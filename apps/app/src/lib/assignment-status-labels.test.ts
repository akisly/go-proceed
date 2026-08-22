import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ASSIGNMENT_STATUS_LABELS, assignmentStatusLabel } from "./assignment-status-labels";

/**
 * WHAT MOVED OUT, AND WHY — fix round 2 on Task 5.
 *
 * This file used to also assert "every value the database permits has a
 * label" by parsing `supabase/migrations/0015_execution_evidence_module.sql`'s
 * text. That assertion now lives in `apps/app/tests/
 * assignment-status-labels.int.test.ts`, reading `pg_constraint` off the
 * running database instead — moved for the exact reason
 * `apps/app/tests/evidence-labels.int.test.ts`'s header documents at length
 * for its own sibling map (`ORIGIN_METHOD_LABELS`): a migration-text parser
 * only sees the spelling it was written to expect (`check (col in (…))`),
 * Postgres normalises every CHECK to `= ANY (ARRAY[…])` in storage, six
 * migrations in this repository already write that spelling BY HAND, and
 * `evidence_objects.origin_method` was widened that way by migration 0043
 * while a text-parsing fidelity test identical in shape to this file's old
 * one stayed green the whole time — shipping a raw identifier
 * (`origin_not_distinguished`) to a Ukrainian-speaking ПТВ. `pg_constraint`
 * is not an approximation of the applied schema; after every migration,
 * every drop, every re-add, in whichever spelling, it IS the applied schema.
 *
 * WHAT STAYS HERE. Everything below has no database dependency: the map's
 * own internal shape (every label is Ukrainian, never an echo of the raw
 * value), its fallback behaviour for a value it has never seen, and its
 * agreement with `technical/copy-catalog.csv`. None of that needs
 * `pg_constraint` to change if the CHECK constraint never does, so none of
 * it belongs in the `.int.test.ts` directory's DB-backed convention.
 */
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const COPY_CATALOG = join(REPO_ROOT, "technical", "copy-catalog.csv");

describe("ASSIGNMENT_STATUS_LABELS's own shape", () => {
  it("labels every value in Ukrainian, never by echoing the identifier back", () => {
    // A label that is the raw value spelled the same way is indistinguishable
    // from a missing one at the call site, since that is exactly what the
    // fallback returns.
    for (const [status, label] of Object.entries(ASSIGNMENT_STATUS_LABELS)) {
      expect(label).not.toBe(status);
      expect(label).toMatch(/\p{Script=Cyrillic}/u);
    }
  });
});

/**
 * The map against `technical/copy-catalog.csv`'s `dash.assignment_status.*`
 * rows — same reasoning `membership-labels.test.ts`'s own second `describe`
 * block gives: a catalog row is only worth something if it is true, and the
 * row and the map are two copies of the same Ukrainian sentence that can go
 * stale independently. No database dependency: the catalog is a file in this
 * repository, not a runtime fact.
 *
 * Only the first two fields are read, and the naive split is safe here for
 * the same reason it is in `membership-labels.test.ts`: `key` is an
 * identifier and every `ui_uk` value in this prefix is a single word with no
 * comma and no quote.
 */
function catalogLabels(prefix: string): Map<string, string> {
  const rows = readFileSync(COPY_CATALOG, "utf8").split("\n").filter((l) => l.startsWith(prefix));
  return new Map(rows.map((line) => {
    const [key, uiUk] = line.split(",");
    if (uiUk === undefined || uiUk.includes('"')) {
      throw new Error(`copy-catalog row "${key}" needs a real CSV parser now: ${line.slice(0, 80)}`);
    }
    return [key!.slice(prefix.length), uiUk];
  }));
}

describe("the catalog says what the code renders", () => {
  it("carries one dash.assignment_status row per value, with the same Ukrainian string", () => {
    const catalog = catalogLabels("dash.assignment_status.");
    expect([...catalog.keys()].sort()).toEqual(Object.keys(ASSIGNMENT_STATUS_LABELS).sort());
    for (const [status, label] of Object.entries(ASSIGNMENT_STATUS_LABELS)) {
      expect(catalog.get(status)).toBe(label);
    }
  });
});

describe("an unknown value stays readable", () => {
  // `AssignmentSummary.status` is `packages/contracts/src/assignments.ts`'s
  // bare `string`, so a server one deploy ahead can legitimately send a
  // value this map has never seen.
  it("returns the raw status when nothing is mapped", () => {
    expect(assignmentStatusLabel("blocked")).toBe("blocked");
    expect(assignmentStatusLabel("")).toBe("");
  });

  it("does not resolve inherited Object.prototype keys as labels", () => {
    // `ASSIGNMENT_STATUS_LABELS["toString"]` on a plain object literal
    // resolves up the prototype chain to a FUNCTION, which is not nullish —
    // `??` would never fire, and `Object.freeze` does not close that either.
    expect(assignmentStatusLabel("toString")).toBe("toString");
    expect(assignmentStatusLabel("constructor")).toBe("constructor");
  });
});
