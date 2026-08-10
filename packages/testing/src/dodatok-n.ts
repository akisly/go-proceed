import { readFileSync } from "node:fs";

/**
 * NOTHING IN THIS PACKAGE'S NEW M1 SUITES HAS BEEN EXECUTED. There is no
 * node_modules, no database and no docker in the environment these files were
 * written in: no `pnpm`, `vitest`, `tsc`, `psql` or `supabase` was run, and no
 * claim is made that any assertion below passes. Static reading is the only
 * check that was available.
 *
 * ---------------------------------------------------------------------------
 * The shipped Додаток Н content, read from
 * technical/requirements/dbn-a31-5-2016-dodatok-n.csv at test time.
 *
 * WHY THE CSV IS READ RATHER THAN TRANSCRIBED. These are regulatory strings
 * under docs/product/hidden-works-content-rules.md. A copy pasted into a
 * fixture is a second source that can drift from the first, and the whole
 * point of the content rules is that there is exactly one place the wording
 * comes from. Reading the file also means a fixture cannot introduce a
 * position, an item or a wording the allow-list does not carry.
 *
 * THIS IS NOT TASK 3. Plan task 3 owes a CONSTANT compiled out of this CSV into
 * production code plus the command that materialises it per workspace
 * (docs/superpowers/plans/2026-08-06-v0.1-implementation.md:1038-1044). This
 * module is a test-side reader and deliberately not that constant: if it were
 * imported by the seeding command, the fidelity test would be comparing the CSV
 * against itself.
 *
 * A NEAR-DUPLICATE OF THIS FILE LIVES AT apps/app/tests/helpers/dodatok-n.ts.
 * It is duplicated rather than shared because @goproceed/app does not depend on
 * @goproceed/testing and adding that edge would put a test package into the
 * application's dependency graph. Both copies read the same CSV, so neither can
 * drift from the content; only the parser is repeated.
 */

export interface DodatokNRow {
  /** Only Н.14 and Н.15 are allow-listed; the CHECK in 0041 §1 stores no other. */
  position: string;
  positionTitleUk: string;
  itemNo: number;
  itemTextUk: string;
  verification: string;
  /** The whole provenance string, stored verbatim as source_citation. */
  source: string;
}

export const DODATOK_N_CSV_PATH = new URL(
  "../../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv", import.meta.url);

/**
 * The standard every row of the CSV belongs to.
 *
 * THE CSV HAS NO source_standard COLUMN, and this is where that gap is
 * absorbed. public.requirement_library_items.source_standard is NOT NULL, and
 * apps/app/src/lib/requirement-content.ts:48-50 composes the attribution from
 * it — «ДБН А.3.1-5:2016, Додаток Н (довідковий), позиція Н.15», which
 * hidden-works-content-rules.md §"What the product MAY assert" item 1 gives
 * literally. There is therefore exactly one value the column may hold for these
 * twelve rows, and it is this one. THE CSV OWES THE COLUMN: until it carries
 * one, the standard is asserted here and in the seeding command rather than
 * read from the content file, which is one more place a correction has to
 * reach.
 */
export const DODATOK_N_SOURCE_STANDARD = "ДБН А.3.1-5:2016";

/**
 * One CSV record → fields. RFC 4180 subset: double-quoted fields, doubled
 * quotes inside them, no embedded newlines. The file has commas and semicolons
 * inside quoted fields, which is exactly why a `split(",")` would be wrong.
 */
function splitRecord(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  // charAt rather than [i]: under noUncheckedIndexedAccess an index read is
  // `string | undefined`, which cannot be concatenated onto a string. charAt
  // returns "" past the end, which is also the behaviour the lookahead wants.
  for (let i = 0; i < line.length; i += 1) {
    const ch = line.charAt(i);
    if (quoted) {
      if (ch === '"') {
        if (line.charAt(i + 1) === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else { field += ch; }
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { out.push(field); field = ""; continue; }
    field += ch;
  }
  out.push(field);
  return out;
}

const HEADER = ["position", "position_title_uk", "item_no", "item_text_uk", "verification", "source"];

/** The twelve rows, in the standard's own order (Н.14 1..5, then Н.15 1..7). */
export function readDodatokN(): DodatokNRow[] {
  const text = readFileSync(DODATOK_N_CSV_PATH, "utf-8");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const header = splitRecord(lines[0] ?? "");
  // The column ORDER is asserted rather than searched for: a reader that
  // silently tolerated a reordered header would seed the wrong text into the
  // wrong column and every fidelity assertion would still be comparing the
  // parse against itself.
  if (header.join(",") !== HEADER.join(",")) {
    throw new Error(`dbn-a31-5-2016-dodatok-n.csv header changed: ${header.join(",")}`);
  }
  return lines.slice(1).map((line, index) => {
    const f = splitRecord(line);
    if (f.length !== HEADER.length) {
      throw new Error(`dbn-a31-5-2016-dodatok-n.csv row ${index + 1} has ${f.length} fields`);
    }
    return {
      position: f[0] as string,
      positionTitleUk: f[1] as string,
      itemNo: Number(f[2]),
      itemTextUk: f[3] as string,
      verification: f[4] as string,
      source: f[5] as string,
    };
  });
}
