import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";

export function ProofStrip() {
  const proof = landingContent.proof;

  return (
    <section
      id="proof"
      aria-labelledby="proof-title"
      className="scroll-mt-24 border-y border-line-strong bg-surface px-5 md:px-8 wide:px-12"
    >
      <div className="mx-auto grid max-w-content wide:grid-cols-[0.34fr_0.66fr]">
        <Reveal
          y={0}
          className="border-b border-line py-9 md:py-11 wide:border-b-0 wide:border-r wide:py-12 wide:pr-12"
        >
          <div className="flex items-center gap-3">
            <span className="size-2 rounded-pill bg-action-signal" aria-hidden="true" />
            <p className="index-label text-ink-muted">{proof.eyebrow} · 01—04</p>
          </div>
          <h2 id="proof-title" className="display mt-6 max-w-[18ch] text-mkt-display-3 text-ink">
            {proof.title}
          </h2>
        </Reveal>

        <Reveal y={0} delay={0.08}>
          <ol aria-label="Етапи доказового контуру" className="grid md:grid-cols-2">
            {proof.items.map((item, index) => (
              <li
                key={item.value}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 border-b border-line py-7 last:border-b-0 md:px-8 md:py-9 md:[&:nth-child(odd)]:border-r md:[&:nth-child(n+3)]:border-b-0 wide:px-10 wide:py-10"
              >
                <span className="index-label tabular pt-0.5 text-ink-subtle" aria-hidden="true">
                  0{index + 1}
                </span>
                <div>
                  <p className="index-label text-ink-muted">{item.value}</p>
                  <p className="mt-3 max-w-[29ch] text-data font-medium leading-relaxed text-ink">
                    {item.label}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
