import { Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";

export function ProofStrip() {
  return (
    <section id="proof" aria-label="Контур продукту" className="scroll-mt-24 border-y border-line bg-surface px-5 md:px-8 wide:px-12">
      <Stagger className="mx-auto grid max-w-content md:grid-cols-2 wide:grid-cols-4">
        {landingContent.proof.map((item, index) => (
          <StaggerItem
            key={item.value}
            y={0}
            className="border-b border-line py-6 md:px-6 md:[&:nth-child(odd)]:border-r wide:border-b-0 wide:border-r wide:first:pl-0 wide:last:border-r-0 wide:last:pr-0"
          >
            <p className="index-label text-ink-subtle">0{index + 1} · {item.value}</p>
            <p className="mt-2 max-w-[26ch] text-data font-medium leading-relaxed text-ink">{item.label}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
