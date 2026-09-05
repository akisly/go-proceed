"use client";

import { ChevronDown } from "lucide-react";
import { Accordion as RadixAccordion } from "radix-ui";
import { cx } from "./cn";

export type AccordionEntry = { id: string; question: string; answer: string };

/**
 * The FAQ disclosure. Radix, because the keyboard contract (arrow keys, Home,
 * End, the trigger/panel `aria-controls` pair) is exactly the kind of thing
 * that is cheap to get 90% right and expensive to get wrong.
 *
 * WHY THE HEIGHT ANIMATION IS ALLOWED HERE AND NOWHERE ELSE
 * ---------------------------------------------------------
 * §8.2 forbids animating layout properties. This animates
 * `grid-template-rows: 0fr -> 1fr`, which is a grid track and not a `height` —
 * no measurement, no `height: auto` hack, and the browser composites it the
 * same way it composites a transform. A `height` transition on an accordion
 * needs the panel's measured height in a CSS variable, which means reading
 * layout on every open, which is the jank the rule exists to prevent.
 *
 * `type="single" collapsible` — one answer open at a time. This is a FAQ, not
 * a checklist: two open answers means the reader lost the one they came for.
 */
export function Accordion({
  entries, className, marker = "chevron",
}: {
  entries: AccordionEntry[];
  className?: string | undefined;
  /** `plus` — the landing's circled plus that fills with ink when open. */
  marker?: "chevron" | "plus" | undefined;
}) {
  return (
    <RadixAccordion.Root type="single" collapsible className={cx("w-full", className)}>
      {entries.map((entry) => (
        <RadixAccordion.Item key={entry.id} value={entry.id} className="border-b border-line">
          <RadixAccordion.Header>
            <RadixAccordion.Trigger
              className={cx(
                "group flex w-full items-center justify-between gap-5 py-5 text-left",
                "text-body font-medium text-ink transition-colors duration-fast ease-out",
                "hover:text-ink-secondary",
              )}
            >
              {entry.question}
              {marker === "plus" ? (
                <span
                  aria-hidden="true"
                  data-accordion-marker="plus"
                  className={cx(
                    "relative grid size-(--gp-control-height-desk-sm) shrink-0 place-items-center rounded-pill border border-line-strong",
                    "transition-colors duration-base ease-out group-data-[state=open]:border-action group-data-[state=open]:bg-action",
                  )}
                >
                  <i className="absolute h-px w-2.5 bg-ink transition-colors duration-base ease-out group-data-[state=open]:bg-action-fg" />
                  <i className="absolute h-2.5 w-px bg-ink transition-[transform,background-color] duration-base ease-out group-data-[state=open]:rotate-90 group-data-[state=open]:bg-action-fg" />
                </span>
              ) : (
                <ChevronDown
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 shrink-0 text-ink-muted transition-transform duration-base ease-out group-data-[state=open]:rotate-180"
                />
              )}
            </RadixAccordion.Trigger>
          </RadixAccordion.Header>
          <RadixAccordion.Content
            className={cx(
              "grid grid-rows-[0fr] overflow-hidden transition-[grid-template-rows]",
              "duration-base ease-out data-[state=open]:grid-rows-[1fr]",
              "motion-reduce:transition-none",
            )}
          >
            <div className="min-h-0">
              <p className="measure pb-5 text-body leading-relaxed text-ink-secondary">{entry.answer}</p>
            </div>
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
