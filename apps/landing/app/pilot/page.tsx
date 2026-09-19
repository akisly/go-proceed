import type { Metadata } from "next";
import { SectionRule } from "@goproceed/ui/components";
import { landingContent as c } from "../../content/landing-content";
import { createPageMetadata } from "../../content/landing-metadata";
import { SITE_ORIGIN } from "../../content/site-origin";
import { SiteShell } from "../../components/site-shell";
import { Pilot } from "../../components/blocks/pilot";
import { Faq } from "../../components/blocks/faq";

export const metadata: Metadata = createPageMetadata(SITE_ORIGIN, "pilot");

/**
 * «Пілот» (DEV-022): the plan, the terms and the one form on the site, with the
 * questions a buyer asks before sending it directly underneath. No closing
 * offer here — the page is the offer.
 */
export default function PilotPage() {
  return (
    <SiteShell page="pilot">
      <Pilot heading="h1" />
      <SectionRule index="01" label={c.faq.rule.label} />
      <Faq />
    </SiteShell>
  );
}
