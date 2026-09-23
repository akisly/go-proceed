-- DEV-029 / ADR-013. Product-owned illustrations are provisioned by an operator
-- from a licensed manifest. No browser or BFF role may publish or replace bytes.
-- Existing rules and occurrences remain null; no historical content is changed.
create table public.requirement_reference_image_versions (
  id uuid primary key,
  workspace_id uuid not null references public.organizations(id),
  requirement_library_item_id uuid not null,
  version_no integer not null check (version_no > 0),
  storage_bucket text not null default 'requirement-reference-images'
    check (storage_bucket = 'requirement-reference-images'),
  storage_key text not null unique
    check (storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check (byte_size between 1 and 5242880),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  width integer not null check (width between 1 and 8192),
  height integer not null check (height between 1 and 8192),
  alt_text_uk text not null check (length(btrim(alt_text_uk)) between 1 and 500),
  rights_holder text not null check (btrim(rights_holder) <> ''),
  license text not null check (btrim(license) <> ''),
  source_uri text not null check (source_uri ~ '^https://'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  published_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, requirement_library_item_id, id),
  unique (workspace_id, requirement_library_item_id, version_no),
  foreign key (workspace_id, requirement_library_item_id)
    references public.requirement_library_items(workspace_id, id)
);
alter table public.requirement_reference_image_versions enable row level security;
revoke all on public.requirement_reference_image_versions from public, anon, authenticated,
  goproceed_app, goproceed_service, goproceed_worker;
grant select on public.requirement_reference_image_versions to goproceed_app;
create policy rriv_select on public.requirement_reference_image_versions
  for select to goproceed_app using (app.active_member_id(workspace_id) is not null);
create trigger requirement_reference_image_versions_immutable before update or delete
  on public.requirement_reference_image_versions for each row execute function app.reject_mutation();

alter table public.requirement_rule_versions
  add column reference_image_version_id uuid,
  add constraint rrv_reference_requires_library check
    (reference_image_version_id is null or requirement_library_item_id is not null),
  add constraint rrv_reference_image_fkey
    foreign key (workspace_id, requirement_library_item_id, reference_image_version_id)
    references public.requirement_reference_image_versions(workspace_id, requirement_library_item_id, id),
  add constraint rrv_reference_pin_unique unique (workspace_id, id, reference_image_version_id);

alter table public.requirement_occurrences
  add column reference_image_version_id uuid,
  add constraint ro_reference_image_fkey foreign key (workspace_id, reference_image_version_id)
    references public.requirement_reference_image_versions(workspace_id, id),
  add constraint ro_reference_rule_pin_fkey foreign key (workspace_id, rule_version_id, reference_image_version_id)
    references public.requirement_rule_versions(workspace_id, id, reference_image_version_id);

-- Insert-only guard: old null pins can still be retired. The existing frozen
-- JSON comparison on rule UPDATE automatically includes this new column.
create function app.guard_rule_reference_image() returns trigger
  language plpgsql set search_path = '' as $$
declare latest uuid;
begin
  if new.requirement_library_item_id is null then
    if new.reference_image_version_id is not null then
      raise exception 'reference image requires library source' using errcode = '23514';
    end if;
    return new;
  end if;
  -- Let the existing tenant FK / RLS own an invisible or absent library row.
  perform 1 from public.requirement_library_items
    where workspace_id = new.workspace_id and id = new.requirement_library_item_id;
  if not found then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'reference-image|' || new.workspace_id::text || '|' || new.requirement_library_item_id::text, 0));
  select id into latest from public.requirement_reference_image_versions
    where workspace_id = new.workspace_id
      and requirement_library_item_id = new.requirement_library_item_id
    order by version_no desc limit 1;
  if latest is null or new.reference_image_version_id is distinct from latest then
    raise exception 'new library rule requires latest published reference image' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function app.guard_rule_reference_image() from public, anon, authenticated;
create trigger requirement_rule_reference_image_guard before insert
  on public.requirement_rule_versions for each row execute function app.guard_rule_reference_image();

-- Composite FKs skip nulls. This guard closes exactly that gap: legacy null
-- must stay null and a non-null rule pin cannot be omitted by materialisation.
create function app.guard_occurrence_reference_image() returns trigger
  language plpgsql set search_path = '' as $$
declare pinned uuid;
begin
  select reference_image_version_id into pinned from public.requirement_rule_versions
    where workspace_id = new.workspace_id and id = new.rule_version_id;
  -- The pre-existing rule FK / RLS still refuses absent or invisible parents.
  if not found then return new; end if;
  if new.reference_image_version_id is distinct from pinned then
    raise exception 'occurrence reference image differs from pinned rule' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function app.guard_occurrence_reference_image() from public, anon, authenticated;
create trigger requirement_occurrence_reference_image_guard before insert
  on public.requirement_occurrences for each row execute function app.guard_occurrence_reference_image();

-- Private, inert raster content only. No storage.objects policy grants a
-- client access; the authorized occurrence proxy uses the server credential.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('requirement-reference-images','requirement-reference-images',false,5242880,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

do $$ begin
  if exists (select 1 from storage.buckets where id = 'requirement-reference-images'
    and (public or file_size_limit is distinct from 5242880::bigint
      or allowed_mime_types is distinct from array['image/jpeg','image/png','image/webp'])) then
    raise exception '0090: reference image bucket has incompatible security settings';
  end if;
end $$;
