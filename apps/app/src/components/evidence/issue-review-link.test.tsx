import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { IssueReviewLink, ONE_TIME_LINK_NOTICE, formatExpiresAt } from "./issue-review-link";

/**
 * `renderToStaticMarkup`, no DOM — the same approach `evidence-card.test.tsx`
 * and `evidence-by-occurrence.test.tsx` already use here. So what this file
 * can prove is the FIRST render (the form) and the two pure exports; the
 * issued block's deadline, in the zone it is handed, is pressed through in
 * jsdom by `issue-review-link.issued.test.tsx` (DEV-089). The pressed-button
 * path — pending, issued, refused — is otherwise proven in two other places,
 * and neither is a substitute for the other:
 * `grants.service.test.ts` pins every outcome of the call with an injected
 * fetch, and `qa/field.mjs`'s seventh audit presses the real button in a real
 * browser against a real route and then opens the resulting link in a second,
 * cookie-less browser context.
 */

const OCCURRENCE = "11111111-1111-4111-8111-111111111111";

describe("the INV-044 sentence", () => {
  it("is the brief's exact wording, byte for byte", () => {
    // PINNED AS A CONSTANT AND COMPARED AS A LITERAL, the way
    // `act-content-fidelity.test.ts` pins the assurance strings: this sentence
    // is the one the product makes about a token it can never re-show, and a
    // softening edit to it must fail a test rather than pass a review.
    expect(ONE_TIME_LINK_NOTICE).toBe(
      "Посилання показано один раз. Скопіюйте його зараз — відновити його неможливо, "
      + "лише відкликати й видати нове.",
    );
  });

  it("says outright that recovery is revoke-and-reissue, not retrieval", () => {
    expect(ONE_TIME_LINK_NOTICE).toContain("відновити його неможливо");
    expect(ONE_TIME_LINK_NOTICE).toContain("відкликати й видати нове");
  });
});

describe("the form, before anything is pressed", () => {
  const html = renderToStaticMarkup(<IssueReviewLink occurrenceId={OCCURRENCE} timeZone="Europe/Kyiv" />);

  it("offers the control under the label the whole task is named for", () => {
    expect(html).toContain("Відправити на перевірку");
    expect(html).toContain('type="submit"');
  });

  it("asks for both fields the grant contract requires", () => {
    expect(html).toContain("Пошта одержувача");
    expect(html).toContain("Роль одержувача");
    expect(html).toContain('type="email"');
  });

  it("states the view-only limit BEFORE the button, not after the link is opened", () => {
    // `grants.service.ts` can only ask for `external.view_scope`: a deciding
    // grant must name the occurrence's own approver role, and this screen's
    // one interface does not carry it. A reviewer discovering that at the far
    // end of the link is the failure this sentence exists to prevent.
    expect(html).toContain("Рішення за ним не ухвалюють");
  });

  it("does not show the one-time notice before a link exists", () => {
    expect(html).not.toContain("Посилання показано один раз");
  });

  it("says the sender delivers the link, because v0.1 has no email producer", () => {
    // `ExternalLinkDelivery.deliveredBy` is `"caller"` — the issuing member IS
    // the delivery mechanism. The word «надішліть» appears on the issued
    // block; what the form must not do is imply a send, so the button's own
    // label is the only promise made here.
    expect(html).not.toContain("Надіслано");
  });
});

describe("formatExpiresAt", () => {
  it("renders the deadline in the workspace's zone, not the server process's", () => {
    // 09:00 UTC in August is 12:00 in Kyiv (EEST, UTC+3). Vercel's runtime
    // clock is UTC; a browser's is the viewer's. Neither may decide this.
    expect(formatExpiresAt("2026-08-29T09:00:00.000Z", "Europe/Kyiv")).toContain("12:00");
  });

  it("shows which zone it is in, so a deadline cannot be silently misread", () => {
    expect(formatExpiresAt("2026-08-29T09:00:00.000Z", "Europe/Kyiv")).toContain("GMT+3");
    expect(formatExpiresAt("2026-01-15T09:00:00.000Z", "Europe/Kyiv")).toContain("GMT+2");
  });

  it("renders the deadline in the zone it is handed (DEV-089, BL-034)", () => {
    // 09:00Z in August is 11:00 in Warsaw (CEST, UTC+2).
    expect(formatExpiresAt("2026-08-29T09:00:00.000Z", "Europe/Warsaw")).toContain("11:00");
    expect(formatExpiresAt("2026-08-29T09:00:00.000Z", "Europe/Warsaw")).toContain("GMT+2");
  });
});
