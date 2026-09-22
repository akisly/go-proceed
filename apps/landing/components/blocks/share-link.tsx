"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@goproceed/ui/components";
import { landingContent } from "../../content/landing-content";

/**
 * «Скопіювати посилання для ПТВ»: the address of «Було і стало» (on /roles since
 * DEV-025) and one sentence, onto the clipboard.
 *
 * The outcome is ANNOUNCED, not just drawn on the button. Neither NVDA nor
 * JAWS re-announces a focused button whose own label changes, so swapping
 * «Скопіювати» for «Скопійовано» told a screen-reader user nothing — and the
 * `catch` below used to reset the flag and say nothing at all, which is a
 * refusal that looks exactly like success (WCAG 4.1.3).
 */
export function ShareLink() {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<number | null>(null);

  async function copy() {
    const url = new URL(landingContent.cta.shareHref, window.location.origin).href;
    try {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      await navigator.clipboard.writeText(`${landingContent.cta.shareText}${url}`);
      setFailed(false);
      setDone(true);
      timerRef.current = window.setTimeout(() => setDone(false), 2200);
    } catch { setDone(false); setFailed(true); }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <>
      <Button type="button" size="lg" variant="outline" className="rounded-pill" onClick={copy}>
        {done ? landingContent.cta.shared : landingContent.cta.share}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {done && landingContent.cta.shared}
        {failed && landingContent.cta.shareFailed}
      </span>
    </>
  );
}
