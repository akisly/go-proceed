import type { Metadata } from "next";
import { SectionRule } from "@goproceed/ui/components";
import { landingContent as c } from "../../content/landing-content";
import { createPageMetadata } from "../../content/landing-metadata";
import { SITE_ORIGIN } from "../../content/site-origin";
import { SiteShell } from "../../components/site-shell";
import { Roles } from "../../components/blocks/roles";
import { Compare } from "../../components/blocks/compare";
import { Cta } from "../../components/blocks/cta";

export const metadata: Metadata = createPageMetadata(SITE_ORIGIN, "roles");

/** «Для кого» (DEV-022): the four roles, the payer first, then the same stage as it is argued now and with GoProceed. */
export default function RolesPage() {
  return (
    <SiteShell page="roles">
      <Roles heading="h1" />
      <SectionRule index="01" label={c.compare.rule.label} />
      <Compare />
      <SectionRule index="02" label={c.cta.rule.label} />
      <Cta />
    </SiteShell>
  );
}
