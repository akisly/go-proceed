// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { NewAssignmentForm, type CreateAssignmentImpl, type MemberOption } from "./new-assignment-form";
import type { CreateAssignmentResult } from "../../services/assignment-create.service";
import type { BaselineOption } from "../../services/baseline.service";

// Testing Library's own auto-cleanup only registers itself
// `if (typeof afterEach === 'function')` at import time — true only when
// vitest injects `afterEach` as a global. This project deliberately does not
// set `test.globals: true` (this file imports `describe`/`it`/`expect`/`vi`/
// `afterEach` explicitly, from "vitest"), so that auto-registration never
// fires and jsdom's `document` would otherwise keep accumulating every
// previous test's rendered markup. This file renders FOUR times, so without
// this line the second test's `getByRole("button", …)` would find two buttons
// and throw — the failure mode `evidence-card.test.tsx` warns about, here for
// real rather than in principle.
afterEach(cleanup);

// `useRouter` throws outside an app-router context ("invariant expected app
// router to be mounted"), and the success arm of this form navigates. The
// double stub is what lets the fourth test's retry reach `kind: "ok"` without
// mounting Next's router.
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const WORK_ITEM_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_ID = "33333333-3333-4333-8333-333333333333";

const baselines: BaselineOption[] = [{
  contractId: "11111111-1111-4111-8111-111111111111",
  contractVersionId: "44444444-4444-4444-8444-444444444444",
  contractVersionNo: 1,
  workItems: [{
    workItemId: WORK_ITEM_ID,
    workCode: "1.1", description: "Приклад-прокладання кабелю в штробі", unitCode: "м",
  }],
}];
const members: MemberOption[] = [{ memberId: MEMBER_ID, role: "owner" }];

describe("NewAssignmentForm", () => {
  it("refuses to submit with no line chosen, and does not call the service", async () => {
    const create = vi.fn<CreateAssignmentImpl>();
    render(<NewAssignmentForm projectId="p1" baselines={baselines} members={members}
      currentMemberId={MEMBER_ID} createImpl={create} />);
    await userEvent.click(screen.getByRole("button", { name: "Створити доручення" }));
    expect(create).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Оберіть рядок кошторису.");
  });

  it("puts a server field error next to the field the server named", async () => {
    const create = vi.fn<CreateAssignmentImpl>(async () => ({
      kind: "refused", status: 422, detail: "Перевірте поля.",
      problem: { fieldErrors: [{ path: "plannedQuantity", message: "Забагато знаків після коми." }] },
    }));
    render(<NewAssignmentForm projectId="p1" baselines={baselines} members={members}
      currentMemberId={MEMBER_ID} createImpl={create} initialWorkItemId={WORK_ITEM_ID} />);
    await userEvent.click(screen.getByRole("button", { name: "Створити доручення" }));
    expect(await screen.findByText("Забагато знаків після коми.")).toBeTruthy();
  });

  /**
   * The claim: «anything unmapped falls back to the banner, so no error can
   * vanish». That sentence is the whole reason `unmappedFrom` exists, and a
   * message the server sent that the user never sees is the exact failure this
   * design was built to prevent — invisible in every other test here, because
   * every other test names a path the form has a field for.
   *
   * BOTH HALVES IN ONE CASE, on purpose. Two separate tests would each prove
   * that one branch fires; only one document carrying both paths proves the
   * SPLIT — that the known message went to its field and NOT also to the
   * banner, and the unknown one went to the banner and was not silently
   * dropped on the way.
   */
  it("splits a mixed refusal: the named field's message to that field, the rest to the banner", async () => {
    const create = vi.fn<CreateAssignmentImpl>(async () => ({
      kind: "refused", status: 422, detail: "Перевірте поля.",
      problem: {
        fieldErrors: [
          { path: "plannedQuantity", message: "Забагато знаків після коми." },
          // A path this form has no field for. The server owns the contract,
          // not the form, so it can and does name things the form never
          // renders.
          { path: "contractId", message: "Кошторис уже не чинний." },
        ],
      },
    }));
    render(<NewAssignmentForm projectId="p1" baselines={baselines} members={members}
      currentMemberId={MEMBER_ID} createImpl={create} initialWorkItemId={WORK_ITEM_ID} />);
    await userEvent.click(screen.getByRole("button", { name: "Створити доручення" }));

    // `FieldError` is role="alert"; `Banner` is deliberately role="status"
    // (Banner.tsx: an answer to a press is not an interruption). That is what
    // makes these two queries address the two halves separately.
    const fieldError = await screen.findByRole("alert");
    const banner = screen.getByRole("status");

    expect(fieldError).toHaveTextContent("Забагато знаків після коми.");
    expect(banner).toHaveTextContent("Кошторис уже не чинний.");

    // The split, stated as what must NOT happen: the mapped message does not
    // also land in the banner, and the unmapped one does not vanish into the
    // field it has no home in.
    expect(banner).not.toHaveTextContent("Забагато знаків після коми.");
    expect(fieldError).not.toHaveTextContent("Кошторис уже не чинний.");

    // `detail` is the fallback for a refusal that named nothing unmapped —
    // never a replacement for a message the server actually sent.
    expect(banner).not.toHaveTextContent("Перевірте поля.");
  });

  it("does not fire a second request when the button is pressed twice", async () => {
    let resolve!: (v: CreateAssignmentResult) => void;
    const create = vi.fn<CreateAssignmentImpl>(
      () => new Promise<CreateAssignmentResult>((r) => { resolve = r; }),
    );
    render(<NewAssignmentForm projectId="p1" baselines={baselines} members={members}
      currentMemberId={MEMBER_ID} createImpl={create} initialWorkItemId={WORK_ITEM_ID} />);
    const button = screen.getByRole("button", { name: "Створити доручення" });
    await userEvent.click(button);
    // The control is disabled while the first request is in flight, so the
    // second press either no-ops or userEvent refuses to deliver it. Both
    // outcomes ARE the guard working; the assertion below is the claim.
    await userEvent.click(button).catch(() => undefined);
    expect(create).toHaveBeenCalledTimes(1);
    resolve({ kind: "ok", assignmentId: "a1" });
  });

  it("reuses ONE idempotency key across a retry, so a timeout cannot create two", async () => {
    const keys: string[] = [];
    const create = vi.fn<CreateAssignmentImpl>(async (_input, key) => {
      keys.push(key);
      return keys.length === 1
        ? { kind: "error", error: "network" }
        : { kind: "ok", assignmentId: "a1" };
    });
    render(<NewAssignmentForm projectId="p1" baselines={baselines} members={members}
      currentMemberId={MEMBER_ID} createImpl={create} initialWorkItemId={WORK_ITEM_ID} />);
    const button = screen.getByRole("button", { name: "Створити доручення" });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
});
