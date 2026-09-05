import { landingContent, type AccessLevel } from "../../content/landing-content";

const DOT: Record<AccessLevel, string> = {
  full: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-status-ready-fg bg-status-ready-fg",
  own: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-status-ready-fg bg-[linear-gradient(90deg,var(--gp-status-ready-fg)_50%,transparent_50%)]",
  none: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-line-strong",
};

const HEAD = "pb-3 text-center align-bottom font-mono text-[9.5px] font-normal uppercase leading-tight tracking-wide text-ink-muted [overflow-wrap:anywhere]";

/**
 * Who sees what — four roles across, seven surfaces down.
 *
 * A REAL TABLE, because the claim it makes is factual and it is made in two
 * dimensions. It was a grid of `<div>`s carrying the level on an `aria-label`
 * of a bare `<i>`, which is worse than no label at all: an `<i>` with no role
 * maps to ARIA `generic`, and `generic` PROHIBITS an accessible name — browsers
 * drop the attribute, so a screen reader read seven row labels and then fell
 * silent. `<th scope>` ties every dot to its role and its surface, and the
 * level itself is `sr-only` TEXT inside the cell, so «colour never alone» is
 * true of the accessibility tree and not only of the legend underneath.
 *
 * The layout stays native table layout on purpose. `display: grid` on a
 * `<table>` reads beautifully and destroys the very mapping this rewrite is
 * for — Chromium and Gecko both derive the table role from the layout object —
 * so the columns are sized with `<colgroup>` and `table-fixed` instead.
 *
 * The dots are `aria-hidden`: they are the visible half of a statement whose
 * spoken half sits beside them, and announcing both would say it all twice.
 */
export function AccessMatrix() {
  const a = landingContent.provenance.access;
  return (
    <div className="grid self-start text-data">
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{a.title}</caption>
        <colgroup>
          <col className="w-1/3" />
          {a.columns.map((c) => <col key={c} className="w-1/6" />)}
        </colgroup>
        <thead>
          <tr>
            <td />
            {a.columns.map((c) => <th key={c} scope="col" className={HEAD}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {a.rows.map((row) => (
            <tr key={row.label} className="border-t border-line">
              <th scope="row" className="py-3 pr-2 text-left font-normal text-ink-secondary">{row.label}</th>
              {row.cells.map((level, i) => (
                <td key={i} data-access={level} className="py-3 text-center">
                  <i aria-hidden="true" className={DOT[level]} />
                  <span className="sr-only">{a.legend[level]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex flex-wrap gap-3.5 pt-3 text-meta text-ink-muted">
        {(["full", "own", "none"] as const).map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className={DOT[l].replace("mx-auto ", "")} />{a.legend[l]}
          </span>
        ))}
      </p>
    </div>
  );
}
