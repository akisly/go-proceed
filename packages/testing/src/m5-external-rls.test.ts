import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import type { Client } from "pg";
import { adminClient, asActor, asExternalSession } from "./pg";
import { dropRulesWorkspaces, seedRulesWorld, type RulesFixture } from "./m1-rules-fixture";
import {
  recordDecision, seedClosureWorld, type ClosureWorld, APPROVER_ROLE,
} from "./m3-closure-fixture";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `tsc`, `psql` and `supabase` were never run against it, no
 * migration was applied, and no claim is made that any assertion below passes.
 * Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * THE SWEEP `packages/database/src/tx.ts` PROMISED, WRITTEN 2026-08-08.
 *
 * `withExternalTx`'s header records the decision that there is no third
 * database role — the external plane is `goproceed_app` with an EMPTY actor GUC
 * and a session GUC — and names the one residual risk that decision does not
 * close:
 *
 *     «a table gaining a permissive policy that reads neither subject —
 *      packages/testing/src/m5-external-rls.test.ts is where that is caught, by
 *      sweeping every base table from an external session and asserting the
 *      reachable set.»
 *
 * BETWEEN M5 AND TODAY THAT FILE DID NOT EXIST. The sentence named a mitigation
 * nobody had written, which is the worst shape a security note can take: it
 * reads as coverage. What existed was `m5-external-schema.test.ts:628`, a
 * hand-written list of fourteen tables asserted to return zero — which proves
 * those fourteen and says nothing about the fifty-third table somebody adds
 * next quarter. This file is the sweep, and it is deliberately built the other
 * way round: it enumerates `pg_class` and `pg_policies` at run time and asserts
 * over EVERYTHING it finds, so a new table or a new policy is in scope the
 * moment it is created, without anyone remembering to add it here.
 *
 * THE FOUR QUESTIONS, AND WHY THE LAST TWO EXIST.
 *
 *   §1 Is every base table in `public` under RLS at all? A table without it is
 *      not narrowed by any of the sixteen external policies — it is open to
 *      every grantee, and «no matching policy denies» never gets a chance to
 *      run.
 *
 *   §2 Can any PERMISSIVE policy granted to `goproceed_app` be satisfied by a
 *      transaction with no subject? This is the residual risk in its exact
 *      form, and it is asked STRUCTURALLY — of the policy expression, not of a
 *      row count — because §3 cannot ask it: a table that is empty returns zero
 *      rows to a wide-open policy exactly as it does to a closed one, and most
 *      of this database's tables are empty in any one fixture. §2 is the half
 *      that survives an empty table, §3 is the half that survives a policy
 *      whose expression reads a subject and gets the comparison wrong.
 *
 *   §3 What does a LIVE external session actually reach? Every base table,
 *      counted, compared against one exact map. Not «these fourteen are zero» —
 *      «these are the eight that are not, with these counts, and every other
 *      table in the schema is zero or has no privilege at all».
 *
 *   §4 What does a transaction with NEITHER subject reach? `withAnonymousTx`
 *      claims «it can reach exactly two things», both `SECURITY DEFINER`
 *      functions, and «every table policy denies it». That is a claim about
 *      fifty-three tables and it is checked against all of them.
 *
 * WHAT THIS SUITE CANNOT PROVE, NAMED SO IT IS NOT MISTAKEN FOR PROVED:
 *
 *   THE ZEROS OF AN EMPTY TABLE ARE WEAK. §3 asserts zero for tables this
 *   fixture never populates — `valuation_allocations`, `progress_entries`,
 *   `stage_closures`, `statutory_acts` among them. Their zero is consistent
 *   with a correct policy AND with a wide-open one. §2 is what actually covers
 *   them, and §3 asserts a non-empty control for the tables that carry the
 *   money and the navigation, so at least those zeros are policy zeros.
 *
 *   §2 READS THE POLICY EXPRESSION AS TEXT. A policy that reaches a subject
 *   through a wrapper function this file does not know about would be reported
 *   as an offender — a false alarm whose fix is to add the wrapper to
 *   `SUBJECT_PREDICATES` after reading it. The opposite error is not possible:
 *   a policy that names none of these cannot be reading a subject.
 *
 *   IT SAYS NOTHING ABOUT STORAGE. `storage.objects` is Supabase's table in
 *   another schema with its own policies; tenancy-and-security.md §"Storage
 *   RLS" governs it and nothing here sweeps it.
 */

const WS_A = "f5c11111-1111-1111-1111-111111111111";
const WS_B = "f5c22222-2222-2222-2222-222222222222";
const USER_A = "f5c33333-3333-3333-3333-333333333333";
const USER_B = "f5c44444-4444-4444-4444-444444444444";

/** Any 32 bytes: this suite tests policies, never cryptography. */
const verifier = (seed: string): Buffer =>
  createHash("sha256").update(seed, "utf8").digest();

const DECIDING = { "external.view_scope": true, "external.decide_evidence": true };

/**
 * Every function through which a policy in this database can learn WHO is
 * asking. Two families, and a policy that names none of them is asking about
 * nothing.
 *
 *   member  — `app.current_actor()` and the three helpers that resolve a
 *             membership or a capability from it. All of them return NULL or
 *             false when the actor GUC is "", which is what the external plane
 *             and the anonymous plane both set it to.
 *   external — the five migration 0049 §7 adds, and the lineage walker 0055
 *             adds beside them. All of them return NULL — or, for the walker,
 *             the empty set — when the session GUC is empty, when an actor GUC
 *             is present, or when the session behind it is expired, revoked or
 *             replaced.
 *
 * `app.external_session_lineage()` was added here after reading it, which is the
 * remedy this file's own header prescribes for a wrapper it does not yet know.
 * It is subject-bound in the only way that matters: the anchor of its recursive
 * term is `where s.id = app.current_external_session()`, so with no session the
 * CTE has no starting row and the set is empty — a policy naming it matches
 * nothing. It walks `rotated_from_session_id` upwards only, so it can never
 * reach a session the caller did not descend from.
 */
const SUBJECT_PREDICATES = [
  "app.current_actor",
  "app.active_member_id",
  "app.member_role",
  "app.has_project_capability",
  "app.current_external_session",
  "app.external_session_scope",
  "app.external_session_occurrence",
  "app.external_session_workspace",
  "app.external_session_may_decide",
  "app.external_session_lineage",
] as const;

/**
 * The tables whose zero in §3 must be a POLICY zero and not an empty-table
 * zero. Each is populated by the fixtures below, and each is something the
 * reviewer must not see: the price, the plan, the tenant, the people.
 * tenancy-and-security.md: a grant «grants no workspace navigation, project
 * discovery, arbitrary storage listing … or access to a sibling occurrence».
 */
const MUST_BE_POPULATED = [
  "organizations", "memberships", "projects", "contracts", "contract_versions",
  "work_items", "work_assignments", "work_stages", "project_access_grants",
  "requirement_library_items", "requirement_rule_versions",
  "contract_version_rule_bindings", "parties",
] as const;

let c: Client;
let a: RulesFixture;
let b: RulesFixture;
let wa: ClosureWorld;
let wb: ClosureWorld;
/** The session the whole suite looks through. Scope: `wa.blockingA`. */
let sessionId: string;
let grantId: string;

const GRANT_INSERT = `
  insert into public.external_access_grants
    (workspace_id, project_id, contract_id, scope_kind, requirement_occurrence_id,
     token_hmac, hmac_key_id, recipient_email, recipient_role, permissions,
     expires_at, issued_by_member_id, decide_role, decides_evidence, status)
  values ($1::uuid,$2::uuid,$3::uuid,'requirement_occurrence',$4::uuid,
          $5::bytea,'k1',$6::text,$7::text,$8::jsonb,
          now() + interval '7 days',$9::uuid,$7::text,true,'active')
  returning id`;

async function insertGrant(w: ClosureWorld, occurrenceId: string, seed: string): Promise<string> {
  const r = await c.query<{ id: string }>(GRANT_INSERT, [
    w.rules.workspaceId, w.rules.projectId, w.rules.contractId, occurrenceId,
    verifier(seed), "prykladtechnahliad@example.test", APPROVER_ROLE,
    JSON.stringify(DECIDING), w.rules.memberId,
  ]);
  return r.rows[0]!.id;
}

async function insertSession(
  w: ClosureWorld, grant: string, occurrenceId: string, seed: string,
): Promise<string> {
  const r = await c.query<{ id: string }>(
    `insert into public.external_sessions
       (workspace_id, external_access_grant_id, requirement_occurrence_id,
        session_verifier, csrf_verifier, verifier_key_id,
        idle_expires_at, absolute_expires_at, grant_revocation_version, status)
     values ($1,$2,$3,$4,$5,'s1', now() + interval '30 minutes',
             now() + interval '12 hours', 0, 'active')
     returning id`,
    [w.rules.workspaceId, grant, occurrenceId, verifier(`s-${seed}`), verifier(`c-${seed}`)]);
  return r.rows[0]!.id;
}

async function insertBatch(
  w: ClosureWorld, grant: string, session: string, occurrenceId: string,
): Promise<string> {
  const r = await c.query<{ id: string }>(
    `insert into public.external_decision_batches
       (workspace_id, project_id, requirement_occurrence_id, external_access_grant_id,
        external_session_id, confirmation_text_version, server_received_at,
        idempotency_key, request_hash, receipt_hash, grant_decides_evidence)
     values ($1,$2,$3,$4,$5,'external-occurrence-decision/1+deadbeefcafe',now(),
             $6,$7,$8,true)
     returning id`,
    [w.rules.workspaceId, w.rules.projectId, occurrenceId, grant, session,
     `idem-${randomUUID()}`, "a".repeat(64), verifier(`r-${session}`)]);
  return r.rows[0]!.id;
}

/**
 * An intent and the evidence finalised from it, agreeing on hash, size, bucket
 * and key exactly as `eo_insert` (0023) requires — even though this fixture
 * writes as the table owner and that policy never runs. A fixture that wrote a
 * shape the product cannot produce would make the sweep a sweep of a database
 * nobody has.
 */
async function seedEvidence(
  w: ClosureWorld, occurrenceId: string | null, status: string, seed: string,
): Promise<{ intentId: string; evidenceId: string }> {
  const f = w.rules;
  const key = `${randomUUID()}/${seed}`;
  const hash = createHash("sha256").update(seed, "utf8").digest("hex");
  const intent = await c.query<{ id: string }>(
    `insert into public.upload_intents
       (workspace_id, project_id, work_assignment_id, requirement_occurrence_id,
        created_by_member_id, origin_method, idempotency_key, request_hash,
        expected_byte_size, expected_content_hash, allowed_content_family,
        claimed_media_type, status, staging_bucket, staging_storage_key, expires_at)
     values ($1,$2,$3,$4,$5,'native_camera',$6,repeat('a',64),
             11,$7,'image','image/jpeg',$8,'evidence',$9, now() + interval '1 day')
     returning id`,
    [f.workspaceId, f.projectId, w.assignmentId, occurrenceId, f.memberId,
     `intent-${seed}`, hash, status, key]);
  const intentId = intent.rows[0]!.id;
  const evidence = await c.query<{ id: string }>(
    `insert into public.evidence_objects
       (workspace_id, project_id, content_hash, byte_size, media_type,
        storage_bucket, storage_key, storage_provider, origin_method,
        recorder_member_id, upload_intent_id, inspection_status,
        inspection_policy_version, server_received_at)
     values ($1,$2,$3,11,'image/jpeg','evidence',$4,'supabase','native_camera',
             $5,$6,'passed','test',now())
     returning id`,
    [f.workspaceId, f.projectId, hash, key, f.memberId, intentId]);
  return { intentId, evidenceId: evidence.rows[0]!.id };
}

/** Every base table in `public`, from the catalog and never from a list. */
async function baseTables(): Promise<string[]> {
  const r = await c.query<{ t: string }>(
    `select cl.relname as t
       from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
      where n.nspname = 'public' and cl.relkind in ('r','p')
      order by 1`);
  return r.rows.map((x) => x.t);
}

/**
 * What one table answered: a row count, `"denied"` for 42501, or
 * `"error:CODE"` for anything else — which is never expected and must show up
 * in the diff rather than be collapsed into a zero.
 */
type Reach = number | string;

/**
 * Count every table through ONE transaction, with a savepoint per statement.
 *
 * The savepoint is not a nicety: a `permission denied` aborts the transaction,
 * and without a rollback to a savepoint every table after the first denial
 * would report `25P02` instead of its own answer — a sweep that stops looking
 * after the first `audit_events`.
 */
async function sweep(
  tables: readonly string[],
  runner: (fn: (x: Client) => Promise<void>) => Promise<unknown>,
): Promise<Record<string, Reach>> {
  const out: Record<string, Reach> = {};
  await runner(async (x) => {
    for (const t of tables) {
      await x.query("savepoint probe");
      try {
        const r = await x.query<{ n: number }>(`select count(*)::int as n from public."${t}"`);
        out[t] = r.rows[0]!.n;
        await x.query("release savepoint probe");
      } catch (e) {
        // 42501 is «no privilege on the table», which is a different and
        // stronger answer than «the policy matched nothing»: it means the
        // GRANT was never made, so no future policy can open it either.
        const code = (e as { code?: string }).code;
        out[t] = code === "42501" ? "denied" : `error:${code}`;
        await x.query("rollback to savepoint probe");
      }
    }
  });
  return out;
}

beforeAll(async () => {
  c = await adminClient();
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  a = await seedRulesWorld(c, { workspaceId: WS_A, userId: USER_A, suffix: "М5Р-А" });
  b = await seedRulesWorld(c, { workspaceId: WS_B, userId: USER_B, suffix: "М5Р-Б" });
  wa = await seedClosureWorld(c, a);
  wb = await seedClosureWorld(c, b);

  // THE SESSION UNDER TEST, and beside it everything it must not see: a second
  // grant, session and receipt on the SIBLING occurrence of the SAME stage of
  // the SAME assignment, which is the nearest row in the database and the one a
  // policy comparing the wrong column would return.
  grantId = await insertGrant(wa, wa.blockingA, "grant-a");
  sessionId = await insertSession(wa, grantId, wa.blockingA, "session-a");
  await insertBatch(wa, grantId, sessionId, wa.blockingA);

  const siblingGrant = await insertGrant(wa, wa.blockingB, "grant-b");
  const siblingSession = await insertSession(wa, siblingGrant, wa.blockingB, "session-b");
  await insertBatch(wa, siblingGrant, siblingSession, wa.blockingB);

  // And the same three in ANOTHER WORKSPACE, so «zero» is also a tenant answer.
  const foreignGrant = await insertGrant(wb, wb.blockingA, "grant-foreign");
  const foreignSession = await insertSession(wb, foreignGrant, wb.blockingA, "session-foreign");
  await insertBatch(wb, foreignGrant, foreignSession, wb.blockingA);

  // The lineage the reviewer is entitled to read, and one they are not.
  await recordDecision(c, wa, { occurrenceId: wa.blockingA, outcome: "returned" });
  await recordDecision(c, wa, { occurrenceId: wa.blockingB, outcome: "accepted" });

  // Three intents, three evidence objects, ONE of which is in scope: the other
  // two differ only by the occurrence they hang off and by the intent status,
  // which are exactly the two columns `ui_external_select` and
  // `eo_external_select` compare.
  await seedEvidence(wa, wa.blockingA, "available", "in-scope");
  await seedEvidence(wa, wa.blockingA, "scan_pending", "not-yet-available");
  await seedEvidence(wa, wa.blockingB, "available", "sibling-occurrence");
});

afterAll(async () => {
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  await c.end();
});

describe("§1 — every base table in public is under row level security", () => {
  it("has RLS enabled on every one of them, with no exception list", async () => {
    const r = await c.query<{ t: string }>(
      `select cl.relname as t
         from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
        where n.nspname = 'public' and cl.relkind in ('r','p')
          and cl.relrowsecurity = false
        order by 1`);
    // A table without RLS is not «denied by default» — it is granted by
    // default to every role holding a privilege on it, and the whole external
    // plane rests on the opposite being true.
    expect(r.rows.map((x) => x.t)).toEqual([]);
  });

  it("and the one RLS table with no policy is also the one with no grant", async () => {
    // `outbox_dead_letters` is the only base table in this schema carrying RLS
    // and no policy at all, and it is closed TWICE: 0008 revoked it from
    // public/anon/authenticated and 0037 took the last grant back off
    // goproceed_worker, so `goproceed_app` reaches it by neither privilege nor
    // policy. Both halves are asserted, because a future migration that granted
    // select «just for debugging» would leave the policy count at zero and this
    // sentence would still read as true.
    const r = await c.query<{ rls: boolean; sel: boolean; pols: number }>(
      `select cl.relrowsecurity as rls,
              has_table_privilege('goproceed_app','public.outbox_dead_letters','select') as sel,
              (select count(*)::int from pg_policies p
                where p.schemaname = 'public' and p.tablename = 'outbox_dead_letters') as pols
         from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
        where n.nspname = 'public' and cl.relname = 'outbox_dead_letters'`);
    expect(r.rows[0]).toEqual({ rls: true, sel: false, pols: 0 });
  });
});

describe("§2 — no permissive policy can be satisfied without a subject", () => {
  it("every permissive policy granted to goproceed_app names a subject predicate", async () => {
    const r = await c.query<{
      tablename: string; policyname: string; cmd: string; expr: string;
    }>(
      `select tablename, policyname, cmd,
              coalesce(qual,'') || ' ' || coalesce(with_check,'') as expr
         from pg_policies
        where schemaname = 'public'
          and permissive = 'PERMISSIVE'
          and 'goproceed_app' = any(roles)
        order by tablename, policyname`);
    // Every one of them, read or write. A permissive INSERT policy that names
    // no subject is a row anybody can write; a permissive SELECT policy that
    // names none is a row everybody can read — and the external plane and the
    // anonymous plane are both «anybody» as far as the member helpers are
    // concerned, because their actor GUC is "".
    const offenders = r.rows
      .filter((p) => !SUBJECT_PREDICATES.some((s) => p.expr.includes(s)))
      .map((p) => `${p.tablename}.${p.policyname} (${p.cmd})`);
    expect(offenders).toEqual([]);
    // The sweep must have found policies at all: an empty catalog read would
    // make the assertion above pass by vacuity, which is the failure mode of
    // every test that filters before it asserts.
    expect(r.rows.length).toBeGreaterThan(100);
  });

  it("the two service-role policies that use `true` are NOT granted to goproceed_app", async () => {
    // `rp_write_server` and `br_write_server` (0045) are `for all to
    // goproceed_service using (true)`. They are correct — the projections are the
    // server's own — and they are the reason the query above filters by role
    // rather than by expression. This pins the filter: if one of them ever
    // gains goproceed_app, the assertion above must fail rather than this one.
    const r = await c.query<{ policyname: string; roles: string }>(
      `select policyname, array_to_string(roles, ',') as roles
         from pg_policies
        where schemaname = 'public'
          and coalesce(qual,'') = 'true'
        order by policyname`);
    for (const p of r.rows) expect({ p: p.policyname, roles: p.roles }).toEqual(
      { p: p.policyname, roles: "goproceed_service" });
    // Both of them, or the loop above proved nothing by having nothing to
    // iterate over.
    expect(r.rows.map((p) => p.policyname).sort())
      .toEqual(["br_write_server", "rp_write_server"]);
  });
});

describe("§3 — what a live external session reaches, over every table there is", () => {
  it("reaches exactly eight tables, with exactly these rows", async () => {
    const tables = await baseTables();
    const priv = await c.query<{ t: string; sel: boolean }>(
      `select cl.relname as t,
              has_table_privilege('goproceed_app', 'public.' || quote_ident(cl.relname), 'select') as sel
         from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
        where n.nspname = 'public' and cl.relkind in ('r','p')`);
    const noSelect = new Set(priv.rows.filter((x) => !x.sel).map((x) => x.t));

    // AUDIT IS WRITABLE AND UNREADABLE, and that is a property rather than an
    // accident: 0006:29 revokes SELECT on audit_events from goproceed_app and
    // 0003:64 grants the outbox INSERT only, so the two tables an external
    // command WRITES (0049 §10's `audit_insert_external` and
    // `outbox_insert_external`) are the two it can never read back.
    expect([...noSelect].sort()).toContain("audit_events");
    expect([...noSelect].sort()).toContain("transaction_outbox");

    /** The eight, and why each is not zero. */
    const VISIBLE: Record<string, number> = {
      // ONE obligation. Not the sibling on the same stage, not the advisory one
      // beside it, not the other stage's, not the other assignment's.
      requirement_occurrences: 1,
      // The available intent of THIS occurrence. The `scan_pending` one on the
      // same occurrence and the available one on the sibling are both out.
      upload_intents: 1,
      evidence_objects: 1,
      // The lineage of this occurrence — including the internal decision, which
      // the reviewer is meant to read: it is what they are appending to.
      requirement_evidence_decisions: 1,
      requirement_evidence_decision_heads: 1,
      // Its own grant, its own session, its own receipt. Not the sibling's,
      // not the other workspace's.
      external_access_grants: 1,
      external_sessions: 1,
      external_decision_batches: 1,
    };

    const expected: Record<string, Reach> = {};
    for (const t of tables) expected[t] = noSelect.has(t) ? "denied" : (VISIBLE[t] ?? 0);

    const actual = await sweep(tables, (fn) =>
      asExternalSession(sessionId, WS_A, fn));

    // ONE assertion over the whole schema. A table added tomorrow with a
    // permissive policy shows up here as an unexpected count without anybody
    // adding a line to this file — which is the entire difference between this
    // sweep and the fourteen-table list it replaces.
    expect(actual).toEqual(expected);
  });

  it("and the one occurrence it reaches is the granted one", async () => {
    const r = await asExternalSession<{ id: string }>(sessionId, WS_A, (x) =>
      x.query("select id from public.requirement_occurrences"));
    expect(r.rows.map((x) => x.id)).toEqual([wa.blockingA]);
  });

  it("the zeros over the money and the plan are POLICY zeros, not empty tables", async () => {
    // Without this, «work_items: 0» would be indistinguishable from «this
    // fixture never wrote a work item», and the strongest assertion in §3 would
    // be proving nothing at all.
    for (const t of MUST_BE_POPULATED) {
      const r = await c.query<{ n: number }>(`select count(*)::int as n from public."${t}"`);
      expect({ t, populated: r.rows[0]!.n > 0 }).toEqual({ t, populated: true });
    }
  });

  it("names the tables whose zero this fixture cannot make meaningful", async () => {
    // NOT A PASS-BY-DEFAULT. These are the tables §3 reports as zero while
    // being empty, so their zero is consistent with a wide-open policy; §2 is
    // what covers them. The list is asserted to be a SUBSET of what is known to
    // be unpopulated here, so a fixture that later seeds one of them makes this
    // case fail and forces the list to shrink rather than silently rot.
    const weak = ["valuation_allocations", "progress_entries", "progress_allocation_heads",
                  "stage_closures", "stage_closure_occurrences", "statutory_acts",
                  "statutory_act_versions", "readiness_projection", "blocked_reasons",
                  "capture_events", "requirement_exceptions", "requirement_exception_heads"];
    for (const t of weak) {
      const r = await c.query<{ n: number }>(`select count(*)::int as n from public."${t}"`);
      expect({ t, empty: r.rows[0]!.n === 0 }).toEqual({ t, empty: true });
    }
  });
});

describe("§4 — a transaction with neither subject reaches nothing at all", () => {
  it("sweeps every base table as the anonymous plane and finds no row anywhere", async () => {
    const tables = await baseTables();
    const priv = await c.query<{ t: string; sel: boolean }>(
      `select cl.relname as t,
              has_table_privilege('goproceed_app', 'public.' || quote_ident(cl.relname), 'select') as sel
         from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
        where n.nspname = 'public' and cl.relkind in ('r','p')`);
    const expected: Record<string, Reach> = {};
    for (const t of tables) {
      expected[t] = priv.rows.find((x) => x.t === t)!.sel ? 0 : "denied";
    }

    // `asActor("")` IS the anonymous plane: the actor GUC is set and empty, and
    // the session GUC is never set. That is precisely what `withAnonymousTx`
    // opens for the exchange and the cookie resolution — the two steps that run
    // before there is a subject to be — and the claim on that function is that
    // «every table policy denies it».
    const actual = await sweep(tables, (fn) => asActor("", WS_A, fn));
    expect(actual).toEqual(expected);
  });
});
