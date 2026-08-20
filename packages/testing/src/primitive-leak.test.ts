import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The three-layer split is only real if it is enforced.
 *
 * A component names a ROLE. `bg-canvas`, `text-ink-muted`, `border-line`. It
 * does not name a ramp step, because a ramp step is a fact about colour and
 * carries no meaning about where it may be used — which is how `#666979`
 * ends up as a border on one screen and as body text on another, and how a
 * theme becomes unswitchable.
 *
 * Tailwind's side of this is structural: theme.generated.css puts no ramp step
 * in the `--color-*` namespace, so `bg-neutral-200` simply does not compile.
 * What that does NOT stop is a raw `var(--gp-neutral-200)` in a stylesheet or
 * a style attribute, which works perfectly and silently. This test is the
 * other half.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");
const src = JSON.parse(
  readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));

const RAMPS = [...new Set(Object.keys(src.primitive.color).map((n) => n.replace(/-\d+$/, "")))];
const LEAK = new RegExp(`--gp-(${RAMPS.join("|")})-\\d+`, "g");

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".css", ".mjs"];

/**
 * Scanned roots. `apps/**` is the product; the whole of `packages/ui/src` is
 * held to the same rule as a component — including the base layer and the
 * generated theme, because if either needs a ramp step directly, that is a role
 * the semantic layer is missing.
 *
 * The generated `tokens.generated.css` is where the ramp is DEFINED and is
 * therefore excluded below; everything else in that directory consumes it.
 */
const ROOTS = ["apps/app", "apps/landing", "apps/mobile", "packages/ui/src"];

/**
 * Exclusions are listed rather than skipped silently, so the debt is visible
 * and cannot outlive the files it covers.
 */
const EXCLUDED = [
  // The generated file that DEFINES the ramp. Everything else consumes it.
  "packages/ui/src/tokens.generated.css",
  // apps/demo carries the frozen 156 KB prototype sheet, byte-identical to
  // prototype/src/styles.css by test. Excluded until D5 retires it.
  "apps/demo/src/styles.css",
  "apps/demo/src/styles/demo.css",
];

function* walk(path: string): Generable {
  let st;
  try { st = statSync(path); } catch { return; }
  if (st.isFile()) { yield path; return; }
  for (const entry of readdirSync(path)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".next" || entry === ".turbo") continue;
    yield* walk(join(path, entry));
  }
}
type Generable = Generator<string, void, unknown>;

describe("no component names a primitive", () => {
  it("finds no ramp-step reference under the scanned roots", () => {
    const findings: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(join(repoRoot, root))) {
        const rel = relative(repoRoot, file);
        if (EXCLUDED.includes(rel)) continue;
        if (!EXTENSIONS.some((e) => file.endsWith(e))) continue;
        const text = readFileSync(file, "utf8");
        for (const m of text.matchAll(LEAK)) {
          findings.push(`${rel}: ${m[0]} — name a semantic role instead`);
        }
      }
    }
    expect(findings).toEqual([]);
  });

  it("the exclusion list names only files that still exist", () => {
    // An exclusion that outlives its file is an exclusion that quietly widens.
    const missing = EXCLUDED.filter((rel) => {
      try { statSync(join(repoRoot, rel)); return false; } catch { return true; }
    });
    expect(missing).toEqual([]);
  });
});
