"use client";

import { useCallback, type PointerEvent, type ReactNode } from "react";

/** The channel card's pointer-tracked dot spotlight — the same two variables `FeatureCell` writes. */
export function SpotlightCard({ children, className }: { children: ReactNode; className: string }) {
  const onMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--gp-spot-x", `${((event.clientX - r.left) / r.width) * 100}%`);
    event.currentTarget.style.setProperty("--gp-spot-y", `${((event.clientY - r.top) / r.height) * 100}%`);
  }, []);
  return (
    <article onPointerMove={onMove} className={className}>
      <i aria-hidden="true" className="spotlight -z-10 opacity-0 transition-opacity duration-slow ease-out group-hover:opacity-100" />
      {children}
    </article>
  );
}
