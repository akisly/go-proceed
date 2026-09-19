import { Check } from "lucide-react";
import { demoRecords } from "../../content/demo-records";

/**
 * The small floating widgets of the reference's cards (DEV-023), drawn from the
 * same demonstration records the large UI windows use — no string is written
 * here. Each is a picture of a product moment, labelled for assistive
 * technology by the card's caption, so the widgets themselves are `aria-hidden`.
 */
const SHEET = "rounded-surface border border-line-strong bg-surface shadow-float";

/** The records of one work as a menu, fading toward its foot — the intro's card. */
export function MiniMenu() {
  const rows = demoRecords.route.act.rows;
  return (
    <div aria-hidden="true" className={`${SHEET} landing-fade-foot w-[240px] p-3 text-data`}>
      {rows.map((row, i) => (
        <p key={row.label} className={i === 0 ? "grid gap-0.5 px-2 py-2" : "grid gap-0.5 border-t border-line px-2 py-2"}>
          <span className="text-meta text-ink-muted">{row.label}</span>
          <b className="truncate font-medium text-ink">{row.value}</b>
        </p>
      ))}
    </div>
  );
}

/** The foreman's moment: the time, the requirement, the frame to take. */
export function MiniCapture() {
  const p = demoRecords.route.capture.phone;
  return (
    <div aria-hidden="true" className="flex items-center gap-4">
      <div className={`${SHEET} w-[230px] p-4`}>
        <p className="font-mono text-meta text-ink-muted">{demoRecords.route.capture.tag}</p>
        <p className="mt-1 text-data font-semibold text-ink">{p.requirement}</p>
        <p className="mt-1.5 text-data leading-relaxed text-ink-secondary">{p.shot}</p>
      </div>
      <span className="grid gap-1.5">
        <i className="block h-0.5 w-8 rounded-pill bg-line-strong" /><i className="block h-0.5 w-12 rounded-pill bg-ink-muted" /><i className="block h-0.5 w-10 rounded-pill bg-line-strong" />
      </span>
    </div>
  );
}

/** The supervisor's moment: one decision on top of the sheets it answers. */
export function MiniReview() {
  const r = demoRecords.route.review;
  return (
    <div aria-hidden="true" className={`${SHEET} w-[280px] p-2.5`}>
      <div className="relative">
        <div className="relative z-20 rounded-panel border border-line bg-subtle px-3.5 py-2.5">
          <p className="text-data font-medium text-ink">{r.decision}</p>
          <p className="mt-0.5 text-meta text-ink-muted">{r.rows[1]?.value}</p>
        </div>
        <i className="relative z-10 mx-2 -mt-1 block h-3 rounded-b-panel border border-t-0 border-line bg-subtle" />
        <i className="mx-4 -mt-px block h-2.5 rounded-b-panel border border-t-0 border-line bg-subtle" />
      </div>
      <p className="mt-2.5 flex items-center gap-2 px-1 text-data text-ink-secondary">
        <span className="grid size-5 place-items-center rounded-pill bg-action text-micro font-semibold text-action-fg">1</span>{r.tag}
      </p>
    </div>
  );
}

/** The office's moment: the act's five facts, each already recorded. */
export function MiniAct() {
  const a = demoRecords.route.act;
  return (
    <div aria-hidden="true" className="grid w-[220px] gap-1.5">
      <div className={`${SHEET} p-1.5`}>
        {a.rows.map((row) => (
          <p key={row.label} className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-data text-ink">
            {row.label}<Check className="size-3.5 text-ink-muted" strokeWidth={2} />
          </p>
        ))}
      </div>
      <p className={`${SHEET} flex items-center justify-between px-3.5 py-2.5 text-data font-medium text-ink`}>
        {a.tag}<span className="rounded-control border border-status-attention-line px-1.5 py-0.5 font-mono text-micro tracking-wide text-status-attention-fg">{a.stamp}</span>
      </p>
    </div>
  );
}
