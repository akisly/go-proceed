-- The identity that asked to be forgotten.
--
-- WHAT THIS ADDS. A way to forget one Telegram identity on request, and a
-- way to forget by age once the owner names the durations. Five sections:
--   1. app.telegram_erasures — the surrogate registry — and
--      app.retention_policy, seeded with three NULL durations (inert);
--   2. app.guard_communication_message learns to recognise exactly one
--      transformation — pseudonym plus redaction — and refuses everything
--      else as before, admitting it under both transaction-local markers;
--   3. app.guard_communication_message_event — the analogous admission for
--      edit events, under the surrogate marker alone, leaving
--      app.reject_mutation untouched for audit_events;
--   4. app.erase_telegram_identity — the definer the operator calls — and the
--      owner-only helpers it is built from;
--   5. app.apply_communication_retention and its pg_cron schedule.
--
-- WHAT THIS DOES NOT CHANGE. No public table gains a column or loses a
-- constraint. DA-148's column grant on communication_attachments and INV-094
-- stand. The immutability of communication_messages stands for every UPDATE
-- that is not the one transformation §2 names.
--
-- WHY SCHEMA app. The registry and the policy are not tenant data and must
-- never be member-readable. Schema app is where the service plane's functions
-- live; a table here has no public grant, no policy and no entity-catalog row
-- (scripts/validate-canonical-docs.mjs counts tables from `create table
-- public.` only). These are the first tables in app.
--
-- ROLLBACK (dev only): drop function app.apply_communication_retention,
-- app.erase_telegram_identity, app.erase_telegram_identity_internal,
-- app.write_erasure_audit, app.guard_communication_message_event; recreate
-- the events trigger on app.reject_mutation; restore
-- app.guard_communication_message from 0070; drop the two tables;
-- cron.unschedule('communication-retention'). Rows already erased are not
-- restorable, by design.

-- ===========================================================================
-- 1. The registry and the policy
-- ===========================================================================

create table if not exists app.telegram_erasures (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.organizations(id),
  subject_hmac      text check (subject_hmac ~ '^[0-9a-f]{64}$'),
  surrogate_user_id bigint not null check (surrogate_user_id < 0),
  origin            text not null check (origin in ('data_subject_request', 'retention')),
  erased_at         timestamptz not null default now(),
  messages_count    integer not null default 0,
  events_count      integer not null default 0,
  links_count       integer not null default 0,
  attachments_count integer not null default 0,
  unique (workspace_id, surrogate_user_id),
  unique (workspace_id, subject_hmac),
  check ((origin = 'data_subject_request') = (subject_hmac is not null))
);
comment on table app.telegram_erasures is
  'One row per erased Telegram identity per workspace. subject_hmac is an HMAC the application computed under its pepper; the original identifier is stored nowhere. Reachable through app.erase_telegram_identity only.';
alter table app.telegram_erasures enable row level security;
revoke all on table app.telegram_erasures from public, anon, authenticated, goproceed_app, goproceed_service;

create table if not exists app.retention_policy (
  data_class text primary key
    check (data_class in ('customer_communication', 'customer_identity', 'operational_security')),
  duration   interval check (duration is null or duration > interval '0'),
  updated_at timestamptz not null default now()
);
comment on table app.retention_policy is
  'Retention durations per data class of technical/data-retention-catalog.csv. NULL means no retention runs for that class. A duration lands by a migration that updates one row.';
insert into app.retention_policy (data_class, duration) values
  ('customer_communication', null), ('customer_identity', null), ('operational_security', null)
on conflict (data_class) do nothing;
alter table app.retention_policy enable row level security;
revoke all on table app.retention_policy from public, anon, authenticated, goproceed_app, goproceed_service;

-- ===========================================================================
-- 2. The message guard learns one transformation
--
-- The guard from 0070 stands: DELETE raises, and any change to the columns it
-- names raises. One shape is now admitted before that comparison — the
-- redaction app.erase_telegram_identity performs — and only under two
-- transaction-local markers the definer sets and clears:
--   app.erasure_subject    the row's current provider_user_id, as text
--   app.erasure_surrogate  the value it becomes, as text
-- The branch requires BOTH the old and the new identifier to match the
-- markers, both snapshots to become NULL, the text to become the marker where
-- it was set and to stay NULL where it was NULL, and every other guarded
-- column to be unchanged. A definer that touched any other column would raise
-- here, which is what packages/testing/src/telegram-erasure.test.ts §2 pins.
-- Outbound messages authored by members carry provider_user_id NULL and can
-- never match the branch.
-- ===========================================================================

create or replace function app.guard_communication_message() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'communication message original is immutable; append an event';
  end if;

  if coalesce(current_setting('app.erasure_subject', true), '') <> ''
     and old.provider_user_id is not null
     and old.provider_user_id::text = current_setting('app.erasure_subject', true)
     and new.provider_user_id::text = coalesce(current_setting('app.erasure_surrogate', true), '')
     and new.provider_display_name_snapshot is null
     and new.provider_username_snapshot is null
     and new.text is not distinct from
         (case when old.text is null then null else '[текст стерто на запит]' end)
     and old.id is not distinct from new.id
     and old.workspace_id is not distinct from new.workspace_id
     and old.project_id is not distinct from new.project_id
     and old.telegram_chat_binding_id is not distinct from new.telegram_chat_binding_id
     and old.direction is not distinct from new.direction
     and old.kind is not distinct from new.kind
     and old.author_member_id is not distinct from new.author_member_id
     and old.server_received_at is not distinct from new.server_received_at
     and old.reply_to_message_id is not distinct from new.reply_to_message_id
     and old.provider_reply_to_message_id is not distinct from new.provider_reply_to_message_id
     and old.work_assignment_id is not distinct from new.work_assignment_id
     and old.retry_of_message_id is not distinct from new.retry_of_message_id
     and old.telegram_reply_markup is not distinct from new.telegram_reply_markup
     and old.telegram_occurrence_snapshot is not distinct from new.telegram_occurrence_snapshot
     and old.telegram_evidence_receipt_key is not distinct from new.telegram_evidence_receipt_key
     and old.telegram_evidence_copy_key is not distinct from new.telegram_evidence_copy_key
     and old.telegram_evidence_source_attachment_id is not distinct from new.telegram_evidence_source_attachment_id
     and old.telegram_evidence_source_media_group_id is not distinct from new.telegram_evidence_source_media_group_id
     and old.telegram_evidence_generation is not distinct from new.telegram_evidence_generation
     and old.telegram_evidence_chunk_index is not distinct from new.telegram_evidence_chunk_index
     and old.telegram_evidence_recipient_member_id is not distinct from new.telegram_evidence_recipient_member_id
     and old.created_at is not distinct from new.created_at then
    return new;
  end if;

  if old.id is distinct from new.id
     or old.workspace_id is distinct from new.workspace_id
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
     or old.telegram_reply_markup is distinct from new.telegram_reply_markup
     or old.telegram_occurrence_snapshot is distinct from new.telegram_occurrence_snapshot
     or old.telegram_evidence_receipt_key is distinct from new.telegram_evidence_receipt_key
     or old.telegram_evidence_copy_key is distinct from new.telegram_evidence_copy_key
     or old.telegram_evidence_source_attachment_id is distinct from new.telegram_evidence_source_attachment_id
     or old.telegram_evidence_source_media_group_id is distinct from new.telegram_evidence_source_media_group_id
     or old.telegram_evidence_generation is distinct from new.telegram_evidence_generation
     or old.telegram_evidence_chunk_index is distinct from new.telegram_evidence_chunk_index
     or old.telegram_evidence_recipient_member_id is distinct from new.telegram_evidence_recipient_member_id
     or old.created_at is distinct from new.created_at then
    raise exception 'communication message original is immutable; append an event';
  end if;
  return new;
end $$;

-- ===========================================================================
-- 3. A guard of its own for edit events
--
-- communication_message_events was append-only through app.reject_mutation,
-- the function 0006 gave audit_events and that three tables share. The
-- function stays as it is — audit_events keeps it — and the events table gets
-- its own guard: the same refusal, plus one admitted shape. An edited event's
-- text may become the marker when the parent message already carries the
-- surrogate named in app.erasure_surrogate and no other column changes. The
-- parent is checked by surrogate, which is why app.erase_telegram_identity
-- rewrites messages before events.
-- ===========================================================================

create or replace function app.guard_communication_message_event() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(current_setting('app.erasure_surrogate', true), '') <> ''
     and old.event_kind = 'edited'
     and new.text = '[текст стерто на запит]'
     and exists (select 1 from public.communication_messages m
                  where m.id = old.message_id
                    and m.provider_user_id::text = current_setting('app.erasure_surrogate', true))
     and old.id is not distinct from new.id
     and old.workspace_id is not distinct from new.workspace_id
     and old.project_id is not distinct from new.project_id
     and old.message_id is not distinct from new.message_id
     and old.event_kind is not distinct from new.event_kind
     and old.delivery_state is not distinct from new.delivery_state
     and old.provider_event_at is not distinct from new.provider_event_at
     and old.server_received_at is not distinct from new.server_received_at
     and old.created_at is not distinct from new.created_at
     and old.provider_update_id is not distinct from new.provider_update_id then
    return new;
  end if;
  raise exception 'append-only relation %.% cannot be % (correct via successor fact)',
    tg_table_schema, tg_table_name, lower(tg_op);
end $$;

drop trigger if exists communication_message_events_append_only on public.communication_message_events;
create trigger communication_message_events_append_only
  before update or delete on public.communication_message_events
  for each row execute function app.guard_communication_message_event();

-- ===========================================================================
-- 4. The erasure
--
-- Three functions. write_erasure_audit inserts the audit row the way
-- app.record_service_audit would — actor_type 'system', no actor — without
-- that function's pg_has_role gate, because §5's retention job runs as the
-- database owner under pg_cron and could not pass it. erase_telegram_identity_
-- internal is the transformation: registry, markers, the updates the guards
-- require, audit, markers cleared — gated by a scope. Scope 'all' (the
-- request path, always) runs every rewrite. Scope 'communication' runs only
-- the messages/events/attachment-filename rewrite; scope 'identity' runs
-- only the member-link rewrite. Retention confines each data class to its
-- own catalog tables this way — customer_communication never touches
-- telegram_member_links (an active link is operational, never aged out by
-- spec §7.5), and customer_identity never touches messages, events, or
-- attachments — while the registry allocation, the markers, the
-- pending-updates count, and the audit row run for every scope regardless; a
-- step the scope skips simply counts zero. erase_telegram_identity is the
-- one callable surface, for the service principal, with the origin fixed to
-- a data-subject request, the scope fixed to 'all', and the declared
-- workspace checked — never set — against app.service_workspace(), the same
-- shape app.record_service_audit uses for its own workspace argument. Only
-- that last function has an EXECUTE grant.
-- ===========================================================================

create or replace function app.write_erasure_audit(
  p_workspace uuid, p_surrogate bigint, p_details jsonb, p_reason text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events
    (organization_id, actor_user_id, actor_type, action, object_type, object_id,
     request_id, details, object_version, reason_code)
  values (p_workspace, null, 'system', 'telegram_identity.erased', 'telegram_identity',
          p_surrogate::text, gen_random_uuid()::text, p_details, null, p_reason);
end $$;
revoke all on function app.write_erasure_audit(uuid, bigint, jsonb, text) from public, anon, authenticated, goproceed_app, goproceed_service;

drop function if exists app.erase_telegram_identity_internal(uuid, bigint, text, text);

create or replace function app.erase_telegram_identity_internal(
  p_workspace uuid, p_telegram_user_id bigint, p_subject_hmac text, p_origin text, p_scope text
) returns table (
  surrogate_user_id bigint, messages bigint, events bigint, links bigint,
  attachments bigint, pending_updates_for_subject bigint, already_erased boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  v_surrogate bigint;
  v_existed boolean := false;
  v_messages bigint := 0; v_events bigint := 0; v_links bigint := 0; v_attachments bigint := 0;
  v_pending bigint := 0;
  v_try integer;
begin
  if p_telegram_user_id is null or p_telegram_user_id <= 0 then
    raise exception 'erasure needs a real Telegram identifier';
  end if;
  if p_origin not in ('data_subject_request', 'retention') then
    raise exception 'erasure origin must be data_subject_request or retention';
  end if;
  if (p_origin = 'data_subject_request') <> (p_subject_hmac is not null) then
    raise exception 'a data-subject request carries an HMAC and a retention run carries none';
  end if;
  if p_scope not in ('all', 'communication', 'identity') then
    raise exception 'unknown erasure scope %', p_scope;
  end if;

  -- The registry. A request re-run finds its surrogate by HMAC; a retention
  -- run has no HMAC and always registers afresh.
  if p_subject_hmac is not null then
    select e.surrogate_user_id into v_surrogate
      from app.telegram_erasures e
     where e.workspace_id = p_workspace and e.subject_hmac = p_subject_hmac;
    v_existed := found;
  end if;
  if v_surrogate is null then
    for v_try in 1..8 loop
      v_surrogate := -(1 + floor(random() * 4611686018427387903))::bigint;
      exit when not exists (select 1 from app.telegram_erasures e
                             where e.workspace_id = p_workspace and e.surrogate_user_id = v_surrogate);
      v_surrogate := null;
    end loop;
    if v_surrogate is null then raise exception 'could not allocate a surrogate identifier'; end if;
    insert into app.telegram_erasures (workspace_id, subject_hmac, surrogate_user_id, origin)
    values (p_workspace, p_subject_hmac, v_surrogate, p_origin);
  end if;

  -- I2: the surrogate is now known but nothing has been written yet. A
  -- person can link again after an earlier erasure (a new
  -- telegram_member_links row, raw telegram_user_id) and then be erased
  -- again; the same HMAC yields the same surrogate, and the links UPDATE
  -- below would try to give the new row the surrogate the old row already
  -- holds, colliding on telegram_member_links' unique (workspace_id,
  -- telegram_user_id) with a bare 23505. Checked here, before any write of
  -- this call (including the messages UPDATE, which precedes the links
  -- UPDATE for scope 'all'), so the whole transaction rolls back with a
  -- clear, actionable message instead of an opaque constraint violation
  -- partway through. Scoped to ('all', 'identity') because only those scopes
  -- reach telegram_member_links at all. Ruling: do not change the data
  -- semantics here (TODOS.md P2, "a repeat erasure after the subject
  -- re-links is refused, not resolved") — refuse until the owner decides.
  if p_scope in ('all', 'identity') then
    if exists (
      select 1 from public.telegram_member_links l
      where l.workspace_id = p_workspace and l.telegram_user_id = p_telegram_user_id
    ) and exists (
      select 1 from public.telegram_member_links l
      where l.workspace_id = p_workspace and l.telegram_user_id = v_surrogate
    ) then
      raise exception 'the subject was linked again after an earlier erasure in this workspace; a repeat erasure of the link needs the owner''s decision (TODOS.md, retention and erasure residue)';
    end if;
  end if;

  perform set_config('app.erasure_subject', p_telegram_user_id::text, true);
  perform set_config('app.erasure_surrogate', v_surrogate::text, true);

  if p_scope in ('all', 'communication') then
    update public.communication_messages
       set provider_user_id = v_surrogate,
           provider_display_name_snapshot = null,
           provider_username_snapshot = null,
           text = case when text is null then null else '[текст стерто на запит]' end
     where workspace_id = p_workspace and provider_user_id = p_telegram_user_id;
    get diagnostics v_messages = row_count;

    update public.communication_message_events e
       set text = '[текст стерто на запит]'
      from public.communication_messages m
     where e.message_id = m.id and m.workspace_id = p_workspace
       and m.provider_user_id = v_surrogate
       and e.event_kind = 'edited' and e.text is distinct from '[текст стерто на запит]';
    get diagnostics v_events = row_count;
  end if;

  if p_scope in ('all', 'identity') then
    update public.telegram_member_links
       set telegram_user_id = v_surrogate, display_name_snapshot = null,
           username_snapshot = null, revoked_at = coalesce(revoked_at, now())
     where workspace_id = p_workspace and telegram_user_id = p_telegram_user_id;
    get diagnostics v_links = row_count;
  end if;

  if p_scope in ('all', 'communication') then
    update public.communication_attachments a
       set filename_snapshot = null
      from public.communication_messages m
     where a.message_id = m.id and a.workspace_id = p_workspace
       and m.provider_user_id = v_surrogate and a.filename_snapshot is not null;
    get diagnostics v_attachments = row_count;
  end if;

  -- What arrives after this transaction is not this transaction's to rewrite:
  -- the four shapes api.ts's allowed_updates admits, counted so the operator
  -- knows to run again once the worker has drained them.
  select count(*) into v_pending
    from public.telegram_inbox_updates u
   where u.state in ('pending', 'leased')
     and coalesce(u.payload #>> '{message,from,id}', u.payload #>> '{edited_message,from,id}',
                  u.payload #>> '{callback_query,from,id}', u.payload #>> '{my_chat_member,from,id}')
         = p_telegram_user_id::text;

  -- erased_at is NOT touched here: it is the column's own `default now()`
  -- from the INSERT above, i.e. the first erasure's timestamp, and a repeat
  -- call (idempotent or retention-after-request) must not move it forward.
  update app.telegram_erasures e
     set messages_count = e.messages_count + v_messages, events_count = e.events_count + v_events,
         links_count = e.links_count + v_links, attachments_count = e.attachments_count + v_attachments
   where e.workspace_id = p_workspace and e.surrogate_user_id = v_surrogate;

  perform app.write_erasure_audit(p_workspace, v_surrogate,
    jsonb_build_object('surrogate', v_surrogate, 'messages', v_messages, 'events', v_events,
                       'links', v_links, 'attachments', v_attachments, 'origin', p_origin,
                       'scope', p_scope, 'pending_updates_for_subject', v_pending),
    p_origin);

  perform set_config('app.erasure_subject', '', true);
  perform set_config('app.erasure_surrogate', '', true);

  return query select v_surrogate, v_messages, v_events, v_links, v_attachments, v_pending, v_existed;
end $$;
revoke all on function app.erase_telegram_identity_internal(uuid, bigint, text, text, text) from public, anon, authenticated, goproceed_app, goproceed_service;

create or replace function app.erase_telegram_identity(
  p_workspace uuid, p_telegram_user_id bigint, p_subject_hmac text
) returns table (
  surrogate_user_id bigint, messages bigint, events bigint, links bigint,
  attachments bigint, pending_updates_for_subject bigint, already_erased boolean
)
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'erasure requires the service principal' using errcode = '42501';
  end if;
  if p_subject_hmac is null or p_subject_hmac !~ '^[0-9a-f]{64}$' then
    raise exception 'erasure needs the subject HMAC the application computed';
  end if;
  if p_workspace is distinct from app.service_workspace() then
    raise exception 'erasure workspace is not the declared workspace';
  end if;
  return query select * from app.erase_telegram_identity_internal(p_workspace, p_telegram_user_id, p_subject_hmac, 'data_subject_request', 'all');
end $$;
revoke all on function app.erase_telegram_identity(uuid, bigint, text) from public, anon, authenticated;
grant execute on function app.erase_telegram_identity(uuid, bigint, text) to goproceed_service;

-- ===========================================================================
-- 5. Retention by age
--
-- Reads app.retention_policy; a NULL duration means the class is skipped and
-- reports zero. Each of customer_communication and customer_identity calls
-- §4's transformation with its own scope, so each touches only the catalog
-- tables its class owns: customer_communication passes scope 'communication'
-- (messages, edit events, attachment filenames — never telegram_member_links,
-- which spec §7.5 calls operational and never aged out) and customer_identity
-- passes scope 'identity' (member links only). Both register with origin
-- 'retention' and no HMAC, because the pepper is not in this database.
-- operational_security deletes what the catalog says is hash-and-disposition
-- only: terminal inbox rows and spent intents. Batched by p_batch subjects or
-- rows per call; a backlog converges over nights. Scheduled exactly as
-- 0007 schedules idempotency-purge.
-- ===========================================================================

create or replace function app.apply_communication_retention(p_batch integer default 5000)
returns table (data_class text, affected bigint)
language plpgsql security definer set search_path = '' as $$
declare
  v_dur interval;
  v_n bigint;
  v_row record;
  v_saved_org text;
begin
  if p_batch is null or p_batch < 1 or p_batch > 100000 then
    raise exception 'retention batch must be between 1 and 100000';
  end if;

  -- I3: this GUC is transaction-local (set_config(..., true)) inside the
  -- erasure it drives, but the function itself may run inside a caller's own
  -- transaction (a test, an admin session) that already had app.organization_id
  -- set for its own reasons. Save it here and put it back at the end rather
  -- than blanking it, so this call is not observed to have cleared a setting
  -- it did not own.
  v_saved_org := current_setting('app.organization_id', true);

  -- customer_communication: senders whose newest message is older than the duration.
  select p.duration into v_dur from app.retention_policy p where p.data_class = 'customer_communication';
  v_n := 0;
  if v_dur is not null then
    for v_row in
      select m.workspace_id, m.provider_user_id
        from public.communication_messages m
       where m.provider_user_id > 0
       group by m.workspace_id, m.provider_user_id
      having max(m.server_received_at) < now() - v_dur
       limit p_batch
    loop
      perform set_config('app.organization_id', v_row.workspace_id::text, true);
      perform app.erase_telegram_identity_internal(v_row.workspace_id, v_row.provider_user_id, null, 'retention', 'communication');
      v_n := v_n + 1;
    end loop;
  end if;
  data_class := 'customer_communication'; affected := v_n; return next;

  -- customer_identity: revoked links older than the duration. Ages by
  -- revoked_at alone and touches telegram_member_links only — never
  -- messages, events, or attachments, which are customer_communication's.
  select p.duration into v_dur from app.retention_policy p where p.data_class = 'customer_identity';
  v_n := 0;
  if v_dur is not null then
    for v_row in
      select l.workspace_id, l.telegram_user_id
        from public.telegram_member_links l
       where l.telegram_user_id > 0 and l.revoked_at is not null and l.revoked_at < now() - v_dur
       limit p_batch
    loop
      perform set_config('app.organization_id', v_row.workspace_id::text, true);
      perform app.erase_telegram_identity_internal(v_row.workspace_id, v_row.telegram_user_id, null, 'retention', 'identity');
      v_n := v_n + 1;
    end loop;
  end if;
  data_class := 'customer_identity'; affected := v_n; return next;

  -- operational_security: bounds row growth in ingress/intent tables past
  -- their duration; it never clears a payload — every terminal (processed or
  -- failed) telegram_inbox_updates row already carries payload = NULL by the
  -- table's own CHECK ((state in ('pending','leased')) = (payload is not
  -- null)) — and it never touches a pending or leased row, which that same
  -- CHECK requires to still carry one. A terminal row with no processed_at
  -- (never actually observed, but not excluded by the schema) is aged by
  -- received_at instead, so it is not immortal.
  select p.duration into v_dur from app.retention_policy p where p.data_class = 'operational_security';
  v_n := 0;
  if v_dur is not null then
    with del as (
      delete from public.telegram_inbox_updates u
       where u.ctid in (select u2.ctid from public.telegram_inbox_updates u2
                         where u2.state in ('processed', 'failed')
                           and coalesce(u2.processed_at, u2.received_at) < now() - v_dur
                         limit p_batch)
      returning 1)
    select count(*) into v_n from del;
    with del as (
      delete from public.telegram_binding_intents i
       where i.ctid in (select i2.ctid from public.telegram_binding_intents i2
                         where coalesce(i2.consumed_at, i2.expires_at) < now() - v_dur limit p_batch)
      returning 1)
    select v_n + count(*) into v_n from del;
    with del as (
      delete from public.telegram_member_link_intents i
       where i.ctid in (select i2.ctid from public.telegram_member_link_intents i2
                         where coalesce(i2.consumed_at, i2.expires_at) < now() - v_dur limit p_batch)
      returning 1)
    select v_n + count(*) into v_n from del;
  end if;
  data_class := 'operational_security'; affected := v_n; return next;

  perform set_config('app.organization_id', coalesce(v_saved_org, ''), true);
  return;
end $$;
revoke all on function app.apply_communication_retention(integer) from public, anon, authenticated, goproceed_app, goproceed_service;

do $$
declare has_pg_cron boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_pg_cron;
  if has_pg_cron then
    if exists (select 1 from cron.job where jobname = 'communication-retention') then
      perform cron.unschedule('communication-retention');
    end if;
    perform cron.schedule('communication-retention', '23 3 * * *', $c$select app.apply_communication_retention(5000)$c$);
  else
    raise notice 'pg_cron not available: communication-retention not scheduled';
  end if;
end $$;
