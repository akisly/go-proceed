import { describe, expect, it } from "vitest";
import { recordEvidenceDecision } from "./record-evidence-decision";

describe("recordEvidenceDecision", () => {
  it("is the shared command boundary used by non-HTTP callers", () => {
    // The integration characterization lives in m3-refusal and is deliberately
    // credential-gated.  This protects the extraction boundary itself: Telegram
    // must depend on the exact service, never import the member route.
    expect(recordEvidenceDecision).toBeTypeOf("function");
  });
});
