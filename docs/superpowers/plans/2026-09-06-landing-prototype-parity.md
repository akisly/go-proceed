# Landing Prototype Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/landing` perform every animation and interaction the approved prototype `design-references/contest-2026-09/daylight/index.html` performs (except Lenis), inside the motion vocabulary and the token system.

**Architecture:** Six new words join `packages/ui/src/motion` (`LineReveal`, `Depth`, `Tilt`, `Magnetic`, `ScrollStack` family, `ScrollProgress`), four changed ones (`ScrollTint`, `Reveal`, `Stagger`/`StaggerItem`) and four CSS loops in `base.css` (beam, pulse, drift, flow); the landing blocks only compose them. Two duration tokens, two springs and one shadow arrive in `tokens.json`; the rules that forbade this choreography are amended by dated corrections. Every new word renders ONE DOM shape on the server and the client (the `ScrollSettle` lesson) and switches its MotionValues off — never its tree — below `md`/`wide`, on coarse pointers and under reduced motion.

**Tech Stack:** Next 16.3.1, React 19.2.8, Tailwind 4.3.3, `motion` 12.43 (imported as `motion/react`, only inside `packages/ui/src/motion`), vitest 3.2 (node + `// @vitest-environment jsdom` per file, `@testing-library/react`), puppeteer 25.8 (`apps/landing/qa/landing.mjs`).

**Spec:** `docs/superpowers/specs/2026-09-06-landing-prototype-parity-design.md` — the block table (§3), the word definitions (§4), the CSS/tokens (§5), the timing map (§6), the document amendments (§8) and the tests (§9). Read it first; every value below comes from it and the prototype lines it cites.

## Global Constraints

- Work in the worktree `/Users/akisliy/Downloads/GoProceed/.claude/worktrees/landing-parity`, branch `claude/landing-prototype-parity` (base `origin/main` = `db7ba8c`). Run every command from that directory. Never `cd` to the main checkout.
- `motion/react` is imported ONLY under `packages/ui/src/motion/`. A block imports words from `@goproceed/ui/motion`. `node packages/testing/qa/motion-audit.mjs` fails the build otherwise.
- A component names a ROLE, never a value: `bg-canvas`, `text-accent`, `shadow-float-accent`. No hex, no `var(--gp-neutral-*)`, no `style={{ color }}`. Every number is a token or a `calc()` of one; the only inline `style` values allowed are MotionValues and the CSS custom properties `--gp-progress`, `--gp-spot-x/y`.
- Never write a Tailwind class as a template literal (`bg-${tone}`). Assemble from literal strings with a ternary or `cx()`.
- Never put a literal Tailwind class string inside a test file — assemble at runtime (see the `motion-audit.test.ts` fixtures).
- Reduced motion is a DIFFERENT composition, never a faster one; below `md` (768) no depth/tilt/magnetic; below `wide` (1240) no stack scrub; `pointer: coarse` gets no tilt/magnetic.
- TypeScript: `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on — optional props are typed `T | undefined`, array reads are `arr[i]!` only when proven.
- Copy: nothing new; every visible string already lives in `apps/landing/content/landing-content.ts` or `content/demo-records.ts`. Kitchen-sink demo strings are Ukrainian.
- Docs in English; the owner is addressed in Russian; public copy is Ukrainian.
- One commit per task, message ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. The gate (`docs/design/02-building-ui.md` §5, five commands) runs at the end of every task that touches `packages/ui` or `apps/landing`; its output is pasted into the task's final message.
- The vocabulary's closed list in `packages/testing/src/motion-audit.test.ts` («exports exactly N primitives») is updated by EXACTLY the names a task exports, in that task, so the suite is green after every task.

Test commands used throughout:

```bash
pnpm --filter @goproceed/testing test          # the contract suite (motion-audit, motion-contract, token-fidelity, …)
pnpm --filter @goproceed/landing test          # apps/landing/tests
pnpm turbo run typecheck
node packages/testing/qa/motion-audit.mjs      # must print "motion-audit: clean"
pnpm --filter @goproceed/landing build
```

---

### Task 1: Tokens — two durations, two springs, one shadow, one ruling

**Files:**
- Modify: `packages/tokens/src/tokens.json` (`primitive.duration`, `primitive.spring`, `primitive.ease.soft.ruling`, `shadow`)
- Modify: `packages/ui/src/motion/tokens.ts:63-71` (`DURATION`), `:86-89` (`SPRING`)
- Modify: `packages/ui/src/base.css` (the `duration-*` utilities block, after `duration-deliberate`)
- Test: `packages/testing/src/motion-contract.test.ts`
- Generated (never hand-edited, regenerate): `packages/ui/src/theme.generated.css`, `packages/ui/src/tokens.generated.css`, `packages/ui/src/tw-merge.generated.ts`, `packages/tokens/src/tokens.generated.ts`, `packages/tokens/src/tokens.dtcg.json`, `docs/design/01-tokens.md`, the native tokens

**Interfaces:**
- Produces: `DURATION.stately` (0.9), `DURATION.grand` (1.2), `SPRING.tilt`, `SPRING.magnetic` from `packages/ui/src/motion/tokens.ts`; CSS `--gp-duration-stately`, `--gp-duration-grand`, `--gp-shadow-float-accent`; Tailwind utilities `duration-stately`, `duration-grand`, `shadow-float-accent`.

- [ ] **Step 1: Write the failing test**

Append to `packages/testing/src/motion-contract.test.ts` inside the existing `describe("the motion bridge is parsed, not retyped", …)` block, before its closing `});`:

```ts
  it("carries the prototype-parity tokens (2026-09-06)", () => {
    // Spec 2026-09-06 §5.3. Two durations for the prototype's entrance families,
    // two springs for the pointer words, one accent shadow for the «now» card.
    expect(src.primitive.duration.stately.value).toBe("900ms");
    expect(src.primitive.duration.grand.value).toBe("1200ms");
    expect(src.primitive.spring.tilt.value).toBe("stiffness 120, damping 20, mass 1");
    expect(src.primitive.spring.magnetic.value).toBe("stiffness 150, damping 18, mass 0.5");
    expect(src.shadow["float-accent"].layers).toHaveLength(2);
    expect(src.shadow["float-accent"].layers[0].color.hex).toBe("#2B4BFF");
    for (const name of ["stately", "grand"]) expect(bridge).toContain(`${name}: seconds(duration.${name})`);
    for (const name of ["tilt", "magnetic"]) expect(bridge).toContain(`${name}: springOf(spring.${name})`);
    // The yoyo loops are the second permitted use of the symmetric curve.
    expect(src.primitive.ease.soft.ruling).toContain("yoyo");
  });
```

- [ ] **Step 2: Run it, expect failure**

Run: `pnpm --filter @goproceed/testing test -- motion-contract`
Expected: FAIL — `Cannot read properties of undefined (reading 'value')` on `duration.stately`.

- [ ] **Step 3: Add the tokens**

Run this script from the worktree root (it edits `tokens.json` in place, preserving key order):

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const p = "packages/tokens/src/tokens.json";
const d = JSON.parse(readFileSync(p, "utf8"));
d.primitive.duration.stately = { value: "900ms", ruling: "The approved prototype (design-references/contest-2026-09/daylight/index.html) enters copy and cards over .9–1.0s: [data-up], the role cells, the compare cards, the bento cells, the hero pills, the board cards. One token for that family; spec 2026-09-06 §6 lists every rounding." };
d.primitive.duration.grand = { value: "1200ms", ruling: "The prototype hero and heading choreography: SplitText line masks 1.1s, the h1 and the receipt 1.2s, the channel cards 1.2s, the stage 1.4s, the counters 1.6s. One token for the family; the 1.4 and 1.6 round down, recorded in spec 2026-09-06 §6." };
d.primitive.spring.tilt = { value: "stiffness 120, damping 20, mass 1", ruling: "Pointer tilt on the board, the role cells and the channel cards. Settles in roughly the prototype quickTo .6–1s on power3, no overshoot — a surface that leans must not wobble." };
d.primitive.spring.magnetic = { value: "stiffness 150, damping 18, mass 0.5", ruling: "A control following the pointer catches up in about half a second, the prototype quickTo .5s. motion-primitives ships 26.7/4.1/0.2 which overshoots visibly; the prototype does not." };
d.primitive.ease.soft.ruling = "Symmetric. Cross-fades, where a directionless change should not imply a direction, and the landing ambient yoyo loops (drift, pulse), which have no direction either [2026-09-06]. Grovia measured reveal curve.";
d.shadow["float-accent"] = {
  layers: [
    { offsetX: 0, offsetY: 30, blurRadius: 70, spreadDistance: -40, color: { hex: "#2B4BFF", alpha: 0.35 } },
    { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: { hex: "#15161A", alpha: 0.05 } },
  ],
  ruling: "The «З GoProceed» compare card only (prototype .cmp-card.now, index.html l.607): the one coloured shadow in the system, and it is the mark colour under the one card that is the product promise. Marketing only.",
};
writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
'
```

Then regenerate:

```bash
pnpm --filter @goproceed/tokens generate
```

- [ ] **Step 4: Extend the bridge**

In `packages/ui/src/motion/tokens.ts` change the two consts:

```ts
export const DURATION = {
  instant: seconds(duration.instant),
  fast: seconds(duration.fast),
  base: seconds(duration.base),
  slow: seconds(duration.slow),
  deliberate: seconds(duration.deliberate),
  stately: seconds(duration.stately),
  grand: seconds(duration.grand),
  marquee: seconds(duration.marquee),
} as const;
```

```ts
export const SPRING = {
  reveal: springOf(spring.reveal),
  press: springOf(spring.press),
  tilt: springOf(spring.tilt),
  magnetic: springOf(spring.magnetic),
} as const;
```

- [ ] **Step 5: Add the two duration utilities**

In `packages/ui/src/base.css`, directly after the line `@utility duration-deliberate { transition-duration: var(--gp-duration-deliberate); }` add:

```css
@utility duration-stately { transition-duration: var(--gp-duration-stately); }
@utility duration-grand { transition-duration: var(--gp-duration-grand); }
```

- [ ] **Step 6: Run the contract suite and typecheck**

Run: `pnpm --filter @goproceed/testing test && pnpm turbo run typecheck`
Expected: all green (`token-fidelity` accepts the rulings; `motion-contract` finds both spellings; `tw-merge` sees `shadow-float-accent` in the shadow group).

- [ ] **Step 7: Commit**

```bash
git add packages/tokens packages/ui/src/motion/tokens.ts packages/ui/src/base.css packages/ui/src/*.generated.* docs/design/01-tokens.md packages/testing/src/motion-contract.test.ts
git commit -m "feat(tokens): duration.stately/grand, spring.tilt/magnetic, shadow.float-accent — the prototype parity numbers (spec 2026-09-06 §5.3)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The perpetual allowlist names five loops

**Files:**
- Modify: `packages/testing/qa/motion-audit.mjs:84` (`PERPETUAL_ALLOWLIST`), the rule-4 message
- Test: `packages/testing/src/motion-audit.test.ts`

**Interfaces:**
- Produces: exported `PERPETUAL_ALLOWLIST` (regexes) from `motion-audit.mjs`; keyframe names `gp-beam`, `gp-pulse`, `gp-drift`, `gp-flow` are legal as `infinite` animations anywhere under `ROOTS`.

- [ ] **Step 1: Write the failing tests**

In `packages/testing/src/motion-audit.test.ts`: change the import line to

```ts
import { auditMotion, ROOTS, EXCLUDED, ANIMATABLE, PERPETUAL_ALLOWLIST } from "../qa/motion-audit.mjs";
```

In the `beforeAll` fixture, after the `violations.css` write, add an allowed file (assembled at runtime, never a literal class):

```ts
    writeFileSync(join(root, "apps/landing/allowed.css"), [
      `.e { ${decl("animation", "gp-drift-a 4s linear infinite alternate")} }`,
      `.f { ${decl("animation", "gp-pulse 1.6s linear infinite")} }`,
      `.g { ${decl("animation", "gp-flow 1.6s linear infinite")} }`,
      `.h { ${decl("animation", "gp-beam 7s linear infinite")} }`,
    ].join("\n"));
```

Replace `it("rule 4 — perpetual animation", () => has("outside the marquee"));` with:

```ts
  it("rule 4 — perpetual animation outside the named loops", () => has("outside the named loops"));
  it("rule 4 — the five named loops are not findings", () => {
    expect(audit(root).filter((f) => f.includes("allowed.css"))).toEqual([]);
  });
```

And in `describe("the vocabulary is closed", …)` add:

```ts
  it("names exactly the five perpetual loops", () => {
    // Spec 2026-09-06 §5.1: the marquee and the landing's four ambient loops.
    // A sixth is a §7.3 decision, so the list is pinned by value.
    expect((PERPETUAL_ALLOWLIST as RegExp[]).map(String)).toEqual([
      "/gp-marquee/", "/marquee-track/", "/gp-beam/", "/gp-pulse/", "/gp-drift/", "/gp-flow/",
    ]);
  });
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @goproceed/testing test -- motion-audit`
Expected: FAIL — `PERPETUAL_ALLOWLIST` is not exported; «outside the named loops» not found.

- [ ] **Step 3: Extend the audit**

In `packages/testing/qa/motion-audit.mjs` replace

```js
/** The one perpetual animation. */
const PERPETUAL_ALLOWLIST = [/gp-marquee/, /marquee-track/];
```

with

```js
/**
 * The five perpetual animations, by keyframe name. Until 2026-09-06 this held
 * the marquee alone; the landing parity slice (spec 2026-09-06 §5.1) adds the
 * prototype's four ambient loops — the Border Beam, the review-dot pulse, the
 * receipt/pill drift and the dashed «flow» lines. A sixth is a decision
 * (02-building-ui §7.3), which is why the list is exported and pinned by a test.
 */
export const PERPETUAL_ALLOWLIST = [/gp-marquee/, /marquee-track/, /gp-beam/, /gp-pulse/, /gp-drift/, /gp-flow/];
```

and the rule-4 finding text `perpetual animation outside the marquee` → `perpetual animation outside the named loops`. Update the header comment's rule 4 sentence to «No perpetual animation outside the five named loops (marquee, beam, pulse, drift, flow). One ambient animation per product was the 2026-08-19 decision; the 2026-09-06 parity spec names four more, and names them so a sixth cannot arrive unnoticed.»

- [ ] **Step 4: Run, expect pass**

Run: `pnpm --filter @goproceed/testing test -- motion-audit && node packages/testing/qa/motion-audit.mjs`
Expected: PASS; `motion-audit: clean`.

- [ ] **Step 5: Commit**

```bash
git add packages/testing/qa/motion-audit.mjs packages/testing/src/motion-audit.test.ts
git commit -m "test(motion-audit): the perpetual allowlist names five loops — marquee, beam, pulse, drift, flow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Gate hooks and `LineReveal`

**Files:**
- Create: `packages/ui/src/motion/use-gates.ts`
- Create: `packages/ui/src/motion/LineReveal.tsx`
- Modify: `packages/ui/src/motion/index.ts` (export), `packages/ui/src/base.css` (`@utility line-mask`)
- Modify: `packages/testing/src/motion-audit.test.ts:105-109` (closed list +`LineReveal`)
- Modify: `apps/landing/app/kitchen-sink/page.tsx` (new `Case n="17"`)
- Test: `apps/landing/tests/motion-parity.test.tsx` (new, node environment, SSR)

**Interfaces:**
- Produces: `useBelowBreakpoint(name: "md" | "wide"): boolean` (false on the server and first paint; live afterwards), `usePointerFine(): boolean` (same shape) from `./use-gates` — used by Tasks 4–7.
- Produces: `LineReveal({ text, accent?, as?, className?, delay? })` and `splitAccent(text, accent?)` exported from `@goproceed/ui/motion`.

- [ ] **Step 1: Write the failing test**

Create `apps/landing/tests/motion-parity.test.tsx`:

```tsx
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LineReveal, splitAccent } from "@goproceed/ui/motion";

vi.mock("../../../packages/ui/src/motion/use-reduced", () => ({
  useReduced: () => false,
  shouldReduce: () => false,
}));

describe("LineReveal", () => {
  const text = "На нараді більше не сперечаються";
  it("renders the text once for readers and once as flat words before measurement, the accent marked", () => {
    const html = renderToStaticMarkup(<LineReveal as="h2" text={text} accent="не сперечаються" />);
    expect(html.startsWith("<h2")).toBe(true);
    expect(html).toContain(`class="sr-only">${text}<`);
    expect(html.match(/data-word=""/g)).toHaveLength(5);
    expect(html.match(/data-accent="true"/g)).toHaveLength(2);
    // The masks arrive after layout measurement; the server never sends them.
    expect(html).not.toContain("data-line");
    // Separators sit between word spans, never inside one (the ScrollTint lesson).
    const visible = html.slice(html.indexOf('aria-hidden="true"'));
    expect(visible).not.toMatch(/\s<\/span>/);
    expect(visible.match(/<\/span> <span/g)).toHaveLength(4);
  });
  it("marks accent words by their position in the sentence", () => {
    expect(splitAccent("Робота готова, коли доказ на місці.", "доказ").map((w) => w.accent))
      .toEqual([false, false, false, true, false, false]);
    expect(splitAccent("Без акценту").every((w) => !w.accent)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @goproceed/landing test -- motion-parity`
Expected: FAIL — `LineReveal` is not exported from `@goproceed/ui/motion`.

- [ ] **Step 3: Write the gate hooks**

Create `packages/ui/src/motion/use-gates.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

/**
 * The two capability gates the pointer and depth words share.
 *
 * Both return `false` on the server and on the first client paint, and the
 * real answer after an effect — the same conservative shape `useReduced()`
 * has, for the same reason: the server cannot read a media query, and a word
 * that rendered one tree on the server and another on the client would
 * remount on hydration (the `ScrollSettle` lesson, 2026-09-05). Every word
 * that consumes these keeps ONE DOM shape and switches its MotionValues off,
 * never its tree.
 *
 * The breakpoint is read from the token (`--breakpoint-md`, `--breakpoint-wide`
 * in theme.generated.css), so the number is typed nowhere here.
 */
export function useBelowBreakpoint(name: "md" | "wide"): boolean {
  const [below, setBelow] = useState(false);
  useEffect(() => {
    const fallback = name === "md" ? "768px" : "1240px";
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--breakpoint-${name}`).trim() || fallback;
    const query = window.matchMedia(`(max-width: calc(${value} - 1px))`);
    const update = () => setBelow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [name]);
  return below;
}

/** `(pointer: fine)` — a mouse or trackpad. Tilt and magnetism follow a pointer; a thumb has nothing to follow. */
export function usePointerFine(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: fine)");
    const update = () => setFine(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return fine;
}
```

- [ ] **Step 4: Write `LineReveal`**

Create `packages/ui/src/motion/LineReveal.tsx`:

```tsx
"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { DURATION, EASE, STAGGER, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";

export type AccentWord = { text: string; accent: boolean };

/**
 * Split `text` into words and mark the ones inside the `accent` phrase (F8:
 * the key phrase of a heading is set in `text-accent`). Matched by character
 * position, so a phrase that spans a line break still marks every word.
 */
export function splitAccent(text: string, accent?: string | undefined): AccentWord[] {
  const at = accent ? text.indexOf(accent) : -1;
  const end = at >= 0 && accent ? at + accent.length : -1;
  let cursor = 0;
  return text.split(" ").map((word) => {
    const start = cursor;
    cursor += word.length + 1;
    return { text: word, accent: at >= 0 && start >= at && start < end };
  });
}

/**
 * A heading arriving line by line — the prototype's SplitText `lines` reveal
 * (`index.html` l.1103, l.1109): each line rises out of an overflow mask,
 * `yPercent 110 → 0`, `ease.emphatic`, `duration.grand`, one `stagger.default`
 * behind the line above.
 *
 * THERE IS NO SPLITTEXT. Lines are found by layout: every word is an inline
 * span, and after the browser has laid them out the spans are grouped by
 * `offsetTop`. The grouping runs in a layout effect, so on hydration it
 * happens before the first paint and the reader never sees the flat state;
 * a `ResizeObserver` and `document.fonts.ready` re-run it, because line breaks
 * move when the viewport or the typeface does. During a re-measure the words
 * are briefly flat again — one frame, on resize only.
 *
 * ONE ACCESSIBLE NODE. The real text sits in an `sr-only` span; every visual
 * piece is `aria-hidden`. Screen readers hear the heading once, intact.
 *
 * SERVER AND FIRST PAINT: the flat words, no masks. The masks are added by
 * measurement, so the server never sends them and hydration matches.
 *
 * Reduced: a single opacity fade of the whole heading — not a faster rise.
 */
export function LineReveal({
  text, accent, as: As = "h2", className, delay = 0,
}: {
  text: string;
  /** The phrase set in `text-accent`. Whole words only. */
  accent?: string | undefined;
  as?: "h1" | "h2" | "h3" | "p" | undefined;
  className?: string | undefined;
  /** Seconds before the first line starts. */
  delay?: number | undefined;
}) {
  const reduced = useReduced();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.14 });
  const words = useMemo(() => splitAccent(text, accent), [text, accent]);
  const [lines, setLines] = useState<number[][] | null>(null);

  useLayoutEffect(() => {
    if (reduced) { setLines(null); return; }
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      const spans = [...el.querySelectorAll<HTMLElement>("[data-word]")];
      const groups: number[][] = [];
      let top: number | null = null;
      spans.forEach((span, i) => {
        const t = span.offsetTop;
        if (top === null || Math.abs(t - top) > 1) { groups.push([i]); top = t; }
        else groups[groups.length - 1]!.push(i);
      });
      setLines(groups);
    };
    const remeasure = () => {
      setLines(null);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(remeasure);
    observer.observe(el);
    document.fonts?.ready.then(remeasure);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [reduced, words]);

  const word = (i: number) => {
    const w = words[i]!;
    return (
      <span key={i} data-word="" data-accent={w.accent ? "true" : undefined} className={w.accent ? "text-accent" : undefined}>
        {w.text}
      </span>
    );
  };
  const flat = words.map((_, i) => <Fragment key={i}>{word(i)}{i < words.length - 1 ? " " : ""}</Fragment>);

  if (reduced) {
    return (
      <As className={className}>
        <span className="sr-only">{text}</span>
        <motion.span
          ref={ref}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: REDUCED.duration, ease: REDUCED.ease }}
        >
          {flat}
        </motion.span>
      </As>
    );
  }

  return (
    <As className={className}>
      <span className="sr-only">{text}</span>
      <span ref={ref} aria-hidden="true">
        {lines === null
          ? flat
          : lines.map((group, li) => (
            <span key={li} data-line="" className="line-mask">
              <motion.span
                className="block"
                initial={{ y: "110%" }}
                animate={inView ? { y: "0%" } : { y: "110%" }}
                transition={{ duration: DURATION.grand, ease: EASE.emphatic, delay: delay + li * STAGGER.default }}
              >
                {group.map((i, k) => <Fragment key={i}>{word(i)}{k < group.length - 1 ? " " : ""}</Fragment>)}
              </motion.span>
            </span>
          ))}
      </span>
    </As>
  );
}
```

- [ ] **Step 5: The mask utility, the export, the closed list**

`packages/ui/src/base.css` — after `@utility measure { … }` add:

```css
/* The line mask under a heading line — the prototype's `.lm` (index.html l.645).
 * `overflow: hidden` clips the rising line; the .12em padding/negative margin
 * pair keeps descenders inside the clip without adding height. */
@utility line-mask {
  display: block;
  overflow: hidden;
  padding-bottom: 0.12em;
  margin-bottom: -0.12em;
}
```

`packages/ui/src/motion/index.ts` — after the `ScrollSettle` export line add:

```ts
export { LineReveal, splitAccent, type AccentWord } from "./LineReveal";
```

`packages/testing/src/motion-audit.test.ts` — in the closed list add `"LineReveal"` after `"ScrollSettle"` and change the test title to `exports exactly seventeen primitives`. (Each following task adds its name and bumps the word.)

- [ ] **Step 6: Kitchen sink case**

In `apps/landing/app/kitchen-sink/page.tsx`: add `LineReveal` to the import list from `@goproceed/ui/motion`; after the last `</Case>` (n="16") add:

```tsx
      <Case n="17" name="LineReveal" rule="Заголовок виїжджає з масок рядок за рядком, 1200 мс, ease-out-expo, крок 80 мс. Рядки знаходяться за розкладкою (offsetTop), не SplitText; під reduced motion — один fade.">
        <LineReveal as="p" className="display max-w-[20ch] text-mkt-display-2 text-ink" text="На нараді більше не сперечаються про те, що вже сховано" accent="що вже сховано" />
      </Case>
```

If the file's last case is not `16`, use the next number and keep the sequence.

- [ ] **Step 7: Run everything**

Run: `pnpm --filter @goproceed/landing test -- motion-parity && pnpm --filter @goproceed/testing test -- motion-audit && pnpm turbo run typecheck && node packages/testing/qa/motion-audit.mjs`
Expected: PASS, `motion-audit: clean`.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/motion/use-gates.ts packages/ui/src/motion/LineReveal.tsx packages/ui/src/motion/index.ts packages/ui/src/base.css packages/testing/src/motion-audit.test.ts apps/landing/app/kitchen-sink/page.tsx apps/landing/tests/motion-parity.test.tsx
git commit -m "feat(motion): LineReveal — a heading arriving line by line, lines found by layout, one accessible node (spec 2026-09-06 §4.1)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `Depth`

**Files:**
- Create: `packages/ui/src/motion/Depth.tsx`
- Modify: `packages/ui/src/motion/index.ts`, `packages/testing/src/motion-audit.test.ts` (+`Depth`, «eighteen»), `apps/landing/app/kitchen-sink/page.tsx` (`Case n="18"`)
- Test: `apps/landing/tests/motion-parity.test.tsx`

**Interfaces:**
- Consumes: `useBelowBreakpoint` (Task 3).
- Produces: `Depth({ depth: number, children, className? })` — `data-depth` attribute carries the number for the QA harness.

- [ ] **Step 1: Failing test** — append to `motion-parity.test.tsx` (extend the import: `import { LineReveal, splitAccent, Depth } from "@goproceed/ui/motion";`):

```tsx
describe("Depth", () => {
  it("renders one wrapper carrying its depth and no offset on the server", () => {
    const html = renderToStaticMarkup(<Depth depth={-0.3} className="absolute"><span>квитанція</span></Depth>);
    expect(html).toContain('data-depth="-0.3"');
    expect(html).toContain('class="absolute');
    expect(html).not.toMatch(/translateY\(-?[1-9]/);
  });
});
```

- [ ] **Step 2: Run, expect failure** — `pnpm --filter @goproceed/landing test -- motion-parity` → `Depth` not exported.

- [ ] **Step 3: Implement**

Create `packages/ui/src/motion/Depth.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useReduced } from "./use-reduced";
import { useBelowBreakpoint } from "./use-gates";

/** Pixels of travel at depth ±1 — the prototype's `d*80` (index.html l.1116). */
const RANGE = 80;

/**
 * A layer that moves against the scroll — the prototype's `data-depth`: over
 * the traverse of the nearest `<section>` the layer goes from `depth·80px` to
 * `depth·−80px`, so a negative depth (the receipt, −0.3) drifts up as the
 * reader scrolls down and a positive one (the pills, .35/.25) lags behind.
 *
 * Scroll-linked, so gated: below `md`, under reduced motion, and until the
 * gates have resolved after hydration the MotionValue is replaced by `0`. The
 * tree never changes — one `motion.div` in every state — so hydration cannot
 * mismatch and the layer cannot jump between two DOM shapes.
 *
 * The section is found through a callback ref so `sectionRef.current` is set
 * during commit, before Motion's own effect reads it.
 */
export function Depth({
  depth, children, className,
}: {
  /** −1 … 1. Negative rises with the scroll, positive lags. */
  depth: number;
  children: ReactNode;
  className?: string | undefined;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const setRefs = (el: HTMLDivElement | null) => { sectionRef.current = el?.closest("section") ?? null; };
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [depth * RANGE, -depth * RANGE]);
  const reduced = useReduced();
  const narrow = useBelowBreakpoint("md");
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const flat = reduced || narrow || !ready;
  return (
    <motion.div
      ref={setRefs}
      data-depth={depth}
      className={flat ? className : [className, "will-change-transform"].filter(Boolean).join(" ")}
      style={{ y: flat ? 0 : y }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Export, list, sink**

`index.ts`: `export { Depth } from "./Depth";`. Closed list: add `"Depth"`, title «eighteen». Kitchen sink, import `Depth`, add:

```tsx
      <Case n="18" name="Depth" rule="Шар рухається проти скролу в межах своєї секції: від depth·80px до depth·−80px. Нижче md і під reduced motion — нерухомий, той самий DOM.">
        <section className="relative h-64 overflow-hidden rounded-panel border border-line bg-surface">
          <Depth depth={-0.3} className="absolute left-6 top-6 rounded-card border border-line-strong bg-canvas px-3 py-2 text-data text-ink">depth −0.3</Depth>
          <Depth depth={0.35} className="absolute bottom-6 right-6 rounded-pill border border-line-strong bg-canvas px-3 py-1.5 text-data text-ink">depth 0.35</Depth>
        </section>
      </Case>
```

- [ ] **Step 5: Run** — `pnpm --filter @goproceed/landing test -- motion-parity && pnpm --filter @goproceed/testing test -- motion-audit && pnpm turbo run typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/motion/Depth.tsx packages/ui/src/motion/index.ts packages/testing/src/motion-audit.test.ts apps/landing/app/kitchen-sink/page.tsx apps/landing/tests/motion-parity.test.tsx
git commit -m "feat(motion): Depth — a layer that moves against the scroll of its section (spec 2026-09-06 §4.2)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `Tilt`

**Files:**
- Create: `packages/ui/src/motion/Tilt.tsx`
- Modify: `index.ts`, `motion-audit.test.ts` (+`Tilt`, «nineteen»), kitchen sink (`Case n="19"`)
- Test: `apps/landing/tests/motion-parity.test.tsx`

**Interfaces:**
- Consumes: `SPRING.tilt` (Task 1), `useBelowBreakpoint`, `usePointerFine` (Task 3).
- Produces: `Tilt({ children, className?, maxX, maxY, area? })`, `data-tilt="on" | "off"`.

- [ ] **Step 1: Failing test** — extend the import with `Tilt`; append:

```tsx
describe("Tilt", () => {
  it("is off on the server and carries no rotation", () => {
    const html = renderToStaticMarkup(<Tilt maxX={2.5} maxY={3}><article>картка</article></Tilt>);
    expect(html).toContain('data-tilt="off"');
    expect(html).not.toMatch(/rotate[XY]\(-?[1-9]/);
    expect(html).toContain("<article>картка</article>");
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useSpring } from "motion/react";
import { SPRING } from "./tokens";
import { useReduced } from "./use-reduced";
import { useBelowBreakpoint, usePointerFine } from "./use-gates";

/**
 * A surface that leans toward the pointer — the prototype's board tilt
 * (`index.html` l.1139: rotateY ±2°, rotateX ±1.5°, read against the whole
 * hero) and the `[data-spot]` card tilt (l.1159: rotateX ±2.5°, rotateY ±3°,
 * read against the card). The degrees are props because the two surfaces
 * differ; the spring (`spring.tilt`) is the token, and it does not overshoot —
 * a surface that leans must not wobble.
 *
 * `area="self"` reads the pointer over the element; `area="section"` reads it
 * over the nearest `<section>` and normalises by the viewport, which is how
 * the prototype tilts the board while the pointer is anywhere in the hero.
 *
 * GATED THREE WAYS and with one DOM shape: `(pointer: fine)` only (a thumb has
 * nothing to follow), above `md`, and not under reduced motion. Off, the
 * springs sit at 0 and `data-tilt="off"` says so — the QA harness counts them.
 * The parent supplies `perspective` (the prototype's `.stage{perspective:1500px}`,
 * `.cards3{perspective:1600px}`); this only sets `transform-style`.
 */
export function Tilt({
  children, className, maxX, maxY, area = "self",
}: {
  children: ReactNode;
  className?: string | undefined;
  /** Degrees of rotateX at the pointer's extreme (top/bottom edge). */
  maxX: number;
  /** Degrees of rotateY at the pointer's extreme (left/right edge). */
  maxY: number;
  area?: "self" | "section" | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(0, SPRING.tilt);
  const rotateY = useSpring(0, SPRING.tilt);
  const reduced = useReduced();
  const narrow = useBelowBreakpoint("md");
  const fine = usePointerFine();
  const on = !reduced && !narrow && fine;

  useEffect(() => {
    const el = ref.current;
    if (!el || !on) { rotateX.set(0); rotateY.set(0); return; }
    const scope: HTMLElement = area === "section" ? (el.closest("section") ?? el) : el;
    const move = (e: PointerEvent) => {
      let px: number; let py: number;
      if (area === "section") {
        px = e.clientX / window.innerWidth;
        py = e.clientY / window.innerHeight;
      } else {
        const r = el.getBoundingClientRect();
        px = (e.clientX - r.left) / r.width;
        py = (e.clientY - r.top) / r.height;
      }
      rotateY.set((px - 0.5) * 2 * maxY);
      rotateX.set(-(py - 0.5) * 2 * maxX);
    };
    const leave = () => { rotateX.set(0); rotateY.set(0); };
    scope.addEventListener("pointermove", move);
    scope.addEventListener("pointerleave", leave);
    return () => {
      scope.removeEventListener("pointermove", move);
      scope.removeEventListener("pointerleave", leave);
      leave();
    };
  }, [on, area, maxX, maxY, rotateX, rotateY]);

  return (
    <motion.div
      ref={ref}
      data-tilt={on ? "on" : "off"}
      className={className}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Export (`export { Tilt } from "./Tilt";`), closed list +`"Tilt"` «nineteen», kitchen sink:**

```tsx
      <Case n="19" name="Tilt" rule="Поверхня нахиляється до курсору на пружині, до 3°; лише pointer:fine, вище md, не під reduced motion. Батько задає perspective.">
        <div className="grid gap-4 md:grid-cols-2 [perspective:1600px]">
          <Tilt maxX={2.5} maxY={3} className="rounded-surface border border-line-strong bg-surface p-6"><p className="text-data text-ink">rotateX ±2.5° · rotateY ±3°</p></Tilt>
          <Tilt maxX={1.5} maxY={2} className="rounded-surface border border-line-strong bg-surface p-6"><p className="text-data text-ink">rotateX ±1.5° · rotateY ±2°</p></Tilt>
        </div>
      </Case>
```

- [ ] **Step 5: Run** the three test commands → PASS.

- [ ] **Step 6: Commit** — `feat(motion): Tilt — a surface that leans toward the pointer, pointer:fine and desktop only (spec 2026-09-06 §4.3)`.

---

### Task 6: `Magnetic`

**Files:**
- Create: `packages/ui/src/motion/Magnetic.tsx`
- Modify: `index.ts`, `motion-audit.test.ts` (+`Magnetic`, «twenty»), kitchen sink (`Case n="20"`)
- Test: `apps/landing/tests/motion-parity.test.tsx`

**Interfaces:**
- Produces: `Magnetic({ children, className?, strengthX?, strengthY? })`, `data-magnetic="on" | "off"`, wrapper is `inline-flex`.

- [ ] **Step 1: Failing test:**

```tsx
describe("Magnetic", () => {
  it("wraps a control inline, off on the server, no offset", () => {
    const html = renderToStaticMarkup(<Magnetic><button type="button">Обговорити пілот</button></Magnetic>);
    expect(html).toContain('data-magnetic="off"');
    expect(html).toContain("inline-flex");
    expect(html).not.toMatch(/translate[XY]\(-?[1-9]/);
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useSpring } from "motion/react";
import { SPRING } from "./tokens";
import { useReduced } from "./use-reduced";
import { useBelowBreakpoint, usePointerFine } from "./use-gates";

/**
 * A control that follows the pointer — the prototype's magnetic `.btn`
 * (`index.html` l.1172): the offset from the control's centre × (.18, .25),
 * back to 0 on leave. The spring is `spring.magnetic`, which catches up in
 * about half a second and does not overshoot; motion-primitives' Magnetic is
 * the structural reference and its default spring is not used (it wobbles).
 *
 * Same gates and the same one-shape rule as `Tilt`. Wraps a `Button` or a
 * `Pill` link from the outside — the app's controls never receive it. Not
 * applied to the header button (spec 2026-09-06 §10.5).
 */
export function Magnetic({
  children, className, strengthX = 0.18, strengthY = 0.25,
}: {
  children: ReactNode;
  className?: string | undefined;
  strengthX?: number | undefined;
  strengthY?: number | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, SPRING.magnetic);
  const y = useSpring(0, SPRING.magnetic);
  const reduced = useReduced();
  const narrow = useBelowBreakpoint("md");
  const fine = usePointerFine();
  const on = !reduced && !narrow && fine;

  useEffect(() => {
    const el = ref.current;
    if (!el || !on) { x.set(0); y.set(0); return; }
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x.set((e.clientX - r.left - r.width / 2) * strengthX);
      y.set((e.clientY - r.top - r.height / 2) * strengthY);
    };
    const leave = () => { x.set(0); y.set(0); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      leave();
    };
  }, [on, strengthX, strengthY, x, y]);

  return (
    <motion.div
      ref={ref}
      data-magnetic={on ? "on" : "off"}
      className={["inline-flex", className].filter(Boolean).join(" ")}
      style={{ x, y }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Export, list («twenty»), sink:**

```tsx
      <Case n="20" name="Magnetic" rule="Кнопка тягнеться до курсору: зсув від центру × (0.18, 0.25) на пружині, назад у нуль при відведенні. Лише pointer:fine і вище md; кнопка шапки без цього.">
        <Magnetic><Press className="h-11 rounded-panel bg-action px-5 text-data font-medium text-action-fg">Обговорити пілот</Press></Magnetic>
      </Case>
```

- [ ] **Step 5: Run** → PASS. **Step 6: Commit** — `feat(motion): Magnetic — a control that follows the pointer on the magnetic spring (spec 2026-09-06 §4.4)`.

---

### Task 7: `ScrollStack`, `ScrollStackCard`, `ScrollStackMedia`

**Files:**
- Create: `packages/ui/src/motion/ScrollStack.tsx`
- Modify: `index.ts`, `motion-audit.test.ts` (+`ScrollStack`, «twenty-one»), kitchen sink (`Case n="21"`)
- Test: `apps/landing/tests/motion-parity.test.tsx`

**Interfaces:**
- Consumes: `DURATION.grand`, `EASE.emphatic`, `useBelowBreakpoint("wide")`.
- Produces: `ScrollStack({ children, className? })` with `data-scroll-stack="on"|"off"`; `ScrollStackCard({ index, count, children, className? })` with `data-stack-card={index}` and a `data-stack-veil` child; `ScrollStackMedia({ children, className? })` with `data-stack-media`.

- [ ] **Step 1: Failing test:**

```tsx
describe("ScrollStack", () => {
  it("renders every card with its veil and media, unstuck and unscaled on the server", () => {
    const html = renderToStaticMarkup(
      <ScrollStack className="grid gap-4">
        <ScrollStackCard index={0} count={2}><ScrollStackMedia><p>панель</p></ScrollStackMedia></ScrollStackCard>
        <ScrollStackCard index={1} count={2}><p>друга</p></ScrollStackCard>
      </ScrollStack>,
    );
    expect(html).toContain('data-scroll-stack="off"');
    expect(html.match(/data-stack-card="\d"/g)).toEqual(['data-stack-card="0"', 'data-stack-card="1"']);
    expect(html.match(/data-stack-veil=""/g)).toHaveLength(2);
    expect(html).toContain('data-stack-media=""');
    expect(html).not.toContain("sticky");
    expect(html).not.toMatch(/scale\(0\.9/);
  });
  it("refuses a card outside a stack", () => {
    expect(() => renderToStaticMarkup(<ScrollStackCard index={0} count={1}>x</ScrollStackCard>)).toThrow(/inside ScrollStack/);
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

```tsx
"use client";

import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { DURATION, EASE, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";
import { useBelowBreakpoint } from "./use-gates";

type CardRef = RefObject<HTMLDivElement | null>;
type Registry = { refFor: (index: number) => CardRef; active: boolean };

const StackContext = createContext<Registry | null>(null);
const CardContext = createContext<CardRef | null>(null);

/** The prototype's numbers (index.html l.1150–1152). */
const SCALE_END = 0.955;
const RISE_END = -14;
const VEIL_END = 0.7;
const MEDIA_Y: [number, number] = [14, -14];
const MEDIA_ROTATE: [number, number] = [-3, 2];

/**
 * Fora's sticky feature stack, as the prototype does it: every card sticks
 * under the header; when the NEXT card's top travels from 90 % of the
 * viewport to 96px below its top, the card underneath shrinks to .955, rises
 * 14px and sinks under a paper veil at .7. The UI panel inside a card's media
 * half drifts `y 14 → −14` and leans `rotateX −3 → 2` over the card's own
 * traverse.
 *
 * The container hands each card a stable ref object by index, so card *i* can
 * bind `useScroll` to card *i+1*'s element without any parent measuring
 * anything. The last card has no next and stays flat.
 *
 * Below `wide` the cards are a single column already (spec 2026-09-05 §10),
 * and a scrub on a single column reads as jitter, so the stack is off there,
 * and under reduced motion. One DOM shape in every state: `sticky` is a class
 * toggled after the gate resolves, the MotionValues are swapped for constants.
 */
export function ScrollStack({ children, className }: { children: ReactNode; className?: string | undefined }) {
  const reduced = useReduced();
  const below = useBelowBreakpoint("wide");
  const refs = useRef(new Map<number, CardRef>());
  const registry = useMemo<Registry>(() => ({
    refFor: (index) => {
      let ref = refs.current.get(index);
      if (!ref) { ref = { current: null }; refs.current.set(index, ref); }
      return ref;
    },
    active: !reduced && !below,
  }), [reduced, below]);
  return (
    <StackContext.Provider value={registry}>
      <div data-scroll-stack={registry.active ? "on" : "off"} className={className}>{children}</div>
    </StackContext.Provider>
  );
}

export function ScrollStackCard({
  index, count, children, className,
}: {
  index: number;
  count: number;
  children: ReactNode;
  className?: string | undefined;
}) {
  const stack = useContext(StackContext);
  if (!stack) throw new Error("ScrollStackCard must sit inside ScrollStack");
  const reduced = useReduced();
  const own = stack.refFor(index);
  const next = stack.refFor(index + 1);
  const hasNext = index < count - 1;
  const { scrollYProgress: pull } = useScroll(hasNext ? { target: next, offset: ["start 0.9", "start 96px"] } : {});
  const { scrollYProgress: veilProgress } = useScroll(hasNext ? { target: next, offset: ["start 0.8", "start 96px"] } : {});
  const scale = useTransform(pull, [0, 1], [1, SCALE_END]);
  const y = useTransform(pull, [0, 1], [0, RISE_END]);
  const veil = useTransform(veilProgress, [0, 1], [0, VEIL_END]);
  const on = stack.active && hasNext;
  return (
    <CardContext.Provider value={own}>
      <motion.div
        ref={own}
        data-stack-card={index}
        className={[stack.active ? "sticky top-[90px]" : "", "relative rounded-surface", className].filter(Boolean).join(" ")}
        style={{ scale: on ? scale : 1, y: on ? y : 0, transformOrigin: "50% 0%" }}
      >
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
          whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={reduced
            ? { duration: REDUCED.duration, ease: REDUCED.ease }
            : { duration: DURATION.grand, ease: EASE.emphatic }}
        >
          {children}
        </motion.div>
        <motion.i
          aria-hidden="true"
          data-stack-veil=""
          className="pointer-events-none absolute inset-0 z-5 rounded-[inherit] bg-canvas"
          style={{ opacity: on ? veil : 0 }}
        />
      </motion.div>
    </CardContext.Provider>
  );
}

export function ScrollStackMedia({ children, className }: { children: ReactNode; className?: string | undefined }) {
  const stack = useContext(StackContext);
  const card = useContext(CardContext);
  const { scrollYProgress } = useScroll(card ? { target: card, offset: ["start end", "end start"] } : {});
  const y = useTransform(scrollYProgress, [0, 1], MEDIA_Y);
  const rotateX = useTransform(scrollYProgress, [0, 1], MEDIA_ROTATE);
  const on = Boolean(stack?.active);
  return (
    <motion.div
      data-stack-media=""
      className={className}
      style={{ y: on ? y : 0, rotateX: on ? rotateX : 0, transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
}
```

`top-[90px]` is the prototype's `.fcard{top:90px}` (l.235) and replaces the literal in `apps/landing/app/globals.css` (removed in Task 15) — one place instead of two.

- [ ] **Step 4: Export (`export { ScrollStack, ScrollStackCard, ScrollStackMedia } from "./ScrollStack";`), closed list +`"ScrollStack"` «twenty-one» (the regex captures the first name on the line), kitchen sink:**

```tsx
      <Case n="21" name="ScrollStack" rule="Стек Fora: картка липне під шапкою; коли наступна доїжджає до 96px від верху, попередня стискається до .955, піднімається на 14px і йде під вуаль .7. Панель усередині медіа пливе y 14→−14 і нахиляється −3→2°. Лише wide, не reduced.">
        <ScrollStack className="grid gap-4">
          {["Вимога", "Фіксація", "Рішення"].map((t, i) => (
            <ScrollStackCard key={t} index={i} count={3}>
              <div className="grid min-h-64 overflow-hidden rounded-surface border border-line-strong bg-surface md:grid-cols-2">
                <div className="p-6"><p className="index-label">0{i + 1} · {t}</p></div>
                <div className="grid place-items-center border-t border-line bg-subtle p-6 [perspective:1200px] md:border-l md:border-t-0">
                  <ScrollStackMedia className="rounded-panel border border-line-strong bg-surface px-4 py-3 text-data text-ink shadow-float">панель {t}</ScrollStackMedia>
                </div>
              </div>
            </ScrollStackCard>
          ))}
        </ScrollStack>
      </Case>
```

- [ ] **Step 5: Run** → PASS. **Step 6: Commit** — `feat(motion): ScrollStack — Fora's sticky stack with the prototype's scale, veil and media parallax (spec 2026-09-06 §4.5)`.

---

### Task 8: `ScrollProgress`, and `Stepper` reads it

**Files:**
- Create: `packages/ui/src/motion/ScrollProgress.tsx`
- Modify: `packages/ui/src/components/Stepper.tsx:1-30`
- Modify: `index.ts`, `motion-audit.test.ts` (+`ScrollProgress`, «twenty-two»), kitchen sink (`Case n="22"`)
- Test: `apps/landing/tests/motion-parity.test.tsx`, `apps/landing/tests/motion-parity-reduced.test.tsx` (new, jsdom)

**Interfaces:**
- Produces: `ScrollProgress({ children, className?, offset? })`, `data-scroll-progress=""`, writes `--gp-progress` on its own node. `Stepper` renders `data-scroll-progress`.

- [ ] **Step 1: Failing tests**

Append to `motion-parity.test.tsx` (import `ScrollProgress`; also import `Stepper, Step` from `@goproceed/ui/components`):

```tsx
describe("ScrollProgress", () => {
  it("renders the wrapper the stepper reads from, and the stepper now uses it", () => {
    expect(renderToStaticMarkup(<ScrollProgress><i /></ScrollProgress>)).toContain('data-scroll-progress=""');
    const stepper = renderToStaticMarkup(
      <Stepper><Step index={0} count={2} when="День 1" title="Реєстр">тіло</Step><Step index={1} count={2} when="Тиждень 1" title="Майданчик">тіло</Step></Stepper>,
    );
    expect(stepper).toContain('data-scroll-progress=""');
    expect(stepper).toContain("scaleY(var(--gp-progress, 0))");
  });
});
```

Create `apps/landing/tests/motion-parity-reduced.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ScrollProgress } from "@goproceed/ui/motion";

// Reduced motion for this file only: the word must publish its FINAL value at
// once and never animate — a different outcome, not a fast one.
vi.mock("../../../packages/ui/src/motion/use-reduced", () => ({
  useReduced: () => true,
  shouldReduce: () => true,
}));

afterEach(cleanup);

describe("ScrollProgress under reduced motion", () => {
  it("publishes --gp-progress: 1 on mount", () => {
    const { container } = render(<ScrollProgress><i /></ScrollProgress>);
    const node = container.querySelector<HTMLElement>("[data-scroll-progress]");
    expect(node?.style.getPropertyValue("--gp-progress")).toBe("1");
  });
});
```

- [ ] **Step 2: Run, expect failure** — `pnpm --filter @goproceed/landing test -- motion-parity`.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useReduced } from "./use-reduced";

type ScrollOffset = NonNullable<Parameters<typeof useScroll>[0]>["offset"];

/**
 * A progress number driven by the scroll — the sibling of `InViewProgress`,
 * which is driven by a timer once in view. Deliberately a separate word: one
 * word with two triggers would make every call site ambiguous about what
 * advances it (the 2026-08-30 ruling that split `TrackFill` from `LineDraw`).
 *
 * Same contract as its sibling: renders no visual, publishes `--gp-progress`
 * 0→1 (four decimals) on its own node, so the pilot stepper's line
 * (`scaleY(var(--gp-progress))`) and dot thresholds need no change. The
 * prototype scrubs the stepper from `top 70%` to `bottom 60%` (index.html
 * l.1171), which is the default offset.
 *
 * Reduced: `1` on mount, and the scroll is never read into the node.
 */
export function ScrollProgress({
  children, className, offset = ["start 0.7", "end 0.6"],
}: {
  children: ReactNode;
  className?: string | undefined;
  offset?: ScrollOffset | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReduced();
  const { scrollYProgress } = useScroll({ target: ref, offset });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (!reduced) ref.current?.style.setProperty("--gp-progress", v.toFixed(4));
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--gp-progress", reduced ? "1" : scrollYProgress.get().toFixed(4));
  }, [reduced, scrollYProgress]);

  return <div ref={ref} data-scroll-progress="" className={className}>{children}</div>;
}
```

`Stepper.tsx`: replace `import { InViewProgress } from "../motion/InViewProgress";` with `import { ScrollProgress } from "../motion/ScrollProgress";`, and `<InViewProgress className={cx("relative grid pl-9", className)}>` … `</InViewProgress>` with `<ScrollProgress …>` … `</ScrollProgress>`. Rewrite the header comment's first sentence: «The pilot plan as a vertical stepper — 21st.dev's «Steppers», scrubbed by the scroll as the prototype does (index.html l.1171): `ScrollProgress` publishes the section's progress into `--gp-progress`; the line's fill is a `scaleY` of that number and each dot lights as the number passes its threshold. [2026-09-06: was `InViewProgress`, timed; spec 2026-09-06 §3 row 10.]»

- [ ] **Step 4: Export (`export { ScrollProgress } from "./ScrollProgress";`), closed list +`"ScrollProgress"` «twenty-two», and correct the index header: `SIXTEEN` → `TWENTY-TWO`, «these sixteen files» → «these twenty-two files», «exactly two scroll-linked elements» → «the scroll-linked compositions the landing spec names, one per section». Kitchen sink:**

```tsx
      <Case n="22" name="ScrollProgress" rule="Брат InViewProgress, але керований скролом: публікує прогрес проходу 0 → 1 у --gp-progress від top 70% до bottom 60%. Під reduced motion — одразу 1.">
        <ScrollProgress className="block h-2 overflow-hidden rounded-pill bg-line">
          <div aria-hidden="true" className="h-full rounded-pill bg-signal" style={{ width: "calc(var(--gp-progress, 0) * 100%)" }} />
        </ScrollProgress>
      </Case>
```

Also update the sink header `text="Шістнадцять примітивів і жодного більше"` → `text="Двадцять два примітиви і жодного більше"` and the header comment «Sixteen primitives» → «Twenty-two primitives».

- [ ] **Step 5: Run** — `pnpm --filter @goproceed/landing test && pnpm --filter @goproceed/testing test -- motion-audit && pnpm turbo run typecheck` → PASS (the landing's full suite: `landing-render` still finds the stepper).

- [ ] **Step 6: Commit** — `feat(motion): ScrollProgress — the stepper's progress is the scroll, as the prototype scrubs it (spec 2026-09-06 §4.6)`.

---

### Task 9: The changed words — `ScrollTint`, `Reveal`, `Stagger`/`StaggerItem`

**Files:**
- Modify: `packages/ui/src/motion/ScrollTint.tsx`, `Reveal.tsx`, `Stagger.tsx`
- Test: `apps/landing/tests/motion-parity.test.tsx`, `apps/landing/tests/ui-components.test.tsx:104-125` (the existing ScrollTint gap test keeps passing)

**Interfaces:**
- Produces: `ScrollTint({ text, className?, offset?, dimUntil? })` — words fade `opacity .14→1`; the first `dimUntil` words carry `text-ink-muted`. `Reveal({ …, x?, size? })` with `size: "slow" | "stately" | "grand"`. `Stagger({ …, delay? })`, `StaggerItem({ …, from?: "rise" | "scale" })`.

- [ ] **Step 1: Failing tests** (import `ScrollTint, Reveal, Stagger, StaggerItem`):

```tsx
describe("changed words", () => {
  it("ScrollTint dims the prefix words and fades by opacity, not colour", () => {
    const html = renderToStaticMarkup(<ScrollTint text="Ми не зупиняємо роботу — ми не даємо записати" dimUntil={4} />);
    const visible = html.slice(html.indexOf('aria-hidden="true"'));
    expect(visible.match(/text-ink-muted/g)).toHaveLength(4);
    expect(visible).toContain("opacity:0.14");
    expect(visible).not.toContain("color:var(--gp-text-subtle)");
  });
  it("Reveal takes a horizontal offset and a size", () => {
    const html = renderToStaticMarkup(<Reveal x={-20} y={0} size="stately"><p>картка</p></Reveal>);
    expect(html).toContain("translateX(-20px)");
  });
  it("StaggerItem can arrive from scale 0", () => {
    const html = renderToStaticMarkup(<Stagger delay={0.35} step="loose"><StaggerItem from="scale"><i /></StaggerItem></Stagger>);
    expect(html).toContain("scale(0)");
  });
});
```

- [ ] **Step 2: Run, expect failure** (unknown props are type errors at typecheck; at runtime the assertions fail).

- [ ] **Step 3: `ScrollTint`** — replace the file body from `export function ScrollTint` to the end with:

```tsx
type ScrollOffset = NonNullable<Parameters<typeof useScroll>[0]>["offset"];

export function ScrollTint({
  text, className, offset = ["start 0.85", "end 0.6"], dimUntil = 0,
}: {
  text: string;
  className?: string | undefined;
  /** The scroll range the words fade across. The problem statement uses the default; the position quote passes `["start 0.85", "start 0.45"]` (prototype l.1155). */
  offset?: ScrollOffset | undefined;
  /** The first N words are set in `text-ink-muted` — the quote's «Ми не зупиняємо роботу на майданчику —» prefix. */
  dimUntil?: number | undefined;
}) {
  const reduced = useReduced();
  const words = text.split(" ");

  if (reduced) {
    return (
      <p className={className}>
        <span className="sr-only">{text}</span>
        <span aria-hidden="true">
          {words.map((word, i) => (
            <Fragment key={`${word}-${i}`}>
              <span className={i < dimUntil ? "inline-block text-ink-muted" : "inline-block text-ink"}>{word}</span>
              {i < words.length - 1 ? " " : ""}
            </Fragment>
          ))}
        </span>
      </p>
    );
  }

  return <AnimatedScrollTint text={text} className={className} offset={offset} dimUntil={dimUntil} />;
}

function AnimatedScrollTint({
  text, className, offset, dimUntil,
}: {
  text: string;
  className?: string | undefined;
  offset: ScrollOffset;
  dimUntil: number;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset });
  const words = text.split(" ");

  return (
    <p ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <Fragment key={`${word}-${i}`}>
            <Word progress={scrollYProgress} index={i} total={words.length} dim={i < dimUntil}>
              {word}
            </Word>
            {i < words.length - 1 ? " " : ""}
          </Fragment>
        ))}
      </span>
    </p>
  );
}

/** The prototype's resting word: `opacity: .14` (index.html l.175, l.298). */
const REST = 0.14;

function Word({
  children, progress, index, total, dim,
}: {
  children: React.ReactNode;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  index: number;
  total: number;
  dim: boolean;
}) {
  // Each word owns a slice of the scroll range and fades across it. The slices
  // overlap by half a step so the leading edge reads as a sweep rather than as
  // a row of independent switches.
  const start = index / total;
  const end = Math.min(1, (index + 1.5) / total);
  const opacity = useTransform(progress, [start, end], [REST, 1]);
  return (
    <motion.span className={dim ? "inline-block text-ink-muted" : "inline-block"} style={{ opacity }}>
      {children}
    </motion.span>
  );
}
```

Rewrite the header comment: the words fade `opacity .14 → 1` (the prototype's `.w`), not colour; «This is the ONE place» → «Two uses on the landing — the problem statement and the position quote — each named in spec 2026-09-06 §3; a third is a spec change»; drop «Colour comes from role tokens» paragraph (the dim prefix is `text-ink-muted`, a role).

- [ ] **Step 4: `Reveal`** — new signature and body:

```tsx
export function Reveal({
  children, delay = 0, y = 16, x = 0, size = "slow", className,
}: {
  children: ReactNode;
  /** Seconds. Prefer <Stagger> over hand-delaying siblings. */
  delay?: number | undefined;
  /** Rise distance. 0 for an element that must not move (a figure, a table row). */
  y?: number | undefined;
  /** Horizontal entry: −20 slides in from the left, 20 from the right (the compare cards, prototype l.1166). */
  x?: number | undefined;
  /** `slow` 400ms (the system's reveal); `stately` 900ms and `grand` 1200ms are the prototype's two entrance families (spec 2026-09-06 §6). */
  size?: "slow" | "stately" | "grand" | undefined;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, x, y }}
      whileInView={reduced ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={
        reduced
          ? { duration: REDUCED.duration, ease: REDUCED.ease, delay: 0 }
          : { duration: DURATION[size], ease: EASE.enter, delay }
      }
    >
      {children}
    </motion.div>
  );
}
```

Add to the header: «`size` exists because the prototype enters copy at 900ms and the hero at 1200ms; the default stays 400ms so every caller outside the landing is unchanged.»

- [ ] **Step 5: `Stagger` / `StaggerItem`:**

```tsx
const container = (step: number, delay: number) => ({
  hidden: {},
  shown: { transition: { staggerChildren: step, delayChildren: 0.04 + delay } },
});

const child = (reduced: boolean, y: number, from: "rise" | "scale") => ({
  hidden: reduced ? { opacity: 0 } : from === "scale" ? { opacity: 0, scale: 0 } : { opacity: 0, y },
  shown: reduced
    ? { opacity: 1, transition: { duration: REDUCED.duration, ease: REDUCED.ease } }
    : from === "scale"
      ? { opacity: 1, scale: 1, transition: { duration: DURATION.deliberate, ease: EASE.emphatic } }
      : { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE.enter } },
});

export function Stagger({
  children, step = "default", delay = 0, className,
}: {
  children: ReactNode;
  step?: keyof typeof STAGGER | undefined;
  /** Seconds before the first child — the compare checks wait .35s after the card lands (prototype l.1168). */
  delay?: number | undefined;
  className?: string | undefined;
}) {
  return (
    <motion.div
      className={className}
      variants={container(STAGGER[step], delay)}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children, y = 16, from = "rise", className,
}: {
  children: ReactNode;
  y?: number | undefined;
  /** `scale` — the check mark that pops from nothing (prototype `.cmp-card.now li i`, l.617), `ease.emphatic` over `duration.deliberate`. */
  from?: "rise" | "scale" | undefined;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    <motion.div className={className} variants={child(reduced, y, from)}>
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 6: Run** — `pnpm --filter @goproceed/landing test && pnpm turbo run typecheck && node packages/testing/qa/motion-audit.mjs` → PASS (`landing-render` still sees the statement's words; `ui-components` ScrollTint gap test unchanged).

- [ ] **Step 7: Commit** — `feat(motion): ScrollTint fades by opacity with a muted prefix; Reveal takes x and size; StaggerItem can pop from scale (spec 2026-09-06 §4.7)`.

---

### Task 10: The four CSS loops and `Chip pulse`

**Files:**
- Modify: `packages/ui/src/base.css` (`@utility beam`, the `[data-settled="true"] .beam` rule, new `@utility pulse-dot`, `drift-a/b/c`, `flow-dash`, `media-tint-1…5`, `media-glow`, `media-glow-cobalt/-sand/-green`, keyframes in `@theme`)
- Modify: `packages/ui/src/components/Chip.tsx`
- Test: `apps/landing/tests/ui-components.test.tsx` (Chip), `packages/testing/src/motion-audit.test.ts` (product stays clean)

**Interfaces:**
- Produces: utilities `beam` (now infinite from first paint), `pulse-dot`, `drift-a`, `drift-b`, `drift-c`, `flow-dash`, `media-tint-1`…`media-tint-5`, `media-glow`, `media-glow-cobalt`, `media-glow-sand`, `media-glow-green`; `Chip` prop `pulse?: boolean`.

- [ ] **Step 1: Failing test** — in `ui-components.test.tsx`, inside `describe("Chip dot", …)` add:

```tsx
  it("pulses the dot only when asked, and only with a dot", () => {
    const pulsing = renderToStaticMarkup(<Chip tone="review" dot pulse>на розгляді</Chip>);
    expect(pulsing).toContain('data-chip-dot="true"');
    expect(pulsing).toContain("pulse-dot");
    expect(renderToStaticMarkup(<Chip tone="review" dot>на розгляді</Chip>)).not.toContain("pulse-dot");
    expect(renderToStaticMarkup(<Chip tone="review" pulse>на розгляді</Chip>)).not.toContain("pulse-dot");
  });
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: `Chip`** — add the prop and the class:

```tsx
export function Chip({
  tone = "idle", children, className, interactive = false, dot = false, pulse = false,
}: {
  tone?: ChipTone | undefined;
  children: ReactNode;
  className?: string | undefined;
  /** A chip inside a filter is a control and takes the touch floor. */
  interactive?: boolean | undefined;
  /** A leading dot in the chip's own colour — the landing's status tags carry one. Never the only signal: the label still names the state. */
  dot?: boolean | undefined;
  /** The dot breathes (prototype `.tag.rv::before`, index.html l.112): 1.6s, opacity .3↔1, scale .8↔1.1. One of the five named perpetual loops; the landing passes it for review-tone tags, the app never does. Needs `dot`. */
  pulse?: boolean | undefined;
}) {
```

and the dot line:

```tsx
      {dot && <i aria-hidden="true" data-chip-dot="true" className={pulse ? "pulse-dot size-1.5 shrink-0 rounded-pill bg-current opacity-80" : "size-1.5 shrink-0 rounded-pill bg-current opacity-80"} />}
```

- [ ] **Step 4: `base.css`** — replace the beam block:

```css
/* Border Beam — 21st.dev's ring of light that runs around a frame's edge
 * (Magic UI border-beam is the reference; ours stays a CSS conic ring). A
 * conic gradient masked to a 1px ring, rotated by a registered custom
 * property so the angle itself animates. INFINITE from the first paint, as the
 * prototype runs it (index.html l.514, `beam 7s linear infinite`) — one of the
 * five named loops (spec 2026-09-06 §5.1). Until 2026-09-06 it ran twice after
 * `data-settled`; `ScrollSettle` still sets that attribute for the QA harness,
 * the ring no longer waits for it. Under reduced motion the unlayered block
 * below drops the iteration count to one and the duration to nothing, so the
 * ring is simply absent. */
```

and in `@utility beam` drop `opacity: 0;`, add `animation: gp-beam 7s linear infinite;`, delete the `[data-settled="true"] .beam { … }` rule. The `gp-beam` keyframes lose their `opacity: 1` pair (only `--gp-beam-angle` animates).

After the `spotlight` utility add:

```css
/* The review dot's pulse — the prototype's `.tag.rv::before` (index.html
 * l.112–113). Named loop 3 of 5. `ease.soft` is the system's symmetric curve;
 * a heartbeat has no direction. */
@utility pulse-dot {
  animation: gp-pulse 1.6s var(--gp-ease-soft) infinite;
}

/* The hero's idle drift — the receipt and the two pills breathe by a degree
 * (index.html l.1138: rotate ±1.2° over 4s, ∓1° over 5s, ±1° over 6s, yoyo).
 * Named loop 4 of 5. Three phases so the three layers never move in step. */
@utility drift-a { animation: gp-drift-a 4s var(--gp-ease-soft) infinite alternate; }
@utility drift-b { animation: gp-drift-b 5s var(--gp-ease-soft) infinite alternate; }
@utility drift-c { animation: gp-drift-c 6s var(--gp-ease-soft) infinite alternate; }

/* The dashed lines converging on one EV record (index.html l.343–344):
 * `stroke-dashoffset` walks −22 every 1.6s so the dashes travel toward the
 * record. Named loop 5 of 5. */
@utility flow-dash {
  stroke-dasharray: 4 7;
  animation: gp-flow 1.6s linear infinite;
}

/* The route cards' tinted media grounds (index.html l.247–253), in roles.
 * Each is a gradient of the soft status grounds over the canvas at partial
 * alpha; card 1 sits over the blueprint photograph, which the block renders
 * beneath with next/image. The sand of the prototype maps to the attention
 * ground — the nearest role, and no new colour is added for a background. */
@utility media-tint-1 { background-image: linear-gradient(160deg, color-mix(in srgb, var(--gp-bg-accent-soft) 92%, transparent), color-mix(in srgb, var(--gp-bg-canvas) 90%, transparent)); }
@utility media-tint-2 { background-image: linear-gradient(200deg, var(--gp-status-attention-surface) 0%, var(--gp-bg-canvas) 55%, var(--gp-bg-accent-soft) 100%); }
@utility media-tint-3 { background-image: linear-gradient(160deg, var(--gp-status-ready-surface) 0%, var(--gp-bg-canvas) 60%, var(--gp-bg-accent-soft) 100%); }
@utility media-tint-4 { background-image: linear-gradient(200deg, var(--gp-bg-accent-soft) 0%, var(--gp-bg-canvas) 50%, var(--gp-status-ready-surface) 100%); }
@utility media-tint-5 { background-image: linear-gradient(160deg, var(--gp-status-attention-surface) 0%, var(--gp-bg-canvas) 60%, var(--gp-bg-accent-soft) 100%); }

/* The blurred glow behind a route card's UI panel (`.glowc`, l.252–253). */
@utility media-glow {
  position: absolute;
  width: 70%;
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(50px);
  opacity: 0.7;
  z-index: -1;
  pointer-events: none;
}
@utility media-glow-cobalt { background: color-mix(in srgb, var(--gp-bg-signal) 16%, transparent); }
@utility media-glow-sand { background: color-mix(in srgb, var(--gp-status-attention-fg) 18%, transparent); }
@utility media-glow-green { background: color-mix(in srgb, var(--gp-status-ready-fg) 14%, transparent); }
```

In the `@theme { … }` keyframes block add:

```css
  @keyframes gp-pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50%      { opacity: 1;   transform: scale(1.1); }
  }
  @keyframes gp-drift-a { from { transform: rotate(0deg); } to { transform: rotate(1.2deg); } }
  @keyframes gp-drift-b { from { transform: rotate(0deg); } to { transform: rotate(-1deg); } }
  @keyframes gp-drift-c { from { transform: rotate(0deg); } to { transform: rotate(1deg); } }
  @keyframes gp-flow { to { stroke-dashoffset: -22; } }
```

The seven role variables above are the generator's exact spelling in `packages/ui/src/tokens.generated.css` (verified 2026-09-06): `--gp-status-attention-surface`, `--gp-status-ready-surface`, `--gp-status-attention-fg`, `--gp-status-ready-fg`, `--gp-bg-accent-soft`, `--gp-bg-signal`, `--gp-bg-canvas`.

- [ ] **Step 5: The ScrollSettle test** — `ui-components.test.tsx` `describe("ScrollSettle")` still asserts `class="beam"`; it stays true. Run: `pnpm --filter @goproceed/landing test && pnpm --filter @goproceed/testing test -- motion-audit && node packages/testing/qa/motion-audit.mjs && pnpm --filter @goproceed/landing build` → PASS, clean, build green (the build proves the utilities compile).

- [ ] **Step 6: Commit** — `feat(ui): the four ambient loops (infinite beam, pulse-dot, drift, flow-dash), the route media tints and glows, Chip pulse (spec 2026-09-06 §5.1–5.2, §5.4)`.

---

### Task 11: Components — `Button` lift, `Accordion` timing, `Compare` shadow and checks, `FeatureCell` tilt

**Files:**
- Modify: `packages/ui/src/components/Button.tsx:75-78` (BASE), `Accordion.tsx:53-57,70-71`, `Compare.tsx`, `FeatureGrid.tsx`
- Test: `apps/landing/tests/ui-components.test.tsx`

**Interfaces:**
- Produces: `CompareCard({ …, animateChecks?: boolean })`; `FeatureCell` output contains `data-tilt`; `FeatureGrid` carries `[perspective:1600px]`.

- [ ] **Step 1: Failing tests** (in `ui-components.test.tsx`; extend the imports as needed):

```tsx
describe("prototype parity — components (2026-09-06)", () => {
  it("Button lifts a pixel on hover on the emphatic curve", () => {
    const html = renderToStaticMarkup(<Button size="lg">Обговорити пілот</Button>);
    expect(html).toContain("hover:-translate-y-px");
    expect(html).toContain("ease-emphatic");
    expect(renderToStaticMarkup(<Button variant="link">лист</Button>)).not.toContain("hover:-translate-y-px");
  });
  it("Accordion opens over the deliberate duration on the emphatic curve", () => {
    const html = renderToStaticMarkup(<Accordion marker="plus" entries={[{ id: "a", question: "Питання?", answer: "Відповідь." }]} />);
    expect(html).toContain("duration-deliberate");
    expect(html).toContain("ease-emphatic");
    expect(html).not.toContain("duration-base");
  });
  it("the «now» compare card carries the accent shadow and pops its checks when asked", () => {
    const rows = [{ key: "photo" as const, question: "Де фото?", answer: "На роботі W-014" }];
    const still = renderToStaticMarkup(<CompareCard tone="now" eyebrow="З GoProceed" title="Один запис" rows={rows} outcome="Акт не повертають." />);
    expect(still).toContain("shadow-float-accent");
    expect(still).not.toContain("scale(0)");
    const popping = renderToStaticMarkup(<CompareCard tone="now" eyebrow="З GoProceed" title="Один запис" rows={rows} outcome="Акт не повертають." animateChecks />);
    expect(popping).toContain("scale(0)");
  });
  it("FeatureCell leans, FeatureGrid supplies the perspective", () => {
    const html = renderToStaticMarkup(<FeatureGrid columns={4}><FeatureCell title="ПТВ">біль</FeatureCell></FeatureGrid>);
    expect(html).toContain("perspective:1600px");
    expect(html).toContain('data-tilt="off"');
    expect(html).toContain('data-slot="feature-cell"');
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: `Button`** — BASE becomes:

```ts
const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control " +
  "font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-base ease-emphatic " +
  "disabled:pointer-events-none disabled:opacity-50";
```

and in `Button()` the size line:

```ts
    variant === "link" ? "h-auto px-0 touch:min-h-(--gp-control-height-touch)" : `${SIZE[size]} hover:-translate-y-px`,
```

— that is a template literal joining two LITERAL class strings, which the scanner reads whole (both halves appear verbatim in the source); the rule forbids `bg-${tone}`-style dynamic segments, not this. Header addition: «[2026-09-06] Every sized button lifts one pixel on hover over `duration.base` on the emphatic curve — the prototype's `.btn:hover{transform:translateY(-1px)}` (index.html l.526–528). Colour transitions move from `fast` to `base` with it: one transition list, one duration (spec 2026-09-06 §6).»

- [ ] **Step 4: `Accordion`** — in the plus marker and both `<i>` replace `duration-base ease-out` with `duration-deliberate ease-emphatic`; in the chevron `duration-base ease-out` → `duration-deliberate ease-emphatic`; in `RadixAccordion.Content` `"duration-base ease-out data-[state=open]:grid-rows-[1fr]"` → `"duration-deliberate ease-emphatic data-[state=open]:grid-rows-[1fr]"`. Header addition: «[2026-09-06] Opens over `duration.deliberate` on `ease.emphatic` — the prototype's `.6s expo.out` (index.html l.1074).»

- [ ] **Step 5: `Compare`** — `TONE.now` → `"border-line-accent bg-surface shadow-float-accent md:-translate-y-3"`; add `import { Stagger, StaggerItem } from "../motion/Stagger";`; add prop `animateChecks?: boolean | undefined` («the landing wraps the check marks in a `Stagger step="loose" delay={0.35}` so they pop in turn once the card is in view (prototype l.1168); off by default, so the server-rendered card stays static in tests and in the app»); the list becomes:

```tsx
      {animateChecks && now ? (
        <Stagger step="loose" delay={0.35} className="contents">
          <ul>{rows.map((row) => <Row key={row.key} row={row} now={now} pop />)}</ul>
        </Stagger>
      ) : (
        <ul>{rows.map((row) => <Row key={row.key} row={row} now={now} pop={false} />)}</ul>
      )}
```

with a `Row` component extracted from the current `<li>` body whose check icon is

```tsx
  const check = (
    <span className="mt-0.5 grid size-5 place-items-center rounded-pill border border-status-ready-fg text-status-ready-fg">
      <Check aria-hidden="true" strokeWidth={2} className="size-3" />
    </span>
  );
  // … inside the <li>:
  {now ? (pop ? <StaggerItem from="scale" className="contents">{check}</StaggerItem> : check) : <span aria-hidden="true" className="mt-0.5 size-5 rounded-pill border border-line-strong bg-[linear-gradient(135deg,transparent_44%,var(--gp-border-strong)_44%_56%,transparent_56%)]" />}
```

Header addition: «[2026-09-06] The «now» card takes `shadow-float-accent` — the prototype's cobalt shadow (l.607) and the system's one coloured shadow.»

- [ ] **Step 6: `FeatureGrid`** — `import { Tilt } from "../motion/Tilt";`; `FeatureGrid`'s class gains `[perspective:1600px]`; `FeatureCell` wraps its article:

```tsx
  return (
    <Tilt maxX={2.5} maxY={3} className="grid">
      <article … (unchanged) >
        …
      </article>
    </Tilt>
  );
```

Header addition: «[2026-09-06] Each cell leans toward the pointer through `Tilt` (rotateX ±2.5°, rotateY ±3°, the prototype's `[data-spot]` tilt, index.html l.1159); the grid supplies the perspective (`.cards3{perspective:1600px}`).» The cell's `bg-surface` stays on the article; the Tilt wrapper is transparent, so the 1px gaps still show the container's line.

- [ ] **Step 7: Run** — `pnpm --filter @goproceed/landing test && pnpm turbo run typecheck && node packages/testing/qa/motion-audit.mjs` → PASS.

- [ ] **Step 8: Commit** — `feat(ui): Button hover lift, Accordion on deliberate/emphatic, Compare accent shadow and popping checks, FeatureCell tilt (spec 2026-09-06 §5.4)`.

---

### Task 12: Hero — lines, depth, tilt, drift, pulse, magnetism

**Files:**
- Modify: `apps/landing/components/blocks/hero.tsx`, `apps/landing/components/visuals/product-frame.tsx`, `visuals/board.tsx`, `visuals/receipt.tsx`
- Test: `apps/landing/tests/landing-render.test.tsx:59-75`

**Interfaces:**
- Consumes: `LineReveal`, `Depth`, `Tilt`, `Magnetic`, `Reveal size`, `Chip pulse`, `drift-*`.

- [ ] **Step 1: Failing tests** — in `landing-render.test.tsx`, `describe` for the hero: change the first hero test's title to `opens with the pill, the promise line by line, two magnetic actions and three facts` and add expectations; add a depth/tilt test:

```tsx
  it("opens with the pill, the promise line by line, two magnetic actions and three facts", () => {
    expect(hero).toContain(landingContent.hero.pill.badge);
    expect(hero.match(/<h1/g)).toHaveLength(1);
    // LineReveal: the h1 text once for readers, once as words; the accent marked.
    expect(hero).toContain(`class="sr-only">${landingContent.hero.title}<`);
    expect(hero.match(/data-accent="true"/g)?.length).toBeGreaterThanOrEqual(1);
    expect(hero.match(/data-magnetic="off"/g)).toHaveLength(3); // pill + two buttons
    for (const f of landingContent.hero.facts) expect(hero).toContain(f.value);
  });
  it("layers the receipt and the two pills at depth, tilts the board and pulses the review tags", () => {
    expect(hero).toContain('data-depth="-0.3"');
    expect(hero).toContain('data-depth="0.35"');
    expect(hero).toContain('data-depth="0.25"');
    expect(hero.match(/data-tilt="off"/g)).toHaveLength(1);
    expect(hero.match(/pulse-dot/g)).toHaveLength(2); // the two review cards on the board
    expect(hero).toContain("drift-a");
    expect(hero).toContain("drift-b");
    expect(hero).toContain("drift-c");
  });
```

Keep the existing facts/board/beam assertions (the beam class is still present).

- [ ] **Step 2: Run, expect failure** — `pnpm --filter @goproceed/landing test -- landing-render`.

- [ ] **Step 3: `hero.tsx`**

```tsx
import { ArrowRight } from "lucide-react";
import { Button, Pill, PillContent } from "@goproceed/ui/components";
import { LineReveal, Magnetic, Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { ProductFrame } from "../visuals/product-frame";

/**
 * The hero, timed as the prototype times it (index.html l.1105, l.1109–1113):
 * the h1 rises line by line from .1s; the pill, lead, actions and facts are
 * `[data-up]` entrances at `stately`; the frame follows at .35s (product-frame).
 */
export function Hero() {
  const h = landingContent.hero;
  return (
    <section id="hero" className="px-4 pt-32 md:px-8 md:pt-36">
      <div className="mx-auto max-w-marketing">
        <div className="mx-auto grid max-w-[780px] justify-items-center text-center">
          <Reveal size="stately">
            <Magnetic>
              <Pill asChild>
                <a href={h.pill.href}><PillContent badge={h.pill.badge}>{h.pill.text}</PillContent></a>
              </Pill>
            </Magnetic>
          </Reveal>
          <LineReveal as="h1" text={h.title} accent={h.titleAccent} delay={0.1} className="display mt-5 max-w-[16ch] text-mkt-display-1 tracking-tightest text-ink" />
          <Reveal delay={0.15} size="stately"><p className="measure mt-5 text-mkt-lead leading-relaxed text-ink-secondary">{h.lead}</p></Reveal>
          <Reveal delay={0.25} size="stately" className="mt-6 flex flex-wrap justify-center gap-2.5">
            <Magnetic><Button asChild size="lg"><a href="#pilot">{h.primaryAction}</a></Button></Magnetic>
            <Magnetic>
              <Button asChild size="lg" variant="outline">
                <a href={h.secondaryHref}>{h.secondaryAction}<ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.6} /></a>
              </Button>
            </Magnetic>
          </Reveal>
          <Reveal delay={0.3} size="stately" className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-left text-data text-ink-muted">
            {h.facts.map((f) => (
              <p key={f.value}><b className="block font-medium text-ink">{f.value}</b>{f.label}</p>
            ))}
          </Reveal>
        </div>
        <ProductFrame />
      </div>
    </section>
  );
}
```

If `landingContent.hero.title` does not contain `landingContent.hero.titleAccent` as a substring the render test fails loudly — it does today (the previous code sliced on `indexOf`).

- [ ] **Step 4: `product-frame.tsx`**

```tsx
import { Depth, Reveal, ScrollSettle, Stagger, StaggerItem, Tilt } from "@goproceed/ui/motion";
import { demoRecords } from "../../content/demo-records";
import { landingContent } from "../../content/landing-content";
import { Board } from "./board";
import { Receipt } from "./receipt";

/**
 * 21st.dev's Container Scroll: the board settles into the page (`ScrollSettle`)
 * and leans toward the pointer anywhere in the hero (`Tilt area="section"`,
 * prototype l.1139); the receipt and two pills sit over it at depth
 * (`data-depth` −0.3 / .35 / .25, l.1116) and breathe (`drift-*`, l.1138).
 * Entrance timing is the prototype's timeline (l.1109–1113).
 */
export function ProductFrame() {
  const pills = demoRecords.receipt.pills;
  return (
    <Reveal delay={0.35} size="grand" y={60} className="mt-11 md:mt-16">
      <ScrollSettle className="pb-4 md:pb-24">
        <div className="relative mx-auto max-w-[1040px]">
          <Tilt area="section" maxX={1.5} maxY={2}><Board /></Tilt>
          <Depth depth={-0.3} className="md:absolute md:-bottom-20 md:right-[-3%] md:w-[236px]">
            <Reveal delay={0.7} size="grand" x={20} y={40}><div className="drift-a"><Receipt /></div></Reveal>
          </Depth>
          <Stagger step="loose" delay={0.9} className="hidden md:contents">
            <StaggerItem y={20} className="absolute -bottom-9 left-0">
              <Depth depth={0.35}>
                <span className="drift-b inline-block whitespace-nowrap rounded-pill border border-line-strong bg-surface px-3 py-1.5 text-data text-ink-secondary shadow-overlay">
                  <b className="font-medium text-ink">{pills[0]!.lead}</b> {pills[0]!.text}
                </span>
              </Depth>
            </StaggerItem>
            <StaggerItem y={20} className="absolute -top-12 left-0">
              <Depth depth={0.25}>
                <span className="drift-c inline-block whitespace-nowrap rounded-pill border border-line-strong bg-surface px-3 py-1.5 text-data text-ink-secondary shadow-overlay">
                  {pills[1]!.text}<b className="font-medium text-ink">{pills[1]!.lead}</b>
                </span>
              </Depth>
            </StaggerItem>
          </Stagger>
        </div>
        <p aria-hidden="true" className="mt-24 hidden items-center gap-2.5 font-mono text-micro uppercase tracking-wide text-ink-subtle md:flex">
          <span className="h-px flex-1 bg-line-strong" />
          {landingContent.hero.dimension}
          <span className="h-px flex-1 bg-line-strong" />
        </p>
      </ScrollSettle>
    </Reveal>
  );
}
```

`receipt.tsx`: the `<aside>` loses its positioning classes (`md:absolute md:-bottom-20 md:right-[-3%] md:w-[236px]`), which moved to the `Depth` wrapper, and keeps `w-full rounded-card border border-line-strong bg-surface p-3.5 text-meta shadow-float`. The `Board` component's outer div keeps `relative overflow-hidden` (the beam's host); `ScrollSettle`'s `perspective: 1500` already covers the tilt.

- [ ] **Step 5: `board.tsx`** — the card chip becomes `<Chip tone={card.tone} dot pulse={card.tone === "review"} className="w-fit px-2 py-0.5 text-micro">{card.tag}</Chip>`; `Stagger` on the cards gains `delay={0.7}`; the `CountUp` stays (its duration is `deliberate`; the prototype's 1.6s rounds to `grand` in spec §6 — `CountUp` takes no size prop, and the counter is not on the parity table's «restore» list, so it stays as it is; record nothing).

- [ ] **Step 6: Run** — `pnpm --filter @goproceed/landing test && pnpm turbo run typecheck && node packages/testing/qa/motion-audit.mjs && pnpm --filter @goproceed/landing build` → PASS. Then `pnpm --filter @goproceed/landing qa`: at 1440 the receipt sits at the board's bottom-right and the pills at its corners as before (compare `qa-output/1440-00.png` with the before-set in the session scratchpad `before/1440-00.png`); at 390 the receipt stacks under the board.

- [ ] **Step 7: Commit** — `feat(landing): hero — the h1 line by line, the frame at depth, tilt, drift and pulse, magnetic actions (spec 2026-09-06 §3 rows 1a–1g)`.

---

### Task 13: Headings, the problem statement, the position quote, FAQ and CTA

**Files:**
- Modify: `apps/landing/components/blocks/section-head.tsx`, `problem.tsx`, `position.tsx`, `faq.tsx`, `cta.tsx`, `share-link.tsx`, `pilot-form.tsx:128-129,140`
- Delete: `apps/landing/components/blocks/accent-text.tsx` if nothing imports it afterwards (`route.tsx` still does — keep it until Task 15 removes that import, then delete there)
- Test: `apps/landing/tests/landing-render.test.tsx`

- [ ] **Step 1: Failing tests** — add to `landing-render.test.tsx`:

```tsx
describe("prototype parity — headings and statements (2026-09-06)", () => {
  it("sets every section heading line by line", () => {
    // Eight h2.lines in the prototype: compare, roles, stages, capture, trust, pilot, faq, cta.
    const h2s = html.match(/<h2[^>]*>/g) ?? [];
    expect(h2s).toHaveLength(8);
    expect(html.match(/<h2[^>]*><span class="sr-only">/g)).toHaveLength(8);
  });
  it("dims the quote's prefix and fades both statements by opacity", () => {
    const position = section("position", "capture");
    const prefixWords = landingContent.position.quoteDim.split(" ").length;
    expect(position.match(/text-ink-muted/g)?.length).toBeGreaterThanOrEqual(prefixWords);
    expect(position).toContain("opacity:0.14");
    expect(section("problem", "compare")).toContain("opacity:0.14");
  });
  it("magnetises every marketing button but the header's", () => {
    const magnetic = html.match(/data-magnetic="off"/g) ?? [];
    // hero pill + 2, cta 2, pilot form 2 (the mail fallback renders only in the failed state)
    expect(magnetic).toHaveLength(7);
    expect(html.slice(0, html.indexOf('id="main-content"'))).not.toContain("data-magnetic");
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: `section-head.tsx`** — replace the `<Reveal><h2 …><AccentText …/></h2></Reveal>` with

```tsx
        <LineReveal as="h2" text={title} accent={titleAccent} className="display mt-3.5 max-w-[20ch] text-mkt-display-2 text-ink" />
```

(import `LineReveal, Reveal` from `@goproceed/ui/motion`, drop the `AccentText` import); the eyebrow and lead `Reveal`s gain `size="stately"`.

- [ ] **Step 4: `problem.tsx`** — the statement stays `ScrollTint` (its default offset is the prototype's); the aside `Reveal` gains `size="stately"`.

- [ ] **Step 5: `position.tsx`** — replace the quote `<Reveal><p …>…</p></Reveal>` with

```tsx
            <ScrollTint
              text={`${p.quoteDim} ${p.quote}`}
              dimUntil={p.quoteDim.split(" ").length}
              offset={["start 0.85", "start 0.45"]}
              className="display text-[clamp(24px,3vw,40px)] font-medium leading-tight tracking-tight text-ink"
            />
```

The accent inside the quote (`p.quoteAccent`) is lost by `ScrollTint`, which has no accent prop — and the prototype's `em` inside `#quote` IS accented (l.889). Give `ScrollTint` an `accent?: string` that marks words exactly as `splitAccent` does (reuse it: `import { splitAccent } from "./LineReveal"`), adding `text-accent` to those word spans in both branches; add to the Task 9 test: `expect(renderToStaticMarkup(<ScrollTint text="поки доказ не отримано" accent="доказ" />).match(/text-accent/g)).toHaveLength(1);`. Then pass `accent={p.quoteAccent}` here. The pills' `Stagger` stays; the eyebrow `Reveal` gains `size="stately"`.

- [ ] **Step 6: `faq.tsx`** — `<LineReveal as="h2" text={q.title} accent={q.titleAccent} className="display mt-3.5 max-w-[12ch] text-mkt-display-2 text-ink" />` replaces the `Reveal`+`h2`+`AccentText`.

- [ ] **Step 7: `cta.tsx`** — the h2 becomes `<LineReveal as="h2" text={c.title} accent={c.titleAccent} className="display max-w-[18ch] text-[clamp(26px,3vw,38px)] leading-tight tracking-tight text-ink" />` (drop `TextBlurIn` and the `at` slicing); the two actions are wrapped: `<Magnetic><Button asChild size="lg"><a href="#pilot">{c.primary}</a></Button></Magnetic>` and `<Magnetic><ShareLink /></Magnetic>`; both `Reveal`s gain `size="stately"`. Update the file comment: «Cta-4 … The h2 rises line by line like every heading; `TextBlurIn` leaves the page (its two uses were the h1 and this — both are `LineReveal` now).»

- [ ] **Step 8: `pilot-form.tsx`** — wrap the submit and copy buttons: `<Magnetic className="w-full"><Button type="submit" size="lg" className="w-full" …>` and the same for the copy button (the grid cell must stay full width — `Magnetic` is `inline-flex`, so `w-full` on both). The failed-state mail `Button` stays unwrapped (it appears inside a live region and moving it while it is announced is noise). Import `Magnetic` from `@goproceed/ui/motion`.

- [ ] **Step 9: Run** — `pnpm --filter @goproceed/landing test && pnpm turbo run typecheck && node packages/testing/qa/motion-audit.mjs` → PASS. `pilot-form.test.tsx` still finds its buttons by role.

- [ ] **Step 10: Commit** — `feat(landing): every heading line by line, the quote dimmed and faded on scroll, magnetic actions everywhere but the header (spec 2026-09-06 §3 rows 3a, 7, 11–12, all)`.

---

### Task 14: Compare, roles, provenance — entrances

**Files:**
- Modify: `apps/landing/components/blocks/compare.tsx`, `roles.tsx`, `provenance.tsx`
- Test: `apps/landing/tests/landing-render.test.tsx`

- [ ] **Step 1: Failing tests:**

```tsx
describe("prototype parity — compare, roles, provenance (2026-09-06)", () => {
  it("slides the two compare cards in from their sides and pops the checks", () => {
    const compare = section("compare", "roles");
    expect(compare).toContain("translateX(-20px)");
    expect(compare).toContain("translateX(20px)");
    expect(compare.match(/scale\(0\)/g)).toHaveLength(landingContent.compare.now.rows.length);
    expect(compare).toContain("shadow-float-accent");
  });
  it("staggers the four role cells, each leaning", () => {
    const roles = section("roles", "stages");
    expect(roles.match(/data-tilt="off"/g)).toHaveLength(4);
    expect(roles.match(/data-slot="feature-cell"/g)).toHaveLength(4);
  });
  it("staggers the three bento cells", () => {
    const trust = section("trust", "pilot");
    expect(trust.match(/data-slot="bento-cell"/g)).toHaveLength(3);
  });
});
```

(`BentoCell` already renders `data-slot="bento-cell"` — `Bento.tsx:27`.)

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: `compare.tsx`:**

```tsx
        <ComparePair>
          <Reveal x={-20} y={0} size="stately" className="order-1 grid">
            <CompareCard tone="was" eyebrow={c.was.eyebrow} title={c.was.title} rows={[...c.was.rows]} outcome={c.was.outcome} className="order-none" />
          </Reveal>
          <CompareArrow />
          <Reveal x={20} y={0} size="stately" delay={0.1} className="order-3 grid">
            <CompareCard tone="now" eyebrow={c.now.eyebrow} title={c.now.title} rows={c.now.rows.map((r) => ({ ...r }))} outcome={c.now.outcome} animateChecks className="order-none" />
          </Reveal>
        </ComparePair>
```

The `Reveal` wrappers take the grid order the cards carried (`order-1` / `order-3`, see `Compare.tsx`), and the cards get `order-none` so the wrapper decides. The `md:-translate-y-3` on the now card and the `Reveal`'s own transform are on different elements, so neither overrides the other.

- [ ] **Step 4: `roles.tsx`** — replace `<Reveal y={0}><FeatureGrid …>` with `<FeatureGrid columns={4}>` whose cells are each wrapped: the `FeatureGrid` is not a `Stagger` (a `motion.div` between the grid and its cells would break the 1px-gap grid), so give `FeatureGrid` a `stagger?: boolean` prop that renders `<Stagger className="contents">` around the children when true, and wrap each `FeatureCell` in `<StaggerItem key={cell.id} y={20} className="grid">`. Add the prop in `FeatureGrid.tsx` (import `Stagger` from `../motion/Stagger`); the `roles.tsx` grid becomes `<FeatureGrid columns={4} stagger>`. The `Reveal` wrapper goes.

- [ ] **Step 5: `provenance.tsx`** — replace `<Reveal y={0}><Bento>…</Bento></Reveal>` with `<Bento>` and wrap each of the three `BentoCell`s in `<StaggerItem y={30} className="grid">` … but the big cell spans two rows (`span="rows-2"` sets `md:row-span-2` on the cell); the wrapper would have to carry the span. Give `Bento` a `stagger?: boolean` that renders `<Stagger step="loose" className="contents">` around its children, and give `BentoCell` a `stagger?: boolean` that, when true, renders `<StaggerItem y={30} className={cx("grid", span === "rows-2" && "md:row-span-2")}>` around the article and drops `SPAN[span]` from the article's own class list (`Bento.tsx:14` — `const SPAN = { "rows-2": "md:row-span-2" }`). `provenance.tsx` passes `stagger` on the `Bento` and all three cells.

- [ ] **Step 6: Run** the landing tests, typecheck, audit → PASS. `ui-components.test.tsx`'s `FeatureGrid`/`Bento` tests still pass (the props default off).

- [ ] **Step 7: Commit** — `feat(landing): compare cards slide in and pop their checks; role and bento cells stagger (spec 2026-09-06 §3 rows 4, 5, 9)`.

---

### Task 15: Route stack, capture channels, pilot boxes

**Files:**
- Modify: `apps/landing/components/blocks/route.tsx`, `capture.tsx`, `pilot.tsx`, `apps/landing/components/visuals/spotlight-card.tsx`, `apps/landing/app/globals.css:144-150` (remove `.landing-route-card`)
- Delete: `apps/landing/components/blocks/accent-text.tsx` (last importer was `route.tsx`)
- Test: `apps/landing/tests/landing-render.test.tsx`

- [ ] **Step 1: Failing tests:**

```tsx
describe("prototype parity — route and capture (2026-09-06)", () => {
  const route = section("stages", "position");
  const capture = section("capture", "trust");
  it("stacks the five route cards in one ScrollStack, each media half tinted, glowing and leaning", () => {
    expect(route).toContain('data-scroll-stack="off"');
    expect(route.match(/data-stack-card="\d"/g)).toHaveLength(5);
    expect(route.match(/data-stack-media=""/g)).toHaveLength(5);
    for (const n of [1, 2, 3, 4, 5]) expect(route).toContain(`media-tint-${n}`);
    expect(route.match(/media-glow-/g)).toHaveLength(5);
    expect(route).not.toContain("landing-route-card");
  });
  it("tilts the three channel cards, pulses the pilot chip and flows the dashes to one record", () => {
    expect(capture.match(/data-tilt="off"/g)).toHaveLength(3);
    expect(capture.match(/pulse-dot/g)).toHaveLength(1);
    expect(capture.match(/flow-dash/g)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: `route.tsx`:**

```tsx
import type { ReactNode } from "react";
import Image from "next/image";
import { LineReveal, ScrollStack, ScrollStackCard, ScrollStackMedia } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import photoBlueprint from "../../public/images/photo-blueprint.jpg";
import { SectionHead } from "./section-head";
import { UiAct } from "../visuals/ui-act";
import { UiCapture } from "../visuals/ui-capture";
import { UiClosure } from "../visuals/ui-closure";
import { UiRequirement } from "../visuals/ui-requirement";
import { UiReview } from "../visuals/ui-review";

const MEDIA: ReactNode[] = [<UiRequirement key="1" />, <UiCapture key="2" />, <UiReview key="3" />, <UiClosure key="4" />, <UiAct key="5" />];

/** The prototype's five media grounds and glows (index.html l.247–253), as literal class strings per card. */
const TINT = ["media-tint-1", "media-tint-2", "media-tint-3", "media-tint-4", "media-tint-5"] as const;
const GLOW = [
  "media-glow media-glow-cobalt -right-[20%] -bottom-[30%]",
  "media-glow media-glow-sand -left-[20%] -top-[30%]",
  "media-glow media-glow-green -right-[20%] -top-[25%]",
  "media-glow media-glow-cobalt -left-[20%] -bottom-[30%]",
  "media-glow media-glow-sand -right-[15%] -bottom-[25%]",
] as const;

/**
 * Fora's sticky feature stack, as the prototype performs it: `ScrollStack`
 * pins each card under the header on wide screens, shrinks and veils it as the
 * next arrives, and drifts the UI panel inside the media half; the media half
 * is tinted and lit per card, card 1 over the blueprint photograph.
 */
export function Route() {
  const r = landingContent.route;
  return (
    <section id="stages" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={r.eyebrow} title={r.title} titleAccent={r.titleAccent} lead={r.lead}>
          <p className="mt-4 flex flex-wrap gap-1.5">
            {r.codes.map((c) => (
              <span key={c.code} className="rounded-control border border-line bg-surface px-2.5 py-1 text-meta text-ink-muted">
                <b className="mr-1.5 font-mono font-medium text-ink">{c.code}</b>{c.label}
              </span>
            ))}
          </p>
        </SectionHead>
        <ScrollStack className="grid gap-4">
          {r.steps.map((step, i) => {
            const flip = i % 2 === 1;
            return (
              <ScrollStackCard key={step.index} index={i} count={r.steps.length}>
                <article
                  data-route-card={flip ? "flip" : "card"}
                  className="grid overflow-hidden rounded-surface border border-line-strong bg-surface shadow-float wide:min-h-[min(600px,calc(100vh-130px))] wide:grid-cols-2"
                >
                  <div className={flip ? "flex flex-col gap-4 p-6 md:p-10 wide:order-2" : "flex flex-col gap-4 p-6 md:p-10"}>
                    <p className="flex items-center gap-2.5">
                      <span className="rounded-control border border-line-strong px-1.5 py-0.5 font-mono text-meta tracking-wide text-ink-muted">{step.index}</span>
                      <span className="index-label">{step.eyebrow}</span>
                    </p>
                    <h3 className="display max-w-[16ch] text-mkt-display-3 leading-tight tracking-tight text-ink">
                      <AccentSpan text={step.title} accent={step.titleAccent} />
                    </h3>
                    <p className="max-w-[44ch] text-body leading-relaxed text-ink-secondary">{step.body}</p>
                    <p className="mt-auto flex items-center gap-2.5 border-t border-line pt-5 text-data text-ink-muted">
                      <i aria-hidden="true" className="size-3.5 rounded-control border border-line-strong" />{step.note}
                    </p>
                  </div>
                  <div className={flip
                    ? `landing-media-grid relative isolate grid place-items-center overflow-hidden border-t border-line p-5 [perspective:1200px] md:p-10 wide:order-1 wide:border-r wide:border-t-0 ${TINT[i]!}`
                    : `landing-media-grid relative isolate grid place-items-center overflow-hidden border-t border-line p-5 [perspective:1200px] md:p-10 wide:border-l wide:border-t-0 ${TINT[i]!}`}>
                    {i === 0 && <Image src={photoBlueprint} alt="" fill sizes="(min-width: 1240px) 590px, 100vw" className="-z-20 object-cover" />}
                    <i aria-hidden="true" className={GLOW[i]!} />
                    <ScrollStackMedia className="w-full max-w-[460px]">{MEDIA[i]}</ScrollStackMedia>
                  </div>
                </article>
              </ScrollStackCard>
            );
          })}
        </ScrollStack>
      </div>
    </section>
  );
}

/** The card's h3 is NOT a `.lines` heading in the prototype (l.826): the card itself enters, the accent is static. */
function AccentSpan({ text, accent }: { text: string; accent: string }) {
  const at = text.indexOf(accent);
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<span className="text-accent" data-accent="true">{accent}</span>{text.slice(at + accent.length)}</>;
}
```

The `${TINT[i]!}` interpolation joins a literal from a `const` array — every class name appears verbatim in this file, which is what the scanner needs; the rule forbids `bg-${tone}`, a class the scanner cannot see. The `.landing-media-grid::before` grid layer (globals.css) sits at `z-index: -1`, above the photo (`-z-20`) and the glow (`z-index: -1` — same level; the glow is declared later in the DOM, so it paints above the grid, as the prototype's `.glowc` does).

`UiWindow` (`ui-window.tsx`) keeps `w-full max-w-[460px]`; `ScrollStackMedia` carries the same so the panel is centred as before.

`accent-text.tsx`: delete the file (`AccentSpan` above replaces its last use; `section-head`, `faq`, `position` stopped importing it in Task 13).

`globals.css`: delete the two `.landing-route-card` rules and their comment (lines ≈143–150); the sticky lives in `ScrollStackCard` now.

- [ ] **Step 4: `spotlight-card.tsx`** — wrap the article in `Tilt`:

```tsx
import { Tilt } from "@goproceed/ui/motion";
…
  return (
    <Tilt maxX={2.5} maxY={3} className="grid h-full">
      <article onPointerMove={onMove} className={className}>
        <i aria-hidden="true" className="spotlight -z-10 opacity-0 transition-opacity duration-slow ease-out group-hover:opacity-100" />
        {children}
      </article>
    </Tilt>
  );
```

- [ ] **Step 5: `capture.tsx`** — the `Stagger` gets `className="grid gap-3.5 md:grid-cols-3 [perspective:1600px]"`; the chip becomes `<Chip tone={ch.status.tone} dot pulse={ch.status.tone === "review"}>{ch.status.label}</Chip>`; the three `<path>`s get `className="flow-dash fill-none stroke-ink-subtle"` and lose the `strokeDasharray` attribute (the utility sets it); the closing `Reveal` gains `size="stately"`.

- [ ] **Step 6: `pilot.tsx`** — the boxes' `Stagger` keeps its step; the `Reveal` around the form gains `size="stately"`. Nothing else: the `Stepper` already reads the scroll (Task 8).

- [ ] **Step 7: Run** — `pnpm --filter @goproceed/landing test && pnpm turbo run typecheck && node packages/testing/qa/motion-audit.mjs && pnpm --filter @goproceed/landing build` → PASS; `grep -rn "accent-text\|landing-route-card" apps/landing` → nothing.

- [ ] **Step 8: Commit** — `feat(landing): the route as a ScrollStack with tinted, lit, leaning media; tilted channel cards, the pulsing pilot chip, dashes flowing to one record (spec 2026-09-06 §3 rows 6, 8, 10)`.

---

### Task 16: The documents — dated corrections

**Files:**
- Modify: `docs/design/02-building-ui.md` (§4.1 table, §4.2, §4.3 rules 5 and 9), `DESIGN.md:171-172, 160-164, 376-379`, `docs/superpowers/specs/2026-09-05-landing-daylight-design.md` (D4, F7, §6.2, §7), `docs/design/03-ui-references.md:147-158`, `docs/design/2026-08-19-design-system-rewrite-plan.md` (§8.3, after the 2026-08-30 block), `TODOS.md:3591,3598`, `packages/ui/src/motion/Marquee.tsx` header, `apps/landing/app/layout.tsx` (contract), `docs/design/04-role-pain-map.md` — untouched
- Test: `apps/landing/tests/design-contract.test.tsx:15`, `pnpm validate:canonical-docs`

- [ ] **Step 1: Failing test** — in `design-contract.test.tsx` change the expectation to `user-approved-daylight-parity-2026-09-06` and add `expect(html).toContain("FORM: Daylight parity");`.

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: `layout.tsx`** — `data-impeccable-contract="user-approved-daylight-parity-2026-09-06"`; in `DESIGN_CONTRACT` the FORM line becomes `FORM: Daylight parity — every animation design-references/contest-2026-09/daylight/index.html performs except Lenis, owner-approved 2026-09-06; the 2026-09-05 composition unchanged.` and OWN-WORLD's «no 3D» becomes «pointer tilt within 3°, no 3D scenes».

- [ ] **Step 4: `02-building-ui.md`** — §4.3 rule 5 line becomes:

```
5. No `transition: all`, no layout-property transition, no `ease-in`, no
   perpetual animation outside the five loops named in `motion-audit.mjs`'s
   `PERPETUAL_ALLOWLIST` → `motion-audit` 1–4
   [Correction, 2026-09-06: until this date the rule read «no perpetual
   animation but the marquee». The landing parity slice
   (`docs/superpowers/specs/2026-09-06-landing-prototype-parity-design.md` §5.1)
   restored the prototype's Border Beam, review-dot pulse, receipt/pill drift
   and dashed «flow» lines, so the allowlist names five loops and a test pins
   the list. A sixth is a §7.3 decision.]
```

rule 9:

```
9. Scroll-linked compositions are the ones the landing spec's block table
   names — one per section, each driven by one scroll source, none below `md`
   (`wide` for the sticky stack), none under reduced motion
   [Correction, 2026-09-06: was «At most two scroll-linked elements per page,
   and never in one fold». The parity spec §3 names them: the hero (settle +
   depth), the problem statement, the route stack, the position quote, the
   pilot stepper. Adding one is a spec change, not a prop.]
```

§4.2: `the sixteen motion primitives` → `the twenty-two motion primitives`. §4.1 table, new row after the `useTransform` row:

```
| `onPointerMove` + `style.transform` for a lean or a pointer follow | `Tilt` / `Magnetic` | Rule 5; and the gates (pointer:fine, `md`, reduced) live in the word, not in the caller |
```

- [ ] **Step 5: `DESIGN.md`** — line 171–172 becomes «Motion is the shared twenty-two-word vocabulary in `@goproceed/ui/motion`; the scroll-linked compositions are the ones the landing spec names, one per section.»; in «Structure is a 1px line…» add «Five shadows; `shadow-float-accent` is the mark's colour under the one card that is the product's promise [2026-09-06].»; the two Don'ts become:

```
- **Don't** build a 3D scene. Pointer tilt is permitted at ≤ 3° on a spring,
  `pointer: fine` and desktop only, on the surfaces the landing spec names:
  the product frame, the role cells, the channel cards
  [Correction, 2026-09-06: was «Don't use 3D, tilt, or pointer-driven
  perspective on any surface». The owner asked for the prototype «точь-в-точь»
  — spec 2026-09-06 R2.]
- **Don't** run any animation forever except the five named loops — the
  marquee, the Border Beam, the review-dot pulse, the hero drift, the dashed
  flow lines. Each is CSS, each stops under reduced motion
  [Correction, 2026-09-06: was «except the marquee — the Border Beam is
  finite».]
```

- [ ] **Step 6: The 2026-09-05 spec** — under **D4** add the paragraph `[Superseded 2026-09-06 by docs/superpowers/specs/2026-09-06-landing-prototype-parity-design.md: every item this decision dropped except Lenis is restored inside the vocabulary; the rules it rested on are amended there, §8.]`; under **F7** add `[Corrected 2026-09-06: «no tilt» is withdrawn — pointer tilt ≤ 3° on the frame, the role cells and the channel cards, spec 2026-09-06 R2; «no brutalism, no 3D scene» stands.]`; in §6.2's last row («Lenis, parallax, tilt, magnetic, idle drift, pulsing dot, dashed flow | dropped (D4)») append `[2026-09-06: all restored but Lenis — see the parity spec §3]`; in §7 rows 7.1, 7.2, 7.5 append `[withdrawn 2026-09-06, parity spec §3]`.

- [ ] **Step 7: `03-ui-references.md`** — replace the table with:

```
| Block | Pattern | What we take | What we do not | Source read 2026-09-06 · licence |
|---|---|---|---|---|
| Hero pill | Announcement | badge + copy + arrow, `asChild` link; magnetic on hover | its gradient border | 21st.dev `haydenbleasel/announcement` (kibo-ui) · MIT |
| Product frame | Container Scroll Animation + Border Beam | the tilt-and-settle entry (`ScrollSettle`), the pointer lean (`Tilt`), the depth layers (`Depth`), the ring of light (infinite, CSS) | the dark bezel | Aceternity `container-scroll-animation` · Aceternity License (structure only, nothing copied); Magic UI `border-beam` · MIT |
| Background | Dot Pattern | the dot field with a radial mask | the glow variant | Magic UI `dot-pattern` · MIT |
| Roles | Grid Feature Cards | 1px-gap cells, pointer spotlight, pointer tilt ≤ 3° | — | 21st.dev `efferd/grid-feature-cards` · licence unstated (structure already ours) |
| Provenance | Bento Grid | a two-row cell beside two stacked cells, staggered | icon-led filler cells | Magic UI `bento-grid` · MIT |
| Route | Fora's sticky feature stack | five sticky cards, sides alternating, the scale/veil scrub and the media parallax (`ScrollStack`) | — | Aceternity `sticky-scroll-reveal` · Aceternity License (structure only) |
| Pilot plan | Steppers / Timeline | vertical steps with a progress line scrubbed by the scroll (`ScrollProgress`) | timed autoplay | Aceternity `timeline` · Aceternity License (structure only) |
| Closing | Cta-4 | light card, copy left, actions right | a second signal button | 21st.dev `shadcnblockscom/cta-4` · licence unstated (structure already ours) |
| Headings | Text Generate Effect | per-word spans as the unit of a heading reveal; the line grouping is ours (`LineReveal`) | the blur | Aceternity `text-generate-effect` · Aceternity License (structure only) |
| Pointer words | Magnetic, Tilt | the spring-driven follow and lean (`Magnetic`, `Tilt`) with our springs | their default springs | motion-primitives (`ibelick/motion-primitives`) · MIT |
```

and after the table: `Spec: docs/superpowers/specs/2026-09-05-landing-daylight-design.md §6, amended by docs/superpowers/specs/2026-09-06-landing-prototype-parity-design.md §3 and §7 (the full source list with URLs).`

- [ ] **Step 8: The rewrite plan §8.3** — after the 2026-08-30 update block add:

```
> **Update, 2026-09-06.** Sixteen became twenty-two. The owner asked for the
> approved prototype's choreography in full
> (`docs/superpowers/specs/2026-09-06-landing-prototype-parity-design.md`), and
> six of its movements had no word:
>
> - **`<LineReveal>`** — a heading arriving line by line. There is no SplitText;
>   lines are found by `offsetTop` after layout, in a layout effect so the
>   reader never sees the flat state. One accessible node. Reduced: one fade.
> - **`<Depth>`** — a layer moving against the scroll of its section,
>   `depth·80px → depth·−80px`. Off below `md` and under reduced motion, with
>   the same tree.
> - **`<Tilt>`** — a surface leaning toward the pointer on `spring.tilt`, ≤ 3°,
>   `pointer: fine` and desktop only. `area="section"` is how the board leans
>   while the pointer is anywhere in the hero.
> - **`<Magnetic>`** — a control following the pointer on `spring.magnetic`.
>   Applied by the landing to its buttons and pill, never inside `Button`.
> - **`<ScrollStack>` / `<ScrollStackCard>` / `<ScrollStackMedia>`** — Fora's
>   stack with the prototype's scale .955, rise −14, veil .7, and the media
>   panel's `y 14 → −14`, `rotateX −3 → 2`. Off below `wide`.
> - **`<ScrollProgress>`** — the sibling of `<InViewProgress>` driven by the
>   scroll instead of a timer; the stepper reads it. Reduced: `1` at once.
>
> Four CSS loops joined the marquee on the perpetual allowlist (beam, pulse,
> drift, flow), `ScrollTint` fades by opacity and has two uses, `Reveal` took
> `x` and `size`, `StaggerItem` took `from="scale"`. Rules 5 and 9 of
> `02-building-ui.md` §4.3 carry the dated corrections.
```

- [ ] **Step 9: `TODOS.md`** — the D4 P3 line becomes `- **P3 (CLOSED 2026-09-06) — not carried from the prototype, by decision D4.** Reopened and restored by \`docs/superpowers/specs/2026-09-06-landing-prototype-parity-design.md\` (R2): depth, tilt, magnetic, drift, pulse, flow, the stack scrub, the tinted media, the accent shadow. Lenis stays out (R1). The hero paths were never in the final prototype file (§1.1).`; the `landing-route-card` P3 becomes `(CLOSED 2026-09-06 — the sticky lives in \`ScrollStackCard\`; the literal media query is gone)`; the «two scroll-linked» docstring P3 becomes `(CLOSED 2026-09-06 — rule 9 and the docstrings were rewritten by the parity slice)`.

- [ ] **Step 10: `Marquee.tsx`** header — «The ONLY perpetual animation in the system.» → «One of the five named perpetual animations (spec 2026-09-06 §5.1); until 2026-09-06 the only one.»

- [ ] **Step 11: Run** — `pnpm --filter @goproceed/landing test -- design-contract && pnpm validate:canonical-docs` → PASS, `canonical documentation: OK`.

- [ ] **Step 12: Commit** — `docs: the parity slice's dated corrections — rules 5 and 9, DESIGN.md, the 09-05 spec, 03-ui-references with licences, rewrite plan §8.3, TODOS closed (spec 2026-09-06 §8)`.

---

### Task 17: QA harness, the gate, before/after evidence, the PR

**Files:**
- Modify: `apps/landing/qa/landing.mjs:96-141` (`beamPixels`), new checks
- Create: `docs/superpowers/plans/evidence/2026-09-06-landing-parity-gate.md`
- Test: the harness itself (`pnpm --filter @goproceed/landing qa`)

- [ ] **Step 1: The beam check no longer waits for `data-settled`** — in `beamPixels()` replace the `settled` evaluation with:

```js
    const present = await page.evaluate(async () => {
      const el = document.querySelector(".beam");
      if (!el) return false;
      el.parentElement.scrollIntoView({ block: "center" });
      await new Promise((r) => setTimeout(r, 700));
      return true;
    });
    const handle = present ? await page.$(".beam") : null;
```

and update its comment: the ring runs from first paint (spec 2026-09-06 §5.1), so the measurement needs the frame in view, not settled.

- [ ] **Step 2: Add the parity checks** — after `report.beamPixels = …` add:

```js
  // PARITY CHECKS (spec 2026-09-06 §9). Each is a fact the seven screenshots
  // cannot show: a transform that changes with the scroll, an attribute that
  // flips with the viewport, a CSS variable that reaches 1.
  async function parity() {
    const out = {};
    const wide = await browser.newPage();
    await wide.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await wide.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 300));
    const depthAtTop = await wide.evaluate(() => [...document.querySelectorAll("[data-depth]")].map((el) => getComputedStyle(el).transform));
    await wide.evaluate(() => window.scrollTo(0, 600));
    await new Promise((r) => setTimeout(r, 400));
    const depthScrolled = await wide.evaluate(() => [...document.querySelectorAll("[data-depth]")].map((el) => getComputedStyle(el).transform));
    out.depthLayers = depthAtTop.length;
    out.depthMoves = depthAtTop.length === 3 && depthAtTop.some((t, i) => t !== depthScrolled[i]);
    out.tiltOnWide = await wide.evaluate(() => document.querySelectorAll('[data-tilt="on"]').length);
    out.magneticOnWide = await wide.evaluate(() => document.querySelectorAll('[data-magnetic="on"]').length);
    out.stackOnWide = await wide.evaluate(() => document.querySelector("[data-scroll-stack]")?.getAttribute("data-scroll-stack"));
    await wide.evaluate(() => document.querySelector("#pilot")?.scrollIntoView({ block: "end" }));
    await wide.evaluate(() => window.scrollBy(0, 400));
    await new Promise((r) => setTimeout(r, 400));
    out.stepperProgress = await wide.evaluate(() => Number(document.querySelector("[data-scroll-progress]")?.style.getPropertyValue("--gp-progress") ?? "0"));
    out.pulsing = await wide.evaluate(() => document.querySelectorAll(".pulse-dot").length);
    out.flowing = await wide.evaluate(() => document.querySelectorAll(".flow-dash").length);
    await wide.close();

    const narrow = await browser.newPage();
    await narrow.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await narrow.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 300));
    out.tiltOnNarrow = await narrow.evaluate(() => document.querySelectorAll('[data-tilt="on"]').length);
    out.depthFlatNarrow = await narrow.evaluate(() => [...document.querySelectorAll("[data-depth]")].every((el) => getComputedStyle(el).transform === "none"));
    out.stackOnNarrow = await narrow.evaluate(() => document.querySelector("[data-scroll-stack]")?.getAttribute("data-scroll-stack"));
    await narrow.close();
    return out;
  }
  report.parity = await parity();
  const p = report.parity;
  const parityOk = p.depthMoves && p.tiltOnWide === 8 && p.magneticOnWide === 7 && p.stackOnWide === "on"
    && p.stepperProgress >= 0.99 && p.pulsing === 3 && p.flowing === 3
    && p.tiltOnNarrow === 0 && p.depthFlatNarrow && p.stackOnNarrow === "off";
  console.log(`parity: ${parityOk ? "ok" : "PROBLEM"} ${JSON.stringify(p)}`);
```

and fold `parityOk` into `allOk`. Expected counts: tilt 8 (board + 4 roles + 3 channels), magnetic 7 (pill, 2 hero, 2 CTA, 2 form), pulse 3 (two board cards + the pilot chip), flow 3.

- [ ] **Step 3: Run the full gate, in order, and paste the output into the evidence file**

```bash
pnpm --filter @goproceed/tokens generate
node packages/testing/qa/motion-audit.mjs
pnpm --filter @goproceed/testing test
pnpm turbo run typecheck
pnpm --filter @goproceed/landing build
pnpm --filter @goproceed/landing test
pnpm --filter @goproceed/landing qa
pnpm validate:canonical-docs
```

Every command green; `landing qa: ok` with the parity line `ok`. If a count differs, the harness names which; fix the block, not the number, unless the spec's table says the number is wrong.

- [ ] **Step 4: Evidence** — create `docs/superpowers/plans/evidence/2026-09-06-landing-parity-gate.md` with the eight commands and their verbatim output, the `qa-output/report.json` parity object, and the before/after pairs: copy `qa-output/1440-00.png`, `1440-03.png` (the route), `1440-06.png` (capture), `390-00.png`, `reduced-1440-00.png` beside the before-set from the session scratchpad (`/private/tmp/claude-501/-Users-akisliy-Downloads-GoProceed/d69fa863-302d-41ef-b0d7-796311e73466/scratchpad/before/`) into `docs/superpowers/plans/evidence/2026-09-06-landing-parity/{before,after}/`. Check `.gitignore` allows PNG under `docs/` (the 2026-09-05 evidence files did this — follow their location).

- [ ] **Step 5: Visual pass** — open the QA PNGs at 1920 · 1440 · 1240 · 768 · 390 · 360 and the reduced pair; check: nothing overflows (the harness asserts it), the receipt and pills keep their corners at 1440 and 1240, the route cards sit under the header at 1440 with the veil visible on the card behind, the reduced set has flat frame, no beam, inked statement, complete stepper, plain stack. Record the findings in the evidence file.

- [ ] **Step 6: Commit and PR**

```bash
git add apps/landing/qa/landing.mjs docs/superpowers/plans/evidence/2026-09-06-landing-parity-gate.md docs/superpowers/plans/evidence/2026-09-06-landing-parity
git commit -m "test(qa): the landing harness measures the parity — depth moves, tilt and magnetism gate by width, the stack and stepper reach the scroll; gate evidence

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin claude/landing-prototype-parity
gh pr create --title "Landing: full parity with the approved Daylight prototype (except Lenis)" --body-file docs/superpowers/plans/evidence/2026-09-06-landing-parity-gate.md
```

The PR body (the evidence file) opens with the rulings R1–R9 from the spec §2 verbatim, then the block table's «Decision» column, then the gate output, then the before/after images. It ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Self-review against the spec

- §3 rows 0, 2, 3b, 13 — no change (verified in §1.1); rows 1a–1g → Task 12; 3a, 7, 11, 12, «all» → Task 13 (+ Tasks 9, 11 for the words and components); 4, 5, 9 → Task 14; 6, 8, 10 → Task 15 (+ Task 8 for the stepper).
- §4.1–4.6 → Tasks 3–8; §4.7 → Task 9 (ScrollTint also gains `accent`, found in Task 13 step 5 and added to Task 9's test there).
- §5.1–5.2 → Task 10; §5.3 → Task 1; §5.4 → Tasks 8, 10, 11 (+ `FeatureGrid stagger`, `Bento stagger` added by Task 14 — small additive props not in the spec table; recorded here).
- §8 → Task 16; §9 → every task's test steps + Task 17; §10 deviations need no task (10.5 is Task 13 step 8's exclusion of the header and the failed-state mail button).
- Names used consistently: `useBelowBreakpoint`, `usePointerFine` (Task 3) in Tasks 4–7; `data-depth`, `data-tilt`, `data-magnetic`, `data-scroll-stack`, `data-stack-card`, `data-stack-veil`, `data-stack-media`, `data-scroll-progress` in Tasks 12–15 and 17; `pulse-dot`, `drift-a/b/c`, `flow-dash`, `media-tint-N`, `media-glow-*` in Tasks 10, 12, 15, 17; `DURATION.stately/grand`, `SPRING.tilt/magnetic` in Tasks 1, 5, 6, 9.
