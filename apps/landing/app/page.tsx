import { EvidenceChain } from "../components/blocks/evidence-chain";
import { EvidenceIntegrity } from "../components/blocks/evidence-integrity";
import { Faq } from "../components/blocks/faq";
import { FieldMobile } from "../components/blocks/field-mobile";
import { FinalCta } from "../components/blocks/final-cta";
import { Footer } from "../components/blocks/footer";
import { Hero } from "../components/blocks/hero";
import { MoneyOutcome } from "../components/blocks/money-outcome";
import { NavFloat } from "../components/blocks/nav-float";
import { Comparison } from "../components/blocks/comparison";
import { PilotFormat } from "../components/blocks/pilot-format";
import { ProofStrip } from "../components/blocks/proof-strip";
import { ProductTour } from "../components/blocks/product-tour";
import { RolesDossier } from "../components/blocks/roles-dossier";

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
        <ProofStrip />
        <MoneyOutcome />
        <EvidenceChain />
        <ProductTour />
        <FieldMobile />
        <RolesDossier />
        <Comparison />
        <EvidenceIntegrity />
        <PilotFormat />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
