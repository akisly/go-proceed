"use client";

import { motion } from "motion/react";
import { BLUR, SPRING, STAGGER, REDUCED } from "./tokens";
import { useReduced } from "./use-reduced";

/**
 * The hero headline resolve: each word arrives out of focus and sharpens.
 *
 * Measured on flexfollio.framer.website — `filter: blur() -> 0` together with
 * `opacity 0 -> 1`, spring-driven, staggered 40ms per unit. It is the one
 * animation on any of the four references that reads as craft rather than as a
 * template, and it costs nothing structurally: no layout, no scroll binding.
 *
 * USED AT MOST TWICE PER PAGE — the hero and the final CTA. A third use makes
 * it a transition style rather than an entrance, and then it stops being an
 * entrance anywhere.
 *
 * Splitting is per WORD, never per character. Per-character breaks the shape
 * of a Ukrainian word for a screen reader that follows the DOM, and at 40ms it
 * would take a 30-character headline 1.2s to finish arriving.
 *
 * The whole string stays in one accessible node: the visual pieces are
 * `aria-hidden` and the real text sits in an `sr-only` span, so the headline is
 * announced once, intact.
 */
export function TextBlurIn({
  text, className, delay = 0, as: As = "span",
}: {
  text: string;
  className?: string | undefined;
  /** Seconds before the first word starts. */
  delay?: number | undefined;
  as?: "span" | "h1" | "h2" | "p" | undefined;
}) {
  const reduced = useReduced();
  const words = text.split(" ");

  if (reduced) {
    return (
      <As className={className}>
        <motion.span
          data-entrance=""
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: REDUCED.duration, ease: REDUCED.ease }}
        >
          {text}
        </motion.span>
      </As>
    );
  }

  return (
    <As className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            className="inline-block"
            initial={{ opacity: 0, filter: `blur(${BLUR.reveal}px)` }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ ...SPRING.reveal, delay: delay + i * STAGGER.tight }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        ))}
      </span>
    </As>
  );
}
