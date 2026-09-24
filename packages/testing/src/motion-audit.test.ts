import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join, relative } from "node:path";
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
// Typed loosely on purpose: the audit is plain .mjs so CI can run it as
// `node packages/testing/qa/motion-audit.mjs` with no build step.
// @ts-expect-error - no declaration file for the audit module
import { auditMotion, ROOTS, EXCLUDED, ANIMATABLE, PERPETUAL_ALLOWLIST } from "../qa/motion-audit.mjs";

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const audit = (root: string): string[] => auditMotion(root) as string[];

describe("motion audit — the product", () => {
  it("finds nothing", () => {
    expect(audit(repoRoot)).toEqual([]);
  });

  it("covers every surface that consumes the system", () => {
    expect(ROOTS).toContain("packages/ui/src");
    expect(ROOTS).toContain("apps/landing");
    expect(ROOTS).toContain("apps/app");
  });

  it("the exclusion list names only files that still exist", () => {
    // An exclusion that outlives its file is an exclusion that quietly widens.
    const missing = (EXCLUDED as string[]).filter((rel) => {
      try { statSync(join(repoRoot, rel)); return false; } catch { return true; }
    });
    expect(missing).toEqual([]);
  });
});

/**
 * An audit that has never failed is an audit nobody has checked. Each rule is
 * exercised against a fixture tree, so a rule that silently stops matching —
 * a regex edited, a branch reordered — fails here rather than going quiet.
 *
 * FIXTURE CONTENT IS ASSEMBLED AT RUNTIME, NEVER WRITTEN AS A LITERAL.
 * Tailwind v4 scans the whole project for class candidates and does not
 * distinguish a test from a component. A literal `transition-all` in this file
 * would be found by the scanner and emitted as real CSS into the production
 * bundle — which is not a hypothetical: it is a defect this repository has
 * already shipped once, with colour fixtures.
 */
describe("motion audit — the rules actually fire", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "motion-audit-"));
    mkdirSync(join(root, "apps/landing"), { recursive: true });
    mkdirSync(join(root, "packages/ui/src"), { recursive: true });
    mkdirSync(join(root, "apps/demo/src/styles"), { recursive: true });
    writeFileSync(join(root, "apps/demo/src/styles.css"), "");
    writeFileSync(join(root, "apps/demo/src/styles/demo.css"), "");

    const decl = (prop: string, value: string) => `${prop}: ${value};`;
    writeFileSync(join(root, "apps/landing/violations.css"), [
      `.a { ${decl("transition", "all 200ms")} }`,
      `.b { ${decl("transition-property", "width")} }`,
      `.c { ${decl("transition-timing-function", "ease" + "-in")} }`,
      `.d { ${decl("animation", "spin 2s linear infinite")} }`,
    ].join("\n"));

    writeFileSync(join(root, "apps/landing/violations.tsx"), [
      `import { motion } from ${JSON.stringify("motion/react")};`,
      `export const X = () => <motion.div className={${JSON.stringify("transition" + "-all")}} />;`,
      // Stock Tailwind's own infinite loops compile since ADR-015 (DEV-073).
      `export const Y = () => <span className={${JSON.stringify("animate" + "-pulse")}} />;`,
    ].join("\n"));

    writeFileSync(join(root, "apps/landing/allowed.css"), [
      `.e { ${decl("animation", "gp-drift-a 4s linear infinite alternate")} }`,
      `.f { ${decl("animation", "gp-pulse 1.6s linear infinite")} }`,
      `.g { ${decl("animation", "gp-flow 1.6s linear infinite")} }`,
      `.h { ${decl("animation", "gp-beam 7s linear infinite")} }`,
    ].join("\n"));
  });

  afterAll(() => { rmSync(root, { recursive: true, force: true }); });

  const has = (needle: string) =>
    expect(audit(root).some((f) => f.includes(needle)), `no finding mentioning "${needle}"`).toBe(true);

  it("rule 1 — transition: all", () => has("name the properties"));
  it("rule 1 — the transition-all utility", () => has("transition-colors"));
  it("rule 2 — a layout property", () => has("layout property"));
  it("rule 3 — ease-in", () => has("stalls the first frame"));
  it("rule 4 — perpetual animation outside the named loops", () => has("outside the named loops"));
  it("rule 4 — a stock Tailwind infinite loop (animate-spin/ping/pulse/bounce)", () => has("stock Tailwind loop"));
  it("rule 4 — the five named loops are not findings", () => {
    expect(audit(root).filter((f) => f.includes("allowed.css"))).toEqual([]);
  });
  it("rule 5 — importing Motion directly", () => has("use a primitive"));

  it("does not flag the frozen sheet, which is excluded", () => {
    const findings = audit(root);
    expect(findings.filter((f) => f.includes("apps/demo"))).toEqual([]);
  });

  it("does not flag its own documentation", () => {
    // Every rule here is explained in prose inside the files it governs. An
    // audit that reads comments flags its own documentation and gets switched
    // off, so comments are stripped before scanning — and that has to stay
    // true, because the primitives are heavily commented.
    mkdirSync(join(root, "packages/ui/src/motion"), { recursive: true });
    const prose = ["/*", " * Never use ease" + "-in: it stalls the first frame.", " */", "export const ok = 1;"].join("\n");
    writeFileSync(join(root, "packages/ui/src/prose.ts"), prose);
    expect(audit(root).filter((f) => f.includes("prose.ts"))).toEqual([]);
  });
});

describe("the vocabulary is closed", () => {
  it("exports exactly twenty-seven primitives", () => {
    // [2026-09-19, DEV-027] Twenty-four became twenty-seven — `CellField`,
    // `ArcField` and `ParticleSphere`: the reference's pointer-reactive grounds
    // and its particle dome, which DEV-026 missed by reading still screenshots.
    // [2026-09-19, DEV-026] Twenty-two became twenty-four — `PixelRain` and
    // `OrbitText`, the two first-screen words the landing reference needed.
    // The what and why are in `motion/index.ts`'s header and each file's own.
    // A twenty-second is a decision, not an addition: it means the vocabulary
    // was missing something, and the plan's motion section has to say what
    // and why. Failing here is the prompt to write that down.
    const index = readFileSync(join(repoRoot, "packages/ui/src/motion/index.ts"), "utf8");
    // `[A-Z][a-z]` and not `[A-Z]\w`: the same file re-exports the token
    // bridge (DURATION, EASE, …), and SCREAMING_CASE is how a value is told
    // apart from a component here.
    const exported = [...index.matchAll(/^export \{ ([A-Z][a-z]\w*)/gm)].map((m) => m[1]);
    expect(new Set(exported)).toEqual(new Set([
      "Reveal", "Stagger", "TextBlurIn", "ScrollTint", "LineDraw", "NodeLock",
      "CountUp", "Marquee", "PinnedTabs", "Lift", "Press", "CrossFade",
      "TrackFill", "SlideSwap", "InViewProgress", "ScrollSettle", "LineReveal",
      "Depth", "Tilt", "Magnetic", "ScrollStack", "ScrollProgress",
      "PixelRain", "OrbitText",
      "CellField", "ArcField", "ParticleSphere",
    ]));
  });

  it("keeps every frame loop inside the vocabulary, on one shared loop (DEV-027)", () => {
    // `motion-audit.mjs` reads CSS and imports; a canvas is invisible to it. So
    // the rule that a canvas word is cancelled off screen, rests when it has
    // nothing to draw and stops under reduced motion holds only because there
    // is ONE loop (`canvas-loop.ts`) and nothing else asks for frames.
    const users: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "qa" || entry.name === "qa-output") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name) && /requestAnimationFrame\(/.test(readFileSync(full, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))) users.push(relative(repoRoot, full));
      }
    };
    walk(join(repoRoot, "packages/ui/src"));
    walk(join(repoRoot, "apps/landing/app"));
    walk(join(repoRoot, "apps/landing/components"));
    expect(users).toEqual(["packages/ui/src/motion/canvas-loop.ts"]);
    // …and three.js is imported by the scene module alone, which `ParticleSphere` imports dynamically.
    const three: string[] = [];
    const scan = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== "node_modules" && entry.name !== ".next") scan(full); }
        else if (/\.(ts|tsx)$/.test(entry.name) && /from\s+["']three["']/.test(readFileSync(full, "utf8"))) three.push(relative(repoRoot, full));
      }
    };
    scan(join(repoRoot, "packages/ui/src"));
    scan(join(repoRoot, "apps/landing/app"));
    scan(join(repoRoot, "apps/landing/components"));
    expect(three).toEqual(["packages/ui/src/motion/particle-sphere-scene.ts"]);
    const sphere = readFileSync(join(repoRoot, "packages/ui/src/motion/ParticleSphere.tsx"), "utf8");
    expect(sphere).toMatch(/import\("\.\/particle-sphere-scene"\)/);
    expect(sphere).not.toMatch(/^import .*particle-sphere-scene/m);
  });

  it("allows only cheap properties to transition", () => {
    expect(ANIMATABLE).toContain("transform");
    expect(ANIMATABLE).toContain("opacity");
    for (const layout of ["width", "height", "top", "left", "margin", "padding"]) {
      expect(ANIMATABLE, `${layout} must not be animatable`).not.toContain(layout);
    }
  });

  it("names exactly the seven perpetual loops", () => {
    // [2026-09-19, DEV-026] Five became seven: `gp-orbit` (the hero's arc text)
    // and `gp-breathe` (the closing mark). Owner decision, recorded in DESIGN.md.
    // Spec 2026-09-06 §5.1: the marquee and the landing's four ambient loops.
    // A sixth is a §7.3 decision, so the list is pinned by value.
    expect((PERPETUAL_ALLOWLIST as RegExp[]).map(String)).toEqual([
      "/gp-marquee/", "/marquee-track/", "/gp-beam/", "/gp-pulse/", "/gp-drift/", "/gp-flow/",
      "/gp-orbit/", "/gp-breathe/",
    ]);
  });
});
