import { CellField, ParticleSphere, Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
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
 *
 * [DEV-024] The band behaves as the reference's does. Its grid answers the
 * pointer — the cell under it lights up and fades (`CellField`, on the pitch
 * of `landing-gridfield`, which still draws the lines). Under the tiles a dome
 * of particles rises from the block's lower edge, turns, and scatters from the
 * pointer (`ParticleSphere`: three.js, fetched only when this block nears the
 * viewport; a still 2D dome without WebGL and under reduced motion). The
 * sources close the band as one even row.
 *
 * [DEV-024, owner, second pass] «сделай отступ больше до глобуса … добавь
 * свечение по бокам как основной фиолетовый акцент, и точки так же фиолетовые,
 * и чтобы под этим глобусом не подсвечивались квадраты»: more air between the
 * tiles and the dome; the dome's dots and the two lights at its lower corners
 * are the accent (cobalt) — the colour is still only a class, `text-accent`,
 * read by the canvas; and the grid's cells stay dark under the dome's box
 * (`CellField exclude`).
 *
 * [DEV-024, owner, third pass] «посмотри как в референсе сделан градиент по
 * бокам возле глобуса, так же верхние точки у него обрезаются … что бы под
 * карточками не подсвечивался квадраты, и может при наведении квадратиков тоже
 * сделать его фиолетовым акцентом»: the lights hug the dome's two sides and
 * rise past its apex toward the tiles, a haze from below the horizon, as the
 * reference's do; the dome's canvas has headroom, so no dot is cut at its top;
 * the tiles are barred to the grid as the dome is; and a lit cell is the
 * accent.
 *
 * [DEV-024, owner, seventh pass] «ховер на квадраты так же должен работать
 * вокруг глобуса, но не на самом глобусе»: the grid is barred from the dome's
 * DISC — which `ParticleSphere` publishes on its box — and no longer from the
 * whole strip the dome stands in; the cells beside the dome answer again.
 */
export function Facts() {
  const f = landingContent.facts;
  return (
    <section id="facts" tabIndex={-1} className="landing-gridfield relative isolate scroll-mt-20 overflow-hidden">
      <CellField pitch={62} strength={0.16} exclude="[data-particle-sphere], [data-tiles]" className="absolute inset-0 -z-10 h-full w-full text-accent" />
      <div className="px-4 pb-20 pt-20 md:px-8 md:pb-28 md:pt-28 wide:px-12 wide:pb-32">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <TwoTone lead={f.lead} rest={f.rest} />
          <Reveal size="stately"><PillLink href={f.actionHref}>{f.action}</PillLink></Reveal>
        </div>
        {/* A box of its own, because `Stagger` forwards no attribute: `data-tiles` is what the grid's `CellField` is barred from. */}
        <div data-tiles="" className="mt-12">
          <Stagger className="grid border border-line-strong bg-subtle md:grid-cols-2 wide:grid-cols-4">
          {f.tiles.map((tile) => (
            <StaggerItem key={tile.label} size="stately" className="border-b border-line-strong px-6 py-6 transition-colors duration-base ease-out last:border-b-0 hover:bg-surface md:border-r md:last:border-r-0 wide:border-b-0">
              <p data-fact="" className="display text-mkt-display-3 font-medium tracking-tight text-ink">{tile.value}</p>
              <p className="mt-1.5 text-body text-ink-muted">{tile.label}</p>
            </StaggerItem>
          ))}
          </Stagger>
        </div>
      </div>
      <div data-dome="" className="relative h-[120px] md:h-[230px] wide:h-[320px]">
        {/* The lights rise past the dome's apex, as the reference's do, so they live on a layer taller than the box; and the dome's canvas keeps 96px of headroom above the apex, or its top dots are cut at the canvas's edge. Neither changes `[data-dome]`'s own box. The grid is barred from the DOME — the disc `ParticleSphere` publishes on its box — not from this strip. */}
        <div aria-hidden="true" className="landing-dome-light pointer-events-none absolute inset-x-0 bottom-0 h-[160%] wide:h-[210%]" />
        <ParticleSphere headroom={96} className="absolute inset-x-0 -top-24 bottom-0 text-accent" />
      </div>
      <Sources />
    </section>
  );
}
