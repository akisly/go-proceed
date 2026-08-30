"use client";

import { Check } from "lucide-react";
import { CrossFade, NodeLock, TrackFill } from "@goproceed/ui/motion";
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
      data-evidence-rail-motion="vocabulary"
      data-evidence-active={active}
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
                  className="absolute right-1/2 top-3.5 z-0 h-px w-full overflow-hidden bg-line-strong"
                >
                  <TrackFill
                    filled={index <= currentIndex}
                    className="absolute inset-0 origin-left bg-ink"
                  />
                </span>
              )}
              <NodeLock index={index}>
                <span
                  aria-hidden="true"
                  data-evidence-point-marker="true"
                  className="relative z-10 mx-auto grid size-7 place-items-center rounded-pill border text-micro font-semibold"
                  style={{
                    backgroundColor: isCurrent
                      ? "var(--color-action-signal)"
                      : isComplete
                        ? "var(--color-ink)"
                        : "var(--color-surface)",
                    borderColor: isCurrent
                      ? "var(--color-action-signal)"
                      : isComplete
                        ? "var(--color-ink)"
                        : "var(--color-line-strong)",
                    color: isCurrent
                      ? "var(--color-action-signal-fg)"
                      : isComplete
                        ? "var(--color-on-inverse)"
                        : "var(--color-ink-muted)",
                    scale: isCurrent ? 1.08 : 1,
                  }}
                >
                  <CrossFade
                    activeKey={isComplete ? "done" : "pending"}
                    className="grid place-items-center"
                  >
                    {isComplete ? <Check className="size-3.5" strokeWidth={2} /> : index + 1}
                  </CrossFade>
                </span>
              </NodeLock>
              <span
                className="index-label mt-2 block truncate"
                style={{ color: isCurrent ? "var(--color-ink)" : "var(--color-ink-muted)" }}
              >
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
