"use client";

import { useState } from "react";
import { Button } from "@goproceed/ui/components";
import { landingContent } from "../../content/landing-content";

/** «Скопіювати посилання для ПТВ»: the page URL with the compare anchor and one sentence, onto the clipboard. */
export function ShareLink() {
  const [done, setDone] = useState(false);
  async function copy() {
    const url = `${window.location.href.split("#")[0]}#compare`;
    try {
      await navigator.clipboard.writeText(`${landingContent.cta.shareText}${url}`);
      setDone(true);
      window.setTimeout(() => setDone(false), 2200);
    } catch { setDone(false); }
  }
  return <Button type="button" size="lg" variant="outline" onClick={copy}>{done ? landingContent.cta.shared : landingContent.cta.share}</Button>;
}
