-- The identity that asked to be forgotten.
--
-- WHAT THIS ADDS. A way to forget one Telegram identity on request, and a
-- way to forget by age once the owner names the durations. Five sections:
--   1. app.telegram_erasures — the surrogate registry — and
--      app.retention_policy, seeded with three NULL durations (inert);
--   2. app.guard_communication_message learns to recognise exactly one
--      transformation — pseudonym plus redaction, under two transaction-local
--      markers — and refuses everything else as before;
--   3. app.guard_communication_message_event — the same for edit events,
--      leaving app.reject_mutation untouched for audit_events;
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
