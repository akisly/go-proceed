import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq, baselineFixture, type BaselineFixture } from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";

/**
 * Task 9 — the create path, proved end to end.
 *
 * EIGHT TASKS BUILT «Нове доручення» AGAINST FAKES. `new-assignment-form.test.tsx`
 * injects a fake `createImpl`; `assignment-create.service.test.ts` injects a
 * fake `fetch`. Both prove the FORM builds the right body; neither proves the
 * REAL route accepts it, or that the write does what `assignments.create`
 * promises on top of creating a row — materialising one requirement occurrence
 * per bound rule the line's stored work type matches (see that route's own
 * header comment). This file drives the real route, against the real
 * database, with the exact two fields `assignment-create.service.ts` sends:
 * `workItemId` and `assigneeMemberId`.
 *
 * THE BASELINE IS THE SAME SHAPE `materialisation-end-to-end.int.test.ts`'s
 * `typedBaseline` BUILDS, NARROWED TO ONE LINE AND ONE RULE. That file's own
 * header explains why the MANUAL route is the one to reuse and not the CSV
 * importer's `publishedBaselineFixture`: an imported line never carries a work
 * type (ADR-006 decision 6, INV-015), so a fixture built through the importer
 * would materialise nothing here and could not prove this route's second job
 * at all. `typedBaseline` itself is not exported, so this follows its call
 * sequence — draft → typed line → bind → publish — rather than importing it,
 * with one rule and one line instead of four and three: all a single
 * assignment needs.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

/** Matches `ruleVersionBody`'s own default `workTypeKey` — see below. */
const ELECTRIC = "montazh-elektrotekhnichnykh-ustanovok";

interface Fx extends BaselineFixture {
  workItemId: string;
}

/**
 * `baselineFixture` grants `contracts.edit` / `imports.manage` /
 * `imports.publish` — enough for the draft, the line and the publish below,
 * but not for `assignments.create` (`assignments.manage`) or for the MANUAL
 * rule-bindings route (`rule_bindings.manage` — the import route is governed
 * differently; `publishBindableRuleVersion`'s own comment in
 * `helpers/fixtures.ts` explains the asymmetry). Granted here, on the test's
 * own fixture call, rather than by widening either route.
 */
async function grant(projectId: string, memberId: string): Promise<void> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const res = await POST(
    jsonReq("http://x", { memberId, capabilities: ["assignments.manage", "rule_bindings.manage"] }),
    { params: Promise.resolve({ projectId }) },
  );
  if (res.status >= 300) throw new Error(`access-grants ${res.status} ${await res.text()}`);
}

/**
 * A published baseline with ONE typed line and ONE bound rule — enough for
 * `assignments.create` to materialise something, and no more than that.
 * Bound BEFORE publication, as every fixture that does this must:
 * `app.guard_rule_binding_window()` refuses a binding on a published version.
 */
async function typedBaseline(): Promise<Fx> {
  const base = await baselineFixture(A);
  await grant(base.projectId, base.memberId);

  const library = await seedRequirementLibrary(base.workspaceId);
  const libraryItemId = library.get("Н.15/1");
  if (!libraryItemId) throw new Error("assignment-creation: the library seeded no Н.15/1");

  // No `over`: `ruleVersionBody`'s own defaults already name ELECTRIC's
  // work type and stage, which is exactly what the line below needs to match.
  const rule = await publishRuleVersion(base.workspaceId, ruleVersionBody(libraryItemId));
  if (rule.status !== 201) {
    throw new Error(`requirement_rule_versions.publish ${rule.status} ${await rule.text()}`);
  }
  const ruleVersionId = (await rule.json()).ruleVersionId as string;

  const draft = await createDraft(base.contractId);
  if (draft.status !== 201) throw new Error(`contract_versions.create ${draft.status} ${await draft.text()}`);
  const contractVersionId = (await draft.json()).contractVersionId as string;

  const line = await addLine(contractVersionId, {
    sourceKey: "1.1", description: "Приклад-прокладання кабелю в штробі",
    unitCode: "м", contractQuantity: "10",
    unitPriceState: "known", unitPrice: "100.00", workTypeKey: ELECTRIC,
  });
  if (line.status !== 201) throw new Error(`work_items.create ${line.status} ${await line.text()}`);
  const workItemId = (await line.json()).workItem.workItemId as string;

  const bind = await bindRules(contractVersionId, [ruleVersionId]);
  if (bind.status !== 201) throw new Error(`rule-bindings.create ${bind.status} ${await bind.text()}`);

  const view = await (await getVersion(base.contractId, 1)).json();
  const pub = await publishVersion(contractVersionId, manifestOf(view));
  if (pub.status !== 201) {
    throw new Error(`contract_versions.publish ${pub.status} ${await pub.text()}`);
  }

  return { ...base, workItemId };
}

beforeEach(async () => {
  await truncateAll();
  current = A;
});

describe("the body the create form builds is one assignments.create accepts", () => {
  it("creates an assignment and materialises its obligations", async () => {
    const fx = await typedBaseline();

    const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
    const res = await POST(
      jsonReq("http://x", { workItemId: fx.workItemId, assigneeMemberId: fx.memberId }),
      { params: Promise.resolve({ contractId: fx.contractId }) },
    );
    expect(res.status, await res.clone().text()).toBe(201);
    const body = await res.json();
    const { assignmentId } = body;

    // The verdict the route reports on the SAME two-field body the form's own
    // `assignment-create.service.ts` sends — a check no component test can
    // make, because its fake `createImpl` never runs the real materialiser.
    expect(body.requirementOccurrences.coverage).toBe("covered");
    expect(body.requirementOccurrences.occurrenceCount).toBeGreaterThan(0);

    // Read from the ROW and not from the response, for the reason
    // `materialisation-end-to-end.int.test.ts` reads occurrences the same
    // way: a 201 that counted something it did not write is exactly the
    // vacuous-success shape this test exists against.
    const occurrences = await q<{ n: number }>(
      `select count(*)::int as n from public.requirement_occurrences
        where workspace_id = $1 and work_assignment_id = $2`,
      [fx.workspaceId, assignmentId]);
    expect(occurrences[0]!.n).toBeGreaterThan(0);

    // The SECOND field the form sends — `assigneeMemberId` — is not just
    // accepted but actually PERSISTED. `CreateAssignmentResponse` never
    // echoes it back (packages/contracts/src/assignments.ts), so the row is
    // the only place this can be checked.
    const stored = await q<{ assignee_member_id: string }>(
      `select assignee_member_id from public.work_assignments
        where workspace_id = $1 and id = $2`,
      [fx.workspaceId, assignmentId]);
    expect(stored[0]!.assignee_member_id).toBe(fx.memberId);
  });
});
