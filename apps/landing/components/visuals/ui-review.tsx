import { demoRecords } from "../../content/demo-records";
import { KeyValue, UiWindow } from "./ui-window";

export function UiReview() {
  const r = demoRecords.route.review;
  return (
    <UiWindow title={r.title} tag={r.tag}>
      <div className="overflow-hidden rounded-card border border-line">
        <p className="flex items-center gap-2 bg-subtle px-3 py-2 font-mono text-micro text-ink-muted"><i className="size-2 rounded-pill bg-status-ready-fg" />{r.url}</p>
        <div className="grid gap-2.5 p-3.5">
          {r.rows.map((row, i) => <KeyValue key={row.label} label={row.label} value={row.value} first={i === 0} />)}
          <div className="flex flex-wrap gap-2">
            {r.actions.map((a) => (
              <span key={a.label} className={"active" in a && a.active ? "rounded-field bg-action px-3 py-1.5 text-data font-medium text-action-fg" : "rounded-field border border-line-strong px-3 py-1.5 text-data text-ink"}>{a.label}</span>
            ))}
          </div>
        </div>
      </div>
      <p className="text-data">{r.decision}</p>
    </UiWindow>
  );
}
