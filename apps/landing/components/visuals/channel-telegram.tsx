import Image from "next/image";
import { demoRecords } from "../../content/demo-records";
import photoThumb from "../../public/images/photo-tray-thumb.jpg";

export function ChannelTelegram() {
  return (
    <div className="grid w-[min(200px,80%)] gap-1.5 rounded-surface bg-status-review p-2.5 text-micro text-ink">
      {demoRecords.channels.telegram.map((m, i) => (
        <p key={i} className={m.me ? "max-w-[90%] justify-self-end rounded-panel rounded-br-[3px] bg-status-ready px-2 py-1.5" : "max-w-[90%] justify-self-start rounded-panel rounded-bl-[3px] bg-surface px-2 py-1.5"}>
          {"photo" in m && m.photo && <span className="landing-photo mb-1 block h-16"><Image src={photoThumb} alt="" fill sizes="200px" className="object-cover" /></span>}
          {"strong" in m && m.strong ? (<>{m.text.slice(0, m.text.indexOf(m.strong))}<b className="font-medium">{m.strong}</b>{m.text.slice(m.text.indexOf(m.strong) + m.strong.length)}</>) : m.text}
        </p>
      ))}
    </div>
  );
}
