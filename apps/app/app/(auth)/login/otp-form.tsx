"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabaseBrowser } from "../../../src/lib/supabase-browser";
import { otpErrorMessage } from "../../../src/lib/otp-error";
import { safeNext } from "../../../src/lib/safe-next";
import { SubmitGuard } from "../../../src/lib/submit-guard";
import { Button, Input, Label } from "@goproceed/ui/components";

type Phase = "email" | "code";

type OtpFormProps = {
  /**
   * Raw, attacker-controlled query-string text — NOT validated by
   * `page.tsx`. It is passed through unchanged and only inspected here, at
   * `verifyCode`, which is the one place a bad value could actually do
   * damage (`router.replace`). See `safe-next.ts`'s `safeNext` — the guard
   * itself lives in its own module (not inline here) so it can be unit
   * tested with `vitest` under plain Node, with no DOM and no `window` at
   * module scope.
   */
  next: string | undefined;
};

/**
 * Two phases, one component, no route change between them: `email` ->
 * request a code, `code` -> verify it and land on `next`. The only state
 * that has to survive between phases (the address just typed, and where to
 * go afterward) only needs to survive a re-render, not a navigation, so a
 * second route/page for phase two would just be more places for `next` to
 * get lost.
 */
export function OtpForm({ next }: OtpFormProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // See submit-guard.ts's header for the full defect this closes and the
  // evidence behind it. `useRef` (not `useState`) because the guard's own
  // identity must survive re-renders and mutating it must not itself
  // trigger one — same reasoning as capture.tsx's [deleted 2026-09-23, DEV-035] `guardRef`. Lazily
  // assigned (`??=`), not `useRef(new SubmitGuard())`: the latter would
  // construct a fresh, immediately-discarded instance on every render,
  // since `useRef`'s argument is only used on the first call but is still
  // evaluated on every one. One guard shared by both phases' submit
  // handlers below — only one of the two forms is ever mounted at a time,
  // so only one of `requestCode`/`verifyCode` can ever be "in flight".
  const guardRef = useRef<SubmitGuard | null>(null);
  guardRef.current ??= new SubmitGuard();
  const submitGuard = guardRef.current;

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // SYNCHRONOUS re-entrancy check, ahead of any `await` — a second
    // dispatch of this same handler before the first has reached its next
    // suspension point sees `false` here and returns immediately, touching
    // neither Supabase nor any state. `pending` below cannot do this job:
    // see submit-guard.ts's header for why.
    if (!submitGuard.start()) return;
    try {
      setPending(true);
      setError(null);

      const { error: signInError } = await supabaseBrowser().auth.signInWithOtp({
        email,
        options: {
          // LOAD-BEARING, not a default left in place. A pilot member is
          // invited and granted capabilities by an administrator; `true` here
          // would let this public form mint a brand-new Supabase Auth user for
          // anyone who types an email address, land them signed in, and show
          // them a product with no organization, no project, and no
          // capability grant — an empty screen with no explanation, for a
          // member nobody on the pilot actually invited.
          shouldCreateUser: false,
        },
      });

      setPending(false);

      if (signInError) {
        // The whole failure-to-sentence rule — the 429 split, the deliberate
        // collapse of everything else, and the refusal to render GoTrue's own
        // English `message` — lives in `src/lib/otp-error.ts`, which states its
        // reasoning in full and is unit-tested in plain Node. It used to be
        // written out here, and `verifyCode` below carried a lookalike ternary
        // that had never learned the 429 half; see that module's header.
        setError(otpErrorMessage("send", signInError.status));
        return;
      }

      setPhase("code");
    } finally {
      // Runs on every exit path — the handled-error `return` above, the
      // success fallthrough, AND an unexpected throw neither branch
      // catches. Anything short of `finally` risks wedging this form's
      // submit permanently disabled-by-guard, for a reason invisible
      // anywhere in the UI — see submit-guard.ts's `finish()` comment.
      submitGuard.finish();
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitGuard.start()) return;
    try {
      setPending(true);
      setError(null);

      const { error: verifyError } = await supabaseBrowser().auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      setPending(false);

      if (verifyError) {
        // THE SAME RULE AS THE SEND PHASE, WHICH IS THE FIX. This line used to
        // be an unconditional «Невірний або прострочений код», so a foreman
        // rate-limited at the verify step — GoTrue returns 429 here too — was
        // told the correct code he was reading off his own phone was wrong. He
        // then retypes it, or asks for a new one, either of which extends the
        // limit. The 429 split had landed one function above this, on the send
        // path, and stopped there.
        setError(otpErrorMessage("verify", verifyError.status));
        return;
      }

      // `.replace`, not `.push`: the one-time code just spent should not sit
      // one back-button press away from a resubmit attempt. `window.location.origin`
      // (not a hardcoded string) is what `safeNext` resolves the candidate
      // against, so this stays correct on whatever host/scheme/port the app is
      // actually running under — localhost in dev, the real domain in
      // staging/prod — rather than assuming one.
      router.replace(safeNext(next, window.location.origin));
    } finally {
      submitGuard.finish();
    }
  }

  if (phase === "code") {
    return (
      <form onSubmit={verifyCode} className="flex flex-col gap-4" noValidate>
        <p className="text-body text-ink-secondary">
          Код надіслано на <span className="font-medium text-ink">{email}</span>.
        </p>
        <div className="flex flex-col gap-1">
          <Label htmlFor="otp-code">Код із листа</Label>
          <Input
            id="otp-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-data text-status-blocked-fg">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="signal" disabled={pending || code.length === 0}>
          {pending ? "Перевіряємо…" : "Увійти"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setPhase("email");
            setCode("");
            setError(null);
          }}
        >
          Змінити адресу пошти
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <Label htmlFor="otp-email">Електронна пошта</Label>
        <Input
          id="otp-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-data text-status-blocked-fg">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="signal" disabled={pending || email.length === 0}>
        {pending ? "Надсилаємо…" : "Надіслати код"}
      </Button>
    </form>
  );
}
