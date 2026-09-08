import { demoRecords } from "../../content/demo-records";
import { UiWindow } from "./ui-window";

export function UiAct() {
  const a = demoRecords.route.act;
  return (
    <UiWindow title={a.title} tag={a.tag}>
      <div className="relative rounded-panel border border-line bg-canvas px-4 py-4 text-data">
        <span aria-hidden="true" className="absolute right-4 top-3 rotate-[4deg] rounded-control border-[1.5px] border-status-attention-fg bg-surface px-2 py-0.5 font-mono text-micro tracking-[0.12em] text-status-attention-fg">{a.stamp}</span>
        {/* Not a heading: this is the title INSIDE a picture of a screen, and
          * putting it in the document outline made a reader navigating by
          * heading hear level 5 under a level 3 with nothing in between. */}
        <b className="mb-2.5 block text-body font-semibold text-ink">{a.heading}</b>
        {a.rows.map((row) => (
          <p key={row.label} className="grid grid-cols-[110px_1fr] gap-2.5 border-t border-dashed border-line-strong py-1.5 text-ink-secondary">
            <span>{row.label}</span><b className="font-medium text-ink">{row.value}</b>
          </p>
        ))}
      </div>
    </UiWindow>
  );
}
