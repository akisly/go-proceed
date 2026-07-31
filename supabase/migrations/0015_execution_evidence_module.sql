-- v0.1-M2-A execution and evidence module.
--
-- Additive only. Migrations 0010-0014 are applied history and are never edited.
--
-- Style follows the realized database rather than technical/database/schema-v0.1.sql,
-- which was written before M1 was built and diverges from it in three ways:
-- the workspace table is public.organizations (not public.workspaces), state
-- columns are text + check (this database has no enums, and enum evolution needs
-- alter type, which complicates additive migrations), and content hashes are text
-- with a hex check, matching public.import_files.content_hash. A mixed style
-- would be worse than a documented deviation.

-- ---------------------------------------------------------------------------
-- Composite uniques required to back the M2 foreign keys.
-- memberships has unique (organization_id, user_id) and
-- (organization_id, user_id, id); neither can back a (workspace_id, member_id)
-- reference. work_items has unique (workspace_id, id) and
-- (workspace_id, contract_version_id, id); the assignment and allocation
-- references need the project/contract-scoped forms.
-- ---------------------------------------------------------------------------
alter table public.memberships
  add constraint memberships_org_id_key unique (organization_id, id);
alter table public.work_items
  add constraint work_items_version_scope_key
  unique (workspace_id, project_id, contract_id, contract_version_id, id);
alter table public.work_items
  add constraint work_items_contract_scope_key
  unique (workspace_id, project_id, contract_id, id);

-- ---------------------------------------------------------------------------
-- Requirement templates (pulled forward from v0.1-M3).
-- M2-A freezes only what assignment pinning and the upload media gate read.
-- condition_expr, form_schema, timing and the three policy objects exist as
-- columns but accept only their empty defaults until M3 opens them.
-- ---------------------------------------------------------------------------
create table public.requirement_template_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  template_key text not null check (length(btrim(template_key)) > 0),
  version_no integer not null check (version_no >= 1),
  status text not null default 'draft' check (status in ('draft','published')),
  evidence_type text not null check (evidence_type in ('photo','document','form')),
  allowed_media jsonb not null default '[]',
  multiplicity jsonb not null default '{}',
  timing jsonb not null default '{}',
  severity text not null default 'blocking' check (severity in ('blocking','advisory')),
  condition_expr text,
  form_schema jsonb,
  satisfier_policy jsonb not null default '{}',
  reviewer_policy jsonb not null default '{}',
  exception_policy jsonb not null default '{}',
  template_hash text check (template_hash ~ '^[0-9a-f]{64}$'),
  published_at timestamptz,
  published_by_member_id uuid,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, template_key, version_no),
  foreign key (workspace_id, published_by_member_id)
    references public.memberships (organization_id, id),
  foreign key (workspace_id, created_by_member_id)
    references public.memberships (organization_id, id),
  constraint requirement_template_versions_published_check
    check (status = 'draft'
        or (template_hash is not null and published_at is not null
            and published_by_member_id is not null))
);

-- ---------------------------------------------------------------------------
-- Work assignments: operational scope derived from a work item, not a copy of
-- the contract row.
-- ---------------------------------------------------------------------------
create table public.work_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
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
  status text not null default 'active'
    check (status in ('draft','active','paused','completed','cancelled')),
  version bigint not null default 1,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id, contract_id, contract_version_id, work_item_id)
    references public.work_items (workspace_id, project_id, contract_id, contract_version_id, id),
  foreign key (workspace_id, project_id, location_id)
    references public.locations (workspace_id, project_id, id),
  foreign key (workspace_id, performer_party_id) references public.parties (workspace_id, id),
  foreign key (workspace_id, assignee_member_id)
    references public.memberships (organization_id, id),
  foreign key (workspace_id, created_by_member_id)
    references public.memberships (organization_id, id),
  -- Stricter than technical/database/schema-v0.1.sql, which leaves this
  -- reference unconstrained: a pinned template version must exist in this
  -- workspace, or the pin is a dangling promise.
  foreign key (workspace_id, requirement_template_version_id)
    references public.requirement_template_versions (workspace_id, id)
);
create index work_assignments_work_item_idx
  on public.work_assignments (workspace_id, work_item_id);
create index work_assignments_project_idx
  on public.work_assignments (workspace_id, project_id, created_at desc, id);

-- ---------------------------------------------------------------------------
-- Progress entries: append-only roots and signed adjustments.
--
-- INV-023 is structural, not procedural. root_is_root is a literal
-- discriminator: NULL on roots, so the composite FK is not enforced under MATCH
-- SIMPLE, and forced true on adjustments, so the FK can only resolve against a
-- row whose generated is_root column is true. An adjustment chain is therefore
-- unrepresentable rather than merely rejected by one route -- the M1 review
-- found INV-020 correct in one route and bypassable through another.
-- ---------------------------------------------------------------------------
create table public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  work_assignment_id uuid not null,
  work_item_id uuid not null,
  entry_kind text not null check (entry_kind in ('root','adjustment')),
  quantity numeric(20,6) not null,
  root_progress_entry_id uuid,
  root_is_root boolean check (root_is_root),
  is_root boolean generated always as (entry_kind = 'root') stored,
  reason_code text,
  recorded_by_member_id uuid not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, id, is_root),
  foreign key (workspace_id, project_id, work_assignment_id)
    references public.work_assignments (workspace_id, project_id, id),
  foreign key (workspace_id, work_item_id) references public.work_items (workspace_id, id),
  foreign key (workspace_id, recorded_by_member_id)
    references public.memberships (organization_id, id),
  constraint progress_entries_root_is_root_fkey
    foreign key (workspace_id, root_progress_entry_id, root_is_root)
    references public.progress_entries (workspace_id, id, is_root),
  constraint progress_entries_kind_check
    check ((entry_kind = 'root' and root_progress_entry_id is null and root_is_root is null
            and quantity > 0 and reason_code is null)
        or (entry_kind = 'adjustment' and root_progress_entry_id is not null
            and root_is_root = true and quantity <> 0 and reason_code is not null))
);
create index progress_adjustments_root_idx
  on public.progress_entries (workspace_id, root_progress_entry_id, created_at, id)
  where entry_kind = 'adjustment';
create index progress_entries_work_item_idx
  on public.progress_entries (workspace_id, work_item_id);
create index progress_entries_assignment_idx
  on public.progress_entries (workspace_id, work_assignment_id);

-- ---------------------------------------------------------------------------
-- Allocation head: rebuildable serialization/balance projection, NOT authority.
-- Only the named app_private commands write it; the app role gets no UPDATE.
-- ---------------------------------------------------------------------------
create table public.progress_allocation_heads (
  workspace_id uuid not null references public.organizations(id),
  root_progress_entry_id uuid not null,
  effective_quantity numeric(20,6) not null check (effective_quantity >= 0),
  reserved_quantity numeric(20,6) not null default 0,
  accepted_reserved_quantity numeric(20,6) not null default 0
    check (accepted_reserved_quantity >= 0),
  current_unaccepted_reserved_quantity numeric(20,6) not null default 0
    check (current_unaccepted_reserved_quantity >= 0),
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, root_progress_entry_id),
  foreign key (workspace_id, root_progress_entry_id)
    references public.progress_entries (workspace_id, id),
  constraint progress_allocation_heads_balance_check
    check (reserved_quantity = accepted_reserved_quantity + current_unaccepted_reserved_quantity),
  constraint progress_allocation_heads_reservation_check
    check (reserved_quantity >= 0 and reserved_quantity <= effective_quantity)
);

-- ---------------------------------------------------------------------------
-- Valuation allocations: append-only money lineage partitioning the work-item
-- pool into exposure slices. Package lines later SUM these amounts instead of
-- recomputing quantity * price, so the same quantity is never rounded twice.
-- ---------------------------------------------------------------------------
create table public.valuation_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  work_item_id uuid not null,
  -- Added beyond technical/database/schema-v0.1.sql, which carries only
  -- root_progress_entry_id: without this column there is no enforceable
  -- "exactly one allocation per progress fact", and an adjustment's allocation
  -- cannot be told from its root's.
  progress_entry_id uuid not null,
  root_progress_entry_id uuid,
  lineage_key text not null,
  quantity numeric(20,6) not null,
  net_minor_units bigint,
  tax_minor_units bigint,
  gross_minor_units bigint,
  unvalued_reason text
    check (unvalued_reason is null
        or unvalued_reason in ('unknown_tax_basis','missing_unit_price')),
  predecessor_allocation_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, progress_entry_id),
  foreign key (workspace_id, project_id, contract_id, work_item_id)
    references public.work_items (workspace_id, project_id, contract_id, id),
  foreign key (workspace_id, progress_entry_id)
    references public.progress_entries (workspace_id, id),
  foreign key (workspace_id, root_progress_entry_id)
    references public.progress_entries (workspace_id, id),
  foreign key (workspace_id, predecessor_allocation_id)
    references public.valuation_allocations (workspace_id, id),
  -- An unvalued slice stores NULL in all three components and names a reason;
  -- it never stores 0. M1's publish writes `mp.net ?? "0"` into the pool
  -- (publish/route.ts:200) and those columns are NOT NULL, so 0 already means
  -- "unknown" there. If it meant "unknown" here too, INV-038's
  -- missing-versus-zero distinction would be unrecoverable in M6.
  constraint valuation_allocations_components_check
    check ((net_minor_units is null and tax_minor_units is null
            and gross_minor_units is null and unvalued_reason is not null)
        or (net_minor_units is not null and tax_minor_units is not null
            and gross_minor_units is not null and unvalued_reason is null
            and gross_minor_units = net_minor_units + tax_minor_units))
);
create index valuation_allocations_work_item_idx
  on public.valuation_allocations (workspace_id, work_item_id, created_at, id);

-- ---------------------------------------------------------------------------
-- Upload intents: the idempotent whole-upload contract.
-- intent_authorized -> staged -> integrity_verified -> scan_pending
--   -> available | scan_blocked; authorization failure -> orphaned_for_purge.
-- Staged bytes are never evidence (INV-046) and orphans purge within 24h
-- (INV-047).
-- ---------------------------------------------------------------------------
create table public.upload_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  work_assignment_id uuid not null,
  requirement_occurrence_id uuid,   -- FK deferred to v0.1-M3 with the table
  created_by_member_id uuid not null,
  device_capture_id text,
  origin_method text not null check (origin_method in
    ('native_camera','photo_picker','file_picker','form','import','generated_derivative')),
  original_filename text,
  claimed_capture_time timestamptz,
  claimed_tz_offset text,
  source_app_version text,
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  expected_byte_size bigint not null check (expected_byte_size > 0),
  expected_content_hash text not null check (expected_content_hash ~ '^[0-9a-f]{64}$'),
  allowed_content_family text not null,
  claimed_media_type text not null,
  status text not null default 'intent_authorized'
    check (status in ('intent_authorized','staged','integrity_verified','scan_pending',
                      'available','scan_blocked','orphaned_for_purge','expired')),
  staging_bucket text,
  staging_storage_key text,
  staging_attempt integer not null default 0,
  quota_reserved_bytes bigint not null default 0,
  expires_at timestamptz not null,
  finalized_evidence_object_id uuid,
  failure_code text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, created_by_member_id, idempotency_key),
  unique (workspace_id, staging_storage_key),
  foreign key (workspace_id, project_id, work_assignment_id)
    references public.work_assignments (workspace_id, project_id, id),
  foreign key (workspace_id, created_by_member_id)
    references public.memberships (organization_id, id)
);
create index upload_intents_purge_idx
  on public.upload_intents (status, expires_at)
  where status in ('intent_authorized','staged','integrity_verified','orphaned_for_purge');

-- ---------------------------------------------------------------------------
-- Evidence objects: immutable content identity and provenance.
-- Recorder/performer/source/custodian are accountability, never permission
-- grants. Claimed capture time and server receipt are separate labeled facts.
--
-- inspection_status has no 'blocked' value by design: a scan-blocked upload
-- never produces an evidence row at all, so nothing downstream can read blocked
-- content as evidence. The blocked state lives on the intent.
-- ---------------------------------------------------------------------------
create table public.evidence_objects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  media_type text not null,
  original_filename text,
  storage_bucket text not null,
  storage_key text not null,
  storage_provider text not null,
  storage_region text,
  origin_method text not null check (origin_method in
    ('native_camera','photo_picker','file_picker','form','import','generated_derivative')),
  relation_kind text not null default 'original'
    check (relation_kind in ('original','derivative','correction')),
  source_evidence_object_id uuid,
  recorder_member_id uuid not null,
  performer_party_id uuid,
  source_party_id uuid,
  custodian_party_id uuid,
  custodian_member_id uuid,
  device_capture_id text,
  claimed_capture_time timestamptz,
  claimed_tz_offset text,
  capture_time_trust text not null default 'unknown'
    check (capture_time_trust in ('device_claimed','server_estimated','unknown')),
  server_received_at timestamptz not null,
  upload_intent_id uuid,
  source_app_version text,
  inspection_status text not null check (inspection_status in ('passed','not_required')),
  inspection_policy_version text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, storage_key),   -- INV-045: immutable, never overwritten
  unique (workspace_id, upload_intent_id),
  foreign key (workspace_id, source_evidence_object_id)
    references public.evidence_objects (workspace_id, id),
  foreign key (workspace_id, recorder_member_id)
    references public.memberships (organization_id, id),
  foreign key (workspace_id, performer_party_id) references public.parties (workspace_id, id),
  foreign key (workspace_id, source_party_id)    references public.parties (workspace_id, id),
  foreign key (workspace_id, custodian_party_id) references public.parties (workspace_id, id),
  foreign key (workspace_id, custodian_member_id)
    references public.memberships (organization_id, id),
  foreign key (workspace_id, upload_intent_id)
    references public.upload_intents (workspace_id, id),
  check ((relation_kind = 'original' and source_evidence_object_id is null)
      or (relation_kind <> 'original' and source_evidence_object_id is not null))
);

alter table public.upload_intents
  add constraint upload_intents_finalized_evidence_fkey
  foreign key (workspace_id, finalized_evidence_object_id)
  references public.evidence_objects (workspace_id, id);

-- ---------------------------------------------------------------------------
-- Capture events: device and server facts for one evidence-capture attempt.
-- ---------------------------------------------------------------------------
create table public.capture_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid,
  work_assignment_id uuid,
  upload_intent_id uuid,
  device_capture_id text not null,
  client_state text not null check (client_state in
    ('not_sent','sending','awaiting_receipt','server_confirmed','failed','quarantined')),
  event_source text not null check (event_source in ('device','server')),
  claimed_capture_time timestamptz,
  claimed_tz_offset text,
  capture_time_trust text not null default 'device_claimed'
    check (capture_time_trust in ('device_claimed','server_estimated','unknown')),
  failure_code text,
  reported_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, upload_intent_id)
    references public.upload_intents (workspace_id, id)
);
create index capture_events_intent_idx
  on public.capture_events (workspace_id, upload_intent_id, reported_at);
