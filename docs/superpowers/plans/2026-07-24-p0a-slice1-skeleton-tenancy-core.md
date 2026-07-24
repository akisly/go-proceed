# P0-A Slice 1 — Skeleton & Tenancy Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the greenfield AktFlow monorepo and prove one authenticated, tenant-scoped vertical end-to-end — a user creates an organization (`POST /v1/organizations`) and reads their context (`GET /v1/me/context`) — with the reusable `withTenantTx` pattern, atomic audit + outbox writes, RLS, idempotency, and a cross-tenant negative-policy test harness, deployed to staging.

**Architecture:** pnpm + Turborepo monorepo. `apps/app` is a Next.js 16 App Router service hosting both UI and the `/v1/*` BFF route handlers. Business logic lives in `packages/domain` (pure), API shapes/validation in `packages/contracts` (zod), and the audited transaction pattern in `packages/database` (node-postgres against Supabase Postgres). Supabase provides Auth + Postgres; RLS + least-privilege roles enforce tenancy; a `pg_cron` + Edge Function drains the transactional outbox. No `apps/worker`, no `apps/mobile`, no demo/sandbox in this slice.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Turborepo, Next.js 16.2.11+, React 19, Supabase (Postgres 15 + Auth + Edge Functions + CLI), node-postgres (`pg`), zod, Vitest, Playwright (smoke, later slices), Tailwind + shadcn/ui, GitHub Actions, Vercel.

## Global Constraints

- Next.js pinned to a security-patched **16.2.11 or newer 16.2.x**; generic `16.2` is forbidden (spec §2, doc 07 §1). Pin exact patch versions in lockfile.
- Node.js **24 LTS** for tooling/runtime; pin in `.nvmrc` and `engines`.
- Every `POST` command requires an `Idempotency-Key` header; replay returns the original result (spec §4.3).
- Every request/response carries `X-Request-Id`; the same id is written to `audit_events.request_id` (spec §5).
- All error responses use one `application/problem+json` envelope: `code`, `detail`, `fieldErrors`, `requestId`, `retryable`, `userAction` (spec §5).
- Data-access allowlist is authoritative: `authenticated` may only `SELECT` reviewed `api` projections; all tenant mutations run under least-priv `aktflow_app` (`NOLOGIN`, `NOBYPASSRLS`); `service_role` is migrations-only (spec §4.4, `technical/data-access-surface.csv`).
- Pooled DB connections must never carry session-level tenant context; context is transaction-local and reset at commit (spec §4.3).
- Table definitions come verbatim from `technical/schema.sql` — no new columns (spec §4.1). No demo `kind`/`expires_at`.
- Design tokens are sourced from `prototype/src/styles.css` (Evidence Atlas); only visual tokens are reused, never prototype state/markup (spec §3.1).
- Money fields use integer minor units; currency default `UAH`; timezone default `Europe/Kyiv` (schema.sql).
- **Error codes come from `technical/error-catalog.csv` verbatim** — SCREAMING_SNAKE, with the catalog's exact `http_status`: `VALIDATION_FAILED`=422, `IDEMPOTENCY_CONFLICT`=409, `AUTH_REQUIRED`=401. Never invent a dotted/lowercase code or an off-catalog status. A missing required header is a `VALIDATION_FAILED` with the header named in `fieldErrors`.
- **Relative imports are EXTENSIONLESS** (`from "./http"`, not `"./http.js"`). The workspace uses `moduleResolution: "Bundler"`; `.js` specifiers pointing at `.ts` sources resolve under `tsc`/Vite but NOT under Turbopack (Next 16's default bundler), so `next build` fails on them. Code blocks below that still show `.js` predate this rule — drop the extension.

---

## File Structure

```text
.nvmrc, package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .gitignore
.github/workflows/ci.yml
supabase/
  config.toml
  migrations/
    0001_core_tenancy.sql          organizations, legal_entities, memberships
    0002_audit_outbox_idempotency.sql
    0003_roles_and_grants.sql      aktflow_app group + aktflow_app_login, grants
    0004_rls_policies.sql          RLS on tenant tables + api.me_context view
    0005_outbox_drain_cron.sql     pg_cron schedule calling the Edge Function
  functions/outbox-drain/index.ts  Deno Edge Function
  seed.sql                         two synthetic auth users for tests
packages/
  contracts/   src/{problem.ts,organizations.ts,me-context.ts,index.ts}  + tests
  domain/      src/{organization.ts,index.ts}                            + tests
  database/    src/{pool.ts,tx.ts,audit.ts,outbox.ts,idempotency.ts,index.ts} + tests
  testing/     src/{pg.ts,fixtures.ts,rls.ts,index.ts}
  ui/          src/tokens.css  tailwind.preset.ts                        (tokens only this slice)
apps/
  app/
    package.json, next.config.ts, tsconfig.json, tailwind.config.ts, .env.example
    app/(auth)/login/page.tsx
    app/(app)/context/page.tsx
    # NOTE: a Next.js app MUST have exactly ONE app-router root. Keep every route
    # and page under apps/app/app/ — never create apps/app/src/app/, or Next
    # silently ignores it and the /v1/* handlers 404 in a real build.
    src/lib/{supabase-server.ts,request-context.ts,auth.ts,http.ts}
    app/v1/organizations/route.ts
    app/v1/me/context/route.ts
    tests/{organizations.int.test.ts,me-context.int.test.ts}
  landing/       package.json, next.config.ts, app/page.tsx  (placeholder shell only)
```

---

## Task 1: Monorepo scaffold + tooling baseline

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.editorconfig`
- Modify: `.gitignore` (already exists)

**Interfaces:**
- Consumes: nothing.
- Produces: pnpm workspace globs `apps/*`, `packages/*`; `tsconfig.base.json` with `strict: true` extended by every package; `turbo` tasks `build`, `lint`, `typecheck`, `test`.

- [ ] **Step 1: Pin Node and create root manifest**

`.nvmrc`:
```
24
```

`package.json`:
```json
{
  "name": "aktflow",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "2.5.4",
    "typescript": "5.9.2",
    "vitest": "3.2.4"
  }
}
```

- [ ] **Step 2: Declare workspace + turbo pipeline**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {},
    "test": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 3: Shared strict tsconfig**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "composite": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 4: Install and verify workspace resolves**

Run: `pnpm install`
Expected: lockfile created, no errors.

Run: `pnpm turbo run typecheck`
Expected: PASS (no packages yet → no-op success).

- [ ] **Step 5: Commit**

```bash
git add .nvmrc package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .editorconfig pnpm-lock.yaml
git commit -m "chore: scaffold pnpm+turborepo monorepo baseline"
```

---

## Task 2: `packages/contracts` — problem+json envelope + endpoint schemas

**Files:**
- Create: `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/src/{problem.ts,organizations.ts,me-context.ts,index.ts}`
- Test: `packages/contracts/src/organizations.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ProblemJson` type + `problem(code, detail, opts?)` builder returning `{ code, detail, fieldErrors, requestId, retryable, userAction }`.
  - `createOrganizationRequest` (zod) → `CreateOrganizationRequest = { legalName: string; displayName: string; edrpou?: string; baseCurrency?: string; timezone?: string }`.
  - `createOrganizationResponse` (zod) → `CreateOrganizationResponse = { organizationId: string; membershipId: string; role: "owner"; version: number }`.
  - `meContextResponse` (zod) → `MeContextResponse = { userId: string; memberships: Array<{ organizationId: string; displayName: string; role: string; status: string; membershipVersion: number }> }`.

- [ ] **Step 1: Package manifest + tsconfig**

`packages/contracts/package.json`:
```json
{
  "name": "@aktflow/contracts",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src"
  },
  "dependencies": { "zod": "3.24.1" }
}
```

`packages/contracts/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 2: Write the failing test**

`packages/contracts/src/organizations.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createOrganizationRequest } from "./organizations.js";

describe("createOrganizationRequest", () => {
  it("accepts a minimal valid body and defaults currency/timezone", () => {
    const parsed = createOrganizationRequest.parse({
      legalName: "ТОВ Електромонтаж",
      displayName: "Електромонтаж",
    });
    expect(parsed.baseCurrency).toBe("UAH");
    expect(parsed.timezone).toBe("Europe/Kyiv");
  });

  it("rejects empty legalName with a field path", () => {
    const r = createOrganizationRequest.safeParse({ legalName: "", displayName: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["legalName"]);
  });

  it("rejects a 4-char currency code", () => {
    const r = createOrganizationRequest.safeParse({
      legalName: "a", displayName: "b", baseCurrency: "USDX",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @aktflow/contracts test`
Expected: FAIL — cannot resolve `./organizations.js`.

- [ ] **Step 4: Implement problem envelope**

`packages/contracts/src/problem.ts`:
```ts
export interface FieldError { path: string; message: string }
export interface ProblemJson {
  code: string;
  detail: string;
  fieldErrors: FieldError[];
  requestId: string;
  retryable: boolean;
  userAction: string;
}
export function problem(
  code: string,
  detail: string,
  opts: Partial<Omit<ProblemJson, "code" | "detail">> = {},
): ProblemJson {
  return {
    code,
    detail,
    fieldErrors: opts.fieldErrors ?? [],
    requestId: opts.requestId ?? "",
    retryable: opts.retryable ?? false,
    userAction: opts.userAction ?? "Перевірте дані та повторіть спробу.",
  };
}
```

- [ ] **Step 5: Implement organization + me-context schemas**

`packages/contracts/src/organizations.ts`:
```ts
import { z } from "zod";

export const createOrganizationRequest = z.object({
  legalName: z.string().trim().min(1).max(300),
  displayName: z.string().trim().min(1).max(200),
  edrpou: z.string().trim().regex(/^\d{8,10}$/).optional(),
  baseCurrency: z.string().length(3).default("UAH"),
  timezone: z.string().min(1).default("Europe/Kyiv"),
});
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequest>;

export const createOrganizationResponse = z.object({
  organizationId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: z.literal("owner"),
  version: z.number().int(),
});
export type CreateOrganizationResponse = z.infer<typeof createOrganizationResponse>;
```

`packages/contracts/src/me-context.ts`:
```ts
import { z } from "zod";

export const meContextResponse = z.object({
  userId: z.string().uuid(),
  memberships: z.array(z.object({
    organizationId: z.string().uuid(),
    displayName: z.string(),
    role: z.string(),
    status: z.string(),
    membershipVersion: z.number().int(),
  })),
});
export type MeContextResponse = z.infer<typeof meContextResponse>;
```

`packages/contracts/src/index.ts`:
```ts
export * from "./problem.js";
export * from "./organizations.js";
export * from "./me-context.js";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @aktflow/contracts test`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/contracts pnpm-lock.yaml
git commit -m "feat(contracts): problem+json envelope and org/context schemas"
```

---

## Task 3: `packages/domain` — organization creation invariants (pure)

**Files:**
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/{organization.ts,index.ts}`
- Test: `packages/domain/src/organization.test.ts`

**Interfaces:**
- Consumes: `CreateOrganizationRequest` from `@aktflow/contracts`.
- Produces: `buildOrganizationCreation(input, actorUserId, ids)` returning
  `{ organization: OrganizationRow; legalEntity: LegalEntityRow; membership: MembershipRow; audit: AuditIntent; outbox: OutboxIntent }`
  where `ids = { organizationId, legalEntityId, membershipId }`. Pure — no I/O, no clock, no uuid generation (ids injected).

- [ ] **Step 1: Manifest + tsconfig**

`packages/domain/package.json`:
```json
{
  "name": "@aktflow/domain",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run", "lint": "eslint src" },
  "dependencies": { "@aktflow/contracts": "workspace:*" }
}
```
`packages/domain/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 2: Write the failing test**

`packages/domain/src/organization.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildOrganizationCreation } from "./organization.js";

const ids = {
  organizationId: "11111111-1111-1111-1111-111111111111",
  legalEntityId: "22222222-2222-2222-2222-222222222222",
  membershipId: "33333333-3333-3333-3333-333333333333",
};
const actor = "44444444-4444-4444-4444-444444444444";

describe("buildOrganizationCreation", () => {
  it("makes the actor the owner and links all rows to the new org", () => {
    const out = buildOrganizationCreation(
      { legalName: "ТОВ Е", displayName: "Е", baseCurrency: "UAH", timezone: "Europe/Kyiv" },
      actor, ids,
    );
    expect(out.organization.id).toBe(ids.organizationId);
    expect(out.organization.status).toBe("trial");
    expect(out.membership.role).toBe("owner");
    expect(out.membership.status).toBe("active");
    expect(out.membership.user_id).toBe(actor);
    expect(out.membership.organization_id).toBe(ids.organizationId);
    expect(out.legalEntity.organization_id).toBe(ids.organizationId);
  });

  it("emits an audit intent and an outbox intent for the creation", () => {
    const out = buildOrganizationCreation(
      { legalName: "a", displayName: "b", baseCurrency: "UAH", timezone: "Europe/Kyiv" },
      actor, ids,
    );
    expect(out.audit.action).toBe("organization.created");
    expect(out.audit.object_id).toBe(ids.organizationId);
    expect(out.outbox.topic).toBe("organization.created");
    expect(out.outbox.aggregate_id).toBe(ids.organizationId);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @aktflow/domain test`
Expected: FAIL — `./organization.js` not found.

- [ ] **Step 4: Implement the pure builder**

`packages/domain/src/organization.ts`:
```ts
import type { CreateOrganizationRequest } from "@aktflow/contracts";

export interface OrganizationRow {
  id: string; legal_name: string; display_name: string; edrpou: string | null;
  base_currency: string; timezone: string; status: "trial"; version: number;
}
export interface LegalEntityRow { id: string; organization_id: string; legal_name: string; registration_code: string | null; country_code: string }
export interface MembershipRow {
  id: string; organization_id: string; user_id: string;
  role: "owner"; status: "active"; all_projects: boolean; version: number;
}
export interface AuditIntent {
  action: string; object_type: string; object_id: string; details: Record<string, unknown>;
}
export interface OutboxIntent {
  topic: string; aggregate_type: string; aggregate_id: string;
  payload_version: number; payload: Record<string, unknown>;
}
export interface OrganizationCreationIds {
  organizationId: string; legalEntityId: string; membershipId: string;
}
export interface OrganizationCreation {
  organization: OrganizationRow; legalEntity: LegalEntityRow;
  membership: MembershipRow; audit: AuditIntent; outbox: OutboxIntent;
}

export function buildOrganizationCreation(
  input: CreateOrganizationRequest,
  actorUserId: string,
  ids: OrganizationCreationIds,
): OrganizationCreation {
  const edrpou = input.edrpou ?? null;
  const organization: OrganizationRow = {
    id: ids.organizationId, legal_name: input.legalName, display_name: input.displayName,
    edrpou, base_currency: input.baseCurrency, timezone: input.timezone, status: "trial", version: 1,
  };
  const legalEntity: LegalEntityRow = {
    id: ids.legalEntityId, organization_id: ids.organizationId,
    legal_name: input.legalName, registration_code: edrpou, country_code: "UA",
  };
  const membership: MembershipRow = {
    id: ids.membershipId, organization_id: ids.organizationId, user_id: actorUserId,
    role: "owner", status: "active", all_projects: true, version: 1,
  };
  return {
    organization, legalEntity, membership,
    audit: {
      action: "organization.created", object_type: "organization",
      object_id: ids.organizationId, details: { legalName: input.legalName },
    },
    outbox: {
      topic: "organization.created", aggregate_type: "organization",
      aggregate_id: ids.organizationId, payload_version: 1,
      payload: { organizationId: ids.organizationId, ownerUserId: actorUserId },
    },
  };
}
```

`packages/domain/src/index.ts`:
```ts
export * from "./organization.js";
```

> Note: `legal_entities` and `memberships` columns match `technical/schema.sql`. If the live schema names differ, prefer the schema and update these row types — the schema is authoritative (Global Constraints).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @aktflow/domain test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/domain pnpm-lock.yaml
git commit -m "feat(domain): pure organization-creation builder with audit+outbox intents"
```

---

## Task 4: Supabase migrations — core tenancy + audit/outbox/idempotency tables

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/0001_core_tenancy.sql`, `supabase/migrations/0002_audit_outbox_idempotency.sql`, `supabase/seed.sql`
- Test: `supabase/migrations/migrations.test.ts` (applies via `supabase db reset`, asserts tables exist)

**Interfaces:**
- Consumes: nothing.
- Produces: tables `public.organizations`, `public.legal_entities`, `public.memberships`, `public.audit_events`, `public.transaction_outbox`, `public.idempotency_records` (columns copied verbatim from `technical/schema.sql`). Seed users `AUTH_USER_A` / `AUTH_USER_B` for tests.

- [ ] **Step 1: Init Supabase locally**

Run: `pnpm dlx supabase@latest init` (creates `supabase/config.toml`)
Then enable required extensions in config and confirm Docker is running.
Run: `pnpm dlx supabase start`
Expected: local stack up; note the `DB URL` (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`).

- [ ] **Step 2: Write migration 0001 (copy column defs from schema.sql)**

`supabase/migrations/0001_core_tenancy.sql` — copy the `organizations`, `legal_entities`, `memberships` `create table` blocks verbatim from `technical/schema.sql`. Reproduced here for the org table (do the same for the other two from the source file):
```sql
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
-- legal_entities: copy verbatim from technical/schema.sql
-- memberships: copy verbatim from technical/schema.sql (role/status checks, unique (organization_id,user_id))
```

- [ ] **Step 3: Write migration 0002 (audit/outbox/idempotency verbatim)**

`supabase/migrations/0002_audit_outbox_idempotency.sql` — copy `audit_events`, `transaction_outbox`, `idempotency_records` `create table` blocks verbatim from `technical/schema.sql`. Add the outbox drain index:
```sql
create index if not exists transaction_outbox_unprocessed_idx
  on public.transaction_outbox (available_at)
  where processed_at is null;
```

- [ ] **Step 4: Seed two auth users for tests**

`supabase/seed.sql`:
```sql
insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a@example.test','authenticated','authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','b@example.test','authenticated','authenticated')
on conflict (id) do nothing;
```

- [ ] **Step 5: Write the failing test**

`supabase/migrations/migrations.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "pg";

const url = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function tableExists(name: string): Promise<boolean> {
  const c = new Client({ connectionString: url });
  await c.connect();
  const r = await c.query("select to_regclass($1) as reg", [`public.${name}`]);
  await c.end();
  return r.rows[0].reg !== null;
}

describe("core migrations", () => {
  beforeAll(() => {}, 60_000);
  it("creates tenancy + audit/outbox/idempotency tables", async () => {
    for (const t of ["organizations","legal_entities","memberships","audit_events","transaction_outbox","idempotency_records"]) {
      expect(await tableExists(t)).toBe(true);
    }
  });
});
```
Add `pg` to root devDependencies: `pnpm add -Dw pg @types/pg`.

- [ ] **Step 6: Run to verify it fails, then apply, then passes**

Run: `pnpm vitest run supabase/migrations/migrations.test.ts`
Expected: FAIL (tables absent) — unless already applied.

Run: `pnpm dlx supabase db reset` (applies all migrations + seed)
Expected: success.

Run: `pnpm vitest run supabase/migrations/migrations.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase pnpm-lock.yaml
git commit -m "feat(db): core tenancy + audit/outbox/idempotency migrations and seed"
```

---

## Task 5: Migrations — least-privilege roles, grants, RLS policies, and `api.me_context`

**Files:**
- Create: `supabase/migrations/0003_roles_and_grants.sql`, `supabase/migrations/0004_rls_policies.sql`
- Test: `packages/testing/src/rls.test.ts`

**Interfaces:**
- Consumes: tables from Task 4.
- Produces:
  - Role `aktflow_app` (`NOLOGIN NOBYPASSRLS`) + login role `aktflow_app_login` (member of `aktflow_app`, `NOINHERIT`) with password from env.
  - RLS enabled on `organizations`, `legal_entities`, `memberships`; policies keyed on `current_setting('app.actor_user_id', true)` and `current_setting('app.organization_id', true)`.
  - View `api.me_context` exposing the current actor's memberships (used by the read path).
  - Helper `app.current_actor()` returning the actor uuid or null.

- [ ] **Step 1: Roles + grants migration**

`supabase/migrations/0003_roles_and_grants.sql`:
```sql
do $$ begin
  if not exists (select from pg_roles where rolname = 'aktflow_app') then
    create role aktflow_app nologin nobypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'aktflow_app_login') then
    create role aktflow_app_login login noinherit nobypassrls;
  end if;
end $$;
grant aktflow_app to aktflow_app_login;

grant usage on schema public to aktflow_app;
create schema if not exists api;
grant usage on schema api to aktflow_app, authenticated;

-- least-privilege table grants (allowlist; extend per technical/data-access-surface.csv)
grant select, insert, update on public.organizations to aktflow_app;
grant select, insert on public.legal_entities to aktflow_app;
grant select, insert, update on public.memberships to aktflow_app;
grant select, insert on public.audit_events to aktflow_app;
grant usage on sequence public.audit_events_id_seq to aktflow_app;
-- INSERT-only per data-access-surface.csv DA-099: the BFF may only enqueue event
-- intents; reading/draining them belongs to aktflow_worker (DA-058).
grant insert on public.transaction_outbox to aktflow_app;
grant select, insert on public.idempotency_records to aktflow_app;

-- actor helper
create or replace function app.current_actor() returns uuid
language sql stable as $$
  select nullif(current_setting('app.actor_user_id', true), '')::uuid
$$;

-- SECURITY DEFINER so the membership-bootstrap policy can check whether an org
-- already has members WITHOUT being narrowed by memberships' own RLS (a plain
-- subquery on memberships inside the policy would only see the caller's own rows
-- and defeat the anti-hijack guard). Bypasses RLS for this one boolean only.
create or replace function app.org_has_members(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where organization_id = org)
$$;
revoke all on function app.org_has_members(uuid) from public;
grant execute on function app.org_has_members(uuid) to aktflow_app;
```
> `app` schema is a Postgres GUC namespace for `set_config`; the `app.current_actor()` function lives in a real `app` schema — create it: add `create schema if not exists app;` before the function and `grant usage on schema app to aktflow_app;`.

- [ ] **Step 2: RLS policies + api.me_context migration**

`supabase/migrations/0004_rls_policies.sql`:
```sql
alter table public.organizations enable row level security;
alter table public.legal_entities enable row level security;
alter table public.memberships enable row level security;

-- organizations: readable only if the actor has a membership; insertable by any authenticated actor (bootstrap)
create policy org_select on public.organizations for select to aktflow_app
  using (exists (
    select 1 from public.memberships m
    where m.organization_id = organizations.id
      and m.user_id = app.current_actor()
      and m.status = 'active'));
create policy org_insert on public.organizations for insert to aktflow_app
  with check (app.current_actor() is not null);

-- legal_entities: same-org membership
create policy le_select on public.legal_entities for select to aktflow_app
  using (exists (
    select 1 from public.memberships m
    where m.organization_id = legal_entities.organization_id
      and m.user_id = app.current_actor() and m.status = 'active'));
-- A legal entity is never a bootstrap target: it always belongs to an existing org
-- the actor must be an active member of. Without this check any actor could inject
-- rows into another tenant's org (cross-tenant data injection).
create policy le_insert on public.legal_entities for insert to aktflow_app
  with check (exists (
    select 1 from public.memberships m
    where m.organization_id = legal_entities.organization_id
      and m.user_id = app.current_actor() and m.status = 'active'));

-- memberships: an actor sees only their own membership rows.
create policy m_select on public.memberships for select to aktflow_app
  using (user_id = app.current_actor());
-- Bootstrap-only insert: an actor may insert ONLY their own owner row, and ONLY
-- into an org that has no members yet. This prevents self-inserting an owner
-- membership into someone else's existing org (cross-tenant privilege escalation).
-- app.org_has_members bypasses RLS so the emptiness check is not narrowed to the
-- caller's own rows. Broader membership creation (admin invites) arrives in the
-- Membership & scopes slice with its own policies.
create policy m_insert on public.memberships for insert to aktflow_app
  with check (
    user_id = app.current_actor()
    and role = 'owner'
    and not app.org_has_members(memberships.organization_id));

-- read projection for GET /v1/me/context
create view api.me_context as
  select m.user_id, m.organization_id, o.display_name, m.role, m.status, m.version as membership_version
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = app.current_actor() and m.status = 'active';
grant select on api.me_context to aktflow_app;
```

- [ ] **Step 3: Write the failing RLS negative test**

`packages/testing/src/rls.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { appClient, asActor, resetDb } from "./pg.js";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("RLS tenant isolation", () => {
  it("actor B cannot see actor A's organization", async () => {
    await resetDb();
    const orgId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    // A bootstraps an org + owner membership
    await asActor(A, orgId, async (c) => {
      await c.query(
        "insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [orgId]);
      await c.query(
        "insert into public.memberships (organization_id, user_id, role, status, all_projects) values ($1,$2,'owner','active',true)",
        [orgId, A]);
    });
    // A sees it
    const seenByA = await asActor(A, orgId, (c) =>
      c.query("select id from public.organizations where id=$1", [orgId]));
    expect(seenByA.rowCount).toBe(1);
    // B does not
    const seenByB = await asActor(B, orgId, (c) =>
      c.query("select id from public.organizations where id=$1", [orgId]));
    expect(seenByB.rowCount).toBe(0);
  });

  it("substituting app.organization_id does not grant cross-tenant read", async () => {
    // B claims A's orgId in context but has no membership → still zero rows
    const orgId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const r = await asActor(B, orgId, (c) =>
      c.query("select * from api.me_context"));
    expect(r.rows.every((row: { user_id: string }) => row.user_id === B)).toBe(true);
  });

  it("actor B cannot self-insert an owner membership into actor A's existing org", async () => {
    // A's org from the first test already has A's owner membership (org is non-empty).
    // B attempting to insert an owner row for itself must be blocked by the
    // m_insert WITH CHECK (app.org_has_members guard) — this is the anti-hijack rule.
    const orgId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    await expect(
      asActor(B, orgId, (c) =>
        c.query(
          "insert into public.memberships (organization_id, user_id, role, status, all_projects) values ($1,$2,'owner','active',true)",
          [orgId, B])),
    ).rejects.toThrow(/row-level security|violates/i);
    // And B still sees none of A's org.
    const seenByB = await asActor(B, orgId, (c) =>
      c.query("select id from public.organizations where id=$1", [orgId]));
    expect(seenByB.rowCount).toBe(0);
  });

  it("actor B cannot inject a legal entity into actor A's org", async () => {
    // le_insert requires an ACTIVE membership in the target org. B has none,
    // so this cross-tenant injection must be rejected by RLS.
    const orgId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    await expect(
      asActor(B, orgId, (c) =>
        c.query(
          "insert into public.legal_entities (organization_id, legal_name) values ($1,'Injected')",
          [orgId])),
    ).rejects.toThrow(/row-level security|violates/i);
  });
});
```
> These three tests must run in order and share the org created in test 1 (`resetDb()` runs once at the start of test 1). The third test is the headline anti-hijack proof; it must FAIL against the naive `m_insert` policy and PASS with the `app.org_has_members` guard.

- [ ] **Step 4: Implement the pg test helper**

`packages/testing/src/pg.ts`:
```ts
import { Client, type QueryResult } from "pg";
import { execSync } from "node:child_process";

const APP_URL = process.env.APP_DB_URL
  ?? "postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres";

export function appClient(): Client { return new Client({ connectionString: APP_URL }); }

export async function asActor<T>(
  actorUserId: string, organizationId: string,
  fn: (c: Client) => Promise<QueryResult<T>> | Promise<void>,
): Promise<QueryResult<T>> {
  const c = appClient();
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role aktflow_app");
    await c.query("select set_config('app.actor_user_id', $1, true)", [actorUserId]);
    await c.query("select set_config('app.organization_id', $1, true)", [organizationId]);
    const res = await fn(c);
    await c.query("commit");
    return (res ?? { rows: [], rowCount: 0 }) as QueryResult<T>;
  } catch (e) { await c.query("rollback"); throw e; }
  finally { await c.end(); }
}

export async function resetDb(): Promise<void> {
  execSync("pnpm dlx supabase db reset --no-seed=false", { stdio: "ignore" });
}
```
Set `aktflow_app_login` password in a local-only migration/env: `alter role aktflow_app_login password 'app_pw';` (dev only; staging/prod use a secret). Add `packages/testing/package.json` (name `@aktflow/testing`, deps `pg`, `@aktflow/contracts`).

- [ ] **Step 5: Run to verify fail → apply → pass**

Run: `pnpm dlx supabase db reset`
Run: `pnpm --filter @aktflow/testing test`
Expected: PASS — B sees zero of A's rows; context substitution grants nothing.

- [ ] **Step 6: Commit**

```bash
git add supabase packages/testing pnpm-lock.yaml
git commit -m "feat(db): least-priv roles, RLS tenant policies, api.me_context, negative-policy harness"
```

---

## Task 6: `packages/database` — `withTenantTx`, audit, outbox, idempotency

**Files:**
- Create: `packages/database/package.json`, `packages/database/tsconfig.json`, `packages/database/src/{pool.ts,tx.ts,audit.ts,outbox.ts,idempotency.ts,index.ts}`
- Test: `packages/database/src/tx.test.ts`

**Interfaces:**
- Consumes: `AuditIntent`, `OutboxIntent` from `@aktflow/domain`; pg pool.
- Produces:
  - `withTenantTx(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T>` where `TenantContext = { actorUserId: string; organizationId: string | null; requestId: string; membershipVersion?: number }`. Sets `role aktflow_app` + transaction-local GUCs, commits/rolls back atomically.
  - `Tx` = `{ query: pg.Client["query"] }`.
  - `recordAudit(tx, ctx, intent, opts?)`, `enqueueOutbox(tx, ctx, intent)`, `withIdempotency(tx, args, fn)` where `args = { organizationId, actorScope, operationId, key, requestHash, ttlSeconds? }` and `fn` returns `{ status, body }`; result is `{ replayed, status, body }`.

- [ ] **Step 1: Manifest + tsconfig + deps**

`packages/database/package.json`:
```json
{
  "name": "@aktflow/database",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run", "lint": "eslint src" },
  "dependencies": { "@aktflow/domain": "workspace:*", "@aktflow/contracts": "workspace:*", "pg": "8.13.1" },
  "devDependencies": { "@types/pg": "8.11.10" }
}
```

- [ ] **Step 2: Write the failing test**

`packages/database/src/tx.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { withTenantTx } from "./tx.js";
import { recordAudit } from "./audit.js";
import { enqueueOutbox } from "./outbox.js";
import { Client } from "pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function count(sql: string, params: unknown[]): Promise<number> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  const r = await c.query(sql, params);
  await c.end();
  return Number(r.rows[0].n);
}

describe("withTenantTx", () => {
  it("commits domain row + audit + outbox atomically", async () => {
    const orgId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    await withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-1" }, async (tx) => {
      await tx.query("insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [orgId]);
      await tx.query("insert into public.memberships (organization_id,user_id,role,status,all_projects) values ($1,$2,'owner','active',true)", [orgId, A]);
      await recordAudit(tx, { actorUserId: A, organizationId: orgId, requestId: "req-1" },
        { action: "organization.created", object_type: "organization", object_id: orgId, details: {} });
      await enqueueOutbox(tx, { actorUserId: A, organizationId: orgId, requestId: "req-1" },
        { topic: "organization.created", aggregate_type: "organization", aggregate_id: orgId, payload_version: 1, payload: {} });
    });
    expect(await count("select count(*) n from public.audit_events where object_id=$1", [orgId])).toBe(1);
    expect(await count("select count(*) n from public.transaction_outbox where aggregate_id=$1", [orgId])).toBe(1);
  });

  it("rolls back everything when fn throws", async () => {
    const orgId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    await expect(withTenantTx({ actorUserId: A, organizationId: null, requestId: "req-2" }, async (tx) => {
      await tx.query("insert into public.organizations (id, legal_name, display_name) values ($1,'L','D')", [orgId]);
      throw new Error("boom");
    })).rejects.toThrow("boom");
    expect(await count("select count(*) n from public.organizations where id=$1", [orgId])).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @aktflow/database test`
Expected: FAIL — modules missing.

- [ ] **Step 4: Implement pool + tx**

`packages/database/src/pool.ts`:
```ts
import pg from "pg";
const { Pool } = pg;
let pool: pg.Pool | null = null;
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.APP_DB_URL;
    if (!connectionString) throw new Error("APP_DB_URL is not set");
    pool = new Pool({ connectionString, max: 10 });
    // REQUIRED: an idle pooled client that dies (DB restart, idle reaper, network
    // partition) emits 'error' on the Pool. With no listener Node exits on an
    // unhandled 'error' event, so one upstream blip would kill the whole server.
    pool.on("error", (err) => { console.error("[db] idle client error", err); });
  }
  return pool;
}
```

`packages/database/src/tx.ts`:
```ts
import type { PoolClient } from "pg";
import { getPool } from "./pool.js";

export interface TenantContext {
  actorUserId: string;
  organizationId: string | null;
  requestId: string;
  membershipVersion?: number;
}
export interface Tx { query: PoolClient["query"] }

export async function withTenantTx<T>(
  ctx: TenantContext, fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  let released = false;
  try {
    await client.query("begin");
    await client.query("set local role aktflow_app");
    await client.query("select set_config('app.actor_user_id', $1, true)", [ctx.actorUserId]);
    await client.query("select set_config('app.organization_id', $1, true)", [ctx.organizationId ?? ""]);
    await client.query("select set_config('app.request_id', $1, true)", [ctx.requestId]);
    await client.query("select set_config('app.membership_version', $1, true)",
      [ctx.membershipVersion != null ? String(ctx.membershipVersion) : ""]);
    const result = await fn({ query: client.query.bind(client) });
    await client.query("commit");
    return result;
  } catch (err) {
    // If ROLLBACK itself fails the client may still be in an aborted-transaction
    // state; destroy it via release(err) instead of returning it to the pool, and
    // always propagate the ORIGINAL error rather than the rollback failure.
    try {
      await client.query("rollback");
    } catch (rollbackErr) {
      client.release(rollbackErr as Error);
      released = true;
    }
    throw err;
  } finally {
    // GUCs are transaction-local and the role is SET LOCAL; nothing leaks to the pool.
    if (!released) client.release();
  }
}
```

- [ ] **Step 5: Implement audit, outbox, idempotency**

`packages/database/src/audit.ts`:
```ts
import type { Tx } from "./tx.js";
import type { TenantContext } from "./tx.js";
import type { AuditIntent } from "@aktflow/domain";

export async function recordAudit(
  tx: Tx, ctx: TenantContext, intent: AuditIntent,
  // organizationId override exists ONLY for bootstrap commands that create the org
  // inside the same transaction (ctx.organizationId is still null there). Callers
  // must never fabricate a second TenantContext to smuggle a different tenant in.
  // actorType covers the non-user actors the CHECK allows ('system'/'worker'/'external').
  opts: { objectVersion?: number; reasonCode?: string; organizationId?: string;
          actorType?: "user" | "external" | "system" | "worker" } = {},
): Promise<void> {
  const organizationId = opts.organizationId ?? ctx.organizationId;
  // audit_events.organization_id is NOT NULL — fail loudly rather than hitting 23502.
  if (!organizationId) throw new Error("recordAudit requires an organization id");
  await tx.query(
    `insert into public.audit_events
       (organization_id, actor_user_id, actor_type, action, object_type, object_id,
        request_id, details, object_version, reason_code)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [organizationId, ctx.actorUserId, opts.actorType ?? "user", intent.action,
     intent.object_type, intent.object_id, ctx.requestId, intent.details,
     opts.objectVersion ?? null, opts.reasonCode ?? null],
  );
}
```

`packages/database/src/outbox.ts`:
```ts
import type { Tx, TenantContext } from "./tx.js";
import type { OutboxIntent } from "@aktflow/domain";

export async function enqueueOutbox(
  tx: Tx, ctx: TenantContext, intent: OutboxIntent,
  // Same bootstrap-only override rule as recordAudit — never fabricate a TenantContext.
  opts: { organizationId?: string } = {},
): Promise<void> {
  const organizationId = opts.organizationId ?? ctx.organizationId;
  await tx.query(
    `insert into public.transaction_outbox
       (organization_id, topic, aggregate_type, aggregate_id, payload_version, payload)
     values ($1,$2,$3,$4,$5,$6)`,
    [organizationId, intent.topic, intent.aggregate_type, intent.aggregate_id,
     intent.payload_version, intent.payload],
  );
}
```

`packages/database/src/idempotency.ts`:
```ts
import type { Tx } from "./tx.js";

/** Retention windows from docs/22-data-api-contract.md §166. */
export const IDEMPOTENCY_CLASS_TTL = {
  standard_30d: 2_592_000,
  ledger_400d: 34_560_000,
} as const;
export type IdempotencyClass = keyof typeof IDEMPOTENCY_CLASS_TTL;

/** Same key + different request hash ⇒ IDEMPOTENCY_CONFLICT (409, non-retryable). */
export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_CONFLICT";
  constructor() { super("Idempotency-Key reused with a different request body."); }
}

export interface IdempotencyArgs {
  organizationId: string | null;
  actorScope: string;   // e.g. `user:${userId}` — bounds the key to an actor
  operationId: string;  // logical operation, e.g. "organizations.create"
  key: string;          // the Idempotency-Key header value
  requestHash: string;  // 64-char lowercase sha256 hex of the raw request body
  idempotencyClass?: IdempotencyClass; // default "standard_30d" (30d, per contract)
}
export interface IdempotencyHit<T> {
  replayed: boolean; status: number; body: T; expiresAt: Date; // expiresAt ⇒ Idempotency-Replay-Until
}

/**
 * Idempotency against public.idempotency_records (exact schema.sql shape:
 * unique (organization_id, actor_scope, operation_id, idempotency_key), with a
 * state/response check constraint and a not-null expires_at > created_at).
 * On replay of a completed record, returns the stored status + body.
 * Otherwise runs fn and stores a single 'completed' record.
 * MUST run inside a withTenantTx transaction. Requires only SELECT+INSERT grants.
 */
export async function withIdempotency<T>(
  tx: Tx, args: IdempotencyArgs, fn: () => Promise<{ status: number; body: T }>,
): Promise<IdempotencyHit<T>> {
  // Serialize same-key callers for the rest of this transaction. Without it two
  // concurrent callers both pass the SELECT, both run fn(), and both commit domain
  // side effects while ON CONFLICT silently drops the loser's ledger row.
  // Correctness relies on READ COMMITTED (withTenantTx's default): the post-lock
  // SELECT must take a fresh snapshot that sees the winner's committed row.
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
    [["idem", args.organizationId ?? "", args.actorScope, args.operationId, args.key].join("|")]);

  const found = await tx.query(
    `select state, request_hash, response_status, response_body, expires_at
       from public.idempotency_records
      where organization_id is not distinct from $1
        and actor_scope = $2 and operation_id = $3 and idempotency_key = $4`,
    [args.organizationId, args.actorScope, args.operationId, args.key],
  );
  const prior = found.rows[0] as
    { state: string; request_hash: string; response_status: number; response_body: T; expires_at: Date } | undefined;
  if (prior) {
    // Contract (doc 22 §166): same key + DIFFERENT hash ⇒ IDEMPOTENCY_CONFLICT.
    if (prior.request_hash !== args.requestHash) throw new IdempotencyConflictError();
    if (prior.state === "completed") {
      return { replayed: true, status: prior.response_status, body: prior.response_body,
               expiresAt: prior.expires_at };
    }
  }

  const result = await fn();
  const ttl = IDEMPOTENCY_CLASS_TTL[args.idempotencyClass ?? "standard_30d"];
  const ins = await tx.query(
    `insert into public.idempotency_records
       (organization_id, actor_scope, operation_id, idempotency_key, request_hash,
        state, response_status, response_body, response_headers, expires_at, completed_at)
     values ($1,$2,$3,$4,$5,'completed',$6,$7::jsonb,'{}'::jsonb,
             now() + make_interval(secs => $8), now())
     on conflict (organization_id, actor_scope, operation_id, idempotency_key) do nothing
     returning expires_at`,
    [args.organizationId, args.actorScope, args.operationId, args.key, args.requestHash,
     result.status, JSON.stringify(result.body ?? null), ttl],
  );
  if (ins.rowCount === 0) {
    // Unreachable while the advisory lock holds; never claim to have stored a body we didn't.
    throw new Error("idempotency record lost a race after the advisory lock");
  }
  return { replayed: false, status: result.status, body: result.body,
           expiresAt: (ins.rows[0] as { expires_at: Date }).expires_at };
}
```
> This matches `technical/schema.sql` `idempotency_records` verbatim (columns `actor_scope`, `operation_id`, `request_hash` — sha256 hex checked by `~ '^[0-9a-f]{64}$'` — `state`, `response_status`, `response_body`, `response_headers`, `expires_at not null`, and the `state='completed' ⇒ response_* not null` check). Insert directly as `'completed'` (valid under the check) and rely on the unique constraint + `on conflict do nothing` for replay races. Task 5 grants `select, insert` on this table — no UPDATE needed.

`packages/database/src/index.ts`:
```ts
export * from "./pool.js";
export * from "./tx.js";
export * from "./audit.js";
export * from "./outbox.js";
export * from "./idempotency.js";
```

- [ ] **Step 6: Run test to verify it passes**

Set env: `export APP_DB_URL=postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres`
Run: `pnpm --filter @aktflow/database test`
Expected: PASS (2 tests) — atomic commit and rollback proven.

- [ ] **Step 7: Commit**

```bash
git add packages/database pnpm-lock.yaml
git commit -m "feat(database): withTenantTx + audit/outbox/idempotency atomic primitives"
```

---

## Task 7: `apps/app` scaffold + Supabase Auth + request context + http helpers

**Files:**
- Create: `apps/app/package.json`, `apps/app/next.config.ts`, `apps/app/tsconfig.json`, `apps/app/.env.example`, `apps/app/src/lib/{supabase-server.ts,request-context.ts,auth.ts,http.ts}`, `apps/app/app/(auth)/login/page.tsx`
- Test: `apps/app/src/lib/http.test.ts`

**Interfaces:**
- Consumes: `problem`, `ProblemJson` from `@aktflow/contracts`.
- Produces:
  - `requireUser(req): Promise<{ userId: string; token: string }>` — verifies the Supabase access token server-side, throws `HttpProblem` (401) if absent/invalid.
  - `requestIdFrom(req): string` — reads or generates `X-Request-Id`.
  - `HttpProblem` error class carrying `status` + `ProblemJson`.
  - `jsonProblem(status, problem)` and `ok(status, body, requestId)` Response helpers that set `X-Request-Id` and `content-type`.

- [ ] **Step 1: Next.js app manifest (pinned version)**

`apps/app/package.json`:
```json
{
  "name": "@aktflow/app",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "16.2.11",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "@supabase/supabase-js": "2.47.10",
    "@supabase/ssr": "0.5.2",
    "@aktflow/contracts": "workspace:*",
    "@aktflow/domain": "workspace:*",
    "@aktflow/database": "workspace:*"
  }
}
```
> Pin `next` to the exact patched 16.2.x current at implementation time (≥16.2.11). Do not use `^`.

- [ ] **Step 2: Env template + supabase server client**

`apps/app/.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
APP_DB_URL=postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres
```

`apps/app/src/lib/supabase-server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (all) => {
          // cookies().set() throws when called from a plain Server Component. getUser()
          // may refresh the token and trigger this, so swallow that case: the refreshed
          // cookie is re-issued on the next Route Handler / Server Action request.
          try {
            all.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch { /* not writable in this context */ }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Write the failing http-helper test**

`apps/app/src/lib/http.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { HttpProblem, jsonProblem, ok, requestIdFrom } from "./http.js";
import { problem } from "@aktflow/contracts";

describe("http helpers", () => {
  it("generates a request id when header is absent", () => {
    const id = requestIdFrom(new Request("http://x/"));
    expect(id).toMatch(/[0-9a-f-]{36}/);
  });
  it("echoes provided X-Request-Id", () => {
    const id = requestIdFrom(new Request("http://x/", { headers: { "x-request-id": "req-9" } }));
    expect(id).toBe("req-9");
  });
  it("jsonProblem sets status, content-type and X-Request-Id", async () => {
    const res = jsonProblem(409, problem("org.conflict", "d", { requestId: "req-9" }));
    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(res.headers.get("x-request-id")).toBe("req-9");
  });
  it("HttpProblem carries status and body", () => {
    const e = new HttpProblem(401, problem("AUTH_REQUIRED", "d"));
    expect(e.status).toBe(401);
    expect(e.body.code).toBe("auth.required");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @aktflow/app test`
Expected: FAIL — `./http.js` missing.

- [ ] **Step 5: Implement http + auth + request-context**

`apps/app/src/lib/http.ts`:
```ts
import { problem, type ProblemJson } from "@aktflow/contracts";

export class HttpProblem extends Error {
  constructor(public status: number, public body: ProblemJson) { super(body.detail); }
}

export function requestIdFrom(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function jsonProblem(status: number, body: ProblemJson): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json", "x-request-id": body.requestId },
  });
}

export function ok(
  status: number, body: unknown, requestId: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": requestId, ...extraHeaders },
  });
}

/**
 * Single error→Response mapping every route handler must use. Without it each
 * handler re-implements the instanceof chain and one missed case turns a
 * documented 409 IDEMPOTENCY_CONFLICT into an opaque 500.
 */
export function toProblemResponse(err: unknown, requestId: string): Response {
  if (err instanceof HttpProblem) {
    return jsonProblem(err.status, { ...err.body, requestId: err.body.requestId || requestId });
  }
  if (err instanceof IdempotencyConflictError) {
    return jsonProblem(409, problem("IDEMPOTENCY_CONFLICT",
      "Той самий Idempotency-Key використано з іншим тілом запиту.", {
        requestId, retryable: false,
        userAction: "Використайте новий ключ або повторіть початковий запит без змін.",
      }));
  }
  return jsonProblem(500, problem("INTERNAL_ERROR", "Внутрішня помилка.",
    { requestId, retryable: true }));
}

export { problem };
```
> `toProblemResponse` imports `IdempotencyConflictError` from `@aktflow/database`. Every route handler's `catch` is exactly `return toProblemResponse(err, requestId);` — no per-route instanceof chains.

`apps/app/src/lib/auth.ts`:
```ts
import { HttpProblem } from "./http.js";
import { problem } from "@aktflow/contracts";
import { supabaseServer } from "./supabase-server.js";

export async function requireUser(requestId: string): Promise<{ userId: string }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new HttpProblem(401, problem("AUTH_REQUIRED", "Потрібна автентифікація.", {
      requestId, retryable: false, userAction: "Увійдіть у систему.",
    }));
  }
  return { userId: data.user.id };
}
```

`apps/app/src/lib/request-context.ts`:
```ts
export function organizationIdFrom(req: Request): string | null {
  return req.headers.get("x-organization-id");
}
export function idempotencyKeyFrom(req: Request): string | null {
  return req.headers.get("idempotency-key");
}
```

- [ ] **Step 6: Minimal login page (Supabase Auth UI is later; email magic-link stub)**

`apps/app/app/(auth)/login/page.tsx`:
```tsx
export default function LoginPage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>AktFlow — вхід</h1>
      <p>Автентифікація через Supabase Auth. UI-форма — у наступному слайсі.</p>
    </main>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @aktflow/app test`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add apps/app pnpm-lock.yaml
git commit -m "feat(app): next.js scaffold, supabase auth guard, request-context + http helpers"
```

---

## Task 8: BFF `POST /v1/organizations` (bootstrap command)

**Files:**
- Create: `apps/app/app/v1/organizations/route.ts`
- Test: `apps/app/tests/organizations.int.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `requestIdFrom`, `idempotencyKeyFrom`, `HttpProblem`, `jsonProblem`, `ok`; `createOrganizationRequest`, `createOrganizationResponse`, `problem` (contracts); `buildOrganizationCreation` (domain); `withTenantTx`, `recordAudit`, `enqueueOutbox`, `withIdempotency` (database).
- Produces: `POST /v1/organizations` → `201` `CreateOrganizationResponse`; the only authenticated route with **no** `X-Organization-Id` requirement.

- [ ] **Step 1: Write the failing integration test**

`apps/app/tests/organizations.int.test.ts` (drives the route handler directly with a faked authenticated user):
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
vi.mock("../src/lib/auth.js", () => ({ requireUser: async () => ({ userId: A }) }));

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
async function count(sql: string, p: unknown[]): Promise<number> {
  const c = new Client({ connectionString: admin }); await c.connect();
  const r = await c.query(sql, p); await c.end(); return Number(r.rows[0].n);
}

beforeEach(async () => {
  const c = new Client({ connectionString: admin }); await c.connect();
  await c.query("truncate public.organizations, public.legal_entities, public.memberships, public.audit_events, public.transaction_outbox, public.idempotency_records cascade");
  await c.end();
});

describe("POST /v1/organizations", () => {
  it("creates org+legal_entity+owner membership+audit+outbox atomically", async () => {
    const { POST } = await import("../app/v1/organizations/route.js");
    const res = await POST(new Request("http://x/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "k1" },
      body: JSON.stringify({ legalName: "ТОВ Е", displayName: "Е" }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.role).toBe("owner");
    expect(await count("select count(*) n from public.legal_entities", [])).toBe(1);
    expect(await count("select count(*) n from public.audit_events where action='organization.created'", [])).toBe(1);
    expect(await count("select count(*) n from public.transaction_outbox where topic='organization.created'", [])).toBe(1);
  });

  it("replays idempotently — same key does not create a second org", async () => {
    const { POST } = await import("../app/v1/organizations/route.js");
    const make = () => POST(new Request("http://x/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "dup" },
      body: JSON.stringify({ legalName: "A", displayName: "B" }),
    }));
    await make(); await make();
    expect(await count("select count(*) n from public.organizations", [])).toBe(1);
  });

  it("rejects a missing Idempotency-Key with problem+json", async () => {
    const { POST } = await import("../app/v1/organizations/route.js");
    const res = await POST(new Request("http://x/v1/organizations", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ legalName: "A", displayName: "B" }),
    }));
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aktflow/app test organizations.int`
Expected: FAIL — route module missing.

- [ ] **Step 3: Implement the route**

`apps/app/app/v1/organizations/route.ts`:
```ts
import { createHash } from "node:crypto";
import { requireUser } from "../../../src/lib/auth.js";
import { requestIdFrom, idempotencyKeyFrom } from "../../../src/lib/request-context.js";
import { HttpProblem, toProblemResponse, ok } from "../../../src/lib/http.js";
import { createOrganizationRequest, problem, type CreateOrganizationResponse } from "@aktflow/contracts";
import { buildOrganizationCreation } from "@aktflow/domain";
import { withTenantTx, recordAudit, enqueueOutbox, withIdempotency } from "@aktflow/database";

export const runtime = "nodejs"; // node-postgres + node:crypto require the Node runtime

export async function POST(req: Request): Promise<Response> {
  const requestId = requestIdFrom(req);
  try {
    const { userId } = await requireUser(requestId);

    const idempotencyKey = idempotencyKeyFrom(req);
    if (!idempotencyKey) {
      throw new HttpProblem(422, problem("VALIDATION_FAILED",
        "Заголовок Idempotency-Key обовʼязковий.", { requestId, retryable: false,
        fieldErrors: [{ path: "Idempotency-Key", message: "required" }],
        userAction: "correct_fields" }));
    }

    // Read the RAW body once: it is both parsed and hashed (request_hash must be a
    // 64-char sha256 hex per the idempotency_records check constraint).
    const raw = await req.text();
    const requestHash = createHash("sha256").update(raw).digest("hex");
    let json: unknown;
    try { json = JSON.parse(raw); }
    catch {
      throw new HttpProblem(422, problem("VALIDATION_FAILED", "Тіло запиту не є валідним JSON.",
        { requestId, retryable: false }));
    }

    const parsed = createOrganizationRequest.safeParse(json);
    if (!parsed.success) {
      throw new HttpProblem(422, problem("VALIDATION_FAILED", "Некоректні дані організації.", {
        requestId, retryable: false,
        fieldErrors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      }));
    }

    const ids = {
      organizationId: crypto.randomUUID(),
      legalEntityId: crypto.randomUUID(),
      membershipId: crypto.randomUUID(),
    };
    const c = buildOrganizationCreation(parsed.data, userId, ids);

    const out = await withTenantTx({ actorUserId: userId, organizationId: null, requestId }, async (tx) => {
      return withIdempotency<CreateOrganizationResponse>(tx, {
        organizationId: null,
        actorScope: `user:${userId}`,
        operationId: "organizations.create",
        key: idempotencyKey,
        requestHash,
      }, async () => {
        await tx.query(
          `insert into public.organizations (id, legal_name, display_name, edrpou, base_currency, timezone, status, version)
           values ($1,$2,$3,$4,$5,$6,'trial',1)`,
          [c.organization.id, c.organization.legal_name, c.organization.display_name,
           c.organization.edrpou, c.organization.base_currency, c.organization.timezone]);
        // ORDER MATTERS: the owner membership must exist BEFORE the legal entity,
        // because le_insert requires an active membership in that org (anti-injection).
        // m_insert still passes here because the org has no members yet (bootstrap).
        await tx.query(
          `insert into public.memberships (id, organization_id, user_id, role, status, all_projects, version)
           values ($1,$2,$3,'owner','active',true,1)`,
          [c.membership.id, c.membership.organization_id, c.membership.user_id]);
        await tx.query(
          `insert into public.legal_entities (id, organization_id, legal_name, registration_code, country_code) values ($1,$2,$3,$4,$5)`,
          [c.legalEntity.id, c.legalEntity.organization_id, c.legalEntity.legal_name, c.legalEntity.registration_code, c.legalEntity.country_code]);
        // now that membership exists, set org context so subsequent audit read policies pass
        await tx.query("select set_config('app.organization_id', $1, true)", [c.organization.id]);
        await recordAudit(tx, { actorUserId: userId, organizationId: c.organization.id, requestId }, c.audit);
        await enqueueOutbox(tx, { actorUserId: userId, organizationId: c.organization.id, requestId }, c.outbox);
        return {
          status: 201,
          body: {
            organizationId: c.organization.id, membershipId: c.membership.id,
            role: "owner" as const, version: 1,
          },
        };
      });
    });

    // Idempotency-Replay-Until lets a client tell "still replayable" from "window
    // expired" — without it a late retry silently creates a SECOND organization.
    return ok(out.status, out.body, requestId, {
      "Idempotency-Replay-Until": out.expiresAt.toISOString(),
    });
  } catch (err) {
    // Single mapping point: HttpProblem → its status, IdempotencyConflictError → 409, else 500.
    return toProblemResponse(err, requestId);
  }
}
```
> `withIdempotency` runs INSIDE the `withTenantTx` transaction; its `fn` returns `{ status, body }`. On idempotent replay the stored `status`+`body` are returned and no rows are inserted. `legal_entities`/`idempotency_records` columns follow `technical/schema.sql` (schema authoritative).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aktflow/app test organizations.int`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app
git commit -m "feat(app): POST /v1/organizations bootstrap command (atomic org+membership+audit+outbox+idempotency)"
```

---

## Task 9: BFF `GET /v1/me/context` (tenant-scoped read)

**Files:**
- Create: `apps/app/app/v1/me/context/route.ts`, `apps/app/app/(app)/context/page.tsx`
- Test: `apps/app/tests/me-context.int.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `requestIdFrom`, `HttpProblem`, `jsonProblem`, `ok`; `meContextResponse` (contracts); `withTenantTx` (database).
- Produces: `GET /v1/me/context` → `200` `MeContextResponse` reading `api.me_context` under the actor's RLS scope.

- [ ] **Step 1: Write the failing integration test**

`apps/app/tests/me-context.int.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = A;
vi.mock("../src/lib/auth.js", () => ({ requireUser: async () => ({ userId: current }) }));

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
async function seedOrgFor(userId: string): Promise<void> {
  const c = new Client({ connectionString: admin }); await c.connect();
  const org = await c.query("insert into public.organizations (legal_name, display_name) values ('L','D-'||$1) returning id", [userId]);
  await c.query("insert into public.memberships (organization_id,user_id,role,status,all_projects) values ($1,$2,'owner','active',true)", [org.rows[0].id, userId]);
  await c.end();
}
beforeEach(async () => {
  const c = new Client({ connectionString: admin }); await c.connect();
  await c.query("truncate public.organizations, public.memberships cascade"); await c.end();
});

describe("GET /v1/me/context", () => {
  it("returns only the caller's memberships", async () => {
    await seedOrgFor(A); await seedOrgFor(B);
    const { GET } = await import("../app/v1/me/context/route.js");
    current = A;
    const res = await GET(new Request("http://x/v1/me/context"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(A);
    expect(body.memberships).toHaveLength(1);
    expect(body.memberships[0].role).toBe("owner");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aktflow/app test me-context.int`
Expected: FAIL — route missing.

- [ ] **Step 3: Implement the route**

`apps/app/app/v1/me/context/route.ts`:
```ts
import { requireUser } from "../../../../src/lib/auth.js";
import { requestIdFrom } from "../../../../src/lib/request-context.js";
import { HttpProblem, toProblemResponse, ok } from "../../../../src/lib/http.js";
import { meContextResponse, problem } from "@aktflow/contracts";
import { withTenantTx } from "@aktflow/database";

export async function GET(req: Request): Promise<Response> {
  const requestId = requestIdFrom(req);
  try {
    const { userId } = await requireUser(requestId);
    const rows = await withTenantTx({ actorUserId: userId, organizationId: null, requestId }, async (tx) => {
      const r = await tx.query(
        `select organization_id, display_name, role, status, membership_version from api.me_context`);
      return r.rows as Array<{ organization_id: string; display_name: string; role: string; status: string; membership_version: number }>;
    });
    const body = meContextResponse.parse({
      userId,
      memberships: rows.map((m) => ({
        organizationId: m.organization_id, displayName: m.display_name,
        role: m.role, status: m.status, membershipVersion: Number(m.membership_version),
      })),
    });
    return ok(200, body, requestId);
  } catch (err) {
    // Single mapping point: HttpProblem → its status, IdempotencyConflictError → 409, else 500.
    return toProblemResponse(err, requestId);
  }
}
```

- [ ] **Step 4: Minimal context page (server component)**

`apps/app/app/(app)/context/page.tsx`:
```tsx
export default async function ContextPage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Ваш контекст</h1>
      <p>Список організацій завантажується через /v1/me/context.</p>
    </main>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @aktflow/app test me-context.int`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/app
git commit -m "feat(app): GET /v1/me/context tenant-scoped read via api.me_context"
```

---

## Task 10: Outbox drain — Edge Function + pg_cron schedule

**Files:**
- Create: `supabase/functions/outbox-drain/index.ts`, `supabase/migrations/0005_outbox_drain_cron.sql`
- Test: `supabase/functions/outbox-drain/drain.test.ts`

**Interfaces:**
- Consumes: `transaction_outbox` rows.
- Produces: an Edge Function that marks the oldest unprocessed rows `processed_at = now()` and returns `{ drained: number }`; a `pg_cron` job invoking it on a schedule.

- [ ] **Step 1: Write the failing test (drain marks rows processed)**

`supabase/functions/outbox-drain/drain.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Client } from "pg";
const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// The drain logic is a single SQL statement; test it directly.
const DRAIN_SQL = `
  with picked as (
    select id from public.transaction_outbox
    where processed_at is null and available_at <= now()
    order by available_at limit 100 for update skip locked)
  update public.transaction_outbox o set processed_at = now()
  from picked where o.id = picked.id returning o.id`;

describe("outbox drain SQL", () => {
  it("marks unprocessed rows processed", async () => {
    const c = new Client({ connectionString: admin }); await c.connect();
    await c.query("truncate public.transaction_outbox");
    await c.query("insert into public.transaction_outbox (topic,aggregate_type,aggregate_id,payload_version,payload) values ('t','a','1',1,'{}')");
    const r = await c.query(DRAIN_SQL);
    expect(r.rowCount).toBe(1);
    const left = await c.query("select count(*) n from public.transaction_outbox where processed_at is null");
    expect(Number(left.rows[0].n)).toBe(0);
    await c.end();
  });
});
```

- [ ] **Step 2: Run to verify it fails, then passes**

Run: `pnpm vitest run supabase/functions/outbox-drain/drain.test.ts`
Expected: FAIL first only if table absent; after `supabase db reset` it should PASS (validates the SQL the function runs).

- [ ] **Step 3: Implement the Edge Function**

`supabase/functions/outbox-drain/index.ts`:
```ts
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supabase.rpc("drain_outbox", { batch: 100 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ drained: data ?? 0 }), {
    headers: { "content-type": "application/json" },
  });
});
```

- [ ] **Step 4: Implement the drain function + cron schedule**

`supabase/migrations/0005_outbox_drain_cron.sql`:
```sql
create extension if not exists pg_cron;

create or replace function public.drain_outbox(batch int default 100)
returns int language sql security definer set search_path = public as $$
  with picked as (
    select id from public.transaction_outbox
    where processed_at is null and available_at <= now()
    order by available_at limit batch for update skip locked)
  , upd as (
    update public.transaction_outbox o set processed_at = now()
    from picked where o.id = picked.id returning 1)
  select count(*)::int from upd
$$;

-- Schedule every 30 seconds (adjust interval as load appears).
select cron.schedule('outbox-drain', '30 seconds', $$select public.drain_outbox(100)$$);
```
> Slice-1 drain runs the SQL directly via `pg_cron`. The Edge Function is deployed for the future path where drained rows fan out to real consumers; wiring cron→Edge Function HTTP is deferred until there is a consumer (spec §4.5).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm dlx supabase db reset && pnpm vitest run supabase/functions/outbox-drain/drain.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat(db): transactional outbox drain function + pg_cron schedule; edge function stub"
```

---

## Task 11: CI — GitHub Actions with ephemeral Supabase + full test suite

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: all package `test`/`typecheck`/`lint`/`build` scripts.
- Produces: a CI pipeline that boots Supabase, applies migrations + seed, and runs unit + contract + integration + RLS negative tests before build.

- [ ] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request: {}
jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      APP_DB_URL: postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres
      SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start
      - run: supabase db reset
      - run: pnpm turbo run lint typecheck
      - run: pnpm turbo run test
      - run: pnpm turbo run build
```

- [ ] **Step 2: Verify locally by mimicking CI order**

Run: `pnpm install --frozen-lockfile && pnpm dlx supabase start && pnpm dlx supabase db reset && pnpm turbo run lint typecheck test build`
Expected: all PASS.

- [ ] **Step 3: Commit and push to open a PR**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: github actions with ephemeral supabase, migrations, and full test suite"
```
Push the branch and confirm the CI run is green on the PR.

---

## Task 12: Landing shell + staging deploy (Vercel + Supabase staging)

**Files:**
- Create: `apps/landing/package.json`, `apps/landing/next.config.ts`, `apps/landing/tsconfig.json`, `apps/landing/app/{layout.tsx,page.tsx}`
- Create: `packages/ui/src/tokens.css`, `packages/ui/package.json`
- Create: `infra/README-staging.md` (provisioning runbook)

**Interfaces:**
- Consumes: nothing (landing is static this slice).
- Produces: two deployable Vercel projects (`apps/app`, `apps/landing`), a staging Supabase project with migrations applied, and a documented provisioning runbook.

- [ ] **Step 1: Import Evidence Atlas tokens into packages/ui**

`packages/ui/src/tokens.css` — copy the `:root` custom-property blocks from `prototype/src/styles.css` (lines with `--ink`, `--signal`, `--slate`, `--paper`, shadow/glass, and the `--atlas-*` block). Header the file:
```css
/* Evidence Atlas design tokens — sourced from prototype/src/styles.css. Visual tokens only. */
:root {
  --ink: #171717; --ink-2: #242424; --paper: #fbfbfb; --white: #fff;
  --signal: #c6ff34; --signal-dark: #667f12; --slate: #484c5e;
  --line: rgba(72,76,94,.17); --muted: #666979;
  --amber: #f2b84b; --red: #e45c55; --blue: #65719a;
  --shadow-xs: 0 5px 16px rgba(23,23,23,.055);
  --shadow-sm: 0 12px 32px rgba(23,23,23,.085);
  --shadow: 0 24px 70px rgba(23,23,23,.13);
  --shadow-lime: 0 12px 28px rgba(198,255,52,.2);
}
```
`packages/ui/package.json`: name `@aktflow/ui`, exports `./tokens.css`.

- [ ] **Step 2: Landing shell that consumes tokens**

`apps/landing/app/page.tsx`:
```tsx
import "@aktflow/ui/tokens.css";
export default function Home() {
  return (
    <main style={{ padding: 48, background: "var(--paper)", color: "var(--ink)" }}>
      <h1>AktFlow</h1>
      <p>Evidence-to-payment operating layer. Публічний лендинг — наповнення далі.</p>
    </main>
  );
}
```
`apps/landing/package.json`: `next` pinned ≥16.2.11, `react` 19, dep `@aktflow/ui`.

- [ ] **Step 3: Provision staging (documented runbook)**

Create `infra/README-staging.md` with the exact steps:
```
1. Create Supabase project "aktflow-staging"; record project ref, DB URL, anon key, service_role key.
2. Set aktflow_app_login password: `alter role aktflow_app_login password '<secret>';` (run once via SQL editor).
3. Link + push migrations: `supabase link --project-ref <ref> && supabase db push`.
4. Create two Vercel projects from the monorepo:
   - app:     root apps/app,     env NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY / APP_DB_URL(staging pooler), domain app.aktflow.com
   - landing: root apps/landing, domain aktflow.com
5. Configure Vercel to build with pnpm + turbo (ignoredBuildStep by workspace).
6. Deploy; verify /login renders and POST /v1/organizations + GET /v1/me/context work against staging DB.
```

- [ ] **Step 4: Verify builds**

Run: `pnpm turbo run build`
Expected: both `@aktflow/app` and `@aktflow/landing` build.

- [ ] **Step 5: Deploy to staging and verify the vertical end-to-end**

Follow `infra/README-staging.md`. Then, against staging:
- create a Supabase Auth user, obtain a session;
- `POST /v1/organizations` with `Idempotency-Key` → `201`;
- `GET /v1/me/context` → the new org appears;
- confirm an `audit_events` row and a `transaction_outbox` row exist and the row was drained (`processed_at` set) within ~30s.

- [ ] **Step 6: Commit**

```bash
git add apps/landing packages/ui infra
git commit -m "feat: landing shell with Evidence Atlas tokens + staging provisioning runbook"
```

---

## Self-Review

**1. Spec coverage (against `docs/superpowers/specs/2026-07-24-p0a-foundation-design.md`):**
- §2 infra (monorepo, Vercel app+landing, Supabase dev+staging, pg_cron drain, CI) → Tasks 1, 10, 11, 12. ✓
- §3 repo shape + package boundaries → Tasks 1–12 create exactly the listed dirs; `apps/worker`/`apps/mobile` correctly absent. ✓
- §3.1 shadcn + Evidence Atlas tokens → Task 12 imports tokens; shadcn primitives noted as tokens-only this slice (component build lands with first real form in slice 2). ✓
- §4.1 tables verbatim from schema.sql → Task 4 (copy-verbatim instruction + authoritative-schema notes). ✓
- §4.2 vertical (POST /v1/organizations + GET /v1/me/context) → Tasks 8, 9. ✓
- §4.3 withTenantTx (token verify, membership resolve, GUCs, least-priv, atomic commit, reset) → Tasks 6, 7 (auth). ✓
- §4.3 idempotency → Tasks 6, 8. ✓
- §4.4 roles/grants/RLS/authenticated-select-only → Task 5. ✓
- §4.5 outbox drain → Task 10. ✓
- §5 problem+json, X-Request-Id → audit link → Tasks 2, 7 (http), 6 (audit writes request_id). ✓
- §6 test pyramid (unit/contract/integration/RLS-negative/idempotency/outbox) → Tasks 3, 2, 6+8+9, 5, 8, 10. ✓
- §6 exit criterion (staging vertical, cross-tenant fails, audit+outbox, idempotent replay, green CI) → Tasks 11, 12 Step 5. ✓

**2. Placeholder scan:** No "TBD/TODO"; every code step has real code. The three "copy verbatim from schema.sql" instructions are deliberate (schema is the authoritative source per Global Constraints) and name the exact tables/columns — not placeholders.

**3. Type consistency:** `TenantContext`, `Tx`, `AuditIntent`, `OutboxIntent`, `buildOrganizationCreation(input, actorUserId, ids)`, `withTenantTx(ctx, fn)`, `recordAudit(tx, ctx, intent)`, `enqueueOutbox(tx, ctx, intent)`, `withIdempotency(tx, key, actorUserId, fn)`, `problem(code, detail, opts)`, `requireUser(requestId)`, `jsonProblem`/`ok`/`requestIdFrom` are defined once and consumed with matching signatures across Tasks 2–9. ✓

**Deferred security items (from the Task 5 deep review — tracked, not built here):**
- `audit_events`, `transaction_outbox`, `idempotency_records` have NO RLS. Grant-revocation protects `anon`/`authenticated` only — it gives no tenant isolation on the shared `aktflow_app` role, so those tables rely on BFF query correctness (`where organization_id = …`). Add RLS in the slice that introduces their read paths.
- `api.me_context` is owner-run (not `security_invoker`); its `user_id = app.current_actor()` predicate is the only isolation. Consider `WITH (security_invoker = true)` for defense-in-depth.
- `legal_entities` UPDATE grant (DA-003) and `idempotency_records` UPDATE (DA-134) are intentionally omitted: no update path exists in this slice and `withIdempotency` is insert-only. Add each with its flow *and* a matching UPDATE policy.

**Known follow-ups (out of slice 1, tracked for slice 2+):** real login UI + session cookies; `X-Organization-Id` enforcement middleware for non-bootstrap routes; MFA binding; membership scopes + no-owner-elevation; cron→Edge Function HTTP wiring when a consumer exists; shadcn component layer.
