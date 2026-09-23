import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * This slice generates three artifacts from two sources. Two of the three had
 * a guard; this is the third.
 *
 * `apps/mobile/src/lib/status-labels.generated.json` is committed output of
 * `apps/mobile/scripts/generate-labels.mjs`, whose source is
 * `technical/copy-catalog.csv`. A reviewer demonstrated the hole directly:
 * change a Ukrainian label in the catalog and leave the JSON alone, and
 * `copy-catalog-fidelity.test.ts` passes (it checks that every
 * database-permitted state HAS a key, never what that key's value says),
 * `token-fidelity.test.ts` passes (different source, different outputs), and
 * `tsc` passes (the JSON's shape is unchanged). The app then renders the stale
 * wording with nothing red anywhere. Only deleting the file was caught, by the
 * import throwing.
 *
 * `apps/mobile/src/screens/token-proof.tsx` was written on the assumption that
 * rendering both artifacts made drift observable. It does not: a wrong label
 * renders as confidently as a right one. Rendering catches an artifact that is
 * MISSING; only a comparison against the source catches one that is STALE.
 * This file is that comparison.
 * [2026-09-23, DEV-042] token-proof.tsx is deleted (nothing imported it once
 * its route went); the paragraph above is its history, and this comparison
 * is unchanged.
 *
 * The catalog is parsed here rather than imported from the generator's own
 * parser on purpose. If this test called `generate-labels.mjs`'s
 * `parseCsvLine`, a bug in that parser would corrupt the expected value and the
 * committed value identically and this guard would agree with itself. The
 * reader below is independent of the generator, so the two have to agree about
 * the catalog's real content for this to pass.
 *
 * String equality is byte equality here: both sides are decoded from UTF-8, so
 * two labels differing in any byte — including a different Unicode
 * normalisation of the same Ukrainian letters — differ as JavaScript strings.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");

const PREFIX = "status.client_state.";

/**
 * Reads one RFC 4180 record's fields. The catalog quotes any field containing
 * a comma and doubles literal quotes inside a quoted field; `context` values
 * use both. Only the first two fields (`key`, `ui_uk`) are needed, but the
 * whole line is parsed so that a malformed row throws rather than silently
 * yielding a truncated `ui_uk`.
 */
function csvFields(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let value = "";
      i += 1;
      let closed = false;
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i += 1;
          closed = true;
          break;
        }
        value += line[i];
        i += 1;
      }
      if (!closed) throw new Error(`unbalanced quote in CSV field: ${line}`);
      fields.push(value);
      if (line[i] === ",") i += 1;
      else if (i >= line.length) break;
      else throw new Error(`unexpected character after quoted CSV field: ${line}`);
    } else {
      const comma = line.indexOf(",", i);
      const end = comma === -1 ? line.length : comma;
      fields.push(line.slice(i, end));
      i = end + 1;
      if (comma === -1) break;
    }
  }
  return fields;
}

/** `status.client_state.*` → its `ui_uk` value, straight from the catalog. */
function catalogLabels(): Map<string, string> {
  const csv = readFileSync(join(repoRoot, "technical/copy-catalog.csv"), "utf8");
  const out = new Map<string, string>();
  for (const line of csv.split("\n")) {
    if (!line.startsWith(PREFIX)) continue;
    const [key, uk] = csvFields(line);
    if (!key || !uk) throw new Error(`empty key or ui_uk in catalog row: ${line}`);
    out.set(key, uk);
  }
  return out;
}

function committedLabels(): Record<string, string> {
  return JSON.parse(readFileSync(
    join(repoRoot, "apps/mobile/src/lib/status-labels.generated.json"), "utf8"));
}

describe("the committed mobile labels are the catalog's own words", () => {
  it("carries exactly the keys the catalog defines, no more and no fewer", () => {
    const catalog = [...catalogLabels().keys()].sort();
    // Seven since 2026-08-06, when ADR-007 decision 6 added the `discarded` row
    // it records the catalog as owing. Like the generator's own guard this is a
    // row-loss count and not a vocabulary claim; which seven keys are legitimate
    // is copy-catalog-fidelity.test.ts's question.
    expect(catalog.length).toBe(7);
    expect(Object.keys(committedLabels()).sort()).toEqual(catalog);
  });

  it("every label is byte-identical to the catalog's ui_uk", () => {
    const catalog = catalogLabels();
    const committed = committedLabels();
    // Asserted key by key rather than as one object comparison so a failure
    // names the drifted label and shows both strings, which is what someone
    // reading a red run needs in order to know which side is wrong.
    for (const [key, expected] of catalog) {
      expect(committed[key], `label drifted for ${key}`).toBe(expected);
    }
  });
});
