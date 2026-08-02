import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

/**
 * The repository's error-catalog guard is the model: it fails when a route
 * emits a problem code the catalog does not define. This is the same shape for
 * tokens — it fails when committed output no longer matches what the source
 * would produce.
 *
 * What it does NOT catch, stated so nobody assumes otherwise: a wrong value.
 * Once a wrong value is in the source, generation makes it consistent
 * everywhere. That is exactly how `muted` drifted (#686E6A documented,
 * #666979 shipped, name identical). Only the visual gate catches that class.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");

/** Regenerates into a temp dir and returns what the generator would write. */
function regenerate(script: string, out: string): string {
  execFileSync("node", [join(repoRoot, "packages/tokens/scripts", script)],
    { cwd: repoRoot, env: { ...process.env, TOKENS_OUT_DIR: "/tmp/token-fidelity" } });
  return readFileSync(join("/tmp/token-fidelity", out), "utf8");
}

describe("generated tokens match their source", () => {
  it("the committed CSS is what the generator produces", () => {
    const committed = readFileSync(join(repoRoot, "packages/ui/src/tokens.generated.css"), "utf8");
    expect(regenerate("generate-css.mjs", "tokens.generated.css")).toBe(committed);
  });

  it("the committed React Native module is what the generator produces", () => {
    const committed = readFileSync(join(repoRoot, "packages/tokens/src/tokens.generated.ts"), "utf8");
    expect(regenerate("generate-native.mjs", "tokens.generated.ts")).toBe(committed);
  });
});

describe("the source accounts for every documented colour", () => {
  it("names every token the design document's table defines, or records it contested", () => {
    // docs/05-design-system.md:19-30. Parsed from the document rather than
    // copied, so adding a row there without adding a token fails here.
    const doc = readFileSync(join(repoRoot, "docs/05-design-system.md"), "utf8");
    const documented = [...doc.matchAll(/^\| `([a-z0-9-]+)` \| `(#[0-9A-Fa-f]{6})` \|/gm)]
      .map((m) => m[1]!);
    expect(documented.length).toBe(12);

    const src = JSON.parse(
      readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));
    const accounted = new Set([...Object.keys(src.color), ...src.contested]);
    expect(documented.filter((t) => !accounted.has(t))).toEqual([]);
  });

  it("carries a ruling for every token, so no value is unexplained", () => {
    const src = JSON.parse(
      readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));
    const unexplained = Object.entries(src.color as Record<string, { ruling?: string }>)
      .filter(([, v]) => !v.ruling || v.ruling.length < 10)
      .map(([k]) => k);
    expect(unexplained).toEqual([]);
  });
});
