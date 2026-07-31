# GoProceed v0.1-M2-A — execution, valuation, evidence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server half of v0.1-M2 — work assignments, append-only progress with coupled money allocation, and the authorize/stage/verify/finalize evidence upload protocol against private object storage.

**Architecture:** Nine API operations on the existing `commandRoute`/`queryRoute` plumbing, two additive migrations (`0015` module DDL, `0016` security), one new pure-domain valuation module, and a storage module wrapping private Supabase Storage buckets. Money is allocated telescopically from cumulative performed quantity so the pool identity reconciles exactly by construction. Every invariant that can be expressed as a constraint is expressed as a constraint, not only as route validation.

**Tech Stack:** TypeScript 5.9.2, Next.js route handlers (`runtime = "nodejs"`), PostgreSQL 15 via `pg`, Supabase local stack (DB `54322`, Storage/API `54321`), Vitest 3.2.4, Turbo 2.5.4, pnpm 9.12.0, Node >=24 <25.

**Spec:** [2026-07-31-goproceed-v0.1-m2a-execution-evidence-design.md](../specs/2026-07-31-goproceed-v0.1-m2a-execution-evidence-design.md)

## Global Constraints

- Migrations `0010`–`0014` are applied history. **Never edit them.** Corrections and additions go in `0015`+.
- The workspace table is `public.organizations`. There is no `public.workspaces`.
- No PostgreSQL enums. Every state column is `text` with `check (col in (...))`, matching all 14 existing migrations.
- Content hashes are `text` with `check (col ~ '^[0-9a-f]{64}$')`, matching `import_files.content_hash`.
- Money is `bigint` minor units end to end. Never `number`, never float arithmetic.
- Quantities are `numeric(20,6)` in the database and scaled `bigint` (scale 6) in TypeScript.
- User-facing problem messages are Ukrainian, matching every existing route.
- Every command route: `commandRoute` → `withTenantTx` → `withIdempotency` → `recordAudit` → `enqueueOutbox`.
- `progress.record` and `progress.adjust` pass `idempotencyClass: "ledger_400d"`. All other new commands take the default.
- Tests run serialized: `pnpm turbo run test --concurrency=1`. Never run bare `vitest run` from the repo root against the shared database.
- Admin DB URL in tests: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- `supabase/seed.sql` must never contain credentials.

---

### Task 1: Capability vocabulary and catalog reconciliation

**Files:**
- Modify: `packages/domain/src/authz.ts:2-17`
- Test: `packages/domain/src/authz.test.ts`
- Modify: `technical/openapi/scope-v0.1.csv`
- Modify: `technical/database/entity-catalog.csv`

**Interfaces:**
- Consumes: nothing.
- Produces: `ProjectCapability` gains `"assignments.manage" | "progress.record" | "progress.adjust" | "evidence.record"`. `WorkspaceCapability` gains `"requirement_templates.manage"`, granted to `owner` and `admin`. Every later task's `requireProjectCapability` / `requireWorkspaceCapability` call uses these exact strings.

- [ ] **Step 1: Write the failing test**

Append to `packages/domain/src/authz.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { workspaceCapabilities } from "./authz";

describe("M2-A capabilities", () => {
  it("grants requirement template management to owner and admin only", () => {
    expect(workspaceCapabilities("owner")).toContain("requirement_templates.manage");
    expect(workspaceCapabilities("admin")).toContain("requirement_templates.manage");
    expect(workspaceCapabilities("member")).not.toContain("requirement_templates.manage");
    expect(workspaceCapabilities("auditor")).not.toContain("requirement_templates.manage");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aktflow/domain exec vitest run src/authz.test.ts`
Expected: FAIL — `workspaceCapabilities("owner")` does not contain the string.

- [ ] **Step 3: Extend the unions**

In `packages/domain/src/authz.ts` replace lines 2-5:

```typescript
export type WorkspaceCapability =
  | "parties.manage" | "own_legal_profiles.manage" | "projects.create" | "units.manage"
  | "requirement_templates.manage";
export type ProjectCapability =
  | "project.admin" | "project.view" | "contracts.edit" | "imports.manage" | "imports.publish"
  | "assignments.manage" | "progress.record" | "progress.adjust" | "evidence.record";
```

Add `"requirement_templates.manage"` to the `owner` and `admin` arrays in `MAP`.

`evidence.custody` is in `technical/permissions/capabilities.csv` but its only operation
(`evidence_links.create`) is M3. It is deliberately NOT added here — an unused capability
string is the dead surface M1's review flagged.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aktflow/domain exec vitest run src/authz.test.ts`
Expected: PASS

- [ ] **Step 5: Reconcile the catalogs**

In `technical/openapi/scope-v0.1.csv`, change the trailing `v0.1-M3` to `v0.1-M2` on exactly
the two rows whose `operation_id` is `requirement_templates.create` and
`requirement_templates.publish`.

In `technical/database/entity-catalog.csv`, change `v0.1-M3` to `v0.1-M2` on the
`requirement_template_versions` row.

In `technical/permissions/capabilities.csv`, change the `requirement_templates.manage` row's
milestone to `v0.1-M2`.

In `technical/database/entity-catalog.csv`, append ` (deliberately schema-only until v0.1-M3)`
to the `purpose` text of the `project_parties` row, closing the reconciliation item recorded in
`TODOS.md`.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/authz.ts packages/domain/src/authz.test.ts technical/
git commit -m "feat(m2): M2-A capability vocabulary and catalog reconciliation"
```

---

### Task 2: Migration 0015 — execution and evidence module DDL

**Files:**
- Create: `supabase/migrations/0015_execution_evidence_module.sql`
- Test: `packages/testing/src/m2-schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `public.requirement_template_versions`, `public.work_assignments`, `public.progress_entries`, `public.progress_allocation_heads`, `public.valuation_allocations`, `public.upload_intents`, `public.capture_events`, `public.evidence_objects`. Every later task inserts into these exact column names.

- [ ] **Step 1: Write the failing schema test**

Create `packages/testing/src/m2-schema.test.ts`. Assert structure, not mere existence —
a table that exists with the wrong foreign key is the failure mode this test is for:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { adminClient } from "./pg";
import type { Client } from "pg";

let c: Client;
beforeAll(async () => { c = await adminClient(); });

async function columns(table: string): Promise<Record<string, string>> {
  const r = await c.query(
    `select column_name, data_type from information_schema.columns
      where table_schema = 'public' and table_name = $1`, [table]);
  return Object.fromEntries(r.rows.map((x) => [x.column_name, x.data_type]));
}

async function constraintSrc(name: string): Promise<string | undefined> {
  const r = await c.query(
    `select pg_get_constraintdef(oid) as src from pg_constraint where conname = $1`, [name]);
  return r.rows[0]?.src;
}

describe("0015 module DDL", () => {
  it("creates all eight M2 tables", async () => {
    const r = await c.query(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_name = any($1::text[])`,
      [["requirement_template_versions", "work_assignments", "progress_entries",
        "progress_allocation_heads", "valuation_allocations", "upload_intents",
        "capture_events", "evidence_objects"]]);
    expect(r.rows.length).toBe(8);
  });

  it("stores money as bigint and quantity as numeric", async () => {
    const va = await columns("valuation_allocations");
    expect(va.net_minor_units).toBe("bigint");
    expect(va.tax_minor_units).toBe("bigint");
    expect(va.gross_minor_units).toBe("bigint");
    expect(va.quantity).toBe("numeric");
    expect(va.progress_entry_id).toBe("uuid");
  });

  it("makes an adjustment chain structurally unrepresentable (INV-023)", async () => {
    const src = await constraintSrc("progress_entries_root_is_root_fkey");
    expect(src).toMatch(/root_progress_entry_id, root_is_root\)/);
    expect(src).toMatch(/REFERENCES progress_entries\(workspace_id, id, is_root\)/);
  });

  it("keeps gross = net + tax or all three null", async () => {
    const src = await constraintSrc("valuation_allocations_components_check");
    expect(src).toMatch(/gross_minor_units = \(net_minor_units \+ tax_minor_units\)/);
  });

  it("adds the composite uniques the M2 foreign keys need", async () => {
    const r = await c.query(
      `select conname from pg_constraint
        where conname = any($1::text[]) and contype = 'u'`,
      [["memberships_org_id_key", "work_items_version_scope_key", "work_items_contract_scope_key"]]);
    expect(r.rows.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aktflow/testing exec vitest run src/m2-schema.test.ts`
Expected: FAIL — 0 of 8 tables found.

- [ ] **Step 3: Write the additive constraints and the first three tables**

Create `supabase/migrations/0015_execution_evidence_module.sql` starting with:

```sql
-- v0.1-M2-A execution and evidence module.
-- Additive only. Migrations 0010-0014 are applied history and are never edited.
-- Style follows the realized database, not technical/database/schema-v0.1.sql:
-- the workspace table is public.organizations, state columns are text+check
-- (this database has no enums), and hashes are text with a hex check.

-- Composite uniques required to back the M2 foreign keys. memberships has
-- unique (organization_id, user_id) and (organization_id, user_id, id); neither
-- can back a (workspace_id, member_id) reference.
alter table public.memberships
  add constraint memberships_org_id_key unique (organization_id, id);
alter table public.work_items
  add constraint work_items_version_scope_key
  unique (workspace_id, project_id, contract_id, contract_version_id, id);
alter table public.work_items
  add constraint work_items_contract_scope_key
  unique (workspace_id, project_id, contract_id, id);

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
  -- stricter than technical/database/schema-v0.1.sql, which leaves this
  -- reference unconstrained: the pinned version must exist in this workspace.
  foreign key (workspace_id, requirement_template_version_id)
    references public.requirement_template_versions (workspace_id, id)
);
create index work_assignments_work_item_idx
  on public.work_assignments (workspace_id, work_item_id);
create index work_assignments_project_idx
  on public.work_assignments (workspace_id, project_id, created_at desc, id);

create table public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  work_assignment_id uuid not null,
  work_item_id uuid not null,
  entry_kind text not null check (entry_kind in ('root','adjustment')),
  quantity numeric(20,6) not null,
  root_progress_entry_id uuid,
  -- Literal discriminator: NULL on roots (so the composite FK is not enforced
  -- under MATCH SIMPLE), forced true on adjustments so the FK can only resolve
  -- against a row whose generated is_root is true. INV-023 becomes
  -- unrepresentable rather than merely rejected by one route.
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
```

- [ ] **Step 4: Write the remaining five tables**

Append to the same file:

```sql
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
  check (reserved_quantity = accepted_reserved_quantity + current_unaccepted_reserved_quantity),
  check (reserved_quantity >= 0 and reserved_quantity <= effective_quantity)
);

create table public.valuation_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  work_item_id uuid not null,
  -- Added beyond technical/database/schema-v0.1.sql: without it there is no
  -- enforceable "exactly one allocation per progress fact", and an adjustment's
  -- allocation cannot be told from its root's.
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
  -- An unvalued slice stores NULL in all three components and names a reason.
  -- It never stores 0: M1's publish writes `mp.net ?? "0"` into the pool, so 0
  -- already means "unknown" there, and INV-038's missing-vs-zero distinction
  -- would be unrecoverable if it meant "unknown" here too.
  constraint valuation_allocations_components_check
    check ((net_minor_units is null and tax_minor_units is null
            and gross_minor_units is null and unvalued_reason is not null)
        or (net_minor_units is not null and tax_minor_units is not null
            and gross_minor_units is not null and unvalued_reason is null
            and gross_minor_units = net_minor_units + tax_minor_units))
);
create index valuation_allocations_work_item_idx
  on public.valuation_allocations (workspace_id, work_item_id, created_at, id);

create table public.upload_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  work_assignment_id uuid not null,
  requirement_occurrence_id uuid,  -- FK deferred to M3 with the table
  created_by_member_id uuid not null,
  device_capture_id text,
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
  -- No 'blocked' value by design: a scan-blocked upload never produces an
  -- evidence row at all. The blocked state lives on the intent (INV-046).
  inspection_status text not null check (inspection_status in ('passed','not_required')),
  inspection_policy_version text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, storage_key),
  unique (workspace_id, upload_intent_id),
  foreign key (workspace_id, source_evidence_object_id)
    references public.evidence_objects (workspace_id, id),
  foreign key (workspace_id, recorder_member_id)
    references public.memberships (organization_id, id),
  foreign key (workspace_id, performer_party_id) references public.parties (workspace_id, id),
  foreign key (workspace_id, source_party_id) references public.parties (workspace_id, id),
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
```

- [ ] **Step 5: Apply and run the schema test**

```bash
supabase db reset
```

Run: `pnpm --filter @aktflow/testing exec vitest run src/m2-schema.test.ts`
Expected: PASS — all five assertions.

- [ ] **Step 6: Prove the INV-023 chain is rejected by the database itself**

Append to `packages/testing/src/m2-schema.test.ts` a test that inserts a root, an adjustment
on it, then a second adjustment whose `root_progress_entry_id` is the first adjustment, and
expects a foreign-key violation (SQLSTATE `23503`) — not a check violation, proving the FK is
what stops it. Use `adminClient()` so RLS is bypassed and only the constraint is under test.
Build the workspace, project, contract, version, work item, and assignment rows directly with
`insert` in a `beforeAll`; this file tests DDL, not routes.

Run: `pnpm --filter @aktflow/testing exec vitest run src/m2-schema.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0015_execution_evidence_module.sql packages/testing/src/m2-schema.test.ts
git commit -m "feat(m2): execution and evidence module DDL with structural INV-023"
```

---

### Task 3: Migration 0016 — grants, RLS, append-only enforcement

**Files:**
- Create: `supabase/migrations/0016_execution_evidence_security.sql`
- Test: `packages/testing/src/m2-rls.test.ts`

**Interfaces:**
- Consumes: the eight tables from Task 2.
- Produces: `app_private.assert_reservation_invariant(p_workspace uuid, p_root_progress_entry uuid) returns void` — a real implementation replacing the design stub, called by Task 8. Raises `PROGRESS_RESERVATION_VIOLATED` when `reserved_quantity` would exceed `effective_quantity`.

- [ ] **Step 1: Write the failing security test**

Create `packages/testing/src/m2-rls.test.ts`. Mirror the shape of the existing
`m1-rls-workspace.test.ts`. Cover, using `asActor()` from `./pg`:

```typescript
// 1. A member of workspace A cannot select work_assignments of workspace B.
// 2. A member with no project grant cannot select the project's assignments.
// 3. update on progress_entries is denied (append-only trigger), for the
//    inserting member, not only for a stranger.
// 4. delete on valuation_allocations is denied.
// 5. update of evidence_objects.storage_key is denied (INV-045).
// 6. A published requirement_template_versions row rejects update (INV-015).
// 7. The app role has no direct update grant on progress_allocation_heads.
```

Assertion 7 is checked against `information_schema.role_table_grants`:

```typescript
it("gives the app role no direct UPDATE on allocation heads", async () => {
  const r = await c.query(
    `select privilege_type from information_schema.role_table_grants
      where grantee = 'aktflow_app' and table_name = 'progress_allocation_heads'`);
  const privs = r.rows.map((x) => x.privilege_type);
  expect(privs).toContain("SELECT");
  expect(privs).not.toContain("UPDATE");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aktflow/testing exec vitest run src/m2-rls.test.ts`
Expected: FAIL — cross-workspace select succeeds because RLS is not enabled yet.

- [ ] **Step 3: Write grants and RLS**

Create `supabase/migrations/0016_execution_evidence_security.sql`. Follow
`0013_contract_baseline_security.sql` exactly for helper-function names and policy shape.

Grant `select, insert` on all eight tables to `aktflow_app`. Grant no `update` and no `delete`
anywhere except `work_assignments` (`update` — it carries `status` and `version`) and
`upload_intents` (`update` — it is a state machine). `progress_allocation_heads` gets
`select` only; it is maintained by the `security definer` functions in Step 5.

Enable RLS on all eight and add per-table policies whose predicate is the same capability the
routes check. **Migration 0014 exists because M1's write policies were a capability no-op — do
not repeat that.** A write policy must name the capability, for example:

Use the existing helper `app.has_project_capability(ws uuid, proj uuid, caps text[])` from
`supabase/migrations/0011_workspace_access_security.sql:20`. Note its third argument is a
**text array**, not a single value:

```sql
alter table public.work_assignments enable row level security;

create policy work_assignments_select on public.work_assignments
  for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
                                    array['project.view','project.admin']));

create policy work_assignments_insert on public.work_assignments
  for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
                                         array['assignments.manage']));
```

Mirror the route's capability exactly per table: `assignments.manage` for `work_assignments`
insert, `progress.record` / `progress.adjust` for `progress_entries` insert, `evidence.record`
for `upload_intents` and `evidence_objects`, and `project.view` plus `project.admin` for every
select. `project.admin` implies only `project.view` — the action capabilities stay explicit,
matching `requireProjectCapability` in `apps/app/src/lib/authz.ts:58`.

- [ ] **Step 4: Write the append-only and immutability triggers**

Append:

```sql
create or replace function app_private.deny_write() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only: % on % is not permitted', tg_op, tg_table_name
    using errcode = '42501';
end $$;

create trigger progress_entries_append_only
  before update or delete on public.progress_entries
  for each row execute function app_private.deny_write();

create trigger valuation_allocations_append_only
  before update or delete on public.valuation_allocations
  for each row execute function app_private.deny_write();

create trigger capture_events_append_only
  before update or delete on public.capture_events
  for each row execute function app_private.deny_write();

create trigger evidence_objects_append_only
  before update or delete on public.evidence_objects
  for each row execute function app_private.deny_write();

-- INV-015: a published template version is frozen; a draft may only advance
-- to published, and its frozen content may not change in that transition.
create or replace function app_private.guard_template_version() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'requirement template versions are not deletable'
      using errcode = '42501';
  end if;
  if old.status = 'published' then
    raise exception 'published template version % is immutable', old.id
      using errcode = '42501';
  end if;
  if new.status = 'published' and (
       new.evidence_type   is distinct from old.evidence_type
    or new.allowed_media   is distinct from old.allowed_media
    or new.multiplicity    is distinct from old.multiplicity
    or new.severity        is distinct from old.severity
    or new.template_key    is distinct from old.template_key
    or new.version_no      is distinct from old.version_no) then
    raise exception 'publishing must not alter frozen template content'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger requirement_template_versions_guard
  before update or delete on public.requirement_template_versions
  for each row execute function app_private.guard_template_version();
```

- [ ] **Step 5: Implement the reservation invariant for real**

`technical/database/schema-v0.1.sql:1795` declares this as a design interface that raises
`'design interface: implemented by v0.1 migrations'`. Implement it:

```sql
create or replace function app_private.assert_reservation_invariant(
  p_workspace uuid, p_root_progress_entry uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_effective numeric(20,6);
  v_reserved  numeric(20,6);
begin
  -- Caller must already hold the allocation head lock.
  select coalesce(sum(quantity), 0) into v_effective
    from public.progress_entries
   where workspace_id = p_workspace
     and (id = p_root_progress_entry or root_progress_entry_id = p_root_progress_entry);

  select reserved_quantity into v_reserved
    from public.progress_allocation_heads
   where workspace_id = p_workspace and root_progress_entry_id = p_root_progress_entry;

  if v_effective < 0 then
    raise exception 'INV-024: effective quantity % is negative for root %',
      v_effective, p_root_progress_entry using errcode = '23514';
  end if;
  if v_reserved is not null and (v_reserved < 0 or v_reserved > v_effective) then
    raise exception 'INV-025: reserved % outside [0, %] for root %',
      v_reserved, v_effective, p_root_progress_entry using errcode = '23514';
  end if;

  update public.progress_allocation_heads
     set effective_quantity = v_effective, version = version + 1, updated_at = now()
   where workspace_id = p_workspace and root_progress_entry_id = p_root_progress_entry;
end $$;

revoke all on function app_private.assert_reservation_invariant(uuid, uuid) from public;
grant execute on function app_private.assert_reservation_invariant(uuid, uuid) to aktflow_app;
```

Add a companion `app_private.open_allocation_head(p_workspace uuid, p_root uuid, p_quantity numeric)`
that inserts the head row for a new root, granted the same way, since the app role has no
direct `insert` on `progress_allocation_heads`.

- [ ] **Step 6: Apply and run**

```bash
supabase db reset
```

Run: `pnpm --filter @aktflow/testing exec vitest run src/m2-rls.test.ts src/m2-schema.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0016_execution_evidence_security.sql packages/testing/src/m2-rls.test.ts
git commit -m "feat(m2): execution and evidence RLS, append-only triggers, reservation invariant"
```

---

### Task 4: Valuation engine — telescopic coupled allocation

**Files:**
- Create: `packages/domain/src/valuation.ts`
- Create: `packages/domain/src/valuation.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: `Decimal`, `TaxMode`, `PriceBasis` from `packages/domain/src/money.ts`.
- Produces:
  - `type UnitPriceState = "known" | "zero" | "missing"`
  - `type ValuationBasis = "unit_price_derived" | "approved_source_amount"`
  - `type UnvaluedReason = "unknown_tax_basis" | "missing_unit_price"`
  - `interface PoolAmounts { net: bigint; tax: bigint; gross: bigint }`
  - `interface WorkItemValuation { pool: PoolAmounts; contractQuantity: bigint; taxMode: TaxMode; unitPriceState: UnitPriceState; valuationBasis: ValuationBasis }`
  - `function unvaluedReason(w: WorkItemValuation): UnvaluedReason | null`
  - `function cumulativeAllocation(w: WorkItemValuation, cumulativeQuantity: bigint): PoolAmounts`
  - `function sliceAllocation(w: WorkItemValuation, beforeQuantity: bigint, afterQuantity: bigint): PoolAmounts`

All quantities are scaled `bigint` at scale 6. Tasks 7 and 8 call `sliceAllocation` only.

- [ ] **Step 1: Write the failing tests**

Create `packages/domain/src/valuation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  unvaluedReason, cumulativeAllocation, sliceAllocation, type WorkItemValuation,
} from "./valuation";

const Q = (whole: number): bigint => BigInt(whole) * 1_000_000n; // scale 6

const exclusive: WorkItemValuation = {
  pool: { net: 10_000n, tax: 2_000n, gross: 12_000n },
  contractQuantity: Q(4), taxMode: "exclusive",
  unitPriceState: "known", valuationBasis: "unit_price_derived",
};

describe("unvaluedReason", () => {
  it("names unknown tax basis", () => {
    expect(unvaluedReason({ ...exclusive, taxMode: "unknown" })).toBe("unknown_tax_basis");
  });
  it("names a missing unit price on unit-price-derived items", () => {
    expect(unvaluedReason({ ...exclusive, unitPriceState: "missing" })).toBe("missing_unit_price");
  });
  it("treats a zero unit price as genuinely free, not unknown", () => {
    expect(unvaluedReason({ ...exclusive, unitPriceState: "zero" })).toBeNull();
  });
  it("ignores price state when the basis is an approved source amount", () => {
    expect(unvaluedReason({
      ...exclusive, unitPriceState: "missing", valuationBasis: "approved_source_amount",
    })).toBeNull();
  });
});

describe("cumulativeAllocation", () => {
  it("derives gross from net plus tax for exclusive scope", () => {
    expect(cumulativeAllocation(exclusive, Q(2))).toEqual({ net: 5_000n, tax: 1_000n, gross: 6_000n });
  });
  it("derives net from gross minus tax for inclusive scope", () => {
    const inclusive: WorkItemValuation = {
      ...exclusive, taxMode: "inclusive",
      pool: { net: 10_000n, tax: 2_000n, gross: 12_000n },
    };
    expect(cumulativeAllocation(inclusive, Q(2))).toEqual({ net: 5_000n, tax: 1_000n, gross: 6_000n });
  });
  it("zeroes tax for exempt scope", () => {
    const exempt: WorkItemValuation = {
      ...exclusive, taxMode: "exempt", pool: { net: 9_000n, tax: 0n, gross: 9_000n },
    };
    expect(cumulativeAllocation(exempt, Q(1))).toEqual({ net: 2_250n, tax: 0n, gross: 2_250n });
  });
  it("caps at the within-contract quantity so over-contract work allocates nothing extra", () => {
    expect(cumulativeAllocation(exclusive, Q(9))).toEqual({ net: 10_000n, tax: 2_000n, gross: 12_000n });
  });
  it("never double-rounds: two quantity-1 slices of a 1-cent quantity-2 pool total 1 cent", () => {
    const cheap: WorkItemValuation = {
      ...exclusive, contractQuantity: Q(2), pool: { net: 1n, tax: 0n, gross: 1n },
      taxMode: "exempt",
    };
    const a = sliceAllocation(cheap, Q(0), Q(1));
    const b = sliceAllocation(cheap, Q(1), Q(2));
    expect(a.gross + b.gross).toBe(1n);
  });
});

describe("sliceAllocation", () => {
  it("returns exactly what it gave when quantity is corrected downward", () => {
    const up = sliceAllocation(exclusive, Q(0), Q(3));
    const down = sliceAllocation(exclusive, Q(3), Q(1));
    const net = up.net + down.net;
    expect(net).toBe(cumulativeAllocation(exclusive, Q(1)).net);
  });

  it("reconciles pool = unperformed + sum(slices) on all three components", () => {
    // Deterministic pseudo-random walk; no new dependency, reproducible seed.
    let seed = 42;
    const next = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let trial = 0; trial < 200; trial++) {
      const item: WorkItemValuation = {
        ...exclusive,
        pool: { net: BigInt(Math.floor(next() * 1_000_00)), tax: 0n, gross: 0n },
        contractQuantity: BigInt(Math.floor(next() * 50) + 1) * 1_000_000n,
      };
      item.pool.tax = item.pool.net / 5n;
      item.pool.gross = item.pool.net + item.pool.tax;

      let performed = 0n;
      const sum = { net: 0n, tax: 0n, gross: 0n };
      for (let step = 0; step < 8; step++) {
        const delta = BigInt(Math.floor(next() * 10_000_000)) - 3_000_000n;
        const after = performed + delta < 0n ? 0n : performed + delta;
        const s = sliceAllocation(item, performed, after);
        sum.net += s.net; sum.tax += s.tax; sum.gross += s.gross;
        performed = after;
      }
      const cum = cumulativeAllocation(item, performed);
      expect(sum).toEqual(cum);
      expect(item.pool.net - sum.net + sum.net).toBe(item.pool.net);
      expect(sum.gross).toBe(sum.net + sum.tax);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aktflow/domain exec vitest run src/valuation.test.ts`
Expected: FAIL — `Cannot find module './valuation'`.

- [ ] **Step 3: Implement the module**

Create `packages/domain/src/valuation.ts`:

```typescript
import type { TaxMode } from "./money";

export type UnitPriceState = "known" | "zero" | "missing";
export type ValuationBasis = "unit_price_derived" | "approved_source_amount";
export type UnvaluedReason = "unknown_tax_basis" | "missing_unit_price";

export interface PoolAmounts { net: bigint; tax: bigint; gross: bigint }

export interface WorkItemValuation {
  pool: PoolAmounts;
  contractQuantity: bigint;   // scale 6
  taxMode: TaxMode;
  unitPriceState: UnitPriceState;
  valuationBasis: ValuationBasis;
}

/**
 * A work item whose money is unknown still carries a pool of 0, because M1's
 * publish writes `mp.net ?? "0"` (publish/route.ts:200) and the columns are NOT
 * NULL. The qualifying facts are therefore the only way to tell "unknown" from
 * "genuinely free", and INV-038 needs that distinction preserved at write time.
 */
export function unvaluedReason(w: WorkItemValuation): UnvaluedReason | null {
  if (w.taxMode === "unknown") return "unknown_tax_basis";
  if (w.valuationBasis === "unit_price_derived" && w.unitPriceState === "missing") {
    return "missing_unit_price";
  }
  return null;
}

/**
 * Money allocated to the first `cumulativeQuantity` of within-contract work.
 *
 * Telescopic rather than incremental: a slice is the difference of two
 * cumulative values, so `pool = unperformed + sum(slices)` reconciles exactly by
 * construction on every component, the result does not depend on append order,
 * and a negative correction returns precisely what it was given. Quantity beyond
 * the contract quantity allocates nothing further — the pool covers within-
 * contract scope only (docs/domain/value-at-risk.md), and over-contract exposure
 * is INV-039's problem in M6, not a second pool here.
 *
 * Components are never allocated independently. The pair that is allocated and
 * the one that is derived follow the tax mode, so `gross = net + tax` holds for
 * every slice and therefore for their sum.
 */
export function cumulativeAllocation(
  w: WorkItemValuation, cumulativeQuantity: bigint,
): PoolAmounts {
  if (unvaluedReason(w) !== null) {
    throw new Error("cumulativeAllocation: work item is unvalued; check unvaluedReason first");
  }
  const denom = w.contractQuantity;
  if (denom <= 0n) return { net: 0n, tax: 0n, gross: 0n };
  const q = cumulativeQuantity <= 0n ? 0n
    : cumulativeQuantity > denom ? denom : cumulativeQuantity;
  const share = (component: bigint): bigint => (component * q) / denom;

  switch (w.taxMode) {
    case "exclusive": {
      const net = share(w.pool.net);
      const tax = share(w.pool.tax);
      return { net, tax, gross: net + tax };
    }
    case "inclusive": {
      const gross = share(w.pool.gross);
      const tax = share(w.pool.tax);
      return { net: gross - tax, tax, gross };
    }
    case "exempt":
    case "out_of_scope": {
      const gross = share(w.pool.gross);
      return { net: gross, tax: 0n, gross };
    }
    default:
      throw new Error(`cumulativeAllocation: unsupported tax mode ${w.taxMode}`);
  }
}

export function sliceAllocation(
  w: WorkItemValuation, beforeQuantity: bigint, afterQuantity: bigint,
): PoolAmounts {
  const a = cumulativeAllocation(w, beforeQuantity);
  const b = cumulativeAllocation(w, afterQuantity);
  return { net: b.net - a.net, tax: b.tax - a.tax, gross: b.gross - a.gross };
}
```

- [ ] **Step 4: Export and run**

Add `export * from "./valuation";` to `packages/domain/src/index.ts`.

Run: `pnpm --filter @aktflow/domain exec vitest run src/valuation.test.ts`
Expected: PASS — all tests including the 200-trial reconciliation walk.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/valuation.ts packages/domain/src/valuation.test.ts packages/domain/src/index.ts
git commit -m "feat(m2): telescopic coupled valuation allocation with exact pool reconciliation"
```

---

### Task 5: requirement_templates.create and .publish

**Files:**
- Create: `packages/contracts/src/requirements.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/app/app/v1/workspaces/[workspaceId]/requirement-templates/route.ts`
- Create: `apps/app/app/v1/requirement-templates/[templateVersionId]/publish/route.ts`
- Test: `apps/app/tests/requirement-templates.int.test.ts`

**Interfaces:**
- Consumes: `requirement_templates.manage` from Task 1; `requirement_template_versions` from Task 2.
- Produces: `createRequirementTemplateRequest` / `CreateRequirementTemplateResponse { templateVersionId, versionNo, version }` and `PublishRequirementTemplateResponse { templateVersionId, templateHash, versionNo }`. Task 6 pins `templateVersionId`; Task 10 reads `allowed_media` for the upload gate.

- [ ] **Step 1: Write the failing integration test**

Create `apps/app/tests/requirement-templates.int.test.ts` following the header conventions of
`apps/app/tests/contracts.int.test.ts` (the `vi.mock("../src/lib/auth", ...)` block, the
`q()` admin helper, `jsonReq`). Cover:

```typescript
// creates a draft version 1 and returns its id
// rejects condition_expr, form_schema, timing, and the three policy objects
//   with VALIDATION_FAILED — they are M3 surface and must not silently vanish
// publish freezes the row: template_hash and published_at become non-null
// a second create for the same template_key yields version_no 2
// publishing twice is idempotent by Idempotency-Key and does not re-hash
// updating a published row directly via SQL raises 42501 (INV-015)
// a member without requirement_templates.manage gets SCOPE_DENIED
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aktflow/app exec vitest run tests/requirement-templates.int.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write the request contracts**

Create `packages/contracts/src/requirements.ts`:

```typescript
import { z } from "zod";

/**
 * M2-A freezes only what assignment pinning and the upload gate read. The M3
 * fields exist as columns but accept nothing here: rejecting them loudly beats
 * accepting and ignoring them, which would make a frozen template hash a lie.
 */
export const createRequirementTemplateRequest = z.object({
  templateKey: z.string().trim().min(1).max(200),
  evidenceType: z.enum(["photo", "document", "form"]),
  allowedMedia: z.object({
    mimeTypes: z.array(z.string().regex(/^[a-z]+\/[a-z0-9.+-]+$/)).min(1).max(20),
    maxByteSize: z.number().int().positive().max(50 * 1024 * 1024),
  }),
  multiplicity: z.object({
    min: z.number().int().min(0).default(1),
    max: z.number().int().positive().nullable().default(null),
  }).default({}),
  severity: z.enum(["blocking", "advisory"]).default("blocking"),
}).strict();
export type CreateRequirementTemplateRequest = z.infer<typeof createRequirementTemplateRequest>;

export interface CreateRequirementTemplateResponse {
  templateVersionId: string; versionNo: number; version: number;
}

export const publishRequirementTemplateRequest = z.object({}).strict();
export interface PublishRequirementTemplateResponse {
  templateVersionId: string; templateHash: string; versionNo: number;
}
```

`.strict()` is what turns an M3 field into a `VALIDATION_FAILED` instead of a silent drop.

Add `export * from "./requirements";` to `packages/contracts/src/index.ts`.

- [ ] **Step 4: Write the create route**

Create `apps/app/app/v1/workspaces/[workspaceId]/requirement-templates/route.ts`, modelled on
`apps/app/app/v1/projects/[projectId]/contracts/route.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership } from "../../../../../src/lib/authz";
import { requireWorkspaceCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  createRequirementTemplateRequest, type CreateRequirementTemplateResponse,
} from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@aktflow/database";

export const runtime = "nodejs";

export const POST = commandRoute(createRequirementTemplateRequest, async (a) => {
  const workspaceId = a.params.workspaceId;
  if (!workspaceId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Робочий простір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) =>
    withIdempotency<CreateRequirementTemplateResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "requirement_templates.create", key: a.idempotencyKey,
      requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      requireWorkspaceCapability(a.requestId, m.role, "requirement_templates.manage");

      const prev = await tx.query(
        `select coalesce(max(version_no), 0) as v from public.requirement_template_versions
          where workspace_id = $1 and template_key = $2`,
        [workspaceId, a.body.templateKey]);
      const versionNo = Number(prev.rows[0].v) + 1;

      const id = randomUUID();
      await tx.query(
        `insert into public.requirement_template_versions
           (id, workspace_id, template_key, version_no, status, evidence_type,
            allowed_media, multiplicity, severity, created_by_member_id)
         values ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9)`,
        [id, workspaceId, a.body.templateKey, versionNo, a.body.evidenceType,
         JSON.stringify(a.body.allowedMedia), JSON.stringify(a.body.multiplicity),
         a.body.severity, m.memberId]);

      await recordAudit(tx, ctx, {
        action: "requirement_template.drafted", object_type: "requirement_template_version",
        object_id: id, details: { templateKey: a.body.templateKey, versionNo },
      }, { organizationId: workspaceId });
      return { status: 201, body: { templateVersionId: id, versionNo, version: 1 } };
    }));
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
```

- [ ] **Step 5: Write the publish route**

Create `apps/app/app/v1/requirement-templates/[templateVersionId]/publish/route.ts`. It must:

1. resolve `workspace_id` from the row before opening the idempotency scope;
2. `requireWorkspaceCapability(..., "requirement_templates.manage")`;
3. reject a row already `published` with `409 VERSION_CONFLICT`;
4. compute the hash over exactly the frozen fields, in a fixed key order, so the same content
   always hashes the same way:

```typescript
const frozen = JSON.stringify({
  templateKey: row.template_key, versionNo: row.version_no,
  evidenceType: row.evidence_type, allowedMedia: row.allowed_media,
  multiplicity: row.multiplicity, severity: row.severity,
});
const templateHash = createHash("sha256").update(frozen).digest("hex");
```

5. `update ... set status = 'published', template_hash = $, published_at = now(), published_by_member_id = $`;
6. `recordAudit` + `enqueueOutbox` with topic `requirement_template.published`.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @aktflow/app exec vitest run tests/requirement-templates.int.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/requirements.ts packages/contracts/src/index.ts \
        "apps/app/app/v1/workspaces/[workspaceId]/requirement-templates" \
        "apps/app/app/v1/requirement-templates" \
        apps/app/tests/requirement-templates.int.test.ts
git commit -m "feat(m2): minimal requirement template create and immutable publish"
```

---

### Task 6: assignments.create and assignments.list

**Files:**
- Create: `packages/contracts/src/assignments.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/app/app/v1/contracts/[contractId]/assignments/route.ts`
- Create: `apps/app/app/v1/projects/[projectId]/assignments/route.ts`
- Modify: `apps/app/tests/helpers/fixtures.ts`
- Test: `apps/app/tests/assignments.int.test.ts`

**Interfaces:**
- Consumes: `assignments.manage` and `project.view` from Task 1; `work_assignments` from Task 2; `CreateRequirementTemplateResponse.templateVersionId` from Task 5.
- Produces: `createAssignmentRequest`, `CreateAssignmentResponse { assignmentId: string; version: number }`, `ListAssignmentsResponse { assignments: AssignmentSummary[] }` where `AssignmentSummary` carries `assignmentId, workItemId, workCode, description, unitCode, plannedQuantity, effectiveQuantity, status`. Tasks 7, 8, and 10 all take an `assignmentId` produced here. The fixtures helper gains `seedAssignmentFixture()` returning `{ ...BaselineFixture, contractVersionId, workItemId, assignmentId, templateVersionId }`, used by Tasks 7–15.

- [ ] **Step 1: Write the failing integration test**

Create `apps/app/tests/assignments.int.test.ts` covering:

```typescript
// creates an assignment against a published work item and returns version 1
// rejects a work item from another contract version with VALIDATION_FAILED
// rejects a location that belongs to a different project (composite FK path)
// rejects a draft (unpublished) requirement template version
// rejects a caller without assignments.manage with SCOPE_DENIED
// rejects a work item from another workspace as RESOURCE_NOT_FOUND, never 403
// list returns assignments for a project the caller can view, with the work
//   item's code, description and unit joined
// list denies a caller with no project grant
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aktflow/app exec vitest run tests/assignments.int.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write the contracts**

Create `packages/contracts/src/assignments.ts`:

```typescript
import { z } from "zod";

export const createAssignmentRequest = z.object({
  workItemId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  performerPartyId: z.string().uuid().optional(),
  assigneeMemberId: z.string().uuid().optional(),
  plannedQuantity: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  requirementTemplateVersionId: z.string().uuid().optional(),
}).strict();
export type CreateAssignmentRequest = z.infer<typeof createAssignmentRequest>;

export interface CreateAssignmentResponse { assignmentId: string; version: number }

export interface AssignmentSummary {
  assignmentId: string; workItemId: string; workCode: string | null;
  description: string; unitCode: string; plannedQuantity: string | null;
  effectiveQuantity: string; status: string;
}
export interface ListAssignmentsResponse { assignments: AssignmentSummary[] }
```

`plannedQuantity` crosses the wire as a decimal string, never a JS number — the same reason
M1 kept money in `bigint`.

- [ ] **Step 4: Write the create route**

Create `apps/app/app/v1/contracts/[contractId]/assignments/route.ts`. Resolve
`workspace_id, project_id` from `public.contracts` by `contractId`, then inside
`withIdempotency` (operationId `assignments.create`):

1. `requireActiveMembership`, then `requireProjectCapability(..., capability: "assignments.manage")`;
2. resolve the work item and its version, pinning the assignment to the contract's **current
   published** version:

```typescript
const wi = await tx.query(
  `select w.id, w.contract_version_id
     from public.work_items w
     join public.contract_versions v
       on v.workspace_id = w.workspace_id and v.id = w.contract_version_id
    where w.workspace_id = $1 and w.contract_id = $2 and w.id = $3`,
  [workspaceId, contractId, a.body.workItemId]);
if (wi.rows.length === 0) {
  throw new HttpProblem(422, problem("VALIDATION_FAILED",
    "Позицію робіт не знайдено в цьому договорі.", {
      requestId: a.requestId, retryable: false, userAction: "correct_fields",
      fieldErrors: [{ path: "workItemId", message: "unknown work item" }],
    }));
}
```

3. if `requirementTemplateVersionId` is supplied, require `status = 'published'`, else a
   `VALIDATION_FAILED` naming `requirementTemplateVersionId` — pinning a draft would let the
   frozen template change under an assignment;
4. insert, `recordAudit` (`assignment.created`), `enqueueOutbox` (`assignment.created`);
5. return `201 { assignmentId, version: 1 }`.

- [ ] **Step 5: Write the list route**

Create `apps/app/app/v1/projects/[projectId]/assignments/route.ts` with `queryRoute`. Require
`project.view`. Effective quantity comes from the entries, not from a cached column:

```sql
select a.id, a.work_item_id, w.work_code, w.description, w.unit_code,
       a.planned_quantity, a.status,
       coalesce((select sum(p.quantity) from public.progress_entries p
                  where p.workspace_id = a.workspace_id
                    and p.work_assignment_id = a.id), 0) as effective_quantity
  from public.work_assignments a
  join public.work_items w on w.workspace_id = a.workspace_id and w.id = a.work_item_id
 where a.workspace_id = $1 and a.project_id = $2
 order by a.created_at desc, a.id
```

Return decimals as strings via `numeric`'s native `pg` string mapping; do not `Number()` them.

- [ ] **Step 6: Extend the fixtures helper**

In `apps/app/tests/helpers/fixtures.ts`, add `seedAssignmentFixture()` that builds on the
existing `BaselineFixture`, drives an import through publish to get a `contractVersionId` and
one `workItemId`, self-grants `assignments.manage`, `progress.record`, `progress.adjust` and
`evidence.record`, publishes a requirement template, and creates one assignment. Return
`{ ...baseline, contractVersionId, workItemId, assignmentId, templateVersionId }`.

Tasks 7 through 15 all start from this one helper.

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @aktflow/app exec vitest run tests/assignments.int.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/contracts/src/assignments.ts packages/contracts/src/index.ts \
        "apps/app/app/v1/contracts" "apps/app/app/v1/projects/[projectId]/assignments" \
        apps/app/tests/assignments.int.test.ts apps/app/tests/helpers/fixtures.ts
git commit -m "feat(m2): work assignment creation with pinned templates and project listing"
```

---

### Task 7: progress.record with coupled valuation allocation

**Files:**
- Create: `packages/contracts/src/progress.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/app/src/lib/valuation-writer.ts`
- Create: `apps/app/app/v1/assignments/[assignmentId]/progress/route.ts`
- Test: `apps/app/tests/progress-record.int.test.ts`

**Interfaces:**
- Consumes: `sliceAllocation`, `unvaluedReason`, `WorkItemValuation` from Task 4; `app_private.open_allocation_head` from Task 3; `seedAssignmentFixture` from Task 6.
- Produces: `recordProgressRequest`, `RecordProgressResponse { progressEntryId: string; effectiveQuantity: string; allocation: { valued: boolean; netMinorUnits: string | null; taxMinorUnits: string | null; grossMinorUnits: string | null; unvaluedReason: string | null } }`, and `appendValuationAllocation(tx, args): Promise<void>` in `valuation-writer.ts`, reused verbatim by Task 8.

- [ ] **Step 1: Write the failing test**

Create `apps/app/tests/progress-record.int.test.ts`. **Parameterize over the fixture matrix** —
this is the direct answer to M1 shipping 340 green tests over one fixture shape:

```typescript
const MATRIX = [
  { taxMode: "exclusive",    unitPriceState: "known",   basis: "unit_price_derived",     valued: true  },
  { taxMode: "inclusive",    unitPriceState: "known",   basis: "unit_price_derived",     valued: true  },
  { taxMode: "exempt",       unitPriceState: "known",   basis: "unit_price_derived",     valued: true  },
  { taxMode: "out_of_scope", unitPriceState: "known",   basis: "unit_price_derived",     valued: true  },
  { taxMode: "unknown",      unitPriceState: "known",   basis: "unit_price_derived",     valued: false },
  { taxMode: "exclusive",    unitPriceState: "zero",    basis: "unit_price_derived",     valued: true  },
  { taxMode: "exclusive",    unitPriceState: "missing", basis: "unit_price_derived",     valued: false },
  { taxMode: "exclusive",    unitPriceState: "missing", basis: "approved_source_amount", valued: true  },
] as const;

for (const c of MATRIX) {
  it(`allocates correctly for ${c.taxMode}/${c.unitPriceState}/${c.basis}`, async () => {
    // seed a work item with exactly these facts, record progress, then assert
    // the allocation row is valued/unvalued as expected, that an unvalued row
    // has NULL components and a reason, and that a valued row has no reason.
  });
}
```

Plus:

```typescript
// records a root entry, opens its allocation head with effective = quantity
// rejects zero and negative quantity with VALIDATION_FAILED
// rejects a quantity whose scale exceeds the unit precision
// replays under the same Idempotency-Key: one entry, one allocation row
// a second record on the same work item allocates the incremental slice only,
//   and the two slices sum to cumulative(total)
// over-contract quantity allocates nothing beyond the pool
// a caller without progress.record gets SCOPE_DENIED
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aktflow/app exec vitest run tests/progress-record.int.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write the shared valuation writer**

Create `apps/app/src/lib/valuation-writer.ts`. Both progress commands append exactly one
allocation row, so the logic lives here once:

```typescript
import { randomUUID } from "node:crypto";
import type { Tx } from "@aktflow/database";
import {
  sliceAllocation, unvaluedReason, type WorkItemValuation,
} from "@aktflow/domain";

export interface ValuationWriterArgs {
  workspaceId: string; projectId: string; contractId: string; workItemId: string;
  progressEntryId: string; rootProgressEntryId: string | null;
  /** Cumulative performed quantity on the work item BEFORE this entry, scale 6. */
  beforeQuantity: bigint;
  /** The entry's signed quantity, scale 6. */
  deltaQuantity: bigint;
}

/** Scaled bigint (scale 6) from a `numeric(20,6)` value pg returns as a string. */
export function toScaled6(value: string): bigint {
  const [whole, frac = ""] = value.replace("-", "").split(".");
  const scaled = BigInt(whole + frac.padEnd(6, "0").slice(0, 6));
  return value.startsWith("-") ? -scaled : scaled;
}

export function fromScaled6(value: bigint): string {
  const neg = value < 0n;
  const abs = (neg ? -value : value).toString().padStart(7, "0");
  return `${neg ? "-" : ""}${abs.slice(0, -6)}.${abs.slice(-6)}`;
}

/**
 * Appends the one valuation allocation for a progress fact. The caller must
 * already hold the work_items row lock, because `beforeQuantity` is only stable
 * under it.
 */
export async function appendValuationAllocation(
  tx: Tx, args: ValuationWriterArgs,
): Promise<{ valued: boolean; net: bigint | null; tax: bigint | null; gross: bigint | null; reason: string | null }> {
  const wi = await tx.query(
    `select contract_quantity, tax_mode, unit_price_state, valuation_basis,
            net_amount_minor_units, tax_amount_minor_units, gross_amount_minor_units
       from public.work_items where workspace_id = $1 and id = $2`,
    [args.workspaceId, args.workItemId]);
  const r = wi.rows[0];

  const item: WorkItemValuation = {
    pool: {
      net: BigInt(r.net_amount_minor_units),
      tax: BigInt(r.tax_amount_minor_units),
      gross: BigInt(r.gross_amount_minor_units),
    },
    contractQuantity: toScaled6(r.contract_quantity),
    taxMode: r.tax_mode,
    unitPriceState: r.unit_price_state,
    valuationBasis: r.valuation_basis,
  };

  const reason = unvaluedReason(item);
  const slice = reason === null
    ? sliceAllocation(item, args.beforeQuantity, args.beforeQuantity + args.deltaQuantity)
    : null;

  await tx.query(
    `insert into public.valuation_allocations
       (id, workspace_id, project_id, contract_id, work_item_id, progress_entry_id,
        root_progress_entry_id, lineage_key, quantity,
        net_minor_units, tax_minor_units, gross_minor_units, unvalued_reason)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [randomUUID(), args.workspaceId, args.projectId, args.contractId, args.workItemId,
     args.progressEntryId, args.rootProgressEntryId,
     `progress:${args.progressEntryId}`, fromScaled6(args.deltaQuantity),
     slice ? slice.net.toString() : null,
     slice ? slice.tax.toString() : null,
     slice ? slice.gross.toString() : null,
     reason]);

  return {
    valued: reason === null,
    net: slice?.net ?? null, tax: slice?.tax ?? null, gross: slice?.gross ?? null,
    reason,
  };
}
```

- [ ] **Step 4: Write the contracts and the route**

Create `packages/contracts/src/progress.ts` with `recordProgressRequest`
(`quantity` as `z.string().regex(/^\d+(\.\d{1,6})?$/)`, optional `recordedAt`) and the two
response interfaces named in the Interfaces block. Export from the index.

Create `apps/app/app/v1/assignments/[assignmentId]/progress/route.ts`. Inside
`withIdempotency` with `idempotencyClass: "ledger_400d"` and operationId `progress.record`:

1. resolve the assignment (`workspace_id, project_id, contract_id, work_item_id`);
2. `requireProjectCapability(..., capability: "progress.record")`;
3. **lock the work item row before reading cumulative quantity** — this is the whole
   serialization story for money:

```typescript
await tx.query(
  `select 1 from public.work_items where workspace_id = $1 and id = $2 for update`,
  [workspaceId, workItemId]);
const before = await tx.query(
  `select coalesce(sum(quantity), 0)::text as q from public.progress_entries
    where workspace_id = $1 and work_item_id = $2`,
  [workspaceId, workItemId]);
```

4. validate the quantity's scale against `work_items.unit_precision`;
5. insert the root entry;
6. `await tx.query("select app_private.open_allocation_head($1,$2,$3)", [workspaceId, entryId, quantity])`;
7. `appendValuationAllocation(...)` with `beforeQuantity = toScaled6(before.rows[0].q)`;
8. `recordAudit` (`progress.recorded`), `enqueueOutbox` (`progress.recorded`);
9. return `201` with the response shape from the Interfaces block, money as decimal strings.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @aktflow/app exec vitest run tests/progress-record.int.test.ts`
Expected: PASS — all eight matrix rows plus the behavioural cases.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/progress.ts packages/contracts/src/index.ts \
        apps/app/src/lib/valuation-writer.ts \
        "apps/app/app/v1/assignments" apps/app/tests/progress-record.int.test.ts
git commit -m "feat(m2): progress recording with coupled valuation allocation under work-item lock"
```

---

### Task 8: progress.adjust with INV-023/024/025 enforcement

**Files:**
- Create: `apps/app/app/v1/progress-entries/[entryId]/adjustments/route.ts`
- Modify: `packages/contracts/src/progress.ts`
- Test: `apps/app/tests/progress-adjust.int.test.ts`

**Interfaces:**
- Consumes: `appendValuationAllocation`, `toScaled6`, `fromScaled6` from Task 7; `app_private.assert_reservation_invariant` from Task 3.
- Produces: `adjustProgressRequest` (`quantity` signed decimal string, `reasonCode` required) and `AdjustProgressResponse { adjustmentEntryId: string; effectiveRootQuantity: string; allocation: {...} }`.

- [ ] **Step 1: Write the failing test**

Create `apps/app/tests/progress-adjust.int.test.ts` covering:

```typescript
// appends a negative adjustment and returns money to the pool: the two
//   allocation rows sum to cumulative(remaining)
// appends a positive adjustment and allocates the incremental slice
// rejects an adjustment referencing another adjustment (INV-023) with a
//   catalog-coded 422, and asserts no row was written
// rejects an adjustment whose root belongs to a different assignment
// rejects zero quantity, and rejects a missing reasonCode
// rejects an adjustment driving effective quantity below zero (INV-024)
// rejects an adjustment crossing a seeded reserved_quantity (INV-025):
//   seed progress_allocation_heads.reserved_quantity directly with the admin
//   client, since no M2-A command reserves — claims are M4. Without seeding,
//   this branch is unreachable and would ship untested.
// replays under the same Idempotency-Key: one adjustment, one allocation
// effective quantity is independent of the order two adjustments are appended
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aktflow/app exec vitest run tests/progress-adjust.int.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write the route**

Create `apps/app/app/v1/progress-entries/[entryId]/adjustments/route.ts`. Inside
`withIdempotency` with `idempotencyClass: "ledger_400d"`, operationId `progress.adjust`:

1. resolve the root entry and require `entry_kind = 'root'` in the query itself — a route that
   fetches any entry and checks the kind afterwards is exactly the single-route enforcement M1's
   review rejected:

```typescript
const root = await tx.query(
  `select p.id, p.workspace_id, p.project_id, p.work_assignment_id, p.work_item_id,
          a.contract_id
     from public.progress_entries p
     join public.work_assignments a
       on a.workspace_id = p.workspace_id and a.id = p.work_assignment_id
    where p.workspace_id = $1 and p.id = $2 and p.entry_kind = 'root'`,
  [workspaceId, entryId]);
```

2. `requireProjectCapability(..., capability: "progress.adjust")`;
3. lock the work item row, then lock the allocation head:

```typescript
await tx.query(`select 1 from public.work_items
                 where workspace_id = $1 and id = $2 for update`, [workspaceId, workItemId]);
await tx.query(`select 1 from public.progress_allocation_heads
                 where workspace_id = $1 and root_progress_entry_id = $2 for update`,
               [workspaceId, entryId]);
```

4. compute the new effective root quantity and reject a negative result with
   `422 PROGRESS_NEGATIVE_EFFECTIVE`; reject crossing `reserved_quantity` with
   `409 PROGRESS_RESERVED_BLOCKED` naming the corrected-successor command as the M4 path;
5. insert the adjustment with `entry_kind = 'adjustment'`, `root_is_root = true`;
6. `select app_private.assert_reservation_invariant($1,$2)` — it re-derives effective quantity
   and advances the head, so the route's arithmetic and the database's never diverge silently;
7. `appendValuationAllocation` with `beforeQuantity` re-read under the work-item lock and
   `deltaQuantity` signed;
8. `recordAudit` (`progress.adjusted`), `enqueueOutbox`;
9. return `201`.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @aktflow/app exec vitest run tests/progress-adjust.int.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/app/app/v1/progress-entries" packages/contracts/src/progress.ts \
        apps/app/tests/progress-adjust.int.test.ts
git commit -m "feat(m2): append-only progress adjustment with reservation and lineage guards"
```

---

### Task 9: Private evidence buckets and the storage module

**Files:**
- Modify: `supabase/config.toml:105-116`
- Create: `supabase/migrations/0020_evidence_storage_buckets.sql` (0017-0019 were taken by the engineering-review corrections)
- Create: `apps/app/src/lib/evidence-storage.ts`
- Test: `apps/app/tests/evidence-storage.int.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `const STAGING_BUCKET = "evidence-staging"`, `const ORIGINALS_BUCKET = "evidence-originals"`
  - `function newStagingKey(): string` — opaque `${uuid}/${uuid}`, no business identifiers
  - `async function createSignedUpload(bucket: string, key: string): Promise<{ signedUrl: string; token: string }>`
  - `async function downloadObject(bucket: string, key: string): Promise<Uint8Array>`
  - `async function moveObject(from: {bucket:string;key:string}, to: {bucket:string;key:string}): Promise<void>`
  - `async function removeObject(bucket: string, key: string): Promise<void>`

Tasks 10, 11, and 13 use these exact names.

- [ ] **Step 1: Declare the buckets**

In `supabase/config.toml`, replace the commented `[storage.buckets.images]` block with:

```toml
[storage.buckets.evidence-staging]
public = false
file_size_limit = "50MiB"

[storage.buckets.evidence-originals]
public = false
file_size_limit = "50MiB"
```

Create `supabase/migrations/0020_evidence_storage_buckets.sql` so deployed environments get the
same two private buckets and no client-side access at all:

```sql
-- Private buckets only. Public access, anonymous listing and predictable
-- tenant paths are forbidden (docs/architecture/files-and-storage.md).
insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence-staging',   'evidence-staging',   false, 52428800),
       ('evidence-originals', 'evidence-originals', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- No policy is created for authenticated or anon on these buckets, so RLS on
-- storage.objects denies them by default. Every read and write goes through the
-- server with the service role.
```

- [ ] **Step 2: Write the failing storage test**

Create `apps/app/tests/evidence-storage.int.test.ts`:

```typescript
// newStagingKey returns an opaque two-uuid path and never repeats
// a signed upload accepts bytes, and downloadObject returns them byte-identical
// moveObject makes the source key unreadable and the destination readable
// removeObject makes the key unreadable
// an anon-key client cannot list or download from either bucket
```

The last assertion is the one that matters — it proves the bucket is genuinely private rather
than merely undocumented.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @aktflow/app exec vitest run tests/evidence-storage.int.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the module**

Create `apps/app/src/lib/evidence-storage.ts` wrapping `@supabase/supabase-js`'s storage client
built from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (read via the existing
`apps/app/src/lib/supabase-server.ts` conventions; add the service-role client there if it does
not already exist). Every function throws on the client's `error` rather than returning it, so
a route cannot accidentally treat a failed upload as success.

- [ ] **Step 5: Run and commit**

```bash
supabase db reset
pnpm --filter @aktflow/app exec vitest run tests/evidence-storage.int.test.ts
```

```bash
git add supabase/config.toml supabase/migrations/0020_evidence_storage_buckets.sql \
        apps/app/src/lib/evidence-storage.ts apps/app/tests/evidence-storage.int.test.ts
git commit -m "feat(m2): private evidence buckets and server-only storage module"
```

---

### Task 10: upload_intents.create

**Files:**
- Create: `packages/contracts/src/uploads.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/app/app/v1/assignments/[assignmentId]/upload-intents/route.ts`
- Test: `apps/app/tests/upload-intents-create.int.test.ts`

**Interfaces:**
- Consumes: `evidence.record` from Task 1; `upload_intents`/`capture_events` from Task 2; `newStagingKey`, `createSignedUpload`, `STAGING_BUCKET` from Task 9; the pinned template's `allowed_media` from Task 5.
- Produces: `createUploadIntentRequest`, `CreateUploadIntentResponse { uploadIntentId: string; status: string; upload: { bucket: string; key: string; signedUrl: string }; expiresAt: string }`. Tasks 11 and 12 take `uploadIntentId`.

- [ ] **Step 1: Write the failing test**

Create `apps/app/tests/upload-intents-create.int.test.ts` covering:

```typescript
// issues an intent with status intent_authorized and a signed upload URL
// writes one device-sourced capture_event in client_state 'not_sent'
// rejects a media type outside the pinned template's allowlist
// rejects an expected size above the template's maxByteSize
// rejects a malformed expectedContentHash (not 64 lowercase hex)
// replays under the same Idempotency-Key: one intent row, same staging key
// same Idempotency-Key with a different hash yields 409 IDEMPOTENCY_CONFLICT
// the staging key contains no workspace id, project id, or filename
// a caller without evidence.record gets SCOPE_DENIED
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aktflow/app exec vitest run tests/upload-intents-create.int.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write the contracts**

Create `packages/contracts/src/uploads.ts`:

```typescript
import { z } from "zod";

export const createUploadIntentRequest = z.object({
  expectedContentHash: z.string().regex(/^[0-9a-f]{64}$/),
  expectedByteSize: z.number().int().positive(),
  claimedMediaType: z.string().regex(/^[a-z]+\/[a-z0-9.+-]+$/),
  originalFilename: z.string().max(255).optional(),
  deviceCaptureId: z.string().min(1).max(200),
  originMethod: z.enum(["native_camera", "photo_picker", "file_picker", "form"]),
  claimedCaptureTime: z.string().datetime({ offset: true }).optional(),
  claimedTzOffset: z.string().regex(/^[+-]\d{2}:\d{2}$/).optional(),
  sourceAppVersion: z.string().max(50).optional(),
}).strict();
export type CreateUploadIntentRequest = z.infer<typeof createUploadIntentRequest>;

export interface CreateUploadIntentResponse {
  uploadIntentId: string; status: string;
  upload: { bucket: string; key: string; signedUrl: string };
  expiresAt: string;
}
```

- [ ] **Step 4: Write the route**

Create `apps/app/app/v1/assignments/[assignmentId]/upload-intents/route.ts`. Inside
`withIdempotency` (operationId `upload_intents.create`):

1. resolve the assignment and its `requirement_template_version_id`;
2. `requireProjectCapability(..., capability: "evidence.record")`;
3. if a template is pinned, load `allowed_media` and enforce both the MIME allowlist and
   `maxByteSize`, with `422 EVIDENCE_MEDIA_REJECTED` naming the exact limit — the failure table
   in the domain doc requires the user see the exact limit, not a generic rejection;
4. if no template is pinned, fall back to a module constant allowlist of
   `image/jpeg`, `image/png`, `image/heic`, `application/pdf` and 50 MiB;
5. `const key = newStagingKey()`, `const { signedUrl } = await createSignedUpload(STAGING_BUCKET, key)`;
6. insert the intent with `status = 'intent_authorized'`, `expires_at = now() + interval '24 hours'`,
   `staging_bucket`, `staging_storage_key`, `idempotency_key`, `request_hash`;
7. insert one `capture_events` row: `event_source = 'device'`, `client_state = 'not_sent'`,
   carrying `device_capture_id`, `claimed_capture_time`, `claimed_tz_offset`;
8. `recordAudit` (`upload_intent.authorized`);
9. return `201`.

Note there is no `enqueueOutbox` here: an authorized intent is not yet a domain event, and the
staged bytes are not evidence.

- [ ] **Step 5: Run and commit**

Run: `pnpm --filter @aktflow/app exec vitest run tests/upload-intents-create.int.test.ts`
Expected: PASS

```bash
git add packages/contracts/src/uploads.ts packages/contracts/src/index.ts \
        "apps/app/app/v1/assignments/[assignmentId]/upload-intents" \
        apps/app/tests/upload-intents-create.int.test.ts
git commit -m "feat(m2): authorized upload intents with template-driven media gate"
```

---

### Task 11: upload_intents.finalize

**Files:**
- Create: `apps/app/src/lib/evidence-inspection.ts`
- Create: `apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts`
- Modify: `packages/contracts/src/uploads.ts`
- Test: `apps/app/tests/upload-intents-finalize.int.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 9 and 10.
- Produces: `FinalizeUploadIntentResponse { uploadIntentId: string; status: string; evidenceObjectId: string | null; contentHash: string; serverReceivedAt: string; failureCode: string | null }`, and `inspectContent(bytes: Uint8Array, mediaType: string): Promise<{ outcome: "passed" | "not_required" | "blocked"; policyVersion: string }>` with a module-level setter `setInspector(fn)` used by tests to force a block.

- [ ] **Step 1: Write the failing test**

Create `apps/app/tests/upload-intents-finalize.int.test.ts` covering:

```typescript
// happy path: staged bytes verify, evidence_objects row is created, intent
//   becomes 'available' and links finalized_evidence_object_id
// the evidence row records server_received_at, claimed capture time and trust
//   as separate labeled facts
// replaying finalize returns the same receipt and creates no second row
// a byte-size mismatch leaves no evidence and names the failure
// a content-hash mismatch leaves no evidence and names the failure (INV-045:
//   the original is never silently accepted under the expected identity)
// an injected blocking inspector yields intent 'scan_blocked' and NO
//   evidence_objects row at all (INV-046)
// membership revoked between create and finalize yields 'orphaned_for_purge',
//   no evidence, and the staging object still present for the purge job
//   (INV-047)
// finalizing an intent belonging to another workspace is RESOURCE_NOT_FOUND
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aktflow/app exec vitest run tests/upload-intents-finalize.int.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write the inspection hook**

Create `apps/app/src/lib/evidence-inspection.ts`:

```typescript
export type InspectionOutcome = "passed" | "not_required" | "blocked";
export interface InspectionResult { outcome: InspectionOutcome; policyVersion: string }

export const DEFAULT_POLICY_VERSION = "m2a-allowlist-1";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/heic", "application/pdf"]);

/**
 * v0.1 ships no anti-malware engine. This is a policy stub with a recorded
 * policy version, and the scan_blocked branch of the state machine is real and
 * tested through an injected inspector. Saying so beats implying a scanner
 * exists.
 */
let inspector = async (_bytes: Uint8Array, mediaType: string): Promise<InspectionResult> => ({
  outcome: ALLOWED.has(mediaType) ? "passed" : "blocked",
  policyVersion: DEFAULT_POLICY_VERSION,
});

export function setInspector(fn: typeof inspector): void { inspector = fn; }
export function inspectContent(bytes: Uint8Array, mediaType: string): Promise<InspectionResult> {
  return inspector(bytes, mediaType);
}
```

- [ ] **Step 4: Write the finalize route**

Create `apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts`. Order is load-bearing —
integrity, then inspection, then the authorization recheck, then the atomic promotion:

1. resolve the intent; if `status = 'available'`, return the stored receipt immediately;
2. `downloadObject(STAGING_BUCKET, staging_storage_key)`; on a missing object return
   `409 UPLOAD_NOT_STAGED`;
3. verify `bytes.length === expected_byte_size` and
   `createHash("sha256").update(bytes).digest("hex") === expected_content_hash`. On mismatch,
   leave `status` at `'staged'`, set `failure_code = 'integrity_mismatch'`, and return
   `422 EVIDENCE_INTEGRITY_FAILED`. **Do not delete the staged object and do not advance the
   state**: the domain failure table requires the original be retained and the failure named,
   and the same intent must stay retryable. On success set `status = 'integrity_verified'`;
4. `inspectContent(bytes, claimed_media_type)`; on `blocked`, set `status = 'scan_blocked'`,
   `failure_code = 'scan_blocked'`, and return `422` with no evidence row;
5. **recheck authorization** — re-run `requireActiveMembership` and `requireProjectCapability`
   inside this transaction. On failure set `status = 'orphaned_for_purge'` and return `403`,
   leaving the staged object for Task 13's purge;
6. `moveObject` from staging to `ORIGINALS_BUCKET` under a fresh opaque key;
7. insert `evidence_objects` with `inspection_status` mapped from the outcome
   (`passed`/`not_required` only), `inspection_policy_version`, `server_received_at = now()`,
   `capture_time_trust = claimed_capture_time ? 'device_claimed' : 'unknown'`;
8. update the intent to `status = 'available'`, set `finalized_evidence_object_id`,
   `version = version + 1`;
9. insert a `capture_events` row with `event_source = 'server'`, `client_state = 'server_confirmed'`;
10. `recordAudit` (`evidence.available`), `enqueueOutbox` (`evidence.available`);
11. return `200`.

Steps 6–10 run in the one `withTenantTx` transaction. If the insert fails after `moveObject`,
the transaction rolls back and the object sits in originals unreferenced; Task 13's purge query
must therefore also sweep originals keys with no `evidence_objects` row.

- [ ] **Step 5: Run and commit**

Run: `pnpm --filter @aktflow/app exec vitest run tests/upload-intents-finalize.int.test.ts`
Expected: PASS

```bash
git add apps/app/src/lib/evidence-inspection.ts "apps/app/app/v1/upload-intents" \
        packages/contracts/src/uploads.ts apps/app/tests/upload-intents-finalize.int.test.ts
git commit -m "feat(m2): upload finalization with integrity, inspection and authorization recheck"
```

---

### Task 12: upload_intents.get

**Files:**
- Create: `apps/app/app/v1/upload-intents/[intentId]/route.ts`
- Modify: `packages/contracts/src/uploads.ts`
- Test: `apps/app/tests/upload-intents-get.int.test.ts`

**Interfaces:**
- Consumes: Task 11's intent states.
- Produces: `GetUploadIntentResponse { uploadIntentId: string; status: string; evidenceObjectId: string | null; contentHash: string | null; serverReceivedAt: string | null; failureCode: string | null; expiresAt: string }`.

- [ ] **Step 1: Write the failing test**

Create `apps/app/tests/upload-intents-get.int.test.ts`:

```typescript
// re-fetches an available receipt by intent identity, so a client that lost
//   its local write does not re-upload (the last row of the domain doc's
//   failure table)
// reports scan_blocked and orphaned_for_purge without leaking a storage key
// returns RESOURCE_NOT_FOUND for another workspace's intent
// requires evidence.record on the intent's project
```

- [ ] **Step 2: Run, implement with `queryRoute`, run again**

Run: `pnpm --filter @aktflow/app exec vitest run tests/upload-intents-get.int.test.ts`
Expected: FAIL, then PASS after the route exists.

The response must never include `staging_storage_key` or the originals key — a storage key in a
response is a capability leak, and `files-and-storage.md` forbids permanent download URLs.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/app/v1/upload-intents/[intentId]/route.ts" \
        packages/contracts/src/uploads.ts apps/app/tests/upload-intents-get.int.test.ts
git commit -m "feat(m2): upload intent receipt query"
```

---

### Task 13: Orphan purge within 24 hours (INV-047)

**Files:**
- Create: `supabase/migrations/0021_upload_purge.sql`
- Create: `apps/app/src/lib/evidence-purge.ts`
- Test: `apps/app/tests/evidence-purge.int.test.ts`

**Interfaces:**
- Consumes: `removeObject` from Task 9; `upload_intents` from Task 2; the outbox helpers from `@aktflow/database`.
- Produces: `public.purge_orphaned_upload_intents() returns integer` and
  `async function drainStagingPurge(limit?: number): Promise<number>` in `evidence-purge.ts`.

- [ ] **Step 1: Write the failing test**

Create `apps/app/tests/evidence-purge.int.test.ts`:

```typescript
// an intent past expires_at in intent_authorized is marked 'expired' and
//   emits one evidence.staging_purge_requested outbox event
// an orphaned_for_purge intent emits the same event
// an 'available' intent is never purged
// drainStagingPurge deletes the staging object and is idempotent: a second
//   run over the same event deletes nothing and does not throw
// a delete failure leaves the outbox event for retry rather than marking it
//   done, so the existing dead-letter path can alert
```

- [ ] **Step 2: Write the SQL side**

Create `supabase/migrations/0021_upload_purge.sql` with a `security definer` function that
selects expired or orphaned intents, updates their status, and inserts one
`public.transaction_outbox` row per intent with topic `evidence.staging_purge_requested` and a
payload of `{ workspaceId, uploadIntentId, bucket, key }`. Schedule it with the **guarded**
`pg_cron` pattern copied from `0005_outbox_drain_cron.sql:79-93` — the extension may be absent
locally and the migration must not fail when it is:

```sql
do $$
declare has_pg_cron boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_pg_cron;
  if has_pg_cron then
    if exists (select 1 from cron.job where jobname = 'upload-orphan-purge') then
      perform cron.unschedule('upload-orphan-purge');
    end if;
    perform cron.schedule('upload-orphan-purge', '15 minutes',
      $c$select public.purge_orphaned_upload_intents()$c$);
  else
    raise notice 'pg_cron unavailable: upload-orphan-purge not scheduled (verify on staging)';
  end if;
end $$;
```

- [ ] **Step 3: Write the worker and run**

Create `apps/app/src/lib/evidence-purge.ts` with `drainStagingPurge` that claims
`evidence.staging_purge_requested` events using the existing claim/retry helpers, calls
`removeObject`, and only marks an event done after the delete returns. Also sweep
`evidence-originals` keys with no `evidence_objects` row, per the rollback window noted in
Task 11.

Run: `pnpm --filter @aktflow/app exec vitest run tests/evidence-purge.int.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0021_upload_purge.sql apps/app/src/lib/evidence-purge.ts \
        apps/app/tests/evidence-purge.int.test.ts
git commit -m "feat(m2): idempotent orphan staging purge with outbox-driven deletion"
```

---

### Task 14: Concurrency harness

**Files:**
- Create: `packages/testing/src/concurrency.ts`
- Create: `apps/app/tests/concurrency.int.test.ts`

**Interfaces:**
- Consumes: routes from Tasks 7, 8, 11.
- Produces: `async function inParallel<T>(n: number, fn: (i: number) => Promise<T>): Promise<PromiseSettledResult<T>[]>` — each invocation gets its own connection, so contention is real.

M1 shipped with no parallel-command test anywhere; publish serialization, the idempotency
advisory lock, and unit auto-registration were reasoned about but never demonstrated. This task
turns three arguments into tests, closing a deferred `TODOS.md` finding.

- [ ] **Step 1: Write the harness**

Create `packages/testing/src/concurrency.ts`:

```typescript
export async function inParallel<T>(
  n: number, fn: (i: number) => Promise<T>,
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(Array.from({ length: n }, (_, i) => fn(i)));
}
```

Parallelism is created **inside** a test with its own connections. Never relax
`turbo run test --concurrency=1`; that flag exists because the suite shares one database.

- [ ] **Step 2: Write the failing concurrency tests**

Create `apps/app/tests/concurrency.int.test.ts`:

```typescript
// two progress.adjust on one root in parallel: both settle, the head's
//   effective quantity equals the sum of all entries, and no state is negative
// two progress.record with the SAME Idempotency-Key: exactly one entry and
//   exactly one valuation_allocations row
// two finalize calls on one intent: exactly one evidence_objects row and two
//   identical receipts
// carry-over from M1: two import_batches.publish on one batch produce exactly
//   one contract version
```

- [ ] **Step 3: Run, fix any serialization gap it exposes, commit**

Run: `pnpm --filter @aktflow/app exec vitest run tests/concurrency.int.test.ts`
Expected: PASS. If a test fails, the defect is in the lock ordering of Task 7 or 8, not in the
test — fix the route, not the assertion.

```bash
git add packages/testing/src/concurrency.ts apps/app/tests/concurrency.int.test.ts
git commit -m "test(m2): concurrency harness for allocation heads, idempotency and publish"
```

---

### Task 15: Vertical scenario and milestone gate evidence

**Files:**
- Create: `apps/app/tests/vertical-m2a.int.test.ts`
- Modify: `TODOS.md`
- Modify: `technical/database/invariant-catalog.csv`
- Modify: `apps/app/app/v1/import-batches/[batchId]/publish/route.ts`
- Create: `docs/superpowers/plans/evidence/2026-07-31-m2a-gate.md`

**Interfaces:**
- Consumes: every prior task.
- Produces: the milestone gate record.

- [ ] **Step 1: Fix the deferred publish idempotency class**

In `apps/app/app/v1/import-batches/[batchId]/publish/route.ts`, add
`idempotencyClass: "ledger_400d"` to the `withIdempotency` args. Publishing a contract version
is the ledger event of M1; the class was the one-line omission recorded in `TODOS.md`.

- [ ] **Step 2: Write the vertical scenario**

Create `apps/app/tests/vertical-m2a.int.test.ts` as one ordered `describe` running the whole
slice through the public API:

```typescript
// 1. publish a requirement template
// 2. create an assignment pinning it
// 3. record progress; assert the exposure slice and pool reconciliation
// 4. create an upload intent, stage bytes, finalize
// 5. assert the available receipt and the immutable evidence identity
// 6. replay finalize; assert the identical receipt and no second row
// 7. append a negative adjustment; assert money returns to the pool and
//    pool = unperformed + sum(slices) still holds on all three components
// 8. on a second intent, revoke the member's project grant between create and
//    finalize; assert orphaned_for_purge with no evidence object
// 9. run the purge; assert the staging object is gone
```

- [ ] **Step 3: Run the full gate**

```bash
pnpm turbo run test --concurrency=1
```

```bash
pnpm typecheck && pnpm build && pnpm db:catalog-snapshot
```

Record the actual counts and the snapshot id. If anything fails, fix it before proceeding —
a gate record that reports a green suite it did not observe is worse than no record.

- [ ] **Step 4: Update the deferred-work register**

In `TODOS.md`, remove the two findings this slice closed (publish idempotency class; no
concurrency tests) and add a note under the `project_parties` finding that the catalog
annotation landed in Task 1. Leave the invitation-email, membership-reactivation, and
responsibility-ending findings untouched — each needs a product decision M2-A does not force.

In `technical/database/invariant-catalog.csv`, replace the `test_evidence` text for INV-023,
INV-024, INV-025, INV-045, INV-046 and INV-047 with the actual test file paths written above.

- [ ] **Step 5: Write the gate record**

Create `docs/superpowers/plans/evidence/2026-07-31-m2a-gate.md` recording: the migration range
applied (0015–0018), the serialized test count, typecheck and build results, the catalog
snapshot id, and — explicitly — that the roadmap M2 exit gate remains **open** pending M2-B,
naming EAS builds, TestFlight and Play internal distribution, and the physical device matrix as
what is outstanding. Do not describe M2 as closed.

- [ ] **Step 6: Commit**

```bash
git add apps/app/tests/vertical-m2a.int.test.ts TODOS.md \
        technical/database/invariant-catalog.csv \
        "apps/app/app/v1/import-batches/[batchId]/publish/route.ts" \
        docs/superpowers/plans/evidence/2026-07-31-m2a-gate.md
git commit -m "test(m2): vertical assignment-progress-evidence scenario and gate evidence"
```

---

## After the plan

Run `/plan-eng-review` on this slice. Triage its findings, fix every P1 and P2 on the branch
before calling M2-A done, and record the verdict in a `## GSTACK REVIEW REPORT` section at the
end of this file — the same shape M1's plan used.

## NOT in scope

- `apps/mobile` and every mobile-local concern (INV-013/014/053) — split into M2-B because its
  exit gates need developer accounts and physical hardware.
- A real anti-malware engine — the inspection hook is a policy stub with a recorded policy
  version. Codex disputes that this is honest enough; see D7.
- Derivatives and thumbnails, offline authorization, background sync, resumable chunks (v0.3).
- M3 requirement surface beyond the two pulled-forward template operations.
- M4 packages, claim segments, the progress-claim ledger, the corrected-successor command.
- Reservation writers — M2-A implements the guard and the assertion, nothing reserves.
- Deferred M1 findings that stay deferred: invitation email binding, membership reactivation,
  ending responsibility assignments. Each needs a product decision this slice does not force.

## What already exists

| Existing | Reused? |
|---|---|
| `commandRoute`/`queryRoute`, `withTenantTx`, `withIdempotency`, `recordAudit`, `enqueueOutbox` | Yes — every M2 route is built on them |
| `packages/domain/src/money.ts` BigInt engine | Yes — `valuation.ts` extends it rather than duplicating |
| `app.has_project_capability`, `app.reject_mutation`, `app.member_role`, `app.active_member_id` | Yes — 0016 reuses all four |
| M1 multipart staging into `bytea` (`import-batches/[batchId]/files`) | **No, deliberately** — evidence goes to private object storage |
| `drain_outbox` / `claim_outbox` / dead-letter (0005, 0008) | Planned for purge alerting — **but see D4: `drain_outbox` marks every topic processed without dispatching, so the purge design does not work as written** |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | 5 P0, 4 P1 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open | 11 issues, 1 critical gap |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not applicable (no UI in M2-A) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**Scope reviewed:** the implemented foundation (`main..HEAD`, migrations 0015–0018,
`packages/domain/src/valuation.ts`, the four `packages/testing/src/m2-*` suites) plus the plan
governing Tasks 5–15. Complexity check tripped (8 tables, 9 operations, 4 modules); scope
accepted as-is, since it is an approved milestone already reduced once by the M2-A/M2-B split.

**Fixed on the branch during this review**

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | P1 | Both `SECURITY DEFINER` allocation-head functions took `p_workspace` from the caller and never resolved the actor. Demonstrated: a member of workspace B planted a head row in workspace A with `effective_quantity` 999999, and the cross-tenant call leaked A's balances through its raise messages. | `0017`, `m2-definer-authz.test.ts` |
| A3 | P2 | `capture_events.project_id` was nullable and the insert policy only demanded `evidence.record` when it was present, so `project.view` alone could append permanent forged provenance bound to an unseen intent. | `0018`, `m2-policy-gaps.test.ts` |
| T1 | P2 | The M2 suites opened with a global `truncate public.organizations cascade`, breaking five `foundation.test.ts` assertions — persistently, across runs. | scoped cleanup in `m2-fixture.ts` |

**Open — Codex (outside voice), verified against the code**

| ID | Sev | Finding |
|---|---|---|
| D1 | P0 | **Valuation lineage is wrong.** `sliceAllocation` keys off total work-item quantity, not the corrected root, so a correction can carry money away from a root that never received it (root A ends at −1 while root B keeps +1). Aggregate reconciliation still passes, which is exactly why the suite missed it — and the "order independence" test is a telescoping tautology that cannot fail. M4 package lines sum per-slice amounts, so per-slice figures must be individually meaningful. |
| D2 | P0 | `grant update on public.upload_intents` is column-wide, so `evidence.record` can rewrite expected hashes, staging keys, actor, assignment, status, and the evidence pointer. Conversely the `ui_update` policy requires that same capability, so after revocation the planned finalize path **cannot** set `orphaned_for_purge` — INV-047's revocation branch is unreachable as designed. |
| D3 | P0 | Storage promotion is not atomic and cannot be. The planned sweep of unreferenced originals can delete an object moved by a still-uncommitted successful finalize. Needs one immutable key with visibility controlled in PostgreSQL, or an explicit promotion journal. |
| D4 | P0 | The purge design does not work: `drain_outbox` sets `processed_at = now()` on every claimed row with no topic filter and no dispatch (verified in the live catalog), so the 30-second cron would mark purge requests done while the bytes survive. |
| D5 | P0 | INV-023 is only half structural. The FK is `(workspace_id, root_progress_entry_id, root_is_root)` — it forbids a chain but permits a root from another assignment or work item, which the invariant text and the plan's own §7.3 both require. The commit message claiming the invariant is enforced by a foreign key overstated it. |
| D6 | P1 | `unique (workspace_id, storage_key)` lets two workspaces reference the same physical object key. Uniqueness must be global per bucket. |
| D7 | P1 | The inspection stub re-checks the client-claimed MIME string and then records `inspection_status = 'passed'`. No magic-byte sniffing, no quota, no scanner-failure handling — false provenance rather than a safe stub. |
| D8 | P1 | Task 10 stores a signed URL inside a 30-day idempotency response; nothing transitions an intent to `staged`; integrity failure claims retryability with no new-attempt path. |
| D9 | P1 | Sequencing: Tasks 5–8 must not start until D1/D2/D5 are settled. The security fixes already occupy `0017`/`0018`, so Task 9's buckets become `0019` and purge `0020`. Task 14 omits the work-item-lock test (parallel `progress.record` under *different* idempotency keys). |
| D10 | P1 | Task 5 versions templates with `max(version_no)+1` without serialization; Task 6 claims to pin the current published version but its query accepts a work item from any version of that contract. |

**Open — this review, not yet fixed**

| ID | Sev | Finding |
|---|---|---|
| A4 | P3 | `va_insert` accepts either progress capability, so `progress.record` alone can write an adjustment's allocation. |
| C1 | P2 | `m2-schema.test.ts` still duplicates ~60 lines of world-building that `m2-fixture.ts` now provides. |
| C2 | P3 | No ASCII diagrams in the new code. Three earn one: the `progress_entries` lineage discriminator, the `upload_intents` state machine, the telescopic allocation. |
| P1 | P3 | `pah_select` runs a correlated subquery into an RLS-protected table per row. |
| P2 | P3 | `progress.record` sums all entries for the work item on every insert — O(n) per write under the lock. |

**Test coverage**

```
IMPLEMENTED (tasks 1-4)                          GAPS
[+] 0015 DDL            ★★★ 11 tests             [GAP] adjustment across assignment/work item (D5)
[+] 0016 RLS/triggers   ★★★ 18 tests             [GAP] out_of_scope absent from the property walk
[+] 0017 definer authz  ★★★  2 tests             [GAP] valuation per-root lineage (D1) — no test exists
[+] 0018 provenance     ★★★  4 tests                   because the aggregate assertion hides it
[+] valuation engine    ★★★ 17 tests (mutation-checked)
COVERAGE: 80/80 green, 13 files  |  QUALITY: ★★★ across the implemented surface
```

**CODEX:** ran (`codex exec`, high reasoning). Five P0 and four P1, all against code and plan
sections this review had already passed. Two were verified directly against the live database
(`drain_outbox` dispatch, the INV-023 FK definition) before being recorded.

**CROSS-MODEL:** the reviews agree on direction and disagree on one substantive point. This
review recommended the telescopic allocation and defended it in the spec; Codex argues the
approach cannot satisfy both aggregate reconciliation and lineage-correct corrections, and
proposes storing quantity plus exact rational entitlement in M2, allocating minor units only
in M4 when the sibling set exists. Working the counter-example by hand confirms Codex is right
on the facts. The remaining judgement is which repair to choose (D1), and that is the user's
call, not this review's.

**VERDICT:** ENG REVIEW NOT CLEAR — three P1/P2 findings fixed and re-proved on the branch,
but ten remain open, one of them a critical gap in the money layer. Tasks 5–15 should not
start until D1, D2, D4, and D5 are decided.

**Post-review resolution (same branch, decided and implemented).**

| ID | Decision | Landed |
|---|---|---|
| D1 | Per-root lineage, implementing what value-at-risk.md prescribed: positive quantity carves from the current unperformed pool, negative quantity re-proportions within its own root. Codex's rational-entitlement deferral was rejected because the domain doc requires package lines to SUM already-allocated amounts, so deferring would change an approved document. | `valuation.ts` rewritten; ledger property test with per-root assertions; counter-example as a regression test; mutation-checked |
| D2 | Column-scoped UPDATE grant on `upload_intents`; the orphan transition moves to `app.orphan_upload_intent`, which authorizes on intent ownership rather than the capability revocation just removed. | `0019` |
| D5 | Foreign key widened to `(workspace_id, work_assignment_id, work_item_id, root_progress_entry_id, root_is_root)`, with a behavioural test asserting 23503 on a cross-assignment adjustment. | `0019` |
| D6 | `unique (storage_bucket, storage_key)` and `unique (staging_bucket, staging_storage_key)`. | `0019` |
| D9 | Task 9's bucket renumbered to `0020`, Task 13's purge to `0021`. | plan text above |
| D3 | One private bucket with an immutable key issued at intent time; the promotion step is deleted, not journalled. A second bucket would not carry retention either, since "delete if no evidence row after 24 hours" is a domain-state rule bucket lifecycle cannot express. | `0020`, `evidence-storage.ts` |

| D4 | Purge gets its own queue and worker, not the outbox: `drain_outbox` marks every claimed row processed with no dispatch, and purge needs its own retry budget and failure queue anyway. | `0021`, `evidence-purge.ts` |
| D7 | Inspection sniffs magic bytes and requires them to agree with the authorized type. Recording `passed` after re-reading the client's own MIME string was false provenance. | `evidence-inspection.ts` |
| D8 | The idempotency record holds the intent identity and key only; the upload grant is minted per call, replays included. | `upload-intents/route.ts` |
| D10 | Template versioning takes an advisory lock; assignment creation requires the work item's version to be the contract's current published one. | Tasks 5 and 6 |
| Codex sequencing | Task 14 gained the work-item-lock test the plan omitted: parallel `progress.record` under DIFFERENT idempotency keys. | `concurrency.int.test.ts` |

**Pre-landing review (`/review`), same branch.** Three findings from this pass
and thirteen from its outside voice; eleven of the thirteen are fixed here.
Migrations `0022`–`0027` carry them: funded quantity for over-contract
corrections, evidence and pin binding, purge attempt accounting, allocation
binding, the storage quota, and blocked-content retention. Full account in the
gate record.

**UNRESOLVED DECISIONS:**
- Codex 11 — nothing invokes the purge worker. An operations step, named in the gate record rather than claimed as done.
- Codex 13 — `inspection_status = 'passed'` means the magic bytes matched the declared type, not that the content is safe. Deliberate for v0.1 and stated in the spec.
- Valuation funding is first-come and is not redistributed when a root withdraws. A named test in `valuation.test.ts` and a P1 in `TODOS.md`; closing it is a lineage decision, not a patch.
- `capture_events.event_source` is unenforceable without a service principal. P2 in `TODOS.md`.
- The evidence quota and blocked-content retention figures await the approved retention schedule. P3 in `TODOS.md`.
- A4, C1, C2, P1/P2 (performance) — the lower-severity items above, unchanged.
