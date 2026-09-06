"use client";

import { Fragment, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useReduced } from "./use-reduced";
import { splitAccent } from "./LineReveal";

/**
 * A statement paragraph whose words move from resting to read as it crosses
 * the viewport. Linear does it to its manifesto line; flexfolio does it to
 * its about paragraph. Both use it exactly once.
 *
 * Two uses on the landing — the problem statement and the position quote —
 * each named in spec 2026-09-06 §3; a third is a spec change.
 *
 * The words fade `opacity .14 -> 1` (the prototype's `.w`), not colour: the
 * "unread" state is `opacity: 0.14` and the "read" state is `opacity: 1`, so
 * the tone of the text never changes, only how much of it is visible yet.
 * The first `dimUntil` words additionally carry `text-ink-muted` — a role,
 * not a ramp step — and `accent` marks the words of one phrase `text-accent`;
 * a word is never both.
 *
 * Under reduced motion the paragraph renders fully opaque, prefix and accent
 * still marked. Not "animates quickly" — a scroll-linked animation has no
 * duration to shorten.
 */
type ScrollOffset = NonNullable<NonNullable<Parameters<typeof useScroll>[0]>["offset"]>;

export function ScrollTint({
  text, className, offset = ["start 0.85", "end 0.6"], dimUntil = 0, accent,
}: {
  text: string;
  className?: string | undefined;
  /** The scroll range the words fade across. The problem statement uses the default; the position quote passes `["start 0.85", "start 0.45"]` (prototype l.1155). */
  offset?: ScrollOffset | undefined;
  /** The first N words are set in `text-ink-muted` — the quote's «Ми не зупиняємо роботу на майданчику —» prefix. */
  dimUntil?: number | undefined;
  /** The phrase set in `text-accent`. Whole words only; never combined with the dim prefix on the same word. */
  accent?: string | undefined;
}) {
  const reduced = useReduced();
  const words = text.split(" ");
  const accents = splitAccent(text, accent);

  if (reduced) {
    return (
      <p className={className}>
        <span className="sr-only">{text}</span>
        <span aria-hidden="true">
          {words.map((word, i) => (
            <Fragment key={`${word}-${i}`}>
              <span className={wordClass(i < dimUntil, accents[i]?.accent ?? false)}>{word}</span>
              {i < words.length - 1 ? " " : ""}
            </Fragment>
          ))}
        </span>
      </p>
    );
  }

  return <AnimatedScrollTint text={text} className={className} offset={offset} dimUntil={dimUntil} accents={accents} />;
}

function wordClass(dim: boolean, accent: boolean): string {
  if (accent) return "inline-block text-accent";
  if (dim) return "inline-block text-ink-muted";
  return "inline-block text-ink";
}

function AnimatedScrollTint({
  text, className, offset, dimUntil, accents,
}: {
  text: string;
  className?: string | undefined;
  offset: ScrollOffset;
  dimUntil: number;
  accents: ReturnType<typeof splitAccent>;
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
            <Word progress={scrollYProgress} index={i} total={words.length} dim={i < dimUntil} accent={accents[i]?.accent ?? false}>
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
  children, progress, index, total, dim, accent,
}: {
  children: React.ReactNode;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  index: number;
  total: number;
  dim: boolean;
  accent: boolean;
}) {
  // Each word owns a slice of the scroll range and fades across it. The slices
  // overlap by half a step so the leading edge reads as a sweep rather than as
  // a row of independent switches.
  const start = index / total;
  const end = Math.min(1, (index + 1.5) / total);
  const opacity = useTransform(progress, [start, end], [REST, 1]);
  return (
    <motion.span className={accent ? "inline-block text-accent" : dim ? "inline-block text-ink-muted" : "inline-block"} style={{ opacity }}>
      {children}
    </motion.span>
  );
}
