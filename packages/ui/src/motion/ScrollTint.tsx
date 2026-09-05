"use client";

import { Fragment, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useReduced } from "./use-reduced";

/**
 * A statement paragraph whose words move from grey to ink as it crosses the
 * viewport. Linear does it to its manifesto line; flexfolio does it to its
 * about paragraph. Both use it exactly once.
 *
 * This is the ONE place the technique is allowed. It is scroll-linked, which
 * means it runs on every frame of every scroll event it is mounted for, and
 * two of them in one page is two continuous animations competing for the same
 * budget while the reader is trying to read.
 *
 * Colour comes from role tokens, not from a ramp step: the "unread" state is
 * `--gp-text-subtle` and the "read" state is `--gp-text-primary`, so the effect
 * follows a theme change instead of pinning two greys into a component.
 *
 * Under reduced motion the paragraph renders fully inked. Not "animates
 * quickly" — a scroll-linked animation has no duration to shorten.
 */
export function ScrollTint({
  text, className,
}: {
  text: string;
  className?: string | undefined;
}) {
  const reduced = useReduced();

  if (reduced) {
    return <p className={className ? `text-ink ${className}` : "text-ink"}>{text}</p>;
  }

  return <AnimatedScrollTint text={text} className={className} />;
}

function AnimatedScrollTint({
  text, className,
}: {
  text: string;
  className?: string | undefined;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.45"],
  });
  const words = text.split(" ");

  return (
    <p ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <Fragment key={`${word}-${i}`}>
            <Word progress={scrollYProgress} index={i} total={words.length}>
              {word}
            </Word>
            {i < words.length - 1 ? " " : ""}
          </Fragment>
        ))}
      </span>
    </p>
  );
}

function Word({
  children, progress, index, total,
}: {
  children: React.ReactNode;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  index: number;
  total: number;
}) {
  // Each word owns a slice of the scroll range and tints across it. The slices
  // overlap by half a step so the leading edge reads as a sweep rather than as
  // a row of independent switches.
  const start = index / total;
  const end = Math.min(1, (index + 1.5) / total);
  const color = useTransform(
    progress,
    [start, end],
    ["var(--gp-text-subtle)", "var(--gp-text-primary)"],
  );
  return <motion.span className="inline-block" style={{ color }}>{children}</motion.span>;
}
