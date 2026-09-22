"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * The header's ground, which steps aside while the page stands at its top
 * (DEV-024, seventh pass). The reference's first screen runs its pixel field
 * right up to the top edge, BEHIND the header: there the header is glass with a
 * hairline, and takes its ground only once the page has scrolled. The owner:
 * «глянь как сделан верх в hero на референсе … хочу так же».
 *
 * The ground is this element, not the header's own background, so that it can
 * fade (`transition: opacity`, `globals.css`) without the links fading with it.
 *
 * THE DEFAULT IS VEILED. The server renders the header with its ground, and so
 * does a browser without JavaScript: a header that is always readable. Only a
 * running script, at the top of the page, on a wide screen, lifts it — so the
 * no-script page keeps its bar, and the first paint never shows links over a
 * page that has already scrolled (a reload half-way down).
 *
 * One passive `scroll` listener that writes an attribute when the answer
 * CHANGES — no frame loop, nothing per frame (the landing's one frame loop is
 * `@goproceed/ui/motion`'s, and the harness counts on it).
 *
 * NOT A SCROLL-LINKED COMPOSITION (`02-building-ui.md` §4.3 rule 9), and no
 * precedent for one (R7-05): nothing here follows the scroll's progress. It is
 * a two-state threshold — at the top, or not — whose only motion is a CSS
 * opacity fade, which the reduced-motion block shortens like any other. A
 * listener that moves something WITH the scroll belongs in the vocabulary.
 */
export function HeaderVeil() {
  const ref = useRef<HTMLElement>(null);
  // A LAYOUT effect (R7-06): every page renders its own header, so a client-side page change mounts a new one —
  // veiled. Written before that first paint, the attribute spares a flash of ground on every top-to-top
  // navigation; on the served page nothing changes (there the script runs after the veiled paint anyway).
  useLayoutEffect(() => {
    const header = ref.current?.closest("header");
    if (!header) return;
    let atTop: boolean | null = null;
    const read = (): void => {
      const next = window.scrollY < 16;
      if (next === atTop) return;
      atTop = next;
      header.setAttribute("data-at-top", String(next));
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => { window.removeEventListener("scroll", read); header.removeAttribute("data-at-top"); };
  }, []);
  return <i ref={ref} aria-hidden="true" data-header-veil="" className="landing-header-veil" />;
}
