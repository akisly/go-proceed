// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { NoAssignmentsEmptyState } from "./no-assignments-empty-state";

// Testing Library's auto-cleanup only registers when vitest injects `afterEach`
// as a GLOBAL, and this project deliberately does not set `test.globals` — see
// `new-assignment-form.test.tsx`'s own note. Two renders in this file, so it is
// not theoretical.
afterEach(cleanup);

/**
 * F1, the whole-branch review's Critical: the FIRST доручення in any project
 * could not be created through the UI.
 *
 * `assignments/page.tsx` returns this component when the register is empty and
 * never reaches `AssignmentsList`, which held the only navigational entry point
 * to `/assignments/new` anywhere in the app. So the create control existed
 * exactly when it was least needed — after somebody had already created an
 * assignment some other way.
 *
 * THE ASSERTION IS ON THE `href`, NOT ON THE LABEL. A button that says «Нове
 * доручення» and goes nowhere is the defect wearing the fix's clothes; the
 * destination is the fact this test exists to pin. It is asserted as a real
 * anchor for the same reason `assignments-list.tsx`'s own header gives for
 * `Button asChild`+`Link`: right-click «open in new tab», and no JavaScript
 * required to follow it.
 */
describe("NoAssignmentsEmptyState", () => {
  it("offers the create screen as a real link, from the state that needs it most", () => {
    render(<NoAssignmentsEmptyState projectId="p-1" />);

    const link = screen.getByRole("link", { name: "Нове доручення" });
    expect(link).toHaveAttribute("href", "/dash/projects/p-1/assignments/new");
  });

  it("still names the condition, so the action has something to be the answer to", () => {
    render(<NoAssignmentsEmptyState projectId="p-1" />);

    expect(screen.getByText("Немає доручень")).toBeTruthy();
    expect(screen.getByText("У цьому проєкті ще немає доручень.")).toBeTruthy();
  });
});
