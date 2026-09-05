# Landing Daylight — Plan 2 of 3: the vocabulary word and the shared components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `packages/ui` everything the Daylight page reuses — one motion primitive (`ScrollSettle`), a finite Border Beam utility, and seven components — each rendered in a kitchen sink and gated by the contract suite, before any landing block exists.

**Architecture:** Motion lives only in `packages/ui/src/motion/` (rule 5); a block never imports `motion/react`. Components name roles, take `className` last and merge with `cx()`, and are exported from `packages/ui/src/components/index.ts`. The two kitchen sinks (`apps/landing/app/kitchen-sink/page.tsx` for motion, `…/kitchen-sink/components/page.tsx` for components) are the third obligation and `component-contract.test.ts` fails without them.

**Tech Stack:** React 19.2.8, `motion` 12.43 (`motion/react`), Tailwind 4.3.3, radix-ui 1.6.7, lucide-react, vitest 3.2.4.

**Spec:** [`docs/superpowers/specs/2026-09-05-landing-daylight-design.md`](../specs/2026-09-05-landing-daylight-design.md) — §6 (components and motion).

**Prerequisite:** Plan 1 green (the roles `text-accent`, `border-accent`, `bg-accent-soft` and the token `control-height-marketing` exist).

## Global Constraints

- Branch `claude/practical-chatterjee-c8d64a`; commit per task.
- `motion/react` only inside `packages/ui/src/motion`; every primitive branches on `useReduced()` and returns a **different** animation under reduced motion, never a faster one.
- No `transition-all`, no ease-in, no layout-property transition except `grid-template-rows`, no perpetual animation except the marquee (`motion-audit.mjs` rules 1–5).
- Classes name roles; no ramp step, no hex, no inline-style colour, no hard-coded control height (`h-11`) in `packages/ui` (`component-contract.test.ts`).
- Never write a Tailwind class as a template literal; one literal string per branch.
- Every new component: file + `index.ts` export + a `<Case>` in the kitchen sink, in the same commit.
- Real Ukrainian strings in the sinks, never lorem.
- Repo docs English; owner conversation Russian.

Run every command from the repo root.

---

### Task 6: `ScrollSettle` — the sixteenth word, and the finite beam

**Files:**
- Create: `packages/ui/src/motion/ScrollSettle.tsx`
- Modify: `packages/ui/src/motion/index.ts` (export; header count 15 → 16)
- Modify: `packages/ui/src/base.css` (a `beam` utility and its keyframes)
- Modify: `packages/testing/src/motion-audit.test.ts:100-112` (sixteen)
- Modify: `apps/landing/app/kitchen-sink/page.tsx` (import + Case 14; header copy)
- Modify: `docs/design/2026-08-19-design-system-rewrite-plan.md` §8.3 (a dated update note), `docs/design/02-building-ui.md:161` (fifteen → sixteen)

**Interfaces:**
- Produces: `ScrollSettle({ children, className? })` — wraps its child in a perspective frame; on the way into the viewport the child goes from `rotateX(18deg) scale(0.94)` to flat, driven by `useScroll` over the wrapper's entry. Sets `data-settled="true"` on the wrapper once progress reaches 1 (the beam's trigger). Below `md` and under reduced motion the child is flat from the first paint and `data-settled` is `"true"` immediately.
- Produces: the `beam` utility — an absolutely positioned conic ring that runs **two** passes when its closest `[data-settled="true"]` ancestor appears; none under reduced motion.

- [ ] **Step 1: Write the failing test — the vocabulary count**

In `packages/testing/src/motion-audit.test.ts`, change the test title and set:

```ts
  it("exports exactly sixteen primitives", () => {
    // A seventeenth is a decision, not an addition: it means the vocabulary was
    // missing something, and the plan's motion section has to say what and
    // why. Failing here is the prompt to write that down.
    const index = readFileSync(join(repoRoot, "packages/ui/src/motion/index.ts"), "utf8");
    const exported = [...index.matchAll(/^export \{ ([A-Z][a-z]\w*)/gm)].map((m) => m[1]);
    expect(new Set(exported)).toEqual(new Set([
      "Reveal", "Stagger", "TextBlurIn", "ScrollTint", "LineDraw", "NodeLock",
      "CountUp", "Marquee", "PinnedTabs", "Lift", "Press", "CrossFade",
      "TrackFill", "SlideSwap", "InViewProgress", "ScrollSettle",
    ]));
  });
```

- [ ] **Step 2: Run it and the kitchen-sink gate**

Run: `pnpm --filter @goproceed/testing exec vitest run src/motion-audit.test.ts src/component-contract.test.ts`
Expected: FAIL — the set lacks `ScrollSettle`.

- [ ] **Step 3: Write the primitive**

`packages/ui/src/motion/ScrollSettle.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useReduced } from "./use-reduced";

/**
 * The product frame settling into the page — 21st.dev's «Container Scroll».
 *
 * The frame enters tilted back (`rotateX 18deg`, `scale .94`) and flattens as
 * the reader scrolls it into the fold. It is scroll-LINKED — it answers the
 * scroll position, not a timer — which makes it one of the page's two
 * permitted scroll-linked elements (`02-building-ui.md` §4.3 rule 9; the
 * other is `ScrollTint`). A page may not use both in one fold.
 *
 * Three states the caller can rely on:
 *   - full motion: perspective, tilt, flattens over `["start end", "start 35%"]`
 *     of the wrapper's entry — the prototype's measured range;
 *   - below the `md` breakpoint (a media query, read once): flat, no
 *     perspective — a tilted frame on a phone shows a sliver of product;
 *   - reduced motion: flat from the first paint, and `data-settled="true"` at
 *     once, so anything keyed to the settle (the beam) knows not to wait.
 *
 * `data-settled` flips to "true" the first time progress reaches 1 and never
 * flips back: the beam utility (`base.css`) keys its two passes off it, and a
 * reader scrolling up should not restart an entrance.
 */
export function ScrollSettle({
  children, className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  const narrow = useNarrow();
  if (reduced || narrow) {
    return (
      <div className={className} data-settled="true">
        {children}
      </div>
    );
  }
  return <AnimatedSettle className={className}>{children}</AnimatedSettle>;
}

function AnimatedSettle({ children, className }: { children: ReactNode; className?: string | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.35"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  useMotionValueEvent(scrollYProgress, "change", (v) => { if (v >= 1) setSettled(true); });

  return (
    <div ref={ref} className={className} data-settled={settled ? "true" : "false"} style={{ perspective: 1500 }}>
      <motion.div style={{ rotateX, scale, transformOrigin: "50% 0%", transformStyle: "preserve-3d" }}>
        {children}
      </motion.div>
    </div>
  );
}

/** True below the `md` breakpoint. Read from the token so the number is typed nowhere here. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const md = getComputedStyle(document.documentElement).getPropertyValue("--breakpoint-md").trim() || "768px";
    const query = window.matchMedia(`(max-width: calc(${md} - 1px))`);
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}
```

Note `style={{ perspective: 1500 }}` is a layout number, not a colour — `component-contract`'s inline-style rule scans `packages/ui/src/components`, and the motion audit does not flag `perspective`.

- [ ] **Step 4: Export it and update the header**

In `packages/ui/src/motion/index.ts` change `FIFTEEN` → `SIXTEEN` and `fifteen files` → `sixteen files` in the header comment, and add after the `InViewProgress` line:

```ts
export { ScrollSettle } from "./ScrollSettle";
```

- [ ] **Step 5: The beam utility**

In `packages/ui/src/base.css`, after `@utility marquee-track { … }`, add:

```css
/* Border Beam — 21st.dev's ring of light that runs around a frame's edge.
 * A conic gradient masked to a 1px ring, rotated by a registered custom
 * property so the angle itself animates. It runs TWICE, keyed off the
 * `data-settled` attribute `ScrollSettle` sets when the frame has landed, and
 * never again: rule 4 permits one perpetual animation in the product and it is
 * the marquee. Under reduced motion the unlayered block below drops the
 * iteration count to one and the duration to nothing, so the ring is simply
 * absent. */
@property --gp-beam-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

@utility beam {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  pointer-events: none;
  background: conic-gradient(
    from var(--gp-beam-angle),
    transparent 0 72%,
    var(--gp-bg-signal) 86%,
    transparent 100%
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
}

[data-settled="true"] .beam {
  animation: gp-beam 7s linear 2;
}
```

and inside the existing `@theme { … }` block, after `gp-marquee`:

```css
  @keyframes gp-beam {
    from { opacity: 1; --gp-beam-angle: 0deg; }
    to   { opacity: 1; --gp-beam-angle: 360deg; }
  }
```

(`opacity` stays 1 for the run and returns to the utility's 0 when the two passes end, which is how it disappears without a third keyframe.)

- [ ] **Step 6: Render it in the motion sink**

In `apps/landing/app/kitchen-sink/page.tsx`: add `ScrollSettle` to the `@goproceed/ui/motion` import list; change the header `text="П'ятнадцять примітивів і жодного більше"` to `text="Шістнадцять примітивів і жодного більше"` and the file's top comment `Fifteen primitives` → `Sixteen primitives`; append before `</main>`:

```tsx
      <Case n="14" name="ScrollSettle" rule="Кадр продукту в'їжджає нахиленим і вирівнюється по скролу — 21st.dev Container Scroll. Другий і останній scroll-linked елемент сторінки; нижче md і під reduced motion кадр плаский одразу. Промінь по рамці робить два оберти після посадки і зупиняється: вічна анімація тут лише одна, і це стрічка.">
        <ScrollSettle className="mx-auto max-w-content">
          <div className="relative rounded-surface border border-line-strong bg-surface p-8 shadow-float">
            <i className="beam" aria-hidden="true" />
            <p className="index-label">Стан пакету робіт</p>
            <p className="mt-3 text-data text-ink-muted">Готово 12 · На розгляді 07 · Заблоковано 03</p>
          </div>
        </ScrollSettle>
      </Case>
```

- [ ] **Step 7: Record the decision**

In `docs/design/2026-08-19-design-system-rewrite-plan.md` §8.3, after the `> **Update, 2026-08-30.**` note, add:

```markdown
> **Update, 2026-09-05.** Fifteen became sixteen. The Daylight landing's hero
> is 21st.dev's «Container Scroll» — the product frame enters tilted and
> flattens as it scrolls in — and no word said that:
>
> - **`<ScrollSettle>`** — a scroll-linked settle (`rotateX 18→0`, `scale
>   .94→1`) over the wrapper's entry. Deliberately scroll-linked rather than
>   in-view: the frame is *set down by the reader's hand*, which is the
>   sentence the prototype's motion says. It is one of the two scroll-linked
>   elements a page may carry (rule 9); the other is `<ScrollTint>`. Below
>   `md` and under reduced motion the frame is flat from the first paint and
>   `data-settled` is true at once. The Border Beam (`base.css` `beam`) keys
>   two passes off that attribute and stops — rule 4 keeps the marquee the
>   only perpetual animation.
```

In `docs/design/02-building-ui.md:161` change `the fifteen motion primitives` to `the sixteen motion primitives`.

- [ ] **Step 8: Run the gates**

Run: `node packages/testing/qa/motion-audit.mjs && pnpm --filter @goproceed/testing exec vitest run src/motion-audit.test.ts src/component-contract.test.ts && pnpm --filter @goproceed/landing typecheck`
Expected: `motion-audit: clean`; both suites PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/ui/src/motion packages/ui/src/base.css packages/testing/src/motion-audit.test.ts apps/landing/app/kitchen-sink/page.tsx docs/design
git commit -m "feat(motion): ScrollSettle — the product frame set down by the reader's hand

The sixteenth word (spec §6.2, rewrite plan §8.3): scroll-linked rotateX/scale
settle for 21st.dev's Container Scroll, flat below md and under reduced
motion. base.css gains the Border Beam as a finite two-pass ring keyed off
data-settled; the marquee stays the only perpetual animation.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `Button size="lg"`, `Chip dot`, `Accordion marker="plus"`

**Files:**
- Modify: `packages/ui/src/components/Button.tsx:43-47` (SIZE)
- Modify: `packages/ui/src/components/Chip.tsx`
- Modify: `packages/ui/src/components/Accordion.tsx`
- Modify: `apps/landing/app/kitchen-sink/components/page.tsx` (Cases 01, 02, and the Accordion case)
- Test: `apps/landing/tests/ui-components.test.tsx` (new)

**Interfaces:**
- Produces: `Button` accepts `size="lg"` → `h-(--gp-control-height-marketing) touch:h-(--gp-control-height-touch) px-5 text-data`. `Chip` accepts `dot?: boolean` rendering a leading `<i aria-hidden class="size-1.5 rounded-pill bg-current opacity-80">`. `Accordion` accepts `marker?: "chevron" | "plus"`; `plus` renders a 26px circled plus (`border-line-strong`) that fills with ink and rotates its vertical bar 90° when open.

- [ ] **Step 1: Write the failing markup tests**

Create `apps/landing/tests/ui-components.test.tsx`:

```tsx
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Accordion, Button, Chip } from "@goproceed/ui/components";

describe("Button size=\"lg\"", () => {
  it("takes its height from the marketing control token", () => {
    const html = renderToStaticMarkup(<Button size="lg">Обговорити пілот</Button>);
    expect(html).toContain("h-(--gp-control-height-marketing)");
    expect(html).toContain("touch:h-(--gp-control-height-touch)");
  });
});

describe("Chip dot", () => {
  it("renders a leading dot only when asked", () => {
    expect(renderToStaticMarkup(<Chip tone="review" dot>на розгляді</Chip>)).toContain('data-chip-dot="true"');
    expect(renderToStaticMarkup(<Chip tone="review">на розгляді</Chip>)).not.toContain("data-chip-dot");
  });
});

describe("Accordion marker", () => {
  const entries = [{ id: "a", question: "Питання?", answer: "Відповідь." }];
  it("draws a circled plus when marker=\"plus\"", () => {
    const html = renderToStaticMarkup(<Accordion entries={entries} marker="plus" />);
    expect(html).toContain('data-accordion-marker="plus"');
    expect(html).not.toContain("lucide-chevron-down");
  });
  it("keeps the chevron by default", () => {
    expect(renderToStaticMarkup(<Accordion entries={entries} />)).toContain("lucide-chevron-down");
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @goproceed/landing exec vitest run tests/ui-components.test.tsx`
Expected: FAIL (three cases; typecheck errors on the unknown props are expected too).

- [ ] **Step 3: Implement**

`Button.tsx` — add to `SIZE`:

```ts
  /** Marketing controls: the prototype's 42px. The touch floor still wins under pointer:coarse. */
  lg: "h-(--gp-control-height-marketing) touch:h-(--gp-control-height-touch) px-5 text-data",
```

`Chip.tsx` — add the prop and the dot:

```tsx
export function Chip({
  tone = "idle", children, className, interactive = false, dot = false,
}: {
  tone?: ChipTone | undefined;
  children: ReactNode;
  className?: string | undefined;
  /** A chip inside a filter is a control and takes the touch floor. */
  interactive?: boolean | undefined;
  /** A leading dot in the chip's own colour — the landing's status tags carry one. Never the only signal: the label still names the state. */
  dot?: boolean | undefined;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-pill border px-3 text-meta font-medium",
        interactive
          ? "h-(--gp-control-height-desk-sm) touch:h-(--gp-control-height-touch)"
          : "py-1",
        TONE[tone],
        className,
      )}
    >
      {dot && <i aria-hidden="true" data-chip-dot="true" className="size-1.5 shrink-0 rounded-pill bg-current opacity-80" />}
      {children}
    </span>
  );
}
```

`Accordion.tsx` — add `marker` and the plus:

```tsx
export function Accordion({
  entries, className, marker = "chevron",
}: {
  entries: AccordionEntry[];
  className?: string | undefined;
  /** `plus` — the landing's circled plus that fills with ink when open. */
  marker?: "chevron" | "plus" | undefined;
}) {
  return (
    <RadixAccordion.Root type="single" collapsible className={cx("w-full", className)}>
      {entries.map((entry) => (
        <RadixAccordion.Item key={entry.id} value={entry.id} className="border-b border-line">
          <RadixAccordion.Header>
            <RadixAccordion.Trigger
              className={cx(
                "group flex w-full items-center justify-between gap-5 py-5 text-left",
                "text-body font-medium text-ink transition-colors duration-fast ease-out",
                "hover:text-ink-secondary",
              )}
            >
              {entry.question}
              {marker === "plus" ? (
                <span
                  aria-hidden="true"
                  data-accordion-marker="plus"
                  className={cx(
                    "relative grid size-(--gp-control-height-desk-sm) shrink-0 place-items-center rounded-pill border border-line-strong",
                    "transition-colors duration-base ease-out group-data-[state=open]:border-action group-data-[state=open]:bg-action",
                  )}
                >
                  <i className="absolute h-px w-2.5 bg-ink transition-colors duration-base ease-out group-data-[state=open]:bg-action-fg" />
                  <i className="absolute h-2.5 w-px bg-ink transition-[transform,background-color] duration-base ease-out group-data-[state=open]:rotate-90 group-data-[state=open]:bg-action-fg" />
                </span>
              ) : (
                <ChevronDown
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 shrink-0 text-ink-muted transition-transform duration-base ease-out group-data-[state=open]:rotate-180"
                />
              )}
            </RadixAccordion.Trigger>
          </RadixAccordion.Header>
          <RadixAccordion.Content
            className={cx(
              "grid grid-rows-[0fr] overflow-hidden transition-[grid-template-rows]",
              "duration-base ease-out data-[state=open]:grid-rows-[1fr]",
              "motion-reduce:transition-none",
            )}
          >
            <div className="min-h-0">
              <p className="measure pb-5 text-body leading-relaxed text-ink-secondary">{entry.answer}</p>
            </div>
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
```

(`size-(--gp-control-height-desk-sm)` is 32px — the prototype's 26px circle is below the small-control token and a token is what a size must come from; 32 also clears the touch floor's spirit on a trigger that is the whole row anyway.)

- [ ] **Step 4: Sinks**

In `apps/landing/app/kitchen-sink/components/page.tsx`: Case 01 gains `<Button size="lg">Маркетинговий</Button>`; Case 02 gains `<Chip tone="review" dot>на розгляді</Chip>`; the Accordion case gains a second `<Accordion entries={FAQ} marker="plus" />` under a `<p className="index-label mt-8">marker="plus"</p>`.

- [ ] **Step 5: Run the tests and the contract suite**

Run: `pnpm --filter @goproceed/landing exec vitest run tests/ui-components.test.tsx && pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts && node packages/testing/qa/motion-audit.mjs`
Expected: PASS; `motion-audit: clean` (`transition-[transform,background-color]` lists two animatable properties).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/Button.tsx packages/ui/src/components/Chip.tsx packages/ui/src/components/Accordion.tsx apps/landing/app/kitchen-sink/components/page.tsx apps/landing/tests/ui-components.test.tsx
git commit -m "feat(ui): Button size=lg, Chip dot, Accordion marker=plus for the Daylight landing

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: `Pill` and `SectionRule`

**Files:**
- Create: `packages/ui/src/components/Pill.tsx`, `packages/ui/src/components/SectionRule.tsx`
- Modify: `packages/ui/src/components/index.ts`
- Modify: `apps/landing/app/kitchen-sink/components/page.tsx` (Cases 18, 19)
- Test: `apps/landing/tests/ui-components.test.tsx`

**Interfaces:**
- Produces: `Pill({ children, asChild?: boolean, className? })` — the announcement pill's shell; with `asChild` the single child (an `<a>`) becomes the pill. `PillContent({ badge?: string, children })` — the badge, copy and arrow, placed inside the link by the caller. Renders `data-slot="pill"`. `SectionRule({ index: string, label: string, className? })` — `aria-hidden` hairline with the mono `index · label` sitting on it; renders `data-section-rule={index}`.

- [ ] **Step 1: Write the failing tests** (append to `apps/landing/tests/ui-components.test.tsx`; add `Pill, PillContent, SectionRule` to the import)

```tsx
describe("Pill", () => {
  it("renders the badge and a trailing arrow, as a link when asChild", () => {
    const html = renderToStaticMarkup(
      <Pill asChild>
        <a href="#pilot"><PillContent badge="Безкоштовний пілот">для субпідрядників</PillContent></a>
      </Pill>,
    );
    expect(html).toContain('<a href="#pilot"');
    expect(html).toContain("Безкоштовний пілот");
    expect(html).toContain('data-slot="pill"');
    expect(html).toContain("→");
  });
});

describe("SectionRule", () => {
  it("is decorative and carries its index and label in mono", () => {
    const html = renderToStaticMarkup(<SectionRule index="01" label="Проблема" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-section-rule="01"');
    expect(html).toContain("01 · Проблема");
    expect(html).toContain("index-label");
  });
});
```

- [ ] **Step 2: Run it** — `pnpm --filter @goproceed/landing exec vitest run tests/ui-components.test.tsx` → FAIL (no export).

- [ ] **Step 3: Implement**

`Pill.tsx`:

```tsx
import type { ReactNode } from "react";
import { Slot } from "radix-ui";
import { cx } from "./cn";

/**
 * The announcement pill — 21st.dev's «Announcement»: a dark badge, a line of
 * copy and an arrow that nudges on hover. Above a hero it says one thing («the
 * pilot is free») and links to where that thing is explained.
 *
 * Two parts on purpose. `Pill` is the shell; `PillContent` is the badge, the
 * copy and the arrow. With `asChild` the caller passes its own `<a>` and puts
 * `PillContent` inside it — Slot merges the shell's classes onto the link and
 * renders the link's own children, so the content has to travel with the
 * link, not with the shell. Never a `<div>` with an onClick.
 */
const SHELL =
  "group inline-flex items-center gap-2 rounded-pill border border-line-strong bg-surface " +
  "py-1 pl-1 pr-3 text-data text-ink-secondary transition-colors duration-fast ease-out hover:border-ink";

export function Pill({
  children, asChild = false, className,
}: {
  children: ReactNode;
  asChild?: boolean | undefined;
  className?: string | undefined;
}) {
  const classes = cx(SHELL, className);
  if (asChild) {
    return <Slot.Root data-slot="pill" className={classes}>{children}</Slot.Root>;
  }
  return <span data-slot="pill" className={classes}>{children}</span>;
}

/** The inside of a pill: badge, copy, arrow. The arrow is a glyph and aria-hidden, so the link's name is the copy. */
export function PillContent({ badge, children }: { badge?: string | undefined; children: ReactNode }) {
  return (
    <>
      {badge && (
        <span className="inline-flex items-center rounded-pill bg-action px-2.5 py-0.5 text-meta font-medium text-action-fg">
          {badge}
        </span>
      )}
      <span>{children}</span>
      <span aria-hidden="true" className="text-ink-muted transition-transform duration-fast ease-out group-hover:translate-x-0.5">→</span>
    </>
  );
}
```

`SectionRule.tsx`:

```tsx
import { cx } from "./cn";

/**
 * The numbered hairline between sections — the prototype's `.sep`. A 1px
 * `border-line` with the mono label sitting on it, backed by the canvas so it
 * reads as a label on a drawing sheet rather than a line through a word.
 * Decorative: the section that follows carries its own heading, so this is
 * `aria-hidden` and never a landmark.
 */
export function SectionRule({
  index, label, className,
}: {
  index: string;
  label: string;
  className?: string | undefined;
}) {
  return (
    <div aria-hidden="true" data-section-rule={index} className={cx("relative h-px bg-line", className)}>
      <div className="mx-auto max-w-marketing px-4 md:px-8">
        <span className="index-label absolute -top-2 bg-canvas pr-2 text-ink-subtle">
          {index} · {label}
        </span>
      </div>
    </div>
  );
}
```

`index.ts` — add after the `Figure` export:

```ts
export { Pill, PillContent } from "./Pill";
export { SectionRule } from "./SectionRule";
```

- [ ] **Step 4: Sinks** — append before the closing `<div className="border-t border-line py-14">` in the component sink:

```tsx
        <Case n="18" name="Pill" rule="Анонс над hero (21st.dev Announcement): тёмний бейдж, рядок і стрілка, що зсувається при наведенні. Одна фраза, одне посилання; як посилання — через asChild, ніколи div з onClick.">
          <Pill asChild>
            <a href="#pilot"><PillContent badge="Безкоштовний пілот">для субпідрядників із прихованими роботами</PillContent></a>
          </Pill>
        </Case>

        <Case n="19" name="SectionRule" rule="Нумерована лінія між розділами: волосяна лінія та моно-підпис на тлі паперу. Декоративна, aria-hidden — заголовок розділу несе секція, що йде далі.">
          <div className="py-6"><SectionRule index="01" label="Проблема" /></div>
        </Case>
```

and add `Pill, PillContent, SectionRule` to the sink's `@goproceed/ui/components` import.

- [ ] **Step 5: Run** — `pnpm --filter @goproceed/landing exec vitest run tests/ui-components.test.tsx && pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/Pill.tsx packages/ui/src/components/SectionRule.tsx packages/ui/src/components/index.ts apps/landing/app/kitchen-sink/components/page.tsx apps/landing/tests/ui-components.test.tsx
git commit -m "feat(ui): Pill (announcement) and SectionRule (numbered hairline)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: `FeatureGrid` + `FeatureCell` with spotlight

**Files:**
- Create: `packages/ui/src/components/FeatureGrid.tsx`
- Modify: `packages/ui/src/components/index.ts`, `apps/landing/app/kitchen-sink/components/page.tsx` (Case 20)
- Test: `apps/landing/tests/ui-components.test.tsx`

**Interfaces:**
- Produces: `FeatureGrid({ children, columns?: 2 | 3 | 4, className? })` — a 1px-gap grid on `bg-line-strong` clipped to `rounded-surface`; `FeatureCell({ icon?: ReactNode, title: string, subtitle?: string, children, footer?: ReactNode, className? })` — a `bg-surface` cell with a pointer-tracked dot spotlight (`"use client"`). Renders `data-slot="feature-cell"`.

- [ ] **Step 1: Failing test** (append; add `FeatureGrid, FeatureCell` to the import)

```tsx
describe("FeatureGrid", () => {
  it("renders four cells in one bordered container with a spotlight layer each", () => {
    const html = renderToStaticMarkup(
      <FeatureGrid columns={4}>
        {["ПТВ", "Майстер", "Власник", "Технагляд"].map((t) => (
          <FeatureCell key={t} title={t} subtitle="роль">біль</FeatureCell>
        ))}
      </FeatureGrid>,
    );
    expect(html.match(/data-slot="feature-cell"/g)).toHaveLength(4);
    expect(html.match(/data-spotlight="true"/g)).toHaveLength(4);
    expect(html).toContain("md:grid-cols-2");
    expect(html).toContain("wide:grid-cols-4");
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `FeatureGrid.tsx`:

```tsx
"use client";

import { useCallback, type PointerEvent, type ReactNode } from "react";
import { cx } from "./cn";

/**
 * 21st.dev's «Grid Feature Cards»: one bordered container, cells separated by
 * a 1px gap that shows the container's line colour, and a dot-pattern
 * spotlight that follows the pointer inside a cell. The spotlight is a
 * pointer-driven CSS variable and an opacity transition — no Motion, no
 * transform, and it costs nothing when the pointer is elsewhere.
 *
 * The columns prop is a closed set so each value is a literal class: Tailwind
 * scans source text and a template literal emits no CSS.
 */
const COLUMNS = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 wide:grid-cols-3",
  4: "md:grid-cols-2 wide:grid-cols-4",
} as const;

export function FeatureGrid({
  children, columns = 4, className,
}: {
  children: ReactNode;
  columns?: keyof typeof COLUMNS | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cx("grid gap-px overflow-hidden rounded-surface border border-line-strong bg-line-strong", COLUMNS[columns], className)}>
      {children}
    </div>
  );
}

export function FeatureCell({
  icon, title, subtitle, children, footer, className,
}: {
  icon?: ReactNode | undefined;
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  className?: string | undefined;
}) {
  const onMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--gp-spot-x", `${((event.clientX - r.left) / r.width) * 100}%`);
    event.currentTarget.style.setProperty("--gp-spot-y", `${((event.clientY - r.top) / r.height) * 100}%`);
  }, []);
  return (
    <article
      data-slot="feature-cell"
      onPointerMove={onMove}
      className={cx("group relative isolate grid content-start gap-3.5 bg-surface px-6 py-6", className)}
    >
      <i aria-hidden="true" data-spotlight="true" className="spotlight -z-10 opacity-0 transition-opacity duration-slow ease-out group-hover:opacity-100" />
      {icon && (
        <span className="grid size-9 place-items-center rounded-panel border border-line-strong bg-surface text-ink [&_svg]:size-4.5">
          {icon}
        </span>
      )}
      <h3 className="grid gap-0.5 text-body font-semibold tracking-tight text-ink">
        {title}
        {subtitle && <span className="text-meta font-normal text-ink-muted">{subtitle}</span>}
      </h3>
      <div className="text-data leading-relaxed text-ink-secondary">{children}</div>
      {footer && <div className="mt-1 grid gap-1.5 border-t border-line pt-3 text-data text-ink-secondary">{footer}</div>}
    </article>
  );
}
```

and the `spotlight` utility in `packages/ui/src/base.css` after `beam`:

```css
/* The dot-pattern spotlight under a feature cell's pointer. Two custom
 * properties the cell writes on pointer move; the mask is what makes it a
 * spotlight rather than a second background. */
@utility spotlight {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(var(--gp-border-strong) 1px, transparent 1.2px);
  background-size: 14px 14px;
  -webkit-mask-image: radial-gradient(240px circle at var(--gp-spot-x, 50%) var(--gp-spot-y, 50%), #000, transparent 70%);
  mask-image: radial-gradient(240px circle at var(--gp-spot-x, 50%) var(--gp-spot-y, 50%), #000, transparent 70%);
}
```

(`#000` inside a mask is a mask value, not a colour; `component-contract` scans `packages/ui/src/components`, not `base.css`, and `primitive-leak` looks for ramp names.)

`index.ts`: `export { FeatureGrid, FeatureCell } from "./FeatureGrid";`

- [ ] **Step 4: Sink** — Case 20:

```tsx
        <Case n="20" name="FeatureGrid + FeatureCell" rule="21st.dev Grid Feature Cards: один контейнер, комірки через 1px-зазор кольору лінії, під курсором проявляється точкова підкладка. Нахилу немає — це не 3D, а світло.">
          <FeatureGrid columns={4}>
            {[["ПТВ", "виробничо-технічний відділ"], ["Майстер", "дільниці"], ["Власник", "комерційний директор"], ["Технагляд", "зовнішній розгляд"]].map(([t, s]) => (
              <FeatureCell key={t} title={t!} subtitle={s} footer={<span>→ доказ знаходиться по роботі</span>}>
                Дні на пошук фото по чатах, переписування у Word.
              </FeatureCell>
            ))}
          </FeatureGrid>
        </Case>
```

- [ ] **Step 5: Run** the two suites and the audit → PASS, clean.

- [ ] **Step 6: Commit** — `git add packages/ui/src/components/FeatureGrid.tsx packages/ui/src/components/index.ts packages/ui/src/base.css apps/landing/app/kitchen-sink/components/page.tsx apps/landing/tests/ui-components.test.tsx && git commit -m "feat(ui): FeatureGrid and FeatureCell with a pointer spotlight

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"`

---

### Task 10: `Bento` + `BentoCell`

**Files:**
- Create: `packages/ui/src/components/Bento.tsx`
- Modify: `index.ts`, component sink (Case 21)
- Test: `apps/landing/tests/ui-components.test.tsx`

**Interfaces:**
- Produces: `Bento({ children, className? })` — `grid gap-3.5 md:grid-cols-[1.25fr_1fr]`; `BentoCell({ eyebrow?: string, title?: string, span?: "rows-2", children, className? })` — `bg-surface border-line-strong rounded-surface` cell; `span="rows-2"` → `md:row-span-2`. Renders `data-slot="bento-cell"`.

- [ ] **Step 1: Failing test**

```tsx
describe("Bento", () => {
  it("lets one cell span two rows", () => {
    const html = renderToStaticMarkup(
      <Bento>
        <BentoCell span="rows-2" eyebrow="Доступ" title="Хто що бачить">матриця</BentoCell>
        <BentoCell eyebrow="Незмінність">список</BentoCell>
        <BentoCell eyebrow="Межі v0.1">список</BentoCell>
      </Bento>,
    );
    expect(html.match(/data-slot="bento-cell"/g)).toHaveLength(3);
    expect(html.match(/md:row-span-2/g)).toHaveLength(1);
    expect(html).toContain("Хто що бачить");
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

```tsx
import type { ReactNode } from "react";
import { cx } from "./cn";

/**
 * 21st.dev's «Bento Grid», reduced to the one arrangement the product uses: a
 * wide cell that spans two rows beside two stacked cells. Cells are surfaces
 * with a strong line and the marketing radius; there is no shadow — structure
 * is the border.
 */
export function Bento({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <div className={cx("grid gap-3.5 md:grid-cols-[1.25fr_1fr]", className)}>{children}</div>;
}

const SPAN = { "rows-2": "md:row-span-2" } as const;

export function BentoCell({
  eyebrow, title, span, children, className,
}: {
  eyebrow?: string | undefined;
  title?: string | undefined;
  span?: keyof typeof SPAN | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <article
      data-slot="bento-cell"
      className={cx("grid content-start gap-3.5 rounded-surface border border-line-strong bg-surface p-6 md:p-7", span && SPAN[span], className)}
    >
      {eyebrow && <p className="index-label">{eyebrow}</p>}
      {title && <h3 className="text-h2 font-semibold tracking-tight text-ink">{title}</h3>}
      {children}
    </article>
  );
}
```

`index.ts`: `export { Bento, BentoCell } from "./Bento";`

- [ ] **Step 4: Sink** — Case 21 with the three cells from the test (Ukrainian copy as above).

- [ ] **Step 5: Run** suites → PASS. **Step 6: Commit** — `feat(ui): Bento and BentoCell`.

---

### Task 11: `ComparePair` + `CompareCard`

**Files:**
- Create: `packages/ui/src/components/Compare.tsx`
- Modify: `index.ts`, component sink (Case 22), `packages/ui/src/base.css` (the `:has()` pairing rule)
- Test: `apps/landing/tests/ui-components.test.tsx`

**Interfaces:**
- Produces: `CompareRow = { key: string; question: string; answer: string; ref?: string }`; `CompareCard({ tone: "was" | "now", eyebrow: string, title: string, rows: CompareRow[], outcome: string, className? })`; `CompareArrow()` — the arrow cell; `ComparePair({ children, className? })` — the three-column grid (card, arrow, card). Rows carry `data-compare-row={key}`; a hovered row highlights its twin in the other card through CSS `:has()` on the pair.

- [ ] **Step 1: Failing test**

```tsx
describe("ComparePair", () => {
  const rows = [{ key: "photo", question: "Де фото?", answer: "У чаті бригади" }];
  it("renders both cards, the arrow, and paired rows by key", () => {
    const html = renderToStaticMarkup(
      <ComparePair>
        <CompareCard tone="was" eyebrow="Зараз" title="Чати, диск, пам'ять" rows={rows} outcome="Акт повертають." />
        <CompareCard tone="now" eyebrow="З GoProceed" title="Один запис" rows={[{ ...rows[0]!, answer: "На роботі W-014", ref: "EV-0248 · 14:32" }]} outcome="Акт не повертають." />
      </ComparePair>,
    );
    expect(html.match(/data-compare-row="photo"/g)).toHaveLength(2);
    expect(html).toContain('data-compare-tone="was"');
    expect(html).toContain('data-compare-tone="now"');
    expect(html).toContain("EV-0248 · 14:32");
    expect(html).toContain('aria-hidden="true"');
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `Compare.tsx`:

```tsx
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cx } from "./cn";

export type CompareRow = { key: string; question: string; answer: string; ref?: string | undefined };

/**
 * «Було і стало» as two sheets — the prototype's ninth iteration. The same
 * questions in both cards, answered twice; a hovered row lights its twin in
 * the other card, and that pairing is CSS `:has()` on the pair container
 * (`base.css`), not JavaScript, so the cards stay server components.
 *
 * `was` is a dashed sheet on the subtle ground; `now` is a white sheet with
 * the accent edge, lifted 12px, on the float shadow — the prototype's
 * composition, in roles.
 */
export function ComparePair({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <div data-slot="compare-pair" className={cx("compare-pair grid items-stretch gap-0 md:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)]", className)}>
      {children}
    </div>
  );
}

const TONE = {
  was: "border-dashed border-line-strong bg-subtle",
  now: "border-line-accent bg-surface shadow-float md:-translate-y-3",
} as const;

export function CompareCard({
  tone, eyebrow, title, rows, outcome, className,
}: {
  tone: keyof typeof TONE;
  eyebrow: string;
  title: string;
  rows: CompareRow[];
  outcome: string;
  className?: string | undefined;
}) {
  const now = tone === "now";
  return (
    <article
      data-compare-tone={tone}
      className={cx("grid grid-rows-[auto_1fr_auto] overflow-hidden rounded-surface border", TONE[tone], now ? "order-3" : "order-1", className)}
    >
      <header className="grid gap-0.5 border-b border-line px-5 pb-3.5 pt-4">
        <p className={cx("index-label", now && "text-status-review-fg")}>{eyebrow}</p>
        <p className="text-body font-semibold text-ink">{title}</p>
      </header>
      <ul>
        {rows.map((row) => (
          <li
            key={row.key}
            data-compare-row={row.key}
            className="grid min-h-24 grid-cols-[20px_1fr] gap-3 border-t border-line px-5 py-3.5 transition-colors duration-fast ease-out first:border-t-0"
          >
            {now ? (
              <span className="mt-0.5 grid size-5 place-items-center rounded-pill border border-status-ready-fg text-status-ready-fg">
                <Check aria-hidden="true" strokeWidth={2} className="size-3" />
              </span>
            ) : (
              <span aria-hidden="true" className="mt-0.5 size-5 rounded-pill border border-line-strong bg-[linear-gradient(135deg,transparent_44%,var(--gp-border-strong)_44%_56%,transparent_56%)]" />
            )}
            <div>
              <p className={cx("text-data font-semibold", now ? "text-ink" : "text-ink-secondary")}>{row.question}</p>
              <p className={cx("text-data leading-relaxed", now ? "text-ink-secondary" : "text-ink-muted")}>{row.answer}</p>
              {row.ref && <p className="mt-0.5 font-mono text-meta text-status-review-fg">{row.ref}</p>}
            </div>
          </li>
        ))}
      </ul>
      <footer className={cx("flex min-h-[74px] items-center border-t border-line px-5 py-4 text-data font-medium",
        now ? "bg-status-ready text-status-ready-fg" : "bg-sunken text-ink-muted")}>
        {outcome}
      </footer>
    </article>
  );
}

/** The arrow between the two cards; rotates to point down when the pair stacks. */
export function CompareArrow() {
  return (
    <div aria-hidden="true" className="order-2 grid h-11 place-items-center md:h-auto">
      <span className="grid size-8 place-items-center rounded-pill border border-line-strong bg-surface text-ink rotate-90 md:rotate-0">→</span>
    </div>
  );
}
```

(`bg-[linear-gradient(…var(--gp-border-strong)…)]` names a role variable, which `primitive-leak` allows; it is the one arbitrary value in the file and the slash glyph has no utility.) `ComparePair` callers place `<CompareArrow />` between the two cards.

`base.css`, after `spotlight`:

```css
/* The «було / стало» pairing: a hovered row lights its twin in the other card.
 * `:has()` on the pair container keeps both cards server-rendered; the wash is
 * a background-color transition, rule 2 territory. */
.compare-pair:has([data-compare-row="photo"]:hover) [data-compare-row="photo"],
.compare-pair:has([data-compare-row="requirement"]:hover) [data-compare-row="requirement"],
.compare-pair:has([data-compare-row="decision"]:hover) [data-compare-row="decision"],
.compare-pair:has([data-compare-row="closure"]:hover) [data-compare-row="closure"],
.compare-pair:has([data-compare-row="act"]:hover) [data-compare-row="act"] {
  background-color: var(--gp-bg-accent-soft);
}
```

The five keys are the product's five questions (Plan 3 Task 16 uses exactly these); a sixth row would need a sixth line here, which is the visible cost of keeping it in CSS.

`index.ts`: `export { ComparePair, CompareCard, CompareArrow, type CompareRow } from "./Compare";`

- [ ] **Step 4: Sink** — Case 22 with the test's two cards and `<CompareArrow />` between.

- [ ] **Step 5: Run** suites + audit → PASS. **Step 6: Commit** — `feat(ui): ComparePair, CompareCard, CompareArrow — «було і стало» as two sheets`.

---

### Task 12: `Stepper` + `Step`

**Files:**
- Create: `packages/ui/src/components/Stepper.tsx`
- Modify: `index.ts`, component sink (Case 23)
- Test: `apps/landing/tests/ui-components.test.tsx`

**Interfaces:**
- Produces: `Stepper({ children, className? })` — a client component wrapping `InViewProgress`; a vertical line whose fill is `scaleY(var(--gp-progress))`; `Step({ index: number, count: number, when: string, title: string, children, className? })` — its dot's opacity crosses from `line-strong` to ink when `--gp-progress` passes `index / count`. Renders `data-slot="step"`.

- [ ] **Step 1: Failing test**

```tsx
describe("Stepper", () => {
  it("renders steps with a progress-driven line and dots", () => {
    const html = renderToStaticMarkup(
      <Stepper>
        <Step index={0} count={2} when="День 1" title="Реєстр">Дві години.</Step>
        <Step index={1} count={2} when="Тиждень 1" title="Майданчик">Знімає.</Step>
      </Stepper>,
    );
    expect(html.match(/data-slot="step"/g)).toHaveLength(2);
    expect(html).toContain("--gp-progress");
    expect(html).toContain('data-stepper-line="true"');
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

```tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import { InViewProgress } from "../motion/InViewProgress";
import { cx } from "./cn";

/**
 * The pilot plan as a vertical stepper — 21st.dev's «Steppers», timed rather
 * than scrubbed. `InViewProgress` publishes 0→1 into `--gp-progress` once the
 * stepper is in view; the line's fill is a `scaleY` of that number and each
 * dot fades to ink as the number passes its threshold. Arithmetic in CSS
 * rather than React state: nothing re-renders per frame, and under reduced
 * motion the progress is 1 from the first paint, so the plan is complete.
 */
export function Stepper({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <InViewProgress className={cx("relative grid pl-9", className)}>
      <span aria-hidden="true" className="absolute bottom-3 left-2.5 top-3 w-0.5 bg-line" />
      <span
        aria-hidden="true"
        data-stepper-line="true"
        className="absolute bottom-3 left-2.5 top-3 w-0.5 origin-top bg-ink"
        style={{ transform: "scaleY(var(--gp-progress, 0))" }}
      />
      {children}
    </InViewProgress>
  );
}

export function Step({
  index, count, when, title, children, className,
}: {
  index: number;
  count: number;
  when: string;
  title: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  // The dot lights when progress passes index/count + 0.02 — the prototype's
  // threshold. clamp() turns the difference into 0 or 1 without a state flip.
  const threshold = index / count + 0.02;
  const lit = { opacity: `clamp(0, calc((var(--gp-progress, 0) - ${threshold}) * 100), 1)` } as CSSProperties;
  return (
    <article data-slot="step" className={cx("relative pb-7 last:pb-0", className)}>
      <span aria-hidden="true" className="absolute -left-8 top-1.5 size-3 rounded-pill border-2 border-line-strong bg-canvas" />
      <span aria-hidden="true" className="absolute -left-8 top-1.5 size-3 rounded-pill bg-ink" style={lit} />
      <p className="index-label mb-1.5">{when}</p>
      <h3 className="text-h3 font-semibold text-ink">{title}</h3>
      <div className="mt-1.5 max-w-[44ch] text-data leading-relaxed text-ink-secondary">{children}</div>
    </article>
  );
}
```

(`opacity` and `transform` in inline styles are layout values; `component-contract` flags only colour-carrying inline styles.)

`index.ts`: `export { Stepper, Step } from "./Stepper";` — and update the header comment's «Breadcrumb, Pagination, Timeline, Stepper — no screen needs them yet» to «Breadcrumb, Pagination, Timeline — no screen needs them yet; `Stepper` arrived 2026-09-05 with the landing's pilot plan».

- [ ] **Step 4: Sink** — Case 23 with four steps (День 1 / Тиждень 1 / Тиждень 2 / Підсумок, `count={4}`).

- [ ] **Step 5: Run** suites + audit → PASS. **Step 6: Commit** — `feat(ui): Stepper and Step, driven by InViewProgress`.

---

### Task 13: Plan 2 gate

- [ ] **Step 1: Run the five commands and the workspace suites**

```bash
pnpm --filter @goproceed/tokens generate
node packages/testing/qa/motion-audit.mjs
pnpm --filter @goproceed/testing test
pnpm turbo run typecheck
pnpm --filter @goproceed/landing build
pnpm --filter @goproceed/landing test
```

Expected: `motion-audit: clean`; all green.

- [ ] **Step 2: See the sinks**

`preview_start` the landing dev server (`apps/landing`: `next dev -p 3100`; add a `.claude/launch.json` entry `{ "name": "landing", "runtimeExecutable": "pnpm", "runtimeArgs": ["--filter", "@goproceed/landing", "dev"], "port": 3100 }` if none exists), open `/kitchen-sink` and `/kitchen-sink/components` at 1440 and 390, then with reduced motion emulated: the frame is flat and the beam absent; the stepper is complete; the spotlight still follows the pointer (it is not motion). Screenshot both and keep them beside the gate output.

- [ ] **Step 3: Append the gate output** to `docs/superpowers/plans/evidence/2026-09-05-landing-daylight-gate.md` under `## Plan 2 — components` and commit:

```bash
git add docs/superpowers/plans/evidence/2026-09-05-landing-daylight-gate.md
git commit -m "docs(evidence): Plan 2 gate — vocabulary and components green

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
