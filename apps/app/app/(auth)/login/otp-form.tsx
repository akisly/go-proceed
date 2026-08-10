"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabaseBrowser } from "../../../src/lib/supabase-browser";
import { Button } from "../../../src/ui/button";

type Phase = "email" | "code";

type OtpFormProps = {
  /**
   * Raw, attacker-controlled query-string text — NOT validated by
   * `page.tsx`. It is passed through unchanged and only inspected here, at
   * `verifyCode`, which is the one place a bad value could actually do
   * damage (`router.replace`). See `sanitizeNext` below.
   */
  next: string | undefined;
};

/**
 * `next` may be `/login?next=https://evil.example` or
 * `/login?next=//evil.example` (a scheme-relative URL — a browser treats a
 * leading `//` as "same scheme, different host", so this is an off-origin
 * redirect too, not a typo) sent to a foreman in a crafted link. Once they
 * type a real one-time code into THIS page, they trust wherever it sends
 * them next — so the only acceptable `next` is a same-origin, root-relative
 * path: exactly one leading slash, and not a second one right after it.
 * Anything else, including no value at all, falls back to `/`.
 */
function sanitizeNext(next: string | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  return next;
}

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

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      // Never render `signInError.message` — it is Supabase's own
      // English-language string (e.g. "Signups not allowed for otp"), and
      // every piece of UI copy in this product is Ukrainian. Surfacing it
      // verbatim would ship English text on a failure path exactly when a
      // pilot member is already stuck signing in.
      setError(
        "Не вдалося надіслати код. Перевірте адресу електронної пошти або зверніться до адміністратора.",
      );
      return;
    }

    setPhase("code");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: verifyError } = await supabaseBrowser().auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    setPending(false);

    if (verifyError) {
      setError("Невірний або прострочений код. Спробуйте ще раз.");
      return;
    }

    // `.replace`, not `.push`: the one-time code just spent should not sit
    // one back-button press away from a resubmit attempt.
    router.replace(sanitizeNext(next));
  }

  if (phase === "code") {
    return (
      <form onSubmit={verifyCode} className="flex flex-col gap-4" noValidate>
        <p className="text-body text-foreground-secondary">
          Код надіслано на <span className="font-medium text-foreground">{email}</span>.
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor="otp-code" className="text-data font-medium text-foreground">
            Код із листа
          </label>
          <input
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
            className="h-11 rounded-control border border-border bg-surface px-3 text-body text-foreground"
          />
        </div>
        {error ? (
          <p role="alert" className="text-data text-destructive">
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
        <label htmlFor="otp-email" className="text-data font-medium text-foreground">
          Електронна пошта
        </label>
        <input
          id="otp-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 rounded-control border border-border bg-surface px-3 text-body text-foreground"
        />
      </div>
      {error ? (
        <p role="alert" className="text-data text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="signal" disabled={pending || email.length === 0}>
        {pending ? "Надсилаємо…" : "Надіслати код"}
      </Button>
    </form>
  );
}
