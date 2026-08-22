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
