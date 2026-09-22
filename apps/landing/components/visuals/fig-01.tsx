import Image from "next/image";
import { demoRecords } from "../../content/demo-records";
import { landingContent } from "../../content/landing-content";
import photoCard from "../../public/images/photo-tray-card.jpg";
import photoThumb from "../../public/images/photo-tray-thumb.jpg";
import photoWide from "../../public/images/photo-tray-wide.jpg";

/** The same frame twice: lost in the crew chat, then as record EV-0248. Static — the prototype's scrolling chat was retired. */
export function Fig01() {
  const f = landingContent.problem.figure;
  const { chat, record } = demoRecords.fig01;
  return (
    <figure className="overflow-hidden rounded-card border border-line-strong bg-surface">
      <figcaption className="flex justify-between gap-4 border-b border-line px-4 py-3 font-mono text-micro uppercase tracking-wide text-ink-muted">
        <span><b className="font-medium text-ink">{f.number}</b> · {f.title}</span><span>{f.note}</span>
      </figcaption>
      <div className="grid md:grid-cols-[minmax(0,0.95fr)_56px_minmax(0,1.05fr)]">
        <div className="flex h-[420px] flex-col border-b border-line bg-canvas md:h-auto md:min-h-[400px] md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-line bg-surface px-3.5 py-2.5 text-meta text-ink-muted">
            <b className="font-medium text-ink">{chat.title}</b><span>{chat.members}</span>
          </div>
          <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(180deg,transparent_0,#000_12%,#000_88%,transparent_100%)]">
            <ul className="absolute inset-x-0 top-0 grid gap-2 p-3">
              {chat.messages.map((m, i) => (
                <li key={i} data-message={"hit" in m && m.hit ? "hit" : "message"} className={"me" in m && m.me ? "grid max-w-[84%] justify-self-end gap-1 text-meta text-ink-secondary" : "grid max-w-[84%] gap-1 text-meta text-ink-secondary"}>
                  <span className="font-mono text-micro text-ink-muted">{m.who}</span>
                  <div className={"hit" in m && m.hit
                    ? "rounded-field border border-line-accent bg-surface px-2.5 py-1.5 ring-3 ring-accent-soft"
                    : "me" in m && m.me ? "rounded-field border border-line bg-subtle px-2.5 py-1.5" : "rounded-field border border-line bg-surface px-2.5 py-1.5"}>
                    {"photo" in m && m.photo && (
                      <span className="landing-photo mb-1.5 block h-[100px] w-[170px]">
                        <Image src={m.photo === "tray" ? photoThumb : photoCard} alt="" fill sizes="170px" className="object-cover" />
                      </span>
                    )}
                    {"text" in m && m.text}
                    {"missing" in m && m.missing && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {m.missing.map((x) => <i key={x} className="rounded-control bg-status-attention px-1.5 py-0.5 font-mono text-micro not-italic text-status-attention-fg">{x}</i>)}
                      </span>
                    )}
                    <span className="block text-right font-mono text-micro text-ink-muted">{m.time}</span>
                  </div>
                </li>
              ))}
            </ul>
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-line-accent opacity-40" />
          </div>
          <p className="flex items-center gap-2 border-t border-line bg-surface px-3.5 py-2.5 text-meta text-ink-muted">
            {chat.footer.lead} <b className="font-medium text-ink">{chat.footer.strong}</b> {chat.footer.tail}
          </p>
        </div>
        <div aria-hidden="true" className="grid h-12 place-items-center bg-subtle md:h-auto">
          <span className="grid size-6 place-items-center rounded-pill border border-line-strong bg-surface text-meta text-ink rotate-90 md:rotate-0">→</span>
        </div>
        <div className="grid content-start px-4 pb-4 pt-3.5">
          <p className="flex items-center justify-between border-b border-line pb-2.5 text-meta text-ink-muted">
            <b className="font-mono text-data font-medium text-ink">{record.code}</b><span>{record.state}</span>
          </p>
          <figure className="landing-photo my-3 h-[150px]">
            <Image src={photoWide} alt="Кабельний лоток над ВРУ-1 до закриття стелі" fill sizes="(min-width: 768px) 520px, 100vw" className="object-cover" />
            <figcaption>{record.photoCaption}</figcaption>
          </figure>
          {record.rows.map((row, i) => (
            <p key={row.label} className={i === 0 ? "grid grid-cols-[86px_1fr] gap-2.5 py-1.5 text-meta text-ink-muted" : "grid grid-cols-[86px_1fr] gap-2.5 border-t border-line py-1.5 text-meta text-ink-muted"}>
              <span>{row.label}</span>
              <b className={"tone" in row && row.tone === "ready" ? "font-medium text-status-ready-fg" : "font-medium text-ink"}>{row.value}</b>
            </p>
          ))}
        </div>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-meta text-ink-muted">
        <span className="flex items-center gap-2"><i className="size-1.5 rounded-pill bg-status-attention-fg" />{f.footChat}</span>
        <span className="flex items-center gap-2"><i className="size-1.5 rounded-pill bg-signal" />{f.footRecord}</span>
      </p>
    </figure>
  );
}
