"use client";

// Structure follows shadcn/ui's Avatar (MIT); styling is this system's token roles.

import type { ComponentPropsWithoutRef } from "react";
import { Avatar as RadixAvatar } from "radix-ui";
import { cx } from "./cn";

/**
 * Initials only. The product has no image source yet, so there is no
 * `AvatarImage` here — adding one before a real source exists is exactly the
 * "forty speculative components" trap `index.ts`'s own header warns about.
 * Rendering initials is the caller's job: pass them as `AvatarFallback`'s
 * children, the same way Radix's own docs do it.
 *
 * Sized off `control-height`, not a literal: this is the one role in the
 * system for "the default UI element's height at desk and at touch", and an
 * avatar that sits beside an icon button in a header needs the same box to
 * line up. `size-9`/`size-10`/`size-11` would compile to the same pixels
 * today and stop tracking the token the moment it moves — the same reasoning
 * Button's own sizes are built on.
 */
export function Avatar({
  className, ...rest
}: ComponentPropsWithoutRef<typeof RadixAvatar.Root>) {
  return (
    <RadixAvatar.Root
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-subtle",
        "size-(--gp-control-height-desk) touch:size-(--gp-control-height-touch)",
        className,
      )}
      {...rest}
    />
  );
}

export function AvatarFallback({
  className, ...rest
}: ComponentPropsWithoutRef<typeof RadixAvatar.Fallback>) {
  return (
    <RadixAvatar.Fallback
      className={cx("text-meta font-medium text-ink-secondary", className)}
      {...rest}
    />
  );
}
