import { demoRecords } from "../../content/demo-records";

export function ChannelWeb() {
  return (
    <div className="grid w-full gap-1.5 rounded-panel border border-line-strong bg-surface p-2.5 text-micro text-ink-secondary shadow-float">
      <span className="flex gap-1">{[0, 1, 2].map((i) => <i key={i} className="size-1.5 rounded-pill bg-line-strong" />)}</span>
      {demoRecords.channels.web.map((r) => (
        <span key={r.left} className="flex justify-between rounded-field border border-line px-2 py-1.5"><span>{r.left}</span><b className="font-medium text-ink">{r.right}</b></span>
      ))}
    </div>
  );
}
