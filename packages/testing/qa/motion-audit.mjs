/**
 * Static motion audit.
 *
 * WHY IT LIVES HERE AND NOT IN apps/demo/qa
 * -----------------------------------------
 * `apps/demo/qa/*` audits apps/demo. Motion is a property of the design
 * system, so it has to be checked across `packages/ui` and every app that
 * consumes it, and an audit that lives inside one app is an audit that quietly
 * stops covering the others.
 *
 * WHAT IT ENFORCES, AND WHY EACH RULE IS A BUILD FAILURE RATHER THAN A REVIEW NOTE
 * -------------------------------------------------------------------------------
 * 1. **No `transition: all`.** It animates properties nobody chose — including
 *    ones that force layout — and it is invisible in review because it looks
 *    like less code, not more behaviour.
 * 2. **Only cheap properties transition.** `transform`, `opacity`, `filter`,
 *    `color`, `background-color`, `border-color`, `outline-color`, `box-shadow`
 *    and `fill`/`stroke`. A transition on `width`, `height`, `top` or `margin`
 *    is a layout animation, and a layout animation in a register is dropped
 *    frames on the machine of someone reading 14 rows on site.
 * 3. **No ease-in.** Ease-in stalls the first frame, which is the frame being
 *    watched. The system has five easings and all of them are ease-out or
 *    symmetric.
 * 4. **No perpetual animation outside the five named loops (marquee, beam,
 *    pulse, drift, flow).** One ambient animation per product was the
 *    2026-08-19 decision; the 2026-09-06 parity spec names four more, and
 *    names them so a sixth cannot arrive unnoticed.
 * 5. **Motion for React is imported only by the twenty-two primitives.** Every rule
 *    above, plus reveal-fires-once and reduced-motion-is-a-different-animation,
 *    holds because it lives inside those files. A hand-written `motion.div` in
 *    a block is a rule that has to be remembered instead of one that holds.
 *
 * Run: `node packages/testing/qa/motion-audit.mjs`
 * Asserted by: `packages/testing/src/motion-audit.test.ts`
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const ANIMATABLE = [
  "transform", "translate", "scale", "rotate", "opacity", "filter",
  "color", "background-color", "border-color", "outline-color", "box-shadow",
  "fill", "stroke", "stroke-dashoffset", "backdrop-filter",
];

/**
 * The one layout property allowed to transition, and it is allowed by name so
 * the exception is visible rather than slipping through a gap in a regex.
 *
 * `grid-template-rows: 0fr -> 1fr` is how a disclosure opens without measuring
 * anything. The alternative — transitioning `height` — needs the panel's
 * measured height in a custom property, which means reading layout on every
 * open, which is the jank rule 2 exists to prevent. This still costs layout per
 * frame; it costs strictly less than the thing it replaces, and it is used by
 * exactly one component.
 */
export const LAYOUT_EXCEPTIONS = ["grid-template-rows"];

/** Roots every rule applies to. */
export const ROOTS = ["packages/ui/src", "apps/landing", "apps/app"];

/**
 * Listed rather than skipped silently, so debt is visible and exclusions
 * cannot outlive their files.
 */
export const EXCLUDED = [];

/** The one file allowed to import Motion for React. Anything else is a block
 * or a screen reaching past the vocabulary. */
const MOTION_HOME = "packages/ui/src/motion";

/**
 * The five perpetual animations, by keyframe name. Until 2026-09-06 this held
 * the marquee alone; the landing parity slice (spec 2026-09-06 §5.1) adds the
 * prototype's four ambient loops — the Border Beam, the review-dot pulse, the
 * receipt/pill drift and the dashed «flow» lines. A sixth is a decision
 * (02-building-ui §7.3), which is why the list is exported and pinned by a test.
 */
// [2026-09-19, DEV-025] `gp-orbit` and `gp-breathe`: the landing reference's arc text and
// closing mark (owner: «1 в 1»). `DESIGN.md` «Don't» and `02-building-ui.md` rule 5 name them.
export const PERPETUAL_ALLOWLIST = [/gp-marquee/, /marquee-track/, /gp-beam/, /gp-pulse/, /gp-drift/, /gp-flow/, /gp-orbit/, /gp-breathe/];

const EXT = [".ts", ".tsx", ".js", ".jsx", ".css", ".mjs"];

/**
 * Comments are stripped before scanning, and that is not an optimisation.
 * This system documents its motion rules IN the files the rules govern — the
 * base layer explains why ease-in is banned, the primitives explain why a
 * reveal fires once. An audit that reads prose flags its own documentation and
 * gets switched off. Blank lines replace the stripped text so reported line
 * numbers still point at the real line.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length));
}

/** `"opacity !important"` -> `"opacity"`. A declaration's importance is not
 * part of the property name, and comparing it as if it were flags the one
 * rule in the system that has to carry `!important` — the unlayered
 * reduced-motion block, which only beats the frozen sheet because it does. */
function propertyName(raw) {
  return raw.replace(/!\s*important/gi, "").trim();
}

function* walk(path) {
  let st;
  try { st = statSync(path); } catch { return; }
  if (st.isFile()) { yield path; return; }
  for (const entry of readdirSync(path)) {
    if (["node_modules", "dist", ".next", ".turbo", "qa-output"].includes(entry)) continue;
    yield* walk(join(path, entry));
  }
}

export function auditMotion(repoRoot) {
  const findings = [];
  for (const root of ROOTS) {
    for (const file of walk(join(repoRoot, root))) {
      if (!EXT.some((e) => file.endsWith(e))) continue;
      const rel = relative(repoRoot, file);
      if (EXCLUDED.includes(rel)) continue;
      const text = stripComments(readFileSync(file, "utf8"));
      const at = (index) => `${rel}:${text.slice(0, index).split("\n").length}`;

      // 1 — transition: all, in CSS and in a Tailwind class alike
      for (const m of text.matchAll(/transition(?:-property)?\s*:\s*all\b/g)) {
        findings.push(`${at(m.index)}: \`transition: all\` — name the properties`);
      }
      for (const m of text.matchAll(/(?<![\w-])transition-all(?![\w-])/g)) {
        findings.push(`${at(m.index)}: \`transition-all\` — use transition-colors, transition-transform or transition-opacity`);
      }

      // 2 — only cheap properties
      for (const m of text.matchAll(/transition-property\s*:\s*([^;}]+)/g)) {
        for (const prop of m[1].split(",").map(propertyName)) {
          if (prop && prop !== "none" && !ANIMATABLE.includes(prop)) {
            findings.push(`${at(m.index)}: transition on \`${prop}\` — layout property, not animatable in this system`);
          }
        }
      }

      // 2b — the same rule, for Tailwind's arbitrary-transition utility.
      // `transition-[grid-template-rows]` is not a CSS declaration, so the
      // check above cannot see it. Without this branch rule 2 had a hole wide
      // enough to drive an accordion through.
      for (const m of text.matchAll(/(?<![\w-])transition-\[([^\]]+)\]/g)) {
        for (const prop of m[1].split(",").map(propertyName)) {
          if (!ANIMATABLE.includes(prop) && !LAYOUT_EXCEPTIONS.includes(prop)) {
            findings.push(`${at(m.index)}: transition-[${prop}] — layout property, and not one of the named exceptions`);
          }
        }
      }

      // 3 — no ease-in
      for (const m of text.matchAll(/transition-timing-function\s*:\s*(ease-in\b|ease-in-out\b)/g)) {
        findings.push(`${at(m.index)}: \`${m[1]}\` — ease-out only; ease-in stalls the first frame`);
      }
      for (const m of text.matchAll(/(?<![\w-])ease-in(?:-out)?(?![\w-])/g)) {
        findings.push(`${at(m.index)}: \`${m[0]}\` utility — the system's easings are ease.out/enter/emphatic/soft/overshoot`);
      }

      // 4 — perpetual animation
      for (const m of text.matchAll(/animation(?:-iteration-count)?\s*:[^;}]*\binfinite\b[^;}]*/g)) {
        if (!PERPETUAL_ALLOWLIST.some((re) => re.test(m[0]))) {
          findings.push(`${at(m.index)}: perpetual animation outside the named loops — \`${m[0].trim().slice(0, 60)}\``);
        }
      }

      // 5 — Motion for React stays inside the vocabulary
      if (!rel.startsWith(MOTION_HOME)) {
        for (const m of text.matchAll(/from\s+["'](motion\/react|framer-motion)["']/g)) {
          findings.push(`${at(m.index)}: imports \`${m[1]}\` directly — use a primitive from @goproceed/ui/motion`);
        }
      }
    }
  }
  return findings;
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const findings = auditMotion(repoRoot);
  if (findings.length) {
    console.error(`motion-audit: ${findings.length} finding(s)\n`);
    for (const f of findings) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log("motion-audit: clean");
}
