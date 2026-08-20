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
import { SystemDashboard } from "../components/blocks/system-dashboard";

export default function LandingPage() {
  return (
    <>
      <NavFloat />
      <main className="overflow-x-clip">
        <Hero />
        <ProofStrip />
        <MoneyOutcome />
        <SystemDashboard />
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
