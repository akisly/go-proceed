import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { CAPTURE_TIME_TRUST_LABELS, ORIGIN_METHOD_LABELS, captureTimeTrustLabel, originMethodLabel } from "./evidence-labels";

/**
 * Both label maps against `evidence_objects`'s own CHECK constraints, read
 * out of the APPLIED migration on every run — same discipline
 * `assignment-status-labels.test.ts` holds `ASSIGNMENT_STATUS_LABELS` to,
 * for the reason given there: a test that repeats the map's own keys proves
 * only that someone typed them twice, and the failure this file exists to
 * catch is a LATER migration widening either column with nothing here
 * changing.
 *
 * SCOPED TO `evidence_objects` SPECIFICALLY, not a bare column-name search.
 * `origin_method` and `capture_time_trust` are BOTH ALSO checked columns on
 * OTHER tables in this same migration — `origin_method` on (what the file's
 * own comments show is) an earlier `import_files`-shaped table, and
 * `capture_time_trust` again on `capture_events`, a different fact about a
 * different attempt. The route this screen calls
 * (`app/v1/assignments/[assignmentId]/evidence/route.ts`) reads
 * `eo.origin_method` / `eo.capture_time_trust` — `evidence_objects`'s own
 * columns — so the block is extracted by table name FIRST, exactly the
 * `assignment-status-labels.test.ts` pattern, before either constraint is
 * searched for.
 *
 * ══════════════════════════════════════════════════════════════════════
 * IT READS THE WHOLE MIGRATION DIRECTORY NOW, NOT ONE FILE — CORRECTED
 * 2026-08-22 (Plan D slice D1 task 7), AND THE PREVIOUS VERSION OF THIS
 * FILE WAS DEFENDING THE DEFECT IT WAS WRITTEN TO CATCH.
 *
 * The header above already named the failure mode exactly: «a LATER migration
 * widening either column with nothing here changing». That is precisely what
 * had happened. `0043_the_obligation_before_the_covering.sql` drops and
 * re-adds `evidence_objects_origin_method_check` with a SEVENTH value,
 * `origin_not_distinguished` — the only value a PWA capture may carry, and
 * therefore the only value anything in this product actually produces — while
 * this file read `0015` alone and asserted, on six values, that the label map
 * was complete. Eleven green tests, and the office evidence screen rendered
 * the raw identifier `origin_not_distinguished` to ПТВ. It was found by
 * `qa/field.mjs`'s seventh audit, the first thing in this repository ever to
 * put a REAL captured photo on that screen in a browser.
 *
 * So «what the database permits» is now resolved the way the database
 * resolves it: every migration, in filename order, LAST definition wins —
 * because that is what applying them in order does. A future `0061` that
 * widens the column again is caught on the run after it lands.
 * ══════════════════════════════════════════════════════════════════════
 */
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");
const COPY_CATALOG = join(REPO_ROOT, "technical", "copy-catalog.csv");

/**
 * Every value the LAST-APPLIED CHECK on `public.evidence_objects.<column>`
 * permits.
 *
 * Two shapes carry that constraint and both are searched, in filename order:
 * the column definition inside `create table public.evidence_objects (…)`,
 * and a later `alter table public.evidence_objects … add constraint …
 * check (<column> in (…))`. The last match across the directory is the one
 * in force, exactly as it is in the database.
 *
 * `.sql` files only, sorted by name — the same order `supabase db push`
 * applies them in. A file that mentions the column in a COMMENT rather than a
 * constraint cannot match either pattern: both require the literal
 * `check (<column> in (`.
 */
function checkedValues(column: string): string[] {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  let last: string[] | null = null;
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

    const created = /create table public\.evidence_objects \(([\s\S]*?)\n\);/.exec(sql);
    if (created) {
      const check = new RegExp(`\\n\\s*${column}\\s[\\s\\S]*?check \\(${column} in\\s*\\(([^)]*)\\)`)
        .exec(created[1]!);
      if (check) last = [...check[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
    }

    // Scoped to this table by requiring the `alter table` line to name it, so
    // `upload_intents`'s identically-named constraint — re-added in the same
    // migration, with the same seven values — cannot stand in for it.
    const altered = [...sql.matchAll(
      new RegExp(
        `alter table public\\.evidence_objects\\s+add constraint [a-z_]+\\s+check \\(${column} in\\s*\\(([^)]*)\\)`,
        "g"),
    )];
    const lastAlter = altered.at(-1);
    if (lastAlter) last = [...lastAlter[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
  }
  if (last === null) {
    throw new Error(`no check constraint on public.evidence_objects.${column} anywhere in ${MIGRATIONS_DIR}`);
  }
  return last;
}

describe("every evidence_objects.capture_time_trust value the database permits has a Ukrainian label", () => {
  it("covers evidence_objects.capture_time_trust", () => {
    const permitted = checkedValues("capture_time_trust");
    // Guards the regex itself, same reasoning
    // `assignment-status-labels.test.ts` gives for its own guard assertion.
    expect(permitted).toContain("device_claimed");
    expect(permitted.length).toBe(3);

    const missing = permitted.filter((v) => !(v in CAPTURE_TIME_TRUST_LABELS));
    expect(missing).toEqual([]);
  });

  it("labels nothing the database forbids", () => {
    const permitted = new Set(checkedValues("capture_time_trust"));
    const stray = Object.keys(CAPTURE_TIME_TRUST_LABELS).filter((v) => !permitted.has(v));
    expect(stray).toEqual([]);
  });

  it("labels every value in Ukrainian, never by echoing the identifier back", () => {
    for (const [value, label] of Object.entries(CAPTURE_TIME_TRUST_LABELS)) {
      expect(label).not.toBe(value);
      expect(label).toMatch(/\p{Script=Cyrillic}/u);
    }
  });
});

describe("every evidence_objects.origin_method value the database permits has a Ukrainian label", () => {
  it("covers evidence_objects.origin_method", () => {
    const permitted = checkedValues("origin_method");
    expect(permitted).toContain("native_camera");
    // SEVEN SINCE MIGRATION 0043, not the six migration 0015 created. This
    // number was 6 and passed, because the resolver above only ever read 0015
    // — the guard meant to protect the regex was instead pinning the stale
    // answer the regex returned. Named explicitly so a future widening shows
    // up here as «7 vs 8» rather than as a silently missing label.
    expect(permitted.length).toBe(7);
    expect(permitted).toContain("origin_not_distinguished");

    const missing = permitted.filter((v) => !Object.hasOwn(ORIGIN_METHOD_LABELS, v));
    expect(missing).toEqual([]);
  });

  it("labels nothing the database forbids", () => {
    const permitted = new Set(checkedValues("origin_method"));
    const stray = Object.keys(ORIGIN_METHOD_LABELS).filter((v) => !permitted.has(v));
    expect(stray).toEqual([]);
  });

  it("labels every value in Ukrainian, never by echoing the identifier back", () => {
    for (const [value, label] of Object.entries(ORIGIN_METHOD_LABELS)) {
      expect(label).not.toBe(value);
      expect(label).toMatch(/\p{Script=Cyrillic}/u);
    }
  });
});

/**
 * The maps against `technical/copy-catalog.csv`'s own rows — same reasoning
 * `assignment-status-labels.test.ts`'s second `describe` block gives: a
 * catalog row is only worth something if it is true, and the row and the
 * map are two copies of the same Ukrainian sentence that can go stale
 * independently.
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
  it("carries one dash.capture_trust row per value, with the same Ukrainian string", () => {
    const catalog = catalogLabels("dash.capture_trust.");
    expect([...catalog.keys()].sort()).toEqual(Object.keys(CAPTURE_TIME_TRUST_LABELS).sort());
    for (const [value, label] of Object.entries(CAPTURE_TIME_TRUST_LABELS)) {
      expect(catalog.get(value)).toBe(label);
    }
  });

  it("carries one dash.origin_method row per value, with the same Ukrainian string", () => {
    const catalog = catalogLabels("dash.origin_method.");
    expect([...catalog.keys()].sort()).toEqual(Object.keys(ORIGIN_METHOD_LABELS).sort());
    for (const [value, label] of Object.entries(ORIGIN_METHOD_LABELS)) {
      expect(catalog.get(value)).toBe(label);
    }
  });
});

describe("an unknown origin_method stays readable", () => {
  // `EvidenceObjectView.originMethod` is `z.string().min(1)` — a server one
  // deploy ahead can legitimately send a value this map has never seen.
  it("returns the raw value when nothing is mapped", () => {
    expect(originMethodLabel("scanned_barcode")).toBe("scanned_barcode");
    expect(originMethodLabel("")).toBe("");
  });

  it("does not resolve inherited Object.prototype keys as labels", () => {
    expect(originMethodLabel("toString")).toBe("toString");
    expect(originMethodLabel("constructor")).toBe("constructor");
  });
});

describe("captureTimeTrustLabel is exhaustive over the contract's own union", () => {
  it("resolves all three values", () => {
    expect(captureTimeTrustLabel("device_claimed")).toBe(CAPTURE_TIME_TRUST_LABELS.device_claimed);
    expect(captureTimeTrustLabel("server_estimated")).toBe(CAPTURE_TIME_TRUST_LABELS.server_estimated);
    expect(captureTimeTrustLabel("unknown")).toBe(CAPTURE_TIME_TRUST_LABELS.unknown);
  });
});
