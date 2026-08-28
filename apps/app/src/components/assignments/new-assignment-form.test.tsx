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
