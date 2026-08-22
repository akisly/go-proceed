import { describe, it, expect } from "vitest";
import { q } from "./helpers/fixtures";

import { ASSIGNMENT_STATUS_LABELS } from "../src/lib/assignment-status-labels";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * «EVERY VALUE THE DATABASE PERMITS» — ASKED OF THE DATABASE.
 *
 * This block used to live in `src/lib/assignment-status-labels.test.ts` and
 * answer that question by PARSING MIGRATION SQL — the exact shape
 * `apps/app/tests/evidence-labels.int.test.ts` was itself moved off of, one
 * task earlier in this same slice, for a reason that turned out to apply here
 * too rather than being specific to `origin_method`.
 *
 * FAILURE 1, WHICH ALREADY SHIPPED FOR THE SIBLING MAP. Task 6 built
 * `ORIGIN_METHOD_LABELS` with a migration-text fidelity test in this file's
 * old shape. Task 7's browser audit put a real field-captured photo on the
 * evidence screen for the first time and it rendered `origin_not_
 * distinguished` — a raw identifier — to a Ukrainian-speaking ПТВ. The label
 * map had no entry for it: migration 0043 had widened
 * `evidence_objects.origin_method` from six values to seven, the text parser
 * read migration 0015 alone, and the fidelity test stayed green throughout.
 * This file's own old version had the identical shape, one migration away
 * (0015 only) from the identical failure on `work_assignments.status`.
 *
 * FAILURE 2, WHICH WOULD HAVE LET FAILURE 1 RECUR SILENTLY EVEN AFTER A FIX
 * THAT WALKED EVERY MIGRATION. The fix still matched only the literal
 * spelling `check (<column> in (…))`. Postgres NORMALISES every CHECK to
 * `= ANY (ARRAY[…])` in storage — confirmed live below for
 * `work_assignments_status_check` itself, not assumed — and SIX migrations in
 * this repository (0016, 0041, 0044, 0045, 0047, 0049) already write that
 * spelling BY HAND. A future migration that widens `work_assignments.status`
 * in that spelling would match nothing, `permittedValues` would return the
 * stale five, the count assertion would pass, `missing` would come back
 * empty, and the new value would reach the assignments list as a raw
 * identifier — the same failure, defended by the very test written to catch
 * it.
 *
 * `pg_constraint` removes both failure modes at once: it is not an
 * approximation of the applied schema, it IS the applied schema, after every
 * migration, every drop, every re-add, in whichever spelling anyone wrote it.
 * The suite already has the database (`ADMIN_URL` — the same value CI passes
 * as `SUPABASE_DB_URL`), so this costs one catalog read and no fixture: it
 * truncates nothing and seeds nothing, so it cannot corrupt a neighbour
 * sharing the database.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Every value the CHECK on `public.work_assignments.<column>` admits, read
 * out of the running database.
 *
 * SCOPED BY `conkey`, NOT BY NAME OR BY SEARCHING THE DEFINITION TEXT. A
 * constraint is matched only when its key columns are EXACTLY this one
 * column, so a future multi-column check cannot be mistaken for this one, and
 * `upload_intents`'s own, differently-shaped `status` CHECK — defined in the
 * same migration file, which is exactly what made the old text-based
 * `checkedValues("work_assignments", "status")` need to scope to a
 * `create table` block first — cannot stand in for `work_assignments`'s.
 *
 * EXACTLY ONE ROW IS REQUIRED. Two single-column CHECKs on one column is a
 * legal schema and an ambiguous answer to «what does the database permit»;
 * this refuses loudly rather than picking one.
 *
 * EVERY QUOTED LITERAL IS VALIDATED, NOT JUST MATCHED — the one gap Task 7's
 * own version of this function (`evidence-labels.int.test.ts:102`) still has.
 * That function's regex, `/'([a-z_]+)'(?:::text)?/g`, finds a value outside
 * the `[a-z_]+` shape by simply not matching it: no entry, no error, and both
 * `expect(permitted.length).toBe(n)` and the `missing`/`stray` assertions
 * below would still pass on a silently shrunken list — exactly the
 * "green test over a stale source" shape that shipped failure 1. This
 * function instead matches EVERY `'...'` in the rendered definition first,
 * then asserts each one is lowercase snake_case, and THROWS, naming the
 * actual literal, the moment one is not — turning a silent miss into a loud
 * failure here rather than at a ПТВ's screen. Every value
 * `work_assignments.status` admits today is lowercase snake_case, so this
 * assertion costs nothing now and only starts mattering the day someone
 * writes a differently-shaped literal, which is exactly the day this
 * function needs to be looked at rather than trusted.
 */
async function permittedValues(column: string): Promise<string[]> {
  const rows = await q<{ conname: string; def: string }>(
    `select c.conname, pg_get_constraintdef(c.oid) as def
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'work_assignments'
        and c.contype = 'c'
        and c.conkey = array[(select a.attnum
                                from pg_attribute a
                               where a.attrelid = t.oid
                                 and a.attname = $1
                                 and a.attnum > 0
                                 and not a.attisdropped)]`,
    [column]);

  if (rows.length !== 1) {
    throw new Error(
      `expected exactly one single-column CHECK on public.work_assignments.${column}, `
      + `found ${rows.length}`
      + (rows.length > 1 ? `: ${rows.map((r) => r.conname).join(", ")}` : ""),
    );
  }

  const def = rows[0]!.def;
  // `'value'::text` in the ANY(ARRAY[…]) form, `'value'` in any other — the
  // cast suffix is optional in the pattern so both read the same. `[^']*`,
  // not `[a-z_]*`: every quoted literal is captured first, unconditionally,
  // so the shape check below sees every one of them rather than silently
  // skipping whichever ones it would not have matched.
  const literals = [...def.matchAll(/'([^']*)'(?:::text)?/g)].map((m) => m[1]!);
  return literals.map((v) => {
    if (!/^[a-z_]+$/.test(v)) {
      throw new Error(
        `public.work_assignments.${column}'s CHECK admits "${v}", which is outside `
        + `the [a-z_]+ shape this extraction assumes for a stored_vocabulary value — `
        + `widen the pattern rather than silently dropping it. Full definition: ${def}`,
      );
    }
    return v;
  });
}

describe("every work_assignments.status value the database permits has a Ukrainian label", () => {
  it("covers work_assignments.status", async () => {
    const permitted = await permittedValues("status");
    // Guards the extraction itself: if it ever stopped finding literals it
    // would return `[]`, and an empty `permitted` makes `missing` empty too —
    // a test that passes by reading nothing.
    expect(permitted).toContain("active");
    expect(permitted.length).toBe(5);

    const missing = permitted.filter((v) => !Object.hasOwn(ASSIGNMENT_STATUS_LABELS, v));
    expect(missing).toEqual([]);
  });

  it("labels nothing the database forbids", async () => {
    // The other direction — a label for a value the CHECK no longer permits
    // is a dead entry nobody notices, and the next reader trusts it as
    // evidence the value still exists.
    const permitted = new Set(await permittedValues("status"));
    const stray = Object.keys(ASSIGNMENT_STATUS_LABELS).filter((v) => !permitted.has(v));
    expect(stray).toEqual([]);
  });
});

/**
 * THE ANY(ARRAY[…]) SPELLING, PINNED AS THE REASON THIS FILE EXISTS — same
 * documentation move `evidence-labels.int.test.ts` makes for
 * `evidence_objects_origin_method_check`, against this map's own constraint.
 *
 * Not a tautology and not decoration: it records the observation that
 * motivated moving off SQL text, so a future reader who wonders why a
 * perfectly readable parser was deleted can see the evidence rather than take
 * a commit message's word for it.
 */
describe("the running database does not store the spelling a text parser would look for", () => {
  it("renders work_assignments_status_check as = ANY (ARRAY[…])", async () => {
    const rows = await q<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
        where conname = 'work_assignments_status_check'`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.def).toContain("= ANY (ARRAY[");
    // THE COMPLEMENT OF THE ASSERTION ABOVE — AND CASE-INSENSITIVE, WHICH THE
    // PREVIOUS VERSION WAS NOT. It read `not.toContain(" in (")`: a LOWERCASE
    // needle against a string in which `pg_get_constraintdef` renders every
    // keyword UPPERCASE. In the one world its own comment claimed it guarded
    // against — Postgres rendering this constraint back as `IN (…)` — the
    // needle still would not have matched. It could not fail for any input this
    // query can produce, while reading as though it could: a green line
    // standing in for a check, which is the defect class this whole file
    // exists to stop. The regex asserts the claim rather than a lowercase
    // accident of it. What it guards is narrow and worth saying plainly: it
    // pins Postgres's NORMALISATION, not the label maps — the migration source
    // says `in (…)`, the database says `ANY`, and a parser that reads
    // migrations sees a spelling the database does not use the moment anyone
    // writes the other one by hand, which six migrations here already do.
    expect(rows[0]!.def).not.toMatch(/\sin\s*\(/i);
  });
});
