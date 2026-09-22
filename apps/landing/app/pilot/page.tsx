import type { Metadata } from "next";
import { createPageMetadata } from "../../content/landing-metadata";
import { SITE_ORIGIN } from "../../content/site-origin";
import { SiteShell } from "../../components/site-shell";
import { Band } from "../../components/blocks/band";
import { Pilot } from "../../components/blocks/pilot";
import { Faq } from "../../components/blocks/faq";

export const metadata: Metadata = createPageMetadata(SITE_ORIGIN, "pilot");

/**
 * «Пілот» (DEV-025): the plan, the terms and the one form on the site, with the
 * questions a buyer asks before sending it directly underneath. No closing
 * offer here — the page is the offer.
 */
export default function PilotPage() {
  return (
    <SiteShell page="pilot">
      <Pilot heading="h1" />
      <Band />
      <Faq />
    </SiteShell>
  );
}
