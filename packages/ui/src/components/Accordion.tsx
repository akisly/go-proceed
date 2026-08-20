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
  entries, className,
}: {
  entries: AccordionEntry[];
  className?: string | undefined;
}) {
  return (
    <RadixAccordion.Root type="single" collapsible className={cx("w-full", className)}>
      {entries.map((entry) => (
        <RadixAccordion.Item key={entry.id} value={entry.id} className="border-b border-line">
          <RadixAccordion.Header>
            <RadixAccordion.Trigger
              className={cx(
                "group flex w-full items-center justify-between gap-4 py-4 text-left",
                "text-body font-medium text-ink transition-colors duration-fast ease-out",
                "hover:text-ink-secondary",
              )}
            >
              {entry.question}
              <ChevronDown
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4 shrink-0 text-ink-muted transition-transform duration-base ease-out group-data-[state=open]:rotate-180"
              />
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
              <p className="measure pb-4 text-data text-ink-muted">{entry.answer}</p>
            </div>
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
