import { CellField, ParticleSphere, Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { PillLink } from "./pill-link";
import { Sources } from "./sources";
import { TwoTone } from "./two-tone";

/**
 * The reference's statistics band (DEV-026): a wide grid ground, a two-tone
 * heading with a pill opposite it, four tiles in one bordered row — and, where
 * the reference sets its customers' logos, the requirement sources.
 *
 * The tiles are terms of the pilot, not results: no outcome figure exists to
 * publish (PRODUCT.md), and a band of invented numbers is the one part of the
 * reference that must not be matched.
 *
 * [DEV-027] The band behaves as the reference's does. Its grid answers the
 * pointer — the cell under it lights up and fades (`CellField`, on the pitch
 * of `landing-gridfield`, which still draws the lines). Under the tiles a dome
 * of particles rises from the block's lower edge, turns, and scatters from the
 * pointer (`ParticleSphere`: three.js, fetched only when this block nears the
 * viewport; a still 2D dome without WebGL and under reduced motion). The
 * sources close the band as one even row.
 *
 * [DEV-027, owner, second pass] «сделай отступ больше до глобуса … добавь
 * свечение по бокам как основной фиолетовый акцент, и точки так же фиолетовые,
 * и чтобы под этим глобусом не подсвечивались квадраты»: more air between the
 * tiles and the dome; the dome's dots and the two lights at its lower corners
 * are the accent (cobalt until 2026-09-22, pine since) — the colour is still only a class, `text-accent`,
 * read by the canvas; and the grid's cells stay dark under the dome's box
 * (`CellField exclude`).
 *
 * [DEV-027, owner, third pass] «посмотри как в референсе сделан градиент по
 * бокам возле глобуса, так же верхние точки у него обрезаются … что бы под
 * карточками не подсвечивался квадраты, и может при наведении квадратиков тоже
 * сделать его фиолетовым акцентом»: the lights hug the dome's two sides and
 * rise past its apex toward the tiles, a haze from below the horizon, as the
 * reference's do; the dome's canvas has headroom, so no dot is cut at its top;
 * the tiles are barred to the grid as the dome is; and a lit cell is the
 * accent.
 *
 * [DEV-027, owner, seventh pass] «ховер на квадраты так же должен работать
 * вокруг глобуса, но не на самом глобусе»: the grid is barred from the dome's
 * DISC — which `ParticleSphere` publishes on its box — and no longer from the
 * whole strip the dome stands in; the cells beside the dome answer again.
 *
 * [2026-09-22, DEV-029] The dome stood on the inverse ground for one revision
 * and it was the clearest case of the mistake the owner threw out on sight:
 * «те темные блоки вообще как-то не к чему, не вписываются». In the reference
 * the near-black is the backdrop a LIGHT PRODUCT is photographed against — a
 * laptop, an application panel. What lay on ours was a cloud of pine dots at
 * 2.55:1 against that ground, so the band read as a black rectangle with almost
 * nothing in it. The dome is back on paper, where its haze was tuned over seven
 * rounds to sit.
 */
export function Facts() {
  const f = landingContent.facts;
  return (
    <section id="facts" tabIndex={-1} className="landing-gridfield relative isolate scroll-mt-20 overflow-hidden">
      <CellField pitch={62} strength={0.16} exclude="[data-particle-sphere], [data-tiles]" className="absolute inset-0 -z-10 h-full w-full text-accent" />
      <div className="py-20 md:py-28">
        <div className="landing-inset flex flex-wrap items-end justify-between gap-6">
          <TwoTone lead={f.lead} rest={f.rest} />
          <Reveal size="stately"><PillLink href={f.actionHref}>{f.action}</PillLink></Reveal>
        </div>
        {/* A box of its own, because `Stagger` forwards no attribute: `data-tiles` is what the grid's `CellField` is barred from.
          * [2026-09-22, DEV-029, owner: «бордеры по бокам двойные».] The strip is full-bleed, so it draws only its top and
          * bottom — its sides are the page frame's. A tile draws a right edge only where a tile follows it in the row
          * (2 × 2 at md, 4 × 1 at wide), and the bottom-left tile of the 2 × 2 no bottom edge, for the same reason.
          * The box is an 8px paper moat round the strip: the section's 62px lattice starts at the section's top and the
          * strip's place depends on how the heading wraps, so at some widths a lattice row fell 1.5px from the strip's
          * edge and read as a second border (`gp-ui-reviewer` U3-01, 1000px). No lattice line can touch it now.
          * `mt-10` + `py-2` keeps the 48px the strip stood below the heading at. */}
        <div data-tiles="" className="mt-10 bg-canvas py-2">
          <Stagger className="grid border-y border-line-strong bg-subtle md:grid-cols-2 wide:grid-cols-4">
          {f.tiles.map((tile) => (
            <StaggerItem key={tile.label} size="stately" className="border-b border-line-strong px-6 py-6 transition-colors duration-base ease-out last:border-b-0 hover:bg-surface md:border-r md:even:border-r-0 md:[&:nth-child(3)]:border-b-0 wide:border-b-0 wide:[&:nth-child(2)]:border-r">
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
