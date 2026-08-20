"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { DURATION, EASE } from "./tokens";
import { useReduced } from "./use-reduced";

export type PinnedTab = {
  /** Stable id — used as the CrossFade key and the DOM id. Never an index. */
  id: string;
  label: string;
  hint: string;
  panel: ReactNode;
};

type PinnedTabsProps = { tabs: PinnedTab[]; className?: string | undefined };

/**
 * The product tour: a sticky tab strip whose active tab advances with scroll
 * progress, with the panel swapping beneath it. Measured on Folio, where it is
 * the only scroll-jacked element on the page — and that is the rule here too.
 *
 * WHAT MAKES THIS DEFENSIBLE RATHER THAN A SCROLL HIJACK
 * ------------------------------------------------------
 * The page never stops scrolling. The section is simply tall — one viewport
 * per tab — and the strip is `position: sticky` inside it. Scroll speed,
 * direction and momentum stay the reader's. Nothing is intercepted, so nothing
 * can be intercepted wrongly.
 *
 * The tabs are also real buttons. Clicking one scrolls to that tab's slice, so
 * a reader who does not want to scroll through four screens does not have to,
 * and a keyboard user reaches every panel without scrolling at all.
 *
 * ACCESSIBILITY
 * -------------
 * `role="tablist"` with `aria-selected` and `aria-controls`, because these
 * genuinely are tabs over panels — unlike the register's segmented filter,
 * which filters a list in place and is therefore `aria-pressed` buttons with
 * no tabpanel to promise.
 *
 * REDUCED MOTION
 * --------------
 * The pinning goes away entirely and the four panels render stacked, each with
 * its heading. Sticky-plus-scroll-progress IS the animation; there is no
 * shorter version of it, and a reader who declined motion should not have to
 * scroll four screens to see four panels.
 */
export function PinnedTabs({ tabs, className }: PinnedTabsProps) {
  const reduced = useReduced();

  return reduced
    ? <ReducedPinnedTabs tabs={tabs} className={className} />
    : <AnimatedPinnedTabs tabs={tabs} className={className} />;
}

function ReducedPinnedTabs({ tabs, className }: PinnedTabsProps) {
  return (
    <div className={className}>
      {tabs.map((tab) => (
        <section key={tab.id} aria-labelledby={`${tab.id}-label`} className="border-t border-line py-12">
          <h3 id={`${tab.id}-label`} className="text-h3 font-semibold text-ink">{tab.label}</h3>
          <p className="mt-1 text-data text-ink-muted">{tab.hint}</p>
          <div className="mt-6">{tab.panel}</div>
        </section>
      ))}
    </div>
  );
}

function AnimatedPinnedTabs({ tabs, className }: PinnedTabsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = Math.min(tabs.length - 1, Math.max(0, Math.floor(p * tabs.length)));
    setActive((current) => (current === next ? current : next));
  });

  return (
    <div ref={ref} className={className} style={{ height: `${tabs.length * 100}vh` }}>
      <div className="sticky top-20 flex h-[calc(100vh-5rem)] flex-col justify-center gap-8">
        <div role="tablist" aria-label="Продукт" className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              role="tab"
              id={`${tab.id}-tab`}
              aria-selected={i === active}
              aria-controls={`${tab.id}-panel`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => scrollToSlice(ref.current, i, tabs.length)}
              className="relative pb-3 text-left"
            >
              <span className={i === active ? "text-data font-semibold text-ink" : "text-data font-medium text-ink-muted"}>
                {tab.label}
              </span>
              <span className="mt-1 block text-meta text-ink-subtle">{tab.hint}</span>
              <span className="absolute inset-x-0 bottom-0 h-px bg-line" />
              {i === active && (
                // layoutId is what makes the underline travel between tabs
                // instead of two rules crossfading in place. One element, one
                // shared identity, and Motion animates the geometry.
                <motion.span
                  layoutId="pinned-tabs-underline"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-ink"
                  transition={{ duration: DURATION.base, ease: EASE.out }}
                />
              )}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`${tabs[active]?.id}-panel`}
          aria-labelledby={`${tabs[active]?.id}-tab`}
          className="min-h-0 flex-1"
        >
          {tabs[active]?.panel}
        </div>
      </div>
    </div>
  );
}

/** Scroll to the top of tab `i`'s slice, so a click reaches the same state a
 * scroll would have produced rather than a second, competing one. */
function scrollToSlice(el: HTMLDivElement | null, i: number, total: number): void {
  if (!el) return;
  const top = el.offsetTop + (el.offsetHeight * i) / total;
  window.scrollTo({ top, behavior: "smooth" });
}
