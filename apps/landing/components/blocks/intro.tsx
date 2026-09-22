import { Marquee, Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { IndexTile } from "./index-tile";
import { demoRecords } from "../../content/demo-records";
import { landingContent } from "../../content/landing-content";
import { SectionLead } from "./section-head";
import { MiniMenu } from "../visuals/mini";
import { PillLink } from "./pill-link";
import { TwoTone } from "./two-tone";

/** The demonstration register's work titles — the tags that drift behind the menu. */
const TAGS = demoRecords.board.columns.flatMap((column) => column.cards.map((card) => card.title));

/**
 * The reference's second block (DEV-026). Left: two rows of tags drifting
 * behind a floating menu — here the kinds of hidden work in the demo register,
 * and the five records one of them leaves. Right: what the product is, as a
 * two-tone heading, one paragraph and a pill. Under both, four numbered
 * columns divided by hairlines: the four roles, the payer first.
 *
 * The two tag rows are the marquee (named loop 1); the second runs the other
 * way by being mirrored, not by a second keyframe.
 */
export function Intro() {
  const c = landingContent.intro;
  return (
    <section id="intro" tabIndex={-1} className="scroll-mt-20">
      <div className="landing-inset grid items-center gap-10 py-20 md:py-28 wide:grid-cols-2 wide:gap-6">
        <div role="img" aria-label={`${c.menuLabel}. ${c.tagsLabel}.`} className="relative isolate grid min-h-[360px] place-items-center overflow-hidden">
          {/* [DEV-029] THE STAGE. It was an edgeless wash for one revision and a
            * critique called it what it looked like: a soft rectangle with no
            * definite shape, which reads as a rendering mistake rather than a
            * decision. It is the site's one stage treatment now — warm fill,
            * one radius, one border — the same object the board and the compare
            * pair stand on. */}
          <div aria-hidden="true" className="landing-stage pointer-events-none absolute inset-0 -z-20" />
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 -z-10 grid -translate-y-1/2 gap-3 text-meta text-ink-muted">
            <Marquee>{TAGS.map((tag) => <span key={tag} className="px-4 py-1">{tag}</span>)}</Marquee>
            <Marquee className="-scale-x-100">{[...TAGS].reverse().map((tag) => <span key={tag} className="-scale-x-100 px-4 py-1">{tag}</span>)}</Marquee>
          </div>
          <Reveal size="stately"><MiniMenu /></Reveal>
        </div>
        <div className="grid max-w-[620px] gap-6 wide:pr-16">
          <TwoTone lead={c.lead} rest={c.rest} />
          <Reveal size="stately"><SectionLead>{c.body}</SectionLead></Reveal>
          <Reveal size="stately" className="flex"><PillLink href={c.actionHref}>{c.action}</PillLink></Reveal>
        </div>
      </div>
      <Stagger className="grid grid-cols-2 border-t border-line wide:grid-cols-4">
        {c.strip.map((item) => (
          <StaggerItem key={item.index} size="stately" className="group border-b border-line px-4 py-7 transition-colors duration-base ease-out odd:border-r hover:bg-surface md:px-6 md:py-9 wide:border-b-0 wide:border-r wide:last:border-r-0">
            <IndexTile>{item.index}</IndexTile>
            <h3 className="mt-4 text-h3 font-medium tracking-tight text-ink">{item.title}</h3>
            <p className="mt-2 text-data leading-relaxed text-ink-muted">{item.text}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
