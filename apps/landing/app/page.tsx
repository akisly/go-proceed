import { Hero } from "../components/blocks/hero";
import { MoneyOutcome } from "../components/blocks/money-outcome";
import { NavFloat } from "../components/blocks/nav-float";
import { ProofStrip } from "../components/blocks/proof-strip";
import { Statement } from "../components/blocks/statement";

export default function LandingPage() {
  return (
    <>
      <NavFloat />
      <main className="overflow-hidden">
        <Hero />
        <ProofStrip />
        <MoneyOutcome />
        <Statement />
      </main>
    </>
  );
}
