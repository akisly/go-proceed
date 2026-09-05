import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * `apps/app` has ONE Tailwind entry point and it is `@goproceed/ui/base.css`.
 *
 * Until 2026-09-05 it had two. `app/globals.css` was a 391-line hand-rolled
 * `@theme` from before `packages/tokens` existed (Evidence Atlas hex, Inter,
 * its own scale) and loaded on every route; `app/dash/dash-theme.css` imported
 * the real system for `/dash/**` only, and pinned `--font-display` back
 * because the legacy sheet read it on every heading. Two `@theme` blocks in
 * one document, two Buttons, two `cn` helpers — and a visual pass that could
 * never cover the field client, because its names were not the system's.
 *
 * This test is what stops it happening again: one `.css` under `app/`, it
 * imports the shared base, and no retired name survives anywhere in the app.
 * Spec: docs/superpowers/specs/2026-09-05-app-daylight-migration-design.md §6.1.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");
const appRoot = join(repoRoot, "apps/app");

/** Names the legacy `@theme` defined and the roles replaced (spec §4.1). Regular
 * expressions, because `bg-accent` must not catch the system's own `bg-accent-soft`. */
const RETIRED: RegExp[] = [
  /\btext-foreground\b/, /\bbg-surface-muted\b/, /\bbg-surface-sunken\b/, /\bborder-border\b/,
  /\btext-destructive\b/, /-warning-/, /\bbg-carbon\b/, /\bbg-accent\b(?!-soft)/, /\btext-accent-ink\b/,
  /readiness-/, /\bfont-display\b/, /goproceed-app/, /\bease-out-strong\b/,
  /\bshadow-drawer\b/, /\banimate-chip-in\b/,
];

/** Packages the legacy Button/cn pulled in; the shared package owns them now. */
const RETIRED_IMPORTS = [
  "@fontsource-variable/inter", "class-variance-authority", "tailwind-merge", "clsx",
];

const EXTENSIONS = [".ts", ".tsx", ".css"];

function* walk(path: string): Generator<string, void, unknown> {
  let st;
  try { st = statSync(path); } catch { return; }
  if (st.isFile()) { yield path; return; }
  for (const entry of readdirSync(path)) {
    if (entry === "node_modules" || entry === ".next" || entry === "qa-output" || entry === "qa-output-before") continue;
    yield* walk(join(path, entry));
  }
}

const sources = () =>
  [...walk(join(appRoot, "app")), ...walk(join(appRoot, "src"))]
    .filter((f) => EXTENSIONS.some((e) => f.endsWith(e)));

describe("apps/app has one stylesheet, and it is the system's", () => {
  it("exactly one .css file under app/, and it imports @goproceed/ui/base.css", () => {
    const css = [...walk(join(appRoot, "app"))].filter((f) => f.endsWith(".css"));
    expect(css.map((f) => relative(repoRoot, f))).toEqual(["apps/app/app/globals.css"]);
    expect(readFileSync(css[0]!, "utf8")).toContain('@import "@goproceed/ui/base.css";');
  });

  it("no retired token name survives under app/ or src/", () => {
    const findings: string[] = [];
    for (const file of sources()) {
      const text = readFileSync(file, "utf8");
      for (const name of RETIRED) {
        if (name.test(text)) findings.push(`${relative(repoRoot, file)}: ${name.source}`);
      }
    }
    expect(findings).toEqual([]);
  });

  it("no file imports a package the shared Button/cn made redundant", () => {
    const findings: string[] = [];
    for (const file of sources()) {
      const text = readFileSync(file, "utf8");
      for (const pkg of RETIRED_IMPORTS) {
        if (new RegExp(`from ["']${pkg}["']|import ["']${pkg}["']`).test(text)) {
          findings.push(`${relative(repoRoot, file)}: ${pkg}`);
        }
      }
    }
    expect(findings).toEqual([]);
  });

  it("the retired list does not catch the system's own accent-soft role", () => {
    const hit = (s: string) => RETIRED.some((r) => r.test(s));
    expect(hit("bg-accent-soft")).toBe(false);
    expect(hit("bg-accent")).toBe(true);
    expect(hit("hover:bg-accent-hover")).toBe(true);
    expect(hit("text-foreground-secondary")).toBe(true);
    expect(hit("font-display")).toBe(true);
  });
});
