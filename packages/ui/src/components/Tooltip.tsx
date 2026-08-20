"use client";

import type { ReactNode } from "react";
import { Tooltip as RadixTooltip } from "radix-ui";
import { cx } from "./cn";

/**
 * Earns its place in exactly one situation: the 768–1240px icon rail.
 *
 * A tooltip on a visible label is noise. The label stays in the DOM at every
 * width (`sr-only` in the icon range), so the accessible name never depends on
 * the tooltip — which matters because a tooltip is not announced on touch at
 * all, and this product's phone audience never sees one.
 *
 * PORTALLED CONTENT ESCAPES THE SHELL. Radix renders into a portal at the
 * document root, which means it gets none of `.goproceed-app`'s base layer —
 * no font, no reduced-motion block, no focus ring. Anything portalled must
 * carry `font-sans` itself. v1 recorded this trap; it is still true.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={200}>{children}</RadixTooltip.Provider>;
}

export function Tooltip({
  label, children, side = "right",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left" | undefined;
}) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={8}
          className={cx(
            // font-sans and motion-reduce: are carried here, not inherited —
            // see the note above about portals escaping the shell.
            "font-sans z-50 rounded-control border border-line bg-surface px-2.5 py-1.5",
            "text-meta text-ink shadow-overlay",
            "animate-chip-in motion-reduce:animate-none",
          )}
        >
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
