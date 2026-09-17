import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { Client } from "pg";
import { adminClient, asActor, asService, dropWorkspaces } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";
import { insertOccurrence, seedOccurrenceWorld } from "./m2-occurrences-fixture";

/**
 * READINESS GATE 11, MODULE communication (DEV-014, BL-090).
 *
 * One test per exposed (relation, principal), each cited in
 * technical/database/rls-coverage.csv as BOTH its positive and its negative.
 *
 * MEMBER PLANE (goproceed_app). The owner of A, holding project.view on A's
 * project, reads A's rows; the owner of B, holding the same on B's project and
 * declaring workspace A, reads only B's. B reading its own rows is what keeps
 * the zero rows of A from coming out of a mis-seeded B.
 *
 * SERVICE PLANE (goproceed_service). The transaction runs with an EMPTY actor —
 * the Telegram contract, and the only way the test proves the service policy.
 * goproceed_service is a member of goproceed_app and inherits its policies,
 * which OR with its own; with a real actor, the member policy would admit A's
 * rows on the five dual-granted tables whatever workspace was declared, so the
 * positive could pass with a broken service policy and the negative fail with a
 * correct one. With no actor, `workspace_id = app.service_workspace()` is the
 * only branch that can admit a row. Declaring A reaches A's rows, declaring B
 * reaches only B's, and declaring nothing reaches none.
 *
 * Both workspaces are seeded identically, from the rules and occurrence worlds
 * up (a media group needs an assignment, a choice needs an occurrence), so every
 * table holds a row of each. Every value unique across workspaces — verifier and
 * token hashes, (bot_id, chat_id) — is derived from the workspace id or chosen
 * here and used by no other suite. No resetDb; the workspaces are dropped
 * before (a crashed earlier run) and after.
 */
const WS_A = "de140a00-0000-4000-8000-000000000002";
const WS_B = "de140b00-0000-4000-8000-000000000002";
const USER_A = "de140a00-0000-4000-8000-0000000000a3";
const USER_B = "de140b00-0000-4000-8000-0000000000b3";
const BOT_ID = "914014001";
const BOTH = [WS_A, WS_B];

let admin: Client;

function hashOf(ws: string, label: string): string {
  return createHash("sha256").update(`dev014:${ws}:${label}`).digest("hex");
}

/** One row of every communication relation (two messages), in `ws`. */
async function seedSide(ws: string, user: string, suffix: string, chatId: string, telegramUserId: string): Promise<void> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const world = await seedOccurrenceWorld(admin, rules);
  const hold = await insertOccurrence(admin, world);
  const permissive = await insertOccurrence(admin, world, {
    ruleVersionId: world.permissiveRuleVersionId, stageKey: world.permissiveStageKey,
    workStageId: world.permissiveStageId, stageIsConcealed: false,
    blockingScope: "blocks_both", timing: "after",
  });
  const { projectId, memberId } = rules;

  await admin.query(
    "insert into public.project_field_channels (workspace_id, project_id, channel) values ($1, $2, 'telegram')",
    [ws, projectId]);
  await admin.query(
    `insert into public.telegram_binding_intents
       (workspace_id, project_id, requested_by_member_id, verifier_hash, expires_at, verifier_key_id)
     values ($1, $2, $3, $4, now() + interval '1 hour', 'k1')`,
    [ws, projectId, memberId, hashOf(ws, "binding-intent")]);
  const binding = await admin.query<{ id: string }>(
    `insert into public.telegram_chat_bindings
       (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
     values ($1, $2, $3, $4, 'supergroup', $5) returning id`,
    [ws, projectId, BOT_ID, chatId, memberId]);
  const bindingId = binding.rows[0]!.id;
  await admin.query(
    `insert into public.telegram_member_link_intents
       (workspace_id, project_id, member_id, issued_by_member_id, verifier_hash, expires_at, verifier_key_id)
     values ($1, $2, $3, $3, $4, now() + interval '1 hour', 'k1')`,
    [ws, projectId, memberId, hashOf(ws, "member-link-intent")]);
  await admin.query(
    `insert into public.telegram_member_links (workspace_id, member_id, telegram_user_id, linked_by_member_id)
     values ($1, $2, $3, $2)`, [ws, memberId, telegramUserId]);

  const inbound = await admin.query<{ id: string }>(
    `insert into public.communication_messages
       (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, provider_user_id, delivery_state)
     values ($1, $2, $3, 'inbound', 'text', 'Приклад-повідомлення', $4, 'received') returning id`,
    [ws, projectId, bindingId, telegramUserId]);
  const inboundId = inbound.rows[0]!.id;
  await admin.query(
    `insert into public.communication_message_events (workspace_id, project_id, message_id, event_kind, text)
     values ($1, $2, $3, 'edited', 'Приклад-повідомлення (виправлено)')`, [ws, projectId, inboundId]);
  const outbound = await admin.query<{ id: string }>(
    `insert into public.communication_messages
       (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, author_member_id, delivery_state)
     values ($1, $2, $3, 'outbound', 'text', 'Приклад-відповідь', $4, 'provider_accepted') returning id`,
    [ws, projectId, bindingId, memberId]);
  await admin.query(
    `insert into public.communication_delivery_attempts
       (workspace_id, project_id, message_id, attempt_no, state, provider_message_id, completed_at)
     values ($1, $2, $3, 1, 'provider_accepted', 1, now())`, [ws, projectId, outbound.rows[0]!.id]);

  const group = await admin.query<{ id: string }>(
    `insert into public.telegram_media_groups
       (workspace_id, project_id, telegram_chat_binding_id, provider_media_group_id, uploader_member_id,
        state, work_assignment_id, choice_expires_at)
     values ($1, $2, $3, 'dev014-group', $4, 'awaiting_requirement_choice', $5, now() + interval '1 hour')
     returning id`, [ws, projectId, bindingId, memberId, world.assignmentId]);
  const groupId = group.rows[0]!.id;
  const attachment = await admin.query<{ id: string }>(
    `insert into public.communication_attachments
       (workspace_id, project_id, message_id, telegram_media_group_id, provider_file_id,
        provider_file_unique_id, media_type_snapshot, byte_size, state)
     values ($1, $2, $3, $4, 'dev014-file', 'dev014-unique', 'image/jpeg', 11, 'awaiting_requirement_choice')
     returning id`, [ws, projectId, inboundId, groupId]);
  // Consumed and closed as `selected` with the occurrence the choice below
  // records, so the two rows describe one decision.
  await admin.query(
    `insert into public.telegram_requirement_choice_sessions
       (workspace_id, project_id, telegram_chat_binding_id, uploader_member_id, work_assignment_id,
        telegram_media_group_id, media_group_generation, token_hash, candidate_occurrence_id,
        allowed_occurrence_ids, expires_at, consumed_at, chosen_occurrence_id, closed_at, closure_reason)
     values ($1, $2, $3, $4, $5, $6, 0, $7, $8, array[$8, $9]::uuid[], now() + interval '1 hour',
             now(), $8, now(), 'selected')`,
    [ws, projectId, bindingId, memberId, world.assignmentId, groupId, hashOf(ws, "choice-session"), hold, permissive]);
  await admin.query(
    `insert into public.telegram_requirement_choices
       (workspace_id, project_id, communication_attachment_id, telegram_media_group_id, chooser_member_id,
        requirement_occurrence_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [ws, projectId, attachment.rows[0]!.id, groupId, memberId, hold]);
}

/** The workspace of every row `actor` can read on the member plane, declaring workspace A, sorted. */
async function memberSeen(actor: string, sql: string): Promise<string[]> {
  const r = await asActor<{ ws: string }>(actor, WS_A, (c) => c.query(sql, [BOTH]));
  return r.rows.map((row) => row.ws).sort();
}

/** The workspace of every row a service transaction with no actor reaches, declaring `declared`, sorted. */
async function serviceSeen(declared: string | null, sql: string): Promise<string[]> {
  const r = await asService<{ ws: string }>("", declared, (c) => c.query(sql, [BOTH]));
  return r.rows.map((row) => row.ws).sort();
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  await seedSide(WS_A, USER_A, "DEV014-A", "-1009140140001", "914014001");
  await seedSide(WS_B, USER_B, "DEV014-B", "-1009140140002", "914014002");
}, 120_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("communication member plane — project.view in A reads rows of A and the owner of B declaring A reads only rows of B", () => {
  it("communication_messages: the owner of A reads the row of A and the owner of B reads only its own", async () => {
    // Two rows per workspace: the inbound message and the outbound reply.
    const sql = "select workspace_id as ws from public.communication_messages where workspace_id = any($1::uuid[])";
    expect(await memberSeen(USER_A, sql)).toEqual([WS_A, WS_A]);
    expect(await memberSeen(USER_B, sql)).toEqual([WS_B, WS_B]);
  });

  it("communication_message_events: the owner of A reads the row of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.communication_message_events where workspace_id = any($1::uuid[])";
    expect(await memberSeen(USER_A, sql)).toEqual([WS_A]);
    expect(await memberSeen(USER_B, sql)).toEqual([WS_B]);
  });

  it("communication_attachments: the owner of A reads the row of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.communication_attachments where workspace_id = any($1::uuid[])";
    expect(await memberSeen(USER_A, sql)).toEqual([WS_A]);
    expect(await memberSeen(USER_B, sql)).toEqual([WS_B]);
  });

  it("telegram_chat_bindings: the owner of A reads the row of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.telegram_chat_bindings where workspace_id = any($1::uuid[])";
    expect(await memberSeen(USER_A, sql)).toEqual([WS_A]);
    expect(await memberSeen(USER_B, sql)).toEqual([WS_B]);
  });

  it("telegram_media_groups: the owner of A reads the row of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.telegram_media_groups where workspace_id = any($1::uuid[])";
    expect(await memberSeen(USER_A, sql)).toEqual([WS_A]);
    expect(await memberSeen(USER_B, sql)).toEqual([WS_B]);
  });
});

describe("communication service plane — a service transaction declaring A reaches rows of A and one declaring B or no workspace reaches none of them", () => {
  it("communication_messages: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.communication_messages where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A, WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B, WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("communication_message_events: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.communication_message_events where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("communication_attachments: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.communication_attachments where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("communication_delivery_attempts: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.communication_delivery_attempts where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("telegram_chat_bindings: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.telegram_chat_bindings where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("telegram_binding_intents: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.telegram_binding_intents where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("telegram_member_link_intents: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.telegram_member_link_intents where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("telegram_member_links: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.telegram_member_links where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("telegram_media_groups: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.telegram_media_groups where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("telegram_requirement_choice_sessions: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.telegram_requirement_choice_sessions where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });

  it("telegram_requirement_choices: declaring A reads the row of A and declaring B reads only the row of B and declaring nothing reads none", async () => {
    const sql = "select workspace_id as ws from public.telegram_requirement_choices where workspace_id = any($1::uuid[])";
    expect(await serviceSeen(WS_A, sql)).toEqual([WS_A]);
    expect(await serviceSeen(WS_B, sql)).toEqual([WS_B]);
    expect(await serviceSeen(null, sql)).toEqual([]);
  });
});
