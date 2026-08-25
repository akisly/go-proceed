import { Check } from "lucide-react";
import type { JourneyChapter } from "../../content/landing-content";

const railNodes = [
  { id: "R-041", label: "Вимога" },
  { id: "EV-0248", label: "Доказ" },
  { id: "DR-0091", label: "Рішення" },
  { id: "CL-017", label: "Закриття" },
] as const;

const activeIndex: Record<JourneyChapter["id"], number> = {
  requirement: 0,
  capture: 1,
  decision: 3,
};

export function EvidenceRail({ active }: { active: JourneyChapter["id"] }) {
  const currentIndex = activeIndex[active];

  return (
    <div
      data-evidence-rail="true"
      role="img"
      aria-label="Маршрут доказу: R-041, EV-0248, DR-0091, CL-017"
      className="bg-surface px-4 py-4 md:px-6"
    >
      <ol className="grid grid-cols-4">
        {railNodes.map((node, index) => {
          const isCurrent = index === currentIndex;
          const isComplete = index < currentIndex;

          return (
            <li key={node.id} className="relative min-w-0 text-center">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-3.5 h-px w-full transition-colors duration-slow motion-reduce:transition-none ${
                    index <= currentIndex ? "bg-ink" : "bg-line-strong"
                  }`}
                />
              )}
              <span
                aria-hidden="true"
                className={`relative mx-auto grid size-7 place-items-center rounded-pill border text-micro font-semibold transition-colors duration-slow motion-reduce:transition-none ${
                  isCurrent
                    ? "border-action-signal bg-action-signal text-action-signal-fg"
                    : isComplete
                      ? "border-ink bg-ink text-on-inverse"
                      : "border-line-strong bg-surface text-ink-muted"
                }`}
              >
                {isComplete ? <Check className="size-3.5" strokeWidth={2} /> : index + 1}
              </span>
              <span className={`index-label mt-2 block truncate ${isCurrent ? "text-ink" : "text-ink-muted"}`}>
                {node.id}
              </span>
              <span className="mt-1 hidden text-micro text-ink-muted sm:block">{node.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
