import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Hero } from "../components/blocks/hero";
import { landingContent } from "../content/landing-content";

/**
 * The first viewport must be painted, not pending.
 *
 * The lead paragraph is the Largest Contentful Paint element, and it used to
 * be wrapped in `<Reveal delay={0.15}>`, which server-renders `opacity: 0` and
 * only animates once React has hydrated and the reduced-motion preference has
 * resolved. Measured on the built page (Lighthouse 13.4.1, mobile profile,
 * 2026-09-07): time to first byte 20 ms, element render delay **1283 ms**,
 * LCP 3.9 s against a 2.5 s threshold. The text was in the HTML from the first
 * byte; the page's own choreography was hiding it.
 *
 * The headline above it was never affected — `LineReveal` server-renders the
 * flat words with no masks, so the h1 has always painted at first paint and
 * only acquires its line masks after measurement. Moving the rest of the fold
 * onto a CSS entrance brings it into step with the headline rather than out of
 * it: nothing in the fold now waits for hydration.
 */
const markup = renderToStaticMarkup(<Hero />);

/**
 * The markup as a reader sees it: tags dropped, entities decoded. [R2-14] The
 * decode is not decoration — React escapes `&`, `<`, `>`, `"` and `'` in text,
 * and the product's own copy is full of `об'єкт`, so a title with an apostrophe
 * would fail three assertions against a page that is correct.
 */
const text = (html: string): string => html
  .replace(/<[^>]+>/g, "")
  .replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/**
 * The text fold: pill, headline, lead, actions (and, until DEV-022, facts) — everything above the
 * product frame. The frame itself keeps its JS entrance on purpose. It is not
 * an LCP candidate, it is the composition `ScrollSettle`, `Depth` and `Tilt`
 * all attach to, and its 0.35s arrival is the prototype's own timing; moving
 * it would buy no metric and risk a composition three primitives deep.
 */
// [DEV-023] The whole hero is the fold now: the product frame that used to
// follow the text (`mt-11`) moved to /product, and the first screen is text
// over two decorative grounds.
const foldText = markup;

/**
 * [DEV-023] HISTORY — the h1 WAS excluded until the first screen took the
 * reference's form; it is plain text now and the rule below covers it too.
 * `withoutHeadline` is kept only so the older assertion still reads as written.
 * What the exemption was for:
 *
 * `LineReveal` groups words into lines by measuring layout, so its masks
 * cannot exist before JavaScript runs, and it therefore ships its
 * pre-hydration branch at `opacity: 0`. Letting the flat words paint first
 * instead would restore a defect this repo already fixed once: the reader sees
 * the whole headline complete, then it drops behind the masks and rises — «two
 * animations» (LineReveal.tsx, 2026-09-06). Buying LCP with that trade is not
 * worth it, and the headline is not what Lighthouse names as the LCP element.
 */
const withoutHeadline = foldText.replace(/<h1[\s\S]*?<\/h1>/, "");

describe("the hero fold paints on the first frame", () => {
  it("sends no text of the fold at opacity 0 — the headline included, since DEV-023", () => {
    // Motion writes its `initial` into a style attribute during SSR. Any
    // `opacity:0` here is an element the reader cannot see until JavaScript
    // has arrived, run, and resolved a media query.
    expect(withoutHeadline).not.toMatch(/opacity:\s*0(?![.\d])/);
    // [DEV-023, R-10] The h1 is plain text now — `hero.tsx` promises it paints on
    // the first frame — so the headline is no longer an exception to the rule.
    expect(markup).not.toMatch(/opacity:\s*0(?![.\d])/);
    // [2026-09-22] The rule was `/<h1[^>]*>[^<]+<\/h1>/` — no element inside the
    // heading at all — until it took its accent word back and now holds one
    // `<span class="text-accent">`. A substring ban is NOT an equivalent guard,
    // and the first attempt at one proved it: it forbade `data-reveal`, which
    // exists nowhere in this repository, and let `.entrance` — the system's own
    // class-driven entrance, the wrapper every other element in this fold uses —
    // straight through (found in review, R2-01). So the tag list is asserted
    // instead: an h1 and one span, and nothing else may appear inside it.
    const h1 = markup.match(/<h1[\s\S]*?<\/h1>/)![0];
    expect(h1.match(/<[a-z][a-z0-9]*/g)).toEqual(["<h1", "<span"]);
    expect(h1).not.toMatch(/opacity|entrance|data-line-reveal/);
    expect(text(h1)).toBe(landingContent.hero.title);
    expect(withoutHeadline).toContain(landingContent.hero.secondaryAction);
  });

  it("carries the lead — the LCP element — with a CSS entrance rather than a JS one", () => {
    const lead = landingContent.hero.lead.slice(0, 40);
    const at = markup.indexOf(lead);
    expect(at).toBeGreaterThan(-1);
    // The wrapper immediately before the paragraph is the entrance.
    expect(markup.slice(Math.max(0, at - 400), at)).toContain("entrance");
  });

  it("still states the whole fold, so nothing was dropped to win the metric", () => {
    const h = landingContent.hero;
    // [DEV-023] The reference's first screen has no announcement pill; the free
    // pilot is said by the fact band and the closing block of the same page.
    // The title is compared with the markup's tags stripped [2026-09-22]: one
    // word of it is wrapped in the accent, so the raw string no longer appears
    // verbatim — while the sentence the reader sees is character for character
    // the one in the content file, which is what this assertion is about.
    expect(text(markup)).toContain(h.title);
    expect(markup).toContain(h.primaryAction);
    expect(markup).toContain(h.secondaryAction);
    expect(markup).toContain(h.lead);
  });
});

describe("the entrance is a real primitive, not a one-off", () => {
  const base = readFileSync(
    join(import.meta.dirname, "..", "..", "..", "packages/ui/src/base.css"),
    "utf8",
  );

  it("is declared as a utility so Tailwind emits it", () => {
    expect(base).toMatch(/@utility entrance\b/);
  });

  it("gives reduced motion a DIFFERENT animation, never the same one made fast", () => {
    // §4.3 rule 8. The global reduced block snaps every animation to 0.01ms,
    // which would technically stop the movement but is "the same animation,
    // faster" — the exact thing the rule forbids. The entrance names its own
    // opacity-only keyframes instead, matching what `Reveal` does in JS.
    const reduced = base.slice(base.indexOf("prefers-reduced-motion"));
    expect(reduced).toContain("gp-entrance-fade");
    expect(base).toMatch(/@keyframes gp-entrance-fade\s*\{[^}]*opacity/);
    // …and that fade must not carry a transform, or it is not a fade.
    const fade = /@keyframes gp-entrance-fade\s*\{([\s\S]*?)\n\s*\}/.exec(base)?.[1] ?? "";
    expect(fade).not.toContain("translate");
  });
});
