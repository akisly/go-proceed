import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { q, truncateAll, jsonReq, baselineFixture, type BaselineFixture } from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";
import type { CreateUploadIntentResponse, FinalizeUploadIntentResponse } from "@goproceed/contracts";
import { assignmentEvidenceResponse } from "@goproceed/contracts";
import { buildCreateIntentBody } from "./helpers/upload-intent-body";

/**
 * Task 3 (`GET /v1/assignments/{assignmentId}/evidence`).
 *
 * `boundOccurrence()` below is copied from `field-capture.int.test.ts` rather
 * than imported — that file exports nothing, every helper is module-private —
 * and extended with a SECOND upload whose intent carries no
 * `requirementOccurrenceId`, because that is exactly the null-occurrence group
 * this route must not drop (see the contract's own comment on
 * `assignmentEvidenceResponse`).
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const CAPS = ["assignments.manage", "evidence.record", "rule_bindings.manage",
              "requirements.assign", "project.view"] as const;

const LINE = {
  sourceKey: "1.1",
  workTypeKey: "montazh-elektrotekhnichnykh-ustanovok",
  description: "Приклад-улаштування прокладки кабелю",
  unitCode: "м",
  contractQuantity: "10",
  unitPriceState: "known" as const,
  unitPrice: "100.00",
};

/** A minimal but genuine JPEG: SOI + APP0 marker, then a byte of payload. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
/** A distinct payload for the fallback photo, so the two evidence rows never collide on content_hash. */
const JPEG2 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x01]);
/** A third, again distinct payload — the SECOND photo on the bound occurrence (fix round 1, cheap item B). */
const JPEG3 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x02]);
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

interface Fx extends BaselineFixture {
  assignmentId: string;
  occurrenceId: string;
}

async function grant(projectId: string, memberId: string): Promise<void> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const res = await POST(jsonReq("http://x", { memberId, capabilities: [...CAPS] }),
    { params: Promise.resolve({ projectId }) });
  if (res.status >= 300) throw new Error(`grant ${res.status} ${await res.text()}`);
}

/** One published baseline, one bound photo rule, one assignment, one materialised occurrence. */
async function boundOccurrence(): Promise<Fx> {
  const fx = await baselineFixture(A);
  await grant(fx.projectId, fx.memberId);
  const library = await seedRequirementLibrary(fx.workspaceId);

  const rv = await publishRuleVersion(fx.workspaceId, ruleVersionBody(library.get("Н.15/1")!));
  if (rv.status !== 201) throw new Error(`publishRuleVersion ${rv.status} ${await rv.text()}`);
  const ruleVersionId = (await rv.json()).ruleVersionId as string;

  const draft = await createDraft(fx.contractId);
  const contractVersionId = (await draft.json()).contractVersionId as string;
  const line = await addLine(contractVersionId, LINE);
  if (line.status !== 201) throw new Error(`addLine ${line.status} ${await line.text()}`);
  const workItemId = (await line.json()).workItem.workItemId as string;

  const bind = await bindRules(contractVersionId, [ruleVersionId]);
  if (bind.status !== 201) throw new Error(`bindRules ${bind.status} ${await bind.text()}`);

  const view = await (await getVersion(fx.contractId, 1)).json();
  const pub = await publishVersion(contractVersionId, manifestOf(view));
  if (pub.status !== 201) throw new Error(`publishVersion ${pub.status} ${await pub.text()}`);

  const { POST: createAssignment } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const asg = await createAssignment(jsonReq("http://x", { workItemId }),
    { params: Promise.resolve({ contractId: fx.contractId }) });
  if (asg.status !== 201) throw new Error(`assignments.create ${asg.status} ${await asg.text()}`);
  const assignmentId = (await asg.json()).assignmentId as string;

  const occ = await q<{ id: string }>(
    `select id from public.requirement_occurrences
      where workspace_id = $1 and work_assignment_id = $2 and rule_version_id = $3`,
    [fx.workspaceId, assignmentId, ruleVersionId]);
  if (occ.length !== 1) {
    throw new Error(`boundOccurrence: expected exactly one occurrence, got ${occ.length}`);
  }

  return { ...fx, assignmentId, occurrenceId: occ[0]!.id };
}

async function createIntent(body: Record<string, unknown>, assignmentId: string): Promise<Response> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
  return POST(jsonReq("http://x", body), { params: Promise.resolve({ assignmentId }) });
}

async function finalize(intentId: string): Promise<Response> {
  const { POST } = await import("../app/v1/upload-intents/[intentId]/finalize/route");
  return POST(jsonReq("http://x", {}), { params: Promise.resolve({ intentId }) });
}

/** The exact, unauthenticated PUT `uploadCapture` performs against a signed upload URL (apps/mobile's; the apps/app copy was deleted 2026-09-23, DEV-035). */
async function putToSignedUrl(signedUrl: string, bytes: Uint8Array, contentType: string): Promise<Response> {
  return fetch(signedUrl, { method: "PUT", headers: { "content-type": contentType }, body: bytes });
}

/** Drives create -> PUT -> finalize for one photo, occurrence-bound or (occurrenceId undefined) fallback. */
async function captureOne(
  assignmentId: string, bytes: Uint8Array, occurrenceId?: string,
): Promise<FinalizeUploadIntentResponse> {
  const body = occurrenceId
    ? buildCreateIntentBody({
        file: new File([bytes], "фото.jpg", { type: "image/jpeg", lastModified: Date.now() }),
        occurrenceId, expectedContentHash: hashOf(bytes), deviceCaptureId: crypto.randomUUID(),
      })
    : {
        // THE FALLBACK'S ONLY REMAINING DOOR (uploads.ts): no
        // requirementOccurrenceId at all, so the intent falls back to
        // FALLBACK_MEDIA rather than the occurrence's pinned policy.
        expectedContentHash: hashOf(bytes),
        expectedByteSize: bytes.byteLength,
        claimedMediaType: "image/jpeg",
        deviceCaptureId: crypto.randomUUID(),
        originMethod: "origin_not_distinguished" as const,
      };
  const createRes = await createIntent(body, assignmentId);
  if (createRes.status !== 201) {
    throw new Error(`captureOne: create ${createRes.status} ${await createRes.text()}`);
  }
  const created = await createRes.json() as CreateUploadIntentResponse;
  const putRes = await putToSignedUrl(created.upload.signedUrl, bytes, "image/jpeg");
  if (putRes.status !== 200) {
    throw new Error(`captureOne: PUT ${putRes.status} ${await putRes.text()}`);
  }
  const finalizeRes = await finalize(created.uploadIntentId);
  if (finalizeRes.status !== 200) {
    throw new Error(`captureOne: finalize ${finalizeRes.status} ${await finalizeRes.text()}`);
  }
  const finalized = await finalizeRes.json() as FinalizeUploadIntentResponse;
  if (finalized.status !== "available") {
    throw new Error(`captureOne: expected available, got ${finalized.status}`);
  }
  return finalized;
}

async function getEvidence(assignmentId: string): Promise<Response> {
  const { GET } = await import("../app/v1/assignments/[assignmentId]/evidence/route");
  return GET(new Request(`http://x/v1/assignments/${assignmentId}/evidence`), {
    params: Promise.resolve({ assignmentId }),
  });
}

let fx: Fx;
let occurrenceId: string;
let assignmentId: string;
beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await boundOccurrence();
  occurrenceId = fx.occurrenceId;
  assignmentId = fx.assignmentId;
  await captureOne(assignmentId, JPEG, occurrenceId);
  // A SECOND photo on the SAME occurrence, not just a second occurrence —
  // fix round 1, cheap item B. Grouping used to be provable only by trusting
  // the SQL's `ORDER BY`; two rows sharing one occurrence id is what would
  // expose a regression that split them into two same-id groups (a `groups.
  // at(-1)`-style comparison, defeated by any re-sort) rather than merging
  // them into one.
  await captureOne(assignmentId, JPEG3, occurrenceId);
  await captureOne(assignmentId, JPEG2 /* no occurrenceId — the fallback photo */);
});

describe("GET /v1/assignments/{id}/evidence", () => {
  it("returns both the occurrence-bound photos and the one with no occurrence, as exactly two groups", async () => {
    const res = await getEvidence(assignmentId);
    expect(res.status, await res.clone().text()).toBe(200);

    const body = assignmentEvidenceResponse.parse(await res.json());
    // EXACTLY TWO GROUPS (fix round 1, cheap item B): the fixture captures two
    // photos on ONE occurrence and one fallback photo on none — three evidence
    // rows, two groups. A grouping bug that keyed on something other than the
    // occurrence id (or that split one occurrence across two groups) would
    // show up here as three groups, not two.
    expect(body.groups).toHaveLength(2);

    const bound = body.groups.find((g) => g.occurrenceId === occurrenceId);
    const fallback = body.groups.find((g) => g.occurrenceId === null);

    expect(bound?.evidence).toHaveLength(2);
    // THE ONE THAT WOULD SILENTLY VANISH under an inner join or a null filter.
    expect(fallback?.evidence).toHaveLength(1);
    // …and the null group is last.
    expect(body.groups.at(-1)?.occurrenceId).toBeNull();

    expect(bound?.evidence[0]?.readUrl).toMatch(/^https?:\/\//);
    expect(bound?.evidence[1]?.readUrl).toMatch(/^https?:\/\//);
    expect(fallback?.evidence[0]?.readUrl).toMatch(/^https?:\/\//);
  });

  it("sends no-store, because the body carries bearer capabilities", async () => {
    const res = await getEvidence(assignmentId);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("does not leak the signed URL into audit, the outbox, or any idempotency body", async () => {
    const res = await getEvidence(assignmentId);
    const body = assignmentEvidenceResponse.parse(await res.json());
    const url = body.groups[0]!.evidence[0]!.readUrl!;
    const token = new URL(url).searchParams.get("token")!;
    expect(token.length).toBeGreaterThan(0);

    // `audit_events` has no `payload` column — its JSON is `details`
    // (migration 0002); `transaction_outbox`'s is `payload`.
    const audit = await q<{ t: string }>(`select details::text as t from public.audit_events`);
    const outbox = await q<{ t: string }>(`select payload::text as t from public.transaction_outbox`);
    // FIX ROUND 1, CHEAP ITEM A: the spec and the TODOS.md entry now BL-035 (docs/BACKLOG.md) name a third place
    // — «or in any idempotency body». `idempotency_records.response_body` and
    // `.response_headers` are real jsonb columns (migration 0002). VACUOUSLY
    // TRUE TODAY: `queryRoute` (unlike `commandRoute`) writes no idempotency
    // record at all, so this table is empty for a GET and the assertion below
    // passes without exercising anything. It is still worth asserting — it is
    // exactly the check that would catch a future refactor that routed this
    // response through the idempotency store the way command routes do.
    const idem = await q<{ b: string | null; h: string | null }>(
      `select response_body::text as b, response_headers::text as h
         from public.idempotency_records`);
    for (const r of [...audit, ...outbox]) {
      expect(r.t).not.toContain(token);
    }
    for (const r of idem) {
      if (r.b !== null) expect(r.b).not.toContain(token);
      if (r.h !== null) expect(r.h).not.toContain(token);
    }
    // NOTE: «never in logs» is NOT asserted here and cannot be — this app has no
    // application logging at all. The shipped app carries exactly ONE
    // `console.error` call, `src/lib/http.ts:97`'s unmapped-error branch;
    // `qa/field.mjs` and `scripts/deploy-preflight.mjs` have their own, and
    // neither runs in the app. (This comment said «three console.error calls»
    // until the D1 final fix wave — a FILE count read as a call count, two of
    // whose three files are not the app.) Recorded in TODOS.md; the rule still
    // binds every future line.
  });

  /**
   * CORRECTION TO THE BRIEF: the stub here asked for «403 SCOPE_PROJECT_DENIED»,
   * but that outcome is unreachable through this route as written. The
   * capability this route asks `requireProjectCapability` for is exactly
   * `project.view` — the SAME pair (`project.view`/`project.admin`) that
   * `wa_select` (migration 0016) already requires to see the
   * `work_assignments` row at all, and `goproceed_app` runs NOBYPASSRLS
   * (`packages/database/src/tx.ts`). So a caller who lacks `project.view`
   * never gets a row back from the first query; the route's own notFound
   * fires before `requireProjectCapability` is ever reached, exactly the
   * asymmetry `m6-blocked-value.int.test.ts` documents for the same shape of
   * check (`projects_select` vs. `blocked_value`'s `project.view` gate): "an
   * actor who can SEE the project but lacks the specific capability gets 403
   * … an actor who cannot see it at all gets 404". Here the two gates are
   * identical, so only the second case exists.
   */
  it("refuses a caller without project.view with 404 — the row is invisible before it is forbidden", async () => {
    const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    await q(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,'',now(),now())
       on conflict (id) do nothing`,
      [B, "evidence-read-stranger@example.test"]);
    await q(
      `insert into public.memberships (organization_id, user_id, role, status)
       values ($1,$2,'member','active')`,
      [fx.workspaceId, B]);
    current = B;
    const res = await getEvidence(assignmentId);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("RESOURCE_NOT_FOUND");
  });
});
