import { Chip } from "@goproceed/ui/components";
import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionHead } from "./section-head";
import { ChannelApp } from "../visuals/channel-app";
import { ChannelTelegram } from "../visuals/channel-telegram";
import { ChannelWeb } from "../visuals/channel-web";
import { SpotlightCard } from "../visuals/spotlight-card";

/** [DEV-029] NO INDEX TINT IN THIS BLOCK, deliberately. Each of these cards
 * already carries a STATUS chip («доступно», «на перевірці»), and two coloured
 * marks in one card is how a reader learns that neither of them means anything.
 * The tints survive in one place on the site, the roles grid. */

const DEVICE = { telegram: <ChannelTelegram />, app: <ChannelApp />, web: <ChannelWeb /> } as const;

export function Capture() {
  const c = landingContent.capture;
  return (
    <section id="capture" tabIndex={-1} className="landing-inset scroll-mt-20 py-20 md:py-28">
      <div>
        <SectionHead eyebrow={c.eyebrow} title={c.title} titleAccent={c.titleAccent} lead={c.lead} />
        <Stagger className="grid gap-3.5 md:grid-cols-3">
          {c.channels.map((ch) => (
            <StaggerItem key={ch.id} size="grand" className="[transform-style:preserve-3d]">
              <SpotlightCard className="landing-stage group relative isolate grid h-full grid-rows-[auto_1fr_auto] gap-4 overflow-hidden p-5.5">
                <p className="flex items-center justify-between gap-3"><span className="index-label">{ch.index}</span><Chip tone={ch.status.tone} dot pulse={ch.status.tone === "review"}>{ch.status.label}</Chip></p>
                <div>
                  <h3 className="mt-2 text-balance text-h3 font-semibold text-ink">{ch.title}</h3>
                  <p className="mt-2 max-w-[44ch] text-data leading-relaxed text-ink-secondary">{ch.body}</p>
                  <div className="grid place-items-center py-6">{DEVICE[ch.id]}</div>
                </div>
                <p className="text-meta text-ink-muted">{ch.foot}</p>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="grid justify-items-center" size="stately">
          <svg aria-hidden="true" viewBox="0 0 1000 96" preserveAspectRatio="none" className="hidden h-24 w-full md:block">
            <path d="M167 0C167 70 500 30 500 96" className="flow-dash fill-none stroke-ink-subtle" strokeWidth="1.2" />
            <path d="M500 0V96" className="flow-dash fill-none stroke-ink-subtle" strokeWidth="1.2" />
            <path d="M833 0C833 70 500 30 500 96" className="flow-dash fill-none stroke-ink-subtle" strokeWidth="1.2" />
          </svg>
          <p className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-pill border border-line-strong bg-canvas px-3.5 py-2 text-center text-data text-ink-secondary md:mt-0">
            <i className="size-1.5 rounded-pill bg-status-ready-fg" /><b className="font-medium text-ink">{c.converge.code}</b> · {c.converge.text}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
