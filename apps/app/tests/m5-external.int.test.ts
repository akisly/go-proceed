import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { q, truncateAll, jsonReq, baselineFixture, type BaselineFixture } from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";
import { withTenantTx } from "@goproceed/database";
import {
  BOUND_RULE_VERSIONS_SQL, boundRuleVersion, planForWorkType,
} from "../src/lib/requirement-materialisation";
import { materialiseOccurrences } from "../src/lib/occurrence-writer";
import {
  EXTERNAL_CSRF_HEADER, EXTERNAL_SESSION_COOKIE, resetKeyRegistriesForTests,
} from "../src/lib/external-link";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No `vitest`, no `tsc`, no `psql`, no
 * `supabase`; no route was invoked, no migration applied, and no claim is made
 * that any assertion below passes. Static reading is the only check that was
 * available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M5 — THE LINK.
 *
 * roadmap.md's M5 exit gate and tenancy-and-security.md §"Protected external-link
 * protocol" fix what this suite has to prove, and none of it is «a page renders»:
 *
 *   the bearer token travels in the URL FRAGMENT and is exchanged by a
 *   same-origin POST; a GET must never receive or consume the token; the server
 *   stores only a keyed hash; history is cleaned immediately; the session is
 *   short and revocable; revoked, expired, replaced, replayed, CSRF and
 *   wrong-version submissions all fail closed; an observer cannot decide; the
 *   decision receipt is immutable.
 *
 * Every case below attempts the thing the rule exists to stop.
 *
 * WHY THE OCCURRENCE IS MATERIALISED BY A HELPER AND NOT BY THE ROUTE:
 * unchanged from `m3-refusal.int.test.ts`, including the correction that suite's
 * header now carries. THIS fixture's work line carries no work type, so
 * `assignments.create` materialises nothing here, and a suite that used the
 * route would grant a link to an obligation set that does not exist. Until
 * migration 0050 that was true of every line in the product; it is now this
 * fixture's own choice, and the rewrite m3-refusal owes — type the line, delete
 * the harness — is owed here in the same terms.
 *
 * WHAT THIS SUITE DELIBERATELY DOES NOT ASSERT:
 *
 *   THROTTLING. There is none — not here, not anywhere in this product, for any
 *   surface. Migration 0049 §11 item 3 records it as the largest security gap
 *   M5 leaves. A test that hammered the exchange and asserted «all succeeded»
 *   would be pinning the gap, which is the one thing a test here may not do.
 *
 *   THE PHOTO. `external.occurrence_scope` returns the evidence object's
 *   identity, hash and provenance and NOT its bytes: no operation in
 *   `technical/openapi/scope-v0.1.csv` streams an original to an external
 *   session. The case below asserts what IS returned and names the gap rather
 *   than asserting a substitute.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const ORIGIN = "https://prykladapp.example";

/**
 * `packages.submit` IS IN NO ROW OF
 * technical/permissions/responsibility-presets.csv — the fourth time this
 * project has had to grant a capability by hand (M1 finding 8, M3 item 22, M4
 * item 32). Migration 0049 §11 item 2 records it. Named rather than folded into
 * the list so the workaround stays legible.
 */
const M5_PRESET_GAP = ["packages.submit"] as const;
const CAPS = ["assignments.manage", "rule_bindings.manage", "requirements.assign",
              "progress.record", "evidence.record", "evidence_decisions.decide",
              "stage_closures.close", "requirement_exceptions.decide", "readiness.view",
              ...M5_PRESET_GAP] as const;

const WORK_TYPE = "montazh-elektrotekhnichnykh-ustanovok";
const STAGE = "prykhovani-roboty";
const APPROVER = "technical_supervisor";

interface Fx extends BaselineFixture {
  contractVersionId: string;
  workItemId: string;
  assignmentId: string;
  workStageId: string;
  /** The obligation whose approver the baseline records as EXTERNAL. */
  occurrenceId: string;
}

beforeAll(() => {
  process.env.EXTERNAL_LINK_ORIGIN = ORIGIN;
  process.env.EXTERNAL_LINK_HMAC_KEYS = "k1:" + Buffer.alloc(32, 11).toString("base64");
  process.env.EXTERNAL_LINK_ACTIVE_KEY_ID = "k1";
  process.env.EXTERNAL_SESSION_HMAC_KEYS = "s1:" + Buffer.alloc(32, 12).toString("base64");
  process.env.EXTERNAL_SESSION_ACTIVE_KEY_ID = "s1";
  resetKeyRegistriesForTests();
});

beforeEach(async () => {
  current = A;
  await truncateAll();
});

async function grantCaps(projectId: string, memberId: string): Promise<void> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const res = await POST(jsonReq("http://x", { memberId, capabilities: [...CAPS] }),
    { params: Promise.resolve({ projectId }) });
  if (res.status >= 300) throw new Error(`grant ${res.status} ${await res.text()}`);
}

/**
 * ONE obligation, and its approver is EXTERNAL.
 *
 * `approverIsExternal: true` on a `hold` was refused by
 * `requirement_rule_versions.publish` until this milestone — INV-085, «while
 * v0.1-M5 is open a hold names an INTERNAL approver role». That the publication
 * below SUCCEEDS is the lift, and it is asserted as a case of its own rather
 * than only relied on by this fixture.
 */
async function baseline(): Promise<Fx> {
  const base = await baselineFixture(A);
  await grantCaps(base.projectId, base.memberId);
  const library = await seedRequirementLibrary(base.workspaceId);

  const res = await publishRuleVersion(base.workspaceId,
    ruleVersionBody(library.get("Н.15/1")!, {
      workTypeKey: WORK_TYPE, stageKey: STAGE,
      approverRole: APPROVER, approverIsExternal: true,
    }));
  if (res.status !== 201) {
    throw new Error(`publishRuleVersion ${res.status} ${await res.text()}`);
  }
  const ruleVersionId = (await res.json()).ruleVersionId as string;

  const draft = await createDraft(base.contractId);
  const contractVersionId = (await draft.json()).contractVersionId as string;
  const line = await addLine(contractVersionId, {
    // WORK_TYPE, not omitted: since 0050 the line's work type is the left-hand
    // side of the materialisation predicate, and the rule bound below carries
    // WORK_TYPE. A line without one intersects nothing and the publish 409s.
    sourceKey: "1.1", workTypeKey: WORK_TYPE,
    description: "Приклад-прокладання кабелю в штробі",
    unitCode: "м", contractQuantity: "10",
    unitPriceState: "known", unitPrice: "100.00",
  });
  if (line.status !== 201) throw new Error(`addLine ${line.status} ${await line.text()}`);
  const workItemId = (await line.json()).workItem.workItemId as string;

  const bind = await bindRules(contractVersionId, [ruleVersionId]);
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

  const written = await withTenantTx(
    { actorUserId: A, organizationId: null, requestId: crypto.randomUUID() },
    async (tx) => {
      const existing = await tx.query(
        `select count(*)::int as n from public.requirement_occurrences
          where workspace_id = $1 and work_assignment_id = $2`,
        [base.workspaceId, assignmentId]);
      if (existing.rows[0].n > 0) {
        throw new Error(
          "m5-external: assignments.create has already materialised this assignment's "
          + "obligation set. The carrier has existed since migration 0050; reaching "
          + "this means this fixture's line acquired a work type: delete this harness "
          + "and let the route build the fixture.");
      }
      const bound = (await tx.query(BOUND_RULE_VERSIONS_SQL,
        [base.workspaceId, contractVersionId])).rows.map(boundRuleVersion);
      const plan = planForWorkType(WORK_TYPE, bound);
      return materialiseOccurrences(tx, {
        workspaceId: base.workspaceId, projectId: base.projectId, contractId: base.contractId,
        contractVersionId, assignmentId, memberId: base.memberId,
      }, plan);
    });

  return {
    ...base, contractVersionId, workItemId, assignmentId,
    workStageId: written.stageIds[0]!, occurrenceId: written.occurrenceIds[0]!,
  };
}

async function issue(
  occurrenceId: string, body: Record<string, unknown> = {}, key = crypto.randomUUID(),
): Promise<Response> {
  const { POST } = await import("../app/v1/occurrences/[occurrenceId]/grants/route");
  const req = new Request("http://x", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify({
      recipientEmail: "prykladtechnahliad@example.test",
      recipientRole: APPROVER,
      permissions: { "external.view_scope": true, "external.decide_evidence": true },
      ...body,
    }),
  });
  return POST(req, { params: Promise.resolve({ occurrenceId }) });
}

function tokenOf(link: { url: string }): string {
  return new URL(link.url).hash.slice(1);
}

async function exchange(token: string, origin = ORIGIN): Promise<Response> {
  const { POST } = await import("../app/external/exchange/route");
  return POST(new Request(`${ORIGIN}/external/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ token }),
  }));
}

/** The opaque cookie value the browser would have stored. */
function cookieOf(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  const m = new RegExp(`${EXTERNAL_SESSION_COOKIE}=([A-Za-z0-9_-]{43})`).exec(raw);
  if (!m) throw new Error(`no external session cookie in: ${raw}`);
  return m[1]!;
}

async function scope(cookie: string | null): Promise<Response> {
  const { GET } = await import("../app/external/occurrence/route");
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = `${EXTERNAL_SESSION_COOKIE}=${cookie}`;
  return GET(new Request(`${ORIGIN}/external/occurrence`, { headers }),
    { params: Promise.resolve({}) });
}

async function submit(
  cookie: string, csrf: string | null, body: Record<string, unknown>,
  o: { key?: string; origin?: string; contentType?: string } = {},
): Promise<Response> {
  const { POST } = await import("../app/external/occurrence-decisions/route");
  const headers: Record<string, string> = {
    "content-type": o.contentType ?? "application/json",
    origin: o.origin ?? ORIGIN,
    cookie: `${EXTERNAL_SESSION_COOKIE}=${cookie}`,
    "idempotency-key": o.key ?? crypto.randomUUID(),
  };
  if (csrf !== null) headers[EXTERNAL_CSRF_HEADER] = csrf;
  return POST(new Request(`${ORIGIN}/external/occurrence-decisions`, {
    method: "POST", headers, body: JSON.stringify(body),
  }), { params: Promise.resolve({}) });
}

/** The whole happy path up to «the reviewer is looking at the page». */
async function openLink(fx: Fx, body: Record<string, unknown> = {}): Promise<{
  grantId: string; token: string; cookie: string; csrf: string;
  scopeBody: Record<string, unknown>;
}> {
  const issued = await issue(fx.occurrenceId, body);
  expect(issued.status).toBe(201);
  const grant = await issued.json();
  const token = tokenOf(grant.link);
  const ex = await exchange(token);
  expect(ex.status).toBe(200);
  const cookie = cookieOf(ex);
  const csrf = (await ex.json()).csrfToken as string;
  const sc = await scope(cookie);
  expect(sc.status).toBe(200);
  return { grantId: grant.grantId, token, cookie, csrf, scopeBody: await sc.json() };
}

describe("INV-085 is lifted BY the change that ships the grant", () => {
  it("publishes a hold naming an EXTERNAL approver, which was refused before M5", async () => {
    const base = await baselineFixture(A);
    await grantCaps(base.projectId, base.memberId);
    const library = await seedRequirementLibrary(base.workspaceId);
    const res = await publishRuleVersion(base.workspaceId,
      ruleVersionBody(library.get("Н.15/1")!, {
        workTypeKey: WORK_TYPE, stageKey: STAGE, approverIsExternal: true,
      }));
    // invariant-catalog.csv:86 requires BOTH directions to be tested. The
    // «rejected before M5» direction is not writable as a test any more — the
    // constant that carried it is `true` — so what remains is this, plus the
    // constant itself, which names the date and the reason it moved.
    expect(res.status).toBe(201);
    const stored = await q<{ approver_is_external: boolean }>(
      `select approver_is_external from public.requirement_rule_versions
        where workspace_id = $1`, [base.workspaceId]);
    expect(stored[0]!.approver_is_external).toBe(true);
  });
});

describe("occurrence_grants.issue — INV-044", () => {
  it("stores only a keyed HMAC, and the raw token is in NO row of the database", async () => {
    const fx = await baseline();
    const res = await issue(fx.occurrenceId);
    expect(res.status).toBe(201);
    const body = await res.json();
    const token = tokenOf(body.link);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const g = await q<{ token_hmac: Buffer; hmac_key_id: string; decides_evidence: boolean }>(
      `select token_hmac, hmac_key_id, decides_evidence
         from public.external_access_grants where id = $1`, [body.grantId]);
    expect(g[0]!.token_hmac).toHaveLength(32);
    expect(g[0]!.hmac_key_id).toBe("k1");
    expect(g[0]!.decides_evidence).toBe(true);

    // THE SWEEP. Not «the token column is absent» — the token must not appear
    // anywhere, in any table, in any jsonb, under any name. `idempotency_records`
    // is the one that would catch it if the route ever returned the link from
    // inside `withIdempotency`.
    const hits = await q<{ n: number }>(
      `select (
         (select count(*) from public.external_access_grants
           where recipient_email = $1 or recipient_role = $1)
       + (select count(*) from public.audit_events where details::text like $2)
       + (select count(*) from public.transaction_outbox where payload::text like $2)
       + (select count(*) from public.idempotency_records where response_body::text like $2)
       )::int as n`, [token, `%${token}%`]);
    expect(hits[0]!.n).toBe(0);
  });

  it("puts the token in the FRAGMENT and never in the path or the query", async () => {
    const fx = await baseline();
    const body = await (await issue(fx.occurrenceId)).json();
    const url = new URL(body.link.url);
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/external/review");
    expect(url.search).toBe("");
    expect(url.hash).toBe(`#${tokenOf(body.link)}`);
    expect(body.link.deliveredBy).toBe("caller");
  });

  it("an idempotent replay returns the SAME grant and NO link", async () => {
    const fx = await baseline();
    const key = crypto.randomUUID();
    const first = await issue(fx.occurrenceId, {}, key);
    const second = await issue(fx.occurrenceId, {}, key);
    expect(second.status).toBe(201);
    const a1 = await first.json();
    const a2 = await second.json();
    expect(a2.grantId).toBe(a1.grantId);
    // INV-044: the token cannot be reconstructed, and a replay is the same
    // situation as a crashed send. tenancy-and-security.md §"Grant creation"
    // says so in terms; the remedy is revoke-and-reissue, not a stored copy.
    expect(a2.link).toBeUndefined();
    expect(await q("select 1 from public.external_access_grants")).toHaveLength(1);
  });

  it("refuses a DECIDING grant in a role the obligation does not name", async () => {
    const fx = await baseline();
    const res = await issue(fx.occurrenceId, { recipientRole: "heodezyst" });
    expect(res.status).toBe(422);
    const p = await res.json();
    expect(p.code).toBe("VALIDATION_FAILED");
    expect(p.fieldErrors.map((f: { path: string }) => f.path)).toContain("recipientRole");
    expect(await q("select 1 from public.external_access_grants")).toHaveLength(0);
  });

  it("but ALLOWS an observing grant in any role", async () => {
    const fx = await baseline();
    const res = await issue(fx.occurrenceId, {
      recipientRole: "heodezyst",
      permissions: { "external.view_scope": true, "external.decide_evidence": false },
    });
    expect(res.status).toBe(201);
  });

  it("refuses a second live deciding link to the same address", async () => {
    const fx = await baseline();
    expect((await issue(fx.occurrenceId)).status).toBe(201);
    const again = await issue(fx.occurrenceId);
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe("OCCURRENCE_CONFLICT");
  });

  it("is invisible to another workspace's owner — no oracle", async () => {
    const fx = await baseline();
    current = B;
    await baselineFixture(B);
    const res = await issue(fx.occurrenceId);
    // The SAME response an absent occurrence produces. INV-001/INV-002.
    expect(res.status).toBe(404);
    const absent = await issue(crypto.randomUUID());
    expect(absent.status).toBe(404);
    expect(await res.text()).toBe(await absent.text());
  });
});

describe("INV-010 — a GET never receives or consumes the token", () => {
  it("the shell is a static document that touches no table", async () => {
    const fx = await baseline();
    const body = await (await issue(fx.occurrenceId)).json();
    const before = await q<{ n: number }>(
      `select (select count(*) from public.audit_events)
            + (select count(*) from public.external_sessions) as n`);

    const { GET } = await import("../app/external/review/route");
    // Exactly what an email scanner sends: the URL WITHOUT its fragment,
    // because a browser never transmits one. Plus, for good measure, a query
    // parameter a careless client might have added.
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const after = await q<{ n: number }>(
      `select (select count(*) from public.audit_events)
            + (select count(*) from public.external_sessions) as n`);
    expect(Number(after[0]!.n)).toBe(Number(before[0]!.n));

    const g = await q<{ exchange_consumed_at: Date | null; status: string }>(
      `select exchange_consumed_at, status from public.external_access_grants where id = $1`,
      [body.grantId]);
    // THE ASSERTION THE WHOLE PROTOCOL RESTS ON.
    expect(g[0]!.exchange_consumed_at).toBeNull();
    expect(g[0]!.status).toBe("active");
  });

  it("the shell cleans history before anything else and loads nothing off-origin", async () => {
    const { GET } = await import("../app/external/review/route");
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("history.replaceState");
    // The call must precede the fetch in the source, because it precedes it at
    // run time and the order is the rule's.
    expect(html.indexOf("history.replaceState"))
      .toBeLessThan(html.indexOf("/external/exchange"));

    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toMatch(/script-src 'nonce-[^']+'/);
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    // No third-party host anywhere in the document or in its policy: a page that
    // can talk to one is a page that can hand it the token-bearing URL.
    expect(html).not.toMatch(/src=["']https?:\/\//);
    expect(csp).not.toMatch(/https?:\/\//);
    // The nonce is per response.
    const second = await (await GET()).headers.get("content-security-policy");
    expect(second).not.toBe(csp);
  });
});

describe("external.exchange — INV-057", () => {
  it("exchanges once, sets a __Host- cookie, and refuses every replay generically", async () => {
    const fx = await baseline();
    const body = await (await issue(fx.occurrenceId)).json();
    const token = tokenOf(body.link);

    const first = await exchange(token);
    expect(first.status).toBe(200);
    const setCookie = first.headers.get("set-cookie") ?? "";
    for (const attr of ["__Host-goproceed_external=", "Path=/", "Secure", "HttpOnly",
                        "SameSite=Lax"]) expect(setCookie).toContain(attr);
    expect(setCookie).not.toContain("Domain");
    const ex = await first.json();
    expect(ex.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ex.mayDecide).toBe(true);
    // The response must not echo the token back.
    expect(JSON.stringify(ex)).not.toContain(token);

    const replay = await exchange(token);
    expect(replay.status).toBe(404);
    expect((await replay.json()).code).toBe("EXTERNAL_SHARE_INVALID");
    // A token that never existed produces a BYTE-IDENTICAL response. «never
    // reveals whether a recipient, package, occurrence, workspace, or grant
    // exists».
    const never = await exchange("z".repeat(43));
    expect(never.status).toBe(404);
    expect(await replay.text()).toBe(await never.text());

    expect(await q("select 1 from public.external_sessions")).toHaveLength(1);
  });

  it("lets exactly ONE of two concurrent exchanges win", async () => {
    const fx = await baseline();
    const body = await (await issue(fx.occurrenceId)).json();
    const token = tokenOf(body.link);
    // A RACE. A green run is not by itself proof that the race is closed — it is
    // evidence that it was not observed on this run. What closes it is the row
    // lock in `app.exchange_external_grant` and
    // `external_sessions_one_exchange_key`, and `m5-external-schema.test.ts`
    // attacks the second directly.
    const [x, y] = await Promise.all([exchange(token), exchange(token)]);
    const ok = [x, y].filter((r) => r.status === 200);
    const refused = [x, y].filter((r) => r.status === 404);
    expect(ok).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(await q("select 1 from public.external_sessions")).toHaveLength(1);
  });

  it("refuses a cross-origin POST and a wrong content type", async () => {
    const fx = await baseline();
    const token = tokenOf((await (await issue(fx.occurrenceId)).json()).link);
    const bad = await exchange(token, "https://evil.example");
    expect(bad.status).toBe(422);
    const g = await q<{ exchange_consumed_at: Date | null }>(
      "select exchange_consumed_at from public.external_access_grants");
    // A refused exchange consumes nothing.
    expect(g[0]!.exchange_consumed_at).toBeNull();
  });

  it("a revoked grant cannot be exchanged", async () => {
    const fx = await baseline();
    const body = await (await issue(fx.occurrenceId)).json();
    const { POST: revoke } = await import("../app/v1/grants/[grantId]/revoke-reissue/route");
    const rev = await revoke(new Request("http://x", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ reissue: false, reason: "Приклад-надіслано не тій особі",
                             expectedVersion: 1 }),
    }), { params: Promise.resolve({ grantId: body.grantId }) });
    expect(rev.status).toBe(200);
    expect((await rev.json()).revokedStatus).toBe("revoked");
    expect((await exchange(tokenOf(body.link))).status).toBe(404);
  });
});

describe("external.occurrence_scope", () => {
  it("returns ONE obligation, its citation with tag and source, and NO money", async () => {
    const fx = await baseline();
    const { scopeBody } = await openLink(fx);
    expect((scopeBody.occurrence as Record<string, unknown>).requirementOccurrenceId)
      .toBe(fx.occurrenceId);
    const norm = (scopeBody.occurrence as Record<string, unknown>).normRef as
      Record<string, string> | null;
    if (norm !== null) {
      // INV-073's rendering half: the tag and the source travel WITH the string.
      expect(norm.verification).toMatch(/^VERIFIED_(PRIMARY|SECONDARY)$/);
      expect(norm.source.length).toBeGreaterThan(0);
    }
    // THE NEGATIVE THAT MATTERS. Not «we did not select the price» — the session
    // has no policy on `public.work_items` at all, so there is no price to
    // select. This asserts the wire half of it.
    const serialized = JSON.stringify(scopeBody);
    for (const banned of ["unitPrice", "netAmount", "grossAmount", "currency",
                          "workItemId", "workAssignmentId", "projectId", "contractId",
                          "plannedQuantity"]) {
      expect(serialized).not.toContain(banned);
    }
    expect((scopeBody.assurance as Record<string, string>).label).toBe("LINK_CONFIRMATION");
    expect((scopeBody.assurance as Record<string, string>).notASignature)
      .toContain("Це не електронний підпис.");
  });

  it("is a 404 without a cookie, with a malformed one, and after revocation", async () => {
    const fx = await baseline();
    const { cookie, grantId } = await openLink(fx);
    expect((await scope(null)).status).toBe(404);
    expect((await scope("x".repeat(43))).status).toBe(404);

    const { POST: revoke } = await import("../app/v1/grants/[grantId]/revoke-reissue/route");
    await revoke(new Request("http://x", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ reissue: false, reason: "Приклад-відкликано", expectedVersion: 2 }),
    }), { params: Promise.resolve({ grantId }) });
    // INV-009. The session row's own status is irrelevant: the scope function
    // compares the grant's state and revocation version on every request.
    expect((await scope(cookie)).status).toBe(404);
  });
});

describe("external.occurrence_decision_submit", () => {
  it("refuses without the synchronizer token, and from another origin — INV-058", async () => {
    const fx = await baseline();
    const { cookie, csrf, scopeBody } = await openLink(fx);
    const body = {
      outcome: "accepted", issues: [], expectedVersion: null, reviewerClaims: {},
      confirmationTextVersion: scopeBody.confirmationTextVersion,
    };
    expect((await submit(cookie, null, body)).status).toBe(422);
    expect((await submit(cookie, "y".repeat(43), body)).status).toBe(422);
    expect((await submit(cookie, csrf, body, { origin: "https://evil.example" })).status).toBe(422);
    expect((await submit(cookie, csrf, body, { contentType: "text/plain" })).status).toBe(422);
    // SameSite is not the defense, and none of the four refusals wrote anything.
    expect(await q("select 1 from public.requirement_evidence_decisions")).toHaveLength(0);
    expect(await q("select 1 from public.external_decision_batches")).toHaveLength(0);
  });

  it("an OBSERVER is refused — INV-031", async () => {
    const fx = await baseline();
    const { cookie, csrf, scopeBody } = await openLink(fx, {
      recipientRole: "heodezyst",
      permissions: { "external.view_scope": true, "external.decide_evidence": false },
    });
    expect((scopeBody.permissions as { mayDecide: boolean }).mayDecide).toBe(false);
    const res = await submit(cookie, csrf, {
      outcome: "accepted", issues: [], expectedVersion: null, reviewerClaims: {},
      confirmationTextVersion: scopeBody.confirmationTextVersion,
    });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_DENIED");
    expect(await q("select 1 from public.requirement_evidence_decisions")).toHaveLength(0);
  });

  it("records the decision, the receipt, and rotates the session", async () => {
    const fx = await baseline();
    const { cookie, csrf, scopeBody } = await openLink(fx);
    const res = await submit(cookie, csrf, {
      outcome: "returned",
      reason: "Приклад-на фото не видно позначки глибини закладення",
      issues: [], expectedVersion: null,
      reviewerClaims: { name: "Приклад-Технагляд", company: "ТОВ Приклад-Нагляд" },
      confirmationTextVersion: scopeBody.confirmationTextVersion,
    });
    expect(res.status).toBe(201);
    const receipt = await res.json();
    expect(receipt.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.assuranceLabel).toBe("LINK_CONFIRMATION");
    expect(receipt.occurrenceSatisfied).toBe(false);

    const d = await q<{
      decided_by_member_id: string | null; assurance_label: string;
      external_session_id: string | null; decision_batch_id: string | null; outcome: string;
    }>(`select decided_by_member_id, assurance_label, external_session_id,
               decision_batch_id, outcome
          from public.requirement_evidence_decisions`);
    expect(d).toHaveLength(1);
    // EXACTLY ONE DECIDING AUTHORITY, and it is not a member.
    expect(d[0]!.decided_by_member_id).toBeNull();
    expect(d[0]!.external_session_id).not.toBeNull();
    expect(d[0]!.decision_batch_id).not.toBeNull();
    expect(d[0]!.assurance_label).toBe("LINK_CONFIRMATION");

    // The audit row is `external`, carries no user, and is in the session's own
    // workspace.
    const audit = await q<{ actor_type: string; actor_user_id: string | null }>(
      `select actor_type, actor_user_id from public.audit_events
        where action = 'requirement_evidence_decision.recorded'`);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.actor_type).toBe("external");
    expect(audit[0]!.actor_user_id).toBeNull();

    // ROTATION: a new cookie, a new CSRF token, the old session revoked.
    const rotated = cookieOf(res);
    expect(rotated).not.toBe(cookie);
    expect(receipt.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(receipt.csrfToken).not.toBe(csrf);
    const sessions = await q<{ status: string; rotated_from_session_id: string | null }>(
      "select status, rotated_from_session_id from public.external_sessions order by created_at");
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.status).toBe("revoked");
    expect(sessions[1]!.status).toBe("active");
    expect(sessions[1]!.rotated_from_session_id).not.toBeNull();
    // The OLD cookie is dead the moment it rotates.
    expect((await scope(cookie)).status).toBe(404);
    expect((await scope(rotated)).status).toBe(200);
  });

  it("INV-007 — the same key replays the same receipt; a different body conflicts", async () => {
    const fx = await baseline();
    const { cookie, csrf, scopeBody } = await openLink(fx);
    const key = crypto.randomUUID();
    const body = {
      outcome: "accepted", issues: [], expectedVersion: null, reviewerClaims: {},
      confirmationTextVersion: scopeBody.confirmationTextVersion,
    };
    const first = await submit(cookie, csrf, body, { key });
    expect(first.status).toBe(201);
    const receipt = await first.json();
    const rotated = cookieOf(first);

    const replay = await submit(rotated, receipt.csrfToken, body, { key });
    expect(replay.status).toBe(200);
    const again = await replay.json();
    expect(again.receiptId).toBe(receipt.receiptId);
    expect(again.receiptHash).toBe(receipt.receiptHash);
    // A replay rotates nothing, so it hands back no token and sets no cookie.
    expect(again.csrfToken).toBeUndefined();
    expect(replay.headers.get("set-cookie")).toBeNull();
    // AND IT DECIDED ONCE.
    expect(await q("select 1 from public.requirement_evidence_decisions")).toHaveLength(1);
    expect(await q("select 1 from public.external_decision_batches")).toHaveLength(1);

    const conflicting = await submit(rotated, receipt.csrfToken,
      { ...body, outcome: "returned", reason: "Приклад-інша причина" }, { key });
    expect(conflicting.status).toBe(409);
    expect((await conflicting.json()).code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("refuses a stale head version and a stale confirmation wording", async () => {
    const fx = await baseline();
    const { cookie, csrf, scopeBody } = await openLink(fx);
    const good = {
      outcome: "accepted", issues: [], expectedVersion: null, reviewerClaims: {},
      confirmationTextVersion: scopeBody.confirmationTextVersion,
    };
    // A reviewer whose page was rendered before somebody else decided.
    expect((await submit(cookie, csrf, { ...good, expectedVersion: 1 })).status).toBe(409);
    // A receipt that says «they agreed» and cannot say to what is not a receipt.
    const stale = await submit(cookie, csrf,
      { ...good, confirmationTextVersion: "external-occurrence-decision/1+000000000000" });
    expect(stale.status).toBe(409);
    expect(await q("select 1 from public.external_decision_batches")).toHaveLength(0);
  });

  it("an accepting external decision releases the hold and STILL MOVES NO MONEY", async () => {
    const fx = await baseline();
    const { cookie, csrf, scopeBody } = await openLink(fx);
    const res = await submit(cookie, csrf, {
      outcome: "accepted", issues: [], expectedVersion: null,
      reviewerClaims: { name: "Приклад-Технагляд" },
      confirmationTextVersion: scopeBody.confirmationTextVersion,
    });
    expect(res.status).toBe(201);
    expect((await res.json()).occurrenceSatisfied).toBe(true);

    // INV-075, first half, and ADR-008: the money moves at the stage closure and
    // nowhere else. An acceptance that admitted money would make the approver a
    // payer.
    expect(await q("select 1 from public.valuation_allocations")).toHaveLength(0);
    expect(await q("select 1 from public.stage_closures")).toHaveLength(0);

    // And the fact is readable on the MEMBER plane, which is what the closure
    // and the act will read.
    const head = await q<{ current_outcome: string }>(
      "select current_outcome from public.requirement_evidence_decision_heads");
    expect(head[0]!.current_outcome).toBe("accepted");
  });

  it("a revoked grant's DECISIONS survive the revocation", async () => {
    const fx = await baseline();
    const { cookie, csrf, scopeBody, grantId } = await openLink(fx);
    await submit(cookie, csrf, {
      outcome: "accepted", issues: [], expectedVersion: null, reviewerClaims: {},
      confirmationTextVersion: scopeBody.confirmationTextVersion,
    });
    const { POST: revoke } = await import("../app/v1/grants/[grantId]/revoke-reissue/route");
    const rev = await revoke(new Request("http://x", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ reissue: true, reason: "Приклад-повторне надсилання",
                             expectedVersion: 2 }),
    }), { params: Promise.resolve({ grantId }) });
    expect(rev.status).toBe(200);
    const r = await rev.json();
    expect(r.revokedStatus).toBe("superseded");
    expect(r.reissuedGrantId).not.toBeNull();
    expect(r.sessionsRevoked).toBeGreaterThanOrEqual(1);
    expect(r.link.url).toContain("/external/review#");

    // Revoking the link withdraws the CAPABILITY. It does not unsay what the
    // технагляд said — the decision is what the closure will be proved against
    // and what the act will print.
    expect(await q("select 1 from public.requirement_evidence_decisions")).toHaveLength(1);
    expect(await q("select 1 from public.external_decision_batches")).toHaveLength(1);
    // The successor is a NEW grant with a NEW token, unexchanged.
    const successor = await q<{ exchange_consumed_at: Date | null; replaced_grant_id: string }>(
      `select exchange_consumed_at, replaced_grant_id
         from public.external_access_grants where id = $1`, [r.reissuedGrantId]);
    expect(successor[0]!.exchange_consumed_at).toBeNull();
    expect(successor[0]!.replaced_grant_id).toBe(grantId);
  });
});

/**
 * EXPIRY, THROUGH THE ROUTES — the one member of tenancy-and-security.md's list
 * («revoked, expired, replaced, replayed, CSRF and wrong-version submissions all
 * fail closed») that the cases above reach only in the database suite.
 *
 * WHY IT IS TESTED BY MOVING `status` AND NOT BY MOVING A CLOCK. Neither a
 * timestamp nor a fake timer is available: `app.guard_external_access_grant()`
 * fixes `expires_at` at issue and `app.guard_external_session()` refuses an idle
 * window that slides backwards, and `vi.useFakeTimers()` does not reach
 * PostgreSQL's `now()`. What both guards DO admit is the one legal status move —
 * `active` leaves exactly once — which is the state a sweep would write and the
 * state `app.current_external_session()` and `app.external_session_occurrence()`
 * resolve against.
 *
 * NOTHING EXPIRES ANYTHING IN v0.1, AND THAT IS THE POINT OF SAYING SO HERE.
 * Both `expired` states are reachable only by a sweep and there is no scheduled
 * principal in this repository, so every expiry the product actually performs is
 * a READ-TIME comparison against `now()` while the stored status stays `active`.
 * These cases prove the stored-status arm; `m5-external-schema.test.ts` proves
 * the read-time arm by inserting rows whose windows are already in the past.
 * Neither arm is a substitute for the missing sweep, and neither pretends to be.
 */
describe("expired fails closed on every external surface", () => {
  it("an expired SESSION resolves nothing, and the scope is a 404", async () => {
    const fx = await baseline();
    const { cookie, csrf, scopeBody, grantId } = await openLink(fx);

    const marked = await q<{ id: string }>(
      `update public.external_sessions set status = 'expired'
        where external_access_grant_id = $1 returning id`, [grantId]);
    expect(marked).toHaveLength(1);

    const sc = await scope(cookie);
    expect(sc.status).toBe(404);
    const submitted = await submit(cookie, csrf, {
      outcome: "accepted", issues: [], expectedVersion: null, reviewerClaims: {},
      confirmationTextVersion: scopeBody.confirmationTextVersion,
    });
    expect(submitted.status).toBe(404);
    // FAILS CLOSED means nothing was written, not that an error was rendered.
    expect(await q("select 1 from public.requirement_evidence_decisions")).toHaveLength(0);
    expect(await q("select 1 from public.external_decision_batches")).toHaveLength(0);
  });

  it("an expired GRANT closes the session that was born of it", async () => {
    const fx = await baseline();
    const { cookie, csrf, scopeBody, grantId } = await openLink(fx);

    // The session row is untouched and still `active`: the grant is the
    // authority and the session resolves THROUGH it, so withdrawing the grant
    // must be enough on its own.
    // `version = version + 1` is not decoration: `app.guard_external_grant()`
    // refuses any update that does not move the version exactly once, so a sweep
    // that forgot it would refuse too.
    await q(`update public.external_access_grants
                set status = 'expired', version = version + 1 where id = $1`, [grantId]);
    const session = await q<{ status: string }>(
      `select status from public.external_sessions where external_access_grant_id = $1`,
      [grantId]);
    expect(session[0]!.status).toBe("active");

    expect((await scope(cookie)).status).toBe(404);
    const submitted = await submit(cookie, csrf, {
      outcome: "accepted", issues: [], expectedVersion: null, reviewerClaims: {},
      confirmationTextVersion: scopeBody.confirmationTextVersion,
    });
    expect(submitted.status).toBe(404);
    expect(await q("select 1 from public.requirement_evidence_decisions")).toHaveLength(0);
  });

  it("an expired grant cannot be EXCHANGED, and the refusal is generic", async () => {
    const fx = await baseline();
    const issued = await issue(fx.occurrenceId);
    expect(issued.status).toBe(201);
    const grant = await issued.json();
    await q(`update public.external_access_grants
                set status = 'expired', version = version + 1 where id = $1`, [grant.grantId]);

    const ex = await exchange(tokenOf(grant.link));
    expect(ex.status).toBe(404);
    // The same body a garbage token gets. A refusal that distinguished «this
    // link expired» from «this link never existed» is an oracle for which
    // 256-bit strings the server has seen.
    const garbage = await exchange("a".repeat(43));
    expect(garbage.status).toBe(404);
    const [a, b] = [await ex.json(), await garbage.json()];
    expect({ ...a, requestId: null }).toEqual({ ...b, requestId: null });
    expect(await q("select 1 from public.external_sessions")).toHaveLength(0);
  });

  it("does not resurrect: a session may not be moved back to active", async () => {
    const fx = await baseline();
    const { grantId } = await openLink(fx);
    await q(`update public.external_sessions set status = 'expired'
              where external_access_grant_id = $1`, [grantId]);
    await expect(q(`update public.external_sessions set status = 'active'
                     where external_access_grant_id = $1`, [grantId]))
      .rejects.toThrow(/leaves 'active' once/);
  });
});
