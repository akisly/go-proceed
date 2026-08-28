-- 0059: the requirement a site supplies from its own робоча документація.
--
-- WHAT THIS ADDS
--   one table — public.project_sourced_requirement_items — holding the
--   requirement text a workspace takes from the working documentation of one
--   of its own projects, together with the sheet and drawing number that
--   identify where it came from; its grants, RLS and the trigger that admits
--   exactly one transition; and one SECURITY DEFINER archive command,
--   app.archive_project_sourced_requirement_item(uuid, uuid). It also adds
--   public.requirement_rule_versions.project_sourced_requirement_item_id — the
--   second provenance a rule version may cite, exclusive with the first.
--
--   ADDED 2026-08-27 (fix round 1, Task 11 review finding 1): a second
--   SECURITY DEFINER helper, app.project_in_workspace(uuid, uuid) — see §4.
--   project_requirements.create's own tenant-boundary check must not be a
--   plain RLS-scoped select against public.projects, because projects_select
--   answers whether THIS member may see THIS project's contents, and
--   project_requirements.manage is a workspace capability that grants no such
--   per-project access on its own.
--
-- WHAT THIS DOES NOT CHANGE
--   No table is dropped. No column is dropped. Migrations 0001-0058 are applied
--   history and are not edited. The only existing objects altered are two CHECK
--   constraints — requirement_rule_versions.norm_ref_verification and
--   requirement_occurrences.norm_ref_verification — and both are WIDENED by one
--   value, so every row that satisfied them still does.
--   public.requirement_library_items IS NOT TOUCHED: it keeps its Н.14/Н.15
--   position CHECK, its item_no extent CHECK and its two-value verification
--   CHECK, so nothing this migration adds can put a line into Додаток Н.
--   public.statutory_act_versions is not touched either — §3 says why.
--
-- ROLLBACK (dev only)
--   Only while the new table is still empty and no rule version cites the new
--   column:
--     alter table public.requirement_rule_versions
--       drop constraint requirement_rule_versions_one_provenance_check,
--       drop constraint requirement_rule_versions_project_sourced_fkey,
--       drop column project_sourced_requirement_item_id;
--     alter table public.requirement_occurrences
--       drop constraint requirement_occurrences_norm_ref_verification_check,
--       add constraint requirement_occurrences_norm_ref_verification_check
--         check (norm_ref_verification in ('VERIFIED_PRIMARY','VERIFIED_SECONDARY'));
--     alter table public.requirement_rule_versions
--       drop constraint requirement_rule_versions_norm_ref_verification_check,
--       add constraint requirement_rule_versions_norm_ref_verification_check
--         check (norm_ref_verification in ('VERIFIED_PRIMARY','VERIFIED_SECONDARY'));
--     drop trigger project_sourced_requirement_items_guard
--       on public.project_sourced_requirement_items;
--     drop table public.project_sourced_requirement_items;
--     drop function app.guard_project_sourced_requirement_item();
--     drop function app.archive_project_sourced_requirement_item(uuid, uuid);
--   app.project_in_workspace(uuid, uuid) (§4) reads and writes nothing and may
--   be dropped at any time, independent of the above:
--     drop function app.project_in_workspace(uuid, uuid);
--   Once a workspace has authored one item, a published rule version may
--   already cite it, and a published baseline is immutable — so the citation
--   cannot be re-derived from anything and there is no rollback. Re-narrowing
--   either CHECK would then also fail its own validation scan against the rows
--   already tagged PROJECT_DOCUMENTATION. Staging and production take a
--   corrective forward migration instead.
--
-- ---------------------------------------------------------------------------
-- ROLE NAMES. Migration 0057 renamed aktflow_* to goproceed_*. This is the
-- first table created after that rename, so the grants and policies below name
-- goproceed_app; every worked example in 0041-0043 still reads aktflow_app and
-- is history, not a template to copy verbatim.

-- ===========================================================================
-- 1. project_sourced_requirement_items — what a site's own documentation says
--
-- ДБН А.3.1-5:2016 п. 8.4.3.3: the binding hidden-works list for a site comes
-- from робоча документація, and Додаток Н is довідковий
-- (hidden-works-content-rules.md allow-list item 8). ADR-010 lets a workspace
-- author from that documentation.
--
-- THIS IS NOT THE LIBRARY AND MUST NEVER BECOME IT. requirement_library_items
-- keeps its Н.14/Н.15 CHECK, its item_no extent CHECK and its two-value
-- verification CHECK, and this migration does not touch that table. A row here
-- can never add a line to Н.15 because it is not in that relation.
-- ===========================================================================
create table public.project_sourced_requirement_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,

  item_text_uk text not null
    check ((length(btrim(item_text_uk, E' \t\n\r\f\v\u00A0')) > 0)),

  -- INV-073's source half, made structural. «Робоча документація» without a
  -- sheet and a drawing number is a word, not a source (ADR-010 decision 3),
  -- so the three identifying fields are NOT NULL and non-blank rather than one
  -- free-text citation column.
  source_document text not null
    check ((length(btrim(source_document, E' \t\n\r\f\v\u00A0')) > 0)),
  source_sheet text not null
    check ((length(btrim(source_sheet, E' \t\n\r\f\v\u00A0')) > 0)),
  source_drawing_no text not null
    check ((length(btrim(source_drawing_no, E' \t\n\r\f\v\u00A0')) > 0)),
  source_revision text
    check (source_revision is null
        or (length(btrim(source_revision, E' \t\n\r\f\v\u00A0')) > 0)),

  -- INV-073's tag half. One storable value, the normative_character pattern:
  -- a row cannot claim a verification the product never performed.
  verification text not null
    check (verification = 'PROJECT_DOCUMENTATION'),

  status text not null default 'active'
    check (status in ('active','archived')),

  created_at timestamptz not null default now(),
  created_by_member_id uuid not null,
  archived_at timestamptz,
  archived_by_member_id uuid,

  unique (workspace_id, id),
  foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  -- memberships predates the workspace_id naming convention: its tenant column
  -- is organization_id and that is what the composite FK must name.
  foreign key (workspace_id, created_by_member_id)
    references public.memberships (organization_id, id),
  foreign key (workspace_id, archived_by_member_id)
    references public.memberships (organization_id, id),

  constraint project_sourced_requirement_items_archived_check
    check (status = 'active'
        or (archived_at is not null and archived_by_member_id is not null))
);

create index project_sourced_requirement_items_project_idx
  on public.project_sourced_requirement_items (workspace_id, project_id)
  where status = 'active';

comment on table public.project_sourced_requirement_items is
  'Requirement text a workspace takes from its own робоча документація for one '
  'project, with the sheet and drawing number that identify it. Never a ДБН '
  'extract and never rendered inside a Додаток Н block '
  '(docs/product/hidden-works-content-rules.md §"Project-sourced strings"). '
  'Text and citation are immutable; a correction is a new row plus an archive '
  'of the old one.';

-- ===========================================================================
-- 2. Grants, RLS, and the one admissible transition
--
-- Route by route, so an unused grant is visible:
--   project_sourced_requirement_items  SELECT  project_requirements.list,
--                                              the publish route's source read
--                                      INSERT  project_requirements.create
-- There is deliberately NO UPDATE grant. Archiving goes through the definer
-- function below, for the reason 0041 §7 gives about retirement: the
-- application role never holds the privilege that would make immutability a
-- convention.
-- ===========================================================================
revoke all on public.project_sourced_requirement_items
  from public, anon, authenticated;
grant select, insert on public.project_sourced_requirement_items to goproceed_app;

alter table public.project_sourced_requirement_items enable row level security;

-- Any active member reads, for the reason rli_select gives: the foreman who
-- reads an occurrence reads the text behind it, and the text reaches him
-- through a rule version that is already member-readable.
create policy psri_select on public.project_sourced_requirement_items
  for select to goproceed_app
  using (app.active_member_id(workspace_id) is not null);

-- Owner/admin writes — the same role mapping packages/domain/src/authz.ts uses
-- for workspace capabilities, which is where project_requirements.manage lands.
create policy psri_insert on public.project_sourced_requirement_items
  for insert to goproceed_app
  with check (app.member_role(workspace_id) in ('owner','admin'));

-- The guard is a hybrid of app.reject_mutation() (0013) and
-- app.guard_requirement_rule_version() (0041): DELETE is refused outright, and
-- the only admissible UPDATE is active -> archived setting exactly the two
-- archival columns. The content comparison is whole-row rather than
-- column-by-column, so a column added by a later migration is frozen from the
-- moment it exists without anybody remembering to extend a list.
create or replace function app.guard_project_sourced_requirement_item()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'project-sourced requirement items are not deletable';
  end if;

  if old.status <> 'active' or new.status <> 'archived' then
    raise exception
      'project-sourced requirement item % admits only the active -> archived transition; attempted % -> %',
      old.id, old.status, new.status;
  end if;

  if new.archived_at is null or new.archived_by_member_id is null then
    raise exception 'archiving item % must record archived_at and the archiving member', old.id;
  end if;

  if (to_jsonb(new) - 'status'::text - 'archived_at'::text - 'archived_by_member_id'::text)
     is distinct from
     (to_jsonb(old) - 'status'::text - 'archived_at'::text - 'archived_by_member_id'::text) then
    raise exception 'archiving must not alter the requirement text or its citation';
  end if;

  return new;
end $$;
revoke all on function app.guard_project_sourced_requirement_item() from public;

create trigger project_sourced_requirement_items_guard
  before update or delete on public.project_sourced_requirement_items
  for each row execute function app.guard_project_sourced_requirement_item();

-- The only write path for the transition. SECURITY DEFINER bypasses RLS, so
-- authorization is this function's own job; it runs BEFORE anything is read so
-- a raise message cannot become a cross-tenant oracle, and the actor comes from
-- app.active_member_id and never from an argument. search_path is the strict
-- form 0051 established, with fully-qualified names.
create or replace function app.archive_project_sourced_requirement_item(
  p_workspace uuid, p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
  v_status text;
begin
  v_member := app.active_member_id(p_workspace);
  if v_member is null or app.member_role(p_workspace) not in ('owner','admin') then
    raise exception 'not authorized to archive a project-sourced requirement item in this workspace';
  end if;

  select status into v_status
    from public.project_sourced_requirement_items
   where workspace_id = p_workspace and id = p_item;

  if v_status is null then
    raise exception 'unknown project-sourced requirement item';
  end if;
  -- Idempotent by state: the operation is idempotency-required in
  -- scope-v0.1.csv and a replay must not raise.
  if v_status = 'archived' then
    return;
  end if;

  -- COMPARE-AND-SWAP, not a plain UPDATE: two concurrent calls to
  -- app.archive_project_sourced_requirement_item can both pass the status read
  -- above, and the loser then re-evaluates this WHERE against the winner's
  -- committed row — so `status = 'active'` is what makes it match nothing
  -- instead of re-stamping archived_at and the archivist with its own.
  update public.project_sourced_requirement_items
     set status = 'archived', archived_at = now(), archived_by_member_id = v_member
   where workspace_id = p_workspace and id = p_item and status = 'active';
end $$;
revoke all on function app.archive_project_sourced_requirement_item(uuid, uuid) from public;
grant execute on function app.archive_project_sourced_requirement_item(uuid, uuid) to goproceed_app;

-- ===========================================================================
-- 3. The vocabulary widens by one value, in the two places a tag travels
--
-- A WIDENING. Every value previously accepted is still accepted, so the
-- re-added constraints are validated against existing rows and cannot fail on
-- them.
--
-- WHY TWO AND NOT ONE. A rule version's norm_ref_verification is COPIED into
-- requirement_occurrences at materialisation (apps/app/src/lib/occurrence-writer.ts,
-- materialiseOccurrences). Widening only the rule-version CHECK would leave a
-- publish that succeeds and an assignment creation that raises 23514.
--
-- WHY NOT THE OTHER TWO. requirement_library_items.verification stays
-- two-valued: the seeded Додаток Н set never carries this tag, and making it
-- storable there would let authoring corrupt the verified set.
-- statutory_act_versions.form_citation_verification stays two-valued because it
-- tags the ACT FORM's own citation, which is Додаток В whatever the
-- requirement's source is (0047 §"INV-073, storage half").
--
-- NOT `drop constraint if exists`: a name mismatch would skip silently and
-- leave the narrow constraint in place, still refusing. One `alter table` per
-- table, comma-separated, so there is no window in which neither exists.
-- ===========================================================================
alter table public.requirement_rule_versions
  drop constraint requirement_rule_versions_norm_ref_verification_check,
  add constraint requirement_rule_versions_norm_ref_verification_check
    check (norm_ref_verification in
      ('VERIFIED_PRIMARY','VERIFIED_SECONDARY','PROJECT_DOCUMENTATION'));

alter table public.requirement_occurrences
  drop constraint requirement_occurrences_norm_ref_verification_check,
  add constraint requirement_occurrences_norm_ref_verification_check
    check (norm_ref_verification in
      ('VERIFIED_PRIMARY','VERIFIED_SECONDARY','PROJECT_DOCUMENTATION'));

-- The second provenance. requirement_library_item_id was already nullable
-- because making it NOT NULL would have baked v0.1 into the schema; this column
-- is its sibling and the CHECK below is what makes them exclusive.
--
-- No edit to app.guard_requirement_rule_version() is needed: it compares
-- to_jsonb(new) against to_jsonb(old) with four keys subtracted rather than
-- enumerating columns, so this column is frozen from the moment it exists.
alter table public.requirement_rule_versions
  add column project_sourced_requirement_item_id uuid,
  add constraint requirement_rule_versions_project_sourced_fkey
    foreign key (workspace_id, project_sourced_requirement_item_id)
    references public.project_sourced_requirement_items (workspace_id, id),
  add constraint requirement_rule_versions_one_provenance_check
    check (requirement_library_item_id is null
        or project_sourced_requirement_item_id is null);

-- ===========================================================================
-- 4. app.project_in_workspace — ADDED 2026-08-27, fix round 1 on Task 11
--
-- THE TRAP THIS CLOSES. project_requirements.create resolves the caller's
-- projectId against public.projects while running as goproceed_app, which is
-- subject to RLS. projects_select (0011) is
-- `using (app.has_project_capability(workspace_id, id,
-- array['project.view','project.admin']))`, and that predicate reads
-- project_access_grants — it answers "may THIS member see THIS project's
-- contents", never "does this project belong to this workspace". INV-019
-- auto-grants project.admin and project.view to a project's CREATOR alone at
-- creation time and infers access for nobody else afterwards. A route that
-- asks projects_select's question in place of the tenant question it actually
-- has therefore answers "not found" for a real project in the caller's own
-- workspace, to every owner or admin who did not happen to create it —
-- although project_requirements.manage is a WORKSPACE capability (ADR-010
-- decision 5) and the project mark on a requirement item is metadata
-- identifying where the requirement came from, never an access boundary
-- (ADR-010 decision 4).
--
-- THE QUESTION THIS FUNCTION ANSWERS INSTEAD is the narrow one the route
-- actually needs: does this project id belong to this workspace, full stop,
-- independent of any per-project grant. SECURITY DEFINER so the query runs
-- outside projects_select rather than being filtered by it — the same reason
-- app.active_member_id and app.project_has_grants (0011) bypass RLS on the
-- tables they answer about. The return is a bare boolean with no row data, so
-- a caller learns tenancy and nothing about the project's own columns; a
-- refusal built on it is non-oracle the same way the route's caller-facing
-- comment already promises — false for a foreign project and false for an
-- absent one, indistinguishably. search_path is 0051's strict form (every
-- reference schema-qualified) rather than 0011's older `= public`, matching
-- this migration's own functions in §2.
create or replace function app.project_in_workspace(p_workspace uuid, p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.projects
     where workspace_id = p_workspace and id = p_project)
$$;
revoke all on function app.project_in_workspace(uuid, uuid) from public;
grant execute on function app.project_in_workspace(uuid, uuid) to goproceed_app;
