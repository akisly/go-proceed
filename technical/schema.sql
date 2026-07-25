-- AktFlow Pilot v2.9 executable reference schema. Convert to ordered reviewed
-- migrations before runtime use. Canonical enums: technical/state-catalog.csv.
-- PostgreSQL 15+ / Supabase-style auth.uid(). All tenant tables use RLS.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create schema if not exists private;
create schema if not exists api;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  edrpou text,
  base_currency char(3) not null default 'UAH',
  timezone text not null default 'Europe/Kyiv',
  status text not null default 'trial' check (status in ('trial','active','suspended','closing','closed')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legal_name text not null,
  registration_code text,
  vat_number text,
  country_code char(2) not null default 'UA',
  billing_email text,
  status text not null default 'active' check (status in ('draft','active','archived')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legal_entity_id uuid not null,
  name text not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, legal_entity_id) references public.legal_entities(organization_id, id)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','admin','commercial_manager','pto_manager','project_manager','foreman','field_worker','internal_reviewer','estimator','accountant','viewer','integration_admin','security_admin')),
  status text not null default 'invited' check (status in ('invited','active','suspended','revoked')),
  all_projects boolean not null default false,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, user_id, id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  email_normalized text not null,
  role text not null check (role in ('admin','commercial_manager','pto_manager','project_manager','foreman','field_worker','internal_reviewer','estimator','accountant','viewer','integration_admin','security_admin')),
  all_projects boolean not null default false,
  token_hash text not null unique,
  status text not null default 'draft' check (status in ('draft','queued','sent','accepted','expired','revoked','delivery_failed')),
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  accepted_terms_version text,
  accepted_privacy_notice_version text,
  mfa_verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null and accepted_terms_version is not null and accepted_privacy_notice_version is not null and mfa_verified_at is not null)
    or (status <> 'accepted' and accepted_by is null and accepted_at is null and accepted_terms_version is null and accepted_privacy_notice_version is null and mfa_verified_at is null)
  )
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  customer_name text,
  site_address text,
  sensitive_location boolean not null default false,
  timezone text not null default 'Europe/Kyiv',
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  version bigint not null default 1,
  starts_on date,
  ends_on date,
  reactivated_from_project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, id),
  foreign key (organization_id, reactivated_from_project_id) references public.projects(organization_id, id)
);

create table public.counterparties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  kind text not null check (kind in ('customer','general_contractor','designer','technical_supervision','supplier','sub_subcontractor','other')),
  legal_name text not null,
  registration_code text,
  country_code char(2) not null default 'UA',
  status text not null default 'active' check (status in ('active','archived')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.counterparty_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  counterparty_id uuid not null,
  display_name text not null,
  email text,
  phone text,
  role_label text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, counterparty_id) references public.counterparties(organization_id, id)
);

create table public.project_counterparties (
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null,
  counterparty_id uuid not null,
  relationship text not null,
  primary key (project_id, counterparty_id, relationship),
  foreign key (organization_id, project_id) references public.projects(organization_id, id),
  foreign key (organization_id, counterparty_id) references public.counterparties(organization_id, id)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  parent_id uuid references public.locations(id),
  code text not null,
  name text not null,
  path text not null,
  created_at timestamptz not null default now(),
  unique (project_id, code),
  unique (organization_id, id),
  unique (organization_id, project_id, id)
);

create table public.invitation_project_scopes (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  all_locations boolean not null default false,
  primary key (invitation_id, project_id)
);

create table public.invitation_location_scopes (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  location_id uuid not null references public.locations(id),
  primary key (invitation_id, location_id),
  foreign key (invitation_id, project_id) references public.invitation_project_scopes(invitation_id, project_id) on delete cascade
);

create table public.membership_project_scopes (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null,
  all_locations boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (membership_id, project_id),
  foreign key (organization_id, project_id) references public.projects(organization_id, id)
);

create table public.membership_location_scopes (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null,
  location_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, location_id),
  foreign key (membership_id, project_id) references public.membership_project_scopes(membership_id, project_id) on delete cascade,
  foreign key (organization_id, project_id, location_id) references public.locations(organization_id, project_id, id)
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  contract_number text not null,
  customer_name text not null,
  currency char(3) not null default 'UAH',
  vat_mode text not null default 'exclusive' check (vat_mode in ('exclusive','inclusive','none')),
  status text not null default 'draft' check (status in ('draft','active','completed','terminated')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (project_id, contract_number)
);

create table public.numbering_series (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  contract_id uuid not null references public.contracts(id),
  created_under_contract_version bigint not null check (created_under_contract_version > 0),
  series_key text not null,
  prefix text not null,
  padding smallint not null check (padding between 1 and 10),
  next_sequence bigint not null default 1 check (next_sequence > 0),
  state text not null default 'active' check (state in ('active','retired')),
  first_used_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  creation_receipt_hash text not null check (creation_receipt_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, project_id, contract_id, series_key),
  unique (organization_id, project_id, id)
);

create table public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  contract_id uuid not null references public.contracts(id),
  version_no integer not null check (version_no > 0),
  source_hash text,
  status text not null default 'draft' check (status in ('draft','validating','ready_to_publish','published','superseded','rejected')),
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (contract_id, version_no),
  check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$'),
  check ((status in ('published','superseded')) = (published_at is not null)),
  check (status not in ('published','superseded') or source_hash is not null)
);

create table public.contract_term_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  contract_id uuid not null references public.contracts(id),
  numbering_series_id uuid not null references public.numbering_series(id),
  version_no integer not null check (version_no > 0),
  state text not null default 'draft' check (state in ('draft','validating','published','superseded','rejected')),
  reporting_timezone text not null default 'Europe/Kyiv',
  reporting_cycle text not null check (reporting_cycle in ('monthly','custom')),
  currency char(3) not null default 'UAH',
  quantity_scale smallint not null default 3 check (quantity_scale between 0 and 6),
  rounding_mode text not null default 'half_up' check (rounding_mode in ('half_up','half_even','down')),
  valuation_basis text not null default 'contract_rate' check (valuation_basis in ('contract_rate','approved_rate_override')),
  cutoff_rule jsonb not null,
  notice_rule jsonb not null,
  payment_due_rule jsonb not null,
  retention_rule jsonb not null,
  business_calendar_key text not null default 'weekday_mon_fri',
  business_calendar_version integer not null default 1 check (business_calendar_version > 0),
  business_calendar_snapshot jsonb not null default '{"weekendDays":[6,7],"holidays":[]}',
  business_calendar_hash text not null check (business_calendar_hash ~ '^[0-9a-f]{64}$'),
  numbering_rule jsonb not null,
  required_document_rules jsonb not null default '[]',
  adapter_key text,
  adapter_version text,
  config_hash text not null check (config_hash ~ '^[0-9a-f]{64}$'),
  effective_on date not null,
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (contract_id, version_no),
  unique (organization_id, project_id, id),
  check ((adapter_key is null) = (adapter_version is null)),
  check ((state in ('published','superseded')) = (published_at is not null))
);

create table public.reference_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  document_type text not null check (document_type in ('drawing','specification','method_statement','customer_instruction','other')),
  document_number text not null,
  title text not null,
  status text not null default 'active' check (status in ('active','archived')),
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, document_number),
  unique (organization_id, project_id, id)
);

create table public.reference_document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  reference_document_id uuid not null references public.reference_documents(id),
  supersedes_version_id uuid references public.reference_document_versions(id),
  revision_code text not null,
  state text not null default 'draft' check (state in ('draft','validating','published','superseded','rejected')),
  issue_date date not null,
  source_label text,
  upload_purpose text not null default 'reference_document' check (upload_purpose = 'reference_document'),
  upload_intent_id uuid,
  storage_key text,
  retention_class text check (retention_class is null or retention_class = 'contract_baseline'),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint check (byte_size is null or byte_size > 0),
  mime_type text,
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (reference_document_id, revision_code),
  unique (organization_id, project_id, id),
  check (
    (storage_key is null and retention_class is null and sha256 is null and byte_size is null and mime_type is null)
    or (storage_key is not null and retention_class is not null and sha256 is not null and byte_size is not null and mime_type is not null)
  ),
  check ((state in ('published','superseded')) = (published_at is not null)),
  check (state not in ('published','superseded') or storage_key is not null)
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null,
  upload_purpose text not null default 'estimate_import' check (upload_purpose in ('estimate_import','location_import')),
  upload_intent_id uuid not null,
  file_hash text not null,
  mode text not null check (mode in ('dry_run','confirm')),
  state text not null default 'queued' check (state in ('queued','running','retry_wait','succeeded','failed_terminal','cancelled')),
  mapping jsonb not null,
  mapping_hash text not null check (mapping_hash ~ '^[0-9a-f]{64}$'),
  summary jsonb not null default '{}',
  public_error_code text,
  requested_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (organization_id, id),
  unique (organization_id, project_id, file_hash, mapping_hash, mode, requested_by),
  foreign key (organization_id, project_id) references public.projects(organization_id, id)
);

create table public.import_row_results (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  import_job_id uuid not null,
  source_row_no integer not null check (source_row_no > 0),
  state text not null check (state in ('valid','warning','error','ignored','duplicate')),
  error_codes text[] not null default '{}',
  normalized_preview jsonb not null default '{}',
  foreign key (organization_id, import_job_id) references public.import_jobs(organization_id, id),
  unique (import_job_id, source_row_no)
);

create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  contract_version_id uuid not null references public.contract_versions(id),
  supersedes_id uuid references public.work_items(id),
  lineage_root_id uuid not null references public.work_items(id) deferrable initially deferred,
  lineage_version integer not null default 1 check (lineage_version > 0),
  is_current boolean not null default true,
  line_type text not null default 'measured' check (line_type = 'measured'),
  code text not null,
  section_path text,
  description text not null,
  unit_code text not null,
  unit_definition_version integer not null default 1 check (unit_definition_version > 0),
  unit_input_precision smallint not null default 3 check (unit_input_precision between 0 and 6),
  contract_quantity numeric(20,6) not null check (contract_quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  currency char(3) not null,
  tax_mode text not null default 'inherit_contract' check (tax_mode in ('inherit_contract','exclusive','inclusive','none')),
  status text not null default 'planned' check (status in ('planned','assigned','in_progress','performed','completed','cancelled')),
  version bigint not null default 1 check (version > 0),
  projection_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (contract_version_id, code),
  unique (organization_id, id),
  check (
    (lineage_version = 1 and supersedes_id is null and lineage_root_id = id)
    or (lineage_version > 1 and supersedes_id is not null and lineage_root_id <> id)
  )
);

create table public.work_item_locations (
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid not null references public.work_items(id),
  location_id uuid not null references public.locations(id),
  planned_quantity numeric(20,6),
  primary key (work_item_id, location_id)
);

create table public.work_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  client_operation_id uuid not null,
  batch_id uuid not null,
  work_item_id uuid not null references public.work_items(id),
  location_id uuid not null references public.locations(id),
  contract_term_version_id uuid not null references public.contract_term_versions(id),
  reference_document_version_id uuid references public.reference_document_versions(id),
  assigned_user_id uuid not null references auth.users(id),
  planned_quantity numeric(20,6) not null check (planned_quantity > 0),
  starts_at timestamptz,
  due_at timestamptz not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  state text not null default 'planned' check (state in ('planned','assigned','accepted','in_progress','submitted','returned','completed','cancelled')),
  rule_snapshot_hash text not null check (rule_snapshot_hash ~ '^[0-9a-f]{64}$'),
  reference_snapshot_hash text not null check (reference_snapshot_hash ~ '^[0-9a-f]{64}$'),
  reference_status text not null default 'current' check (reference_status in ('current','stale_unacknowledged','stale_acknowledged')),
  source_reason_code text not null,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, project_id, id),
  unique (organization_id, client_operation_id),
  check (starts_at is null or due_at >= starts_at)
);

create table public.evidence_rule_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid references public.projects(id),
  rule_key text not null,
  version_no integer not null,
  name text not null,
  requirement_type text not null check (requirement_type in ('photo','video','audio','document','quantity','location','review','before_concealment')),
  config jsonb not null default '{}',
  config_schema_version integer not null default 1 check (config_schema_version > 0),
  config_hash text not null check (config_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('draft','published','retired')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, rule_key, version_no),
  check (config ? 'occurrenceStrategy')
);

create table public.work_item_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid not null references public.work_items(id),
  location_id uuid references public.locations(id),
  rule_version_id uuid not null references public.evidence_rule_versions(id),
  state text not null default 'missing' check (state in ('not_applicable','missing','pending_scan','pending_review','met','failed','waived','expired')),
  engine_version text not null,
  evaluated_at timestamptz,
  reason_code text,
  unique nulls not distinct (work_item_id, location_id, rule_version_id),
  unique (organization_id, id)
);

create table public.requirement_occurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  assignment_id uuid not null references public.work_assignments(id),
  work_item_id uuid not null references public.work_items(id),
  location_id uuid not null references public.locations(id),
  requirement_id uuid not null,
  rule_version_id uuid not null references public.evidence_rule_versions(id),
  reference_document_version_id uuid references public.reference_document_versions(id),
  reference_snapshot_hash text not null check (reference_snapshot_hash ~ '^[0-9a-f]{64}$'),
  occurrence_key text not null,
  occurrence_type text not null check (occurrence_type in ('once','date','batch','quantity_threshold')),
  timing text not null check (timing in ('before_work','during','before_concealment','after','before_package')),
  trigger_snapshot jsonb not null,
  material_batch text,
  quantity_from numeric(20,6),
  quantity_to numeric(20,6),
  due_at timestamptz not null,
  hold_point_required boolean not null default false,
  state text not null default 'required' check (state in ('required','capture_pending','ready_for_inspection','passed','passed_with_notes','failed','waived','expired','closed')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  unique (assignment_id, rule_version_id, occurrence_key),
  unique (organization_id, project_id, id),
  check (quantity_from is null or quantity_to is null or quantity_to >= quantity_from)
);

create table public.occurrence_trigger_events (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  assignment_id uuid not null references public.work_assignments(id),
  rule_version_id uuid not null references public.evidence_rule_versions(id),
  occurrence_id uuid not null references public.requirement_occurrences(id),
  strategy_type text not null check (strategy_type in ('once','date','batch','quantity_threshold')),
  trigger_key text not null,
  trigger_date date,
  batch_reference text,
  threshold_quantity numeric(20,6),
  authoritative_quantity_entry_id uuid,
  trigger_snapshot jsonb not null,
  trigger_hash text not null check (trigger_hash ~ '^[0-9a-f]{64}$'),
  declared_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (assignment_id, rule_version_id, trigger_key),
  unique (organization_id, project_id, id),
  check (
    (strategy_type = 'once' and trigger_date is null and batch_reference is null and threshold_quantity is null and authoritative_quantity_entry_id is null)
    or (strategy_type = 'date' and trigger_date is not null and batch_reference is null and threshold_quantity is null and authoritative_quantity_entry_id is null)
    or (strategy_type = 'batch' and trigger_date is null and batch_reference is not null and threshold_quantity is null and authoritative_quantity_entry_id is null)
    or (strategy_type = 'quantity_threshold' and trigger_date is null and batch_reference is null and threshold_quantity is not null and authoritative_quantity_entry_id is not null)
  )
);

create table public.requirement_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  requirement_id uuid not null references public.work_item_requirements(id),
  state text not null check (state in ('not_applicable','missing','pending_scan','pending_review','met','failed','waived','expired')),
  engine_version text not null,
  input_snapshot jsonb not null,
  input_hash text not null,
  reason_codes text[] not null default '{}',
  evaluated_at timestamptz not null default now(),
  unique (requirement_id, input_hash)
);

create table public.requirement_waivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid not null,
  location_id uuid not null,
  assignment_id uuid not null,
  requirement_id uuid not null,
  occurrence_id uuid not null,
  reason_code text not null,
  justification text not null,
  affected_quantity numeric(20,6) check (affected_quantity is null or affected_quantity > 0),
  affected_value_minor bigint check (affected_value_minor is null or affected_value_minor >= 0),
  currency char(3),
  expires_at timestamptz not null,
  state text not null default 'active' check (state in ('active','expired','revoked')),
  version bigint not null default 1 check (version > 0),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revocation_reason_code text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, project_id, id),
  check (
    (state = 'active' and revoked_at is null and revoked_by is null and revocation_reason_code is null)
    or (state = 'expired' and revoked_at is null and revoked_by is null and revocation_reason_code is null)
    or (state = 'revoked' and revoked_at is not null and revoked_by is not null and revocation_reason_code is not null)
  )
);

create table public.requirement_waiver_revocations (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  waiver_id uuid not null references public.requirement_waivers(id),
  occurrence_id uuid not null references public.requirement_occurrences(id),
  expected_waiver_version bigint not null check (expected_waiver_version > 0),
  reason_code text not null,
  revoked_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (waiver_id),
  unique (organization_id, project_id, id)
);

create table public.evidence_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid not null,
  location_id uuid not null,
  assignment_id uuid not null references public.work_assignments(id),
  requirement_id uuid,
  occurrence_id uuid references public.requirement_occurrences(id),
  assigned_to_user_id uuid references auth.users(id),
  state text not null default 'open' check (state in ('open','fulfilled','cancelled','expired')),
  reason_code text not null,
  instructions text,
  due_at timestamptz,
  created_by uuid not null references auth.users(id),
  fulfilled_by_capture_session_id uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.offline_authorization_leases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  membership_id uuid not null references public.memberships(id),
  assignment_id uuid not null references public.work_assignments(id),
  authorized_user_id uuid not null references auth.users(id),
  membership_version bigint not null check (membership_version > 0),
  assignment_version bigint not null check (assignment_version > 0),
  organization_version bigint not null check (organization_version > 0),
  project_version bigint not null check (project_version > 0),
  contract_version bigint not null check (contract_version > 0),
  subscription_version bigint not null check (subscription_version > 0),
  policy_version integer not null check (policy_version > 0),
  authorization_context_hash text not null check (authorization_context_hash ~ '^[0-9a-f]{64}$'),
  bundle_hash text not null check (bundle_hash ~ '^[0-9a-f]{64}$'),
  lease_hash text not null check (lease_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null,
  valid_until timestamptz not null,
  invalidated_at timestamptz,
  invalidation_reason text,
  created_at timestamptz not null default now(),
  unique (organization_id, project_id, id),
  unique (organization_id, authorized_user_id, id),
  check (valid_until > issued_at),
  check ((invalidated_at is null) = (invalidation_reason is null))
);

create table public.capture_sessions (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid not null references public.work_items(id),
  assignment_id uuid not null references public.work_assignments(id),
  authorization_lease_id uuid not null references public.offline_authorization_leases(id),
  location_id uuid not null references public.locations(id),
  created_by uuid not null references auth.users(id),
  revision_of_id uuid references public.capture_sessions(id),
  state text not null default 'server_received' check (state in ('server_received','scanning','pending_review','returned','approved','quarantined','terminal_failed')),
  authorization_disposition text not null default 'pending' check (authorization_disposition in ('pending','lease_valid','pre_invalidation_proven','first_seen_after_invalidation','recovery_approved','recovery_rejected')),
  authorization_resolution_id uuid,
  claimed_reporting_date date,
  authoritative_reporting_date date,
  reporting_date_review_state text not null default 'not_required' check (reporting_date_review_state in ('not_required','required','confirmed','rejected')),
  first_server_received_at timestamptz not null default now(),
  note text,
  version bigint not null default 1 check (version > 0),
  client_captured_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, id),
  unique (organization_id, project_id, work_item_id, location_id, assignment_id, client_operation_id, id),
  check (
    (authorization_disposition = 'first_seen_after_invalidation' and state = 'quarantined')
    or authorization_disposition <> 'first_seen_after_invalidation'
  ),
  check (
    (reporting_date_review_state = 'not_required' and claimed_reporting_date is null and authoritative_reporting_date is null)
    or (reporting_date_review_state in ('required','rejected') and claimed_reporting_date is not null and authoritative_reporting_date is null)
    or (reporting_date_review_state = 'confirmed' and claimed_reporting_date is not null and authoritative_reporting_date is not null)
  )
);

create table public.capture_authorization_resolutions (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  capture_session_id uuid not null references public.capture_sessions(id),
  decision text not null check (decision in ('release_to_scan_and_review','reject')),
  reason_code text not null,
  evidence_summary text not null,
  target_capture_version bigint not null check (target_capture_version > 0),
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  unique (organization_id, client_operation_id),
  unique (capture_session_id),
  unique (organization_id, project_id, id),
  check (btrim(reason_code) <> ''),
  check (btrim(evidence_summary) <> '')
);

create table public.capture_reporting_date_confirmations (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  capture_session_id uuid not null references public.capture_sessions(id),
  claimed_reporting_date date not null,
  authoritative_reporting_date date,
  decision text not null check (decision in ('confirm','reject')),
  reason_code text not null,
  target_capture_version bigint not null check (target_capture_version > 0),
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  unique (organization_id, client_operation_id),
  unique (capture_session_id),
  unique (organization_id, project_id, id),
  check (
    (decision = 'confirm' and authoritative_reporting_date is not null)
    or (decision = 'reject' and authoritative_reporting_date is null)
  ),
  check (btrim(reason_code) <> '')
);

create table public.upload_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid,
  assignment_id uuid,
  authorization_lease_id uuid,
  location_id uuid,
  capture_client_operation_id uuid,
  purpose text not null check (purpose in ('evidence','estimate_import','location_import','reference_document')),
  retention_class text not null check (retention_class in ('contract_baseline','evidence_original')),
  state text not null default 'authorized' check (state in ('authorized','sealed','expired','cancelled')),
  object_key text not null,
  file_name text not null,
  declared_mime_type text not null,
  expected_byte_size bigint not null check (expected_byte_size > 0),
  expected_sha256 text not null check (expected_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  sealed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, object_key),
  check (
    (purpose = 'evidence' and retention_class = 'evidence_original' and work_item_id is not null and assignment_id is not null and authorization_lease_id is not null and location_id is not null and capture_client_operation_id is not null)
    or (purpose in ('estimate_import','location_import','reference_document') and retention_class = 'contract_baseline' and work_item_id is null and assignment_id is null and authorization_lease_id is null and location_id is null and capture_client_operation_id is null)
  ),
  check (expires_at > created_at),
  check ((state = 'sealed') = (sealed_at is not null))
);

create table public.evidence_objects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid not null,
  assignment_id uuid not null,
  location_id uuid not null,
  capture_client_operation_id uuid not null,
  capture_session_id uuid not null references public.capture_sessions(id),
  upload_purpose text not null default 'evidence' check (upload_purpose = 'evidence'),
  upload_intent_id uuid,
  parent_id uuid references public.evidence_objects(id),
  kind text not null check (kind in ('photo','video','audio','document','annotation')),
  storage_key text not null,
  retention_class text not null check (retention_class in ('evidence_original','evidence_derivative')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  scan_state text not null default 'pending' check (scan_state in ('pending','clean','quarantined','rejected')),
  lifecycle_state text not null default 'active' check (lifecycle_state in ('active','invalidated','superseded')),
  invalidated_at timestamptz,
  invalidated_by uuid references auth.users(id),
  invalidation_reason_code text,
  version bigint not null default 1 check (version > 0),
  metadata jsonb not null default '{}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sha256, storage_key),
  unique (organization_id, storage_key),
  unique (organization_id, project_id, work_item_id, location_id, assignment_id, capture_client_operation_id, id),
  check (
    (parent_id is null and upload_intent_id is not null and retention_class = 'evidence_original')
    or (parent_id is not null and upload_intent_id is null and retention_class = 'evidence_derivative')
  ),
  check (kind <> 'annotation' or parent_id is not null),
  check ((lifecycle_state = 'active' and invalidated_at is null and invalidated_by is null and invalidation_reason_code is null) or (lifecycle_state <> 'active' and invalidated_at is not null and invalidated_by is not null and invalidation_reason_code is not null)),
  unique (organization_id, id)
);

create table public.typed_evidence_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid not null,
  location_id uuid not null,
  capture_session_id uuid not null references public.capture_sessions(id),
  assignment_id uuid not null,
  occurrence_id uuid not null,
  reference_document_version_id uuid references public.reference_document_versions(id),
  original_evidence_object_id uuid references public.evidence_objects(id),
  schema_key text not null,
  schema_version integer not null check (schema_version > 0),
  form_kind text not null check (form_kind in ('certificate','test','drawing','quantity','checklist','generic_document')),
  response jsonb not null,
  response_hash text not null check (response_hash ~ '^[0-9a-f]{64}$'),
  validation_state text not null check (validation_state in ('received','valid','warning','invalidated')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (capture_session_id, occurrence_id, schema_key, schema_version),
  unique (organization_id, project_id, id)
);

create table public.evidence_requirement_links (
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid not null,
  assignment_id uuid not null,
  location_id uuid not null,
  capture_client_operation_id uuid not null,
  evidence_object_id uuid not null references public.evidence_objects(id),
  requirement_id uuid not null,
  occurrence_id uuid not null,
  link_type text not null default 'supports' check (link_type in ('supports','contradicts','context')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (evidence_object_id, occurrence_id, link_type)
);

create table public.quantity_entries (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid not null references public.work_items(id),
  assignment_id uuid not null references public.work_assignments(id),
  location_id uuid not null references public.locations(id),
  capture_session_id uuid references public.capture_sessions(id),
  corrects_entry_id uuid references public.quantity_entries(id),
  entry_type text not null default 'progress' check (entry_type in ('progress','correction','reversal','transfer_out','transfer_in','accepted_adjustment')),
  reason_code text,
  transfer_group_id uuid,
  quantity numeric(20,6) not null check (quantity <> 0),
  claimed_occurred_on date,
  occurred_on date,
  reporting_date_review_state text not null default 'not_required' check (reporting_date_review_state in ('not_required','required','confirmed','rejected')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  check ((entry_type = 'progress' and reason_code is null) or (entry_type <> 'progress' and reason_code is not null)),
  check ((entry_type in ('transfer_out','transfer_in')) = (transfer_group_id is not null)),
  check ((entry_type = 'progress' and quantity > 0 and corrects_entry_id is null) or (entry_type = 'correction' and corrects_entry_id is not null) or (entry_type = 'reversal' and quantity < 0 and corrects_entry_id is not null) or entry_type in ('transfer_out','transfer_in','accepted_adjustment')),
  check ((entry_type in ('correction','reversal')) = (corrects_entry_id is not null))
  ,check (
    (reporting_date_review_state = 'not_required' and claimed_occurred_on is null and occurred_on is not null)
    or (reporting_date_review_state in ('required','rejected') and claimed_occurred_on is not null and occurred_on is null)
    or (reporting_date_review_state = 'confirmed' and claimed_occurred_on is not null and occurred_on is not null)
  )
);

create table public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  capture_session_id uuid references public.capture_sessions(id),
  package_version_id uuid,
  client_operation_id uuid not null,
  supersedes_decision_id uuid references public.review_decisions(id),
  lineage_root_id uuid not null references public.review_decisions(id) deferrable initially deferred,
  lineage_version integer not null default 1 check (lineage_version > 0),
  is_current boolean not null default true,
  decision text not null check (decision in ('approve','return','waive','acknowledge','reject')),
  target_server_version bigint not null check (target_server_version > 0),
  assurance_level text not null check (assurance_level in ('authenticated_mfa','supervised','recorded_external','system')),
  reason_code text,
  comment text,
  actor_user_id uuid references auth.users(id),
  external_actor_label text,
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, project_id, id),
  check (num_nonnulls(capture_session_id, package_version_id) = 1),
  check (decision <> 'return' or reason_code is not null),
  check (num_nonnulls(actor_user_id, external_actor_label) = 1),
  check (
    (lineage_version = 1 and supersedes_decision_id is null and lineage_root_id = id)
    or (lineage_version > 1 and supersedes_decision_id is not null and lineage_root_id <> id)
  )
);

create table public.review_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  target_type text not null check (target_type in ('capture_session','requirement_occurrence','package_decision')),
  target_version bigint not null check (target_version > 0),
  capture_session_id uuid references public.capture_sessions(id),
  occurrence_id uuid references public.requirement_occurrences(id),
  package_decision_item_id uuid,
  assigned_reviewer_id uuid references auth.users(id),
  sla_policy_version text not null,
  opened_at timestamptz not null,
  due_at timestamptz not null,
  escalation_owner_id uuid references auth.users(id),
  priority text not null default 'normal' check (priority in ('normal','high','critical')),
  state text not null default 'open' check (state in ('open','assigned','in_review','completed','cancelled','expired')),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  unique nulls not distinct (target_type, capture_session_id, occurrence_id, package_decision_item_id, target_version),
  unique (organization_id, project_id, id),
  check (due_at >= opened_at),
  check (
    (target_type = 'capture_session' and capture_session_id is not null and occurrence_id is null and package_decision_item_id is null)
    or (target_type = 'requirement_occurrence' and occurrence_id is not null and package_decision_item_id is null)
    or (target_type = 'package_decision' and capture_session_id is null and occurrence_id is null and package_decision_item_id is not null)
  )
);

create table public.review_decision_corrections (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  capture_session_id uuid not null references public.capture_sessions(id),
  invalidated_decision_id uuid not null references public.review_decisions(id),
  target_decision_version bigint not null check (target_decision_version > 0),
  reopened_capture_version bigint not null check (reopened_capture_version > 0),
  review_task_id uuid not null references public.review_tasks(id),
  reason_code text not null,
  comment text,
  corrected_by uuid not null references auth.users(id),
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (invalidated_decision_id),
  unique (organization_id, project_id, id)
);

create table public.assignment_reassignment_receipts (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  assignment_id uuid not null references public.work_assignments(id),
  from_user_id uuid not null references auth.users(id),
  to_user_id uuid not null references auth.users(id),
  assignment_version_before bigint not null check (assignment_version_before > 0),
  assignment_version_after bigint not null check (assignment_version_after > assignment_version_before),
  reason_code text not null,
  offline_capture_policy text not null check (offline_capture_policy in ('quarantine_first_seen_after_invalidation','reject_first_seen_after_invalidation')),
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, project_id, id)
);

create table public.review_task_reassignment_receipts (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  review_task_id uuid not null references public.review_tasks(id),
  from_user_id uuid references auth.users(id),
  to_user_id uuid not null references auth.users(id),
  task_version_before bigint not null check (task_version_before > 0),
  task_version_after bigint not null check (task_version_after > task_version_before),
  reason_code text not null,
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, project_id, id)
);

create table public.assignment_reference_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  assignment_id uuid not null references public.work_assignments(id),
  assignment_version bigint not null check (assignment_version > 0),
  acknowledged_reference_document_version_id uuid not null references public.reference_document_versions(id),
  stale_snapshot_hash text not null check (stale_snapshot_hash ~ '^[0-9a-f]{64}$'),
  reason_code text not null,
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  acknowledged_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, project_id, id)
);

create table public.hold_point_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  occurrence_id uuid not null references public.requirement_occurrences(id),
  occurrence_version bigint not null check (occurrence_version > 0),
  evidence_snapshot_hash text not null check (evidence_snapshot_hash ~ '^[0-9a-f]{64}$'),
  decision text not null check (decision in ('passed','passed_with_notes','failed')),
  reason_code text not null,
  comment text,
  witness_label text,
  assurance_level text not null default 'internal_workflow',
  decided_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, project_id, id)
);

create table public.concealment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid not null,
  assignment_id uuid not null,
  location_id uuid not null,
  occurrence_id uuid not null references public.requirement_occurrences(id),
  occurrence_version bigint not null check (occurrence_version > 0),
  client_operation_id uuid not null,
  event_type text not null check (event_type = 'concealed_or_closed'),
  source text not null check (source in ('field_online','field_offline','supervised')),
  reason_code text not null,
  occurred_at timestamptz not null,
  recorded_by uuid not null references auth.users(id),
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (occurrence_id),
  unique (organization_id, client_operation_id),
  unique (organization_id, project_id, id),
  unique (organization_id, project_id, work_item_id, location_id, assignment_id, occurrence_id, id)
);

create table public.concealment_event_evidence (
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  work_item_id uuid not null,
  assignment_id uuid not null,
  location_id uuid not null,
  occurrence_id uuid not null,
  concealment_event_id uuid not null references public.concealment_events(id),
  evidence_object_id uuid not null references public.evidence_objects(id),
  primary key (concealment_event_id, evidence_object_id)
);

create table public.variations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  reference text,
  state text not null default 'draft' check (state in ('draft','evidence_ready','internally_approved','issued','acknowledged','approved','rejected','withdrawn','disputed','incorporated')),
  current_version_no integer not null default 1,
  started_before_direction boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, reference)
);

create table public.variation_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  variation_id uuid not null references public.variations(id),
  version_no integer not null check (version_no > 0),
  title text not null,
  narrative text,
  event_date date not null,
  notice_deadline date,
  reason_code text not null,
  recipient_label text,
  cost_breakdown jsonb not null default '[]',
  amount_minor bigint not null default 0 check (amount_minor >= 0),
  currency char(3) not null,
  snapshot jsonb not null,
  snapshot_hash text not null,
  issued_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (variation_id, version_no)
);

create table public.variation_subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  variation_id uuid not null references public.variations(id),
  work_item_id uuid references public.work_items(id),
  assignment_id uuid references public.work_assignments(id),
  evidence_object_id uuid references public.evidence_objects(id),
  created_at timestamptz not null default now(),
  unique (organization_id, project_id, id),
  check (num_nonnulls(work_item_id, assignment_id, evidence_object_id) = 1)
);

create table public.variation_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  variation_version_id uuid not null references public.variation_versions(id),
  decision text not null check (decision in ('comment','return','acknowledge','approve','reject','withdraw')),
  assurance_level text not null default 'workflow' check (assurance_level in ('workflow','authenticated','electronic_signature','qualified_signature')),
  reason_code text,
  comment text,
  actor_user_id uuid references auth.users(id),
  external_actor_label text,
  created_at timestamptz not null default now()
);

create table public.reporting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  starts_on date not null,
  ends_on date not null,
  state text not null default 'open' check (state in ('open','preflight','closing','closed','reopened')),
  version bigint not null default 1 check (version > 0),
  close_cycle_no integer not null default 0 check (close_cycle_no >= 0),
  close_input_hash text check (close_input_hash is null or close_input_hash ~ '^[0-9a-f]{64}$'),
  closed_at timestamptz,
  unique (project_id, starts_on, ends_on),
  exclude using gist (project_id with =, daterange(starts_on, ends_on, '[]') with &&),
  check (ends_on >= starts_on),
  check (
    (state = 'closed' and closed_at is not null and close_cycle_no > 0)
    or (state <> 'closed' and closed_at is null)
  )
);

create table public.period_close_cycles (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  period_id uuid not null references public.reporting_periods(id),
  cycle_no integer not null check (cycle_no > 0),
  state text not null default 'preflight' check (state in ('preflight','committed','reopened','cancelled')),
  preflight_hash text not null check (preflight_hash ~ '^[0-9a-f]{64}$'),
  close_input_hash text check (close_input_hash is null or close_input_hash ~ '^[0-9a-f]{64}$'),
  reopen_reason_code text,
  requested_by uuid not null references auth.users(id),
  committed_at timestamptz,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (period_id, cycle_no),
  unique (organization_id, project_id, id),
  check (
    (state = 'preflight' and committed_at is null and reopened_at is null)
    or (state = 'committed' and committed_at is not null and reopened_at is null)
    or (state = 'reopened' and committed_at is not null and reopened_at is not null and reopen_reason_code is not null)
    or (state = 'cancelled' and committed_at is null)
  )
);

create table public.package_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  period_id uuid not null references public.reporting_periods(id),
  contract_id uuid not null references public.contracts(id),
  contract_version_id uuid not null references public.contract_versions(id),
  contract_term_version_id uuid not null references public.contract_term_versions(id),
  numbering_series_id uuid not null references public.numbering_series(id),
  version_no integer not null,
  document_number text not null,
  numbering_sequence bigint not null check (numbering_sequence > 0),
  version bigint not null default 1 check (version > 0),
  state text not null default 'draft_snapshot' check (state in ('draft_snapshot','generating','generation_failed','generated','ready_to_submit','submitted','pending_reconciliation','returned','accepted','superseded','withdrawn')),
  amount_minor bigint not null default 0 check (amount_minor >= 0),
  currency char(3) not null,
  template_version text not null,
  adapter_key text not null,
  adapter_version text not null,
  rule_snapshot_hash text not null check (rule_snapshot_hash ~ '^[0-9a-f]{64}$'),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  manifest_storage_key text,
  manifest_sha256 text check (manifest_sha256 is null or manifest_sha256 ~ '^[0-9a-f]{64}$'),
  manifest_byte_size bigint check (manifest_byte_size is null or manifest_byte_size > 0),
  manifest_mime_type text check (manifest_mime_type is null or manifest_mime_type = 'application/json'),
  manifest_retention_class text check (manifest_retention_class is null or manifest_retention_class = 'package_artifact'),
  generated_at timestamptz,
  submitted_at timestamptz,
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (period_id, version_no),
  unique (numbering_series_id, document_number),
  unique (organization_id, document_number),
  unique (numbering_series_id, numbering_sequence),
  check (
    (manifest_storage_key is null and manifest_sha256 is null and manifest_byte_size is null and manifest_mime_type is null and manifest_retention_class is null)
    or (manifest_storage_key is not null and manifest_sha256 is not null and manifest_byte_size is not null and manifest_mime_type is not null and manifest_retention_class is not null)
  ),
  check (state not in ('generated','ready_to_submit','submitted','pending_reconciliation','returned','accepted','superseded','withdrawn') or manifest_storage_key is not null)
);

create table public.package_number_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  contract_term_version_id uuid not null references public.contract_term_versions(id),
  numbering_series_id uuid not null references public.numbering_series(id),
  period_id uuid not null references public.reporting_periods(id),
  package_version_id uuid not null unique references public.package_versions(id),
  sequence_no bigint not null check (sequence_no > 0),
  document_number text not null,
  state text not null default 'consumed' check (state in ('reserved','consumed','voided')),
  reserved_by uuid not null references auth.users(id),
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz,
  voided_at timestamptz,
  unique (numbering_series_id, document_number),
  unique (numbering_series_id, sequence_no),
  check (
    (state = 'reserved' and consumed_at is null and voided_at is null)
    or (state = 'consumed' and consumed_at is not null and voided_at is null)
    or (state = 'voided' and consumed_at is null and voided_at is not null)
  )
);

alter table public.review_decisions
  add constraint review_package_fk foreign key (package_version_id) references public.package_versions(id);

create table public.package_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  package_version_id uuid not null references public.package_versions(id),
  work_item_id uuid not null references public.work_items(id),
  quantity numeric(20,6) not null check (quantity >= 0),
  amount_minor bigint not null check (amount_minor >= 0),
  readiness_snapshot jsonb not null,
  unique (package_version_id, work_item_id),
  unique (organization_id, project_id, id)
);

create table public.package_line_quantity_sources (
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  package_line_id uuid not null references public.package_lines(id),
  quantity_entry_id uuid not null references public.quantity_entries(id),
  included_quantity numeric(20,6) not null check (included_quantity <> 0),
  source_snapshot_hash text not null,
  claim_state text not null default 'current' check (claim_state in ('current','superseded')),
  primary key (package_line_id, quantity_entry_id)
);

create table public.package_line_evidence_sources (
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  package_line_id uuid not null references public.package_lines(id),
  evidence_object_id uuid not null references public.evidence_objects(id),
  evidence_sha256 text not null,
  primary key (package_line_id, evidence_object_id)
);

create table public.package_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  package_version_id uuid not null references public.package_versions(id),
  kind text not null,
  storage_key text not null,
  retention_class text not null check (retention_class = 'package_artifact'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  mime_type text not null,
  renderer_version text not null,
  created_at timestamptz not null default now(),
  unique (package_version_id, kind, sha256)
);

create table public.package_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  package_version_id uuid not null references public.package_versions(id),
  channel text not null check (channel in ('manual_email','customer_portal','paper','secure_link','other')),
  recipient_label text,
  reference text,
  assurance_level text not null default 'recorded_by_user',
  submitted_at timestamptz not null,
  recorded_by uuid not null references auth.users(id),
  supersedes_submission_id uuid references public.package_submissions(id),
  attachment_evidence_object_id uuid references public.evidence_objects(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, supersedes_submission_id) references public.package_submissions(organization_id, id),
  foreign key (organization_id, attachment_evidence_object_id) references public.evidence_objects(organization_id, id)
);

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  package_version_id uuid not null references public.package_versions(id),
  acceptance_record_id uuid not null,
  reference text,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null,
  due_on date,
  retention_minor bigint not null default 0 check (retention_minor >= 0),
  state text not null default 'draft' check (state in ('draft','issued','due','part_paid','paid','overdue','disputed','written_off','cancelled')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now()
);

create table public.acceptance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  package_version_id uuid not null references public.package_versions(id),
  supersedes_acceptance_record_id uuid references public.acceptance_records(id),
  lineage_root_id uuid not null references public.acceptance_records(id) deferrable initially deferred,
  package_version bigint not null check (package_version > 0),
  version bigint not null default 1 check (version > 0),
  is_current boolean not null default true,
  state text not null check (state in ('pending','partially_accepted','accepted','returned','disputed')),
  accepted_minor bigint not null default 0 check (accepted_minor >= 0),
  currency char(3) not null,
  assurance_level text not null,
  source_reference text,
  decided_at timestamptz,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (
    (version = 1 and supersedes_acceptance_record_id is null and lineage_root_id = id)
    or (version > 1 and supersedes_acceptance_record_id is not null and lineage_root_id <> id)
  ),
  check (
    (state in ('pending','returned','disputed') and accepted_minor = 0)
    or (state in ('partially_accepted','accepted') and accepted_minor > 0)
  )
);

create table public.receivable_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  receivable_id uuid not null references public.receivables(id),
  kind text not null check (kind in ('retention','deduction','credit','debit','writeoff','reversal')),
  amount_minor bigint not null check (amount_minor <> 0),
  reason_code text not null,
  due_on date,
  corrects_adjustment_id uuid references public.receivable_adjustments(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.retention_releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  adjustment_id uuid not null references public.receivable_adjustments(id),
  amount_minor bigint not null check (amount_minor > 0),
  release_due_on date,
  released_at timestamptz,
  reference text,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  reference text,
  source_fingerprint text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  paid_on date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, source_fingerprint),
  unique (organization_id, id)
);

create table public.payment_allocations (
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  payment_id uuid not null references public.payments(id),
  receivable_id uuid not null references public.receivables(id),
  amount_minor bigint not null check (amount_minor > 0),
  primary key (payment_id, receivable_id)
);

create table public.payment_reversals (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  payment_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  reason_code text not null,
  reference text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, id)
);

create table public.reconciliation_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  job_id uuid not null,
  source_fingerprint text not null,
  file_hash text not null,
  source_label text,
  preview jsonb not null default '{}',
  public_error_code text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, id),
  unique (organization_id, source_fingerprint)
);

create table public.external_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  resource_type text not null check (resource_type in ('package','variation')),
  package_version_id uuid references public.package_versions(id),
  variation_version_id uuid references public.variation_versions(id),
  target_snapshot_hash text not null check (target_snapshot_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'created' check (state in ('created','active','otp_challenged','opened','decided','expired','revoked','locked')),
  token_hash text not null unique,
  permissions text[] not null default '{read,decide}',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  otp_required boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (
    (resource_type = 'package' and package_version_id is not null and variation_version_id is null)
    or (resource_type = 'variation' and variation_version_id is not null and package_version_id is null)
  )
);

create table public.external_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  external_share_id uuid not null references public.external_shares(id),
  session_token_hash text not null unique,
  actor_name text,
  actor_company text,
  otp_verified_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, project_id, id)
);

create table public.external_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  external_share_id uuid not null references public.external_shares(id),
  external_session_id uuid not null references public.external_sessions(id),
  package_version_id uuid references public.package_versions(id),
  decision text not null check (decision in ('comment','return','operational_accept')),
  reason_code text,
  comment text,
  target_snapshot_hash text not null,
  created_at timestamptz not null default now()
);

create table public.package_decision_sets (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  package_version_id uuid not null references public.package_versions(id),
  source_type text not null check (source_type in ('internal_review','external_portal','manual_record')),
  review_decision_id uuid references public.review_decisions(id),
  external_decision_id uuid references public.external_decisions(id),
  manual_decision text check (manual_decision is null or manual_decision in ('operational_acknowledgement','return')),
  source_reference text,
  source_actor_label text,
  source_decided_at timestamptz,
  source_reason_code text,
  source_comment text,
  package_snapshot_hash text not null check (package_snapshot_hash ~ '^[0-9a-f]{64}$'),
  submitted_total_minor bigint not null check (submitted_total_minor >= 0),
  decided_total_minor bigint not null check (decided_total_minor >= 0),
  returned_total_minor bigint not null check (returned_total_minor >= 0),
  state text not null default 'pending_reconciliation' check (state in ('pending_reconciliation','reconciled','superseded')),
  source_receipt_hash text not null check (source_receipt_hash ~ '^[0-9a-f]{64}$'),
  reconciliation_receipt_hash text check (reconciliation_receipt_hash is null or reconciliation_receipt_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reconciled_at timestamptz,
  unique (organization_id, client_operation_id),
  unique (organization_id, project_id, id),
  check (
    (source_type = 'internal_review' and review_decision_id is not null and external_decision_id is null and created_by is not null
      and manual_decision is null and source_reference is null and source_actor_label is null and source_decided_at is null)
    or (source_type = 'external_portal' and review_decision_id is null and external_decision_id is not null
      and manual_decision is null and source_reference is null and source_actor_label is null and source_decided_at is null)
    or (source_type = 'manual_record' and review_decision_id is null and external_decision_id is null and created_by is not null
      and manual_decision is not null and source_reference is not null and source_actor_label is not null and source_decided_at is not null)
  ),
  check ((reconciliation_receipt_hash is null) = (reconciled_at is null)),
  check (state <> 'pending_reconciliation' or reconciliation_receipt_hash is null),
  check (state <> 'reconciled' or reconciliation_receipt_hash is not null),
  check (manual_decision <> 'return' or source_reason_code is not null),
  check (reconciliation_receipt_hash is null or submitted_total_minor = decided_total_minor + returned_total_minor)
);

create table public.package_decision_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  decision_set_id uuid not null references public.package_decision_sets(id),
  package_version_id uuid not null references public.package_versions(id),
  package_line_id uuid not null references public.package_lines(id),
  decision text not null check (decision in ('returned','accepted','modified')),
  submitted_amount_minor bigint not null check (submitted_amount_minor >= 0),
  modified_amount_minor bigint not null check (modified_amount_minor >= 0),
  reason_code text,
  correction_owner_id uuid references auth.users(id),
  correction_due_at timestamptz,
  resolved_by_package_version_id uuid,
  state text not null default 'pending' check (state in ('pending','returned','accepted','modified','correction_open','resolved')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, project_id, id),
  unique (decision_set_id, package_line_id),
  check (decision = 'accepted' or reason_code is not null),
  check (
    (decision = 'accepted' and modified_amount_minor = submitted_amount_minor)
    or (decision = 'returned' and modified_amount_minor = 0)
    or (decision = 'modified' and modified_amount_minor < submitted_amount_minor)
  ),
  check (state = 'pending' or ((state = 'accepted') = (decision = 'accepted'))),
  check (state <> 'returned' or decision = 'returned'),
  check (state <> 'modified' or decision = 'modified'),
  check (state not in ('correction_open','resolved') or decision in ('returned','modified')),
  check ((correction_owner_id is null) = (correction_due_at is null)),
  check (state not in ('correction_open','resolved') or correction_owner_id is not null),
  check (decision <> 'accepted' or correction_owner_id is null),
  check ((state = 'resolved') = (resolved_by_package_version_id is not null))
);

create table public.package_decision_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  package_version_id uuid not null references public.package_versions(id),
  decision_set_id uuid not null references public.package_decision_sets(id),
  decision_item_id uuid references public.package_decision_items(id),
  target_type text not null check (target_type in ('package','package_line','requirement_occurrence','evidence_object')),
  occurrence_id uuid references public.requirement_occurrences(id),
  evidence_object_id uuid references public.evidence_objects(id),
  issue_type text not null check (issue_type in ('missing_line','duplicate_line','invalid_amount','unmatched_reference','unsupported_decision','total_mismatch','correction_required')),
  severity text not null check (severity in ('warning','blocking')),
  reason_code text not null,
  state text not null default 'open' check (state in ('open','resolved','cancelled')),
  version bigint not null default 1 check (version > 0),
  code text not null,
  comment text,
  details jsonb not null default '{}',
  correction_owner_id uuid not null references auth.users(id),
  correction_due_at timestamptz not null,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_note text,
  cancelled_at timestamptz,
  cancellation_reason_code text,
  created_at timestamptz not null default now(),
  unique (organization_id, project_id, id),
  check (
    (target_type = 'package' and decision_item_id is null and occurrence_id is null and evidence_object_id is null)
    or (target_type = 'package_line' and decision_item_id is not null and occurrence_id is null and evidence_object_id is null)
    or (target_type = 'requirement_occurrence' and occurrence_id is not null and evidence_object_id is null)
    or (target_type = 'evidence_object' and occurrence_id is null and evidence_object_id is not null)
  ),
  check (
    (state = 'resolved' and resolved_by is not null and resolved_at is not null and resolution_note is not null)
    or (state <> 'resolved' and resolved_by is null and resolved_at is null and resolution_note is null)
  ),
  check (
    (state = 'cancelled' and cancelled_at is not null and cancellation_reason_code is not null)
    or (state <> 'cancelled' and cancelled_at is null and cancellation_reason_code is null)
  )
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  project_id uuid references public.projects(id),
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

create table public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  user_id uuid not null references auth.users(id),
  client_operation_id uuid not null,
  operation_type text not null,
  result text not null check (result in ('accepted','duplicate','conflict','rejected')),
  server_object_id uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id)
);

create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null,
  version_no integer not null check (version_no > 0),
  display_name text not null,
  currency char(3) not null,
  monthly_price_minor bigint,
  annual_price_minor bigint,
  status text not null check (status in ('draft','active','retired')),
  effective_from timestamptz not null,
  effective_to timestamptz,
  entitlements jsonb not null,
  created_at timestamptz not null default now(),
  unique (plan_key, version_no)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id),
  plan_version_id uuid not null references public.plan_versions(id),
  state text not null check (state in ('pilot','trialing','active','grace','suspended','cancelled','export_only','closed')),
  billing_timezone text not null default 'Europe/Kyiv',
  period_starts_at timestamptz not null,
  period_ends_at timestamptz not null,
  cancel_at_period_end boolean not null default false,
  grace_ends_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_ends_at > period_starts_at)
);

create table public.subscription_state_previews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  subscription_id uuid not null references public.subscriptions(id),
  expected_subscription_version bigint not null check (expected_subscription_version > 0),
  action text not null check (action in ('cancel','reactivate')),
  consequence_snapshot jsonb not null,
  consequence_hash text not null check (consequence_hash ~ '^[0-9a-f]{64}$'),
  requested_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check (expires_at > created_at)
);

create table public.entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  feature_key text not null,
  value jsonb not null,
  reason_code text not null,
  reference text,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table public.usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  subscription_id uuid not null references public.subscriptions(id),
  period_starts_at timestamptz not null,
  period_ends_at timestamptz not null,
  meter_values jsonb not null,
  source_hash text not null,
  created_at timestamptz not null default now(),
  unique (subscription_id, period_starts_at, period_ends_at)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  project_id uuid references public.projects(id),
  type text not null check (length(type) between 1 and 100),
  resource_type text not null check (length(resource_type) between 1 and 100),
  resource_id text not null check (length(resource_id) between 1 and 200),
  state text not null default 'queued' check (state in ('queued','running','retry_wait','succeeded','failed_terminal','cancelled')),
  idempotency_key text,
  payload_version integer not null default 1,
  progress smallint not null default 0 check (progress between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  public_error_code text,
  request_id text,
  lease_owner text,
  lease_expires_at timestamptz,
  fencing_token bigint not null default 0 check (fencing_token >= 0),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (organization_id, type, idempotency_key),
  unique (organization_id, id),
  check (
    (state = 'running' and lease_owner is not null and lease_expires_at is not null)
    or (state <> 'running' and lease_owner is null and lease_expires_at is null)
  )
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

create table public.notification_preferences (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  events jsonb not null default '{}',
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  check (jsonb_typeof(events) = 'object')
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  notification_id uuid not null,
  user_id uuid not null references auth.users(id),
  event_key text not null,
  channel text not null check (channel in ('in_app','email','push','sms')),
  state text not null check (state in ('queued','sent','delivered','bounced','failed','cancelled')),
  provider_message_id text,
  public_error_code text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (organization_id, notification_id, channel)
);

create table public.support_access_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  case_id text not null,
  platform_actor_id text not null,
  scopes text[] not null,
  status text not null default 'requested' check (status in ('requested','active','revoked','expired')),
  approved_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.support_access_grant_projects (
  organization_id uuid not null references public.organizations(id),
  support_access_grant_id uuid not null references public.support_access_grants(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  primary key (support_access_grant_id, project_id)
);

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid references public.projects(id),
  requested_by uuid not null references auth.users(id),
  scope text not null check (scope in ('current_view','project','organization')),
  format text not null check (format in ('xlsx','csv','zip_json','pdf')),
  state text not null default 'requested' check (state in ('requested','authorized','collecting','packaging','cancel_requested','ready','expired','failed','cancelled')),
  version bigint not null default 1 check (version > 0),
  storage_key text,
  storage_sha256 text check (storage_sha256 is null or storage_sha256 ~ '^[0-9a-f]{64}$'),
  storage_byte_size bigint check (storage_byte_size is null or storage_byte_size > 0),
  storage_mime_type text,
  retention_class text not null default 'temporary_export' check (retention_class = 'temporary_export'),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check (
    (storage_key is null and storage_sha256 is null and storage_byte_size is null and storage_mime_type is null)
    or (storage_key is not null and storage_sha256 is not null and storage_byte_size is not null and storage_mime_type is not null)
  ),
  check (state <> 'ready' or (storage_key is not null and expires_at is not null))
);

create table public.export_cancellation_receipts (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  export_job_id uuid not null references public.export_jobs(id),
  expected_export_version bigint not null check (expected_export_version > 0),
  reason_code text not null,
  cancellation_status text not null check (cancellation_status in ('cancel_requested','cancelled')),
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, client_operation_id),
  unique (export_job_id),
  unique (organization_id, id),
  check ((cancellation_status = 'cancelled') = (completed_at is not null))
);

create table public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  scope_type text not null,
  scope_id text not null,
  retention_classes text[] not null,
  reason_reference text not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  released_at timestamptz,
  check (cardinality(retention_classes) > 0),
  check (retention_classes <@ array[
    'identity_access','security_audit','contract_baseline','evidence_original','evidence_derivative',
    'package_artifact','project_commercial','saas_billing','support_incident','analytics_minimized','temporary_export'
  ]::text[])
);

-- Pilot support tables that make the normative domain model executable rather
-- than hiding required state in JSON or operational runbooks.
create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id),
  locale text not null default 'uk-UA',
  capture_policy_version text not null default 'pilot-safe-v1',
  retention_policy_version text not null default 'unvalidated-safe-v1',
  external_review_enabled boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  view_key text not null,
  name text not null,
  filter_schema_version integer not null check (filter_schema_version > 0),
  filters jsonb not null,
  sort jsonb not null default '[]',
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, view_key, name),
  unique (organization_id, id)
);

create table public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  current_owner_user_id uuid not null references auth.users(id),
  successor_user_id uuid not null references auth.users(id),
  state text not null default 'requested' check (state in ('requested','successor_confirmed','completed','cancelled','expired')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  unique (organization_id, id),
  check (current_owner_user_id <> successor_user_id)
);

create table public.access_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  scope text not null check (scope in ('organization','project')),
  project_id uuid references public.projects(id),
  snapshot jsonb not null,
  snapshot_hash text not null,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.membership_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  resource text not null,
  action text not null,
  effect text not null default 'deny' check (effect = 'deny'),
  reason_code text not null,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (membership_id, resource, action)
);

create table public.unit_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  display_name text not null,
  input_precision smallint not null check (input_precision between 0 and 6),
  display_precision smallint not null check (display_precision between 0 and 6),
  base_unit_code text,
  conversion_factor numeric(20,10),
  version integer not null default 1,
  status text not null default 'active' check (status in ('active','retired')),
  unique (organization_id, code, version),
  unique (organization_id, id)
);

create table public.import_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  upload_purpose text not null default 'estimate_import' check (upload_purpose in ('estimate_import','location_import')),
  upload_intent_id uuid not null,
  storage_key text not null,
  retention_class text not null check (retention_class = 'contract_baseline'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  detected_mime_type text not null,
  scan_state text not null default 'pending' check (scan_state in ('pending','clean','quarantined','rejected')),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, upload_intent_id),
  unique (organization_id, sha256, storage_key)
);

create table public.import_mapping_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  source_fingerprint text,
  mapping jsonb not null,
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, name, version),
  unique (organization_id, id)
);

create table public.import_diffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  import_job_id uuid not null references public.import_jobs(id),
  prior_contract_version_id uuid references public.contract_versions(id),
  summary jsonb not null,
  summary_hash text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (import_job_id)
);

create table public.impact_previews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  preview_type text not null check (preview_type in ('rule_publish','contract_terms_publish','reference_publish','assignment_batch','location_import')),
  base_version bigint not null check (base_version >= 0),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  canonical_input_snapshot jsonb not null,
  dependency_hash text not null check (dependency_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  requested_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, project_id, id),
  check (expires_at > created_at)
);

create table public.member_offboarding_previews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  membership_id uuid not null references public.memberships(id),
  plan_id uuid not null,
  plan_version bigint not null check (plan_version > 0),
  membership_version bigint not null check (membership_version > 0),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  dependency_hash text not null check (dependency_hash ~ '^[0-9a-f]{64}$'),
  project_ids uuid[] not null,
  blocking_count integer not null default 0 check (blocking_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  requested_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check (expires_at > created_at)
);

create table public.member_offboarding_preview_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  preview_id uuid not null references public.member_offboarding_previews(id) on delete cascade,
  project_id uuid references public.projects(id),
  resource_type text not null check (resource_type in ('work_assignment','review_task_assignee','review_task_escalation','evidence_request','package_decision_issue','approval_responsibility','integration_connection','offline_authorization_lease','project_scope')),
  resource_id uuid not null,
  expected_version bigint not null check (expected_version > 0),
  replacement_user_id uuid references auth.users(id),
  offline_capture_policy text check (offline_capture_policy in ('quarantine_first_seen_after_invalidation','reject_first_seen_after_invalidation')),
  resolution text not null check (resolution in ('reassign','transfer_admin','invalidate_lease','remove_scope','block_revoke')),
  state text not null check (state in ('valid','warning','blocked')),
  codes text[] not null default '{}',
  unique (preview_id, resource_type, resource_id),
  unique (organization_id, project_id, id),
  check (
    (resource_type = 'work_assignment' and project_id is not null and resolution = 'reassign' and replacement_user_id is not null and offline_capture_policy is not null)
    or (resource_type in ('review_task_assignee','review_task_escalation','evidence_request','package_decision_issue','approval_responsibility')
      and project_id is not null and resolution = 'reassign' and replacement_user_id is not null and offline_capture_policy is null)
    or (resource_type = 'integration_connection' and project_id is null and resolution = 'transfer_admin' and replacement_user_id is not null and offline_capture_policy is null)
    or (resource_type = 'offline_authorization_lease' and project_id is not null and resolution = 'invalidate_lease' and replacement_user_id is null and offline_capture_policy is null)
    or (resource_type = 'project_scope' and project_id is not null and resolution = 'remove_scope' and replacement_user_id is null and offline_capture_policy is null)
    or (resolution = 'block_revoke' and replacement_user_id is null and offline_capture_policy is null)
  )
);

create table public.member_offboarding_plans (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  membership_id uuid not null references public.memberships(id),
  membership_version bigint not null check (membership_version > 0),
  project_ids uuid[] not null default '{}',
  state text not null default 'draft' check (state in ('draft','ready_for_preview','previewed','consumed','expired')),
  scan_cursor text,
  scan_complete boolean not null default false,
  dependency_count integer not null default 0 check (dependency_count >= 0),
  resolution_count integer not null default 0 check (resolution_count >= 0),
  dependency_hash text,
  version bigint not null default 1 check (version > 0),
  requested_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, id),
  check (expires_at > created_at),
  check (state <> 'ready_for_preview' or scan_complete),
  check ((state = 'consumed') = (consumed_at is not null))
);

create table public.member_offboarding_plan_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  plan_id uuid not null references public.member_offboarding_plans(id) on delete cascade,
  project_id uuid,
  resource_type text not null check (resource_type in ('work_assignment','review_task_assignee','review_task_escalation','evidence_request','package_decision_issue','approval_responsibility','integration_connection','offline_authorization_lease','project_scope')),
  resource_id uuid not null,
  expected_version bigint not null check (expected_version > 0),
  replacement_user_id uuid references auth.users(id),
  offline_capture_policy text check (offline_capture_policy in ('quarantine_first_seen_after_invalidation','reject_first_seen_after_invalidation')),
  resolution text check (resolution is null or resolution in ('reassign','transfer_admin','invalidate_lease','remove_scope','block_revoke')),
  state text not null default 'unresolved' check (state in ('unresolved','resolved','blocked','stale')),
  codes text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (plan_id, resource_type, resource_id),
  unique (organization_id, id),
  check (
    (resolution is null and replacement_user_id is null and offline_capture_policy is null and state in ('unresolved','stale'))
    or (resource_type = 'work_assignment' and project_id is not null and resolution = 'reassign' and replacement_user_id is not null and offline_capture_policy is not null and state = 'resolved')
    or (resource_type in ('review_task_assignee','review_task_escalation','evidence_request','package_decision_issue','approval_responsibility')
      and project_id is not null and resolution = 'reassign' and replacement_user_id is not null and offline_capture_policy is null and state = 'resolved')
    or (resource_type = 'integration_connection' and project_id is null and resolution = 'transfer_admin' and replacement_user_id is not null and offline_capture_policy is null and state = 'resolved')
    or (resource_type = 'offline_authorization_lease' and project_id is not null and resolution = 'invalidate_lease' and replacement_user_id is null and offline_capture_policy is null and state = 'resolved')
    or (resource_type = 'project_scope' and project_id is not null and resolution = 'remove_scope' and replacement_user_id is null and offline_capture_policy is null and state = 'resolved')
    or (resolution = 'block_revoke' and replacement_user_id is null and offline_capture_policy is null and state = 'blocked')
  )
);

create table public.membership_project_scope_removal_receipts (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  membership_id uuid not null references public.memberships(id),
  project_id uuid not null references public.projects(id),
  expected_membership_version bigint not null check (expected_membership_version > 0),
  offboarding_plan_id uuid references public.member_offboarding_plans(id),
  reason_code text not null,
  removed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, membership_id, project_id),
  unique (organization_id, id)
);

create table public.rule_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  pack_key text not null,
  name text not null,
  specialization text not null,
  status text not null default 'active' check (status in ('active','retired')),
  unique (organization_id, pack_key),
  unique (organization_id, id)
);

create table public.rule_pack_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  rule_pack_id uuid not null references public.rule_packs(id),
  version_no integer not null check (version_no > 0),
  state text not null default 'draft' check (state in ('draft','published','retired')),
  config_snapshot jsonb not null,
  config_hash text not null,
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (rule_pack_id, version_no),
  unique (organization_id, id)
);

create table public.rule_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  rule_version_id uuid not null references public.evidence_rule_versions(id),
  subject_type text not null check (subject_type in ('project','location','work_item','work_item_location')),
  location_id uuid references public.locations(id),
  work_item_id uuid references public.work_items(id),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique nulls not distinct (organization_id, project_id, rule_version_id, subject_type, location_id, work_item_id, effective_from),
  check (
    (subject_type = 'project' and location_id is null and work_item_id is null)
    or (subject_type = 'location' and location_id is not null and work_item_id is null)
    or (subject_type = 'work_item' and location_id is null and work_item_id is not null)
    or (subject_type = 'work_item_location' and location_id is not null and work_item_id is not null)
  ),
  check (effective_to is null or effective_to > effective_from)
);

create table public.readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  subject_type text not null check (subject_type in ('work_item','project','period')),
  work_item_id uuid references public.work_items(id),
  period_id uuid references public.reporting_periods(id),
  state text not null check (state in ('not_started','evidence_missing','review_pending','ready_internal','overridden_ready','packaged','submitted','accepted_external','returned_external')),
  performed_minor bigint not null default 0,
  ready_minor bigint not null default 0,
  risk_minor bigint not null default 0,
  currency char(3) not null,
  input_snapshot jsonb not null,
  input_hash text not null,
  engine_version text not null,
  evaluated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique nulls not distinct (organization_id, project_id, subject_type, work_item_id, period_id, input_hash),
  check (
    (subject_type = 'project' and work_item_id is null and period_id is null)
    or (subject_type = 'work_item' and work_item_id is not null and period_id is null)
    or (subject_type = 'period' and work_item_id is null and period_id is not null)
  ),
  check (performed_minor >= 0 and ready_minor >= 0 and risk_minor >= 0),
  check (performed_minor = ready_minor + risk_minor)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  event_key text not null,
  resource_type text,
  resource_id text,
  safe_payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, user_id, id)
);

create table public.job_attempts (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id),
  job_id uuid not null references public.jobs(id),
  attempt_no integer not null check (attempt_no > 0),
  started_at timestamptz not null,
  finished_at timestamptz,
  result text check (result in ('succeeded','retryable_failed','terminal_failed','cancelled')),
  public_error_code text,
  internal_correlation_id text,
  unique (job_id, attempt_no)
);

create table public.dead_letters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  source_type text not null,
  source_id text not null,
  payload_version integer not null,
  redacted_payload jsonb not null,
  error_code text not null,
  state text not null default 'open' check (state in ('open','replayed','discarded')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (source_type, source_id)
);

create table public.deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  requested_by uuid not null references auth.users(id),
  state text not null default 'requested' check (state in ('requested','cooling_off','blocked_by_hold','scheduled','executing','verified','complete','cancelled')),
  requested_at timestamptz not null default now(),
  execute_after timestamptz,
  report jsonb,
  report_hash text,
  completed_at timestamptz,
  unique (organization_id, id)
);

create table public.security_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id),
  actor_user_id uuid references auth.users(id),
  event_key text not null,
  severity text not null check (severity in ('info','low','medium','high','critical')),
  request_id text,
  safe_metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create table public.saas_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  subscription_id uuid not null references public.subscriptions(id),
  plan_version_id uuid not null references public.plan_versions(id),
  reference text not null,
  order_reference text,
  issue_reason_code text not null,
  state text not null default 'draft' check (state in ('draft','issued','due','paid','overdue','cancelled','credited')),
  version bigint not null default 1 check (version > 0),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  tax_treatment text not null default 'unvalidated',
  document_mode text not null default 'payment_request' check (document_mode in ('payment_request','validated_invoice')),
  period_starts_at timestamptz not null,
  period_ends_at timestamptz not null,
  basis_snapshot jsonb not null,
  basis_hash text not null,
  issued_at timestamptz,
  due_on date,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, reference),
  unique (organization_id, id),
  check (length(reference) between 1 and 120),
  check (order_reference is null or length(order_reference) between 1 and 200),
  check (length(issue_reason_code) between 1 and 80),
  check (jsonb_typeof(basis_snapshot) = 'object'),
  check (basis_hash ~ '^[0-9a-f]{64}$'),
  check (period_ends_at > period_starts_at)
);

create table public.saas_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  saas_invoice_id uuid not null references public.saas_invoices(id),
  source_fingerprint text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  paid_on date not null,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, source_fingerprint),
  unique (organization_id, id)
);

create table public.saas_invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  saas_invoice_id uuid not null,
  kind text not null check (kind in ('cancel','credit')),
  amount_minor bigint not null check (amount_minor > 0),
  reason_code text not null,
  document_reference text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, saas_invoice_id) references public.saas_invoices(organization_id, id)
);

create table public.saas_payment_reversals (
  id uuid primary key default gen_random_uuid(),
  client_operation_id uuid not null,
  organization_id uuid not null references public.organizations(id),
  saas_payment_id uuid not null references public.saas_payments(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  reason_code text not null,
  settlement_reference text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, settlement_reference),
  unique (organization_id, id)
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  type text not null check (type in ('webhook','export_sink')),
  name text not null,
  state text not null default 'active' check (state in ('active','paused','revoked')),
  allowed_event_keys text[] not null default '{}',
  operational_owner_id uuid not null references auth.users(id),
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  integration_connection_id uuid not null references public.integration_connections(id),
  endpoint_url_ciphertext bytea not null,
  endpoint_host_hash text not null,
  signing_secret_ciphertext bytea not null,
  secret_wrapped_dek bytea not null,
  secret_key_id text not null,
  secret_version integer not null default 1 check (secret_version > 0),
  state text not null default 'active' check (state in ('active','paused','revoked')),
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  webhook_endpoint_id uuid not null references public.webhook_endpoints(id),
  event_id uuid not null,
  event_key text not null,
  state text not null default 'queued' check (state in ('queued','sending','delivered','retry_wait','failed_terminal','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  response_status integer check (response_status between 100 and 599),
  public_error_code text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, event_id, webhook_endpoint_id),
  unique (organization_id, id)
);

-- Tenant-integrity keys. A UUID match alone is never sufficient for a
-- tenant/project-owned relationship: the repeated organization_id/project_id
-- columns are constrained to the same parent boundary.
create unique index memberships_org_id_uidx on public.memberships(organization_id, id);
create unique index memberships_org_user_id_uidx on public.memberships(organization_id, user_id, id);
create unique index contracts_org_project_id_uidx on public.contracts(organization_id, project_id, id);
create unique index numbering_series_org_project_id_uidx on public.numbering_series(organization_id, project_id, id);
create unique index numbering_series_contract_id_uidx on public.numbering_series(organization_id, project_id, contract_id, id);
create unique index contract_versions_org_project_id_uidx on public.contract_versions(organization_id, project_id, id);
create unique index contract_versions_contract_id_uidx on public.contract_versions(organization_id, project_id, contract_id, id);
create unique index contract_terms_org_project_id_uidx on public.contract_term_versions(organization_id, project_id, id);
create unique index contract_terms_contract_id_uidx on public.contract_term_versions(organization_id, project_id, contract_id, id);
create unique index contract_terms_series_id_uidx on public.contract_term_versions(organization_id, project_id, contract_id, numbering_series_id, id);
create unique index contract_terms_numbering_id_uidx on public.contract_term_versions(organization_id, project_id, numbering_series_id, id);
create unique index references_org_project_id_uidx on public.reference_documents(organization_id, project_id, id);
create unique index reference_versions_org_project_id_uidx on public.reference_document_versions(organization_id, project_id, id);
create unique index work_items_org_project_id_uidx on public.work_items(organization_id, project_id, id);
create unique index work_items_one_current_head_uidx on public.work_items(lineage_root_id) where is_current;
create unique index work_items_one_direct_successor_uidx on public.work_items(supersedes_id) where supersedes_id is not null;
create unique index assignments_org_project_id_uidx on public.work_assignments(organization_id, project_id, id);
create unique index assignments_subject_id_uidx on public.work_assignments(organization_id, project_id, work_item_id, location_id, id);
create unique index evidence_rules_org_id_uidx on public.evidence_rule_versions(organization_id, id);
create unique index requirements_org_project_id_uidx on public.work_item_requirements(organization_id, project_id, id);
create unique index requirements_org_project_work_id_uidx on public.work_item_requirements(organization_id, project_id, work_item_id, id);
create unique index occurrences_org_project_id_uidx on public.requirement_occurrences(organization_id, project_id, id);
create unique index occurrences_subject_id_uidx on public.requirement_occurrences(organization_id, project_id, work_item_id, location_id, assignment_id, requirement_id, id);
create unique index occurrences_assignment_subject_id_uidx on public.requirement_occurrences(organization_id, project_id, work_item_id, location_id, assignment_id, id);
create unique index occurrences_version_uidx on public.requirement_occurrences(organization_id, project_id, id, version);
create unique index occurrences_subject_version_uidx on public.requirement_occurrences(organization_id, project_id, work_item_id, location_id, assignment_id, requirement_id, id, version);
create unique index occurrences_assignment_subject_version_uidx on public.requirement_occurrences(organization_id, project_id, work_item_id, location_id, assignment_id, id, version);
create unique index occurrence_triggers_org_project_id_uidx on public.occurrence_trigger_events(organization_id, project_id, id);
create unique index waivers_org_project_id_uidx on public.requirement_waivers(organization_id, project_id, id);
create unique index waiver_revocations_org_project_id_uidx on public.requirement_waiver_revocations(organization_id, project_id, id);
create unique index captures_org_project_id_uidx on public.capture_sessions(organization_id, project_id, id);
create unique index offline_leases_org_project_id_uidx on public.offline_authorization_leases(organization_id, project_id, id);
create unique index offline_leases_assignment_subject_uidx on public.offline_authorization_leases(organization_id, project_id, assignment_id, id);
create unique index offline_leases_actor_uidx on public.offline_authorization_leases(organization_id, authorized_user_id, id);
create unique index captures_org_project_work_id_uidx on public.capture_sessions(organization_id, project_id, work_item_id, id);
create unique index captures_org_project_work_operation_id_uidx on public.capture_sessions(organization_id, project_id, work_item_id, client_operation_id, id);
create unique index captures_subject_without_operation_id_uidx on public.capture_sessions(organization_id, project_id, work_item_id, location_id, assignment_id, id);
create unique index capture_auth_resolutions_org_project_id_uidx on public.capture_authorization_resolutions(organization_id, project_id, id);
create unique index capture_reporting_confirmations_org_project_id_uidx on public.capture_reporting_date_confirmations(organization_id, project_id, id);
create unique index upload_intents_org_project_id_uidx on public.upload_intents(organization_id, project_id, id);
create unique index upload_intents_org_project_purpose_id_uidx on public.upload_intents(organization_id, project_id, purpose, id);
create unique index upload_intents_org_project_purpose_retention_id_uidx on public.upload_intents(organization_id, project_id, purpose, retention_class, id);
create unique index upload_intents_evidence_subject_id_uidx on public.upload_intents(organization_id, project_id, work_item_id, location_id, assignment_id, capture_client_operation_id, purpose, retention_class, id);
create unique index evidence_org_project_id_uidx on public.evidence_objects(organization_id, project_id, id);
create unique index evidence_assignment_subject_id_uidx on public.evidence_objects(organization_id, project_id, work_item_id, location_id, assignment_id, id);
create unique index typed_evidence_org_project_id_uidx on public.typed_evidence_records(organization_id, project_id, id);
create unique index quantity_org_project_id_uidx on public.quantity_entries(organization_id, project_id, id);
create unique index quantity_subject_id_uidx on public.quantity_entries(organization_id, project_id, work_item_id, location_id, assignment_id, id);
create unique index review_decisions_org_project_id_uidx on public.review_decisions(organization_id, project_id, id);
create unique index review_decisions_package_id_uidx on public.review_decisions(organization_id, project_id, package_version_id, id);
create unique index review_decisions_one_current_head_uidx on public.review_decisions(lineage_root_id) where is_current;
create unique index review_decisions_one_direct_successor_uidx on public.review_decisions(supersedes_decision_id) where supersedes_decision_id is not null;
create unique index variations_org_project_id_uidx on public.variations(organization_id, project_id, id);
create unique index variation_versions_org_project_id_uidx on public.variation_versions(organization_id, project_id, id);
create unique index periods_org_project_id_uidx on public.reporting_periods(organization_id, project_id, id);
create unique index period_close_cycles_org_project_id_uidx on public.period_close_cycles(organization_id, project_id, id);
create unique index packages_org_project_id_uidx on public.package_versions(organization_id, project_id, id);
create unique index receivables_org_project_id_uidx on public.receivables(organization_id, project_id, id);
create unique index acceptances_org_project_id_uidx on public.acceptance_records(organization_id, project_id, id);
create unique index acceptances_package_id_uidx on public.acceptance_records(organization_id, project_id, package_version_id, id);
create unique index assignment_reassign_org_project_id_uidx on public.assignment_reassignment_receipts(organization_id, project_id, id);
create unique index review_task_reassign_org_project_id_uidx on public.review_task_reassignment_receipts(organization_id, project_id, id);
create unique index reference_ack_org_project_id_uidx on public.assignment_reference_acknowledgements(organization_id, project_id, id);
create unique index package_number_reservations_org_project_id_uidx on public.package_number_reservations(organization_id, project_id, id);
create unique index member_offboarding_previews_org_id_uidx on public.member_offboarding_previews(organization_id, id);
create unique index member_offboarding_items_org_project_id_uidx on public.member_offboarding_preview_items(organization_id, project_id, id);
create unique index member_offboarding_plans_org_id_uidx on public.member_offboarding_plans(organization_id, id);
create unique index member_offboarding_plan_items_org_id_uidx on public.member_offboarding_plan_items(organization_id, id);
create unique index membership_scope_removals_org_id_uidx on public.membership_project_scope_removal_receipts(organization_id, id);
create unique index saas_payment_reversals_org_id_uidx on public.saas_payment_reversals(organization_id, id);
create unique index adjustments_org_project_id_uidx on public.receivable_adjustments(organization_id, project_id, id);
create unique index payments_org_project_id_uidx on public.payments(organization_id, project_id, id);
create unique index shares_org_project_id_uidx on public.external_shares(organization_id, project_id, id);
create unique index external_decisions_org_project_id_uidx on public.external_decisions(organization_id, project_id, id);
create unique index external_decisions_package_id_uidx on public.external_decisions(organization_id, project_id, package_version_id, id);
create unique index package_decision_sets_org_project_id_uidx on public.package_decision_sets(organization_id, project_id, id);
create unique index package_decision_sets_package_id_uidx on public.package_decision_sets(organization_id, project_id, package_version_id, id);
create unique index package_decision_sets_current_uidx on public.package_decision_sets(organization_id, project_id, package_version_id) where state in ('pending_reconciliation','reconciled');
create unique index package_decision_sets_review_source_uidx on public.package_decision_sets(review_decision_id) where review_decision_id is not null;
create unique index package_decision_sets_external_source_uidx on public.package_decision_sets(external_decision_id) where external_decision_id is not null;
create unique index package_decision_items_org_project_id_uidx on public.package_decision_items(organization_id, project_id, id);
create unique index package_decision_issues_org_project_id_uidx on public.package_decision_issues(organization_id, project_id, id);
create unique index package_lines_package_id_uidx on public.package_lines(organization_id, project_id, package_version_id, id);
create unique index subscriptions_org_id_uidx on public.subscriptions(organization_id, id);
create unique index jobs_org_id_uidx on public.jobs(organization_id, id);
create unique index jobs_org_project_id_uidx on public.jobs(organization_id, project_id, id);
create unique index import_files_org_project_id_uidx on public.import_files(organization_id, project_id, id);
create unique index import_files_upload_subject_uidx on public.import_files(organization_id, project_id, upload_purpose, upload_intent_id);
create unique index import_jobs_org_project_id_uidx on public.import_jobs(organization_id, project_id, id);
create unique index support_grants_org_id_uidx on public.support_access_grants(organization_id, id);

-- A Pilot project has exactly one mutable commercial baseline. New versions
-- supersede the previous published row in the same transaction.
create unique index contracts_one_active_per_project_uidx
  on public.contracts(organization_id, project_id) where status = 'active';
create unique index contract_versions_one_published_uidx
  on public.contract_versions(contract_id) where status = 'published';
create unique index contract_terms_one_published_uidx
  on public.contract_term_versions(contract_id) where state = 'published';
create unique index reference_versions_one_published_uidx
  on public.reference_document_versions(reference_document_id) where state = 'published';
create unique index evidence_rules_one_published_uidx
  on public.evidence_rule_versions(organization_id, project_id, rule_key) nulls not distinct
  where status = 'published';
create unique index package_quantity_one_current_claim_uidx
  on public.package_line_quantity_sources(quantity_entry_id) where claim_state = 'current';
create unique index acceptance_one_current_head_uidx
  on public.acceptance_records(lineage_root_id) where is_current;
create unique index acceptance_one_direct_successor_uidx
  on public.acceptance_records(supersedes_acceptance_record_id) where supersedes_acceptance_record_id is not null;

alter table public.locations
  add constraint locations_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint locations_parent_tenant_fk foreign key (organization_id, project_id, parent_id)
    references public.locations(organization_id, project_id, id);

alter table public.invitation_project_scopes
  add constraint invitation_projects_invitation_tenant_fk foreign key (organization_id, invitation_id)
    references public.invitations(organization_id, id),
  add constraint invitation_projects_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.invitation_location_scopes
  add constraint invitation_locations_invitation_tenant_fk foreign key (organization_id, invitation_id)
    references public.invitations(organization_id, id),
  add constraint invitation_locations_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint invitation_locations_location_tenant_fk foreign key (organization_id, project_id, location_id)
    references public.locations(organization_id, project_id, id);

alter table public.membership_project_scopes
  add constraint member_project_member_tenant_fk foreign key (organization_id, membership_id)
    references public.memberships(organization_id, id);

alter table public.membership_location_scopes
  add constraint member_location_member_tenant_fk foreign key (organization_id, membership_id)
    references public.memberships(organization_id, id),
  add constraint member_location_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.contracts
  add constraint contracts_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.numbering_series
  add constraint numbering_series_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint numbering_series_contract_tenant_fk foreign key (organization_id, project_id, contract_id)
    references public.contracts(organization_id, project_id, id);

alter table public.contract_versions
  add constraint contract_versions_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint contract_versions_contract_tenant_fk foreign key (organization_id, project_id, contract_id)
    references public.contracts(organization_id, project_id, id);

alter table public.contract_term_versions
  add constraint contract_terms_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint contract_terms_contract_tenant_fk foreign key (organization_id, project_id, contract_id)
    references public.contracts(organization_id, project_id, id),
  add constraint contract_terms_numbering_series_fk foreign key (organization_id, project_id, contract_id, numbering_series_id)
    references public.numbering_series(organization_id, project_id, contract_id, id);

alter table public.reference_documents
  add constraint references_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.reference_document_versions
  add constraint reference_versions_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint reference_versions_document_tenant_fk foreign key (organization_id, project_id, reference_document_id)
    references public.reference_documents(organization_id, project_id, id),
  add constraint reference_versions_supersedes_tenant_fk foreign key (organization_id, project_id, supersedes_version_id)
    references public.reference_document_versions(organization_id, project_id, id),
  add constraint reference_versions_upload_tenant_fk foreign key (organization_id, project_id, upload_purpose, upload_intent_id)
    references public.upload_intents(organization_id, project_id, purpose, id);

alter table public.import_files
  add constraint import_files_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint import_files_upload_intent_tenant_fk foreign key (organization_id, project_id, upload_purpose, retention_class, upload_intent_id)
    references public.upload_intents(organization_id, project_id, purpose, retention_class, id);

alter table public.import_jobs
  add constraint import_jobs_upload_tenant_fk foreign key (organization_id, project_id, upload_purpose, upload_intent_id)
    references public.upload_intents(organization_id, project_id, purpose, id),
  add constraint import_jobs_verified_file_tenant_fk foreign key (organization_id, project_id, upload_purpose, upload_intent_id)
    references public.import_files(organization_id, project_id, upload_purpose, upload_intent_id);

alter table public.import_diffs
  add constraint import_diffs_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint import_diffs_job_tenant_fk foreign key (organization_id, project_id, import_job_id)
    references public.import_jobs(organization_id, project_id, id),
  add constraint import_diffs_contract_tenant_fk foreign key (organization_id, project_id, prior_contract_version_id)
    references public.contract_versions(organization_id, project_id, id);

alter table public.impact_previews
  add constraint impact_previews_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.member_offboarding_previews
  add constraint member_offboarding_membership_tenant_fk foreign key (organization_id, membership_id)
    references public.memberships(organization_id, id),
  add constraint member_offboarding_preview_plan_tenant_fk foreign key (organization_id, plan_id)
    references public.member_offboarding_plans(organization_id, id);

alter table public.member_offboarding_preview_items
  add constraint member_offboarding_item_preview_tenant_fk foreign key (organization_id, preview_id)
    references public.member_offboarding_previews(organization_id, id),
  add constraint member_offboarding_item_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.member_offboarding_plans
  add constraint member_offboarding_plan_membership_tenant_fk foreign key (organization_id, membership_id)
    references public.memberships(organization_id, id);

alter table public.member_offboarding_plan_items
  add constraint member_offboarding_plan_item_plan_tenant_fk foreign key (organization_id, plan_id)
    references public.member_offboarding_plans(organization_id, id),
  add constraint member_offboarding_plan_item_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.membership_project_scope_removal_receipts
  add constraint membership_scope_removal_member_tenant_fk foreign key (organization_id, membership_id)
    references public.memberships(organization_id, id),
  add constraint membership_scope_removal_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint membership_scope_removal_plan_tenant_fk foreign key (organization_id, offboarding_plan_id)
    references public.member_offboarding_plans(organization_id, id);

alter table public.work_items
  add constraint work_items_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint work_items_contract_tenant_fk foreign key (organization_id, project_id, contract_version_id)
    references public.contract_versions(organization_id, project_id, id),
  add constraint work_items_supersedes_tenant_fk foreign key (organization_id, project_id, supersedes_id)
    references public.work_items(organization_id, project_id, id),
  add constraint work_items_lineage_root_tenant_fk foreign key (organization_id, project_id, lineage_root_id)
    references public.work_items(organization_id, project_id, id)
    deferrable initially deferred;

alter table public.work_item_locations
  add constraint work_locations_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id),
  add constraint work_locations_location_tenant_fk foreign key (organization_id, project_id, location_id)
    references public.locations(organization_id, project_id, id);

alter table public.work_assignments
  add constraint assignments_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint assignments_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id),
  add constraint assignments_location_tenant_fk foreign key (organization_id, project_id, location_id)
    references public.locations(organization_id, project_id, id),
  add constraint assignments_terms_tenant_fk foreign key (organization_id, project_id, contract_term_version_id)
    references public.contract_term_versions(organization_id, project_id, id),
  add constraint assignments_reference_tenant_fk foreign key (organization_id, project_id, reference_document_version_id)
    references public.reference_document_versions(organization_id, project_id, id);

alter table public.evidence_rule_versions
  add constraint evidence_rules_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.work_item_requirements
  add constraint requirements_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint requirements_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id),
  add constraint requirements_location_tenant_fk foreign key (organization_id, project_id, location_id)
    references public.locations(organization_id, project_id, id),
  add constraint requirements_rule_tenant_fk foreign key (organization_id, rule_version_id)
    references public.evidence_rule_versions(organization_id, id);

alter table public.requirement_occurrences
  add constraint occurrences_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint occurrences_assignment_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id)
    references public.work_assignments(organization_id, project_id, work_item_id, location_id, id),
  add constraint occurrences_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id),
  add constraint occurrences_location_tenant_fk foreign key (organization_id, project_id, location_id)
    references public.locations(organization_id, project_id, id),
  add constraint occurrences_requirement_tenant_fk foreign key (organization_id, project_id, requirement_id)
    references public.work_item_requirements(organization_id, project_id, id),
  add constraint occurrences_rule_tenant_fk foreign key (organization_id, rule_version_id)
    references public.evidence_rule_versions(organization_id, id),
  add constraint occurrences_reference_tenant_fk foreign key (organization_id, project_id, reference_document_version_id)
    references public.reference_document_versions(organization_id, project_id, id);

alter table public.occurrence_trigger_events
  add constraint occurrence_triggers_assignment_tenant_fk foreign key (organization_id, project_id, assignment_id)
    references public.work_assignments(organization_id, project_id, id),
  add constraint occurrence_triggers_rule_tenant_fk foreign key (organization_id, rule_version_id)
    references public.evidence_rule_versions(organization_id, id),
  add constraint occurrence_triggers_occurrence_tenant_fk foreign key (organization_id, project_id, occurrence_id)
    references public.requirement_occurrences(organization_id, project_id, id),
  add constraint occurrence_triggers_quantity_tenant_fk foreign key (organization_id, project_id, authoritative_quantity_entry_id)
    references public.quantity_entries(organization_id, project_id, id);

alter table public.requirement_evaluations
  add constraint evaluations_requirement_tenant_fk foreign key (organization_id, project_id, requirement_id)
    references public.work_item_requirements(organization_id, project_id, id);

alter table public.requirement_waivers
  add constraint waivers_occurrence_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, requirement_id, occurrence_id)
    references public.requirement_occurrences(organization_id, project_id, work_item_id, location_id, assignment_id, requirement_id, id);

alter table public.requirement_waiver_revocations
  add constraint waiver_revocations_waiver_tenant_fk foreign key (organization_id, project_id, waiver_id)
    references public.requirement_waivers(organization_id, project_id, id),
  add constraint waiver_revocations_occurrence_tenant_fk foreign key (organization_id, project_id, occurrence_id)
    references public.requirement_occurrences(organization_id, project_id, id);

alter table public.capture_sessions
  add constraint captures_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint captures_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id),
  add constraint captures_assignment_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id)
    references public.work_assignments(organization_id, project_id, work_item_id, location_id, id),
  add constraint captures_authorization_lease_subject_fk foreign key (organization_id, project_id, assignment_id, authorization_lease_id)
    references public.offline_authorization_leases(organization_id, project_id, assignment_id, id),
  add constraint captures_location_tenant_fk foreign key (organization_id, project_id, location_id)
    references public.locations(organization_id, project_id, id),
  add constraint captures_revision_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, revision_of_id)
    references public.capture_sessions(organization_id, project_id, work_item_id, location_id, assignment_id, id),
  add constraint captures_actor_lease_fk foreign key (organization_id, created_by, authorization_lease_id)
    references public.offline_authorization_leases(organization_id, authorized_user_id, id),
  add constraint captures_authorization_resolution_fk foreign key (organization_id, project_id, authorization_resolution_id)
    references public.capture_authorization_resolutions(organization_id, project_id, id);

alter table public.offline_authorization_leases
  add constraint offline_lease_membership_tenant_fk foreign key (organization_id, membership_id)
    references public.memberships(organization_id, id),
  add constraint offline_lease_actor_membership_fk foreign key (organization_id, authorized_user_id, membership_id)
    references public.memberships(organization_id, user_id, id),
  add constraint offline_lease_assignment_tenant_fk foreign key (organization_id, project_id, assignment_id)
    references public.work_assignments(organization_id, project_id, id);

alter table public.capture_authorization_resolutions
  add constraint capture_auth_resolution_capture_tenant_fk foreign key (organization_id, project_id, capture_session_id)
    references public.capture_sessions(organization_id, project_id, id);

alter table public.capture_reporting_date_confirmations
  add constraint capture_reporting_confirmation_capture_tenant_fk foreign key (organization_id, project_id, capture_session_id)
    references public.capture_sessions(organization_id, project_id, id);

alter table public.upload_intents
  add constraint upload_intents_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint upload_intents_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id),
  add constraint upload_intents_assignment_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id)
    references public.work_assignments(organization_id, project_id, work_item_id, location_id, id),
  add constraint upload_intents_authorization_lease_subject_fk foreign key (organization_id, project_id, assignment_id, authorization_lease_id)
    references public.offline_authorization_leases(organization_id, project_id, assignment_id, id),
  add constraint upload_intents_actor_lease_fk foreign key (organization_id, created_by, authorization_lease_id)
    references public.offline_authorization_leases(organization_id, authorized_user_id, id);

alter table public.evidence_requests
  add constraint evidence_requests_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint evidence_requests_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id),
  add constraint evidence_requests_assignment_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id)
    references public.work_assignments(organization_id, project_id, work_item_id, location_id, id),
  add constraint evidence_requests_requirement_subject_fk foreign key (organization_id, project_id, work_item_id, requirement_id)
    references public.work_item_requirements(organization_id, project_id, work_item_id, id),
  add constraint evidence_requests_occurrence_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, requirement_id, occurrence_id)
    references public.requirement_occurrences(organization_id, project_id, work_item_id, location_id, assignment_id, requirement_id, id),
  add constraint evidence_requests_fulfillment_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, fulfilled_by_capture_session_id)
    references public.capture_sessions(organization_id, project_id, work_item_id, location_id, assignment_id, id),
  add constraint evidence_requests_occurrence_requires_requirement check (occurrence_id is null or requirement_id is not null);

alter table public.evidence_objects
  add constraint evidence_capture_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, capture_client_operation_id, capture_session_id)
    references public.capture_sessions(organization_id, project_id, work_item_id, location_id, assignment_id, client_operation_id, id),
  add constraint evidence_upload_intent_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, capture_client_operation_id, upload_purpose, retention_class, upload_intent_id)
    references public.upload_intents(organization_id, project_id, work_item_id, location_id, assignment_id, capture_client_operation_id, purpose, retention_class, id),
  add constraint evidence_parent_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, capture_client_operation_id, parent_id)
    references public.evidence_objects(organization_id, project_id, work_item_id, location_id, assignment_id, capture_client_operation_id, id);

alter table public.typed_evidence_records
  add constraint typed_evidence_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint typed_evidence_capture_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, capture_session_id)
    references public.capture_sessions(organization_id, project_id, work_item_id, location_id, assignment_id, id),
  add constraint typed_evidence_occurrence_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, occurrence_id)
    references public.requirement_occurrences(organization_id, project_id, work_item_id, location_id, assignment_id, id),
  add constraint typed_evidence_reference_tenant_fk foreign key (organization_id, project_id, reference_document_version_id)
    references public.reference_document_versions(organization_id, project_id, id),
  add constraint typed_evidence_original_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, original_evidence_object_id)
    references public.evidence_objects(organization_id, project_id, work_item_id, location_id, assignment_id, id);

alter table public.evidence_requirement_links
  add constraint evidence_links_evidence_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, capture_client_operation_id, evidence_object_id)
    references public.evidence_objects(organization_id, project_id, work_item_id, location_id, assignment_id, capture_client_operation_id, id),
  add constraint evidence_links_occurrence_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, requirement_id, occurrence_id)
    references public.requirement_occurrences(organization_id, project_id, work_item_id, location_id, assignment_id, requirement_id, id);

alter table public.quantity_entries
  add constraint quantity_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id),
  add constraint quantity_location_tenant_fk foreign key (organization_id, project_id, location_id)
    references public.locations(organization_id, project_id, id),
  add constraint quantity_assignment_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id)
    references public.work_assignments(organization_id, project_id, work_item_id, location_id, id),
  add constraint quantity_capture_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, capture_session_id)
    references public.capture_sessions(organization_id, project_id, work_item_id, location_id, assignment_id, id),
  add constraint quantity_correction_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, corrects_entry_id)
    references public.quantity_entries(organization_id, project_id, work_item_id, location_id, assignment_id, id);

alter table public.review_decisions
  add constraint review_capture_tenant_fk foreign key (organization_id, project_id, capture_session_id)
    references public.capture_sessions(organization_id, project_id, id),
  add constraint review_package_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id),
  add constraint review_supersedes_tenant_fk foreign key (organization_id, project_id, supersedes_decision_id)
    references public.review_decisions(organization_id, project_id, id),
  add constraint review_lineage_root_tenant_fk foreign key (organization_id, project_id, lineage_root_id)
    references public.review_decisions(organization_id, project_id, id)
    deferrable initially deferred;

alter table public.review_tasks
  add constraint review_tasks_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint review_tasks_capture_tenant_fk foreign key (organization_id, project_id, capture_session_id)
    references public.capture_sessions(organization_id, project_id, id),
  add constraint review_tasks_occurrence_tenant_fk foreign key (organization_id, project_id, occurrence_id)
    references public.requirement_occurrences(organization_id, project_id, id),
  add constraint review_tasks_package_item_tenant_fk foreign key (organization_id, project_id, package_decision_item_id)
    references public.package_decision_items(organization_id, project_id, id);

alter table public.review_decision_corrections
  add constraint review_corrections_capture_tenant_fk foreign key (organization_id, project_id, capture_session_id)
    references public.capture_sessions(organization_id, project_id, id),
  add constraint review_corrections_invalidated_decision_tenant_fk foreign key (organization_id, project_id, invalidated_decision_id)
    references public.review_decisions(organization_id, project_id, id),
  add constraint review_corrections_task_tenant_fk foreign key (organization_id, project_id, review_task_id)
    references public.review_tasks(organization_id, project_id, id);

alter table public.assignment_reassignment_receipts
  add constraint assignment_reassign_assignment_tenant_fk foreign key (organization_id, project_id, assignment_id)
    references public.work_assignments(organization_id, project_id, id);

alter table public.review_task_reassignment_receipts
  add constraint review_task_reassign_task_tenant_fk foreign key (organization_id, project_id, review_task_id)
    references public.review_tasks(organization_id, project_id, id);

alter table public.assignment_reference_acknowledgements
  add constraint reference_ack_assignment_tenant_fk foreign key (organization_id, project_id, assignment_id)
    references public.work_assignments(organization_id, project_id, id),
  add constraint reference_ack_version_tenant_fk foreign key (organization_id, project_id, acknowledged_reference_document_version_id)
    references public.reference_document_versions(organization_id, project_id, id);

alter table public.hold_point_decisions
  add constraint hold_decisions_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint hold_decisions_occurrence_version_fk foreign key (organization_id, project_id, occurrence_id, occurrence_version)
    references public.requirement_occurrences(organization_id, project_id, id, version);

alter table public.concealment_events
  add constraint concealment_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint concealment_occurrence_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, occurrence_id, occurrence_version)
    references public.requirement_occurrences(organization_id, project_id, work_item_id, location_id, assignment_id, id, version);

alter table public.concealment_event_evidence
  add constraint concealment_evidence_event_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, occurrence_id, concealment_event_id)
    references public.concealment_events(organization_id, project_id, work_item_id, location_id, assignment_id, occurrence_id, id),
  add constraint concealment_evidence_object_subject_fk foreign key (organization_id, project_id, work_item_id, location_id, assignment_id, evidence_object_id)
    references public.evidence_objects(organization_id, project_id, work_item_id, location_id, assignment_id, id);

alter table public.variations
  add constraint variations_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.variation_versions
  add constraint variation_versions_variation_tenant_fk foreign key (organization_id, project_id, variation_id)
    references public.variations(organization_id, project_id, id);

alter table public.variation_subjects
  add constraint variation_subjects_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint variation_subjects_variation_tenant_fk foreign key (organization_id, project_id, variation_id)
    references public.variations(organization_id, project_id, id),
  add constraint variation_subjects_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id),
  add constraint variation_subjects_assignment_tenant_fk foreign key (organization_id, project_id, assignment_id)
    references public.work_assignments(organization_id, project_id, id),
  add constraint variation_subjects_evidence_tenant_fk foreign key (organization_id, project_id, evidence_object_id)
    references public.evidence_objects(organization_id, project_id, id);

alter table public.variation_decisions
  add constraint variation_decisions_version_tenant_fk foreign key (organization_id, project_id, variation_version_id)
    references public.variation_versions(organization_id, project_id, id);

alter table public.reporting_periods
  add constraint periods_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.period_close_cycles
  add constraint period_close_cycles_period_tenant_fk foreign key (organization_id, project_id, period_id)
    references public.reporting_periods(organization_id, project_id, id);

alter table public.package_versions
  add constraint packages_period_tenant_fk foreign key (organization_id, project_id, period_id)
    references public.reporting_periods(organization_id, project_id, id),
  add constraint packages_contract_tenant_fk foreign key (organization_id, project_id, contract_id)
    references public.contracts(organization_id, project_id, id),
  add constraint packages_contract_version_subject_fk foreign key (organization_id, project_id, contract_id, contract_version_id)
    references public.contract_versions(organization_id, project_id, contract_id, id),
  add constraint packages_contract_terms_subject_fk foreign key (organization_id, project_id, contract_id, contract_term_version_id)
    references public.contract_term_versions(organization_id, project_id, contract_id, id),
  add constraint packages_numbering_series_tenant_fk foreign key (organization_id, project_id, numbering_series_id)
    references public.numbering_series(organization_id, project_id, id),
  add constraint packages_terms_series_subject_fk foreign key (organization_id, project_id, contract_id, numbering_series_id, contract_term_version_id)
    references public.contract_term_versions(organization_id, project_id, contract_id, numbering_series_id, id);

alter table public.package_number_reservations
  add constraint package_number_period_tenant_fk foreign key (organization_id, project_id, period_id)
    references public.reporting_periods(organization_id, project_id, id),
  add constraint package_number_terms_series_tenant_fk foreign key (organization_id, project_id, numbering_series_id, contract_term_version_id)
    references public.contract_term_versions(organization_id, project_id, numbering_series_id, id),
  add constraint package_number_series_tenant_fk foreign key (organization_id, project_id, numbering_series_id)
    references public.numbering_series(organization_id, project_id, id),
  add constraint package_number_version_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id);

alter table public.package_lines
  add constraint package_lines_package_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id),
  add constraint package_lines_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id);

alter table public.package_line_quantity_sources
  add constraint package_qty_sources_line_tenant_fk foreign key (organization_id, project_id, package_line_id)
    references public.package_lines(organization_id, project_id, id),
  add constraint package_qty_sources_entry_tenant_fk foreign key (organization_id, project_id, quantity_entry_id)
    references public.quantity_entries(organization_id, project_id, id);

alter table public.package_line_evidence_sources
  add constraint package_evidence_sources_line_tenant_fk foreign key (organization_id, project_id, package_line_id)
    references public.package_lines(organization_id, project_id, id),
  add constraint package_evidence_sources_object_tenant_fk foreign key (organization_id, project_id, evidence_object_id)
    references public.evidence_objects(organization_id, project_id, id);

alter table public.package_artifacts
  add constraint package_artifacts_package_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id);

alter table public.package_submissions
  add constraint package_submissions_package_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id);

alter table public.receivables
  add constraint receivables_package_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id),
  add constraint receivables_acceptance_tenant_fk foreign key (organization_id, project_id, package_version_id, acceptance_record_id)
    references public.acceptance_records(organization_id, project_id, package_version_id, id);

alter table public.acceptance_records
  add constraint acceptances_package_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id),
  add constraint acceptances_supersedes_tenant_fk foreign key (organization_id, project_id, package_version_id, supersedes_acceptance_record_id)
    references public.acceptance_records(organization_id, project_id, package_version_id, id),
  add constraint acceptances_lineage_root_tenant_fk foreign key (organization_id, project_id, package_version_id, lineage_root_id)
    references public.acceptance_records(organization_id, project_id, package_version_id, id)
    deferrable initially deferred;

alter table public.receivable_adjustments
  add constraint adjustments_receivable_tenant_fk foreign key (organization_id, project_id, receivable_id)
    references public.receivables(organization_id, project_id, id),
  add constraint adjustments_correction_tenant_fk foreign key (organization_id, project_id, corrects_adjustment_id)
    references public.receivable_adjustments(organization_id, project_id, id);

alter table public.retention_releases
  add constraint retention_adjustment_tenant_fk foreign key (organization_id, project_id, adjustment_id)
    references public.receivable_adjustments(organization_id, project_id, id);

alter table public.payments
  add constraint payments_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.payment_allocations
  add constraint allocations_payment_tenant_fk foreign key (organization_id, project_id, payment_id)
    references public.payments(organization_id, project_id, id),
  add constraint allocations_receivable_tenant_fk foreign key (organization_id, project_id, receivable_id)
    references public.receivables(organization_id, project_id, id);

alter table public.payment_reversals
  add constraint payment_reversals_payment_tenant_fk foreign key (organization_id, project_id, payment_id)
    references public.payments(organization_id, project_id, id);

alter table public.reconciliation_imports
  add constraint reconciliation_imports_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint reconciliation_imports_job_tenant_fk foreign key (organization_id, project_id, job_id)
    references public.jobs(organization_id, project_id, id);

alter table public.external_shares
  add constraint shares_package_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id),
  add constraint shares_variation_tenant_fk foreign key (organization_id, project_id, variation_version_id)
    references public.variation_versions(organization_id, project_id, id);

alter table public.external_sessions
  add constraint sessions_share_tenant_fk foreign key (organization_id, project_id, external_share_id)
    references public.external_shares(organization_id, project_id, id);

alter table public.external_decisions
  add constraint decisions_share_tenant_fk foreign key (organization_id, project_id, external_share_id)
    references public.external_shares(organization_id, project_id, id),
  add constraint decisions_session_tenant_fk foreign key (organization_id, project_id, external_session_id)
    references public.external_sessions(organization_id, project_id, id),
  add constraint decisions_package_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id);

alter table public.package_decision_sets
  add constraint package_decision_sets_package_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id),
  add constraint package_decision_sets_review_subject_fk foreign key (organization_id, project_id, package_version_id, review_decision_id)
    references public.review_decisions(organization_id, project_id, package_version_id, id),
  add constraint package_decision_sets_external_subject_fk foreign key (organization_id, project_id, package_version_id, external_decision_id)
    references public.external_decisions(organization_id, project_id, package_version_id, id);

alter table public.package_decision_items
  add constraint package_decisions_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint package_decisions_package_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id),
  add constraint package_decisions_set_subject_fk foreign key (organization_id, project_id, package_version_id, decision_set_id)
    references public.package_decision_sets(organization_id, project_id, package_version_id, id),
  add constraint package_decisions_line_subject_fk foreign key (organization_id, project_id, package_version_id, package_line_id)
    references public.package_lines(organization_id, project_id, package_version_id, id),
  add constraint package_decisions_resolved_package_tenant_fk foreign key (organization_id, project_id, resolved_by_package_version_id)
    references public.package_versions(organization_id, project_id, id);

alter table public.package_decision_issues
  add constraint package_decision_issues_package_tenant_fk foreign key (organization_id, project_id, package_version_id)
    references public.package_versions(organization_id, project_id, id),
  add constraint package_decision_issues_set_tenant_fk foreign key (organization_id, project_id, decision_set_id)
    references public.package_decision_sets(organization_id, project_id, id),
  add constraint package_decision_issues_item_tenant_fk foreign key (organization_id, project_id, decision_item_id)
    references public.package_decision_items(organization_id, project_id, id),
  add constraint package_decision_issues_occurrence_tenant_fk foreign key (organization_id, project_id, occurrence_id)
    references public.requirement_occurrences(organization_id, project_id, id),
  add constraint package_decision_issues_evidence_tenant_fk foreign key (organization_id, project_id, evidence_object_id)
    references public.evidence_objects(organization_id, project_id, id);

alter table public.audit_events
  add constraint audit_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.sync_operations
  add constraint sync_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.usage_snapshots
  add constraint usage_subscription_tenant_fk foreign key (organization_id, subscription_id)
    references public.subscriptions(organization_id, id);

alter table public.subscription_state_previews
  add constraint subscription_state_preview_tenant_fk foreign key (organization_id, subscription_id)
    references public.subscriptions(organization_id, id);

alter table public.notification_preferences
  add constraint notification_preferences_member_tenant_fk foreign key (organization_id, user_id)
    references public.memberships(organization_id, user_id);

alter table public.saved_views
  add constraint saved_views_member_tenant_fk foreign key (organization_id, user_id)
    references public.memberships(organization_id, user_id);

alter table public.integration_connections
  add constraint integration_operational_owner_membership_fk foreign key (organization_id, operational_owner_id)
    references public.memberships(organization_id, user_id);

alter table public.notifications
  add constraint notifications_member_tenant_fk foreign key (organization_id, user_id)
    references public.memberships(organization_id, user_id);

alter table public.notification_deliveries
  add constraint notification_deliveries_recipient_tenant_fk foreign key (organization_id, user_id, notification_id)
    references public.notifications(organization_id, user_id, id);

alter table public.jobs
  add constraint jobs_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint jobs_project_requires_org check (project_id is null or organization_id is not null);

alter table public.export_jobs
  add constraint exports_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.export_cancellation_receipts
  add constraint export_cancellation_job_tenant_fk foreign key (organization_id, export_job_id)
    references public.export_jobs(organization_id, id);

alter table public.support_access_grant_projects
  add constraint support_projects_grant_tenant_fk foreign key (organization_id, support_access_grant_id)
    references public.support_access_grants(organization_id, id),
  add constraint support_projects_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.access_reviews
  add constraint access_reviews_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id);

alter table public.membership_permission_overrides
  add constraint permission_overrides_member_tenant_fk foreign key (organization_id, membership_id)
    references public.memberships(organization_id, id);

alter table public.rule_pack_versions
  add constraint rule_pack_versions_pack_tenant_fk foreign key (organization_id, rule_pack_id)
    references public.rule_packs(organization_id, id);

alter table public.rule_assignments
  add constraint rule_assignments_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint rule_assignments_rule_tenant_fk foreign key (organization_id, rule_version_id)
    references public.evidence_rule_versions(organization_id, id),
  add constraint rule_assignments_location_tenant_fk foreign key (organization_id, project_id, location_id)
    references public.locations(organization_id, project_id, id),
  add constraint rule_assignments_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id);

alter table public.readiness_snapshots
  add constraint readiness_project_tenant_fk foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  add constraint readiness_work_tenant_fk foreign key (organization_id, project_id, work_item_id)
    references public.work_items(organization_id, project_id, id),
  add constraint readiness_period_tenant_fk foreign key (organization_id, project_id, period_id)
    references public.reporting_periods(organization_id, project_id, id);

alter table public.job_attempts
  add constraint job_attempts_job_tenant_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id);

alter table public.saas_invoices
  add constraint saas_invoices_subscription_tenant_fk foreign key (organization_id, subscription_id)
    references public.subscriptions(organization_id, id);

alter table public.saas_payments
  add constraint saas_payments_invoice_tenant_fk foreign key (organization_id, saas_invoice_id)
    references public.saas_invoices(organization_id, id);

alter table public.saas_payment_reversals
  add constraint saas_payment_reversal_payment_tenant_fk foreign key (organization_id, saas_payment_id)
    references public.saas_payments(organization_id, id);

alter table public.webhook_endpoints
  add constraint webhook_endpoints_connection_tenant_fk foreign key (organization_id, integration_connection_id)
    references public.integration_connections(organization_id, id);

alter table public.webhook_deliveries
  add constraint webhook_deliveries_endpoint_tenant_fk foreign key (organization_id, webhook_endpoint_id)
    references public.webhook_endpoints(organization_id, id);

create index memberships_user_active_idx on public.memberships(user_id, organization_id) where status = 'active';
create index projects_org_status_idx on public.projects(organization_id, status);
create index work_items_project_status_idx on public.work_items(project_id, status);
create index assignments_project_state_due_idx on public.work_assignments(project_id, state, due_at);
create index requirements_project_state_idx on public.work_item_requirements(project_id, state);
create index occurrences_assignment_state_due_idx on public.requirement_occurrences(assignment_id, state, due_at);
create index reference_versions_project_state_idx on public.reference_document_versions(project_id, state, issue_date desc);
create index captures_project_state_idx on public.capture_sessions(project_id, state, submitted_at desc);
create index review_tasks_project_state_due_idx on public.review_tasks(project_id, state, due_at);
create index review_decision_corrections_capture_idx on public.review_decision_corrections(capture_session_id, created_at);
create index quantity_work_date_idx on public.quantity_entries(work_item_id, occurred_on);
create index packages_project_state_idx on public.package_versions(project_id, state, created_at desc);
create index receivables_org_due_idx on public.receivables(organization_id, due_on) where state not in ('paid','written_off');
create index audit_org_time_idx on public.audit_events(organization_id, occurred_at desc);
create unique index invitations_one_open_idx on public.invitations(organization_id, email_normalized)
  where status in ('draft','queued','sent');
create index membership_project_scope_idx on public.membership_project_scopes(organization_id, project_id, membership_id);
create index membership_location_scope_idx on public.membership_location_scopes(organization_id, project_id, location_id, membership_id);
create index import_jobs_project_state_idx on public.import_jobs(project_id, state, created_at desc);
create index upload_intents_project_state_idx on public.upload_intents(organization_id, project_id, state, expires_at);
create index evaluation_requirement_time_idx on public.requirement_evaluations(requirement_id, evaluated_at desc);
create unique index waiver_one_active_occurrence_uidx on public.requirement_waivers(occurrence_id) where state = 'active';
create index waiver_active_idx on public.requirement_waivers(requirement_id, expires_at) where state = 'active';
create index occurrence_triggers_assignment_idx on public.occurrence_trigger_events(assignment_id, rule_version_id, created_at);
create index capture_auth_exception_idx on public.capture_sessions(project_id, first_server_received_at) where authorization_disposition = 'first_seen_after_invalidation';
create index capture_reporting_date_review_idx on public.capture_sessions(project_id, first_server_received_at) where reporting_date_review_state = 'required';
create index period_close_cycles_period_idx on public.period_close_cycles(period_id, cycle_no desc);
create index offboarding_plans_member_state_idx on public.member_offboarding_plans(organization_id, membership_id, state, expires_at);
create index offboarding_plan_items_state_idx on public.member_offboarding_plan_items(plan_id, state, resource_type);
create index variations_project_state_idx on public.variations(project_id, state, updated_at desc);
create index external_share_active_idx on public.external_shares(resource_type, package_version_id, variation_version_id, expires_at) where revoked_at is null;
create index package_decisions_package_state_idx on public.package_decision_items(package_version_id, state, correction_due_at);
create index package_decision_issues_open_idx on public.package_decision_issues(package_version_id, severity, created_at) where state = 'open';
create index jobs_ready_idx on public.jobs(state, next_attempt_at, created_at) where state in ('queued','retry_wait');
create index outbox_ready_idx on public.transaction_outbox(available_at, created_at) where processed_at is null;
create index notification_deliveries_recipient_state_idx on public.notification_deliveries(organization_id, user_id, state, next_attempt_at, created_at desc);
create index notifications_recipient_read_idx on public.notifications(organization_id, user_id, read_at, created_at desc);
create index support_grants_active_idx on public.support_access_grants(organization_id, expires_at) where status = 'active';
create index legal_holds_active_idx on public.legal_holds(organization_id, scope_type, scope_id) where active;
create index webhook_deliveries_ready_idx on public.webhook_deliveries(state, next_attempt_at, created_at) where state in ('queued','retry_wait');

create or replace function private.current_actor_user_id()
returns uuid
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(
    auth.uid(),
    nullif(current_setting('app.actor_user_id', true), '')::uuid
  );
$$;

create or replace function private.has_org_access(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = target_org
      and m.user_id = private.current_actor_user_id()
      and m.status = 'active'
  );
$$;

create or replace function private.has_project_access(target_org uuid, target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_org
      and m.user_id = private.current_actor_user_id()
      and m.status = 'active'
      and (
        m.all_projects
        or m.role in ('owner', 'admin')
        or exists (
          select 1
          from public.membership_project_scopes s
          where s.organization_id = target_org
            and s.membership_id = m.id
            and s.project_id = target_project
        )
      )
  );
$$;

revoke all on function private.current_actor_user_id() from public;
revoke all on function private.has_org_access(uuid) from public;
revoke all on function private.has_project_access(uuid, uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.current_actor_user_id() to authenticated;
grant execute on function private.has_org_access(uuid) to authenticated;
grant execute on function private.has_project_access(uuid, uuid) to authenticated;

-- Enable RLS. Production migrations add action/role/project policies per permissions.csv.
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.locations enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_versions enable row level security;
alter table public.work_items enable row level security;
alter table public.work_item_locations enable row level security;
alter table public.evidence_rule_versions enable row level security;
alter table public.work_item_requirements enable row level security;
alter table public.capture_sessions enable row level security;
alter table public.evidence_objects enable row level security;
alter table public.quantity_entries enable row level security;
alter table public.review_decisions enable row level security;
alter table public.reporting_periods enable row level security;
alter table public.package_versions enable row level security;
alter table public.package_lines enable row level security;
alter table public.receivables enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.external_shares enable row level security;
alter table public.audit_events enable row level security;
alter table public.sync_operations enable row level security;

-- Defense-in-depth: future reference tables are deny-by-default even when a migration
-- author forgets an explicit ALTER. Production migrations still define action-specific
-- policies and grants; this block only enables RLS.
do $$
declare
  target record;
begin
  for target in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', target.schemaname, target.tablename);
    execute format('alter table %I.%I force row level security', target.schemaname, target.tablename);
  end loop;
end
$$;

-- Baseline read policy pattern; repeat/generated in migrations and tighten by scope.
create policy org_member_select_projects on public.projects
for select to authenticated
using (private.has_project_access(organization_id, id));

create policy org_admin_insert_projects on public.projects
for insert to authenticated
with check (
  private.has_org_access(organization_id)
  and exists (
    select 1 from public.memberships m
    where m.organization_id = projects.organization_id
      and m.user_id = private.current_actor_user_id() and m.status = 'active'
      and m.role in ('owner','admin','commercial_manager','pto_manager')
  )
);

create policy org_admin_update_projects on public.projects
for update to authenticated
using (private.has_org_access(organization_id))
with check (
  private.has_org_access(organization_id)
  and exists (
    select 1 from public.memberships m
    where m.organization_id = projects.organization_id
      and m.user_id = private.current_actor_user_id() and m.status = 'active'
      and m.role in ('owner','admin','commercial_manager','pto_manager')
  )
);

-- RLS does not grant privileges. Supabase Data API exposes only the reviewed
-- `api` schema; `public` is intentionally absent from exposed_schemas.
revoke all on all tables in schema public from anon, authenticated;
revoke all on schema public from anon;
grant usage on schema api to authenticated;
grant select on public.projects to authenticated;

create or replace view api.project_list
with (security_invoker = true)
as
select
  id,
  organization_id,
  code,
  name,
  customer_name,
  site_address,
  timezone,
  status,
  version,
  starts_on,
  ends_on
from public.projects;

revoke all on api.project_list from anon, authenticated;
grant select on api.project_list to authenticated;

-- BFF/worker roles, login mapping and their explicit grants are generated from
-- technical/data-access-surface.csv in a deployment migration. They must be
-- NOLOGIN/NOBYPASSRLS group roles. service_role is migration/emergency-only.
-- Do not grant any client insert/update/delete on tenant or audit tables.

-- Evidence Graph canonical-query indexes (doc 39 §7): composite, organization_id-first,
-- on link tables and hot projections for reverse traversal not covered by the PK leading column.
create index evidence_requirement_links_occurrence_idx on public.evidence_requirement_links(organization_id, occurrence_id, evidence_object_id);
create index payment_allocations_receivable_idx on public.payment_allocations(organization_id, receivable_id, payment_id);
create index package_line_quantity_sources_qentry_idx on public.package_line_quantity_sources(organization_id, quantity_entry_id, package_line_id);
create index readiness_snapshots_subject_idx on public.readiness_snapshots(organization_id, subject_type, work_item_id, period_id);
