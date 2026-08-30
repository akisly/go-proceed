# Landing motion vocabulary — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** turn `node packages/testing/qa/motion-audit.mjs` green by giving the
vocabulary the three words the landing needed, and fix the two red landing tests
filed with that debt.

**Architecture:** three new primitives in `packages/ui/src/motion/` —
`SlideSwap` (a swap that has a direction), `TrackFill` (a progress line driven by
state), `InViewProgress` (publishes progress into `--gp-progress`, renders
nothing). The three landing files then use them and stop importing `motion/react`.
The readiness diagram keeps drawing itself; it reads the CSS variable instead of
holding `MotionValue`s.

**Tech Stack:** React 19, Motion for React (inside `packages/ui/src/motion` only),
Tailwind v4 with cleared stock namespaces, vitest 3.2.4, `renderToStaticMarkup`
for landing tests (node environment, no jsdom).

**Spec:** `docs/superpowers/specs/2026-08-30-landing-motion-vocabulary-design.md`

## Global Constraints

- **No `motion/react` or `framer-motion` import outside `packages/ui/src/motion`.**
  `motion-audit.mjs` rule 5; `EXCLUDED = []` and it stays empty.
- **No literal duration or curve in a primitive.** Draw from `./tokens`:
  `DURATION.{instant,fast,base,slow,deliberate,marquee}`,
  `EASE.{out,enter,emphatic,soft,overshoot}`, `REDUCED = { duration: 0.12, ease: "linear" }`.
- **Reduced motion is a DIFFERENT animation, never a faster one.** Every primitive
  branches on `useReduced()` from `./use-reduced`.
- **No `ease-in`** — `motion-audit` rule 3. No `transition: all` — rule 1. No
  layout-property transition — rule 2. No perpetual animation but the marquee — rule 4.
- **Role names only in classes.** `text-meta`, `text-ink-muted`, `bg-surface`,
  `border-line`. Stock Tailwind (`text-sm`, `rounded-md`) compiles to nothing.
- **Never write a Tailwind class as a template literal** — the scanner sees the
  template, not the class, and emits no CSS.
- **`exactOptionalPropertyTypes` is on** — optional props are `T | undefined`.
- **Every primitive is exported from `packages/ui/src/motion/index.ts` and rendered
  on `apps/landing/app/kitchen-sink/page.tsx`.** Task 1 makes the second one a gate.
- **Ukrainian strings, never lorem.** «Внутрішньо готово», «Секція А · підвал».
- **No passthrough re-export of `motion/react` from the vocabulary.** A
  `export { motion } from "motion/react"` would satisfy the audit's regex while
  defeating its purpose; the spec §9 rules it out by name.

---

### Task 1: Extend the kitchen-sink gate to the motion vocabulary

The components gate landed 2026-08-30 and reads `packages/ui/src/components/index.ts`
only. The twelve motion primitives are all on `/kitchen-sink` today, so the gate is
green the moment it is written — which is the point: it must exist BEFORE the three
new primitives, or nothing forces them onto that page.

**Files:**
- Modify: `packages/testing/src/component-contract.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a failing test the moment a primitive is exported without a sink entry.
  Tasks 2–4 each rely on this to prove their sink entry is real.

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe("the inventory is closed and complete", …)`:

```ts
  /**
   * The same obligation, for the other index. §7.3 calls a thirteenth primitive
   * «a decision», and a decision nobody can see is not one — the motion sink is
   * where a primitive's reduced-motion branch gets looked at.
   */
  it("renders every motion primitive in the motion kitchen sink", () => {
    const motionIndex = readFileSync(
      join(repoRoot, "packages/ui/src/motion/index.ts"), "utf8");
    const sink = readFileSync(
      join(repoRoot, "apps/landing/app/kitchen-sink/page.tsx"), "utf8");

    const names = [...motionIndex.matchAll(/export\s*\{([^}]*)\}\s*from\s*"\.\/([\w-]+)"/g)]
      .filter((m) => !["tokens", "use-reduced"].includes(m[2]!))
      .flatMap((m) => m[1]!.split(",")
        .map((n) => n.trim().split(/\s+as\s+/).pop()!.trim())
        .filter((n) => /^[A-Z]/.test(n)));

    const unrendered = names.filter((n) => !new RegExp(`\\b${n}\\b`).test(sink));
    expect(unrendered).toEqual([]);
  });
```

- [ ] **Step 2: Run it and confirm it PASSES**

Run: `pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts`
Expected: 16/16 pass. All twelve primitives are already on that page — this test is
a tripwire for tasks 2–4, not a red-to-green step. If it fails now, stop: a
primitive is missing from the sink and that is a separate finding.

- [ ] **Step 3: Prove the tripwire actually trips**

Temporarily add `export { Nothing } from "./Nothing";` to
`packages/ui/src/motion/index.ts`, re-run the test, confirm it reports
`[ 'Nothing' ]`, then REVERT that line. A gate never seen failing is a gate nobody
has tested.

- [ ] **Step 4: Commit**

```bash
git add packages/testing/src/component-contract.test.ts
git commit -m "test(ui): the motion vocabulary owes the sink the same showing"
```

---

### Task 2: `TrackFill` — a progress line driven by state

**Files:**
- Create: `packages/ui/src/motion/TrackFill.tsx`
- Modify: `packages/ui/src/motion/index.ts`
- Modify: `apps/landing/app/kitchen-sink/page.tsx`

**Interfaces:**
- Consumes: `DURATION`, `EASE`, `REDUCED` from `./tokens`; `useReduced` from `./use-reduced`.
- Produces: `TrackFill({ filled: boolean, className?: string | undefined })` —
  Task 5 (`evidence-rail`) consumes exactly this signature.

- [ ] **Step 1: Write the failing test**

Add to `packages/testing/src/component-contract.test.ts`, in a new describe:

```ts
describe("the three primitives the landing needed", () => {
  const motionDir = join(repoRoot, "packages/ui/src/motion");
  const motionCode = (f: string) =>
    readFileSync(join(motionDir, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length));

  it("TrackFill branches on reduced motion and holds no literal timing", () => {
    const src = motionCode("TrackFill.tsx");
    expect(src).toContain("useReduced");
    expect(src).toContain("REDUCED");
    // `duration: 0` is allowed and is the point: TrackFill's reduced branch
    // applies the final state with NO transition. Zero is the absence of a
    // timing, not a hand-typed one. Any other literal is the defect.
    expect(src.match(/duration:\s*(?!0[,\s}])[\d.]+/g) ?? []).toEqual([]);
    expect(src).not.toMatch(/ease-in\b|cubic-bezier/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts`
Expected: FAIL — `ENOENT: no such file or directory … TrackFill.tsx`

- [ ] **Step 3: Write the primitive**

`packages/ui/src/motion/TrackFill.tsx`:

```tsx
"use client";

import { motion } from "motion/react";
import { DURATION, EASE, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";

/**
 * A segment of a progress rail filling in because the READER moved, not because
 * the page scrolled.
 *
 * The sibling of `LineDraw` and deliberately not a variant of it. `LineDraw`
 * answers to scroll position; this answers to application state. One word with
 * two triggers would make every call site ambiguous about what advances it.
 *
 * `scaleX` from `origin-left`, so the line grows the way the reader reads.
 *
 * REDUCED: the final state, applied with no transition. Not a faster fill — a
 * line that whips across in 120ms is still a moving line.
 */
export function TrackFill({
  filled, className,
}: {
  /** True when this segment sits behind the active step. */
  filled: boolean;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    <motion.span
      aria-hidden="true"
      className={className}
      initial={false}
      animate={{ scaleX: filled ? 1 : 0 }}
      transition={
        reduced
          ? { duration: 0, ease: REDUCED.ease }
          : { duration: DURATION.base, ease: EASE.enter }
      }
    />
  );
}
```

- [ ] **Step 4: Export it**

In `packages/ui/src/motion/index.ts`, beside the other exports:

```ts
export { TrackFill } from "./TrackFill";
```

- [ ] **Step 5: Render it in the motion sink**

In `apps/landing/app/kitchen-sink/page.tsx`, add a case following that file's
existing pattern, with a Ukrainian rule sentence naming what makes it different
from `LineDraw`: that it answers to state, not to scroll. Render three segments
with the middle one `filled`.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts`
Expected: PASS, including Task 1's motion-sink gate.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/motion/TrackFill.tsx packages/ui/src/motion/index.ts \
        apps/landing/app/kitchen-sink/page.tsx packages/testing/src/component-contract.test.ts
git commit -m "feat(motion): TrackFill — the progress line that answers to state"
```

---

### Task 3: `SlideSwap` — a swap that has a direction

**Files:**
- Create: `packages/ui/src/motion/SlideSwap.tsx`
- Modify: `packages/ui/src/motion/index.ts`
- Modify: `apps/landing/app/kitchen-sink/page.tsx`

**Interfaces:**
- Consumes: `DURATION`, `EASE`, `REDUCED`, `useReduced`.
- Produces: `SlideSwap({ activeKey: string, direction: 1 | -1, children: ReactNode, className?: string | undefined })`
  — Task 6 (`evidence-journey-client`) consumes exactly this.

- [ ] **Step 1: Write the failing test**

Add to the same describe as Task 2:

```ts
  it("SlideSwap takes a direction and reduces to a cross-fade", () => {
    const src = motionCode("SlideSwap.tsx");
    expect(src).toContain("direction");
    expect(src).toContain("useReduced");
    // The reduced branch must not translate — a direction is the thing being
    // dropped, not shortened.
    const reducedBranch = src.slice(src.indexOf("reduced ?"));
    expect(reducedBranch.slice(0, 200)).not.toMatch(/\bx:\s*[^0]/);
    expect(src.match(/duration:\s*[\d.]+/g) ?? []).toEqual([]);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts`
Expected: FAIL — `ENOENT … SlideSwap.tsx`

- [ ] **Step 3: Write the primitive**

`packages/ui/src/motion/SlideSwap.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DURATION, EASE, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";

/** How far a panel travels. Small on purpose — see the header. */
const TRAVEL = 24;

/**
 * Swapping one panel for the next in a sequence the reader is walking through.
 *
 * NOT A VARIANT OF `CrossFade`. That one is symmetric on purpose — its header
 * says a cross-fade has no direction, so an ease-out would tell the reader
 * something untrue. Here the opposite is true: the reader pressed «next», the
 * story HAS a direction, and an arrival curve is the honest one. Two words,
 * because two different things are being said.
 *
 * 24px, not 200: enough that the eye reads «the next one», not so much that it
 * implies a carousel the reader could swipe.
 *
 * `mode="wait"` for the same reason CrossFade uses it — two panels of different
 * heights overlapping makes the page jump under a deliberate press.
 *
 * REDUCED: a cross-fade. The direction is DROPPED, not shortened; a 24px slide
 * finished in 120ms is still a slide, and the vestibular system does not care
 * how quickly the thing moved.
 */
export function SlideSwap({
  activeKey, direction, children, className,
}: {
  /** Changing this swaps the panel. Use the chapter id, never an index. */
  activeKey: string;
  /** 1 when the story moves forward, -1 when it moves back. */
  direction: 1 | -1;
  children: ReactNode;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={activeKey}
        custom={direction}
        className={className}
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: direction * TRAVEL }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, x: direction * -TRAVEL }}
        transition={
          reduced
            ? { duration: REDUCED.duration, ease: REDUCED.ease }
            : { duration: DURATION.base, ease: EASE.enter }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Export it**

```ts
export { SlideSwap } from "./SlideSwap";
```

- [ ] **Step 5: Render it in the motion sink, and correct the page's own count**

Add a case with two buttons («Назад» / «Далі») driving `direction` and `activeKey`
over three Ukrainian panels, so the difference from `CrossFade` is visible by
pressing rather than by reading.

**Then update the count in two places on that same page**, which Task 2 left at
thirteen: the header comment at the top of the file, and the visible `<h1>`
(«Тринадцять примітивів і жодного більше» → «Чотирнадцять…»). The page must be
true at the commit it lands in — a heading promising «and not one more» printed
above one more is a false claim a visitor reads. Do not skip ahead to fifteen;
Task 4 owns its own increment.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/motion/SlideSwap.tsx packages/ui/src/motion/index.ts \
        apps/landing/app/kitchen-sink/page.tsx packages/testing/src/component-contract.test.ts
git commit -m "feat(motion): SlideSwap — the swap that knows which way the story went"
```

---

### Task 4: `InViewProgress` — the word that draws nothing

**Files:**
- Create: `packages/ui/src/motion/InViewProgress.tsx`
- Modify: `packages/ui/src/motion/index.ts`
- Modify: `apps/landing/app/kitchen-sink/page.tsx`

**Interfaces:**
- Consumes: `DURATION`, `EASE`, `useReduced`.
- Produces: `InViewProgress({ children: ReactNode, amount?: number | undefined, className?: string | undefined })`,
  publishing `--gp-progress` (0 → 1) on its own wrapper element. Task 7
  (`readiness-workflow`) reads that variable and nothing else.

- [ ] **Step 1: Write the failing test**

```ts
  it("InViewProgress publishes --gp-progress and never re-renders to do it", () => {
    const src = motionCode("InViewProgress.tsx");
    expect(src).toContain("--gp-progress");
    expect(src).toContain("useReduced");
    // A useState per frame is the thing this primitive exists to avoid.
    expect(src).not.toMatch(/useState/);
    expect(src.match(/duration:\s*[\d.]+/g) ?? []).toEqual([]);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts`
Expected: FAIL — `ENOENT … InViewProgress.tsx`

- [ ] **Step 3: Write the primitive**

`packages/ui/src/motion/InViewProgress.tsx`:

```tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, useInView, useMotionValue } from "motion/react";
import { DURATION, EASE } from "./tokens";
import { useReduced } from "./use-reduced";

/**
 * A progress number, and nothing else. The only word in this vocabulary that
 * renders no visual of its own.
 *
 * WHY IT EXISTS. `readiness-workflow` is a diagram of one product concept —
 * trunk, branch, travelers, pulses — derived from a single 0→1 progress. Moving
 * that drawing into this package would put a domain picture into a shared
 * vocabulary; leaving it as it was kept `motion/react` in `apps/landing`, which
 * rule 5 forbids. So the vocabulary supplies the number and the landing keeps
 * the picture.
 *
 * IT WRITES A CSS VARIABLE RATHER THAN RETURNING A VALUE. A render prop would
 * read better and re-render a 340-line SVG sixty times a second. The variable
 * is set straight on the node, so the subtree restyles without React knowing.
 *
 * REDUCED: publishes 1 immediately and never animates — the diagram renders in
 * its settled state, which is a different outcome, not a fast one.
 */
export function InViewProgress({
  children, amount, className,
}: {
  children: ReactNode;
  /** How much of the wrapper must be visible before it starts. Default 0.4. */
  amount?: number | undefined;
  className?: string | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: amount ?? 0.4, once: true });
  const reduced = useReduced();
  const progress = useMotionValue(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced) {
      node.style.setProperty("--gp-progress", "1");
      return;
    }
    if (!inView) {
      node.style.setProperty("--gp-progress", "0");
      return;
    }
    // Same shape as CountUp.tsx, which is the precedent for an in-view
    // `animate` in this package — a MotionValue driven by `animate`, the
    // controls stopped on cleanup, and no explicit return-type annotation
    // because inference already has it.
    const controls = animate(progress, 1, {
      duration: DURATION.deliberate,
      ease: EASE.out,
      onUpdate: (v) => node.style.setProperty("--gp-progress", v.toFixed(4)),
    });
    return () => controls.stop();
  }, [inView, reduced, progress]);

  return <div ref={ref} className={className}>{children}</div>;
}
```

- [ ] **Step 4: Export it**

```ts
export { InViewProgress } from "./InViewProgress";
```

- [ ] **Step 5: Render it in the motion sink, and correct the page's own count**

Add a case wrapping a plain `<div>` whose width is
`style={{ width: "calc(var(--gp-progress, 0) * 100%)" }}` over a `bg-line`
track, with a Ukrainian sentence saying the primitive itself draws nothing and
this bar is the caller's.

**Then update the count in FOUR places, in two files.**

On the sink page, which Task 3 left at fourteen: the header comment at the top of
the file, and the visible `<h1>` («Чотирнадцять примітивів і жодного більше» →
«П'ятнадцять…»).

And in `packages/ui/src/motion/index.ts`, whose own header still says «TWELVE
primitives» in two places (its opening line and «living inside these twelve
files»). That file is the vocabulary's manifest and has been stale since Task 2 —
the earlier ruling that the count must be true at every commit only knew about
the page. It goes from twelve straight to fifteen here; the two intermediate
commits cannot be made true after the fact.

Fifteen is the number Task 9 records in the plan's §8.3.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @goproceed/testing exec vitest run src/component-contract.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/motion/InViewProgress.tsx packages/ui/src/motion/index.ts \
        apps/landing/app/kitchen-sink/page.tsx packages/testing/src/component-contract.test.ts
git commit -m "feat(motion): InViewProgress — a number the vocabulary owed the landing"
```

---

### Task 5: `evidence-rail` stops importing Motion

**Files:**
- Modify: `apps/landing/components/visuals/evidence-rail.tsx`
- Test: `apps/landing/tests/landing-render.test.tsx` (already renders `EvidenceRail`)

**Interfaces:**
- Consumes: `TrackFill` (Task 2), plus existing `NodeLock` and `CrossFade`.
- Produces: no new interface. The component's props are unchanged:
  `EvidenceRail({ active: JourneyChapter["id"] })`.

- [ ] **Step 1: Write the failing test**

Add to `apps/landing/tests/landing-render.test.tsx`:

```tsx
describe("the evidence rail reaches Motion through the vocabulary", () => {
  it("keeps its markers and connectors in the rendered output", () => {
    expect(decisionRail).toContain('data-evidence-rail="true"');
    expect(decisionRail.match(/data-evidence-point="true"/g)).toHaveLength(3);
    expect(decisionRail.match(/data-evidence-connector="true"/g)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it to verify it PASSES before the rewrite**

Run: `pnpm --filter @goproceed/landing exec vitest run tests/landing-render.test.tsx`
Expected: PASS. This is a characterization test — it pins what the rewrite must
not change. Writing it first is what makes the rewrite safe; watching it stay
green afterwards is the assertion.

- [ ] **Step 3: Rewrite the component**

In `apps/landing/components/visuals/evidence-rail.tsx`:
- Delete `import { AnimatePresence, motion } from "motion/react";` and the two
  local curve arrays `easeEnter` / `easeOut` — they are hand-copied values the
  tokens already name.
- Add `import { CrossFade, NodeLock, TrackFill } from "@goproceed/ui/motion";`
- Replace the connector `motion.span` with
  `<TrackFill filled={index <= currentIndex} className="absolute inset-0 origin-left bg-ink" />`
- Replace each point marker `motion.span` with `NodeLock` wrapping the same span,
  passing `index={index}`.
- Replace the `AnimatePresence` around the check icon with
  `<CrossFade activeKey={isComplete ? "done" : "pending"}>`.
- Keep every class exactly as it is, and every `data-*` attribute EXCEPT the one
  named in Step 3b below.

- [ ] **Step 3b: The attribute that names the engine becomes a lie — change it**

`evidence-rail.tsx:22` renders `data-evidence-rail-motion="motion"`, and
`apps/landing/tests/landing-render.test.tsx:114` asserts it:

```ts
expect(section.match(/data-evidence-rail-motion="motion"/g)?.length).toBeGreaterThanOrEqual(2);
```

That attribute states WHICH LIBRARY animates the rail — which is precisely what
the vocabulary exists to stop callers knowing. After this rewrite the rail
reaches Motion only through `TrackFill`, so `"motion"` would be false.

Change the attribute to `data-evidence-rail-motion="vocabulary"` in the
component, and update that assertion to match. Do not delete the attribute: the
QA harness's viewport pass uses these hooks to find the rail, and the test's
count (`>= 2`) is what proves the rail rendered more than one node.

- [ ] **Step 4: Run the tests and the audit**

```bash
pnpm --filter @goproceed/landing exec vitest run tests/landing-render.test.tsx
node packages/testing/qa/motion-audit.mjs
```
Expected: tests PASS; the audit drops from 3 findings to 2 and no longer names
`evidence-rail.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/landing/components/visuals/evidence-rail.tsx apps/landing/tests/landing-render.test.tsx
git commit -m "refactor(landing): the rail speaks the vocabulary"
```

---

### Task 6: `evidence-journey-client` stops importing Motion

**Files:**
- Modify: `apps/landing/components/blocks/evidence-journey-client.tsx`
- Test: `apps/landing/tests/landing-render.test.tsx`

**Interfaces:**
- Consumes: `SlideSwap` (Task 3), plus existing `Reveal`, `Stagger`, `StaggerItem`.
- Produces: no new interface.

- [ ] **Step 1: Read the four assertions this rewrite is about to break**

`apps/landing/tests/landing-render.test.tsx:111-114` pins the attributes this
component uses to say HOW it animates:

```ts
expect(section).toContain('data-evidence-motion-engine="motion"');
expect(section).toContain('data-evidence-stage-transition="presence"');
expect(section.match(/data-evidence-scroll-trigger="motion-in-view"/g) ?? []).toHaveLength(3);
```

Three of those values name the library and its mechanisms — `motion`,
`presence`, `motion-in-view`. That is exactly the knowledge the vocabulary
exists to take away from callers, and after this rewrite all three are false:
the engine is reached through primitives, the swap is a `SlideSwap`, and the
in-view trigger belongs to `Stagger`.

**They are renamed, not deleted.** The QA harness's viewport pass uses these
hooks to find the section, and the count of three is what proves all three
chapters rendered.

- [ ] **Step 2: Update the three assertions to the truthful values**

In `apps/landing/tests/landing-render.test.tsx`:

```ts
expect(section).toContain('data-evidence-motion-engine="vocabulary"');
expect(section).toContain('data-evidence-stage-transition="slide-swap"');
expect(section.match(/data-evidence-scroll-trigger="stagger"/g) ?? []).toHaveLength(3);
```

Run: `pnpm --filter @goproceed/landing exec vitest run tests/landing-render.test.tsx`
Expected: FAIL, three assertions, each reporting the old value still in the DOM.
That failure is this task's RED step — the component has not been rewritten yet.

- [ ] **Step 3: Rewrite the component**

- Delete the `motion/react` import.
- Add `import { Reveal, SlideSwap, Stagger, StaggerItem } from "@goproceed/ui/motion";`
- Rename the three attributes to the values Step 2 now expects:
  `data-evidence-motion-engine="vocabulary"` (line 94),
  `data-evidence-stage-transition="slide-swap"` (line 100),
  `data-evidence-scroll-trigger="stagger"` (line 162).
- The `AnimatePresence` with `custom={direction}` becomes
  `<SlideSwap activeKey={active} direction={direction}>`. The component already
  computes `direction` as `1 | -1`; pass it straight through.
- The copy block's `motion.div` with `variants={copyItemVariants}` becomes
  `Stagger` wrapping `StaggerItem` children; delete `copyItemVariants` and any
  other local variant objects — they are literal timings the tokens own.
- `motion.h`/`motion.p`/`motion.ul` become plain elements inside `StaggerItem`.

- [ ] **Step 4: Run the tests and the audit**

```bash
pnpm --filter @goproceed/landing exec vitest run tests/landing-render.test.tsx
node packages/testing/qa/motion-audit.mjs
```
Expected: tests PASS; the audit is down to 1 finding, naming only
`readiness-workflow.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/landing/components/blocks/evidence-journey-client.tsx apps/landing/tests/landing-render.test.tsx
git commit -m "refactor(landing): the journey swaps with a direction it can name"
```

---

### Task 7: `readiness-workflow` draws from a CSS variable

The largest task, and the one with a real trap: thirteen `useTransform` values
must become `calc()` expressions that mean the same thing.

**Files:**
- Modify: `apps/landing/components/visuals/readiness-workflow.tsx`
- Test: `apps/landing/tests/landing-render.test.tsx`

**Interfaces:**
- Consumes: `InViewProgress` (Task 4). Reads `--gp-progress` and nothing else.
- Produces: no new interface.

- [ ] **Step 1: Write the failing test**

```tsx
  it("renders the readiness diagram without reaching for Motion", () => {
    const src = readFileSync(
      join(import.meta.dirname, "..", "components/visuals/readiness-workflow.tsx"), "utf8");
    expect(src).not.toContain("motion/react");
    expect(src).toContain("InViewProgress");
    expect(src).toContain("--gp-progress");
  });
```

Add `import { readFileSync } from "node:fs";` and `import { join } from "node:path";`
at the top of the test file if they are not already there.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @goproceed/landing exec vitest run tests/landing-render.test.tsx`
Expected: FAIL — the file still contains `motion/react`.

- [ ] **Step 3: Rewrite the component**

- Delete the `motion/react` import. Keep `useReduced` — it already branches, and
  the component's `motionState` must stay in step with the primitive's own
  reduced behaviour.
- Wrap the diagram's root in `<InViewProgress>` and delete the local
  `useInView(workflowRef, …)`; the primitive owns that trigger now.
- Each of the thirteen `useTransform(source, inputRange, outputRange)` becomes an
  inline `style` whose value is a `calc()` over `var(--gp-progress, 0)`. For a
  transform mapping `[a, b] → [c, d]`, the expression is:
  `calc(${c} + (${d} - ${c}) * clamp(0, (var(--gp-progress, 0) - ${a}) / (${b} - ${a}), 1))`
  Write each one out; do not build the string with a template literal helper —
  a Tailwind-adjacent template is the trap this repo already paid for once, and
  an inline `style` is the one route a computed value legitimately has.
- `motion.path` / `motion.circle` / `motion.rect` become plain `<path>`,
  `<circle>`, `<rect>` carrying those styles.
- Keep every `data-*` attribute, every class, and the `motionState` values
  (`static` / `active` / `idle`) exactly as they are.

- [ ] **Step 4: Run the tests and the audit**

```bash
pnpm --filter @goproceed/landing exec vitest run tests/landing-render.test.tsx
node packages/testing/qa/motion-audit.mjs
```
Expected: tests PASS; **`motion-audit: clean`** — the line this whole slice exists
to produce.

- [ ] **Step 5: Commit**

```bash
git add apps/landing/components/visuals/readiness-workflow.tsx apps/landing/tests/landing-render.test.tsx
git commit -m "refactor(landing): the readiness diagram reads a number instead of holding one"
```

---

### Task 8: The two red landing tests

Neither is a motion change. They are here because leaving them makes
`turbo run test` red on 2026-09-01 regardless of the motion work.

**Files:**
- Modify: `apps/landing/components/visuals/field-review-visual.tsx:74`
- Modify: `apps/landing/components/blocks/pilot-enquiry.tsx`

**Interfaces:**
- Consumes: nothing. Produces: nothing.

- [ ] **Step 1: Run both failing tests and read the assertions**

```bash
pnpm --filter @goproceed/landing test
```
Expected: 2 failures —
`expected [] to have a length of 1` (`landing-craft.test.tsx`, the handoff line)
and `expected 'id="pilot" …' to contain 'aria-live="polite"'` (`landing-render.test.tsx`).

- [ ] **Step 2: Fix the handoff line**

`landing-craft.test.tsx` asserts the element carrying `data-handoff-line="true"`
also carries the literal class `wide:right-8`. Add that class to that element.
It must be a literal in the class string — a template literal emits no CSS.

- [ ] **Step 3: Fix the pilot form's status region**

`landing-render.test.tsx` asserts the `#pilot` section contains
`aria-live="polite"`. The form has no status region at all today. Add one that
announces the outcome of «Підготувати лист» — a `<p aria-live="polite">` in the
form, empty until there is something to say. Do NOT put `aria-live` on a
decorative element to satisfy the string match: the test's name is «renders an
honest accessible pilot form», and an announcer that announces nothing is the
dishonest version of passing it.

- [ ] **Step 4: Run the landing suite**

Run: `pnpm --filter @goproceed/landing test`
Expected: 42/42 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/landing
git commit -m "fix(landing): the wide-screen gap, and a pilot form that can speak"
```

---

### Task 9: The documentation this change owes

§7.3 is explicit that a new primitive is a decision the plan's §8.3 must record.

**Files:**
- Modify: `docs/design/2026-08-19-design-system-rewrite-plan.md` (§8.3)
- Modify: `docs/design/02-building-ui.md` (§4.1 substitution table)
- Modify: `TODOS.md`

**Interfaces:** none.

- [ ] **Step 1: Record the three in §8.3**

In `docs/design/2026-08-19-design-system-rewrite-plan.md` §8.3, add the three
primitives to the list with, for each, the choreography that had no word:
`SlideSwap` — a swap whose direction the reader caused; `TrackFill` — a progress
line driven by state rather than scroll; `InViewProgress` — a progress number for
a drawing the vocabulary should not own. Mark the section's count: twelve became
fifteen on 2026-08-30.

- [ ] **Step 2: Add the rows to §4.1**

In `docs/design/02-building-ui.md`, three rows in the substitution table:

| Do not write | Write | What happens otherwise |
|---|---|---|
| `<AnimatePresence custom={dir}>` | `SlideSwap` | Rule 5, build failure |
| a state-driven `motion.span` progress line | `TrackFill` | Rule 5; `LineDraw` is the scroll one |
| `useTransform` in a landing visual | `InViewProgress` + `calc(var(--gp-progress))` | Rule 5 |

- [ ] **Step 3: Close the P2 in TODOS.md with its measurement**

Add a dated closure to the `motion/react` entry: the audit prints
`motion-audit: clean`, `@goproceed/testing` is 627/627 and `@goproceed/landing`
is 42/42. State the count correction that entry already carries (three offenders,
not two) is now moot because all three are fixed.

- [ ] **Step 4: Run the doc validator**

Run: `node scripts/validate-canonical-docs.mjs`
Expected: 13 findings, ALL of them inside `discovery/templates/` — the outreach
copy the owner has deliberately left as-is pending a production URL. Any finding
outside that directory is this task's regression and must be fixed before
committing.

- [ ] **Step 5: Commit**

```bash
git add docs/design TODOS.md
git commit -m "docs(motion): three words, and why the vocabulary needed each"
```

---

### Task 10: The gate, and the pass a motion slice may not skip

**Files:** none — this task produces evidence.

- [ ] **Step 1: Run the §5 gate in order and paste the output**

```bash
node packages/testing/qa/motion-audit.mjs
pnpm --filter @goproceed/testing test
pnpm turbo run typecheck
pnpm --filter @goproceed/landing build
pnpm --filter @goproceed/landing test
```

Expected: `motion-audit: clean`; testing 627/627; typecheck 10/10 tasks; landing
build compiles; landing 42/42. Step 1 of the gate (`tokens generate`) is skipped —
this slice changes no token. Say so rather than omitting it.

- [ ] **Step 2: The §6 visual pass**

Six viewports — `1920 · 1440 · 1240 · 768 · 390 · 360` — on `/kitchen-sink` and on
the landing page. Then turn reduced motion on and reload. Assert by looking:
`SlideSwap` stops translating and becomes a fade; `TrackFill` shows its final
state with no travel; `InViewProgress` renders the diagram settled rather than
running it quickly.

**This step is the one a motion slice may not skip.** A slice that verified its
rules and not its subject has verified the wrong thing. If the preview tooling
cannot reach this branch, say so explicitly in the report rather than marking the
step done.

- [ ] **Step 3: Report**

State what passed, what was measured, and — if the visual pass could not run —
which viewports were not seen and why.
