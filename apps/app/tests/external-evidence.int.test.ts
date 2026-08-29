import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { Client } from "pg";
import {
  ADMIN_URL, q, truncateAll, jsonReq, baselineFixture, type BaselineFixture,
} from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";
import type { CreateUploadIntentResponse, FinalizeUploadIntentResponse } from "@goproceed/contracts";
import { buildCreateIntentBody } from "../src/lib/capture/upload";
import {
  EXTERNAL_SESSION_COOKIE, resetKeyRegistriesForTests,
} from "../src/lib/external-link";
import { EXTERNAL_RESPONSE_HEADERS } from "../src/lib/external-session";
import {
  EXTERNAL_TEST_APPROVER, EXTERNAL_TEST_ORIGIN, cookieOf, exchange, issueGrant, tokenOf,
} from "./helpers/external-plane";

/**
 * Task 4 — `external.evidence_bytes`, GET /external/evidence.
 *
 * THE ONE THING THIS SUITE EXISTS FOR is the sentence
 * `apps/app/app/external/occurrence/route.ts` wrote against itself: «a reviewer
 * who cannot see the photo will not accept». Everything else here is about what
 * that reviewer must NOT be able to see.
 *
 * The fixture is `m5-external.int.test.ts`'s, with one deliberate addition: TWO
 * bound rules, so the assignment materialises TWO obligations and the grant is
 * issued over exactly one of them. With a single occurrence, «the policy scopes
 * to the session's occurrence» and «the policy admits everything the workspace
 * has» are the same observation and a route that ignored scoping entirely would
 * pass. A sibling is the smallest fixture that can tell them apart.
 *
 * WHAT THIS SUITE DELIBERATELY DOES NOT ASSERT, and must never be edited to:
 *
 *   THAT A REVOKE STOPS A TRANSFER ALREADY IN FLIGHT. Nothing in this repository
 *   implements that. Revocation is revalidated PER REQUEST — in
 *   `app.resolve_external_session` before the handler runs, and again at
 *   statement time inside every external policy through
 *   `app.external_session_scope()` — and «during» has no chunked re-check, no
 *   abort path and no cancellation token anywhere. A test asserting it would be
 *   pinning a guarantee the product does not make, which is the one thing a test
 *   here may not do. What IS asserted is that the NEXT request is refused.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const ORIGIN = EXTERNAL_TEST_ORIGIN;

// `m5-external.int.test.ts`'s list verbatim. Trimming it is a false economy:
// the publish/bind/assign chain below is the same chain, and a missing
// capability surfaces as a 403 three helpers deep.
const CAPS = ["assignments.manage", "rule_bindings.manage", "requirements.assign",
              "progress.record", "evidence.record", "evidence_decisions.decide",
              "stage_closures.close", "requirement_exceptions.decide", "readiness.view",
              "packages.submit"] as const;

const WORK_TYPE = "montazh-elektrotekhnichnykh-ustanovok";
const STAGE = "prykhovani-roboty";
const APPROVER = EXTERNAL_TEST_APPROVER;

/** A minimal but genuine JPEG: SOI + APP0 marker, then a byte of payload. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
/** The SIBLING occurrence's photo — a distinct payload, so the two rows cannot collide on content_hash. */
const JPEG_SIBLING = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x01]);
/** A third payload for the photo captured with NO occurrence at all — the fallback door. */
const JPEG_FALLBACK = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x02]);
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

interface Fx extends BaselineFixture {
  assignmentId: string;
  /** The obligation the grant is issued over. */
  occurrenceId: string;
  /** Its sibling on the SAME assignment — never in any grant here. */
  siblingOccurrenceId: string;
}

beforeAll(() => {
  process.env.EXTERNAL_LINK_ORIGIN = ORIGIN;
  process.env.EXTERNAL_LINK_HMAC_KEYS = "k1:" + Buffer.alloc(32, 11).toString("base64");
  process.env.EXTERNAL_LINK_ACTIVE_KEY_ID = "k1";
  process.env.EXTERNAL_SESSION_HMAC_KEYS = "s1:" + Buffer.alloc(32, 12).toString("base64");
  process.env.EXTERNAL_SESSION_ACTIVE_KEY_ID = "s1";
  resetKeyRegistriesForTests();
});

async function grantCaps(projectId: string, memberId: string): Promise<void> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const res = await POST(jsonReq("http://x", { memberId, capabilities: [...CAPS] }),
    { params: Promise.resolve({ projectId }) });
  if (res.status >= 300) throw new Error(`grant ${res.status} ${await res.text()}`);
}

/**
 * TWO obligations on one assignment, both naming an EXTERNAL approver.
 *
 * `userId` is a parameter because one case below builds a SECOND, complete
 * world for user B and opens a live link into it — the cross-workspace negative
 * needs a session that is genuinely valid somewhere, not a forged cookie.
 */
async function baseline(userId: string = A): Promise<Fx> {
  const base = await baselineFixture(userId);
  await grantCaps(base.projectId, base.memberId);
  const library = await seedRequirementLibrary(base.workspaceId);

  const ruleIds: string[] = [];
  for (const key of ["Н.15/1", "Н.15/2"]) {
    const res = await publishRuleVersion(base.workspaceId,
      ruleVersionBody(library.get(key)!, {
        workTypeKey: WORK_TYPE, stageKey: STAGE,
        approverRole: APPROVER, approverIsExternal: true,
      }));
    if (res.status !== 201) {
      throw new Error(`publishRuleVersion ${res.status} ${await res.text()}`);
    }
    ruleIds.push((await res.json()).ruleVersionId as string);
  }

  const draft = await createDraft(base.contractId);
  const contractVersionId = (await draft.json()).contractVersionId as string;
  const line = await addLine(contractVersionId, {
    sourceKey: "1.1", workTypeKey: WORK_TYPE,
    description: "Приклад-прокладання кабелю в штробі",
    unitCode: "м", contractQuantity: "10",
    unitPriceState: "known", unitPrice: "100.00",
  });
  if (line.status !== 201) throw new Error(`addLine ${line.status} ${await line.text()}`);
  const workItemId = (await line.json()).workItem.workItemId as string;

  const bind = await bindRules(contractVersionId, ruleIds);
  if (bind.status !== 201) throw new Error(`bindRules ${bind.status} ${await bind.text()}`);
  const view = await (await getVersion(base.contractId, 1)).json();
  const pub = await publishVersion(contractVersionId, manifestOf(view));
  if (pub.status !== 201) throw new Error(`publishVersion ${pub.status} ${await pub.text()}`);

  const { POST: createAssignment } = await import(
    "../app/v1/contracts/[contractId]/assignments/route");
  const asg = await createAssignment(jsonReq("http://x", { workItemId }),
    { params: Promise.resolve({ contractId: base.contractId }) });
  if (asg.status !== 201) throw new Error(`assignments.create ${asg.status} ${await asg.text()}`);
  const assignmentId = (await asg.json()).assignmentId as string;

  const written = await q<{ id: string }>(
    `select id from public.requirement_occurrences
      where workspace_id = $1 and work_assignment_id = $2
      order by id`, [base.workspaceId, assignmentId]);
  if (written.length !== 2) {
    throw new Error(`external-evidence: expected two materialised occurrences, got ${written.length}`);
  }

  return {
    ...base, assignmentId,
    occurrenceId: written[0]!.id, siblingOccurrenceId: written[1]!.id,
  };
}

/* ── capture, exactly as the field client performs it ───────────────────────── */

async function captureOne(
  assignmentId: string, bytes: Uint8Array, occurrenceId?: string,
): Promise<string> {
  const { POST: create } = await import(
    "../app/v1/assignments/[assignmentId]/upload-intents/route");
  const body = occurrenceId
    ? buildCreateIntentBody({
        file: new File([bytes], "фото.jpg", { type: "image/jpeg", lastModified: Date.now() }),
        occurrenceId, expectedContentHash: hashOf(bytes), deviceCaptureId: crypto.randomUUID(),
      })
    : {
        // No `requirementOccurrenceId` at all — the fallback door
        // (`packages/contracts/src/uploads.ts`). This photo belongs to the
        // assignment and to NO obligation, which is what makes it the third
        // negative below.
        expectedContentHash: hashOf(bytes),
        expectedByteSize: bytes.byteLength,
        claimedMediaType: "image/jpeg",
        deviceCaptureId: crypto.randomUUID(),
        originMethod: "origin_not_distinguished" as const,
      };
  const createRes = await create(jsonReq("http://x", body),
    { params: Promise.resolve({ assignmentId }) });
  if (createRes.status !== 201) {
    throw new Error(`captureOne: create ${createRes.status} ${await createRes.text()}`);
  }
  const created = await createRes.json() as CreateUploadIntentResponse;
  const put = await fetch(created.upload.signedUrl, {
    method: "PUT", headers: { "content-type": "image/jpeg" }, body: bytes,
  });
  if (put.status !== 200) throw new Error(`captureOne: PUT ${put.status} ${await put.text()}`);

  const { POST: finalize } = await import("../app/v1/upload-intents/[intentId]/finalize/route");
  const finRes = await finalize(jsonReq("http://x", {}),
    { params: Promise.resolve({ intentId: created.uploadIntentId }) });
  if (finRes.status !== 200) {
    throw new Error(`captureOne: finalize ${finRes.status} ${await finRes.text()}`);
  }
  const fin = await finRes.json() as FinalizeUploadIntentResponse;
  if (fin.status !== "available" || fin.evidenceObjectId === null) {
    throw new Error(`captureOne: expected an available object, got ${fin.status}`);
  }
  return fin.evidenceObjectId;
}

/* ── the link, exchanged for a session ──────────────────────────────────────── */

/*
 * The grant/exchange/cookie moves are the SHARED external-plane drivers
 * (`./helpers/external-plane`, extracted 2026-08-28 — TODOS 2026-08-27
 * residual 9). This suite's deliberate difference — grants addressed to
 * varying recipients — survives as the body override `issueGrant` merges over
 * the shared default. `openLink` stays HERE: it asserts on the way through,
 * and an assertion inside a shared helper is a hidden test.
 */
async function openLink(
  occurrenceId: string, email = "prykladtechnahliad@example.test",
): Promise<{ grantId: string; cookie: string }> {
  const issued = await issueGrant(occurrenceId, { recipientEmail: email });
  expect(issued.status, await issued.clone().text()).toBe(201);
  const grant = await issued.json();

  const ex = await exchange(tokenOf(grant.link));
  expect(ex.status, await ex.clone().text()).toBe(200);
  return { grantId: grant.grantId as string, cookie: cookieOf(ex) };
}

async function revoke(grantId: string, expectedVersion: number): Promise<Response> {
  const { POST } = await import("../app/v1/grants/[grantId]/revoke-reissue/route");
  return POST(new Request("http://x", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({ reissue: false, reason: "Приклад-відкликано", expectedVersion }),
  }), { params: Promise.resolve({ grantId }) });
}

/**
 * One DDL statement, on its own connection, under a SHORT `lock_timeout`.
 *
 * `q()` sets none — `truncateAll` in the same helpers file sets 5s deliberately,
 * and its comment records the deadlock that taught it to. `ALTER POLICY` takes a
 * table-level exclusive lock, so the widen/restore pair below has exactly the
 * hazard that comment describes: a connection leaked by some earlier suite,
 * still holding or queued for a lock on `evidence_objects`, would make an ALTER
 * BLOCK. With no `lock_timeout` the block runs until vitest's default 5s
 * `testTimeout` kills the case **while the restore is still queued**, and every
 * later case in this file then runs against a half-widened policy — a red run
 * that also poisons everything after it.
 *
 * 1s, not 5s: there are at most four of these per case (two widen, two restore),
 * so even four consecutive timeouts total 4s and stay inside the 5s test
 * timeout. That is the whole point — the case must fail with a named
 * `lock_not_available` and a completed `finally`, never with a timeout and a
 * queued one.
 *
 * WHY NOT `q()` — CORRECTED 2026-08-22, AND THE FIRST ANSWER WAS WRONG.
 *
 * What stood here said `q()` «passes an empty values array, which puts node-pg
 * on the extended query protocol, where a `set lock_timeout; alter policy …`
 * pair in one string is not accepted». THAT IS FALSE, and it was written from
 * memory rather than run — the same failure the rest of this file's comments
 * exist to correct. `pg@8.23.0`'s `requiresPreparation()` ends
 * `return this.values.length > 0`, so an EMPTY array is falsy and the call takes
 * the SIMPLE path, which does accept a multi-statement string. Executed against
 * the local stack on `q()`'s exact call shape — `c.query("set lock_timeout =
 * '1s'; select current_setting('lock_timeout')", [])` — the batch ran and the
 * setting read back as `1s`. So «it would not work» was never the reason.
 *
 * THE VERSION IS `8.23.0` AND IT IS CITED WITH ITS RESOLUTION, because this
 * number depends on where you stand and getting it wrong is the second mistake
 * this comment has recorded. The repo root pins `pg: ^8.22.0` and `apps/app`
 * pins `pg: ^8.23.0`; `apps/app/node_modules/pg` exists, so THIS file — which
 * lives under `apps/app` and runs via `pnpm --filter @goproceed/app` — resolves
 * 8.23.0:
 *
 *     $ cd apps/app && node -e "console.log(require('pg/package.json').version)"
 *     8.23.0
 *
 * A first correction here cited 8.22.0, which is what the same command prints
 * from the repo root. Everything above and below was re-executed from inside
 * `apps/app` against 8.23.0 before this line was written.
 *
 * Both copies are installed, so one more thing is worth knowing and it is the
 * only thing about them that is: `requiresPreparation()` and
 * `_checkForMultirow()` — the two functions this whole argument rests on — are
 * IDENTICAL between them, compared directly rather than inferred from where a
 * diff happened to fall. A reader who ends up in the root's 8.22.0 copy is
 * reading the same two functions.
 *
 * WHAT IS ACTUALLY TRUE, and both halves were run rather than reasoned:
 *
 *   THE RETURN SHAPE BREAKS SILENTLY. A multi-statement simple query makes
 *   node-pg accumulate an ARRAY of `Result`s (`query.js` `_checkForMultirow`),
 *   so on that same executed call `Array.isArray(result)` was `true` and
 *   `result.rows` was `undefined` — while `q()`'s signature promises `T[]` and
 *   its body is `return r.rows as T[]`. Nothing here reads the return value of
 *   an `alter policy`, which is exactly what makes it a trap rather than an
 *   error: it is the next person adding a `returning` clause who finds it.
 *
 *   AND IT WOULD HOLD ONLY WHILE THE VALUES ARRAY STAYS EMPTY. By the same line
 *   of `requiresPreparation()`, one bound parameter flips the call to the
 *   extended protocol, where the batch IS refused — run, not inferred: the same
 *   statement with `[1]` bound throws «cannot insert multiple commands into a
 *   prepared statement». A helper whose correctness depends on never passing a
 *   parameter is a helper with a trapdoor in it. `ddl()` sends the GUC as its
 *   own statement and depends on none of this.
 *
 * NOT A REASON, THOUGH IT SOUNDS LIKE ONE: keeping a session-scoped GUC from
 * leaking into other tests. `q()` (helpers/fixtures.ts) already opens its OWN
 * `Client` per call and `end()`s it in a `finally` — there is no shared pool
 * here to leak into, and the GUC dies with the connection either way.
 */
async function ddl(sql: string): Promise<void> {
  const c = new Client({ connectionString: ADMIN_URL });
  await c.connect();
  try {
    await c.query("set lock_timeout = '1s'");
    await c.query(sql);
  } finally {
    await c.end().catch(() => undefined);
  }
}

/** The route under test, driven the way a browser's `<img>` would drive it. */
async function bytes(cookie: string | null, evidenceObjectId: string): Promise<Response> {
  const { GET } = await import("../app/external/evidence/route");
  const headers: Record<string, string> = {};
  if (cookie !== null) headers.cookie = `${EXTERNAL_SESSION_COOKIE}=${cookie}`;
  return GET(new Request(
    `${ORIGIN}/external/evidence?evidenceObjectId=${evidenceObjectId}`, { headers }));
}

let fx: Fx;
let mine: string;
let sibling: string;
let fallback: string;
let cookie: string;
let grantId: string;

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await baseline();
  mine = await captureOne(fx.assignmentId, JPEG, fx.occurrenceId);
  sibling = await captureOne(fx.assignmentId, JPEG_SIBLING, fx.siblingOccurrenceId);
  fallback = await captureOne(fx.assignmentId, JPEG_FALLBACK);
  ({ cookie, grantId } = await openLink(fx.occurrenceId));
});

describe("external.evidence_bytes — GET /external/evidence", () => {
  it("serves the bytes of an object on the session's own occurrence", async () => {
    const res = await bytes(cookie, mine);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("content-length")).toBe(String(JPEG.byteLength));
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
  });

  it("carries EVERY header the wrapper-served responses carry — iterated, not listed", async () => {
    // CORRECTED 2026-08-22. This used to assert four literals it had copied out
    // of `externalNoStore`, which is exactly the divergence it was supposed to
    // prevent: a fifth header added to the wrapper's record would have extended
    // every wrapper-served response, skipped the byte route, and left this test
    // green. It now iterates `EXTERNAL_RESPONSE_HEADERS` — the record the route
    // spreads and the wrapper spreads — so the assertion grows with the source
    // instead of trailing it.
    const res = await bytes(cookie, mine);
    expect(res.status).toBe(200);
    expect(Object.keys(EXTERNAL_RESPONSE_HEADERS).length).toBeGreaterThanOrEqual(4);
    for (const [name, value] of Object.entries(EXTERNAL_RESPONSE_HEADERS)) {
      expect(res.headers.get(name), `missing or wrong: ${name}`).toBe(value);
    }
    // The one value spelled out on purpose, because it is the one whose exact
    // string a reviewer will want to read in a test rather than chase through a
    // constant: this response must not be storable by anything in between.
    expect(res.headers.get("cache-control")).toContain("no-store");
    await res.arrayBuffer();
  });

  it("carries its own CSP, because a top-level navigation is a document the shell's CSP never reaches", async () => {
    // `x-frame-options` stops framing, not navigation. `application/pdf` is in
    // `evidence-inspection.ts`'s recognised set and renders inline as a document
    // of its own on the external origin; the review shell's CSP binds the
    // shell's response and no sibling document. This header is what covers that
    // case, and it leaves `<img>` alone because CSP's `sandbox` directive
    // applies only to a response loaded AS a document.
    //
    // WHAT THIS ASSERTS IS THAT THE HEADER IS SENT. It does not assert the
    // browser behaviour that makes it worth sending — nothing in this repo
    // renders a PDF and no browser audit drives this path yet.
    const res = await bytes(cookie, mine);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    await res.arrayBuffer();
  });

  it("puts NO storage key and NO signed URL in any header", async () => {
    // files-and-storage.md: «Logs record the domain object and authorization
    // result, never the signed URL or raw storage key». The response is the
    // surface a test can actually reach; the log line is asserted by
    // construction (`EvidenceStorageError` cannot carry either) and named in
    // TODOS.md as unassertable while this app has no logger.
    const row = await q<{ storage_key: string; storage_bucket: string }>(
      `select storage_key, storage_bucket from public.evidence_objects where id = $1`, [mine]);
    const key = row[0]!.storage_key;
    expect(key.length).toBeGreaterThan(0);

    const res = await bytes(cookie, mine);
    expect(res.status).toBe(200);
    const serialized = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
    expect(serialized).not.toContain(key);
    // Both halves of the key, in case a future change ever emitted a prefix.
    for (const half of key.split("/")) expect(serialized).not.toContain(half);
    expect(serialized).not.toContain("token=");
    expect(serialized).not.toContain("/object/sign/");
    await res.arrayBuffer();
  });

  it("refuses an object on a SIBLING occurrence of the SAME assignment", async () => {
    // TWO mechanisms have to agree for this to pass, and it is worth knowing
    // which is which. `eo_external_select` scopes to
    // `app.external_session_occurrence()`; the route ALSO joins the intent and
    // requires `requirement_occurrence_id` to equal the occurrence
    // `app.resolve_external_session` handed it. Either alone would produce this
    // 404 today — which is the point of having both, and is also why this case
    // cannot tell them apart. What it does prove is that a route filtering on
    // caller input and cross-checking nothing (which is what this route did
    // until 2026-08-22) has no way to reach a 200 here as long as at least one
    // of the two holds. The sibling row EXISTS — `captureOne` returned its id
    // above — so this 404 is a refusal and not an absence.
    const res = await bytes(cookie, sibling);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("EXTERNAL_SHARE_INVALID");
  });

  /**
   * THE CASE THE PREVIOUS VERSION OF THIS ROUTE COULD NOT SURVIVE, and the one
   * the coordinator's fix-round finding is about.
   *
   * Until 2026-08-22 the route ran `where id = $1` and then asserted
   * `rows.length === 1`, under a comment claiming that assertion caught a
   * widened policy. `evidence_objects.id` is the PRIMARY KEY, so the count was
   * one whenever the policy admitted the row at all: a widened
   * `eo_external_select` would have been served, with a 200, to a no-account
   * supervisor asking for a sibling's uuid.
   *
   * So this case WIDENS THE POLICIES FOR REAL — both of them, because widening
   * only `eo_external_select` would leave `ui_external_select` refusing the
   * join and the test would pass for the wrong reason — and then asserts two
   * things in order:
   *
   *   1. the widening TOOK: the exact query the old route ran now returns the
   *      sibling's row through a live external session, so the old shape's
   *      count assertion would have passed and its bytes would have been
   *      served. Without this step the case could be vacuous and look green.
   *   2. the route REFUSES ANYWAY, because its own SQL requires the intent's
   *      `requirement_occurrence_id` to equal the occurrence the SESSION
   *      resolved to — a value the policy plays no part in producing.
   *
   * The original policy expressions are read back out of `pg_policy` and
   * restored in a `finally`, rather than re-typed from the migration, so this
   * case cannot drift from whatever 0049 §10 actually says. If the process is
   * killed between the widening and the restore the local database is left
   * permissive until the next `supabase db reset` — the same exposure any
   * DDL-mutating case here has, named rather than hidden.
   *
   * THE RESTORE IS VERIFIED INSIDE THE `finally`, not after it — corrected
   * 2026-08-22. Verification that sits after the `try/finally` only runs when
   * the body PASSED, which is precisely the run where a leak matters least; on
   * a failing run the restore happened and nothing checked it. Inside the
   * `finally` it runs on every exit path.
   *
   * The cost, stated because it is a real one: an `expect` that fails inside a
   * `finally` REPLACES the body's error, so a run where both the body and the
   * restore failed reports only the restore. That is the right way round — a
   * leaked permissive policy silently weakens every suite that runs after this
   * file, while a body failure is reproducible by running the case again.
   */
  it("refuses the sibling EVEN IF BOTH POLICIES ARE WIDENED — the route pins the occurrence itself", async () => {
    // ORDERED — corrected 2026-08-22. `pg_policy` has no guaranteed row order,
    // and the two reads are compared with `toEqual`, which is order-sensitive.
    // Catalog order can shift after the ALTERs below, so an unordered pair could
    // report a spurious red AFTER A CORRECT RESTORE — a failure that tells the
    // next person the policies leaked when they did not.
    const readPolicies = () => q<{ polname: string; qual: string }>(
      `select p.polname, pg_get_expr(p.polqual, p.polrelid) as qual
         from pg_policy p
        where p.polname in ('eo_external_select', 'ui_external_select')
        order by p.polname`);

    const original = await readPolicies();
    expect(original).toHaveLength(2);
    const sessionRow = await q<{ id: string }>(
      `select id from public.external_sessions where status = 'active'`);
    expect(sessionRow).toHaveLength(1);
    const sessionId = sessionRow[0]!.id;

    const { withExternalTx } = await import("@goproceed/database");
    // The OLD query, verbatim: filter on caller input, cross-check nothing.
    const oldRouteQuery = async () => withExternalTx(
      { organizationId: fx.workspaceId, requestId: crypto.randomUUID(),
        externalSessionId: sessionId },
      async (tx) => (await tx.query(
        `select storage_key from public.evidence_objects where id = $1`, [sibling])).rows.length);

    // Narrow: the old query already sees nothing, so the widening below is what
    // creates the interesting state rather than the fixture accidentally having
    // it.
    expect(await oldRouteQuery()).toBe(0);

    try {
      await ddl(`alter policy ui_external_select on public.upload_intents
                   using (status = 'available')`);
      await ddl(`alter policy eo_external_select on public.evidence_objects
                   using (exists (
                     select 1 from public.upload_intents ui
                      where ui.workspace_id = evidence_objects.workspace_id
                        and ui.id = evidence_objects.upload_intent_id
                        and ui.status = 'available'))`);

      // 1. THE WIDENING TOOK, and the old shape would have served the sibling.
      expect(await oldRouteQuery()).toBe(1);

      // 2. THE ROUTE STILL REFUSES.
      const res = await bytes(cookie, sibling);
      expect(res.status, await res.clone().text()).toBe(404);
      expect((await res.json()).code).toBe("EXTERNAL_SHARE_INVALID");

      // …and the session's OWN object is still served, so the refusal above is
      // the occurrence predicate biting and not the route simply broken.
      const own = await bytes(cookie, mine);
      expect(own.status).toBe(200);
      expect(new Uint8Array(await own.arrayBuffer())).toEqual(JPEG);
    } finally {
      for (const row of original) {
        const table = row.polname === "eo_external_select" ? "evidence_objects" : "upload_intents";
        await ddl(`alter policy ${row.polname} on public.${table} using (${row.qual})`);
      }
      // ASSERTED HERE, on every exit path — see the case's header for why this
      // is not after the `try/finally` and what it costs when both fail.
      expect(await readPolicies()).toEqual(original);
      // Behavioural, not only textual: the widened view is gone as well as the
      // widened text.
      expect(await oldRouteQuery()).toBe(0);
    }
  });

  it("refuses a photo captured against NO occurrence at all", async () => {
    // The fallback door: `upload_intents.requirement_occurrence_id` is nullable
    // by design, and `null = <uuid>` is NULL, not true. Asserted because the
    // policy's null behaviour is the kind of thing a «simplifying» rewrite
    // (`coalesce`, `is not distinct from`) silently inverts.
    const res = await bytes(cookie, fallback);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("EXTERNAL_SHARE_INVALID");
  });

  it("gives the SAME refusal for an id that does not exist, and for a malformed one", async () => {
    // No oracle: «not yours», «never existed» and «not even a uuid» are one
    // answer. The envelope is compared field for field except `requestId`,
    // which is minted per request and must differ.
    const absent = await bytes(cookie, crypto.randomUUID());
    const malformed = await bytes(cookie, "not-a-uuid");
    const foreign = await bytes(cookie, sibling);
    expect([absent.status, malformed.status, foreign.status]).toEqual([404, 404, 404]);
    const [a, m, f] = [await absent.json(), await malformed.json(), await foreign.json()];
    expect({ ...m, requestId: null }).toEqual({ ...a, requestId: null });
    expect({ ...f, requestId: null }).toEqual({ ...a, requestId: null });
    // A malformed id must not become a 500 through SQLSTATE 22P02 — the shape
    // difference would be measurable even though it is not an existence oracle.
    expect(m.code).toBe("EXTERNAL_SHARE_INVALID");
  });

  it("refuses with no cookie, and with a well-formed cookie naming nothing", async () => {
    expect((await bytes(null, mine)).status).toBe(404);
    expect((await bytes("x".repeat(43), mine)).status).toBe(404);
  });

  it("refuses another workspace's session — the grant never crosses a boundary", async () => {
    // A LIVE session, correctly exchanged, for a DIFFERENT workspace's own
    // obligation. The cookie is valid; the object is not in its scope.
    const own = mine;
    current = B;
    const other = await baseline(B);
    await captureOne(other.assignmentId, JPEG, other.occurrenceId);
    const { cookie: otherCookie } = await openLink(
      other.occurrenceId, "prykladinshyi@example.test");
    current = A;
    const res = await bytes(otherCookie, own);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("EXTERNAL_SHARE_INVALID");
  });

  it("refuses after the grant is revoked", async () => {
    // The exchange bumped the grant to version 2.
    const rev = await revoke(grantId, 2);
    expect(rev.status, await rev.clone().text()).toBe(200);
    expect((await rev.json()).revokedStatus).toBe("revoked");

    const res = await bytes(cookie, mine);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("EXTERNAL_SHARE_INVALID");

    // NOT ASSERTED, AND NOT ACHIEVABLE HERE: that a transfer already in flight
    // stops. Revocation is revalidated per request — twice, at session
    // resolution and again per statement — and «during» is implemented nowhere
    // in this repository: no chunked re-check, no abort path, no cancellation
    // token, and `openObjectStream` takes no `AbortSignal`. Asserting it would
    // be a false guarantee.
  });

  it("writes nothing — not an audit row, not an outbox row, not an idempotency record", async () => {
    // A GET on this plane mutates no grant (INV-010) and this one additionally
    // records no read. `audit_events` is unreadable from the external session
    // itself, so the sweep runs as the admin client.
    const before = await q<{ n: string }>(
      `select (
         (select count(*) from public.audit_events)
       + (select count(*) from public.transaction_outbox)
       + (select count(*) from public.idempotency_records))::text as n`);
    const res = await bytes(cookie, mine);
    expect(res.status).toBe(200);
    await res.arrayBuffer();
    const after = await q<{ n: string }>(
      `select (
         (select count(*) from public.audit_events)
       + (select count(*) from public.transaction_outbox)
       + (select count(*) from public.idempotency_records))::text as n`);
    expect(after[0]!.n).toBe(before[0]!.n);
    // And the grant is untouched: not consumed a second time, not revoked.
    const g = await q<{ status: string }>(
      `select status from public.external_access_grants where id = $1`, [grantId]);
    expect(g[0]!.status).toBe("active");
  });
});
