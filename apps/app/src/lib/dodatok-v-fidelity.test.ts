import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DODATOK_V_FIELDS } from "./dodatok-v";

/**
 * The generated field list against the content file it was generated from.
 *
 * `dodatok-v.ts` carries the state standard's own captions as TypeScript
 * literals, which is three chances to drift: the PDF, the CSV, and the module.
 * The PDF-to-CSV half was verified once, at transcription, by regenerating the
 * CSV and comparing all 51 rows. This is the standing half — CSV against
 * module, on every run.
 *
 * COMPARED AS BYTES, not with `toBe`. Ukrainian orthography, two different
 * apostrophes in one form (U+0027 in «обов'язковий», U+2019 in «ім’я»), a
 * missing space in «посада,номер» that its neighbour two lines below does have,
 * and trailing spaces from the PDF's text layer: every one of those survives a
 * careless `.trim()` or `.normalize()` in a way `toBe` on decoded strings can
 * still miss when the two sides normalise identically.
 */
const CSV = join(import.meta.dirname, "..", "..", "..", "..",
  "technical", "requirements", "dbn-a31-5-2016-dodatok-v.csv");

function csvRows(): { section: string; ordinal: number; caption: string }[] {
  const text = readFileSync(CSV, "utf-8");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  const ix = (n: string) => header!.indexOf(n);
  return body.filter((r) => r.length > 1).map((r) => ({
    section: r[ix("section")]!, ordinal: Number(r[ix("ordinal")]), caption: r[ix("caption")]!,
  }));
}

describe("the generated Додаток В field list is the committed CSV's own text", () => {
  it("carries every row, in the standard's order, and not one more", () => {
    const csv = csvRows();
    expect(csv).toHaveLength(51);
    expect(DODATOK_V_FIELDS.map((f) => f.ordinal)).toEqual(csv.map((r) => r.ordinal));
    expect(DODATOK_V_FIELDS.map((f) => f.section)).toEqual(csv.map((r) => r.section));
  });

  it("every caption is byte-identical to the CSV's", () => {
    const csv = csvRows();
    for (const [i, f] of DODATOK_V_FIELDS.entries()) {
      const want = Buffer.from(csv[i]!.caption, "utf-8");
      const got = Buffer.from(f.caption, "utf-8");
      expect(got.equals(want), `caption drifted at ordinal ${f.ordinal}`).toBe(true);
    }
  });

  it("keeps the three quirks prohibition F names, so no formatter has run", () => {
    const all = DODATOK_V_FIELDS.map((f) => f.caption);
    expect(all.some((c) => c.includes("посада,номер")), "«посада,номер» без пробілу").toBe(true);
    expect(all.some((c) => c.includes("посада, номер")), "«посада, номер» з пробілом").toBe(true);
    expect(all.some((c) => c.includes("ім’я")), "U+2019 у «ім’я»").toBe(true);
    expect(all.some((c) => c.includes("обов'язковий")), "U+0027 у «обов'язковий»").toBe(true);
  });

  it("binds only fields the renderer can answer, and leaves the rest static", () => {
    // The map, asserted as a whole so adding a binding is a visible change.
    const bound = DODATOK_V_FIELDS
      .filter((f) => f.binding.kind !== "static")
      .map((f) => `${f.ordinal}:${f.binding.kind}`);
    expect(bound).toEqual([
      // 6 and 8 joined the list on 2026-08-10, when the view was widened by
      // `work_items.description` and `public.projects.name`/`address`. They are
      // the two RULED LINES of the title block; their hints on 7 and 9 stay
      // static, which is the arrangement 19/20 and 22/23 already use.
      "6:recorded_fact", "8:recorded_fact",
      "10:recorded_fact", "11:signatory", "14:signatory", "16:signatory",
      "19:recorded_fact", "22:quantity_lines", "36:decision_blocks",
      "45:signatory", "47:signatory", "49:signatory",
    ]);
  });
});
