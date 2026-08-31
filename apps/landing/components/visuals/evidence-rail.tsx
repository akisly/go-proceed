"use client";

import { Check } from "lucide-react";
import { CrossFade, NodeLock, TrackFill } from "@goproceed/ui/motion";
import type { JourneyChapter } from "../../content/landing-content";

const railNodes = [
  { chapter: "requirement", code: "R-041", label: "Вимога" },
  { chapter: "capture", code: "EV-0248", label: "Доказ" },
  { chapter: "decision", code: "DR-0091", label: "Рішення → CL-017" },
] as const;

/**
 * BOTH CSS TRANSITIONS BELOW NAME `ease-out`, and they have to name it.
 *
 * A `transition-*` with a `duration-*` and no `ease-*` does not fall back to
 * nothing — Tailwind resolves it to `--default-transition-timing-function`,
 * `cubic-bezier(.4, 0, .2, 1)`, which is the ease-in-out family that
 * `motion-audit` rule 3 fails BY NAME when a file writes it out. Arriving via a
 * default made it invisible to the audit and to the contract test both, so the
 * only reader who could have caught it was one who knew Tailwind's default by
 * heart. The rail these replaced used `ease.out`; `.ease-out { --tw-ease:
 * var(--gp-ease-out) }` is in the emitted CSS.
 */
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

          const markerTone = isCurrent
            ? "bg-action-signal border-action-signal text-action-signal-fg"
            : isComplete
              ? "bg-ink border-ink text-on-inverse"
              : "bg-surface border-line-strong text-ink-muted";
          const indexLabelTone = isCurrent ? "text-ink" : "text-ink-muted";

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
                    className="absolute inset-0 bg-ink"
                  />
                </span>
              )}
              <NodeLock index={index}>
                <span
                  aria-hidden="true"
                  data-evidence-point-marker="true"
                  className={`relative z-10 mx-auto grid size-7 place-items-center overflow-hidden rounded-pill border text-micro font-semibold transition-[background-color,border-color,color,scale] duration-fast ease-out ${markerTone}`}
                  style={{ scale: isCurrent ? 1.08 : 1 }}
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
                className={`index-label mt-2 block truncate transition-colors duration-fast ease-out ${indexLabelTone}`}
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
