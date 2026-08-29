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

/**
 * F4, THE WHOLE-BRANCH REVIEW'S HEADLINE FINDING — and it needed the REAL
 * route to be catchable at all.
 *
 * `new-assignment-form.test.tsx` proves the form puts `fieldErrors[].message`
 * beside the field the server named. Every one of those tests hands it a
 * FABRICATED Ukrainian message, so all of them passed while the real route was
 * putting ENGLISH in that slot: its `invalid()` helper wrote the Ukrainian
 * sentence into `problem.detail` and a phrase like «unknown work item in the
 * current published version» into `fieldErrors[].message`, which is the one the
 * office form renders under «Рядок кошторису», in blocked-red. A test that
 * feeds a fabricated problem document cannot see that, whatever it asserts —
 * so this drives the real handler and reads what it actually produced.
 *
 * BOTH SLOTS ARE ASSERTED, because both are read by a person: the form maps
 * `fieldErrors[].message` onto the field, and falls back to `problem.detail`
 * for the banner when a refusal names only fields the form has. Either one in
 * English is the same defect in a different box.
 *
 * THE ASSERTION IS «NO LATIN WORD», NOT «EQUALS THIS SENTENCE» — the literal is
 * checked too, but the scripts are what generalize: a future refusal that
 * reaches for an English phrase fails here without anyone having to remember to
 * add a case for it. A short Latin run is tolerated (a unit code, a field name
 * a message might quote); two or more letters in a row is a word.
 */
const CYRILLIC = /\p{Script=Cyrillic}/u;
const LATIN_WORD = /[A-Za-z]{2,}/;

/** A well-formed guid that names nothing — the shape both refusals below need. */
const ABSENT = "00000000-0000-4000-8000-000000000000";

describe("a real refusal from this route speaks Ukrainian in the slot the form renders", () => {
  it("refuses an unknown work item in Ukrainian, on the field and in the detail", async () => {
    const fx = await typedBaseline();

    const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
    const res = await POST(
      jsonReq("http://x", { workItemId: ABSENT, assigneeMemberId: fx.memberId }),
      { params: Promise.resolve({ contractId: fx.contractId }) },
    );
    expect(res.status, await res.clone().text()).toBe(422);

    const body = await res.json();
    expect(body.fieldErrors).toHaveLength(1);
    const fieldError = body.fieldErrors[0];
    expect(fieldError.path).toBe("workItemId");
    expect(fieldError.message).toMatch(CYRILLIC);
    expect(fieldError.message).not.toMatch(LATIN_WORD);
    expect(fieldError.message).toBe(
      "Позицію робіт не знайдено в поточній опублікованій версії договору.");
    expect(body.detail).toMatch(CYRILLIC);
    expect(body.detail).not.toMatch(LATIN_WORD);
  });

  /**
   * THE SECOND REACHABLE ONE, and it takes a different path through the route:
   * the work item resolves, the insert runs, and the composite foreign key on
   * `(workspace_id, assignee_member_id)` is what refuses. So this covers the
   * `catch` block's own `invalid(...)` calls, which the case above never
   * reaches.
   */
  it("refuses an unknown assignee in Ukrainian, from the insert's own catch", async () => {
    const fx = await typedBaseline();

    const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
    const res = await POST(
      jsonReq("http://x", { workItemId: fx.workItemId, assigneeMemberId: ABSENT }),
      { params: Promise.resolve({ contractId: fx.contractId }) },
    );
    expect(res.status, await res.clone().text()).toBe(422);

    const body = await res.json();
    const fieldError = body.fieldErrors[0];
    expect(fieldError.path).toBe("assigneeMemberId");
    expect(fieldError.message).toMatch(CYRILLIC);
    expect(fieldError.message).not.toMatch(LATIN_WORD);
    expect(fieldError.message).toBe("Учасника не знайдено в цьому просторі.");
    expect(body.detail).toMatch(CYRILLIC);
    expect(body.detail).not.toMatch(LATIN_WORD);
  });
});
