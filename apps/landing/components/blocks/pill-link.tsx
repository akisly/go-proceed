import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronsRight } from "lucide-react";
import { Button } from "@goproceed/ui/components";
import { Magnetic } from "@goproceed/ui/motion";

/**
 * The reference's control (DEV-023): a pill. The primary one is ink, ends in a
 * double chevron and carries a light travelling round its border, which is the
 * same idea the reference calls `star-btn`. [DEV-024, owner] It was the 1px,
 * 7 s `beam`, then a 2px / 3 s conic comet (`beam-pill`), and since the sixth
 * pass it is built the way the reference builds it — a constant faint border
 * and a soft light moving along the outline — in our accent (`pill-ring`,
 * `pill-light`, `pill-face`). A browser without `offset-path: inset()` gets the
 * earlier conic ring instead, from a `@supports not` nested in those utilities. The
 * secondary one is paper with a hairline. Both are the system's `Button` at
 * its marketing size with the radius swapped; nothing about the control's
 * height, focus ring or touch floor is restated here.
 */
export function PillLink({
  href, tone = "ink", magnetic = true, size = "lg", children,
}: {
  href: string;
  tone?: "ink" | "paper" | undefined;
  /** The header's action does not follow the pointer (parity spec 2026-09-06). */
  magnetic?: boolean | undefined;
  size?: "lg" | "sm" | undefined;
  children: ReactNode;
}) {
  const button = (
    <Button asChild size={size} variant={tone === "ink" ? "primary" : "outline"} className={tone === "ink" ? "relative isolate overflow-hidden rounded-pill" : "relative isolate rounded-pill"}>
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
