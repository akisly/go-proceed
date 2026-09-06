import { Building2, ClipboardList, ShieldCheck, Smartphone } from "lucide-react";
import { FeatureCell, FeatureGrid } from "@goproceed/ui/components";
import { StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionHead } from "./section-head";

const ICON = {
  pto: <ClipboardList aria-hidden="true" strokeWidth={1.6} />,
  foreman: <Smartphone aria-hidden="true" strokeWidth={1.6} />,
  owner: <Building2 aria-hidden="true" strokeWidth={1.6} />,
  supervision: <ShieldCheck aria-hidden="true" strokeWidth={1.6} />,
} as const;

export function Roles() {
  const r = landingContent.roles;
  return (
    <section id="roles" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={r.eyebrow} title={r.title} titleAccent={r.titleAccent} lead={r.lead} />
        <FeatureGrid columns={4} stagger>
          {r.cells.map((cell) => (
            <StaggerItem key={cell.id} y={20} className="grid [transform-style:preserve-3d]">
              <FeatureCell
                icon={ICON[cell.id as keyof typeof ICON]}
                title={cell.title}
                subtitle={cell.subtitle}
                footer={cell.gets.map((g) => <span key={g}><span className="text-ink-muted">→ </span>{g}</span>)}
              >
                {cell.pain}
              </FeatureCell>
            </StaggerItem>
          ))}
        </FeatureGrid>
      </div>
    </section>
  );
}
