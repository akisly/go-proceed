import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  NORM_REF_VERIFICATION_LABELS, normRefVerificationLabel,
  type NormRefVerificationTag,
} from "./norm-ref-labels";

/**
 * The field half of `apps/app/tests/norm-ref-labels.int.test.ts` (TODOS 2026-08-27
 * residual 7). The app half asks the RUNNING DATABASE which values the CHECK
 * admits; this app has no database in its tests, so the union is pinned by
 * hand the same way every inlined contract shape here is — and this file is
 * what makes drift loud on the mobile side.
 *
 * The labels are regulatory-adjacent strings under
 * docs/product/hidden-works-content-rules.md, so they are compared BYTE FOR
 * BYTE: two apostrophe codepoints look identical in a diff and are not.
 */

function sameBytes(a: string, b: string): boolean {
  return Buffer.from(a, "utf8").equals(Buffer.from(b, "utf8"));
}

describe("the norm-ref verification labels, byte-identical to the app's copy", () => {
  it("carries the three labels the content rules give, byte for byte", () => {
    expect(sameBytes(
      NORM_REF_VERIFICATION_LABELS.VERIFIED_PRIMARY,
      "перевірено за першоджерелом")).toBe(true);
    expect(sameBytes(
      NORM_REF_VERIFICATION_LABELS.VERIFIED_SECONDARY,
      "перевірено за вторинним джерелом")).toBe(true);
    // hidden-works-content-rules.md §"Project-sourced strings": «Its UI label
    // is «за робочою документацією об'єкта»». The apostrophe is U+0027 in the
    // content rules AND in the app's copy — measured, not assumed — and the
    // byte comparison is what notices if either side ever drifts to U+02BC.
    expect(sameBytes(
      NORM_REF_VERIFICATION_LABELS.PROJECT_DOCUMENTATION,
      "за робочою документацією об'єкта")).toBe(true);
  });

  it("never labels the project-sourced origin «перевірено» in any form", () => {
    // The rule's own words: «an origin, not a verification strength. It must
    // not be labelled «перевірено» in any form.» The two standard-sourcing
    // labels, by contrast, ARE strength statements and say so.
    expect(NORM_REF_VERIFICATION_LABELS.PROJECT_DOCUMENTATION).not.toContain("перевірено");
    expect(NORM_REF_VERIFICATION_LABELS.VERIFIED_PRIMARY.startsWith("перевірено за ")).toBe(true);
    expect(NORM_REF_VERIFICATION_LABELS.VERIFIED_SECONDARY.startsWith("перевірено за ")).toBe(true);
  });

  it("is exhaustive in both directions over the hand-pinned union", () => {
    // (1) every union member has a label — the compiler enforces it on this
    // object literal; (2) every label key is a union member — only a test can
    // see the map's actual keys.
    const unionMembers = {
      VERIFIED_PRIMARY: true,
      VERIFIED_SECONDARY: true,
      PROJECT_DOCUMENTATION: true,
    } as const satisfies Record<NormRefVerificationTag, true>;
    expect(Object.keys(NORM_REF_VERIFICATION_LABELS).sort())
      .toEqual(Object.keys(unionMembers).sort());
  });

  it("resolves through the function the screen calls", () => {
    expect(normRefVerificationLabel("PROJECT_DOCUMENTATION"))
      .toBe(NORM_REF_VERIFICATION_LABELS.PROJECT_DOCUMENTATION);
  });
});

/**
 * `apps/app/src/lib/norm-ref-labels.ts` prints the same labels in the project
 * money overview's blocked-reasons list and on the Telegram cards. Its file is read as text, not
 * imported (this package does not depend on `apps/app`), and every
 * `KEY: "label"` pair it declares must equal this map's, byte for byte.
 */
describe("the norm-ref verification labels, byte-identical to apps/app's copy", () => {
  it("declares the same keys with the same labels", () => {
    const source = readFileSync(
      new URL("../../../../app/src/lib/norm-ref-labels.ts", import.meta.url), "utf8");
    const pairs = [...source.matchAll(/^\s*([A-Z][A-Z_]*): ("(?:[^"\\]|\\.)*"),/gm)]
      .map((m) => [m[1] as NormRefVerificationTag, JSON.parse(m[2]!) as string] as const);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.map(([key]) => key).sort()).toEqual(Object.keys(NORM_REF_VERIFICATION_LABELS).sort());
    for (const [key, label] of pairs) {
      expect(sameBytes(label, NORM_REF_VERIFICATION_LABELS[key]), key).toBe(true);
    }
  });
});
