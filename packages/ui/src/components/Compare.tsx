import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cx } from "./cn";

export type CompareRow = { key: string; question: string; answer: string; ref?: string | undefined };

/**
 * «Було і стало» as two sheets — the prototype's ninth iteration. The same
 * questions in both cards, answered twice; a hovered row lights its twin in
 * the other card, and that pairing is CSS `:has()` on the pair container
 * (`base.css`), not JavaScript, so the cards stay server components.
 *
 * `was` is a dashed sheet on the subtle ground; `now` is a white sheet with
 * the accent edge, lifted 12px, on the float shadow — the prototype's
 * composition, in roles.
 */
export function ComparePair({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <div data-slot="compare-pair" className={cx("compare-pair grid items-stretch gap-0 md:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)]", className)}>
      {children}
    </div>
  );
}

const TONE = {
  was: "border-dashed border-line-strong bg-subtle",
  now: "border-line-accent bg-surface shadow-float md:-translate-y-3",
} as const;

export function CompareCard({
  tone, eyebrow, title, rows, outcome, className,
}: {
  tone: keyof typeof TONE;
  eyebrow: string;
  title: string;
  rows: CompareRow[];
  outcome: string;
  className?: string | undefined;
}) {
  const now = tone === "now";
  return (
    <article
      data-compare-tone={tone}
      className={cx("grid grid-rows-[auto_1fr_auto] overflow-hidden rounded-surface border", TONE[tone], now ? "order-3" : "order-1", className)}
    >
      <header className="grid gap-0.5 border-b border-line px-5 pb-3.5 pt-4">
        <p className={cx("index-label", now && "text-status-review-fg")}>{eyebrow}</p>
        <p className="text-body font-semibold text-ink">{title}</p>
      </header>
      <ul>
        {rows.map((row) => (
          <li
            key={row.key}
            data-compare-row={row.key}
            className="grid min-h-24 grid-cols-[20px_1fr] gap-3 border-t border-line px-5 py-3.5 transition-colors duration-fast ease-out first:border-t-0"
          >
            {now ? (
              <span className="mt-0.5 grid size-5 place-items-center rounded-pill border border-status-ready-fg text-status-ready-fg">
                <Check aria-hidden="true" strokeWidth={2} className="size-3" />
              </span>
            ) : (
              <span aria-hidden="true" className="mt-0.5 size-5 rounded-pill border border-line-strong bg-[linear-gradient(135deg,transparent_44%,var(--gp-border-strong)_44%_56%,transparent_56%)]" />
            )}
            <div>
              <p className={cx("text-data font-semibold", now ? "text-ink" : "text-ink-secondary")}>{row.question}</p>
              <p className={cx("text-data leading-relaxed", now ? "text-ink-secondary" : "text-ink-muted")}>{row.answer}</p>
              {row.ref && <p className="mt-0.5 font-mono text-meta text-status-review-fg">{row.ref}</p>}
            </div>
          </li>
        ))}
      </ul>
      <footer className={cx("flex min-h-[74px] items-center border-t border-line px-5 py-4 text-data font-medium",
        now ? "bg-status-ready text-status-ready-fg" : "bg-muted text-ink-muted")}>
        {outcome}
      </footer>
    </article>
  );
}

/**
 * The arrow between the two cards; rotates to point down when the pair
 * stacks. Sized off `control-height`, not a literal — `h-11`/`size-8` would
 * compile to the same 44px/32px today and stop tracking the token the moment
 * it moves, the same reasoning `Avatar` is built on.
 */
export function CompareArrow() {
  return (
    <div aria-hidden="true" className="order-2 grid h-(--gp-control-height-touch) place-items-center md:h-auto">
      <span className="grid size-(--gp-control-height-desk-sm) place-items-center rounded-pill border border-line-strong bg-surface text-ink rotate-90 md:rotate-0">→</span>
    </div>
  );
}
