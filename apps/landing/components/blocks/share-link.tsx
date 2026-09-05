"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@goproceed/ui/components";
import { landingContent } from "../../content/landing-content";

/** «Скопіювати посилання для ПТВ»: the page URL with the compare anchor and one sentence, onto the clipboard. */
export function ShareLink() {
  const [done, setDone] = useState(false);
  const timerRef = useRef<number | null>(null);

  async function copy() {
    const url = `${window.location.href.split("#")[0]}#compare`;
    try {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      await navigator.clipboard.writeText(`${landingContent.cta.shareText}${url}`);
      setDone(true);
      timerRef.current = window.setTimeout(() => setDone(false), 2200);
    } catch { setDone(false); }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return <Button type="button" size="lg" variant="outline" onClick={copy}>{done ? landingContent.cta.shared : landingContent.cta.share}</Button>;
}
