"use client";

// Structure follows satnaing/shadcn-admin's `src/components/sign-out-dialog.tsx`
// (MIT: https://github.com/satnaing/shadcn-admin) — a confirm dialog whose
// open state the caller owns, whose confirm performs the sign-out. Every class
// name below is this system's own token role, never shadcn's CSS variables.

import { useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import {
  Banner, Button, Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
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
  open, onOpenChange, returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Where focus goes when this closes — see `onCloseAutoFocus` below. The
   * profile menu's own trigger, which is the control still on screen and the
   * one the user was working from.
   */
  returnFocusTo?: RefObject<HTMLButtonElement | null> | undefined;
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
      <DialogContent
        // `max-w-sm`, stock Tailwind's 384px (the theme keeps the stock scale
        // since 2026-09-24, DEV-073, BL-047).
        className="max-w-sm"
        // FOCUS GOES SOMEWHERE DELIBERATE WHEN THIS CLOSES. Radix's modal
        // content ships `onCloseAutoFocus: composeEventHandlers(props..., (e)
        // => { e.preventDefault(); context.triggerRef.current?.focus(); })`
        // (@radix-ui/react-dialog@1.1.23, dist/index.mjs:154-156) — it
        // cancels FocusScope's own restore and then focuses the trigger ref.
        // This dialog is controlled and has NO `DialogTrigger`, so that ref
        // is null, the optional call no-ops, and Cancel or Escape leaves
        // focus on nothing: the browser drops it to `<body>` and a keyboard
        // user is thrown to the top of the document in the middle of a task.
        //
        // `composeEventHandlers` defaults to `checkForDefaultPrevented: true`
        // (@radix-ui/primitive), so preventing the default here runs INSTEAD
        // of Radix's handler rather than alongside it — one restore, ours.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo?.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Вийти з системи?</DialogTitle>
          <DialogDescription>Ви зможете увійти знову за одноразовим кодом.</DialogDescription>
        </DialogHeader>

        {/*
          * `Banner tone="blocked"`, not a hand-rolled `<p>`. The previous
          * version wore `text-status-blocked-fg` WITHOUT the paired
          * `bg-status-blocked`/`border-status-blocked-line` the tone is
          * defined as, and carried `role="alert"` — which `Banner`'s own
          * header explicitly rejects for this exact situation: «alert
          * interrupts whatever the screen reader is saying, and a refusal the
          * user just caused by pressing a button is not an interruption — it
          * is the answer.» Reusing the component keeps a blocked banner here
          * the same colour as a blocked chip anywhere else, which is the
          * reason that tone map is shared.
          */}
        {failed && <Banner tone="blocked" title="Не вдалося вийти. Спробуйте ще раз." />}

        <DialogFooter>
          {/* [2026-09-23, DEV-035: the confirm is `brand` (pine) — the
            * dashboard's primary action, owner: «Зелёная, как в Autumn».
            * The note below predates it and is kept as written.]
            * `outline`, and the confirm is `primary` (ink) — there is no
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
          <Button type="button" variant="brand" disabled={pending} onClick={() => void confirm()}>
            {pending ? "Виходимо…" : "Вийти"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
