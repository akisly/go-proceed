import { Footer } from "../components/blocks/footer";
import { EvidenceJourney } from "../components/blocks/evidence-journey";
import { FieldReview } from "../components/blocks/field-review";
import { Hero } from "../components/blocks/hero";
import { NavFloat } from "../components/blocks/nav-float";
import { ReadinessDiagram } from "../components/blocks/readiness-diagram";
import { TrustBoundary } from "../components/blocks/trust-boundary";

export default function LandingPage() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-5 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-action focus:px-4 focus:py-3 focus:text-data focus:font-semibold focus:text-action-fg"
      >
        Перейти до основного вмісту
      </a>
      <NavFloat />
      <main id="main-content" tabIndex={-1} className="overflow-x-clip">
        <Hero />
        <EvidenceJourney />
        <FieldReview />
        <ReadinessDiagram />
        <TrustBoundary />
      </main>
      <Footer />
    </>
  );
}
