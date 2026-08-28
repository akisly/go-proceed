# Telegram Project Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one official Telegram bot that binds one closed group to one draft project, locks Telegram as that project's field channel at activation, mirrors the group into the PTV web app, and turns supported replies to assignment cards into durable GoProceed evidence.

**Architecture:** Telegram is a provider adapter around a normalized, tenant-scoped communication core. Provider updates enter a secret-verified durable inbox, leased workers normalize them, and outbound messages leave through the existing transactional outbox; evidence and decisions reuse shared application services extracted from the current member routes. PostgreSQL and private object storage remain authoritative, while the web app and one closed Telegram group are two views of the same project conversation.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, TypeScript 6, Zod 4.4.3, PostgreSQL/Supabase, `@supabase/supabase-js` 2.112.3, Telegram HTTP Bot API, Vitest 3.2.4, Puppeteer 25.8.0, pnpm/Turbo.

**Spec:** [`docs/superpowers/specs/2026-08-28-telegram-project-channel-design.md`](../specs/2026-08-28-telegram-project-channel-design.md)

## Global Constraints

- One project has zero or one configured field channel while draft, exactly one healthy channel before activation, and no channel or group switch after activation.
- `telegram` is the only accepted channel value in this release; WhatsApp, Viber, Mini Apps, cross-channel routing, and personal bot chats as an operational surface stay absent.
- One official GoProceed bot serves all tenants; one live Telegram group maps to one project and one project maps to one live Telegram group.
- Web replies always return to the same project's Telegram group; there is no recipient or channel picker.
- Only `photo` messages and JPEG, PNG, or HEIC documents are evidence candidates; the Telegram Bot API download ceiling is `20 * 1024 * 1024` bytes.
- A Telegram media group targets one requirement occurrence, but every image gets its own upload intent, SHA-256, evidence object, and receipt.
- Telegram evidence uses `origin_not_distinguished`, null claimed capture time and timezone, and separate provider provenance; no copy may claim a sensor original or camera session.
- A supported image is evidence only when it replies to a live assignment card and the uploader selects one occurrence where needed. No PTV reassociation is added.
- The ordinary HTTP Bot API exposes `edited_message` but no deletion update for an ordinary project-group message. Preserve the last known GoProceed record and never claim live deletion mirroring.
- Webhook and worker routes accept no tenant selector from Telegram. Tenant scope comes only from a persisted chat binding or a single-use keyed verifier.
- Bot token, webhook secret, worker secret, link pepper, raw one-time tokens, signed storage URLs, raw storage keys, full chat text, and evidence bytes never enter logs or metrics.
- Raw webhook JSON may exist only in the durable inbox until normalized processing finishes; then the payload is cleared while its hash and disposition remain.
- Public Ukrainian copy is direct and factual. Statuses must distinguish provider acceptance from human reading and evidence processing from durable evidence availability.
- Existing dirty-worktree content outside files named in a task belongs to the user and must not be staged, changed, or deleted.
- Every task follows red-green-refactor, ends with focused tests plus relevant typechecks, and creates one reviewable commit.

---

## File and module map

### Contracts and catalogs

- `packages/contracts/src/projects.ts` — project lifecycle and field-channel request/response contracts.
- `packages/contracts/src/project-communications.ts` — normalized communication, binding, link, page, reply, card, and health contracts.
- `packages/contracts/src/index.ts` — exports the new contract surface.
- `packages/contracts/src/project-access.ts` and `packages/domain/src/authz.ts` — the new `communication.reply` capability vocabulary.
- `technical/openapi/scope-v0.1.csv`, `technical/openapi.yaml`, permission/state/entity/relationship/event/copy/test/retention/access catalogs — canonical records for every new operation, state, table, event, and user-facing label.

### Database

- `supabase/migrations/0061_the_project_chooses_one_channel.sql` — applied project status, field-channel row, immutable activation, and capability widening.
- `supabase/migrations/0062_the_group_becomes_a_project_conversation.sql` — Telegram bindings, link intents, inbox, normalized messages/events/attachments/media groups/deliveries, RLS, grants, and leased claim functions.
- `technical/database/schema-v0.1.sql` — canonical schema synchronized with both migrations.

### Telegram provider adapter

- `apps/app/src/lib/telegram/config.ts` — validated server-only environment.
- `apps/app/src/lib/telegram/types.ts` — narrow provider DTOs and normalized discriminated unions.
- `apps/app/src/lib/telegram/normalize.ts` — pure update normalization and command redaction.
- `apps/app/src/lib/telegram/api.ts` — `fetch`-based Bot API client and safe error classification.
- `apps/app/src/lib/telegram/tokens.ts` — random one-time tokens and keyed verifiers.
- `apps/app/src/lib/telegram/ingress.ts` — secret verification, inbox acceptance, and deduplication.
- `apps/app/src/lib/telegram/processor.ts` — leased inbox processing and normalized chat writes.
- `apps/app/src/lib/telegram/delivery.ts` — leased outbox delivery and `delivery_unknown` handling.
- `apps/app/src/lib/telegram/cards.ts` — escaped Ukrainian assignment-card and receipt formatting.
- `apps/app/src/lib/telegram/evidence.ts` — provider download, occurrence choice, shared upload/finalize calls, and per-image outcome.
- `apps/app/src/lib/telegram/decisions.ts` — callback-to-shared-decision adapter.

### Application services and routes

- `apps/app/src/lib/evidence/authorize-upload-intent.ts` and `finalize-upload-intent.ts` — one shared evidence path for HTTP clients and Telegram.
- `apps/app/src/lib/evidence/record-evidence-decision.ts` — one shared decision path for HTTP and Telegram.
- `apps/app/app/integrations/telegram/webhook/route.ts` — fast provider-authenticated inbox endpoint.
- `apps/app/app/internal/telegram/jobs/route.ts` — secret-authenticated bounded inbox/outbox worker invocation.
- `apps/app/app/v1/projects/[projectId]/field-channel/route.ts` — draft channel configuration and health read.
- `apps/app/app/v1/projects/[projectId]/activate/route.ts` — activation and lock.
- `apps/app/app/v1/projects/[projectId]/telegram/binding-intents/route.ts` — group connection intent.
- `apps/app/app/v1/projects/[projectId]/telegram/member-link-intents/route.ts` — member identity-link intent.
- `apps/app/app/v1/projects/[projectId]/communications/route.ts` — cursor-paginated timeline and web reply.
- `apps/app/app/v1/assignments/[assignmentId]/communication-card/route.ts` — idempotent assignment-card publication.

### Web app

- `apps/app/app/dash/projects/new/page.tsx` and `apps/app/src/components/projects/project-create-form.tsx` — draft project creation with Telegram selection.
- `apps/app/app/dash/projects/[projectId]/communication/page.tsx` — thin project communication route.
- `apps/app/src/services/project-communication.service.ts` — typed member-plane reads and commands.
- `apps/app/src/components/communication/*` — channel status, timeline, message, attachment, composer, filters, and explicit decision controls.
- `apps/app/src/components/projects/project-overview-header.tsx` and dashboard navigation — communication entry point and immutable channel label.

### Test and operations support

- `apps/app/tests/helpers/fake-telegram.ts` — deterministic fake Bot API server/fetch adapter.
- `apps/app/tests/project-channel.int.test.ts`, `telegram-bindings.int.test.ts`, `telegram-ingress.int.test.ts`, `telegram-processing.int.test.ts`, `telegram-evidence.int.test.ts`, `telegram-delivery.int.test.ts`, and `project-communications.int.test.ts` — database-backed vertical tests.
- `apps/app/qa/telegram-project.mjs` — browser plus real/stub Telegram acceptance walk.
- `apps/app/scripts/configure-telegram-webhook.mjs` — explicit webhook registration/check command.
- `infra/README-staging.md` and `apps/app/.env.example` — required secrets, worker schedule, webhook configuration, and rollback procedure.

---

### Task 1: Project lifecycle, field-channel lock, and permission vocabulary

**Files:**
- Create: `supabase/migrations/0061_the_project_chooses_one_channel.sql`
- Create: `apps/app/app/v1/projects/[projectId]/field-channel/route.ts`
- Create: `apps/app/app/v1/projects/[projectId]/activate/route.ts`
- Create: `apps/app/tests/project-channel.int.test.ts`
- Modify: `packages/contracts/src/projects.ts`
- Modify: `packages/contracts/src/project-access.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/domain/src/authz.ts`
- Modify: `apps/app/app/v1/workspaces/[workspaceId]/projects/route.ts`
- Modify: `apps/app/app/v1/projects/route.ts`
- Modify: `packages/testing/src/capability-vocabulary.test.ts`
- Modify: `technical/permissions/capabilities.csv`
- Modify: `technical/permissions/responsibility-presets.csv`
- Modify: `technical/openapi/scope-v0.1.csv`
- Modify: `technical/states/state-catalog.csv`
- Modify: `technical/states/transition-catalog.csv`
- Modify: `technical/database/schema-v0.1.sql`

**Interfaces:**
- Produces: `projectStatus`, `fieldCommunicationChannel`, `configureProjectFieldChannelRequest`, `activateProjectRequest`, `ProjectFieldChannelResponse`.
- Produces: `communication.reply` in all three enforced capability vocabularies.
- Produces: `POST/GET /v1/projects/{projectId}/field-channel` and `POST /v1/projects/{projectId}/activate`.
- Consumes: existing `project.admin`, `project.view`, `commandRoute`, `queryRoute`, idempotency, audit, and project RLS patterns.

- [ ] **Step 1: Write contract tests for the lifecycle and capability**

```ts
import { describe, expect, it } from "vitest";
import {
  activateProjectRequest,
  configureProjectFieldChannelRequest,
  createProjectRequest,
  projectStatus,
  projectCapability,
} from "./index";

describe("project field channel", () => {
  it("accepts only Telegram and explicit activation version", () => {
    expect(createProjectRequest.parse({ name: "ЖК Річковий" })).toEqual({ name: "ЖК Річковий" });
    expect(configureProjectFieldChannelRequest.parse({ channel: "telegram", expectedVersion: 1 }))
      .toEqual({ channel: "telegram", expectedVersion: 1 });
    expect(activateProjectRequest.parse({ expectedVersion: 1 })).toEqual({ expectedVersion: 1 });
    expect(projectStatus.options).toEqual(["draft", "active", "archived"]);
    expect(projectCapability.options).toContain("communication.reply");
  });
});
```

- [ ] **Step 2: Run the contract test and verify the new exports are absent**

Run: `pnpm --filter @goproceed/contracts test -- project-channel`

Expected: FAIL because the lifecycle/channel schemas and capability do not exist.

- [ ] **Step 3: Add the exact contract vocabulary**

```ts
export const projectStatus = z.enum(["draft", "active", "archived"]);
export const fieldCommunicationChannel = z.literal("telegram");
export const configureProjectFieldChannelRequest = z.object({
  channel: fieldCommunicationChannel,
  expectedVersion: z.number().int().positive(),
}).strict();
export const activateProjectRequest = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();
export const projectFieldChannelResponse = z.object({
  projectId: z.string().guid(),
  projectStatus,
  channel: fieldCommunicationChannel.nullable(),
  channelState: z.enum(["unbound", "connected", "active", "unhealthy", "archived"]).nullable(),
  lockedAt: z.string().datetime().nullable(),
  version: z.number().int().positive(),
}).strict();
```

Add `communication.reply` to `projectCapability`, `ProjectCapability`, the
database CHECK, capabilities catalog, and the PTV/project-manager presets in
the same task so `capability-vocabulary.test.ts` cannot observe a split state.

- [ ] **Step 4: Write the migration test cases before the migration**

```ts
it("backfills legacy projects active without inventing a channel", async () => {
  const rows = await q<{ status: string; channel: string | null }>(`
    select p.status, c.channel
    from public.projects p
    left join public.project_field_channels c on c.workspace_id=p.workspace_id and c.project_id=p.id
    where p.id=$1`, [legacyProjectId]);
  expect(rows[0]).toEqual({ status: "active", channel: null });
});

it("refuses to activate a draft without a connected channel", async () => {
  const response = await activate(projectId, { expectedVersion: 1 });
  expect(response.status).toBe(409);
  expect((await response.json()).code).toBe("VERSION_CONFLICT");
});
```

- [ ] **Step 5: Run the project-channel integration test and verify schema failure**

Run: `pnpm --filter @goproceed/app test -- project-channel.int.test.ts`

Expected: FAIL because `projects.status` and `project_field_channels` are absent.

- [ ] **Step 6: Implement migration 0061 and the two member routes**

```sql
create type public.project_status as enum ('draft','active','archived');
create type public.field_communication_channel as enum ('telegram');
create type public.project_field_channel_state as enum
  ('unbound','connected','active','unhealthy','archived');

alter table public.projects
  add column status public.project_status not null default 'active';

create table public.project_field_channels (
  workspace_id uuid not null,
  project_id uuid not null,
  channel public.field_communication_channel not null,
  state public.project_field_channel_state not null default 'unbound',
  locked_at timestamptz,
  locked_by_member_id uuid,
  last_healthy_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, project_id),
  foreign key (workspace_id, project_id)
    references public.projects(workspace_id, id),
  check ((locked_at is null and locked_by_member_id is null)
      or (locked_at is not null and locked_by_member_id is not null))
);
```

The create route inserts `projects.status='draft'`. The configure route permits
insert/change only for a draft project with an unbound row and matching version.
The activate route requires `state='connected'`, advances project and channel to
`active`, sets `locked_at/locked_by_member_id`, records audit, and emits
`project.activated` in one idempotent transaction.

- [ ] **Step 7: Synchronize the canonical catalogs and schema**

Add operations `project_field_channel.configure`, `project_field_channel.get`,
and `projects.activate`; add project/channel states and transitions; record
`communication.reply` and its presets; add the `project.activated` event. Run:

`node scripts/validate-canonical-docs.mjs`

Expected: PASS with no unknown operation, state, capability, or table reference.

- [ ] **Step 8: Run focused tests and typechecks**

Run:

```bash
pnpm --filter @goproceed/contracts test
pnpm --filter @goproceed/testing test -- capability-vocabulary.test.ts
pnpm --filter @goproceed/app test -- project-channel.int.test.ts projects.int.test.ts
pnpm --filter @goproceed/contracts typecheck
pnpm --filter @goproceed/app typecheck
```

Expected: all PASS. Existing project fixtures continue because application
routes explicitly create drafts while the database default preserves legacy
direct inserts as active/channel-less.

- [ ] **Step 9: Commit the lifecycle slice**

```bash
git add -- supabase/migrations/0061_the_project_chooses_one_channel.sql packages/contracts/src/projects.ts packages/contracts/src/project-access.ts packages/contracts/src/index.ts packages/domain/src/authz.ts packages/testing/src/capability-vocabulary.test.ts 'apps/app/app/v1/workspaces/[workspaceId]/projects/route.ts' apps/app/app/v1/projects/route.ts 'apps/app/app/v1/projects/[projectId]/field-channel/route.ts' 'apps/app/app/v1/projects/[projectId]/activate/route.ts' apps/app/tests/project-channel.int.test.ts technical/permissions/capabilities.csv technical/permissions/responsibility-presets.csv technical/openapi/scope-v0.1.csv technical/states/state-catalog.csv technical/states/transition-catalog.csv technical/database/schema-v0.1.sql
git commit -m "feat(projects): lock one field channel at activation"
```

### Task 2: Tenant-scoped communication and Telegram persistence

**Files:**
- Create: `supabase/migrations/0062_the_group_becomes_a_project_conversation.sql`
- Create: `packages/contracts/src/project-communications.ts`
- Create: `apps/app/tests/telegram-schema.int.test.ts`
- Create: `packages/testing/src/telegram-rls.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `technical/database/schema-v0.1.sql`
- Modify: `technical/database/entity-catalog.csv`
- Modify: `technical/database/relationship-catalog.csv`
- Modify: `technical/database/invariant-catalog.csv`
- Modify: `technical/data-access-surface.csv`
- Modify: `technical/data-retention-catalog.csv`
- Modify: `technical/states/state-catalog.csv`
- Modify: `technical/test-catalog.csv`

**Interfaces:**
- Produces tables: `telegram_chat_bindings`, `telegram_binding_intents`, `telegram_member_link_intents`, `telegram_member_links`, `telegram_inbox_updates`, `communication_messages`, `communication_message_events`, `communication_attachments`, `telegram_media_groups`, `telegram_requirement_choices`, `communication_delivery_attempts`.
- Produces database functions: `app.resolve_telegram_chat`, `app.consume_telegram_binding_intent`, `app.consume_telegram_member_link_intent`, `app.claim_telegram_inbox`, `app.complete_telegram_inbox`, `app.fail_telegram_inbox`, and `app.claim_outbox_topic`.
- Produces normalized public contract types used by Tasks 3–13.

- [ ] **Step 1: Write strict communication contract tests**

```ts
it("parses a normalized message page without provider secrets", () => {
  const page = projectCommunicationPage.parse({
    messages: [{
      messageId: crypto.randomUUID(), direction: "inbound", kind: "text",
      author: { memberId: null, displayName: "Іван", verified: false },
      text: "Роботу завершено", replyToMessageId: null, providerSentAt: null,
      serverReceivedAt: new Date().toISOString(), deliveryState: "received",
      attachments: [],
    }],
    nextCursor: null,
  });
  expect(JSON.stringify(page)).not.toContain("file_id");
  expect(JSON.stringify(page)).not.toContain("bot_token");
});
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `pnpm --filter @goproceed/contracts test -- project-communications`

Expected: FAIL because `projectCommunicationPage` is absent.

- [ ] **Step 3: Define normalized contracts**

```ts
export const communicationDirection = z.enum(["inbound", "outbound", "system"]);
export const communicationDeliveryState = z.enum([
  "received", "queued", "provider_accepted", "failed", "delivery_unknown",
]);
export const communicationAttachmentState = z.enum([
  "unbound", "awaiting_requirement_choice", "processing", "available",
  "not_evidence", "failed",
]);
export const postProjectCommunicationRequest = z.object({
  text: z.string().trim().min(1).max(4096),
  replyToMessageId: z.string().guid().optional(),
}).strict();
```

Define `ProjectCommunicationMessage`, `ProjectCommunicationPage`,
`TelegramBindingIntentResponse`, `TelegramMemberLinkIntentResponse`,
`ProjectFieldChannelHealth`, and assignment-card response types with no raw
provider token or file handle on the member plane.

- [ ] **Step 4: Write schema, constraint, and RLS failures first**

```ts
it("one live Telegram group cannot bind across tenants", async () => {
  await insertBinding(workspaceA, projectA, "-100123");
  await expect(insertBinding(workspaceB, projectB, "-100123"))
    .rejects.toMatchObject({ code: "23505" });
});

it("a member with no project.view cannot read communication", async () => {
  const visible = await asAppUser(unrelatedUser, workspaceA,
    "select id from public.communication_messages where project_id=$1", [projectA]);
  expect(visible.rows).toEqual([]);
});
```

- [ ] **Step 5: Run schema tests and verify tables are absent**

Run:

```bash
pnpm --filter @goproceed/app test -- telegram-schema.int.test.ts
pnpm --filter @goproceed/testing test -- telegram-rls.test.ts
```

Expected: FAIL on missing communication tables/functions.

- [ ] **Step 6: Implement migration 0062 with complete identities and constraints**

Use decimal strings at TypeScript boundaries and PostgreSQL `bigint` for
Telegram ids. Make provider identity unique without using display names:

```sql
create table public.telegram_chat_bindings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  bot_id bigint not null,
  chat_id bigint not null,
  chat_type text not null check (chat_type in ('group','supergroup')),
  title_snapshot text,
  connected_by_member_id uuid not null,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  migrated_from_chat_id bigint,
  unique (bot_id, chat_id),
  unique (workspace_id, project_id),
  foreign key (workspace_id, project_id)
    references public.project_field_channels(workspace_id, project_id)
);

create table public.telegram_inbox_updates (
  bot_id bigint not null,
  update_id bigint not null,
  payload jsonb,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('pending','leased','processed','failed')),
  available_at timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz,
  attempts integer not null default 0,
  disposition text,
  last_error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (bot_id, update_id),
  check (state <> 'processed' or payload is null)
);
```

Apply the same explicit composite tenant foreign keys to every table. Message
originals are immutable; edits are append-only events. Provider file handles
are restricted to the service plane and cleared after terminal processing.

- [ ] **Step 7: Add leased SECURITY DEFINER functions and least-privilege grants**

`app.claim_telegram_inbox(batch, worker, lease_seconds)` must use
`FOR UPDATE SKIP LOCKED`, increment attempts, and return only due rows.
`app.complete_telegram_inbox(bot_id, update_id, lease_id, disposition)` clears
`payload`. `app.claim_outbox_topic(topic, batch, worker, lease_seconds)` must
never claim another consumer's topic. Revoke all functions from
`PUBLIC/anon/authenticated`; grant only to the service role used by the internal
worker.

- [ ] **Step 8: Synchronize schema and data-governance catalogs**

Record every entity, relationship, invariant, retention class, RLS surface,
state, and test. The retention row must classify message text and provider user
ids as customer data and must not invent a duration before the existing M0
schedule is approved.

- [ ] **Step 9: Run schema, RLS, canonical, and type checks**

Run:

```bash
pnpm --filter @goproceed/contracts test
pnpm --filter @goproceed/app test -- telegram-schema.int.test.ts
pnpm --filter @goproceed/testing test -- telegram-rls.test.ts
node scripts/validate-canonical-docs.mjs
pnpm --filter @goproceed/contracts typecheck
```

Expected: all PASS, including a sweep showing an unrelated member and an
anonymous transaction cannot enumerate communication rows.

- [ ] **Step 10: Commit the persistence slice**

```bash
git add -- supabase/migrations/0062_the_group_becomes_a_project_conversation.sql packages/contracts/src/project-communications.ts packages/contracts/src/index.ts apps/app/tests/telegram-schema.int.test.ts packages/testing/src/telegram-rls.test.ts technical/database/schema-v0.1.sql technical/database/entity-catalog.csv technical/database/relationship-catalog.csv technical/database/invariant-catalog.csv technical/data-access-surface.csv technical/data-retention-catalog.csv technical/states/state-catalog.csv technical/test-catalog.csv
git commit -m "feat(communication): add tenant-scoped Telegram persistence"
```

### Task 3: Pure Telegram configuration, API client, and normalization

**Files:**
- Create: `apps/app/src/lib/telegram/config.ts`
- Create: `apps/app/src/lib/telegram/types.ts`
- Create: `apps/app/src/lib/telegram/normalize.ts`
- Create: `apps/app/src/lib/telegram/normalize.test.ts`
- Create: `apps/app/src/lib/telegram/api.ts`
- Create: `apps/app/src/lib/telegram/api.test.ts`
- Create: `apps/app/tests/helpers/fake-telegram.ts`
- Modify: `apps/app/.env.example`

**Interfaces:**
- Produces: `TelegramConfig`, `loadTelegramConfig()`, `TelegramApiClient`, `createTelegramApiClient()`, `normalizeTelegramUpdate()`, `NormalizedTelegramUpdate`.
- Consumes: Bot API `Update`, `Message`, `CallbackQuery`, `getFile`, `sendMessage`, `answerCallbackQuery`, and `setWebhook` shapes only.

- [ ] **Step 1: Write normalization tests for supported update kinds**

```ts
it.each([
  [messageFixture, "message"],
  [editedMessageFixture, "edited_message"],
  [callbackFixture, "callback_query"],
  [membershipFixture, "my_chat_member"],
] as const)("normalizes %s", (input, kind) => {
  expect(normalizeTelegramUpdate(input).kind).toBe(kind);
});

it("redacts /start and /startgroup payloads from normalized text", () => {
  const normalized = normalizeTelegramUpdate(startGroupFixture("secret-token"));
  expect(JSON.stringify(normalized)).not.toContain("secret-token");
});
```

- [ ] **Step 2: Run normalization tests and verify failure**

Run: `pnpm --filter @goproceed/app test -- src/lib/telegram/normalize.test.ts`

Expected: FAIL because the adapter modules do not exist.

- [ ] **Step 3: Define a narrow discriminated union**

```ts
export type NormalizedTelegramUpdate =
  | { kind: "message"; updateId: string; chatId: string; chatType: "group" | "supergroup" | "private"; messageId: string; senderId: string; sentAt: string; text: string | null; replyToMessageId: string | null; mediaGroupId: string | null; files: TelegramFileCandidate[]; command: TelegramStartCommand | null }
  | { kind: "edited_message"; updateId: string; chatId: string; messageId: string; editedAt: string; text: string | null }
  | { kind: "callback_query"; updateId: string; callbackId: string; senderId: string; chatId: string | null; messageId: string | null; data: string | null }
  | { kind: "my_chat_member"; updateId: string; chatId: string; newStatus: string }
  | { kind: "unsupported"; updateId: string; reason: string };
```

Represent Telegram ids as decimal strings in TypeScript. Do not add an ordinary
message-deletion variant because Bot API `Update` has none.

- [ ] **Step 4: Write API client tests against the fake fetch adapter**

```ts
it("classifies a timeout after dispatch as delivery_unknown", async () => {
  const client = createTelegramApiClient(config, timeoutAfterAcceptingFetch());
  await expect(client.sendMessage({ chatId: "-1001", text: "Тест" }))
    .rejects.toMatchObject({ kind: "delivery_unknown" });
});

it("refuses a getFile result above 20 MiB", async () => {
  const client = createTelegramApiClient(config, fakeTelegramFetch({ fileSize: 20 * 1024 * 1024 + 1 }));
  await expect(client.downloadFile("file-id"))
    .rejects.toMatchObject({ kind: "provider_limit" });
});
```

- [ ] **Step 5: Implement validated server-only config**

```ts
const telegramConfigSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(20),
  TELEGRAM_BOT_ID: z.string().regex(/^\d+$/),
  TELEGRAM_BOT_USERNAME: z.string().regex(/^[A-Za-z0-9_]{5,}$/),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(32),
  TELEGRAM_WORKER_SECRET: z.string().min(32),
  TELEGRAM_LINK_PEPPER: z.string().min(32),
  APP_PUBLIC_ORIGIN: z.string().url().startsWith("https://"),
}).strict();
```

Load lazily inside server functions so ordinary tests and builds that do not
execute Telegram code do not require production secrets.

- [ ] **Step 6: Implement the fetch-based client and safe errors**

Use `POST https://api.telegram.org/bot{token}/{method}` and
`GET https://api.telegram.org/file/bot{token}/{path}` internally, but never put
either URL in an error. Return provider message ids on success. A received
`ok:false`, 429, or 5xx is a definite provider response; a thrown network error
after `fetch` begins is `delivery_unknown` for sends.

- [ ] **Step 7: Run focused tests and typecheck**

Run:

```bash
pnpm --filter @goproceed/app test -- src/lib/telegram/normalize.test.ts src/lib/telegram/api.test.ts
pnpm --filter @goproceed/app typecheck
```

Expected: PASS with no token, file URL, or command token in snapshots/errors.

- [ ] **Step 8: Commit the provider adapter**

```bash
git add -- apps/app/src/lib/telegram/config.ts apps/app/src/lib/telegram/types.ts apps/app/src/lib/telegram/normalize.ts apps/app/src/lib/telegram/normalize.test.ts apps/app/src/lib/telegram/api.ts apps/app/src/lib/telegram/api.test.ts apps/app/tests/helpers/fake-telegram.ts apps/app/.env.example
git commit -m "feat(telegram): add safe Bot API adapter"
```

### Task 4: Group binding and member identity linking

**Files:**
- Create: `apps/app/src/lib/telegram/tokens.ts`
- Create: `apps/app/src/lib/telegram/tokens.test.ts`
- Create: `apps/app/src/lib/telegram/linking.ts`
- Create: `apps/app/app/v1/projects/[projectId]/telegram/binding-intents/route.ts`
- Create: `apps/app/app/v1/projects/[projectId]/telegram/member-link-intents/route.ts`
- Create: `apps/app/tests/telegram-bindings.int.test.ts`
- Modify: `technical/openapi/scope-v0.1.csv`
- Modify: `technical/openapi.yaml`
- Modify: `technical/copy-catalog.csv`

**Interfaces:**
- Produces: `issueTelegramToken()`, `telegramVerifier(raw, pepper)`, `consumeBindingCommand()`, `consumeMemberLinkCommand()`.
- Produces: short-lived `startgroup` URL and private `start` URL; raw tokens appear only in the immediate member response.
- Consumes: `project.admin` for group binding; self/current membership for member linking.

- [ ] **Step 1: Write token tests**

```ts
it("issues URL-safe 256-bit tokens and stable keyed verifiers", () => {
  const raw = issueTelegramToken();
  expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(telegramVerifier(raw, "p".repeat(32))).toMatch(/^[0-9a-f]{64}$/);
  expect(telegramVerifier(raw, "p".repeat(32))).not.toContain(raw);
});
```

- [ ] **Step 2: Run token tests and verify failure**

Run: `pnpm --filter @goproceed/app test -- src/lib/telegram/tokens.test.ts`

Expected: FAIL because token helpers do not exist.

- [ ] **Step 3: Implement token generation and constant-time comparison**

```ts
export function issueTelegramToken(): string {
  return randomBytes(32).toString("base64url");
}

export function telegramVerifier(raw: string, pepper: string): string {
  return createHmac("sha256", pepper).update(raw, "utf8").digest("hex");
}
```

Consumption computes the candidate verifier and lets the single-row database
function atomically check expiry, consume once, and create the binding/link.

- [ ] **Step 4: Write route and consumption failures first**

```ts
it("consumes a group-binding token exactly once", async () => {
  const issued = await createBindingIntent(projectId);
  expect((await consumeStartGroup(issued.rawToken, "-100123", adminTelegramId)).kind)
    .toBe("connected");
  expect((await consumeStartGroup(issued.rawToken, "-100999", adminTelegramId)).kind)
    .toBe("invalid_or_expired");
});

it("does not link a Telegram id to an inactive membership", async () => {
  await endMembership(memberId);
  expect((await consumeMemberStart(rawToken, telegramUserId)).kind)
    .toBe("membership_inactive");
});
```

- [ ] **Step 5: Run binding tests and verify route/function failures**

Run: `pnpm --filter @goproceed/app test -- telegram-bindings.int.test.ts`

Expected: FAIL because intent routes and consumption services are absent.

- [ ] **Step 6: Implement member routes and consumption services**

Binding intent: 15-minute expiry, `project.admin`, draft project, Telegram
channel, no live binding. Member link intent: 15-minute expiry, current active
membership, exact project/workspace context. Responses use:

```ts
{
  expiresAt,
  telegramUrl: `https://t.me/${botUsername}?startgroup=${rawToken}`,
}
```

and

```ts
{
  expiresAt,
  telegramUrl: `https://t.me/${botUsername}?start=${rawToken}`,
}
```

Never write either raw token to audit/outbox/logs. Audit only the intent id,
project, member, expiry, and later consumption result.

- [ ] **Step 7: Update API/copy catalogs and run validation**

Add `telegram_binding_intents.create` and `telegram_member_link_intents.create`
with command/idempotency/member ownership, plus Ukrainian expired/already-used,
wrong-group-type, and membership-inactive copy.

Run: `node scripts/validate-canonical-docs.mjs`

Expected: PASS.

- [ ] **Step 8: Run focused tests and commit**

```bash
pnpm --filter @goproceed/app test -- src/lib/telegram/tokens.test.ts telegram-bindings.int.test.ts
pnpm --filter @goproceed/app typecheck
git add -- apps/app/src/lib/telegram/tokens.ts apps/app/src/lib/telegram/tokens.test.ts apps/app/src/lib/telegram/linking.ts 'apps/app/app/v1/projects/[projectId]/telegram/binding-intents/route.ts' 'apps/app/app/v1/projects/[projectId]/telegram/member-link-intents/route.ts' apps/app/tests/telegram-bindings.int.test.ts technical/openapi/scope-v0.1.csv technical/openapi.yaml technical/copy-catalog.csv
git commit -m "feat(telegram): bind groups and member identities"
```

### Task 5: Secret-verified durable webhook ingress

**Files:**
- Create: `apps/app/src/lib/telegram/ingress.ts`
- Create: `apps/app/src/lib/telegram/ingress.test.ts`
- Create: `apps/app/app/integrations/telegram/webhook/route.ts`
- Create: `apps/app/tests/telegram-ingress.int.test.ts`
- Modify: `apps/app/proxy.ts`
- Modify: `apps/app/tests/proxy-cors.test.ts`
- Modify: `technical/openapi/scope-v0.1.csv`
- Modify: `technical/openapi.yaml`
- Modify: `technical/rate-limits.csv`
- Modify: `technical/error-catalog.csv`

**Interfaces:**
- Produces: `verifyTelegramWebhookSecret(req, expected)`, `acceptTelegramUpdate(req)`, `POST /integrations/telegram/webhook`.
- Consumes: `normalizeTelegramUpdate` only for bounded validation/redaction metadata; durable raw payload is cleared after Task 6 processing.

- [ ] **Step 1: Write secret and body-bound tests**

```ts
it("rejects before JSON parsing when the Telegram secret is wrong", async () => {
  const response = await webhook(request({ secret: "wrong", body: "{" }));
  expect(response.status).toBe(401);
});

it("accepts a duplicate update without a second inbox row", async () => {
  expect((await webhook(validUpdate(42))).status).toBe(200);
  expect((await webhook(validUpdate(42))).status).toBe(200);
  expect(await countInbox(42)).toBe(1);
});
```

- [ ] **Step 2: Run ingress tests and verify failure**

Run: `pnpm --filter @goproceed/app test -- telegram-ingress.int.test.ts`

Expected: FAIL because the public integration route is absent.

- [ ] **Step 3: Implement constant-time secret verification and a 1 MiB body ceiling**

```ts
const MAX_TELEGRAM_UPDATE_BYTES = 1024 * 1024;
const HEADER = "x-telegram-bot-api-secret-token";

export function sameSecret(actual: string | null, expected: string): boolean {
  if (actual === null) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Check both declared and actual byte length, validate `update_id`, hash the exact
raw body, insert pending with `ON CONFLICT DO NOTHING`, and return `200` after
the durable transaction. Do not download files or send Telegram messages in the
webhook response.

- [ ] **Step 4: Exclude `/integrations` from member-session proxying**

Add the segment beside existing `/v1` and `/external` exclusions. Extend the
proxy test to prove `/integrations/telegram/webhook` is not redirected to login
while `/dash/**` still is.

- [ ] **Step 5: Add route/rate/error catalog rows**

Record provider authentication, 1 MiB, request rate, duplicate semantics, and
safe 401/413/422 responses. The public route returns no tenant detail.

- [ ] **Step 6: Run focused tests, canonical validation, and typecheck**

```bash
pnpm --filter @goproceed/app test -- src/lib/telegram/ingress.test.ts telegram-ingress.int.test.ts proxy-cors.test.ts
node scripts/validate-canonical-docs.mjs
pnpm --filter @goproceed/app typecheck
```

Expected: PASS; malformed JSON with a wrong secret still returns 401 rather than
revealing parser behaviour.

- [ ] **Step 7: Commit the ingress slice**

```bash
git add -- apps/app/src/lib/telegram/ingress.ts apps/app/src/lib/telegram/ingress.test.ts apps/app/app/integrations/telegram/webhook/route.ts apps/app/tests/telegram-ingress.int.test.ts apps/app/proxy.ts apps/app/tests/proxy-cors.test.ts technical/openapi/scope-v0.1.csv technical/openapi.yaml technical/rate-limits.csv technical/error-catalog.csv
git commit -m "feat(telegram): accept signed updates into a durable inbox"
```

### Task 6: Leased Telegram processor and normalized project history

**Files:**
- Create: `apps/app/src/lib/telegram/processor.ts`
- Create: `apps/app/src/lib/telegram/processor.test.ts`
- Create: `apps/app/app/internal/telegram/jobs/route.ts`
- Create: `apps/app/tests/telegram-processing.int.test.ts`
- Modify: `apps/app/proxy.ts`
- Modify: `apps/app/tests/proxy-cors.test.ts`
- Modify: `technical/events/event-catalog.csv`
- Modify: `technical/copy-catalog.csv`

**Interfaces:**
- Produces: `processTelegramInboxBatch({ workerId, limit })`, `processTelegramUpdate(update)`, secret-authenticated `POST /internal/telegram/jobs`.
- Consumes: Task 2 lease functions, Task 3 normalized union, Task 4 binding/link consumers.
- Produces normalized communication messages/events but no evidence yet.

- [ ] **Step 1: Write processor behaviour tests**

```ts
it("stores an unlinked group author as unverified communication", async () => {
  await enqueueTelegramUpdate(groupTextUpdate({ senderId: "77", text: "Готово" }));
  await processTelegramInboxBatch({ workerId: "test", limit: 10 });
  const row = await lastMessage(projectId);
  expect(row).toMatchObject({ text: "Готово", sender_member_id: null, author_verified: false });
});

it("clears processed raw payload and preserves its hash", async () => {
  await processTelegramInboxBatch({ workerId: "test", limit: 10 });
  expect(await inboxRow(updateId)).toMatchObject({ state: "processed", payload: null });
});
```

- [ ] **Step 2: Run processor tests and verify failure**

Run: `pnpm --filter @goproceed/app test -- telegram-processing.int.test.ts`

Expected: FAIL because no worker or processor exists.

- [ ] **Step 3: Implement bounded claim/process/complete flow**

```ts
export async function processTelegramInboxBatch(input: {
  workerId: string; limit: number;
}): Promise<{ claimed: number; processed: number; failed: number }> {
  const claimed = await claimTelegramInbox(input);
  const result = { claimed: claimed.length, processed: 0, failed: 0 };
  for (const item of claimed) {
    try {
      const disposition = await processTelegramUpdate(normalizeTelegramUpdate(item.payload));
      await completeTelegramInbox(item, disposition);
      result.processed += 1;
    } catch (error) {
      await failTelegramInbox(item, safeTelegramProcessingCode(error));
      result.failed += 1;
    }
  }
  return result;
}
```

`/startgroup` and private `/start` commands call Task 4 consumers and are never
stored as chat text. Unknown groups produce a safe disposition and no tenant
row. Known groups store messages under the exact binding. Edited messages append
events and leave original content immutable.

- [ ] **Step 4: Implement secret-authenticated internal invocation**

The route accepts `{ inboxLimit, outboxLimit }`, each `1..100`, verifies
`Authorization: Bearer ${TELEGRAM_WORKER_SECRET}` before JSON parsing, and
returns only counts and safe codes. Exclude `/internal` from session proxying;
the worker secret, not a user cookie, authenticates this route.

- [ ] **Step 5: Add health processing for bot membership changes**

`my_chat_member` transitions to `left/kicked` set channel `unhealthy` and append
an event. Restoration in the same bound chat may return it to `active` or
`connected`; it never clears `locked_at` or changes `chat_id`.

- [ ] **Step 6: Run focused processing and proxy tests**

```bash
pnpm --filter @goproceed/app test -- src/lib/telegram/processor.test.ts telegram-processing.int.test.ts proxy-cors.test.ts
pnpm --filter @goproceed/app typecheck
```

Expected: PASS including duplicate claims, expired leases, unknown chats,
start-token redaction, unlinked authors, edits, and bot removal/restoration.

- [ ] **Step 7: Commit the processor slice**

```bash
git add -- apps/app/src/lib/telegram/processor.ts apps/app/src/lib/telegram/processor.test.ts apps/app/app/internal/telegram/jobs/route.ts apps/app/tests/telegram-processing.int.test.ts apps/app/proxy.ts apps/app/tests/proxy-cors.test.ts technical/events/event-catalog.csv technical/copy-catalog.csv
git commit -m "feat(telegram): normalize updates into project history"
```

### Task 7: Transactional outbound delivery and assignment cards

**Files:**
- Create: `apps/app/src/lib/telegram/cards.ts`
- Create: `apps/app/src/lib/telegram/cards.test.ts`
- Create: `apps/app/src/lib/telegram/delivery.ts`
- Create: `apps/app/src/lib/telegram/delivery.test.ts`
- Create: `apps/app/app/v1/assignments/[assignmentId]/communication-card/route.ts`
- Create: `apps/app/tests/telegram-delivery.int.test.ts`
- Modify: `apps/app/src/lib/telegram/processor.ts`
- Modify: `apps/app/app/internal/telegram/jobs/route.ts`
- Modify: `technical/events/event-catalog.csv`
- Modify: `technical/openapi/scope-v0.1.csv`
- Modify: `technical/openapi.yaml`
- Modify: `technical/copy-catalog.csv`

**Interfaces:**
- Produces: `formatAssignmentCard()`, `formatTelegramReceipt()`, `enqueueTelegramMessage()`, `deliverTelegramOutboxBatch()`.
- Produces: `POST /v1/assignments/{assignmentId}/communication-card` governed by `assignments.manage`.
- Consumes: `app.claim_outbox_topic('communication.telegram.send', ...)`, `TelegramApiClient.sendMessage()`.

- [ ] **Step 1: Write escaped Ukrainian card tests**

```ts
it("escapes provider markup in project data", () => {
  const card = formatAssignmentCard({
    title: "Лоток <секція & 2>",
    occurrences: [{ occurrenceId: "o1", criterion: "Загальний план", normRef: "ДБН <Н.15>" }],
  });
  expect(card.text).toContain("Лоток &lt;секція &amp; 2&gt;");
  expect(card.parseMode).toBe("HTML");
});
```

- [ ] **Step 2: Run card/delivery tests and verify failure**

Run: `pnpm --filter @goproceed/app test -- src/lib/telegram/cards.test.ts src/lib/telegram/delivery.test.ts`

Expected: FAIL because formatting/delivery modules do not exist.

- [ ] **Step 3: Implement assignment-card formatting and identity**

```ts
export interface AssignmentCardPayload {
  assignmentId: string;
  title: string;
  occurrences: Array<{
    occurrenceId: string;
    criterion: string;
    normRef: string;
  }>;
}
```

Store an internal `communication_messages.kind='assignment_card'` row before
delivery. The provider message id written after acceptance is the only reply
anchor recognized by the evidence bridge.

- [ ] **Step 4: Write route integration tests**

```ts
it("publishes one card under idempotent replay", async () => {
  const key = crypto.randomUUID();
  const first = await publishCard(assignmentId, key);
  const replay = await publishCard(assignmentId, key);
  expect(first.body.messageId).toBe(replay.body.messageId);
  expect(await countOutbox("communication.telegram.send")).toBe(1);
});
```

- [ ] **Step 5: Implement transactional enqueue and route**

Resolve assignment -> project -> active healthy Telegram binding, require
`project.view` plus `assignments.manage`, read ordered occurrences, insert the
card message and outbox event atomically, and return queued state.

- [ ] **Step 6: Implement safe delivery state transitions**

```ts
type DeliveryResult =
  | { kind: "provider_accepted"; providerMessageId: string }
  | { kind: "retryable_rejection"; retryAfterMs: number }
  | { kind: "definitive_failure"; code: string }
  | { kind: "delivery_unknown"; code: "network_outcome_unknown" };
```

Provider-accepted writes the provider message id and completes the outbox lease.
Definite retryable rejection calls the bounded outbox fail path. Unknown writes
`delivery_unknown`, completes the outbox item to stop automatic retry, and
requires a warned manual retry command in Task 11.

- [ ] **Step 7: Extend the internal job route with outbox processing**

Call inbox and outbound batches independently so a failing provider send does
not stop inbound normalization. Return counts by accepted/failed/unknown only.

- [ ] **Step 8: Run focused tests and commit**

```bash
pnpm --filter @goproceed/app test -- src/lib/telegram/cards.test.ts src/lib/telegram/delivery.test.ts telegram-delivery.int.test.ts
pnpm --filter @goproceed/app typecheck
node scripts/validate-canonical-docs.mjs
git add -- apps/app/src/lib/telegram/cards.ts apps/app/src/lib/telegram/cards.test.ts apps/app/src/lib/telegram/delivery.ts apps/app/src/lib/telegram/delivery.test.ts apps/app/src/lib/telegram/processor.ts apps/app/app/internal/telegram/jobs/route.ts 'apps/app/app/v1/assignments/[assignmentId]/communication-card/route.ts' apps/app/tests/telegram-delivery.int.test.ts technical/events/event-catalog.csv technical/openapi/scope-v0.1.csv technical/openapi.yaml technical/copy-catalog.csv
git commit -m "feat(telegram): deliver assignment cards through the outbox"
```

### Task 8: Shared evidence authorization and finalization services

**Files:**
- Create: `apps/app/src/lib/evidence/authorize-upload-intent.ts`
- Create: `apps/app/src/lib/evidence/finalize-upload-intent.ts`
- Create: `apps/app/src/lib/evidence/evidence-service.test.ts`
- Modify: `apps/app/app/v1/assignments/[assignmentId]/upload-intents/route.ts`
- Modify: `apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts`
- Modify: `apps/app/tests/upload-intents-create.int.test.ts`
- Modify: `apps/app/tests/upload-intents-finalize.int.test.ts`
- Modify: `apps/app/tests/field-capture.int.test.ts`

**Interfaces:**
- Produces: `authorizeUploadIntent(input): Promise<HandlerResult>` and `finalizeUploadIntent(input): Promise<HandlerResult>`.
- Consumes: verified `actorUserId`, `requestId`, existing contract bodies, idempotency identity, storage helpers, tenant/service transactions.
- Preserves every current HTTP status, problem code, audit action, outbox event, idempotency replay, and authorization rule.

- [ ] **Step 1: Characterize current route behaviour before extraction**

Add cases that call the routes twice and assert exact status/body/header for:

```ts
it.each([
  "unknown_assignment",
  "wrong_occurrence",
  "unsupported_media",
  "quota_exhausted",
  "available_replay",
  "hash_mismatch",
] as const)("preserves %s behaviour through the shared service", async (scenario) => {
  expect(await runScenario(scenario)).toMatchSnapshot();
});
```

- [ ] **Step 2: Run characterization tests and save the green baseline**

Run:

```bash
pnpm --filter @goproceed/app test -- upload-intents-create.int.test.ts upload-intents-finalize.int.test.ts field-capture.int.test.ts
```

Expected: PASS before extraction. Do not update snapshots after moving code
unless the old implementation was demonstrably wrong and the spec names the
change.

- [ ] **Step 3: Define the shared service inputs**

```ts
export interface AuthorizeUploadIntentInput {
  actorUserId: string;
  requestId: string;
  assignmentId: string;
  body: CreateUploadIntentRequest;
  idempotencyKey: string;
  requestHash: string;
}

export interface FinalizeUploadIntentInput {
  actorUserId: string;
  requestId: string;
  intentId: string;
}
```

The service owns transactions and returns the existing `HandlerResult` shape so
routes remain wrappers and Telegram can call the same application boundary.

- [ ] **Step 4: Move authorization logic without semantic edits**

Move occurrence/media policy, membership/project capability, quota lock,
intent/capture inserts, audit, and signed-upload creation into
`authorizeUploadIntent`. Replace the route body with:

```ts
export const POST = commandRoute(createUploadIntentRequest, (a) =>
  authorizeUploadIntent({
    actorUserId: a.userId,
    requestId: a.requestId,
    assignmentId: a.params.assignmentId ?? "",
    body: a.body,
    idempotencyKey: a.idempotencyKey,
    requestHash: a.requestHash,
  }));
```

- [ ] **Step 5: Move finalization logic without semantic edits**

Move receipt replay, storage size/hash/inspection, failure recording, service
command, evidence insert, audit, and outbox into `finalizeUploadIntent`. Keep
storage I/O outside transactions exactly as the current route does.

- [ ] **Step 6: Add direct service tests for a linked-member caller**

```ts
it("authorizes and finalizes for a verified server caller using the same member", async () => {
  const authorized = await authorizeUploadIntent(telegramActorInput);
  await putObject(authorized.body.storage.key, bytes, "image/jpeg");
  const finalized = await finalizeUploadIntent({ actorUserId, requestId, intentId: authorized.body.uploadIntentId });
  expect(finalized.body).toMatchObject({ status: "available" });
});
```

- [ ] **Step 7: Run the full evidence regression set**

```bash
pnpm --filter @goproceed/app test -- src/lib/evidence/evidence-service.test.ts upload-intents-create.int.test.ts upload-intents-finalize.int.test.ts upload-intents-get.int.test.ts field-capture.int.test.ts finalize-vanishing-bytes.int.test.ts evidence-storage.int.test.ts
pnpm --filter @goproceed/app typecheck
```

Expected: all PASS with unchanged member-route responses and receipts.

- [ ] **Step 8: Commit the service extraction**

```bash
git add -- apps/app/src/lib/evidence/authorize-upload-intent.ts apps/app/src/lib/evidence/finalize-upload-intent.ts apps/app/src/lib/evidence/evidence-service.test.ts 'apps/app/app/v1/assignments/[assignmentId]/upload-intents/route.ts' 'apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts' apps/app/tests/upload-intents-create.int.test.ts apps/app/tests/upload-intents-finalize.int.test.ts apps/app/tests/field-capture.int.test.ts
git commit -m "refactor(evidence): share upload authorization and finalization"
```

### Task 9: Telegram image evidence and requirement selection

**Files:**
- Create: `apps/app/src/lib/telegram/evidence.ts`
- Create: `apps/app/src/lib/telegram/evidence.test.ts`
- Create: `apps/app/tests/telegram-evidence.int.test.ts`
- Modify: `apps/app/src/lib/telegram/processor.ts`
- Modify: `apps/app/src/lib/telegram/cards.ts`
- Modify: `apps/app/src/lib/telegram/delivery.ts`
- Modify: `technical/copy-catalog.csv`
- Modify: `technical/test-catalog.csv`

**Interfaces:**
- Produces: `prepareTelegramEvidenceCandidate()`, `selectTelegramOccurrence()`, `processTelegramEvidenceAttachment()`.
- Consumes: Task 3 downloads, Task 7 receipts, Task 8 shared evidence services, provider message/card mapping.
- Constants: `TELEGRAM_DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024`, `TELEGRAM_REQUIREMENT_CHOICE_TTL_MS = 24 * 60 * 60 * 1000`.

- [ ] **Step 1: Write eligibility tests before implementation**

```ts
it.each([
  [{ kind: "photo", mime: "image/jpeg", size: 1000 }, true],
  [{ kind: "document", mime: "image/png", size: 1000 }, true],
  [{ kind: "document", mime: "application/pdf", size: 1000 }, false],
  [{ kind: "video", mime: "video/mp4", size: 1000 }, false],
  [{ kind: "document", mime: "image/jpeg", size: 20 * 1024 * 1024 + 1 }, false],
] as const)("classifies %j", (file, accepted) => {
  expect(isTelegramEvidenceCandidate(file)).toBe(accepted);
});
```

- [ ] **Step 2: Write vertical evidence failures first**

```ts
it("does not download an image that is not a reply to a live assignment card", async () => {
  await receivePhoto({ replyToMessageId: null });
  expect(fakeTelegram.downloadCalls).toBe(0);
  expect(await attachmentState()).toBe("unbound");
});

it("creates one evidence object per image in a selected album", async () => {
  await receiveAlbum(3, { replyToProviderCardId, occurrenceCount: 2 });
  await chooseOccurrence(originalUploaderTelegramId, choiceToken);
  await runJobs();
  expect(await evidenceObjectsForAlbum()).toHaveLength(3);
});
```

- [ ] **Step 3: Run focused evidence tests and verify failure**

Run:

```bash
pnpm --filter @goproceed/app test -- src/lib/telegram/evidence.test.ts telegram-evidence.int.test.ts
```

Expected: FAIL because the evidence bridge does not exist.

- [ ] **Step 4: Implement card/occurrence resolution**

Accept only replies whose provider message id maps to a current
`assignment_card` in the same binding. Read upload-capable occurrences from the
card snapshot and current assignment. With one occurrence, process. With more,
create a random opaque callback token mapped server-side to uploader, album,
assignment, choices, and 24-hour expiry. Callback data contains only `req:<token>`.

- [ ] **Step 5: Implement media-group quiet-period aggregation**

Upsert `telegram_media_groups` on every album part and schedule it at
`last_part_at + interval '2 seconds'`. The worker claims only groups whose quiet
period elapsed. One choice applies to every supported image. Unsupported parts
remain ordinary attachments and are reported separately.

- [ ] **Step 6: Implement download, hash, upload, and finalization**

```ts
const bytes = await telegram.downloadFile(candidate.fileId);
const hash = createHash("sha256").update(bytes).digest("hex");
const idempotencyKey = createHash("sha256")
  .update(`telegram:${botId}:${chatId}:${messageId}:${fileUniqueId}:${occurrenceId}`)
  .digest("hex");
```

Call `authorizeUploadIntent` with the linked membership's `user_id`,
`originMethod: 'origin_not_distinguished'`, null claimed time/offset,
`sourceAppVersion: telegramSourceVersion()`, then `putObject` and
`finalizeUploadIntent`. Link the attachment only from the durable `available`
receipt. Clear provider file handle after terminal success/failure.

Define the helper in `evidence.ts` so the stored value is deterministic in
local tests and identifies a configured deployment without exposing a secret:

```ts
export function telegramSourceVersion(): string {
  return `telegram-bot/${process.env.APP_VERSION?.trim() || "dev"}`;
}
```

- [ ] **Step 7: Implement per-image receipts and partial success**

Queue a processing message first. After terminal outcomes, send one summary
that names counts and each exact failure. Never say `збережено` before every
named successful attachment has an evidence object id.

- [ ] **Step 8: Add callback authorization and expiry tests**

Only the original uploader may choose. A PTV member, another foreman, expired
token, wrong group, or replay receives a short callback answer and changes no
attachment. At 24 hours, move to `not_evidence`, clear provider handles, and
instruct the uploader to reply again.

- [ ] **Step 9: Run evidence regression and typechecks**

```bash
pnpm --filter @goproceed/app test -- src/lib/telegram/evidence.test.ts telegram-evidence.int.test.ts field-capture.int.test.ts upload-intents-create.int.test.ts upload-intents-finalize.int.test.ts
pnpm --filter @goproceed/app typecheck
node scripts/validate-canonical-docs.mjs
```

Expected: PASS for one occurrence, multiple occurrence choice, albums, duplicate
updates, provider limit, unsupported media, partial download failure, quota,
revoked access, and finalization replay.

- [ ] **Step 10: Commit the evidence bridge**

```bash
git add -- apps/app/src/lib/telegram/evidence.ts apps/app/src/lib/telegram/evidence.test.ts apps/app/src/lib/telegram/processor.ts apps/app/src/lib/telegram/cards.ts apps/app/src/lib/telegram/delivery.ts apps/app/tests/telegram-evidence.int.test.ts technical/copy-catalog.csv technical/test-catalog.csv
git commit -m "feat(telegram): turn card replies into durable evidence"
```

### Task 10: Shared evidence decisions and Telegram accept/return actions

**Files:**
- Create: `apps/app/src/lib/evidence/record-evidence-decision.ts`
- Create: `apps/app/src/lib/evidence/record-evidence-decision.test.ts`
- Create: `apps/app/src/lib/telegram/decisions.ts`
- Create: `apps/app/src/lib/telegram/decisions.test.ts`
- Modify: `apps/app/app/v1/occurrences/[occurrenceId]/evidence-decisions/route.ts`
- Modify: `apps/app/src/lib/telegram/processor.ts`
- Modify: `apps/app/src/lib/telegram/cards.ts`
- Modify: `apps/app/tests/m3-refusal.int.test.ts`
- Modify: `technical/copy-catalog.csv`

**Interfaces:**
- Produces: `recordEvidenceDecision(input): Promise<HandlerResult>` and `processTelegramDecisionCallback()`.
- Consumes: linked member user id, current occurrence head version, existing `recordEvidenceDecisionRequest`, explicit callback tokens.

- [ ] **Step 1: Characterize the existing decision route**

Add route snapshots for accepted, returned-with-reason, missing reason,
self-decision denial, stale expected version, and idempotent replay. Run:

`pnpm --filter @goproceed/app test -- m3-refusal.int.test.ts`

Expected: PASS before extraction.

- [ ] **Step 2: Define and extract the shared service**

```ts
export interface RecordEvidenceDecisionInput {
  actorUserId: string;
  requestId: string;
  occurrenceId: string;
  body: RecordEvidenceDecisionRequest;
  idempotencyKey: string;
  requestHash: string;
}
```

Move the existing membership/capability, self-decision, lineage lock, head
advance, readiness evaluation, audit, and outbox code unchanged. Make the HTTP
route a thin `commandRoute` adapter.

- [ ] **Step 3: Run decision regressions after extraction**

Run:

```bash
pnpm --filter @goproceed/app test -- src/lib/evidence/record-evidence-decision.test.ts m3-refusal.int.test.ts
```

Expected: PASS with unchanged responses and domain facts.

- [ ] **Step 4: Write Telegram callback tests**

```ts
it("treats ordinary ok text as chat, never acceptance", async () => {
  await receiveText("ок", linkedPtvUser);
  expect(await decisionCount()).toBe(0);
});

it("requires a reason before a return command", async () => {
  const result = await processTelegramDecisionCallback(returnTokenWithoutReason);
  expect(result.kind).toBe("reason_required");
  expect(await decisionCount()).toBe(0);
});
```

- [ ] **Step 5: Implement explicit, opaque decision callbacks**

Create server-side callback tokens scoped to occurrence, action, actor/group,
and expiry. Acceptance can execute immediately after confirmation. Return asks
the linked PTV member to reply to the bot prompt with non-blank reason; the
prompt id binds the next reply. Fetch current head version immediately before
calling the shared service. Recheck `project.view` and
`evidence_decisions.decide` inside that service.

- [ ] **Step 6: Run focused and regression tests**

```bash
pnpm --filter @goproceed/app test -- src/lib/evidence/record-evidence-decision.test.ts src/lib/telegram/decisions.test.ts m3-refusal.int.test.ts telegram-processing.int.test.ts
pnpm --filter @goproceed/app typecheck
```

Expected: PASS including wrong actor, stale token, expired token, self-decision,
missing return reason, idempotent callback replay, and free-text `ок`.

- [ ] **Step 7: Commit the decision slice**

```bash
git add -- apps/app/src/lib/evidence/record-evidence-decision.ts apps/app/src/lib/evidence/record-evidence-decision.test.ts apps/app/src/lib/telegram/decisions.ts apps/app/src/lib/telegram/decisions.test.ts apps/app/src/lib/telegram/processor.ts apps/app/src/lib/telegram/cards.ts 'apps/app/app/v1/occurrences/[occurrenceId]/evidence-decisions/route.ts' apps/app/tests/m3-refusal.int.test.ts technical/copy-catalog.csv
git commit -m "feat(telegram): add explicit attributed evidence decisions"
```

### Task 11: Project communication API and manual delivery recovery

**Files:**
- Create: `apps/app/app/v1/projects/[projectId]/communications/route.ts`
- Create: `apps/app/app/v1/projects/[projectId]/communications/[messageId]/retry/route.ts`
- Create: `apps/app/tests/project-communications.int.test.ts`
- Modify: `packages/contracts/src/project-communications.ts`
- Modify: `technical/openapi/scope-v0.1.csv`
- Modify: `technical/openapi.yaml`
- Modify: `technical/ui-actions.csv`
- Modify: `technical/command-availability.csv`

**Interfaces:**
- Produces: cursor-paginated GET and idempotent POST on project communications.
- Produces: explicit warned retry for `failed` or `delivery_unknown` outbound messages.
- Consumes: `project.view` for reads and `project.view + communication.reply` for replies/retries.

- [ ] **Step 1: Write member-plane API tests**

```ts
it("returns newest-first cursor pages and no provider file handles", async () => {
  const first = await listCommunication(projectId, { limit: 2 });
  expect(first.messages).toHaveLength(2);
  expect(first.nextCursor).not.toBeNull();
  expect(JSON.stringify(first)).not.toContain("provider_file_id");
});

it("a web reply is fixed to the project's Telegram binding", async () => {
  const response = await postReply(projectId, { text: "Потрібен загальний план" });
  expect(response.channel).toBe("telegram");
  expect(response).not.toHaveProperty("recipient");
});
```

- [ ] **Step 2: Run API tests and verify failure**

Run: `pnpm --filter @goproceed/app test -- project-communications.int.test.ts`

Expected: FAIL because the member routes are absent.

- [ ] **Step 3: Implement stable keyset pagination**

Use `(server_received_at, id)` as the cursor pair, encode it as base64url JSON,
and validate it server-side. Limit is `1..100`, default 50. Query exact project
under RLS and return normalized messages, append-only edits, attachments, links,
and delivery states. Never return link verifiers or provider file handles.

- [ ] **Step 4: Implement transactional web replies**

Require active project and healthy Telegram channel, `project.view`, and
`communication.reply`. Resolve optional reply target inside the same project.
Insert outbound `queued` message plus `communication.telegram.send` outbox row
in the idempotent transaction.

- [ ] **Step 5: Implement warned manual retry**

Allow retry only from `failed` or `delivery_unknown`; create a new outbound
message linked by `retry_of_message_id` rather than reusing the provider identity.
Require body `{ acknowledgePossibleDuplicate: true }` for `delivery_unknown`.
Audit the actor and prior state.

- [ ] **Step 6: Update route/action catalogs**

Add `project_communications.list`, `project_communications.reply`, and
`project_communications.retry`; record `communication.reply` and the explicit
duplicate acknowledgement in `ui-actions.csv` and `command-availability.csv`.

- [ ] **Step 7: Run API, security, and canonical checks**

```bash
pnpm --filter @goproceed/app test -- project-communications.int.test.ts telegram-delivery.int.test.ts
pnpm --filter @goproceed/testing test -- telegram-rls.test.ts
node scripts/validate-canonical-docs.mjs
pnpm --filter @goproceed/app typecheck
```

Expected: PASS for cross-project reply ids, unauthorized readers/repliers,
pagination ties, idempotency replay, failed retry, and unknown duplicate warning.

- [ ] **Step 8: Commit the member communication API**

```bash
git add -- 'apps/app/app/v1/projects/[projectId]/communications/route.ts' 'apps/app/app/v1/projects/[projectId]/communications/[messageId]/retry/route.ts' apps/app/tests/project-communications.int.test.ts packages/contracts/src/project-communications.ts technical/openapi/scope-v0.1.csv technical/openapi.yaml technical/ui-actions.csv technical/command-availability.csv
git commit -m "feat(communication): expose project timeline and web replies"
```

### Task 12: Project setup and PTV communication UI

**Files:**
- Create: `apps/app/app/dash/projects/new/page.tsx`
- Create: `apps/app/app/dash/projects/[projectId]/communication/page.tsx`
- Create: `apps/app/src/services/project-communication.service.ts`
- Create: `apps/app/src/services/project-communication.service.test.ts`
- Create: `apps/app/src/components/projects/project-create-form.tsx`
- Create: `apps/app/src/components/projects/project-create-form.test.tsx`
- Create: `apps/app/src/components/communication/channel-status.tsx`
- Create: `apps/app/src/components/communication/communication-timeline.tsx`
- Create: `apps/app/src/components/communication/communication-message.tsx`
- Create: `apps/app/src/components/communication/communication-attachment.tsx`
- Create: `apps/app/src/components/communication/communication-composer.tsx`
- Create: `apps/app/src/components/communication/communication-filters.tsx`
- Create: `apps/app/src/components/communication/decision-actions.tsx`
- Create: `apps/app/src/components/communication/communication-timeline.test.tsx`
- Modify: `apps/app/src/components/projects/project-overview-header.tsx`
- Modify: `apps/app/src/components/dash-shell/projects-list.tsx`
- Modify: `technical/copy-catalog.csv`

**Interfaces:**
- Produces: `/dash/projects/new` and `/dash/projects/{projectId}/communication`.
- Consumes: Tasks 1, 4, 7, 10, and 11 member APIs only; components do not call Telegram directly.

- [ ] **Step 1: Write service result tests**

```ts
it("maps 401 to session_expired and preserves delivery_unknown", async () => {
  mockApiGet.rejectOnce(new ApiError(401, authProblem));
  expect(await getProjectCommunication(projectId)).toEqual({ kind: "session_expired" });
  mockApiGet.resolveOnce(pageWithDeliveryUnknown);
  expect((await getProjectCommunication(projectId)).kind).toBe("ok");
});
```

- [ ] **Step 2: Write component behaviour tests**

```tsx
it("shows source limitation and never renders a channel picker", () => {
  const html = renderToStaticMarkup(<CommunicationComposer projectId={projectId} />);
  expect(html).toContain("Відповідь буде надіслана в Telegram");
  expect(html).not.toContain("WhatsApp");
  expect(html).not.toContain("Одержувач");
});

it("does not label an unbound image as evidence", () => {
  const html = renderToStaticMarkup(<CommunicationAttachment attachment={unboundImage} />);
  expect(html).toContain("Не прив’язано до роботи");
  expect(html).not.toContain("Доказ збережено");
});
```

- [ ] **Step 3: Run service/component tests and verify failure**

Run:

```bash
pnpm --filter @goproceed/app test -- project-communication.service.test.ts project-create-form.test.tsx communication-timeline.test.tsx
```

Expected: FAIL because the service/pages/components do not exist.

- [ ] **Step 4: Implement the thin service layer**

Use existing `apiGet/apiPost` and discriminated result conventions. Export:

```ts
export async function getProjectCommunication(projectId: string, cursor?: string): Promise<ProjectCommunicationResult>;
export async function replyToProjectCommunication(projectId: string, input: PostProjectCommunicationRequest): Promise<CommunicationCommandResult>;
export async function createTelegramBindingIntent(projectId: string): Promise<BindingIntentResult>;
export async function createTelegramMemberLinkIntent(projectId: string): Promise<MemberLinkIntentResult>;
export async function activateProject(projectId: string, expectedVersion: number): Promise<ProjectChannelCommandResult>;
```

- [ ] **Step 5: Build draft project setup**

The form requires name and displays one project-wide channel option, Telegram.
After creation it shows group connection and member-link actions, connection
health, and the exact immutable-after-activation warning. Activation stays
disabled until the API reports `connected`.

- [ ] **Step 6: Build the project communication page**

The server page resolves `projectId`, calls the service, redirects only on
session expiry, and renders explicit error/empty/content branches. Timeline
shows author verification, role, provider/server time, reply relationship,
edit history, attachment state, evidence/occurrence links, and delivery state.

- [ ] **Step 7: Build reply, retry, and decision controls**

The composer states that delivery is Telegram-only. Retry unknown delivery
requires a confirmation explaining a possible duplicate. Accept/return controls
call explicit decision operations; return requires reason. Plain chat text has
no acceptance semantics.

- [ ] **Step 8: Add project navigation and immutable channel label**

Add `Комунікація` to the exact project, not the global workspace shell. Show
`Канал майданчика: Telegram` and health on the project header. Existing active
channel-less projects show `Канал не налаштовано` and no retrofit action.

- [ ] **Step 9: Run UI tests, typecheck, and build**

```bash
pnpm --filter @goproceed/app test -- project-communication.service.test.ts project-create-form.test.tsx communication-timeline.test.tsx
pnpm --filter @goproceed/app typecheck
pnpm --filter @goproceed/app build
```

Expected: PASS at 360px-capable markup, keyboard-operable controls, visible
focus from existing tokens, no channel picker, and no evidence success label on
pending/unbound/failed attachments.

- [ ] **Step 10: Commit the web experience**

```bash
git add -- apps/app/app/dash/projects/new/page.tsx 'apps/app/app/dash/projects/[projectId]/communication/page.tsx' apps/app/src/services/project-communication.service.ts apps/app/src/services/project-communication.service.test.ts apps/app/src/components/projects/project-create-form.tsx apps/app/src/components/projects/project-create-form.test.tsx apps/app/src/components/projects/project-overview-header.tsx apps/app/src/components/dash-shell/projects-list.tsx apps/app/src/components/communication/channel-status.tsx apps/app/src/components/communication/communication-timeline.tsx apps/app/src/components/communication/communication-message.tsx apps/app/src/components/communication/communication-attachment.tsx apps/app/src/components/communication/communication-composer.tsx apps/app/src/components/communication/communication-filters.tsx apps/app/src/components/communication/decision-actions.tsx apps/app/src/components/communication/communication-timeline.test.tsx technical/copy-catalog.csv
git commit -m "feat(web): add Telegram project communication workspace"
```

### Task 13: Bot registration, scheduling, observability, and end-to-end gate

**Files:**
- Create: `apps/app/scripts/configure-telegram-webhook.mjs`
- Create: `apps/app/scripts/configure-telegram-webhook.test.ts`
- Create: `apps/app/qa/telegram-project.mjs`
- Modify: `apps/app/package.json`
- Modify: `apps/app/.env.example`
- Modify: `infra/README-staging.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `technical/asvs-profile.csv`
- Modify: `technical/mobile-security-profile.csv`
- Modify: `technical/traceability.csv`
- Modify: `technical/test-catalog.csv`
- Modify: `docs/architecture/system-overview.md`
- Modify: `docs/architecture/files-and-storage.md`
- Modify: `docs/architecture/jobs-events-and-audit.md`
- Modify: `docs/product/personas-and-workflows.md`

**Interfaces:**
- Produces commands: `pnpm --filter @goproceed/app telegram:webhook:configure`, `telegram:webhook:check`, `qa:telegram`.
- Consumes: deployed HTTPS origin, bot credentials, worker scheduler, one closed staging group, and two linked test members.

- [ ] **Step 1: Write webhook configuration tests**

```ts
it("registers the exact HTTPS webhook and allowed update set", async () => {
  await configureWebhook(config, fakeTelegramFetch());
  expect(lastTelegramRequest()).toMatchObject({
    method: "setWebhook",
    body: {
      url: "https://staging.example/integrations/telegram/webhook",
      secret_token: config.webhookSecret,
      allowed_updates: ["message", "edited_message", "callback_query", "my_chat_member"],
      drop_pending_updates: false,
    },
  });
});
```

- [ ] **Step 2: Run the script test and verify failure**

Run: `pnpm --filter @goproceed/app test -- configure-telegram-webhook.test.ts`

Expected: FAIL because the script does not exist.

- [ ] **Step 3: Implement configure/check scripts without printing secrets**

`configure` calls `getMe`, verifies configured bot id/username, calls
`setWebhook`, then `getWebhookInfo` and prints only bot username, webhook origin,
pending count, and last safe error code. `check` performs the reads only. Both
exit non-zero on mismatch and never interpolate the token or webhook secret.

- [ ] **Step 4: Document the exact staging wiring**

Document required secrets:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_ID
TELEGRAM_BOT_USERNAME
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_WORKER_SECRET
TELEGRAM_LINK_PEPPER
APP_PUBLIC_ORIGIN
```

Document one scheduler call every minute to
`POST /internal/telegram/jobs` with the worker bearer secret, bounded batch
sizes, alerting on non-2xx, and the disable order: pause scheduler, remove
webhook, wait for leases, then rotate/revoke secrets. Do not put actual values
in the repository.

- [ ] **Step 5: Add operational metrics and safe structured logging tests**

Assert emitted records contain opaque internal ids and safe codes only:

```ts
expect(JSON.stringify(metric)).not.toContain(config.botToken);
expect(JSON.stringify(metric)).not.toContain(messageText);
expect(metric).toMatchObject({ name: "telegram.evidence.finalized", outcome: "available" });
```

Cover webhook accepted/rejected/deduplicated, inbox age, evidence duration,
delivery accepted/failed/unknown, unhealthy bindings, and expired intents.

- [ ] **Step 6: Add the automated fake-provider acceptance walk**

`apps/app/qa/telegram-project.mjs` must create a draft project, bind a fake
group, activate, link foreman/PTV, publish a card, inject photo/document/album,
choose a requirement, run workers, open the web page, reply from web, inject a
Telegram reply, accept/return, remove/restore bot, and inject an unknown send.
Every step asserts database receipt and visible Ukrainian UI state.

- [ ] **Step 7: Add CI gates**

Run fake-provider unit/integration coverage on every push. Keep the real-group
pass manual because it needs protected credentials and a phone. Add canonical
validation, app build, and the new QA script in the same sequence existing CI
uses for local Supabase-backed tests.

- [ ] **Step 8: Run the complete automated verification**

```bash
pnpm test
pnpm typecheck
pnpm --filter @goproceed/app build
pnpm --filter @goproceed/app qa:telegram
node scripts/validate-canonical-docs.mjs
git diff --check
```

Expected: all PASS. Confirm the working tree contains no generated screenshots,
provider payloads, tokens, or evidence bytes selected for commit.

- [ ] **Step 9: Perform the protected staging gate when credentials are available**

Run the 11-step staging acceptance in the spec with one real closed group and a
physical phone. Save only safe evidence: internal ids, timestamps, redacted
screenshots, and test catalog results. Verify ordinary Telegram message deletion
produces no Bot API update and that GoProceed retains the last known record
without claiming a deletion event.

- [ ] **Step 10: Commit operations and release documentation**

```bash
git add -- apps/app/scripts/configure-telegram-webhook.mjs apps/app/scripts/configure-telegram-webhook.test.ts apps/app/qa/telegram-project.mjs apps/app/package.json apps/app/.env.example infra/README-staging.md .github/workflows/ci.yml technical/asvs-profile.csv technical/mobile-security-profile.csv technical/traceability.csv technical/test-catalog.csv docs/architecture/system-overview.md docs/architecture/files-and-storage.md docs/architecture/jobs-events-and-audit.md docs/product/personas-and-workflows.md
git commit -m "test(telegram): add deployment and acceptance gates"
```

---

## Plan self-review coverage map

| Spec requirement | Owning task(s) |
|---|---|
| Draft selection, activation, immutable one-channel rule | 1, 4, 12 |
| One official bot and one group per project | 2, 3, 4 |
| Tenant/RLS isolation and keyed identity linking | 2, 4, 5, 6 |
| Durable webhook, dedupe, raw-payload clearing | 2, 5, 6 |
| Full normalized history from connection forward | 2, 6, 11, 12 |
| Assignment cards and reply-only evidence context | 7, 9 |
| Photo/image-document/album evidence and 20 MiB ceiling | 3, 9 |
| Shared evidence authorization/finalization | 8, 9 |
| Explicit attributed accept/return | 10, 12 |
| Web reply to same Telegram group only | 7, 11, 12 |
| Definite retry vs delivery unknown | 3, 7, 11, 12 |
| Edit history and honest deletion limitation | 3, 6, 12, 13 |
| Bot removal/unhealthy without switching | 6, 12, 13 |
| Secrets, rate limits, retention, safe logs | 2, 3, 5, 13 |
| Fake-provider CI and real-group staging gate | 3, 13 |
