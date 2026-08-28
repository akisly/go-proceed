"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { JourneyChapter } from "../../content/landing-content";

const railNodes = [
  { chapter: "requirement", code: "R-041", label: "Вимога" },
  { chapter: "capture", code: "EV-0248", label: "Доказ" },
  { chapter: "decision", code: "DR-0091", label: "Рішення → CL-017" },
] as const;

const easeEnter = [0.165, 0.84, 0.44, 1] as const;
const easeOut = [0.25, 0.46, 0.45, 0.94] as const;

export function EvidenceRail({ active }: { active: JourneyChapter["id"] }) {
  const currentIndex = railNodes.findIndex((node) => node.chapter === active);

  return (
    <div
      data-evidence-rail="true"
      data-evidence-rail-motion="motion"
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
                  <motion.span
                    className="absolute inset-0 origin-left bg-ink"
                    initial={false}
                    animate={{
                      scaleX: index <= currentIndex ? 1 : 0,
                    }}
                    transition={{
                      duration: 0.4,
                      ease: easeEnter,
                    }}
                  />
                </span>
              )}
              <motion.span
                aria-hidden="true"
                data-evidence-point-marker="true"
                className="relative z-10 mx-auto grid size-7 place-items-center rounded-pill border text-micro font-semibold"
                initial={false}
                animate={{
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
                transition={{
                  backgroundColor: { duration: 0.24, ease: easeOut },
                  borderColor: { duration: 0.24, ease: easeOut },
                  color: { duration: 0.24, ease: easeOut },
                  scale: { type: "spring", duration: 0.42, bounce: 0.12 },
                }}
              >
                <AnimatePresence initial={false} mode="wait">
                  <motion.span
                    key={isComplete ? "complete" : "index"}
                    className="grid place-items-center"
                    initial={{ opacity: 0, scale: 0.86 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.18, ease: easeOut }}
                  >
                    {isComplete ? <Check className="size-3.5" strokeWidth={2} /> : index + 1}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
              <motion.span
                className="index-label mt-2 block truncate"
                initial={false}
                animate={{
                  color: isCurrent ? "var(--color-ink)" : "var(--color-ink-muted)",
                }}
                transition={{ duration: 0.24, ease: easeOut }}
              >
                {node.code}
              </motion.span>
              <span className="mt-1 hidden text-micro text-ink-muted sm:block">{node.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
