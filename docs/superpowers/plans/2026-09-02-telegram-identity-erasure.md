# Erasure and retention of Telegram conversation identity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give GoProceed a way to forget one Telegram identity on request and a way to forget by age once the owner names the durations — without weakening the immutability the message guard exists for.

**Architecture:** One migration, `0081`, in five sections: two tables in schema `app` (a surrogate registry and a retention policy seeded inert), a recognised transformation in the message guard and a dedicated guard for edit events, a SECURITY DEFINER that performs the erasure, and a retention definer scheduled through pg_cron. An operator script holds the HMAC pepper and calls the definer in one transaction. Tests live in `packages/testing` on workspace-scoped fixtures. Paperwork closes the slice: two catalog rows, one invariant, the README procedure, two dated evidence entries in the readiness gates, and a gate record.

**Tech Stack:** PostgreSQL 17 (Supabase local, pinned CLI in `.supabase-cli-version`), plpgsql SECURITY DEFINER functions in schema `app`, pg_cron (present locally and on staging per `infra/README-staging.md` §2.1), Node ESM script with `pg` 8.23, vitest 3.2.4, pnpm + turbo.

**Spec:** [`docs/superpowers/specs/2026-09-02-telegram-identity-erasure-design.md`](../specs/2026-09-02-telegram-identity-erasure-design.md)

## Global Constraints

Every task's requirements implicitly include this section.

- **CLAUDE.md (2026-09-02):** every change to RLS, grants or the migration that carries them is its own commit naming the test it answers, and keeps or explicitly revises `technical/data-access-surface.csv`, `technical/database/invariant-catalog.csv` and the slice's spec. The migration is written in five sections, one commit each (Tasks 1–5). Auth code is not touched.
- **Migration number is `0081`, and it depends on `0080` being present.** `0080_the_choice_session_the_service_could_not_reach.sql` lands with PR #62. Task 0 verifies it; if `ls supabase/migrations | tail -1` is not `0080…`, stop and rebase this branch onto `origin/claude/d3-0-decision-slice` first. Migrations are append-only (`docs/README.md` §"Change control").
- **The marker text is exactly** `[текст стерто на запит]` **on both paths.** It is a stored value, not a copy-catalog key. Type it once into the migration and copy it; a differing byte in the guard branch versus the definer makes every erasure raise.
- **Column lists are copied from the tree, not from the spec.** The message guard in `0070_telegram_evidence_terminal_receipts.sql:426-451` compares **26** columns (the spec's §5 and §7.4 say 27 — Task 8 corrects the spec); erasure changes four, so the branch holds the other **22** unchanged. `communication_message_events` has eleven columns (read from the catalog on 2026-09-02): `id, workspace_id, project_id, message_id, event_kind, text, delivery_state, provider_event_at, server_received_at, created_at, provider_update_id`.
- **`app.reject_mutation()` is shared with `audit_events`** (`0006_foundation_tenant_isolation.sql:10-19`) and stays untouched. The edit-events branch lives in a new function `app.guard_communication_message_event()` and the events trigger is repointed to it (Task 3). This is the spec's §7.4 branch with a smaller blast radius, not a change of semantics.
- **The audit row is written by an owner-only helper, not by `app.record_service_audit`.** That function requires `pg_has_role(session_user, 'goproceed_service', 'member')` (`0078_service_plane_write_paths.sql:92-94`); the retention job runs under pg_cron as the database owner and cannot pass it. `app.write_erasure_audit()` (Task 4) inserts the same shape into `public.audit_events` with `actor_type = 'system'` and `actor_user_id` NULL, and is granted to no role.
- **Two roles, three planes, in tests:** `adminClient()` (superuser: bypasses RLS, triggers still fire — the guard pins run here), `asService(actor, workspace, fn)` (`packages/testing/src/pg.ts:86-103` — `set local role goproceed_service`, the definer's real caller), `asActor` (member plane — proves the `app` tables are unreachable). Never `truncate`; every fixture is dropped by `dropWorkspaces` in `afterAll`.
- **Tests in `packages/testing` need the three connection variables** (`APP_DB_URL`, `SERVICE_DB_URL`, `SUPABASE_DB_URL` — Environment setup). `packages/testing`'s vitest `include` is `src/**/*.test.ts` (`packages/testing/vitest.config.ts:9`) and files run serially (`fileParallelism: false`).
- **The isolated `apps/app` suites do not run locally.** Their `beforeEach` truncates `public.organizations cascade` (`apps/app/tests/project-channel.int.test.ts:29-33`) over the only local database. Nothing in this plan needs them; the script's unit test has no database.
- **The pepper never reaches the database.** `TELEGRAM_LINK_PEPPER` (`apps/app/src/lib/telegram/config.ts:19`, `min(32)`) is read by the script only; the definer receives an HMAC and an id. The HMAC input is `erasure:<workspace>:<telegram_user_id>` — the `erasure:` prefix keeps it apart from `telegramVerifier()`'s domain (`apps/app/src/lib/telegram/tokens.ts:14`).
- **No counts in source comments, no line numbers in migration comments** — cite the symbol. Commit messages carry the counts.
- **Commit trailer on every commit:** `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Environment setup (run once, before Task 1)

```bash
cd /Users/akisliy/Downloads/GoProceed/.claude/worktrees/d1-telegram-identity-erasure
pnpm install --frozen-lockfile
```

```bash
supabase status   # the local stack must be up; `supabase start` if it is not
```

```bash
export APP_DB_URL=postgresql://goproceed_app_login:app_pw@127.0.0.1:54322/postgres
export SERVICE_DB_URL=postgresql://goproceed_service_login:service_pw@127.0.0.1:54322/postgres
export SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

**Applying the migration locally.** The owner's working database is the same local stack. `supabase db reset` rebuilds it from every migration and is the honest way to apply `0081`; it also wipes local state the owner may be using on the Telegram branch. Ask before running it. The alternative that touches nothing else is to apply each section by hand inside a transaction while developing —

```bash
docker exec -i supabase_db_goproceed psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 -f - < supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql
```

— which is idempotent for this file (every statement is `create or replace`, `create table if not exists`, `drop trigger if exists`, `insert … on conflict do nothing`) and is what the steps below assume. CI applies it through `db reset` regardless.

## File Structure

**Database (Tasks 1–5)**
- Create: `supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql` — one file, five sections, written across five commits.
- Create: `packages/testing/src/telegram-erasure.test.ts` — one file, one `describe` per task; the fixture is shared.

**Operator entry (Task 6)**
- Create: `apps/app/scripts/telegram-erase-identity.mjs` — exports `parseArgs`, `subjectHmac`, `erase`; runs `main` only when invoked directly.
- Create: `apps/app/src/lib/telegram/erase-identity-cli.test.ts` — no database.

**Paperwork (Task 7)**
- Modify: `technical/data-access-surface.csv` (+2 rows), `technical/database/invariant-catalog.csv` (+INV-099), `technical/data-retention-catalog.csv` (notes on rows 3–14), `infra/README-staging.md` (new §7), `docs/delivery/production-readiness.md` (dated entries under §2 and §4), the spec (the 27→26 correction).

**Closing (Task 8)**
- Create: `docs/superpowers/plans/evidence/2026-09-0X-telegram-identity-erasure-gate.md` — the gate record, in the shape of `2026-08-03-rename-slice3-gate.md`.
- Modify: `TODOS.md` — residuals.

---

### Task 0: Preconditions

- [ ] **Step 1: Confirm the branch base and the migration number**

Run:
```bash
git log --oneline -1 origin/claude/d3-0-decision-slice
ls supabase/migrations | tail -2
```
Expected: the second line ends with `0080_the_choice_session_the_service_could_not_reach.sql`. If it ends with `0079…`, PR #62 has not landed on d3 — `git merge origin/claude/d3-0-decision-slice` after it does, then continue. Do not renumber to `0080`.

- [ ] **Step 2: Confirm the local stack is at the same ledger**

Run:
```bash
docker exec -i supabase_db_goproceed psql -U supabase_admin -d postgres -X -A -t -c "select max(version) from supabase_migrations.schema_migrations"
```
Expected: `0080…` (or the owner's answer about resetting — see Environment setup).

---

### Task 1: Migration 0081 §1 — the registry and the policy

**Files:**
- Create: `supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql`
- Create: `packages/testing/src/telegram-erasure.test.ts`

**Interfaces:**
- Produces: `app.telegram_erasures (id, workspace_id, subject_hmac, surrogate_user_id, origin, erased_at, messages_count, events_count, links_count, attachments_count)` and `app.retention_policy (data_class, duration, updated_at)` seeded with three NULL rows. Tasks 4 and 5 read and write both.

- [ ] **Step 1: Write the failing schema tests**

Create `packages/testing/src/telegram-erasure.test.ts`. The fixture seeds one workspace with two senders; later tasks add cases to the same file. `sqlstate()` returns the SQLSTATE of a failing query so a policy denial (`42501`) is distinguishable from a missing relation (`42P01`).

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { Client, QueryResult } from "pg";
import { adminClient, asActor, asService, dropWorkspaces } from "./pg";

/**
 * THE ERASURE PROCEDURE, EXERCISED ON SYNTHETIC DATA — M0 gate 4's «manual
 * deletion procedure … exercised once end to end», scoped to one identity.
 *
 * Fixture: workspace WS_A with two Telegram senders. X (SUBJECT) wrote two
 * messages, one of them edited, has a member link and one attachment with a
 * filename. Y (BYSTANDER) wrote one message. Every assertion about X is paired
 * with «and Y is byte-identical», because an erasure that reaches one row too
 * many is a different bug from one that reaches one too few.
 */
const WS_A = "a1a1a1a1-2222-4222-8222-222222222222";
const WS_B = "b1b1b1b1-2222-4222-8222-222222222222";
const OWNER = "c1c1c1c1-2222-4222-8222-222222222222";
const SUBJECT = 700001n;
const BYSTANDER = 700002n;
const MARKER = "[текст стерто на запит]";
const PEPPER = "p".repeat(32);

let admin: Client;
let projectId: string;
let ownerMemberId: string;
let bindingId: string;
let subjectMessageIds: string[] = [];
let bystanderMessageId: string;

export function subjectHmac(pepper: string, workspaceId: string, telegramUserId: bigint): string {
  return createHmac("sha256", pepper).update(`erasure:${workspaceId}:${telegramUserId}`, "utf8").digest("hex");
}

async function sqlstate(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return "ok"; } catch (e) { return (e as { code?: string }).code ?? "unknown"; }
}

/** One row of every column the guard watches, as a comparable object. */
async function messageRow(id: string): Promise<Record<string, unknown>> {
  const r = await admin.query("select * from public.communication_messages where id = $1", [id]);
  return r.rows[0]!;
}

beforeAll(async () => {
  admin = await adminClient();
  await admin.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'erasure-owner@example.test', '', now(), now())
    on conflict (id) do nothing`, [OWNER]);
  await admin.query("insert into public.organizations (id, legal_name, display_name) values ($1, 'Erasure A', 'Erasure A'), ($2, 'Erasure B', 'Erasure B')", [WS_A, WS_B]);
  const member = await admin.query<{ id: string }>("insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'owner', 'active') returning id", [WS_A, OWNER]);
  ownerMemberId = member.rows[0]!.id;
  const project = await admin.query<{ id: string }>("insert into public.projects (workspace_id, name, created_by) values ($1, 'Erasure', $2) returning id", [WS_A, OWNER]);
  projectId = project.rows[0]!.id;
  await admin.query("insert into public.project_field_channels (workspace_id, project_id, channel) values ($1, $2, 'telegram')", [WS_A, projectId]);
  const binding = await admin.query<{ id: string }>(`insert into public.telegram_chat_bindings
    (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
    values ($1, $2, 123456789, -100777, 'supergroup', $3) returning id`, [WS_A, projectId, ownerMemberId]);
  bindingId = binding.rows[0]!.id;
  const insertMessage = async (sender: bigint, text: string | null, name: string, username: string) => {
    const r = await admin.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, provider_user_id,
       provider_display_name_snapshot, provider_username_snapshot, server_received_at, delivery_state)
      values ($1, $2, $3, 'inbound', 'text', $4, $5, $6, $7, now(), 'received') returning id`,
      [WS_A, projectId, bindingId, text, sender.toString(), name, username]);
    return r.rows[0]!.id;
  };
  subjectMessageIds = [
    await insertMessage(SUBJECT, "Кабель прокладено, фото додаю", "Петро Петренко", "petrenko"),
    await insertMessage(SUBJECT, null, "Петро Петренко", "petrenko"),
  ];
  bystanderMessageId = await insertMessage(BYSTANDER, "Прийнято", "Ольга Іваненко", "ivanenko");
  await admin.query(`insert into public.communication_message_events
    (workspace_id, project_id, message_id, event_kind, text, server_received_at)
    values ($1, $2, $3, 'edited', 'Кабель прокладено, фото додаю (виправлено)', now())`,
    [WS_A, projectId, subjectMessageIds[0]]);
  await admin.query(`insert into public.telegram_member_links
    (workspace_id, member_id, telegram_user_id, display_name_snapshot, username_snapshot, linked_by_member_id)
    values ($1, $2, $3, 'Петро Петренко', 'petrenko', $2)`, [WS_A, ownerMemberId, SUBJECT.toString()]);
  await admin.query(`insert into public.communication_attachments
    (workspace_id, project_id, message_id, provider_file_id, provider_file_unique_id,
     filename_snapshot, media_type_snapshot, byte_size, state)
    values ($1, $2, $3, 'file-x', 'uniq-x', 'Петренко_акт.pdf', 'application/pdf', 11, 'staged')`,
    [WS_A, projectId, subjectMessageIds[0]]);
});

afterAll(async () => {
  await dropWorkspaces(admin, [WS_A, WS_B]);
  await admin.end();
});

describe("§1 — the registry and the policy exist, in schema app, reachable by no role", () => {
  it("app.telegram_erasures answers 42501 to the member plane and to the service plane", async () => {
    expect(await sqlstate(() => asActor(OWNER, WS_A, (c) => c.query("select 1 from app.telegram_erasures")))).toBe("42501");
    expect(await sqlstate(() => asService("", WS_A, (c) => c.query("select 1 from app.telegram_erasures")))).toBe("42501");
  });

  it("app.retention_policy answers 42501 to both planes and holds three NULL durations", async () => {
    expect(await sqlstate(() => asActor(OWNER, WS_A, (c) => c.query("select 1 from app.retention_policy")))).toBe("42501");
    expect(await sqlstate(() => asService("", WS_A, (c) => c.query("select 1 from app.retention_policy")))).toBe("42501");
    const r = await admin.query<{ data_class: string; duration: string | null }>(
      "select data_class, duration::text as duration from app.retention_policy order by 1");
    expect(r.rows).toEqual([
      { data_class: "customer_communication", duration: null },
      { data_class: "customer_identity", duration: null },
      { data_class: "operational_security", duration: null },
    ]);
  });

  it("both tables have row level security enabled and no policy", async () => {
    const r = await admin.query<{ relname: string; rls: boolean; policies: number }>(`
      select c.relname, c.relrowsecurity as rls,
             (select count(*) from pg_policies p where p.schemaname = 'app' and p.tablename = c.relname)::int as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'app' and c.relname in ('telegram_erasures', 'retention_policy') order by 1`);
    expect(r.rows).toEqual([
      { relname: "retention_policy", rls: true, policies: 0 },
      { relname: "telegram_erasures", rls: true, policies: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts`
Expected: three failures — `42P01` where `42501` was expected (the relations do not exist), and an empty row set for the third.

- [ ] **Step 3: Write §1 of the migration**

Create `supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql`:

```sql
-- The identity that asked to be forgotten.
--
-- WHAT THIS ADDS. A way to forget one Telegram identity on request, and a
-- way to forget by age once the owner names the durations. Five sections:
--   1. app.telegram_erasures — the surrogate registry — and
--      app.retention_policy, seeded with three NULL durations (inert);
--   2. app.guard_communication_message learns to recognise exactly one
--      transformation — pseudonym plus redaction, under two transaction-local
--      markers — and refuses everything else as before;
--   3. app.guard_communication_message_event — the same for edit events,
--      leaving app.reject_mutation untouched for audit_events;
--   4. app.erase_telegram_identity — the definer the operator calls — and the
--      owner-only helpers it is built from;
--   5. app.apply_communication_retention and its pg_cron schedule.
--
-- WHAT THIS DOES NOT CHANGE. No public table gains a column or loses a
-- constraint. DA-148's column grant on communication_attachments and INV-094
-- stand. The immutability of communication_messages stands for every UPDATE
-- that is not the one transformation §2 names.
--
-- WHY SCHEMA app. The registry and the policy are not tenant data and must
-- never be member-readable. Schema app is where the service plane's functions
-- live; a table here has no public grant, no policy and no entity-catalog row
-- (scripts/validate-canonical-docs.mjs counts tables from `create table
-- public.` only). These are the first tables in app.
--
-- ROLLBACK (dev only): drop function app.apply_communication_retention,
-- app.erase_telegram_identity, app.erase_telegram_identity_internal,
-- app.write_erasure_audit, app.guard_communication_message_event; recreate
-- the events trigger on app.reject_mutation; restore
-- app.guard_communication_message from 0070; drop the two tables;
-- cron.unschedule('communication-retention'). Rows already erased are not
-- restorable, by design.

-- ===========================================================================
-- 1. The registry and the policy
-- ===========================================================================

create table if not exists app.telegram_erasures (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.organizations(id),
  subject_hmac      text check (subject_hmac ~ '^[0-9a-f]{64}$'),
  surrogate_user_id bigint not null check (surrogate_user_id < 0),
  origin            text not null check (origin in ('data_subject_request', 'retention')),
  erased_at         timestamptz not null default now(),
  messages_count    integer not null default 0,
  events_count      integer not null default 0,
  links_count       integer not null default 0,
  attachments_count integer not null default 0,
  unique (workspace_id, surrogate_user_id),
  unique (workspace_id, subject_hmac),
  check ((origin = 'data_subject_request') = (subject_hmac is not null))
);
comment on table app.telegram_erasures is
  'One row per erased Telegram identity per workspace. subject_hmac is an HMAC the application computed under its pepper; the original identifier is stored nowhere. Reachable through app.erase_telegram_identity only.';
alter table app.telegram_erasures enable row level security;
revoke all on table app.telegram_erasures from public, anon, authenticated, goproceed_app, goproceed_service;

create table if not exists app.retention_policy (
  data_class text primary key
    check (data_class in ('customer_communication', 'customer_identity', 'operational_security')),
  duration   interval check (duration is null or duration > interval '0'),
  updated_at timestamptz not null default now()
);
comment on table app.retention_policy is
  'Retention durations per data class of technical/data-retention-catalog.csv. NULL means no retention runs for that class. A duration lands by a migration that updates one row.';
insert into app.retention_policy (data_class, duration) values
  ('customer_communication', null), ('customer_identity', null), ('operational_security', null)
on conflict (data_class) do nothing;
alter table app.retention_policy enable row level security;
revoke all on table app.retention_policy from public, anon, authenticated, goproceed_app, goproceed_service;
```

- [ ] **Step 4: Apply §1 and run the test**

Run:
```bash
docker exec -i supabase_db_goproceed psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 -f - < supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql
pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts
```
Expected: §1's three cases PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql packages/testing/src/telegram-erasure.test.ts
git commit -m "$(cat <<'EOF'
feat(erasure): 0081 §1 — the surrogate registry and the retention policy, in schema app

Answers packages/testing/src/telegram-erasure.test.ts §1: both tables exist
in schema app with row level security on and no policy, both answer 42501
to goproceed_app and to goproceed_service, and the policy holds three NULL
durations — inert until the owner lands one.

Spec: docs/superpowers/specs/2026-09-02-telegram-identity-erasure-design.md
§7.1, §7.2, §10. Paperwork: DA rows and the retention-catalog pointer land
in the paperwork commit of this slice; DA-148 and INV-094 untouched.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Migration 0081 §2 — the message guard recognises the transformation

**Files:**
- Modify: `supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql` (append §2)
- Modify: `packages/testing/src/telegram-erasure.test.ts` (add `describe("§2 …")`)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: the transaction-local markers `app.erasure_subject` (the old `provider_user_id` as text) and `app.erasure_surrogate` (the new one as text), which Task 4's definer sets. The redaction shape the guard admits: `provider_user_id` → surrogate, both snapshots → NULL, `text` → `MARKER` where it was non-NULL, every other guarded column unchanged.

- [ ] **Step 1: Write the failing guard pins**

Append to the test file. These run as the superuser inside one transaction each, rolled back at the end — triggers fire for the superuser, RLS does not apply, and nothing persists.

```ts
/** Run `fn` as admin in a transaction with the two markers set, then roll back. */
async function underMarkers(subject: bigint, surrogate: bigint, fn: (c: Client) => Promise<unknown>): Promise<string> {
  const c = await adminClient();
  try {
    await c.query("begin");
    await c.query("select set_config('app.erasure_subject', $1, true), set_config('app.erasure_surrogate', $2, true)",
      [subject.toString(), surrogate.toString()]);
    try { await fn(c); return "ok"; } catch (e) { return (e as { code?: string }).code ?? "unknown"; }
  } finally { await c.query("rollback").catch(() => undefined); await c.end(); }
}

describe("§2 — the message guard admits the redaction and nothing else", () => {
  const SURROGATE = -424242n;
  const redaction = (extra = "") => `update public.communication_messages
     set provider_user_id = ${SURROGATE}, provider_display_name_snapshot = null,
         provider_username_snapshot = null,
         text = case when text is null then null else '${MARKER}' end ${extra}
   where id = $1`;

  it("admits the exact redaction of the subject's message under the markers", async () => {
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => c.query(redaction(), [subjectMessageIds[0]]))).toBe("ok");
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => c.query(redaction(), [subjectMessageIds[1]]))).toBe("ok");
  });

  it("refuses the same UPDATE without the markers", async () => {
    const c = await adminClient();
    try {
      await c.query("begin");
      const code = await sqlstate(() => c.query(redaction(), [subjectMessageIds[0]]));
      expect(code).toBe("P0001");
    } finally { await c.query("rollback").catch(() => undefined); await c.end(); }
  });

  it("refuses a text that is not the marker", async () => {
    const sql = `update public.communication_messages set provider_user_id = ${SURROGATE},
      provider_display_name_snapshot = null, provider_username_snapshot = null, text = 'щось інше' where id = $1`;
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => c.query(sql, [subjectMessageIds[0]]))).toBe("P0001");
  });

  it("refuses the redaction when any other guarded column changes with it", async () => {
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => c.query(redaction(", kind = 'photo'"), [subjectMessageIds[0]]))).toBe("P0001");
  });

  it("refuses the redaction of a message that is not the subject's", async () => {
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => c.query(redaction(), [bystanderMessageId]))).toBe("P0001");
  });

  it("refuses a surrogate other than the one the marker names", async () => {
    const sql = `update public.communication_messages set provider_user_id = -1, provider_display_name_snapshot = null,
      provider_username_snapshot = null, text = case when text is null then null else '${MARKER}' end where id = $1`;
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => c.query(sql, [subjectMessageIds[0]]))).toBe("P0001");
  });

  it("still refuses DELETE under the markers", async () => {
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => c.query("delete from public.communication_messages where id = $1", [subjectMessageIds[0]]))).toBe("P0001");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts -t "§2"`
Expected: the first case FAILS with `P0001` (the guard as it stands refuses the redaction); the six refusal cases already pass — they pin what must survive.

- [ ] **Step 3: Write §2 of the migration**

Append. The body below is `0070_telegram_evidence_terminal_receipts.sql`'s `app.guard_communication_message` with one branch before its comparison. The 26 guarded columns and the message text are copied from there; do not retype them from memory.

```sql
-- ===========================================================================
-- 2. The message guard learns one transformation
--
-- The guard from 0070 stands: DELETE raises, and any change to the columns it
-- names raises. One shape is now admitted before that comparison — the
-- redaction app.erase_telegram_identity performs — and only under two
-- transaction-local markers the definer sets and clears:
--   app.erasure_subject    the row's current provider_user_id, as text
--   app.erasure_surrogate  the value it becomes, as text
-- The branch requires BOTH the old and the new identifier to match the
-- markers, both snapshots to become NULL, the text to become the marker where
-- it was set and to stay NULL where it was NULL, and every other guarded
-- column to be unchanged. A definer that touched any other column would raise
-- here, which is what packages/testing/src/telegram-erasure.test.ts §2 pins.
-- Outbound messages authored by members carry provider_user_id NULL and can
-- never match the branch.
-- ===========================================================================

create or replace function app.guard_communication_message() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'communication message original is immutable; append an event';
  end if;

  if coalesce(current_setting('app.erasure_subject', true), '') <> ''
     and old.provider_user_id is not null
     and old.provider_user_id::text = current_setting('app.erasure_subject', true)
     and new.provider_user_id::text = coalesce(current_setting('app.erasure_surrogate', true), '')
     and new.provider_display_name_snapshot is null
     and new.provider_username_snapshot is null
     and new.text is not distinct from
         (case when old.text is null then null else '[текст стерто на запит]' end)
     and old.id is not distinct from new.id
     and old.workspace_id is not distinct from new.workspace_id
     and old.project_id is not distinct from new.project_id
     and old.telegram_chat_binding_id is not distinct from new.telegram_chat_binding_id
     and old.direction is not distinct from new.direction
     and old.kind is not distinct from new.kind
     and old.author_member_id is not distinct from new.author_member_id
     and old.server_received_at is not distinct from new.server_received_at
     and old.reply_to_message_id is not distinct from new.reply_to_message_id
     and old.provider_reply_to_message_id is not distinct from new.provider_reply_to_message_id
     and old.work_assignment_id is not distinct from new.work_assignment_id
     and old.retry_of_message_id is not distinct from new.retry_of_message_id
     and old.telegram_reply_markup is not distinct from new.telegram_reply_markup
     and old.telegram_occurrence_snapshot is not distinct from new.telegram_occurrence_snapshot
     and old.telegram_evidence_receipt_key is not distinct from new.telegram_evidence_receipt_key
     and old.telegram_evidence_copy_key is not distinct from new.telegram_evidence_copy_key
     and old.telegram_evidence_source_attachment_id is not distinct from new.telegram_evidence_source_attachment_id
     and old.telegram_evidence_source_media_group_id is not distinct from new.telegram_evidence_source_media_group_id
     and old.telegram_evidence_generation is not distinct from new.telegram_evidence_generation
     and old.telegram_evidence_chunk_index is not distinct from new.telegram_evidence_chunk_index
     and old.telegram_evidence_recipient_member_id is not distinct from new.telegram_evidence_recipient_member_id
     and old.created_at is not distinct from new.created_at then
    return new;
  end if;

  if old.id is distinct from new.id
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
     or old.retry_of_message_id is distinct from new.retry_of_message_id
     or old.telegram_reply_markup is distinct from new.telegram_reply_markup
     or old.telegram_occurrence_snapshot is distinct from new.telegram_occurrence_snapshot
     or old.telegram_evidence_receipt_key is distinct from new.telegram_evidence_receipt_key
     or old.telegram_evidence_copy_key is distinct from new.telegram_evidence_copy_key
     or old.telegram_evidence_source_attachment_id is distinct from new.telegram_evidence_source_attachment_id
     or old.telegram_evidence_source_media_group_id is distinct from new.telegram_evidence_source_media_group_id
     or old.telegram_evidence_generation is distinct from new.telegram_evidence_generation
     or old.telegram_evidence_chunk_index is distinct from new.telegram_evidence_chunk_index
     or old.telegram_evidence_recipient_member_id is distinct from new.telegram_evidence_recipient_member_id
     or old.created_at is distinct from new.created_at then
    raise exception 'communication message original is immutable; append an event';
  end if;
  return new;
end $$;
```

Before applying, diff the second `if` against `0070:426-451` — it must be byte-identical:

```bash
sed -n '/^  if old.id is distinct from new.id/,/^  end if;/p' supabase/migrations/0070_telegram_evidence_terminal_receipts.sql > /tmp/g0070.txt
sed -n '/^  if old.id is distinct from new.id/,/^  end if;/p' supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql > /tmp/g0081.txt
diff /tmp/g0070.txt /tmp/g0081.txt && echo "guard comparison identical"
```

- [ ] **Step 4: Apply §2 and run the tests**

Run:
```bash
docker exec -i supabase_db_goproceed psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 -f - < supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql
pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts
```
Expected: §1 and §2 PASS (§2: 1 admission, 6 refusals).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql packages/testing/src/telegram-erasure.test.ts
git commit -m "$(cat <<'EOF'
feat(erasure): 0081 §2 — the message guard admits the redaction, and nothing else

Answers packages/testing/src/telegram-erasure.test.ts §2: under the two
markers the exact redaction of the subject's message passes; without the
markers, with a text other than the marker, with any other guarded column
changed, on another sender's message, with a surrogate the marker did not
name, and on DELETE — the guard raises as it did in 0070.

The second comparison is byte-identical to 0070's (diffed before applying);
the branch admits one shape ahead of it. Spec §7.4.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migration 0081 §3 — a guard for edit events

**Files:**
- Modify: `supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql` (append §3)
- Modify: `packages/testing/src/telegram-erasure.test.ts` (add `describe("§3 …")`)

**Interfaces:**
- Consumes: the `app.erasure_surrogate` marker from Task 2 — the events branch checks the parent message already carries the surrogate, which fixes the order Task 4 must use: messages first, then events.
- Produces: `app.guard_communication_message_event()`, bound to `communication_message_events` in place of `app.reject_mutation()`.

- [ ] **Step 1: Write the failing pins**

```ts
describe("§3 — the edit-event guard admits the redaction of an already-redacted message's edit", () => {
  const SURROGATE = -424242n;
  let eventId: string;
  beforeAll(async () => {
    const r = await admin.query<{ id: string }>("select id from public.communication_message_events where message_id = $1 and event_kind = 'edited'", [subjectMessageIds[0]]);
    eventId = r.rows[0]!.id;
  });

  /** The parent must already carry the surrogate; do that first, in the same transaction. */
  const parentThenEvent = (c: Client, eventSql: string) => c.query(`update public.communication_messages
       set provider_user_id = ${SURROGATE}, provider_display_name_snapshot = null,
           provider_username_snapshot = null, text = case when text is null then null else '${MARKER}' end
     where id = $1`, [subjectMessageIds[0]]).then(() => c.query(eventSql, [eventId]));

  it("admits text → marker on an edited event whose parent carries the surrogate", async () => {
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => parentThenEvent(c,
      `update public.communication_message_events set text = '${MARKER}' where id = $1`))).toBe("ok");
  });

  it("refuses the same UPDATE when the parent still carries the real id", async () => {
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => c.query(
      `update public.communication_message_events set text = '${MARKER}' where id = $1`, [eventId]))).toBe("P0001");
  });

  it("refuses a text other than the marker, and any other column, and DELETE", async () => {
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => parentThenEvent(c,
      "update public.communication_message_events set text = 'інше' where id = $1"))).toBe("P0001");
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => parentThenEvent(c,
      `update public.communication_message_events set text = '${MARKER}', event_kind = 'edited', provider_update_id = 5 where id = $1`))).toBe("P0001");
    expect(await underMarkers(SUBJECT, SURROGATE, (c) => parentThenEvent(c,
      "delete from public.communication_message_events where id = $1"))).toBe("P0001");
  });

  it("audit_events is still append-only through the untouched app.reject_mutation", async () => {
    const r = await admin.query<{ f: string }>(`select p.proname as f from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid where t.tgrelid = 'public.audit_events'::regclass and not t.tgisinternal`);
    expect(r.rows.map((x) => x.f)).toEqual(["reject_mutation"]);
    const e = await admin.query<{ f: string }>(`select p.proname as f from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid where t.tgrelid = 'public.communication_message_events'::regclass and not t.tgisinternal`);
    expect(e.rows.map((x) => x.f)).toEqual(["guard_communication_message_event"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts -t "§3"`
Expected: the first case FAILS with `P0001`; the last FAILS on the trigger function name (`reject_mutation` instead of `guard_communication_message_event`).

- [ ] **Step 3: Write §3 of the migration**

```sql
-- ===========================================================================
-- 3. A guard of its own for edit events
--
-- communication_message_events was append-only through app.reject_mutation,
-- the function 0006 gave audit_events and that three tables share. The
-- function stays as it is — audit_events keeps it — and the events table gets
-- its own guard: the same refusal, plus one admitted shape. An edited event's
-- text may become the marker when the parent message already carries the
-- surrogate named in app.erasure_surrogate and no other column changes. The
-- parent is checked by surrogate, which is why app.erase_telegram_identity
-- rewrites messages before events.
-- ===========================================================================

create or replace function app.guard_communication_message_event() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(current_setting('app.erasure_surrogate', true), '') <> ''
     and old.event_kind = 'edited'
     and new.text = '[текст стерто на запит]'
     and exists (select 1 from public.communication_messages m
                  where m.id = old.message_id
                    and m.provider_user_id::text = current_setting('app.erasure_surrogate', true))
     and old.id is not distinct from new.id
     and old.workspace_id is not distinct from new.workspace_id
     and old.project_id is not distinct from new.project_id
     and old.message_id is not distinct from new.message_id
     and old.event_kind is not distinct from new.event_kind
     and old.delivery_state is not distinct from new.delivery_state
     and old.provider_event_at is not distinct from new.provider_event_at
     and old.server_received_at is not distinct from new.server_received_at
     and old.created_at is not distinct from new.created_at
     and old.provider_update_id is not distinct from new.provider_update_id then
    return new;
  end if;
  raise exception 'append-only relation %.% cannot be % (correct via successor fact)',
    tg_table_schema, tg_table_name, lower(tg_op);
end $$;

drop trigger if exists communication_message_events_append_only on public.communication_message_events;
create trigger communication_message_events_append_only
  before update or delete on public.communication_message_events
  for each row execute function app.guard_communication_message_event();
```

- [ ] **Step 4: Apply §3 and run the tests**

Run the apply command from Task 1 Step 4, then `pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts`.
Expected: §1–§3 PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql packages/testing/src/telegram-erasure.test.ts
git commit -m "$(cat <<'EOF'
feat(erasure): 0081 §3 — edit events get a guard of their own

Answers packages/testing/src/telegram-erasure.test.ts §3: an edited event's
text may become the marker once its parent carries the surrogate the marker
names; with the parent unredacted, with another text, with another column,
or on DELETE the guard raises. app.reject_mutation is untouched and still the
only guard on audit_events — pinned by the trigger-function query.

Spec §7.4, second block; the dedicated function is the branch with a smaller
blast radius, as Global Constraints record.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Migration 0081 §4 — the erasure definer

**Files:**
- Modify: `supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql` (append §4)
- Modify: `packages/testing/src/telegram-erasure.test.ts` (add `describe("§4 …")`)

**Interfaces:**
- Consumes: `app.telegram_erasures` (Task 1), the markers and the admitted shapes (Tasks 2–3).
- Produces:
  - `app.write_erasure_audit(p_workspace uuid, p_surrogate bigint, p_details jsonb, p_reason text) returns void` — owner-only.
  - `app.erase_telegram_identity_internal(p_workspace uuid, p_telegram_user_id bigint, p_subject_hmac text, p_origin text) returns table (surrogate_user_id bigint, messages bigint, events bigint, links bigint, attachments bigint, pending_updates_for_subject bigint, already_erased boolean)` — owner-only; Task 5 calls it.
  - `app.erase_telegram_identity(p_workspace uuid, p_telegram_user_id bigint, p_subject_hmac text)` — same return shape; EXECUTE to `goproceed_service`; Task 6's script calls it.

- [ ] **Step 1: Write the failing synthetic exercise**

```ts
describe("§4 — one identity, erased on request", () => {
  const call = (hmac: string) => asService<{
    surrogate_user_id: string; messages: string; events: string; links: string; attachments: string;
    pending_updates_for_subject: string; already_erased: boolean;
  }>("", WS_A, (c) => c.query("select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text)",
    [WS_A, SUBJECT.toString(), hmac]));

  it("rewrites every row of the subject and none of the bystander, and records itself", async () => {
    const before = await messageRow(bystanderMessageId);
    const r = await call(subjectHmac(PEPPER, WS_A, SUBJECT));
    const out = r.rows[0]!;
    expect(out.already_erased).toBe(false);
    expect(Number(out.surrogate_user_id)).toBeLessThan(0);
    expect({ m: out.messages, e: out.events, l: out.links, a: out.attachments }).toEqual({ m: "2", e: "1", l: "1", a: "1" });

    const msgs = await admin.query<{ provider_user_id: string; provider_display_name_snapshot: string | null; provider_username_snapshot: string | null; text: string | null }>(
      "select provider_user_id::text, provider_display_name_snapshot, provider_username_snapshot, text from public.communication_messages where id = any($1::uuid[]) order by created_at", [subjectMessageIds]);
    expect(msgs.rows).toEqual([
      { provider_user_id: out.surrogate_user_id, provider_display_name_snapshot: null, provider_username_snapshot: null, text: MARKER },
      { provider_user_id: out.surrogate_user_id, provider_display_name_snapshot: null, provider_username_snapshot: null, text: null },
    ]);
    const ev = await admin.query<{ text: string }>("select text from public.communication_message_events where message_id = $1 and event_kind = 'edited'", [subjectMessageIds[0]]);
    expect(ev.rows).toEqual([{ text: MARKER }]);
    const link = await admin.query<{ telegram_user_id: string; display_name_snapshot: string | null; username_snapshot: string | null; revoked: boolean }>(
      "select telegram_user_id::text, display_name_snapshot, username_snapshot, revoked_at is not null as revoked from public.telegram_member_links where workspace_id = $1 and member_id = $2", [WS_A, ownerMemberId]);
    expect(link.rows).toEqual([{ telegram_user_id: out.surrogate_user_id, display_name_snapshot: null, username_snapshot: null, revoked: true }]);
    const att = await admin.query<{ filename_snapshot: string | null; provider_file_id: string | null }>(
      "select filename_snapshot, provider_file_id from public.communication_attachments where message_id = $1", [subjectMessageIds[0]]);
    expect(att.rows).toEqual([{ filename_snapshot: null, provider_file_id: "file-x" }]);

    expect(await messageRow(bystanderMessageId)).toEqual(before);

    const reg = await admin.query<{ subject_hmac: string; origin: string; surrogate_user_id: string }>(
      "select subject_hmac, origin, surrogate_user_id::text from app.telegram_erasures where workspace_id = $1", [WS_A]);
    expect(reg.rows).toEqual([{ subject_hmac: subjectHmac(PEPPER, WS_A, SUBJECT), origin: "data_subject_request", surrogate_user_id: out.surrogate_user_id }]);

    const audit = await admin.query<{ action: string; actor_type: string; actor_user_id: string | null; object_id: string; details: Record<string, unknown>; body: string }>(
      `select action, actor_type, actor_user_id, object_id, details, row_to_json(a)::text as body
         from public.audit_events a where organization_id = $1 and action = 'telegram_identity.erased'`, [WS_A]);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({ actor_type: "system", actor_user_id: null, object_id: out.surrogate_user_id });
    expect(audit.rows[0]!.details).toMatchObject({ messages: 2, events: 1, links: 1, attachments: 1, origin: "data_subject_request" });
    expect(audit.rows[0]!.body).not.toContain(SUBJECT.toString());
  });

  it("is idempotent: a second call returns the same surrogate and touches nothing", async () => {
    const first = await admin.query<{ surrogate_user_id: string }>("select surrogate_user_id::text from app.telegram_erasures where workspace_id = $1", [WS_A]);
    const r = await call(subjectHmac(PEPPER, WS_A, SUBJECT));
    expect(r.rows[0]).toMatchObject({ already_erased: true, surrogate_user_id: first.rows[0]!.surrogate_user_id, messages: "0", events: "0", links: "0", attachments: "0" });
  });

  it("refuses the member plane and a caller with no service membership", async () => {
    expect(await sqlstate(() => asActor(OWNER, WS_A, (c) => c.query("select * from app.erase_telegram_identity($1::uuid, 1::bigint, repeat('a', 64))", [WS_A])))).toBe("42501");
  });

  it("clears both markers before returning", async () => {
    const r = await asService<{ s: string | null; g: string | null }>("", WS_A, async (c) => {
      await c.query("select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text)", [WS_A, BYSTANDER.toString(), subjectHmac(PEPPER, WS_A, BYSTANDER)]);
      return c.query("select current_setting('app.erasure_subject', true) as s, current_setting('app.erasure_surrogate', true) as g");
    });
    expect(r.rows[0]).toEqual({ s: "", g: "" });
  });
});
```

The fourth case erases the bystander too; §5's retention cases below seed their own rows, so nothing later depends on Y being intact.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts -t "§4"`
Expected: FAIL — `function app.erase_telegram_identity(uuid, bigint, text) does not exist` (`42883`).

- [ ] **Step 3: Write §4 of the migration**

```sql
-- ===========================================================================
-- 4. The erasure
--
-- Three functions. write_erasure_audit inserts the audit row the way
-- app.record_service_audit would — actor_type 'system', no actor — without
-- that function's pg_has_role gate, because §5's retention job runs as the
-- database owner under pg_cron and could not pass it. erase_telegram_identity_
-- internal is the transformation: registry, markers, four updates in the
-- order the guards require, audit, markers cleared. erase_telegram_identity
-- is the one callable surface, for the service principal, with the origin
-- fixed to a data-subject request. Only that last function has an EXECUTE
-- grant.
-- ===========================================================================

create or replace function app.write_erasure_audit(
  p_workspace uuid, p_surrogate bigint, p_details jsonb, p_reason text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events
    (organization_id, actor_user_id, actor_type, action, object_type, object_id,
     request_id, details, object_version, reason_code)
  values (p_workspace, null, 'system', 'telegram_identity.erased', 'telegram_identity',
          p_surrogate::text, gen_random_uuid()::text, p_details, null, p_reason);
end $$;
revoke all on function app.write_erasure_audit(uuid, bigint, jsonb, text) from public, anon, authenticated, goproceed_app, goproceed_service;

create or replace function app.erase_telegram_identity_internal(
  p_workspace uuid, p_telegram_user_id bigint, p_subject_hmac text, p_origin text
) returns table (
  surrogate_user_id bigint, messages bigint, events bigint, links bigint,
  attachments bigint, pending_updates_for_subject bigint, already_erased boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  v_surrogate bigint;
  v_existed boolean := false;
  v_messages bigint := 0; v_events bigint := 0; v_links bigint := 0; v_attachments bigint := 0;
  v_pending bigint := 0;
  v_try integer;
begin
  if p_telegram_user_id is null or p_telegram_user_id <= 0 then
    raise exception 'erasure needs a real Telegram identifier';
  end if;
  if p_origin not in ('data_subject_request', 'retention') then
    raise exception 'erasure origin must be data_subject_request or retention';
  end if;
  if (p_origin = 'data_subject_request') <> (p_subject_hmac is not null) then
    raise exception 'a data-subject request carries an HMAC and a retention run carries none';
  end if;

  -- The registry. A request re-run finds its surrogate by HMAC; a retention
  -- run has no HMAC and always registers afresh.
  if p_subject_hmac is not null then
    select e.surrogate_user_id into v_surrogate
      from app.telegram_erasures e
     where e.workspace_id = p_workspace and e.subject_hmac = p_subject_hmac;
    v_existed := found;
  end if;
  if v_surrogate is null then
    for v_try in 1..8 loop
      v_surrogate := -(1 + floor(random() * 4611686018427387903))::bigint;
      exit when not exists (select 1 from app.telegram_erasures e
                             where e.workspace_id = p_workspace and e.surrogate_user_id = v_surrogate);
      v_surrogate := null;
    end loop;
    if v_surrogate is null then raise exception 'could not allocate a surrogate identifier'; end if;
    insert into app.telegram_erasures (workspace_id, subject_hmac, surrogate_user_id, origin)
    values (p_workspace, p_subject_hmac, v_surrogate, p_origin);
  end if;

  perform set_config('app.erasure_subject', p_telegram_user_id::text, true);
  perform set_config('app.erasure_surrogate', v_surrogate::text, true);

  update public.communication_messages
     set provider_user_id = v_surrogate,
         provider_display_name_snapshot = null,
         provider_username_snapshot = null,
         text = case when text is null then null else '[текст стерто на запит]' end
   where workspace_id = p_workspace and provider_user_id = p_telegram_user_id;
  get diagnostics v_messages = row_count;

  update public.communication_message_events e
     set text = '[текст стерто на запит]'
    from public.communication_messages m
   where e.message_id = m.id and m.workspace_id = p_workspace
     and m.provider_user_id = v_surrogate
     and e.event_kind = 'edited' and e.text is distinct from '[текст стерто на запит]';
  get diagnostics v_events = row_count;

  update public.telegram_member_links
     set telegram_user_id = v_surrogate, display_name_snapshot = null,
         username_snapshot = null, revoked_at = coalesce(revoked_at, now())
   where workspace_id = p_workspace and telegram_user_id = p_telegram_user_id;
  get diagnostics v_links = row_count;

  update public.communication_attachments a
     set filename_snapshot = null
    from public.communication_messages m
   where a.message_id = m.id and a.workspace_id = p_workspace
     and m.provider_user_id = v_surrogate and a.filename_snapshot is not null;
  get diagnostics v_attachments = row_count;

  -- What arrives after this transaction is not this transaction's to rewrite:
  -- the four shapes api.ts's allowed_updates admits, counted so the operator
  -- knows to run again once the worker has drained them.
  select count(*) into v_pending
    from public.telegram_inbox_updates u
   where u.state in ('pending', 'leased')
     and coalesce(u.payload #>> '{message,from,id}', u.payload #>> '{edited_message,from,id}',
                  u.payload #>> '{callback_query,from,id}', u.payload #>> '{my_chat_member,from,id}')
         = p_telegram_user_id::text;

  update app.telegram_erasures e
     set erased_at = now(),
         messages_count = e.messages_count + v_messages, events_count = e.events_count + v_events,
         links_count = e.links_count + v_links, attachments_count = e.attachments_count + v_attachments
   where e.workspace_id = p_workspace and e.surrogate_user_id = v_surrogate;

  perform app.write_erasure_audit(p_workspace, v_surrogate,
    jsonb_build_object('surrogate', v_surrogate, 'messages', v_messages, 'events', v_events,
                       'links', v_links, 'attachments', v_attachments, 'origin', p_origin,
                       'pending_updates_for_subject', v_pending),
    p_origin);

  perform set_config('app.erasure_subject', '', true);
  perform set_config('app.erasure_surrogate', '', true);

  return query select v_surrogate, v_messages, v_events, v_links, v_attachments, v_pending, v_existed;
end $$;
revoke all on function app.erase_telegram_identity_internal(uuid, bigint, text, text) from public, anon, authenticated, goproceed_app, goproceed_service;

create or replace function app.erase_telegram_identity(
  p_workspace uuid, p_telegram_user_id bigint, p_subject_hmac text
) returns table (
  surrogate_user_id bigint, messages bigint, events bigint, links bigint,
  attachments bigint, pending_updates_for_subject bigint, already_erased boolean
)
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'erasure requires the service principal' using errcode = '42501';
  end if;
  if p_subject_hmac is null or p_subject_hmac !~ '^[0-9a-f]{64}$' then
    raise exception 'erasure needs the subject HMAC the application computed';
  end if;
  perform set_config('app.organization_id', p_workspace::text, true);
  return query select * from app.erase_telegram_identity_internal(p_workspace, p_telegram_user_id, p_subject_hmac, 'data_subject_request');
end $$;
revoke all on function app.erase_telegram_identity(uuid, bigint, text) from public, anon, authenticated;
grant execute on function app.erase_telegram_identity(uuid, bigint, text) to goproceed_service;
```

- [ ] **Step 4: Apply §4 and run the tests**

Run the apply command, then `pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts`.
Expected: §1–§4 PASS. If the first §4 case fails on `messages: "2"`, check that §2's branch admits the NULL-text message (the `case` keeps NULL); if on `events`, the parent was not rewritten before the events UPDATE.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql packages/testing/src/telegram-erasure.test.ts
git commit -m "$(cat <<'EOF'
feat(erasure): 0081 §4 — one identity, erased on request

Answers packages/testing/src/telegram-erasure.test.ts §4: the subject's two
messages, one edit event, member link and attachment filename are rewritten
under one negative surrogate; the bystander's row is byte-identical before
and after; the registry holds the HMAC and the surrogate; the audit row is a
system act whose body never contains the original identifier; a second call
returns the same surrogate and touches nothing; the member plane is refused
with 42501; both markers are '' when the definer returns.

This is the synthetic exercise M0 gate 4 asks for. Spec §7.3, §8.1, §11.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Migration 0081 §5 — retention by age, scheduled

**Files:**
- Modify: `supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql` (append §5)
- Modify: `packages/testing/src/telegram-erasure.test.ts` (add `describe("§5 …")`)

**Interfaces:**
- Consumes: `app.retention_policy` (Task 1), `app.erase_telegram_identity_internal` (Task 4).
- Produces: `app.apply_communication_retention(p_batch integer default 5000) returns table (data_class text, affected bigint)` — no EXECUTE grant; run by pg_cron as the owner and by the tests as admin. Cron job `communication-retention`.

- [ ] **Step 1: Write the failing retention cases**

The cases seed their own rows dated in the past, set one duration as admin, run, and reset the duration in `finally` so no later file inherits a live retention.

```ts
describe("§5 — retention by age", () => {
  const RETIRED = 700003n;
  let retiredMessageId: string;
  const setDuration = (cls: string, d: string | null) =>
    admin.query("update app.retention_policy set duration = $2::interval, updated_at = now() where data_class = $1", [cls, d]);
  const run = () => admin.query<{ data_class: string; affected: string }>("select * from app.apply_communication_retention(100) order by 1");

  beforeAll(async () => {
    const r = await admin.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, provider_user_id,
       provider_display_name_snapshot, provider_username_snapshot, server_received_at, delivery_state)
      values ($1, $2, $3, 'inbound', 'text', 'Старе повідомлення', $4, 'Іван Старий', 'staryi', now() - interval '400 days', 'received') returning id`,
      [WS_A, projectId, bindingId, RETIRED.toString()]);
    retiredMessageId = r.rows[0]!.id;
    await admin.query(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state, processed_at, disposition)
      values (123456789, 9000001, null, repeat('b', 64), 'processed', now() - interval '400 days', 'ignored'),
             (123456789, 9000002, '{"update_id": 9000002}'::jsonb, repeat('c', 64), 'pending', null, null)`);
  });

  it("does nothing while every duration is NULL", async () => {
    const before = await messageRow(retiredMessageId);
    const r = await run();
    expect(r.rows).toEqual([
      { data_class: "customer_communication", affected: "0" },
      { data_class: "customer_identity", affected: "0" },
      { data_class: "operational_security", affected: "0" },
    ]);
    expect(await messageRow(retiredMessageId)).toEqual(before);
  });

  it("redacts a sender whose messages are older than the customer_communication duration, with no HMAC in the registry", async () => {
    await setDuration("customer_communication", "365 days");
    try {
      const r = await run();
      expect(r.rows.find((x) => x.data_class === "customer_communication")).toEqual({ data_class: "customer_communication", affected: "1" });
      const m = await messageRow(retiredMessageId);
      expect(Number(m.provider_user_id)).toBeLessThan(0);
      expect(m.text).toBe(MARKER);
      const reg = await admin.query<{ origin: string; subject_hmac: string | null }>(
        "select origin, subject_hmac from app.telegram_erasures where workspace_id = $1 and surrogate_user_id = $2", [WS_A, m.provider_user_id]);
      expect(reg.rows).toEqual([{ origin: "retention", subject_hmac: null }]);
      const again = await run();
      expect(again.rows.find((x) => x.data_class === "customer_communication")).toEqual({ data_class: "customer_communication", affected: "0" });
    } finally { await setDuration("customer_communication", null); }
  });

  it("deletes terminal inbox rows older than the operational_security duration and leaves pending ones", async () => {
    await setDuration("operational_security", "30 days");
    try {
      const r = await run();
      expect(r.rows.find((x) => x.data_class === "operational_security")).toEqual({ data_class: "operational_security", affected: "1" });
      const left = await admin.query<{ update_id: string; state: string }>(
        "select update_id::text, state from public.telegram_inbox_updates where update_id in (9000001, 9000002) order by 1");
      expect(left.rows).toEqual([{ update_id: "9000002", state: "pending" }]);
    } finally {
      await setDuration("operational_security", null);
      await admin.query("delete from public.telegram_inbox_updates where update_id = 9000002");
    }
  });

  it("is scheduled under pg_cron as communication-retention", async () => {
    const r = await admin.query<{ n: number }>("select count(*)::int as n from pg_extension where extname = 'pg_cron'");
    if (r.rows[0]!.n === 0) return; // the local stack may run without pg_cron; CI's does not
    const job = await admin.query<{ schedule: string; command: string }>("select schedule, command from cron.job where jobname = 'communication-retention'");
    expect(job.rows).toEqual([{ schedule: "23 3 * * *", command: "select app.apply_communication_retention(5000)" }]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts -t "§5"`
Expected: FAIL — `function app.apply_communication_retention(integer) does not exist`.

- [ ] **Step 3: Write §5 of the migration**

```sql
-- ===========================================================================
-- 5. Retention by age
--
-- Reads app.retention_policy; a NULL duration means the class is skipped and
-- reports zero. customer_communication and customer_identity apply §4's
-- transformation to subjects old enough — the same rewrite, registered with
-- origin 'retention' and no HMAC, because the pepper is not in this database.
-- operational_security deletes what the catalog says is hash-and-disposition
-- only: terminal inbox rows and spent intents. Batched by p_batch subjects or
-- rows per call; a backlog converges over nights. Scheduled exactly as
-- 0007 schedules idempotency-purge.
-- ===========================================================================

create or replace function app.apply_communication_retention(p_batch integer default 5000)
returns table (data_class text, affected bigint)
language plpgsql security definer set search_path = '' as $$
declare
  v_dur interval;
  v_n bigint;
  v_row record;
begin
  if p_batch is null or p_batch < 1 or p_batch > 100000 then
    raise exception 'retention batch must be between 1 and 100000';
  end if;

  -- customer_communication: senders whose newest message is older than the duration.
  select p.duration into v_dur from app.retention_policy p where p.data_class = 'customer_communication';
  v_n := 0;
  if v_dur is not null then
    for v_row in
      select m.workspace_id, m.provider_user_id
        from public.communication_messages m
       where m.provider_user_id > 0
       group by m.workspace_id, m.provider_user_id
      having max(m.server_received_at) < now() - v_dur
       limit p_batch
    loop
      perform set_config('app.organization_id', v_row.workspace_id::text, true);
      perform app.erase_telegram_identity_internal(v_row.workspace_id, v_row.provider_user_id, null, 'retention');
      v_n := v_n + 1;
    end loop;
  end if;
  data_class := 'customer_communication'; affected := v_n; return next;

  -- customer_identity: revoked links older than the duration whose subject wrote nothing recent enough to have kept them.
  select p.duration into v_dur from app.retention_policy p where p.data_class = 'customer_identity';
  v_n := 0;
  if v_dur is not null then
    for v_row in
      select l.workspace_id, l.telegram_user_id
        from public.telegram_member_links l
       where l.telegram_user_id > 0 and l.revoked_at is not null and l.revoked_at < now() - v_dur
       limit p_batch
    loop
      perform set_config('app.organization_id', v_row.workspace_id::text, true);
      perform app.erase_telegram_identity_internal(v_row.workspace_id, v_row.telegram_user_id, null, 'retention');
      v_n := v_n + 1;
    end loop;
  end if;
  data_class := 'customer_identity'; affected := v_n; return next;

  -- operational_security: hash-and-disposition rows past their duration.
  select p.duration into v_dur from app.retention_policy p where p.data_class = 'operational_security';
  v_n := 0;
  if v_dur is not null then
    with del as (
      delete from public.telegram_inbox_updates u
       where u.ctid in (select u2.ctid from public.telegram_inbox_updates u2
                         where u2.state in ('processed', 'failed') and u2.processed_at < now() - v_dur
                         limit p_batch)
      returning 1)
    select count(*) into v_n from del;
    with del as (
      delete from public.telegram_binding_intents i
       where i.ctid in (select i2.ctid from public.telegram_binding_intents i2
                         where coalesce(i2.consumed_at, i2.expires_at) < now() - v_dur limit p_batch)
      returning 1)
    select v_n + count(*) into v_n from del;
    with del as (
      delete from public.telegram_member_link_intents i
       where i.ctid in (select i2.ctid from public.telegram_member_link_intents i2
                         where coalesce(i2.consumed_at, i2.expires_at) < now() - v_dur limit p_batch)
      returning 1)
    select v_n + count(*) into v_n from del;
  end if;
  data_class := 'operational_security'; affected := v_n; return next;

  perform set_config('app.organization_id', '', true);
  return;
end $$;
revoke all on function app.apply_communication_retention(integer) from public, anon, authenticated, goproceed_app, goproceed_service;

do $$
declare has_pg_cron boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_pg_cron;
  if has_pg_cron then
    if exists (select 1 from cron.job where jobname = 'communication-retention') then
      perform cron.unschedule('communication-retention');
    end if;
    perform cron.schedule('communication-retention', '23 3 * * *', $c$select app.apply_communication_retention(5000)$c$);
  else
    raise notice 'pg_cron not available: communication-retention not scheduled';
  end if;
end $$;
```

Before applying, confirm the two intent tables carry `consumed_at` and `expires_at`:

```bash
docker exec -i supabase_db_goproceed psql -U supabase_admin -d postgres -X -A -t -c "select relname, string_agg(attname, ',') from pg_attribute a join pg_class c on c.oid = a.attrelid where relname in ('telegram_binding_intents','telegram_member_link_intents') and attname in ('consumed_at','expires_at') group by 1"
```
Expected: both tables, both columns.

- [ ] **Step 4: Apply §5 and run the whole file**

Run the apply command, then `pnpm --filter @goproceed/testing exec vitest run src/telegram-erasure.test.ts`.
Expected: §1–§5 PASS. Then the neighbours that share tables — `pnpm --filter @goproceed/testing exec vitest run src/telegram-rls.test.ts src/m5-external-rls.test.ts` — still PASS (the external-plane sweep of `public` is unchanged by two tables in `app`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql packages/testing/src/telegram-erasure.test.ts
git commit -m "$(cat <<'EOF'
feat(erasure): 0081 §5 — retention by age, inert until a duration lands

Answers packages/testing/src/telegram-erasure.test.ts §5: with every
duration NULL the job reports three zeros and changes nothing; with
customer_communication at 365 days a sender whose newest message is older is
redacted through the same transformation, registered with origin 'retention'
and no HMAC, and a second run reports zero; with operational_security at 30
days a processed inbox row older than that is deleted and a pending one is
left; the job is scheduled as communication-retention at 23 3 * * * where
pg_cron exists, in 0007's shape.

Spec §7.5, §8.2. No role holds EXECUTE; pg_cron runs it as the owner.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The operator script

**Files:**
- Create: `apps/app/scripts/telegram-erase-identity.mjs`
- Create: `apps/app/src/lib/telegram/erase-identity-cli.test.ts`

**Interfaces:**
- Consumes: `app.erase_telegram_identity(uuid, bigint, text)` (Task 4).
- Produces: `parseArgs(argv: string[]) → { workspace: string; telegramUserId: string }`, `subjectHmac(pepper, workspace, telegramUserId) → string` (hex, 64), `erase({ serviceDbUrl, workspace, telegramUserId, hmac }) → Promise<Row>`. The README procedure (Task 7) quotes the invocation.

- [ ] **Step 1: Write the failing unit test**

```ts
import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { parseArgs, subjectHmac } from "../../../scripts/telegram-erase-identity.mjs";

const WS = "a1a1a1a1-2222-4222-8222-222222222222";

describe("telegram-erase-identity — the operator's entry, without a database", () => {
  it("parses --workspace and --telegram-user-id and refuses anything else", () => {
    expect(parseArgs(["--workspace", WS, "--telegram-user-id", "700001"])).toEqual({ workspace: WS, telegramUserId: "700001" });
    expect(() => parseArgs(["--workspace", WS])).toThrow(/--telegram-user-id/);
    expect(() => parseArgs(["--workspace", "not-a-uuid", "--telegram-user-id", "1"])).toThrow(/uuid/i);
    expect(() => parseArgs(["--workspace", WS, "--telegram-user-id", "-5"])).toThrow(/positive/);
    expect(() => parseArgs(["--workspace", WS, "--telegram-user-id", "1", "--extra"])).toThrow(/unknown argument/);
  });

  it("computes the HMAC over the erasure-prefixed input and refuses a missing or short pepper", () => {
    const pepper = "p".repeat(32);
    expect(subjectHmac(pepper, WS, "700001"))
      .toBe(createHmac("sha256", pepper).update(`erasure:${WS}:700001`, "utf8").digest("hex"));
    expect(subjectHmac(pepper, WS, "700001")).toMatch(/^[0-9a-f]{64}$/);
    expect(() => subjectHmac(undefined, WS, "700001")).toThrow(/TELEGRAM_LINK_PEPPER/);
    expect(() => subjectHmac("p".repeat(31), WS, "700001")).toThrow(/32/);
  });

  it("keeps the HMAC domain apart from the intent-token verifier", () => {
    const pepper = "p".repeat(32);
    const asIntent = createHmac("sha256", pepper).update(`${WS}:700001`, "utf8").digest("hex");
    expect(subjectHmac(pepper, WS, "700001")).not.toBe(asIntent);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @goproceed/app exec vitest run src/lib/telegram/erase-identity-cli.test.ts`
Expected: FAIL — cannot resolve `../../../scripts/telegram-erase-identity.mjs`.

- [ ] **Step 3: Write the script**

```js
// apps/app/scripts/telegram-erase-identity.mjs
//
// The operator's entry to app.erase_telegram_identity — M0 gate 4's manual
// deletion procedure, scoped to one Telegram identity in one workspace.
//
//   pnpm --filter @goproceed/app exec node scripts/telegram-erase-identity.mjs \
//     --workspace <uuid> --telegram-user-id <id>
//
// Reads SERVICE_DB_URL and TELEGRAM_LINK_PEPPER from the environment. The
// pepper never leaves this process: the database receives an HMAC and the
// identifier, and after the transaction stores only the HMAC. Prints one JSON
// line and exits 0; any error exits 1 with its message. A non-zero
// pending_updates_for_subject means the worker still holds updates from this
// person — run again once /internal/telegram/jobs has drained them; the
// erasure that ran is complete.
import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--workspace" || key === "--telegram-user-id") {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${key} needs a value`);
      out[key === "--workspace" ? "workspace" : "telegramUserId"] = value;
      i += 1;
    } else {
      throw new Error(`unknown argument: ${key}`);
    }
  }
  if (!out.workspace) throw new Error("--workspace is required");
  if (!out.telegramUserId) throw new Error("--telegram-user-id is required");
  if (!UUID.test(out.workspace)) throw new Error("--workspace must be a uuid");
  if (!/^[1-9][0-9]{0,18}$/.test(out.telegramUserId)) throw new Error("--telegram-user-id must be a positive integer");
  return out;
}

export function subjectHmac(pepper, workspace, telegramUserId) {
  if (typeof pepper !== "string" || pepper.length === 0) throw new Error("TELEGRAM_LINK_PEPPER is not set");
  if (pepper.length < 32) throw new Error("TELEGRAM_LINK_PEPPER must be at least 32 characters");
  return createHmac("sha256", pepper).update(`erasure:${workspace}:${telegramUserId}`, "utf8").digest("hex");
}

export async function erase({ serviceDbUrl, workspace, telegramUserId, hmac }) {
  const client = new pg.Client({ connectionString: serviceDbUrl });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local role goproceed_service");
    await client.query("select set_config('app.organization_id', $1, true)", [workspace]);
    const r = await client.query(
      "select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text)",
      [workspace, telegramUserId, hmac],
    );
    await client.query("commit");
    return r.rows[0];
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const serviceDbUrl = process.env.SERVICE_DB_URL;
  if (!serviceDbUrl) throw new Error("SERVICE_DB_URL is not set");
  const hmac = subjectHmac(process.env.TELEGRAM_LINK_PEPPER, args.workspace, args.telegramUserId);
  const row = await erase({ serviceDbUrl, workspace: args.workspace, telegramUserId: args.telegramUserId, hmac });
  console.log(JSON.stringify(row));
  if (Number(row.pending_updates_for_subject) > 0) {
    console.error("pending inbox updates from this identity exist — run again after /internal/telegram/jobs has drained them");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
}
```

- [ ] **Step 4: Run the unit test, then exercise the script against the local stack**

Run:
```bash
pnpm --filter @goproceed/app exec vitest run src/lib/telegram/erase-identity-cli.test.ts
```
Expected: 3 PASS.

Then, with the §4 fixture's workspace gone (the test file drops it), a dry exercise that must refuse cleanly:
```bash
cd apps/app && TELEGRAM_LINK_PEPPER="$(printf 'p%.0s' $(seq 32))" SERVICE_DB_URL="$SERVICE_DB_URL" \
  node scripts/telegram-erase-identity.mjs --workspace a1a1a1a1-2222-4222-8222-222222222222 --telegram-user-id 700001; echo "exit=$?"
```
Expected: exit 1 with a foreign-key message on `app.telegram_erasures.workspace_id` (the workspace does not exist) — the refusal path is the one exercised here; the success path is §4's test.

- [ ] **Step 5: Commit**

```bash
git add apps/app/scripts/telegram-erase-identity.mjs apps/app/src/lib/telegram/erase-identity-cli.test.ts
git commit -m "$(cat <<'EOF'
feat(erasure): the operator's entry — telegram-erase-identity.mjs

Answers apps/app/src/lib/telegram/erase-identity-cli.test.ts: argument
parsing refuses a missing id, a non-uuid workspace, a non-positive id and
an unknown flag; the HMAC is SHA-256 under TELEGRAM_LINK_PEPPER over
`erasure:<workspace>:<id>` — a domain apart from tokens.ts's verifier — and
a missing or 31-character pepper is refused before any connection.

One transaction as goproceed_service_login → goproceed_service; one JSON
line out; exit 1 on any error. Spec §8.1.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Paperwork

**Files:**
- Modify: `technical/data-access-surface.csv` — append two rows.
- Modify: `technical/database/invariant-catalog.csv` — append INV-099.
- Modify: `technical/data-retention-catalog.csv` — extend `notes` on rows 3–14.
- Modify: `infra/README-staging.md` — new `## 7. Manual erasure of a Telegram identity` before `## Status`.
- Modify: `docs/delivery/production-readiness.md` — dated entries under `### 2.` and `### 4.`.
- Modify: `docs/superpowers/specs/2026-09-02-telegram-identity-erasure-design.md` — 27 → 26.

**Interfaces:**
- Consumes: the CI run id of the first green run of Task 5's commit (for the evidence entries); if it is not known yet, write `run <pending>` and fill it in Task 8.

- [ ] **Step 1: Append the two DA rows**

Match the header `surface_id,object_type,schema,object_name,release,consumer,db_role,privileges,access_path,rls_policy_family,client_exposed,status,notes` (the last existing id is `DA-158`):

```csv
DA-159,table,app,telegram_erasures,Pilot,operator,none,none,app.erase_telegram_identity (SECURITY DEFINER; EXECUTE goproceed_service),none,false,normative,Surrogate registry for erased Telegram identities. Holds a peppered HMAC and a negative surrogate; never the identifier. No role reads it directly.
DA-160,table,app,retention_policy,Pilot,operator,none,none,app.apply_communication_retention (SECURITY DEFINER; no EXECUTE grant; pg_cron as owner),none,false,normative,Retention durations per data class; NULL means the class is not retained. A duration lands by migration.
```

- [ ] **Step 2: Append INV-099**

Header `invariant_id,severity,scope,statement,enforcement,test_evidence,source_document,applies_to`:

```csv
INV-099,P0,customer_identity,An erased Telegram identity is unrecoverable from any table or column the member plane can read: the subject's messages edit events member link and attachment filenames carry the surrogate or NULL and no table stores the original identifier or an unpeppered hash of it,app.erase_telegram_identity rewrites under two transaction-local markers the message guard and the edit-event guard admit for that shape only; the registry stores an HMAC under the application pepper,packages/testing/src/telegram-erasure.test.ts §2 §3 §4,docs/superpowers/specs/2026-09-02-telegram-identity-erasure-design.md,v0.1-Telegram
```

- [ ] **Step 3: Point the retention rows at the policy**

For each of rows 3–14 of `technical/data-retention-catalog.csv`, append to `notes` the sentence ` Duration comes from app.retention_policy (0081); NULL there until the owner lands it.` — the `policy_status` and `external_gate` columns stay as they are, because the durations have not landed.

- [ ] **Step 4: The README procedure**

Insert before `## Status` in `infra/README-staging.md`:

```markdown
## 7. Manual erasure of a Telegram identity

M0 gate 4 asks for a manual deletion procedure exercised on synthetic data.
This is the identity-level half of it — one person, one workspace — added
with migration `0081`. Workspace closure is a separate procedure and is not
written yet.

**What it does.** Every message that person sent in the workspace's project
groups keeps its row and its links to attachments, cards and decisions, but
its `provider_user_id` becomes a negative surrogate, its name and username
snapshots become NULL, its text becomes `[текст стерто на запит]`, its edit
history is redacted the same way, its member link is revoked and surrogated,
and its attachment filenames are cleared. One audit row `telegram_identity.erased`
records the surrogate and the counts — never the identifier. The registry
`app.telegram_erasures` keeps a peppered HMAC so a repeat is idempotent.

**Run it** on a machine holding the target environment's `SERVICE_DB_URL` and
`TELEGRAM_LINK_PEPPER` (the same values the app deploys with):

```bash
pnpm --filter @goproceed/app exec node scripts/telegram-erase-identity.mjs \
  --workspace <workspace uuid> --telegram-user-id <telegram user id>
```

It prints one JSON line: `surrogate_user_id`, `messages`, `events`, `links`,
`attachments`, `pending_updates_for_subject`, `already_erased`. Exit 1 with
the message on any error; nothing is half-erased — the whole transaction rolls
back.

**If `pending_updates_for_subject` is not 0**, the worker still holds updates
from this person. The erasure that ran is complete; run the same command again
after `POST /internal/telegram/jobs` has drained the inbox. The HMAC yields the
same surrogate.

**Record** the date, workspace, surrogate and counts where the partner's
requests are tracked. Never record the identifier next to the surrogate.

**Never** run this against a database you have not been asked to run it
against; there is no dry run, and erased rows are not restorable by design.
```

- [ ] **Step 5: The evidence entries**

Under `### 4. Manual deletion` in `docs/delivery/production-readiness.md`, directly below the first checkbox item (leave the box unticked — the item is workspace closure, and this closes one identity):

```markdown
      - **Evidence, 2026-09-0X:** the identity-level half exists and was
        exercised on synthetic data — `app.erase_telegram_identity` (0081 §4),
        procedure in [README-staging.md](../../infra/README-staging.md) §7,
        exercise `packages/testing/src/telegram-erasure.test.ts` §4, CI run
        `<id>`. Workspace closure is still owed.
```

Under `### 2. Retention schedule and telemetry bounds`, below the first checkbox:

```markdown
      - **Evidence, 2026-09-0X:** the schedule has a mechanism —
        `app.retention_policy` (0081 §1) and `app.apply_communication_retention`
        (0081 §5, pg_cron `communication-retention`) — for the fourteen
        telegram/communication tables of the retention catalog. Every duration
        is NULL; the schedule itself is still owed.
```

- [ ] **Step 6: Correct the spec's count**

In the spec, §5 «guards 27 columns» → «guards 26 columns», and §7.4 «the remaining 22 guarded columns» stands. Add one line to §5: «(26, read from 0070 on 2026-09-0X; an earlier draft said 27)».

- [ ] **Step 7: Validate and commit**

Run:
```bash
node scripts/validate-canonical-docs.mjs
```
Expected: `canonical documentation: OK`.

```bash
git add technical/data-access-surface.csv technical/database/invariant-catalog.csv technical/data-retention-catalog.csv infra/README-staging.md docs/delivery/production-readiness.md docs/superpowers/specs/2026-09-02-telegram-identity-erasure-design.md
git commit -m "$(cat <<'EOF'
docs(erasure): the paperwork the schema rests on — DA-159, DA-160, INV-099, the procedure, two gate entries

DA-159 and DA-160 record the two app-schema tables and the only paths to
them; INV-099 states what erasure guarantees and names the tests that pin
it; the retention catalog's fourteen rows point at app.retention_policy
without changing their status, because no duration has landed;
README-staging §7 is the procedure M0 gate 4 asks for; production-readiness
gains one dated evidence entry under gate 4 (identity-level half, box open)
and one under gate 2 (mechanism, schedule still owed). The spec's guarded-
column count is corrected to the 26 that 0070 compares.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: The gate record, CI, residuals

**Files:**
- Create: `docs/superpowers/plans/evidence/2026-09-0X-telegram-identity-erasure-gate.md`
- Modify: `TODOS.md`
- Modify: `docs/delivery/production-readiness.md` (fill the run id from Task 7 if it was `<pending>`)

- [ ] **Step 1: Push and let CI run**

```bash
git push origin claude/d1-telegram-identity-erasure
```
PR #65 already targets `claude/d3-0-decision-slice`. Wait for the run; record its id. Expected: `@goproceed/testing` green including the new file; `@goproceed/app` green on the new unit test and unchanged on the branch's known eighteen (recorded on #62 — they are not this slice's).

- [ ] **Step 2: Write the gate record**

Copy the shape of `docs/superpowers/plans/evidence/2026-08-03-rename-slice3-gate.md`: header block (Date, Branch, Plan, Spec, Predecessor record), «Read this first: what has *not* happened», the `Gate | Result` table with the vocabulary PASS / PASS (negative) / PASS (assisted) / NOT PROVEN — environmental / NOT RUN, «The NOT PROVEN gates, with the exact command that settles each», «Mutation checks», «What this slice does not make true», «Commits». Rows to fill from the runs above:

| Gate | Result |
|---|---|
| `packages/testing` telegram-erasure §1–§5, locally at 0081 | PASS — n tests |
| `packages/testing` telegram-rls, m5-external-rls | PASS — unchanged |
| `apps/app` erase-identity-cli | PASS — 3 |
| Mutation: §2 branch removed → §2 admission fails | PASS (negative) |
| Mutation: `app.erasure_subject` check removed → «refuses a message that is not the subject's» fails | PASS (negative) |
| Script against an absent workspace | PASS (negative) — exit 1, FK message |
| `validate-canonical-docs` | PASS |
| CI run `<id>` | PASS / list |
| The isolated `apps/app` suites locally | NOT RUN — their `beforeEach` truncates the only local database |
| Retention under a real duration in a real environment | NOT PROVEN — no duration has landed |

Run the two mutation checks for real before writing PASS (negative): comment out the branch in a copy of §2, apply, run `-t "admits the exact redaction"`, expect FAIL, restore, apply.

- [ ] **Step 3: Residuals in TODOS.md**

Add under a new heading `## P2 — retention durations are owed (0081 shipped inert)`: the three NULL rows of `app.retention_policy`, the catalog's `duration_external_gate` on rows 3–14, and the two tables with no retention row (`telegram_requirement_choice_sessions`, `telegram_evidence_decision_tokens`, per ADR-011's open items). Add under `## P3 — workspace closure procedure`: M0 gate 4's first box stays open; identity-level erasure exists (README-staging §7).

- [ ] **Step 4: Commit and update the PR**

```bash
git add docs/superpowers/plans/evidence/2026-09-0X-telegram-identity-erasure-gate.md TODOS.md docs/delivery/production-readiness.md
git commit -m "$(cat <<'EOF'
docs(erasure): the gate record, and what this slice leaves owed

The record names every command that was run and the two that were not —
the isolated apps/app suites (they truncate the only local database) and
retention under a real duration (none has landed). TODOS carries the owed
durations and the workspace-closure half of gate 4.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
git push origin claude/d1-telegram-identity-erasure
```

Then edit PR #65's description: replace «plan to follow» with the commit list and the gate record's table.

---

## Self-Review

**Spec coverage.** §2 decisions 1–8 → Tasks 1–6 (1: scope is what the tasks build; 2: Task 4's UPDATEs; 3: Task 6; 4: Tasks 2–3; 5: Tasks 1–7; 6: Task 4's order and marker reset; 7: Task 4's pending count and attachment filenames; 8: the literal in Tasks 2–5). §7.1–7.5 → Tasks 1–5 respectively. §8.1 → Task 6 + Task 7 Step 4. §8.2 → Task 5. §10 → Task 1's revokes, Task 4's HMAC handling, INV-099 in Task 7. §11 → Task 4's refusals and pending count, Task 6's exit codes. §12 → no route anywhere. §13 tests 1–5 → Tasks 4, 2–3, 5, 1 (the `app`-table pins live in §1 rather than in `m5-external-rls`, as Task 1's third case), 6. §14 → the commit sequence and Task 7. §15 → Task 8's record.

**Placeholder scan.** `2026-09-0X` and `<id>` appear where a date or run id is not known at planning time; Task 8 Step 1 and Task 7's Interfaces say how they are filled. No «TBD», no «similar to».

**Type consistency.** `subjectHmac(pepper, workspace, telegramUserId)` — same order in the test file (Task 1), the script (Task 6) and its test. `app.erase_telegram_identity(uuid, bigint, text)` — same in Tasks 4, 6, 7. `app.erase_telegram_identity_internal(uuid, bigint, text, text)` — same in Tasks 4, 5. Return columns `surrogate_user_id, messages, events, links, attachments, pending_updates_for_subject, already_erased` — same in Tasks 4, 6 and the README. Markers `app.erasure_subject` / `app.erasure_surrogate` — same in Tasks 2, 3, 4. The marker literal — one string, copied.

**One thing the executor must not do.** Rewrite the 26-column comparison from memory. Task 2 Step 3's diff against 0070 is the gate.
