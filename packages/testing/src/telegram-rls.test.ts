import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, asActor, asService, dropWorkspaces } from "./pg";
import type { Client } from "pg";

const WS_A = "cccccccc-1111-1111-1111-111111111111";
const WS_B = "dddddddd-1111-1111-1111-111111111111";
const OWNER = "eeeeeeee-1111-1111-1111-111111111111";
const UNRELATED = "ffffffff-1111-1111-1111-111111111111";
let admin: Client;
let projectId: string;
let ownerMemberId: string;
let bindingId: string;

beforeAll(async () => {
  admin = await adminClient();
  await admin.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'telegram-owner@example.test', '', now(), now()),
           ($2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'telegram-unrelated@example.test', '', now(), now())
    on conflict (id) do nothing`, [OWNER, UNRELATED]);
  await admin.query("insert into public.organizations (id, legal_name, display_name) values ($1, 'Telegram RLS A', 'Telegram RLS A'), ($2, 'Telegram RLS B', 'Telegram RLS B')", [WS_A, WS_B]);
  const member = await admin.query<{ id: string }>("insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'owner', 'active') returning id", [WS_A, OWNER]);
  ownerMemberId = member.rows[0]!.id;
  await admin.query("insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'member', 'active')", [WS_A, UNRELATED]);
  const project = await admin.query<{ id: string }>("insert into public.projects (workspace_id, name, created_by) values ($1, 'Telegram RLS', $2) returning id", [WS_A, OWNER]);
  projectId = project.rows[0]!.id;
  await admin.query("insert into public.project_field_channels (workspace_id, project_id, channel) values ($1, $2, 'telegram')", [WS_A, projectId]);
  const binding = await admin.query<{ id: string }>(`insert into public.telegram_chat_bindings
    (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
    values ($1, $2, 123456789, -100998, 'supergroup', $3) returning id`, [WS_A, projectId, ownerMemberId]);
  bindingId = binding.rows[0]!.id;
  await admin.query(`insert into public.communication_messages
    (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, server_received_at, delivery_state)
    values ($1, $2, $3, 'inbound', 'text', 'Тест', now(), 'received')`, [WS_A, projectId, binding.rows[0]!.id]);
});

afterAll(async () => {
  await dropWorkspaces(admin, [WS_A, WS_B]);
  await admin.end();
});

describe("Telegram communication RLS", () => {
  it("a member with no project.view cannot read communication", async () => {
    const visible = await asActor(UNRELATED, WS_A, (c) => c.query(
      "select id from public.communication_messages where project_id=$1", [projectId],
    ));
    expect(visible.rows).toEqual([]);
  });

  it("an anonymous transaction cannot enumerate communication rows", async () => {
    const visible = await asActor("", null, (c) => c.query("select id from public.communication_messages"));
    expect(visible.rows).toEqual([]);
  });
});

/**
 * THE SERVICE POLICY ON telegram_requirement_choice_sessions, BOTH WAYS.
 *
 * 0068:40-67 wrote that policy as three EXISTS over tables that carry only
 * `to goproceed_app` policies keyed on app.current_actor(). goproceed_service
 * INHERITS goproceed_app, so the service plane — which always runs with an
 * empty actor — was refused by its own policy on every insert; 0080 rewrites
 * it as `workspace_id = app.service_workspace()`, like its ten siblings.
 *
 * No fixture beyond this file's is needed, because of the order PostgreSQL
 * applies the fences on INSERT: RLS WITH CHECK first, then CHECK constraints,
 * then the foreign keys (AFTER triggers). A CHECK-valid row with garbage
 * foreign keys therefore fails with 42501 when the policy refuses it and with
 * 23503 when the policy admits it — the error code says which fence stopped
 * the row. That order is measured, not recalled: at 0079 the declared-workspace
 * row failed with 42501 although it also violated a CHECK (the policy ran
 * first); at 0080 the same row failed with 23514 in CI run 33619255955 (the
 * policy admitted it, the CHECK ran before any foreign key); with the CHECK
 * satisfied — telegram_media_group_id and media_group_generation set together,
 * per telegram_requirement_choice_sessions_generation_check — the foreign keys
 * are what remains. Before 0080 the first case below was red; that is the red
 * this test was written against.
 */
describe("§ service policy on telegram_requirement_choice_sessions", () => {
  const wellFormed = (workspaceId: string) => ({
    sql: `insert into public.telegram_requirement_choice_sessions
      (workspace_id, project_id, telegram_chat_binding_id, uploader_member_id, work_assignment_id,
       telegram_media_group_id, media_group_generation, token_hash, candidate_occurrence_id,
       allowed_occurrence_ids, expires_at)
      values ($1, $2, $3, $4, gen_random_uuid(), gen_random_uuid(), 1, repeat('a', 64), gen_random_uuid(),
              array[gen_random_uuid(), gen_random_uuid()], now() + interval '1 hour')`,
    params: [workspaceId, projectId, bindingId, ownerMemberId],
  });

  async function codeOf(workspaceRow: string, workspaceGuc: string): Promise<string> {
    const row = wellFormed(workspaceRow);
    try {
      await asService("", workspaceGuc, (c) => c.query(row.sql, row.params));
      return "inserted";
    } catch (e) {
      return (e as { code?: string }).code ?? "unknown";
    }
  }

  it("admits a row for the workspace the service transaction declared (the foreign keys, not the policy, stop it)", async () => {
    expect(await codeOf(WS_A, WS_A)).toBe("23503");
  });

  it("refuses a row for any other workspace at the policy, before a foreign key is looked at", async () => {
    expect(await codeOf(WS_B, WS_A)).toBe("42501");
  });

  it("refuses every row when no workspace is declared", async () => {
    expect(await codeOf(WS_A, "")).toBe("42501");
  });
});

/**
 * THE LINKED MEMBER THE SERVICE PLANE COULD NOT SEE (0082).
 *
 * public.memberships carries member-plane policies only — m_select and
 * m_select_workspace, both resolving app.current_actor() — and
 * goproceed_service INHERITS goproceed_app, so a service transaction (always
 * an empty actor) reads no membership whatever workspace it declares. The
 * first case pins that fact, because it is the reason the definer exists:
 * processor.ts resolved the author of every inbound Telegram message with an
 * inline join to this table and found no one. app.resolve_telegram_linked_member
 * is the bounded lookup that replaces the join — declared workspace only,
 * service principal only, one row or none.
 */
describe("§ app.resolve_telegram_linked_member (0082)", () => {
  const TELEGRAM_USER = "700100";
  const resolve = (declared: string, workspace: string) => asService<{ member_id: string; user_id: string }>("", declared, (c) => c.query(
    "select member_id, user_id from app.resolve_telegram_linked_member($1::uuid, $2::bigint)", [workspace, TELEGRAM_USER],
  ));

  beforeAll(async () => {
    await admin.query(`insert into public.telegram_member_links (workspace_id, member_id, telegram_user_id, linked_by_member_id)
      values ($1, $2, $3::bigint, $2)`, [WS_A, ownerMemberId, TELEGRAM_USER]);
  });

  it("the inline read it replaces sees no membership from the service plane, even for the declared workspace", async () => {
    const seen = await asService("", WS_A, (c) => c.query("select id from public.memberships where organization_id=$1", [WS_A]));
    expect(seen.rows).toEqual([]);
  });

  it("resolves the linked, active member and their user for the declared workspace", async () => {
    expect((await resolve(WS_A, WS_A)).rows).toEqual([{ member_id: ownerMemberId, user_id: OWNER }]);
  });

  it("refuses any workspace but the declared one, and refuses when none is declared", async () => {
    await expect(resolve(WS_A, WS_B)).rejects.toMatchObject({ code: "P0001" });
    await expect(resolve("", WS_A)).rejects.toMatchObject({ code: "P0001" });
  });

  it("resolves nothing for a revoked link, and nothing for a membership that is not active", async () => {
    await admin.query("update public.telegram_member_links set revoked_at=now() where workspace_id=$1 and telegram_user_id=$2::bigint", [WS_A, TELEGRAM_USER]);
    expect((await resolve(WS_A, WS_A)).rows).toEqual([]);
    await admin.query("update public.telegram_member_links set revoked_at=null where workspace_id=$1 and telegram_user_id=$2::bigint", [WS_A, TELEGRAM_USER]);
    await admin.query("update public.memberships set status='suspended' where id=$1", [ownerMemberId]);
    expect((await resolve(WS_A, WS_A)).rows).toEqual([]);
    await admin.query("update public.memberships set status='active' where id=$1", [ownerMemberId]);
    expect((await resolve(WS_A, WS_A)).rows).toHaveLength(1);
  });

  it("is not executable from the member plane", async () => {
    await expect(asActor(OWNER, WS_A, (c) => c.query(
      "select * from app.resolve_telegram_linked_member($1::uuid, $2::bigint)", [WS_A, TELEGRAM_USER],
    ))).rejects.toMatchObject({ code: "42501" });
  });
});
