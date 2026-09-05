import { landingContent, type AccessLevel } from "../../content/landing-content";

const DOT: Record<AccessLevel, string> = {
  full: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-status-ready-fg bg-status-ready-fg",
  own: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-status-ready-fg bg-[linear-gradient(90deg,var(--gp-status-ready-fg)_50%,transparent_50%)]",
  none: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-line-strong",
};

/** Who sees what — four roles across, seven surfaces down. Colour never alone: the legend names each dot and the cell carries its level as data. */
export function AccessMatrix() {
  const a = landingContent.provenance.access;
  return (
    <div className="grid self-start text-data">
      <div className="grid grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] items-center gap-1.5 pb-3">
        <span />
        {a.columns.map((c) => <span key={c} className="text-center font-mono text-[9.5px] uppercase leading-tight tracking-wide text-ink-muted [overflow-wrap:anywhere]">{c}</span>)}
      </div>
      {a.rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] items-center gap-1.5 border-t border-line py-3">
          <span className="text-ink-secondary">{row.label}</span>
          {row.cells.map((level, i) => <i key={i} data-access={level} aria-label={a.legend[level]} className={DOT[level]} />)}
        </div>
      ))}
      <p className="flex flex-wrap gap-3.5 pt-3 text-meta text-ink-muted">
        {(["full", "own", "none"] as const).map((l) => <span key={l} className="inline-flex items-center gap-1.5"><i className={DOT[l].replace("mx-auto ", "")} />{a.legend[l]}</span>)}
      </p>
    </div>
  );
}
