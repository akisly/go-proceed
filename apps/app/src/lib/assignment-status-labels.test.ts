import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ASSIGNMENT_STATUS_LABELS, assignmentStatusLabel } from "./assignment-status-labels";

/**
 * The label map against the CHECK constraint it claims to cover, read out of
 * the APPLIED migration on every run — same discipline `membership-
 * labels.test.ts` holds `MEMBERSHIP_ROLE_LABELS`/`MEMBERSHIP_STATUS_LABELS`
 * to, against a different source file for a reason stated below.
 *
 * WHY NOT JUST LIST THE FIVE STRINGS HERE. A test that repeats the map's own
 * keys proves only that someone typed them twice. The failure this file
 * exists to catch is the one that happens LATER: a migration widens
 * `work_assignments.status` with a sixth value, nothing here changes, and the
 * new status renders as a raw English token to a Ukrainian-speaking ПТВ with
 * every suite green — which is exactly what already happened once to this
 * five-value set (that is why `dash.assignment_status.*` had to be added as
 * NEW catalog rows in the first place, per `assignment-status-labels.ts`'s
 * header). Deriving the expectation from the schema is what makes the next
 * drift a red test instead of a bug report from the pilot.
 *
 * `supabase/migrations/0015_execution_evidence_module.sql`, NOT
 * `technical/schema.sql`. `membership-labels.test.ts` reads `technical/
 * schema.sql` because that file's `public.memberships` table happens to match
 * the applied one. `work_assignments` does not: `technical/schema.sql:419`
 * describes a different, unapplied target design for this table (an
 * eight-value `state` column). The APPLIED migration is the one the route
 * this screen calls actually queries, so it is the one this test reads.
 * Confirmed no later migration alters the constraint: no
 * `alter table … work_assignments … status` appears anywhere under
 * `supabase/migrations/` (migration 0043's `work_assignments.baseline_status`
 * is a different column, not this one).
 *
 * THE TABLE BLOCK IS EXTRACTED FIRST, same reason `membership-labels.test.ts`
 * and `packages/testing/src/copy-catalog-fidelity.test.ts` both do it: the
 * migration file also defines `upload_intents.status` (a different five-plus
 * value CHECK), so a regex run over the whole file could match the wrong
 * column's constraint. Scoping to the owning `create table` block first, then
 * searching inside it, is what makes that impossible rather than merely
 * unlikely today.
 */
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const MIGRATION = join(
  REPO_ROOT, "supabase", "migrations", "0015_execution_evidence_module.sql");
const COPY_CATALOG = join(REPO_ROOT, "technical", "copy-catalog.csv");

function checkedValues(table: string, column: string): string[] {
  const sql = readFileSync(MIGRATION, "utf8");
  const block = new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  if (!block) throw new Error(`no \`create table public.${table}\` block in ${MIGRATION}`);
  const check = new RegExp(`\\n\\s*${column}\\s[\\s\\S]*?check \\(${column} in\\s*\\(([^)]*)\\)`)
    .exec(block[1]!);
  if (!check) throw new Error(`no check constraint on ${table}.${column} in ${MIGRATION}`);
  return [...check[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
}

describe("every work_assignments.status value the database permits has a Ukrainian label", () => {
  it("covers work_assignments.status", () => {
    const permitted = checkedValues("work_assignments", "status");
    // Guards the regex itself: a pattern that silently matched nothing, or
    // matched `upload_intents.status`'s own constraint instead, would
    // otherwise pass this suite by asking nothing of the map.
    expect(permitted).toContain("active");
    expect(permitted.length).toBe(5);

    const missing = permitted.filter((status) => !(status in ASSIGNMENT_STATUS_LABELS));
    expect(missing).toEqual([]);
  });

  it("labels nothing the database forbids", () => {
    // The other direction — a label for a value the CHECK no longer permits
    // is a dead entry nobody notices, and the next reader trusts it as
    // evidence the value still exists.
    const statuses = new Set(checkedValues("work_assignments", "status"));
    expect(Object.keys(ASSIGNMENT_STATUS_LABELS).filter((s) => !statuses.has(s))).toEqual([]);
  });

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
 * stale independently.
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
