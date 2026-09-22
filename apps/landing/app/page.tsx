import type { Metadata } from "next";
import { createPageMetadata } from "../content/landing-metadata";
import { SITE_ORIGIN } from "../content/site-origin";
import { SiteShell } from "../components/site-shell";
import { Band } from "../components/blocks/band";
import { Hero } from "../components/blocks/hero";
import { Intro } from "../components/blocks/intro";
import { Scenes } from "../components/blocks/scenes";
import { Facts } from "../components/blocks/facts";
import { Cta } from "../components/blocks/cta";

export const metadata: Metadata = createPageMetadata(SITE_ORIGIN, "home");

/**
 * The home page. [DEV-024] Short: what GoProceed is, why a late acceptance
 * costs money, what the product does, what the pilot costs. [DEV-025] In the
 * reference's order and form: the full-viewport first screen, the split with
 * its four numbered columns, three cards on a grid ground, the fact band over
 * the requirement sources, the radial closing block — a raster band between
 * each. Рис. 01 and the position statement live on /roles and /product.
 */
export default function HomePage() {
  return (
    <SiteShell page="home">
      <Hero />
      <Band />
      <Intro />
      <Band />
      <Scenes />
      <Band />
      <Facts />
      <Band />
      <Cta />
    </SiteShell>
  );
}
