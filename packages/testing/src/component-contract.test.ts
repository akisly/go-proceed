import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Rulings this repository has already paid for, asserted against the component
 * sources rather than left in a document. Each `it` below is a decision that
 * cost a round somewhere.
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");
const dir = join(repoRoot, "packages/ui/src/components");
const files = readdirSync(dir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
const read = (f: string) => readFileSync(join(dir, f), "utf8");

/**
 * Comments stripped, blank space kept so line numbers survive.
 *
 * Every ruling asserted below is also DOCUMENTED in the file it governs —
 * Button.tsx explains why there is no destructive variant, Skeleton.tsx
 * explains why it does not shimmer. A test that greps the raw source fails on
 * its own documentation, which is the same defect the motion audit had before
 * it started stripping comments.
 */
const code = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length));

const index = read("index.ts");

describe("the inventory is closed and complete", () => {
  it("exports every component file, so none is orphaned", () => {
    const orphans = files
      .filter((f) => f !== "index.ts" && f !== "cn.ts")
      .filter((f) => !index.includes(`"./${f.replace(/\.tsx?$/, "")}"`));
    expect(orphans).toEqual([]);
  });

  /**
   * THE THIRD OBLIGATION, FINALLY GATED.
   *
   * `docs/design/02-building-ui.md` §7.2 asks three things of a component: the
   * file, the `index.ts` export, and a rendering in `/kitchen-sink/components`
   * «beside the rule it carries». The two tests above gate the first two. The
   * third was gated by NOTHING until this test, and §7.2 said otherwise in
   * writing until 2026-08-29 — so every reader was told a check existed that
   * did not.
   *
   * WHAT IT COST, measured rather than imagined: slice A shipped
   * `FieldSeparator` with `bg-canvas` where §4.1's substitution table maps
   * shadcn's `bg-background` to `bg-surface`. `cx` is `extendTailwindMerge`
   * with the taught config, so the class was live — a paper-toned band across
   * a white panel — and it survived review because no sink rendered it and no
   * test looked.
   *
   * THE UNIT IS THE MODULE, NOT THE EXPORTED NAME. A sink entry that renders
   * `Dialog` necessarily exercises `DialogContent`, `DialogTitle` and the rest
   * of its family; demanding every name appear by itself would fail on
   * `SelectScrollDownButton` and teach people to paste names rather than
   * render components. One name per module is the honest floor: it proves the
   * component is on a page a human and the QA harness can both look at.
   */
  it("renders every component module in the kitchen sink", () => {
    const sink = readFileSync(
      join(repoRoot, "apps/landing/app/kitchen-sink/components/page.tsx"), "utf8");

    const perModule = [...index.matchAll(/export\s*\{([^}]*)\}\s*from\s*"\.\/([\w-]+)"/g)]
      .filter((m) => m[2] !== "cn")
      .map((m) => ({
        module: m[2]!,
        names: m[1]!.split(",")
          .map((n) => n.trim().split(/\s+as\s+/).pop()!.trim())
          .filter((n) => n.length > 0 && !n.startsWith("type ") && /^[A-Z]/.test(n)),
      }))
      .filter((m) => m.names.length > 0);

    const unrendered = perModule
      .filter((m) => !m.names.some((n) => new RegExp(`\\b${n}\\b`).test(sink)))
      .map((m) => m.module);

    expect(unrendered).toEqual([]);
  });

  it("exports nothing that has no file", () => {
    const referenced = [...index.matchAll(/from "\.\/([\w-]+)"/g)].map((m) => m[1]);
    const missing = referenced.filter(
      (name) => !files.includes(`${name}.tsx`) && !files.includes(`${name}.ts`));
    expect(missing).toEqual([]);
  });
});

describe("control size comes from tokens, never from a literal", () => {
  it("no component hard-codes a control height", () => {
    // WCAG 2.5.5's 44px is a floor, not a preference, and this audience is
    // gloved and outdoors. A literal `h-11` compiles to the same pixels today
    // and stops tracking the token the moment the token moves.
    const findings: string[] = [];
    for (const f of files) {
      for (const m of code(f).matchAll(/(?<![\w-])(?:h|size)-(?:9|11|8|10|12|\[\d+px\])(?![\w-])/g)) {
        findings.push(`${f}: ${m[0]} — use h-(--gp-control-height-*)`);
      }
    }
    expect(findings).toEqual([]);
  });

  it("every interactive control offers the touch floor", () => {
    for (const f of ["Button.tsx", "Input.tsx"]) {
      expect(code(f), `${f} does not reach the touch floor`)
        .toContain("touch:h-(--gp-control-height-touch)");
    }
  });
});

describe("colour cannot escape the token layer", () => {
  it("no inline style carries a colour", () => {
    // An inline style is the one route into the DOM that neither the Tailwind
    // namespace nor colour-audit.mjs's arbitrary-value scan can see. Layout
    // numbers computed at runtime (Meter's flexGrow) are fine; colour is not.
    const findings: string[] = [];
    for (const f of files) {
      for (const m of code(f).matchAll(/style=\{\{([^}]*)\}\}/g)) {
        if (/colou?r|background|border|fill|stroke|shadow/i.test(m[1]!)) {
          findings.push(`${f}: inline style carries colour — ${m[1]!.trim().slice(0, 40)}`);
        }
      }
    }
    expect(findings).toEqual([]);
  });

  it("no component names a raw hex, rgb or oklch", () => {
    const findings: string[] = [];
    for (const f of files) {
      for (const m of code(f).matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(|oklch\(|hsla?\(/g)) {
        findings.push(`${f}: ${m[0]}`);
      }
    }
    expect(findings).toEqual([]);
  });
});

describe("rulings that a variant would quietly undo", () => {
  it("Button has no destructive variant", () => {
    // Nothing under /app/** deletes anything, so a destructive variant could
    // only ever be used by being reached for wrongly — and a variant that
    // exists is a variant that will be used.
    expect(code("Button.tsx")).not.toMatch(/destructive/i);
  });

  it("Button defines no focus ring of its own", () => {
    // base.css gives every focusable element in the product one treatment, so
    // two of them cannot disagree.
    expect(code("Button.tsx")).not.toMatch(/focus:ring|focus-visible:ring|outline-/);
  });

  it("the five status tones agree across every component that shows state", () => {
    // A blocked chip and a blocked banner on one screen must be the same
    // colour, or one of them is lying.
    const tones = (f: string) =>
      new Set([...code(f).matchAll(/^\s{2}(\w+):\s"bg-/gm)].map((m) => m[1]));
    const catalog = new Set(["ready", "attention", "blocked", "review", "idle"]);
    expect(tones("Banner.tsx")).toEqual(catalog);
    expect(tones("Meter.tsx")).toEqual(catalog);
    // Chip adds `neutral`, which is the eyebrow pill and explicitly not a status.
    expect(tones("Chip.tsx")).toEqual(new Set([...catalog, "neutral"]));
  });

  it("the meter divides the track by count, never by percentage", () => {
    // With percentages the parts can fail to equal the whole; with flex-grow
    // they always consume exactly the track.
    expect(code("Meter.tsx")).toContain("flexGrow");
    expect(code("Meter.tsx")).not.toMatch(/width:\s*`?\$\{|%`/);
  });

  it("the money figure requires its qualifier", () => {
    // src/domain/risk.ts sets a wording rule for every surface consuming this
    // number: it is money whose evidence is currently missing, not money that
    // will certainly go unpaid. An optional qualifier is one a caller omits.
    expect(code("Figure.tsx")).toMatch(/qualifier:\s*string;/);
    expect(code("Figure.tsx")).not.toMatch(/qualifier\?:/);
  });

  it("portalled content carries its own font", () => {
    // Radix portals render at the document root and get none of the shell's
    // base layer — no font, no reduced-motion block, no focus ring.
    expect(code("Tooltip.tsx")).toContain("font-sans");
    expect(code("Tooltip.tsx")).toContain("motion-reduce:");
  });

  it("the table is a real table with fixed columns", () => {
    // Changing `display` on table elements strips their implicit ARIA roles;
    // per-row grids were v1's "fourteen grids" defect.
    expect(code("Table.tsx")).toContain("table-fixed");
    expect(code("Table.tsx")).toContain("tabular text-right");
  });

  it("the skeleton does not shimmer", () => {
    // Every shimmer is a perpetual animation, and the system permits exactly
    // one — the marquee.
    expect(code("Skeleton.tsx")).not.toMatch(/animate-|pulse|shimmer/);
  });
});
