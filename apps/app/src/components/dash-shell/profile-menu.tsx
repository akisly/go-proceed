"use client";

// Structure follows ln-dev7/circle's `components/layout/sidebar` user menu
// (MIT: https://github.com/ln-dev7/circle) — the avatar-and-identity control
// pinned to the foot of the rail, opening a menu — and satnaing/shadcn-admin's
// `profile-dropdown` (MIT: https://github.com/satnaing/shadcn-admin) for the
// label/separator/items shape. Every class name below is this system's own
// token role.

import { useState } from "react";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import {
  Avatar, AvatarFallback, DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, cx,
} from "@goproceed/ui/components";

import { SignOutDialog } from "./sign-out-dialog";

/**
 * The profile control at the foot of the rail — and the first place in
 * GoProceed from which a user can sign out at all.
 *
 * ONE COMPONENT, BOTH SURFACES. `src/layouts/dash-layout.tsx` builds this once
 * and hands the same element to `Sidebar` (the desktop rail) and to `TopBar`
 * (which passes it into the drawer's own `Sidebar`), per Task 2's `profileSlot`
 * contract. Two implementations would be two things to keep in step, and the
 * one that got skipped would be the mobile one.
 *
 * THE LABEL COLLAPSES; THE CONTROL DOES NOT — THIS IS DEFECT 1 OF TASK 3'S
 * BRIEF. `sidebar.tsx` used to wrap the whole profile slot in
 * `rail-icons:hidden`, so between 768px and 1240px — an ordinary office laptop
 * window, and the width at which the rail is icons-only — the block was
 * `display: none` and there was NO WAY TO SIGN OUT AT THAT WIDTH. The fix is
 * split across the two files: the wrapper there no longer hides anything, and
 * the collapse moves HERE, onto the address alone, exactly as a nav item keeps
 * its icon and drops its `<span>`.
 *
 * `rail-icons:hidden` NEEDS NO `variant` PROP, and that is worth stating
 * because it looks like an oversight. `rail-icons` is `768px ≤ w < 1240px`;
 * the drawer this also renders inside lives in `TopBar`, which is `md:hidden`
 * and therefore only exists BELOW 768px. The two ranges do not overlap, so one
 * class is correct in both places: hidden in the icon rail, shown in the
 * labelled rail, shown in the drawer.
 *
 * `aria-label` ON THE TRIGGER, not a reliance on its contents. At `rail-icons`
 * the address is `display: none` and contributes nothing to the accessible
 * name, which would leave a button announced as "avatar, button". The address
 * is still announced — it is the menu's own `DropdownMenuLabel`, one keystroke
 * away — so the button names the ACTION rather than repeating the identity.
 */
export function ProfileMenu({
  accountLabel, accountInitial, className,
}: {
  /** Already resolved server-side (`session.service.ts`'s `accountLabel`), so
   * the «no address» fallback exists in exactly one place rather than once per
   * surface that renders it. */
  accountLabel: string;
  accountInitial: string;
  className?: string | undefined;
}) {
  const [signOutOpen, setSignOutOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        {/*
         * The Trigger's own native button is styled directly rather than
         * `asChild`-composed onto `Button` — `top-bar.tsx`'s `DialogTrigger`
         * carries the same note and the same reason: `Button` does not forward
         * a ref, and Radix's `asChild` composes one onto its child.
         */}
        <DropdownMenuTrigger
          aria-label="Профіль і вихід"
          className={cx(
            "flex w-full items-center gap-2 rounded-control p-1",
            "text-ink transition-colors duration-fast ease-out",
            "hover:bg-action-ghost-hover data-[state=open]:bg-action-ghost-hover",
            className,
          )}
        >
          <Avatar>
            <AvatarFallback>{accountInitial}</AvatarFallback>
          </Avatar>
          <span className="rail-icons:hidden min-w-0 flex-1 truncate text-left text-data">
            {accountLabel}
          </span>
        </DropdownMenuTrigger>

        {/*
         * `side="top"`: this control sits at the foot of a full-height rail, so
         * the menu has nowhere to go but up.
         *
         * INSIDE THE MOBILE DRAWER THIS IS A RADIX MENU INSIDE A RADIX DIALOG,
         * and both are portalled to the document root with `z-50`. The menu's
         * portal mounts later — it only exists once opened — so it comes later
         * in the body's child order and paints above the drawer without either
         * one naming a z-index the other has to out-rank. Escape closes the
         * menu alone: `DropdownMenuContent`'s dismissable layer handles the key
         * and stops it, so the drawer behind survives the first press. Both
         * verified in the browser pass, not assumed from the library's docs.
         */}
        <DropdownMenuContent side="top" align="start" className="min-w-56 max-w-72">
          <DropdownMenuLabel className="truncate" title={accountLabel}>
            {accountLabel}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/*
            * THE EXPLICIT HEIGHT IS THE 44px TOUCH FLOOR, not a look.
            * `DropdownMenuItem`'s own padding (`py-2 touch:py-2.5`) plus one
            * line of `text-data` lands around 40px — under WCAG 2.5.5's floor
            * — and this menu is reachable inside the mobile drawer, where
            * `(pointer: coarse)` matches. The utility is §4.1's own
            * substitution for a control height; `packages/ui` is left alone
            * (this task's brief scopes it out) because the shortfall is this
            * call site's single-line content, not the component's contract.
            */}
          <DropdownMenuItem asChild className="h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch)">
            <Link href="/dash/settings/profile">
              <UserRound aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
              Профіль
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch)"
            // `onSelect` and NOT `onClick`: Radix closes the menu after this
            // handler, and it is the same event for a pointer press and for
            // Enter/Space on a keyboard-navigated item. The dialog is a
            // SIBLING of this menu (below), so it survives that close.
            onSelect={() => setSignOutOpen(true)}
          >
            <LogOut aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
            Вийти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </>
  );
}
