import { Check } from "lucide-react";
import type { JourneyChapter } from "../../content/landing-content";

const railNodes = [
  { chapter: "requirement", code: "R-041", label: "Вимога" },
  { chapter: "capture", code: "EV-0248", label: "Доказ" },
  { chapter: "decision", code: "DR-0091", label: "Рішення → CL-017" },
] as const;

export function EvidenceRail({ active }: { active: JourneyChapter["id"] }) {
  const currentIndex = railNodes.findIndex((node) => node.chapter === active);

  return (
    <div
      data-evidence-rail="true"
      role="img"
      aria-label="Маршрут доказу: R-041, EV-0248, DR-0091, CL-017"
      className="bg-surface px-4 py-4 md:px-6"
    >
      <ol className="grid grid-cols-3">
        {railNodes.map((node, index) => {
          const isCurrent = index === currentIndex;
          const isComplete = index < currentIndex;

          return (
            <li
              key={node.chapter}
              className="relative min-w-0 text-center"
              data-evidence-point="true"
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  data-evidence-connector="true"
                  className={`absolute right-1/2 top-3.5 z-0 h-px w-full transition-colors duration-slow motion-reduce:transition-none ${
                    index <= currentIndex ? "bg-ink" : "bg-line-strong"
                  }`}
                />
              )}
              <span
                aria-hidden="true"
                data-evidence-point-marker="true"
                className={`relative z-10 mx-auto grid size-7 place-items-center rounded-pill border text-micro font-semibold transition-colors duration-slow motion-reduce:transition-none ${
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
                {node.code}
              </span>
              <span className="mt-1 hidden text-micro text-ink-muted sm:block">{node.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
