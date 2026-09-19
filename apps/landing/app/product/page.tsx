import type { Metadata } from "next";
import { SectionRule } from "@goproceed/ui/components";
import { landingContent as c } from "../../content/landing-content";
import { createPageMetadata } from "../../content/landing-metadata";
import { SITE_ORIGIN } from "../../content/site-origin";
import { SiteShell } from "../../components/site-shell";
import { Route } from "../../components/blocks/route";
import { Capture } from "../../components/blocks/capture";
import { Provenance } from "../../components/blocks/provenance";
import { Cta } from "../../components/blocks/cta";

export const metadata: Metadata = createPageMetadata(SITE_ORIGIN, "product");

/** «Як працює» (DEV-022): the five-card route, the capture channels, then who sees what and the limits of v0.1. */
export default function ProductPage() {
  return (
    <SiteShell page="product">
      <Route heading="h1" />
      <SectionRule index="01" label={c.capture.rule.label} />
      <Capture />
      <SectionRule index="02" label={c.provenance.rule.label} />
      <Provenance />
      <SectionRule index="03" label={c.cta.rule.label} />
      <Cta />
    </SiteShell>
  );
}
