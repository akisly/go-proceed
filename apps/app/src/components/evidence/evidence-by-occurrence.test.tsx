import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AssignmentEvidenceResponse, EvidenceObjectView } from "@goproceed/contracts";

import { EvidenceByOccurrence } from "./evidence-by-occurrence";

/**
 * FIX ROUND 1: the two load-bearing group-ordering behaviours this file
 * shipped with no coverage of their own — see `evidence-card.test.tsx`'s
 * header for why `renderToStaticMarkup` with no DOM, and for the
 * `vitest.config.ts` fix (same commit) this file's own render also depends
 * on.
 */

function item(overrides: Partial<EvidenceObjectView> = {}): EvidenceObjectView {
  return {
    evidenceObjectId: "aaaaaaaa-0000-4000-8000-000000000001",
    mediaType: "image/jpeg",
    byteSize: 1_048_576,
    contentHash: "a".repeat(64),
    originalFilename: "IMG_0142.jpg",
    originMethod: "native_camera",
    captureTimeTrust: "device_claimed",
    claimedCaptureTime: null,
    serverReceivedAt: "2026-08-22T09:30:00.000Z",
    readUrl: undefined,
    ...overrides,
  };
}

describe("EvidenceByOccurrence — the null group is a real group, not an empty state", () => {
  it("renders the null group's own label when it is the ONLY group", () => {
    // The exact case the reviewer's own render caught the spec compliance
    // of: a response with one group whose occurrenceId is null must render
    // as content, never be mistaken for "no evidence" — that empty check
    // (`groups.length === 0`) lives one level up, in `page.tsx`, and is
    // never reachable here because this component is only ever rendered
    // once `page.tsx` has already confirmed `groups.length > 0`. What THIS
    // component owns is not silently treating a lone null group as nothing
    // to show.
    const groups: AssignmentEvidenceResponse["groups"] = [
      { occurrenceId: null, evidence: [item()] },
    ];
    const html = renderToStaticMarkup(
      <EvidenceByOccurrence assignmentId="99999999-9999-4999-8999-999999999999" groups={groups} />,
    );
    expect(html).toContain("Без прив&#x27;язки до вимоги");
    expect(html).not.toContain("Немає доказів");
  });

  it("renders the null group LAST when an occurrence group precedes it", () => {
    const groups: AssignmentEvidenceResponse["groups"] = [
      { occurrenceId: "11111111-1111-4111-8111-111111111111", evidence: [item()] },
      { occurrenceId: null, evidence: [item({ evidenceObjectId: "bbbbbbbb-0000-4000-8000-000000000001" })] },
    ];
    const html = renderToStaticMarkup(
      <EvidenceByOccurrence assignmentId="99999999-9999-4999-8999-999999999999" groups={groups} />,
    );
    const occurrenceHeading = html.indexOf("Вимога");
    const nullHeading = html.indexOf("Без прив&#x27;язки до вимоги");
    expect(occurrenceHeading).toBeGreaterThan(-1);
    expect(nullHeading).toBeGreaterThan(-1);
    expect(nullHeading).toBeGreaterThan(occurrenceHeading);
  });

  it("does not itself reorder groups when the null group arrives first", () => {
    // This component trusts the route's own construction rather than
    // re-sorting (its own header comment's stated choice) — pinning that a
    // response that broke the route's own "null last" invariant would
    // render exactly as given, not silently corrected here, which would
    // make a real regression upstream invisible at this layer.
    const groups: AssignmentEvidenceResponse["groups"] = [
      { occurrenceId: null, evidence: [item()] },
      { occurrenceId: "11111111-1111-4111-8111-111111111111", evidence: [item()] },
    ];
    const html = renderToStaticMarkup(
      <EvidenceByOccurrence assignmentId="99999999-9999-4999-8999-999999999999" groups={groups} />,
    );
    const nullHeading = html.indexOf("Без прив&#x27;язки до вимоги");
    const occurrenceHeading = html.indexOf("Вимога");
    expect(nullHeading).toBeGreaterThan(-1);
    expect(occurrenceHeading).toBeGreaterThan(-1);
    expect(nullHeading).toBeLessThan(occurrenceHeading);
  });
});

describe("EvidenceByOccurrence — the review-link control is scoped to an occurrence", () => {
  it("offers it on a group that HAS an occurrence", () => {
    const groups: AssignmentEvidenceResponse["groups"] = [
      { occurrenceId: "11111111-1111-4111-8111-111111111111", evidence: [item()] },
    ];
    const html = renderToStaticMarkup(
      <EvidenceByOccurrence assignmentId="99999999-9999-4999-8999-999999999999" groups={groups} />,
    );
    expect(html).toContain("Відправити на перевірку");
  });

  it("offers it NOWHERE on a lone null group — there is no occurrence to scope a grant to", () => {
    // `occurrence_grants.issue` is scoped to one requirement occurrence
    // (ADR-005 decision 9). A control rendered over the null group would have
    // no id to send, so the only honest options were «absent» and «present but
    // permanently refused»; this pins the first. The unbound photos themselves
    // are still shown — that is `evidence-by-occurrence`'s own rule, asserted
    // in the group above.
    const groups: AssignmentEvidenceResponse["groups"] = [
      { occurrenceId: null, evidence: [item()] },
    ];
    const html = renderToStaticMarkup(
      <EvidenceByOccurrence assignmentId="99999999-9999-4999-8999-999999999999" groups={groups} />,
    );
    expect(html).not.toContain("Відправити на перевірку");
    expect(html).toContain("Без прив&#x27;язки до вимоги");
  });

  it("renders exactly one control per occurrence group, not one per screen", () => {
    const groups: AssignmentEvidenceResponse["groups"] = [
      { occurrenceId: "11111111-1111-4111-8111-111111111111", evidence: [item()] },
      { occurrenceId: "22222222-2222-4222-8222-222222222222", evidence: [item()] },
      { occurrenceId: null, evidence: [item()] },
    ];
    const html = renderToStaticMarkup(
      <EvidenceByOccurrence assignmentId="99999999-9999-4999-8999-999999999999" groups={groups} />,
    );
    // Two occurrence groups, two controls; the null group adds none. FOUR and
    // not two because the string appears TWICE per control — once as the
    // section heading, once as the submit button's own label — which is
    // stated rather than left as an unexplained number: a future edit that
    // drops one of the two would fail here, and the reader should be able to
    // tell that from a wrong count without opening the component.
    expect(html.split("Відправити на перевірку").length - 1).toBe(4);
  });
});
