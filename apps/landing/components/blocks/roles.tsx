import { Building2, ClipboardList, ShieldCheck, Smartphone } from "lucide-react";
import { FeatureCell, FeatureGrid } from "@goproceed/ui/components";
import { Reveal, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionHead } from "./section-head";

/** [DEV-029] One tint per role, in the order the page argues them — the payer
 * first. This is the ONE place on the site that keeps the four tints, by the
 * owner's decision after an `impeccable` critique: four peer cells that a
 * reader has to tell apart is the only job a decorative hue can do here without
 * competing with the five status colours. Everywhere else the enumeration is a
 * mono numeral in a hairline square. Four literal class strings;
 * `bg-chip-${tint}` would emit no CSS at all. */
const ORDER = ["clay", "violet", "pine", "stone"] as const;
const tintAt = (i: number) => ORDER[i % ORDER.length]!;

const TINT_TILE = {
  clay: "border-transparent bg-chip-clay text-chip-clay-fg",
  violet: "border-transparent bg-chip-violet text-chip-violet-fg",
  pine: "border-transparent bg-chip-pine text-chip-pine-fg",
  // The quiet member reads by its EDGE: on a white cell its fill is 1.29:1, and
  // a fourth hue would be a colour nobody can name. The other three need no line.
  stone: "border-line bg-chip-stone text-chip-stone-fg",
} as const;

const ICON = {
  pto: <ClipboardList aria-hidden="true" strokeWidth={1.6} />,
  foreman: <Smartphone aria-hidden="true" strokeWidth={1.6} />,
  owner: <Building2 aria-hidden="true" strokeWidth={1.6} />,
  supervision: <ShieldCheck aria-hidden="true" strokeWidth={1.6} />,
} as const;

/** `h1` on the page the block opens (DEV-025), `h2` anywhere else. */
export function Roles({ heading = "h2" }: { heading?: "h1" | "h2" }) {
  const r = landingContent.roles;
  return (
    <section id="roles" tabIndex={-1} className="scroll-mt-20 landing-inset py-20 md:py-28">
      <div>
        <SectionHead as={heading} eyebrow={r.eyebrow} title={r.title} titleAccent={r.titleAccent} lead={r.lead} />
        {/* On /roles the grid is in the first fold, so it enters on load, not on view — see `FeatureGrid`'s `stagger`. */}
        <FeatureGrid columns={4} stagger={heading === "h1" ? "load" : true}>
          {r.cells.map((cell, i) => (
            <StaggerItem key={cell.id} y={20} size="stately" className="grid [transform-style:preserve-3d]">
              <FeatureCell
                icon={ICON[cell.id as keyof typeof ICON]}
                iconClassName={TINT_TILE[tintAt(i)]}
                title={cell.title}
                titleAs={heading === "h1" ? "h2" : "h3"}
                subtitle={cell.subtitle}
                footer={cell.gets.map((g) => <span key={g}><span className="text-ink-muted">→ </span>{g}</span>)}
              >
                {cell.pain}
              </FeatureCell>
            </StaggerItem>
          ))}
        </FeatureGrid>
        {/* What each role is asked for, in one line — the hero's facts until
          * DEV-025, the owner's first because he is the one who signs. */}
        <Reveal size="stately">
          <ul data-role-facts="" className="mt-8 grid gap-x-6 gap-y-4 border-t border-line pt-6 text-data text-ink-muted md:grid-cols-2 wide:grid-cols-4 wide:gap-x-0">
            {r.facts.map((f) => (
              <li key={f.value} className="wide:px-6"><b className="block font-medium text-ink">{f.value}</b>{f.label}</li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
