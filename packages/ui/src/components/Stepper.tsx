"use client";

import type { CSSProperties, ReactNode } from "react";
import { createContext, useContext } from "react";
import { ScrollProgress } from "../motion/ScrollProgress";
import { cx } from "./cn";

/**
 * The direction, from the stepper to its steps. [2026-09-22, review R2-11] It
 * was a prop on both, and passing it to only one rendered horizontal chrome
 * with vertical dots — at `-left-6`, outside the grid cell — with nothing to
 * catch it. A `Step` outside a `Stepper` is vertical, which is what it was
 * before the prop existed.
 */
type Direction = "vertical" | "horizontal";
const DirectionContext = createContext<Direction>("vertical");

/**
 * The pilot plan as a stepper — 21st.dev's «Steppers», scrubbed by the scroll
 * as the prototype does (index.html l.1171): `ScrollProgress` publishes the
 * section's progress into `--gp-progress`; the line's fill is a scale of that
 * number and each dot lights as the number passes its threshold. [2026-09-06:
 * was `InViewProgress`, timed; spec 2026-09-06 §3 row 10.]
 *
 * `direction` [2026-09-22, owner: «смысл тут уже от степов, если страница уже
 * стоит тут … нужно пересмотреть и перестроить»]. A vertical stepper is a
 * narrative: it asks for a column of its own and it is read top to bottom. On a
 * page the visitor has already chosen — the pilot page, where the next thing to
 * do is the form — the plan is reference, not narrative, and a column is the
 * wrong price for it. `horizontal` lays the same steps across the block on one
 * rail, under the work rather than beside it. Same progress, same thresholds,
 * same dots.
 *
 * THE RAIL EXISTS ONLY WHERE THE STEPS ARE ONE ROW, which is `wide` and nothing
 * below it. A horizontal rail is one line pinned to the top of the grid, so the
 * moment the steps wrap, every step in a later row carries a dot standing in
 * paper with nothing to connect it to — four of six pinned widths, and worst
 * under reduced motion, where every dot is lit and three of them are orphans
 * (found in review, 2026-09-22). Below `wide` the same four steps are a stacked
 * list separated by hairlines: no rail, no dots, no scroll-linked anything —
 * which is also what §4.3 rule 9 says about a scroll-linked composition on a
 * narrow screen. The fill's transform is an inline style and cannot switch at a
 * breakpoint, so this is a boundary, not a variant.
 *
 * The rail ENDS AT THE LAST DOT rather than at the block's edge: a plan that is
 * finished should not have a quarter of a filled line continuing past its final
 * step. With four equal columns and a gap of `g`, the fourth column starts at
 * 75 % of the width plus three quarters of one gap.
 */
export function Stepper({ children, className, direction = "vertical" }: { children: ReactNode; className?: string | undefined; direction?: Direction | undefined }) {
  const horizontal = direction === "horizontal";
  return (
    <DirectionContext value={direction}>
    <ScrollProgress className={cx("relative grid", horizontal ? "gap-7 wide:grid-cols-4 wide:gap-x-10 wide:pt-9" : "pl-9", className)}>
      <span
        aria-hidden="true"
        data-stepper={direction}
        className={cx("absolute bg-line", horizontal ? "left-0 right-[calc(25%-1.875rem)] top-4 hidden h-0.5 wide:block" : "bottom-3 left-4 top-3 w-0.5")}
      />
      <span
        aria-hidden="true"
        data-stepper-line="true"
        className={cx("absolute bg-ink", horizontal ? "left-0 right-[calc(25%-1.875rem)] top-4 hidden h-0.5 origin-left wide:block" : "bottom-3 left-4 top-3 w-0.5 origin-top")}
        style={{ transform: horizontal ? "scaleX(var(--gp-progress, 0))" : "scaleY(var(--gp-progress, 0))" }}
      />
      {children}
    </ScrollProgress>
    </DirectionContext>
  );
}

export function Step({
  index, count, when, title, titleAs: Title = "h3", children, className,
}: {
  index: number;
  count: number;
  when: string;
  title: string;
  /** The title's level. `h3` by default; `h2` where the stepper sits directly under a page's `h1` (DEV-024 R-02), so the outline never skips a level. */
  titleAs?: "h2" | "h3" | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  // The dot lights when progress passes index/count + 0.02 — the prototype's
  // threshold. clamp() turns the difference into 0 or 1 without a state flip.
  const threshold = index / count + 0.02;
  const lit = { opacity: `clamp(0, calc((var(--gp-progress, 0) - ${threshold}) * 100), 1)` } as CSSProperties;
  // The dot belongs to the rail, so it appears exactly where the rail does:
  // at `wide` in a horizontal stepper, always in a vertical one. Below `wide`
  // the horizontal step is a hairline-separated entry instead.
  // The rail's centre is `top-4` + half of `h-0.5` = 17px from the container's
  // top; the article starts at `pt-9` = 36px, so a 12px dot centres there at
  // 36 − 25 + 6 (R2-04: it was −29 and sat 4px high, with the rail leaving it
  // 1px above its lower edge).
  const horizontal = useContext(DirectionContext) === "horizontal";
  const dot = horizontal ? "-top-[1.5625rem] left-0 hidden size-3 wide:block" : "-translate-x-[10%] -left-6 top-1.5 size-3";
  return (
    <article data-slot="step" className={cx("relative", horizontal ? "border-t border-line pt-5 wide:border-t-0 wide:pt-0" : "pb-7 last:pb-0", className)}>
      <span aria-hidden="true" className={cx("absolute rounded-pill border-2 border-line-strong bg-canvas", dot)} />
      <span aria-hidden="true" className={cx("absolute rounded-pill bg-ink", dot)} style={lit} />
      <p className="index-label mb-1.5">{when}</p>
      <Title className="text-h3 font-semibold text-ink">{title}</Title>
      <div className="mt-1.5 max-w-[44ch] text-data leading-relaxed text-ink-secondary">{children}</div>
    </article>
  );
}
