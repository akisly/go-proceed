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
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.14 });
  const words = useMemo(() => splitAccent(text, accent), [text, accent]);
  const [lines, setLines] = useState<number[][] | null>(null);

  useLayoutEffect(() => {
    if (reduced) { setLines(null); return; }
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    let alive = true;
    const measure = () => {
      if (!alive) return;
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
      if (!alive) return;
      setLines(null);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(remeasure);
    observer.observe(el);
    document.fonts?.ready.then(remeasure);
    return () => { alive = false; observer.disconnect(); cancelAnimationFrame(frame); };
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

  return (
    <As className={className}>
      <span className="sr-only">{text}</span>
      <span ref={ref} aria-hidden="true">
        {reduced ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: REDUCED.duration, ease: REDUCED.ease }}
          >
            {flat}
          </motion.span>
        ) : lines === null ? (
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
