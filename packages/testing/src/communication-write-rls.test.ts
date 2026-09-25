import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { Client } from "pg";
import { adminClient, dropWorkspaces, superuserClient } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import { insertOccurrence, seedOccurrenceWorld } from "./m2-occurrences-fixture";

/**
 * THE CROSS-WORKSPACE WRITE MINIMUM, MODULE communication (DEV-078, BL-165).
 *
 * DEV-076 widened a `covered` row of technical/database/rls-coverage.csv: where
 * its principal can write, a test must show it cannot write into another
 * workspace. Every row of this module is goproceed_service on the service
 * plane, where the minimum is another declared workspace and none. One test per
 * row of technical/database/rls-write-coverage.csv, each cited there as its
 * `negative_test`. Per privilege the row holds:
 *
 *   - INSERT carrying B's tenant key and parent ids, declaring A: refused by the
 *     policy (42501); the same statement with A's ids declaring nothing:
 *     refused by the policy; and declaring A with A's ids: succeeds (the
 *     control);
 *   - INSERT keeping A's tenant key with one of B's parent ids, declaring A:
 *     refused by that composite foreign key (23503, named). The service policy
 *     reads no parent, so a 42501 here would mean the probe declared the wrong
 *     workspace;
 *   - UPDATE reading no column (no WHERE, a constant SET, no RETURNING),
 *     declaring A: its row count equals A's rows (at least one), and B's rows
 *     read back unchanged as admin in the same transaction; declaring nothing:
 *     no row, and neither side changes;
 *   - moving A's rows into B (tenant key, project and parents), again reading no
 *     column: refused by the policy (42501). With a WHERE, the policy's USING
 *     applied to the new row as a read refuses the move even under `WITH CHECK
 *     (true)` (DEV-077 C1), and this policy is FOR ALL, so its USING is that read
 *     policy;
 *   - moving one parent column alone to B's, within A: refused by the composite
 *     foreign key (23503, INV-001).
 *
 * The service transaction runs with an EMPTY actor, the Telegram contract
 * (communication-rls.test.ts): `workspace_id = app.service_workspace()` is then
 * the only branch that can admit a write. goproceed_app, whose policies
 * goproceed_service inherits, has no write policy on these tables.
 *
 * Every probe runs on the local superuser connection in one transaction that
 * is always rolled back: each statement runs inside a savepoint under `SET
 * LOCAL ROLE goproceed_service` with the GUCs passed explicitly (a
 * `set_config(..., true)` outlives its released savepoint), and the admin
 * read-back runs after `RESET ROLE` in the same transaction. A trigger's refusal
 * does not count (owner, 2026-09-24): the two tables whose guards fire before
 * the policy on UPDATE have their user triggers disabled inside the probe's
 * transaction (`DISABLE TRIGGER USER`), and the rollback re-enables them; the
 * test then asserts they are enabled. No INSERT trigger exists on these tables.
 *
 * 0104 withdrew the service grants only SECURITY DEFINER functions use (owner,
 * 2026-09-25): UPDATE on both intent tables, INSERT on telegram_chat_bindings,
 * and every write on telegram_member_links. Their tests assert the privilege
 * refusal, so a grant coming back fails here as well as in rls-coverage.test.ts.
 *
 * The fixture is this file's own (ids `de078…`, bot 914078001, chats
 * -100914078000N), dropped before and after. No resetDb.
 */
const WS_A = "de078a00-0000-4000-8000-000000000001";
const WS_B = "de078b00-0000-4000-8000-000000000001";
const USER_A = "de078a00-0000-4000-8000-0000000000a1";
const USER_B = "de078b00-0000-4000-8000-0000000000b1";
const BOT_ID = "914078001";
const BOTH = [WS_A, WS_B];

interface Side {
  ws: string; project: string; member: string; assignment: string; hold: string; permissive: string;
  binding: string; inbound: string; outbound: string; group: string; groupKey: string;
  attachment: string; attachment2: string;
}

/**
 * `reason` separates the two refusals SQLSTATE 42501 names: `policy` — «violates
 * row-level security policy»; `privilege` — «permission denied». `constraint`
 * names the constraint a 23503 or 23505 came from.
 */
interface Outcome {
  rowCount: number | null; code: string | null;
  reason: "policy" | "privilege" | "other" | null; constraint: string | null;
}

const refusedByPolicy: Outcome = { rowCount: null, code: "42501", reason: "policy", constraint: null };
const refusedByPrivilege: Outcome = { rowCount: null, code: "42501", reason: "privilege", constraint: null };
const inserted: Outcome = { rowCount: 1, code: null, reason: null, constraint: null };
const byForeignKey = (constraint: string): Outcome => ({ rowCount: null, code: "23503", reason: "other", constraint });

let admin: Client;
let A: Side;
let B: Side;

function hashOf(label: string): string {
  return createHash("sha256").update(`dev078:${label}`).digest("hex");
}

async function one<T extends Record<string, unknown>>(sql: string, params: unknown[]): Promise<T> {
  const r = await admin.query<T>(sql, params);
  if (!r.rows[0]) throw new Error(`fixture: no row from ${sql}`);
  return r.rows[0];
}

/** One row of every communication relation in `ws` but telegram_member_links, which no probe writes (two messages, two attachments). */
async function seedSide(ws: string, user: string, suffix: string, chatId: string, telegramUserId: string): Promise<Side> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const world = await seedOccurrenceWorld(admin, rules);
  const hold = await insertOccurrence(admin, world);
  const permissive = await insertOccurrence(admin, world, {
    ruleVersionId: world.permissiveRuleVersionId, stageKey: world.permissiveStageKey,
    workStageId: world.permissiveStageId, stageIsConcealed: false,
    blockingScope: "blocks_both", timing: "after",
  });
  const { projectId: project, memberId: member } = rules;

  await admin.query(
    "insert into public.project_field_channels (workspace_id, project_id, channel) values ($1, $2, 'telegram')",
    [ws, project]);
  await admin.query(
    `insert into public.telegram_binding_intents
       (workspace_id, project_id, requested_by_member_id, verifier_hash, expires_at, verifier_key_id)
     values ($1, $2, $3, $4, now() + interval '1 hour', 'k1')`,
    [ws, project, member, hashOf(`${ws}:binding-intent`)]);
  const binding = (await one<{ id: string }>(
    `insert into public.telegram_chat_bindings
       (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
     values ($1, $2, $3, $4, 'supergroup', $5) returning id`,
    [ws, project, BOT_ID, chatId, member])).id;
  await admin.query(
    `insert into public.telegram_member_link_intents
       (workspace_id, project_id, member_id, issued_by_member_id, verifier_hash, expires_at, verifier_key_id)
     values ($1, $2, $3, $3, $4, now() + interval '1 hour', 'k1')`,
    [ws, project, member, hashOf(`${ws}:member-link-intent`)]);

  const inbound = (await one<{ id: string }>(
    `insert into public.communication_messages
       (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, provider_user_id, delivery_state)
     values ($1, $2, $3, 'inbound', 'text', 'Приклад-повідомлення', $4, 'received') returning id`,
    [ws, project, binding, telegramUserId])).id;
  await admin.query(
    `insert into public.communication_message_events (workspace_id, project_id, message_id, event_kind, text)
     values ($1, $2, $3, 'edited', 'Приклад-повідомлення (виправлено)')`, [ws, project, inbound]);
  const outbound = (await one<{ id: string }>(
    `insert into public.communication_messages
       (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, author_member_id, delivery_state)
     values ($1, $2, $3, 'outbound', 'text', 'Приклад-відповідь', $4, 'provider_accepted') returning id`,
    [ws, project, binding, member])).id;
  await admin.query(
    `insert into public.communication_delivery_attempts
       (workspace_id, project_id, message_id, attempt_no, state, provider_message_id, completed_at)
     values ($1, $2, $3, 1, 'provider_accepted', 1, now())`, [ws, project, outbound]);

  // A key of each side's own: (telegram_chat_binding_id, provider_media_group_id)
  // is unique, so a parent-only move of A's group onto B's binding would
  // otherwise answer 23505 before the foreign key.
  const groupKey = `dev078-group-${suffix}`;
  const group = (await one<{ id: string }>(
    `insert into public.telegram_media_groups
       (workspace_id, project_id, telegram_chat_binding_id, provider_media_group_id, uploader_member_id,
        state, work_assignment_id, choice_expires_at)
     values ($1, $2, $3, $4, $5, 'awaiting_requirement_choice', $6, now() + interval '1 hour')
     returning id`, [ws, project, binding, groupKey, member, world.assignmentId])).id;
  const attachment = (await one<{ id: string }>(
    `insert into public.communication_attachments
       (workspace_id, project_id, message_id, telegram_media_group_id, provider_file_id,
        provider_file_unique_id, media_type_snapshot, byte_size, state)
     values ($1, $2, $3, $4, 'dev078-file', 'dev078-unique', 'image/jpeg', 11, 'awaiting_requirement_choice')
     returning id`, [ws, project, inbound, group])).id;
  // A staged single attachment with no choice: the target of the choice and
  // choice-session controls, whose unique keys the first attachment already holds.
  const attachment2 = (await one<{ id: string }>(
    `insert into public.communication_attachments
       (workspace_id, project_id, message_id, provider_file_id, provider_file_unique_id, media_type_snapshot, state)
     values ($1, $2, $3, 'dev078-file-2', 'dev078-unique-2', 'image/jpeg', 'staged') returning id`,
    [ws, project, inbound])).id;
  await admin.query(
    `insert into public.telegram_requirement_choice_sessions
       (workspace_id, project_id, telegram_chat_binding_id, uploader_member_id, work_assignment_id,
        telegram_media_group_id, media_group_generation, token_hash, candidate_occurrence_id,
        allowed_occurrence_ids, expires_at, consumed_at, chosen_occurrence_id, closed_at, closure_reason)
     values ($1, $2, $3, $4, $5, $6, 0, $7, $8, array[$8, $9]::uuid[], now() + interval '1 hour',
             now(), $8, now(), 'selected')`,
    [ws, project, binding, member, world.assignmentId, group, hashOf(`${ws}:choice-session`), hold, permissive]);
  await admin.query(
    `insert into public.telegram_requirement_choices
       (workspace_id, project_id, communication_attachment_id, telegram_media_group_id, chooser_member_id,
        requirement_occurrence_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [ws, project, attachment, group, member, hold]);
  return {
    ws, project, member, assignment: world.assignmentId, hold, permissive,
    binding, inbound, outbound, group, groupKey, attachment, attachment2,
  };
}

/** One probe: a transaction on the superuser connection, always rolled back. */
interface Probe {
  /** A statement as goproceed_service with no actor, declaring `declared` ('' declares none). */
  svc(sql: string, params?: unknown[], declared?: string): Promise<Outcome>;
  /** A statement as the superuser, in the same transaction. */
  admin<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** The message of the last refused `svc` statement. */
  lastMessage(): string | null;
}

async function probe(body: (p: Probe) => Promise<void>, disableTriggersOn?: string): Promise<void> {
  const c = superuserClient();
  await c.connect();
  try {
    await c.query("begin");
    if (disableTriggersOn) await c.query(`alter table public.${disableTriggersOn} disable trigger user`);
    let last: string | null = null;
    const p: Probe = {
      async svc(sql, params = [], declared = WS_A) {
        last = null;
        await c.query("savepoint probe");
        await c.query("set local role goproceed_service");
        await c.query(
          `select set_config('app.actor_user_id', '', true), set_config('app.organization_id', $1, true),
                  set_config('app.external_session_id', '', true)`, [declared]);
        try {
          const r = await c.query(sql, params);
          await c.query("release savepoint probe");
          await c.query("reset role");
          return { rowCount: r.rowCount, code: null, reason: null, constraint: null };
        } catch (e) {
          await c.query("rollback to savepoint probe");
          await c.query("reset role");
          const { code, message, constraint } = e as { code?: string; message?: string; constraint?: string };
          last = message ?? null;
          const reason = /row-level security policy/.test(message ?? "") ? "policy"
            : /permission denied/.test(message ?? "") ? "privilege" : "other";
          return { rowCount: null, code: code ?? "unknown", reason, constraint: constraint ?? null };
        }
      },
      async admin(sql, params = []) {
        return (await c.query(sql, params)).rows;
      },
      lastMessage: () => last,
    };
    await body(p);
  } finally {
    await c.query("rollback").catch(() => undefined);
    await c.end().catch(() => undefined);
  }
}

/** Every row of `table` in workspace `ws` as JSON text, sorted: the read-back that must not change. */
async function snapshot(p: Probe, table: string, ws: string): Promise<string[]> {
  const rows = await p.admin<{ j: string }>(
    `select to_jsonb(t)::text as j from public.${table} t where t.workspace_id = $1 order by 1`, [ws]);
  return rows.map((r) => r.j);
}

/**
 * The UPDATE probe, reading no column: declaring A it changes every row of A
 * and none of B's; declaring nothing it changes none.
 */
async function expectUpdateConfined(table: string, set: string, disable?: string): Promise<void> {
  await probe(async (p) => {
    const beforeA = await snapshot(p, table, WS_A);
    const beforeB = await snapshot(p, table, WS_B);
    expect(beforeA.length).toBeGreaterThanOrEqual(1);
    expect(beforeB.length).toBeGreaterThanOrEqual(1);
    expect(await p.svc(`update public.${table} set ${set}`, [], ""))
      .toEqual({ rowCount: 0, code: null, reason: null, constraint: null });
    expect(await snapshot(p, table, WS_A)).toEqual(beforeA);
    expect(await snapshot(p, table, WS_B)).toEqual(beforeB);
    expect(await p.svc(`update public.${table} set ${set}`))
      .toEqual({ rowCount: beforeA.length, code: null, reason: null, constraint: null });
    expect(await snapshot(p, table, WS_A)).not.toEqual(beforeA);
    expect(await snapshot(p, table, WS_B)).toEqual(beforeB);
  }, disable);
}

/**
 * One INSERT statement taking a side's ids, run four ways declaring A (or
 * nothing): with B's ids, with A's ids declaring nothing, with A's tenant key
 * and one of B's parents (`mixed`), and with A's ids (the control).
 */
async function insertOutcomes(sql: string, params: (s: Side) => unknown[], mixed: unknown[]): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  await probe(async (p) => {
    outcomes.push(await p.svc(sql, params(B)));
    outcomes.push(await p.svc(sql, params(A), ""));
    outcomes.push(await p.svc(sql, mixed));
    outcomes.push(await p.svc(sql, params(A)));
  });
  return outcomes;
}

/** What `insertOutcomes` must return: the policy refuses B's ids and no declared workspace, the named foreign key refuses the mixed row, and the control inserts. */
const insertConfined = (constraint: string): Outcome[] =>
  [refusedByPolicy, refusedByPolicy, byForeignKey(constraint), inserted];

async function triggersEnabled(table: string): Promise<string[]> {
  const r = await admin.query<{ s: string }>(
    `select tgenabled::text as s from pg_trigger where tgrelid = ('public.' || $1)::regclass and not tgisinternal`, [table]);
  return r.rows.map((row) => row.s);
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  A = await seedSide(WS_A, USER_A, "DEV078-A", "-1009140780001", "914078011");
  B = await seedSide(WS_B, USER_B, "DEV078-B", "-1009140780002", "914078012");
}, 120_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("communication cross-workspace write denial", () => {
  it("communication_attachments: the service plane declaring A cannot insert or update an attachment of B or move one there", async () => {
    expect(await insertOutcomes(
      `insert into public.communication_attachments
         (workspace_id, project_id, message_id, provider_file_id, provider_file_unique_id, media_type_snapshot, state)
       values ($1, $2, $3, 'dev078-probe-file', 'dev078-probe-unique', 'image/jpeg', 'staged')`,
      (s) => [s.ws, s.project, s.inbound],
      [WS_A, A.project, B.inbound])).toEqual(insertConfined("communication_attachments_workspace_id_project_id_message__fkey"));
    await expectUpdateConfined("communication_attachments", "filename_snapshot = 'Приклад-проба.jpg'");
    await probe(async (p) => {
      const before = await snapshot(p, "communication_attachments", WS_B);
      expect(await p.svc(
        "update public.communication_attachments set workspace_id = $1, project_id = $2, message_id = $3, telegram_media_group_id = null",
        [WS_B, B.project, B.inbound])).toEqual(refusedByPolicy);
      expect(await p.svc("update public.communication_attachments set message_id = $1", [B.inbound]))
        .toEqual(byForeignKey("communication_attachments_workspace_id_project_id_message__fkey"));
      expect(await snapshot(p, "communication_attachments", WS_B)).toEqual(before);
    });
  });

  it("communication_delivery_attempts: the service plane declaring A cannot insert an attempt of B", async () => {
    expect(await insertOutcomes(
      `insert into public.communication_delivery_attempts
         (workspace_id, project_id, message_id, attempt_no, state, error_code, completed_at)
       values ($1, $2, $3, 2, 'definitive_failure', 'dev078_probe', now())`,
      (s) => [s.ws, s.project, s.outbound],
      [WS_A, A.project, B.outbound])).toEqual(insertConfined("communication_delivery_attemp_workspace_id_project_id_mess_fkey"));
  });

  it("communication_message_events: the service plane declaring A cannot insert an event of B", async () => {
    expect(await insertOutcomes(
      `insert into public.communication_message_events (workspace_id, project_id, message_id, event_kind)
       values ($1, $2, $3, 'bot_removed')`,
      (s) => [s.ws, s.project, s.inbound],
      [WS_A, A.project, B.inbound])).toEqual(insertConfined("communication_message_events_workspace_id_project_id_messa_fkey"));
  });

  it("communication_messages: the service plane declaring A cannot insert or update a message of B or move one there", async () => {
    expect(await insertOutcomes(
      `insert into public.communication_messages
         (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, delivery_state)
       values ($1, $2, $3, 'inbound', 'text', 'Приклад-проба', 'received')`,
      (s) => [s.ws, s.project, s.binding],
      [WS_A, A.project, B.binding])).toEqual(insertConfined("communication_messages_workspace_id_project_id_telegram_ch_fkey"));
    // The product's statement (processor.ts): its arbiter has no tenant column
    // (BL-176), so an A-declared row naming B's binding and a provider message
    // id B already holds is swallowed by B's row before any foreign key runs —
    // nothing is written, but the answer differs from the 23503 above.
    await probe(async (p) => {
      await p.admin("update public.communication_messages set provider_message_id = 424242 where id = $1", [B.inbound]);
      const before = await snapshot(p, "communication_messages", WS_B);
      expect(await p.svc(
        `insert into public.communication_messages
           (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, provider_message_id, delivery_state)
         values ($1, $2, $3, 'inbound', 'text', 'Приклад-проба', 424242, 'received')
         on conflict (telegram_chat_binding_id, provider_message_id) where provider_message_id is not null do nothing`,
        [WS_A, A.project, B.binding])).toEqual({ rowCount: 0, code: null, reason: null, constraint: null });
      expect(await snapshot(p, "communication_messages", WS_B)).toEqual(before);
      expect(await snapshot(p, "communication_messages", WS_A)).toHaveLength(2);
    });
    // The guard admits provider_sent_at, so the confinement holds with it on.
    await expectUpdateConfined("communication_messages", "provider_sent_at = timestamptz '2001-01-01 00:00:00Z'");
    // The guard refuses a changed tenant key, project, binding or author before
    // the policy is asked; with it off, the policy alone must refuse.
    await probe(async (p) => {
      const before = await snapshot(p, "communication_messages", WS_B);
      expect(await p.svc(
        "update public.communication_messages set workspace_id = $1, project_id = $2, telegram_chat_binding_id = $3, author_member_id = $4",
        [WS_B, B.project, B.binding, B.member])).toEqual(refusedByPolicy);
      expect(await p.svc("update public.communication_messages set telegram_chat_binding_id = $1", [B.binding]))
        .toEqual(byForeignKey("communication_messages_workspace_id_project_id_telegram_ch_fkey"));
      expect(await snapshot(p, "communication_messages", WS_B)).toEqual(before);
    }, "communication_messages");
    expect(await triggersEnabled("communication_messages")).toEqual(["O"]);
  });

  it("telegram_binding_intents: the service plane declaring A cannot insert an intent of B and holds no UPDATE", async () => {
    let n = 0;
    expect(await insertOutcomes(
      `insert into public.telegram_binding_intents
         (workspace_id, project_id, requested_by_member_id, verifier_hash, expires_at, verifier_key_id)
       values ($1, $2, $3, $4, now() + interval '15 minutes', 'k1')`,
      (s) => [s.ws, s.project, s.member, hashOf(`probe:binding-intent:${n++}`)],
      [WS_A, A.project, B.member, hashOf("probe:binding-intent:mixed")])).toEqual(insertConfined("telegram_binding_intents_workspace_id_requested_by_member__fkey"));
    await probe(async (p) => {
      expect(await p.svc("update public.telegram_binding_intents set verifier_key_id = 'k-probe'")).toEqual(refusedByPrivilege);
    });
  });

  it("telegram_chat_bindings: the service plane declaring A cannot update a binding of B or move one there and holds no INSERT", async () => {
    await probe(async (p) => {
      expect(await p.svc(
        `insert into public.telegram_chat_bindings (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
         values ($1, $2, $3, -1009140780009, 'supergroup', $4)`, [WS_A, A.project, BOT_ID, A.member])).toEqual(refusedByPrivilege);
    });
    // The guard admits title_snapshot, so the confinement holds with it on.
    await expectUpdateConfined("telegram_chat_bindings", "title_snapshot = 'Приклад-проба'");
    await probe(async (p) => {
      const before = await snapshot(p, "telegram_chat_bindings", WS_B);
      expect(await p.svc(
        "update public.telegram_chat_bindings set workspace_id = $1, project_id = $2, connected_by_member_id = $3",
        [WS_B, B.project, B.member])).toEqual(refusedByPolicy);
      expect(await p.svc("update public.telegram_chat_bindings set connected_by_member_id = $1", [B.member]))
        .toEqual(byForeignKey("telegram_chat_bindings_workspace_id_connected_by_member_id_fkey"));
      expect(await snapshot(p, "telegram_chat_bindings", WS_B)).toEqual(before);
    }, "telegram_chat_bindings");
    expect(await triggersEnabled("telegram_chat_bindings")).toEqual(["O"]);
  });

  it("telegram_media_groups: the service plane declaring A cannot insert or update a media group of B or move one there", async () => {
    let n = 0;
    expect(await insertOutcomes(
      `insert into public.telegram_media_groups
         (workspace_id, project_id, telegram_chat_binding_id, provider_media_group_id, uploader_member_id,
          reply_provider_message_id, last_part_at)
       values ($1, $2, $3, $4, $5, 7, now())`,
      (s) => [s.ws, s.project, s.binding, `dev078-probe-${n++}`, s.member],
      [WS_A, A.project, B.binding, "dev078-probe-mixed", A.member])).toEqual(insertConfined("telegram_media_groups_workspace_id_project_id_telegram_cha_fkey"));
    // Never last_part_at: the generation trigger acts on it.
    await expectUpdateConfined("telegram_media_groups", "reply_provider_message_id = 424242");
    await probe(async (p) => {
      const before = await snapshot(p, "telegram_media_groups", WS_B);
      // The product's upsert: its arbiter has no tenant column (BL-176), so an
      // A-declared row naming B's binding and B's group key reaches B's row,
      // and the policy's USING must refuse the update of it.
      expect(await p.svc(
        `insert into public.telegram_media_groups
           (workspace_id, project_id, telegram_chat_binding_id, provider_media_group_id, uploader_member_id, last_part_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (telegram_chat_binding_id, provider_media_group_id) do update set last_part_at = excluded.last_part_at`,
        [WS_A, A.project, B.binding, B.groupKey, A.member])).toEqual(refusedByPolicy);
      // The existing row's check, not the new row's: under `USING (true)` the
      // WITH CHECK would still refuse B's row, with a different message.
      expect(p.lastMessage()).toMatch(/\(USING expression\)/);
      expect(await p.svc(
        "update public.telegram_media_groups set workspace_id = $1, project_id = $2, telegram_chat_binding_id = $3, uploader_member_id = $4, work_assignment_id = $5",
        [WS_B, B.project, B.binding, B.member, B.assignment])).toEqual(refusedByPolicy);
      expect(await p.svc("update public.telegram_media_groups set telegram_chat_binding_id = $1", [B.binding]))
        .toEqual(byForeignKey("telegram_media_groups_workspace_id_project_id_telegram_cha_fkey"));
      expect(await snapshot(p, "telegram_media_groups", WS_B)).toEqual(before);
    });
  });

  it("telegram_member_link_intents: the service plane declaring A cannot insert an intent of B and holds no UPDATE", async () => {
    let n = 0;
    expect(await insertOutcomes(
      `insert into public.telegram_member_link_intents
         (workspace_id, project_id, member_id, issued_by_member_id, verifier_hash, expires_at, verifier_key_id)
       values ($1, $2, $3, $4, $5, now() + interval '15 minutes', 'k1')`,
      (s) => [s.ws, s.project, s.member, s.member, hashOf(`probe:member-link-intent:${n++}`)],
      [WS_A, A.project, B.member, A.member, hashOf("probe:member-link-intent:mixed")])).toEqual(insertConfined("telegram_member_link_intents_workspace_id_member_id_fkey"));
    await probe(async (p) => {
      expect(await p.svc("update public.telegram_member_link_intents set verifier_key_id = 'k-probe'")).toEqual(refusedByPrivilege);
    });
  });

  it("telegram_member_links: the service plane holds no INSERT and no UPDATE since 0104", async () => {
    await probe(async (p) => {
      expect(await p.svc(
        `insert into public.telegram_member_links (workspace_id, member_id, telegram_user_id, linked_by_member_id)
         values ($1, $2, 914078019, $2)`, [WS_A, A.member])).toEqual(refusedByPrivilege);
      expect(await p.svc("update public.telegram_member_links set display_name_snapshot = 'Приклад-проба'")).toEqual(refusedByPrivilege);
    });
  });

  it("telegram_requirement_choice_sessions: the service plane declaring A cannot insert or update a session of B or move one there", async () => {
    let n = 0;
    expect(await insertOutcomes(
      `insert into public.telegram_requirement_choice_sessions
         (workspace_id, project_id, telegram_chat_binding_id, uploader_member_id, work_assignment_id,
          communication_attachment_id, token_hash, candidate_occurrence_id, allowed_occurrence_ids, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, array[$8, $9]::uuid[], now() + interval '15 minutes')`,
      (s) => [s.ws, s.project, s.binding, s.member, s.assignment, s.attachment2, hashOf(`probe:session:${n++}`), s.hold, s.permissive],
      [WS_A, A.project, A.binding, A.member, A.assignment, A.attachment2, hashOf("probe:session:mixed"), B.hold, A.permissive])).toEqual(insertConfined("telegram_requirement_choice_s_workspace_id_project_id_cand_fkey"));
    await expectUpdateConfined("telegram_requirement_choice_sessions", "expires_at = timestamptz '2100-01-01 00:00:00Z'");
    await probe(async (p) => {
      const before = await snapshot(p, "telegram_requirement_choice_sessions", WS_B);
      expect(await p.svc(
        `update public.telegram_requirement_choice_sessions set workspace_id = $1, project_id = $2, telegram_chat_binding_id = $3,
           uploader_member_id = $4, work_assignment_id = $5, telegram_media_group_id = $6, candidate_occurrence_id = $7,
           chosen_occurrence_id = $7`,
        [WS_B, B.project, B.binding, B.member, B.assignment, B.group, B.hold])).toEqual(refusedByPolicy);
      expect(await p.svc("update public.telegram_requirement_choice_sessions set candidate_occurrence_id = $1", [B.hold]))
        .toEqual(byForeignKey("telegram_requirement_choice_s_workspace_id_project_id_cand_fkey"));
      expect(await snapshot(p, "telegram_requirement_choice_sessions", WS_B)).toEqual(before);
    });
  });

  it("telegram_requirement_choices: the service plane declaring A cannot insert a choice of B", async () => {
    const insert = `insert into public.telegram_requirement_choices
         (workspace_id, project_id, communication_attachment_id, chooser_member_id, requirement_occurrence_id)
       values ($1, $2, $3, $4, $5)`;
    expect(await insertOutcomes(insert,
      (s) => [s.ws, s.project, s.attachment2, s.member, s.hold],
      [WS_A, A.project, B.attachment2, A.member, A.hold])).toEqual(insertConfined("telegram_requirement_choices_workspace_id_project_id_commu_fkey"));
    // The product's statement, on B's attachment that already has a choice: the
    // policy refuses before arbitration, not a silent zero rows.
    await probe(async (p) => {
      expect(await p.svc(`${insert} on conflict (workspace_id, communication_attachment_id) do nothing`,
        [WS_B, B.project, B.attachment, B.member, B.hold])).toEqual(refusedByPolicy);
    });
  });
});
