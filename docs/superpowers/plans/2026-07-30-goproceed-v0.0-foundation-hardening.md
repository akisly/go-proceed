# GoProceed v0.0 Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every [docs/delivery/version-0.0.md](../../delivery/version-0.0.md) gate: reproducible environment, green serialized baseline, tenant-isolated foundation tables, serialized bootstrap, deny-by-default privileges, environment-safe seed credentials, hardened CI, re-scoped legacy validator, and migration safety rails.

**Architecture:** Everything is additive. New migrations 0006–0009 extend the six-table foundation without renaming or dropping anything. Legacy `aktflow_*` role/package names stay in v0.0 (renaming is a separate later decision). Tests live in `packages/testing` (DB-level) and existing package suites; every migration lands with negative tests in the same task.

**Tech Stack:** PostgreSQL (Supabase local), pnpm 9.12.0, Node >=24 <25, Vitest 3, GitHub Actions, Python 3 (legacy validator).

## Global Constraints

- Node `>=24 <25`; pnpm `9.12.0` (root `package.json` `engines`/`packageManager`).
- Never modify `/Users/akisliy/Downloads/aktflow-product-package 2` (read-only old tree).
- Never stage/commit/delete untracked `.agents/` or `skills-lock.json`.
- Migrations are additive only: no rename/drop of baseline objects.
- After every task both validators stay green:
  `node scripts/validate-canonical-docs.mjs` → `canonical documentation: OK`;
  `python3 scripts/validate_package.py` → `... PASS`.
- DB tests run serialized: `pnpm turbo run test --concurrency=1` (packages share one local Postgres).
- Local DB URLs only in tests/scripts: host must be `127.0.0.1`/`localhost`.
- No green-baseline claim until Task 11 records the serialized re-run.

## File structure

```text
pnpm-workspace.yaml                      (T1: build-script policy)
vitest.workspace.ts                      (T2: root runner parity)
.github/workflows/ci.yml                 (T3: SHA pins + permissions; T4: password step)
supabase/seed.sql                        (T4: password statement removed)
scripts/set-local-app-password.mjs       (T4)
supabase/migrations/0006_foundation_tenant_isolation.sql   (T5)
supabase/migrations/0007_idempotency_expiry.sql            (T6)
supabase/migrations/0008_outbox_claim_retry_dead_letter.sql(T7)
supabase/migrations/0009_deny_by_default_privileges.sql    (T8)
packages/database/src/idempotency.ts     (T6: expiry-aware replay)
packages/testing/src/foundation.test.ts  (T5)
packages/testing/src/idempotency-expiry.test.ts (T6)
packages/testing/src/outbox.test.ts      (T7)
packages/testing/src/privileges.test.ts  (T8)
scripts/validate_package.py              (T9: re-scope)
scripts/snapshot-db-catalog.mjs          (T10)
migration/goproceed-canonical-v0.1/migration-safety-plan.md (T10)
migration/goproceed-canonical-v0.1/baseline-verification.md (T11: addendum)
```

---

### Task 1: pnpm build-script policy

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `migration/goproceed-canonical-v0.1/decision-register.md`

**Interfaces:**
- Produces: deterministic `pnpm install --frozen-lockfile` exit 0 (unblocks turbo for every later task).

- [ ] **Step 1: Record the decision**

Append to the decision register table:

```markdown
| D-048 | 2026-07-30 | pnpm build scripts are allowlisted to esbuild and sharp only; puppeteer's Chrome download stays an explicit step (`pnpm exec puppeteer browsers install chrome`), as CI already does. | Supply-chain: install scripts run only for two vetted native packages; the browser download is auditable and cache-friendly as an explicit command. | `pnpm-workspace.yaml` |
```

- [ ] **Step 2: Configure the allowlist**

Append to `pnpm-workspace.yaml`:

```yaml
onlyBuiltDependencies:
  - esbuild
  - sharp
```

- [ ] **Step 3: Verify install is clean**

Run: `pnpm install --frozen-lockfile; echo "exit: $?"`
Expected: `exit: 0` and no build-script approval prompt/warning.

- [ ] **Step 4: Verify turbo is unblocked**

Run: `pnpm turbo run typecheck 2>&1 | tail -3`
Expected: turbo executes (typecheck results, not an approval error).

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml migration/goproceed-canonical-v0.1/decision-register.md
git commit -m "build: allowlist esbuild+sharp build scripts (D-048)"
```

---

### Task 2: Root vitest workspace parity (demo `@/lib/utils` failures)

The three failing demo suites are NOT missing code: `apps/demo/src/lib/utils.ts`
exists and `apps/demo/vitest.config.ts` defines the `@` alias. They fail only
under the ROOT `vitest run`, which ignores per-package configs. Fix the runner,
not the code.

**Files:**
- Create: `vitest.workspace.ts`
- Modify: `migration/goproceed-canonical-v0.1/baseline-verification.md`

**Interfaces:**
- Produces: root `./node_modules/.bin/vitest run` behaves like per-package runs (same alias/env), so baseline numbers stop lying.

- [ ] **Step 1: Reproduce the failure (pre-fix)**

Run: `./node_modules/.bin/vitest run apps/demo/tests/nav.test.ts 2>&1 | tail -5`
Expected: FAIL `Cannot find package '@/lib/utils'`.

- [ ] **Step 2: Create the workspace file**

```ts
// vitest.workspace.ts
// Root vitest discovers per-package configs instead of running files with a
// bare default config (which lacks apps/demo's `@` alias). Packages without
// a vitest.config fall back to their directory defaults.
export default [
  "apps/app/vitest.config.ts",
  "apps/demo/vitest.config.ts",
  "packages/*/vitest.config.ts",
  "supabase/functions/*/vitest.config.ts",
];
```

Before writing, list the actual config files:
`ls apps/*/vitest.config.ts packages/*/vitest.config.ts supabase/functions/*/vitest.config.ts 2>/dev/null`
Include only the globs that match at least one file; if a package with tests
has no config (check `git ls-files '*/vitest.config.ts'` against packages with
`tests/`), add a minimal `vitest.config.ts` there:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

- [ ] **Step 3: Verify demo suites collect and pass under the root runner**

Run: `./node_modules/.bin/vitest run --project '*demo*' 2>&1 | tail -4`
(or `./node_modules/.bin/vitest run apps/demo 2>&1 | tail -4`)
Expected: 3 demo files PASS (no `@/lib/utils` error).

- [ ] **Step 4: Correct the baseline record**

In `baseline-verification.md`, after the failure-groups list, append:

```markdown
**2026-07-30 correction:** the three `apps/demo` collection failures were a
root-runner configuration gap (root `vitest run` ignored
`apps/demo/vitest.config.ts` and its `@` alias), not a missing module.
`vitest.workspace.ts` restores parity; per-package runs were always green.
```

- [ ] **Step 5: Commit**

```bash
git add vitest.workspace.ts migration/goproceed-canonical-v0.1/baseline-verification.md
git commit -m "test: root vitest workspace parity fixes demo alias failures"
```

---

### Task 3: CI hardening — SHA pins and least privilege

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: every third-party action pinned to a full commit SHA; workflow-level `permissions: contents: read`.

- [ ] **Step 1: Resolve tag SHAs (no auth needed)**

```bash
git ls-remote https://github.com/pnpm/action-setup.git refs/tags/v4
git ls-remote https://github.com/supabase/setup-cli.git refs/tags/v1
git ls-remote https://github.com/actions/checkout.git refs/tags/v4
git ls-remote https://github.com/actions/setup-node.git refs/tags/v4
git ls-remote https://github.com/actions/setup-python.git refs/tags/v5
git ls-remote https://github.com/actions/upload-artifact.git refs/tags/v4
```

If a tag is an annotated tag object, dereference with
`git ls-remote https://github.com/<org>/<repo>.git refs/tags/v4^{}`.

- [ ] **Step 2: Add permissions and pin every `uses:`**

At the top of `ci.yml`, directly under `name: ci`:

```yaml
permissions:
  contents: read
```

Replace each `uses: <action>@vN` with `uses: <action>@<full-sha> # vN`,
using the SHAs from Step 1 (all occurrences: two `pnpm/action-setup`, one
`supabase/setup-cli`, three `actions/checkout`, three `actions/setup-node`,
one `actions/setup-python`, one `actions/upload-artifact`).

- [ ] **Step 3: Verify no unpinned actions remain**

Run: `grep -n "uses:" .github/workflows/ci.yml | grep -v "@[0-9a-f]\{40\}"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: pin actions to commit SHAs and drop token write access"
```

---

### Task 4: Environment-safe seed credentials

**Files:**
- Modify: `supabase/seed.sql` (remove the `alter role ... password` statement)
- Create: `scripts/set-local-app-password.mjs`
- Modify: `package.json` (script `db:local-credentials`)
- Modify: `.github/workflows/ci.yml` (run the script after `supabase db reset`)

**Interfaces:**
- Consumes: root devDependency `pg`.
- Produces: `pnpm db:local-credentials` — sets `aktflow_app_login`'s password to `app_pw` on a LOCAL database only; refuses any non-local host structurally.

- [ ] **Step 1: Write the guard-first script**

```js
// scripts/set-local-app-password.mjs
// Sets the dev-only password for aktflow_app_login on the LOCAL Supabase
// database. This replaces the former seed.sql statement so that no Supabase
// tooling path (--include-seed, db reset --linked, Branching preview reseed)
// can ever plant a known password on a reachable database.
import pg from "pg";

const url = new URL(process.env.SUPABASE_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
  console.error(`refusing non-local host: ${url.hostname}`);
  process.exit(1);
}
const password = process.env.APP_DB_PASSWORD ?? "app_pw";
const client = new pg.Client({ connectionString: url.href });
await client.connect();
// Identifier is fixed; only the password is parameterized via literal escape.
await client.query(`alter role aktflow_app_login password '${password.replaceAll("'", "''")}'`);
await client.end();
console.log("aktflow_app_login password set on", url.hostname);
```

- [ ] **Step 2: Remove the statement from seed.sql**

Delete the final `alter role aktflow_app_login password 'app_pw';` line and
replace the long warning comment with:

```sql
-- The dev-only aktflow_app_login password is NOT set here. seed.sql can be
-- applied to reachable databases (supabase db push --include-seed, db reset
-- --linked --include-seed, and Branching preview reseeds), so it must never
-- contain credentials. Local/CI setup runs `pnpm db:local-credentials`
-- (scripts/set-local-app-password.mjs), which refuses non-local hosts.
```

- [ ] **Step 3: Wire package script and CI**

`package.json` scripts: add
`"db:local-credentials": "node scripts/set-local-app-password.mjs"`.

`ci.yml` verify job, immediately after the `supabase db reset` step:

```yaml
      - name: Set local app-role password (never via seed.sql)
        run: pnpm db:local-credentials
```

- [ ] **Step 4: Verify locally (requires local Supabase)**

```bash
supabase db reset && pnpm db:local-credentials \
  && node -e "const pg=require('pg');const c=new pg.Client({connectionString:'postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres'});c.connect().then(()=>{console.log('login OK');return c.end()})"
grep -c "password" supabase/seed.sql
```

Expected: `login OK`; grep shows only the comment (no `alter role` line).
Also verify the guard: `SUPABASE_DB_URL=postgresql://x@db.example.com/postgres pnpm db:local-credentials` → exits 1 with `refusing non-local host`.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql scripts/set-local-app-password.mjs package.json .github/workflows/ci.yml
git commit -m "fix: move dev password out of seed.sql behind a local-only script"
```

---

### Task 5: Migration 0006 — foundation tenant isolation, append-only audit, permission-aware legal entities, serialized bootstrap

**Files:**
- Create: `supabase/migrations/0006_foundation_tenant_isolation.sql`
- Test: `packages/testing/src/foundation.test.ts`

**Interfaces:**
- Consumes: `packages/testing/src/pg.ts` helpers `appClient`, `asActor`, `resetDb` (existing).
- Produces: RLS on `audit_events`/`idempotency_records`/`transaction_outbox`; `app.reject_mutation()` trigger function; serialized `app.org_has_members`; role-checked `le_insert`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/testing/src/foundation.test.ts
import { describe, it, expect } from "vitest";
import { asActor, resetDb } from "./pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ORG = "cccccccc-cccc-cccc-cccc-cccccccccccc";

async function bootstrap(actor: string, org: string, role = "owner") {
  await asActor(actor, org, async (c) => {
    await c.query("insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [org]);
    await c.query(
      "insert into public.memberships (organization_id, user_id, role, status, all_projects) values ($1,$2,$3,'active',true)",
      [org, actor, role]);
  });
}

describe("0006 foundation tenant isolation", () => {
  it("audit insert into a foreign org is denied", async () => {
    await resetDb();
    await bootstrap(A, ORG);
    await expect(asActor(B, ORG, (c) =>
      c.query(
        "insert into public.audit_events (organization_id, actor_user_id, actor_type, action, object_type, object_id) values ($1,$2,'user','x','y','z')",
        [ORG, B]),
    )).rejects.toThrow(/row-level security|violates/i);
  });

  it("audit rows cannot be updated or deleted even with widened grants", async () => {
    await asActor(A, ORG, (c) =>
      c.query(
        "insert into public.audit_events (organization_id, actor_user_id, actor_type, action, object_type, object_id) values ($1,$2,'user','x','y','z')",
        [ORG, A]));
    await expect(asActor(A, ORG, (c) =>
      c.query("update public.audit_events set action='forged' where organization_id=$1", [ORG]),
    )).rejects.toThrow(/permission denied|append-only/i);
    await expect(asActor(A, ORG, (c) =>
      c.query("delete from public.audit_events where organization_id=$1", [ORG]),
    )).rejects.toThrow(/permission denied|append-only/i);
  });

  it("outbox insert into a foreign org is denied", async () => {
    await expect(asActor(B, ORG, (c) =>
      c.query(
        "insert into public.transaction_outbox (organization_id, topic, aggregate_type, aggregate_id, payload_version, payload) values ($1,'t','a','1',1,'{}')",
        [ORG]),
    )).rejects.toThrow(/row-level security|violates/i);
  });

  it("idempotency records are invisible across actors", async () => {
    await asActor(A, ORG, (c) =>
      c.query(
        `insert into public.idempotency_records (organization_id, actor_scope, operation_id, idempotency_key, request_hash, state, response_status, response_body, completed_at, expires_at)
         values ($1,$2,'op','k1', repeat('a',64),'completed',200,'{}', now(), now() + interval '1 day')`,
        [ORG, `user:${A}`]));
    const seenByB = await asActor(B, ORG, (c) =>
      c.query("select 1 from public.idempotency_records where idempotency_key='k1'"));
    expect(seenByB.rowCount).toBe(0);
  });

  it("a plain member cannot insert a legal entity; an admin can", async () => {
    const ORG2 = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    await bootstrap(A, ORG2);
    await asActor(A, ORG2, (c) =>
      c.query(
        "insert into public.memberships (organization_id, user_id, role, status, all_projects) values ($1,$2,'viewer','active',false)",
        [ORG2, B]));
    await expect(asActor(B, ORG2, (c) =>
      c.query("insert into public.legal_entities (organization_id, legal_name) values ($1,'X')", [ORG2]),
    )).rejects.toThrow(/row-level security|violates/i);
    const ok = await asActor(A, ORG2, (c) =>
      c.query("insert into public.legal_entities (organization_id, legal_name) values ($1,'X') returning id", [ORG2]));
    expect(ok.rowCount).toBe(1);
  });

  it("two concurrent bootstraps of one org yield exactly one owner", async () => {
    const ORG3 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const results = await Promise.allSettled([bootstrap(A, ORG3), bootstrap(B, ORG3)]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(1);
    const owners = await asActor(A, ORG3, (c) =>
      c.query("select user_id from public.memberships where organization_id=$1", [ORG3]));
    expect(owners.rowCount).toBeLessThanOrEqual(1);
  });
});
```

Note: the memberships insert in `bootstrap` still passes the existing
`m_insert` policy; the concurrency test relies on the serialized
`app.org_has_members` below. One bootstrap loses on either the organizations
PK or the serialized members check — both acceptable, asserted via `ok === 1`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `APP_DB_URL=postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres pnpm --filter @aktflow/testing test -- foundation 2>&1 | tail -6`
Expected: FAIL (cross-org audit/outbox inserts currently succeed; update/delete not blocked; member legal-entity insert succeeds).

- [ ] **Step 3: Write migration 0006**

```sql
-- 0006_foundation_tenant_isolation.sql
-- v0.0 gate 3 (docs/delivery/version-0.0.md): tenant isolation for
-- audit/idempotency/outbox, append-only audit, permission-aware legal
-- entities, serialized first-owner bootstrap. Additive only.

-- 1) Append-only guard (design interface from technical/database/schema-v0.1.sql).
create or replace function app.reject_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only relation %.% cannot be % (correct via successor fact)',
    tg_table_schema, tg_table_name, lower(tg_op);
end $$;

create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function app.reject_mutation();

-- 2) RLS for the operational tables (grants alone are not tenant-safe).
alter table public.audit_events enable row level security;
alter table public.idempotency_records enable row level security;
alter table public.transaction_outbox enable row level security;

-- audit: INSERT only, bound to an org the actor is an active member of.
-- The BFF never reads audit in v0.0; SELECT stays revoked.
revoke select on public.audit_events from aktflow_app;
create policy audit_insert on public.audit_events for insert to aktflow_app
  with check (
    exists (select 1 from public.memberships m
            where m.organization_id = audit_events.organization_id
              and m.user_id = app.current_actor()
              and m.status = 'active'));

-- outbox: INSERT bound the same way (org NULL is not allowed for app inserts).
create policy outbox_insert on public.transaction_outbox for insert to aktflow_app
  with check (
    organization_id is not null
    and exists (select 1 from public.memberships m
                where m.organization_id = transaction_outbox.organization_id
                  and m.user_id = app.current_actor()
                  and m.status = 'active'));

-- idempotency: an actor sees/writes only its own actor_scope; org, when set,
-- must be one of the actor's orgs. Pre-workspace bootstrap keeps org NULL.
create policy idem_select on public.idempotency_records for select to aktflow_app
  using (actor_scope = 'user:' || app.current_actor()::text);
create policy idem_insert on public.idempotency_records for insert to aktflow_app
  with check (
    actor_scope = 'user:' || app.current_actor()::text
    and (organization_id is null
         or exists (select 1 from public.memberships m
                    where m.organization_id = idempotency_records.organization_id
                      and m.user_id = app.current_actor()
                      and m.status = 'active')));

-- 3) Permission-aware legal entities: replace the any-member policy.
drop policy le_insert on public.legal_entities;
create policy le_insert on public.legal_entities for insert to aktflow_app
  with check (exists (
    select 1 from public.memberships m
    where m.organization_id = legal_entities.organization_id
      and m.user_id = app.current_actor()
      and m.status = 'active'
      and m.role in ('owner','admin')));

-- 4) Serialized first-owner bootstrap: org_has_members takes a transaction
-- advisory lock keyed on the org before checking, so two concurrent
-- bootstraps of one org serialize and the loser sees the winner's row.
create or replace function app.org_has_members(org uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('goproceed.bootstrap|' || org::text, 0));
  return exists (select 1 from public.memberships where organization_id = org);
end $$;
```

Note: `stable` + `pg_advisory_xact_lock` — advisory locks are permitted in
stable functions (they do not modify the database); if `supabase db reset`
rejects it, change to `volatile` and re-run.

- [ ] **Step 4: Apply and run tests**

```bash
supabase db reset && pnpm db:local-credentials
APP_DB_URL=postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres \
  pnpm turbo run test --concurrency=1 2>&1 | tail -5
```

Expected: foundation.test.ts PASS; existing rls/migration/app suites still
PASS (the organizations route's audit+outbox inserts satisfy the new
policies because the owner membership is inserted earlier in the same
transaction).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_foundation_tenant_isolation.sql packages/testing/src/foundation.test.ts
git commit -m "feat: tenant-isolate audit/idempotency/outbox and serialize bootstrap"
```

---

### Task 6: Migration 0007 — idempotency expiry enforcement

**Files:**
- Create: `supabase/migrations/0007_idempotency_expiry.sql`
- Modify: `packages/database/src/idempotency.ts`
- Test: `packages/testing/src/idempotency-expiry.test.ts`

**Interfaces:**
- Produces: `app.delete_expired_idempotency(org uuid, scope text, op text, key text) returns boolean`; `withIdempotency` treats an expired record as absent.

- [ ] **Step 1: Write the failing test**

```ts
// packages/testing/src/idempotency-expiry.test.ts
import { describe, it, expect } from "vitest";
import { asActor, resetDb, adminClient } from "./pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("0007 idempotency expiry", () => {
  it("an expired completed record does not block a fresh execution with the same key", async () => {
    await resetDb();
    const admin = await adminClient();
    await admin.query(
      `insert into public.idempotency_records (organization_id, actor_scope, operation_id, idempotency_key, request_hash, state, response_status, response_body, completed_at, created_at, expires_at)
       values (null, $1, 'op', 'k-exp', repeat('a',64), 'completed', 201, '{}', now() - interval '31 days', now() - interval '31 days', now() - interval '1 day')`,
      [`user:${A}`]);
    await admin.end();
    await asActor(A, null, async (c) => {
      const del = await c.query("select app.delete_expired_idempotency(null, $1, 'op', 'k-exp') as d", [`user:${A}`]);
      expect(del.rows[0].d).toBe(true);
      const ins = await c.query(
        `insert into public.idempotency_records (organization_id, actor_scope, operation_id, idempotency_key, request_hash, state, response_status, response_body, completed_at, expires_at)
         values (null, $1, 'op', 'k-exp', repeat('b',64), 'completed', 201, '{}', now(), now() + interval '30 days') returning id`,
        [`user:${A}`]);
      expect(ins.rowCount).toBe(1);
    });
  });

  it("delete_expired refuses unexpired rows and foreign scopes", async () => {
    await asActor(A, null, async (c) => {
      const r = await c.query("select app.delete_expired_idempotency(null, $1, 'op', 'k-exp') as d", [`user:${A}`]);
      expect(r.rows[0].d).toBe(false); // fresh row from previous test is unexpired
      const foreign = await c.query("select app.delete_expired_idempotency(null, 'user:someone-else', 'op', 'k-exp') as d");
      expect(foreign.rows[0].d).toBe(false);
    });
  });
});
```

If `packages/testing/src/pg.ts` lacks `adminClient`, add it there:

```ts
export async function adminClient() {
  const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL
    ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
  await c.connect();
  return c;
}
```

- [ ] **Step 2: Run to verify failure**

Run: `APP_DB_URL=... pnpm --filter @aktflow/testing test -- idempotency-expiry 2>&1 | tail -4`
Expected: FAIL — `app.delete_expired_idempotency` does not exist.

- [ ] **Step 3: Write migration 0007**

```sql
-- 0007_idempotency_expiry.sql
-- v0.0 gate: idempotency expiry is enforced, not just stored. The app role
-- has no DELETE grant; deletion of exactly one expired matching row goes
-- through a SECURITY DEFINER command the caller can only aim at rows whose
-- actor_scope it could see anyway.
create or replace function app.delete_expired_idempotency(
  p_org uuid, p_scope text, p_op text, p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare deleted int;
begin
  -- Only the caller's own scope may be purged; mirrors the RLS select policy.
  if p_scope <> 'user:' || app.current_actor()::text then
    return false;
  end if;
  delete from public.idempotency_records
   where organization_id is not distinct from p_org
     and actor_scope = p_scope and operation_id = p_op
     and idempotency_key = p_key and expires_at <= now();
  get diagnostics deleted = row_count;
  return deleted > 0;
end $$;
revoke all on function app.delete_expired_idempotency(uuid, text, text, text) from public, anon, authenticated;
grant execute on function app.delete_expired_idempotency(uuid, text, text, text) to aktflow_app;

-- Bulk purge for scheduled maintenance (cron/service only).
create or replace function app.purge_expired_idempotency(batch int default 1000) returns int
language sql security definer set search_path = public as $$
  with del as (
    delete from public.idempotency_records
     where id in (select id from public.idempotency_records
                  where expires_at <= now() limit batch)
    returning 1)
  select count(*)::int from del
$$;
revoke all on function app.purge_expired_idempotency(int) from public, anon, authenticated;
grant execute on function app.purge_expired_idempotency(int) to service_role;

do $$
declare has_pg_cron boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_pg_cron;
  if has_pg_cron then
    if exists (select 1 from cron.job where jobname = 'idempotency-purge') then
      perform cron.unschedule('idempotency-purge');
    end if;
    perform cron.schedule('idempotency-purge', '17 3 * * *', $c$select app.purge_expired_idempotency(5000)$c$);
  else
    raise notice 'pg_cron not available: idempotency-purge not scheduled';
  end if;
end $$;
```

- [ ] **Step 4: Make `withIdempotency` expiry-aware**

In `packages/database/src/idempotency.ts`, extend the SELECT to fetch
`expires_at` (already selected) and insert after the `prior` lookup:

```ts
  if (prior && new Date(prior.expires_at).getTime() <= Date.now()) {
    // Expired replay window: the record no longer answers for this key.
    await tx.query("select app.delete_expired_idempotency($1,$2,$3,$4)",
      [args.organizationId, args.actorScope, args.operationId, args.key]);
    return runFresh();
  }
```

where `runFresh()` is the existing execute+insert tail refactored into a
local async function so both paths share it. Conflict/replay branches stay
above this check unchanged EXCEPT they now apply only to unexpired rows:
move the expiry check to run BEFORE the `request_hash` conflict check (an
expired record must not cause `IdempotencyConflictError`).

- [ ] **Step 5: Apply, run, commit**

```bash
supabase db reset && pnpm db:local-credentials
APP_DB_URL=postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres \
  pnpm turbo run test --concurrency=1 2>&1 | tail -5
git add supabase/migrations/0007_idempotency_expiry.sql packages/database/src/idempotency.ts packages/testing/src/idempotency-expiry.test.ts packages/testing/src/pg.ts
git commit -m "feat: enforce idempotency expiry with scoped deletion and purge"
```

---

### Task 7: Migration 0008 — outbox claim, retry, backoff, dead letters

**Files:**
- Create: `supabase/migrations/0008_outbox_claim_retry_dead_letter.sql`
- Test: `packages/testing/src/outbox.test.ts`

**Interfaces:**
- Produces: columns `claimed_by`, `lease_token`, `lease_expires_at`, `last_error` on `transaction_outbox`; table `public.outbox_dead_letters`; role `aktflow_worker` (NOLOGIN); functions `app.claim_outbox(p_batch int, p_worker text, p_lease_seconds int)`, `app.complete_outbox(p_id uuid, p_lease uuid)`, `app.fail_outbox(p_id uuid, p_lease uuid, p_error text)`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/testing/src/outbox.test.ts
import { describe, it, expect } from "vitest";
import { adminClient, resetDb } from "./pg";

async function seedRow(c: any, org: string) {
  const r = await c.query(
    `insert into public.transaction_outbox (organization_id, topic, aggregate_type, aggregate_id, payload_version, payload)
     values ($1,'t','a','1',1,'{}') returning id`, [org]);
  return r.rows[0].id as string;
}

describe("0008 outbox claim/retry/dead-letter", () => {
  it("claim leases a row; a second claimer skips it; complete finishes it", async () => {
    await resetDb();
    const c = await adminClient();
    const org = (await c.query(
      "insert into public.organizations (legal_name, display_name) values ('L','D') returning id")).rows[0].id;
    const id = await seedRow(c, org);
    const claim1 = await c.query("select * from app.claim_outbox(10, 'w1', 60)");
    expect(claim1.rows.map((r: any) => r.id)).toContain(id);
    const lease = claim1.rows.find((r: any) => r.id === id).lease_token;
    const claim2 = await c.query("select * from app.claim_outbox(10, 'w2', 60)");
    expect(claim2.rows.map((r: any) => r.id)).not.toContain(id);
    await c.query("select app.complete_outbox($1,$2)", [id, lease]);
    const done = await c.query("select processed_at from public.transaction_outbox where id=$1", [id]);
    expect(done.rows[0].processed_at).not.toBeNull();
    await c.end();
  });

  it("complete with a wrong lease token is rejected", async () => {
    const c = await adminClient();
    const org = (await c.query("select id from public.organizations limit 1")).rows[0].id;
    const id = await seedRow(c, org);
    const claim = await c.query("select * from app.claim_outbox(10, 'w1', 60)");
    expect(claim.rows.map((r: any) => r.id)).toContain(id);
    await expect(
      c.query("select app.complete_outbox($1, gen_random_uuid())", [id]),
    ).rejects.toThrow(/lease/i);
    await c.end();
  });

  it("fail applies exponential backoff and dead-letters after max attempts", async () => {
    const c = await adminClient();
    const org = (await c.query("select id from public.organizations limit 1")).rows[0].id;
    const id = await seedRow(c, org);
    for (let attempt = 1; attempt <= 5; attempt++) {
      const claim = await c.query("select * from app.claim_outbox(50, 'w1', 60)");
      const row = claim.rows.find((r: any) => r.id === id);
      expect(row, `attempt ${attempt} should be claimable`).toBeTruthy();
      await c.query("select app.fail_outbox($1,$2,'boom')", [id, row.lease_token]);
      if (attempt < 5) {
        // backoff pushed available_at into the future; make it claimable again
        const st = await c.query(
          "select attempt_count, available_at > now() as backed_off from public.transaction_outbox where id=$1", [id]);
        expect(st.rows[0].attempt_count).toBe(attempt);
        expect(st.rows[0].backed_off).toBe(true);
        await c.query("update public.transaction_outbox set available_at = now() where id=$1", [id]);
      }
    }
    const dead = await c.query("select reason from public.outbox_dead_letters where outbox_id=$1", [id]);
    expect(dead.rowCount).toBe(1);
    const row = await c.query("select processed_at from public.transaction_outbox where id=$1", [id]);
    expect(row.rows[0].processed_at).not.toBeNull(); // closed as dead-lettered
    await c.end();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @aktflow/testing test -- outbox 2>&1 | tail -4`
Expected: FAIL — `app.claim_outbox` does not exist.

- [ ] **Step 3: Write migration 0008**

```sql
-- 0008_outbox_claim_retry_dead_letter.sql
-- v0.0 gate: real claim/retry/backoff/error/dead-letter paths
-- (docs/architecture/jobs-events-and-audit.md). drain_outbox (0005) remains
-- for compatibility; the cron job now exercises the lease-based path.
alter table public.transaction_outbox
  add column if not exists claimed_by text,
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_error text;

create table if not exists public.outbox_dead_letters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  outbox_id uuid not null references public.transaction_outbox(id),
  reason text not null,
  attempts int not null,
  first_failed_at timestamptz,
  last_failed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (outbox_id)
);
revoke all on public.outbox_dead_letters from public, anon, authenticated;

do $$ begin
  if not exists (select from pg_roles where rolname = 'aktflow_worker') then
    create role aktflow_worker nologin nobypassrls;
  end if;
end $$;
grant usage on schema app to aktflow_worker;
grant usage on schema public to aktflow_worker;
grant select on public.outbox_dead_letters to aktflow_worker;

-- max attempts / backoff constants pinned here (retry policy v0.0-1):
--   base 30s, multiplier 2, cap 1 hour, max 5 attempts.
create or replace function app.claim_outbox(p_batch int, p_worker text, p_lease_seconds int)
returns setof public.transaction_outbox
language sql security definer set search_path = public as $$
  with picked as (
    select id from public.transaction_outbox
    where processed_at is null and available_at <= now()
      and (lease_expires_at is null or lease_expires_at < now())
    order by available_at limit p_batch
    for update skip locked)
  update public.transaction_outbox o
     set claimed_by = p_worker,
         lease_token = gen_random_uuid(),
         lease_expires_at = now() + make_interval(secs => p_lease_seconds)
    from picked where o.id = picked.id
  returning o.*
$$;

create or replace function app.complete_outbox(p_id uuid, p_lease uuid) returns void
language plpgsql security definer set search_path = public as $$
declare updated int;
begin
  update public.transaction_outbox
     set processed_at = now(), lease_expires_at = null
   where id = p_id and lease_token = p_lease and processed_at is null;
  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'outbox complete rejected: lease mismatch or already processed for %', p_id;
  end if;
end $$;

create or replace function app.fail_outbox(p_id uuid, p_lease uuid, p_error text) returns void
language plpgsql security definer set search_path = public as $$
declare r record; updated int;
begin
  update public.transaction_outbox
     set attempt_count = attempt_count + 1,
         last_error = left(p_error, 500),
         lease_expires_at = null,
         available_at = now() + least(interval '1 hour',
           make_interval(secs => 30 * (2 ^ attempt_count)))
   where id = p_id and lease_token = p_lease and processed_at is null
   returning * into r;
  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'outbox fail rejected: lease mismatch or already processed for %', p_id;
  end if;
  if r.attempt_count >= 5 then
    insert into public.outbox_dead_letters (organization_id, outbox_id, reason, attempts, first_failed_at)
    values (r.organization_id, p_id, left(p_error, 500), r.attempt_count, r.created_at)
    on conflict (outbox_id) do nothing;
    update public.transaction_outbox set processed_at = now() where id = p_id;
  end if;
end $$;

revoke all on function app.claim_outbox(int, text, int) from public, anon, authenticated;
revoke all on function app.complete_outbox(uuid, uuid) from public, anon, authenticated;
revoke all on function app.fail_outbox(uuid, uuid, text) from public, anon, authenticated;
grant execute on function app.claim_outbox(int, text, int) to aktflow_worker, service_role;
grant execute on function app.complete_outbox(uuid, uuid) to aktflow_worker, service_role;
grant execute on function app.fail_outbox(uuid, uuid, text) to aktflow_worker, service_role;
```

- [ ] **Step 4: Apply, run all suites serialized, commit**

```bash
supabase db reset && pnpm db:local-credentials
APP_DB_URL=postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres \
  pnpm turbo run test --concurrency=1 2>&1 | tail -5
git add supabase/migrations/0008_outbox_claim_retry_dead_letter.sql packages/testing/src/outbox.test.ts
git commit -m "feat: lease-based outbox claim with backoff and dead letters"
```

---

### Task 8: Migration 0009 — deny-by-default future privileges

**Files:**
- Create: `supabase/migrations/0009_deny_by_default_privileges.sql`
- Test: `packages/testing/src/privileges.test.ts`

**Interfaces:**
- Produces: `ALTER DEFAULT PRIVILEGES` revocations for the actual migration owner; `revoke create on schema public from public`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/testing/src/privileges.test.ts
import { describe, it, expect } from "vitest";
import { adminClient } from "./pg";

describe("0009 deny-by-default privileges", () => {
  it("a table created after 0009 grants nothing to anon/authenticated", async () => {
    const c = await adminClient();
    await c.query("create table if not exists public._priv_probe (id int)");
    const r = await c.query(`
      select
        has_table_privilege('anon', 'public._priv_probe', 'select') as anon_select,
        has_table_privilege('authenticated', 'public._priv_probe', 'select') as auth_select,
        has_table_privilege('authenticated', 'public._priv_probe', 'insert') as auth_insert`);
    expect(r.rows[0]).toEqual({ anon_select: false, auth_select: false, auth_insert: false });
    await c.query("drop table public._priv_probe");
    await c.end();
  });

  it("PUBLIC cannot create in schema public", async () => {
    const c = await adminClient();
    const r = await c.query(
      "select has_schema_privilege('anon', 'public', 'create') as can_create");
    expect(r.rows[0].can_create).toBe(false);
    await c.end();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @aktflow/testing test -- privileges 2>&1 | tail -4`
Expected: FAIL — the local stack's default privileges currently grant ALL to
anon/authenticated on new tables.

- [ ] **Step 3: Write migration 0009**

```sql
-- 0009_deny_by_default_privileges.sql
-- v0.0 gate: future objects are inaccessible until explicitly granted
-- (docs/architecture/tenancy-and-security.md "Grants and exposed schemas").
revoke create on schema public from public;

-- The migration runner on the local stack and hosted Supabase is `postgres`;
-- pg_default_acl must be checked, not assumed. This block discovers every
-- role owning a default ACL in schema public and strips app-facing roles.
do $$
declare owner_role text;
begin
  for owner_role in
    select distinct pg_get_userbyid(defaclrole)
      from pg_default_acl
     where defaclnamespace = 'public'::regnamespace
    union select 'postgres'
  loop
    execute format(
      'alter default privileges for role %I in schema public revoke all on tables from anon, authenticated',
      owner_role);
    execute format(
      'alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated',
      owner_role);
    execute format(
      'alter default privileges for role %I in schema public revoke all on functions from public, anon, authenticated',
      owner_role);
  end loop;
end $$;
```

`service_role` is deliberately left with its defaults in v0.0: it is
server-side only, RLS-bypassing by design, and Supabase platform tooling
depends on it; narrowing it is a separate reviewed change.

- [ ] **Step 4: Apply, run all suites, commit**

```bash
supabase db reset && pnpm db:local-credentials
APP_DB_URL=postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres \
  pnpm turbo run test --concurrency=1 2>&1 | tail -5
git add supabase/migrations/0009_deny_by_default_privileges.sql packages/testing/src/privileges.test.ts
git commit -m "feat: deny-by-default privileges for future public-schema objects"
```

---

### Task 9: Re-scope the legacy package validator and finish the approved cleanup

The user approved this cleanup on 2026-07-30; execution was blocked only by
`scripts/validate_package.py` (see `cleanup-proposal.md` execution record).

**Files:**
- Modify: `scripts/validate_package.py`
- Move: `docs/{02,16,29,37,38,39}-*.md` → `docs/legacy/`
- Move: `technical/implementation-backlog.csv` → `docs/legacy/`
- Delete: `technical/openapi-redocly-report.txt`, `technical/sql-parser-report.txt`
- Modify: `migration/goproceed-canonical-v0.1/document-disposition.csv`, `cleanup-proposal.md`

**Interfaces:**
- Produces: `python3 scripts/validate_package.py` → PASS with the archived indices allowlisted.

- [ ] **Step 1: Allowlist archived indices in the contiguity check**

In `validate_package.py`, right before the `missing_docs` computation
(~line 222), add:

```python
ARCHIVED_DOC_INDICES = {2, 16, 29, 37, 38, 39}  # moved to docs/legacy/ per document-disposition.csv
```

and change the computation to:

```python
    missing_docs = [
        f"{index:02d}"
        for index in range(highest_doc + 1)
        if index not in numbered_docs and index not in ARCHIVED_DOC_INDICES
    ]
```

- [ ] **Step 2: Drop the moved/deleted files from `required_files`**

Remove these tuples from the numbered list: `(2, "market-competition")`,
`(16, "fidelity-ledger")`, `(29, "prototype-coverage")`,
`(37, "functional-closure-feature-register")`, `(38, "business-logic-closure")`,
`(39, "evidence-graph")`. Remove these entries from the `TECH` filename list:
`"openapi-redocly-report.txt"`, `"sql-parser-report.txt"`,
`"implementation-backlog.csv"`.

- [ ] **Step 3: Excise the report and backlog content checks**

Delete the blocks that read the removed files (grep coordinates as of
`d6c286b`; re-grep before editing):

- `redocly_report = (TECH / "openapi-redocly-report.txt")...` and its two
  `require(...)` calls (~lines 696–702);
- `sql_parser_report = (TECH / "sql-parser-report.txt")...` and its
  `require(...)` (~lines 1775–1782);
- the `implementation-backlog.csv` schema/key entries in the two dicts
  (~lines 287, 308);
- the backlog graph section using `csv_rows["implementation-backlog.csv"]`
  (~lines 2364–2384). Where later code consumes `task_ids` or backlog-derived
  sets, grep for the variable names first (`backlog_rows`, `task_ids`) and
  remove every dependent statement in the same pass.

- [ ] **Step 4: Verify the re-scoped validator on the unchanged tree**

Run: `python3 scripts/validate_package.py 2>&1 | tail -2`
Expected: PASS (nothing moved yet — the validator must tolerate BOTH states).

- [ ] **Step 5: Execute the moves and deletions**

```bash
git mv docs/02-market-competition.md docs/legacy/
git mv docs/16-fidelity-ledger.md docs/legacy/
git mv docs/29-prototype-coverage.md docs/legacy/
git mv docs/37-functional-closure-feature-register.md docs/legacy/
git mv docs/38-business-logic-closure.md docs/legacy/
git mv docs/39-evidence-graph.md docs/legacy/
git mv technical/implementation-backlog.csv docs/legacy/
git rm technical/openapi-redocly-report.txt technical/sql-parser-report.txt
```

- [ ] **Step 6: Verify both validators after the moves**

```bash
python3 scripts/validate_package.py 2>&1 | tail -2
node scripts/validate-canonical-docs.mjs
```

Expected: PASS and `canonical documentation: OK`. If a remaining legacy doc's
markdown LINK (not prose mention) pointed at a moved file, the validator names
it; resolve by updating the disposition/cleanup record and moving the link
target back — do NOT edit legacy prose.

- [ ] **Step 7: Update the ledger**

In `document-disposition.csv`: for the six docs and the backlog set
`target_path` to `docs/legacy/<filename>` and `review_status` to
`executed_2026-07-30`; for the two reports set `review_status` to
`deleted_2026-07-30`. Append the executed paths to the
`cleanup-proposal.md` execution record.

- [ ] **Step 8: Commit**

```bash
git add scripts/validate_package.py migration/goproceed-canonical-v0.1 docs/legacy technical
git commit -m "chore: re-scope legacy validator and finish approved cleanup"
```

---

### Task 10: Migration safety rails — catalog snapshot and rollback plan

**Files:**
- Create: `scripts/snapshot-db-catalog.mjs`
- Modify: `package.json` (script `db:catalog-snapshot`)
- Create: `migration/goproceed-canonical-v0.1/migration-safety-plan.md`
- Create: `migration/goproceed-canonical-v0.1/catalog-snapshots/` (first snapshot)

**Interfaces:**
- Produces: `pnpm db:catalog-snapshot` writing `migration/goproceed-canonical-v0.1/catalog-snapshots/<YYYYMMDD-HHmm>.md`.

- [ ] **Step 1: Write the snapshot script**

```js
// scripts/snapshot-db-catalog.mjs
// Dumps the live catalog (tables, columns count, RLS, policies, grants,
// functions, roles, triggers) so staging/production drift stops being
// unknown (baseline-verification "What is not verified").
import pg from "pg";
import { writeFileSync, mkdirSync } from "node:fs";

const url = process.env.SUPABASE_DB_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const c = new pg.Client({ connectionString: url });
await c.connect();
const q = async (sql) => (await c.query(sql)).rows;

const sections = {
  tables: await q(`select schemaname, tablename, rowsecurity from pg_tables
                   where schemaname in ('public','api','app') order by 1,2`),
  policies: await q(`select schemaname, tablename, policyname, cmd, roles::text
                     from pg_policies order by 1,2,3`),
  grants: await q(`select table_schema, table_name, grantee, privilege_type
                   from information_schema.role_table_grants
                   where table_schema in ('public','api','app')
                     and grantee not in ('postgres','PUBLIC') order by 1,2,3,4`),
  functions: await q(`select n.nspname, p.proname, p.prosecdef
                      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname in ('public','api','app') order by 1,2`),
  roles: await q(`select rolname, rolcanlogin, rolbypassrls from pg_roles
                  where rolname like 'aktflow%' or rolname in ('anon','authenticated','service_role') order by 1`),
  triggers: await q(`select event_object_table, trigger_name, action_timing, event_manipulation
                     from information_schema.triggers where trigger_schema='public' order by 1,2`),
  default_acls: await q(`select pg_get_userbyid(defaclrole) as owner, defaclobjtype, defaclacl::text
                         from pg_default_acl order by 1,2`),
};
await c.end();

const stamp = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, "").replace(/(\d{8})(\d{4})/, "$1-$2");
mkdirSync("migration/goproceed-canonical-v0.1/catalog-snapshots", { recursive: true });
const out = `migration/goproceed-canonical-v0.1/catalog-snapshots/${stamp}.md`;
let md = `# DB catalog snapshot ${new Date().toISOString()}\n\nSource: ${new URL(url).hostname}\n`;
for (const [name, rows] of Object.entries(sections)) {
  md += `\n## ${name} (${rows.length})\n\n\`\`\`json\n${JSON.stringify(rows, null, 1)}\n\`\`\`\n`;
}
writeFileSync(out, md);
console.log("snapshot written:", out);
```

Add to root `package.json` scripts:
`"db:catalog-snapshot": "node scripts/snapshot-db-catalog.mjs"`.

- [ ] **Step 2: Take the first snapshot against the freshly migrated local DB**

Run: `supabase db reset && pnpm db:local-credentials && pnpm db:catalog-snapshot`
Expected: `snapshot written: migration/.../catalog-snapshots/<stamp>.md` with
non-empty tables/policies/roles sections including migrations 0006–0009
objects.

- [ ] **Step 3: Write the safety plan**

`migration-safety-plan.md` content:

```markdown
# Migration safety plan (v0.0 additions)

**Status:** Approved
**Applies to:** v0.0
**Last reviewed:** 2026-07-30

## Additive rule
Migrations 0006-0009 add objects only; no baseline rename/drop. Any
destructive change needs its own approved migration per
docs/architecture/data-model.md "Additive migration rules".

## Per-migration rollback / forward-fix
| Migration | Rollback (dev only) | Forward fix (staging/prod) |
|---|---|---|
| 0006 tenant isolation | drop policies audit_insert/outbox_insert/idem_select/idem_insert; recreate le_insert from 0004; restore sql org_has_members; drop trigger audit_events_append_only | new migration re-creating the corrected policy; never disable RLS in place |
| 0007 idempotency expiry | drop functions delete_expired/purge_expired; unschedule idempotency-purge | new migration replacing the function body |
| 0008 outbox claim | drop functions claim/complete/fail_outbox; drop table outbox_dead_letters; alter table drop the four added columns | new migration; dead_letters rows are append-only evidence, never dropped with data |
| 0009 default privileges | re-grant via alter default privileges (dev only) | new migration adjusting grants explicitly |

## Live-catalog verification
`pnpm db:catalog-snapshot` against each environment before and after every
deploy; snapshots are committed under catalog-snapshots/ and diffed. Staging
verification follows infra/README-staging.md; production requires the same
snapshot step once production exists.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/snapshot-db-catalog.mjs package.json migration/goproceed-canonical-v0.1
git commit -m "docs: add catalog snapshot tooling and migration safety plan"
```

---

### Task 11: Serialized green-baseline re-run

**Files:**
- Modify: `migration/goproceed-canonical-v0.1/baseline-verification.md`
- Modify: `migration/goproceed-canonical-v0.1/final-review.md`
- Modify: `docs/delivery/version-0.0.md` (tick the closed checklists)

- [ ] **Step 1: Full serialized run from a clean database**

```bash
supabase db reset && pnpm db:local-credentials
APP_DB_URL=postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres \
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  pnpm turbo run test --concurrency=1 2>&1 | tail -12
```

Expected: every package green. If a non-security test fails, either fix it in
this task or add a quarantine entry (owner, reason, expiry, removal
condition) to `baseline-verification.md`; security/tenant-isolation suites
can never be quarantined.

- [ ] **Step 2: Record the result**

Append to `baseline-verification.md`:

```markdown
## v0.0 re-run (2026-07-30)

Serialized `pnpm turbo run test --concurrency=1` against a freshly reset
local database after migrations 0006-0009:

- Test files: <N> passed, <M> failed
- Tests: <N> passed, <M> failed
- Environment: local Supabase reachable; APP_DB_URL set;
  build-script policy D-048 active; demo suites run via vitest.workspace.ts.
- Quarantines: <none | list>
```

(fill the counts from the actual run output — this is a recording step, the
numbers must be verbatim). Update `final-review.md` §4 with one line pointing
to this addendum, and tick the corresponding `version-0.0.md` checklist items
that now have evidence.

- [ ] **Step 3: Both validators + commit**

```bash
node scripts/validate-canonical-docs.mjs && python3 scripts/validate_package.py | tail -1
git add migration/goproceed-canonical-v0.1 docs/delivery/version-0.0.md
git commit -m "docs: record serialized v0.0 baseline re-run"
```

---

## Out of scope (explicitly)

- Governance-role migration (owner/admin/member/auditor) and the tenant-local
  party migration: they land with v0.1-M1 per
  `technical/database/entity-catalog.csv`, not v0.0.
- Renaming `aktflow_*` roles/packages to `goproceed_*`.
- A real outbox consumer/worker process (v0.1; 0008 provides the protocol).
- Narrowing `service_role` defaults.
- Any change under `/Users/akisliy/Downloads/aktflow-product-package 2`.

## Self-review checklist

- Every `version-0.0.md` gate maps to a task: env/build policy (T1), demo
  utility + reproducible runner (T2), CI pinning (T3), green baseline (T11),
  tenant isolation + bootstrap + le-permission + append-only audit +
  idempotency expiry + outbox paths (T5–T7), deny-by-default (T8), seed
  safety (T4), migration rails + catalog snapshot (T10); validator re-scope +
  cleanup completion (T9) closes the user-approved cleanup.
- No placeholders: every code step carries the actual SQL/TS/JS.
- Type/name consistency: `app.reject_mutation`, `app.org_has_members(uuid)`,
  `app.delete_expired_idempotency(uuid,text,text,text)`,
  `app.claim_outbox(int,text,int)`, `app.complete_outbox(uuid,uuid)`,
  `app.fail_outbox(uuid,uuid,text)` are used with identical signatures in
  their migration and test tasks.
