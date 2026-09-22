"use client";

import { useReduced } from "./use-reduced";

/**
 * A phrase set around a circle and turning slowly, of which only the top arc
 * shows (DEV-026) — the line that sits over the landing hero's heading in the
 * reference. Named perpetual loop `gp-orbit`.
 *
 * CSS, not Motion, for the reason the marquee is: one endless linear rotation
 * has no state, no gesture and no scroll binding. The keyframes and the
 * `orbit-spin` utility are in `base.css`; this file only places the glyphs.
 *
 * The phrase is repeated to fill the circle, each glyph rotated about the
 * centre by its share of 360°. `orbit-mask` fades the arc out at both ends, so
 * glyphs arrive and leave rather than being cut. Under reduced motion the ring
 * does not turn — the same arc, still — and that is a complete composition,
 * because the phrase is legible where it stands.
 *
 * Decorative: a phrase set glyph by glyph would be read out letter by letter,
 * so the ring is hidden from assistive technology. What it says must therefore
 * also be said in ordinary text nearby — on the landing, by the lead under the
 * heading.
 */
export function OrbitText({
  text, repeat = 9, className,
}: {
  text: string;
  /** How many times the phrase goes round the ring. */
  repeat?: number | undefined;
  className?: string | undefined;
}) {
  const reduced = useReduced();
  const glyphs = Array.from({ length: repeat }, () => [...`${text} · `]).flat();
  const step = 360 / glyphs.length;
  // Glyph 0 sits at twelve o'clock, so the window's centre falls on a phrase's
  // FIRST letter and shows the tail of one phrase and the head of the next.
  // Turning the ring back by half a phrase centres one whole phrase — what a
  // reader who asked for no motion sees for good, and the first frame otherwise.
  const lead = -((text.length - 1) / 2) * step;
  return (
    <div aria-hidden="true" data-orbit={reduced ? "still" : "turning"} className={className ? `orbit-mask ${className}` : "orbit-mask"}>
      <div className={reduced ? "orbit-ring" : "orbit-ring orbit-spin"}>
        {glyphs.map((glyph, i) => (
          <span key={i} className="orbit-glyph" style={{ transform: `rotate(${(lead + i * step).toFixed(3)}deg)` }}>{glyph}</span>
        ))}
      </div>
    </div>
  );
}
