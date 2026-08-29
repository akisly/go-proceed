-- =============================================================================
-- GoProceed v0.1 TARGET DESIGN DDL
-- Status: Approved target design. Applies to: v0.1. Last reviewed: 2026-08-06.
--
-- THIS FILE IS NOT A MIGRATION. Applied migrations under supabase/migrations/
-- remain the only truth for the actual database. This file is the reviewed
-- target contract that v0.0/v0.1 migrations must implement additively
-- (docs/architecture/data-model.md "Additive migration rules").
--
-- NOTHING BELOW IS DEPLOYED BY BEING WRITTEN HERE. The runtime on this branch
-- is 33 tables plus migrations 0036-0040. Every object introduced by ADR-005 --
-- requirement rules and their versions, the shipped library, contract-version
-- rule bindings, work stages, stage closures, unevidenced closures and their
-- clearances, witness notices, attendance outcomes, occurrence evidence
-- decisions, blocked reasons, and statutory acts -- has NO table in any applied
-- migration. v0.1-M3 through v0.1-M6 have no tables at all.
--
-- Sources of every rule here:
--   docs/domain/domain-model.md, execution-and-evidence.md,
--   packages-and-acceptance.md, value-at-risk.md, glossary.md
--   docs/architecture/data-model.md, tenancy-and-security.md,
--   files-and-storage.md, jobs-events-and-audit.md
--   docs/decisions/ADR-005-readiness-gate-and-hidden-works.md (the gate),
--   docs/decisions/ADR-006-pilot-shaped-v0.1.md (which of the objects below
--   v0.1 actually builds -- this file is the whole target design and 63 of its
--   86 tables are not v0.1 work; read the version of a table from
--   entity-catalog.csv status_version, never from its presence here),
--   docs/decisions/ADR-007-pilot-field-client.md (the v0.1 field client is a
--   PWA: capture is online-only, a pending original is not durable, and
--   capture_origin carries origin_not_distinguished) and
--   docs/product/hidden-works-content-rules.md (every regulatory string; no
--   norm, clause, form field, or Додаток Н item may be asserted here that is
--   not on that document's allow-list)
--   technical/database/entity-catalog.csv, relationship-catalog.csv,
--   invariant-catalog.csv (INV-xxx references below)
--
-- Conventions:
--   * every tenant-owned table: workspace_id uuid not null + unique
--     (workspace_id, id) so children can use tenant-safe composite FKs;
--   * quantities: numeric(20,6); unit-pinned precision is enforced by the
--     serialized command against unit_definitions.precision_scale;
--   * canonical money: signed bigint minor units after the pinned rounding
--     policy; every monetary row satisfies gross = net + tax (INV-037);
--   * binary floating point is forbidden for canonical money (value-at-risk.md);
--   * content immutability is separate from lifecycle: append-only tables get
--     reject-mutation triggers; snapshot tables get frozen-content guards that
--     still allow the draft->published/frozen lifecycle transition;
--   * on delete: restrict everywhere. Draft deletion is a serialized command
--     that removes children first; business history is never erased by cascade.
--   * ADR-005 vocabularies (intervention_type, blocking_scope, timing,
--     evidence_kind, blocked-reason codes, act form) are closed identifier sets
--     declared as text + CHECK, like the existing draft/published status
--     columns. An unknown value denies (INV-052);
--   * where a constraint can make an invalid combination unrepresentable, it
--     does. The gate is not a set of rules the commands remember to apply.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Schemas (docs/architecture/data-model.md "Schema and exposure boundaries")
-- ---------------------------------------------------------------------------
create schema if not exists api;          -- reviewed Data API views/functions only
create schema if not exists app_private;  -- helpers/invariants; never exposed

-- ---------------------------------------------------------------------------
-- Enums (closed identifiers; unknown values deny, INV-052)
-- ---------------------------------------------------------------------------
create type workspace_status        as enum ('trial','active','suspended','closing','closed');
create type membership_role         as enum ('owner','admin','member','auditor');
create type membership_status       as enum ('active','suspended','ended');
create type invitation_status       as enum ('pending','accepted','revoked','expired');
create type party_status            as enum ('draft','active','archived');
create type project_status          as enum ('draft','active','archived');
create type field_communication_channel as enum ('telegram');
create type project_field_channel_state as enum ('unbound','connected','active','unhealthy','archived');
create type project_party_role      as enum ('customer','technical_supervision','designer','general_contractor','performer','other');
create type responsibility_kind     as enum ('performer','progress_recorder','evidence_recorder','evidence_custodian','requirement_owner','package_compiler','internal_verifier','package_submitter','acceptance_liaison','commercial_observer');
create type contract_status         as enum ('draft','active','archived');
create type contract_version_status as enum ('draft','published');
create type price_state             as enum ('known','zero','missing');
create type price_basis             as enum ('net','gross');
create type tax_mode                as enum ('exclusive','inclusive','exempt','out_of_scope','unknown');
create type valuation_basis        as enum ('unit_price_derived','approved_source_amount');
create type import_batch_status     as enum ('created','parsing','parsed','mapping','validated','preview_ready','published','failed','abandoned');
create type import_row_status       as enum ('valid','warning','blocked');
create type assignment_status       as enum ('draft','active','paused','completed','cancelled');
create type progress_entry_kind     as enum ('root','adjustment');
create type upload_intent_status    as enum ('intent_authorized','staged','integrity_verified','scan_pending','available','scan_blocked','orphaned_for_purge','expired');
-- origin_not_distinguished added 2026-08-06 for ADR-007 decision 5: the v0.1
-- field client is a browser page, which has no camera-session identity and may
-- be handed bytes the browser stripped or transcoded, so a PWA capture cannot
-- be recorded as native_camera and must carry a value that says the origin is
-- not distinguished (INV-086; state-catalog.csv capture.origin_method).
-- This is the target design. The DEPLOYED check at
-- supabase/migrations/0015_execution_evidence_module.sql and
-- packages/contracts/src/uploads.ts still carry the six-value set, and until
-- both carry this value no PWA capture may be recorded at all.
create type capture_origin          as enum ('native_camera','photo_picker','file_picker','form','import','generated_derivative','origin_not_distinguished');
create type evidence_relation       as enum ('original','derivative','correction');
create type capture_time_trust      as enum ('device_claimed','server_estimated','unknown');
create type inspection_status       as enum ('passed','not_required');
create type requirement_severity    as enum ('blocking','advisory');
create type exception_action        as enum ('waive','not_applicable','accept_risk','revoke');
create type review_outcome          as enum ('accepted','returned');
create type package_version_status  as enum ('draft','frozen');
create type package_head_state      as enum ('current_prepared','active_for_review');
create type artifact_kind           as enum ('pdf','xlsx','zip','manifest');
create type approval_classification as enum ('required','observer');
create type approval_decision_kind  as enum ('quantity','evidence','quantity_and_evidence');
create type grant_credential_type   as enum ('bearer_email_link');
create type grant_status            as enum ('active','revoked','expired','superseded');
create type session_status          as enum ('active','expired','revoked');
create type decision_outcome        as enum ('accepted','returned');
create type issue_severity          as enum ('blocking','non_blocking');
create type allocation_movement     as enum ('reserve','activate','partition','release','accept_reserve');
create type job_status              as enum ('queued','running','retry_wait','succeeded','dead_letter','cancelled');
create type attempt_outcome         as enum ('succeeded','retryable_failure','permanent_failure','lease_expired','cancelled_before_effect','ambiguous_external_result');
create type audit_actor_kind        as enum ('member','external','service','worker','system');
create type notification_status     as enum ('created','seen','dismissed');
create type delivery_status         as enum ('requested','provider_accepted','failed','ambiguous');
create type var_state               as enum ('accepted','returned','submitted_pending','packaged_not_submitted','internal_review','evidence_blocked','ready_not_packaged');

-- ---------------------------------------------------------------------------
-- app_private helpers and immutability guards
-- ---------------------------------------------------------------------------
-- Actor context is set per request by the BFF with parameterized set_config
-- inside `set local role` transactions (docs/architecture/tenancy-and-security.md "BFF").
create or replace function app_private.current_actor() returns uuid
language sql stable as $$
  select nullif(current_setting('app.actor_user_id', true), '')::uuid
$$;

-- Generic append-only guard (INV-015, INV-043): attach BEFORE UPDATE OR DELETE.
create or replace function app_private.reject_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only relation %.% cannot be % (correct via successor fact)',
    tg_table_schema, tg_table_name, lower(tg_op);
end $$;

-- Frozen/published-content guard: allows the single draft->frozen/published
-- lifecycle transition and lifecycle-only columns; rejects everything else.
-- Concrete column allowlists are implemented per table in migrations.
create or replace function app_private.reject_frozen_content_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'design interface: frozen/published content of %.% is immutable; migrations implement the column-level guard',
    tg_table_schema, tg_table_name;
end $$;

-- =============================================================================
-- 1. WORKSPACE AND ACCESS
-- =============================================================================

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  branding jsonb not null default '{}',
  timezone text not null default 'Europe/Kyiv',
  locale text not null default 'uk-UA',
  status workspace_status not null default 'trial',
  default_own_party_id uuid, -- tenant-safe FK added after public.parties below
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.workspaces is
  'Tenant/governance boundary. Official legal identity NEVER lives here (ADR-002): it belongs to parties/party_legal_profiles.';
-- EXTERNAL GATE: workspace closure/deletion procedure and retention periods are
-- not invented here; they require the approved retention schedule before pilot
-- (docs/architecture/files-and-storage.md "Retention, deletion, export, and restore").

create table public.memberships (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references auth.users(id), -- provider-global subject; never replaces workspace_id
  role membership_role not null,
  status membership_status not null default 'active',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, user_id)
);
-- INV-017/INV-018: last-active-owner protection and first-owner bootstrap are
-- serialized commands (app_private.bootstrap_workspace / membership commands),
-- not plain inserts.

create table public.invitations (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  email text not null,
  invited_role membership_role not null,
  status invitation_status not null default 'pending',
  token_hmac bytea not null,          -- keyed verifier only; raw invite token never stored
  hmac_key_id text not null,
  invited_by_member_id uuid,
  accepted_member_id uuid,
  expires_at timestamptz not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (hmac_key_id, token_hmac),
  foreign key (workspace_id, invited_by_member_id) references public.memberships (workspace_id, id),
  foreign key (workspace_id, accepted_member_id)  references public.memberships (workspace_id, id)
);

create table public.parties (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  display_name text not null,
  status party_status not null default 'active',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id)
);
comment on table public.parties is
  'Tenant-local business participant. No global cross-customer registry (ADR-002).';

alter table public.workspaces
  add constraint workspaces_default_own_party_fkey
  foreign key (id, default_own_party_id) references public.parties (workspace_id, id);

create table public.party_legal_profiles (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  party_id uuid not null,
  legal_name text not null,
  registration_code text,             -- e.g. EDRPOU; format validated per country
  vat_number text,
  country_code char(2) not null default 'UA',
  legal_address jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, party_id),    -- one current legal profile per party
  foreign key (workspace_id, party_id) references public.parties (workspace_id, id)
);
-- EXTERNAL GATE: statutory registration/VAT validation rules and legal-data
-- retention are jurisdictional decisions recorded in the approved retention/
-- compliance schedule, not defaulted here.

create table public.own_legal_entity_profiles (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  party_id uuid not null,
  completeness_state text not null default 'incomplete',
  signing_notes jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, party_id),    -- INV-020: at most one own profile per party
  foreign key (workspace_id, party_id) references public.parties (workspace_id, id)
);
comment on table public.own_legal_entity_profiles is
  'Marks a party the workspace acts for. Editing requires own_legal_profiles.manage (stricter than parties.manage, INV-020). Contracts FK here to prove own-party status (INV-002).';

create table public.party_contacts (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  party_id uuid not null,
  full_name text not null,
  role_title text,
  email text,
  phone text,
  -- ПКМУ № 903, п. 3: the технагляд's person holds a кваліфікаційний
  -- сертифікат. That is a fact about the participant, and it is held here, on
  -- the participant record. It is NOT an act column and NOT a form field:
  -- whether Додаток В has a slot for серія/номер is not established, so
  -- nothing here is printed into the act until
  -- docs/product/hidden-works-content-rules.md allow-lists that field against
  -- the В.1/В.2 field list. Both columns are optional — no constraint may make
  -- an unestablished form field mandatory. Prohibition E bans the adjacent
  -- «ким видана», so there is no issuer column.
  qualification_certificate_series text,
  qualification_certificate_number text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  foreign key (workspace_id, party_id) references public.parties (workspace_id, id)
);
-- EXTERNAL GATE: contact PII retention/erasure periods come from the approved
-- privacy/retention schedule before pilot; no default is invented here.

create table public.projects (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  name text not null,
  code text,
  status project_status not null default 'active',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id)
);
comment on table public.projects is
  'Construction object. Not owned by one legal entity; contracts of different own parties may coexist (ADR-002). Creation atomically grants creator project-admin access (INV-019).';

create table public.project_field_channels (
  workspace_id uuid not null,
  project_id uuid not null,
  channel field_communication_channel not null,
  state project_field_channel_state not null default 'unbound',
  locked_at timestamptz,
  locked_by_member_id uuid,
  last_healthy_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, project_id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, locked_by_member_id) references public.memberships (workspace_id, id),
  check ((locked_at is null and locked_by_member_id is null)
      or (locked_at is not null and locked_by_member_id is not null))
);

create table public.project_parties (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  party_id uuid not null,
  relationship project_party_role not null,
  note text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, project_id, id),
  unique (workspace_id, project_id, party_id, relationship),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, party_id)   references public.parties (workspace_id, id)
);
comment on table public.project_parties is
  'Business relationship only. NEVER grants application visibility or access (INV-021).';

create table public.project_access_grants (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  member_id uuid not null,
  capabilities text[] not null,       -- closed identifiers from technical/permissions/capabilities.csv
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  revoked_by_member_id uuid,
  granted_by_member_id uuid not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id)          references public.projects (workspace_id, id),
  foreign key (workspace_id, member_id)           references public.memberships (workspace_id, id),
  foreign key (workspace_id, granted_by_member_id) references public.memberships (workspace_id, id),
  foreign key (workspace_id, revoked_by_member_id) references public.memberships (workspace_id, id)
);
create index project_access_actor_idx
  on public.project_access_grants (workspace_id, member_id, project_id, valid_until);

create table public.project_responsibility_assignments (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  member_id uuid not null,
  responsibility responsibility_kind not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,            -- lifecycle column: bounded end via command; identity/content immutable
  assigned_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, member_id)  references public.memberships (workspace_id, id),
  foreign key (workspace_id, assigned_by_member_id) references public.memberships (workspace_id, id)
);
comment on table public.project_responsibility_assignments is
  'Operational accountability fact. Never grants visibility (INV-021). Retained as history after expiry; separation-of-duties conflicts warn, never silently deny (domain-model.md).';

-- =============================================================================
-- 2. CONTRACT BASELINE AND IMPORT
-- =============================================================================

create table public.unit_definitions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  code text not null,
  name text not null,
  precision_scale int not null check (precision_scale between 0 and 6),
  status text not null default 'active' check (status in ('active','archived')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, code)
);

create table public.locations (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  parent_location_id uuid,
  name text not null,
  kind text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, project_id, parent_location_id)
    references public.locations (workspace_id, project_id, id)
);

create table public.contracts (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  own_party_id uuid not null,
  customer_party_id uuid not null,
  contract_no_display text not null,
  contract_no_normalized text not null,
  status contract_status not null default 'draft',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  -- INV-022: uniqueness includes own party + normalized number, not merely project
  unique (workspace_id, own_party_id, contract_no_normalized),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  -- INV-002: the own party must carry an own-legal-entity profile in the SAME workspace
  foreign key (workspace_id, own_party_id)
    references public.own_legal_entity_profiles (workspace_id, party_id),
  foreign key (workspace_id, customer_party_id) references public.parties (workspace_id, id),
  check (own_party_id <> customer_party_id)
);

create table public.import_batches (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  status import_batch_status not null default 'created',
  parser_name text not null,
  parser_version text not null,
  parser_config jsonb not null default '{}',
  mapping_version text,
  locale_settings jsonb not null default '{}', -- decimal/grouping/encoding interpretation
  created_by_member_id uuid not null,
  published_at timestamptz,
  published_by_member_id uuid,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  foreign key (workspace_id, project_id, contract_id)
    references public.contracts (workspace_id, project_id, id),
  foreign key (workspace_id, created_by_member_id)  references public.memberships (workspace_id, id),
  foreign key (workspace_id, published_by_member_id) references public.memberships (workspace_id, id)
);
comment on table public.import_batches is
  'Draft-producing pipeline. Publication is an explicit command; macros/formulas are never executed (INV-016). Parser retries are idempotent by source hash + parser/mapping version.';

create table public.import_files (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  import_batch_id uuid not null,
  storage_key text not null,
  byte_size bigint not null check (byte_size > 0),
  content_hash bytea not null,
  detected_format text not null,
  original_filename text,             -- untrusted metadata; never part of the storage key
  uploaded_by_member_id uuid not null,
  uploaded_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, storage_key), -- INV-045: keys are immutable and never reused
  foreign key (workspace_id, import_batch_id) references public.import_batches (workspace_id, id),
  foreign key (workspace_id, uploaded_by_member_id) references public.memberships (workspace_id, id)
);

create table public.import_row_results (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  import_batch_id uuid not null,
  import_file_id uuid not null,
  worksheet text not null default '',
  source_row_no int not null check (source_row_no >= 1),
  source_values jsonb not null,       -- exact source values; formulas as inert text only
  normalized_preview jsonb,
  row_status import_row_status not null,
  validation_messages jsonb not null default '[]',
  parser_version text not null,
  mapping_version text,
  produced_work_item_id uuid,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, import_batch_id, import_file_id, worksheet, source_row_no),
  foreign key (workspace_id, import_batch_id) references public.import_batches (workspace_id, id),
  foreign key (workspace_id, import_file_id)  references public.import_files (workspace_id, id)
);

create table public.contract_versions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  version_no int not null check (version_no >= 1),
  status contract_version_status not null default 'draft',
  currency char(3) not null,
  default_tax_mode tax_mode not null,
  rounding_policy jsonb not null,
  -- rounding_policy pins: decimal price precision, currency minor-unit
  -- precision, midpoint mode, signed-value behavior, tax base/order, and
  -- rounding scope = 'work_item_version_pool' (value-at-risk.md).
  mismatch_tolerance_minor_units bigint not null default 0,
  mismatch_tolerance_basis_points int not null default 0,
  approval_policy jsonb not null default '{}',
  terms jsonb not null default '{}',
  own_party_snapshot jsonb,           -- immutable pinned party snapshot at publication
  customer_party_snapshot jsonb,
  source_import_batch_id uuid,
  source_manifest_hash bytea,
  predecessor_version_id uuid,
  published_at timestamptz,
  published_by_member_id uuid,
  draft_version bigint not null default 1, -- optimistic concurrency for the draft only
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, project_id, contract_id, id),
  unique (workspace_id, contract_id, version_no),
  foreign key (workspace_id, project_id, contract_id)
    references public.contracts (workspace_id, project_id, id),
  foreign key (workspace_id, source_import_batch_id) references public.import_batches (workspace_id, id),
  foreign key (workspace_id, predecessor_version_id) references public.contract_versions (workspace_id, id),
  foreign key (workspace_id, published_by_member_id) references public.memberships (workspace_id, id),
  check (status = 'draft' or (published_at is not null and own_party_snapshot is not null and customer_party_snapshot is not null))
);
comment on table public.contract_versions is
  'Published versions are immutable snapshots (INV-015). Reimport creates a new version with lineage. Source amount discrepancies must be resolved before publication (INV-054).';

create table public.work_items (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  contract_version_id uuid not null,
  position int not null,
  source_key text,
  work_code text,
  description text not null,
  -- predicate side, LEFT-HAND. The right-hand side is
  -- requirement_rule_versions.work_type_key below; ADR-006 decision 1 step 1 is
  -- what puts it here («ПТВ enters the work lines by hand, picks a work type,
  -- and the requirements load»). Added by migration 0050.
  --
  -- NULLABLE, AND NULL IS NOT AN ERROR: every line the frozen importer wrote
  -- carries NULL, matches no rule, and is DISCLOSED as `work_type_unresolved`
  -- rather than refused. NO FOREIGN KEY AND NO VOCABULARY TABLE — the set of
  -- work types has no owning entity in v0.1 (glossary.md:109 calls giving it one
  -- a scope decision an ADR must make) and many rule versions share one key, so
  -- there is no candidate key to reference. What replaces the FK is a write-time
  -- refusal (app.work_type_key_is_bindable + work_items_work_type_guard: a
  -- non-null key must name a rule version this workspace can bind) and a
  -- publish-time disclosure in contract_versions.publish. The shape check is
  -- STRICTER than the rule side's `length(btrim(...)) > 0` on purpose: both
  -- comparisons that matter are exact string equality, and normalising on one
  -- side only is how two comparisons come to disagree.
  work_type_key text,
  section text,
  unit_id uuid not null,
  contract_quantity numeric(20,6) not null check (contract_quantity >= 0),
  price_state price_state not null,
  unit_price numeric(20,6),
  price_basis price_basis,
  valuation_basis valuation_basis not null default 'unit_price_derived',
  currency char(3) not null,
  tax_mode tax_mode not null,
  tax_rate numeric(7,4),
  -- Canonical work-item valuation pool (value-at-risk.md): pinned minor units
  -- after the contract rounding policy. Null while tax basis is unknown or
  -- price is missing (the slice is numerically unvalued, INV-038).
  pool_net_minor_units bigint,
  pool_tax_minor_units bigint,
  pool_gross_minor_units bigint,
  source_amount_minor_units bigint,
  source_amount_basis price_basis,
  location_id uuid,
  external_ref text,
  predecessor_work_item_id uuid,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, contract_version_id, id),
  unique (workspace_id, project_id, contract_id, contract_version_id, id),
  foreign key (workspace_id, project_id, contract_id, contract_version_id)
    references public.contract_versions (workspace_id, project_id, contract_id, id),
  foreign key (workspace_id, unit_id) references public.unit_definitions (workspace_id, id),
  foreign key (workspace_id, project_id, location_id)
    references public.locations (workspace_id, project_id, id),
  foreign key (workspace_id, predecessor_work_item_id) references public.work_items (workspace_id, id),
  -- price-state coherence (INV-038)
  check ((price_state = 'known'  and unit_price is not null and unit_price > 0)
      or (price_state = 'zero'   and unit_price is not null and unit_price = 0)
      or (price_state = 'missing' and unit_price is null)),
  -- tax-mode/price-basis compatibility table (value-at-risk.md)
  check (tax_mode <> 'exclusive' or price_basis = 'net'),
  check (tax_mode <> 'inclusive' or price_basis = 'gross'),
  check (tax_mode not in ('exempt','out_of_scope') or coalesce(tax_rate, 0) = 0),
  -- coupled money (INV-037): all three present or all three absent
  check ((pool_net_minor_units is null and pool_tax_minor_units is null and pool_gross_minor_units is null)
      or (pool_gross_minor_units = pool_net_minor_units + pool_tax_minor_units)),
  check (tax_mode <> 'unknown' or pool_gross_minor_units is null),
  -- the work type is stored exactly as it will be compared (migration 0050)
  check (work_type_key is null
      or (work_type_key = btrim(work_type_key) and length(work_type_key) > 0))
);

create table public.source_amount_resolutions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  import_batch_id uuid not null,
  import_row_result_id uuid not null,
  chosen_valuation_basis valuation_basis not null,
  chosen_price_basis price_basis not null,
  approved_amount_minor_units bigint,
  original_source_amount_minor_units bigint,
  original_unit_price numeric(20,6),
  reason text not null,
  resolved_by_member_id uuid not null,
  resolved_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, import_row_result_id),
  foreign key (workspace_id, import_batch_id)      references public.import_batches (workspace_id, id),
  foreign key (workspace_id, import_row_result_id) references public.import_row_results (workspace_id, id),
  foreign key (workspace_id, resolved_by_member_id) references public.memberships (workspace_id, id)
);
comment on table public.source_amount_resolutions is
  'INV-054: a source amount vs quantity*price mismatch outside pinned tolerance blocks publication until this explicit fact exists. Original values are retained.';

-- =============================================================================
-- 3. EXECUTION: ASSIGNMENTS, STAGES, PROGRESS, ALLOCATION HEADS, VALUATION
-- =============================================================================

create table public.work_assignments (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  contract_version_id uuid not null,
  work_item_id uuid not null,
  location_id uuid,
  performer_party_id uuid,
  assignee_member_id uuid,
  planned_quantity numeric(20,6) check (planned_quantity is null or planned_quantity > 0),
  due_date date,
  -- ADR-005 decision 2 RETIRES work_assignments.requirement_template_version_id
  -- (present in the runtime at supabase/migrations/0015:85). One optional
  -- template pinned to an assignment cannot express an ordered set, cannot vary
  -- by stage or location, and is absent by default, which is the same as having
  -- no gate. Obligations now arrive as requirement_occurrences materialised
  -- from the rule versions bound to the published contract version. Removing
  -- the deployed column is a migration concern; the target shape has no column.
  status assignment_status not null default 'active',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id, contract_id, contract_version_id, work_item_id)
    references public.work_items (workspace_id, project_id, contract_id, contract_version_id, id),
  foreign key (workspace_id, project_id, location_id)
    references public.locations (workspace_id, project_id, id),
  foreign key (workspace_id, performer_party_id) references public.parties (workspace_id, id),
  foreign key (workspace_id, assignee_member_id) references public.memberships (workspace_id, id)
);

create table public.work_stages (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  contract_version_id uuid not null,
  work_assignment_id uuid not null,
  location_id uuid,
  stage_key text not null,            -- from the vocabulary pinned by the contract-version rule bindings
  is_concealed boolean not null default false,
  status text not null default 'open'
    check (status in ('open','closed','closed_without_evidence')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  -- the concealed flag is part of the stage identity a child may pin, so an
  -- occurrence timed before_concealment cannot attach to a stage that is not
  -- concealed (execution-and-evidence.md "Timing")
  unique (workspace_id, project_id, id, is_concealed),
  -- and so is the status: a stage_closures row may only reference a stage whose
  -- status is 'closed', an unevidenced_closures row only one whose status is
  -- 'closed_without_evidence'. Since a stage has exactly one status, the two
  -- kinds of closure are mutually exclusive per stage RELATIONALLY, not by
  -- convention. It also means that once either closure exists the status can
  -- never move again (on delete/update restrict), which is what "ADR-005
  -- defines no reopen" has to mean in a schema.
  unique (workspace_id, project_id, id, status),
  foreign key (workspace_id, project_id, work_assignment_id)
    references public.work_assignments (workspace_id, project_id, id),
  foreign key (workspace_id, project_id, location_id)
    references public.locations (workspace_id, project_id, id)
);
comment on table public.work_stages is
  'The closable unit: one assignment, one location node, one stage from the vocabulary the published contract version pins, flagged concealed or not. status is a stored lifecycle column (technical/states/state-catalog.csv work_stage.status); the closure FACTS are stage_closures and unevidenced_closures and they are what may be relied on. The stage vocabulary is NOT checked relationally: a stage with no bound rule and therefore no occurrence is legal and is exactly what the bulk-instantiation dry run must disclose as an uncovered line (INV-072).';
-- One assignment + one location node + one stage key is ONE stage. Without
-- this, "close the same stage twice" is reachable through duplicate stage
-- identities instead of duplicate closures.
create unique index work_stages_closable_unit_uniq
  on public.work_stages (workspace_id, work_assignment_id,
    coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), stage_key);

create table public.progress_entries (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  work_assignment_id uuid not null,
  work_item_id uuid not null,        -- denormalized ancestor for tenant-safe adjustment checks
  entry_kind progress_entry_kind not null,
  quantity numeric(20,6) not null,
  root_progress_entry_id uuid,
  reason_code text,
  recorded_by_member_id uuid not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  foreign key (workspace_id, project_id, work_assignment_id)
    references public.work_assignments (workspace_id, project_id, id),
  foreign key (workspace_id, work_item_id) references public.work_items (workspace_id, id),
  foreign key (workspace_id, root_progress_entry_id) references public.progress_entries (workspace_id, id),
  foreign key (workspace_id, recorded_by_member_id)  references public.memberships (workspace_id, id),
  -- INV-023: roots are positive and rootless; adjustments are signed non-zero
  -- deltas referencing exactly one root and stating a reason.
  check ((entry_kind = 'root' and root_progress_entry_id is null and quantity > 0 and reason_code is null)
      or (entry_kind = 'adjustment' and root_progress_entry_id is not null and quantity <> 0 and reason_code is not null))
);
comment on table public.progress_entries is
  'Append-only (trigger below). Adjustments never reference adjustments; the serialized command additionally proves the referenced root has entry_kind = root and shares assignment/work item (INV-023) and that effective quantity stays >= reserved (INV-024/INV-025).';
create index progress_adjustments_root_idx
  on public.progress_entries (workspace_id, root_progress_entry_id, created_at, id)
  where entry_kind = 'adjustment';

create table public.progress_allocation_heads (
  workspace_id uuid not null references public.workspaces(id),
  root_progress_entry_id uuid not null,
  effective_quantity numeric(20,6) not null check (effective_quantity >= 0),
  reserved_quantity numeric(20,6) not null default 0,
  accepted_reserved_quantity numeric(20,6) not null default 0 check (accepted_reserved_quantity >= 0),
  current_unaccepted_reserved_quantity numeric(20,6) not null default 0 check (current_unaccepted_reserved_quantity >= 0),
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, root_progress_entry_id),
  foreign key (workspace_id, root_progress_entry_id) references public.progress_entries (workspace_id, id),
  -- canonical balance identity + INV-025 (no-overclaim interface, see
  -- app_private.assert_reservation_invariant below)
  check (reserved_quantity = accepted_reserved_quantity + current_unaccepted_reserved_quantity),
  check (reserved_quantity >= 0 and reserved_quantity <= effective_quantity)
);
comment on table public.progress_allocation_heads is
  'Rebuildable serialization/balance projection, NOT authority (the signed progress_claim_allocations ledger is). Only named commands update it; clients get no direct UPDATE grant. Locked in stable (workspace_id, root_progress_entry_id) order.';

create table public.valuation_allocations (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  work_item_id uuid not null,
  root_progress_entry_id uuid,
  lineage_key text not null,          -- stable largest-remainder tie-break identity
  quantity numeric(20,6) not null,
  net_minor_units bigint,
  tax_minor_units bigint,
  gross_minor_units bigint,
  predecessor_allocation_id uuid,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  foreign key (workspace_id, work_item_id) references public.work_items (workspace_id, id),
  foreign key (workspace_id, root_progress_entry_id) references public.progress_entries (workspace_id, id),
  foreign key (workspace_id, predecessor_allocation_id) references public.valuation_allocations (workspace_id, id),
  check ((net_minor_units is null and tax_minor_units is null and gross_minor_units is null)
      or (gross_minor_units = net_minor_units + tax_minor_units))
);
comment on table public.valuation_allocations is
  'INV-055: append-only lineage splitting the work-item valuation pool into exposure slices with stable canonical minor units. The same quantity is never rounded independently twice; package lines SUM these amounts instead of recomputing quantity*price.';

-- =============================================================================
-- 4. EVIDENCE: CAPTURE, UPLOAD INTENTS, OBJECTS, LINKS
-- =============================================================================

create table public.upload_intents (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  work_assignment_id uuid not null,
  requirement_occurrence_id uuid,     -- FK added after requirement_occurrences
  created_by_member_id uuid not null,
  device_capture_id text,
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  expected_byte_size bigint not null check (expected_byte_size > 0),
  expected_content_hash bytea not null,
  allowed_content_family text not null,
  claimed_media_type text not null,
  status upload_intent_status not null default 'intent_authorized',
  staging_storage_key text,
  staging_attempt int not null default 0,
  quota_reserved_bytes bigint not null default 0,
  expires_at timestamptz not null,
  finalized_evidence_object_id uuid,  -- FK added after evidence_objects
  failure_code text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, created_by_member_id, idempotency_key),
  foreign key (workspace_id, project_id, work_assignment_id)
    references public.work_assignments (workspace_id, project_id, id),
  foreign key (workspace_id, created_by_member_id) references public.memberships (workspace_id, id)
);
comment on table public.upload_intents is
  'Idempotent whole-upload contract. State machine: intent_authorized -> staged -> integrity_verified -> scan_pending -> available | scan_blocked; authorization failure -> orphaned_for_purge (INV-046/INV-047). Staged bytes are never evidence. Orphans purge within 24h.';
-- EXTERNAL GATE: per-workspace storage quota values and scan-blocked retention
-- periods come from the approved retention schedule, not defaults here.

create table public.capture_events (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid,
  work_assignment_id uuid,
  upload_intent_id uuid,
  device_capture_id text not null,
  client_state text not null,         -- not_sent/sending/awaiting_receipt/server_confirmed/failed/quarantined per files-and-storage.md
  claimed_capture_time timestamptz,
  claimed_tz_offset text,
  capture_time_trust capture_time_trust not null default 'device_claimed',
  reported_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  foreign key (workspace_id, upload_intent_id) references public.upload_intents (workspace_id, id)
);

create table public.evidence_objects (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  content_hash bytea not null,
  byte_size bigint not null check (byte_size > 0),
  media_type text not null,           -- server-validated; original filename below stays untrusted
  original_filename text,
  storage_key text not null,
  storage_provider text not null,
  storage_region text,
  origin_method capture_origin not null,
  relation_kind evidence_relation not null default 'original',
  source_evidence_object_id uuid,
  recorder_member_id uuid not null,
  performer_party_id uuid,
  source_party_id uuid,
  custodian_party_id uuid,
  custodian_member_id uuid,
  device_capture_id text,
  claimed_capture_time timestamptz,
  capture_time_trust capture_time_trust not null default 'unknown',
  server_received_at timestamptz not null,
  upload_intent_id uuid,
  source_app_version text,
  inspection_status inspection_status not null,
  inspection_policy_version text not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, storage_key), -- INV-045: immutable, never overwritten
  foreign key (workspace_id, source_evidence_object_id) references public.evidence_objects (workspace_id, id),
  foreign key (workspace_id, recorder_member_id) references public.memberships (workspace_id, id),
  foreign key (workspace_id, performer_party_id) references public.parties (workspace_id, id),
  foreign key (workspace_id, source_party_id)    references public.parties (workspace_id, id),
  foreign key (workspace_id, custodian_party_id) references public.parties (workspace_id, id),
  foreign key (workspace_id, custodian_member_id) references public.memberships (workspace_id, id),
  foreign key (workspace_id, upload_intent_id)   references public.upload_intents (workspace_id, id),
  check ((relation_kind = 'original' and source_evidence_object_id is null)
      or (relation_kind <> 'original' and source_evidence_object_id is not null))
);
comment on table public.evidence_objects is
  'Immutable content identity + provenance (append-only trigger below). Recorder/performer/source/custodian are accountability, never permission grants. Claimed capture time and server receipt are separate labeled facts.';
-- EXTERNAL GATE: EXIF/GPS retention/exposure policy must be approved before
-- pilot (files-and-storage.md); no default exposure is designed here.

alter table public.upload_intents
  add constraint upload_intents_finalized_evidence_fkey
  foreign key (workspace_id, finalized_evidence_object_id)
  references public.evidence_objects (workspace_id, id);

-- =============================================================================
-- 5. REQUIREMENTS: RULES, LIBRARY, BINDINGS, OCCURRENCES, INTERNAL REVIEW
-- =============================================================================
-- ADR-005 decision 2: requirements are known in advance and are bound to the
-- work, not to a person or a visit. A rule is a predicate over (work type,
-- location node, stage) yielding an ORDERED set of requirements; each member of
-- that set is one immutable published rule version carrying its own ordinal.
-- The set bound to a baseline is therefore the set of rule versions the
-- published contract version pins, ordered by (rule, ordinal).

create table public.requirement_library_items (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  source_standard text not null,
  position_code text not null check (position_code in ('Н.14','Н.15')),
  position_title_uk text not null,
  item_no int not null check (item_no >= 1),
  item_text_uk text not null,
  -- Додаток Н is довідковий. There is no value that records it as mandatory or
  -- as an «орієнтовний перелік» (hidden-works-content-rules.md B and C).
  normative_character text not null default 'dovidkovyi'
    check (normative_character = 'dovidkovyi'),
  -- INV-073: verification tag and source are NOT NULL, so an unsourced
  -- regulatory string cannot be stored and therefore cannot be rendered.
  verification text not null check (verification in ('VERIFIED_PRIMARY','VERIFIED_SECONDARY')),
  source_citation text not null,
  -- Neither ДБН А.3.1-5:2016 nor ДСТУ 9258:2023 says which position takes which
  -- act form. The mapping is the product's assumption and there is no value
  -- that records it as a norm reference (hidden-works-content-rules.md G).
  act_form_assumption text check (act_form_assumption in ('dodatok_v','dodatok_g')),
  act_form_basis text not null default 'product_assumption'
    check (act_form_basis = 'product_assumption'),
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, source_standard, position_code, item_no),
  -- Н.14 has exactly five items and Н.15 exactly seven. An eighth line in Н.15
  -- is unrepresentable, not merely forbidden by review
  -- (hidden-works-content-rules.md A).
  check ((position_code = 'Н.14' and item_no <= 5)
      or (position_code = 'Н.15' and item_no <= 7))
);
comment on table public.requirement_library_items is
  'Shipped regulatory reference content: the twelve VERIFIED_PRIMARY items of Додаток Н positions Н.14 and Н.15 (technical/requirements/dbn-a31-5-2016-dodatok-n.csv). Content is a repository change under hidden-works-content-rules.md, never a runtime command. Anything outside those two positions belongs to a separate non-normative block and never to this table. NOTE: entity-catalog.csv and relationship-catalog.csv scope these rows to a workspace; domain-model.md calls them workspace-independent reference rows. The catalogs win on shape (tenant-safe FKs, INV-001); the document wins on substance, and a rule version COPIES the quoted text, its verification tag, and its source into its own immutable content so no tenant obligation depends on a shared row.';
-- EXTERNAL GATE: adding a position beyond Н.14/Н.15 requires the same
-- primary-source verification that produced these twelve rows (ADR-005
-- assumption c). It is a content-sourcing programme, not a schema change.

-- ADR-010: the OTHER source of a requirement. п. 8.4.3.3 says the binding
-- hidden-works list for a site comes from робоча документація and that Додаток
-- Н is довідковий, so the table above is a starter by design and this one is
-- where a workspace states what its own documentation says.
--
-- SEPARATE FROM THE LIBRARY ON PURPOSE. Nothing written here can reach
-- requirement_library_items, so the seeded verified set cannot be corrupted by
-- authoring, and no row here can become a line of Н.15.
--
-- NOTE ON THIS FILE'S VOCABULARY: the tenant root here is public.workspaces,
-- while the deployed migrations name public.organizations with a workspace_id
-- column on every child. The two differ by history, not by intent; the
-- migration's FK targets are the deployed spelling.
create table public.project_sourced_requirement_items (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  item_text_uk text not null,
  -- INV-073's source half, structural: «робоча документація» without a sheet
  -- and a drawing number is a word, not a source. Three identifying fields
  -- rather than one free-text citation column.
  source_document text not null,
  source_sheet text not null,
  source_drawing_no text not null,
  source_revision text,
  -- INV-073's tag half. One storable value: a row cannot claim a verification
  -- the product never performed (hidden-works-content-rules.md
  -- §"Verification vocabulary", the PROJECT_DOCUMENTATION bullet).
  verification text not null check (verification = 'PROJECT_DOCUMENTATION'),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  created_by_member_id uuid not null,
  archived_at timestamptz,
  archived_by_member_id uuid,
  primary key (id),
  unique (workspace_id, id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, created_by_member_id) references public.memberships (workspace_id, id),
  foreign key (workspace_id, archived_by_member_id) references public.memberships (workspace_id, id),
  check (status = 'active'
      or (archived_at is not null and archived_by_member_id is not null))
);
comment on table public.project_sourced_requirement_items is
  'Requirement text a workspace takes from its own робоча документація for one project, with the sheet and drawing number that identify it. Never a ДБН extract, never rendered inside a Додаток Н block, and never attributed to a standard (hidden-works-content-rules.md §"Project-sourced strings"). Text and citation are immutable: a published rule version has already copied the content, so a correction is a new row plus an archive of the old one rather than an edit no obligation could see.';

create table public.requirement_rules (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  rule_key text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active','archived')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, rule_key)
);
comment on table public.requirement_rules is
  'Stable identity and naming only. All agreed content lives in immutable published rule versions; archiving a rule never changes an existing obligation, because an occurrence pins a version identity (INV-067).';

create table public.requirement_rule_versions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  requirement_rule_id uuid not null,
  version_no int not null check (version_no >= 1),
  ordinal int not null check (ordinal >= 1),  -- position inside the rule's ordered set
  status text not null default 'draft' check (status in ('draft','published','retired')),
  -- predicate side. Rules are workspace-scoped and never project-scoped, so the
  -- location node is a predicate over the node, not an FK into one project tree.
  work_type_key text not null,
  location_predicate jsonb not null default '{}',
  stage_key text not null,
  -- requirement side (domain-model.md "Requirement rules and library")
  intervention_type text not null check (intervention_type in ('hold','witness','review')),
  blocking_scope text not null
    check (blocking_scope in ('none','blocks_stage_closure','blocks_package_inclusion','blocks_both')),
  timing text not null
    check (timing in ('before_work','during','before_concealment','after','before_package')),
  evidence_kind text not null check (evidence_kind in ('photo','measurement','document','checkbox')),
  acceptance_criterion text not null,
  performer_role text not null,
  approver_role text not null,
  approver_is_external boolean not null default false,
  min_evidence_count int not null default 1 check (min_evidence_count >= 1),
  max_evidence_count int check (max_evidence_count is null or max_evidence_count >= min_evidence_count),
  allowed_media jsonb not null default '[]',
  form_schema jsonb,
  exception_policy jsonb not null default '{}',
  -- the normative citation is COPIED into this immutable content, with its
  -- verification tag and source, and is never a live reference (INV-073)
  norm_ref text,
  norm_ref_verification text
    check (norm_ref_verification in ('VERIFIED_PRIMARY','VERIFIED_SECONDARY')),
  norm_ref_source text,
  requirement_library_item_id uuid,   -- provenance of the copied text, not its authority
  rule_version_hash bytea,
  published_at timestamptz,
  published_by_member_id uuid,
  retired_at timestamptz,
  retired_by_member_id uuid,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, requirement_rule_id, id),
  unique (workspace_id, requirement_rule_id, version_no),
  unique (workspace_id, id, stage_key),          -- the binding pins the stage with the version
  unique (workspace_id, id, intervention_type),
  foreign key (workspace_id, requirement_rule_id) references public.requirement_rules (workspace_id, id),
  foreign key (workspace_id, requirement_library_item_id)
    references public.requirement_library_items (workspace_id, id),
  foreign key (workspace_id, published_by_member_id) references public.memberships (workspace_id, id),
  foreign key (workspace_id, retired_by_member_id)  references public.memberships (workspace_id, id),
  -- INV-066 / ADR-005 decision 4: a hold admits blocks_both ONLY, and witness
  -- and review admit exactly the scopes the decision permits. An impermissible
  -- combination is not rejected at read time; it cannot be stored.
  check (intervention_type <> 'hold'    or blocking_scope = 'blocks_both'),
  check (intervention_type <> 'witness' or blocking_scope in ('none','blocks_stage_closure','blocks_both')),
  check (intervention_type <> 'review'  or blocking_scope in ('none','blocks_package_inclusion','blocks_both')),
  -- INV-073: a normative string without BOTH a verification tag and a source is
  -- unrepresentable, so a contributor cannot introduce one by editing a template
  check (norm_ref is null or (norm_ref_verification is not null and norm_ref_source is not null)),
  check (status = 'draft' or (rule_version_hash is not null and published_at is not null)),
  check (status <> 'retired' or retired_at is not null)
);
comment on table public.requirement_rule_versions is
  'Publish/retire only, never updated (INV-067): no UPDATE grant, plus the frozen-content guard below. Retirement stops future binding and changes nothing about an occurrence that already pinned this identity. severity as a free axis is retired (ADR-005 decision 4): a requirement''s consequence is blocking_scope, and one column says so.';
create index requirement_rule_versions_predicate_idx
  on public.requirement_rule_versions (workspace_id, work_type_key, stage_key)
  where status = 'published';

-- Module: contract_baseline (entity-catalog.csv). Declared here because it
-- references the rule versions above; ADR-002's publication discipline is
-- unchanged and the binding is pinned in the same act that pins party,
-- currency, tax, terms, and approval policy.
create table public.contract_version_rule_bindings (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  contract_version_id uuid not null,
  requirement_rule_id uuid not null,
  requirement_rule_version_id uuid not null,
  stage_key text not null,            -- carried from the pinned version: the baseline's stage vocabulary
  bound_at timestamptz not null default now(),
  bound_by_member_id uuid not null,
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, project_id, contract_id, contract_version_id, id),
  -- one rule contributes AT MOST ONE version to a baseline. Two versions of the
  -- same rule inside one published contract version would make "what was
  -- agreed" ambiguous, and reproducibility is the whole point of the binding.
  unique (workspace_id, contract_version_id, requirement_rule_id),
  unique (workspace_id, contract_version_id, requirement_rule_version_id),
  foreign key (workspace_id, project_id, contract_id, contract_version_id)
    references public.contract_versions (workspace_id, project_id, contract_id, id),
  foreign key (workspace_id, requirement_rule_id, requirement_rule_version_id)
    references public.requirement_rule_versions (workspace_id, requirement_rule_id, id),
  -- the binding cannot misreport the stage its rule version names
  foreign key (workspace_id, requirement_rule_version_id, stage_key)
    references public.requirement_rule_versions (workspace_id, id, stage_key),
  foreign key (workspace_id, bound_by_member_id) references public.memberships (workspace_id, id)
);
comment on table public.contract_version_rule_bindings is
  'Pins the exact rule-version set to a published contract version at baseline publication (ADR-005 decision 2). A rule published after that baseline does not retroactively enter it. The set of stage_key values bound to a contract version IS that version''s stage vocabulary.';
create index contract_version_rule_bindings_stage_idx
  on public.contract_version_rule_bindings (workspace_id, contract_version_id, stage_key);

create table public.requirement_template_versions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  template_key text not null,
  version_no int not null check (version_no >= 1),
  status text not null default 'draft' check (status in ('draft','published')),
  evidence_type text not null,
  allowed_media jsonb not null default '[]',
  multiplicity jsonb not null default '{}',
  timing jsonb not null default '{}',
  severity requirement_severity not null default 'blocking',
  condition_expr text,                -- allowlisted expression language only
  form_schema jsonb,
  satisfier_policy jsonb not null default '{}',
  reviewer_policy jsonb not null default '{}',
  exception_policy jsonb not null default '{}',
  template_hash bytea,
  published_at timestamptz,
  published_by_member_id uuid,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, template_key, version_no),
  foreign key (workspace_id, published_by_member_id) references public.memberships (workspace_id, id),
  check (status = 'draft' or (template_hash is not null and published_at is not null))
);

create table public.requirement_occurrences (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  work_assignment_id uuid not null,
  work_stage_id uuid,                 -- the closable unit this obligation is evaluated over
  stage_is_concealed boolean,         -- pinned with the stage so timing is checkable here
  rule_version_id uuid not null,      -- pinned identity, never a live rule (INV-067)
  requirement_template_version_id uuid, -- v0.1-M2 lineage only; no longer the source of an obligation
  ordinal int not null default 1 check (ordinal >= 1),
  -- materialised from the rule version at assignment creation (INV-066).
  -- Stored values, never a severity word interpreted at read time.
  intervention_type text not null check (intervention_type in ('hold','witness','review')),
  blocking_scope text not null
    check (blocking_scope in ('none','blocks_stage_closure','blocks_package_inclusion','blocks_both')),
  timing text not null
    check (timing in ('before_work','during','before_concealment','after','before_package')),
  evidence_kind text not null check (evidence_kind in ('photo','measurement','document','checkbox')),
  acceptance_criterion text not null,
  norm_ref text,
  norm_ref_verification text
    check (norm_ref_verification in ('VERIFIED_PRIMARY','VERIFIED_SECONDARY')),
  norm_ref_source text,
  performer_role text not null,
  approver_role text not null,
  approver_is_external boolean not null default false,
  min_evidence_count int not null default 1 check (min_evidence_count >= 1),
  location_id uuid,
  quantity_scope jsonb not null default '{}', -- exact quantity/location scope of the obligation
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  -- children pin the axis they are only allowed to touch: a notice may exist
  -- only for a witness, an exception kind is coupled to the type, and a
  -- decision may only be made in the role the occurrence names.
  unique (workspace_id, id, intervention_type),
  unique (workspace_id, id, approver_role),
  foreign key (workspace_id, project_id, work_assignment_id)
    references public.work_assignments (workspace_id, project_id, id),
  foreign key (workspace_id, project_id, work_stage_id, stage_is_concealed)
    references public.work_stages (workspace_id, project_id, id, is_concealed),
  foreign key (workspace_id, rule_version_id)
    references public.requirement_rule_versions (workspace_id, id),
  foreign key (workspace_id, requirement_template_version_id)
    references public.requirement_template_versions (workspace_id, id),
  foreign key (workspace_id, project_id, location_id)
    references public.locations (workspace_id, project_id, id),
  foreign key (workspace_id, created_by_member_id) references public.memberships (workspace_id, id),
  -- INV-066: the copied scope obeys the same rule as the published version
  check (intervention_type <> 'hold' or blocking_scope = 'blocks_both'),
  check ((work_stage_id is null) = (stage_is_concealed is null)),
  -- a requirement that must precede a covering that never happens is
  -- unreachable (execution-and-evidence.md "Timing", decision 2). `is true`
  -- rather than a bare column reference, so an occurrence with no stage at all
  -- cannot slip through on a NULL.
  check (timing <> 'before_concealment' or stage_is_concealed is true),
  check (norm_ref is null or (norm_ref_verification is not null and norm_ref_source is not null))
);
comment on table public.requirement_occurrences is
  'Materialised when the assignment is created, with no evidence yet linked (projection requirement_occurrence.review = occurrence; deliberately no status column here), and visible in the field client BEFORE work starts (ADR-005 decision 2). A placeholder that appears only after the work is covered is not advance notice. Satisfaction is a projection over decisions, notices, attendance outcomes, review heads, and exception heads; it is never a column here.';

alter table public.upload_intents
  add constraint upload_intents_occurrence_fkey
  foreign key (workspace_id, requirement_occurrence_id)
  references public.requirement_occurrences (workspace_id, id);

create table public.evidence_requirement_links (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  evidence_object_id uuid not null,
  requirement_occurrence_id uuid not null,
  linked_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  retracted_at timestamptz,           -- lifecycle only; link content is immutable
  retracted_by_member_id uuid,
  primary key (id),
  unique (workspace_id, id),
  foreign key (workspace_id, evidence_object_id) references public.evidence_objects (workspace_id, id),
  foreign key (workspace_id, project_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, project_id, id),
  foreign key (workspace_id, linked_by_member_id) references public.memberships (workspace_id, id)
);
create unique index evidence_requirement_links_active_uniq
  on public.evidence_requirement_links (workspace_id, evidence_object_id, requirement_occurrence_id)
  where retracted_at is null;

create table public.requirement_exceptions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  requirement_occurrence_id uuid not null,
  occurrence_intervention_type text not null, -- pinned from the occurrence, not restated
  exception_scope text not null default 'occurrence' check (exception_scope = 'occurrence'), -- v0.1: whole occurrence only
  action exception_action not null,
  authority_member_id uuid not null,
  reason text not null,
  predecessor_exception_id uuid,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, predecessor_exception_id), -- INV-035: no forks from one predecessor
  foreign key (workspace_id, requirement_occurrence_id, occurrence_intervention_type)
    references public.requirement_occurrences (workspace_id, id, intervention_type),
  foreign key (workspace_id, predecessor_exception_id)
    references public.requirement_exceptions (workspace_id, id),
  foreign key (workspace_id, authority_member_id) references public.memberships (workspace_id, id),
  -- INV-063 / ADR-005 decision 3: a hold occurrence can NEVER carry a
  -- not_applicable exception. waiver and accept_risk stay available to an
  -- authorised actor and stay visible -- an exception that hides itself is
  -- worse than no exception -- but the exception that asserts the obligation
  -- never existed cannot be written against a hold at all.
  check (action <> 'not_applicable' or occurrence_intervention_type <> 'hold')
);
comment on table public.requirement_exceptions is
  'Append-only. The hold/not_applicable prohibition is a table CHECK over the intervention type pinned from the occurrence (INV-063 enforcement), so it holds regardless of which command, role, or UI affordance is involved.';

create table public.requirement_exception_heads (
  workspace_id uuid not null references public.workspaces(id),
  requirement_occurrence_id uuid not null,
  exception_scope text not null default 'occurrence',
  current_exception_id uuid,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, requirement_occurrence_id, exception_scope),
  foreign key (workspace_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, id),
  foreign key (workspace_id, current_exception_id) references public.requirement_exceptions (workspace_id, id)
);

create table public.requirement_notices (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  requirement_occurrence_id uuid not null,
  -- only a witness occurrence can be noticed: the type is pinned from the
  -- occurrence and checked here, so a notice against a hold is unrepresentable
  occurrence_intervention_type text not null check (occurrence_intervention_type = 'witness'),
  notice_no int not null default 1 check (notice_no >= 1),
  recipient_contact_id uuid,
  recipients jsonb not null default '[]', -- party contacts with the delivery channel used
  sent_by_member_id uuid not null,
  sent_at timestamptz not null default now(),   -- SERVER time; never a client-claimed value
  required_notice interval not null check (required_notice > interval '0'),
  earliest_proceed_at timestamptz not null,
  -- v0.1 records a calendar duration configured as a workspace setting. There
  -- is no value here that labels it as the five-working-day примітка of
  -- Додаток В/Г: the Ukrainian working-day calendar is v0.2, and calendar days
  -- and робочі дні produce different dates (ADR-005 decision 3, INV-068).
  notice_duration_basis text not null default 'workspace_setting_calendar'
    check (notice_duration_basis = 'workspace_setting_calendar'),
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, id, earliest_proceed_at), -- an outcome pins the deadline it was recorded against
  unique (workspace_id, requirement_occurrence_id, notice_no),
  unique (workspace_id, requirement_occurrence_id, idempotency_key),
  foreign key (workspace_id, requirement_occurrence_id, occurrence_intervention_type)
    references public.requirement_occurrences (workspace_id, id, intervention_type),
  foreign key (workspace_id, recipient_contact_id) references public.party_contacts (workspace_id, id),
  foreign key (workspace_id, sent_by_member_id) references public.memberships (workspace_id, id),
  -- a notice addressed to nobody is not a notice
  check (jsonb_typeof(recipients) = 'array' and jsonb_array_length(recipients) >= 1),
  check (earliest_proceed_at > sent_at)
);
comment on table public.requirement_notices is
  'Append-only witness notification event. earliest_proceed_at is SERVER-computed as sent_at + required_notice and is never client-supplied (INV-068). It is a stored column rather than GENERATED ALWAYS because timestamptz + interval is only STABLE in PostgreSQL and a generated column requires an immutable expression; what the schema can still guarantee is that the deadline is strictly after the server sent_at, that the row is append-only, and that no client role holds INSERT or UPDATE on it -- the equality itself is asserted by the notice command. requirement_notice.status (sent / period_elapsed / attended / not_attended) in technical/states/state-catalog.csv is DERIVED here -- from the server clock against earliest_proceed_at and from notice_attendance_outcomes -- because entity-catalog.csv makes this table an append-only fact with immutable content, and a stored status column would have to be updated in place.';

create table public.requirement_evidence_decisions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  requirement_occurrence_id uuid not null,
  approver_role text not null,        -- pinned from the occurrence, never typed into the decision
  outcome decision_outcome not null,
  decided_by_member_id uuid,
  external_session_id uuid,           -- FK added after public.external_sessions (section 7)
  external_access_grant_id uuid,      -- FK added after public.external_access_grants (section 7)
  decision_batch_id uuid,             -- the receipt; FK added after public.external_decision_batches (section 7)
  assurance_label text,
  reason text,
  issues jsonb not null default '[]',
  superseded_decision_id uuid,
  idempotency_key text not null,
  decided_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, superseded_decision_id),  -- INV-035: no forks
  unique (workspace_id, requirement_occurrence_id, idempotency_key),
  -- the decision can only exist in the role the occurrence names, which is what
  -- satisfied(o) quantifies over for a hold (INV-061)
  foreign key (workspace_id, requirement_occurrence_id, approver_role)
    references public.requirement_occurrences (workspace_id, id, approver_role),
  foreign key (workspace_id, decided_by_member_id) references public.memberships (workspace_id, id),
  foreign key (workspace_id, superseded_decision_id)
    references public.requirement_evidence_decisions (workspace_id, id),
  -- exactly one deciding authority: an internal member, or an occurrence-scoped
  -- external session together with the grant it was exchanged from. Never both,
  -- never neither, and never a session without its grant.
  check ((decided_by_member_id is not null
            and external_session_id is null and external_access_grant_id is null
            and decision_batch_id is null)
      or (external_session_id is not null and external_access_grant_id is not null
            and decision_batch_id is not null
            and decided_by_member_id is null)),
  -- v0.1 external assurance is LINK_CONFIRMATION -- email link, IP, server time
  -- -- and is NOT an electronic signature. КЕП assurance levels are v0.2
  -- (ADR-005 assumption d), so no other value and no absent value is storable.
  check ((external_session_id is null and assurance_label is null)
      or (external_session_id is not null and assurance_label = 'LINK_CONFIRMATION'))
);
comment on table public.requirement_evidence_decisions is
  'Append-only accept/return on ONE occurrence (INV-075). Governs package eligibility and never money: there is no path from this outcome to a quantity or a valuation row, and a commercial decision never releases an evidence block. INV-069 (no member decides their own capture or progress) compares actor identity against every target item and is enforced by the decision command, not by a constraint on this row.';

-- The head the eligibility predicate needs. packages-and-acceptance.md
-- "Occurrence-scoped evidence decisions" requires exactly one head per
-- (workspace, requirement_occurrence, approver_role): a submit locks it,
-- supplies its expected version, references the prior head decision, and
-- advances it in the same transaction. Without this table the no-fork
-- constraint on requirement_evidence_decisions stops two SUCCESSORS from one
-- predecessor but not two independent ROOT decisions on one occurrence and
-- role, which is the case the predicate cannot resolve. Same shape as
-- internal_review_heads and requirement_exception_heads (INV-035).
create table public.requirement_evidence_decision_heads (
  workspace_id uuid not null references public.workspaces(id),
  requirement_occurrence_id uuid not null,
  approver_role text not null,
  current_decision_id uuid,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, requirement_occurrence_id, approver_role),
  foreign key (workspace_id, requirement_occurrence_id, approver_role)
    references public.requirement_occurrences (workspace_id, id, approver_role),
  foreign key (workspace_id, current_decision_id)
    references public.requirement_evidence_decisions (workspace_id, id)
);

create table public.notice_attendance_outcomes (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  requirement_notice_id uuid not null,
  notice_earliest_proceed_at timestamptz not null, -- pinned from the notice, not recomputed
  outcome_no int not null default 1 check (outcome_no >= 1),
  outcome text not null check (outcome in ('attended','not_attended')),
  attendee_claims jsonb not null default '{}',    -- self-declared; labeled, never identity proof
  requirement_evidence_decision_id uuid,
  recorded_by_member_id uuid not null,
  recorded_at timestamptz not null default now(),
  predecessor_outcome_id uuid,
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, requirement_notice_id, outcome_no),
  unique (workspace_id, predecessor_outcome_id),  -- INV-035: no forks
  foreign key (workspace_id, requirement_notice_id, notice_earliest_proceed_at)
    references public.requirement_notices (workspace_id, id, earliest_proceed_at),
  foreign key (workspace_id, requirement_evidence_decision_id)
    references public.requirement_evidence_decisions (workspace_id, id),
  foreign key (workspace_id, recorded_by_member_id) references public.memberships (workspace_id, id),
  foreign key (workspace_id, predecessor_outcome_id)
    references public.notice_attendance_outcomes (workspace_id, id),
  check ((outcome_no = 1) = (predecessor_outcome_id is null)),
  -- recorded non-attendance is appendable only at or after the server-computed
  -- deadline the row carries from its notice (INV-068; execution-and-evidence.md
  -- decision 6). Before that instant there is nothing to record.
  check (outcome <> 'not_attended' or recorded_at >= notice_earliest_proceed_at),
  -- attendance carries the decision the attendee made; non-attendance cannot
  check ((outcome = 'attended') = (requirement_evidence_decision_id is not null))
);
comment on table public.notice_attendance_outcomes is
  'Append-only. Recorded non-attendance after the period is a POSITIVE fact and evidence of process in favour of the performer, not a silent pass. The link to the decision the attendee made is declared in relationship-catalog.csv as notice_attendance_outcomes carries_decision requirement_evidence_decisions (added 2026-08-06); it is required by the witness release condition in ADR-005 decision 3 and by the state-catalog projections requirement_notice.status sent/period_elapsed -> attended.';

create table public.review_target_sets (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  work_assignment_id uuid not null,
  requirement_occurrence_id uuid not null,
  item_set_hash bytea not null,       -- deterministic hash of the normalized item set
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, requirement_occurrence_id, item_set_hash), -- INV-036
  foreign key (workspace_id, project_id, work_assignment_id)
    references public.work_assignments (workspace_id, project_id, id),
  foreign key (workspace_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, id)
);

create table public.review_target_items (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  review_target_set_id uuid not null,
  position int not null,
  evidence_object_id uuid,
  evidence_requirement_link_id uuid,
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, review_target_set_id, position),
  foreign key (workspace_id, review_target_set_id) references public.review_target_sets (workspace_id, id),
  foreign key (workspace_id, evidence_object_id)   references public.evidence_objects (workspace_id, id),
  foreign key (workspace_id, evidence_requirement_link_id)
    references public.evidence_requirement_links (workspace_id, id),
  check (evidence_object_id is not null or evidence_requirement_link_id is not null)
);

create table public.internal_review_decisions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  review_target_set_id uuid not null,
  outcome review_outcome not null,
  reviewer_member_id uuid not null,
  reason text,
  issues jsonb not null default '[]',
  superseded_decision_id uuid,
  idempotency_key text not null,
  decided_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, superseded_decision_id),  -- INV-035: no forks
  unique (workspace_id, review_target_set_id, idempotency_key),
  foreign key (workspace_id, review_target_set_id) references public.review_target_sets (workspace_id, id),
  foreign key (workspace_id, superseded_decision_id) references public.internal_review_decisions (workspace_id, id),
  foreign key (workspace_id, reviewer_member_id) references public.memberships (workspace_id, id)
);
comment on table public.internal_review_decisions is
  'Append-only. Internal outcomes make scope ready/blocked for packaging; they NEVER accept contractual quantity (execution-and-evidence.md).';

create table public.internal_review_heads (
  workspace_id uuid not null references public.workspaces(id),
  review_target_set_id uuid not null,
  current_decision_id uuid,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, review_target_set_id),
  foreign key (workspace_id, review_target_set_id) references public.review_target_sets (workspace_id, id),
  foreign key (workspace_id, current_decision_id) references public.internal_review_decisions (workspace_id, id)
);

-- =============================================================================
-- 5A. STAGE CLOSURE, THE BYPASS AND ITS CLEARANCE, AND THE STATUTORY ACT
-- =============================================================================
-- ADR-005 decision 1: the gate blocks exactly two recorded acts -- the recorded
-- CLOSURE of a hidden or covered stage, and the ELIGIBILITY of performed
-- quantity to enter a package version. It never refuses to record a fact
-- (INV-065): nothing in this section appears as a precondition on
-- progress.record, progress.adjust, upload_intents.*, or evidence_links.create.

create table public.stage_closures (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  work_stage_id uuid not null,
  stage_status text not null default 'closed' check (stage_status = 'closed'),
  closure_no int not null default 1 check (closure_no >= 1),
  predecessor_closure_id uuid,
  correction_reason text,
  closed_by_member_id uuid not null,
  closed_at timestamptz not null default now(),   -- server time
  claimed_covered_at timestamptz,                 -- untrusted, like claimed capture time
  claimed_covered_tz_offset text,
  claimed_time_trust capture_time_trust not null default 'device_claimed',
  can_close_stage_result boolean not null,
  -- the EXACT occurrence set the predicate quantified over, frozen into the
  -- fact so the closure can be re-defended years later without asking the
  -- runtime what the requirements were at the time
  evaluated_occurrence_ids jsonb not null default '[]',
  evaluated_occurrence_count int not null check (evaluated_occurrence_count >= 0),
  evaluated_occurrence_set_hash bytea not null,
  relied_on_decision_ids jsonb not null default '[]',       -- accepting evidence decisions
  relied_on_notice_outcome_ids jsonb not null default '[]', -- notice + attendance facts for witnesses
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  primary key (id),
  unique (workspace_id, id),
  -- DOUBLE-CLOSING ONE STAGE IS UNREPRESENTABLE, as the AktFlow-era
  -- concealment_events guaranteed: exactly one root closure per stage, and no
  -- two successors from one predecessor, so the lineage is a chain with a
  -- single current head. A mistaken closure is corrected by appending a
  -- superseding closure; only after that correction may a new closure exist.
  unique (workspace_id, work_stage_id, closure_no),
  unique (workspace_id, predecessor_closure_id),
  unique (workspace_id, work_stage_id, idempotency_key),
  -- targets the stage AND its status, so this row can only exist against a
  -- stage recorded closed -- never against one closed by bypass
  foreign key (workspace_id, project_id, work_stage_id, stage_status)
    references public.work_stages (workspace_id, project_id, id, status),
  foreign key (workspace_id, predecessor_closure_id) references public.stage_closures (workspace_id, id),
  foreign key (workspace_id, closed_by_member_id) references public.memberships (workspace_id, id),
  check ((closure_no = 1) = (predecessor_closure_id is null)),
  check (predecessor_closure_id is null or correction_reason is not null),
  -- a SATISFIED closure is the only thing this table can record. The predicate
  -- result is not a reported field, it is the table's precondition (INV-061);
  -- the unsatisfied case is an unevidenced_closures row and nothing else.
  check (can_close_stage_result),
  check (jsonb_typeof(evaluated_occurrence_ids) = 'array'
     and jsonb_array_length(evaluated_occurrence_ids) = evaluated_occurrence_count),
  check (jsonb_typeof(relied_on_decision_ids) = 'array'),
  check (jsonb_typeof(relied_on_notice_outcome_ids) = 'array')
);
comment on table public.stage_closures is
  'Append-only fact that a stage was recorded closed with can_close_stage satisfied (INV-061). Closing does not by itself satisfy occurrences, allocate money, or make scope eligible: it records that the physical opportunity to inspect has passed. A refused closure returns the blocked_reason objects naming the requirement, the missing evidence, the owed role, and the money -- never a bare status word. evaluated_occurrence_count MAY be zero: a stage with no applicable blocking occurrence closes vacuously, which is correct behaviour and exactly why the bulk-instantiation dry run has to print uncovered lines (INV-072). Coverage is the gate; this fact only records what coverage produced.';
create index stage_closures_stage_idx
  on public.stage_closures (workspace_id, work_stage_id, closure_no);

create table public.unevidenced_closures (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  work_stage_id uuid not null,
  stage_status text not null default 'closed_without_evidence'
    check (stage_status = 'closed_without_evidence'),
  closed_by_member_id uuid not null,
  -- every one of these is MANDATORY: a bypass with no named authority, no
  -- structured reason, no free text, or no expected remedy cannot be written
  claimed_authority text not null check (length(btrim(claimed_authority)) > 0),
  reason_code text not null check (length(btrim(reason_code)) > 0),
  reason_text text not null check (length(btrim(reason_text)) > 0),
  expected_remedy text not null check (length(btrim(expected_remedy)) > 0),
  -- the exact unmet occurrence set AT THAT MOMENT, frozen and never recomputed;
  -- later satisfaction does not rewrite what was unmet at bypass time (INV-064)
  unmet_occurrence_ids jsonb not null,
  unmet_occurrence_count int not null check (unmet_occurrence_count >= 1),
  unmet_occurrence_set_hash bytea not null,
  -- the code every covering claim segment carries until a clearance exists
  blocked_reason_code text not null default 'CLOSED_WITHOUT_ACT'
    check (blocked_reason_code = 'CLOSED_WITHOUT_ACT'),
  closed_at timestamptz not null default now(),
  claimed_covered_at timestamptz,
  claimed_time_trust capture_time_trust not null default 'device_claimed',
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  primary key (id),
  unique (workspace_id, id),
  -- one bypass per stage. The fact is never edited, never superseded, and never
  -- deleted, so there is no second row to record.
  unique (workspace_id, work_stage_id),
  -- lets a clearance prove relationally that it was appended by a DIFFERENT
  -- member than the one who took the bypass
  unique (workspace_id, id, closed_by_member_id),
  -- targets the stage AND its status: a stage cannot carry both an ordinary
  -- closure and a bypass, because it has exactly one status to satisfy
  foreign key (workspace_id, project_id, work_stage_id, stage_status)
    references public.work_stages (workspace_id, project_id, id, status),
  foreign key (workspace_id, closed_by_member_id) references public.memberships (workspace_id, id),
  -- a bypass that claims nothing was unmet is not a bypass, it is an ordinary
  -- closure, and that path is stage_closures
  check (jsonb_typeof(unmet_occurrence_ids) = 'array'
     and jsonb_array_length(unmet_occurrence_ids) = unmet_occurrence_count)
);
comment on table public.unevidenced_closures is
  'Append-only bypass fact (ADR-005 decision 5). Reality is recorded -- the stage is closed -- and nothing is satisfied: the occurrences stay unsatisfied and every claim segment covering the scope is ineligible for ANY package version under code CLOSED_WITHOUT_ACT until an internal reviewer appends a clearance. The bypass prints in the frozen manifest as a named appendix with its value by currency, cleared or not. The price of a bypass is that the money waits; there is no path whose only consequence is escalation. reason_code is a closed identifier versioned with the command; the vocabulary is not invented here. unevidenced_closure.status (open / cleared) in state-catalog.csv is DERIVED from the existence of a current clearance, because this row is append-only with immutable content (entity-catalog.csv) and a stored status would have to be updated in place.';

create table public.unevidenced_closure_clearances (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  unevidenced_closure_id uuid not null,
  bypassing_member_id uuid not null,  -- pinned from the bypass, not restated by the clearing actor
  cleared_by_member_id uuid not null,
  clearance_no int not null default 1 check (clearance_no >= 1),
  predecessor_clearance_id uuid,
  substitute_evidence_object_id uuid,
  substitute_evidence_reference text,
  reason text not null check (length(btrim(reason)) > 0),
  cleared_at timestamptz not null default now(),
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, unevidenced_closure_id, clearance_no),
  unique (workspace_id, predecessor_clearance_id),  -- INV-035: no forks
  unique (workspace_id, unevidenced_closure_id, idempotency_key),
  foreign key (workspace_id, unevidenced_closure_id, bypassing_member_id)
    references public.unevidenced_closures (workspace_id, id, closed_by_member_id),
  foreign key (workspace_id, cleared_by_member_id) references public.memberships (workspace_id, id),
  foreign key (workspace_id, substitute_evidence_object_id)
    references public.evidence_objects (workspace_id, id),
  foreign key (workspace_id, predecessor_clearance_id)
    references public.unevidenced_closure_clearances (workspace_id, id),
  check ((clearance_no = 1) = (predecessor_clearance_id is null)),
  -- INV-069: self-clearance is UNREPRESENTABLE, not merely refused -- the row
  -- carries the bypassing actor through a composite FK and cannot equal it
  check (cleared_by_member_id <> bypassing_member_id),
  -- a clearance NAMES substitute evidence: an evidence object, or an explicit
  -- external reference. A clearance that names nothing is not a clearance.
  check (substitute_evidence_object_id is not null
      or length(btrim(coalesce(substitute_evidence_reference, ''))) > 0)
);
comment on table public.unevidenced_closure_clearances is
  'Append-only internal-reviewer fact restoring package eligibility (INV-064/INV-069). It never deletes, edits, or hides the bypass, and no clearance is implied by later evidence arriving on its own.';

create table public.statutory_acts (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  work_stage_id uuid not null,
  stage_closure_id uuid not null,
  act_form text not null check (act_form in ('dodatok_v','dodatok_g')),
  -- no source establishes which Додаток Н position takes which form; the
  -- mapping is recorded as the product's assumption and can never be stored as
  -- a norm reference (hidden-works-content-rules.md G)
  act_form_basis text not null default 'product_assumption'
    check (act_form_basis in ('product_assumption','user_selected')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  unique (workspace_id, stage_closure_id),  -- one act identity per closure
  foreign key (workspace_id, project_id, work_stage_id)
    references public.work_stages (workspace_id, project_id, id),
  foreign key (workspace_id, stage_closure_id) references public.stage_closures (workspace_id, id)
);
comment on table public.statutory_acts is
  'By-product of a SATISFIED stage closure only: the FK targets stage_closures, so there is no relational path from an unevidenced closure to an act (ADR-005 decision 10). form dodatok_v is the concealed-works act titled «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ»; form dodatok_g covers responsible structures and is a separate template. Every field of either form comes from the render template under hidden-works-content-rules.md; this schema names no field of Додаток В and adds none.';

create table public.statutory_act_versions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  statutory_act_id uuid not null,
  version_no int not null check (version_no >= 1),
  status text not null default 'draft' check (status in ('draft','frozen')),
  form_template_version text not null,
  -- the form citation is a normative string and obeys the same rule as every
  -- other one: tag and source are NOT NULL, so an unsourced act is unrenderable
  -- because it is unstorable (INV-073)
  form_citation text not null,
  form_citation_verification text not null
    check (form_citation_verification in ('VERIFIED_PRIMARY','VERIFIED_SECONDARY')),
  form_citation_source text not null,
  -- quantity comes from a progress entry ALREADY recorded against the line,
  -- with a share selector. There is no column a human can type a quantity into.
  root_progress_entry_id uuid,
  source_quantity_share numeric(9,6)
    check (source_quantity_share is null
        or (source_quantity_share > 0 and source_quantity_share <= 1)),
  printed_quantity numeric(20,6),
  printed_unit_id uuid,
  -- exactly three typed signatory slots per п. 8.4.3.5. There is no fourth
  -- slot, and no column for a field Додаток В does not have
  -- (hidden-works-content-rules.md E). The технагляд's кваліфікаційний
  -- сертифікат lives on the participant record (party_contacts), NOT here:
  -- whether Додаток В has a field for its серія and номер is not established,
  -- so this table stores nothing to print for it until
  -- hidden-works-content-rules.md allow-lists that field against В.1/В.2.
  builder_signatory jsonb,
  technical_supervision_signatory jsonb,
  designer_supervision_signatory jsonb,
  renderer_version text,
  content_hash bytea,
  frozen_at timestamptz,
  frozen_by_member_id uuid,
  draft_version bigint not null default 1,  -- optimistic concurrency for the draft only
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, statutory_act_id, version_no),
  foreign key (workspace_id, statutory_act_id) references public.statutory_acts (workspace_id, id),
  foreign key (workspace_id, root_progress_entry_id) references public.progress_entries (workspace_id, id),
  foreign key (workspace_id, printed_unit_id) references public.unit_definitions (workspace_id, id),
  foreign key (workspace_id, frozen_by_member_id) references public.memberships (workspace_id, id),
  -- INV-073: a printed quantity exists ONLY as a share of a recorded progress
  -- entry, in that entry's canonical unit. A quantity a human types into an act
  -- is literature, and this constraint is why one cannot be stored.
  check ((root_progress_entry_id is null and source_quantity_share is null
          and printed_quantity is null and printed_unit_id is null)
      or (root_progress_entry_id is not null and source_quantity_share is not null
          and printed_quantity is not null and printed_quantity > 0
          and printed_unit_id is not null)),
  check (status = 'draft'
      or (builder_signatory is not null and technical_supervision_signatory is not null)),
  check (status = 'draft' or (frozen_at is not null and content_hash is not null))
);
comment on table public.statutory_act_versions is
  'Immutable once frozen (INV-015), pinned by the package version that carries it, and assembled ONLY from already-recorded facts. Corrections re-assemble a successor version from newly recorded facts; nothing is edited in place. Every regulatory string it renders carries its verification tag and source in the data, not in the template.';

-- =============================================================================
-- 6. PACKAGES: TEMPLATES, VERSIONS, HEADS, LINES, SEGMENTS, ALLOCATION LEDGER
-- =============================================================================

create table public.package_template_versions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  template_key text not null,
  version_no int not null check (version_no >= 1),
  status text not null default 'draft' check (status in ('draft','published')),
  template_hash bytea,
  renderer_contract jsonb not null default '{}',
  published_at timestamptz,
  published_by_member_id uuid,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, template_key, version_no),
  foreign key (workspace_id, published_by_member_id) references public.memberships (workspace_id, id),
  check (status = 'draft' or (template_hash is not null and published_at is not null))
);

create table public.packages (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  package_series text not null default 'main',
  period_key text not null,
  title text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, project_id, contract_id, id),
  unique (workspace_id, project_id, contract_id, package_series, period_key),
  foreign key (workspace_id, project_id, contract_id)
    references public.contracts (workspace_id, project_id, id)
);
comment on table public.packages is
  'Stable container for ONE contract + series + period (INV-003: one package belongs to exactly one contract).';

create table public.package_versions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  package_id uuid not null,
  version_no int not null check (version_no >= 1),
  status package_version_status not null default 'draft',
  contract_version_id uuid not null,
  package_template_version_id uuid not null,
  renderer_version text not null,
  renderer_config jsonb not null default '{}',
  approval_policy_version text not null,
  source_manifest_hash bytea,         -- set atomically at freeze; stale-source conflict otherwise
  created_by_member_id uuid not null,
  frozen_at timestamptz,
  frozen_by_member_id uuid,
  draft_version bigint not null default 1,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, package_id, version_no),
  unique (workspace_id, project_id, contract_id, package_id, id),
  foreign key (workspace_id, project_id, contract_id, package_id)
    references public.packages (workspace_id, project_id, contract_id, id),
  foreign key (workspace_id, project_id, contract_id, contract_version_id)
    references public.contract_versions (workspace_id, project_id, contract_id, id),
  foreign key (workspace_id, package_template_version_id)
    references public.package_template_versions (workspace_id, id),
  foreign key (workspace_id, created_by_member_id) references public.memberships (workspace_id, id),
  foreign key (workspace_id, frozen_by_member_id)  references public.memberships (workspace_id, id),
  check (status = 'draft' or (frozen_at is not null and source_manifest_hash is not null))
);
comment on table public.package_versions is
  'Freeze validates all sources, REFUSES ineligible scope (INV-062), and atomically records the immutable snapshot (INV-015, INV-034). Submitted/ActiveForReview/Superseded/Completed are projections, never columns here. The act versions this package version carries are pinned through package_version_statutory_acts, not through a column: a package version covering several closed concealed stages carries several acts, which is what packages-and-acceptance.md "Frozen snapshot" has always said. The single statutory_act_version_id column and the N:1 row in relationship-catalog.csv were the disagreement; both were corrected on 2026-08-06 in the documents favour.';

-- M:N, because a package version covering several closed concealed stages
-- carries one act per stage. Append-only and pinned at freeze with the rest of
-- the snapshot (INV-015): the set a frozen version carries never changes.
create table public.package_version_statutory_acts (
  workspace_id uuid not null references public.workspaces(id),
  package_version_id uuid not null,
  statutory_act_version_id uuid not null,
  pinned_at timestamptz not null default now(),
  primary key (workspace_id, package_version_id, statutory_act_version_id),
  foreign key (workspace_id, package_version_id)
    references public.package_versions (workspace_id, id),
  foreign key (workspace_id, statutory_act_version_id)
    references public.statutory_act_versions (workspace_id, id)
);
comment on table public.package_version_statutory_acts is
  'Pins the act versions one frozen package version carries. Append-only: a frozen version never gains or loses an act, and a correction freezes a successor package version with its own set (INV-015).';

create table public.package_scope_heads (
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  package_id uuid not null,
  scope_key text not null default 'default',
  current_package_version_id uuid,
  head_state package_head_state,
  review_epoch bigint not null default 0,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, project_id, contract_id, package_id, scope_key), -- INV-027: one head per series/scope
  foreign key (workspace_id, project_id, contract_id, package_id)
    references public.packages (workspace_id, project_id, contract_id, id),
  foreign key (workspace_id, project_id, contract_id, package_id, current_package_version_id)
    references public.package_versions (workspace_id, project_id, contract_id, package_id, id)
);
comment on table public.package_scope_heads is
  'Serialized head selecting the sole current version and carrying the package review epoch (INV-027/INV-041). Advance atomically releases unaccepted allocations, preserves accepted reservations, revokes old grants/sessions, increments the epoch.';

create table public.claim_scope_lineages (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  parent_lineage_id uuid,             -- partition parentage (children of a partitioned scope)
  predecessor_lineage_id uuid,        -- material-change traceability; cannot inherit acceptance
  definition_hash bytea not null,     -- immutable: exact source allocations + homogeneous scope
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, contract_id, id),
  foreign key (workspace_id, project_id, contract_id)
    references public.contracts (workspace_id, project_id, id),
  foreign key (workspace_id, parent_lineage_id)      references public.claim_scope_lineages (workspace_id, id),
  foreign key (workspace_id, predecessor_lineage_id) references public.claim_scope_lineages (workspace_id, id)
);

create table public.claim_segment_lineage_heads (
  workspace_id uuid not null references public.workspaces(id),
  claim_scope_lineage_id uuid not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, claim_scope_lineage_id),
  foreign key (workspace_id, claim_scope_lineage_id) references public.claim_scope_lineages (workspace_id, id)
);
comment on table public.claim_segment_lineage_heads is
  'Shared serialization point for partition and decision commit (INV-006/INV-029): decision-vs-partition interleavings cannot lose coverage.';

create table public.package_lines (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  package_id uuid not null,
  package_version_id uuid not null,
  work_item_id uuid not null,
  location_id uuid,
  unit_id uuid not null,
  position int not null,
  price_state price_state not null,
  unit_price numeric(20,6),
  currency char(3) not null,
  tax_mode tax_mode not null,
  tax_rate numeric(7,4),
  line_quantity numeric(20,6) not null check (line_quantity > 0),
  net_minor_units bigint,
  tax_minor_units bigint,
  gross_minor_units bigint,
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, package_version_id, id),
  foreign key (workspace_id, project_id, contract_id, package_id, package_version_id)
    references public.package_versions (workspace_id, project_id, contract_id, package_id, id),
  foreign key (workspace_id, work_item_id) references public.work_items (workspace_id, id),
  foreign key (workspace_id, project_id, location_id)
    references public.locations (workspace_id, project_id, id),
  foreign key (workspace_id, unit_id) references public.unit_definitions (workspace_id, id),
  check ((net_minor_units is null and tax_minor_units is null and gross_minor_units is null)
      or (gross_minor_units = net_minor_units + tax_minor_units))
);
-- INV-033 acceptance-homogeneity: one work-item version + location + unit price
-- + currency + tax basis per line. The compiler command splits heterogeneous
-- scope; a partial unique index (with coalesced null location) backs it:
create unique index package_lines_homogeneous_uniq
  on public.package_lines (workspace_id, package_version_id, work_item_id,
    coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(unit_price, -1), currency, tax_mode, coalesce(tax_rate, -1));

create table public.package_line_claim_segments (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  package_id uuid not null,
  package_version_id uuid not null,
  package_line_id uuid not null,
  claim_scope_lineage_id uuid not null,
  parent_segment_id uuid,
  quantity numeric(20,6) not null check (quantity > 0),
  net_minor_units bigint,
  tax_minor_units bigint,
  gross_minor_units bigint,
  is_partitioned boolean not null default false, -- lineage lifecycle flag; content immutable
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, package_version_id, package_line_id, id),
  foreign key (workspace_id, package_version_id, package_line_id)
    references public.package_lines (workspace_id, package_version_id, id),
  foreign key (workspace_id, contract_id, claim_scope_lineage_id)
    references public.claim_scope_lineages (workspace_id, contract_id, id),
  foreign key (workspace_id, parent_segment_id)
    references public.package_line_claim_segments (workspace_id, id),
  check ((net_minor_units is null and tax_minor_units is null and gross_minor_units is null)
      or (gross_minor_units = net_minor_units + tax_minor_units))
);
comment on table public.package_line_claim_segments is
  'The exact quantity-decision grain. Partition is ONE transaction via app_private.partition_claim_segment: children are non-overlapping, child quantities AND coupled minor units reconcile to the parent (INV-004/INV-011/INV-037), prior decision coverage propagates (INV-006), the new decision attaches only to its exact child.';

create table public.package_line_progress_sources (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  package_version_id uuid not null,
  claim_segment_id uuid not null,
  root_progress_entry_id uuid not null,
  quantity numeric(20,6) not null check (quantity > 0),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, claim_segment_id, root_progress_entry_id),
  foreign key (workspace_id, claim_segment_id)
    references public.package_line_claim_segments (workspace_id, id),
  foreign key (workspace_id, root_progress_entry_id)
    references public.progress_entries (workspace_id, id)
);
comment on table public.package_line_progress_sources is
  'Immutable per-segment allocation composition. Every claim segment is tied to exact non-adjustment progress roots; sums reconcile with the progress_claim_allocations ledger (INV-005).';

create table public.progress_claim_allocations (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  root_progress_entry_id uuid not null,
  package_id uuid,
  package_version_id uuid,
  claim_segment_id uuid,
  movement allocation_movement not null,
  quantity numeric(20,6) not null check (quantity <> 0),
  original_allocation_id uuid,        -- every release references the original movement
  command_ref text not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  foreign key (workspace_id, root_progress_entry_id) references public.progress_entries (workspace_id, id),
  foreign key (workspace_id, package_version_id)     references public.package_versions (workspace_id, id),
  foreign key (workspace_id, claim_segment_id)
    references public.package_line_claim_segments (workspace_id, id),
  foreign key (workspace_id, original_allocation_id)
    references public.progress_claim_allocations (workspace_id, id),
  check (movement <> 'release' or original_allocation_id is not null)
);
comment on table public.progress_claim_allocations is
  'THE no-overclaim authority (INV-005/INV-025/INV-026): immutable signed ledger of reserve/activate/partition/release/accept_reserve movements per root measurement. progress_allocation_heads is the rebuildable balance. Accepted movements are never released in v0.1 (INV-026).';

create table public.package_evidence_sources (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  package_version_id uuid not null,
  evidence_object_id uuid not null,
  requirement_occurrence_id uuid,
  pinned_content_hash bytea not null,
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, package_version_id, evidence_object_id),
  foreign key (workspace_id, package_version_id) references public.package_versions (workspace_id, id),
  foreign key (workspace_id, evidence_object_id) references public.evidence_objects (workspace_id, id),
  foreign key (workspace_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, id)
);

create table public.package_artifacts (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  package_version_id uuid not null,
  artifact_kind artifact_kind not null,
  renderer_version text not null,
  renderer_config_hash bytea not null,
  storage_key text not null,
  byte_size bigint not null check (byte_size > 0),
  content_hash bytea not null,
  generated_by_service text not null,
  generated_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, storage_key),
  -- idempotent rendering identity (jobs-events-and-audit.md "Idempotent effects")
  unique (workspace_id, package_version_id, artifact_kind, renderer_version, renderer_config_hash),
  foreign key (workspace_id, package_version_id) references public.package_versions (workspace_id, id)
);

-- =============================================================================
-- 7. EXTERNAL REVIEW: REQUIREMENTS, GRANTS, SESSIONS, DECISIONS, COVERAGE
-- =============================================================================

create table public.package_approval_requirements (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  package_id uuid not null,
  package_version_id uuid not null,
  classification approval_classification not null,
  decision_kind approval_decision_kind not null,
  recipient_role text not null,
  recipient_contact_id uuid,
  package_line_id uuid,               -- null = whole-version scope
  claim_segment_id uuid,              -- null = whole-line/version scope
  parallel_group text not null default 'default',
  confirmation_text_version text not null,
  approval_scope_hash_inputs jsonb not null default '{}',
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, package_version_id, id),
  foreign key (workspace_id, project_id, contract_id, package_id, package_version_id)
    references public.package_versions (workspace_id, project_id, contract_id, package_id, id),
  foreign key (workspace_id, recipient_contact_id) references public.party_contacts (workspace_id, id),
  foreign key (workspace_id, package_version_id, package_line_id)
    references public.package_lines (workspace_id, package_version_id, id),
  foreign key (workspace_id, claim_segment_id)
    references public.package_line_claim_segments (workspace_id, id)
);
comment on table public.package_approval_requirements is
  'Pinned at freeze. Freeze fails unless every claim segment is covered by >= 1 REQUIRED quantity requirement (INV-034); observer/evidence-only coverage cannot make quantity acceptance vacuous. Observers cannot decide (INV-031). v0.1: parallel approvers only, no sequential engine.';

create table public.package_submissions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  package_version_id uuid not null,
  approval_policy_version text not null,
  submitted_by_member_id uuid not null,
  idempotency_key text not null,
  submitted_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, package_version_id, idempotency_key),
  foreign key (workspace_id, package_version_id) references public.package_versions (workspace_id, id),
  foreign key (workspace_id, submitted_by_member_id) references public.memberships (workspace_id, id)
);

create table public.external_access_grants (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  -- exactly one scope kind per grant (INV-074). ADR-005 decision 9 adds the
  -- requirement-occurrence scope so an external hold approver can decide BEFORE
  -- any package version exists; without it eligibility would wait for a
  -- decision that only exists after freeze, which is circular.
  scope_kind text not null default 'package_version'
    check (scope_kind in ('package_version','requirement_occurrence')),
  package_id uuid,
  package_version_id uuid,
  requirement_occurrence_id uuid,
  credential_type grant_credential_type not null default 'bearer_email_link',
  token_hmac bytea not null,          -- HMAC-SHA-256(server_key, raw_token); raw token NEVER stored (INV-044)
  hmac_key_id text not null,
  recipient_contact_id uuid,
  recipient_role text not null,
  permissions jsonb not null default '{}', -- exact view/decide scope incl approval requirement ids
  status grant_status not null default 'active',
  expires_at timestamptz not null,    -- initial link: 7 days or package supersession, whichever first
  exchange_consumed_at timestamptz,   -- INV-057: single-use atomic exchange marker
  revocation_version bigint not null default 0,
  review_epoch_at_issue bigint,       -- package-version scope only; an occurrence has no review epoch
  replaced_grant_id uuid,
  issued_by_member_id uuid not null,
  issued_at timestamptz not null default now(),
  version bigint not null default 1,
  primary key (id),
  unique (workspace_id, id),
  unique (hmac_key_id, token_hmac),
  foreign key (workspace_id, project_id, contract_id, package_id, package_version_id)
    references public.package_versions (workspace_id, project_id, contract_id, package_id, id),
  foreign key (workspace_id, project_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, project_id, id),
  foreign key (workspace_id, recipient_contact_id) references public.party_contacts (workspace_id, id),
  foreign key (workspace_id, replaced_grant_id) references public.external_access_grants (workspace_id, id),
  foreign key (workspace_id, issued_by_member_id) references public.memberships (workspace_id, id),
  -- an occurrence grant confers NO package-version access and vice versa: the
  -- other scope's columns are null, so there is nothing for a mismatch to read
  check ((scope_kind = 'package_version'
            and package_id is not null and package_version_id is not null
            and requirement_occurrence_id is null and review_epoch_at_issue is not null)
      or (scope_kind = 'requirement_occurrence'
            and requirement_occurrence_id is not null
            and package_id is null and package_version_id is null
            and review_epoch_at_issue is null))
);
comment on table public.external_access_grants is
  'bearer_email_link assurance: proves link possession, not identity (tenancy-and-security.md). 256-bit token, base64url, fragment-only delivery; deliberate POST exchange; GET prefetch never consumes (INV-010). Reissue revokes old grant + sessions. One-time post-commit provider send; crash => revoke-and-reissue (INV-044). ADR-005 changes the scope KIND only: the token, delivery, exchange, expiry, revocation, and workspace/project/contract boundaries are unchanged (INV-074).';

create table public.external_sessions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  external_access_grant_id uuid not null,
  package_version_id uuid,            -- null for an occurrence-scoped grant (INV-074)
  requirement_occurrence_id uuid,
  session_verifier bytea not null,    -- server-side verifier of the opaque cookie value
  verifier_key_id text not null,
  status session_status not null default 'active',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,      -- 30 minutes idle
  absolute_expires_at timestamptz not null,  -- 12 hours absolute
  rotated_from_session_id uuid,
  grant_revocation_version bigint not null,
  review_epoch bigint,                -- package-version scope only
  primary key (id),
  unique (workspace_id, id),
  unique (verifier_key_id, session_verifier),
  foreign key (workspace_id, external_access_grant_id)
    references public.external_access_grants (workspace_id, id),
  foreign key (workspace_id, package_version_id) references public.package_versions (workspace_id, id),
  foreign key (workspace_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, id),
  foreign key (workspace_id, rotated_from_session_id) references public.external_sessions (workspace_id, id),
  -- the session inherits the grant's single scope kind and fails closed on any
  -- mismatch; the review epoch exists only where a package review does
  check ((package_version_id is not null and requirement_occurrence_id is null
            and review_epoch is not null)
      or (requirement_occurrence_id is not null and package_version_id is null
            and review_epoch is null))
);
comment on table public.external_sessions is
  'Cookie: __Host- prefix, Path=/, Secure, HttpOnly, SameSite=Lax, no Domain. CSRF is a session-bound synchronizer token + origin checks; SameSite is NOT the defense (INV-058). Session carries grant revocation version + review epoch (INV-041/INV-056) and exactly one scope kind (INV-074).';

-- Deferred FKs for the occurrence evidence decision (section 5): the deciding
-- authority is an internal member OR an occurrence-scoped external session.
alter table public.requirement_evidence_decisions
  add constraint requirement_evidence_decisions_session_fkey
  foreign key (workspace_id, external_session_id)
  references public.external_sessions (workspace_id, id);
alter table public.requirement_evidence_decisions
  add constraint requirement_evidence_decisions_grant_fkey
  foreign key (workspace_id, external_access_grant_id)
  references public.external_access_grants (workspace_id, id);
-- EXTERNAL GATE: source-network security telemetry retention is bounded by the
-- approved privacy/retention schedule before pilot; not defaulted here.

-- ONE receipt object for both grant scope kinds. packages-and-acceptance.md
-- "Decision submission" says a batch records "grant scope: package version, or
-- requirement occurrence", and an occurrence-scoped submit precedes every
-- package version -- so a NOT NULL package_version_id would leave half the
-- external plane with no receipt, no confirmation-text version and no
-- idempotency record, and roadmap.md's M5 exit gate ("the reviewer receives an
-- immutable decision receipt") would be unmeetable for it. Exclusive arc
-- instead: exactly one scope kind per batch, matching the grant (INV-074).
create table public.external_decision_batches (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid,                    -- null on an occurrence-scoped batch
  package_id uuid,                     -- null on an occurrence-scoped batch
  package_version_id uuid,             -- null on an occurrence-scoped batch
  requirement_occurrence_id uuid,      -- null on a package-scoped batch
  external_access_grant_id uuid not null,
  external_session_id uuid not null,
  reviewer_claims jsonb not null default '{}', -- self-declared name/company/title; labeled, never identity proof
  confirmation_text_version text not null,
  submitted_at timestamptz,
  server_received_at timestamptz not null default now(),
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  receipt_id uuid not null default gen_random_uuid(),
  receipt_hash bytea not null,
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, external_access_grant_id, idempotency_key), -- INV-007
  -- exactly one scope kind, and it must be the kind its grant carries (INV-074)
  check ((package_version_id is not null and contract_id is not null
            and package_id is not null and requirement_occurrence_id is null)
      or (requirement_occurrence_id is not null and package_version_id is null
            and contract_id is null and package_id is null)),
  foreign key (workspace_id, project_id, contract_id, package_id, package_version_id)
    references public.package_versions (workspace_id, project_id, contract_id, package_id, id),
  foreign key (workspace_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, id),
  foreign key (workspace_id, external_access_grant_id)
    references public.external_access_grants (workspace_id, id),
  foreign key (workspace_id, external_session_id) references public.external_sessions (workspace_id, id)
);

-- the receipt link for an occurrence-scoped external evidence decision: the
-- batch is what carries the confirmation-text version, the idempotency record
-- and the receipt hash, so an externally submitted decision must name one
alter table public.requirement_evidence_decisions
  add constraint requirement_evidence_decisions_batch_fkey
  foreign key (workspace_id, decision_batch_id)
  references public.external_decision_batches (workspace_id, id);

create table public.external_commercial_decisions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  package_version_id uuid not null,
  decision_batch_id uuid not null,
  approval_requirement_id uuid not null,
  package_line_id uuid not null,
  claim_segment_id uuid not null,
  outcome decision_outcome not null,
  reason text,
  primary key (id),
  unique (workspace_id, id),
  -- INV-028: at most one terminal decision per complete commercial target tuple
  unique (workspace_id, package_version_id, approval_requirement_id, claim_segment_id),
  foreign key (workspace_id, decision_batch_id) references public.external_decision_batches (workspace_id, id),
  foreign key (workspace_id, package_version_id, approval_requirement_id)
    references public.package_approval_requirements (workspace_id, package_version_id, id),
  foreign key (workspace_id, package_version_id, package_line_id, claim_segment_id)
    references public.package_line_claim_segments (workspace_id, package_version_id, package_line_id, id)
);
comment on table public.external_commercial_decisions is
  'Terminal commercial outcome for (requirement, exact claim segment). Commit rechecks grant/session/epoch/CSRF/idempotency under the shared lineage head lock (INV-009/INV-029/INV-041). DECISION_ALREADY_FINAL on override attempts. v0.1 never reverses accepted quantity (INV-026).';

create table public.external_evidence_decisions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  package_version_id uuid not null,
  decision_batch_id uuid not null,
  approval_requirement_id uuid not null,
  evidence_object_id uuid not null,
  requirement_occurrence_id uuid not null,
  outcome decision_outcome not null,
  reason text,
  primary key (id),
  unique (workspace_id, id),
  -- INV-028: at most one terminal decision per complete evidence target tuple
  unique (workspace_id, package_version_id, approval_requirement_id, evidence_object_id, requirement_occurrence_id),
  foreign key (workspace_id, decision_batch_id) references public.external_decision_batches (workspace_id, id),
  foreign key (workspace_id, package_version_id, approval_requirement_id)
    references public.package_approval_requirements (workspace_id, package_version_id, id),
  foreign key (workspace_id, evidence_object_id) references public.evidence_objects (workspace_id, id),
  foreign key (workspace_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, id)
);
comment on table public.external_evidence_decisions is
  'Separate from commercial decisions BY DESIGN (INV-032): an evidence return never changes quantity or money; after monetary acceptance it creates a visible compliance exception instead.';

create table public.external_decision_issues (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  decision_batch_id uuid not null,
  severity issue_severity not null,
  code text not null,
  description text,
  commercial_decision_id uuid,
  evidence_decision_id uuid,
  claim_segment_id uuid,
  evidence_object_id uuid,
  primary key (id),
  unique (workspace_id, id),
  foreign key (workspace_id, decision_batch_id) references public.external_decision_batches (workspace_id, id),
  foreign key (workspace_id, commercial_decision_id) references public.external_commercial_decisions (workspace_id, id),
  foreign key (workspace_id, evidence_decision_id) references public.external_evidence_decisions (workspace_id, id),
  foreign key (workspace_id, claim_segment_id) references public.package_line_claim_segments (workspace_id, id),
  foreign key (workspace_id, evidence_object_id) references public.evidence_objects (workspace_id, id)
);

create table public.external_decision_coverage (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  commercial_decision_id uuid not null,
  descendant_segment_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, commercial_decision_id, descendant_segment_id),
  foreign key (workspace_id, commercial_decision_id)
    references public.external_commercial_decisions (workspace_id, id),
  foreign key (workspace_id, descendant_segment_id)
    references public.package_line_claim_segments (workspace_id, id)
);
comment on table public.external_decision_coverage is
  'INV-006: immutable derived coverage written in the SAME partition transaction. An earlier decision covers exact partition descendants without being copied; reviewer order cannot change the leaf-level result.';

create table public.prior_acceptance_references (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  package_id uuid not null,
  package_version_id uuid not null,   -- successor version
  claim_segment_id uuid not null,     -- successor segment
  approval_requirement_id uuid not null, -- successor requirement (prior acceptance is requirement-specific)
  original_package_version_id uuid not null,
  original_claim_segment_id uuid not null,
  original_commercial_decision_id uuid not null,
  approval_scope_hash bytea not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, package_version_id, approval_requirement_id, claim_segment_id),
  foreign key (workspace_id, project_id, contract_id, package_id, package_version_id)
    references public.package_versions (workspace_id, project_id, contract_id, package_id, id),
  foreign key (workspace_id, claim_segment_id)
    references public.package_line_claim_segments (workspace_id, id),
  foreign key (workspace_id, package_version_id, approval_requirement_id)
    references public.package_approval_requirements (workspace_id, package_version_id, id),
  -- the original chain must resolve through the SAME workspace/project/contract/package
  foreign key (workspace_id, project_id, contract_id, package_id, original_package_version_id)
    references public.package_versions (workspace_id, project_id, contract_id, package_id, id),
  foreign key (workspace_id, original_claim_segment_id)
    references public.package_line_claim_segments (workspace_id, id),
  foreign key (workspace_id, original_commercial_decision_id)
    references public.external_commercial_decisions (workspace_id, id)
);
comment on table public.prior_acceptance_references is
  'INV-008/INV-030: points at the original decision; NEVER a copied decision row. Valid only when claim-scope lineage, source allocations, AND approval_scope_hash match; hash match is necessary but not sufficient. One approver''s reference can never satisfy another required approver.';

-- =============================================================================
-- 8. OPERATIONAL FOUNDATION
-- =============================================================================

create table public.audit_events (
  id bigint generated always as identity,
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid,
  actor_kind audit_actor_kind not null,
  actor_member_id uuid,
  actor_grant_id uuid,
  actor_session_id uuid,
  service_principal text,
  action text not null,
  object_type text not null,
  object_id text not null,
  object_version bigint,
  outcome text not null,
  request_id text,
  idempotency_ref text,
  correlation_id uuid,
  causation_id uuid,
  reason_code text,
  details jsonb not null default '{}', -- safe structured summary; NEVER tokens/cookies/signed URLs/bodies
  assurance_label text,
  occurred_at timestamptz not null default now(),
  primary key (id),
  foreign key (workspace_id, actor_member_id)  references public.memberships (workspace_id, id),
  foreign key (workspace_id, actor_grant_id)   references public.external_access_grants (workspace_id, id),
  foreign key (workspace_id, actor_session_id) references public.external_sessions (workspace_id, id),
  -- INV-043: actor kind and actor reference are coherent
  check ((actor_kind = 'member'  and actor_member_id is not null and service_principal is null)
      or (actor_kind = 'external' and actor_grant_id is not null and actor_member_id is null)
      or (actor_kind in ('service','worker','system') and service_principal is not null and actor_member_id is null and actor_grant_id is null))
);
create index audit_events_workspace_idx
  on public.audit_events (workspace_id, occurred_at, id);
-- EXTERNAL GATE: audit retention duration is a statutory/policy decision from
-- the approved retention schedule, not a default here.

create table public.idempotency_records (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id), -- null ONLY for pre-workspace bootstrap
  actor_scope text not null,
  operation_id text not null,
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  idempotency_class text not null default 'standard_30d' check (idempotency_class in ('standard_30d','ledger_400d')),
  state text not null default 'in_progress' check (state in ('in_progress','completed','failed_replayable')),
  response_status integer check (response_status is null or response_status between 100 and 599),
  response_body jsonb,
  response_headers jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  primary key (id),
  unique nulls not distinct (workspace_id, actor_scope, operation_id, idempotency_key),
  check (expires_at > created_at),
  check ((state = 'in_progress' and response_status is null and response_body is null and completed_at is null)
      or (state <> 'in_progress' and response_status is not null and response_body is not null and completed_at is not null))
);

create table public.transaction_outbox (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  topic text not null,
  payload_version integer not null,
  aggregate_type text not null,
  aggregate_id text not null,
  aggregate_version bigint,
  source_fact_ref text,
  correlation_id uuid,
  causation_id uuid,
  actor_ref text,
  payload jsonb not null,
  payload_checksum bytea not null,
  available_at timestamptz not null default now(),
  claimed_by text,
  lease_token uuid,
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id)
);
comment on table public.transaction_outbox is
  'Written in the SAME commit as its source fact (INV-042). Topic/payload/causal identity immutable; claim/delivery columns operational. FORBIDDEN in payload: raw tokens, bearer links, auth headers, signed URLs, file bytes, secrets (jobs-events-and-audit.md).';
create index outbox_available_idx
  on public.transaction_outbox (workspace_id, available_at, id)
  where delivered_at is null;
create unique index transaction_outbox_telegram_processor_identity_uniq
  on public.transaction_outbox
    (workspace_id, topic, aggregate_type, aggregate_id, (payload ->> 'providerUpdateId'), (payload ->> 'eventKind'))
  where topic in ('telegram.message.normalized', 'telegram.channel.health_changed');

create table public.jobs (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  consumer text not null,
  outbox_event_id uuid not null,
  effect_kind text not null,
  status job_status not null default 'queued',
  retry_policy_version text not null,
  next_attempt_at timestamptz,
  attempt_count int not null default 0,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  -- INV-049: one effective job per (consumer, event, effect kind)
  unique (workspace_id, consumer, outbox_event_id, effect_kind),
  foreign key (workspace_id, outbox_event_id) references public.transaction_outbox (workspace_id, id)
);

create table public.job_attempts (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  job_id uuid not null,
  attempt_no int not null check (attempt_no >= 1),
  fence bigint not null,              -- INV-050: monotonically advancing; stale holders cannot finalize
  lease_token uuid not null,
  worker_identity text not null,
  handler_version text not null,
  payload_version int not null,
  started_at timestamptz not null default now(),
  lease_expires_at timestamptz not null,
  heartbeat_at timestamptz,
  finished_at timestamptz,
  outcome attempt_outcome,
  error_code text,
  error_summary text,                 -- sanitized; no stack traces/provider bodies/tokens
  correlation_id uuid,
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, job_id, attempt_no),
  foreign key (workspace_id, job_id) references public.jobs (workspace_id, id)
);

create table public.dead_letters (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  job_id uuid not null,
  outbox_event_id uuid not null,
  final_attempt_id uuid,
  reason_code text not null,
  handler_version text not null,
  payload_checksum bytea not null,
  first_failed_at timestamptz not null,
  last_failed_at timestamptz not null,
  operational_owner text not null,
  replayed_by_job_id uuid,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  foreign key (workspace_id, job_id) references public.jobs (workspace_id, id),
  foreign key (workspace_id, outbox_event_id) references public.transaction_outbox (workspace_id, id),
  foreign key (workspace_id, final_attempt_id) references public.job_attempts (workspace_id, id),
  foreign key (workspace_id, replayed_by_job_id) references public.jobs (workspace_id, id)
);

create table public.notifications (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  recipient_member_id uuid,
  kind text not null,
  source_fact_type text not null,
  source_fact_id text not null,
  payload jsonb not null default '{}',
  status notification_status not null default 'created',
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (id),
  unique (workspace_id, id),
  -- idempotent creation identity (recipient + kind + source fact)
  unique nulls not distinct (workspace_id, recipient_member_id, kind, source_fact_type, source_fact_id),
  foreign key (workspace_id, recipient_member_id) references public.memberships (workspace_id, id)
);

create table public.message_deliveries (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  notification_id uuid not null,
  channel text not null,
  delivery_generation int not null default 1,
  template_version text not null,
  provider text not null,
  provider_message_ref text,
  status delivery_status not null default 'requested',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  error_class text,
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, notification_id, channel, delivery_generation),
  foreign key (workspace_id, notification_id) references public.notifications (workspace_id, id)
);
comment on table public.message_deliveries is
  'Provider acceptance is delivery evidence, not proof a human read or acted (jobs-events-and-audit.md). Protected-link initial delivery does NOT go through here or the outbox: it is the one-time in-memory post-commit protocol (INV-044).';

-- =============================================================================
-- 9. PROJECTIONS AND API VIEWS (rebuildable; never client-writable)
-- =============================================================================

create table public.readiness_projection (
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  scope_kind text not null,           -- e.g. work_assignment | occurrence_scope
  scope_ref uuid not null,
  ready boolean not null,
  blocking jsonb not null default '[]',
  source_watermark text not null,
  algorithm_version text not null,
  calculated_at timestamptz not null default now(),
  stale boolean not null default false,
  error text,
  primary key (workspace_id, scope_kind, scope_ref)
);

comment on table public.readiness_projection is
  'Rebuildable projection AND a precondition (ADR-005 decision 7): stage closure and package freeze read it, and neither may be satisfied by a manual override. Becoming a precondition does not make it a status column -- there is no writable readiness anywhere in this schema.';

create table public.blocked_reasons (
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  work_assignment_id uuid not null,   -- INV-070: the deduplication key for value
  requirement_occurrence_id uuid not null,
  rule_version_id uuid,               -- what was agreed, and in which version
  -- closed, versioned vocabulary (ADR-005 decision 6). An unknown code is a
  -- projection error, never a free label, so it cannot be stored.
  code text not null check (code in (
    'ACT_NOT_SIGNED',
    'TEST_REPORT_MISSING',
    'MATERIAL_CERTIFICATE_MISSING',
    'SUPERVISION_SIGNATURE_MISSING',
    'CUSTOMER_MOTIVATED_REFUSAL',
    'NOTICE_PERIOD_NOT_ELAPSED',
    'CLOSED_WITHOUT_ACT')),
  code_vocabulary_version text not null,
  missing_evidence jsonb not null default '[]', -- by evidence_kind and acceptance_criterion
  awaiting_approver_role text,                  -- who owes the decision
  since timestamptz not null,                   -- server time the block began
  currency char(3),
  net_minor_units bigint,
  tax_minor_units bigint,
  gross_minor_units bigint,
  unvalued_quantity numeric(20,6),
  source_watermark text not null,
  algorithm_version text not null,
  calculated_at timestamptz not null default now(),
  stale boolean not null default false,
  primary key (workspace_id, requirement_occurrence_id, code),
  check (jsonb_typeof(missing_evidence) = 'array'),
  -- coupled money (INV-037) per currency; there is no cross-currency total
  -- anywhere (INV-012). All three components present or all three absent, and
  -- a valued row always names its currency.
  check ((net_minor_units is null and tax_minor_units is null and gross_minor_units is null)
      or (currency is not null
          and net_minor_units is not null and tax_minor_units is not null
          and gross_minor_units = net_minor_units + tax_minor_units)),
  -- every refusal names the money: either a valued amount, or the quantity of
  -- scope whose price state is missing. Missing price is unvalued, never zero
  -- (INV-038).
  check (net_minor_units is not null or unvalued_quantity is not null)
);
comment on table public.blocked_reasons is
  'The structured block object of ADR-005 decision 6, not a UI state. Rebuildable from occurrences, evidence, closures, and decisions. Blocked VALUE is attributed once per work_assignment_id: several unmet occurrences on one work reference the same assignment-scoped value and the projection sums DISTINCT assignments per currency (INV-070), so three missing requirements on one work cannot report three times the money. CLOSED_WITHOUT_ACT is a code inside evidence_blocked; no eighth value-at-risk state exists for the bypass (ADR-005 decision 8).';
create index blocked_reasons_assignment_idx
  on public.blocked_reasons (workspace_id, work_assignment_id, currency);

create table public.package_review_status_projection (
  workspace_id uuid not null references public.workspaces(id),
  package_id uuid not null,
  package_version_id uuid not null,
  review_status text not null check (review_status in ('draft','current_prepared','submitted','active_for_review','superseded_for_review','completed')),
  source_watermark text not null,
  algorithm_version text not null,
  calculated_at timestamptz not null default now(),
  stale boolean not null default false,
  primary key (workspace_id, package_version_id)
);

create table public.acceptance_projection (
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  claim_segment_id uuid not null,
  workflow_state var_state not null,  -- INV-040: exactly one state per active slice
  quantity numeric(20,6) not null,
  net_minor_units bigint,
  tax_minor_units bigint,
  gross_minor_units bigint,
  currency char(3) not null,
  source_watermark text not null,
  algorithm_version text not null,
  calculated_at timestamptz not null default now(),
  stale boolean not null default false,
  primary key (workspace_id, claim_segment_id),
  check ((net_minor_units is null and tax_minor_units is null and gross_minor_units is null)
      or (gross_minor_units = net_minor_units + tax_minor_units))
);

create table public.value_at_risk_projection (
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid,                   -- null = project-level rollup row
  currency char(3) not null,
  workflow_state var_state not null,
  net_minor_units bigint not null default 0,
  tax_minor_units bigint not null default 0,
  gross_minor_units bigint not null default 0,
  unvalued_quantity numeric(20,6) not null default 0,  -- missing-price register (INV-038)
  over_contract_quantity numeric(20,6) not null default 0, -- unapproved_unvalued_exposure (INV-039)
  source_watermark text not null,
  algorithm_version text not null,
  calculated_at timestamptz not null default now(),
  stale boolean not null default false,
  primary key (workspace_id, project_id, currency, workflow_state),
  check (gross_minor_units = net_minor_units + tax_minor_units)
);
comment on table public.value_at_risk_projection is
  'Per-currency, per-state rows; NO cross-currency total exists anywhere (INV-012). Accepted rows are reported alongside; VaR sums only the six risk states. Every exposed field names net/tax/gross; an unqualified acceptance_var field is forbidden (value-at-risk.md).';

-- API contract views (exposed schema; security-invoker; grants per slice).
create view api.readiness with (security_invoker = true) as
  select workspace_id, project_id, contract_id, scope_kind, scope_ref,
         ready, blocking, source_watermark, algorithm_version, calculated_at, stale
  from public.readiness_projection;

create view api.blocked_reasons with (security_invoker = true) as
  select workspace_id, project_id, contract_id, work_assignment_id,
         requirement_occurrence_id, rule_version_id, code, code_vocabulary_version,
         missing_evidence, awaiting_approver_role, since, currency,
         net_minor_units   as blocked_value_net_minor_units,
         tax_minor_units   as blocked_value_tax_minor_units,
         gross_minor_units as blocked_value_gross_minor_units,
         unvalued_quantity, source_watermark, algorithm_version, calculated_at, stale
  from public.blocked_reasons;

create view api.acceptance with (security_invoker = true) as
  select workspace_id, project_id, contract_id, claim_segment_id, workflow_state,
         quantity, net_minor_units, tax_minor_units, gross_minor_units, currency,
         source_watermark, algorithm_version, calculated_at, stale
  from public.acceptance_projection;

create view api.value_at_risk with (security_invoker = true) as
  select workspace_id, project_id, contract_id, currency, workflow_state,
         net_minor_units  as state_value_net_minor_units,
         tax_minor_units  as state_value_tax_minor_units,
         gross_minor_units as state_value_gross_minor_units,
         unvalued_quantity, over_contract_quantity,
         source_watermark, algorithm_version, calculated_at, stale
  from public.value_at_risk_projection;

-- =============================================================================
-- 10. SERIALIZED COMMAND INTERFACES (design stubs — implemented by migrations)
-- =============================================================================
-- Lock order everywhere (data-model.md): package-scope/review heads ->
-- segment-lineage heads -> progress-allocation heads; within a class by
-- (workspace_id, id).

create or replace function app_private.assert_reservation_invariant(
  p_workspace uuid, p_root_progress_entry uuid) returns void
language plpgsql as $$
begin
  -- Interface (INV-005/INV-024/INV-025): recompute effective quantity from
  -- progress_entries, recompute reservation from progress_claim_allocations,
  -- and prove 0 <= reserved <= effective while holding the allocation head
  -- lock. Called by every adjustment/freeze/partition/release/advance command.
  raise exception 'design interface: implemented by v0.1 migrations';
end $$;

create or replace function app_private.partition_claim_segment(
  p_workspace uuid, p_parent_segment uuid, p_child_quantities numeric[],
  p_expected_lineage_head_version bigint) returns uuid[]
language plpgsql as $$
begin
  -- Interface (INV-004/INV-006/INV-011/INV-037): one transaction that locks
  -- the segment-lineage head and affected allocation heads in stable order,
  -- creates non-overlapping children, allocates source quantities and coupled
  -- net/tax/gross minor units by largest remainder with stable lineage
  -- tie-break, proves reconciliation to the parent, marks the parent
  -- partitioned, and propagates prior decision coverage without copying
  -- decisions. Concurrent attempts on one parent produce one winner; losers
  -- receive a stale-segment conflict plus current children.
  raise exception 'design interface: implemented by v0.1 migrations';
end $$;

create or replace function app_private.close_work_stage(
  p_workspace uuid, p_work_stage uuid, p_expected_stage_version bigint,
  p_idempotency_key text, p_request_hash text) returns uuid
language plpgsql as $$
begin
  -- Interface (INV-061/INV-064/INV-065/INV-069): locks the stage row, evaluates
  -- can_close_stage(s) over every applicable occurrence whose blocking_scope is
  -- blocks_stage_closure or blocks_both, and either appends ONE stage_closures
  -- row freezing the exact evaluated occurrence set and the decisions relied
  -- on, or refuses with the per-occurrence blocked_reason objects -- the
  -- requirement, the missing evidence, the owed role, and the money -- never a
  -- bare status word. The unsatisfied path is unevidenced_closures and is a
  -- DIFFERENT command with a different capability (stage_closures.bypass); the
  -- two are mutually exclusive per stage and the stage row lock is what makes
  -- them so. A concealed stage additionally drafts its statutory act from
  -- already-recorded facts. Recording progress or evidence is never refused by
  -- this path or any other (INV-065).
  raise exception 'design interface: implemented by v0.1 migrations';
end $$;

create or replace function app_private.freeze_package_version(
  p_workspace uuid, p_package_version uuid, p_expected_draft_version bigint) returns void
language plpgsql as $$
begin
  -- Interface (INV-015/INV-034/INV-027/INV-062): validates all sources, requires
  -- every claim segment covered by a required commercial approval requirement,
  -- and REFUSES ineligible scope instead of filtering it out -- is_package_
  -- eligible is evaluated for every included segment inside the commit, and a
  -- failure returns PACKAGE_SCOPE_INELIGIBLE with a per-segment blocked_reason
  -- list plus the sums included and excluded by currency. That refusal is
  -- NAMED DISTINCTLY from a stale-source conflict: the remedies differ, and
  -- telling a user to refresh their draft when they need a supervisor's
  -- signature is a support cost. On success it records the immutable snapshot +
  -- source manifest hash atomically, including the excluded-scope and
  -- unevidenced-closure appendices; the FIRST freeze locks an empty
  -- package_scope_head and installs current_prepared with activated
  -- allocations; later freezes create candidates with no balance or VaR effect
  -- until head advance. Stale sources => freeze fails.
  raise exception 'design interface: implemented by v0.1 migrations';
end $$;

create or replace function app_private.advance_package_head(
  p_workspace uuid, p_package uuid, p_scope_key text,
  p_successor_version uuid, p_expected_head_version bigint) returns void
language plpgsql as $$
begin
  -- Interface (INV-026/INV-027/INV-041): locks the package head, segment
  -- heads, and allocation heads; revalidates lineage, prior acceptance
  -- references, candidate allocations, approval coverage; releases ONLY
  -- current_unaccepted_reserved_quantity; preserves accepted reservations;
  -- activates successor allocations; increments the review epoch; revokes old
  -- grants/sessions. Old-epoch decisions fail with REVIEW_VERSION_SUPERSEDED.
  raise exception 'design interface: implemented by v0.1 migrations';
end $$;

create or replace function app_private.apply_corrected_successor(
  p_workspace uuid, p_package uuid, p_scope_key text,
  p_correction_payload jsonb, p_expected_source_hashes jsonb) returns void
language plpgsql as $$
begin
  -- Interface (packages-and-acceptance.md "Atomic corrected successor"):
  -- one transaction that releases only unaccepted reservation, appends the
  -- immutable signed adjustment, proves accepted_reserved <= new effective,
  -- freezes the successor from the exact post-adjustment state, activates its
  -- allocations, installs it as current_prepared, advances the epoch, revokes
  -- old grants/sessions, and writes audit/idempotency/outbox. Any failure
  -- rolls back everything together. Never releases accepted reservations.
  raise exception 'design interface: implemented by v0.1 migrations';
end $$;

create or replace function app_private.submit_external_decision_batch(
  p_workspace uuid, p_session uuid, p_batch_payload jsonb,
  p_idempotency_key text, p_request_hash text) returns uuid
language plpgsql as $$
begin
  -- Interface (INV-007/INV-009/INV-028/INV-029/INV-031/INV-041/INV-057/INV-058):
  -- rechecks session/grant state, revocation version, exact package version,
  -- review epoch, CSRF, target scope, terminal uniqueness, and idempotency
  -- while holding the decision/partition serialization lock; commits one
  -- immutable batch + decisions + issues + receipt.
  raise exception 'design interface: implemented by v0.1 migrations';
end $$;

-- =============================================================================
-- 11. IMMUTABILITY / APPEND-ONLY TRIGGERS (INV-015 / INV-043 layer 2 of 3)
-- =============================================================================
-- Layer 1 is the absence of UPDATE/DELETE grants; layer 3 is tests.

create trigger progress_entries_append_only before update or delete on public.progress_entries
  for each row execute function app_private.reject_mutation();
create trigger valuation_allocations_append_only before update or delete on public.valuation_allocations
  for each row execute function app_private.reject_mutation();
create trigger capture_events_append_only before update or delete on public.capture_events
  for each row execute function app_private.reject_mutation();
create trigger import_row_results_append_only before update or delete on public.import_row_results
  for each row execute function app_private.reject_mutation();
create trigger source_amount_resolutions_append_only before update or delete on public.source_amount_resolutions
  for each row execute function app_private.reject_mutation();
create trigger requirement_exceptions_append_only before update or delete on public.requirement_exceptions
  for each row execute function app_private.reject_mutation();
create trigger requirement_notices_append_only before update or delete on public.requirement_notices
  for each row execute function app_private.reject_mutation();
create trigger notice_attendance_outcomes_append_only before update or delete on public.notice_attendance_outcomes
  for each row execute function app_private.reject_mutation();
create trigger requirement_evidence_decisions_append_only before update or delete on public.requirement_evidence_decisions
  for each row execute function app_private.reject_mutation();
create trigger stage_closures_append_only before update or delete on public.stage_closures
  for each row execute function app_private.reject_mutation();
-- INV-064 layer 2: the bypass fact is never deleted, edited, or superseded in
-- place. A clearance is a separate row and does not touch this one.
create trigger unevidenced_closures_append_only before update or delete on public.unevidenced_closures
  for each row execute function app_private.reject_mutation();
create trigger unevidenced_closure_clearances_append_only before update or delete on public.unevidenced_closure_clearances
  for each row execute function app_private.reject_mutation();
create trigger requirement_library_items_append_only before update or delete on public.requirement_library_items
  for each row execute function app_private.reject_mutation();
create trigger review_target_sets_append_only before update or delete on public.review_target_sets
  for each row execute function app_private.reject_mutation();
create trigger review_target_items_append_only before update or delete on public.review_target_items
  for each row execute function app_private.reject_mutation();
create trigger internal_review_decisions_append_only before update or delete on public.internal_review_decisions
  for each row execute function app_private.reject_mutation();
create trigger evidence_objects_append_only before update or delete on public.evidence_objects
  for each row execute function app_private.reject_mutation();
create trigger package_line_progress_sources_append_only before update or delete on public.package_line_progress_sources
  for each row execute function app_private.reject_mutation();
create trigger progress_claim_allocations_append_only before update or delete on public.progress_claim_allocations
  for each row execute function app_private.reject_mutation();
create trigger package_evidence_sources_append_only before update or delete on public.package_evidence_sources
  for each row execute function app_private.reject_mutation();
create trigger package_artifacts_append_only before update or delete on public.package_artifacts
  for each row execute function app_private.reject_mutation();
create trigger package_submissions_append_only before update or delete on public.package_submissions
  for each row execute function app_private.reject_mutation();
create trigger external_decision_batches_append_only before update or delete on public.external_decision_batches
  for each row execute function app_private.reject_mutation();
create trigger external_commercial_decisions_append_only before update or delete on public.external_commercial_decisions
  for each row execute function app_private.reject_mutation();
create trigger external_evidence_decisions_append_only before update or delete on public.external_evidence_decisions
  for each row execute function app_private.reject_mutation();
create trigger external_decision_issues_append_only before update or delete on public.external_decision_issues
  for each row execute function app_private.reject_mutation();
create trigger external_decision_coverage_append_only before update or delete on public.external_decision_coverage
  for each row execute function app_private.reject_mutation();
create trigger prior_acceptance_references_append_only before update or delete on public.prior_acceptance_references
  for each row execute function app_private.reject_mutation();
create trigger audit_events_append_only before update or delete on public.audit_events
  for each row execute function app_private.reject_mutation();
create trigger job_attempts_append_only before update or delete on public.job_attempts
  for each row execute function app_private.reject_mutation();
create trigger dead_letters_append_only before update or delete on public.dead_letters
  for each row execute function app_private.reject_mutation();

-- Frozen/published-content guards (migrations implement the exact column
-- allowlist: lifecycle transitions allowed, content mutation rejected):
--   contract_versions, work_items, requirement_template_versions,
--   requirement_rule_versions (INV-067: publish/retire are the ONLY lifecycle
--     transitions; no content column is ever writable after publication),
--   contract_version_rule_bindings (immutable once its contract version is
--     published), statutory_act_versions (draft -> frozen only),
--   package_template_versions, package_versions, package_lines,
--   package_line_claim_segments (content columns; is_partitioned is lifecycle).

-- =============================================================================
-- 12. RLS AND GRANTS (coverage rule; concrete policies ship per migration slice)
-- =============================================================================
-- Telegram project communication (migration 0062). The source of truth is the
-- normalized conversation; provider handles and raw webhook JSON are never a
-- member-plane projection. Every project-scoped relation uses workspace_id +
-- project_id and the relevant parent identity as its composite key.
create table public.telegram_chat_bindings (
  id uuid primary key, workspace_id uuid not null, project_id uuid not null,
  bot_id bigint not null, chat_id bigint not null, chat_type text not null,
  title_snapshot text, connected_by_member_id uuid not null, connected_at timestamptz not null,
  disconnected_at timestamptz, migrated_from_chat_id bigint,
  unique (workspace_id, id), unique (workspace_id, project_id, id),
  unique (bot_id, chat_id), unique (workspace_id, project_id),
  foreign key (workspace_id, project_id) references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, connected_by_member_id) references public.memberships(workspace_id, id),
  check (chat_type in ('group', 'supergroup')),
  check (migrated_from_chat_id is null or migrated_from_chat_id <> chat_id)
);
create table public.telegram_binding_intents (
  id uuid primary key, workspace_id uuid not null, project_id uuid not null,
  requested_by_member_id uuid not null, verifier_hash text not null,
  expires_at timestamptz not null, consumed_at timestamptz, consumed_by_telegram_user_id bigint,
  created_at timestamptz not null, unique (workspace_id, id), unique (verifier_hash),
  foreign key (workspace_id, project_id) references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, requested_by_member_id) references public.memberships(workspace_id, id),
  check (expires_at > created_at),
  check ((consumed_at is null) = (consumed_by_telegram_user_id is null))
);
create table public.telegram_member_link_intents (
  id uuid primary key, workspace_id uuid not null, project_id uuid not null,
  member_id uuid not null, issued_by_member_id uuid not null, verifier_hash text not null,
  expires_at timestamptz not null, consumed_at timestamptz, consumed_by_telegram_user_id bigint,
  created_at timestamptz not null, unique (workspace_id, id), unique (verifier_hash),
  foreign key (workspace_id, project_id) references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, member_id) references public.memberships(workspace_id, id),
  foreign key (workspace_id, issued_by_member_id) references public.memberships(workspace_id, id),
  check (expires_at > created_at),
  check ((consumed_at is null) = (consumed_by_telegram_user_id is null))
);
create table public.telegram_member_links (
  id uuid primary key, workspace_id uuid not null, member_id uuid not null,
  telegram_user_id bigint not null, verified_at timestamptz not null,
  revoked_at timestamptz, linked_by_member_id uuid not null, unique (workspace_id, id),
  unique (workspace_id, telegram_user_id), unique (workspace_id, member_id),
  foreign key (workspace_id, member_id) references public.memberships(workspace_id, id),
  foreign key (workspace_id, linked_by_member_id) references public.memberships(workspace_id, id)
);
create table public.telegram_inbox_updates (
  bot_id bigint not null, update_id bigint not null, payload jsonb,
  payload_hash text not null, state text not null, lease_id uuid, lease_expires_at timestamptz,
  leased_by text, attempts integer not null, disposition text, last_error_code text,
  primary key (bot_id, update_id),
  check (state in ('pending','leased','processed','failed')),
  check ((state = 'leased') = (lease_id is not null and lease_expires_at is not null and leased_by is not null)),
  check ((state in ('pending','leased')) = (payload is not null))
);
create table public.telegram_media_groups (
  id uuid primary key, workspace_id uuid not null, project_id uuid not null,
  telegram_chat_binding_id uuid not null, provider_media_group_id text not null,
  state text not null, unique (workspace_id, id), unique (workspace_id, project_id, id),
  unique (telegram_chat_binding_id, provider_media_group_id),
  foreign key (workspace_id, project_id) references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, telegram_chat_binding_id) references public.telegram_chat_bindings(workspace_id, project_id, id),
  check (state in ('open','awaiting_requirement_choice','processing','completed','not_evidence','failed'))
);
create table public.communication_messages (
  id uuid primary key, workspace_id uuid not null, project_id uuid not null,
  telegram_chat_binding_id uuid not null, direction text not null, kind text not null,
  text text, author_member_id uuid, provider_user_id bigint, provider_display_name_snapshot text,
  provider_username_snapshot text, provider_message_id bigint, provider_sent_at timestamptz,
  server_received_at timestamptz not null, reply_to_message_id uuid,
  provider_reply_to_message_id bigint, work_assignment_id uuid, retry_of_message_id uuid, delivery_state text not null,
  unique (workspace_id, id), unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, telegram_chat_binding_id) references public.telegram_chat_bindings(workspace_id, project_id, id),
  foreign key (workspace_id, author_member_id) references public.memberships(workspace_id, id),
  foreign key (workspace_id, project_id, reply_to_message_id) references public.communication_messages(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, work_assignment_id) references public.work_assignments(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, retry_of_message_id) references public.communication_messages(workspace_id, project_id, id),
  check (direction in ('inbound','outbound','system')),
  check (delivery_state in ('received','queued','provider_accepted','failed','delivery_unknown')),
  check (direction <> 'inbound' or delivery_state = 'received'),
  check (direction <> 'outbound' or delivery_state in ('queued','provider_accepted','failed','delivery_unknown')),
  check (retry_of_message_id is null or direction = 'outbound')
);
create table public.communication_message_events (
  id uuid primary key, workspace_id uuid not null, project_id uuid not null,
  message_id uuid not null, event_kind text not null, text text, delivery_state text, provider_update_id bigint,
  server_received_at timestamptz not null, unique (workspace_id, id), unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, message_id) references public.communication_messages(workspace_id, project_id, id),
  check (event_kind in ('edited','delivery_state_changed','bot_removed','bot_restored')),
  check ((event_kind = 'edited' and text is not null and delivery_state is null)
      or (event_kind = 'delivery_state_changed' and text is null and delivery_state is not null)
      or (event_kind in ('bot_removed','bot_restored') and text is null and delivery_state is null))
);
create unique index communication_message_events_provider_edit_identity_uniq
  on public.communication_message_events (workspace_id, project_id, message_id, provider_update_id)
  where event_kind = 'edited' and provider_update_id is not null;

alter table public.evidence_objects
  add constraint evidence_objects_project_identity_key unique (workspace_id, project_id, id);

create table public.communication_attachments (
  id uuid primary key, workspace_id uuid not null, project_id uuid not null,
  message_id uuid not null, telegram_media_group_id uuid, provider_file_id text, provider_file_unique_id text,
  state text not null, requirement_occurrence_id uuid, evidence_object_id uuid, failure_code text, terminal_at timestamptz,
  unique (workspace_id, id), unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, message_id) references public.communication_messages(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, telegram_media_group_id) references public.telegram_media_groups(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, requirement_occurrence_id) references public.requirement_occurrences(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, evidence_object_id) references public.evidence_objects(workspace_id, project_id, id),
  check (state in ('staged','unbound','awaiting_requirement_choice','processing','available','not_evidence','failed')),
  check ((state in ('unbound','available','not_evidence','failed')) = (terminal_at is not null)),
  check (state not in ('unbound','available','not_evidence','failed') or (provider_file_id is null and provider_file_unique_id is null)),
  check (state <> 'available' or evidence_object_id is not null),
  check (state <> 'failed' or failure_code is not null)
);
create table public.telegram_requirement_choices (
  id uuid primary key, workspace_id uuid not null, project_id uuid not null,
  communication_attachment_id uuid not null, telegram_media_group_id uuid, chooser_member_id uuid not null,
  requirement_occurrence_id uuid not null, chosen_at timestamptz not null,
  unique (workspace_id, id), unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, communication_attachment_id) references public.communication_attachments(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, telegram_media_group_id) references public.telegram_media_groups(workspace_id, project_id, id),
  foreign key (workspace_id, chooser_member_id) references public.memberships(workspace_id, id),
  foreign key (workspace_id, project_id, requirement_occurrence_id) references public.requirement_occurrences(workspace_id, project_id, id)
);
create table public.communication_delivery_attempts (
  id uuid primary key, workspace_id uuid not null, project_id uuid not null,
  message_id uuid not null, attempt_no integer not null, state text not null,
  provider_message_id bigint, error_code text, attempted_at timestamptz not null, completed_at timestamptz, unique (workspace_id, id),
  unique (workspace_id, project_id, id), unique (workspace_id, message_id, attempt_no),
  foreign key (workspace_id, project_id) references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, message_id) references public.communication_messages(workspace_id, project_id, id),
  check (state in ('provider_accepted','retryable_rejection','definitive_failure','delivery_unknown')),
  check (completed_at is null or completed_at >= attempted_at),
  check ((state = 'provider_accepted' and provider_message_id is not null and error_code is null)
      or (state <> 'provider_accepted' and provider_message_id is null))
);

-- Communication originals reject UPDATE/DELETE except their delivery-provider
-- projection; edits and delivery transitions append communication_message_events.
-- Events, requirement choices and delivery attempts are append-only. Terminal
-- attachment checks clear both provider file identifiers. Raw inbox payloads and
-- both `claim_*` functions are service-plane only; claims reject null or lease seconds
-- outside the explicit 1..900-second bound and use FOR UPDATE SKIP LOCKED.
create or replace function app.guard_communication_message() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE'
     or old.id is distinct from new.id
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
     or old.retry_of_message_id is distinct from new.retry_of_message_id then
    raise exception 'communication message original is immutable; append an event';
  end if;
  return new;
end $$;
create trigger communication_messages_guard before update or delete on public.communication_messages
  for each row execute function app.guard_communication_message();
create trigger communication_message_events_append_only before update or delete on public.communication_message_events
  for each row execute function app.reject_mutation();
create trigger telegram_requirement_choices_append_only before update or delete on public.telegram_requirement_choices
  for each row execute function app.reject_mutation();
create trigger communication_delivery_attempts_append_only before update or delete on public.communication_delivery_attempts
  for each row execute function app.reject_mutation();
revoke all on table public.telegram_chat_bindings, public.telegram_binding_intents,
  public.telegram_member_link_intents, public.telegram_member_links, public.telegram_inbox_updates,
  public.telegram_media_groups, public.communication_messages, public.communication_message_events,
  public.communication_attachments, public.telegram_requirement_choices,
  public.communication_delivery_attempts from public, anon, authenticated, goproceed_app;
grant select on public.telegram_chat_bindings, public.telegram_media_groups,
  public.communication_messages, public.communication_message_events to goproceed_app;
grant select (id, workspace_id, project_id, message_id, telegram_media_group_id,
  filename_snapshot, media_type_snapshot, byte_size, state, requirement_occurrence_id,
  evidence_object_id, failure_code, retry_disposition, created_at, terminal_at)
  on public.communication_attachments to goproceed_app;
grant select, insert, update on public.telegram_chat_bindings, public.telegram_binding_intents,
  public.telegram_member_link_intents, public.telegram_member_links, public.telegram_inbox_updates,
  public.telegram_media_groups, public.communication_messages, public.communication_attachments
  to goproceed_service;
grant select, insert on public.communication_message_events, public.telegram_requirement_choices,
  public.communication_delivery_attempts to goproceed_service;

-- Every tenant table reachable by an exposed role gets RLS (INV-060). Future
-- object privileges are deny-by-default via ALTER DEFAULT PRIVILEGES for every
-- actual migration-owner role discovered from pg_class/pg_default_acl
-- (tenancy-and-security.md "Grants and exposed schemas"). BFF/worker roles are
-- NOLOGIN NOBYPASSRLS capability roles assumed per request/task.

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.parties enable row level security;
alter table public.party_legal_profiles enable row level security;
alter table public.own_legal_entity_profiles enable row level security;
alter table public.party_contacts enable row level security;
alter table public.projects enable row level security;
alter table public.project_parties enable row level security;
alter table public.project_access_grants enable row level security;
alter table public.project_responsibility_assignments enable row level security;
alter table public.unit_definitions enable row level security;
alter table public.locations enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_versions enable row level security;
alter table public.work_items enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_files enable row level security;
alter table public.import_row_results enable row level security;
alter table public.source_amount_resolutions enable row level security;
alter table public.work_assignments enable row level security;
alter table public.work_stages enable row level security;
alter table public.progress_entries enable row level security;
alter table public.progress_allocation_heads enable row level security;
alter table public.valuation_allocations enable row level security;
alter table public.upload_intents enable row level security;
alter table public.capture_events enable row level security;
alter table public.evidence_objects enable row level security;
alter table public.evidence_requirement_links enable row level security;
alter table public.requirement_library_items enable row level security;
alter table public.requirement_rules enable row level security;
alter table public.requirement_rule_versions enable row level security;
alter table public.contract_version_rule_bindings enable row level security;
alter table public.requirement_template_versions enable row level security;
alter table public.requirement_occurrences enable row level security;
alter table public.requirement_exceptions enable row level security;
alter table public.requirement_exception_heads enable row level security;
alter table public.requirement_notices enable row level security;
alter table public.notice_attendance_outcomes enable row level security;
alter table public.requirement_evidence_decisions enable row level security;
alter table public.stage_closures enable row level security;
alter table public.unevidenced_closures enable row level security;
alter table public.unevidenced_closure_clearances enable row level security;
alter table public.statutory_acts enable row level security;
alter table public.statutory_act_versions enable row level security;
alter table public.review_target_sets enable row level security;
alter table public.review_target_items enable row level security;
alter table public.internal_review_decisions enable row level security;
alter table public.internal_review_heads enable row level security;
alter table public.package_template_versions enable row level security;
alter table public.packages enable row level security;
alter table public.package_versions enable row level security;
alter table public.package_scope_heads enable row level security;
alter table public.claim_scope_lineages enable row level security;
alter table public.claim_segment_lineage_heads enable row level security;
alter table public.package_lines enable row level security;
alter table public.package_line_claim_segments enable row level security;
alter table public.package_line_progress_sources enable row level security;
alter table public.progress_claim_allocations enable row level security;
alter table public.package_evidence_sources enable row level security;
alter table public.package_artifacts enable row level security;
alter table public.package_approval_requirements enable row level security;
alter table public.package_submissions enable row level security;
alter table public.external_access_grants enable row level security;
alter table public.external_sessions enable row level security;
alter table public.external_decision_batches enable row level security;
alter table public.external_commercial_decisions enable row level security;
alter table public.external_evidence_decisions enable row level security;
alter table public.external_decision_issues enable row level security;
alter table public.external_decision_coverage enable row level security;
alter table public.prior_acceptance_references enable row level security;
alter table public.audit_events enable row level security;
alter table public.idempotency_records enable row level security;
alter table public.transaction_outbox enable row level security;
alter table public.jobs enable row level security;
alter table public.job_attempts enable row level security;
alter table public.dead_letters enable row level security;
alter table public.notifications enable row level security;
alter table public.message_deliveries enable row level security;
alter table public.readiness_projection enable row level security;
alter table public.blocked_reasons enable row level security;
alter table public.package_review_status_projection enable row level security;
alter table public.acceptance_projection enable row level security;
alter table public.value_at_risk_projection enable row level security;
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

-- =============================================================================
-- END OF TARGET DESIGN
-- =============================================================================
