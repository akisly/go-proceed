-- One official Telegram bot serves every tenant. Provider identifiers stay
-- bigint in PostgreSQL; adapters turn them into decimal strings at the boundary.

create table public.telegram_chat_bindings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  bot_id bigint not null,
  chat_id bigint not null,
  chat_type text not null check (chat_type in ('group', 'supergroup')),
  title_snapshot text,
  connected_by_member_id uuid not null,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  migrated_from_chat_id bigint,
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  unique (bot_id, chat_id),
  unique (workspace_id, project_id),
  foreign key (workspace_id, project_id)
    references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, connected_by_member_id)
    references public.memberships(organization_id, id),
  check (migrated_from_chat_id is null or migrated_from_chat_id <> chat_id)
);

create table public.telegram_binding_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  requested_by_member_id uuid not null,
  verifier_hash text not null check (verifier_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_telegram_user_id bigint,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (verifier_hash),
  foreign key (workspace_id, project_id)
    references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, requested_by_member_id)
    references public.memberships(organization_id, id),
  check (expires_at > created_at),
  check ((consumed_at is null and consumed_by_telegram_user_id is null)
      or (consumed_at is not null and consumed_by_telegram_user_id is not null))
);

create table public.telegram_member_link_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  member_id uuid not null,
  issued_by_member_id uuid not null,
  verifier_hash text not null check (verifier_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_telegram_user_id bigint,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (verifier_hash),
  foreign key (workspace_id, project_id)
    references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, member_id)
    references public.memberships(organization_id, id),
  foreign key (workspace_id, issued_by_member_id)
    references public.memberships(organization_id, id),
  check (expires_at > created_at),
  check ((consumed_at is null and consumed_by_telegram_user_id is null)
      or (consumed_at is not null and consumed_by_telegram_user_id is not null))
);

create table public.telegram_member_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  member_id uuid not null,
  telegram_user_id bigint not null,
  display_name_snapshot text,
  username_snapshot text,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_seen_at timestamptz,
  linked_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, telegram_user_id),
  unique (workspace_id, member_id),
  foreign key (workspace_id, member_id)
    references public.memberships(organization_id, id),
  foreign key (workspace_id, linked_by_member_id)
    references public.memberships(organization_id, id),
  check (revoked_at is null or revoked_at >= verified_at)
);

-- This is service-plane ingress, before the provider update can be resolved to
-- a tenant. Its raw payload is cleared by complete/fail once normalized.
create table public.telegram_inbox_updates (
  bot_id bigint not null,
  update_id bigint not null,
  payload jsonb,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('pending', 'leased', 'processed', 'failed')),
  available_at timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz,
  leased_by text,
  attempts integer not null default 0 check (attempts >= 0),
  disposition text,
  last_error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (bot_id, update_id),
  check ((state = 'leased') = (lease_id is not null and lease_expires_at is not null)),
  check ((state in ('pending', 'leased')) = (payload is not null)),
  check ((state = 'leased') = (leased_by is not null))
);

create table public.telegram_media_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  telegram_chat_binding_id uuid not null,
  provider_media_group_id text not null,
  uploader_member_id uuid,
  state text not null default 'open' check (state in ('open', 'awaiting_requirement_choice', 'processing', 'completed', 'not_evidence', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  unique (telegram_chat_binding_id, provider_media_group_id),
  foreign key (workspace_id, project_id)
    references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, telegram_chat_binding_id)
    references public.telegram_chat_bindings(workspace_id, project_id, id),
  foreign key (workspace_id, uploader_member_id)
    references public.memberships(organization_id, id),
  check (completed_at is null or completed_at >= created_at)
);

-- Evidence is project-scoped. The original schema exposed only its tenant key;
-- this candidate key makes a communication attachment unable to name evidence
-- from a sibling project in the same workspace.
alter table public.evidence_objects
  add constraint evidence_objects_project_identity_key unique (workspace_id, project_id, id);

create table public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  telegram_chat_binding_id uuid not null,
  direction text not null check (direction in ('inbound', 'outbound', 'system')),
  kind text not null check (kind in ('text', 'photo', 'document', 'assignment_card', 'system', 'unsupported')),
  text text,
  author_member_id uuid,
  provider_user_id bigint,
  provider_display_name_snapshot text,
  provider_username_snapshot text,
  provider_message_id bigint,
  provider_sent_at timestamptz,
  server_received_at timestamptz not null default now(),
  reply_to_message_id uuid,
  provider_reply_to_message_id bigint,
  work_assignment_id uuid,
  delivery_state text not null check (delivery_state in ('received', 'queued', 'provider_accepted', 'failed', 'delivery_unknown')),
  retry_of_message_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id)
    references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, telegram_chat_binding_id)
    references public.telegram_chat_bindings(workspace_id, project_id, id),
  foreign key (workspace_id, author_member_id)
    references public.memberships(organization_id, id),
  foreign key (workspace_id, project_id, reply_to_message_id)
    references public.communication_messages(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, work_assignment_id)
    references public.work_assignments(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, retry_of_message_id)
    references public.communication_messages(workspace_id, project_id, id),
  check (direction <> 'inbound' or delivery_state = 'received'),
  check (direction <> 'outbound' or delivery_state in ('queued', 'provider_accepted', 'failed', 'delivery_unknown')),
  check (retry_of_message_id is null or direction = 'outbound')
);
create unique index communication_messages_provider_identity_uniq
  on public.communication_messages (telegram_chat_binding_id, provider_message_id)
  where provider_message_id is not null;
create index communication_messages_project_timeline_idx
  on public.communication_messages (workspace_id, project_id, server_received_at desc, id desc);

create table public.communication_message_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  message_id uuid not null,
  event_kind text not null check (event_kind in ('edited', 'delivery_state_changed', 'bot_removed', 'bot_restored')),
  text text,
  delivery_state text check (delivery_state in ('received', 'queued', 'provider_accepted', 'failed', 'delivery_unknown')),
  provider_event_at timestamptz,
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id)
    references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, message_id)
    references public.communication_messages(workspace_id, project_id, id),
  check ((event_kind = 'edited' and text is not null and delivery_state is null)
      or (event_kind = 'delivery_state_changed' and text is null and delivery_state is not null)
      or (event_kind in ('bot_removed', 'bot_restored') and text is null and delivery_state is null))
);

create table public.communication_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  message_id uuid not null,
  telegram_media_group_id uuid,
  provider_file_id text,
  provider_file_unique_id text,
  filename_snapshot text,
  media_type_snapshot text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  state text not null check (state in ('unbound', 'awaiting_requirement_choice', 'processing', 'available', 'not_evidence', 'failed')),
  requirement_occurrence_id uuid,
  evidence_object_id uuid,
  failure_code text,
  retry_disposition text,
  created_at timestamptz not null default now(),
  terminal_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id)
    references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, message_id)
    references public.communication_messages(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, telegram_media_group_id)
    references public.telegram_media_groups(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, requirement_occurrence_id)
    references public.requirement_occurrences(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, evidence_object_id)
    references public.evidence_objects(workspace_id, project_id, id),
  check ((state in ('unbound', 'available', 'not_evidence', 'failed') and terminal_at is not null
          and provider_file_id is null and provider_file_unique_id is null)
      or (state not in ('unbound', 'available', 'not_evidence', 'failed') and terminal_at is null)),
  check (state <> 'available' or evidence_object_id is not null),
  check (state <> 'failed' or failure_code is not null)
);

create table public.telegram_requirement_choices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  communication_attachment_id uuid not null,
  telegram_media_group_id uuid,
  chooser_member_id uuid not null,
  requirement_occurrence_id uuid not null,
  chosen_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  unique (workspace_id, communication_attachment_id),
  foreign key (workspace_id, project_id)
    references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, communication_attachment_id)
    references public.communication_attachments(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, telegram_media_group_id)
    references public.telegram_media_groups(workspace_id, project_id, id),
  foreign key (workspace_id, chooser_member_id)
    references public.memberships(organization_id, id),
  foreign key (workspace_id, project_id, requirement_occurrence_id)
    references public.requirement_occurrences(workspace_id, project_id, id)
);

create table public.communication_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  message_id uuid not null,
  attempt_no integer not null check (attempt_no > 0),
  state text not null check (state in ('provider_accepted', 'retryable_rejection', 'definitive_failure', 'delivery_unknown')),
  provider_message_id bigint,
  error_code text,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  unique (workspace_id, message_id, attempt_no),
  foreign key (workspace_id, project_id)
    references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, message_id)
    references public.communication_messages(workspace_id, project_id, id),
  check (completed_at is null or completed_at >= attempted_at),
  check ((state = 'provider_accepted' and provider_message_id is not null and error_code is null)
      or (state <> 'provider_accepted' and provider_message_id is null))
);

create or replace function app.guard_telegram_chat_binding() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.id is distinct from new.id
     or old.workspace_id is distinct from new.workspace_id
     or old.project_id is distinct from new.project_id
     or old.bot_id is distinct from new.bot_id
     or old.connected_by_member_id is distinct from new.connected_by_member_id
     or old.connected_at is distinct from new.connected_at then
    raise exception 'Telegram chat binding identity is immutable';
  end if;
  if old.chat_id is distinct from new.chat_id
     and (new.migrated_from_chat_id is distinct from old.chat_id or old.migrated_from_chat_id is not null) then
    raise exception 'Telegram chat id may change only through one supergroup migration';
  end if;
  return new;
end $$;
revoke all on function app.guard_telegram_chat_binding() from public;
create trigger telegram_chat_bindings_guard
  before update on public.telegram_chat_bindings
  for each row execute function app.guard_telegram_chat_binding();

create or replace function app.guard_communication_message() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'communication message original is immutable; append an event';
  end if;
  if old.workspace_id is distinct from new.workspace_id
     or old.project_id is distinct from new.project_id
     or old.telegram_chat_binding_id is distinct from new.telegram_chat_binding_id
     or old.direction is distinct from new.direction
     or old.kind is distinct from new.kind
     or old.text is distinct from new.text
     or old.author_member_id is distinct from new.author_member_id
     or old.provider_user_id is distinct from new.provider_user_id
     or old.provider_display_name_snapshot is distinct from new.provider_display_name_snapshot
     or old.provider_username_snapshot is distinct from new.provider_username_snapshot
     or old.server_received_at is distinct from new.server_received_at
     or old.reply_to_message_id is distinct from new.reply_to_message_id
     or old.provider_reply_to_message_id is distinct from new.provider_reply_to_message_id
     or old.work_assignment_id is distinct from new.work_assignment_id
     or old.retry_of_message_id is distinct from new.retry_of_message_id
     or old.created_at is distinct from new.created_at then
    raise exception 'communication message original is immutable; append an event';
  end if;
  return new;
end $$;
revoke all on function app.guard_communication_message() from public;
create trigger communication_messages_guard
  before update or delete on public.communication_messages
  for each row execute function app.guard_communication_message();

create trigger communication_message_events_append_only
  before update or delete on public.communication_message_events
  for each row execute function app.reject_mutation();
create trigger telegram_requirement_choices_append_only
  before update or delete on public.telegram_requirement_choices
  for each row execute function app.reject_mutation();
create trigger communication_delivery_attempts_append_only
  before update or delete on public.communication_delivery_attempts
  for each row execute function app.reject_mutation();

-- Exact binding resolution never infers a tenant from a display name or an id
-- carried by webhook callback data.
create or replace function app.resolve_telegram_chat(p_bot_id bigint, p_chat_id bigint)
returns table (workspace_id uuid, project_id uuid, telegram_chat_binding_id uuid, channel_state text)
language sql stable security definer set search_path = '' as $$
  select b.workspace_id, b.project_id, b.id, c.state::text
    from public.telegram_chat_bindings b
    join public.project_field_channels c
      on c.workspace_id = b.workspace_id and c.project_id = b.project_id
   where b.bot_id = p_bot_id and b.chat_id = p_chat_id and b.disconnected_at is null
$$;

create or replace function app.consume_telegram_binding_intent(
  p_verifier_hash text, p_bot_id bigint, p_chat_id bigint, p_chat_type text,
  p_title_snapshot text, p_telegram_user_id bigint
) returns table (workspace_id uuid, project_id uuid, telegram_chat_binding_id uuid, outcome text)
language plpgsql security definer set search_path = '' as $$
declare i public.telegram_binding_intents;
declare b public.telegram_chat_bindings;
begin
  select * into i from public.telegram_binding_intents
   where verifier_hash = p_verifier_hash and consumed_at is null and expires_at > now()
   for update;
  if not found then return; end if;
  if p_chat_type not in ('group', 'supergroup') then
    return query select i.workspace_id, i.project_id, null::uuid, 'wrong_group_type';
    return;
  end if;
  perform 1 from public.project_field_channels c
   where c.workspace_id = i.workspace_id and c.project_id = i.project_id
     and c.channel = 'telegram' and c.state = 'unbound' and c.locked_at is null
   for update;
  if not found then
    return query select i.workspace_id, i.project_id, null::uuid, 'channel_unavailable';
    return;
  end if;
  insert into public.telegram_chat_bindings
    (workspace_id, project_id, bot_id, chat_id, chat_type, title_snapshot, connected_by_member_id)
  values (i.workspace_id, i.project_id, p_bot_id, p_chat_id, p_chat_type, p_title_snapshot, i.requested_by_member_id)
  returning * into b;
  update public.telegram_binding_intents
     set consumed_at = now(), consumed_by_telegram_user_id = p_telegram_user_id
   where id = i.id;
  update public.project_field_channels
     set state = 'connected', last_healthy_at = now(), updated_at = now()
   where workspace_id = i.workspace_id and project_id = i.project_id;
  return query select b.workspace_id, b.project_id, b.id, 'connected';
end $$;

create or replace function app.consume_telegram_member_link_intent(
  p_verifier_hash text, p_telegram_user_id bigint, p_display_name_snapshot text, p_username_snapshot text
) returns table (workspace_id uuid, member_id uuid, telegram_member_link_id uuid, outcome text)
language plpgsql security definer set search_path = '' as $$
declare i public.telegram_member_link_intents;
declare l public.telegram_member_links;
begin
  select * into i from public.telegram_member_link_intents
   where verifier_hash = p_verifier_hash and consumed_at is null and expires_at > now()
   for update;
  if not found then return; end if;
  perform 1 from public.memberships m
   where m.organization_id = i.workspace_id and m.id = i.member_id and m.status = 'active'
   for update;
  if not found then
    return query select i.workspace_id, i.member_id, null::uuid, 'membership_inactive';
    return;
  end if;
  insert into public.telegram_member_links
    (workspace_id, member_id, telegram_user_id, display_name_snapshot, username_snapshot, linked_by_member_id)
  values (i.workspace_id, i.member_id, p_telegram_user_id, p_display_name_snapshot, p_username_snapshot, i.issued_by_member_id)
  on conflict do nothing
  returning * into l;
  if not found then
    return query select i.workspace_id, i.member_id, null::uuid, 'telegram_identity_already_linked';
    return;
  end if;
  update public.telegram_member_link_intents
     set consumed_at = now(), consumed_by_telegram_user_id = p_telegram_user_id
   where id = i.id;
  return query select l.workspace_id, l.member_id, l.id, 'linked';
end $$;

create or replace function app.claim_telegram_inbox(p_batch integer, p_worker text, p_lease_seconds integer)
returns setof public.telegram_inbox_updates
language plpgsql security definer set search_path = '' as $$
begin
  if p_lease_seconds is null or p_lease_seconds not between 1 and 900 then
    raise exception 'lease seconds must be between 1 and 900';
  end if;
  return query
  with picked as (
    select bot_id, update_id from public.telegram_inbox_updates
     where state in ('pending', 'leased') and available_at <= now()
       and (lease_expires_at is null or lease_expires_at < now())
     order by available_at, received_at
     limit greatest(0, least(p_batch, 100))
     for update skip locked
  )
  update public.telegram_inbox_updates i
     set state = 'leased', lease_id = gen_random_uuid(), leased_by = p_worker,
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         attempts = i.attempts + 1, last_error_code = null
    from picked p
   where i.bot_id = p.bot_id and i.update_id = p.update_id
  returning i.*;
end
$$;

create or replace function app.complete_telegram_inbox(
  p_bot_id bigint, p_update_id bigint, p_lease_id uuid, p_disposition text
) returns void
language plpgsql security definer set search_path = '' as $$
declare updated integer;
begin
  update public.telegram_inbox_updates
     set state = 'processed', payload = null, disposition = left(p_disposition, 200),
         processed_at = now(), lease_id = null, lease_expires_at = null, leased_by = null
   where bot_id = p_bot_id and update_id = p_update_id and state = 'leased'
     and lease_id = p_lease_id;
  get diagnostics updated = row_count;
  if updated = 0 then raise exception 'telegram inbox complete rejected: lease mismatch or terminal row'; end if;
end $$;

create or replace function app.fail_telegram_inbox(
  p_bot_id bigint, p_update_id bigint, p_lease_id uuid, p_error_code text
) returns void
language plpgsql security definer set search_path = '' as $$
declare updated integer;
begin
  update public.telegram_inbox_updates
     set state = 'failed', payload = null, last_error_code = left(p_error_code, 200),
         processed_at = now(), lease_id = null, lease_expires_at = null, leased_by = null
   where bot_id = p_bot_id and update_id = p_update_id and state = 'leased'
     and lease_id = p_lease_id;
  get diagnostics updated = row_count;
  if updated = 0 then raise exception 'telegram inbox fail rejected: lease mismatch or terminal row'; end if;
end $$;

create or replace function app.claim_outbox_topic(
  p_topic text, p_batch integer, p_worker text, p_lease_seconds integer
) returns setof public.transaction_outbox
language plpgsql security definer set search_path = '' as $$
begin
  if p_lease_seconds is null or p_lease_seconds not between 1 and 900 then
    raise exception 'lease seconds must be between 1 and 900';
  end if;
  return query
  with picked as (
    select id from public.transaction_outbox
     where topic = p_topic and processed_at is null and available_at <= now()
       and (lease_expires_at is null or lease_expires_at < now())
     order by available_at, created_at
     limit greatest(0, least(p_batch, 100))
     for update skip locked
  )
  update public.transaction_outbox o
     set claimed_by = p_worker, lease_token = gen_random_uuid(),
         lease_expires_at = now() + make_interval(secs => p_lease_seconds)
    from picked p where o.id = p.id
  returning o.*;
end
$$;

revoke all on table public.telegram_chat_bindings, public.telegram_binding_intents,
  public.telegram_member_link_intents, public.telegram_member_links, public.telegram_inbox_updates,
  public.telegram_media_groups, public.communication_messages, public.communication_message_events,
  public.communication_attachments, public.telegram_requirement_choices,
  public.communication_delivery_attempts from public, anon, authenticated, goproceed_app;

grant select on public.telegram_chat_bindings, public.communication_messages,
  public.communication_message_events, public.telegram_media_groups to goproceed_app;
grant select (id, workspace_id, project_id, message_id, telegram_media_group_id,
  filename_snapshot, media_type_snapshot, byte_size, state, requirement_occurrence_id,
  evidence_object_id, failure_code, retry_disposition, created_at, terminal_at)
  on public.communication_attachments to goproceed_app;

grant select, insert, update on public.telegram_chat_bindings, public.telegram_binding_intents,
  public.telegram_member_link_intents, public.telegram_member_links, public.telegram_inbox_updates,
  public.telegram_media_groups, public.communication_messages, public.communication_attachments to goproceed_service;
grant select, insert on public.communication_message_events, public.telegram_requirement_choices,
  public.communication_delivery_attempts to goproceed_service;

alter table public.telegram_chat_bindings enable row level security;
alter table public.telegram_binding_intents enable row level security;
alter table public.telegram_member_link_intents enable row level security;
alter table public.telegram_member_links enable row level security;
alter table public.telegram_inbox_updates enable row level security;
alter table public.telegram_media_groups enable row level security;
alter table public.communication_messages enable row level security;
alter table public.communication_message_events enable row level security;
alter table public.communication_attachments enable row level security;
alter table public.telegram_requirement_choices enable row level security;
alter table public.communication_delivery_attempts enable row level security;

create policy telegram_chat_bindings_read on public.telegram_chat_bindings for select to goproceed_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view', 'project.admin']));
create policy telegram_media_groups_read on public.telegram_media_groups for select to goproceed_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view', 'project.admin']));
create policy communication_messages_read on public.communication_messages for select to goproceed_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view', 'project.admin']));
create policy communication_message_events_read on public.communication_message_events for select to goproceed_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view', 'project.admin']));
create policy communication_attachments_read on public.communication_attachments for select to goproceed_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view', 'project.admin']));

create policy telegram_chat_bindings_service on public.telegram_chat_bindings for all to goproceed_service using (true) with check (true);
create policy telegram_binding_intents_service on public.telegram_binding_intents for all to goproceed_service using (true) with check (true);
create policy telegram_member_link_intents_service on public.telegram_member_link_intents for all to goproceed_service using (true) with check (true);
create policy telegram_member_links_service on public.telegram_member_links for all to goproceed_service using (true) with check (true);
create policy telegram_inbox_updates_service on public.telegram_inbox_updates for all to goproceed_service using (true) with check (true);
create policy telegram_media_groups_service on public.telegram_media_groups for all to goproceed_service using (true) with check (true);
create policy communication_messages_service on public.communication_messages for all to goproceed_service using (true) with check (true);
create policy communication_message_events_service on public.communication_message_events for all to goproceed_service using (true) with check (true);
create policy communication_attachments_service on public.communication_attachments for all to goproceed_service using (true) with check (true);
create policy telegram_requirement_choices_service on public.telegram_requirement_choices for all to goproceed_service using (true) with check (true);
create policy communication_delivery_attempts_service on public.communication_delivery_attempts for all to goproceed_service using (true) with check (true);

revoke all on function app.resolve_telegram_chat(bigint, bigint) from public, anon, authenticated, goproceed_app;
revoke all on function app.consume_telegram_binding_intent(text, bigint, bigint, text, text, bigint) from public, anon, authenticated, goproceed_app;
revoke all on function app.consume_telegram_member_link_intent(text, bigint, text, text) from public, anon, authenticated, goproceed_app;
revoke all on function app.claim_telegram_inbox(integer, text, integer) from public, anon, authenticated, goproceed_app;
revoke all on function app.complete_telegram_inbox(bigint, bigint, uuid, text) from public, anon, authenticated, goproceed_app;
revoke all on function app.fail_telegram_inbox(bigint, bigint, uuid, text) from public, anon, authenticated, goproceed_app;
revoke all on function app.claim_outbox_topic(text, integer, text, integer) from public, anon, authenticated, goproceed_app;
grant execute on function app.resolve_telegram_chat(bigint, bigint) to goproceed_service;
grant execute on function app.consume_telegram_binding_intent(text, bigint, bigint, text, text, bigint) to goproceed_service;
grant execute on function app.consume_telegram_member_link_intent(text, bigint, text, text) to goproceed_service;
grant execute on function app.claim_telegram_inbox(integer, text, integer) to goproceed_service;
grant execute on function app.complete_telegram_inbox(bigint, bigint, uuid, text) to goproceed_service;
grant execute on function app.fail_telegram_inbox(bigint, bigint, uuid, text) to goproceed_service;
grant execute on function app.claim_outbox_topic(text, integer, text, integer) to goproceed_service;
