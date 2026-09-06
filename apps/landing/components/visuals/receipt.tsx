import Image from "next/image";
import { demoRecords } from "../../content/demo-records";
import photoThumb from "../../public/images/photo-tray-thumb.jpg";

/** The EV-0248 receipt that floats over the board's corner. Demonstration data. */
export function Receipt() {
  const r = demoRecords.receipt;
  return (
    <aside aria-label="Квитанція доказу EV-0248" className="w-full rounded-card border border-line-strong bg-surface p-3.5 text-meta shadow-float">
      <p className="mb-2 flex justify-between font-mono text-micro uppercase tracking-wide text-ink-muted"><span>{r.code}</span><span>{r.when}</span></p>
      <figure className="landing-photo mb-2.5 h-24">
        <Image src={photoThumb} alt="" fill sizes="236px" className="object-cover" />
        <figcaption>{r.photoCaption}</figcaption>
      </figure>
      {r.rows.map((row) => (
        <p key={row.label} className="flex justify-between gap-2 border-t border-dashed border-line-strong py-1.5 text-ink-muted">
          <span>{row.label}</span>
          <b className={"tone" in row && row.tone === "review" ? "text-right font-medium text-status-review-fg" : "text-right font-medium text-ink"}>{row.value}</b>
        </p>
      ))}
    </aside>
  );
}
