# Landing motion: three words the vocabulary was missing

**Status:** Approved 2026-08-30. **Slice:** closes the `motion/react` P2 and the
two red landing tests filed with it.

## 1. Why this exists

`packages/testing/qa/motion-audit.mjs` has been red since the 2026-08-27 landing
merge. Three files import `motion/react` directly, which rule 5 forbids outside
`packages/ui/src/motion`:

```
apps/landing/components/blocks/evidence-journey-client.tsx:9
apps/landing/components/visuals/evidence-rail.tsx:4
apps/landing/components/visuals/readiness-workflow.tsx:11
```

`pnpm --filter @goproceed/testing test` is 626/627 with that single failure, so
steps 2 and 3 of `docs/design/02-building-ui.md` §5's gate are red on `main` and
every slice that runs the gate inherits it. **Actions billing restores
2026-09-01**; the first CI run after that lands on a red suite unless this ships.

## 2. What was measured, before deciding anything

The TODOS entry assumed this was a rewrite into existing primitives — «`CrossFade`
for the `AnimatePresence` swaps, `Reveal`/`Stagger` for entrances». Reading the
three files against the twelve primitives shows roughly half of that is true and
the rest is not:

| File | Maps onto the vocabulary | Does **not** map |
|---|---|---|
| `evidence-journey-client` (197 lines) | `Stagger`/`StaggerItem`, `Reveal` for the chapter copy | the panel swap is **directional** (`custom={direction}`, `mode="sync"`); `CrossFade`'s own header states it is directionless by design — «a cross-fade has no direction» |
| `evidence-rail` (118 lines) | `NodeLock` for the point markers, `CrossFade` for the check mark | the connector is a progress line driven by **state** (`scaleX` from the active chapter); `LineDraw` is driven by **scroll** (`useScroll` with a target and offset) |
| `readiness-workflow` (340 lines) | — | an in-view-triggered SVG diagram: 13 `useTransform` deriving trunk and branch progress, two travelers and two pulses |

Two things worth recording because they change the shape of the work:

- **`readiness-workflow` is not ignorant of the system.** It already imports
  `useReduced` from `@goproceed/ui/motion` and branches honestly
  (`motionState = reduced ? "static" : active ? "active" : "idle"`). It draws with
  raw `motion.*` inside a correct frame.
- **The audit's exclusion list is empty and is checked.** `EXCLUDED = []`, and a
  sibling test asserts «the exclusion list names only files that still exist».
  Excluding a file would be a legitimate, visible move — it is not the one taken
  here, and §9 says why.

## 3. The decision

§7.3 is explicit that a thirteenth primitive is «not an addition — a decision»,
and that the plan's §8.3 must say what and why in the same change. Three words
are added, and the boundary between vocabulary and component is drawn as follows.

**A primitive is a word of the shared language, not a wrapper around one caller.**
A directional swap and a state-driven progress line recur; they become words. The
readiness diagram is one of a kind — moving it into `packages/ui/src/motion` would
put a domain picture into the vocabulary and disguise a component as a word. So
the diagram stays a landing visual and the vocabulary gives it what it lacks: a
progress number.

### 3.1 How progress reaches the SVG — the mechanism, and why not the obvious one

`useTransform` and `motion.path` both come from `motion/react`, so «the diagram
draws it itself» is not free: the diagram cannot import either. Three ways were
considered.

**Chosen — the primitive publishes progress as a CSS custom property.** It holds
the `MotionValue` internally and writes each frame into `--gp-progress` on its
wrapper element, without re-rendering React. The diagram draws with plain
`<path>`/`<circle>`/`<rect>` and expresses its thirteen derived values as `calc()`
against that variable. Motion stays entirely inside the vocabulary, the diagram
stays a landing visual, and nothing re-renders per frame.
**Cost, stated rather than hidden:** arithmetic moves from TypeScript into CSS and
reads worse there. That is the price of the boundary.

**Rejected — a render prop returning a plain number.** `<InViewProgress>{(p) => …}`
would keep the arithmetic in TypeScript and read best, but it re-renders a
340-line SVG component on every frame — sixty React renders a second for a
decorative diagram.

**Rejected — move the animated SVG elements into the vocabulary**, the way
`LineDraw` does (it owns its `<svg>` and `motion.path`). The precedent is real,
but the trunk, branch, travelers and pulses of a readiness diagram would move with
them, which is exactly the boundary this design refuses.

## 4. The three primitives

All three live in `packages/ui/src/motion/`, are exported from its `index.ts`, and
draw every duration and curve from `./tokens` — no literal number reaches a
component.

### 4.1 `SlideSwap` — a swap that has a direction

```ts
SlideSwap({ activeKey, direction, children, className? })
  activeKey: string          // the panel identity, as CrossFade takes it
  direction: 1 | -1          // 1 = the story moves forward, -1 = back
```

The entering panel arrives from the side the story is moving from; the leaving
panel departs the opposite way. `ease.enter` for the arrival — a swap with a
direction IS arriving somewhere, which is the distinction that makes this a
different word from `CrossFade` rather than a variant of it.

**Reduced:** becomes a cross-fade. No translation at all — a *different*
animation, never the same one made faster (§4.3 rule 8).

### 4.2 `TrackFill` — a progress line driven by state

```ts
TrackFill({ filled, className? })
  filled: boolean            // whether this segment is behind the active step
```

`scaleX` from `origin-left` over a token duration with `ease.enter`. It is the
sibling of `LineDraw` and deliberately not a variant of it: `LineDraw` answers to
the scroll position, `TrackFill` answers to application state, and conflating the
two would give one word two triggers.

**Reduced:** the final state is applied with no transition.

### 4.3 `InViewProgress` — the one word that draws nothing

```ts
InViewProgress({ children, amount?, className? })
```

Runs 0 → 1 once its wrapper enters the viewport and publishes the value into
`--gp-progress` on that wrapper, for its whole subtree. It renders no visual of
its own.

**It is the only non-visual word in the vocabulary, and that is deliberate rather
than an oversight.** The alternative was to give the diagram its own primitive,
which would have made the vocabulary hold a picture of one product concept. A
progress source is reusable; a readiness diagram is not.

**Reduced:** publishes `1` immediately and never runs the sequence — the diagram
renders in its settled state, which is a different outcome from a fast run-through.

## 5. What changes in the three files

- **`evidence-rail.tsx`** — `motion.span` connectors become `TrackFill`; the point
  markers become `NodeLock`; the `AnimatePresence` check becomes `CrossFade`. The
  two local `easeEnter`/`easeOut` arrays are deleted: they are hand-copied curves
  that the tokens already name.
- **`evidence-journey-client.tsx`** — the `AnimatePresence` panel swap becomes
  `SlideSwap` (it already computes `direction`); the copy entrance becomes
  `Stagger` + `StaggerItem`; `motion.h`/`motion.p` become `Reveal` or plain
  elements inside a `StaggerItem`.
- **`readiness-workflow.tsx`** — wrapped in `InViewProgress`; the 13 `useTransform`
  become `calc()` expressions against `--gp-progress`; `motion.path`/`circle`/`rect`
  become plain SVG elements. Its existing `useReduced` branch is kept — the
  primitive's reduced behaviour and the component's `motionState` must agree, and
  the plan below asserts that rather than assuming it.

## 6. The two red landing tests, fixed in the same slice

The TODOS entry groups them with the motion work — same surface, same slice — and
both are single, concrete assertions:

- `landing-craft.test.tsx` «keeps a wide-screen gap between the handoff line and
  review card» expects the `data-handoff-line="true"` element to carry
  `wide:right-8`. It carries no such class today.
- `landing-render.test.tsx` «renders an honest accessible pilot form» expects the
  `#pilot` section to contain `aria-live="polite"`. The form has no status region
  at all; the attribute did not move, it was lost.

Neither is a motion change. They are in this slice because leaving them makes
`turbo run test` red on 2026-09-01 regardless of the motion work, which would
defeat the reason this slice has a date.

## 7. Documentation this change owes

- **`docs/design/2026-08-19-design-system-rewrite-plan.md` §8.3** — §7.3 requires
  the vocabulary's own section to record what was added and why. Three entries,
  each naming the choreography that had no word.
- **`docs/design/02-building-ui.md` §4.1** — the substitution table gains rows for
  the three, so the next reader meets them where they will look.
- **`TODOS.md`** — the P2 closes with its measurement, not with a checkmark.

## 8. Verification

The §5 gate in order, output pasted rather than paraphrased:

1. `pnpm --filter @goproceed/tokens generate` — only if `tokens.json` changed
2. `node packages/testing/qa/motion-audit.mjs` — **must print `motion-audit: clean`**; this is the assertion the whole slice exists for
3. `pnpm --filter @goproceed/testing test` — 627/627
4. `pnpm turbo run typecheck`
5. `pnpm --filter @goproceed/landing build`

Then `pnpm --filter @goproceed/landing test` — 42/42, the two named cases green.

**And §6, which this slice may not skip.** Six viewports (1920 · 1440 · 1240 ·
768 · 390 · 360), then reduced motion on and reload. Every primitive must change
shape, not speed. A motion slice whose visual pass was skipped has verified its
rules and not its subject.

## 9. What this does NOT do

- **It does not use the audit's exclusion list.** Excluding `readiness-workflow`
  would turn the suite green in one commit and leave the rule weaker than it was
  found — the exclusion would outlive the reason for it, which is the failure mode
  the list's own header warns about.
- **It does not restyle the three visuals.** The choreography is re-expressed, not
  redesigned; anything that looks different afterwards is a defect, not an
  improvement, and §6's pass is where that is judged.
- **It adds no thirteenth motion primitive beyond these three**, and no passthrough
  re-export of `motion/react` from the vocabulary. A passthrough would satisfy the
  audit's regex while defeating its purpose.
