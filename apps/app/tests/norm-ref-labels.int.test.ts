import { describe, it, expect } from "vitest";
import { q } from "./helpers/fixtures";

import { NORM_REF_VERIFICATION_LABELS } from "../src/lib/norm-ref-labels";

/**
 * «EVERY VALUE THE DATABASE PERMITS» — ASKED OF THE DATABASE, matching
 * `evidence-kind-labels.int.test.ts` and `assignment-status-labels.int.
 * test.ts`'s own shape and the same reasoning: a migration-text or
 * hand-copied version of this question can stay green while the live CHECK
 * (which Postgres normalises to `= ANY (ARRAY[…])` in storage regardless of
 * how it was written) has already moved.
 *
 * SCOPED TO `public.requirement_occurrences.norm_ref_verification` — the
 * table `readiness.ts:337-339` actually reads into `blockedReason.normRef.
 * verification`, not `requirement_rule_versions`'s identically-worded sibling
 * CHECK (0043's own INV-066 copy).
 */
async function permittedVerificationTags(): Promise<string[]> {
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
                                 and a.attname = 'norm_ref_verification'
                                 and a.attnum > 0
                                 and not a.attisdropped)]`,
  );

  if (rows.length !== 1) {
    throw new Error(
      `expected exactly one single-column CHECK on public.requirement_occurrences.`
      + `norm_ref_verification, found ${rows.length}`
      + (rows.length > 1 ? `: ${rows.map((r) => r.conname).join(", ")}` : ""),
    );
  }

  const def = rows[0]!.def;
  const literals = [...def.matchAll(/'([^']*)'(?:::text)?/g)].map((m) => m[1]!);
  return literals.map((v) => {
    if (!/^[A-Z_]+$/.test(v)) {
      throw new Error(
        `public.requirement_occurrences.norm_ref_verification's CHECK admits "${v}", which is `
        + `outside the [A-Z_]+ shape this extraction assumes. Full definition: ${def}`,
      );
    }
    return v;
  });
}

describe("every requirement_occurrences.norm_ref_verification value the database permits has a Ukrainian label", () => {
  it("covers norm_ref_verification", async () => {
    const permitted = await permittedVerificationTags();
    expect(permitted).toContain("VERIFIED_PRIMARY");
    expect(permitted).toContain("PROJECT_DOCUMENTATION");
    expect(permitted.length).toBe(3);
    expect(NORM_REF_VERIFICATION_LABELS.PROJECT_DOCUMENTATION)
      .toBe("за робочою документацією об'єкта");

    const missing = permitted.filter((v) => !Object.hasOwn(NORM_REF_VERIFICATION_LABELS, v));
    expect(missing).toEqual([]);
  });

  it("labels nothing the database forbids", async () => {
    const permitted = new Set(await permittedVerificationTags());
    const stray = Object.keys(NORM_REF_VERIFICATION_LABELS).filter((v) => !permitted.has(v));
    expect(stray).toEqual([]);
  });
});
