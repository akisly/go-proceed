import { describe, expect, it } from "vitest";
import { quoted, requiredDisclaimers } from "../../../../app/tests/helpers/content-rules";
import { DOVIDKOVYI_DISCLAIMER_TEXT, PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT } from "./disclaimer";
import { NORM_REF_VERIFICATION_LABELS } from "./norm-ref-labels";

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
  // Found by the sentence that mandates it, not by position: a disclaimer the
  // document gains above it must not move this guard onto another blockquote.
  const matches = requiredDisclaimers().filter((d) => d.introduction.includes("never collapsed"));

  it("is the requirement-list disclaimer, mandated exactly once", () => {
    expect(matches).toHaveLength(1);
    expect(matches[0]!.introduction).toContain("Under every generated requirement list");
  });

  it("prints the mandated text character for character", () => {
    expect(Buffer.from(DOVIDKOVYI_DISCLAIMER_TEXT, "utf8")
      .equals(Buffer.from(matches[0]!.body, "utf8"))).toBe(true);
  });
});

/**
 * The project-sourced items note, found the same way — by the sentence that
 * mandates it, as `act-content-fidelity.test.ts` finds the app's copy.
 */
describe("the project-sourced items disclaimer, byte for byte as the content rules mandate it", () => {
  const all = requiredDisclaimers();
  const matches = all.filter((d) =>
    d.introduction.includes("only on a list that also carries project-sourced items"));

  it("is mandated exactly once, immediately after the довідковий disclaimer", () => {
    expect(matches).toHaveLength(1);
    expect(matches[0]!.introduction).toContain("immediately after it");
    // «it» is the довідковий disclaimer: the blockquote right above this one.
    expect(all.indexOf(matches[0]!))
      .toBe(all.findIndex((d) => d.introduction.includes("never collapsed")) + 1);
  });

  it("prints the mandated text character for character", () => {
    expect(Buffer.from(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT, "utf8")
      .equals(Buffer.from(matches[0]!.body, "utf8"))).toBe(true);
  });

  it("quotes the very label the screen prints beside a project-sourced item", () => {
    expect(quoted(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT)[0])
      .toBe(NORM_REF_VERIFICATION_LABELS.PROJECT_DOCUMENTATION);
  });
});
