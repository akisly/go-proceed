import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { APPROVER_ROLE_LABELS, approverRoleLabel } from "./approver-role-labels";

/**
 * Round 2, finding 1: `money.ts` and `quantity.ts` each landed with a
 * dedicated test file in fix round 1; this module did not. Its own header
 * claims to match `membershipRoleLabel`'s "exact shape"
 * (`membership-labels.ts`), so this file asserts exactly the
 * schema-INDEPENDENT behaviours `membership-labels.test.ts` covers for that
 * function — nothing here needs the database, because `approver_role` (per
 * this module's own header) carries no closed vocabulary to read one from.
 *
 * THE PROTOTYPE-POLLUTION GUARD IS NOT HYPOTHETICAL HERE. This repository
 * shipped exactly this bug once, in `membershipRoleLabel`, caught by review
 * rather than by a test: a plain object literal answers `["toString"]` with
 * an inherited FUNCTION, which is not nullish, so a naive `MAP[key] ?? key`
 * renders that function's source text where a role belongs. `Object.hasOwn`
 * is the fix `approverRoleLabel` already carries; this pins that it stays.
 */
describe("approverRoleLabel — an unknown value stays readable", () => {
  it("returns the raw role when nothing is mapped", () => {
    expect(approverRoleLabel("site_inspector")).toBe("site_inspector");
    expect(approverRoleLabel("")).toBe("");
  });

  it("does not resolve inherited Object.prototype keys as labels", () => {
    // `APPROVER_ROLE_LABELS["toString"]` on a plain object literal resolves
    // up the prototype chain to a function — not nullish, so `??` would
    // never treat it as unmapped. `Object.hasOwn` is what actually guards
    // this, and this assertion is what would fail if that guard regressed
    // to `MAP[role] ?? role`.
    expect(approverRoleLabel("toString")).toBe("toString");
    expect(approverRoleLabel("constructor")).toBe("constructor");
    expect(approverRoleLabel("hasOwnProperty")).toBe("hasOwnProperty");
  });
});

describe("approverRoleLabel — every mapped value is a real translation", () => {
  it("labels every known value in Ukrainian, never by echoing the identifier back", () => {
    // Same shape as membership-labels.test.ts's identical assertion: a label
    // equal to its own key is indistinguishable from an unmapped one at the
    // call site, since that is exactly what the fallback returns.
    for (const [role, label] of Object.entries(APPROVER_ROLE_LABELS)) {
      expect(label).not.toBe(role);
      expect(label).toMatch(/\p{Script=Cyrillic}/u);
    }
  });

  it("maps the one known value, technical_supervisor, through the function", () => {
    expect(approverRoleLabel("technical_supervisor")).toBe(APPROVER_ROLE_LABELS.technical_supervisor);
    expect(approverRoleLabel("technical_supervisor")).not.toBe("technical_supervisor");
  });
});

/**
 * The map against `technical/copy-catalog.csv` — same reasoning
 * `membership-labels.test.ts`'s own "the catalog says what the code renders"
 * block gives: a catalog row and the map are two copies of the same
 * Ukrainian sentence, and the copy nobody renders is the one that drifts.
 */
describe("approverRoleLabel — the catalog says what the code renders", () => {
  it("carries a matching row for every known value", () => {
    const repoRoot = join(import.meta.dirname, "..", "..", "..", "..");
    const csv = readFileSync(join(repoRoot, "technical", "copy-catalog.csv"), "utf8");
    for (const [role, label] of Object.entries(APPROVER_ROLE_LABELS)) {
      const key = `dash.approver_role.${role}`;
      const row = csv.split("\n").find((l) => l.startsWith(`${key},`));
      expect(row, `no copy-catalog row for ${key}`).toBeDefined();
      // The ui_uk field is the second CSV column; this map's own values
      // contain no comma or quote, so the naive split is safe here — same
      // caveat `membership-labels.test.ts`'s `catalogLabels` states for its
      // own identical shape.
      const uiUk = row!.split(",")[1];
      expect(uiUk).toBe(label);
    }
  });
});
