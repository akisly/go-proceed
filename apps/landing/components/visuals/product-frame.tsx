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
 * Entrance timing is the prototype's timeline (l.1109–1113) — and it IS a
 * timeline: `#stage` at .35 s, `#receipt` at .7 s, the floats at .9 s, from
 * page load, not from scroll. Every entrance here is `on="load"`. Under
 * `on="view"` the frame (below the fold at 1440×900) showed nothing until
 * the reader scrolled, then rose 60px while `ScrollSettle` was already
 * flattening it with the same scroll — two motions on one element, and a
 * dashboard the hero promised but did not show (2026-09-06).
 */
export function ProductFrame() {
  const pills = demoRecords.receipt.pills;
  return (
    <Reveal on="load" delay={0.35} size="grand" y={60} className="mt-11 md:mt-16">
      <ScrollSettle className="pb-4 md:pb-24">
        {/*
          The receipt is a standalone `Reveal` (its own entrance, independent
          delay) nested inside `Depth`, drifting on top: `Depth → Reveal →
          drift`. The pills are two siblings inside one shared `Stagger`, so
          the order swaps to `StaggerItem → Depth → drift` — the stagger has
          to be the outermost wrapper for its `whileInView` to see both
          children as one group. Every transform in both chains is an
          independent translate/rotate (Tilt's board lean, ScrollSettle's
          settle, Reveal's/StaggerItem's rise, Depth's parallax offset, the
          drift keyframes), so nesting order has no visible effect — it only
          has to keep `perspective` reaching `Tilt` through an unbroken
          `transform-style: preserve-3d` chain (this wrapper carries it; see
          the final review's F1).
        */}
        <div className="relative mx-auto max-w-[1040px] [transform-style:preserve-3d]">
          <Tilt area="section" maxX={1.5} maxY={2}><Board /></Tilt>
          <Depth depth={-0.3} className="md:absolute md:-bottom-20 md:right-[-3%] md:w-[236px]">
            <Reveal on="load" delay={0.7} size="grand" x={20} y={40}><div className="drift-a"><Receipt /></div></Reveal>
          </Depth>
          <Stagger on="load" step="loose" delay={0.9} className="pointer-events-none absolute inset-0 hidden md:block">
            <StaggerItem y={20} size="stately" className="absolute -bottom-9 left-0">
              <Depth depth={0.35}>
                <span className="drift-b inline-block whitespace-nowrap rounded-pill border border-line-strong bg-surface px-3 py-1.5 text-data text-ink-secondary shadow-overlay">
                  <b className="font-medium text-ink">{pills[0]!.lead}</b> {pills[0]!.text}
                </span>
              </Depth>
            </StaggerItem>
            <StaggerItem y={20} size="stately" className="absolute -top-12 left-0">
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
