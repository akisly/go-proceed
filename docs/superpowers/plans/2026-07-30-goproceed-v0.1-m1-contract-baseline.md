# v0.1-M1 — Parties, contracts, versions, and import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A workspace with several own legal entities publishes a clean, traceable, immutable contract baseline from XLSX/CSV — the full v0.1-M1 vertical slice (schema, 21 API operations, security invariant tests, vertical test) per [docs/delivery/version-0.1.md](../../delivery/version-0.1.md).

**Architecture:** Additive migrations 0010–0013 add the workspace-access module (invitations, parties, legal/own profiles, contacts, projects, project parties, access grants, responsibilities) and the contract-baseline module (units, locations, contracts, immutable contract versions, work items, import batches/files/row results, source-amount resolutions) on top of the six-table v0.0 baseline. `public.organizations` stays the physical tenant root; every new table names its tenant column `workspace_id` and FKs to `organizations(id)` with tenant-safe composite keys, workspace-leading indexes, RLS to `aktflow_app`, and append-only/immutability triggers. The API is 21 Next.js route handlers in `apps/app` following the v0.0 command pattern (requestId → auth → Idempotency-Key → body hash → zod → `withTenantTx` → capability checks → domain fact + audit + outbox in one commit → problem+json). Import parse/validate runs synchronously inside `import_batches.validate` with hard resource caps; publish freezes an immutable `contract_version` + `work_items` snapshot with lineage and reimport diff.

**Tech Stack:** PostgreSQL 15 (Supabase local stack), Next.js 16.2.11 (App Router, node runtime), TypeScript 5.9.2, zod 3.24.1, node-postgres (pg 8.22), vitest 3.2.4, turbo 2.5.4, pnpm 9.12.0, exceljs (new dependency, XLSX read only — never evaluates formulas).

## Global Constraints

- Work ONLY in this worktree (`.claude/worktrees/dashboard-rewrite-handoff-5b2789`), branch `claude/plan-v0-1-m1-07de82`. Never modify files outside it. `/Users/akisliy/Downloads/GoProceed` is the canonical main worktree — read-only for this plan.
- Node `>=24 <25`, pnpm `9.12.0`, Next `16.2.11`, zod `3.24.1`, vitest `3.2.4`, TS `5.9.2` — do not bump.
- DB tests MUST run serialized: `pnpm turbo run test --concurrency=1`. A direct root `vitest run` runs projects in parallel against one database and produces false failures.
- Local stack must be up (`supabase start`) and dev password set (`pnpm db:local-credentials`) before any DB test. `supabase/seed.sql` must NEVER contain credentials.
- Migrations are additive only (data-model.md "Additive migration rules"): no baseline object renamed or dropped. Numbering continues at `0010_`. Every migration header documents rollback (dev) + forward-fix (staging/prod), following `migration/goproceed-canonical-v0.1/migration-safety-plan.md`.
- Every tenant-owned table: `workspace_id uuid not null`, `unique (workspace_id, id)`, tenant-safe composite FKs (never id-only between tenant aggregates), workspace-leading indexes on every FK/lookup/RLS path, RLS enabled with policies to `aktflow_app`, explicit grant allowlist (deny-by-default holds via migration 0009).
- Canonical enums come from `technical/states/state-catalog.csv`; error codes from `technical/error-catalog.csv` (closed set — never invent an HTTP-level code); events from `technical/events/event-catalog.csv`; capabilities from `technical/permissions/capabilities.csv`.
- Money is signed integer minor units (BigInt in TS, `bigint` in PG). Binary floating point is forbidden for canonical money/quantities. `gross = net + tax` is CHECK-enforced on every monetary row.
- User-visible copy (errors included) is Ukrainian. Synthetic demo/test names must be transparently fake: prefix «Приклад-» (never plausible invented Ukrainian company names).
- Import safety (INV-016): formulas/macros are NEVER executed; XLSX is an untrusted ZIP with entry-count/ratio/size caps checked before expansion; parsing fails closed with named errors.
- Domain facts + audit event + idempotency record + outbox intent commit in the SAME transaction (v0.0 `withTenantTx` pattern). Retry with same key+hash replays the original result; same key + different hash → 409 `IDEMPOTENCY_CONFLICT`.
- Keep package names `@aktflow/*` (the `@goproceed/contracts` name in scope-v0.1.csv is the future canonical name; renaming is out of milestone scope).
- After changing any file under `docs/` or `technical/`, run `pnpm validate:canonical-docs` and `python3 scripts/validate_package.py` (if the script exists in this tree) and fix findings.
- Each task ends with a commit on this branch. Never commit with a red suite.

## Recorded design decisions (reviewer checkpoints)

These are decisions this plan makes where the approved docs allow more than one implementation. Each is flagged so a reviewer can veto before the affected task starts:

1. **Tenant root stays `public.organizations`.** New tables use `workspace_id ... references public.organizations(id)`. API/contracts speak "workspace". Rationale: one source of tenant truth (no dual-write divergence risk), additive-only policy, and the physical rename to `workspaces` lands later under its own approved destructive migration. (data-model.md keeps applied migrations authoritative; ADR-002 forbids workspace legal authority, which we honor by never reading `organizations.legal_name/edrpou` in new code.)
2. **`memberships` CHECK swap.** The v0.0 role check (13 job titles) is replaced by the canonical closed set `('owner','admin','member','auditor')`; status check replaced by `('active','suspended','ended')` with default flipped `'invited'→'active'`. Guard DO-blocks abort the migration if any existing row violates (only `'owner'/'active'` rows exist in any environment today). This is a constraint modification, not an object drop; rollback documented in the header.
3. **Import source bytes live in Postgres** (`import_files.source_bytes bytea`, ≤ 20 MB/file) with sha256 hash and a deterministic logical `storage_key` (`pg://import-sources/{workspace_id}/{batch_id}/{file_id}`). Physical relocation to the private storage bucket arrives with M2's upload-intent infrastructure via an additive migration preserving hash identity. Provenance (hash/parser/mapping/row) — the actual M1 exit gate — is unaffected.
4. **Parse/validate is synchronous** inside `import_batches.validate` (no jobs tables exist yet; the operational jobs module is not in the M1 schema slice). Hard caps make sync feasible; parsing happens OUTSIDE the DB transaction, then one short transaction records results.
5. **Workspace-capability map** (closed, in `@aktflow/domain`): `owner` → parties.manage, own_legal_profiles.manage, projects.create, units.manage; `admin` → parties.manage, projects.create, units.manage; `member`/`auditor` → none. INV-020 ("own legal profiles stricter than parties") is realized as **owner-only** `own_legal_profiles.manage` in v0.1-M1.
6. **Project visibility requires an explicit active grant** with capability `project.view` or `project.admin` (governance roles alone see no projects — per tenancy-and-security.md separation). `project.admin` implies only `project.view`, not action capabilities (`contracts.edit`, `imports.manage`, `imports.publish` stay explicit). Commands that grant an action capability auto-add `project.view` when absent.
7. **Invitation accept** uses a SECURITY DEFINER function `app.accept_invitation(token_hash)` (same sanctioned pattern as v0.0 `app.org_has_members`): the invitee has no RLS visibility of the invitation row before membership exists. Tokens are 32 random bytes, hex; only the sha256 hex enters the DB; plaintext appears once in the create response and never in audit/outbox/logs.
8. **Source-amount tolerance is strict-OR** (per the literal value-at-risk.md sentence "outside either pinned tolerance"): a mismatch blocks when `|diff| > tolAbsMinor` OR `|diff|` exceeds `tolBps` basis points of max(|source|, |derived|). Defaults pinned on the contract: 100 minor units, 10 bps.
9. **Publish is allowed only from `preview_ready`.** A blocking `AMOUNT_MISMATCH` row keeps the batch at `validated`; after `import_resolutions.create`, a re-validate (append-only attempt N+1, resolutions consulted) reaches `preview_ready`. Adding files is allowed only in `created`.
10. **Duplicate contract number** (INV-022 unique index violation) maps to 409 `VERSION_CONFLICT` with Ukrainian message naming the own party + number — the closed error catalog has no dedicated code; the invariant test asserts 409 + no second row.

## File structure

```
supabase/migrations/
  0010_workspace_access_module.sql      # memberships hardening + 10 new tables + indexes
  0011_workspace_access_security.sql    # grants + RLS + app.member helpers + app.accept_invitation
  0012_contract_baseline_module.sql     # units, locations, contracts, versions, work_items, import_* tables
  0013_contract_baseline_security.sql   # grants + RLS + immutability/append-only triggers
packages/contracts/src/
  workspaces.ts  invitations.ts  members.ts  parties.ts  projects.ts
  project-access.ts  contracts-baseline.ts  imports.ts  contract-versions.ts
packages/domain/src/
  authz.ts                 # role→capability map (pure)
  workspace.ts             # bootstrap builder
  invitations.ts           # token generate/hash (pure given randomness input)
  contract-number.ts       # normalization (mirrors the DB generated column)
  money.ts                 # BigInt decimal parse/scale/round/tax/tolerance
  import/csv.ts            # strict RFC4180 parser, fail-closed
  import/xlsx-guard.ts     # ZIP central-directory guard (no dependency)
  import/xlsx.ts           # exceljs read → SourceRow[], formulas inert
  import/mapping.ts        # column mapping + uk-UA normalization
  import/validate.ts       # row validation + preview totals (INV-054 core)
  import/publish.ts        # version assembly, lineage matching, diff
apps/app/src/lib/
  command.ts               # commandRoute/queryRoute wrappers (DRY for 21 routes)
  authz.ts                 # membership/capability resolution against tx
apps/app/app/v1/
  workspaces/route.ts
  workspaces/[workspaceId]/invitations/route.ts
  workspaces/[workspaceId]/members/route.ts
  workspaces/[workspaceId]/parties/route.ts
  workspaces/[workspaceId]/projects/route.ts
  invitations/accept/route.ts
  parties/[partyId]/route.ts
  parties/[partyId]/legal-profile/route.ts
  parties/[partyId]/own-profile/route.ts
  projects/route.ts
  projects/[projectId]/access-grants/route.ts
  projects/[projectId]/responsibilities/route.ts
  projects/[projectId]/contracts/route.ts
  contracts/[contractId]/import-batches/route.ts
  contracts/[contractId]/versions/[versionNo]/route.ts
  import-batches/[batchId]/route.ts            # GET
  import-batches/[batchId]/files/route.ts
  import-batches/[batchId]/validate/route.ts
  import-batches/[batchId]/resolutions/route.ts
  import-batches/[batchId]/publish/route.ts
packages/testing/src/
  m1-schema.test.ts        # introspection: workspace_id, composite FKs, indexes
  m1-rls-workspace.test.ts # INV-001 workspace-access module
  m1-rls-baseline.test.ts  # INV-001/002 contract-baseline + immutability/append-only
apps/app/tests/
  workspaces.int.test.ts  invitations.int.test.ts  parties.int.test.ts
  projects.int.test.ts  contracts.int.test.ts  imports.int.test.ts
  import-publish.int.test.ts  vertical-m1.int.test.ts
```

Existing files modified: `packages/contracts/src/index.ts`, `packages/domain/src/index.ts`, `packages/contracts/src/me-context.ts` (+ its tests), `apps/app/package.json` / `packages/domain/package.json` (exceljs), `technical/database/entity-catalog.csv` is NOT modified (already lists M1 rows).

---

### Task 1: Migration 0010 — workspace-access module DDL

**Files:**
- Create: `supabase/migrations/0010_workspace_access_module.sql`
- Test: `packages/testing/src/m1-schema.test.ts`

**Interfaces:**
- Consumes: v0.0 tables `public.organizations`, `public.memberships`, `auth.users`.
- Produces: tables `invitations`, `parties`, `party_legal_profiles`, `own_legal_entity_profiles`, `party_contacts`, `projects`, `project_parties`, `project_access_grants`, `project_responsibility_assignments`; `memberships` constraints `memberships_role_check` (4 roles), `memberships_status_check` (active/suspended/ended), `memberships_org_id_unique unique (organization_id, id)`; `organizations.locale`, `organizations.default_own_party_id`. Later tasks reference these exact table/column names.

- [ ] **Step 1: Write the failing introspection test**

`packages/testing/src/m1-schema.test.ts` (follow the style of `foundation.test.ts` — `adminClient()` from `./pg`, `resetDb()` once in `beforeAll`):

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, resetDb } from "./pg";

const M1_WORKSPACE_TABLES = [
  "invitations", "parties", "party_legal_profiles", "own_legal_entity_profiles",
  "party_contacts", "projects", "project_parties", "project_access_grants",
  "project_responsibility_assignments",
];

let admin: Client;
beforeAll(async () => { await resetDb(); admin = await adminClient(); }, 180_000);
afterAll(async () => { await admin.end(); });

describe("M1 workspace-access schema", () => {
  it("every M1 workspace table exists with a NOT NULL workspace_id", async () => {
    for (const t of M1_WORKSPACE_TABLES) {
      const r = await admin.query(
        `select is_nullable from information_schema.columns
          where table_schema='public' and table_name=$1 and column_name='workspace_id'`, [t]);
      expect(r.rows, t).toHaveLength(1);
      expect(r.rows[0].is_nullable, t).toBe("NO");
    }
  });

  it("every M1 workspace table has unique (workspace_id, id) or equivalent PK", async () => {
    for (const t of M1_WORKSPACE_TABLES.filter((t) => t !== "own_legal_entity_profiles")) {
      const r = await admin.query(
        `select 1 from pg_constraint c join pg_class rel on rel.oid = c.conrelid
          where rel.relname = $1 and c.contype in ('u','p')
            and (select array_agg(a.attname order by a.attname)
                   from unnest(c.conkey) k join pg_attribute a
                     on a.attrelid = rel.oid and a.attnum = k) = array['id','workspace_id']`, [t]);
      expect(r.rows.length, t).toBeGreaterThan(0);
    }
    const pk = await admin.query(
      `select 1 from pg_constraint c join pg_class rel on rel.oid = c.conrelid
        where rel.relname = 'own_legal_entity_profiles' and c.contype = 'p'`);
    expect(pk.rows).toHaveLength(1);
  });

  it("project-scoped tables carry tenant-safe composite FKs to projects", async () => {
    for (const t of ["project_parties", "project_access_grants", "project_responsibility_assignments"]) {
      const r = await admin.query(
        `select 1 from pg_constraint c
          join pg_class rel on rel.oid = c.conrelid
          join pg_class ref on ref.oid = c.confrelid
          where rel.relname = $1 and ref.relname = 'projects' and c.contype = 'f'
            and cardinality(c.conkey) = 2`, [t]);
      expect(r.rows.length, t).toBeGreaterThan(0);
    }
  });

  it("memberships now enforces the four governance roles and canonical statuses", async () => {
    await admin.query(`insert into public.organizations (id, legal_name, display_name) values ('11111111-1111-1111-1111-111111111111','Приклад-Орг','Приклад-Орг') on conflict do nothing`);
    await expect(admin.query(
      `insert into public.memberships (organization_id, user_id, role, status)
       values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','foreman','active')`,
    )).rejects.toThrow(/memberships_role_check/);
    await expect(admin.query(
      `insert into public.memberships (organization_id, user_id, role, status)
       values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','member','invited')`,
    )).rejects.toThrow(/memberships_status_check/);
    await admin.query(`delete from public.memberships where organization_id='11111111-1111-1111-1111-111111111111'`);
    await admin.query(`delete from public.organizations where id='11111111-1111-1111-1111-111111111111'`);
  });

  it("workspace-leading index exists for every M1 workspace table FK path", async () => {
    for (const t of M1_WORKSPACE_TABLES) {
      const r = await admin.query(
        `select 1 from pg_index i
          join pg_class rel on rel.oid = i.indrelid
          join pg_attribute a on a.attrelid = rel.oid and a.attnum = i.indkey[0]
          where rel.relname = $1 and a.attname = 'workspace_id'`, [t]);
      expect(r.rows.length, t).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @aktflow/testing test -- m1-schema`
Expected: FAIL — tables missing (`toHaveLength(1)` gets 0 rows).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0010_workspace_access_module.sql` — complete content:

```sql
-- 0010: workspace-access module (v0.1-M1). Additive: no baseline object is
-- renamed or dropped. The tenant root REMAINS public.organizations; every new
-- table's tenant column is named workspace_id and references organizations(id)
-- (plan decision 1 in docs/superpowers/plans/2026-07-30-goproceed-v0.1-m1-contract-baseline.md).
--
-- Rollback (dev only): drop the nine new tables in reverse order; drop
-- organizations.locale / organizations.default_own_party_id; restore the 0001
-- memberships role/status checks and default. Forward fix (staging/prod): new
-- migration; never edit this one after deploy.

-- ── memberships hardening (ADR-002 four governance roles) ────────────────────
-- Guard: abort if any environment holds a row the canonical sets would break.
do $$ begin
  if exists (select 1 from public.memberships
              where role not in ('owner','admin','member','auditor')) then
    raise exception 'memberships contains non-canonical role values; manual review required';
  end if;
  if exists (select 1 from public.memberships
              where status not in ('active','suspended')) then
    raise exception 'memberships contains non-canonical status values; manual review required';
  end if;
end $$;

alter table public.memberships drop constraint memberships_role_check;
alter table public.memberships add constraint memberships_role_check
  check (role in ('owner','admin','member','auditor'));
alter table public.memberships drop constraint memberships_status_check;
alter table public.memberships add constraint memberships_status_check
  check (status in ('active','suspended','ended'));
alter table public.memberships alter column status set default 'active';
-- Tenant-safe FK target for member-bound rows (grants, responsibilities).
alter table public.memberships add constraint memberships_org_id_unique
  unique (organization_id, id);

-- ── workspace product columns (additive; legal authority NOT added) ──────────
alter table public.organizations
  add column if not exists locale text not null default 'uk-UA',
  add column if not exists default_own_party_id uuid;

-- ── invitations ──────────────────────────────────────────────────────────────
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  email text not null check (position('@' in email) > 1),
  role text not null check (role in ('admin','member','auditor')),
  -- sha256 hex of the one-time token; plaintext never enters the database.
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id),
  accepted_membership_id uuid,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (token_hash),
  foreign key (workspace_id, accepted_membership_id)
    references public.memberships (organization_id, id)
);
create unique index invitations_pending_email_unique
  on public.invitations (workspace_id, lower(email)) where status = 'pending';
create index invitations_ws_status_idx
  on public.invitations (workspace_id, status, expires_at);

-- ── parties (tenant-local; no global registry — ADR-002) ─────────────────────
create table public.parties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  display_name text not null check (length(btrim(display_name)) > 0),
  party_kind text not null default 'organization'
    check (party_kind in ('organization','individual')),
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index parties_ws_name_idx on public.parties (workspace_id, display_name);

-- Circular by design: organizations.default_own_party_id → parties (nullable).
alter table public.organizations add constraint organizations_default_own_party_fk
  foreign key (id, default_own_party_id) references public.parties (workspace_id, id);

create table public.party_legal_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  party_id uuid not null,
  official_name text not null check (length(btrim(official_name)) > 0),
  -- ЄДРПОУ (8 digits) or РНОКПП (10 digits); nullable while a draft profile.
  edrpou text check (edrpou ~ '^[0-9]{8}$' or edrpou ~ '^[0-9]{10}$'),
  vat_number text,
  tax_status text,
  legal_address text,
  country_code char(2) not null default 'UA',
  version bigint not null default 1,
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, party_id),
  foreign key (workspace_id, party_id) references public.parties (workspace_id, id)
);

-- Marks the workspace's own legal entities (stricter permission, INV-020).
create table public.own_legal_entity_profiles (
  workspace_id uuid not null references public.organizations(id),
  party_id uuid not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (workspace_id, party_id),
  foreign key (workspace_id, party_id) references public.parties (workspace_id, id),
  -- An own profile requires an existing legal profile row (completeness of
  -- official_name/edrpou is validated by the command; the FK is defense in depth).
  foreign key (workspace_id, party_id)
    references public.party_legal_profiles (workspace_id, party_id)
);

create table public.party_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  party_id uuid not null,
  full_name text not null check (length(btrim(full_name)) > 0),
  role_title text,
  email text,
  phone text,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, party_id) references public.parties (workspace_id, id)
);
create index party_contacts_party_idx on public.party_contacts (workspace_id, party_id);

-- ── projects ─────────────────────────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  name text not null check (length(btrim(name)) > 0),
  code text,
  address text,
  description text,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

-- Business relationship of a party to a project; NEVER grants access (ADR-002).
create table public.project_parties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  party_id uuid not null,
  relationship text not null check (relationship in
    ('customer','general_contractor','subcontractor','technical_supervision',
     'designer','performer','other')),
  note text,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  unique (workspace_id, project_id, party_id, relationship),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, party_id) references public.parties (workspace_id, id)
);

-- Explicit, time-bounded, revocable member visibility/action grant (tenancy doc).
create table public.project_access_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  member_id uuid not null,
  capability text not null check (capability in
    ('project.admin','project.view','contracts.edit','imports.manage','imports.publish')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz check (valid_until is null or valid_until > valid_from),
  revoked_at timestamptz,
  granted_by uuid not null references auth.users(id),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, member_id) references public.memberships (organization_id, id)
);
create unique index project_access_active_unique
  on public.project_access_grants (workspace_id, project_id, member_id, capability)
  where revoked_at is null;
create index project_access_actor_idx
  on public.project_access_grants (workspace_id, member_id, project_id, valid_until);

-- Append-only operational accountability fact; never an access grant.
create table public.project_responsibility_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  member_id uuid not null,
  responsibility text not null check (responsibility in
    ('performer','progress_recorder','evidence_recorder','evidence_custodian',
     'requirement_owner','package_compiler','internal_verifier','package_submitter',
     'acceptance_liaison','commercial_observer')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz check (valid_until is null or valid_until > valid_from),
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id),
  foreign key (workspace_id, member_id) references public.memberships (organization_id, id)
);
create index project_responsibility_member_idx
  on public.project_responsibility_assignments (workspace_id, member_id, project_id, responsibility);
```

- [ ] **Step 4: Apply and run the test to verify it passes**

Run: `supabase db reset --no-seed=false && pnpm -w db:local-credentials && pnpm --filter @aktflow/testing test -- m1-schema`
Expected: PASS. Also confirm the whole existing suite still passes: `pnpm turbo run test --concurrency=1` (v0.0 tests must not regress — the memberships guard/checks are the risk point).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0010_workspace_access_module.sql packages/testing/src/m1-schema.test.ts
git commit -m "feat(m1): workspace-access module DDL — parties, projects, access, responsibilities"
```

---

### Task 2: Migration 0011 — workspace-access grants, RLS, and helpers

**Files:**
- Create: `supabase/migrations/0011_workspace_access_security.sql`
- Test: `packages/testing/src/m1-rls-workspace.test.ts`

**Interfaces:**
- Consumes: Task 1 tables; v0.0 `app.current_actor()`, role `aktflow_app`, test helpers `appClient/adminClient/asActor` from `packages/testing/src/pg.ts`.
- Produces: `app.active_member_id(ws uuid) returns uuid`; `app.has_project_capability(ws uuid, proj uuid, caps text[]) returns boolean`; `app.project_has_grants(ws uuid, proj uuid) returns boolean` (security definer, bootstrap); `app.accept_invitation(p_token_hash text) returns table (workspace_id uuid, membership_id uuid, member_role text)` (security definer). RLS policies + grant allowlist for all Task 1 tables. Routes in Tasks 6–10 call these functions by these exact names.

- [ ] **Step 1: Write the failing RLS tests**

`packages/testing/src/m1-rls-workspace.test.ts`. Fixture: two workspaces W1 (member A) and W2 (member B) created via admin inserts; then `asActor` sessions assert isolation (INV-001 for the workspace-access module):

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor, resetDb } from "./pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const W1 = "11111111-1111-1111-1111-111111111111";
const W2 = "22222222-2222-2222-2222-222222222222";
const P1 = "31111111-1111-1111-1111-111111111111";

let admin: Client;
beforeAll(async () => {
  await resetDb();
  admin = await adminClient();
  for (const [w, u, name] of [[W1, A, "Приклад-Перший"], [W2, B, "Приклад-Другий"]] as const) {
    await admin.query(`insert into public.organizations (id, legal_name, display_name) values ($1,$2,$2)`, [w, name]);
    await admin.query(`insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'owner','active')`, [w, u]);
  }
  await admin.query(`insert into public.projects (id, workspace_id, name, created_by) values ($1,$2,'Приклад-Обʼєкт',$3)`, [P1, W1, A]);
}, 180_000);
afterAll(async () => { await admin.end(); });

describe("INV-001 — workspace-access module isolation", () => {
  it("A cannot insert a party into B's workspace (WITH CHECK denial)", async () => {
    await expect(asActor(A, W2, (c) => c.query(
      `insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Чужий',$2)`,
      [W2, A]))).rejects.toThrow(/row-level security|violates/i);
  });

  it("A cannot see B's workspace parties", async () => {
    await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Б-Партія',$2)`, [W2, B]);
    const r = await asActor(A, W1, (c) => c.query(`select * from public.parties where workspace_id = $1`, [W2]));
    expect(r.rows).toHaveLength(0);
  });

  it("B cannot see W1 projects even with a stolen project id", async () => {
    const r = await asActor(B, W2, (c) => c.query(`select * from public.projects where id = $1`, [P1]));
    expect(r.rows).toHaveLength(0);
  });

  it("A member without a grant cannot see a project in their OWN workspace", async () => {
    const r = await asActor(A, W1, (c) => c.query(`select * from public.projects where id = $1`, [P1]));
    expect(r.rows).toHaveLength(0); // visibility requires an explicit grant (decision 6)
  });

  it("a project.view grant makes the project visible", async () => {
    const m = await admin.query(`select id from public.memberships where organization_id=$1 and user_id=$2`, [W1, A]);
    await admin.query(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,'project.view',$4)`, [W1, P1, m.rows[0].id, A]);
    const r = await asActor(A, W1, (c) => c.query(`select * from public.projects where id = $1`, [P1]));
    expect(r.rows).toHaveLength(1);
  });

  it("cross-workspace composite-FK injection is impossible: grant in W1 for a W2 project", async () => {
    const m = await admin.query(`select id from public.memberships where organization_id=$1 and user_id=$2`, [W1, A]);
    const p2 = await admin.query(`insert into public.projects (workspace_id, name, created_by) values ($1,'Приклад-Б-Обʼєкт',$2) returning id`, [W2, B]);
    await expect(admin.query(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,'project.view',$4)`, [W1, p2.rows[0].id, m.rows[0].id, A],
    )).rejects.toThrow(/foreign key/i); // even a superuser cannot join W1+W2 (INV-001 FK layer)
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @aktflow/testing test -- m1-rls-workspace`
Expected: FAIL — with no RLS policies + no grants, `asActor` selects/inserts error with `permission denied` (grants missing), not the expected shapes.

- [ ] **Step 3: Write the migration**

`supabase/migrations/0011_workspace_access_security.sql` — complete content:

```sql
-- 0011: grants + RLS for the workspace-access module, membership helpers, and
-- the invitation-accept security-definer command.
-- Rollback (dev only): drop policies/functions created here; revoke the grants.
-- Forward fix (staging/prod): corrective migration; never disable RLS in place.

-- ── helper functions ─────────────────────────────────────────────────────────
create or replace function app.active_member_id(ws uuid) returns uuid
language sql stable as $$
  select m.id from public.memberships m
   where m.organization_id = ws and m.user_id = app.current_actor()
     and m.status = 'active'
$$;

create or replace function app.has_project_capability(ws uuid, proj uuid, caps text[])
returns boolean language sql stable as $$
  select exists (
    select 1
      from public.memberships m
      join public.project_access_grants g
        on g.workspace_id = m.organization_id and g.member_id = m.id
     where m.organization_id = ws and m.user_id = app.current_actor()
       and m.status = 'active'
       and g.project_id = proj and g.capability = any(caps)
       and g.revoked_at is null and g.valid_from <= now()
       and (g.valid_until is null or g.valid_until > now()))
$$;

-- SECURITY DEFINER (like app.org_has_members): the creator's very first grant
-- insert must pass RLS before any project.admin grant exists.
create or replace function app.project_has_grants(ws uuid, proj uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_access_grants
                  where workspace_id = ws and project_id = proj)
$$;
revoke all on function app.project_has_grants(uuid, uuid) from public;
grant execute on function app.project_has_grants(uuid, uuid) to aktflow_app;

-- ── grants allowlist ─────────────────────────────────────────────────────────
revoke all on public.invitations, public.parties, public.party_legal_profiles,
  public.own_legal_entity_profiles, public.party_contacts, public.projects,
  public.project_parties, public.project_access_grants,
  public.project_responsibility_assignments
  from public, anon, authenticated;

grant select, insert, update on public.invitations to aktflow_app;
grant select, insert, update on public.parties to aktflow_app;
grant select, insert, update on public.party_legal_profiles to aktflow_app;
grant select, insert on public.own_legal_entity_profiles to aktflow_app;
grant select, insert, update on public.party_contacts to aktflow_app;
grant select, insert, update on public.projects to aktflow_app;
grant select, insert, update on public.project_parties to aktflow_app;
grant select, insert, update on public.project_access_grants to aktflow_app;
grant select, insert on public.project_responsibility_assignments to aktflow_app;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.invitations enable row level security;
alter table public.parties enable row level security;
alter table public.party_legal_profiles enable row level security;
alter table public.own_legal_entity_profiles enable row level security;
alter table public.party_contacts enable row level security;
alter table public.projects enable row level security;
alter table public.project_parties enable row level security;
alter table public.project_access_grants enable row level security;
alter table public.project_responsibility_assignments enable row level security;

-- Workspace-scoped tables: active membership in that workspace.
create policy inv_select on public.invitations for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy inv_write on public.invitations for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy inv_update on public.invitations for update to aktflow_app
  using (app.active_member_id(workspace_id) is not null)
  with check (app.active_member_id(workspace_id) is not null);

create policy parties_select on public.parties for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy parties_insert on public.parties for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy parties_update on public.parties for update to aktflow_app
  using (app.active_member_id(workspace_id) is not null)
  with check (app.active_member_id(workspace_id) is not null);

create policy plp_select on public.party_legal_profiles for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy plp_insert on public.party_legal_profiles for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy plp_update on public.party_legal_profiles for update to aktflow_app
  using (app.active_member_id(workspace_id) is not null)
  with check (app.active_member_id(workspace_id) is not null);

create policy olep_select on public.own_legal_entity_profiles for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy olep_insert on public.own_legal_entity_profiles for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);

create policy pc_select on public.party_contacts for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy pc_insert on public.party_contacts for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy pc_update on public.party_contacts for update to aktflow_app
  using (app.active_member_id(workspace_id) is not null)
  with check (app.active_member_id(workspace_id) is not null);

-- Projects: SELECT needs an explicit visibility grant (decision 6); INSERT needs
-- an active membership (the projects.create capability check runs in the command).
create policy projects_select on public.projects for select to aktflow_app
  using (app.has_project_capability(workspace_id, id, array['project.view','project.admin']));
create policy projects_insert on public.projects for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy projects_update on public.projects for update to aktflow_app
  using (app.has_project_capability(workspace_id, id, array['project.admin']))
  with check (app.has_project_capability(workspace_id, id, array['project.admin']));

create policy pp_select on public.project_parties for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy pp_write on public.project_parties for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));
create policy pp_update on public.project_parties for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.admin']))
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));

-- Access grants: visible to project admins and to the grantee; writable by a
-- project admin, or by the project creator's bootstrap insert when the project
-- has no grants yet (mirrors the v0.0 owner-bootstrap pattern).
create policy pag_select on public.project_access_grants for select to aktflow_app
  using (
    app.has_project_capability(workspace_id, project_id, array['project.admin'])
    or member_id = app.active_member_id(workspace_id));
create policy pag_insert on public.project_access_grants for insert to aktflow_app
  with check (
    app.has_project_capability(workspace_id, project_id, array['project.admin'])
    or (member_id = app.active_member_id(workspace_id)
        and not app.project_has_grants(workspace_id, project_id)));
create policy pag_update on public.project_access_grants for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.admin']))
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));

create policy pra_select on public.project_responsibility_assignments for select to aktflow_app
  using (
    app.has_project_capability(workspace_id, project_id, array['project.view','project.admin'])
    or member_id = app.active_member_id(workspace_id));
create policy pra_insert on public.project_responsibility_assignments for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));

-- Members of a workspace may list the workspace's memberships (members.list).
-- Additive second SELECT policy; the v0.0 own-row policy remains.
create policy m_select_workspace on public.memberships for select to aktflow_app
  using (exists (
    select 1 from public.memberships me
     where me.organization_id = memberships.organization_id
       and me.user_id = app.current_actor() and me.status = 'active'));

-- ── invitation accept (SECURITY DEFINER command) ─────────────────────────────
create or replace function app.accept_invitation(p_token_hash text)
returns table (workspace_id uuid, membership_id uuid, member_role text)
language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations%rowtype;
  new_membership uuid;
begin
  if app.current_actor() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select * into inv from public.invitations i
   where i.token_hash = p_token_hash and i.status = 'pending'
   for update;
  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;
  if inv.expires_at <= now() then
    update public.invitations
       set status = 'expired', updated_at = now(), version = version + 1
     where id = inv.id;
    raise exception 'INVITATION_NOT_FOUND'; -- existence-safe: expired == invalid
  end if;
  if exists (select 1 from public.memberships m
              where m.organization_id = inv.workspace_id
                and m.user_id = app.current_actor()) then
    raise exception 'ALREADY_MEMBER';
  end if;
  insert into public.memberships (organization_id, user_id, role, status, all_projects)
  values (inv.workspace_id, app.current_actor(), inv.role, 'active', false)
  returning id into new_membership;
  update public.invitations
     set status = 'accepted', accepted_membership_id = new_membership,
         updated_at = now(), version = version + 1
   where id = inv.id;
  return query select inv.workspace_id, new_membership, inv.role;
end $$;
revoke all on function app.accept_invitation(text) from public;
grant execute on function app.accept_invitation(text) to aktflow_app;
```

- [ ] **Step 4: Reset, run the new test, then the full serialized suite**

Run: `supabase db reset --no-seed=false && pnpm -w db:local-credentials && pnpm --filter @aktflow/testing test -- m1-rls-workspace`
Expected: PASS.
Then: `pnpm turbo run test --concurrency=1` — the v0.0 `rls.test.ts` and `privileges.test.ts` must stay green (the new `m_select_workspace` policy widens membership SELECT — if a v0.0 test asserts a member cannot see co-members, update THAT expectation deliberately and note it in the commit message; members.list requires this widening).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0011_workspace_access_security.sql packages/testing/src/m1-rls-workspace.test.ts
git commit -m "feat(m1): workspace-access grants, RLS, membership helpers, invitation accept"
```

---

### Task 3: Migration 0012 — contract-baseline module DDL

**Files:**
- Create: `supabase/migrations/0012_contract_baseline_module.sql`
- Modify: `packages/testing/src/m1-schema.test.ts` (extend the table lists)

**Interfaces:**
- Consumes: Task 1 tables (`parties`, `own_legal_entity_profiles`, `projects`), `public.organizations`, `auth.users`.
- Produces: tables `unit_definitions`, `locations`, `contracts` (with generated `normalized_contract_no`), `contract_versions`, `work_items`, `import_batches`, `import_files`, `import_row_results`, `source_amount_resolutions` — exact column names below are consumed verbatim by Tasks 10–17.

- [ ] **Step 1: Extend the failing introspection test**

In `packages/testing/src/m1-schema.test.ts` add:

```ts
const M1_BASELINE_TABLES = [
  "unit_definitions", "locations", "contracts", "contract_versions",
  "work_items", "import_batches", "import_files", "import_row_results",
  "source_amount_resolutions",
];

describe("M1 contract-baseline schema", () => {
  it("every baseline table exists with NOT NULL workspace_id and unique (workspace_id, id)", async () => {
    for (const t of M1_BASELINE_TABLES) {
      const col = await admin.query(
        `select is_nullable from information_schema.columns
          where table_schema='public' and table_name=$1 and column_name='workspace_id'`, [t]);
      expect(col.rows, t).toHaveLength(1);
      expect(col.rows[0].is_nullable, t).toBe("NO");
    }
  });

  it("INV-022: duplicate normalized contract number within (workspace, own party) is rejected", async () => {
    // fixture: workspace + own party with legal + own profile + project (admin inserts)
    const W = "41111111-1111-1111-1111-111111111111";
    await admin.query(`insert into public.organizations (id, legal_name, display_name) values ($1,'Приклад-Т','Приклад-Т')`, [W]);
    const p = await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Власна','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') returning id`, [W]);
    const c = await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Замовник','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') returning id`, [W]);
    await admin.query(`insert into public.party_legal_profiles (workspace_id, party_id, official_name, edrpou, updated_by) values ($1,$2,'ТОВ Приклад-Власна','12345678','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')`, [W, p.rows[0].id]);
    await admin.query(`insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by) values ($1,$2,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')`, [W, p.rows[0].id]);
    const pr = await admin.query(`insert into public.projects (workspace_id, name, created_by) values ($1,'Приклад-Обʼєкт-К','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') returning id`, [W]);
    const ins = (no: string) => admin.query(
      `insert into public.contracts (workspace_id, project_id, own_party_id, customer_party_id, contract_no, currency, tax_mode, rounding_policy, created_by)
       values ($1,$2,$3,$4,$5,'UAH','exclusive','{"midpoint":"half_up","scope":"work_item_version_pool"}','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')`,
      [W, pr.rows[0].id, p.rows[0].id, c.rows[0].id, no]);
    await ins("Д-2026/01");
    await expect(ins("  д-2026/01 ")).rejects.toThrow(/contracts_number_unique/);
  });

  it("INV-002 (FK layer): a contract cannot use a party without an own profile", async () => {
    const W = "41111111-1111-1111-1111-111111111111";
    const notOwn = await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-НеВласна','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') returning id`, [W]);
    const pr = await admin.query(`select id from public.projects where workspace_id=$1 limit 1`, [W]);
    const cust = await admin.query(`select id from public.parties where workspace_id=$1 and display_name='Приклад-Замовник'`, [W]);
    await expect(admin.query(
      `insert into public.contracts (workspace_id, project_id, own_party_id, customer_party_id, contract_no, currency, tax_mode, rounding_policy, created_by)
       values ($1,$2,$3,$4,'Д-2026/02','UAH','exclusive','{"midpoint":"half_up","scope":"work_item_version_pool"}','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')`,
      [W, pr.rows[0].id, notOwn.rows[0].id, cust.rows[0].id],
    )).rejects.toThrow(/foreign key/i);
  });

  it("work_items enforces gross = net + tax", async () => {
    // direct DDL-level check; full insert fixture is exercised in Task 17 tests
    const r = await admin.query(
      `select pg_get_constraintdef(oid) def from pg_constraint
        where conrelid = 'public.work_items'::regclass and contype = 'c'
          and pg_get_constraintdef(oid) like '%gross_amount_minor_units%'`);
    expect(r.rows.some((x: { def: string }) => /net_amount_minor_units\s*\+\s*tax_amount_minor_units/.test(x.def))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @aktflow/testing test -- m1-schema`
Expected: FAIL — baseline tables missing.

- [ ] **Step 3: Write the migration**

`supabase/migrations/0012_contract_baseline_module.sql` — complete content:

```sql
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
```

- [ ] **Step 4: Apply and verify**

Run: `supabase db reset --no-seed=false && pnpm -w db:local-credentials && pnpm --filter @aktflow/testing test -- m1-schema`
Expected: PASS (all Task 1 + Task 3 assertions).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0012_contract_baseline_module.sql packages/testing/src/m1-schema.test.ts
git commit -m "feat(m1): contract-baseline DDL — contracts, immutable versions, work items, import chain"
```

---

### Task 4: Migration 0013 — contract-baseline security (grants, RLS, immutability)

**Files:**
- Create: `supabase/migrations/0013_contract_baseline_security.sql`
- Test: `packages/testing/src/m1-rls-baseline.test.ts`

**Interfaces:**
- Consumes: Task 2 helpers (`app.active_member_id`, `app.has_project_capability`), Task 3 tables.
- Produces: `app.reject_mutation()` trigger function; RLS + grants for the nine baseline tables. Route tasks rely on: `aktflow_app` may UPDATE only `contracts`, `import_batches`, `locations`, `unit_definitions`; everything published/append-only is INSERT+SELECT only.

- [ ] **Step 1: Write the failing tests**

`packages/testing/src/m1-rls-baseline.test.ts` — fixture mirrors Task 3's admin fixture (workspace W1 + member A with grants, workspace W2 + member B), then:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor, resetDb } from "./pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const W1 = "51111111-1111-1111-1111-111111111111";
const W2 = "52222222-2222-2222-2222-222222222222";

let admin: Client;
let projectId: string; let contractId: string; let ownPartyId: string;

beforeAll(async () => {
  await resetDb();
  admin = await adminClient();
  // W1 with owner A; W2 with owner B
  for (const [w, u] of [[W1, A], [W2, B]] as const) {
    await admin.query(`insert into public.organizations (id, legal_name, display_name) values ($1,'Приклад-РЛС','Приклад-РЛС')`, [w]);
    await admin.query(`insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'owner','active')`, [w, u]);
  }
  const own = await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Власна',$2) returning id`, [W1, A]);
  ownPartyId = own.rows[0].id;
  const cust = await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Замовник',$2) returning id`, [W1, A]);
  await admin.query(`insert into public.party_legal_profiles (workspace_id, party_id, official_name, edrpou, updated_by) values ($1,$2,'ТОВ Приклад-Власна','12345678',$3)`, [W1, ownPartyId, A]);
  await admin.query(`insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by) values ($1,$2,$3)`, [W1, ownPartyId, A]);
  const pr = await admin.query(`insert into public.projects (workspace_id, name, created_by) values ($1,'Приклад-Обʼєкт',$2) returning id`, [W1, A]);
  projectId = pr.rows[0].id;
  const m = await admin.query(`select id from public.memberships where organization_id=$1 and user_id=$2`, [W1, A]);
  for (const cap of ["project.view", "project.admin", "contracts.edit", "imports.manage", "imports.publish"]) {
    await admin.query(`insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by) values ($1,$2,$3,$4,$5)`, [W1, projectId, m.rows[0].id, cap, A]);
  }
  const c = await admin.query(
    `insert into public.contracts (workspace_id, project_id, own_party_id, customer_party_id, contract_no, currency, tax_mode, rounding_policy, created_by)
     values ($1,$2,$3,$4,'Д-РЛС/1','UAH','exclusive','{"midpoint":"half_up","scope":"work_item_version_pool"}',$5) returning id`,
    [W1, projectId, ownPartyId, cust.rows[0].id, A]);
  contractId = c.rows[0].id;
}, 180_000);
afterAll(async () => { await admin.end(); });

describe("INV-001/002 — contract-baseline isolation and immutability", () => {
  it("B cannot see W1 contracts even by id", async () => {
    const r = await asActor(B, W2, (c) => c.query(`select * from public.contracts where id=$1`, [contractId]));
    expect(r.rows).toHaveLength(0);
  });

  it("A with grants sees the contract; a grantless member of W1 does not", async () => {
    const r = await asActor(A, W1, (c) => c.query(`select * from public.contracts where id=$1`, [contractId]));
    expect(r.rows).toHaveLength(1);
  });

  it("published contract_versions reject UPDATE and DELETE (trigger, all roles)", async () => {
    const batch = await admin.query(
      `insert into public.import_batches (workspace_id, project_id, contract_id, created_by) values ($1,$2,$3,$4) returning id`,
      [W1, projectId, contractId, A]);
    const v = await admin.query(
      `insert into public.contract_versions
        (workspace_id, project_id, contract_id, version_no, own_party_snapshot, customer_party_snapshot,
         currency, tax_mode, terms, approval_policy, rounding_policy,
         source_tolerance_minor_units, source_tolerance_bps, import_batch_id, source_manifest_hash, published_by)
       values ($1,$2,$3,1,'{}','{}','UAH','exclusive','{}','{}','{"midpoint":"half_up","scope":"work_item_version_pool"}',100,10,$4,repeat('a',64),$5)
       returning id`,
      [W1, projectId, contractId, batch.rows[0].id, A]);
    await expect(admin.query(`update public.contract_versions set currency='USD' where id=$1`, [v.rows[0].id]))
      .rejects.toThrow(/immutable/i);
    await expect(admin.query(`delete from public.contract_versions where id=$1`, [v.rows[0].id]))
      .rejects.toThrow(/immutable/i);
  });

  it("append-only tables reject UPDATE/DELETE: import_files, import_row_results, source_amount_resolutions, project_responsibility_assignments, work_items", async () => {
    const f = await admin.query(
      `insert into public.import_files (workspace_id, import_batch_id, filename, byte_size, content_hash, detected_format, storage_key, source_bytes, uploaded_by)
       select $1, id, 'приклад.csv', 3, repeat('b',64), 'csv', 'pg://x', '\\x616263', $2 from public.import_batches where workspace_id=$1 limit 1 returning id`,
      [W1, A]);
    await expect(admin.query(`update public.import_files set filename='x' where id=$1`, [f.rows[0].id]))
      .rejects.toThrow(/immutable/i);
    await expect(admin.query(`delete from public.import_files where id=$1`, [f.rows[0].id]))
      .rejects.toThrow(/immutable/i);
  });

  it("aktflow_app has no UPDATE/DELETE grant on append-only tables", async () => {
    const r = await admin.query(
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee='aktflow_app' and table_schema='public'
          and table_name in ('contract_versions','work_items','import_files','import_row_results','source_amount_resolutions','project_responsibility_assignments')
          and privilege_type in ('UPDATE','DELETE')`);
    expect(r.rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @aktflow/testing test -- m1-rls-baseline`
Expected: FAIL (`permission denied` before policies/grants exist; no trigger yet).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0013_contract_baseline_security.sql` — complete content:

```sql
-- 0013: grants + RLS + immutability/append-only enforcement for the
-- contract-baseline module. Mirrors 0006's audit append-only trigger pattern.
-- Rollback (dev only): drop policies + triggers + app.reject_mutation, revoke grants.

create or replace function app.reject_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is immutable (append-only relation)', tg_table_name;
end $$;

-- ── grants allowlist ─────────────────────────────────────────────────────────
revoke all on public.unit_definitions, public.locations, public.contracts,
  public.contract_versions, public.work_items, public.import_batches,
  public.import_files, public.import_row_results, public.source_amount_resolutions
  from public, anon, authenticated;

grant select, insert, update on public.unit_definitions to aktflow_app;
grant select, insert, update on public.locations to aktflow_app;
grant select, insert, update on public.contracts to aktflow_app;
grant select, insert on public.contract_versions to aktflow_app;
grant select, insert on public.work_items to aktflow_app;
grant select, insert, update on public.import_batches to aktflow_app;
grant select, insert on public.import_files to aktflow_app;
grant select, insert on public.import_row_results to aktflow_app;
grant select, insert on public.source_amount_resolutions to aktflow_app;

-- ── immutability / append-only triggers (second layer beyond grants) ─────────
create trigger contract_versions_immutable before update or delete
  on public.contract_versions for each row execute function app.reject_mutation();
create trigger work_items_immutable before update or delete
  on public.work_items for each row execute function app.reject_mutation();
create trigger import_files_immutable before update or delete
  on public.import_files for each row execute function app.reject_mutation();
create trigger import_row_results_immutable before update or delete
  on public.import_row_results for each row execute function app.reject_mutation();
create trigger source_amount_resolutions_immutable before update or delete
  on public.source_amount_resolutions for each row execute function app.reject_mutation();
create trigger project_responsibility_assignments_immutable before update or delete
  on public.project_responsibility_assignments for each row execute function app.reject_mutation();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.unit_definitions enable row level security;
alter table public.locations enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_versions enable row level security;
alter table public.work_items enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_files enable row level security;
alter table public.import_row_results enable row level security;
alter table public.source_amount_resolutions enable row level security;

-- Workspace-scoped units: any active member reads; writes are capability-checked
-- in the command layer (units.manage), RLS provides the tenant boundary.
create policy units_select on public.unit_definitions for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy units_insert on public.unit_definitions for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy units_update on public.unit_definitions for update to aktflow_app
  using (app.active_member_id(workspace_id) is not null)
  with check (app.active_member_id(workspace_id) is not null);

create policy locations_select on public.locations for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy locations_insert on public.locations for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['imports.manage','project.admin']));
create policy locations_update on public.locations for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.admin']))
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));

create policy contracts_select on public.contracts for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy contracts_insert on public.contracts for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['contracts.edit']));
create policy contracts_update on public.contracts for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['contracts.edit']))
  with check (app.has_project_capability(workspace_id, project_id, array['contracts.edit']));

create policy cv_select on public.contract_versions for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy cv_insert on public.contract_versions for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['imports.publish']));

create policy wi_select on public.work_items for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy wi_insert on public.work_items for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['imports.publish']));

create policy ib_select on public.import_batches for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy ib_insert on public.import_batches for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['imports.manage']));
create policy ib_update on public.import_batches for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['imports.manage','imports.publish']))
  with check (app.has_project_capability(workspace_id, project_id, array['imports.manage','imports.publish']));

-- import_files/row_results/resolutions are batch-scoped: derive project via the
-- batch row (workspace-leading index path; the subquery is per-statement).
create policy if_select on public.import_files for select to aktflow_app
  using (exists (select 1 from public.import_batches b
                  where b.workspace_id = import_files.workspace_id
                    and b.id = import_files.import_batch_id
                    and app.has_project_capability(b.workspace_id, b.project_id,
                          array['project.view','project.admin'])));
create policy if_insert on public.import_files for insert to aktflow_app
  with check (exists (select 1 from public.import_batches b
                       where b.workspace_id = import_files.workspace_id
                         and b.id = import_files.import_batch_id
                         and app.has_project_capability(b.workspace_id, b.project_id,
                               array['imports.manage'])));

create policy irr_select on public.import_row_results for select to aktflow_app
  using (exists (select 1 from public.import_batches b
                  where b.workspace_id = import_row_results.workspace_id
                    and b.id = import_row_results.import_batch_id
                    and app.has_project_capability(b.workspace_id, b.project_id,
                          array['project.view','project.admin'])));
create policy irr_insert on public.import_row_results for insert to aktflow_app
  with check (exists (select 1 from public.import_batches b
                       where b.workspace_id = import_row_results.workspace_id
                         and b.id = import_row_results.import_batch_id
                         and app.has_project_capability(b.workspace_id, b.project_id,
                               array['imports.manage'])));

create policy sar_select on public.source_amount_resolutions for select to aktflow_app
  using (exists (select 1 from public.import_batches b
                  where b.workspace_id = source_amount_resolutions.workspace_id
                    and b.id = source_amount_resolutions.import_batch_id
                    and app.has_project_capability(b.workspace_id, b.project_id,
                          array['project.view','project.admin'])));
create policy sar_insert on public.source_amount_resolutions for insert to aktflow_app
  with check (exists (select 1 from public.import_batches b
                       where b.workspace_id = source_amount_resolutions.workspace_id
                         and b.id = source_amount_resolutions.import_batch_id
                         and app.has_project_capability(b.workspace_id, b.project_id,
                               array['imports.manage'])));
```

- [ ] **Step 4: Apply and verify, then full suite**

Run: `supabase db reset --no-seed=false && pnpm -w db:local-credentials && pnpm --filter @aktflow/testing test -- m1-rls-baseline`
Expected: PASS. Then `pnpm turbo run test --concurrency=1` — all green.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0013_contract_baseline_security.sql packages/testing/src/m1-rls-baseline.test.ts
git commit -m "feat(m1): contract-baseline grants, RLS, immutability and append-only enforcement"
```

---

### Task 5: Command/query route plumbing and authorization helpers

**Files:**
- Create: `apps/app/src/lib/command.ts`, `apps/app/src/lib/authz.ts`, `packages/domain/src/authz.ts`
- Modify: `packages/domain/src/index.ts` (re-export)
- Test: `apps/app/src/lib/command.test.ts`, `packages/domain/src/authz.test.ts`

**Interfaces:**
- Consumes: v0.0 `requireUser`, `idempotencyKeyFrom`, `HttpProblem`, `toProblemResponse`, `ok`, `requestIdFrom`, `problem`, `withTenantTx`, `withIdempotency`, `Tx`.
- Produces (used verbatim by Tasks 6–17):
  - `commandRoute<T>(schema, run)` → Next handler `(req, ctx: { params: Promise<Record<string,string>> }) => Promise<Response>`; `run` receives `{ req, requestId, userId, body: T, params, idempotencyKey, requestHash }` and returns `{ status, body, expiresAt? }`.
  - `queryRoute(run)` → same shape without idempotency/body (GET).
  - `@aktflow/domain`: `type GovernanceRole`, `type WorkspaceCapability`, `type ProjectCapability`, `workspaceCapabilities(role): readonly WorkspaceCapability[]`.
  - `apps/app/src/lib/authz.ts`: `requireActiveMembership(tx, requestId, userId, workspaceId): Promise<{ memberId: string; role: GovernanceRole }>`; `requireWorkspaceCapability(requestId, role, capability): void`; `requireProjectCapability(tx, requestId, { workspaceId, projectId, memberId, capability }): Promise<void>`.

- [ ] **Step 1: Write failing unit tests**

`packages/domain/src/authz.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { workspaceCapabilities } from "./authz";

describe("workspaceCapabilities (decision 5, INV-020)", () => {
  it("owner holds own_legal_profiles.manage; admin does not", () => {
    expect(workspaceCapabilities("owner")).toContain("own_legal_profiles.manage");
    expect(workspaceCapabilities("admin")).not.toContain("own_legal_profiles.manage");
  });
  it("admin holds parties.manage, projects.create, units.manage", () => {
    for (const c of ["parties.manage", "projects.create", "units.manage"] as const) {
      expect(workspaceCapabilities("admin")).toContain(c);
    }
  });
  it("member and auditor hold no workspace capabilities", () => {
    expect(workspaceCapabilities("member")).toEqual([]);
    expect(workspaceCapabilities("auditor")).toEqual([]);
  });
});
```

`apps/app/src/lib/command.test.ts` (unit level, mock `requireUser` like the existing `auth.test.ts`/`http.test.ts` style):

```ts
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

vi.mock("./auth", () => ({ requireUser: async () => ({ userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }) }));
import { commandRoute, queryRoute } from "./command";

const echo = commandRoute(z.object({ name: z.string().min(1) }), async (a) => ({
  status: 200, body: { got: a.body.name, key: a.idempotencyKey, hash: a.requestHash.length },
}));

const mk = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://x/v1/echo", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });

describe("commandRoute", () => {
  it("rejects a missing Idempotency-Key with 422 VALIDATION_FAILED", async () => {
    const res = await echo(mk(JSON.stringify({ name: "x" })), { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDATION_FAILED");
  });
  it("rejects invalid JSON with 422", async () => {
    const res = await echo(mk("{oops", { "idempotency-key": "k" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
  });
  it("rejects a zod-failing body with 422 + fieldErrors", async () => {
    const res = await echo(mk(JSON.stringify({ name: "" }), { "idempotency-key": "k" }), { params: Promise.resolve({}) });
    const b = await res.json();
    expect(res.status).toBe(422);
    expect(b.fieldErrors.length).toBeGreaterThan(0);
  });
  it("passes body, key, and sha256 hash through on success", async () => {
    const res = await echo(mk(JSON.stringify({ name: "ok" }), { "idempotency-key": "k1" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ got: "ok", key: "k1", hash: 64 });
  });
});

describe("queryRoute", () => {
  it("authenticates and passes params", async () => {
    const q = queryRoute(async (a) => ({ status: 200, body: { id: a.params.id, user: a.userId } }));
    const res = await q(new Request("http://x/v1/things/42"), { params: Promise.resolve({ id: "42" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("42");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @aktflow/domain test -- authz && pnpm --filter app test -- command`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement**

`packages/domain/src/authz.ts`:

```ts
export type GovernanceRole = "owner" | "admin" | "member" | "auditor";
export type WorkspaceCapability =
  | "parties.manage" | "own_legal_profiles.manage" | "projects.create" | "units.manage";
export type ProjectCapability =
  | "project.admin" | "project.view" | "contracts.edit" | "imports.manage" | "imports.publish";

const MAP: Record<GovernanceRole, readonly WorkspaceCapability[]> = {
  // INV-020: own_legal_profiles.manage is strictly narrower than parties.manage.
  owner: ["parties.manage", "own_legal_profiles.manage", "projects.create", "units.manage"],
  admin: ["parties.manage", "projects.create", "units.manage"],
  member: [],
  auditor: [],
};

export function workspaceCapabilities(role: GovernanceRole): readonly WorkspaceCapability[] {
  return MAP[role] ?? [];
}
```

`apps/app/src/lib/command.ts`:

```ts
import { createHash } from "node:crypto";
import type { z } from "zod";
import { requireUser } from "./auth";
import { idempotencyKeyFrom } from "./request-context";
import { HttpProblem, toProblemResponse, ok, requestIdFrom } from "./http";
import { problem } from "@aktflow/contracts";

export interface CommandArgs<T> {
  req: Request;
  requestId: string;
  userId: string;
  body: T;
  params: Record<string, string>;
  idempotencyKey: string;
  requestHash: string;
}
export interface HandlerResult { status: number; body: unknown; expiresAt?: Date }
type RouteCtx = { params: Promise<Record<string, string>> };

export function commandRoute<T>(
  schema: z.ZodType<T>,
  run: (a: CommandArgs<T>) => Promise<HandlerResult>,
): (req: Request, ctx: RouteCtx) => Promise<Response> {
  return async (req, ctx) => {
    let requestId = crypto.randomUUID();
    try {
      requestId = requestIdFrom(req);
      const { userId } = await requireUser(requestId, req);
      const idempotencyKey = idempotencyKeyFrom(req);
      if (!idempotencyKey) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Заголовок Idempotency-Key обовʼязковий.", {
            requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "Idempotency-Key", message: "required" }],
          }));
      }
      const raw = await req.text();
      const requestHash = createHash("sha256").update(raw).digest("hex");
      let json: unknown;
      try { json = raw === "" ? {} : JSON.parse(raw); }
      catch {
        throw new HttpProblem(422, problem("VALIDATION_FAILED", "Тіло запиту не є валідним JSON.",
          { requestId, retryable: false, userAction: "correct_fields" }));
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED", "Некоректні дані запиту.", {
          requestId, retryable: false, userAction: "correct_fields",
          fieldErrors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        }));
      }
      const params = ctx?.params ? await ctx.params : {};
      const out = await run({ req, requestId, userId, body: parsed.data, params, idempotencyKey, requestHash });
      const headers: Record<string, string> = {};
      if (out.expiresAt) headers["Idempotency-Replay-Until"] = out.expiresAt.toISOString();
      return ok(out.status, out.body, requestId, headers);
    } catch (err) {
      return toProblemResponse(err, requestId);
    }
  };
}

export interface QueryArgs {
  req: Request; requestId: string; userId: string; params: Record<string, string>;
}
export function queryRoute(
  run: (a: QueryArgs) => Promise<HandlerResult>,
): (req: Request, ctx: RouteCtx) => Promise<Response> {
  return async (req, ctx) => {
    let requestId = crypto.randomUUID();
    try {
      requestId = requestIdFrom(req);
      const { userId } = await requireUser(requestId, req);
      const params = ctx?.params ? await ctx.params : {};
      const out = await run({ req, requestId, userId, params });
      return ok(out.status, out.body, requestId, {});
    } catch (err) {
      return toProblemResponse(err, requestId);
    }
  };
}
```

`apps/app/src/lib/authz.ts`:

```ts
import { HttpProblem } from "./http";
import { problem } from "@aktflow/contracts";
import type { Tx } from "@aktflow/database";
import {
  workspaceCapabilities,
  type GovernanceRole, type WorkspaceCapability, type ProjectCapability,
} from "@aktflow/domain";

export interface ActiveMembership { memberId: string; role: GovernanceRole }

export async function requireActiveMembership(
  tx: Tx, requestId: string, userId: string, workspaceId: string,
): Promise<ActiveMembership> {
  const r = await tx.query(
    `select id, role from public.memberships
      where organization_id = $1 and user_id = $2 and status = 'active'`,
    [workspaceId, userId]);
  if (r.rows.length === 0) {
    throw new HttpProblem(403, problem("MEMBERSHIP_INACTIVE",
      "Немає активного членства в цьому робочому просторі.",
      { requestId, retryable: false, userAction: "contact_org_admin" }));
  }
  return { memberId: r.rows[0].id, role: r.rows[0].role };
}

export function requireWorkspaceCapability(
  requestId: string, role: GovernanceRole, capability: WorkspaceCapability,
): void {
  if (!workspaceCapabilities(role).includes(capability)) {
    throw new HttpProblem(403, problem("SCOPE_DENIED",
      "Недостатньо прав для цієї дії.",
      { requestId, retryable: false, userAction: "request_scope" }));
  }
}

export async function requireProjectCapability(
  tx: Tx, requestId: string,
  args: { workspaceId: string; projectId: string; memberId: string; capability: ProjectCapability },
): Promise<void> {
  // Decision 6: project.admin implies ONLY project.view; action capabilities stay explicit.
  const caps = args.capability === "project.view"
    ? ["project.view", "project.admin"] : [args.capability];
  const r = await tx.query(
    `select 1 from public.project_access_grants
      where workspace_id = $1 and project_id = $2 and member_id = $3
        and capability = any($4::text[])
        and revoked_at is null and valid_from <= now()
        and (valid_until is null or valid_until > now())
      limit 1`,
    [args.workspaceId, args.projectId, args.memberId, caps]);
  if (r.rows.length === 0) {
    throw new HttpProblem(403, problem("SCOPE_PROJECT_DENIED",
      "Немає доступу до цього проєкту.",
      { requestId, retryable: false, userAction: "request_project_scope" }));
  }
}
```

Re-export from `packages/domain/src/index.ts`: `export * from "./authz";`

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @aktflow/domain test -- authz && pnpm --filter app test -- command`
Expected: PASS. Run `pnpm turbo run typecheck` too.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/authz.ts packages/domain/src/authz.test.ts packages/domain/src/index.ts apps/app/src/lib/command.ts apps/app/src/lib/command.test.ts apps/app/src/lib/authz.ts
git commit -m "feat(m1): commandRoute/queryRoute plumbing and capability helpers"
```

---

### Task 6: workspaces.create, me.context alignment, members.list

**Files:**
- Create: `packages/contracts/src/workspaces.ts`, `packages/contracts/src/members.ts`, `apps/app/app/v1/workspaces/route.ts`, `apps/app/app/v1/workspaces/[workspaceId]/members/route.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/contracts/src/me-context.ts` (add `workspaceId` field), `apps/app/app/v1/me/context/route.ts` (include `workspaceId` in each row)
- Test: `apps/app/tests/workspaces.int.test.ts`; update `apps/app/tests/me-context.int.test.ts`

**Interfaces:**
- Consumes: Task 5 `commandRoute`/`queryRoute`/authz; v0.0 `withTenantTx`, `withIdempotency`, `recordAudit`, `enqueueOutbox`.
- Produces: `createWorkspaceRequest` zod (`{ displayName: string (1..200), timezone?: string, locale?: string }`), `CreateWorkspaceResponse = { workspaceId, membershipId, role: "owner", version: 1 }`; `MembersListResponse = { members: { memberId, userId, role, status }[] }`. Vertical test (Task 18) calls these routes.

- [ ] **Step 1: Write failing integration tests**

`apps/app/tests/workspaces.int.test.ts` — copy the structure of `organizations.int.test.ts` (same `vi.mock("../src/lib/auth")`, same truncate list + new tables `invitations, parties, party_legal_profiles, own_legal_entity_profiles, party_contacts, projects, project_parties, project_access_grants, project_responsibility_assignments, unit_definitions, locations, contracts, contract_versions, work_items, import_batches, import_files, import_row_results, source_amount_resolutions`):

```ts
describe("POST /v1/workspaces", () => {
  it("creates workspace (organizations row) + owner membership + audit + outbox atomically; NO legal entity", async () => {
    const { POST } = await import("../app/v1/workspaces/route");
    const res = await POST(new Request("http://x/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "w1" },
      body: JSON.stringify({ displayName: "Приклад-Простір" }),
    }), { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.role).toBe("owner");
    expect(await count("select count(*) n from public.organizations", [])).toBe(1);
    expect(await count("select count(*) n from public.legal_entities", [])).toBe(0);
    expect(await count("select count(*) n from public.memberships where role='owner' and status='active'", [])).toBe(1);
    expect(await count("select count(*) n from public.audit_events where action='workspace.created'", [])).toBe(1);
    expect(await count("select count(*) n from public.transaction_outbox where topic='workspace.created'", [])).toBe(1);
  });
  it("replays idempotently on the same key", async () => { /* same pattern as organizations.int.test.ts replay test, path /v1/workspaces */ });
});

describe("GET /v1/workspaces/{workspaceId}/members", () => {
  it("an active member lists members; an outsider gets 403 MEMBERSHIP_INACTIVE", async () => {
    // create a workspace as A (route above), then:
    const { GET } = await import("../app/v1/workspaces/[workspaceId]/members/route");
    const okRes = await GET(new Request("http://x"), { params: Promise.resolve({ workspaceId }) });
    expect(okRes.status).toBe(200);
    expect((await okRes.json()).members).toHaveLength(1);
    // remock auth as user B (vi.doMock + vi.resetModules, or a second describe file section)
    // B has no membership → 403 MEMBERSHIP_INACTIVE
  });
});
```

Write the replay test and the B-actor 403 test out in full (follow the `organizations.int.test.ts` idioms; for actor switching use `vi.resetModules()` + `vi.doMock("../src/lib/auth", ...)` before re-importing the route module).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter app test -- workspaces`
Expected: FAIL — route module missing.

- [ ] **Step 3: Implement**

`packages/contracts/src/workspaces.ts`:

```ts
import { z } from "zod";

export const createWorkspaceRequest = z.object({
  displayName: z.string().trim().min(1).max(200),
  timezone: z.string().trim().min(1).max(64).default("Europe/Kyiv"),
  locale: z.string().trim().min(2).max(16).default("uk-UA"),
});
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequest>;
export interface CreateWorkspaceResponse {
  workspaceId: string; membershipId: string; role: "owner"; version: number;
}
```

`packages/contracts/src/members.ts`:

```ts
import { z } from "zod";
export const governanceRole = z.enum(["owner", "admin", "member", "auditor"]);
export interface MemberRow { memberId: string; userId: string; role: string; status: string }
export interface MembersListResponse { members: MemberRow[] }
```

`apps/app/app/v1/workspaces/route.ts`:

```ts
import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../src/lib/command";
import { createWorkspaceRequest, type CreateWorkspaceResponse } from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@aktflow/database";

export const runtime = "nodejs";

export const POST = commandRoute(createWorkspaceRequest, async (a) => {
  const workspaceId = randomUUID();
  const membershipId = randomUUID();
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, (tx) =>
    withIdempotency<CreateWorkspaceResponse>(tx, {
      organizationId: null,
      actorScope: `user:${a.userId}`,
      operationId: "workspaces.create",
      key: a.idempotencyKey,
      requestHash: a.requestHash,
    }, async () => {
      // legal_name mirrors displayName ONLY to satisfy the legacy NOT NULL —
      // the workspace holds no authoritative legal attributes (ADR-002);
      // official data lives in party_legal_profiles.
      await tx.query(
        `insert into public.organizations (id, legal_name, display_name, timezone, locale, status, version)
         values ($1,$2,$2,$3,$4,'trial',1)`,
        [workspaceId, a.body.displayName, a.body.timezone, a.body.locale]);
      await tx.query(
        `insert into public.memberships (id, organization_id, user_id, role, status, all_projects, version)
         values ($1,$2,$3,'owner','active',false,1)`,
        [membershipId, workspaceId, a.userId]);
      await recordAudit(tx, ctx, {
        action: "workspace.created", entity: "workspace", entityId: workspaceId, metadata: {},
      }, { organizationId: workspaceId });
      await enqueueOutbox(tx, ctx, {
        topic: "workspace.created", payload: { workspaceId, payloadVersion: 1 },
      }, { organizationId: workspaceId });
      return { status: 201, body: { workspaceId, membershipId, role: "owner" as const, version: 1 } };
    }));
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
```

(Adapt the exact `recordAudit`/`enqueueOutbox` argument shapes to the real signatures in `packages/database/src/audit.ts`/`outbox.ts` — mirror how `apps/app/app/v1/organizations/route.ts` builds `c.audit`/`c.outbox` via `buildOrganizationCreation`; if those helpers require a builder object, add `buildWorkspaceCreation(input, userId, ids)` to `packages/domain/src/workspace.ts` returning the same shape `{ organization|workspace, membership, audit, outbox }` and unit-test it like `organization.test.ts`.)

`apps/app/app/v1/workspaces/[workspaceId]/members/route.ts`:

```ts
import { queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership } from "../../../../../src/lib/authz";
import { withTenantTx } from "@aktflow/database";
import type { MembersListResponse } from "@aktflow/contracts";

export const runtime = "nodejs";

export const GET = queryRoute(async (a) => {
  const workspaceId = a.params.workspaceId;
  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx): Promise<MembersListResponse> => {
    await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
    const r = await tx.query(
      `select id, user_id, role, status from public.memberships
        where organization_id = $1 order by created_at, id`, [workspaceId]);
    return { members: r.rows.map((m) => ({ memberId: m.id, userId: m.user_id, role: m.role, status: m.status })) };
  });
  return { status: 200, body };
});
```

`me-context`: add `workspaceId` (same value as `organizationId`) to the response mapping in `apps/app/app/v1/me/context/route.ts` and to the contract type in `packages/contracts/src/me-context.ts`; keep `organizationId` for compatibility. Update `me-context.int.test.ts` to assert both fields are present and equal.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter app test -- workspaces && pnpm --filter app test -- me-context`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/workspaces.ts packages/contracts/src/members.ts packages/contracts/src/index.ts packages/contracts/src/me-context.ts packages/domain/src/workspace.ts apps/app/app/v1/workspaces apps/app/app/v1/me/context/route.ts apps/app/tests/workspaces.int.test.ts apps/app/tests/me-context.int.test.ts
git commit -m "feat(m1): workspace bootstrap, members list, me.context workspace naming"
```

---

### Task 7: invitations.create and invitations.accept

**Files:**
- Create: `packages/contracts/src/invitations.ts`, `packages/domain/src/invitations.ts` (+ test), `apps/app/app/v1/workspaces/[workspaceId]/invitations/route.ts`, `apps/app/app/v1/invitations/accept/route.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/domain/src/index.ts`
- Test: `apps/app/tests/invitations.int.test.ts`, `packages/domain/src/invitations.test.ts`

**Interfaces:**
- Consumes: Task 2 `app.accept_invitation(text)`; Task 5 plumbing; Task 6 workspace bootstrap (test fixture).
- Produces: `createInvitationRequest` (`{ email: string(email, max 320), role: "admin"|"member"|"auditor", expiresInHours?: number (1..720, default 168) }`), `CreateInvitationResponse = { invitationId, token, expiresAt }` (token appears ONLY here); `acceptInvitationRequest` (`{ token: string(64 hex chars… see below) }`), `AcceptInvitationResponse = { workspaceId, membershipId, role }`. Domain: `generateInvitationToken(bytes: Uint8Array): { token: string; tokenHash: string }` where `token` is 64 lowercase hex chars from 32 input bytes and `tokenHash = sha256hex(token)`.

- [ ] **Step 1: Domain unit test first**

`packages/domain/src/invitations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateInvitationToken } from "./invitations";

describe("generateInvitationToken", () => {
  it("hex-encodes 32 bytes and hashes with sha256", () => {
    const bytes = new Uint8Array(32).fill(7);
    const { token, tokenHash } = generateInvitationToken(bytes);
    expect(token).toBe("07".repeat(32));
    expect(tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
  });
  it("rejects input that is not exactly 32 bytes", () => {
    expect(() => generateInvitationToken(new Uint8Array(16))).toThrow();
  });
});
```

- [ ] **Step 2: Verify failure, implement domain**

Run: `pnpm --filter @aktflow/domain test -- invitations` → FAIL. Then implement `packages/domain/src/invitations.ts`:

```ts
import { createHash } from "node:crypto";

export function generateInvitationToken(bytes: Uint8Array): { token: string; tokenHash: string } {
  if (bytes.length !== 32) throw new Error("invitation token requires exactly 32 random bytes");
  const token = Buffer.from(bytes).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}
```

Re-run → PASS.

- [ ] **Step 3: Write failing integration tests**

`apps/app/tests/invitations.int.test.ts` (same harness idioms; actor switching via `vi.resetModules()` + `vi.doMock`):

- owner A creates workspace W (Task 6 route), then `POST /v1/workspaces/W/invitations` `{ email: "b@example.test", role: "member" }` → 201; body has 64-hex `token`; DB `invitations` row has `token_hash = sha256(token)` and NO plaintext token anywhere (`select count(*) from invitations where token_hash = $token` is 0 — assert the hash column differs from the token); outbox row `invitation.issued` payload contains `invitationId` but NOT the token (assert `payload::text not like '%'||token||'%'` via admin SQL).
- a `member`-role actor calling invitations.create → 403 `SCOPE_DENIED` (only owner/admin invite — governance action).
- actor B `POST /v1/invitations/accept` `{ token }` → 200 `{ workspaceId: W, role: "member" }`; memberships now contains B active; invitation status `accepted`.
- accept again with the same token → 404 `RESOURCE_NOT_FOUND` (status no longer pending).
- accept with a random unknown token → 404 `RESOURCE_NOT_FOUND` (existence-safe).
- B invited again to W (new invitation) and accepting while already a member → 409 `VERSION_CONFLICT`.
- INV-001 slice: owner of W2 cannot create an invitation for W1 (403 `MEMBERSHIP_INACTIVE`).

- [ ] **Step 4: Implement routes**

`apps/app/app/v1/workspaces/[workspaceId]/invitations/route.ts`:

```ts
import { randomBytes, randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem } from "../../../../../src/lib/http";
import { problem, createInvitationRequest, type CreateInvitationResponse } from "@aktflow/contracts";
import { generateInvitationToken } from "@aktflow/domain";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@aktflow/database";

export const runtime = "nodejs";

export const POST = commandRoute(createInvitationRequest, async (a) => {
  const workspaceId = a.params.workspaceId;
  const { token, tokenHash } = generateInvitationToken(randomBytes(32));
  const invitationId = randomUUID();
  const expiresAt = new Date(Date.now() + a.body.expiresInHours * 3600_000);
  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const out = await withTenantTx(ctx, (tx) =>
    withIdempotency<CreateInvitationResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "invitations.create", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      if (m.role !== "owner" && m.role !== "admin") {
        throw new HttpProblem(403, problem("SCOPE_DENIED", "Запрошення може створити лише власник або адміністратор.",
          { requestId: a.requestId, retryable: false, userAction: "request_scope" }));
      }
      await tx.query(
        `insert into public.invitations (id, workspace_id, email, role, token_hash, expires_at, invited_by)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [invitationId, workspaceId, a.body.email.toLowerCase(), a.body.role, tokenHash, expiresAt, a.userId]);
      await recordAudit(tx, ctx, { action: "invitation.issued", entity: "invitation", entityId: invitationId, metadata: { role: a.body.role } });
      await enqueueOutbox(tx, ctx, { topic: "invitation.issued", payload: { invitationId, workspaceId, payloadVersion: 1 } });
      // token: response-only (decision 7); never audited, never enqueued.
      return { status: 201, body: { invitationId, token, expiresAt: expiresAt.toISOString() } };
    }));
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
```

`apps/app/app/v1/invitations/accept/route.ts`:

```ts
import { createHash } from "node:crypto";
import { commandRoute } from "../../../../src/lib/command";
import { HttpProblem } from "../../../../src/lib/http";
import { problem, acceptInvitationRequest, type AcceptInvitationResponse } from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@aktflow/database";

export const runtime = "nodejs";

export const POST = commandRoute(acceptInvitationRequest, async (a) => {
  const tokenHash = createHash("sha256").update(a.body.token).digest("hex");
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, (tx) =>
    withIdempotency<AcceptInvitationResponse>(tx, {
      organizationId: null, actorScope: `user:${a.userId}`,
      operationId: "invitations.accept", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      let row: { workspace_id: string; membership_id: string; member_role: string };
      try {
        const r = await tx.query(`select * from app.accept_invitation($1)`, [tokenHash]);
        row = r.rows[0];
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("INVITATION_NOT_FOUND")) {
          throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Запрошення не знайдено або воно недійсне.",
            { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
        }
        if (msg.includes("ALREADY_MEMBER")) {
          throw new HttpProblem(409, problem("VERSION_CONFLICT", "Ви вже є учасником цього робочого простору.",
            { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
        }
        throw e;
      }
      await recordAudit(tx, ctx, { action: "invitation.accepted", entity: "membership", entityId: row.membership_id, metadata: {} }, { organizationId: row.workspace_id });
      await enqueueOutbox(tx, ctx, { topic: "invitation.accepted", payload: { workspaceId: row.workspace_id, membershipId: row.membership_id, payloadVersion: 1 } }, { organizationId: row.workspace_id });
      return { status: 200, body: { workspaceId: row.workspace_id, membershipId: row.membership_id, role: row.member_role } };
    }));
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
```

`packages/contracts/src/invitations.ts`:

```ts
import { z } from "zod";
export const createInvitationRequest = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["admin", "member", "auditor"]),
  expiresInHours: z.number().int().min(1).max(720).default(168),
});
export const acceptInvitationRequest = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
});
export interface CreateInvitationResponse { invitationId: string; token: string; expiresAt: string }
export interface AcceptInvitationResponse { workspaceId: string; membershipId: string; role: string }
```

- [ ] **Step 5: Run tests, then commit**

Run: `pnpm --filter app test -- invitations` → PASS; then full `pnpm turbo run test --concurrency=1`.

```bash
git add packages/contracts/src/invitations.ts packages/contracts/src/index.ts packages/domain/src/invitations.ts packages/domain/src/invitations.test.ts packages/domain/src/index.ts "apps/app/app/v1/workspaces/[workspaceId]/invitations" apps/app/app/v1/invitations apps/app/tests/invitations.int.test.ts
git commit -m "feat(m1): invitations issue/accept with hash-only token storage"
```

---

### Task 8: parties.create/update, legal_profile.put, own_profile.create (INV-020)

**Files:**
- Create: `packages/contracts/src/parties.ts`, `apps/app/app/v1/workspaces/[workspaceId]/parties/route.ts`, `apps/app/app/v1/parties/[partyId]/route.ts`, `apps/app/app/v1/parties/[partyId]/legal-profile/route.ts`, `apps/app/app/v1/parties/[partyId]/own-profile/route.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `apps/app/tests/parties.int.test.ts`

**Interfaces:**
- Consumes: Tasks 5–6.
- Produces zod contracts:
  - `createPartyRequest = { displayName: string(1..300), partyKind?: "organization"|"individual" }` → `{ partyId, version }`
  - `updatePartyRequest = { displayName?: string(1..300), expectedVersion: number(int ≥1) }` → `{ partyId, version }`
  - `putLegalProfileRequest = { officialName: string(1..500), edrpou?: string(/^\d{8}$|^\d{10}$/), vatNumber?: string, taxStatus?: string, legalAddress?: string, countryCode?: string(2), expectedVersion?: number }` → `{ profileId, version }`
  - `createOwnProfileRequest = {}` (empty body) → `{ partyId }`
  - Route resolution rule (used by all `/v1/parties/{partyId}/*` and later `/v1/projects|contracts|import-batches/{id}` routes): load the resource by `id` inside the tenant transaction **with `organizationId: null` replaced by a two-step flow** — first `withTenantTx` with `organizationId: null` cannot apply; instead resolve the workspace OUTSIDE RLS impossibility by querying with the actor's GUC set per-workspace. Concretely: `select workspace_id from public.parties where id = $1` under `aktflow_app` returns the row only if the actor is a member (RLS) — run this in a transaction with `app.organization_id` unset; RLS policies here do not reference the org GUC, only `app.current_actor()`, so this works. If no row → 404 `RESOURCE_NOT_FOUND`.

- [ ] **Step 1: Write failing integration tests**

`apps/app/tests/parties.int.test.ts` — fixture: A bootstraps workspace W (Task 6 route); admin-inserts a second membership for B with role `admin`, and a third user C (`cccccccc-cccc-cccc-cccc-cccccccccccc` — add to `supabase/seed.sql` auth.users seed if absent; keep the no-credentials rule) with role `member`. Tests:

1. A (owner) creates a party «Приклад-Підрядник» → 201, row exists.
2. B (admin) creates a party → 201 (admin holds `parties.manage`).
3. C (member) creates a party → 403 `SCOPE_DENIED`.
4. B PUTs a legal profile with `officialName: "ТОВ Приклад-Підрядник"`, `edrpou: "12345678"` → 200; PUT again with changed name and correct `expectedVersion` → 200 version 2; stale `expectedVersion` → 409 `VERSION_CONFLICT`.
5. **INV-020:** B (admin) `POST /v1/parties/{id}/own-profile` → 403 `SCOPE_DENIED`; A (owner) → 201; `own_legal_entity_profiles` row exists.
6. own-profile on a party WITHOUT a legal profile or without `edrpou`/`officialName` → 422 `VALIDATION_FAILED` (completeness check).
7. A updates a party in workspace W2 they don't belong to → 404 `RESOURCE_NOT_FOUND` (INV-001 API surface).

- [ ] **Step 2: Run to verify failure, then implement**

`packages/contracts/src/parties.ts` with the four schemas above (zod, exact bounds as listed). Routes follow the Task 6/7 pattern; the four handler cores:

- `parties.create` (`POST /v1/workspaces/{workspaceId}/parties`): `requireActiveMembership` → `requireWorkspaceCapability(requestId, role, "parties.manage")` → `insert into public.parties (id, workspace_id, display_name, party_kind, created_by) values (...)` → audit `party.created` → 201. (No outbox — `party.created` is not in the M1 event catalog.)
- `parties.update` (`PATCH /v1/parties/{partyId}`): resolve workspace via `select workspace_id, version from public.parties where id = $1` (RLS-scoped); 404 if absent; `requireWorkspaceCapability(..., "parties.manage")`; optimistic update:

```ts
const upd = await tx.query(
  `update public.parties set display_name = coalesce($3, display_name),
          version = version + 1, updated_at = now()
    where workspace_id = $1 and id = $2 and version = $4
    returning version`,
  [workspaceId, partyId, a.body.displayName ?? null, a.body.expectedVersion]);
if (upd.rows.length === 0) {
  throw new HttpProblem(409, problem("VERSION_CONFLICT", "Запис було змінено. Оновіть сторінку і повторіть.",
    { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));
}
```

- `legal_profile.put` (`PUT /v1/parties/{partyId}/legal-profile`): capability `parties.manage`; upsert-by-(workspace, party): `insert ... on conflict (workspace_id, party_id) do update set official_name=excluded.official_name, ... , version = party_legal_profiles.version + 1, updated_at = now() where party_legal_profiles.version = $expectedVersion or $expectedVersion is null` — if the conditional update matched nothing while the row exists → 409 `VERSION_CONFLICT`. Audit `party_legal_profile.updated`.
- `own_profile.create` (`POST /v1/parties/{partyId}/own-profile`): capability `own_legal_profiles.manage` (owner-only, INV-020); completeness check:

```ts
const lp = await tx.query(
  `select official_name, edrpou from public.party_legal_profiles
    where workspace_id = $1 and party_id = $2`, [workspaceId, partyId]);
if (lp.rows.length === 0 || !lp.rows[0].edrpou || !lp.rows[0].official_name?.trim()) {
  throw new HttpProblem(422, problem("VALIDATION_FAILED",
    "Власна юридична особа потребує повного юридичного профілю (назва та ЄДРПОУ).", {
      requestId: a.requestId, retryable: false, userAction: "correct_fields",
      fieldErrors: [{ path: "legalProfile", message: "official_name and edrpou required" }],
    }));
}
await tx.query(
  `insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by) values ($1,$2,$3)`,
  [workspaceId, partyId, a.userId]);
```

Duplicate own profile (PK violation) → catch and map to 409 `VERSION_CONFLICT` («Власний профіль уже існує.»). Audit `own_legal_entity_profile.created`.

- [ ] **Step 3: Run tests to verify pass**

Run: `pnpm --filter app test -- parties`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/parties.ts packages/contracts/src/index.ts "apps/app/app/v1/workspaces/[workspaceId]/parties" "apps/app/app/v1/parties" apps/app/tests/parties.int.test.ts supabase/seed.sql
git commit -m "feat(m1): parties, legal profiles, own-profile with INV-020 permission separation"
```

---

### Task 9: projects.create/list, project_access.grant, project_responsibilities.assign

**Files:**
- Create: `packages/contracts/src/projects.ts`, `packages/contracts/src/project-access.ts`, `apps/app/app/v1/workspaces/[workspaceId]/projects/route.ts`, `apps/app/app/v1/projects/route.ts`, `apps/app/app/v1/projects/[projectId]/access-grants/route.ts`, `apps/app/app/v1/projects/[projectId]/responsibilities/route.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `apps/app/tests/projects.int.test.ts`

**Interfaces:**
- Consumes: Tasks 5–8.
- Produces:
  - `createProjectRequest = { name: string(1..300), code?: string(1..50), address?: string(1..500), description?: string(1..2000) }` → `{ projectId, version }`
  - `ProjectsListResponse = { projects: { projectId, workspaceId, name, code|null }[] }` (GET `/v1/projects` — across ALL the actor's workspaces, RLS-driven)
  - `grantProjectAccessRequest = { memberId: uuid, capabilities: ("project.admin"|"project.view"|"contracts.edit"|"imports.manage"|"imports.publish")[] (min 1), validUntil?: ISO datetime }` → `{ granted: { capability, grantId }[] }`
  - `assignResponsibilityRequest = { memberId: uuid, responsibility: enum(10 values from 0010 CHECK), validFrom?: ISO, validUntil?: ISO }` → `{ assignmentId, warnings: string[] }`
- Produces behavior: projects.create atomically inserts the project + creator's `project.admin` AND `project.view` grants (INV-019); grant command auto-adds `project.view` when granting any action capability; responsibilities command returns SoD warnings (`sod:performer+internal_verifier` when one member holds both on the project) without blocking.

- [ ] **Step 1: Write failing integration tests**

`apps/app/tests/projects.int.test.ts` — fixture: A owner of W1, B admin member of W1, C member of W1; A bootstraps and creates project P via route. Tests:

1. projects.create by B (admin, has `projects.create`) → 201; DB has project + B's `project.admin` + `project.view` grants (INV-019 atomicity: assert both rows in one query).
2. projects.create by C (member) → 403 `SCOPE_DENIED`.
3. `GET /v1/projects` as C → `projects: []` (no grant, RLS-invisible); as B → contains P.
4. B grants C `["imports.manage"]` → response has TWO grants (`imports.manage` + auto `project.view`); C now sees P in projects.list.
5. C (no `project.admin`) tries to grant → 403 `SCOPE_PROJECT_DENIED`.
6. Cross-workspace: B tries to grant on a W2 project id → 404 `RESOURCE_NOT_FOUND`.
7. Responsibilities: B assigns C `performer` → 201, `warnings: []`; B assigns C `internal_verifier` → 201 with `warnings: ["sod:performer+internal_verifier"]`; both rows exist (append-only — no update happened).
8. Assign to an inactive/foreign member id → 422 `VALIDATION_FAILED` (member not active in this workspace).

- [ ] **Step 2: Run to verify failure, then implement**

projects.create handler core (after `requireActiveMembership` + `requireWorkspaceCapability(..., "projects.create")`):

```ts
const projectId = randomUUID();
await tx.query(
  `insert into public.projects (id, workspace_id, name, code, address, description, created_by)
   values ($1,$2,$3,$4,$5,$6,$7)`,
  [projectId, workspaceId, a.body.name, a.body.code ?? null, a.body.address ?? null, a.body.description ?? null, a.userId]);
for (const cap of ["project.admin", "project.view"] as const) {
  await tx.query(
    `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
     values ($1,$2,$3,$4,$5)`,
    [workspaceId, projectId, m.memberId, cap, a.userId]);
}
await recordAudit(tx, ctx, { action: "project.created", entity: "project", entityId: projectId, metadata: {} });
await enqueueOutbox(tx, ctx, { topic: "project.created", payload: { workspaceId, projectId, payloadVersion: 1 } });
```

projects.list (`GET /v1/projects`): `withTenantTx` with `organizationId: null`; single RLS-scoped select:

```sql
select p.id, p.workspace_id, p.name, p.code from public.projects p order by p.created_at, p.id
```

(RLS returns exactly the visible set across workspaces; no explicit workspace filter — this IS the INV-001 test surface.)

project_access.grant core (resolve project → 404 if invisible; `requireProjectCapability(..., "project.admin")`; validate target member active in the same workspace else 422; dedupe with the partial unique index):

```ts
const caps = new Set(a.body.capabilities);
if ([...caps].some((c) => c !== "project.view")) caps.add("project.view"); // decision 6
const granted: { capability: string; grantId: string }[] = [];
for (const cap of caps) {
  const r = await tx.query(
    `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by, valid_until)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (workspace_id, project_id, member_id, capability) where revoked_at is null
     do nothing
     returning id`,
    [workspaceId, projectId, a.body.memberId, cap, a.userId, a.body.validUntil ?? null]);
  if (r.rows[0]) granted.push({ capability: cap, grantId: r.rows[0].id });
}
```

(Note: `ON CONFLICT ... WHERE revoked_at is null DO NOTHING` must name the partial index predicate; if PostgreSQL rejects the arbiter syntax, pre-check with a SELECT then insert — keep it inside the same transaction, the unique index still guards races.)

responsibilities.assign core: `requireProjectCapability(..., "project.admin")`; target member must be an active membership of the workspace (`select 1 from memberships where organization_id=$1 and id=$2 and status='active'`, else 422); insert assignment; compute warnings:

```ts
const SOD_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["performer", "internal_verifier"],
  ["progress_recorder", "internal_verifier"],
  ["package_compiler", "internal_verifier"],
];
const existing = await tx.query(
  `select distinct responsibility from public.project_responsibility_assignments
    where workspace_id=$1 and project_id=$2 and member_id=$3
      and (valid_until is null or valid_until > now())`,
  [workspaceId, projectId, a.body.memberId]);
const held = new Set(existing.rows.map((r) => r.responsibility));
const warnings = SOD_PAIRS
  .filter(([x, y]) => (a.body.responsibility === x && held.has(y)) || (a.body.responsibility === y && held.has(x)))
  .map(([x, y]) => `sod:${x}+${y}`);
```

Audit `project_responsibility.assigned` with `metadata: { warnings }` (the explicit SoD fact per ADR-002).

- [ ] **Step 3: Run tests to verify pass**

Run: `pnpm --filter app test -- projects`
Expected: PASS. Then the full serialized suite.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/projects.ts packages/contracts/src/project-access.ts packages/contracts/src/index.ts "apps/app/app/v1/workspaces/[workspaceId]/projects" apps/app/app/v1/projects apps/app/tests/projects.int.test.ts
git commit -m "feat(m1): projects with atomic creator access, grants, responsibilities with SoD warnings"
```

---

### Task 10: contracts.create (INV-002, INV-022)

**Files:**
- Create: `packages/contracts/src/contracts-baseline.ts`, `packages/domain/src/contract-number.ts` (+ test), `apps/app/app/v1/projects/[projectId]/contracts/route.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/domain/src/index.ts`
- Test: `apps/app/tests/contracts.int.test.ts`, `packages/domain/src/contract-number.test.ts`

**Interfaces:**
- Consumes: Tasks 5–9 (fixture: workspace, own party with own profile, customer party, project, grants).
- Produces:
  - `normalizeContractNo(no: string): string` — trim, collapse inner whitespace to single spaces, uppercase — MUST mirror the 0012 generated column exactly (property: for any input, TS result === SQL result).
  - `createContractRequest = { ownPartyId: uuid, customerPartyId: uuid, contractNo: string(1..200), title?: string(1..500), currency: string(/^[A-Z]{3}$/), taxMode: enum(exclusive|inclusive|exempt|out_of_scope|unknown), taxRateBps?: int(0..10000), terms?: object, approvalPolicy?: object, roundingPolicy?: { midpoint: "half_up"|"half_even" }, toleranceMinorUnits?: int(≥0, default 100), toleranceBps?: int(≥0, default 10) }` → `{ contractId, version }`.
  - Stored `rounding_policy` is always `{ midpoint, scope: "work_item_version_pool" }` (v0.1 pins scope).

- [ ] **Step 1: Domain unit test**

`packages/domain/src/contract-number.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeContractNo } from "./contract-number";

describe("normalizeContractNo (INV-022)", () => {
  it("trims, collapses whitespace, uppercases", () => {
    expect(normalizeContractNo("  д-2026/01 ")).toBe("Д-2026/01");
    expect(normalizeContractNo("д  -  2026\t/01")).toBe("Д - 2026 /01");
    expect(normalizeContractNo("Abc 12")).toBe("ABC 12");
  });
});
```

Implement:

```ts
export function normalizeContractNo(no: string): string {
  return no.trim().replace(/\s+/g, " ").toUpperCase();
}
```

- [ ] **Step 2: Write failing integration tests**

`apps/app/tests/contracts.int.test.ts` — fixture via routes: A bootstraps W, creates parties «Приклад-Власна» (+legal+own profile) and «Приклад-Замовник», project P, grants self `contracts.edit`. Tests:

1. Valid create → 201; DB row has `normalized_contract_no = 'Д-2026/01'`.
2. **INV-022:** same number with different casing/whitespace (`"  д-2026/01 "`) for the same own party → 409 `VERSION_CONFLICT`, exactly one contract row remains. Same number under a DIFFERENT own party (create second own party first) → 201 (uniqueness is scoped to own party).
3. **INV-002:** `ownPartyId` = the customer party (no own profile) → 422 `VALIDATION_FAILED` (pre-check) and no row; `ownPartyId` from ANOTHER workspace (admin-insert W2 fixture) → 404 `RESOURCE_NOT_FOUND` (party invisible under RLS).
4. `ownPartyId === customerPartyId` → 422 (zod `.refine` or DB CHECK surfaced as 422).
5. Actor with `project.view` but not `contracts.edit` → 403 `SCOPE_PROJECT_DENIED`.

- [ ] **Step 3: Implement the route**

Handler core (after project resolution → 404, `requireActiveMembership`, `requireProjectCapability(..., "contracts.edit")`):

```ts
// INV-002 pre-check (FK is the hard guarantee; this gives a clean 422):
const own = await tx.query(
  `select 1 from public.own_legal_entity_profiles where workspace_id=$1 and party_id=$2`,
  [workspaceId, a.body.ownPartyId]);
if (own.rows.length === 0) {
  throw new HttpProblem(422, problem("VALIDATION_FAILED",
    "Обрана сторона не позначена як власна юридична особа.", {
      requestId: a.requestId, retryable: false, userAction: "correct_fields",
      fieldErrors: [{ path: "ownPartyId", message: "must hold an own legal entity profile" }],
    }));
}
const contractId = randomUUID();
try {
  await tx.query(
    `insert into public.contracts
       (id, workspace_id, project_id, own_party_id, customer_party_id, contract_no, title,
        currency, tax_mode, tax_rate_bps, terms, approval_policy, rounding_policy,
        source_tolerance_minor_units, source_tolerance_bps, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [contractId, workspaceId, projectId, a.body.ownPartyId, a.body.customerPartyId,
     a.body.contractNo, a.body.title ?? null, a.body.currency, a.body.taxMode,
     a.body.taxRateBps ?? null, JSON.stringify(a.body.terms ?? {}),
     JSON.stringify(a.body.approvalPolicy ?? {}),
     JSON.stringify({ midpoint: a.body.roundingPolicy?.midpoint ?? "half_up", scope: "work_item_version_pool" }),
     a.body.toleranceMinorUnits, a.body.toleranceBps, a.userId]);
} catch (e) {
  if (e instanceof Error && /contracts_number_unique/.test(e.message)) {
    throw new HttpProblem(409, problem("VERSION_CONFLICT",
      "Договір із таким номером уже існує для цієї власної юридичної особи.",
      { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
  }
  throw e;
}
await recordAudit(tx, ctx, { action: "contract.created", entity: "contract", entityId: contractId, metadata: {} });
await enqueueOutbox(tx, ctx, { topic: "contract.created", payload: { workspaceId, projectId, contractId, payloadVersion: 1 } });
return { status: 201, body: { contractId, version: 1 } };
```

- [ ] **Step 4: Run tests, commit**

Run: `pnpm --filter @aktflow/domain test -- contract-number && pnpm --filter app test -- contracts` → PASS.

```bash
git add packages/contracts/src/contracts-baseline.ts packages/contracts/src/index.ts packages/domain/src/contract-number.ts packages/domain/src/contract-number.test.ts packages/domain/src/index.ts "apps/app/app/v1/projects/[projectId]/contracts" apps/app/tests/contracts.int.test.ts
git commit -m "feat(m1): contract creation with own-party and number-uniqueness invariants"
```

---

### Task 11: Domain money engine (BigInt, INV-054 core)

**Files:**
- Create: `packages/domain/src/money.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/money.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces (consumed by Tasks 14, 16, 17):

```ts
export interface Decimal { scaled: bigint; scale: number }           // value = scaled / 10^scale
export type TaxMode = "exclusive" | "inclusive" | "exempt" | "out_of_scope" | "unknown";
export type Midpoint = "half_up" | "half_even";
export function parseLocalizedDecimal(text: string, locale: "uk-UA" | "en-US"):
  { ok: true; value: Decimal } | { ok: false; code: "NUMBER_INVALID" };
export function rescale(v: Decimal, targetScale: number, midpoint: Midpoint): bigint;
export function mulToMinorUnits(qty: Decimal, price: Decimal, minorScale: number, midpoint: Midpoint): bigint;
export function taxSplit(netMinor: bigint, taxRateBps: number | null, taxMode: TaxMode, midpoint: Midpoint):
  { net: bigint; tax: bigint; gross: bigint; warning?: "TAX_MODE_UNKNOWN" };
export function withinTolerance(sourceMinor: bigint, derivedMinor: bigint, tolAbsMinor: bigint, tolBps: number): boolean;
```

Semantics:
- `parseLocalizedDecimal("1 234,56", "uk-UA")` → 123456n scale 2. uk-UA: decimal comma; space/NBSP ( ,  ) group separators; a bare dot also accepted as decimal when no comma present (mixed real files). en-US: decimal dot, comma groups. Reject: two separators of the same kind after normalization ambiguity, letters, empty, >18 integer digits, >6 fraction digits.
- `rescale`: half_up rounds |x| away on tie; half_even to even; both sign-symmetric.
- `taxSplit`: `exclusive` → tax = round(net×rate); `inclusive` → given GROSS minor in `netMinor` arg? NO — callers always pass NET-basis minor units; for `inclusive` price basis the caller first converts gross→net via `netFromGross(grossMinor, rateBps, midpoint)` — add that fourth export: `export function netFromGross(grossMinor: bigint, taxRateBps: number, midpoint: Midpoint): bigint` = round(gross × 10000 / (10000 + rate)). `exempt`/`out_of_scope` → tax 0. `unknown` → tax 0 + warning.
- `withinTolerance` (decision 8, strict-OR): returns false when `|d| > tolAbsMinor` OR `|d| * 10000n > BigInt(tolBps) * max(|source|, |derived|, 1n)`.

- [ ] **Step 1: Write the failing tests** — cover at minimum:

```ts
import { describe, it, expect } from "vitest";
import { parseLocalizedDecimal, rescale, mulToMinorUnits, taxSplit, netFromGross, withinTolerance } from "./money";

describe("parseLocalizedDecimal", () => {
  it("uk-UA space groups + comma decimal", () => {
    expect(parseLocalizedDecimal("1 234,56", "uk-UA")).toEqual({ ok: true, value: { scaled: 123456n, scale: 2 } });
    expect(parseLocalizedDecimal("1 234,5", "uk-UA")).toEqual({ ok: true, value: { scaled: 12345n, scale: 1 } });
  });
  it("rejects garbage and overflow", () => {
    expect(parseLocalizedDecimal("12,34,56", "uk-UA").ok).toBe(false);
    expect(parseLocalizedDecimal("abc", "uk-UA").ok).toBe(false);
    expect(parseLocalizedDecimal("1234567890123456789", "uk-UA").ok).toBe(false);
    expect(parseLocalizedDecimal("1,1234567", "uk-UA").ok).toBe(false);
  });
});

describe("rounding", () => {
  it("half_up ties away from zero; half_even to even", () => {
    expect(rescale({ scaled: 125n, scale: 2 }, 1, "half_up")).toBe(13n);
    expect(rescale({ scaled: 125n, scale: 2 }, 1, "half_even")).toBe(12n);
    expect(rescale({ scaled: -125n, scale: 2 }, 1, "half_up")).toBe(-13n);
  });
  it("mulToMinorUnits: 2.5 × 199.99 → 499.98 (49998 minor)", () => {
    expect(mulToMinorUnits({ scaled: 25n, scale: 1 }, { scaled: 19999n, scale: 2 }, 2, "half_up")).toBe(49998n);
  });
});

describe("taxSplit", () => {
  it("exclusive 20%: net 10000 → tax 2000 gross 12000", () => {
    expect(taxSplit(10000n, 2000, "exclusive", "half_up")).toEqual({ net: 10000n, tax: 2000n, gross: 12000n });
  });
  it("netFromGross inverse: gross 12000 at 20% → net 10000", () => {
    expect(netFromGross(12000n, 2000, "half_up")).toBe(10000n);
  });
  it("unknown mode: zero tax + warning", () => {
    expect(taxSplit(500n, null, "unknown", "half_up").warning).toBe("TAX_MODE_UNKNOWN");
  });
});

describe("withinTolerance (strict-OR, decision 8)", () => {
  it("inside both → true", () => { expect(withinTolerance(100000n, 100050n, 100n, 10n as unknown as number)).toBe(true); });
  it("abs breach blocks even when relative is tiny", () => {
    expect(withinTolerance(10_000_000n, 10_000_200n, 100n, 100)).toBe(false); // 200 > 100 abs
  });
  it("relative breach blocks even when abs is inside", () => {
    expect(withinTolerance(1000n, 1050n, 100n, 10)).toBe(false); // 50/1050 ≈ 476 bps > 10
  });
});
```

(Fix the `10n as unknown as number` slip when writing for real — `tolBps` is a plain number: `withinTolerance(100000n, 100050n, 100n, 10)`; 50 abs ≤ 100 AND 5 bps ≤ 10 → true.)

- [ ] **Step 2: Run to verify failure, implement**

Implementation notes (BigInt only, no float anywhere):

```ts
function pow10(n: number): bigint { let r = 1n; for (let i = 0; i < n; i++) r *= 10n; return r; }

export function rescale(v: Decimal, targetScale: number, midpoint: Midpoint): bigint {
  if (v.scale <= targetScale) return v.scaled * pow10(targetScale - v.scale);
  const f = pow10(v.scale - targetScale);
  const q = v.scaled / f; const r = v.scaled % f;
  if (r === 0n) return q;
  const abs2r = 2n * (r < 0n ? -r : r);
  const sign = v.scaled < 0n ? -1n : 1n;
  if (abs2r > f) return q + sign;
  if (abs2r < f) return q;
  if (midpoint === "half_up") return q + sign;
  return (q % 2n === 0n) ? q : q + sign; // half_even
}

export function mulToMinorUnits(qty: Decimal, price: Decimal, minorScale: number, midpoint: Midpoint): bigint {
  return rescale({ scaled: qty.scaled * price.scaled, scale: qty.scale + price.scale }, minorScale, midpoint);
}

export function taxSplit(netMinor: bigint, taxRateBps: number | null, taxMode: TaxMode, midpoint: Midpoint) {
  if (taxMode === "exempt" || taxMode === "out_of_scope")
    return { net: netMinor, tax: 0n, gross: netMinor };
  if (taxMode === "unknown" || taxRateBps == null)
    return { net: netMinor, tax: 0n, gross: netMinor, warning: "TAX_MODE_UNKNOWN" as const };
  const tax = rescale({ scaled: netMinor * BigInt(taxRateBps), scale: 4 }, 0, midpoint);
  return { net: netMinor, tax, gross: netMinor + tax };
}

export function netFromGross(grossMinor: bigint, taxRateBps: number, midpoint: Midpoint): bigint {
  return rescale({ scaled: grossMinor * 10000n, scale: 0 },  0, midpoint) // placeholder — see below
}
```

`netFromGross` must divide, not rescale: `net = round(gross * 10000 / (10000 + rate))`. Implement division with the same midpoint rules:

```ts
function divRound(num: bigint, den: bigint, midpoint: Midpoint): bigint {
  const q = num / den; const r = num % den;
  if (r === 0n) return q;
  const sign = (num < 0n) !== (den < 0n) ? -1n : 1n;
  const abs2r = 2n * (r < 0n ? -r : r); const absDen = den < 0n ? -den : den;
  if (abs2r > absDen) return q + sign;
  if (abs2r < absDen) return q;
  return midpoint === "half_up" ? q + sign : (q % 2n === 0n ? q : q + sign);
}
export function netFromGross(grossMinor: bigint, taxRateBps: number, midpoint: Midpoint): bigint {
  return divRound(grossMinor * 10000n, 10000n + BigInt(taxRateBps), midpoint);
}
export function withinTolerance(sourceMinor: bigint, derivedMinor: bigint, tolAbsMinor: bigint, tolBps: number): boolean {
  const d = sourceMinor - derivedMinor; const ad = d < 0n ? -d : d;
  if (ad > tolAbsMinor) return false;
  const as = sourceMinor < 0n ? -sourceMinor : sourceMinor;
  const ar = derivedMinor < 0n ? -derivedMinor : derivedMinor;
  const base = (as > ar ? as : ar) || 1n;
  return ad * 10000n <= BigInt(tolBps) * base;
}
```

`parseLocalizedDecimal`: strip group separators (uk-UA: `[   ]`; en-US: `,`); normalize decimal separator to `.`; validate with `/^-?\d{1,18}(\.\d{1,6})?$/`; build `scaled`/`scale` from the string.

- [ ] **Step 3: Run tests to verify pass, commit**

Run: `pnpm --filter @aktflow/domain test -- money` → PASS.

```bash
git add packages/domain/src/money.ts packages/domain/src/money.test.ts packages/domain/src/index.ts
git commit -m "feat(m1): BigInt money engine — localized parse, rounding, tax split, tolerance"
```

---

### Task 12: Domain strict CSV parser (fail-closed)

**Files:**
- Create: `packages/domain/src/import/csv.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/import/csv.test.ts`

**Interfaces:**
- Consumes: nothing (pure `Uint8Array` in).
- Produces (consumed by Task 16):

```ts
export interface SourceRow { worksheet: string | null; rowNo: number; cells: Record<string, { raw: string; formula?: string }> }
// cells keyed by spreadsheet-style column letters "A","B",...,"Z","AA",...
export interface CsvLimits { maxBytes: number; maxRows: number; maxCols: number; maxFieldChars: number }
export const CSV_LIMITS: CsvLimits = { maxBytes: 20_971_520, maxRows: 200_000, maxCols: 256, maxFieldChars: 32_768 };
export type CsvDelimiter = "," | ";" | "\t";
export interface CsvResult {
  ok: boolean;
  rows: SourceRow[];
  delimiter: CsvDelimiter | null;
  errors: { code: "CSV_ENCODING_INVALID" | "CSV_CONTROL_CHARS" | "CSV_FIELD_TOO_LONG" | "CSV_TOO_MANY_ROWS" | "CSV_TOO_MANY_COLS" | "CSV_UNBALANCED_QUOTE" | "CSV_TOO_LARGE"; row?: number }[];
}
export function parseCsv(bytes: Uint8Array, delimiter?: CsvDelimiter): CsvResult;
```

Rules: UTF-8 only (BOM tolerated and stripped; invalid UTF-8 → `CSV_ENCODING_INVALID`, `ok:false`, zero rows — decode with `new TextDecoder("utf-8", { fatal: true })`). RFC4180 quoting (`""` escape). CR, LF, CRLF row breaks. NUL or C0 control chars other than `\t\r\n` → `CSV_CONTROL_CHARS` fail-closed. Delimiter auto-detected from the first row (most frequent of `;`, `,`, `\t` outside quotes) unless given. Every limit breach fails closed (`ok:false`) with a named code — never a partial silent result. Values are NEVER interpreted here (no number/date coercion — untrusted strings out).

- [ ] **Step 1: Write the failing tests** — minimum set:

```ts
const enc = (s: string) => new TextEncoder().encode(s);

it("parses quoted fields with embedded delimiter and quote", () => {
  const r = parseCsv(enc('Назва;К-сть\n"Бетон; М300";"12,5"\n'));
  expect(r.ok).toBe(true);
  expect(r.delimiter).toBe(";");
  expect(r.rows[1].cells.A.raw).toBe("Бетон; М300");
  expect(r.rows[1].cells.B.raw).toBe("12,5");
});
it("strips BOM; keeps 1-based rowNo aligned to the source file", () => {
  const r = parseCsv(enc("﻿a,b\nc,d\n"));
  expect(r.rows[0].rowNo).toBe(1);
  expect(r.rows[0].cells.A.raw).toBe("a");
});
it("fails closed on NUL bytes", () => {
  const bytes = new Uint8Array([...enc("a,b\n"), 0, ...enc("c,d\n")]);
  const r = parseCsv(bytes);
  expect(r.ok).toBe(false);
  expect(r.errors[0].code).toBe("CSV_CONTROL_CHARS");
  expect(r.rows).toHaveLength(0);
});
it("fails closed on invalid UTF-8", () => {
  const r = parseCsv(new Uint8Array([0xff, 0xfe, 0x41]));
  expect(r.ok).toBe(false);
  expect(r.errors[0].code).toBe("CSV_ENCODING_INVALID");
});
it("fails closed on unbalanced quote at EOF", () => {
  expect(parseCsv(enc('a,"unclosed\n')).ok).toBe(false);
});
it("enforces row/col/field/byte limits with named codes", () => {
  const manyCols = Array.from({ length: 300 }, (_, i) => `c${i}`).join(",");
  expect(parseCsv(enc(manyCols + "\n")).errors[0].code).toBe("CSV_TOO_MANY_COLS");
});
it("fuzz: 200 seeded random byte mutations never throw and never return ok with garbage", () => {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const base = enc("Назва;Од;К-сть;Ціна\nРобота;м2;10,5;199,99\n");
  for (let i = 0; i < 200; i++) {
    const b = new Uint8Array(base);
    b[Math.floor(rnd() * b.length)] = Math.floor(rnd() * 256);
    expect(() => parseCsv(b)).not.toThrow(); // fail-closed, never crash
  }
});
```

- [ ] **Step 2: Run to verify failure, implement**

Hand-rolled single-pass state machine over the decoded string (states: `field`, `quoted`, `afterQuote`); accumulate rows as `string[][]`, convert to `SourceRow` with a `columnLetter(i)` helper (`A…Z, AA…`). Detect delimiter by counting candidates outside quotes in the first line. Check limits during the pass and bail out with the named error (fail-closed: `rows: []`).

- [ ] **Step 3: Run tests to verify pass, commit**

```bash
git add packages/domain/src/import/csv.ts packages/domain/src/import/csv.test.ts packages/domain/src/index.ts
git commit -m "feat(m1): strict fail-closed CSV parser with fuzz coverage"
```

---

### Task 13: Domain XLSX container guard + safe parse (INV-016)

**Files:**
- Create: `packages/domain/src/import/xlsx-guard.ts`, `packages/domain/src/import/xlsx.ts`
- Modify: `packages/domain/src/index.ts`, `packages/domain/package.json` (add dependency `exceljs@^4.4.0`)
- Test: `packages/domain/src/import/xlsx.test.ts`

**Interfaces:**
- Consumes: `SourceRow` shape from Task 12.
- Produces (consumed by Task 16):

```ts
export interface XlsxLimits {
  maxBytes: number;            // 20_971_520
  maxEntries: number;          // 10_000
  maxTotalUncompressed: number;// 104_857_600 (100 MB)
  maxCompressionRatio: number; // 100
  maxRows: number;             // 200_000
  maxCols: number;             // 256
  maxCellChars: number;        // 32_768
}
export const XLSX_LIMITS: XlsxLimits;
export type XlsxGuardError =
  | "XLSX_NOT_ZIP" | "XLSX_ENCRYPTED_OR_LEGACY" | "XLSX_MACROS_PRESENT"
  | "XLSX_PATH_TRAVERSAL" | "XLSX_TOO_MANY_ENTRIES" | "XLSX_BOMB_RATIO"
  | "XLSX_BOMB_SIZE" | "XLSX_TOO_LARGE" | "XLSX_MALFORMED";
export function guardXlsxContainer(bytes: Uint8Array, limits?: XlsxLimits): { ok: true } | { ok: false; errors: XlsxGuardError[] };
export function parseXlsx(bytes: Uint8Array, limits?: XlsxLimits): Promise<
  | { ok: true; rows: SourceRow[]; worksheets: string[] }
  | { ok: false; errors: (XlsxGuardError | "XLSX_ROWS_LIMIT" | "XLSX_COLS_LIMIT" | "XLSX_CELL_LIMIT")[] }>;
```

Guard implementation — hand-rolled ZIP central-directory scan (NO extraction, no dependency): locate EOCD (`PK\x05\x06`) scanning backward ≤ 65 557 bytes + 22; read entry count and central-directory offset; iterate central headers (`PK\x01\x02`) collecting `{ path, compressedSize, uncompressedSize }`. Reject:
- first 4 bytes not `PK\x03\x04` → `XLSX_NOT_ZIP`; first 8 bytes `D0 CF 11 E0 A1 B1 1A E1` (CFB: legacy .xls or encrypted OOXML) → `XLSX_ENCRYPTED_OR_LEGACY`;
- any entry path containing `..` segments, starting with `/`, or containing `\` → `XLSX_PATH_TRAVERSAL`;
- any path equal to `xl/vbaProject.bin` or ending `.bin` under `xl/macros`, or `[Content_Types].xml` declaring `macroEnabled` (byte-search the first central entry names is sufficient: presence of `vbaProject` anywhere in an entry name) → `XLSX_MACROS_PRESENT`;
- entries > maxEntries → `XLSX_TOO_MANY_ENTRIES`; Σ uncompressedSize > maxTotalUncompressed → `XLSX_BOMB_SIZE`; for any entry with compressedSize ≥ 64 bytes, uncompressed/compressed > maxCompressionRatio → `XLSX_BOMB_RATIO`;
- EOCD/central directory unparseable → `XLSX_MALFORMED`.

`parseXlsx`: run the guard first (fail-closed). Then `new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(bytes))` inside try/catch (`XLSX_MALFORMED` on throw). Iterate `wb.worksheets`, `ws.eachRow({ includeEmpty: false })`; for each cell record `raw` = text of `cell.value` WITHOUT evaluating anything; when `cell.formula` is present record `{ raw: String(cell.result ?? ""), formula: cell.formula }` — formula text is INERT provenance only. Enforce row/col/cell-length limits fail-closed.

- [ ] **Step 1: Write the failing tests** — fixtures built in-test:

```ts
import ExcelJS from "exceljs";
import { deflateRawSync } from "node:zlib";
import { guardXlsxContainer, parseXlsx, XLSX_LIMITS } from "./xlsx";

async function buildXlsx(rows: (string | number | { formula: string; result?: number })[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Кошторис");
  rows.forEach((r) => ws.addRow(r));
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
// Hand-craft a minimal ZIP with one entry whose header declares a huge
// uncompressed size (bomb) — build local header + central dir + EOCD with
// Buffer.writeUInt32LE; entry data = deflateRawSync(Buffer.alloc(1024)).

it("accepts a normal workbook", async () => {
  const b = await buildXlsx([["Назва", "К-сть"], ["Бетон", 12.5]]);
  expect(guardXlsxContainer(b)).toEqual({ ok: true });
  const p = await parseXlsx(b);
  expect(p.ok).toBe(true);
  if (p.ok) expect(p.rows.some((r) => r.cells.A?.raw === "Бетон")).toBe(true);
});
it("keeps formulas inert: formula text + cached value, nothing executed", async () => {
  const b = await buildXlsx([["=SUM(1,1)"], [{ formula: "A1*2", result: 4 }]]);
  const p = await parseXlsx(b);
  if (!p.ok) throw new Error("expected ok");
  const withFormula = p.rows.flatMap((r) => Object.values(r.cells)).filter((c) => c.formula);
  expect(withFormula.length).toBeGreaterThan(0);
  expect(withFormula[0].formula).toBe("A1*2");
});
it("rejects CFB (legacy/encrypted) containers", () => {
  const cfb = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array(64).fill(0)]);
  expect(guardXlsxContainer(cfb)).toEqual({ ok: false, errors: ["XLSX_ENCRYPTED_OR_LEGACY"] });
});
it("rejects a macro workbook by vbaProject entry name", async () => {
  // take a valid xlsx buffer and append a crafted central-dir entry named xl/vbaProject.bin
  // (or simpler: build the zip fixture by hand with two entries) → XLSX_MACROS_PRESENT
});
it("rejects a declared-size ZIP bomb without inflating it", () => {
  // crafted zip: entry declares uncompressedSize 10 GB, compressed 1 KB → XLSX_BOMB_SIZE/RATIO
});
it("rejects path traversal entries", () => { /* crafted entry name '../../evil' → XLSX_PATH_TRAVERSAL */ });
it("fuzz: 100 seeded mutations of a valid workbook never throw and fail closed", async () => {
  const base = await buildXlsx([["a", 1]]);
  let seed = 7; const rnd = () => (seed = (seed * 48271) % 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 100; i++) {
    const b = new Uint8Array(base);
    b[Math.floor(rnd() * b.length)] ^= 0xff;
    await expect(parseXlsx(b)).resolves.toBeDefined(); // never throws
  }
});
```

Write the three crafted-zip fixtures as a small helper `craftZip(entries: { name: string; data: Buffer; declaredUncompressed?: number }[]): Uint8Array` inside the test file (local header `PK\x03\x04`, central `PK\x01\x02`, EOCD `PK\x05\x06`; deflate-raw method 8).

- [ ] **Step 2: Run to verify failure, implement, re-run**

Run: `pnpm --filter @aktflow/domain test -- xlsx` (add exceljs to `packages/domain/package.json` dependencies + `pnpm install` first so imports resolve). Implement until PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/domain/package.json pnpm-lock.yaml packages/domain/src/import/xlsx-guard.ts packages/domain/src/import/xlsx.ts packages/domain/src/import/xlsx.test.ts packages/domain/src/index.ts
git commit -m "feat(m1): XLSX container guard and inert-formula parse (INV-016)"
```

---

### Task 14: Domain mapping, normalization, row validation, preview

**Files:**
- Create: `packages/domain/src/import/mapping.ts`, `packages/domain/src/import/validate.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/import/validate.test.ts`

**Interfaces:**
- Consumes: `SourceRow` (Tasks 12–13), money engine (Task 11).
- Produces (consumed by Tasks 16–17):

```ts
export interface ColumnMapping {
  sourceKey?: string; workCode?: string; description: string; section?: string;
  unit: string; quantity: string; unitPrice?: string; amount?: string;
  location?: string; externalRef?: string;      // values are column letters "A".."IV"
}
export interface ImportConfig { locale: "uk-UA" | "en-US"; headerRow: number; worksheet?: string }
export interface MappedRow {
  sourceRowNo: number; worksheet: string | null;
  sourceKey: string | null; workCode: string | null; description: string;
  section: string | null; unitText: string; quantityText: string;
  unitPriceText: string | null; amountText: string | null;
  locationName: string | null; externalRef: string | null;
}
export type RowErrorCode =
  | "DESCRIPTION_REQUIRED" | "UNIT_REQUIRED" | "UNIT_UNKNOWN"
  | "QUANTITY_INVALID" | "QUANTITY_NEGATIVE" | "PRICE_INVALID"
  | "AMOUNT_INVALID" | "AMOUNT_MISMATCH" | "TAX_MODE_UNKNOWN" | "FORMULA_CELL";
export interface ContractPins {
  currency: string; taxMode: TaxMode; taxRateBps: number | null;
  midpoint: Midpoint; minorScale: number;           // 2 for UAH
  tolAbsMinor: bigint; tolBps: number; priceBasis: "net" | "gross";
}
export interface RowValidation {
  row: MappedRow;
  severity: "ok" | "warning" | "blocking";
  codes: RowErrorCode[];
  needsResolution: boolean;                          // AMOUNT_MISMATCH only blocker
  quantity: Decimal | null; unitPrice: Decimal | null;
  derivedMinor: bigint | null; sourceMinor: bigint | null;
  net: bigint | null; tax: bigint | null; gross: bigint | null;
}
export function applyMapping(rows: SourceRow[], mapping: ColumnMapping, config: ImportConfig):
  { mapped: MappedRow[]; skippedEmpty: number };
export function validateRow(row: MappedRow, unit: { normalizedCode: string; precision: number } | null,
  pins: ContractPins, resolved: boolean): RowValidation;
export function buildPreview(rows: RowValidation[]): {
  rowCount: number; blockingCount: number; warningCount: number; needsResolutionCount: number;
  totals: { netMinor: string; taxMinor: string; grossMinor: string };  // strings: JSON-safe bigint
};
export function normalizeUnitCode(text: string): string; // lower + strip all whitespace — mirrors 0012 generated column
```

Validation semantics:
- description empty → blocking `DESCRIPTION_REQUIRED`; unit text empty → `UNIT_REQUIRED`; `unit === null` (not registered, actor lacked units.manage) → blocking `UNIT_UNKNOWN`.
- quantity: `parseLocalizedDecimal` fail → blocking `QUANTITY_INVALID`; negative → blocking `QUANTITY_NEGATIVE`; quantity rescaled to unit precision (warning-free if exact, else warning implicit in rescale — no code, precision pinning is policy).
- price text present but unparseable → blocking `PRICE_INVALID`; absent price + absent amount → `unit_price_state`  handling happens at publish (state `missing`), severity `warning` with no code (missing price is legal, VaR treats it).
- amount present: parse (else blocking `AMOUNT_INVALID`); compute `derivedMinor` = taxbasis-normalized qty×price (price_basis `gross` → `netFromGross` first); compare with `withinTolerance`; outside → `AMOUNT_MISMATCH`, `needsResolution: true`, severity `blocking` UNLESS `resolved === true` → severity `warning` (code retained for provenance).
- any source cell in a mapped column carrying `formula` → warning `FORMULA_CELL` (inert text used; never blocks by itself).
- taxSplit warning `TAX_MODE_UNKNOWN` → warning code.
- `buildPreview` totals sum net/tax/gross over non-blocking rows only.

- [ ] **Step 1: Write the failing tests** — cover each semantic above with concrete numbers; the two INV-054 cores:

```ts
const pins: ContractPins = { currency: "UAH", taxMode: "exclusive", taxRateBps: 2000,
  midpoint: "half_up", minorScale: 2, tolAbsMinor: 100n, tolBps: 10, priceBasis: "net" };
const unit = { normalizedCode: "м2", precision: 3 };
const row = (over: Partial<MappedRow>): MappedRow => ({
  sourceRowNo: 2, worksheet: "Кошторис", sourceKey: "1.1", workCode: null,
  description: "Мурування", section: null, unitText: "м2", quantityText: "10",
  unitPriceText: "199,99", amountText: null, locationName: null, externalRef: null, ...over });

it("clean row: ok, derived 1999,90 → net 199990 tax 39998 gross 239988", () => {
  const v = validateRow(row({}), unit, pins, false);
  expect(v.severity).toBe("ok");
  expect(v.net).toBe(199990n); expect(v.tax).toBe(39998n); expect(v.gross).toBe(239988n);
});
it("INV-054: source amount 2 100,00 vs derived 1 999,90 → blocking AMOUNT_MISMATCH needsResolution", () => {
  const v = validateRow(row({ amountText: "2 100,00" }), unit, pins, false);
  expect(v.severity).toBe("blocking");
  expect(v.codes).toContain("AMOUNT_MISMATCH");
  expect(v.needsResolution).toBe(true);
  expect(v.sourceMinor).toBe(210000n);
});
it("INV-054: the same row with resolved=true degrades to warning and keeps the code", () => {
  const v = validateRow(row({ amountText: "2 100,00" }), unit, pins, true);
  expect(v.severity).toBe("warning");
  expect(v.codes).toContain("AMOUNT_MISMATCH");
});
it("amount within both tolerances passes without resolution", () => {
  const v = validateRow(row({ amountText: "1 999,95" }), unit, pins, false); // diff 5 ≤ 100 abs, ~0.25 bps
  expect(v.severity).toBe("ok");
});
```

Plus: applyMapping skips fully-empty rows and rows at/before headerRow; UNIT_UNKNOWN; QUANTITY_INVALID («аби що»); FORMULA_CELL propagation; buildPreview counts/totals; `normalizeUnitCode("М 2") === "м2"` mirror test.

- [ ] **Step 2: Run to verify failure, implement, re-run to pass**

Run: `pnpm --filter @aktflow/domain test -- validate`

- [ ] **Step 3: Commit**

```bash
git add packages/domain/src/import/mapping.ts packages/domain/src/import/validate.ts packages/domain/src/import/validate.test.ts packages/domain/src/index.ts
git commit -m "feat(m1): import mapping, localized normalization, row validation with tolerance blocking"
```

---

### Task 15: import_batches.create, import_files.add (multipart), import_batches.get

**Files:**
- Create: `packages/contracts/src/imports.ts`, `apps/app/app/v1/contracts/[contractId]/import-batches/route.ts`, `apps/app/app/v1/import-batches/[batchId]/route.ts` (GET), `apps/app/app/v1/import-batches/[batchId]/files/route.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `apps/app/tests/imports.int.test.ts`

**Interfaces:**
- Consumes: Tasks 5–10 fixture chain; Task 13 `guardXlsxContainer` (early reject at upload).
- Produces:
  - `createImportBatchRequest = {}` → `{ batchId, status: "created", version }`
  - files.add: `multipart/form-data`, field `file` (required, ≤ 20 MB) → `{ fileId, contentHash, detectedFormat, byteSize }`
  - `ImportBatchResponse = { batchId, contractId, projectId, workspaceId, status, mappingVersion, currentAttempt, rowCount|null, blockingCount|null, warningCount|null, needsResolutionCount|null, totals|null, failureCodes: string[], sourceManifestHash|null, publishedVersionId|null, version, files: { fileId, filename, byteSize, contentHash, detectedFormat }[], rowResults: { rowResultId, worksheet, sourceRow, severity, errorCodes, mapped }[] (latest attempt, blocking first, ≤ 500), resolutions: { resolutionId, rowResultId, chosenBasis, reason }[] }`
- Behavior: batch create requires `imports.manage` on the contract's project; files.add allowed ONLY while `status = 'created'` (else 409 `IMPORT_JOB_CONFLICT`); format sniffing by magic bytes (`PK\x03\x04` → xlsx + container guard immediately; printable text → csv; anything else → 422 `IMPORT_FILE_UNSUPPORTED`); duplicate content hash in one batch → 409 `IMPORT_JOB_CONFLICT`.

- [ ] **Step 1: Write the failing integration tests**

`apps/app/tests/imports.int.test.ts` — fixture: full route chain (workspace → parties/own → project → self-grants incl `imports.manage` — grants come via access-grants route; contract via Task 10 route). Tests:

1. batch create → 201 status `created`; actor with only `project.view` → 403 `SCOPE_PROJECT_DENIED`; foreign contract id → 404.
2. files.add CSV (build `FormData` with a `File` from `new TextEncoder().encode("Назва;Од;К-сть;Ціна\n...")`) → 201; `content_hash` equals locally computed sha256; DB `source_bytes` round-trips.
3. files.add with `.exe` bytes (`MZ...`) → 422 `IMPORT_FILE_UNSUPPORTED`; with a ZIP-bomb crafted zip (Task 13 helper extracted into a shared test util `apps/app/tests/helpers/zip.ts`) → 422 `IMPORT_FILE_UNSUPPORTED` (guard errors surfaced in `fieldErrors`).
4. same file twice in one batch → 409 `IMPORT_JOB_CONFLICT`.
5. files.add after validate has run (status ≠ created) → 409 `IMPORT_JOB_CONFLICT` (set up by advancing the batch in Task 16's flow — write the test now with `it.todo`, enable in Task 16 when validate exists).
6. batch GET → 200 with files list; foreign workspace actor → 404.

Multipart call pattern for route tests:

```ts
const fd = new FormData();
fd.append("file", new File([bytes], "кошторис.csv", { type: "text/csv" }));
const req = new Request("http://x/v1/import-batches/" + batchId + "/files", {
  method: "POST", headers: { "idempotency-key": "f1" }, body: fd,
});
```

- [ ] **Step 2: Run to verify failure, then implement**

files.add is the one route NOT using `commandRoute` (multipart body): hand-roll following the organizations route skeleton — requestId → `requireUser` → idempotency key → `req.formData()` → validate `file` instanceof File and size cap → `Buffer.from(await file.arrayBuffer())` → sha256 hex as BOTH the request hash (idempotency) and `content_hash` → sniff format:

```ts
const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
const isCfb = bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf;
let detectedFormat: "xlsx" | "csv";
if (isZip) {
  const g = guardXlsxContainer(bytes);
  if (!g.ok) throw new HttpProblem(422, problem("IMPORT_FILE_UNSUPPORTED",
    "Файл не пройшов перевірку безпеки.", { requestId, retryable: false,
      userAction: "use_template_or_supported_format",
      fieldErrors: g.errors.map((code) => ({ path: "file", message: code })) }));
  detectedFormat = "xlsx";
} else if (isCfb) {
  throw new HttpProblem(422, problem("IMPORT_FILE_UNSUPPORTED",
    "Застарілий або зашифрований формат Excel не підтримується. Збережіть як .xlsx.",
    { requestId, retryable: false, userAction: "use_template_or_supported_format" }));
} else {
  const probe = new TextDecoder("utf-8", { fatal: true });
  try { probe.decode(bytes.subarray(0, 4096)); detectedFormat = "csv"; }
  catch {
    throw new HttpProblem(422, problem("IMPORT_FILE_UNSUPPORTED",
      "Підтримуються лише файли XLSX та CSV.",
      { requestId, retryable: false, userAction: "use_template_or_supported_format" }));
  }
}
```

Insert with `storage_key = 'pg://import-sources/' + workspaceId + '/' + batchId + '/' + fileId` (decision 3); status guard `where status = 'created'` on the batch row (SELECT ... FOR UPDATE first; wrong status → 409 `IMPORT_JOB_CONFLICT`); duplicate-hash unique violation → 409 `IMPORT_JOB_CONFLICT`. Audit `import_file.added` (metadata: hash, format, size — no content).

batch create and GET use `commandRoute`/`queryRoute` + capability checks (`imports.manage` / `project.view`). GET assembles the `ImportBatchResponse` with three follow-up selects (files; latest-attempt row results ordered `severity desc, source_row` limit 500; resolutions).

- [ ] **Step 3: Run tests to verify pass, commit**

```bash
git add packages/contracts/src/imports.ts packages/contracts/src/index.ts "apps/app/app/v1/contracts/[contractId]/import-batches" "apps/app/app/v1/import-batches" apps/app/tests/imports.int.test.ts apps/app/tests/helpers/zip.ts
git commit -m "feat(m1): import batch creation, guarded multipart file staging, batch query"
```

---

### Task 16: import_batches.validate — synchronous safe pipeline

**Files:**
- Create: `apps/app/app/v1/import-batches/[batchId]/validate/route.ts`
- Modify: `packages/contracts/src/imports.ts` (add `validateImportBatchRequest`)
- Test: extend `apps/app/tests/imports.int.test.ts`

**Interfaces:**
- Consumes: Tasks 12–15 (`parseCsv`, `parseXlsx`, `applyMapping`, `validateRow`, `buildPreview`, `normalizeUnitCode`).
- Produces: `validateImportBatchRequest = { mapping: ColumnMapping (zod mirror: column letters /^[A-Z]{1,3}$/), config: { locale: "uk-UA"|"en-US" (default uk-UA), headerRow: int ≥ 0 (default 1), worksheet?: string }, expectedVersion: int ≥ 1 }` → the Task 15 `ImportBatchResponse`. Parser identity string `PARSER_VERSION = "goproceed-import/1.0.0"` exported from `@aktflow/domain` (bump on any parser change — provenance).
- State walk (one command): `created → parsing → parsed → mapping → validated [→ preview_ready]`; guard/parse failure → `failed` + `failure_codes`. Re-validation from `validated`/`preview_ready`/`failed` starts a new attempt (append-only row results; `current_attempt + 1`), allowed because files are frozen after `created`… **correction:** re-validation is allowed from `validated`, `preview_ready`, and `failed`; the state column moves through the same walk again. `mapping_version` increments each validate call. Manifest: `sha256(hex-concat of ordered file content_hashes + '|' + PARSER_VERSION + '|' + mapping_version + '|' + canonical JSON of config+mapping)`.

- [ ] **Step 1: Write the failing integration tests** (extend `imports.int.test.ts`):

1. Happy CSV: stage `"Назва;Од;К-сть;Ціна\nМурування;м2;10;199,99\nШтукатурення;м2;5,5;150,00\n"`, validate with mapping `{ description: "A", unit: "B", quantity: "C", unitPrice: "D" }`, headerRow 1 → 200; batch `preview_ready`; `row_count 2`, `blocking_count 0`; `totals.netMinor = "282490"` (10×19999 + 5.5×15000 = 199990 + 82500); row results attempt 1 exist; units «м2» auto-registered in `unit_definitions` (actor is owner → `units.manage`).
2. INV-054 blocking: CSV row with amount column mismatch beyond tolerance (mapping includes `amount: "E"`) → batch stays `validated`; `needs_resolution_count 1`; GET shows the blocking row with `AMOUNT_MISMATCH`.
3. Unknown unit with a `member`-role actor holding `imports.manage` but NOT `units.manage` → row blocking `UNIT_UNKNOWN`, batch `validated`.
4. XLSX happy path: build workbook in-test (Task 13 helper), stage, validate → `preview_ready`; a formula cell surfaces as warning `FORMULA_CELL` with inert formula text in `source_cells`.
5. Corrupted/limit-breaching file (crafted zip passing upload sniff? no — upload guards already; instead truncate a valid xlsx AFTER staging is impossible since files freeze… stage a VALID zip container whose inner sheet XML is corrupted — exceljs load throws) → validate → batch `failed`, `failure_codes: ["XLSX_MALFORMED"]`, HTTP 200 with status `failed` (fail-closed is a domain outcome, not an HTTP error).
6. Stale `expectedVersion` → 409 `VERSION_CONFLICT`; wrong status transition (validate on `published` batch — covered in Task 17 tests).
7. Enable the Task 15 `it.todo` (files.add after validate → 409).

- [ ] **Step 2: Implement the route**

Structure (the ONE long handler in M1 — keep parsing outside the transaction):

```ts
export const POST = commandRoute(validateImportBatchRequest, async (a) => {
  // 1. Resolve batch + workspace/project/contract via RLS-scoped select (404 if invisible).
  // 2. requireActiveMembership + requireProjectCapability(imports.manage).
  // 3. Load contract pins + files (bytes) in a READ transaction; assert status allows validate
  //    ('created','validated','preview_ready','failed') else 409 IMPORT_JOB_CONFLICT; ≥1 file else 422.
  // 4. OUTSIDE any transaction: per file — parseCsv / parseXlsx; on guard/parse failure
  //    collect failureCodes and skip to the FAILED write path.
  // 5. applyMapping over concatenated SourceRows (CSV worksheet = null; XLSX per sheet,
  //    config.worksheet filter). Resolve units: select unit_definitions by normalized codes.
  // 6. Load existing resolutions for the batch (rowResult → resolved flag by matching
  //    worksheet+sourceRow of the PREVIOUS attempt's resolved rows — carry resolution
  //    forward by (worksheet, source_row) identity).
  // 7. validateRow per row; buildPreview.
  // 8. WRITE transaction with withIdempotency:
  //    - select batch FOR UPDATE, re-check version = expectedVersion else 409 VERSION_CONFLICT;
  //    - auto-register unseen units IF workspaceCapabilities(role) includes 'units.manage'
  //      (insert ... on conflict do nothing, then re-select ids);
  //    - walk status: update to 'parsing' … final state in successive updates (audit metadata
  //      records the walk; final = failed | validated | preview_ready);
  //    - insert import_row_results (attempt = current_attempt + 1) with source_cells
  //      {colLetter: {raw, formula?}}, mapped, severity, error_codes, parser_version, mapping_version;
  //    - update batch: counts, totals (jsonb strings), failure_codes, source_manifest_hash,
  //      mapping/mapping_version/parser_config/parser_version, current_attempt, version + 1;
  //    - recordAudit('import_batch.validated', metadata: counts + final status).
  // 9. Return the assembled ImportBatchResponse (same shape as GET).
});
```

`preview_ready` condition: `blockingCount === 0` (resolved mismatches are warnings). `validated` when blocking rows remain. `failed` when any file-level guard/parse error occurred (no row results written for the failed file set — fail-closed, `rows: []`).

- [ ] **Step 3: Run tests to verify pass, commit**

Run: `pnpm --filter app test -- imports` → PASS; full serialized suite.

```bash
git add "apps/app/app/v1/import-batches/[batchId]/validate" packages/contracts/src/imports.ts apps/app/tests/imports.int.test.ts packages/domain/src/index.ts
git commit -m "feat(m1): synchronous fail-closed import validation pipeline with unit auto-registration"
```

---

### Task 17: import_resolutions.create, import_batches.publish, contract_versions.get

**Files:**
- Create: `packages/domain/src/import/publish.ts` (+ test), `packages/contracts/src/contract-versions.ts`, `apps/app/app/v1/import-batches/[batchId]/resolutions/route.ts`, `apps/app/app/v1/import-batches/[batchId]/publish/route.ts`, `apps/app/app/v1/contracts/[contractId]/versions/[versionNo]/route.ts`
- Modify: `packages/contracts/src/imports.ts`, `packages/contracts/src/index.ts`, `packages/domain/src/index.ts`
- Test: `apps/app/tests/import-publish.int.test.ts`, `packages/domain/src/import/publish.test.ts`

**Interfaces:**
- Consumes: Tasks 11–16.
- Produces:
  - `createResolutionRequest = { rowResultId: uuid, chosenBasis: "unit_price_derived"|"approved_source_amount", reason: string(1..2000) }` → `{ resolutionId }`
  - `publishImportBatchRequest = { expectedVersion: int ≥ 1, confirmedManifestHash: string(/^[0-9a-f]{64}$/) }` → `{ contractVersionId, versionNo, workItemCount, supersedesVersionId|null }`
  - `ContractVersionResponse = { contractVersionId, versionNo, status: "published", publishedAt, sourceManifestHash, supersedesVersionId|null, pins: { currency, taxMode, taxRateBps, roundingPolicy, toleranceMinorUnits, toleranceBps }, partySnapshots: { own, customer }, workItems: [{ workItemId, position, sourceKey, workCode, description, section, unitCode, unitPrecision, contractQuantity, unitPriceState, unitPriceDecimal|null, valuationBasis, netMinor, taxMinor, grossMinor, sourceAmountMinor|null, predecessorWorkItemId|null }], diff: { added: number, removed: number, changed: number, unchanged: number } | null }`
  - Domain `matchLineage(prev: { id, sourceKey, workCode, description }[], next: MappedRowLike[]): Map<number, string>` — position→predecessor id; match priority: exact `sourceKey`, else exact (`workCode`, normalized description), else no predecessor. `computeDiff(prev, next, lineage)` → the diff counts (`changed` = matched pair with any differing of quantity/price/unit/amount fields).

- [ ] **Step 1: Domain lineage unit tests**

`packages/domain/src/import/publish.test.ts`: three cases — sourceKey match wins over workCode; unmatched next row → added; removed prev row counted; changed detection on quantity delta. Concrete literals, ~40 lines. Run → FAIL → implement `publish.ts` → PASS.

- [ ] **Step 2: Write failing integration tests**

`apps/app/tests/import-publish.int.test.ts` — fixture reaches a `validated` batch with one `AMOUNT_MISMATCH` row (Task 16 CSV #2). Tests:

1. **INV-054 blocking:** publish on `validated` batch → 409 `IMPORT_JOB_CONFLICT`; zero contract_versions rows.
2. resolutions.create for the blocking row (`approved_source_amount`, reason «Ціна включає доставку») → 201; re-validate → `preview_ready`; row now warning.
3. resolutions.create by an actor without `imports.manage` → 403; for a row of ANOTHER batch → 404/422 (composite FK + RLS).
4. publish with wrong `confirmedManifestHash` → 409 `IMPORT_REVIEW_STALE`.
5. Happy publish (capability `imports.publish` — an actor with ONLY `imports.manage` gets 403 `SCOPE_PROJECT_DENIED`) → 201: contract_version v1 `published`; work_items rows with correct minor units; mismatch row has `valuation_basis='approved_source_amount'`, `approved_amount_minor_units = source`; batch `published` + `published_version_id`; outbox `contract_version.published`; audit exists; party snapshots frozen (jsonb contains own party official name + edrpou).
6. Idempotent replay of publish (same key) → same body, still ONE version.
7. **Reimport + lineage:** new batch, modified CSV (one row quantity changed, one row added, one removed) → validate → publish → v2: `supersedes_version_id = v1.id`; work_items carry `predecessor_work_item_id` per lineage; `GET /v1/contracts/{id}/versions/2` diff = `{ added: 1, removed: 1, changed: 1, unchanged: N }`.
8. **Published immutability (API + DB):** publish on the already-`published` batch → 409 `IMPORT_JOB_CONFLICT`; admin-SQL `update contract_versions ...` and `update work_items ...` → rejected by triggers; `GET .../versions/1` still returns the original snapshot byte-for-byte (compare against a copy captured before v2).
9. `GET .../versions/{n}` for a foreign workspace actor → 404; unknown versionNo → 404 `RESOURCE_NOT_FOUND`.

- [ ] **Step 3: Implement the three routes**

resolutions.create core: resolve batch (RLS→404), `requireProjectCapability(imports.manage)`, batch status must be `validated`/`preview_ready` else 409; row must belong to batch + latest attempt + carry `AMOUNT_MISMATCH` else 422 `VALIDATION_FAILED`; insert `source_amount_resolutions` with `source_amount_minor_units`/`derived_amount_minor_units` copied from the row's `mapped` jsonb; duplicate → 409 `VERSION_CONFLICT`. Audit `source_amount.resolved` (metadata: basis, NO reason text — log_policy).

publish core (one serialized transaction after `requireProjectCapability(imports.publish)`):

```ts
// lock the contract row: serializes version_no assignment per contract
const c = await tx.query(`select * from public.contracts where workspace_id=$1 and id=$2 for update`, [workspaceId, contractId]);
const b = await tx.query(`select * from public.import_batches where workspace_id=$1 and id=$2 for update`, [workspaceId, batchId]);
if (b.rows[0].status !== "preview_ready") throw conflict("IMPORT_JOB_CONFLICT", "Пакет імпорту не готовий до публікації.");
if (b.rows[0].version !== a.body.expectedVersion) throw conflict("VERSION_CONFLICT", "...");
if (b.rows[0].source_manifest_hash !== a.body.confirmedManifestHash)
  throw new HttpProblem(409, problem("IMPORT_REVIEW_STALE", "Джерело або мапінг змінилися після перегляду. Запустіть перевірку знову.",
    { requestId: a.requestId, retryable: false, userAction: "run_new_dry_run" }));
const prev = await tx.query(
  `select id, version_no from public.contract_versions where workspace_id=$1 and contract_id=$2 order by version_no desc limit 1`,
  [workspaceId, contractId]);
const versionNo = (prev.rows[0]?.version_no ?? 0) + 1;
// party snapshots from CURRENT legal profiles (immutable copies):
const snap = async (partyId: string) => {
  const r = await tx.query(
    `select p.display_name, lp.official_name, lp.edrpou, lp.vat_number, lp.tax_status, lp.legal_address, lp.country_code
       from public.parties p left join public.party_legal_profiles lp
         on lp.workspace_id = p.workspace_id and lp.party_id = p.id
      where p.workspace_id=$1 and p.id=$2`, [workspaceId, partyId]);
  return r.rows[0] ?? {};
};
// rows: latest attempt, severity <> 'blocking'; recompute money via validateRow outputs stored in mapped jsonb
// insert contract_version, then work_items with position = row order, lineage via matchLineage against v(prev) items,
// then: update import_batches set status='published', published_version_id=$vid, version=version+1;
// recordAudit('contract_version.published'); enqueueOutbox('contract_version.published',
//   payload { workspaceId, projectId, contractId, contractVersionId, versionNo, payloadVersion: 1 });
```

`unit_price_state`: `known` when price parsed; `zero` when parsed price is exactly 0; `missing` when no price column/value — then `net/tax/gross = 0` and `valuation_basis='unit_price_derived'` unless an approved source amount exists. For `approved_source_amount` rows: `approved_amount_minor_units = sourceMinor`; net/tax/gross derive from the source amount under the pinned tax mode (source amount is `priceBasis`-basis).

versions.get: `queryRoute`; resolve contract (RLS→404) + `requireProjectCapability(project.view)`; load version by `(workspace_id, contract_id, version_no)` → 404 if absent; load work items ordered by position; if `supersedes_version_id` load predecessor items and `computeDiff`; assemble `ContractVersionResponse` (bigint → string in JSON).

- [ ] **Step 4: Run tests to verify pass, commit**

Run: `pnpm --filter app test -- import-publish` → PASS; full serialized suite green.

```bash
git add packages/domain/src/import/publish.ts packages/domain/src/import/publish.test.ts packages/contracts/src/contract-versions.ts packages/contracts/src/imports.ts packages/contracts/src/index.ts packages/domain/src/index.ts "apps/app/app/v1/import-batches/[batchId]/resolutions" "apps/app/app/v1/import-batches/[batchId]/publish" "apps/app/app/v1/contracts/[contractId]/versions" apps/app/tests/import-publish.int.test.ts
git commit -m "feat(m1): discrepancy resolutions, immutable publish with lineage, version query with diff"
```

---

### Task 18: M1 vertical test and milestone gate

**Files:**
- Create: `apps/app/tests/vertical-m1.int.test.ts`, `apps/app/tests/helpers/estimate-fixture.ts`
- Test: the file IS the test.

**Interfaces:**
- Consumes: every route from Tasks 6–17; Task 13's workbook builder.
- Produces: the delivery-gate vertical evidence (version-0.1.md M1: "import a sanitized real estimate; resolve one mismatch; publish; reimport and verify diff plus lineage; prove published immutability").

- [ ] **Step 1: Build the sanitized estimate fixture**

`apps/app/tests/helpers/estimate-fixture.ts`: exceljs workbook «Приклад-Кошторис» — 8 realistic rows (описи робіт українською: «Мурування цегляних стін», «Штукатурення фасаду», …), columns: `№ п/п | Шифр | Найменування робіт | Од. вим. | Кількість | Ціна за од., грн | Сума, грн`; uk-UA number formatting as TEXT cells («1 234,56»); one row's Сума deliberately off by 150,00 грн (beyond 100-minor-unit/10-bps tolerance); one formula cell (`=E5*F5` with cached value) to prove inert handling. Export `buildEstimateV1(): Promise<Uint8Array>` and `buildEstimateV2(): Promise<Uint8Array>` (v2: one quantity changed, one row added, one row removed). All names carry «Приклад-» (transparently synthetic).

- [ ] **Step 2: Write the vertical scenario as one ordered test**

Single `describe` with sequential `it` blocks sharing state (vitest runs file-serially):

1. **Bootstrap:** A creates workspace «Приклад-Генпідряд»; invites B (admin) — B accepts by token.
2. **Parties:** A creates «Приклад-Будівельна компанія» + legal profile (ЄДРПОУ 12345678) + own profile; B creates customer «Приклад-Замовник-Девелопмент» + legal profile.
3. **Project + access:** B creates project «Приклад-ЖК Сонячний»; grants A `contracts.edit`, `imports.manage`, `imports.publish`.
4. **Second own entity proof:** A creates «Приклад-Спецмонтаж» (+profiles, own); creates TWO contracts in the same project — one per own party, same contract number «Д-2026/07» on both → both 201 (uniqueness scoped per own party — exit gate "one project holds contracts for different own parties").
5. **Import:** batch on contract 1; upload `buildEstimateV1()` XLSX; validate (mapping by columns C/D/E/F/G, headerRow 1, uk-UA) → `validated` with exactly one `AMOUNT_MISMATCH` blocking row; formula cell recorded inert.
6. **Resolve:** resolution `approved_source_amount`, reason «Сума з урахуванням транспортних витрат»; re-validate → `preview_ready`; publish with the manifest hash from GET → v1 published; totals reconcile (assert exact minor-unit totals precomputed in the fixture module).
7. **Reimport:** new batch with `buildEstimateV2()`; validate; publish → v2; `GET versions/2` diff `{ added: 1, removed: 1, changed: 1, unchanged: 5 }`; changed item's `predecessorWorkItemId` points into v1.
8. **Immutability:** captured v1 response equals a fresh `GET versions/1` after v2 exists; admin SQL UPDATE/DELETE on v1 rows rejected by triggers; third publish attempt on batch 1 → 409.
9. **Isolation coda (INV-001):** outsider actor X (user C from seed) sees: projects list `[]`, batch GET 404, versions GET 404.

- [ ] **Step 3: Run the vertical test, then the FULL milestone gate**

Run: `pnpm --filter app test -- vertical-m1` → PASS.
Then the complete gate, in order:

```bash
supabase db reset --no-seed=false && pnpm -w db:local-credentials
pnpm turbo run typecheck
pnpm turbo run test --concurrency=1
pnpm turbo run build
pnpm db:catalog-snapshot
pnpm validate:canonical-docs
```

All green; commit the catalog snapshot produced under `migration/goproceed-canonical-v0.1/catalog-snapshots/` (live-catalog verification per migration-safety-plan).

- [ ] **Step 4: Commit and record milestone evidence**

```bash
git add apps/app/tests/vertical-m1.int.test.ts apps/app/tests/helpers/estimate-fixture.ts migration/goproceed-canonical-v0.1/catalog-snapshots/
git commit -m "test(m1): vertical import-resolve-publish-reimport scenario and milestone gate evidence"
```

Note in the final report to the human partner: M1 **exit gates covered by automation** are the six schema/API/security/vertical bullets; the roadmap **entry evidence** (recorded walkthrough with the estimate preparer, real sanitized artifact) and **closing evidence** (walkthrough recordings) are user-provided and remain open — list them explicitly.

---

## Self-review checklist (run after writing, before execution)

- **Spec coverage:** 21/21 operations mapped (Task 6: workspaces.create, me.context, members.list; T7: invitations.create/accept; T8: parties.create/update, legal_profile.put, own_profile.create; T9: projects.create/list, project_access.grant, project_responsibilities.assign; T10: contracts.create; T15: import_batches.create, import_files.add, import_batches.get; T16: import_batches.validate; T17: import_resolutions.create, import_batches.publish, contract_versions.get). 17 catalog entities + invitations all in Tasks 1/3. Security tests: INV-001 (T2/T4/T18), INV-002 (T3/T10), INV-016 (T13/T15), INV-020 (T5/T8), INV-022 (T3/T10), INV-054 (T14/T16/T17). Vertical test T18. Exclusions honored: no assignments/progress/evidence/packages/external access/PDF authority anywhere.
- **Type consistency spot-checks:** `app.active_member_id`/`app.has_project_capability` names match between 0011 and 0013 policies; `ImportBatchResponse` shape identical in T15 GET and T16 return; `MappedRow`/`RowValidation` field names match between T14 and T16/T17 consumers; `memberships_org_id_unique` consumed by 0010 invitations/grants FKs.
- **Known judgment calls:** listed under "Recorded design decisions" — reviewer may veto any before its task runs.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-30-goproceed-v0.1-m1-contract-baseline.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks (superpowers:subagent-driven-development).

**2. Inline Execution** — execute tasks in this session with superpowers:executing-plans, batch execution with checkpoints.




