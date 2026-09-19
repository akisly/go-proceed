import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronsRight } from "lucide-react";
import { Button } from "@goproceed/ui/components";
import { Magnetic } from "@goproceed/ui/motion";

/**
 * The reference's control (DEV-023): a pill. The primary one is ink, ends in a
 * double chevron and carries a light travelling round its border — our `beam`,
 * named loop 2, which is the same idea the reference calls `star-btn`. The
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
    <Button asChild size={size} variant={tone === "ink" ? "primary" : "outline"} className="relative isolate rounded-pill">
      <Link href={href} data-pill={tone}>
        {tone === "ink" && <i aria-hidden="true" className="beam" />}
        {children}
        {tone === "ink" && <ChevronsRight aria-hidden="true" className="size-4" strokeWidth={1.6} />}
      </Link>
    </Button>
  );
  return magnetic ? <Magnetic>{button}</Magnetic> : button;
}
