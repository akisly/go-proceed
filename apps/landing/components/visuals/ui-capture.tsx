import Image from "next/image";
import { demoRecords } from "../../content/demo-records";
import photoThumb from "../../public/images/photo-tray-thumb.jpg";
import { KeyValue, UiWindow } from "./ui-window";

export function UiCapture() {
  const c = demoRecords.route.capture;
  return (
    <UiWindow title={c.title} tag={c.tag}>
      <div className="grid gap-5 md:grid-cols-[200px_1fr] md:items-start">
        <div className="mx-auto w-full max-w-[200px] rounded-section bg-inverse p-2 shadow-float" style={{ aspectRatio: "9 / 17" }}>
          <div className="grid h-full content-start gap-1.5 rounded-surface bg-canvas px-2.5 pb-2.5 pt-6 text-micro text-ink-secondary">
            <span className="text-meta font-semibold text-ink">{c.phone.work}</span>
            <span className="grid gap-0.5 rounded-field border border-line bg-surface px-2 py-1.5"><span>{c.phone.requirementLabel}</span><b className="font-medium text-ink">{c.phone.requirement}</b></span>
            <span className="landing-photo grid h-[86px] items-end p-1.5"><Image src={photoThumb} alt="" fill sizes="200px" className="object-cover" /><span className="relative z-10 text-surface">{c.phone.shot}</span></span>
            <span className="rounded-panel bg-action py-1.5 text-center font-medium text-action-fg">{c.phone.action}</span>
          </div>
        </div>
        <div>{c.rows.map((row, i) => <KeyValue key={row.label} label={row.label} value={row.value} first={i === 0} />)}</div>
      </div>
    </UiWindow>
  );
}
