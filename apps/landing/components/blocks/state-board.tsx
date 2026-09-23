import { Globe, Send, Smartphone, Workflow } from "lucide-react";
import { Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { ProductFrame } from "../visuals/product-frame";
import { TwoTone } from "./two-tone";

const ICON = [Send, Smartphone, Globe, Workflow] as const;

/**
 * The reference's «every channel, connected» (DEV-026): a two-tone heading, the
 * large application view, and four short statements in a
 * row — an icon, a name in ink, the rest muted. The view is the state board
 * that was the home page's hero until this task; the statements are the three
 * capture channels and the one record they converge on.
 *
 * [2026-09-22, DEV-029] THE VIEW STANDS ON A PANEL, not on the page — and the
 * panel is the WARM one, the site's single stage treatment. It was near-black
 * for one revision, taken from the reference's own product shots; the owner
 * removed the dark from the whole site («убрать тёмное совсем») after a
 * critique measured 32 distinct panel treatments across four pages. The fix for
 * that number is one stage, used everywhere a sheet needs something to lie on,
 * not a second one that is darker.
 *
 * The heading and the four statements stay on paper. The board itself is
 * untouched: a white sheet with its own beam, which is what the stage exists to
 * hold.
 */
export function StateBoard() {
  const c = landingContent.capture;
  const statements = [
    ...c.channels.map((channel) => ({ name: channel.index.split(" · ")[1] ?? channel.title, text: channel.title })),
    { name: c.converge.code, text: c.converge.text },
  ];
  return (
    <section id="board" tabIndex={-1} className="landing-inset scroll-mt-20 py-20 md:py-28">
      <TwoTone lead={landingContent.board.lead} rest={landingContent.board.rest} />
      <div className="landing-stage relative isolate mt-10 px-4 pb-10 pt-8 md:px-10 md:pb-16 md:pt-12">
        <ProductFrame />
      </div>
      <Stagger className="mt-4 grid gap-x-8 gap-y-6 md:grid-cols-2 wide:grid-cols-4">
        {statements.map((s, i) => {
          const Icon = ICON[i]!;
          return (
            <StaggerItem key={s.name} size="stately">
              <p className="text-body leading-relaxed text-ink-muted">
                <Icon aria-hidden="true" className="mr-1.5 inline size-4 align-[-2px] text-ink" strokeWidth={1.6} />
                <span className="font-medium text-ink">{s.name}</span> — {s.text}
              </p>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
