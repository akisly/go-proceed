import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
 */
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const MIGRATION = join(
  REPO_ROOT, "supabase", "migrations", "0015_execution_evidence_module.sql");
const COPY_CATALOG = join(REPO_ROOT, "technical", "copy-catalog.csv");

function checkedValues(column: string): string[] {
  const sql = readFileSync(MIGRATION, "utf8");
  const block = /create table public\.evidence_objects \(([\s\S]*?)\n\);/.exec(sql);
  if (!block) throw new Error(`no \`create table public.evidence_objects\` block in ${MIGRATION}`);
  const check = new RegExp(`\\n\\s*${column}\\s[\\s\\S]*?check \\(${column} in\\s*\\(([^)]*)\\)`)
    .exec(block[1]!);
  if (!check) throw new Error(`no check constraint on evidence_objects.${column} in ${MIGRATION}`);
  return [...check[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
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
    expect(permitted.length).toBe(6);

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
