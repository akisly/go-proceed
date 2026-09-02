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
  // dropWorkspaces (./pg) scans schema `public` only; the registry lives in
  // schema `app` (§1) and needs its own cleanup so a repeat run starts clean.
  await admin.query("delete from app.telegram_erasures where workspace_id = any($1::uuid[])", [[WS_A, WS_B]]);
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

  it("refuses the member plane", async () => {
    expect(await sqlstate(() => asActor(OWNER, WS_A, (c) => c.query("select * from app.erase_telegram_identity($1::uuid, 1::bigint, repeat('a', 64))", [WS_A])))).toBe("42501");
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
        c.query("select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text)",
          [WS_B, SUBJECT.toString(), subjectHmac(PEPPER, WS_B, SUBJECT)]));
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
  // real — this case needs BYSTANDER still intact. A NULL HMAC is rejected by
  // app.erase_telegram_identity's own validation before it ever calls the
  // internal transformation, so nothing — registry, audit, or redaction —
  // should exist as a result of this call.
  it("a failure raised before the transformation runs leaves the registry, the audit trail, and the bystander's row untouched", async () => {
    const before = await messageRow(bystanderMessageId);
    const registryCountBefore = await admin.query<{ count: string }>(
      "select count(*)::text as count from app.telegram_erasures where workspace_id = $1", [WS_A]);
    const auditBefore = await admin.query<{ count: string }>(
      "select count(*)::text as count from public.audit_events where organization_id = $1 and action = 'telegram_identity.erased'", [WS_A]);

    let error: { code?: string; message?: string } | undefined;
    try {
      await asService("", WS_A, (c) =>
        c.query("select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text)", [WS_A, BYSTANDER.toString(), null]));
    } catch (e) {
      error = e as { code?: string; message?: string };
    }
    expect(error?.code).toBe("P0001");
    // Distinguishes the wrapper's own HMAC-format check from the internal
    // function's origin/HMAC-pairing check — both are P0001 today.
    expect(error?.message).toMatch(/subject HMAC the application computed/);

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
      await c.query("select * from app.erase_telegram_identity($1::uuid, $2::bigint, $3::text)", [WS_A, BYSTANDER.toString(), subjectHmac(PEPPER, WS_A, BYSTANDER)]);
      return c.query("select current_setting('app.erasure_subject', true) as s, current_setting('app.erasure_surrogate', true) as g");
    });
    expect(r.rows[0]).toEqual({ s: "", g: "" });
  });
});
