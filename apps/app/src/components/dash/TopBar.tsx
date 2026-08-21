// Structure follows ln-dev7/circle's components/layout/headers (MIT:
// https://github.com/ln-dev7/circle) — a mobile bar with a menu control that
// opens the same navigation off-canvas. The drawer itself is Task 1's
// `Dialog` (Radix), not a bespoke sheet; every class below is a token role.

import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger, cx } from "@goproceed/ui/components";
import { Sidebar } from "./Sidebar";
import type { Membership } from "./WorkspaceSwitch";

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
  profileSlot?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <header
      className={cx(
        "flex h-(--gp-control-height-touch) shrink-0 items-center gap-3 border-b border-line bg-canvas px-3 md:hidden",
        className,
      )}
    >
      <Dialog>
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
          <Sidebar
            variant="drawer"
            memberships={memberships}
            profileSlot={profileSlot}
            className="border-r-0"
          />
        </DialogContent>
      </Dialog>
      <span className="text-data font-medium text-ink">GoProceed</span>
    </header>
  );
}
