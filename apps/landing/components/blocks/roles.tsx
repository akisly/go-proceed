import { Building2, ClipboardList, ShieldCheck, Smartphone } from "lucide-react";
import { FeatureCell, FeatureGrid } from "@goproceed/ui/components";
import { Reveal, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionHead } from "./section-head";

const ICON = {
  pto: <ClipboardList aria-hidden="true" strokeWidth={1.6} />,
  foreman: <Smartphone aria-hidden="true" strokeWidth={1.6} />,
  owner: <Building2 aria-hidden="true" strokeWidth={1.6} />,
  supervision: <ShieldCheck aria-hidden="true" strokeWidth={1.6} />,
} as const;

/** `h1` on the page the block opens (DEV-022), `h2` anywhere else. */
export function Roles({ heading = "h2" }: { heading?: "h1" | "h2" }) {
  const r = landingContent.roles;
  return (
    <section id="roles" tabIndex={-1} className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead as={heading} eyebrow={r.eyebrow} title={r.title} titleAccent={r.titleAccent} lead={r.lead} />
        <FeatureGrid columns={4} stagger>
          {r.cells.map((cell) => (
            <StaggerItem key={cell.id} y={20} size="stately" className="grid [transform-style:preserve-3d]">
              <FeatureCell
                icon={ICON[cell.id as keyof typeof ICON]}
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
          * DEV-022, the owner's first because he is the one who signs. */}
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
