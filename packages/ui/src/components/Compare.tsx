import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { cx } from "./cn";

/**
 * The row keys are a CLOSED set, and the reason lives in `base.css`: the
 * «було / стало» pairing is five hand-written `:has()` selectors naming these
 * five keys, not JavaScript. A sixth key would compile, render, typecheck and
 * pass the render gate while silently doing nothing, so the union is exported
 * and a new row has to fail typecheck here and send the reader to `base.css`.
 */
export type CompareRowKey = "photo" | "requirement" | "decision" | "closure" | "act";

export type CompareRow = { key: CompareRowKey; question: string; answer: string; ref?: string | undefined };

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
  /**
   * [2026-09-06] The «now» card takes `shadow-float-accent` — the prototype's
   * cobalt shadow (l.607) and the system's one coloured shadow.
   */
  now: "border-line-accent bg-surface shadow-float-accent md:-translate-y-3",
} as const;

function Row({ row, now, pop }: { row: CompareRow; now: boolean; pop: boolean }) {
  return (
    <li
      data-compare-row={row.key}
      className="grid min-h-24 grid-cols-[20px_1fr] gap-3 border-t border-line px-5 py-3.5 transition-colors duration-fast ease-out first:border-t-0"
    >
      {now ? (pop ? <StaggerItem from="scale" className="mt-0.5 grid size-5"><span className="grid size-5 place-items-center rounded-pill border border-status-ready-fg text-status-ready-fg"><Check aria-hidden="true" strokeWidth={2} className="size-3" /></span></StaggerItem> : <span className="mt-0.5 grid size-5 place-items-center rounded-pill border border-status-ready-fg text-status-ready-fg"><Check aria-hidden="true" strokeWidth={2} className="size-3" /></span>) : <span aria-hidden="true" className="mt-0.5 size-5 rounded-pill border border-line-strong bg-[linear-gradient(135deg,transparent_44%,var(--gp-border-strong)_44%_56%,transparent_56%)]" />}
      <div>
        <p className={cx("text-data font-semibold", now ? "text-ink" : "text-ink-secondary")}>{row.question}</p>
        <p className={cx("text-data leading-relaxed", now ? "text-ink-secondary" : "text-ink-muted")}>{row.answer}</p>
        {row.ref && <p className="mt-0.5 font-mono text-meta text-status-review-fg">{row.ref}</p>}
      </div>
    </li>
  );
}

export function CompareCard({
  tone, eyebrow, title, rows, outcome, className, animateChecks,
}: {
  tone: keyof typeof TONE;
  eyebrow: string;
  title: string;
  rows: CompareRow[];
  outcome: string;
  className?: string | undefined;
  /**
   * The landing wraps the check marks in a `Stagger step="loose" delay={0.35}`
   * so they pop in turn once the card is in view (prototype l.1168); off by
   * default, so the server-rendered card stays static in tests and in the app.
   *
   * The `Stagger` and each check's `StaggerItem` are real boxes (`grid`), not
   * `display:contents` — a boxless element never gets an `IntersectionObserver`
   * callback in Chromium, so `whileInView` would never fire and the checks
   * would sit at their hidden opacity forever (confirmed against the live
   * page, 2026-09-06). The `Stagger` becomes the article's middle `1fr` row
   * (a `grid` div holding the `<ul>`, which fills it — same layout), and each
   * check's `StaggerItem` owns the 20px column box the check itself used to
   * carry, so the check `<span>` is content inside a real wrapper instead of
   * an animated element with no box of its own.
   */
  animateChecks?: boolean | undefined;
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
      {animateChecks && now ? (
        <Stagger step="loose" delay={0.35} className="grid">
          <ul>{rows.map((row) => <Row key={row.key} row={row} now={now} pop />)}</ul>
        </Stagger>
      ) : (
        <ul>{rows.map((row) => <Row key={row.key} row={row} now={now} pop={false} />)}</ul>
      )}
      <footer className={cx("flex min-h-[74px] items-center border-t border-line px-5 py-4 text-data font-medium",
        now ? "bg-status-ready text-status-ready-fg" : "bg-sunken text-ink-muted")}>
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
