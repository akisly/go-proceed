import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient } from "./pg";
import { asActor, asService } from "./pg";
import {
  seedM2World, grantM2Capabilities, seedAssignment, dropM2Workspaces, type M2Fixture,
} from "./m2-fixture";

// The whole boundary is role membership. If goproceed_app_login can reach
// goproceed_service, every guarantee built on top of it is decoration.

let c: Client;

beforeAll(async () => { c = await adminClient(); });
afterAll(async () => { await c.end(); });

/** Runs SQL and reports the SQLSTATE, or null when it succeeded. */
async function sqlstate(fn: () => Promise<unknown>): Promise<string | null> {
  try { await fn(); return null; } catch (e) { return (e as { code?: string }).code ?? "unknown"; }
}

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
        where rolname in ('goproceed_service','goproceed_service_login') order by 1`);
    expect(r.rows).toEqual([
      { rolname: "goproceed_service", rolcanlogin: false, rolbypassrls: false },
      { rolname: "goproceed_service_login", rolcanlogin: true, rolbypassrls: false },
    ]);
  });

  it("can do everything the application role can", async () => {
    // Membership, not a duplicated grant surface: the server is the app plus
    // the right to speak for itself.
    expect(await memberOf("goproceed_app")).toContain("goproceed_service");
  });

  it("is unreachable from the application login", async () => {
    // The direction that matters. goproceed_app_login must never be able to
    // SET ROLE its way into asserting server facts.
    //
    // The migration owner is filtered out rather than asserted. PostgreSQL 16+
    // auto-grants the creating role admin-option membership in every role it
    // creates, so 'postgres' appears here — and on goproceed_app from migration
    // 0003, where nothing ever looked. That is role bookkeeping, not a hole:
    // the owner runs the migrations and can do anything regardless.
    const members = (await memberOf("goproceed_service")).filter((m) => m !== "postgres");
    expect(members).toEqual(["goproceed_service_login"]);
    expect(members).not.toContain("goproceed_app_login");
    expect(members).not.toContain("goproceed_app");
  });

  it("refuses the application login an actual SET ROLE", async () => {
    // Asserting the catalog is not the same as attempting the move.
    const { Client } = await import("pg");
    const app = new Client({ connectionString: process.env.APP_DB_URL
      ?? "postgresql://goproceed_app_login:app_pw@127.0.0.1:54322/postgres" });
    await app.connect();
    try {
      let code = "";
      try { await app.query("set role goproceed_service"); }
      catch (e) { code = (e as { code?: string }).code ?? "unknown"; }
      expect(code).toBe("42501");
    } finally { await app.end(); }
  });
});

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

  // device_capture_id is NOT NULL with no default, and PostgreSQL checks column
  // constraints before the RLS WITH CHECK — omitting it turns every refusal in
  // this block into 23502 and hides which mechanism actually stopped the write.
  const captureEvent = (source: string) =>
    `insert into public.capture_events
       (workspace_id, project_id, work_assignment_id, upload_intent_id,
        device_capture_id, client_state, event_source)
     values ('${f.workspaceId}','${f.projectId}','${assignmentId}','${intentId}',
             '${crypto.randomUUID()}','failed','${source}')`;

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
    //
    // The privilege denies before the body runs: 0035 revokes execute from
    // goproceed_app, so a member connection is stopped at the door and never
    // reaches the guard's own raise inside the body. Asserting the SQLSTATE
    // rather than the message is what makes the revoke's removal visible — the
    // guard's raise text also matches /service/i, so a message-based assertion
    // would pass whether or not the revoke exists.
    const code = await sqlstate(() => asActor(USER_S, WS_S, (cl) => cl.query(
      `select * from app.finalize_upload_intent($1,$2,$3,$4,$5,$6,$7)`,
      [f.workspaceId, intentId, "d".repeat(64), 11, "image/jpeg", "passed", "probe"])));
    expect(code).toBe("42501");

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

  /**
   * THE INHERITED READ, AND THE BOUND NOBODY HAD WRITTEN DOWN.
   *
   * `goproceed_service` is a member of `goproceed_app` (0034), deliberately:
   * that migration rejects a parallel grant surface because «every future table
   * grant had to be made twice — a divergence nobody would notice until a
   * policy quietly stopped applying». The cost is that the service role
   * INHERITS the application's whole grant surface — measured 2026-08-18:
   * SELECT on 50 tables, INSERT on 48, UPDATE on 24 — while holding direct
   * grants on only two (`readiness_projection`, `blocked_reasons`).
   *
   * `tenancy-and-security.md` recorded that as an open least-privilege
   * deviation and named ONE table, `evidence_objects`. Both TODOS.md and that
   * document then described the deviation without its bound, which is the part
   * that actually decides how much it matters: `goproceed_service` is
   * NOBYPASSRLS, and `withServiceTx` keeps the CALLER's `app.actor_user_id`.
   * So the grant is wide and the reach is not — every row the service
   * connection can see is a row the acting member could already see.
   *
   * These two cases are that sentence, made falsifiable. THE FIXTURE MATTERS:
   * they run after evidence exists, because the first version of this probe was
   * written against an empty table and «zero rows visible» proved nothing at
   * all — a passing assertion about a database with nothing in it.
   */
  describe("the inherited SELECT is bounded by RLS, not by the grant", () => {
    it("shows the entitled actor their own evidence through the service connection", async () => {
      // The positive control. Without it the negative case below passes on an
      // empty table, which is exactly how this was nearly got wrong.
      const r = await asService(USER_S, WS_S, (cl) => cl.query<{ n: string }>(
        `select count(*) n from public.evidence_objects where upload_intent_id = $1`, [intentId]));
      expect(r.rows[0]!.n).toBe("1");
    });

    it("hides that same evidence from a service connection acting for a stranger", async () => {
      // Same connection, same role, same inherited grant — a different actor.
      // If this ever returns 1, the deviation has stopped being bounded and the
      // membership edge is a real read of another tenant's evidence.
      const stranger = "5e999999-9999-9999-9999-999999999999";
      const r = await asService(stranger, WS_S, (cl) => cl.query<{ n: string }>(
        `select count(*) n from public.evidence_objects where upload_intent_id = $1`, [intentId]));
      expect(r.rows[0]!.n).toBe("0");
    });
  });
});
