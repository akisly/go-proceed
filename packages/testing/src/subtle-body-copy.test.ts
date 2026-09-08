import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * `text-ink-subtle` is a LARGE-TEXT role, and the pairing table says so.
 *
 * `contrast.test.ts` asserts it at 3.0 against the canvas and labels that row
 * "metadata on the canvas (large/non-body only)". WCAG grants the 3.0 floor
 * only from 24px (or 18.66px bold); below that the requirement is 4.5. So the
 * role is only ever legitimate on display-sized text.
 *
 * Nothing checked the second half of that sentence. `#7A7E87` shipped at 11px
 * and 12px in seven places — section index rules, chat-log authors and
 * timestamps, the product-frame label, the form's fine print and the footer
 * disclaimer — measuring 3.50–4.07:1 on the three grounds it actually renders
 * on. The pairing suite stayed green throughout, because it pins which colours
 * may meet and says nothing about the size at which they meet, and because its
 * coverage check ("every foreground against at least one ground") is satisfied
 * by a single row per foreground.
 *
 * This is that missing half: the role may not appear in a class list that also
 * names a small type step. It is a source scan because size and colour are
 * chosen in the same string, and that string is the only place both are known.
 *
 * `docs/design/02-building-ui.md` §4.1, row «text-ink-subtle for body copy →
 * text-ink-muted».
 */
const repoRoot = join(import.meta.dirname, "..", "..", "..");

const SUBTLE = "text-ink-subtle";

/**
 * Every type step below the WCAG large-text threshold. `index-label` is a
 * utility rather than a `text-*` class but sets `--gp-size-mkt-index`, so it
 * belongs here by size even though it does not look like a size class.
 */
const SMALL_TYPE = ["text-micro", "text-meta", "text-data", "text-body", "index-label"];

const ROOTS = ["apps/app", "apps/landing", "packages/ui/src"];
const EXTENSIONS = [".ts", ".tsx"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

/**
 * Comments are stripped before scanning. A rule documented inside the file it
 * governs is the classic way one of these audits flags its own prose —
 * `Input.tsx` explains in a comment why it does NOT use this role, and that
 * sentence must not read as a violation.
 */
function classStrings(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...code.matchAll(/"([^"\n]*)"|'([^'\n]*)'/g)].map((m) => m[1] ?? m[2] ?? "");
}

describe("text-ink-subtle is never body copy", () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(join(repoRoot, root))) {
      for (const candidate of classStrings(readFileSync(file, "utf8"))) {
        if (!candidate.includes(SUBTLE)) continue;
        const small = SMALL_TYPE.filter((step) => new RegExp(`(^|[\\s:])${step}(\\s|$)`).test(candidate));
        if (small.length > 0) {
          offenders.push(`${relative(repoRoot, file)} — "${candidate}" carries ${small.join(", ")}`);
        }
      }
    }
  }

  it("does not pair the role with a type step below the large-text threshold", () => {
    expect(offenders).toEqual([]);
  });
});
