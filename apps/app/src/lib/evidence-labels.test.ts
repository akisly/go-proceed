import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CAPTURE_TIME_TRUST_LABELS, ORIGIN_METHOD_LABELS, captureTimeTrustLabel, originMethodLabel } from "./evidence-labels";

/**
 * The two label maps, in the ways that need no database: the strings
 * themselves, the catalogue rows that repeat them, and the fallback.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * «EVERY VALUE THE DATABASE PERMITS» IS NO LONGER ASKED HERE — MOVED 2026-08-22
 * (Plan D slice D1 task 7, fix round 1). It is in
 * `apps/app/tests/evidence-labels.int.test.ts`, which reads `pg_constraint`.
 *
 * This file used to answer that question by parsing migration SQL, and the
 * parser was wrong twice: it read migration 0015 alone while 0043 had widened
 * `origin_method` to seven values, and — after that was fixed by walking the
 * whole directory — it still matched only the literal spelling
 * `check (<column> in (…))`, which is NOT how the running database stores it
 * and not how six migrations in this repository write it. Both are set out in
 * full in the int file's header, with the evidence.
 *
 * A test that approximates the schema can be wrong about the schema. The
 * database cannot. What stayed here is everything that is genuinely about the
 * label strings and the catalogue, neither of which Postgres knows anything
 * about.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const COPY_CATALOG = join(REPO_ROOT, "technical", "copy-catalog.csv");

describe("every label is Ukrainian, never the identifier echoed back", () => {
  it("holds for capture_time_trust", () => {
    for (const [value, label] of Object.entries(CAPTURE_TIME_TRUST_LABELS)) {
      expect(label).not.toBe(value);
      expect(label).toMatch(/\p{Script=Cyrillic}/u);
    }
  });

  it("holds for origin_method", () => {
    // The failure this catches is exactly what shipped and was found in a
    // browser: `origin_not_distinguished` had no entry at all, so
    // `originMethodLabel`'s fallback returned the identifier and the office
    // card rendered it. An entry that IS present must never be the identifier
    // wearing a label's clothes.
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
