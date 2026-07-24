-- audit_events, idempotency_records, transaction_outbox.
-- Column definitions copied verbatim from technical/schema.sql (lines 1589-1754),
-- with ONE deviation, called out below.

-- DEVIATION FROM VERBATIM: schema.sql's audit_events.project_id is
-- `references public.projects(id)`. The `projects` table is not part of this
-- slice (P0A slice 1 — skeleton + tenancy core) and is not created by any
-- migration in supabase/migrations/. Copying the FK verbatim would make this
-- CREATE TABLE fail with "relation public.projects does not exist". The
-- column is kept (same name/type) but the FK constraint is dropped here.
-- Whichever future task creates public.projects should add:
--   alter table public.audit_events
--     add constraint audit_events_project_id_fkey
--     foreign key (project_id) references public.projects(id);
create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  project_id uuid,
  actor_user_id uuid references auth.users(id),
  actor_type text not null check (actor_type in ('user','external','system','worker')),
  action text not null,
  object_type text not null,
  object_id text not null,
  request_id text,
  details jsonb not null default '{}',
  object_version bigint,
  reason_code text,
  prev_row_hash bytea,
  row_hash bytea,
  occurred_at timestamptz not null default now()
);

create table public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  actor_scope text not null,
  operation_id text not null,
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'in_progress' check (state in ('in_progress','completed','failed_replayable')),
  response_status integer check (response_status is null or response_status between 100 and 599),
  response_body jsonb,
  response_headers jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  unique nulls not distinct (organization_id, actor_scope, operation_id, idempotency_key),
  check (expires_at > created_at),
  check ((state = 'in_progress' and response_status is null and response_body is null and completed_at is null) or (state <> 'in_progress' and response_status is not null and response_body is not null and completed_at is not null))
);

create table public.transaction_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  topic text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  payload_version integer not null,
  payload jsonb not null,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists transaction_outbox_unprocessed_idx
  on public.transaction_outbox (available_at)
  where processed_at is null;
