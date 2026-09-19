import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { PillLink } from "./pill-link";
import { Sources } from "./sources";
import { TwoTone } from "./two-tone";

/**
 * The reference's statistics band (DEV-023): a wide grid ground, a two-tone
 * heading with a pill opposite it, four tiles in one bordered row — and, where
 * the reference sets its customers' logos, the requirement sources.
 *
 * The tiles are terms of the pilot, not results: no outcome figure exists to
 * publish (PRODUCT.md), and a band of invented numbers is the one part of the
 * reference that must not be matched.
 */
export function Facts() {
  const f = landingContent.facts;
  return (
    <section id="facts" tabIndex={-1} className="landing-gridfield scroll-mt-20">
      <div className="px-4 pb-16 pt-20 md:px-8 md:pt-28 wide:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <TwoTone lead={f.lead} rest={f.rest} />
          <Reveal size="stately"><PillLink href={f.actionHref}>{f.action}</PillLink></Reveal>
        </div>
        <Stagger className="mt-12 grid border border-line-strong bg-subtle md:grid-cols-2 wide:grid-cols-4">
          {f.tiles.map((tile) => (
            <StaggerItem key={tile.label} size="stately" className="border-b border-line-strong px-6 py-6 last:border-b-0 md:border-r md:last:border-r-0 wide:border-b-0">
              <p data-fact="" className="display text-mkt-display-3 font-medium tracking-tight text-ink">{tile.value}</p>
              <p className="mt-1.5 text-body text-ink-muted">{tile.label}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
      <Sources />
    </section>
  );
}
