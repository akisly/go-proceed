"use client";

// Structure follows shadcn/ui's Dialog (MIT); styling is this system's token roles.

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import { cx } from "./cn";

/**
 * The one thing under `/app/**` allowed to cover content, which is why
 * `shadow-modal` is worn here and nowhere else a panel sits flat on the page.
 * `tokens.json`'s own ruling for that shadow names dialog and the off-canvas
 * rail as the only two things it is standing in for — not decoration, and not
 * a reach past the border-led rule the rest of the system follows.
 *
 * PORTALLED CONTENT ESCAPES THE SHELL, the same trap Tooltip.tsx already
 * carries: a Radix portal renders at the document root and inherits none of
 * `.goproceed-app`'s base layer, so `font-sans` and `motion-reduce:` are
 * repeated on the content rather than assumed inherited.
 *
 * The enter animation is `animate-chip-in` — the same CSS keyframe Tooltip
 * already uses for its own Radix `data-state` transition. This is a Radix
 * primitive's own open/close state, not a scroll-linked or imperative
 * animation, so it stays a CSS utility rather than reaching for one of the
 * fifteen `@goproceed/ui/motion` primitives, which are for the JS-driven
 * vocabulary (reveals, staggers, counters) that this is not.
 */
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

/**
 * Every `DialogContent` needs a `DialogTitle` inside it — Radix's own
 * accessibility contract, not this file's. Omit one and Radix console-warns
 * at runtime rather than failing the build; the dialog still opens, but a
 * screen reader has nothing to announce it by. This file does not paper over
 * that with a `VisuallyHidden` fallback — a silent one would hide the mistake
 * the warning exists to surface, so a missing title stays visible as a warning.
 */
export function DialogContent({
  className, children, ...rest
}: ComponentPropsWithoutRef<typeof RadixDialog.Content>) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
      <RadixDialog.Content
        className={cx(
          "font-sans fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
          "rounded-panel border border-line bg-surface p-6 shadow-modal",
          "animate-chip-in motion-reduce:animate-none",
          className,
        )}
        {...rest}
      >
        {children}
        <RadixDialog.Close
          className={cx(
            "absolute right-4 top-4 inline-flex items-center justify-center rounded-control",
            "size-(--gp-control-height-desk-sm) touch:size-(--gp-control-height-touch)",
            "text-ink-muted transition-colors duration-fast ease-out",
            "hover:bg-action-ghost-hover hover:text-ink",
          )}
        >
          <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
          <span className="sr-only">Закрити</span>
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

/** Title and description on their own lines, clear of the close button's
 * corner. Not a Radix component: it is layout only, so a plain div takes the
 * same minimal `{children, className}` shape Panel's own header pieces do. */
export function DialogHeader({
  children, className,
}: { children: ReactNode; className?: string | undefined }) {
  return <div className={cx("flex flex-col gap-1.5 pr-8 text-left", className)}>{children}</div>;
}

/** Actions stack on mobile, align to the trailing edge at `md` and up — the
 * one breakpoint this system reasons about below `wide`. */
export function DialogFooter({
  children, className,
}: { children: ReactNode; className?: string | undefined }) {
  return (
    <div className={cx("flex flex-col-reverse gap-2 pt-2 md:flex-row md:justify-end", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({
  className, ...rest
}: ComponentPropsWithoutRef<typeof RadixDialog.Title>) {
  return <RadixDialog.Title className={cx("text-h3 font-semibold text-ink", className)} {...rest} />;
}

export function DialogDescription({
  className, ...rest
}: ComponentPropsWithoutRef<typeof RadixDialog.Description>) {
  return (
    <RadixDialog.Description className={cx("text-data text-ink-muted", className)} {...rest} />
  );
}
