"use client";

// Structure follows satnaing/shadcn-admin's `src/components/sign-out-dialog.tsx`
// (MIT: https://github.com/satnaing/shadcn-admin) — a confirm dialog whose
// open state the caller owns, whose confirm performs the sign-out. Every class
// name below is this system's own token role, never shadcn's CSS variables.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from "@goproceed/ui/components";

import { supabaseBrowser } from "../../lib/supabase-browser";
import { SubmitGuard } from "../../lib/submit-guard";
import { performSignOut } from "../../services/sign-out.service";

/**
 * The confirm in front of the only irreversible thing this shell can do.
 *
 * IT MUST NOT SIGN ANYTHING OUT UNTIL CONFIRMED, and that is not a styling
 * claim about a modal — it is what `qa/field.mjs`'s dash audit asserts by
 * reading the session cookie while this dialog is open. Nothing here runs on
 * mount; `performSignOut` is reached only from `confirm()`.
 *
 * CONTROLLED, WITH NO `DialogTrigger`. The thing that opens it is a
 * `DropdownMenuItem` inside `profile-menu.tsx`, and a Radix menu item cannot
 * also be a Radix dialog trigger — selecting the item closes the menu, which
 * would unmount a trigger nested inside it before the dialog it opened had
 * mounted. So the menu sets state and this renders as the menu's SIBLING.
 *
 * ON FAILURE THIS STAYS OPEN. See `sign-out.service.ts` for why navigating on
 * a failed sign-out is worse than not navigating at all.
 */
export function SignOutDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // Same guard, same reason as `otp-form.tsx` — see `submit-guard.ts`'s
  // header. `pending` is a `useState` boolean and therefore cannot be read
  // synchronously by a second dispatch of this handler; it stays the
  // mechanism for the VISIBLE disabled state and is no longer the mechanism
  // correctness depends on. A doubled confirm here is not harmless: the
  // second `signOut` lands after the first has already cleared the session,
  // and while the SDK's session-missing branch happens to answer that with
  // `{ error: null }` today, a control that fires twice per press is a
  // control whose behaviour depends on someone else's error handling.
  const guardRef = useRef<SubmitGuard | null>(null);
  guardRef.current ??= new SubmitGuard();
  const submitGuard = guardRef.current;

  async function confirm() {
    if (!submitGuard.start()) return;
    try {
      setPending(true);
      setFailed(false);

      const result = await performSignOut({ client: supabaseBrowser(), router });

      if (result.kind === "error") {
        // Deliberately NOT the SDK's own `message`, which is GoTrue's English
        // ("Failed to fetch", "Internal Server Error") — the same rule
        // `src/lib/otp-error.ts` states for the login form. There is no
        // 429-style split worth making here: every failure mode has the same
        // remedy, which is to press it again.
        setFailed(true);
        setPending(false);
        return;
      }

      // NO `setPending(false)` AND NO `onOpenChange(false)` ON SUCCESS. The
      // navigation has been issued; clearing the flag would re-enable a
      // button on a screen that is being replaced, and closing the dialog
      // would flash the signed-in shell behind it for the duration of the
      // route transition. The component unmounts with the tree.
    } finally {
      // Every exit path, including a throw neither branch catches — otherwise
      // the guard wedges shut and this dialog's confirm becomes permanently
      // inert for a reason invisible anywhere on screen.
      submitGuard.finish();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A sign-out already in flight is not cancellable — the request is
        // gone. Ignoring the close while pending keeps the dialog as the one
        // place the outcome is reported, rather than letting Escape or the
        // overlay dismiss it into silence.
        if (pending) return;
        setFailed(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Вийти з системи?</DialogTitle>
          <DialogDescription>Ви зможете увійти знову за одноразовим кодом.</DialogDescription>
        </DialogHeader>

        {failed && (
          <p role="alert" className="text-data text-status-blocked-fg">
            Не вдалося вийти. Спробуйте ще раз.
          </p>
        )}

        <DialogFooter>
          {/* `outline`, and the confirm is `primary` (ink) — there is no
            * `destructive` variant in this system and `signal` is rationed to
            * one per screen. Cancel comes FIRST in the DOM so `DialogFooter`'s
            * `flex-col-reverse` puts it BELOW the confirm on a phone and to
            * its left at `md` and up. */}
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Скасувати
          </Button>
          <Button type="button" variant="primary" disabled={pending} onClick={() => void confirm()}>
            {pending ? "Виходимо…" : "Вийти"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
