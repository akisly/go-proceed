# v0.1-M2 service principal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `evidence_objects.inspection_status` and
`capture_events.event_source = 'server'` writable only from the server's own
database connection, so they record what the server observed instead of what the
uploading member asserted.

**Architecture:** A second PostgreSQL login (`aktflow_service_login`) belongs to
a new `aktflow_service` role, which is itself a member of `aktflow_app`. The
service role can therefore do everything the application role can, plus assert
server facts; the application login cannot reach it, because role membership is
one-directional and `aktflow_app_login` belongs only to `aktflow_app`. The
finalize route reads and authorizes on the application pool, then switches to a
service pool for every write made after the server has looked at the bytes.

**Tech Stack:** PostgreSQL 15 (roles, RLS, `SECURITY DEFINER`), Supabase CLI
local stack, Node `pg` connection pools, Next.js route handlers, Vitest.

## Global Constraints

- **Migrations are additive and numbered from `0034`.** `0015`–`0033` exist and
  are never edited. Migrations `0001`–`0014` are applied history on `main`.
- **No migration ever sets a password.** A default `supabase db push` runs
  migrations only; credentials are set by `scripts/set-local-app-password.mjs`
  on localhost, or by an operator (`infra/README-staging.md` §3).
- **Branch:** `claude/m2-service-principal`, stacked on
  `claude/m2-superpowers-brainstorm-6e5ec1` (PR #5). Do not rebase onto `main`;
  `main` does not have the M2-A tables.
- **Every test command needs `APP_DB_URL` in the environment.** Use:
  `APP_DB_URL="postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres"`
- **The full suite must be run with `--force`.** turbo caches `test` results and
  a SQL-only change can otherwise replay a stale pass.
- **`aktflow_app_login` must never become a member of `aktflow_service`.** That
  membership is the whole boundary.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0034_service_principal_role.sql` | Creates `aktflow_service` and `aktflow_service_login`, wires membership. No enforcement. |
| `supabase/migrations/0035_server_facts_are_service_only.sql` | `app.finalize_upload_intent` requires the service principal; `ce_insert` splits by `event_source`. |
| `scripts/set-local-app-password.mjs` | Extended to set the service login's local password too. |
| `packages/database/src/pool.ts` | Gains `getServicePool()` alongside `getPool()`. |
| `packages/database/src/tx.ts` | Gains `withServiceTx()` beside `withTenantTx()`. |
| `packages/testing/src/pg.ts` | Gains `asService()` beside `asActor()`. |
| `packages/database/src/tx.test.ts` | Gains the assertion that a service transaction runs as the service role. |
| `apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts` | Post-inspection writes move to the service transaction. |
| `packages/testing/src/m2-service-principal.test.ts` | New. Attack tests for the role boundary and both enforcement points. |
| `apps/app/.env.example`, `.github/workflows/ci.yml` | `SERVICE_DB_URL`. |

---

### Task 1: The service role, its login, and the credentials that reach it

Nothing is enforced in this task. It creates the identity and proves the
boundary is real before anything depends on it.

**Files:**
- Create: `supabase/migrations/0034_service_principal_role.sql`
- Create: `packages/testing/src/m2-service-principal.test.ts`
- Modify: `scripts/set-local-app-password.mjs`
- Modify: `apps/app/.env.example`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: roles `aktflow_service` (NOLOGIN) and `aktflow_service_login`
  (LOGIN); the connection string
  `postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres`,
  exported to later tasks as the env var `SERVICE_DB_URL`.

- [ ] **Step 1: Write the failing test**

Create `packages/testing/src/m2-service-principal.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient } from "./pg";

// The whole boundary is role membership. If aktflow_app_login can reach
// aktflow_service, every guarantee built on top of it is decoration.

let c: Client;

beforeAll(async () => { c = await adminClient(); });
afterAll(async () => { await c.end(); });

/** Direct grants only — pg_auth_members is not transitive. */
async function memberOf(role: string): Promise<string[]> {
  const r = await c.query<{ grantee: string }>(
    `select r.rolname as grantee
       from pg_auth_members am
       join pg_roles r on r.oid = am.member
       join pg_roles g on g.oid = am.roleid
      where g.rolname = $1
      order by 1`, [role]);
  return r.rows.map((x) => x.grantee);
}

describe("the service principal is a separate identity", () => {
  it("exists as a nologin role with a login of its own", async () => {
    const r = await c.query<{ rolname: string; rolcanlogin: boolean; rolbypassrls: boolean }>(
      `select rolname, rolcanlogin, rolbypassrls from pg_roles
        where rolname in ('aktflow_service','aktflow_service_login') order by 1`);
    expect(r.rows).toEqual([
      { rolname: "aktflow_service", rolcanlogin: false, rolbypassrls: false },
      { rolname: "aktflow_service_login", rolcanlogin: true, rolbypassrls: false },
    ]);
  });

  it("can do everything the application role can", async () => {
    // Membership, not a duplicated grant surface: the server is the app plus
    // the right to speak for itself.
    expect(await memberOf("aktflow_app")).toContain("aktflow_service");
  });

  it("is unreachable from the application login", async () => {
    // The direction that matters. aktflow_app_login must never be able to
    // SET ROLE its way into asserting server facts.
    expect(await memberOf("aktflow_service")).toEqual(["aktflow_service_login"]);
    expect(await memberOf("aktflow_service")).not.toContain("aktflow_app_login");
    expect(await memberOf("aktflow_service")).not.toContain("aktflow_app");
  });

  it("refuses the application login an actual SET ROLE", async () => {
    // Asserting the catalog is not the same as attempting the move.
    const { Client } = await import("pg");
    const app = new Client({ connectionString: process.env.APP_DB_URL
      ?? "postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" });
    await app.connect();
    try {
      let code = "";
      try { await app.query("set role aktflow_service"); }
      catch (e) { code = (e as { code?: string }).code ?? "unknown"; }
      expect(code).toBe("42501");
    } finally { await app.end(); }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
APP_DB_URL="postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" pnpm --filter @aktflow/testing test -- src/m2-service-principal.test.ts
```
Expected: FAIL. The first test returns `[]` instead of two rows, because
neither role exists yet.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0034_service_principal_role.sql`:

```sql
-- 0034: the service principal.
--
-- Additive. Creates two roles and one membership edge. Enforces nothing — 0035
-- does that, once the application already speaks through this identity.
--
-- Why a second LOGIN and not `set local role` on the existing one: role
-- membership is what makes this a boundary instead of a convention.
-- aktflow_app_login is a member of aktflow_app and nothing else, so SQL
-- injected into any ordinary route runs on a connection that CANNOT reach the
-- service role. Reusing the application login would leave the same injected SQL
-- free to issue the very `set local role` the application uses.
--
-- aktflow_service is a member of aktflow_app rather than a parallel grant
-- surface. The server is the application plus the right to speak for itself,
-- and duplicating grants would mean every future table grant had to be made
-- twice — a divergence nobody would notice until a policy quietly stopped
-- applying.
--
-- No password here, for the same reason 0003 sets none: a default
-- `supabase db push` runs migrations only, and must never plant a credential.
-- Local and CI get one from scripts/set-local-app-password.mjs; staging and
-- production get one from an operator (infra/README-staging.md §3).
do $$ begin
  if not exists (select from pg_roles where rolname = 'aktflow_service') then
    create role aktflow_service nologin nobypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'aktflow_service_login') then
    create role aktflow_service_login login noinherit nobypassrls;
  end if;
end $$;

grant aktflow_app to aktflow_service;
grant aktflow_service to aktflow_service_login;

comment on role aktflow_service is
  'The server''s own identity. Everything aktflow_app can do, plus the right to '
  'record what the server observed — inspection verdicts and server-sourced '
  'capture events. Unreachable from aktflow_app_login by design.';
```

- [ ] **Step 4: Apply and run the test to verify it passes**

Run:
```bash
supabase db reset && node scripts/set-local-app-password.mjs
APP_DB_URL="postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" pnpm --filter @aktflow/testing test -- src/m2-service-principal.test.ts
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Give the service login a local password**

Modify `scripts/set-local-app-password.mjs`. Replace the single `alter role`
line and the final `console.log` with:

```js
// Both logins, one script: a service credential that only exists in someone's
// shell is a credential CI does not have, and the finalize path would fail
// there for a reason that looks nothing like its cause.
const servicePassword = process.env.SERVICE_DB_PASSWORD ?? "service_pw";
for (const [role, secret] of [
  ["aktflow_app_login", password],
  ["aktflow_service_login", servicePassword],
]) {
  // Identifiers are fixed; the password value is escaped as a SQL literal.
  await client.query(`alter role ${role} password '${secret.replaceAll("'", "''")}'`);
}
await client.end();
console.log("aktflow_app_login and aktflow_service_login passwords set on", url.hostname);
```

Also update the file's header comment, replacing "the dev-only password for
aktflow_app_login" with "the dev-only passwords for aktflow_app_login and
aktflow_service_login".

- [ ] **Step 6: Verify the service login can actually connect**

Run:
```bash
node scripts/set-local-app-password.mjs
psql "postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres" -c "select current_user, session_user" 2>/dev/null \
  || docker exec "$(docker ps --format '{{.Names}}' | grep supabase_db | head -1)" \
     psql "postgresql://aktflow_service_login:service_pw@127.0.0.1:5432/postgres" -c "select current_user, session_user"
```
Expected: one row, `aktflow_service_login | aktflow_service_login`.

- [ ] **Step 7: Declare the connection string**

Append to `apps/app/.env.example`:

```
# The server's own identity. Used only for writes the server makes on its own
# behalf — inspection verdicts and server-sourced capture events — so that a
# member who can execute SQL as aktflow_app cannot forge them. 'service_pw' is
# a LOCAL-ONLY dev password set by scripts/set-local-app-password.mjs, never by
# a migration or by seed.sql. Staging and production must use a freshly
# generated secret; see infra/README-staging.md §3.
SERVICE_DB_URL=postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres
```

In `.github/workflows/ci.yml`, add to the `env:` block of the `verify` job,
immediately after the `APP_DB_URL:` line:

```yaml
      # The service principal's connection (migration 0034). Set by the same
      # local-credentials script as APP_DB_URL, one step below.
      SERVICE_DB_URL: postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres
```

- [ ] **Step 8: Run the full suite**

Run:
```bash
supabase db reset && node scripts/set-local-app-password.mjs
APP_DB_URL="postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" \
SERVICE_DB_URL="postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres" \
pnpm turbo run test --concurrency=1 --force
```
Expected: 6/6 tasks. Test count is 610 (606 from the M2-A branch plus this
task's 4). Nothing else changed behaviour. If the count differs, find out why
before continuing — do not adjust the expectation to match.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0034_service_principal_role.sql \
  packages/testing/src/m2-service-principal.test.ts \
  scripts/set-local-app-password.mjs apps/app/.env.example .github/workflows/ci.yml
git commit -m "feat(m2): give the server an identity of its own

Two roles and one membership edge, enforcing nothing yet. aktflow_service is a
member of aktflow_app, so the server is the application plus the right to speak
for itself; aktflow_service_login is a member of aktflow_service and nothing
else, and aktflow_app_login remains a member of aktflow_app and nothing else.

That direction is the entire boundary, so the test attempts the move rather than
only reading the catalog: SET ROLE aktflow_service from the application login
must fail with 42501."
```

---

### Task 2: The application speaks through the new identity

Still no enforcement. The route starts using the service connection for writes
made after inspection, so that Task 3 can forbid the old path without breaking
anything.

**Files:**
- Modify: `packages/database/src/pool.ts`
- Modify: `packages/database/src/tx.ts`
- Modify: `packages/database/src/tx.test.ts`
- Modify: `apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts`
- Test: `apps/app/tests/finalize-vanishing-bytes.int.test.ts` (must keep passing)

**Interfaces:**
- Consumes: `SERVICE_DB_URL` from Task 1. The test uses the seeded user
  `A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"` already defined at the top of
  `tx.test.ts`.
- Produces: `getServicePool(): pg.Pool` and
  `withServiceTx<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T>`,
  both exported from `@aktflow/database`. `withServiceTx` has the same signature
  as `withTenantTx`; only the pool and the role differ.

- [ ] **Step 1: Write the failing test**

Add to `packages/database/src/tx.test.ts` — the transaction wrapper's own suite,
so no new package dependency is introduced. Change the first import line to
`import { withTenantTx, withServiceTx } from "./tx";` and append:

```ts
describe("withServiceTx", () => {
  it("runs as the service role while keeping the login as session_user", async () => {
    // session_user staying the login is not incidental: it is the only reason
    // a SECURITY DEFINER function can ask who connected, which is what
    // migration 0035 depends on.
    const seen = await withServiceTx(
      { actorUserId: A, organizationId: null, requestId: "req-service" },
      async (tx) => {
        const r = await tx.query<{ cu: string; su: string }>(
          "select current_user as cu, session_user as su");
        return r.rows[0]!;
      });
    expect(seen.cu).toBe("aktflow_service");
    expect(seen.su).toBe("aktflow_service_login");
  });

  it("still carries the actor, because the server acts on a member's behalf", async () => {
    const seen = await withServiceTx(
      { actorUserId: A, organizationId: null, requestId: "req-service" },
      async (tx) => {
        const r = await tx.query<{ actor: string }>(
          "select current_setting('app.actor_user_id', true) as actor");
        return r.rows[0]!;
      });
    expect(seen.actor).toBe(A);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
APP_DB_URL="postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" \
SERVICE_DB_URL="postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres" \
pnpm --filter @aktflow/database test
```
Expected: FAIL — `withServiceTx` is not exported from `./tx`.

- [ ] **Step 3: Add the second pool**

In `packages/database/src/pool.ts`, append:

```ts
let servicePool: pg.Pool | null = null;
/**
 * The server's own connection.
 *
 * Separate from getPool() on purpose: sharing a pool would mean sharing a
 * login, and the boundary this exists for is exactly that a connection
 * authenticated as aktflow_app_login cannot become the service role. Smaller
 * max than the application pool because only the finalize path uses it.
 */
export function getServicePool(): pg.Pool {
  if (!servicePool) {
    const connectionString = process.env.SERVICE_DB_URL;
    if (!connectionString) throw new Error("SERVICE_DB_URL is not set");
    servicePool = new Pool({ connectionString, max: 4 });
    servicePool.on("error", (err) => { console.error("[db] idle service client error", err); });
  }
  return servicePool;
}
```

- [ ] **Step 4: Add the service transaction**

In `packages/database/src/tx.ts`, change the import line to
`import { getPool, getServicePool } from "./pool";`, then refactor
`withTenantTx` so both wrappers share one body. Replace the whole
`withTenantTx` function with:

```ts
async function runTx<T>(
  pool: ReturnType<typeof getPool>, role: string,
  ctx: TenantContext, fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let released = false;
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    await client.query("select set_config('app.actor_user_id', $1, true)", [ctx.actorUserId]);
    await client.query("select set_config('app.organization_id', $1, true)", [ctx.organizationId ?? ""]);
    await client.query("select set_config('app.request_id', $1, true)", [ctx.requestId]);
    await client.query("select set_config('app.membership_version', $1, true)",
      [ctx.membershipVersion != null ? String(ctx.membershipVersion) : ""]);
    const result = await fn({ query: client.query.bind(client) });
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch (rollbackErr) {
      client.release(rollbackErr as Error); // destroy, don't return a poisoned client
      released = true;
    }
    throw err; // always the ORIGINAL error
  } finally {
    if (!released) client.release(); // GUCs are transaction-local; nothing leaks to the pooled connection
  }
}

export async function withTenantTx<T>(
  ctx: TenantContext, fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return runTx(getPool(), "aktflow_app", ctx, fn);
}

/**
 * A transaction on the server's own connection.
 *
 * Same shape as withTenantTx, and it still carries the actor GUC: this is the
 * server acting ON BEHALF OF a member, so ownership and capability checks keep
 * working exactly as they did. The service principal authorizes nothing by
 * itself; it only vouches for what the server observed.
 *
 * Use it for writes made AFTER the server has looked at the bytes. Reads and
 * authorization stay on withTenantTx, so an ordinary request never touches this
 * connection.
 */
export async function withServiceTx<T>(
  ctx: TenantContext, fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return runTx(getServicePool(), "aktflow_service", ctx, fn);
}
```

The `role` argument is interpolated, not parameterised, because `SET ROLE` does
not accept parameters. Both call sites pass a literal; never widen this to
accept caller input.

- [ ] **Step 5: Run the test to verify it passes**

Run the Step 2 command. Expected: PASS, 6 tests in `@aktflow/database`.

- [ ] **Step 6: Move the route's post-inspection writes onto the service connection**

In `apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts`:

1. Change the import to
   `import { withTenantTx, withServiceTx, recordAudit, enqueueOutbox } from "@aktflow/database";`
2. In `recordFailure`, change `await withTenantTx(ctx, async (tx) => {` to
   `await withServiceTx(ctx, async (tx) => {`.
3. In the blocking branch, change `const blocked = await withTenantTx(ctx, async (tx) => {`
   to `const blocked = await withServiceTx(ctx, async (tx) => {`.
4. In the finalization block, change
   `const result = await withServiceTx<FinalizeResult>(ctx, async (tx) => {`
   — that is, replace `withTenantTx<FinalizeResult>` with
   `withServiceTx<FinalizeResult>`.
5. Replace the comment above the finalization block's first line with:

```ts
    // On the SERVICE connection (migration 0034). Everything from here down
    // records what the server concluded after reading the bytes, and a write
    // that speaks for the server has to come from the server's own identity —
    // otherwise the column says "server" because the caller typed it.
    //
    // The boundary is the moment, not the statement list: the next write added
    // to this path is on the right side of it by default.
```

Leave the intent read and the authorization block on `withTenantTx`.

- [ ] **Step 7: Run the finalize tests to verify nothing changed**

Run:
```bash
APP_DB_URL="postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" \
SERVICE_DB_URL="postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres" \
pnpm --filter @aktflow/app test -- tests/finalize-vanishing-bytes.int.test.ts tests/vertical-m2a.int.test.ts tests/concurrency.int.test.ts
```
Expected: PASS. Behaviour is identical; only the connection changed.

- [ ] **Step 8: Commit**

```bash
git add packages/database/src/pool.ts packages/database/src/tx.ts \
  packages/database/src/tx.test.ts \
  "apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts"
git commit -m "feat(m2): route the server's own writes through the server's connection

Still enforcing nothing — this makes the application comply before the database
starts requiring it, so the next commit can forbid the old path without a window
where finalization is broken.

withTenantTx and withServiceTx now share one body; the only differences are the
pool and the role. The service transaction still carries the actor GUC, because
this is the server acting on behalf of a member: ownership and capability checks
have to keep working, and the service principal authorizes nothing on its own."
```

---

### Task 3: The database refuses the old path

**Files:**
- Create: `supabase/migrations/0035_server_facts_are_service_only.sql`
- Modify: `packages/testing/src/pg.ts`
- Modify: `packages/testing/src/m2-binding-hardening.test.ts`
- Test: `packages/testing/src/m2-service-principal.test.ts`

**Interfaces:**
- Consumes: `aktflow_service` from Task 1; the route already complying from
  Task 2.
- Produces: `asService(actorUserId, organizationId, fn)` in
  `packages/testing/src/pg.ts`, same signature as the existing `asActor`.

- [ ] **Step 1: Add the service test client**

In `packages/testing/src/pg.ts`, after the `APP_URL` constant add:

```ts
// The server's identity. 'service_pw' is the local/CI-only password set by
// scripts/set-local-app-password.mjs — never by a migration, never by seed.sql.
const SERVICE_URL = process.env.SERVICE_DB_URL
  ?? "postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres";
```

and after `asActor` add:

```ts
/** Runs as the server rather than as a member. Same shape as asActor. */
export async function asService<T extends QueryResultRow = QueryResultRow>(
  actorUserId: string, organizationId: string | null,
  fn: (c: Client) => Promise<QueryResult<T>> | Promise<void>,
): Promise<QueryResult<T>> {
  const c = new Client({ connectionString: SERVICE_URL });
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role aktflow_service");
    await c.query("select set_config('app.actor_user_id', $1, true)", [actorUserId]);
    await c.query("select set_config('app.organization_id', $1, true)", [organizationId ?? ""]);
    const res = await fn(c);
    await c.query("commit");
    return (res ?? { rows: [], rowCount: 0 }) as QueryResult<T>;
  } catch (e) { await c.query("rollback"); throw e; }
  finally { await c.end(); }
}
```

- [ ] **Step 2: Write the failing attack tests**

Add to `packages/testing/src/m2-service-principal.test.ts`. It needs the M2
fixture, so add these imports at the top of the file:

```ts
import { asActor, asService } from "./pg";
import {
  seedM2World, grantM2Capabilities, seedAssignment, dropM2Workspaces, type M2Fixture,
} from "./m2-fixture";
```

and this block at the end:

```ts
const WS_S = "5e111111-1111-1111-1111-111111111111";
const USER_S = "5e222222-2222-2222-2222-222222222222";

describe("only the server may say the server said it", () => {
  let f: M2Fixture;
  let assignmentId: string;
  let intentId: string;
  let key: string;

  beforeAll(async () => {
    await dropM2Workspaces(c, [WS_S]);
    f = await seedM2World(c, { workspaceId: WS_S, userId: USER_S,
                               email: "svc@example.test", suffix: "SV" });
    await grantM2Capabilities(c, f);
    assignmentId = await seedAssignment(c, f);
    key = `${crypto.randomUUID()}/${crypto.randomUUID()}`;
    const r = await c.query(
      `insert into public.upload_intents
         (workspace_id, project_id, work_assignment_id, created_by_member_id,
          origin_method, idempotency_key, request_hash, expected_byte_size,
          expected_content_hash, allowed_content_family, claimed_media_type,
          staging_bucket, staging_storage_key, expires_at)
       values ($1,$2,$3,$4,'native_camera',$5,repeat('a',64),11,repeat('d',64),
               'image','image/jpeg','evidence',$6, now() + interval '1 day')
       returning id`,
      [f.workspaceId, f.projectId, assignmentId, f.memberId, crypto.randomUUID(), key]);
    intentId = r.rows[0].id;
    await c.query(
      `insert into storage.objects (bucket_id, name, metadata)
       values ('evidence', $1, jsonb_build_object('size', 11::int))`, [key]);
  });

  afterAll(async () => { await dropM2Workspaces(c, [WS_S]); });

  const captureEvent = (source: string) =>
    `insert into public.capture_events
       (workspace_id, project_id, work_assignment_id, upload_intent_id,
        client_state, event_source)
     values ('${f.workspaceId}','${f.projectId}','${assignmentId}','${intentId}',
             'failed','${source}')`;

  it("refuses a member claiming an event came from the server", async () => {
    let code = "";
    try {
      await asActor(USER_S, WS_S, (cl) => cl.query(captureEvent("server")));
    } catch (e) { code = (e as { code?: string }).code ?? "unknown"; }
    expect(code).toBe("42501");   // RLS refused the write
  });

  it("still lets a member record what their device did", async () => {
    let code = "";
    try {
      await asActor(USER_S, WS_S, (cl) => cl.query(captureEvent("device")));
    } catch (e) { code = (e as { code?: string }).code ?? "unknown"; }
    expect(code).toBe("");
  });

  it("lets the server record what the server did", async () => {
    let code = "";
    try {
      await asService(USER_S, WS_S, (cl) => cl.query(captureEvent("server")));
    } catch (e) { code = (e as { code?: string }).code ?? "unknown"; }
    expect(code).toBe("");
  });

  it("refuses a member creating evidence, even with every capability", async () => {
    // The verdict is the point: this caller owns the intent, holds
    // evidence.record, and presents exactly the hash and size authorization
    // fixed. What they do not have is the right to say inspection passed.
    let message = "";
    try {
      await asActor(USER_S, WS_S, (cl) => cl.query(
        `select * from app.finalize_upload_intent($1,$2,$3,$4,$5,$6,$7)`,
        [f.workspaceId, intentId, "d".repeat(64), 11, "image/jpeg", "passed", "probe"]));
    } catch (e) { message = (e as Error).message; }
    expect(message).toMatch(/service/i);

    const none = await c.query(
      `select count(*) n from public.evidence_objects where upload_intent_id = $1`,
      [intentId]);
    expect(none.rows[0].n).toBe("0");
  });

  it("lets the server create evidence", async () => {
    const r = await asService(USER_S, WS_S, (cl) => cl.query<{ outcome: string }>(
      `select * from app.finalize_upload_intent($1,$2,$3,$4,$5,$6,$7)`,
      [f.workspaceId, intentId, "d".repeat(64), 11, "image/jpeg", "passed", "probe"]));
    expect(r.rows[0]!.outcome).toBe("created");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:
```bash
APP_DB_URL="postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" \
SERVICE_DB_URL="postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres" \
pnpm --filter @aktflow/testing test -- src/m2-service-principal.test.ts
```
Expected: FAIL on two tests — "refuses a member claiming an event came from the
server" gets `""` instead of `42501`, and "refuses a member creating evidence"
gets `""` instead of a message mentioning the service role.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/0035_server_facts_are_service_only.sql`:

```sql
-- 0035: the two columns that speak for the server become the server's to write.
--
-- Additive. Replaces one function body and one policy, and adds one policy.
--
-- Until now both were assertions made by the party they exist to distinguish
-- from. A holder of evidence.record could authorize an intent, upload bytes
-- nobody looked at, and pass inspection_status = 'passed'; the same member could
-- write event_source = 'server' on their own capture event. 0032 closed the
-- adjacent hole — evidence for bytes that are not in the bucket — but whether
-- anyone INSPECTED those bytes was still whatever the caller said.
--
-- The check is pg_has_role on session_user, not a login name. SECURITY DEFINER
-- changes current_user to the owner and leaves session_user as the connecting
-- role, which is the only reason this is expressible inside the definer at all.
-- Asking about role membership rather than a literal name means a deployment
-- may name its login whatever it likes, and it keeps superusers working, which
-- fixtures and migrations depend on.

create or replace function app.finalize_upload_intent(
  p_workspace uuid,
  p_intent uuid,
  p_content_hash text,
  p_byte_size bigint,
  p_media_type text,
  p_inspection_status text,
  p_inspection_policy_version text
) returns table (evidence_object_id uuid, outcome text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i public.upload_intents%rowtype;
  v_evidence uuid;
  v_stored bigint;
begin
  -- The inspection verdict arrives as a parameter and always will; what changes
  -- is who is allowed to supply it. Raised rather than returned as an outcome:
  -- the route reaches this only through the service connection, so a caller on
  -- any other connection is a defect or an attack, not a state the client can
  -- act on.
  if not pg_has_role(session_user, 'aktflow_service', 'member') then
    raise exception 'evidence may only be created by the service principal';
  end if;

  select * into i from public.upload_intents
   where workspace_id = p_workspace and id = p_intent
   for update;
  if not found then
    raise exception 'no such upload intent';
  end if;

  if i.created_by_member_id is distinct from app.member_id_any_status(p_workspace) then
    raise exception 'not authorized to finalize this upload intent';
  end if;

  if i.status = 'available' then
    return query select i.finalized_evidence_object_id, 'already'::text;
    return;
  end if;

  if i.status <> 'intent_authorized'
     or i.purged_at is not null or i.purge_claimed_at is not null
     or i.expires_at <= now() then
    return query select null::uuid, 'conflict'::text;
    return;
  end if;

  if app.active_member_id(p_workspace) is null
     or not app.has_project_capability(p_workspace, i.project_id,
                                       array['evidence.record']) then
    update public.upload_intents
       set status = 'orphaned_for_purge',
           failure_code = coalesce(failure_code, 'authorization_revoked'),
           version = version + 1
     where workspace_id = p_workspace and id = p_intent;
    return query select null::uuid, 'unauthorized'::text;
    return;
  end if;

  if p_content_hash is distinct from i.expected_content_hash
     or p_byte_size is distinct from i.expected_byte_size then
    raise exception 'finalization does not match the authorized content identity';
  end if;

  select (o.metadata ->> 'size')::bigint into v_stored
    from storage.objects o
   where o.bucket_id = i.staging_bucket and o.name = i.staging_storage_key;

  if v_stored is null or v_stored is distinct from p_byte_size then
    update public.upload_intents
       set failure_code = 'content_missing',
           quota_reserved_bytes = greatest(quota_reserved_bytes, coalesce(v_stored, 0)),
           version = version + 1
     where workspace_id = p_workspace and id = p_intent;
    return query select null::uuid, 'no_content'::text;
    return;
  end if;

  v_evidence := gen_random_uuid();
  insert into public.evidence_objects
    (id, workspace_id, project_id, content_hash, byte_size, media_type,
     original_filename, storage_bucket, storage_key, storage_provider,
     origin_method, relation_kind, recorder_member_id, device_capture_id,
     claimed_capture_time, claimed_tz_offset, capture_time_trust,
     server_received_at, upload_intent_id, source_app_version,
     inspection_status, inspection_policy_version)
  values
    (v_evidence, p_workspace, i.project_id, p_content_hash, p_byte_size, p_media_type,
     i.original_filename, i.staging_bucket, i.staging_storage_key, 'supabase',
     i.origin_method, 'original', i.created_by_member_id, i.device_capture_id,
     i.claimed_capture_time, i.claimed_tz_offset,
     case when i.claimed_capture_time is null then 'unknown' else 'device_claimed' end,
     now(), p_intent, i.source_app_version,
     p_inspection_status, p_inspection_policy_version);

  update public.upload_intents
     set status = 'available', finalized_evidence_object_id = v_evidence,
         failure_code = null, version = version + 1
   where workspace_id = p_workspace and id = p_intent;

  return query select v_evidence, 'created'::text;
end $$;

-- ---------------------------------------------------------------------------
-- capture_events: the member records the device, the server records itself.
--
-- ce_insert keeps every condition it had and gains one: a member may only write
-- what their device did. aktflow_service is a member of aktflow_app, so this
-- policy still applies to the service role — RLS combines permissive policies
-- with OR, and the server writing a device-sourced event is harmless. The
-- direction that matters is the other one, and it is now closed.
-- ---------------------------------------------------------------------------
drop policy ce_insert on public.capture_events;
create policy ce_insert on public.capture_events for insert to aktflow_app
  with check (
    event_source = 'device'
    and app.has_project_capability(workspace_id, project_id,
          array['project.view','project.admin'])
    and app.has_project_capability(workspace_id, project_id, array['evidence.record'])
    and (upload_intent_id is null or exists (
          select 1 from public.upload_intents u
           where u.workspace_id = capture_events.workspace_id
             and u.id = capture_events.upload_intent_id
             and u.project_id = capture_events.project_id
             and u.created_by_member_id = app.active_member_id(capture_events.workspace_id))));

create policy ce_insert_server on public.capture_events for insert to aktflow_service
  with check (
    event_source = 'server'
    and (upload_intent_id is null or exists (
          select 1 from public.upload_intents u
           where u.workspace_id = capture_events.workspace_id
             and u.id = capture_events.upload_intent_id
             and u.project_id = capture_events.project_id)));
```

- [ ] **Step 5: Apply and run the tests to verify they pass**

Run:
```bash
supabase db reset && node scripts/set-local-app-password.mjs
APP_DB_URL="postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" \
SERVICE_DB_URL="postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres" \
pnpm --filter @aktflow/testing test -- src/m2-service-principal.test.ts
```
Expected: PASS, 10 tests.

- [ ] **Step 6: Repair the M2-A hardening tests that now use the wrong identity**

`packages/testing/src/m2-binding-hardening.test.ts` calls
`app.finalize_upload_intent` through `asActor`, which is now refused. In the
`describe("evidence is created only by the finalization command")` block:

1. Change the import line `import { adminClient, asActor } from "./pg";` to
   `import { adminClient, asActor, asService } from "./pg";`
2. In the `finalize` helper, replace `asActor(USER_A, WS_A, ...)` with
   `asService(USER_A, WS_A, ...)`.
3. In the test `"orphans the bytes itself when the capability is gone"`, replace
   `asActor(USER_A, WS_A, (cl) => cl.query<{` with
   `asService(USER_A, WS_A, (cl) => cl.query<{`.
4. Leave `"refuses a caller who did not create the intent"` on `asActor` and
   change its expectation comment to note that it now fails on the service check
   first; the assertion `toBeTruthy()` is unchanged and still correct.

Then add one test to that same block, so the old guarantee is still asserted
somewhere:

```ts
  it("refuses the member identity outright, before anything else", async () => {
    // Migration 0035. The caller below owns the intent and holds every
    // capability; identity is what stops them now.
    let message = "";
    try {
      await asActor(USER_A, WS_A, (cl) => cl.query(
        `select * from app.finalize_upload_intent($1,$2,$3,$4,$5,$6,$7)`,
        [a.workspaceId, intentId, "d".repeat(64), 11, "image/jpeg", "passed", "probe"]));
    } catch (e) { message = (e as Error).message; }
    expect(message).toMatch(/service/i);
  });
```

- [ ] **Step 7: Mutation-check both guarantees**

Prove each test fails when the mechanism it tests is removed. For the definer:

```bash
docker exec "$(docker ps --format '{{.Names}}' | grep supabase_db | head -1)" \
  psql -U postgres -d postgres -c \
  "create or replace function app.finalize_upload_intent(uuid,uuid,text,bigint,text,text,text) returns table (evidence_object_id uuid, outcome text) language plpgsql security definer set search_path = public, pg_temp as \$\$ begin return query select null::uuid, 'created'::text; end \$\$;"
```
Then run the suite from Step 5 and confirm "refuses a member creating evidence"
FAILS. Restore with `supabase db reset && node scripts/set-local-app-password.mjs`.

For the policy: re-run Step 5 after replacing `event_source = 'device' and` with
`true and` in `ce_insert` via a direct `psql` `create policy`, confirm "refuses a
member claiming an event came from the server" FAILS, then reset.

Record both results in the commit message. A test that has not been shown to
fail for the right reason is not evidence.

- [ ] **Step 8: Run the full suite**

Run:
```bash
supabase db reset && node scripts/set-local-app-password.mjs
APP_DB_URL="postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" \
SERVICE_DB_URL="postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres" \
pnpm turbo run test --concurrency=1 --force && pnpm typecheck && pnpm build
```
Expected: 6/6 tasks, typecheck 8/8, build 3/3. Test count 616 (606 + 4 from
Task 1 + 1 from Task 2 + 5 from Task 3 + 1 added in Step 6, minus 1 because no
test was removed — verify the actual number and use it, do not copy this one if
it disagrees).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0035_server_facts_are_service_only.sql \
  packages/testing/src/pg.ts packages/testing/src/m2-service-principal.test.ts \
  packages/testing/src/m2-binding-hardening.test.ts
git commit -m "feat(m2): make the inspection verdict and server capture events unforgeable

Both columns claimed to record what the server observed while the server and the
member reached PostgreSQL as the same role. A holder of evidence.record could
authorize an intent, upload bytes nobody looked at, pass inspection_status =
'passed', and write event_source = 'server' on their own capture event.

The check asks pg_has_role(session_user, 'aktflow_service', 'member') rather
than comparing a login name: SECURITY DEFINER leaves session_user as the
connecting role, which is what makes the question answerable inside the definer
at all, and asking about membership keeps deployments free to name their login
and keeps superusers working for fixtures.

Both guarantees are mutation-checked. [Paste the two results here.]"
```

---

### Task 4: Say what this bought and what it did not

**Files:**
- Modify: `TODOS.md`
- Modify: `docs/superpowers/plans/evidence/2026-07-31-m2a-gate.md`
- Create: `docs/superpowers/plans/evidence/2026-08-01-service-principal-gate.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing code depends on.

- [ ] **Step 1: Close the two P1 items**

In `TODOS.md`, find the two sections whose headings contain "nothing proves
inspection ran" and "capture_events cannot tell the server's assertion from a
member's". Replace each heading's `P1`/`P2` prefix with `CLOSED` and append to
each body:

```markdown

**Closed** 2026-08-01 by migrations `0034` and `0035` on
`claude/m2-service-principal`. The verdict is now writable only from a
connection whose login is a member of `aktflow_service`, which
`aktflow_app_login` is not. This does not make inspection *correct* — see the
gate record for what remains true.
```

- [ ] **Step 2: Correct the M2-A gate record**

In `docs/superpowers/plans/evidence/2026-07-31-m2a-gate.md`, under "Known
limitations, stated rather than implied", append to the
`capture_events.event_source` bullet and to the `inspection_status` bullet:

```markdown
  Superseded 2026-08-01: closed by the service principal (`0034`, `0035`) on
  `claude/m2-service-principal`. The limitation stood for the whole of M2-A and
  is left here rather than deleted, because a gate record that edits away what
  was true when it was issued is not a record.
```

- [ ] **Step 3: Write the new gate record**

Create `docs/superpowers/plans/evidence/2026-08-01-service-principal-gate.md`
with: the branch and baseline; the evidence table (migrations applied, the
serialized suite figure from Task 3 Step 8, typecheck, build, canonical docs);
which two P1 items closed; the mutation-check results from Task 3 Step 7; and a
section headed "What this does not buy" containing, verbatim from the spec:

> A compromised application process holds both credentials. This closes SQL
> injection and a member with database access. It does not close code execution
> in the web process.

> It does not prove inspection ran correctly. It proves the row was written from
> the server's own connection rather than a member's. `inspection_status =
> 'passed'` continues to mean "the magic bytes matched the declared type", and
> v0.1 still ships no scanner.

Also record that staging and production need `SERVICE_DB_URL` and a real
credential set by an operator before any deploy, and that nothing in CI proves
that step happened.

- [ ] **Step 4: Validate and commit**

```bash
node scripts/validate-canonical-docs.mjs
git add TODOS.md docs/superpowers/plans/evidence/
git commit -m "docs(m2): record what the service principal closed, and what it did not

Two P1 items are closed and marked as such rather than deleted. The M2-A gate
record keeps its original limitations and notes them superseded, because a gate
record edited to remove what was true when it was issued stops being a record.

The new gate record states in the spec's own words that a compromised app
process holds both credentials, and that this proves the row came from the
server's connection rather than that inspection ran correctly."
```

---

## Self-Review

**Spec coverage.** Role and login — Task 1. Password handling — Task 1 Step 5.
Second pool and `withServiceTx` — Task 2. Actor GUC on the service connection —
Task 2 Step 4, asserted by Task 2 Step 1's test. Finalize requires the service
principal — Task 3 Step 4. `ce_insert` split — Task 3 Step 4. Route boundary —
Task 2 Step 6. Testing posture, including mutation checks — Task 3 Steps 2 and 7.
"What this does not buy" — Task 4 Step 3.

The `withServiceTx` test lives in `packages/database/src/tx.test.ts` rather than
in the new testing-package file, because `@aktflow/testing` does not depend on
`@aktflow/database` and adding that edge to assert a role name would be a
package dependency bought for one line. The spec's claim that `SECURITY
DEFINER` leaves `session_user` alone is verified by Task 2 Step 1's assertion
`expect(seen.su).toBe("aktflow_service_login")` before Task 3 depends on it.

**Placeholder scan.** One deliberate placeholder remains: Task 3 Step 9's commit
message says `[Paste the two results here.]`, because the values come from
running Step 7. Task 3 Step 8's test count is marked "verify the actual number
and use it" for the same reason — the arithmetic is stated so a wrong count is
visible, not so it is copied blind.

**Type consistency.** `withServiceTx` has `withTenantTx`'s signature
(`ctx: TenantContext, fn: (tx: Tx) => Promise<T>`) in Task 2's interface block,
its implementation, and both call sites. `asService` matches `asActor`'s
signature in Task 3 Step 1 and every use in Steps 2 and 6. `getServicePool`
returns `pg.Pool`, matching `getPool`, which is what lets `runTx` take either.
