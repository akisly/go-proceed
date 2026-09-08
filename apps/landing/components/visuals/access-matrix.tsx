import { landingContent, type AccessLevel } from "../../content/landing-content";

const DOT: Record<AccessLevel, string> = {
  full: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-status-ready-fg bg-status-ready-fg",
  own: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-status-ready-fg bg-[linear-gradient(90deg,var(--gp-status-ready-fg)_50%,transparent_50%)]",
  none: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-line-strong",
};

/**
 * `overflow-wrap: anywhere` used to sit here so a long role name could not
 * overflow its column. It stopped the overflow by breaking the word instead:
 * «ТЕХНАГЛЯД» rendered as «ТЕХНАГЛЯ» / «Д», with the first line clipped by the
 * cell's own box — in the block whose whole job is to look authoritative. The
 * columns are wider now and the type is on the token scale, so the names fit;
 * `hyphens: manual` keeps any future name breaking only where the copy puts a
 * soft hyphen.
 */
const HEAD = "whitespace-nowrap pb-3 text-center align-bottom font-mono text-micro font-normal uppercase leading-tight tracking-tight text-ink-muted";

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
      {/* The table scrolls rather than compresses.
        *
        * Four role names have to fit at 11px mono, and between `md` and `wide`
        * the Bento puts this cell in a two-column grid where the columns fall
        * to about 30px — narrower than «ТЕХНАГЛЯД» renders. The old answer was
        * `overflow-wrap: anywhere`, which stopped the overflow by breaking the
        * word mid-syllable and clipping the first half. The rule the design
        * procedure actually gives for wide content is this one: a minimum width
        * the content is legible at, inside its own horizontal scroller. */}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[26rem] table-fixed border-collapse">
        <caption className="sr-only">{a.title}</caption>
        <colgroup>
          <col className="w-[30%]" />
          {a.columns.map((c) => <col key={c} className="w-[17.5%]" />)}
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
      </div>
      {/* The legend stays outside the scroller — it is the key to the table, not
        * part of it, and it must not slide away from the dots it explains. */}
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
