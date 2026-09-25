"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, useInView } from "motion/react";
import { DURATION, EASE, STAGGER, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";
import { useBelowBreakpoint } from "./use-gates";

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
 * move when the viewport or the typeface does. A re-measure never paints the
 * flat state either: both of its updates go through `flushSync`, so the
 * masks come off, the words are laid out and measured, and the masks go
 * back on inside one callback, before the browser's next paint. It used to
 * unmount the masks and measure on the next animation frame, and that
 * frame painted the whole heading flat at full opacity — on the hero, where
 * `fonts.ready` re-measures once the sans has swapped in, the reader saw the
 * headline flash complete and then rise line by line, «two animations»
 * (2026-09-06).
 *
 * ONE ACCESSIBLE NODE. The real text sits in an `sr-only` span; every visual
 * piece is `aria-hidden`. Screen readers hear the heading once, intact.
 *
 * SERVER AND FIRST PAINT: the flat words, no masks. The masks are added by
 * measurement, so the server never sends them and hydration matches.
 *
 * ONE DOM SHAPE FOR THE REF: `useInView(ref, …)` attaches its
 * IntersectionObserver once, on mount, and its effect deps never change
 * across a re-render — so if the element carrying `ref` is swapped out from
 * under it (a different element in the reduced branch vs. the animated
 * branch), the observer keeps watching the detached node forever and
 * `inView` never updates. Concretely: `useReduced()` is `true` on the server
 * and at first paint, so hydration mounts the reduced branch's ref'd
 * `motion.span`; once `useReduced()` flips to `false` after hydration, the
 * animated branch swaps in a brand-new `<span ref={ref}>` and the reduced
 * span unmounts — the observer never notices, `inView` stays `false`, and
 * the line masks sit at `translateY(110%)` forever (the defect QA caught
 * after Task 12). The fix: the ref'd `aria-hidden` span is the SAME element
 * in both branches; only its *contents* change reduced vs. animated.
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
  /**
   * Below `md` the heading does not rise at all — see the block in `base.css`
   * that turns the CSS entrance off at the same breakpoint. The masks cannot
   * exist before layout has been measured, so on a phone this component was
   * the last thing holding the first viewport at `opacity: 0` until the bundle
   * had hydrated, and it was holding the LCP element. `useBelowBreakpoint` is
   * `false` on the server and on the first client paint, like every gate here,
   * so the DOM shape the server sent is the one that hydrates; the stylesheet
   * is what makes that shape visible on a phone in the meantime.
   */
  const belowMd = useBelowBreakpoint("md");
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.14 });
  const words = useMemo(() => splitAccent(text, accent), [text, accent]);
  const [lines, setLines] = useState<number[][] | null>(null);

  useLayoutEffect(() => {
    if (reduced || belowMd) { setLines(null); return; }
    const el = ref.current;
    if (!el) return;
    let alive = true;
    // `lastWidth` is the span's own width (`getBoundingClientRect().width`)
    // at the last completed measurement, and `currentGroups` the line groups
    // that measurement produced. Without this pair, two things replay the
    // reveal from `y: 110%` for no visible reason: (1) `ResizeObserver` fires
    // once, synchronously-scheduled, right after `observe()` — a spec-
    // mandated initial callback, not a real resize — so mount alone would
    // measure twice; (2) every later callback (a height-only reflow from
    // unrelated content, or `fonts.ready` when the swapped font changes no
    // break) would unmount the masks even though nothing about the lines
    // changed. A width match short-circuits the resize path entirely; fonts
    // can change breaks at an unchanged width, so that path always
    // recomputes, but only unmounts when the recomputed groups actually
    // differ from what is already rendered.
    let lastWidth = -1;
    let currentGroups: number[][] = [];
    const computeGroups = (): number[][] => {
      const spans = [...el.querySelectorAll<HTMLElement>("[data-word]")];
      const groups: number[][] = [];
      let top: number | null = null;
      spans.forEach((span, i) => {
        const t = span.offsetTop;
        if (top === null || Math.abs(t - top) > 1) { groups.push([i]); top = t; }
        else groups[groups.length - 1]!.push(i);
      });
      return groups;
    };
    const groupsEqual = (a: number[][], b: number[][]) =>
      a.length === b.length && a.every((g, i) => g.length === b[i]!.length && g.every((v, j) => v === b[i]![j]));
    const measure = () => {
      lastWidth = el.getBoundingClientRect().width;
      currentGroups = computeGroups();
      return currentGroups;
    };
    // The first measurement, inside this layout effect: the update flushes
    // before paint on its own (and `flushSync` is not allowed here).
    setLines(measure());
    // Every later one runs from an observer or a promise, where nothing
    // would flush before paint — so both updates are forced through
    // synchronously and the flat state exists only inside this function.
    const remeasure = () => {
      if (!alive) return;
      flushSync(() => setLines(null));
      const groups = measure();
      flushSync(() => setLines(groups));
    };
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined && width === lastWidth) return;
      remeasure();
    });
    observer.observe(el);
    document.fonts?.ready.then(() => {
      if (!alive) return;
      const width = el.getBoundingClientRect().width;
      const groups = computeGroups();
      if (width === lastWidth && groupsEqual(groups, currentGroups)) return;
      remeasure();
    });
    return () => { alive = false; observer.disconnect(); };
  }, [reduced, belowMd, words]);

  const word = (i: number) => {
    const w = words[i]!;
    return (
      <span key={i} data-word="" data-accent={w.accent ? "true" : undefined} className={w.accent ? "text-accent" : undefined}>
        {w.text}
      </span>
    );
  };
  const flat = words.map((_, i) => <Fragment key={i}>{word(i)}{i < words.length - 1 ? " " : ""}</Fragment>);

  return (
    <As className={className}>
      <span className="sr-only">{text}</span>
      <span ref={ref} aria-hidden="true">
        {reduced ? (
          <motion.span
            data-line-reveal=""
            data-entrance=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: REDUCED.duration, ease: REDUCED.ease }}
          >
            {flat}
          </motion.span>
        ) : belowMd || lines === null ? (
          flat
        ) : (
          lines.map((group, li) => (
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
          ))
        )}
      </span>
    </As>
  );
}
