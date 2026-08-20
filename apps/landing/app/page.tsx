import { EvidenceChain } from "../components/blocks/evidence-chain";
import { FieldMobile } from "../components/blocks/field-mobile";
import { Hero } from "../components/blocks/hero";
import { MoneyOutcome } from "../components/blocks/money-outcome";
import { NavFloat } from "../components/blocks/nav-float";
import { ProofStrip } from "../components/blocks/proof-strip";
import { ProductTour } from "../components/blocks/product-tour";
import { Statement } from "../components/blocks/statement";
import { SystemDashboard } from "../components/blocks/system-dashboard";

export default function LandingPage() {
  return (
    <>
      <NavFloat />
      <main className="overflow-x-clip">
        <Hero />
        <ProofStrip />
        <MoneyOutcome />
        <Statement />
        <SystemDashboard />
        <EvidenceChain />
        <ProductTour />
        <FieldMobile />
      </main>
    </>
  );
}
