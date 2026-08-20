import { PinnedTabs, type PinnedTab } from "@goproceed/ui/motion";
import { landingContent, type TourChapter } from "../../content/landing-content";
import { ActPanel, CapturePanel, RequirementPanel, ReviewPanel } from "../mock-panels";
import { SectionShell } from "../section-shell";

const visuals = {
  requirements: <RequirementPanel />,
  capture: <CapturePanel />,
  review: <ReviewPanel />,
  act: <ActPanel />,
} as const;

const tabs: PinnedTab[] = landingContent.tour.map((chapter) => ({
  id: chapter.id,
  label: chapter.label,
  hint: chapter.hint,
  panel: <TourPanel chapter={chapter}>{visuals[chapter.id as keyof typeof visuals]}</TourPanel>,
}));

export function ProductTour() {
  return (
    <SectionShell
      eyebrow="Продуктовий контур"
      title="Від правила до документа без розриву історії"
      lead="Чотири робочі поверхні показують той самий факт у потрібному контексті для кожного учасника."
      className="bg-canvas"
    >
      <PinnedTabs tabs={tabs} />
    </SectionShell>
  );
}

function TourPanel({ chapter, children }: { chapter: TourChapter; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-8 py-4 wide:min-h-[460px] wide:grid-cols-[0.72fr_1.28fr]">
      <div>
        <p className="index-label text-ink-muted">{chapter.label} · {chapter.hint}</p>
        <h3 className="display mt-4 max-w-[17ch] text-mkt-display-3 text-ink">{chapter.title}</h3>
        <p className="mt-5 max-w-[46ch] text-body leading-relaxed text-ink-muted">{chapter.lead}</p>
        <ul className="mt-7 space-y-3">
          {chapter.points.map((point) => (
            <li key={point} className="flex items-center gap-3 text-data font-medium text-ink">
              <span aria-hidden="true" className="size-1.5 rounded-pill bg-action-signal" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
