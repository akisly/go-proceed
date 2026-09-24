import { describe, expect, it } from "vitest";
import { requiredDisclaimers } from "../../../../app/tests/helpers/content-rules";
import { DOVIDKOVYI_DISCLAIMER_TEXT } from "./disclaimer";

/**
 * The довідковий disclaimer is a string the product is REQUIRED to print
 * (docs/product/hidden-works-content-rules.md §"Required disclaimers", an
 * Approved document), so this copy is compared with the document itself —
 * the same blockquote `apps/app/tests/act-content-fidelity.test.ts` compares
 * the app's `DOVIDKOVYI_DISCLAIMER_TEXT` with — and not with the app's copy:
 * both copies then answer to the authority, not to each other. The document
 * is read through the app's own reader, which removes `**` and nothing else.
 */
describe("the довідковий disclaimer, byte for byte as the content rules mandate it", () => {
  const mandated = requiredDisclaimers()[1]!;

  it("is the requirement-list disclaimer, never collapsed", () => {
    expect(mandated.introduction).toContain("never collapsed");
  });

  it("prints the mandated text character for character", () => {
    expect(Buffer.from(DOVIDKOVYI_DISCLAIMER_TEXT, "utf8")
      .equals(Buffer.from(mandated.body, "utf8"))).toBe(true);
  });
});
