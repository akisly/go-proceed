import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

/**
 * A fixed, never-cleaned output path (the original `/tmp/token-fidelity`) let
 * a broken generator pass this guard silently. If a generator stopped
 * honouring `TOKENS_OUT_DIR` — e.g. someone hardcoded the real output path
 * back in — it would overwrite the committed file at its real location as a
 * side effect, while this test kept reading a stale-but-matching copy left
 * in the fixed temp path by an earlier successful run, and passed. On a
 * clean checkout that failed correctly with ENOENT; on a warm CI runner or a
 * second local `vitest` invocation it did not. A reviewer built and
 * confirmed exactly this regression.
 *
 * The fix is two-layered: `runDir` is unique per test-file execution
 * (`mkdtempSync`) and removed afterwards (`rmSync`), so no earlier run's
 * output can be waiting there to be misread; and each `regenerate()` call
 * gets its own fresh subdirectory of `runDir`, checked empty immediately
 * before the generator runs and checked to contain exactly the expected file
 * immediately after. A generator that silently ignores `TOKENS_OUT_DIR`
 * leaves that subdirectory empty, so the post-run assertion fails and
 * `readFileSync` never gets the chance to read back something stale.
 * Isolation here is the mechanism the guard depends on, not tidiness.
 */
let runDir: string;

beforeAll(() => {
  runDir = mkdtempSync(join(tmpdir(), "token-fidelity-"));
});

afterAll(() => {
  rmSync(runDir, { recursive: true, force: true });
});

/** Regenerates into a fresh, empty subdirectory of this run's temp root and
 * returns what the generator wrote. See the comment above `runDir` for why
 * this checks the directory's contents before and after, rather than
 * trusting that `TOKENS_OUT_DIR` was honoured. */
function regenerate(script: string, out: string): string {
  const dir = mkdtempSync(join(runDir, `${script}-`));
  expect(readdirSync(dir)).toEqual([]);

  execFileSync("node", [join(repoRoot, "packages/tokens/scripts", script)],
    { cwd: repoRoot, env: { ...process.env, TOKENS_OUT_DIR: dir } });

  expect(readdirSync(dir)).toEqual([out]);
  return readFileSync(join(dir, out), "utf8");
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

    // Only entries shaped like a token — an object carrying a `layers`
    // array, the same test `packages/tokens/scripts/lib/source.mjs` uses in
    // both generators — are checked for a ruling here, so block-level
    // metadata in the `shadow` block is not mistaken for a token. The block
    // carries none today: `nativeBlurDivisor` and its note were removed when
    // the token moved to React Native's `boxShadow`. Checking the shadow's
    // ruling at all was missing entirely until a review caught that deleting
    // it left this test green.
    const shadowTokens = Object.entries(
      (src.shadow ?? {}) as Record<string, { layers?: unknown; ruling?: string }>,
    ).filter(([, v]) => v && typeof v === "object" && Array.isArray(v.layers));
    for (const [name, v] of shadowTokens) {
      if (!v.ruling || v.ruling.length < 10) unexplained.push(`shadow.${name}`);
    }

    expect(unexplained).toEqual([]);
  });

  it("the contested list is empty, so every B0 render has been ruled", () => {
    // B0's three contested tokens (line, blue-500, the shadow) all needed an
    // owner at a render rather than a rule — see the ruling entries above.
    // A review caught that nothing asserted this stayed true: refilling
    // `contested` left the rest of this suite green.
    const src = JSON.parse(
      readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));
    expect(src.contested).toEqual([]);
  });
});
