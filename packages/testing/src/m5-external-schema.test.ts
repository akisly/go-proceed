import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import type { Client } from "pg";
import { adminClient, asActor, asExternalSession } from "./pg";
import { dropRulesWorkspaces, seedRulesWorld, type RulesFixture } from "./m1-rules-fixture";
import { seedClosureWorld, type ClosureWorld, APPROVER_ROLE } from "./m3-closure-fixture";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `tsc`, `psql` and `supabase` were never run against it, no
 * migration was applied, and no claim is made that any assertion below passes.
 * Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M5, storage layer: the protected link as a SHAPE.
 *
 * `apps/app/tests/m5-external.int.test.ts` proves the protocol — fragment, POST
 * exchange, CSRF, replay, revocation. THIS suite proves the half that survives a
 * rewrite of all six routes: every refusal below is attempted from the ADMIN
 * CONNECTION, the table owner, with RLS bypassed, so what answers is a key, a
 * CHECK or a trigger and never a command.
 *
 * The one exception is §"the external plane sees exactly one occurrence", which
 * must run as an external session because policies are what it is about. It uses
 * `asExternalSession`, whose actor GUC is EXPLICITLY empty.
 *
 * WHAT THIS SUITE CANNOT PROVE, NAMED SO IT IS NOT MISTAKEN FOR PROVED:
 *
 *   TIMING. INV-009's «revoked, expired or replaced grants cannot decide» is
 *   enforced by COMPARISON at read time inside `app.external_session_scope()`,
 *   because nothing in this product expires anything — there is no scheduled
 *   principal (migration 0049 §11 item 8). The cases below move `now()` by
 *   writing expiry timestamps in the past, which exercises the comparison and
 *   not a sweep. A sweep does not exist to be exercised.
 *
 *   THE CONSTANT-TIME COMPARISON. It is in TypeScript
 *   (`apps/app/src/lib/external-link.ts`) and is asserted in
 *   `external-link.test.ts`. A database cannot check it.
 *
 *   THROTTLING. There is none, anywhere, for any surface. Migration 0049 §11
 *   items 3 and 4 record it, and no case here pretends otherwise.
 */

const WS_A = "f5aa1111-1111-1111-1111-111111111111";
const WS_B = "f5bb2222-2222-2222-2222-222222222222";
const USER_A = "f5aa3333-3333-3333-3333-333333333333";
const USER_B = "f5bb4444-4444-4444-4444-444444444444";

/** Any 32 bytes. The suite never needs a real HMAC: it tests SHAPE. */
const verifier = (seed: string): Buffer =>
  createHash("sha256").update(seed, "utf8").digest();

const VIEW_ONLY = { "external.view_scope": true, "external.decide_evidence": false };
const DECIDING = { "external.view_scope": true, "external.decide_evidence": true };

/**
 * One attempt, both facts.
 *
 * `m1-rules-fixture`'s `raised` and `sqlstate` each run the statement and return
 * one of the two, so asserting both about one refusal means running it twice.
 * That is harmless when the statement fails — nothing is written — and it is
 * misleading to read: the reader cannot tell whether the second attempt is
 * exercising the same refusal or a different one reached from a changed state.
 * This runs it once and reports both.
 */
async function refused(fn: () => Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await fn();
    return { code: "", message: "" };
  } catch (e) {
    return {
      code: (e as { code?: string }).code ?? "unknown",
      message: (e as Error).message,
    };
  }
}

let c: Client;
let a: RulesFixture;
let b: RulesFixture;
let wa: ClosureWorld;
let wb: ClosureWorld;

interface GrantSeed {
  workspaceId?: string;
  projectId?: string;
  contractId?: string;
  occurrenceId?: string;
  permissions?: Record<string, boolean>;
  recipientEmail?: string;
  recipientRole?: string;
  decideRole?: string | null;
  decidesEvidence?: boolean | null;
  expiresInDays?: number;
  hmacKeyId?: string;
  tokenSeed?: string;
  status?: string;
}

const GRANT_INSERT = `
  insert into public.external_access_grants
    (workspace_id, project_id, contract_id, scope_kind, requirement_occurrence_id,
     token_hmac, hmac_key_id, recipient_email, recipient_role, permissions,
     expires_at, issued_by_member_id, decide_role, decides_evidence, status)
  values ($1::uuid,$2::uuid,$3::uuid,'requirement_occurrence',$4::uuid,
          $5::bytea,$6::text,$7::text,$8::text,$9::jsonb,
          now() + make_interval(days => $10::int),$11::uuid,$12::text,$13::boolean,$14::text)
  returning id`;

function grantParams(w: ClosureWorld, o: GrantSeed = {}): unknown[] {
  const f = w.rules;
  const permissions = o.permissions ?? DECIDING;
  const decides = o.decidesEvidence === undefined
    ? permissions["external.decide_evidence"] === true : o.decidesEvidence;
  const role = o.recipientRole ?? APPROVER_ROLE;
  return [
    o.workspaceId ?? f.workspaceId,
    o.projectId ?? f.projectId,
    o.contractId ?? f.contractId,
    // `===  undefined`, NOT `??`: nullish coalescing treats an explicit null the
    // same as an absent key, so `grantParams(w, { occurrenceId: null })` — the
    // way this file builds a grant that names no target — silently received a
    // valid occurrence instead and inserted an ordinary grant. The case below
    // then asserted an error code against a successful insert. It failed, which
    // was luck: written the other way round it would have been green forever.
    o.occurrenceId === undefined ? w.blockingA : o.occurrenceId,
    verifier(o.tokenSeed ?? randomUUID()),
    o.hmacKeyId ?? "k1",
    o.recipientEmail ?? "prykladtechnahliad@example.test",
    role,
    JSON.stringify(permissions),
    o.expiresInDays ?? 7,
    f.memberId,
    o.decideRole === undefined ? (decides ? role : null) : o.decideRole,
    decides,
    o.status ?? "active",
  ];
}

async function insertGrant(w: ClosureWorld, o: GrantSeed = {}): Promise<string> {
  const r = await c.query<{ id: string }>(GRANT_INSERT, grantParams(w, o));
  return r.rows[0]!.id;
}

const SESSION_INSERT = `
  insert into public.external_sessions
    (workspace_id, external_access_grant_id, requirement_occurrence_id,
     session_verifier, csrf_verifier, verifier_key_id,
     idle_expires_at, absolute_expires_at, grant_revocation_version,
     rotated_from_session_id, status)
  values ($1::uuid,$2::uuid,$3::uuid,$4::bytea,$5::bytea,$6::text,
          now() + make_interval(mins => $7::int), now() + make_interval(hours => $8::int),
          $9::bigint,$10::uuid,$11::text)
  returning id`;

async function insertSession(
  w: ClosureWorld, grantId: string, o: {
    occurrenceId?: string; idleMinutes?: number; absoluteHours?: number;
    revocationVersion?: number; rotatedFrom?: string | null; status?: string;
    seed?: string; workspaceId?: string;
  } = {},
): Promise<string> {
  const r = await c.query<{ id: string }>(SESSION_INSERT, [
    o.workspaceId ?? w.rules.workspaceId, grantId, o.occurrenceId ?? w.blockingA,
    verifier(o.seed ?? `s-${randomUUID()}`), verifier(`c-${o.seed ?? randomUUID()}`),
    "s1", o.idleMinutes ?? 30, o.absoluteHours ?? 12,
    o.revocationVersion ?? 0, o.rotatedFrom ?? null, o.status ?? "active",
  ]);
  return r.rows[0]!.id;
}

const BATCH_INSERT = `
  insert into public.external_decision_batches
    (workspace_id, project_id, requirement_occurrence_id, external_access_grant_id,
     external_session_id, confirmation_text_version, server_received_at,
     idempotency_key, request_hash, receipt_hash, grant_decides_evidence)
  values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::text,now(),$7::text,$8::text,
          $9::bytea,$10::boolean)
  returning id`;

function batchParams(
  w: ClosureWorld, grantId: string, sessionId: string,
  o: { occurrenceId?: string; key?: string; decides?: boolean; hash?: string } = {},
): unknown[] {
  return [
    w.rules.workspaceId, w.rules.projectId, o.occurrenceId ?? w.blockingA,
    grantId, sessionId, "external-occurrence-decision/1+deadbeefcafe",
    o.key ?? `idem-${randomUUID()}`, o.hash ?? "a".repeat(64),
    verifier("receipt"), o.decides ?? true,
  ];
}

beforeAll(async () => {
  c = await adminClient();
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  // `suffix`, not `prefix`. `RulesSeedOptions` has never had a `prefix` field:
  // this call was an excess property AND a missing required one — two type
  // errors that no run has ever surfaced, because `tsc` has not been run
  // against this branch. At run time it named this world's workspace
  // «Приклад-Простір-undefined» and its contract «ПР-undefined». The fixture
  // supplies the «Приклад-» prefix itself, so the value here is the
  // distinguishing part and nothing else. Corrected 2026-08-08.
  a = await seedRulesWorld(c, { workspaceId: WS_A, userId: USER_A, suffix: "М5С-А" });
  b = await seedRulesWorld(c, { workspaceId: WS_B, userId: USER_B, suffix: "М5С-Б" });
  wa = await seedClosureWorld(c, a);
  wb = await seedClosureWorld(c, b);
});

beforeEach(async () => {
  // Each of these three refuses DELETE by design, and one of them says why in
  // its own error: «an external access grant is never deleted; revoke it — the
  // record that a link existed is the accountability (INV-044)». A test fixture
  // is the one caller allowed to ignore that, and only because it is resetting
  // a world it created; `disable trigger user` suppresses the guard without
  // touching referential integrity, so a 23503 escaping this block would still
  // be a real finding rather than fixture noise.
  for (const t of ["external_decision_batches", "external_sessions", "external_access_grants"]) {
    await c.query(`alter table public.${t} disable trigger user`);
    try {
      await c.query(`delete from public.${t} where workspace_id = any($1::uuid[])`, [[WS_A, WS_B]]);
    } finally {
      await c.query(`alter table public.${t} enable trigger user`);
    }
  }
  await c.query(
    `delete from public.requirement_evidence_decision_heads where workspace_id = any($1::uuid[])`,
    [[WS_A, WS_B]]);
  // `requirement_evidence_decisions` is append-only, and 0045's
  // `app.reject_mutation()` trigger fires for the TABLE OWNER too — that is the
  // point of the pattern, not an oversight, so a plain DELETE here raised
  // «requirement_evidence_decisions is immutable (append-only relation)» and
  // took all 39 cases in this file down from one beforeEach. The house answer
  // is `disable trigger user` around the delete, exactly as
  // `m1-rules-fixture.ts:420` does; it suppresses the guard and NOT referential
  // integrity, so an FK violation here would still be a real finding.
  await c.query(
    "alter table public.requirement_evidence_decisions disable trigger user");
  try {
    await c.query(
      `delete from public.requirement_evidence_decisions where workspace_id = any($1::uuid[])`,
      [[WS_A, WS_B]]);
  } finally {
    await c.query(
      "alter table public.requirement_evidence_decisions enable trigger user");
  }
});

afterAll(async () => {
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  await c.end();
});

describe("the interlock 0045 left for 0049", () => {
  it("requirement_evidence_decisions_v01_internal_only_check is GONE", async () => {
    // 0045:690-698: «M5 drops exactly this constraint and adds the three foreign
    // keys in the same statement». If the constraint survived, every external
    // decision in this product would be unstorable and the milestone would be a
    // set of routes that cannot write.
    const r = await c.query<{ conname: string }>(
      `select conname from pg_constraint
        where conrelid = 'public.requirement_evidence_decisions'::regclass
          and conname = 'requirement_evidence_decisions_v01_internal_only_check'`);
    expect(r.rows).toHaveLength(0);
  });

  it("and the five foreign keys it was standing in for are present", async () => {
    const r = await c.query<{ conname: string }>(
      `select conname from pg_constraint
        where conrelid = 'public.requirement_evidence_decisions'::regclass
          and contype = 'f'`);
    const names = r.rows.map((x) => x.conname);
    for (const n of [
      "requirement_evidence_decisions_session_fkey",
      "requirement_evidence_decisions_grant_fkey",
      "requirement_evidence_decisions_batch_fkey",
      // The two beyond what 0045 named: INV-056 carried onto the FACT.
      "requirement_evidence_decisions_session_scope_fkey",
      "requirement_evidence_decisions_batch_session_fkey",
    ]) expect(names).toContain(n);
  });

  it("an internal decision is still storable, and still has no session", async () => {
    // THE POSITIVE CONTROL FOR THE DROP. Dropping the constraint must not have
    // changed what the member plane writes: `_authority_check` still requires
    // exactly one deciding authority.
    const r = await c.query<{ id: string }>(
      `insert into public.requirement_evidence_decisions
         (workspace_id, project_id, requirement_occurrence_id, approver_role, outcome,
          decided_by_member_id, idempotency_key, request_hash)
       values ($1,$2,$3,$4,'accepted',$5,'k','${"b".repeat(64)}') returning id`,
      [WS_A, a.projectId, wa.blockingA, APPROVER_ROLE, a.memberId]);
    expect(r.rows).toHaveLength(1);
  });

  it("a decision with NEITHER authority is still refused", async () => {
    const e = await refused(() => c.query(
      `insert into public.requirement_evidence_decisions
         (workspace_id, project_id, requirement_occurrence_id, approver_role, outcome,
          idempotency_key, request_hash)
       values ($1,$2,$3,$4,'accepted','k','${"c".repeat(64)}')`,
      [WS_A, a.projectId, wa.blockingA, APPROVER_ROLE]));
    expect(e.code).toBe("23514");
    expect(e.message).toContain("authority_check");
  });
});

describe("INV-074 — one scope kind, and v0.1 has exactly one", () => {
  it("a grant naming neither target is refused", async () => {
    const e = await refused(() => c.query(GRANT_INSERT,
      grantParams(wa, { occurrenceId: null as unknown as string })));
    // 23514, not 23502: the column is deliberately nullable — the package arc
    // needs it null — so what refuses a grant naming NEITHER target is
    // `external_access_grants_scope_arc_check`, whose occurrence branch demands
    // `requirement_occurrence_id IS NOT NULL`. Asserting NOT NULL here asserted
    // a constraint the design does not have and could not have.
    expect(e.code).toBe("23514");
    expect(e.message).toContain("scope_arc_check");
  });

  it("a grant claiming the package arc is refused, because v0.1 has no package", async () => {
    // The package branch of the arc CHECK requires package_id, package_version_id
    // AND review_epoch_at_issue. A v0.1 database has no public.package_versions,
    // so the only way to reach this branch is to lie about it — and the CHECK is
    // what makes v0.2 additive rather than a reinterpretation.
    const e = await refused(() => c.query(
      `insert into public.external_access_grants
         (workspace_id, project_id, contract_id, scope_kind, requirement_occurrence_id,
          package_id, package_version_id, review_epoch_at_issue,
          token_hmac, hmac_key_id, recipient_email, recipient_role, permissions,
          expires_at, issued_by_member_id, decides_evidence)
       values ($1,$2,$3,'package_version',$4,$5,$6,1,$7,'k1','x@example.test','r',
               '{}'::jsonb, now() + interval '1 day', $8, false)`,
      [WS_A, a.projectId, a.contractId, wa.blockingA, randomUUID(), randomUUID(),
       verifier("pkg"), a.memberId]));
    expect(e.code).toBe("23514");
    expect(e.message).toContain("scope_arc_check");
  });
});

describe("INV-056 — the scope never widens, and it is a KEY at every hop", () => {
  it("a session may not name a sibling occurrence of the same assignment", async () => {
    const g = await insertGrant(wa, { occurrenceId: wa.blockingA });
    // `blockingB` is on the SAME stage, the SAME assignment and the SAME
    // workspace. Everything about it resolves; only the grant's own occurrence
    // column says no.
    const e = await refused(() => c.query(SESSION_INSERT, [
      WS_A, g, wa.blockingB, verifier("s"), verifier("c"), "s1", 30, 12, 0, null, "active",
    ]));
    expect(e.code).toBe("23503");
    expect(e.message).toContain("external_sessions_grant_scope_fkey");
  });

  it("a batch may not name an occurrence other than its session's", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    const e = await refused(() => c.query(BATCH_INSERT,
      batchParams(wa, g, s, { occurrenceId: wa.blockingB })));
    expect(e.code).toBe("23503");
  });

  it("a decision may not name an occurrence other than its session's", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    const bt = await c.query<{ id: string }>(BATCH_INSERT, batchParams(wa, g, s));
    const e = await refused(() => c.query(
      `insert into public.requirement_evidence_decisions
         (workspace_id, project_id, requirement_occurrence_id, approver_role, outcome,
          external_session_id, external_access_grant_id, decision_batch_id,
          assurance_label, idempotency_key, request_hash)
       values ($1,$2,$3,$4,'accepted',$5,$6,$7,'LINK_CONFIRMATION','k','${"d".repeat(64)}')`,
      [WS_A, a.projectId, wa.blockingB, APPROVER_ROLE, s, g, bt.rows[0]!.id]));
    expect(e.code).toBe("23503");
    expect(e.message).toContain("session_scope_fkey");
  });

  it("a decision may not name a batch belonging to another session", async () => {
    const g = await insertGrant(wa);
    const s1 = await insertSession(wa, g, { seed: "one" });
    const s2 = await insertSession(wa, g, { seed: "two", rotatedFrom: s1 });
    const bt = await c.query<{ id: string }>(BATCH_INSERT, batchParams(wa, g, s1));
    const e = await refused(() => c.query(
      `insert into public.requirement_evidence_decisions
         (workspace_id, project_id, requirement_occurrence_id, approver_role, outcome,
          external_session_id, external_access_grant_id, decision_batch_id,
          assurance_label, idempotency_key, request_hash)
       values ($1,$2,$3,$4,'accepted',$5,$6,$7,'LINK_CONFIRMATION','k','${"e".repeat(64)}')`,
      [WS_A, a.projectId, wa.blockingA, APPROVER_ROLE, s2, g, bt.rows[0]!.id]));
    expect(e.code).toBe("23503");
    expect(e.message).toContain("batch_session_fkey");
  });

  it("a grant may not name an occurrence of another workspace", async () => {
    // INV-001/INV-002. Every id below is real; only the tenant chain is crossed.
    const e = await refused(() => c.query(GRANT_INSERT,
      grantParams(wa, { occurrenceId: wb.blockingA })));
    expect(e.code).toBe("23503");
  });

  it("a grant may not name a contract its occurrence does not belong to", async () => {
    const e = await refused(() => c.query(GRANT_INSERT,
      grantParams(wa, { contractId: randomUUID() })));
    expect(e.code).toBe("23503");
  });
});

describe("INV-031 — an observer cannot decide, and it is a FOREIGN KEY", () => {
  it("a receipt for an observing grant is UNSTORABLE", async () => {
    const g = await insertGrant(wa, { permissions: VIEW_ONLY, recipientRole: "sposterihach" });
    const s = await insertSession(wa, g);
    // `grant_decides_evidence` is CHECKed true, so the batch asserts it decides;
    // the foreign key resolves that assertion against the GRANT'S OWN column.
    // A command that forgot to look at the permission object still cannot write
    // the row.
    const e = await refused(() => c.query(BATCH_INSERT, batchParams(wa, g, s)));
    expect(e.code).toBe("23503");
    expect(e.message).toContain("external_decision_batches_decide_fkey");
  });

  it("and claiming otherwise on the batch is refused by its own CHECK", async () => {
    const g = await insertGrant(wa, { permissions: VIEW_ONLY, recipientRole: "sposterihach" });
    const s = await insertSession(wa, g);
    const e = await refused(() => c.query(BATCH_INSERT,
      batchParams(wa, g, s, { decides: false })));
    expect(e.code).toBe("23514");
  });

  it("a deciding grant's receipt is storable — the positive control", async () => {
    const g = await insertGrant(wa, { permissions: DECIDING });
    const s = await insertSession(wa, g);
    const r = await c.query<{ id: string }>(BATCH_INSERT, batchParams(wa, g, s));
    expect(r.rows).toHaveLength(1);
  });
});

describe("the permission object is a CLOSED two-key vocabulary", () => {
  it("refuses an empty object — the column's own default", async () => {
    // The target DDL defaults `permissions` to '{}'. Under the v0.1 CHECK that
    // default is UNUSABLE, deliberately: a grant that took it would confer
    // nothing, and a default that cannot be taken is a default that cannot be
    // taken by mistake.
    const e = await refused(() => c.query(GRANT_INSERT, grantParams(wa, { permissions: {} })));
    expect(e.code).toBe("23514");
    expect(e.message).toContain("permissions_check");
  });

  it("refuses a third key", async () => {
    const e = await refused(() => c.query(GRANT_INSERT, grantParams(wa, {
      permissions: { ...DECIDING, "external.decide_commercial": true } as Record<string, boolean>,
    })));
    expect(e.code).toBe("23514");
  });

  it("refuses a grant that confers no view", async () => {
    const e = await refused(() => c.query(GRANT_INSERT, grantParams(wa, {
      permissions: { "external.view_scope": false, "external.decide_evidence": false },
    })));
    expect(e.code).toBe("23514");
  });

  it("refuses a decides_evidence that disagrees with its own permission object", async () => {
    // The derived column is derived by CHECK rather than by GENERATED ALWAYS, so
    // this is the case that makes «derived» true.
    const e = await refused(() => c.query(GRANT_INSERT, grantParams(wa, {
      permissions: VIEW_ONLY, decidesEvidence: true, decideRole: APPROVER_ROLE,
    })));
    expect(e.code).toBe("23514");
    expect(e.message).toContain("decides_derived_check");
  });

  it("refuses a deciding grant whose role is not the occurrence's approver_role", async () => {
    // The role pin, as a foreign key through `decide_role`. A deciding grant to
    // «геодезист» against an obligation whose approver_role is
    // «technical_supervisor» would produce a decision in a role nobody granted,
    // because the decision's role is pinned FROM the occurrence.
    const e = await refused(() => c.query(GRANT_INSERT,
      grantParams(wa, { permissions: DECIDING, recipientRole: "heodezyst" })));
    expect(e.code).toBe("23503");
    expect(e.message).toContain("decide_role_fkey");
  });

  it("but an OBSERVER may name any role at all", async () => {
    // MATCH SIMPLE: a NULL `decide_role` skips the whole foreign key. Showing an
    // outsider what is owed is not deciding it.
    const id = await insertGrant(wa, {
      permissions: VIEW_ONLY, recipientRole: "heodezyst",
    });
    expect(id).toBeTruthy();
  });

  it("refuses a decide_role that disagrees with decides_evidence", async () => {
    const e = await refused(() => c.query(GRANT_INSERT, grantParams(wa, {
      permissions: VIEW_ONLY, decideRole: "heodezyst",
    })));
    expect(e.code).toBe("23514");
    expect(e.message).toContain("decide_role_check");
  });
});

describe("INV-057 — the exchange is single-use, and a second one is UNSTORABLE", () => {
  it("only one session per grant may be born of an exchange", async () => {
    const g = await insertGrant(wa);
    await insertSession(wa, g, { seed: "first" });
    // A rotation names its predecessor; an EXCHANGE names none. The partial
    // unique index is over `rotated_from_session_id is null`, so a second
    // exchange-born session collides even if a future command forgot to look at
    // `exchange_consumed_at`.
    const e = await refused(() => c.query(SESSION_INSERT, [
      WS_A, g, wa.blockingA, verifier("second"), verifier("c2"), "s1", 30, 12, 0, null, "active",
    ]));
    expect(e.code).toBe("23505");
    expect(e.message).toContain("external_sessions_one_exchange_key");
  });

  it("rotations are unlimited, and each replaces exactly one predecessor", async () => {
    const g = await insertGrant(wa);
    const s1 = await insertSession(wa, g, { seed: "r1" });
    const s2 = await insertSession(wa, g, { seed: "r2", rotatedFrom: s1 });
    expect(await insertSession(wa, g, { seed: "r3", rotatedFrom: s2 })).toBeTruthy();
    // Two successors of one predecessor would be two live sessions after one
    // rotation, which is what `external_sessions_rotation_key` refuses.
    const e = await refused(() => c.query(SESSION_INSERT, [
      WS_A, g, wa.blockingA, verifier("r4"), verifier("c4"), "s1", 30, 12, 0, s1, "active",
    ]));
    expect(e.code).toBe("23505");
  });

  it("a consumed marker is never cleared or moved", async () => {
    const g = await insertGrant(wa);
    await c.query(
      `update public.external_access_grants
          set exchange_consumed_at = now(), version = version + 1 where id = $1`, [g]);
    const cleared = await refused(() => c.query(
      `update public.external_access_grants
          set exchange_consumed_at = null, version = version + 1 where id = $1`, [g]));
    expect(cleared.message).toContain("consumed exchange marker");
    const moved = await refused(() => c.query(
      `update public.external_access_grants
          set exchange_consumed_at = now() + interval '1 hour', version = version + 1
        where id = $1`, [g]));
    expect(moved.message).toContain("consumed exchange marker");
  });
});

describe("the two guards", () => {
  it("a grant's scope, recipient, permissions, verifier and expiry are fixed at issue", async () => {
    const g = await insertGrant(wa);
    for (const [col, value] of [
      ["requirement_occurrence_id", wa.blockingB],
      ["recipient_email", "inshyi@example.test"],
      ["permissions", JSON.stringify(VIEW_ONLY)],
      ["token_hmac", verifier("other")],
      ["expires_at", "2030-01-01T00:00:00Z"],
    ] as [string, unknown][]) {
      const e = await refused(() => c.query(
        `update public.external_access_grants
            set ${col} = $2, version = version + 1 where id = $1`, [g, value]));
      expect(e.message).toMatch(/fixed at issue|derived|decide_role|scope/);
    }
  });

  it("a grant leaves 'active' exactly once and is never deleted", async () => {
    const g = await insertGrant(wa);
    await c.query(
      `update public.external_access_grants
          set status = 'revoked', revocation_version = revocation_version + 1,
              version = version + 1 where id = $1`, [g]);
    const again = await refused(() => c.query(
      `update public.external_access_grants
          set status = 'superseded', version = version + 1 where id = $1`, [g]));
    expect(again.message).toContain("leaves 'active' once");
    const del = await refused(() => c.query(
      `delete from public.external_access_grants where id = $1`, [g]));
    // A revoked link is a fact somebody has to be able to explain years later,
    // and a decision taken through it NAMES it.
    expect(del.message).toContain("never deleted");
  });

  it("a revocation version never goes backwards", async () => {
    const g = await insertGrant(wa);
    await c.query(
      `update public.external_access_grants
          set revocation_version = 3, version = version + 1 where id = $1`, [g]);
    const e = await refused(() => c.query(
      `update public.external_access_grants
          set revocation_version = 2, version = version + 1 where id = $1`, [g]));
    expect(e.message).toContain("never goes backwards");
  });

  it("a session's secrets and its absolute ceiling are fixed at exchange", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    for (const [col, value] of [
      ["session_verifier", verifier("new")],
      ["csrf_verifier", verifier("new-csrf")],
      ["absolute_expires_at", "2030-01-01T00:00:00Z"],
      ["grant_revocation_version", 9],
    ] as [string, unknown][]) {
      const e = await refused(() => c.query(
        `update public.external_sessions set ${col} = $2 where id = $1`, [s, value]));
      expect(e.message).toContain("fixed at exchange");
    }
  });

  it("an idle window slides forward and never past its ceiling", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    const back = await refused(() => c.query(
      `update public.external_sessions
          set idle_expires_at = idle_expires_at - interval '1 minute' where id = $1`, [s]));
    expect(back.message).toContain("slides forward");
    const past = await refused(() => c.query(
      `update public.external_sessions
          set idle_expires_at = absolute_expires_at + interval '1 minute' where id = $1`, [s]));
    // A sliding window that could slide past its ceiling is not a ceiling.
    expect(past.code).toBe("23514");
  });

  it("a receipt takes no update and no delete", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    const bt = await c.query<{ id: string }>(BATCH_INSERT, batchParams(wa, g, s));
    const id = bt.rows[0]!.id;
    const up = await refused(() => c.query(
      `update public.external_decision_batches set receipt_hash = $2 where id = $1`,
      [id, verifier("tampered")]));
    expect(up.message).toMatch(/immutable|append-only|not allowed|reject/i);
    const del = await refused(() => c.query(
      `delete from public.external_decision_batches where id = $1`, [id]));
    expect(del.message).toMatch(/immutable|append-only|not allowed|reject/i);
  });

  it("INV-007 — one receipt per (grant, idempotency key)", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    await c.query(BATCH_INSERT, batchParams(wa, g, s, { key: "same" }));
    const e = await refused(() => c.query(BATCH_INSERT, batchParams(wa, g, s, { key: "same" })));
    expect(e.code).toBe("23505");
    expect(e.message).toContain("external_decision_batches_idempotency_key");
  });
});

describe("the reviewer's claims are claims, and cannot become a second profile", () => {
  it("refuses a fourth key on reviewer_claims", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    const params = batchParams(wa, g, s);
    const e = await refused(() => c.query(
      `insert into public.external_decision_batches
         (workspace_id, project_id, requirement_occurrence_id, external_access_grant_id,
          external_session_id, reviewer_claims, confirmation_text_version,
          server_received_at, idempotency_key, request_hash, receipt_hash,
          grant_decides_evidence)
       values ($1,$2,$3,$4,$5,'{"name":"Приклад","edrpou":"12345678"}'::jsonb,
               $6,now(),$7,$8,$9,$10)`,
      [params[0], params[1], params[2], params[3], params[4], params[5],
       params[6], params[7], params[8], params[9]]));
    // A blob with room for anything is a place a certificate number ends up, and
    // prohibition E is about exactly that.
    expect(e.code).toBe("23514");
  });
});

describe("the external plane sees exactly one occurrence, and nothing else", () => {
  it("resolves the granted occurrence and NO sibling", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    const r = await asExternalSession<{ id: string }>(s, WS_A, (x) =>
      x.query("select id from public.requirement_occurrences"));
    // ONE row. Not the sibling on the same stage, not the advisory occurrence,
    // not the other stage's, not the other assignment's.
    expect(r.rows.map((x) => x.id)).toEqual([wa.blockingA]);
  });

  // THE NARROW CASE, AND IT IS NOW THE NARROW ONE ON PURPOSE. This list is
  // fourteen tables somebody typed, and it says nothing about the fifteenth.
  // `m5-external-rls.test.ts` (written 2026-08-08, the sweep `tx.ts` had been
  // naming since M5) enumerates `pg_class` instead and asserts over every base
  // table in the schema. This case is kept beside it because a named list fails
  // with a legible name — «work_items: 1» — where a whole-schema diff fails with
  // fifty rows of context, and because the two disagree loudly if either rots.
  it("cannot reach the money, the assignment, the stage or the closure", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    for (const table of [
      "work_items", "work_assignments", "work_stages", "stage_closures",
      "projects", "contracts", "contract_versions", "progress_entries",
      "valuation_allocations", "requirement_exception_heads", "requirement_exceptions",
      "memberships", "project_access_grants", "statutory_acts",
    ]) {
      const r = await asExternalSession<{ n: number }>(s, WS_A, (x) =>
        x.query(`select count(*)::int as n from public.${table}`));
      // «It grants no workspace navigation, project discovery, arbitrary storage
      // listing … or access to a sibling occurrence on the same assignment.»
      // The reviewer HAS NO PRICED SCOPE IN VIEW, which is the structural half
      // of «an occurrence-scoped session cannot submit a commercial_decision».
      expect({ table, n: r.rows[0]!.n }).toEqual({ table, n: 0 });
    }
  });

  it("a revoked grant resolves NOTHING, without any session row changing", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    await c.query(
      `update public.external_access_grants
          set status = 'revoked', revocation_version = revocation_version + 1,
              version = version + 1 where id = $1`, [g]);
    // The session row is untouched and still says 'active'. INV-009 holds
    // because the SCOPE FUNCTION compares, not because a sweep ran.
    const still = await c.query<{ status: string }>(
      `select status from public.external_sessions where id = $1`, [s]);
    expect(still.rows[0]!.status).toBe("active");
    const r = await asExternalSession<{ n: number }>(s, WS_A, (x) =>
      x.query("select count(*)::int as n from public.requirement_occurrences"));
    expect(r.rows[0]!.n).toBe(0);
  });

  it("an expired session resolves nothing, and so does an expired grant", async () => {
    const g1 = await insertGrant(wa, { tokenSeed: "e1" });
    const idle = await insertSession(wa, g1, { seed: "idle", idleMinutes: -1 });
    const r1 = await asExternalSession<{ n: number }>(idle, WS_A, (x) =>
      x.query("select count(*)::int as n from public.requirement_occurrences"));
    expect(r1.rows[0]!.n).toBe(0);

    const g2 = await insertGrant(wa, { tokenSeed: "e2", expiresInDays: -1 });
    const live = await insertSession(wa, g2, { seed: "live" });
    const r2 = await asExternalSession<{ n: number }>(live, WS_A, (x) =>
      x.query("select count(*)::int as n from public.requirement_occurrences"));
    expect(r2.rows[0]!.n).toBe(0);
  });

  it("a session whose revocation version has fallen behind resolves nothing", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g, { revocationVersion: 5 });
    // The grant is active and unexpired; only the versions disagree.
    const r = await asExternalSession<{ n: number }>(s, WS_A, (x) =>
      x.query("select count(*)::int as n from public.requirement_occurrences"));
    expect(r.rows[0]!.n).toBe(0);
  });

  it("THE TWO PLANES ARE MUTUALLY EXCLUSIVE: an actor GUC disables the session", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    // Both GUCs set. `app.current_external_session()` returns NULL whenever an
    // actor is present, so this behaves as a MEMBER transaction — which requires
    // a real active membership and a project capability to see anything. USER_B
    // has neither in WS_A.
    const { Client } = await import("pg");
    const x = new Client({ connectionString: process.env.APP_DB_URL
      ?? "postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" });
    await x.connect();
    try {
      await x.query("begin");
      await x.query("set local role aktflow_app");
      await x.query("select set_config('app.actor_user_id', $1, true)", [USER_B]);
      await x.query("select set_config('app.external_session_id', $1, true)", [s]);
      const r = await x.query<{ n: number }>(
        "select count(*)::int as n from public.requirement_occurrences");
      expect(r.rows[0]!.n).toBe(0);
      const who = await x.query<{ v: string | null }>(
        "select app.current_external_session()::text as v");
      // The collapse is TOWARDS the plane that needs an identity.
      expect(who.rows[0]!.v).toBeNull();
      await x.query("commit");
    } finally { await x.end(); }
  });

  it("an external session may not write a decision on an occurrence it was not granted", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    const bt = await c.query<{ id: string }>(BATCH_INSERT, batchParams(wa, g, s));
    const e = await refused(() => asExternalSession(s, WS_A, (x) => x.query(
      `insert into public.requirement_evidence_decisions
         (workspace_id, project_id, requirement_occurrence_id, approver_role, outcome,
          external_session_id, external_access_grant_id, decision_batch_id,
          assurance_label, idempotency_key, request_hash)
       values ($1,$2,$3,$4,'accepted',$5,$6,$7,'LINK_CONFIRMATION','k','${"f".repeat(64)}')`,
      [WS_A, a.projectId, wa.blockingB, APPROVER_ROLE, s, g, bt.rows[0]!.id])));
    // 42501 from the policy, not 23503 from the key: the policy is the layer
    // that runs first, and both exist.
    expect(e.code).toBe("42501");
  });

  it("an OBSERVING session may read and may not decide", async () => {
    const g = await insertGrant(wa, { permissions: VIEW_ONLY, recipientRole: "sposterihach" });
    const s = await insertSession(wa, g);
    const read = await asExternalSession<{ id: string }>(s, WS_A, (x) =>
      x.query("select id from public.requirement_occurrences"));
    expect(read.rows.map((x) => x.id)).toEqual([wa.blockingA]);

    const e = await refused(() => asExternalSession(s, WS_A, (x) => x.query(
      `insert into public.requirement_evidence_decision_heads
         (workspace_id, project_id, requirement_occurrence_id, approver_role)
       values ($1,$2,$3,$4)`,
      [WS_A, a.projectId, wa.blockingA, APPROVER_ROLE])));
    expect(e.code).toBe("42501");
  });

  it("a member of ANOTHER workspace sees no grant, session or receipt of this one", async () => {
    const g = await insertGrant(wa);
    const s = await insertSession(wa, g);
    await c.query(BATCH_INSERT, batchParams(wa, g, s));
    for (const table of ["external_access_grants", "external_sessions",
                         "external_decision_batches"]) {
      const r = await asActor<{ n: number }>(USER_B, WS_B, (x) =>
        x.query(`select count(*)::int as n from public.${table} where workspace_id = $1`,
          [WS_A]));
      expect({ table, n: r.rows[0]!.n }).toEqual({ table, n: 0 });
    }
  });
});
