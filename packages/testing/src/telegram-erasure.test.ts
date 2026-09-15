import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { Client } from "pg";
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
const WS_C = "d1d1d1d1-2222-4222-8222-222222222222";
const OWNER = "c1c1c1c1-2222-4222-8222-222222222222";
const SUBJECT = 700001n;
const BYSTANDER = 700002n;
const MARKER = "[текст стерто на запит]";
const PEPPER = "p".repeat(32);

// BL-085: the registry's HMAC keys carry key ids. K1 serves §4; §6 rotates.
const K1 = Buffer.alloc(32, 1);
const K2 = Buffer.alloc(32, 2);
const K3 = Buffer.alloc(32, 3);
const K4 = Buffer.alloc(32, 4);
const LEGACY = Buffer.from(PEPPER, "utf8");
const TEST_KEY_IDS = ["k1", "k2", "k3", "k4", "legacy"];
const KEY_CHECK_LABEL = "goproceed:telegram-erasure:key-check:v1";
const ERASE_SQL = "select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text, $4::text[], $5::text[], $6::text[])";

function hmacUnder(key: Buffer, workspaceId: string, telegramUserId: bigint): string {
  return createHmac("sha256", key).update(`erasure:${workspaceId}:${telegramUserId}`, "utf8").digest("hex");
}
function checkValue(key: Buffer): string {
  return createHmac("sha256", key).update(KEY_CHECK_LABEL, "utf8").digest("hex");
}
type KeySet = { active: string; keys: Array<[string, Buffer]> };
/** The six arguments app.erase_telegram_identity takes, for one subject under one key set. */
function eraseArgs(workspaceId: string, telegramUserId: bigint, set: KeySet): unknown[] {
  return [workspaceId, telegramUserId.toString(), set.active, set.keys.map(([id]) => id),
    set.keys.map(([, key]) => hmacUnder(key, workspaceId, telegramUserId)), set.keys.map(([, key]) => checkValue(key))];
}
const ONLY_K1: KeySet = { active: "k1", keys: [["k1", K1]] };

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

/** One telegram_member_links row, by member, as a comparable object. */
async function linkRow(memberId: string): Promise<Record<string, unknown>> {
  const r = await admin.query("select * from public.telegram_member_links where workspace_id = $1 and member_id = $2", [WS_A, memberId]);
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
  // dropWorkspaces (./pg) scans schema `public` only; the registry lives in
  // schema `app` (§1) and needs its own cleanup so a repeat run starts clean.
  await admin.query("delete from app.telegram_erasures where workspace_id = any($1::uuid[])", [[WS_A, WS_B, WS_C]]);
  await admin.query("delete from app.telegram_erasure_keys where key_id = any($1::text[])", [TEST_KEY_IDS]);
  // §5's telegram_inbox_updates seeds carry no workspace_id/organization_id
  // column (it is service-plane ingress, keyed by bot_id+update_id), so
  // dropWorkspaces cannot reach them; each §5 case is normally self-cleaning
  // (the retention job deletes the terminal row, the test's own `finally`
  // deletes the pending one), but this unconditional delete is the backstop
  // for an interrupted run — same discipline as the registry delete above.
  await admin.query("delete from public.telegram_inbox_updates where bot_id = 123456789 and update_id in (9000001, 9000002)");
  await dropWorkspaces(admin, [WS_A, WS_B, WS_C]);
  await admin.end();
});

describe("§1 — the registry and the policy exist, in schema app, reachable by no role", () => {
  it("app.telegram_erasures answers 42501 to the member plane and to the service plane", async () => {
    expect(await sqlstate(() => asActor(OWNER, WS_A, (c) => c.query("select 1 from app.telegram_erasures")))).toBe("42501");
    expect(await sqlstate(() => asService("", WS_A, (c) => c.query("select 1 from app.telegram_erasures")))).toBe("42501");
  });

  it("app.telegram_erasure_keys answers 42501 to the member plane and to the service plane (BL-085)", async () => {
    expect(await sqlstate(() => asActor(OWNER, WS_A, (c) => c.query("select 1 from app.telegram_erasure_keys")))).toBe("42501");
    expect(await sqlstate(() => asService("", WS_A, (c) => c.query("select 1 from app.telegram_erasure_keys")))).toBe("42501");
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
       where n.nspname = 'app' and c.relname in ('telegram_erasures', 'retention_policy', 'telegram_erasure_keys') order by 1`);
    expect(r.rows).toEqual([
      { relname: "retention_policy", rls: true, policies: 0 },
      { relname: "telegram_erasure_keys", rls: true, policies: 0 },
      { relname: "telegram_erasures", rls: true, policies: 0 },
    ]);
  });
});

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

describe("§4 — one identity, erased on request", () => {
  const call = (set: KeySet) => asService<{
    surrogate_user_id: string; messages: string; events: string; links: string; attachments: string;
    pending_updates_for_subject: string; already_erased: boolean;
  }>("", WS_A, (c) => c.query(ERASE_SQL, eraseArgs(WS_A, SUBJECT, set)));

  it("rewrites every row of the subject and none of the bystander, and records itself", async () => {
    const before = await messageRow(bystanderMessageId);
    const r = await call(ONLY_K1);
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

    const reg = await admin.query<{ subject_hmac: string; subject_key_id: string; origin: string; surrogate_user_id: string }>(
      "select subject_hmac, subject_key_id, origin, surrogate_user_id::text from app.telegram_erasures where workspace_id = $1", [WS_A]);
    expect(reg.rows).toEqual([{ subject_hmac: hmacUnder(K1, WS_A, SUBJECT), subject_key_id: "k1", origin: "data_subject_request", surrogate_user_id: out.surrogate_user_id }]);

    const audit = await admin.query<{ action: string; actor_type: string; actor_user_id: string | null; object_id: string; details: Record<string, unknown>; body: string }>(
      `select action, actor_type, actor_user_id, object_id, details, row_to_json(a)::text as body
         from public.audit_events a where organization_id = $1 and action = 'telegram_identity.erased'`, [WS_A]);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({ actor_type: "system", actor_user_id: null, object_id: out.surrogate_user_id });
    expect(audit.rows[0]!.details).toMatchObject({ messages: 2, events: 1, links: 1, attachments: 1, origin: "data_subject_request" });
    expect(audit.rows[0]!.body).not.toContain(SUBJECT.toString());
  });

  it("is idempotent: a second call returns the same surrogate and touches nothing, and erased_at does not move", async () => {
    const first = await admin.query<{ surrogate_user_id: string; erased_at: string }>("select surrogate_user_id::text, erased_at::text from app.telegram_erasures where workspace_id = $1", [WS_A]);
    const r = await call(ONLY_K1);
    expect(r.rows[0]).toMatchObject({ already_erased: true, surrogate_user_id: first.rows[0]!.surrogate_user_id, messages: "0", events: "0", links: "0", attachments: "0" });
    const second = await admin.query<{ erased_at: string }>("select erased_at::text from app.telegram_erasures where workspace_id = $1", [WS_A]);
    expect(second.rows[0]!.erased_at).toBe(first.rows[0]!.erased_at);
  });

  it("refuses the member plane", async () => {
    expect(await sqlstate(() => asActor(OWNER, WS_A, (c) => c.query("select * from app.erase_telegram_identity($1::uuid, 1::bigint, 'k1', array['k1'], array[repeat('a', 64)], array[repeat('b', 64)])", [WS_A])))).toBe("42501");
  });

  // The wrapper checks the caller's declared tenant (app.service_workspace(),
  // from the session's own app.organization_id) against the argument, rather
  // than overwriting it — the same shape app.record_service_audit uses. A
  // valid-looking HMAC is required so this reaches THAT check rather than
  // the HMAC-format check above it.
  it("refuses a workspace that does not match the session's declared tenant", async () => {
    let error: { code?: string; message?: string } | undefined;
    try {
      await asService("", WS_A, (c) =>
        c.query(ERASE_SQL, eraseArgs(WS_B, SUBJECT, ONLY_K1)));
    } catch (e) {
      error = e as { code?: string; message?: string };
    }
    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/erasure workspace is not the declared workspace/);

    const registered = await admin.query<{ count: string }>(
      "select count(*)::text as count from app.telegram_erasures where workspace_id = $1", [WS_B]);
    expect(registered.rows[0]!.count).toBe("0");
  });

  // Placed before "clears both markers" (below), which erases BYSTANDER for
  // real — this case needs BYSTANDER still intact. Key arrays of unequal
  // length are rejected by app.erase_telegram_identity's own validation before
  // it ever calls the internal transformation, so nothing — registry, audit,
  // or redaction — should exist as a result of this call.
  it("a failure raised before the transformation runs leaves the registry, the audit trail, and the bystander's row untouched", async () => {
    const before = await messageRow(bystanderMessageId);
    const registryCountBefore = await admin.query<{ count: string }>(
      "select count(*)::text as count from app.telegram_erasures where workspace_id = $1", [WS_A]);
    const auditBefore = await admin.query<{ count: string }>(
      "select count(*)::text as count from public.audit_events where organization_id = $1 and action = 'telegram_identity.erased'", [WS_A]);

    let error: { code?: string; message?: string } | undefined;
    try {
      await asService("", WS_A, (c) =>
        c.query(ERASE_SQL, [WS_A, BYSTANDER.toString(), "k1", ["k1"], [], [checkValue(K1)]]));
    } catch (e) {
      error = e as { code?: string; message?: string };
    }
    expect(error?.code).toBe("22023");
    expect(error?.message).toMatch(/one subject HMAC and one key check value per key id/);

    expect(await messageRow(bystanderMessageId)).toEqual(before);
    const bystanderNow = await admin.query<{ provider_user_id: string }>(
      "select provider_user_id::text from public.communication_messages where id = $1", [bystanderMessageId]);
    expect(bystanderNow.rows[0]!.provider_user_id).toBe(BYSTANDER.toString());

    const registryCountAfter = await admin.query<{ count: string }>(
      "select count(*)::text as count from app.telegram_erasures where workspace_id = $1", [WS_A]);
    expect(registryCountAfter.rows[0]!.count).toBe(registryCountBefore.rows[0]!.count);

    const auditAfter = await admin.query<{ count: string }>(
      "select count(*)::text as count from public.audit_events where organization_id = $1 and action = 'telegram_identity.erased'", [WS_A]);
    expect(auditAfter.rows[0]!.count).toBe(auditBefore.rows[0]!.count);
  });

  it("clears both markers before returning", async () => {
    const r = await asService<{ s: string | null; g: string | null }>("", WS_A, async (c) => {
      await c.query(ERASE_SQL, eraseArgs(WS_A, BYSTANDER, ONLY_K1));
      return c.query("select current_setting('app.erasure_subject', true) as s, current_setting('app.erasure_surrogate', true) as g");
    });
    expect(r.rows[0]).toEqual({ s: "", g: "" });
  });

  // §5's fix round: erase_telegram_identity_internal gained a fifth
  // parameter, p_scope, validated before any table is touched. Called
  // directly (not through the wrapper, which always passes 'all'), as
  // admin/owner — the retention job's own calling convention.
  it("erase_telegram_identity_internal rejects an unknown scope", async () => {
    let error: { code?: string; message?: string } | undefined;
    try {
      await admin.query("select * from app.erase_telegram_identity_internal($1::uuid, $2::bigint, null, 'retention', 'bogus')", [WS_A, BYSTANDER.toString()]);
    } catch (e) {
      error = e as { code?: string; message?: string };
    }
    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/unknown erasure scope bogus/);
  });

  // I2: SUBJECT was erased earlier in this describe block (the first case),
  // so a link row for SUBJECT already exists carrying the surrogate. A
  // person can link again after that — a second telegram_member_links row,
  // a fresh member, the raw id — and then be erased again; the same HMAC
  // resolves to the same surrogate, and the links UPDATE would try to give
  // this new row the surrogate the old row already holds, colliding on
  // telegram_member_links' unique (workspace_id, telegram_user_id). The
  // definer now refuses this before any write.
  it("refuses a repeat erasure after the subject linked again, before any write", async () => {
    const RELINK_USER = "f1f1f1f1-2222-4222-8222-222222222222";
    await admin.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
      values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'erasure-relink@example.test', '', now(), now())
      on conflict (id) do nothing`, [RELINK_USER]);
    const member = await admin.query<{ id: string }>(
      "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'member', 'active') returning id",
      [WS_A, RELINK_USER]);
    const relinkMemberId = member.rows[0]!.id;
    await admin.query(`insert into public.telegram_member_links
      (workspace_id, member_id, telegram_user_id, display_name_snapshot, username_snapshot, linked_by_member_id)
      values ($1, $2, $3, 'Петро Петренко', 'petrenko', $2)`, [WS_A, relinkMemberId, SUBJECT.toString()]);
    const linkBefore = await linkRow(relinkMemberId);
    const registryCountBefore = await admin.query<{ count: string }>(
      "select count(*)::text as count from app.telegram_erasures where workspace_id = $1", [WS_A]);

    let error: { code?: string; message?: string } | undefined;
    try {
      await call(ONLY_K1);
    } catch (e) {
      error = e as { code?: string; message?: string };
    }
    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/the subject was linked again after an earlier erasure in this workspace/);

    expect(await linkRow(relinkMemberId)).toEqual(linkBefore);
    const registryCountAfter = await admin.query<{ count: string }>(
      "select count(*)::text as count from app.telegram_erasures where workspace_id = $1", [WS_A]);
    expect(registryCountAfter.rows[0]!.count).toBe(registryCountBefore.rows[0]!.count);
  });
});

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

  it("refuses a batch of 0 or null", async () => {
    expect(await sqlstate(() => admin.query("select * from app.apply_communication_retention(0)"))).toBe("P0001");
    expect(await sqlstate(() => admin.query("select * from app.apply_communication_retention(null)"))).toBe("P0001");
  });

  it("redacts a sender whose messages are older than the customer_communication duration, with no HMAC in the registry — and never touches that sender's active member link (class confinement)", async () => {
    const ACTIVE_LINK_USER = "d1d1d1d1-2222-4222-8222-222222222222";
    // Defensive cleanup, same discipline as elsewhere in this file: a prior
    // interrupted run could leave this fixed identity behind.
    await admin.query("delete from public.telegram_member_links where workspace_id = $1 and telegram_user_id = $2", [WS_A, RETIRED.toString()]);
    await admin.query("delete from public.memberships where organization_id = $1 and user_id = $2", [WS_A, ACTIVE_LINK_USER]);
    await admin.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
      values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'erasure-active-link@example.test', '', now(), now())
      on conflict (id) do nothing`, [ACTIVE_LINK_USER]);
    const activeLinkMember = await admin.query<{ id: string }>(
      "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'member', 'active') returning id",
      [WS_A, ACTIVE_LINK_USER]);
    const activeLinkMemberId = activeLinkMember.rows[0]!.id;
    // RETIRED's OWN active link — never revoked — sharing the same identity
    // the stale message belongs to. spec §7.5: "Active links are operational
    // and are never aged out"; this is what pins that the communication
    // branch (scope 'communication') leaves it alone.
    await admin.query(`insert into public.telegram_member_links
      (workspace_id, member_id, telegram_user_id, display_name_snapshot, username_snapshot, linked_by_member_id)
      values ($1, $2, $3, 'Іван Старий', 'staryi', $2)`,
      [WS_A, activeLinkMemberId, RETIRED.toString()]);
    const linkBefore = await linkRow(activeLinkMemberId);

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

      // Class confinement: the same identity's active link is untouched —
      // still the raw telegram_user_id, still revoked_at NULL, snapshots
      // unchanged — byte-identical to before the run.
      const linkAfter = await linkRow(activeLinkMemberId);
      expect(linkAfter).toEqual(linkBefore);
      expect(linkAfter.telegram_user_id).toBe(RETIRED.toString());
      expect(linkAfter.revoked_at).toBeNull();

      // A second run must allocate no new surrogate: not just "affected: 0" on
      // the report, but the registry itself must be unchanged in row count.
      const registryBefore = await admin.query<{ count: string }>(
        "select count(*)::text as count from app.telegram_erasures where workspace_id = any($1::uuid[])", [[WS_A, WS_B]]);
      const again = await run();
      expect(again.rows.find((x) => x.data_class === "customer_communication")).toEqual({ data_class: "customer_communication", affected: "0" });
      const registryAfter = await admin.query<{ count: string }>(
        "select count(*)::text as count from app.telegram_erasures where workspace_id = any($1::uuid[])", [[WS_A, WS_B]]);
      expect(registryAfter.rows[0]!.count).toBe(registryBefore.rows[0]!.count);
    } finally { await setDuration("customer_communication", null); }
  });

  it("redacts a member link whose revocation is older than the customer_identity duration, with no HMAC in the registry — and never touches that same identity's fresh message (class confinement)", async () => {
    const STALE_LINK = 700004n;
    const STALE_USER = "e1e1e1e1-2222-4222-8222-222222222222";
    // Defensive cleanup: a prior interrupted run (RED-step artifact, crash)
    // could leave this fixed identity behind; start from a known-clean slate,
    // same discipline as the manual recovery this fix round is answering.
    await admin.query("delete from public.telegram_member_links where workspace_id = $1 and telegram_user_id = $2", [WS_A, STALE_LINK.toString()]);
    await admin.query("delete from public.memberships where organization_id = $1 and user_id = $2", [WS_A, STALE_USER]);
    await admin.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
      values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'erasure-stale@example.test', '', now(), now())
      on conflict (id) do nothing`, [STALE_USER]);
    const member = await admin.query<{ id: string }>(
      "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'member', 'active') returning id",
      [WS_A, STALE_USER]);
    const staleMemberId = member.rows[0]!.id;
    // verified_at must precede revoked_at (the table's own check constraint),
    // so both are backdated: verified 500 days ago, revoked 400 days ago —
    // older than the 365-day duration this case sets below.
    await admin.query(`insert into public.telegram_member_links
      (workspace_id, member_id, telegram_user_id, display_name_snapshot, username_snapshot, linked_by_member_id, verified_at, revoked_at)
      values ($1, $2, $3, 'Стара Ланка', 'stara', $2, now() - interval '500 days', now() - interval '400 days')`,
      [WS_A, staleMemberId, STALE_LINK.toString()]);
    // The same identity ALSO sent a message just now (server_received_at =
    // now()) — class confinement (scope 'identity') must leave it alone,
    // exactly as spec §7.5 confines customer_communication to messages/
    // events/attachments and customer_identity to links.
    const staleMessage = await admin.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, provider_user_id,
       provider_display_name_snapshot, provider_username_snapshot, server_received_at, delivery_state)
      values ($1, $2, $3, 'inbound', 'text', 'Свіже повідомлення', $4, 'Стара Ланка', 'stara', now(), 'received') returning id`,
      [WS_A, projectId, bindingId, STALE_LINK.toString()]);
    const staleMessageId = staleMessage.rows[0]!.id;
    const messageBefore = await messageRow(staleMessageId);

    await setDuration("customer_identity", "365 days");
    try {
      const r = await run();
      const found = r.rows.find((x) => x.data_class === "customer_identity")!;
      expect(found).toEqual({ data_class: "customer_identity", affected: "1" });

      const link = await admin.query<{ telegram_user_id: string; display_name_snapshot: string | null; username_snapshot: string | null }>(
        "select telegram_user_id::text, display_name_snapshot, username_snapshot from public.telegram_member_links where workspace_id = $1 and member_id = $2",
        [WS_A, staleMemberId]);
      expect(link.rows).toHaveLength(1);
      expect(Number(link.rows[0]!.telegram_user_id)).toBeLessThan(0);
      expect(link.rows[0]).toMatchObject({ display_name_snapshot: null, username_snapshot: null });

      const reg = await admin.query<{ origin: string; subject_hmac: string | null }>(
        "select origin, subject_hmac from app.telegram_erasures where workspace_id = $1 and surrogate_user_id = $2",
        [WS_A, link.rows[0]!.telegram_user_id]);
      expect(reg.rows).toEqual([{ origin: "retention", subject_hmac: null }]);

      // Class confinement: the fresh message is byte-identical to before —
      // raw provider_user_id, original text, unchanged snapshots.
      expect(await messageRow(staleMessageId)).toEqual(messageBefore);
    } finally { await setDuration("customer_identity", null); }
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

describe("§6 — the registry's keys carry key ids, and a rotation loses no match (BL-085)", () => {
  const SUBJECT_C = 700101n;
  const SPLIT = 700102n;
  let memberC: string;

  const callC = (uid: bigint, set: KeySet) => asService<{
    surrogate_user_id: string; messages: string; links: string; already_erased: boolean;
  }>("", WS_C, (c) => c.query(ERASE_SQL, eraseArgs(WS_C, uid, set)));
  const registryC = async () => (await admin.query<{ surrogate_user_id: string; subject_key_id: string | null; subject_hmac: string | null }>(
    "select surrogate_user_id::text, subject_key_id, subject_hmac from app.telegram_erasures where workspace_id = $1 order by surrogate_user_id", [WS_C])).rows;
  const auditCountC = async () => (await admin.query<{ count: string }>(
    "select count(*)::text as count from public.audit_events where organization_id = $1 and action = 'telegram_identity.erased'", [WS_C])).rows[0]!.count;
  const failure = async (fn: () => Promise<unknown>) => {
    try { await fn(); return { code: "ok", message: "" }; } catch (e) {
      const err = e as { code?: string; message?: string };
      return { code: err.code ?? "unknown", message: err.message ?? "" };
    }
  };

  beforeAll(async () => {
    await admin.query("insert into public.organizations (id, legal_name, display_name) values ($1, 'Erasure C', 'Erasure C')", [WS_C]);
    const member = await admin.query<{ id: string }>("insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'owner', 'active') returning id", [WS_C, OWNER]);
    memberC = member.rows[0]!.id;
    const project = await admin.query<{ id: string }>("insert into public.projects (workspace_id, name, created_by) values ($1, 'Erasure C', $2) returning id", [WS_C, OWNER]);
    await admin.query("insert into public.project_field_channels (workspace_id, project_id, channel) values ($1, $2, 'telegram')", [WS_C, project.rows[0]!.id]);
    const binding = await admin.query<{ id: string }>(`insert into public.telegram_chat_bindings
      (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
      values ($1, $2, 123456789, -100778, 'supergroup', $3) returning id`, [WS_C, project.rows[0]!.id, memberC]);
    await admin.query(`insert into public.communication_messages
      (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, provider_user_id, server_received_at, delivery_state)
      values ($1, $2, $3, 'inbound', 'text', 'Ключ', $4, now(), 'received')`, [WS_C, project.rows[0]!.id, binding.rows[0]!.id, SUBJECT_C.toString()]);
    await admin.query(`insert into public.telegram_member_links
      (workspace_id, member_id, telegram_user_id, display_name_snapshot, username_snapshot, linked_by_member_id)
      values ($1, $2, $3, 'Іван', 'ivan', $2)`, [WS_C, memberC, SUBJECT_C.toString()]);
  });

  it("an erasure under the old pepper's bytes stores the HMAC the pepper produced, with its key id", async () => {
    const r = await callC(SUBJECT_C, { active: "legacy", keys: [["legacy", LEGACY]] });
    expect(r.rows[0]!.already_erased).toBe(false);
    expect(await registryC()).toEqual([{
      surrogate_user_id: r.rows[0]!.surrogate_user_id, subject_key_id: "legacy", subject_hmac: subjectHmac(PEPPER, WS_C, SUBJECT_C),
    }]);
  });

  it("a repeat request under a rotated key set finds the same surrogate and moves the row to the active key", async () => {
    const [before] = await registryC();
    const r = await callC(SUBJECT_C, { active: "k2", keys: [["legacy", LEGACY], ["k2", K2]] });
    expect(r.rows[0]).toMatchObject({ already_erased: true, surrogate_user_id: before!.surrogate_user_id });
    expect(await registryC()).toEqual([{
      surrogate_user_id: before!.surrogate_user_id, subject_key_id: "k2", subject_hmac: hmacUnder(K2, WS_C, SUBJECT_C),
    }]);

    // The old key is no longer needed for this workspace.
    const again = await callC(SUBJECT_C, { active: "k2", keys: [["k2", K2]] });
    expect(again.rows[0]).toMatchObject({ already_erased: true, surrogate_user_id: before!.surrogate_user_id });
  });

  it("refuses a key set that omits a key id this workspace's registry holds, before any write", async () => {
    const reg = await registryC();
    const audit = await auditCountC();
    const f = await failure(() => callC(SUBJECT_C, { active: "k3", keys: [["k3", K3]] }));
    expect(f.code).toBe("P0001");
    expect(f.message).toMatch(/erasure key set does not cover key ids already in this workspace's registry: k2/);
    expect(await registryC()).toEqual(reg);
    expect(await auditCountC()).toBe(audit);
    expect((await admin.query("select 1 from app.telegram_erasure_keys where key_id = 'k3'")).rows).toHaveLength(0);
  });

  it("refuses a key id whose secret differs from the key first used under that id", async () => {
    const reg = await registryC();
    const f = await failure(() => callC(SUBJECT_C, { active: "k2", keys: [["k2", K3]] }));
    expect(f.code).toBe("P0001");
    expect(f.message).toMatch(/erasure key k2 does not match the key first used under that id/);
    expect(await registryC()).toEqual(reg);
  });

  it("refuses malformed key arguments with 22023 and writes nothing", async () => {
    const reg = await registryC();
    const hex = hmacUnder(K2, WS_C, SUBJECT_C);
    const cases: unknown[][] = [
      [WS_C, SUBJECT_C.toString(), "k2", ["k2"], [hex, hex], [checkValue(K2)]],
      [WS_C, SUBJECT_C.toString(), "k9", ["k2"], [hex], [checkValue(K2)]],
      [WS_C, SUBJECT_C.toString(), "k2", ["k2", "k2"], [hex, hex], [checkValue(K2), checkValue(K2)]],
      [WS_C, SUBJECT_C.toString(), "k2", ["k2"], ["zz"], [checkValue(K2)]],
      [WS_C, SUBJECT_C.toString(), "k2", [" "], [hex], [checkValue(K2)]],
      [WS_C, SUBJECT_C.toString(), "k2", ["k2"], [null], [checkValue(K2)]],
      [WS_C, SUBJECT_C.toString(), "k2", [], [], []],
      [WS_C, SUBJECT_C.toString(), "k2", Array.from({ length: 9 }, (_, i) => (i === 0 ? "k2" : `x${i}`)),
        Array(9).fill(hex), Array(9).fill(checkValue(K2))],
    ];
    for (const args of cases) {
      const f = await failure(() => asService("", WS_C, (c) => c.query(ERASE_SQL, args)));
      expect(f.code, JSON.stringify(args.slice(2, 4))).toBe("22023");
    }
    expect(await registryC()).toEqual(reg);
  });

  it("refuses when more than one registry row matches the subject — a person split before key ids — for the owner's decision", async () => {
    await admin.query(`insert into app.telegram_erasures (workspace_id, subject_hmac, subject_key_id, surrogate_user_id, origin)
      values ($1, $2, 'legacy', -900001, 'data_subject_request'), ($1, $3, 'k2', -900002, 'data_subject_request')`,
      [WS_C, hmacUnder(LEGACY, WS_C, SPLIT), hmacUnder(K2, WS_C, SPLIT)]);
    try {
      const reg = await registryC();
      const f = await failure(() => callC(SPLIT, { active: "k2", keys: [["legacy", LEGACY], ["k2", K2]] }));
      expect(f.code).toBe("P0001");
      expect(f.message).toMatch(/more than one registry row matches this subject/);
      expect(await registryC()).toEqual(reg);
    } finally {
      await admin.query("delete from app.telegram_erasures where workspace_id = $1 and surrogate_user_id in (-900001, -900002)", [WS_C]);
    }
  });

  it("rolls the re-key back when the re-link guard refuses the erasure", async () => {
    const RELINK_USER = "e1e1e1e1-2222-4222-8222-222222222222";
    await admin.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
      values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'erasure-relink-c@example.test', '', now(), now())
      on conflict (id) do nothing`, [RELINK_USER]);
    const member = await admin.query<{ id: string }>(
      "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'member', 'active') returning id", [WS_C, RELINK_USER]);
    await admin.query(`insert into public.telegram_member_links
      (workspace_id, member_id, telegram_user_id, display_name_snapshot, username_snapshot, linked_by_member_id)
      values ($1, $2, $3, 'Іван', 'ivan', $2)`, [WS_C, member.rows[0]!.id, SUBJECT_C.toString()]);
    const reg = await registryC();

    const f = await failure(() => callC(SUBJECT_C, { active: "k4", keys: [["k2", K2], ["k4", K4]] }));
    expect(f.code).toBe("P0001");
    expect(f.message).toMatch(/the subject was linked again after an earlier erasure in this workspace/);
    expect(await registryC()).toEqual(reg);
    expect((await admin.query("select 1 from app.telegram_erasure_keys where key_id = 'k4'")).rows).toHaveLength(0);
  });

  it("constrains the key id: not blank, and present exactly when an HMAC is", async () => {
    const hex = hmacUnder(K2, WS_C, 1n);
    const insert = (hmac: string | null, keyId: string | null, surrogate: number, origin: string) => sqlstate(() => admin.query(
      "insert into app.telegram_erasures (workspace_id, subject_hmac, subject_key_id, surrogate_user_id, origin) values ($1, $2, $3, $4, $5)",
      [WS_C, hmac, keyId, surrogate, origin]));
    expect(await insert(hex, "  ", -900010, "data_subject_request")).toBe("23514");
    expect(await insert(hex, null, -900011, "data_subject_request")).toBe("23514");
    expect(await insert(null, "k2", -900012, "retention")).toBe("23514");
    const intents = await admin.query<{ table_name: string; is_nullable: string }>(`select table_name, is_nullable from information_schema.columns
      where table_schema = 'public' and column_name = 'verifier_key_id'
        and table_name in ('telegram_binding_intents', 'telegram_member_link_intents') order by table_name`);
    expect(intents.rows).toEqual([
      { table_name: "telegram_binding_intents", is_nullable: "NO" },
      { table_name: "telegram_member_link_intents", is_nullable: "NO" },
    ]);
  });

  it("replaces the keyless signatures, and only the service principal may call the new ones", async () => {
    const gone = await admin.query(`select
      to_regprocedure('app.erase_telegram_identity(uuid,bigint,text)') is null as erase,
      to_regprocedure('app.erase_telegram_identity_internal(uuid,bigint,text,text,text)') is null as internal,
      to_regprocedure('app.consume_telegram_binding_intent(text,bigint,bigint,text,text,bigint)') is null as binding,
      to_regprocedure('app.consume_telegram_member_link_intent(text,bigint,text,text)') is null as member`);
    expect(gone.rows[0]).toEqual({ erase: true, internal: true, binding: true, member: true });
    const grants = await admin.query(`select r.rolname,
      has_function_privilege(r.rolname, 'app.erase_telegram_identity(uuid,bigint,text,text[],text[],text[])', 'EXECUTE') as erase,
      has_function_privilege(r.rolname, 'app.erase_telegram_identity_internal(uuid,bigint,text,text,text,text)', 'EXECUTE') as internal,
      has_function_privilege(r.rolname, 'app.consume_telegram_binding_intent(text[],text[],bigint,bigint,text,text,bigint)', 'EXECUTE') as binding,
      has_function_privilege(r.rolname, 'app.consume_telegram_member_link_intent(text[],text[],bigint,text,text)', 'EXECUTE') as member,
      has_table_privilege(r.rolname, 'app.telegram_erasure_keys', 'SELECT') as keys
      from pg_roles r where r.rolname in ('anon', 'authenticated', 'goproceed_app', 'goproceed_service') order by 1`);
    expect(grants.rows).toEqual([
      { rolname: "anon", erase: false, internal: false, binding: false, member: false, keys: false },
      { rolname: "authenticated", erase: false, internal: false, binding: false, member: false, keys: false },
      { rolname: "goproceed_app", erase: false, internal: false, binding: false, member: false, keys: false },
      { rolname: "goproceed_service", erase: true, internal: false, binding: true, member: true, keys: false },
    ]);
  });
});
