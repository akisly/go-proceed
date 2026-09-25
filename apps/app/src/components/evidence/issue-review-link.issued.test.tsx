// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IssueReviewLink, formatExpiresAt } from "./issue-review-link";
import { EvidenceByOccurrence } from "./evidence-by-occurrence";

// See `evidence-card.test.tsx`: without `test.globals`, Testing Library does
// not register its own cleanup.
afterEach(cleanup);

vi.mock("../../services/grants.service", () => ({
  issueReviewLink: async () => ({
    kind: "ok",
    link: {
      url: "https://app.example.test/external/review#t=token",
      expiresAt: "2026-08-29T09:00:00.000Z",
      deliveredBy: "caller",
    },
  }),
}));

/**
 * The issued state, which `issue-review-link.test.tsx`'s server render cannot
 * reach: the deadline is shown in the zone the page hands down, the
 * workspace's (DEV-089, BL-034), not the hard-coded Kyiv it was before.
 */

/** Fills the form, presses the button, and returns what the issued block says. */
async function issue(): Promise<string> {
  await userEvent.type(screen.getByLabelText(/Пошта одержувача/), "tehnahliad@example.com");
  await userEvent.type(screen.getByLabelText(/Роль одержувача/), "технічний нагляд");
  await userEvent.click(screen.getByRole("button", { name: "Відправити на перевірку" }));

  return (await screen.findByRole("status")).textContent ?? "";
}

describe("the issued link's deadline", () => {
  it("is in the zone the component is handed", async () => {
    render(<IssueReviewLink occurrenceId="11111111-1111-4111-8111-111111111111" timeZone="Europe/Warsaw" />);
    const status = await issue();
    // 09:00Z in August: 11:00 in Warsaw (GMT+2), 12:00 in Kyiv.
    expect(status).toContain(
      `Діє до ${formatExpiresAt("2026-08-29T09:00:00.000Z", "Europe/Warsaw")}.`);
    expect(status).toContain("11:00");
    expect(status).not.toContain("12:00");
  });

  it("is in the zone the evidence screen hands down to each group's link", async () => {
    render(
      <EvidenceByOccurrence
        assignmentId="99999999-9999-4999-8999-999999999999"
        groups={[{ occurrenceId: "11111111-1111-4111-8111-111111111111", evidence: [] }]}
        timeZone="Europe/Warsaw"
      />,
    );
    const status = await issue();
    expect(status).toContain("11:00");
    expect(status).not.toContain("12:00");
  });
});
