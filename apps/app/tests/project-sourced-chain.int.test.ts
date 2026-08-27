import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { q, truncateAll, jsonReq, baselineFixture } from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, projectSourcedRuleVersionBody,
  publishRuleVersion, publishVersion,
} from "./helpers/manual-baseline";
import { EXTERNAL_SESSION_COOKIE, resetKeyRegistriesForTests } from "../src/lib/external-link";

/**
 * ADR-010, END TO END: a requirement the SITE supplied from its own робоча
 * документація travels the whole chain and arrives, intact and correctly
 * attributed, in front of a reviewer who has no account.
 *
 * Every seam this slice touched is already covered on its own —
 * `project-requirements.int.test.ts` owns the three authoring routes and both
 * source arms of `requirement_rule_versions.publish`,
 * `requirement-occurrences.int.test.ts` owns the materialisation copy, and
 * `m5-external.int.test.ts` owns the grant, the exchange and the external
 * plane's refusals. THIS FILE OWNS NONE OF THOSE. It owns the one claim no
 * single-seam suite can make: that the tag and the citation survive EVERY hop
 * between the two ends, so a workspace typing its own requirement and a
 * технагляд clicking a one-time link are looking at the same string with the
 * same attribution.
 *
 * THE ORDER BELOW IS LOAD-BEARING AND IS COPIED FROM `field-capture.int.test.ts`'s
 * `boundOccurrence`, not reinvented. `requireBindableWorkType`
 * (src/lib/manual-baseline.ts) refuses a work item whose `workTypeKey` names no
 * rule version already published in the workspace, so the rule version is
 * published BEFORE the typed line is added; a line added first comes back 422
 * and the chain never reaches an assignment.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED HERE: every refusal. A chain test that also
 * carried the negatives would restate the suites named above and would go red for
 * reasons that have nothing to do with the chain. One path, walked once.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const ORIGIN = "https://prykladapp.example";
const WORK_TYPE = "montazh-elektrotekhnichnykh-ustanovok";
const APPROVER = "technical_supervisor";

/**
 * `project.view` reaches the occurrence at all (RLS `ro_select`), `packages.submit`
 * is what `occurrence_grants.issue` asks for beside it, and the other three are
 * the manual baseline's own: `rule_bindings.manage` for the binding,
 * `requirements.assign` and `assignments.manage` for the assignment that
 * materialises. `baselineFixture` has already granted contracts.edit /
 * imports.manage / imports.publish.
 */
const CAPS = ["assignments.manage", "rule_bindings.manage", "requirements.assign",
              "project.view", "packages.submit"] as const;

/**
 * The authored requirement, in transparently fake demo naming. «Приклад-» is not
 * decoration: a plausible invented Ukrainian document code in a test fixture is
 * indistinguishable from a real one the moment it is pasted into an issue or a
 * screenshot, and this string is composed into a CITATION that the external
 * plane renders as the source of an obligation.
 */
const AUTHORED = {
  itemTextUk: "Приклад-герметизація вводу кабелю в гільзі перед закриттям штроби",
  sourceDocument: "Приклад-РД-2026-207",
  sourceSheet: "7",
  sourceDrawingNo: "ЕМ-12",
  sourceRevision: "2",
};

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

async function grantCaps(projectId: string, memberId: string): Promise<void> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const res = await POST(jsonReq("http://x", { memberId, capabilities: [...CAPS] }),
    params({ projectId }));
  if (res.status >= 300) throw new Error(`grant ${res.status} ${await res.text()}`);
}

async function createProjectRequirement(
  workspaceId: string, body: Record<string, unknown>,
): Promise<Response> {
  const { POST } = await import(
    "../app/v1/workspaces/[workspaceId]/project-requirements/route");
  return POST(jsonReq("http://x", body), params({ workspaceId }));
}

async function listOccurrences(assignmentId: string): Promise<Response> {
  const { GET } = await import(
    "../app/v1/assignments/[assignmentId]/requirement-occurrences/route");
  return GET(new Request("http://x"), params({ assignmentId }));
}

/**
 * The three external-plane drivers, written the way `m5-external.int.test.ts`
 * and `external-evidence.int.test.ts` write them. Neither suite exports its
 * copy, and this file may not restructure either, so the shape is mirrored
 * rather than imported — including the cookie regex, which matches the opaque
 * value the browser would have stored and never a token.
 */
async function issueGrant(occurrenceId: string): Promise<Response> {
  const { POST } = await import("../app/v1/occurrences/[occurrenceId]/grants/route");
  return POST(jsonReq("http://x", {
    recipientEmail: "prykladtechnahliad@example.test",
    recipientRole: APPROVER,
    permissions: { "external.view_scope": true, "external.decide_evidence": true },
  }), params({ occurrenceId }));
}

async function exchange(token: string): Promise<Response> {
  const { POST } = await import("../app/external/exchange/route");
  return POST(new Request(`${ORIGIN}/external/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ token }),
  }));
}

function cookieOf(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  const m = new RegExp(`${EXTERNAL_SESSION_COOKIE}=([A-Za-z0-9_-]{43})`).exec(raw);
  if (!m) throw new Error(`no external session cookie in: ${raw}`);
  return m[1]!;
}

async function externalScope(cookie: string): Promise<Response> {
  const { GET } = await import("../app/external/occurrence/route");
  return GET(new Request(`${ORIGIN}/external/occurrence`, {
    headers: { cookie: `${EXTERNAL_SESSION_COOKIE}=${cookie}` },
  }), params({}));
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
  await truncateAll();
  current = A;
});

describe("a site's own requirement reaches the no-account reviewer", () => {
  it("carries PROJECT_DOCUMENTATION and its citation from authoring to the external link", async () => {
    const fx = await baselineFixture(A);
    await grantCaps(fx.projectId, fx.memberId);

    // ── 1. the site authors the requirement ────────────────────────────────
    const authored = await createProjectRequirement(fx.workspaceId,
      { projectId: fx.projectId, ...AUTHORED });
    expect(authored.status, await authored.clone().text()).toBe(201);
    const itemId = (await authored.json()).itemId as string;

    // ── 2. a rule version rests on it, on ADR-010's project arm ────────────
    // `approverIsExternal` is what makes step 5 reachable: `occurrence_grants.issue`
    // refuses a DECIDING grant on an occurrence whose pinned version names an
    // internal approver, so the external reviewer this test is about only exists
    // because the obligation says an external role releases the hold.
    const published = await publishRuleVersion(fx.workspaceId,
      projectSourcedRuleVersionBody(itemId, {
        approverRole: APPROVER, approverIsExternal: true,
      }));
    expect(published.status, await published.clone().text()).toBe(201);
    const version = await published.json();
    const ruleVersionId = version.ruleVersionId as string;
    expect(version.normRefVerification).toBe("PROJECT_DOCUMENTATION");
    expect(version.projectSourcedRequirementItemId).toBe(itemId);
    expect(version.requirementLibraryItemId).toBeNull();

    // ── 3. bind it into a baseline, publish it, assign the work ────────────
    // The rule version above already exists, which is the whole reason the
    // typed line below is accepted; see this file's header.
    const draft = await createDraft(fx.contractId);
    expect(draft.status, await draft.clone().text()).toBe(201);
    const contractVersionId = (await draft.json()).contractVersionId as string;

    const line = await addLine(contractVersionId, {
      sourceKey: "1.1", workTypeKey: WORK_TYPE,
      description: "Приклад-прокладання кабелю в штробі",
      unitCode: "м", contractQuantity: "10",
      unitPriceState: "known", unitPrice: "100.00",
    });
    expect(line.status, await line.clone().text()).toBe(201);
    const workItemId = (await line.json()).workItem.workItemId as string;

    const bound = await bindRules(contractVersionId, [ruleVersionId]);
    expect(bound.status, await bound.clone().text()).toBe(201);

    const view = await (await getVersion(fx.contractId, 1)).json();
    const publishedVersion = await publishVersion(contractVersionId, manifestOf(view));
    expect(publishedVersion.status, await publishedVersion.clone().text()).toBe(201);

    const { POST: createAssignment } = await import(
      "../app/v1/contracts/[contractId]/assignments/route");
    const assigned = await createAssignment(jsonReq("http://x", { workItemId }),
      params({ contractId: fx.contractId }));
    expect(assigned.status, await assigned.clone().text()).toBe(201);
    const assignmentId = (await assigned.json()).assignmentId as string;

    // ── 4. the materialised obligation carries the tag and the citation ────
    // Read from the table the way `requirement-occurrences.int.test.ts` reads
    // it: the copy is what the external plane will later select, and a view
    // that agreed with a row the database stored differently would be the
    // failure worth catching.
    const stored = await q<{ id: string; norm_ref: string; v: string; s: string }>(
      `select id, norm_ref, norm_ref_verification as v, norm_ref_source as s
         from public.requirement_occurrences
        where workspace_id = $1 and work_assignment_id = $2 and rule_version_id = $3`,
      [fx.workspaceId, assignmentId, ruleVersionId]);
    expect(stored).toHaveLength(1);
    const occurrenceId = stored[0]!.id;
    expect(stored[0]!.v).toBe("PROJECT_DOCUMENTATION");
    // The storage half of the attribution rule, asserted before anything renders:
    // the obligation's normative string names the site's own робоча документація
    // and no position of the shipped Додаток Н list.
    expect(stored[0]!.norm_ref).not.toContain("Додаток Н");
    expect(stored[0]!.s).toContain(AUTHORED.sourceDocument);
    expect(stored[0]!.s).toContain(`арк. ${AUTHORED.sourceSheet}`);
    expect(stored[0]!.s).toContain(`кресл. ${AUTHORED.sourceDrawingNo}`);
    expect(stored[0]!.s).toContain(`ревізія ${AUTHORED.sourceRevision}`);

    // The MEMBER plane sees the same thing, and its response is parsed on the
    // way out too (`listRequirementOccurrencesResponse.parse`) — so the foreman's
    // read is a second place a two-value verification enum would have thrown.
    const listed = await listOccurrences(assignmentId);
    expect(listed.status, await listed.clone().text()).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.coverage).toBe("covered");
    expect(listedBody.occurrences).toHaveLength(1);
    expect(listedBody.occurrences[0].normRef.verification).toBe("PROJECT_DOCUMENTATION");

    // ── 5. the no-account reviewer opens the link ──────────────────────────
    const issued = await issueGrant(occurrenceId);
    expect(issued.status, await issued.clone().text()).toBe(201);
    const link = (await issued.json()).link as { url: string };
    // The token lives in the FRAGMENT and is exchanged by a same-origin POST.
    const exchanged = await exchange(new URL(link.url).hash.slice(1));
    expect(exchanged.status, await exchanged.clone().text()).toBe(200);

    const scoped = await externalScope(cookieOf(exchanged));
    // ═══ THE ASSERTION THIS WHOLE FILE EXISTS FOR ═══════════════════════════
    // `external.occurrence_scope` builds its body with
    // `externalOccurrenceScopeResponse.parse`, whose `normRef` is
    // `externalNormRef` (packages/contracts/src/external.ts), whose
    // `verification` is the SHARED `verificationTag`. A stale two-value
    // `externalNormRef` — one that had kept its own copy of the enum instead of
    // reusing the widened constant — would make this a 500 from a zod throw,
    // not a 200 carrying a wrong string. So the status line below is itself the
    // test of that reuse, and the value line proves it is the right value and
    // not merely a parsable one.
    expect(scoped.status, await scoped.clone().text()).toBe(200);
    const body = await scoped.json();
    const normRef = body.occurrence.normRef as { text: string; verification: string; source: string };
    expect(normRef.verification).toBe("PROJECT_DOCUMENTATION");
    expect(normRef.source).toContain(AUTHORED.sourceDocument);
    expect(normRef.source).toContain(`кресл. ${AUTHORED.sourceDrawingNo}`);
    expect(normRef.text.length).toBeGreaterThan(0);

    // The site's own text is attributed to the site's own documentation and to
    // no standard's list — hidden-works-content-rules.md §"Project-sourced
    // strings". A project-sourced string rendering inside a Додаток Н block is
    // the misattribution ADR-010 exists to prevent, and the external plane is
    // where it would be read by someone who cannot check.
    expect(JSON.stringify(body)).not.toContain("Додаток Н");

    // The reviewer is reading the requirement the site typed, verbatim: absent
    // `acceptanceCriterion` copies the source's own wording (ADR-010's half of
    // what ADR-006 step 2 promises on the library arm).
    expect(body.occurrence.acceptanceCriterion).toBe(AUTHORED.itemTextUk);
  });
});
