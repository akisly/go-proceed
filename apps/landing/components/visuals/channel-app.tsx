import { Chip } from "@goproceed/ui/components";
import { demoRecords } from "../../content/demo-records";

export function ChannelApp() {
  const a = demoRecords.channels.app;
  return (
    <div className="relative w-[min(150px,60%)] rounded-section bg-inverse p-1.5" style={{ aspectRatio: "9 / 16" }}>
      <div className="grid h-full content-start gap-1.5 rounded-surface bg-canvas px-2 pb-2 pt-5 text-micro text-ink-muted">
        <span>{a.header}</span>
        {a.rows.map((r) => <span key={r.title} className="rounded-field border border-line bg-surface px-1.5 py-1"><b className="block font-medium text-ink">{r.title}</b>{r.text}</span>)}
      </div>
      <span className="absolute inset-0 grid place-items-center rounded-section"><Chip tone="review" className="border-transparent bg-action text-action-fg">пілот</Chip></span>
    </div>
  );
}
