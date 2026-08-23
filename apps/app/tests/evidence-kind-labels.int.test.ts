import { describe, it, expect } from "vitest";
import { q } from "./helpers/fixtures";

import { EVIDENCE_KIND_LABELS } from "../src/lib/evidence-kind-labels";

/**
 * «EVERY VALUE THE DATABASE PERMITS» — ASKED OF THE DATABASE, not of
 * migration text and not of the zod enum this map is typed against.
 *
 * Same shape as `assignment-status-labels.int.test.ts` (whose own header
 * carries the full account of why: a migration-text parser read one
 * migration out of several that touched the same CHECK, and a change that
 * widened the constraint in the `= ANY (ARRAY[…])` spelling — which Postgres
 * itself normalises every CHECK to in storage — would match nothing a naive
 * `check (col in (…))` regex looks for). `pg_constraint` is not an
 * approximation of the applied schema; it IS the applied schema, after
 * every migration, in whichever spelling anyone wrote it.
 *
 * SCOPED TO `public.requirement_occurrences`, NOT `requirement_rule_
 * versions` — both tables carry an identically-worded `evidence_kind` CHECK
 * (migration 0043's INV-066 copy), but `apps/app/src/lib/readiness.ts:333`
 * (`missingEvidenceFor`, called from `blockedReasonFor`) reads the
 * OCCURRENCE'S own column, and that is the value this screen actually
 * renders — so this test asks the table this screen's route actually
 * queries, not its upstream source.
 */
async function permittedEvidenceKinds(): Promise<string[]> {
  const rows = await q<{ conname: string; def: string }>(
    `select c.conname, pg_get_constraintdef(c.oid) as def
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'requirement_occurrences'
        and c.contype = 'c'
        and c.conkey = array[(select a.attnum
                                from pg_attribute a
                               where a.attrelid = t.oid
                                 and a.attname = 'evidence_kind'
                                 and a.attnum > 0
                                 and not a.attisdropped)]`,
  );

  if (rows.length !== 1) {
    throw new Error(
      `expected exactly one single-column CHECK on public.requirement_occurrences.evidence_kind, `
      + `found ${rows.length}`
      + (rows.length > 1 ? `: ${rows.map((r) => r.conname).join(", ")}` : ""),
    );
  }

  const def = rows[0]!.def;
  // Every quoted literal is captured unconditionally first, then shape-
  // checked — same move `assignment-status-labels.int.test.ts`'s own
  // `permittedValues` makes, so a literal outside `[a-z_]+` fails loudly
  // here instead of being silently dropped by a narrower regex.
  const literals = [...def.matchAll(/'([^']*)'(?:::text)?/g)].map((m) => m[1]!);
  return literals.map((v) => {
    if (!/^[a-z_]+$/.test(v)) {
      throw new Error(
        `public.requirement_occurrences.evidence_kind's CHECK admits "${v}", which is outside `
        + `the [a-z_]+ shape this extraction assumes — widen the pattern rather than silently `
        + `dropping it. Full definition: ${def}`,
      );
    }
    return v;
  });
}

describe("every requirement_occurrences.evidence_kind value the database permits has a Ukrainian label", () => {
  it("covers evidence_kind", async () => {
    const permitted = await permittedEvidenceKinds();
    // Guards the extraction itself: an empty `permitted` would make `missing`
    // empty too — a test that passes by reading nothing.
    expect(permitted).toContain("photo");
    expect(permitted.length).toBe(4);

    const missing = permitted.filter((v) => !Object.hasOwn(EVIDENCE_KIND_LABELS, v));
    expect(missing).toEqual([]);
  });

  it("labels nothing the database forbids", async () => {
    const permitted = new Set(await permittedEvidenceKinds());
    const stray = Object.keys(EVIDENCE_KIND_LABELS).filter((v) => !permitted.has(v));
    expect(stray).toEqual([]);
  });
});
