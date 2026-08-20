"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { DURATION, EASE } from "./tokens";
import { useReduced } from "./use-reduced";

export type PinnedTab = {
  id: string;
  label: string;
  hint: string;
  panel: ReactNode;
};

type PinnedTabsProps = { tabs: PinnedTab[]; className?: string | undefined };

const AUTO_ADVANCE_SECONDS = 6;

/**
 * A timed product tour with direct tab control.
 *
 * The active tab advances after a readable interval while its baseline fills
 * from left to right. Any manual selection restarts that interval. Readers can
 * pause the rotation, and reduced-motion preferences disable auto-advance
 * entirely while preserving the same clickable tab interface.
 */
export function PinnedTabs({ tabs, className }: PinnedTabsProps) {
  const reduced = useReduced();
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [auto, setAuto] = useState(true);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const autoRuns = auto && !reduced && tabs.length > 1;

  useEffect(() => {
    if (!autoRuns) return;

    const timeout = window.setTimeout(() => {
      setActive((current) => (current + 1) % tabs.length);
      setCycle((current) => current + 1);
    }, AUTO_ADVANCE_SECONDS * 1000);

    return () => window.clearTimeout(timeout);
  }, [active, autoRuns, cycle, tabs.length]);

  function selectTab(index: number): void {
    setActive(index);
    setCycle((current) => current + 1);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let next = index;

    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;

    event.preventDefault();
    selectTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div data-tour-mode="timed-tabs" className={className}>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          aria-pressed={!auto}
          aria-label={auto ? "Призупинити автоматичне перемикання" : "Увімкнути автоматичне перемикання"}
          onClick={() => {
            setAuto((current) => !current);
            setCycle((current) => current + 1);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line px-3 text-meta font-medium text-ink-muted transition-colors duration-fast ease-out hover:border-line-strong hover:text-ink"
        >
          <span aria-hidden="true" className="font-mono text-micro">{autoRuns ? "Ⅱ" : "▶"}</span>
          {autoRuns ? "Пауза" : "Авто"}
        </button>
      </div>

      <div role="tablist" aria-label="Продукт" className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        {tabs.map((tab, index) => {
          const selected = index === active;

          return (
            <button
              key={tab.id}
              ref={(element) => { tabRefs.current[index] = element; }}
              type="button"
              role="tab"
              id={`${tab.id}-tab`}
              aria-selected={selected}
              aria-controls={`${tab.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(index)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className="relative min-h-16 pb-4 text-left"
            >
              <span className={selected ? "text-data font-semibold text-ink" : "text-data font-medium text-ink-muted"}>
                {tab.label}
              </span>
              <span className="mt-1 block text-meta text-ink-subtle">{tab.hint}</span>
              <span className="absolute inset-x-0 bottom-0 h-px bg-line" aria-hidden="true" />
              {selected && (
                <motion.span
                  key={`${tab.id}-${cycle}-${autoRuns ? "auto" : "still"}`}
                  data-tour-progress="true"
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-action-signal"
                  initial={{ scaleX: autoRuns ? 0 : 1 }}
                  animate={{ scaleX: 1 }}
                  transition={autoRuns
                    ? { duration: AUTO_ADVANCE_SECONDS, ease: "linear" }
                    : { duration: DURATION.fast, ease: EASE.out }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8 min-h-[560px] wide:min-h-[620px]">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${tab.id}-panel`}
            aria-labelledby={`${tab.id}-tab`}
            hidden={index !== active}
          >
            <motion.div
              key={`${tab.id}-${cycle}`}
              initial={reduced ? { opacity: 1 } : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: DURATION.base, ease: EASE.soft }}
            >
              {tab.panel}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
