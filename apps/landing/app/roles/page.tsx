import type { Metadata } from "next";
import { createPageMetadata } from "../../content/landing-metadata";
import { SITE_ORIGIN } from "../../content/site-origin";
import { SiteShell } from "../../components/site-shell";
import { Band } from "../../components/blocks/band";
import { Roles } from "../../components/blocks/roles";
import { Problem } from "../../components/blocks/problem";
import { Compare } from "../../components/blocks/compare";
import { Cta } from "../../components/blocks/cta";

export const metadata: Metadata = createPageMetadata(SITE_ORIGIN, "roles");

/** «Для кого» (DEV-024): the four roles, the payer first; Рис. 01 — the same frame in a chat and in a record; then the same stage as it is argued now and with GoProceed. */
export default function RolesPage() {
  return (
    <SiteShell page="roles">
      <Roles heading="h1" />
      <Band />
      <Problem />
      <Band />
      <Compare />
      <Band />
      <Cta />
    </SiteShell>
  );
}
