"use client";

// Structure follows ln-dev7/circle's components/layout/headers (MIT:
// https://github.com/ln-dev7/circle) — a mobile bar with a menu control that
// opens the same navigation off-canvas. The drawer itself is Task 1's
// `Dialog` (Radix), not a bespoke sheet; every class below is a token role.

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger, cx } from "@goproceed/ui/components";
import { Sidebar } from "./sidebar";
import type { Membership } from "./workspace-switch";

/**
 * Below `md` only — matching the shell's three-state contract
 * (`--gp-rail-width-*`'s own rulings): off-canvas drawer under 768px, the
 * icon rail from 768 to 1240, the labelled rail from 1240 up. There is no
 * desktop top bar; the rail already carries the brand there.
 */
export function TopBar({
  memberships, profileSlot, className,
}: {
  memberships: Membership[];
  /** Required since Task 3 — see `sidebar.tsx`'s own note on this prop. The
   * drawer is the ONLY place a phone can reach the profile menu, so an
   * omitted slot here is "no sign-out on mobile" with nothing to notice it. */
  profileSlot: ReactNode;
  className?: string | undefined;
}) {
  // ═══════════════════════════════════════════════════════════════════════
  // THE DRAWER CLOSES WHEN THE ROUTE CHANGES, AND IT HAS TO BE OWNED HERE.
  //
  // This was an uncontrolled `<Dialog>` — no `open`, no `onOpenChange` — and
  // that was a real bug on a phone the moment the drawer gained its first
  // link. Tapping «Профіль» inside it soft-navigates to
  // `/dash/settings/profile`, which is nested under `app/dash/layout.tsx`, so
  // Next re-renders only `children`: this component is not remounted and the
  // Dialog's internal open state survives the navigation. Radix's modal
  // content then keeps `hideOthers()` applied, so the page the user just
  // asked for sits behind the drawer — covered, focus-trapped and
  // `aria-hidden` — with no way forward but closing the drawer by hand.
  //
  // DERIVED FROM THE PATHNAME, NOT SYNCED TO IT IN AN EFFECT. Storing "the
  // path this drawer was opened on" and comparing it during render means the
  // drawer is already closed in the first render of the new route; a
  // `useEffect(() => setOpen(false), [pathname])` would run after paint and
  // show one frame of the old drawer over the new page. `null` is the closed
  // state, so reopening on the same path works normally.
  //
  // This is also why the file is now `"use client"`. It renders only client
  // components (`Dialog`, `Sidebar`) and its props stay serialisable —
  // `memberships` is plain JSON and `profileSlot` is a client element — so
  // nothing about the server tree above it changes.
  // ═══════════════════════════════════════════════════════════════════════
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn !== null && openedOn === pathname;

  return (
    <header
      className={cx(
        "flex h-(--gp-control-height-touch) shrink-0 items-center gap-3 border-b border-line bg-canvas px-3 md:hidden",
        className,
      )}
    >
      <Dialog open={open} onOpenChange={(next) => setOpenedOn(next ? pathname : null)}>
        {/*
         * Not `<DialogTrigger asChild><Button>…</Button></DialogTrigger>`:
         * `Button` does not forward a ref (Task 1's own report flags this —
         * see `Dialog.tsx`'s `DialogClose`, which hand-rolls its icon-button
         * styling for the identical reason), and Radix's `asChild` composes
         * a ref onto its child. Styling the Trigger's own native button
         * directly, matching `DialogClose`'s precedent, sidesteps that
         * uncertainty rather than relying on it silently working.
         */}
        <DialogTrigger
          aria-label="Відкрити меню"
          className={cx(
            "inline-flex shrink-0 items-center justify-center rounded-control",
            "size-(--gp-control-height-desk) touch:size-(--gp-control-height-touch)",
            "text-ink-secondary transition-colors duration-fast ease-out",
            "hover:bg-action-ghost-hover hover:text-ink",
          )}
        >
          <Menu aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </DialogTrigger>
        <DialogContent
          className={cx(
            // Only position/size/radius/padding/background are overridden —
            // `border border-line` is left as DialogContent's own default
            // rather than zeroed on three sides and reapplied on one, which
            // would pit two Tailwind border-width utilities against each
            // other with no guaranteed resolution order.
            "left-0 top-0 translate-x-0 translate-y-0 rounded-none",
            "h-dvh w-(--gp-rail-width-drawer) max-w-none bg-canvas p-0",
          )}
        >
          <DialogTitle className="sr-only">Навігація</DialogTitle>
          {/*
           * `pt-16` clears `DialogContent`'s own built-in close button
           * (`packages/ui/src/components/Dialog.tsx`: `absolute right-4
           * top-4`, up to `size-(--gp-control-height-touch)` = 44px on
           * touch — bottom edge at 16 + 44 = 60px). Without it, `Sidebar`'s
           * own `p-3` starts `WorkspaceSwitch` at the top of this drawer
           * (content is `p-0`), landing its row — with more than one
           * membership, the `+N` pill and chevron specifically — under the
           * close button.
           *
           * `p-3` and `pt-16` both survive `cx`: tailwind-merge's
           * `conflictingClassGroups` map is one-directional (`p` conflicts
           * with `pt`, `pr`, … but not the reverse), so a later `pt` never
           * evicts an earlier `p`. Which one then wins on the element is
           * source order in the generated sheet, not specificity — `.p-3`
           * and `.pt-16` have identical specificity — and Tailwind emits
           * `padding` before `padding-top`.
           *
           * The 64px is derived, not measured, and `qa/field.mjs`'s dash
           * audit now asserts the two boxes do not overlap so that moving
           * `--gp-control-height-touch` cannot bring the overlap back
           * silently.
           */}
          <Sidebar
            variant="drawer"
            memberships={memberships}
            profileSlot={profileSlot}
            className="border-r-0 pt-16"
          />
        </DialogContent>
      </Dialog>
      <span className="text-data font-medium text-ink">GoProceed</span>
    </header>
  );
}
