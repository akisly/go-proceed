import { SectionRule } from "@goproceed/ui/components";
import { landingContent as c } from "../content/landing-content";
import { landingJsonLd } from "../content/landing-jsonld";
import { SITE_ORIGIN } from "../content/site-origin";
import { Nav } from "../components/blocks/nav";
import { Hero } from "../components/blocks/hero";
import { Sources } from "../components/blocks/sources";
import { Problem } from "../components/blocks/problem";
import { Compare } from "../components/blocks/compare";
import { Roles } from "../components/blocks/roles";
import { Route } from "../components/blocks/route";
import { Position } from "../components/blocks/position";
import { Capture } from "../components/blocks/capture";
import { Provenance } from "../components/blocks/provenance";
import { Pilot } from "../components/blocks/pilot";
import { Faq } from "../components/blocks/faq";
import { Cta } from "../components/blocks/cta";
import { Footer } from "../components/blocks/footer";

export default function LandingPage() {
  return (
    <>
      {/* One graph, server-rendered. See content/landing-jsonld.ts for what is
        * deliberately absent and why FAQPage is not a promise of rich results. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd(SITE_ORIGIN)) }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-5 focus:top-3 focus:z-50 focus:rounded-control focus:bg-action focus:px-4 focus:py-3 focus:text-data focus:font-semibold focus:text-action-fg"
      >
        Перейти до основного вмісту
      </a>
      <Nav />
      <main id="main-content" tabIndex={-1} className="overflow-x-clip">
        <Hero />
        <Sources />
        <SectionRule index={c.problem.rule.index} label={c.problem.rule.label} />
        <Problem />
        <SectionRule index={c.compare.rule.index} label={c.compare.rule.label} />
        <Compare />
        <SectionRule index={c.roles.rule.index} label={c.roles.rule.label} />
        <Roles />
        <SectionRule index={c.route.rule.index} label={c.route.rule.label} />
        <Route />
        <Position />
        <SectionRule index={c.capture.rule.index} label={c.capture.rule.label} />
        <Capture />
        <SectionRule index={c.provenance.rule.index} label={c.provenance.rule.label} />
        <Provenance />
        <SectionRule index={c.pilot.rule.index} label={c.pilot.rule.label} />
        <Pilot />
        <SectionRule index={c.faq.rule.index} label={c.faq.rule.label} />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
