import { describe, it, expect } from "vitest";
import { q } from "./helpers/fixtures";

import { CAPTURE_TIME_TRUST_LABELS, ORIGIN_METHOD_LABELS } from "../src/lib/evidence-labels";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * «EVERY VALUE THE DATABASE PERMITS» — ASKED OF THE DATABASE.
 *
 * This block used to live in `src/lib/evidence-labels.test.ts` and answer that
 * question by PARSING MIGRATION SQL. It is here, and DB-backed, because the
 * text approach failed at the one job it was written for — twice over, and the
 * second failure was found by review rather than by the test.
 *
 * FAILURE 1, ALREADY SHIPPED AND FIXED (Plan D slice D1 task 7). The parser
 * read migration 0015 alone. Migration 0043 re-added the same constraint with a
 * seventh value, `origin_not_distinguished` — the only value a PWA capture may
 * carry, and therefore the only value anything in this product actually
 * produces. Eleven green tests over a stale source, while the office evidence
 * card rendered the raw identifier to ПТВ.
 *
 * FAILURE 2, WHICH WOULD HAVE LET FAILURE 1 RECUR SILENTLY. The fix walked the
 * whole migration directory, last definition wins — and still matched only the
 * literal spelling `check (<column> in (…))`. Three ways that is not enough,
 * all of them present in this repository today:
 *
 *   1. `= ANY (ARRAY[…])`. Postgres NORMALISES `in (…)` to that form, which is
 *      literally how `evidence_objects_origin_method_check` reads in the
 *      running database — and SIX migrations here (0016, 0041, 0044, 0045,
 *      0047, 0049) already write it that way by hand. A future migration
 *      widening `origin_method` in that spelling matched NOTHING, the resolver
 *      returned the stale set, the count assertion passed, `missing` came back
 *      empty, and the new value reached the screen as a raw identifier. That is
 *      failure 1 again, defended by the very test written to catch it.
 *   2. A `drop constraint` with no re-add left the resolver reporting a
 *      constraint that no longer exists.
 *   3. `--` comments were not stripped. `0043:67-71`'s rollback block escapes
 *      only because each `--` prefix happens to break the whitespace match; one
 *      single-line rollback comment elsewhere would have read as a live
 *      definition.
 *
 * `pg_constraint` removes all three at once, because it is not an
 * approximation of the applied schema — it IS the applied schema, after every
 * migration, every drop, every re-add, in whichever spelling. The suite already
 * has the database (`ADMIN_URL`, the same value CI passes as
 * `SUPABASE_DB_URL`), so this costs one catalog read and no fixture: it
 * truncates nothing and seeds nothing.
 *
 * `pg_get_constraintdef` STILL RETURNS TEXT, and that is worth being precise
 * about rather than overclaiming. What changed is WHOSE text: Postgres's own
 * normalised rendering of the parsed expression, in one canonical form, with no
 * comments, no rollback blocks and no superseded definitions in it. A quoted
 * literal in that string is a value the constraint actually admits.
 *
 * BOTH DIRECTIONS ARE STILL ASSERTED, as they were before: every permitted
 * value has a label, and every label names a permitted value. One without the
 * other is half a test — the first misses a stale entry, the second misses a
 * missing one.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Every value the CHECK on `public.evidence_objects.<column>` admits, read out
 * of the running database.
 *
 * SCOPED BY `conkey`, NOT BY NAME OR BY SEARCHING THE DEFINITION TEXT. A
 * constraint is matched only when its key columns are EXACTLY this one column,
 * so a future multi-column check cannot be mistaken for this one, and
 * `upload_intents`'s identically-shaped constraint — re-added by the same
 * migration, with the same seven values — cannot stand in for
 * `evidence_objects`'s.
 *
 * EXACTLY ONE ROW IS REQUIRED. Two single-column CHECKs on one column is a
 * legal schema and an ambiguous answer to «what does the database permit»;
 * this refuses loudly rather than picking one.
 */
async function permittedValues(column: string): Promise<string[]> {
  const rows = await q<{ conname: string; def: string }>(
    `select c.conname, pg_get_constraintdef(c.oid) as def
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'evidence_objects'
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
      `expected exactly one single-column CHECK on public.evidence_objects.${column}, found ${rows.length}`
      + (rows.length > 1 ? `: ${rows.map((r) => r.conname).join(", ")}` : ""),
    );
  }
  // `'value'::text` in the ANY(ARRAY[…]) form, `'value'` in any other — the
  // cast suffix is optional in the pattern so both read the same.
  return [...rows[0]!.def.matchAll(/'([a-z_]+)'(?:::text)?/g)].map((m) => m[1]!);
}

describe("every evidence_objects.capture_time_trust value the database permits has a Ukrainian label", () => {
  it("covers evidence_objects.capture_time_trust", async () => {
    const permitted = await permittedValues("capture_time_trust");
    // Guards the extraction itself: if the regex ever stopped finding literals
    // it would return `[]`, and an empty `permitted` makes `missing` empty too
    // — a test that passes by reading nothing.
    expect(permitted).toContain("device_claimed");
    expect(permitted.length).toBe(3);

    const missing = permitted.filter((v) => !(v in CAPTURE_TIME_TRUST_LABELS));
    expect(missing).toEqual([]);
  });

  it("labels nothing the database forbids", async () => {
    const permitted = new Set(await permittedValues("capture_time_trust"));
    const stray = Object.keys(CAPTURE_TIME_TRUST_LABELS).filter((v) => !permitted.has(v));
    expect(stray).toEqual([]);
  });
});

describe("every evidence_objects.origin_method value the database permits has a Ukrainian label", () => {
  it("covers evidence_objects.origin_method", async () => {
    const permitted = await permittedValues("origin_method");
    expect(permitted).toContain("native_camera");
    // SEVEN SINCE MIGRATION 0043, not the six migration 0015 created. Named as
    // a number so a future widening shows up here as «7 vs 8» rather than as a
    // value that silently reaches ПТВ as a raw identifier.
    expect(permitted.length).toBe(7);
    expect(permitted).toContain("origin_not_distinguished");

    const missing = permitted.filter((v) => !Object.hasOwn(ORIGIN_METHOD_LABELS, v));
    expect(missing).toEqual([]);
  });

  it("labels nothing the database forbids", async () => {
    const permitted = new Set(await permittedValues("origin_method"));
    const stray = Object.keys(ORIGIN_METHOD_LABELS).filter((v) => !permitted.has(v));
    expect(stray).toEqual([]);
  });
});

/**
 * THE ANY(ARRAY[…]) SPELLING, PINNED AS THE REASON THIS FILE EXISTS.
 *
 * Not a tautology and not decoration: it records the observation that motivated
 * moving off SQL text, so that a future reader who wonders why a perfectly
 * readable parser was deleted can see the evidence rather than take the
 * commit message's word for it. If Postgres ever rendered this constraint back
 * as `IN (…)`, this would fail and the header above would need rewriting —
 * which is the correct outcome for a claim about how Postgres normalises.
 */
describe("the running database does not store the spelling the old parser looked for", () => {
  it("renders evidence_objects_origin_method_check as = ANY (ARRAY[…])", async () => {
    const rows = await q<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
        where conname = 'evidence_objects_origin_method_check'`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.def).toContain("= ANY (ARRAY[");
    // The literal the deleted resolver matched on. Its absence is the whole
    // failure mode: the migration says `in (…)`, the database says `ANY`, and
    // a parser that reads migrations sees a spelling the database does not use
    // the moment anyone writes the other one by hand — which six migrations
    // here already do.
    expect(rows[0]!.def).not.toContain(" in (");
  });
});
