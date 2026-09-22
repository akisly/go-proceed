import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { contrastRatio } from "../../tokens/scripts/lib/color.mjs";

/**
 * The repository's error-catalog guard is the model: it fails when a route
 * emits a problem code the catalog does not define. This is the same shape for
 * tokens — it fails when committed output no longer matches what the source
 * would produce.
 *
 * What it does NOT catch, stated so nobody assumes otherwise: a wrong value.
 * Once a wrong value is in the source, generation makes it consistent
 * everywhere. That is exactly how `muted` drifted in v1 (#686E6A documented,
 * #666979 shipped, name identical). Two other guards close that gap now —
 * palette-derivation.test.ts recomputes every hex from its OKLCH triple, and
 * contrast.test.ts asserts every semantic pairing — but neither replaces the
 * visual gate for a value that is legal and simply wrong.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");

/**
 * A fixed, never-cleaned output path let a broken generator pass this guard
 * silently in v1: if a generator stopped honouring `TOKENS_OUT_DIR` it would
 * overwrite the committed file at its real location as a side effect, while
 * this test read a stale-but-matching copy left in the fixed temp path by an
 * earlier run. `runDir` is therefore unique per test-file execution and removed
 * afterwards, and each `regenerate()` call gets its own fresh subdirectory,
 * checked empty immediately before the generator runs and checked to contain
 * exactly the expected file immediately after. Isolation here is the mechanism
 * the guard depends on, not tidiness.
 */
let runDir: string;

beforeAll(() => { runDir = mkdtempSync(join(tmpdir(), "token-fidelity-")); });
afterAll(() => { rmSync(runDir, { recursive: true, force: true }); });

function regenerate(script: string, out: string): string {
  const dir = mkdtempSync(join(runDir, `${script}-`));
  expect(readdirSync(dir)).toEqual([]);

  execFileSync("node", [join(repoRoot, "packages/tokens/scripts", script)],
    { cwd: repoRoot, env: { ...process.env, TOKENS_OUT_DIR: dir } });

  expect(readdirSync(dir)).toEqual([out]);
  return readFileSync(join(dir, out), "utf8");
}

const src = JSON.parse(
  readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));

/** Every generator, and the committed artefact it owns. One row per output —
 * a generator with no row here is a generator whose output nothing guards. */
const GENERATORS: Array<[script: string, file: string, committed: string]> = [
  ["generate-css.mjs", "tokens.generated.css", "packages/ui/src/tokens.generated.css"],
  ["generate-theme.mjs", "theme.generated.css", "packages/ui/src/theme.generated.css"],
  ["generate-native.mjs", "tokens.generated.ts", "packages/tokens/src/tokens.generated.ts"],
  ["generate-dtcg.mjs", "tokens.dtcg.json", "packages/tokens/src/tokens.dtcg.json"],
  ["generate-palette.mjs", "palette.generated.mjs", "packages/testing/qa/palette.generated.mjs"],
  ["generate-docs.mjs", "01-tokens.md", "docs/design/01-tokens.md"],
  ["generate-merge-config.mjs", "tw-merge.generated.ts", "packages/ui/src/tw-merge.generated.ts"],
];

describe("generated tokens match their source", () => {
  for (const [script, file, committed] of GENERATORS) {
    it(`${committed} is what ${script} produces`, () => {
      expect(regenerate(script, file))
        .toBe(readFileSync(join(repoRoot, committed), "utf8"));
    });
  }

  it("every generator in the scripts directory has a row above", () => {
    // A generator added without a row would emit an unguarded artefact, which
    // is the state this whole file exists to make impossible.
    const scripts = readdirSync(join(repoRoot, "packages/tokens/scripts"))
      .filter((f) => f.startsWith("generate-") && f.endsWith(".mjs")).sort();
    expect(scripts).toEqual(GENERATORS.map(([s]) => s).sort());
  });
});

describe("the source explains itself", () => {
  it("carries a ruling for every primitive colour", () => {
    const unexplained = Object.entries(
      src.primitive.color as Record<string, { ruling?: string }>)
      .filter(([, v]) => !v.ruling || v.ruling.length < 10).map(([k]) => k);
    expect(unexplained).toEqual([]);
  });

  it("carries a ruling for every semantic role, scale entry and component value", () => {
    const unexplained: string[] = [];
    for (const [name, v] of Object.entries(
      src.semantic.color as Record<string, { ruling?: string }>)) {
      if (!v.ruling || v.ruling.length < 10) unexplained.push(`semantic.${name}`);
    }
    for (const [block, entries] of Object.entries(src.primitive)) {
      if (block === "color") continue;
      for (const [name, v] of Object.entries(entries as Record<string, { ruling?: string }>)) {
        if (!v.ruling || v.ruling.length < 10) unexplained.push(`primitive.${block}.${name}`);
      }
    }
    for (const [name, v] of Object.entries(
      src.component as Record<string, { ruling?: string }>)) {
      if (!v.ruling || v.ruling.length < 10) unexplained.push(`component.${name}`);
    }
    expect(unexplained).toEqual([]);
  });

  it("carries a ruling for every shadow", () => {
    // Only entries shaped like a token — an object carrying a `layers` array,
    // the same test packages/tokens/scripts/lib/source.mjs uses in every
    // generator — are checked, so block-level metadata is not mistaken for a
    // token. A review once caught that deleting a shadow's ruling left this
    // suite green.
    const shadows = Object.entries(
      (src.shadow ?? {}) as Record<string, { layers?: unknown; ruling?: string }>)
      .filter(([, v]) => v && typeof v === "object" && Array.isArray(v.layers));
    expect(shadows.length).toBeGreaterThan(0);
    expect(shadows.filter(([, v]) => !v.ruling || v.ruling.length < 10).map(([k]) => k))
      .toEqual([]);
  });

  it("the contested list is empty, so every value has been ruled", () => {
    expect(src.contested).toEqual([]);
  });

  it("every contrast ratio a ruling states is one its own colour produces", () => {
    // [2026-09-22, DEV-027] THIS IS THE GUARD THE PALETTE CHANGE EARNED TWICE.
    // A ruling's prose is copied verbatim into `tokens.dtcg.json` and into the
    // generated `01-tokens.md`, beside a contrast column the generator computes
    // — and nothing recomputes the prose. When the palette moved, seventeen
    // rulings kept Daylight's numbers (found in review), and the pass that
    // corrected them left one behind: `ember-600` said 4.56 where the column on
    // its own row said 4.57 (found in QA). Both are the same defect: a number
    // typed by a human beside a number derived by a machine.
    //
    // SCOPED TO THE RULING'S OWN COLOUR, which is what makes it bite. A first
    // version asked only that the number be the contrast of SOME pair in the
    // palette; with 76 primitives that is ~5 800 pairs and almost every
    // two-decimal value in range is produced by one of them — it did not even
    // catch 4.56 → 4.58. A ruling talks about ITS colour, so the candidates are
    // that colour against each of the others: 76 values, not 5 800. Verified to
    // reject both real defects this task produced.
    const hexOf = (name: string) => (src.primitive.color[name] as { hex: string }).hex;
    const hexes = Object.keys(src.primitive.color).map(hexOf);
    const against = (hex: string) => new Set(hexes.map((b) => contrastRatio(hex, b).toFixed(2)));
    // The one sentence that names a pair on purpose to REFUSE it: `text-on-signal`
    // is ink, and its ruling says why it is not white — «White on ember measures
    // 3.11:1». The subject of that number is white, not the role's own colour.
    const NAMES_A_REFUSED_PAIRING = new Set(["text-on-signal:3.11"]);
    const orphans: string[] = [];
    for (const [name, token] of Object.entries(src.primitive.color)) {
      const produced = against(hexOf(name));
      for (const m of String((token as { ruling: string }).ruling).matchAll(/(\d+\.\d+):1/g)) {
        if (!produced.has(m[1]!)) orphans.push(`primitive ${name}: ${m[1]} is not this colour's contrast with anything`);
      }
    }
    for (const [role, def] of Object.entries(src.semantic.color)) {
      const d = def as { light?: unknown; dark?: unknown; ruling?: string };
      const produced = new Set<string>();
      for (const ref of [d.light, d.dark]) {
        if (typeof ref === "string") for (const v of against(hexOf(ref))) produced.add(v);
      }
      for (const m of String(d.ruling ?? "").matchAll(/(\d+\.\d+):1/g)) {
        if (!produced.has(m[1]!) && !NAMES_A_REFUSED_PAIRING.has(`${role}:${m[1]}`)) {
          orphans.push(`semantic ${role}: ${m[1]} is not a contrast of the rungs it resolves to`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });
});

describe("the semantic layer is well formed", () => {
  it("every semantic role resolves to a primitive that exists, in both themes", () => {
    const primitives = new Set(Object.keys(src.primitive.color));
    const dangling: string[] = [];
    for (const [name, t] of Object.entries(src.semantic.color as Record<string, any>)) {
      for (const theme of ["light", "dark"] as const) {
        const ref = typeof t[theme] === "string" ? t[theme] : t[theme].ref;
        if (!primitives.has(ref)) dangling.push(`${name}.${theme} -> ${ref}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it("no two roles claim the same Tailwind colour name", () => {
    // bg-muted (a fill) and text-muted (copy) both want `--color-muted`. They
    // are spelled `sunken` and `ink-muted` precisely so they cannot collide,
    // and this is what keeps a later addition from quietly re-pointing one of
    // them: the last declaration in the @theme block would simply win.
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [name, t] of Object.entries(src.semantic.color as Record<string, any>)) {
      if (!t.tw) continue;
      if (seen.has(t.tw)) clashes.push(`${t.tw}: ${seen.get(t.tw)} and ${name}`);
      seen.set(t.tw, name);
    }
    expect(clashes).toEqual([]);
  });

  it("no primitive ramp step is reachable as a Tailwind utility", () => {
    // The whole point of the three-layer split: a component names a role. If a
    // ramp step ever appears in the @theme block, `bg-neutral-200` starts
    // working and the layer stops being enforceable by anything but review.
    const theme = readFileSync(
      join(repoRoot, "packages/ui/src/theme.generated.css"), "utf8");
    const ramps = [...new Set(Object.keys(src.primitive.color)
      .map((n) => n.replace(/-\d+$/, "")))];
    const leaked = ramps.filter((r) =>
      new RegExp(`^\\s*--color-${r}-\\d+\\s*:`, "m").test(theme));
    expect(leaked).toEqual([]);
  });
});
