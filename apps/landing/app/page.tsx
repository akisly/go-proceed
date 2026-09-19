import type { Metadata } from "next";
import { SectionRule } from "@goproceed/ui/components";
import { landingContent as c } from "../content/landing-content";
import { createPageMetadata } from "../content/landing-metadata";
import { SITE_ORIGIN } from "../content/site-origin";
import { SiteShell } from "../components/site-shell";
import { Hero } from "../components/blocks/hero";
import { Sources } from "../components/blocks/sources";
import { Problem } from "../components/blocks/problem";
import { Scenes } from "../components/blocks/scenes";
import { Position } from "../components/blocks/position";
import { Cta } from "../components/blocks/cta";

export const metadata: Metadata = createPageMetadata(SITE_ORIGIN, "home");

/**
 * The home page (DEV-022): what GoProceed is, why a late acceptance costs
 * money, what the product does about it, what it refuses to promise, and what
 * the pilot costs. Six blocks; the route, the roles and the form each have a
 * page of their own.
 */
export default function HomePage() {
  return (
    <SiteShell page="home">
      <Hero />
      <Sources />
      <SectionRule index="01" label={c.problem.rule.label} />
      <Problem />
      <SectionRule index="02" label={c.scenes.rule.label} />
      <Scenes />
      <Position />
      <SectionRule index="03" label={c.cta.rule.label} />
      <Cta />
    </SiteShell>
  );
}
