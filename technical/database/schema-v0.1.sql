-- =============================================================================
-- GoProceed v0.1 TARGET DESIGN DDL
-- Status: Approved target design. Applies to: v0.1. Last reviewed: 2026-07-30.
--
-- THIS FILE IS NOT A MIGRATION. Applied migrations under supabase/migrations/
-- remain the only truth for the actual database. This file is the reviewed
-- target contract that v0.0/v0.1 migrations must implement additively
-- (docs/architecture/data-model.md "Additive migration rules").
--
-- Sources of every rule here:
--   docs/domain/domain-model.md, execution-and-evidence.md,
--   packages-and-acceptance.md, value-at-risk.md, glossary.md
--   docs/architecture/data-model.md, tenancy-and-security.md,
--   files-and-storage.md, jobs-events-and-audit.md
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
create type capture_origin          as enum ('native_camera','photo_picker','file_picker','form','import','generated_derivative');
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
  check (tax_mode <> 'unknown' or pool_gross_minor_units is null)
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
-- 3. EXECUTION: ASSIGNMENTS, PROGRESS, ALLOCATION HEADS, VALUATION LINEAGE
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
  requirement_template_version_id uuid,
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
-- 5. REQUIREMENTS AND INTERNAL REVIEW
-- =============================================================================

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
  requirement_template_version_id uuid not null,
  location_id uuid,
  quantity_scope jsonb not null default '{}', -- exact quantity/location scope of the obligation
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id, work_assignment_id)
    references public.work_assignments (workspace_id, project_id, id),
  foreign key (workspace_id, requirement_template_version_id)
    references public.requirement_template_versions (workspace_id, id),
  foreign key (workspace_id, project_id, location_id)
    references public.locations (workspace_id, project_id, id),
  foreign key (workspace_id, created_by_member_id) references public.memberships (workspace_id, id)
);

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
  exception_scope text not null default 'occurrence' check (exception_scope = 'occurrence'), -- v0.1: whole occurrence only
  action exception_action not null,
  authority_member_id uuid not null,
  reason text not null,
  predecessor_exception_id uuid,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, predecessor_exception_id), -- INV-035: no forks from one predecessor
  foreign key (workspace_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, id),
  foreign key (workspace_id, predecessor_exception_id)
    references public.requirement_exceptions (workspace_id, id),
  foreign key (workspace_id, authority_member_id) references public.memberships (workspace_id, id)
);

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
  'Freeze validates all sources and atomically records the immutable snapshot (INV-015, INV-034). Submitted/ActiveForReview/Superseded/Completed are projections, never columns here.';

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
  package_id uuid not null,
  package_version_id uuid not null,
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
  review_epoch_at_issue bigint not null,
  replaced_grant_id uuid,
  issued_by_member_id uuid not null,
  issued_at timestamptz not null default now(),
  version bigint not null default 1,
  primary key (id),
  unique (workspace_id, id),
  unique (hmac_key_id, token_hmac),
  foreign key (workspace_id, project_id, contract_id, package_id, package_version_id)
    references public.package_versions (workspace_id, project_id, contract_id, package_id, id),
  foreign key (workspace_id, recipient_contact_id) references public.party_contacts (workspace_id, id),
  foreign key (workspace_id, replaced_grant_id) references public.external_access_grants (workspace_id, id),
  foreign key (workspace_id, issued_by_member_id) references public.memberships (workspace_id, id)
);
comment on table public.external_access_grants is
  'bearer_email_link assurance: proves link possession, not identity (tenancy-and-security.md). 256-bit token, base64url, fragment-only delivery; deliberate POST exchange; GET prefetch never consumes (INV-010). Reissue revokes old grant + sessions. One-time post-commit provider send; crash => revoke-and-reissue (INV-044).';

create table public.external_sessions (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  external_access_grant_id uuid not null,
  package_version_id uuid not null,
  session_verifier bytea not null,    -- server-side verifier of the opaque cookie value
  verifier_key_id text not null,
  status session_status not null default 'active',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,      -- 30 minutes idle
  absolute_expires_at timestamptz not null,  -- 12 hours absolute
  rotated_from_session_id uuid,
  grant_revocation_version bigint not null,
  review_epoch bigint not null,
  primary key (id),
  unique (workspace_id, id),
  unique (verifier_key_id, session_verifier),
  foreign key (workspace_id, external_access_grant_id)
    references public.external_access_grants (workspace_id, id),
  foreign key (workspace_id, package_version_id) references public.package_versions (workspace_id, id),
  foreign key (workspace_id, rotated_from_session_id) references public.external_sessions (workspace_id, id)
);
comment on table public.external_sessions is
  'Cookie: __Host- prefix, Path=/, Secure, HttpOnly, SameSite=Lax, no Domain. CSRF is a session-bound synchronizer token + origin checks; SameSite is NOT the defense (INV-058). Session carries grant revocation version + review epoch (INV-041/INV-056).';
-- EXTERNAL GATE: source-network security telemetry retention is bounded by the
-- approved privacy/retention schedule before pilot; not defaulted here.

create table public.external_decision_batches (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  contract_id uuid not null,
  package_id uuid not null,
  package_version_id uuid not null,
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
  foreign key (workspace_id, project_id, contract_id, package_id, package_version_id)
    references public.package_versions (workspace_id, project_id, contract_id, package_id, id),
  foreign key (workspace_id, external_access_grant_id)
    references public.external_access_grants (workspace_id, id),
  foreign key (workspace_id, external_session_id) references public.external_sessions (workspace_id, id)
);

create table public.external_quantity_decisions (
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
  -- INV-028: at most one terminal decision per complete quantity target tuple
  unique (workspace_id, package_version_id, approval_requirement_id, claim_segment_id),
  foreign key (workspace_id, decision_batch_id) references public.external_decision_batches (workspace_id, id),
  foreign key (workspace_id, package_version_id, approval_requirement_id)
    references public.package_approval_requirements (workspace_id, package_version_id, id),
  foreign key (workspace_id, package_version_id, package_line_id, claim_segment_id)
    references public.package_line_claim_segments (workspace_id, package_version_id, package_line_id, id)
);
comment on table public.external_quantity_decisions is
  'Terminal quantity outcome for (requirement, exact claim segment). Commit rechecks grant/session/epoch/CSRF/idempotency under the shared lineage head lock (INV-009/INV-029/INV-041). DECISION_ALREADY_FINAL on override attempts. v0.1 never reverses accepted quantity (INV-026).';

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
  'Separate from quantity decisions BY DESIGN (INV-032): an evidence return never changes quantity or money; after monetary acceptance it creates a visible compliance exception instead.';

create table public.external_decision_issues (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  decision_batch_id uuid not null,
  severity issue_severity not null,
  code text not null,
  description text,
  quantity_decision_id uuid,
  evidence_decision_id uuid,
  claim_segment_id uuid,
  evidence_object_id uuid,
  primary key (id),
  unique (workspace_id, id),
  foreign key (workspace_id, decision_batch_id) references public.external_decision_batches (workspace_id, id),
  foreign key (workspace_id, quantity_decision_id) references public.external_quantity_decisions (workspace_id, id),
  foreign key (workspace_id, evidence_decision_id) references public.external_evidence_decisions (workspace_id, id),
  foreign key (workspace_id, claim_segment_id) references public.package_line_claim_segments (workspace_id, id),
  foreign key (workspace_id, evidence_object_id) references public.evidence_objects (workspace_id, id)
);

create table public.external_decision_coverage (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  quantity_decision_id uuid not null,
  descendant_segment_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (workspace_id, id),
  unique (workspace_id, quantity_decision_id, descendant_segment_id),
  foreign key (workspace_id, quantity_decision_id)
    references public.external_quantity_decisions (workspace_id, id),
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
  original_quantity_decision_id uuid not null,
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
  foreign key (workspace_id, original_quantity_decision_id)
    references public.external_quantity_decisions (workspace_id, id)
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

create or replace function app_private.freeze_package_version(
  p_workspace uuid, p_package_version uuid, p_expected_draft_version bigint) returns void
language plpgsql as $$
begin
  -- Interface (INV-015/INV-034/INV-027): validates all sources, requires every
  -- claim segment covered by a required quantity approval requirement, records
  -- the immutable snapshot + source manifest hash atomically; the FIRST freeze
  -- locks an empty package_scope_head and installs current_prepared with
  -- activated allocations; later freezes create candidates with no balance or
  -- VaR effect until head advance. Stale sources => freeze fails.
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
create trigger external_quantity_decisions_append_only before update or delete on public.external_quantity_decisions
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
--   package_template_versions, package_versions, package_lines,
--   package_line_claim_segments (content columns; is_partitioned is lifecycle).

-- =============================================================================
-- 12. RLS AND GRANTS (coverage rule; concrete policies ship per migration slice)
-- =============================================================================
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
alter table public.progress_entries enable row level security;
alter table public.progress_allocation_heads enable row level security;
alter table public.valuation_allocations enable row level security;
alter table public.upload_intents enable row level security;
alter table public.capture_events enable row level security;
alter table public.evidence_objects enable row level security;
alter table public.evidence_requirement_links enable row level security;
alter table public.requirement_template_versions enable row level security;
alter table public.requirement_occurrences enable row level security;
alter table public.requirement_exceptions enable row level security;
alter table public.requirement_exception_heads enable row level security;
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
alter table public.external_quantity_decisions enable row level security;
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
alter table public.package_review_status_projection enable row level security;
alter table public.acceptance_projection enable row level security;
alter table public.value_at_risk_projection enable row level security;

-- =============================================================================
-- END OF TARGET DESIGN
-- =============================================================================
