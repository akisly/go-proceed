import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronsRight } from "lucide-react";
import { Button } from "@goproceed/ui/components";
import { Magnetic } from "@goproceed/ui/motion";

/** One literal per branch; `variant={VARIANT[tone]}` is a lookup, not a template. */
const VARIANT = { ink: "primary", paper: "ghost" } as const;

/* [2026-09-22, DEV-029] The paper pill is GLASS. It exists at one address — the
 * hero's secondary action — and it stands on the perspective floor, which is
 * the one ground on this site with enough texture for a blur to resolve. The
 * variant is `ghost` rather than `outline` because `outline`'s own `bg-surface`
 * is a utility and would paint over a background the components layer sets. */
const FACE = { ink: "relative isolate overflow-hidden rounded-pill", paper: "landing-glass relative isolate rounded-pill text-ink" } as const;

/**
 * The reference's control (DEV-026): a pill. The primary one is ink, ends in a
 * double chevron and carries a light travelling round its border, which is the
 * same idea the reference calls `star-btn`. [DEV-027, owner] It was the 1px,
 * 7 s `beam`, then a 2px / 3 s conic comet (`beam-pill`), and since the sixth
 * pass it is built the way the reference builds it — a constant faint border
 * and a soft light moving along the outline (`pill-ring`, `pill-light`,
 * `pill-face`); the light is the spark colour since DEV-028, because the
 * primary measures 2.56:1 on ink. A browser without `offset-path: inset()` gets the
 * earlier conic ring instead, from a `@supports not` nested in those utilities. The
 * secondary one is paper glass (`.landing-glass`). Both are the system's `Button` at
 * its marketing size with the radius swapped; nothing about the control's
 * height, focus ring or touch floor is restated here.
 */
export function PillLink({
  href, tone = "ink", magnetic = true, size = "lg", children,
}: {
  href: string;
  /** [2026-09-22, DEV-029, owner] No `signal` tone: the owner took the orange
   * buttons off the site. Every action is the ink pill with its border. */
  tone?: "ink" | "paper" | undefined;
  /** The header's action does not follow the pointer (parity spec 2026-09-06). */
  magnetic?: boolean | undefined;
  size?: "lg" | "sm" | undefined;
  children: ReactNode;
}) {
  const button = (
    <Button asChild size={size} variant={VARIANT[tone]} className={FACE[tone]}>
      <Link href={href} data-pill={tone}>
        {/* [owner, sixth pass] The reference's construction (`base.css`, «THE PILL'S LIGHT»): a faint constant border, a soft
            light travelling along the pill's outline, and the pill's own face over both, inset by the border's 2px. All three
            sit under the label (z < 0 inside the pill's `isolate`); the pill clips them, which the focus outline is not subject to.
            The LIGHT is hidden while the pill has keyboard focus (B2-04): the focus ring is cobalt too, and a second moving
            cobalt edge inside it blurs which of them is the focus. The constant border stays. */}
        {tone === "ink" && (
          <>
            <i aria-hidden="true" data-pill-layer="ring" className="pill-ring" />
            <i aria-hidden="true" data-beam="pill" className="pill-light in-focus-visible:hidden" />
            <i aria-hidden="true" data-pill-layer="face" className="pill-face" />
          </>
        )}
        {children}
        {tone === "ink" && <ChevronsRight aria-hidden="true" className="size-4" strokeWidth={1.6} />}
      </Link>
    </Button>
  );
  return magnetic ? <Magnetic>{button}</Magnetic> : button;
}
