import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every problem code a route emits must exist in technical/error-catalog.csv.
 *
 * The catalog is the contract with clients: it fixes the HTTP status, whether
 * the failure is retryable, and what the user is told to do. v0.1-M2-A shipped
 * five invented codes (EVIDENCE_MEDIA_REJECTED, EVIDENCE_INTEGRITY_FAILED,
 * EVIDENCE_SCAN_BLOCKED, UPLOAD_NOT_STAGED, QUOTA_EXCEEDED) while the catalog
 * already had a code for each case. The mobile client in M2-B would have had
 * nothing to map them to. Neither the review nor its outside voice caught it,
 * so this is the standing guard.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("problem codes come from the error catalog", () => {
  it("emits no code the catalog does not define", () => {
    const catalog = new Set(
      readFileSync(join(repoRoot, "technical/error-catalog.csv"), "utf8")
        .split("\n").slice(1)
        .map((line) => line.split(",")[0]?.trim())
        .filter((c): c is string => Boolean(c)));

    const emitted = new Map<string, string[]>();
    for (const file of walk(join(repoRoot, "apps/app/app/v1"))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/problem\("([A-Z_]+)"/g)) {
        const code = m[1]!;
        emitted.set(code, [...(emitted.get(code) ?? []), file.replace(repoRoot + "/", "")]);
      }
    }
    expect(emitted.size).toBeGreaterThan(0);

    const unknown = [...emitted.entries()]
      .filter(([code]) => !catalog.has(code))
      .map(([code, files]) => `${code} (${files[0]})`);
    expect(unknown).toEqual([]);
  });
});
