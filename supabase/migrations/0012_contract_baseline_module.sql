-- 0012: contract-baseline module (v0.1-M1): units, locations, contracts,
-- immutable contract versions + work items, import provenance chain.
-- Import source bytes are stored in-database for M1 (plan decision 3); the
-- storage_key records the deterministic logical key for later relocation.
-- Rollback (dev only): drop the nine tables in reverse dependency order.
-- Forward fix (staging/prod): corrective migration only.

create table public.unit_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  code text not null check (length(btrim(code)) > 0),
  normalized_code text generated always as
    (lower(regexp_replace(btrim(code), '\s+', '', 'g'))) stored,
  name text,
  unit_precision smallint not null default 3 check (unit_precision between 0 and 6),
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index unit_definitions_code_unique
  on public.unit_definitions (workspace_id, normalized_code);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  parent_location_id uuid,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, project_id, parent_location_id)
    references public.locations (workspace_id, project_id, id)
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  own_party_id uuid not null,
  customer_party_id uuid not null,
  contract_no text not null check (length(btrim(contract_no)) > 0),
  normalized_contract_no text generated always as
    (upper(regexp_replace(btrim(contract_no), '\s+', ' ', 'g'))) stored,
  title text,
  currency char(3) not null,
  tax_mode text not null check (tax_mode in
    ('exclusive','inclusive','exempt','out_of_scope','unknown')),
  tax_rate_bps integer check (tax_rate_bps between 0 and 10000),
  terms jsonb not null default '{}'::jsonb,
  approval_policy jsonb not null default '{}'::jsonb,
  rounding_policy jsonb not null,
  source_tolerance_minor_units bigint not null default 100
    check (source_tolerance_minor_units >= 0),
  source_tolerance_bps integer not null default 10
    check (source_tolerance_bps >= 0),
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (own_party_id <> customer_party_id),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  -- INV-002 at the FK layer: the own party MUST hold an own-legal-entity profile
  -- in the same workspace.
  foreign key (workspace_id, own_party_id)
    references public.own_legal_entity_profiles (workspace_id, party_id),
  foreign key (workspace_id, customer_party_id)
    references public.parties (workspace_id, id)
);
create unique index contracts_number_unique
  on public.contracts (workspace_id, own_party_id, normalized_contract_no);
create index contracts_project_idx on public.contracts (workspace_id, project_id, id);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  status text not null default 'created' check (status in
    ('created','parsing','parsed','mapping','validated','preview_ready',
     'published','failed','abandoned')),
  mapping jsonb,
  mapping_version integer not null default 0,
  parser_config jsonb,
  parser_version text,
  current_attempt integer not null default 0,
  row_count integer,
  blocking_count integer,
  warning_count integer,
  needs_resolution_count integer,
  totals jsonb,
  failure_codes text[] not null default '{}',
  source_manifest_hash text check (source_manifest_hash ~ '^[0-9a-f]{64}$'),
  published_version_id uuid,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, contract_id, id),
  foreign key (workspace_id, project_id, contract_id)
    references public.contracts (workspace_id, project_id, id)
);
create index import_batches_contract_idx
  on public.import_batches (workspace_id, contract_id, status, created_at);

create table public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  version_no integer not null check (version_no >= 1),
  status text not null default 'published' check (status in ('draft','published')),
  own_party_snapshot jsonb not null,
  customer_party_snapshot jsonb not null,
  currency char(3) not null,
  tax_mode text not null check (tax_mode in
    ('exclusive','inclusive','exempt','out_of_scope','unknown')),
  tax_rate_bps integer check (tax_rate_bps between 0 and 10000),
  terms jsonb not null,
  approval_policy jsonb not null,
  rounding_policy jsonb not null,
  source_tolerance_minor_units bigint not null,
  source_tolerance_bps integer not null,
  import_batch_id uuid not null,
  source_manifest_hash text not null check (source_manifest_hash ~ '^[0-9a-f]{64}$'),
  supersedes_version_id uuid,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, contract_id, id),
  unique (workspace_id, project_id, contract_id, id),
  unique (workspace_id, contract_id, version_no),
  foreign key (workspace_id, project_id, contract_id)
    references public.contracts (workspace_id, project_id, id),
  foreign key (workspace_id, import_batch_id)
    references public.import_batches (workspace_id, id),
  foreign key (workspace_id, contract_id, supersedes_version_id)
    references public.contract_versions (workspace_id, contract_id, id)
);

alter table public.import_batches add constraint import_batches_published_version_fk
  foreign key (workspace_id, published_version_id)
  references public.contract_versions (workspace_id, id);

create table public.import_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  import_batch_id uuid not null,
  filename text not null check (length(btrim(filename)) > 0),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  detected_format text not null check (detected_format in ('xlsx','csv')),
  storage_key text not null,
  source_bytes bytea not null,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, import_batch_id, id),
  unique (workspace_id, import_batch_id, content_hash),
  foreign key (workspace_id, import_batch_id)
    references public.import_batches (workspace_id, id)
);

create table public.import_row_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  import_batch_id uuid not null,
  import_file_id uuid not null,
  attempt integer not null check (attempt >= 1),
  worksheet text,
  source_row integer not null check (source_row >= 1),
  source_cells jsonb not null,
  mapped jsonb,
  severity text not null check (severity in ('ok','warning','blocking')),
  error_codes text[] not null default '{}',
  parser_version text not null,
  mapping_version integer not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, import_batch_id, id),
  unique (workspace_id, import_batch_id, attempt, import_file_id, worksheet, source_row),
  foreign key (workspace_id, import_batch_id)
    references public.import_batches (workspace_id, id),
  foreign key (workspace_id, import_batch_id, import_file_id)
    references public.import_files (workspace_id, import_batch_id, id)
);
create index import_row_results_attempt_idx
  on public.import_row_results (workspace_id, import_batch_id, attempt, severity);

create table public.source_amount_resolutions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  import_batch_id uuid not null,
  row_result_id uuid not null,
  chosen_basis text not null check (chosen_basis in
    ('unit_price_derived','approved_source_amount')),
  reason text not null check (length(btrim(reason)) > 0),
  source_amount_minor_units bigint not null,
  derived_amount_minor_units bigint not null,
  resolved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, import_batch_id, row_result_id),
  foreign key (workspace_id, import_batch_id)
    references public.import_batches (workspace_id, id),
  foreign key (workspace_id, import_batch_id, row_result_id)
    references public.import_row_results (workspace_id, import_batch_id, id)
);

create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  contract_version_id uuid not null,
  position integer not null check (position >= 1),
  source_key text,
  work_code text,
  description text not null check (length(btrim(description)) > 0),
  section text,
  unit_definition_id uuid not null,
  unit_code text not null,
  unit_precision smallint not null check (unit_precision between 0 and 6),
  contract_quantity numeric(18,6) not null check (contract_quantity >= 0),
  unit_price_state text not null check (unit_price_state in ('known','zero','missing')),
  unit_price_decimal numeric(18,6)
    check ((unit_price_state = 'known') = (unit_price_decimal is not null)),
  price_basis text check (price_basis in ('net','gross')),
  valuation_basis text not null check (valuation_basis in
    ('unit_price_derived','approved_source_amount')),
  currency char(3) not null,
  tax_mode text not null check (tax_mode in
    ('exclusive','inclusive','exempt','out_of_scope','unknown')),
  tax_rate_bps integer check (tax_rate_bps between 0 and 10000),
  source_amount_minor_units bigint,
  approved_amount_minor_units bigint,
  net_amount_minor_units bigint not null,
  tax_amount_minor_units bigint not null,
  gross_amount_minor_units bigint not null
    check (gross_amount_minor_units = net_amount_minor_units + tax_amount_minor_units),
  location_id uuid,
  external_ref text,
  source_row_result_id uuid,
  predecessor_work_item_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, contract_version_id, id),
  unique (workspace_id, contract_version_id, position),
  foreign key (workspace_id, project_id, contract_id, contract_version_id)
    references public.contract_versions (workspace_id, project_id, contract_id, id),
  foreign key (workspace_id, unit_definition_id)
    references public.unit_definitions (workspace_id, id),
  foreign key (workspace_id, project_id, location_id)
    references public.locations (workspace_id, project_id, id),
  foreign key (workspace_id, source_row_result_id)
    references public.import_row_results (workspace_id, id),
  foreign key (workspace_id, predecessor_work_item_id)
    references public.work_items (workspace_id, id)
);
create index work_items_version_idx
  on public.work_items (workspace_id, contract_version_id, position);
create index work_items_predecessor_idx
  on public.work_items (workspace_id, predecessor_work_item_id);
