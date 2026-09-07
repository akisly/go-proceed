import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const base = readFileSync(join(repoRoot, "packages/ui/src/base.css"), "utf8");
const lineReveal = readFileSync(join(repoRoot, "packages/ui/src/motion/LineReveal.tsx"), "utf8");

/**
 * Below `md` there is no entrance at all.
 *
 * Not a performance hack bolted on — it is the same argument §4.3 rule 9
 * already makes for scroll-linked compositions ("none below `md`"), extended
 * to the one thing that still made a phone wait: the first viewport could not
 * paint until the bundle had hydrated.
 *
 * The measurement that forced it. Moving the fold's copy onto the CSS
 * `entrance` dropped its render delay from 1283 ms to 238 ms, and mobile LCP
 * did not move at all — Lighthouse simply renamed the LCP element to the `h1`,
 * because `LineReveal` groups words into lines by measuring layout and
 * therefore ships `opacity: 0` until JavaScript runs. On a phone the entrance
 * was buying nothing and costing the metric outright.
 *
 * Two halves, and both are needed. CSS turns the animation off for markup the
 * server has already sent; the component stops applying line masks, so nothing
 * re-hides the headline after hydration.
 */
describe("the phone gets no entrance animation", () => {
  const belowMd = base.slice(base.indexOf("/* No entrance below `md`"));

  it("turns the CSS entrance off under the md breakpoint", () => {
    expect(belowMd).toMatch(/@media[^{]*width\s*<\s*48rem/);
    expect(belowMd).toContain("animation: none");
  });

  it("un-hides the headline the server sent at opacity 0", () => {
    // The hidden state is an inline style Motion wrote during SSR, so only
    // `!important` can reach it. Without this the h1 stays invisible on a
    // phone until hydration — which is the whole defect.
    expect(belowMd).toContain("[data-line-reveal]");
    expect(belowMd).toMatch(/opacity:\s*1\s*!important/);
  });

  it("stops the component applying line masks below md", () => {
    // If the masks still arrived after hydration the headline would be
    // visible, then drop behind them and rise — the «two animations» defect,
    // now on the one device that can least afford it.
    expect(lineReveal).toContain("useBelowBreakpoint");
    expect(lineReveal).toContain("data-line-reveal");
  });
});
