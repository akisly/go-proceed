import { Chip } from "@goproceed/ui/components";
import { demoRecords } from "../../content/demo-records";
import { RuleBox, UiWindow } from "./ui-window";

export function UiClosure() {
  const c = demoRecords.route.closure;
  return (
    <UiWindow title={c.title} tag={c.tag}>
      <div>
        {c.log.map((e, i) => (
          <p key={e.time} className={i === 0 ? "grid grid-cols-[56px_1fr] gap-3 py-2 text-data text-ink-secondary" : "grid grid-cols-[56px_1fr] gap-3 border-t border-line py-2 text-data text-ink-secondary"}>
            <i className="pt-0.5 font-mono text-meta not-italic text-ink">{e.time}</i>
            <span>
              {"code" in e && e.code && <b className="font-medium text-ink">{e.code} · </b>}{e.text}
              {e.tags.map((t) => (
                <Chip key={t.label} tone={"tone" in t && t.tone ? t.tone : "neutral"} className="ml-1.5 px-1.5 py-0 text-micro">{t.label}</Chip>
              ))}
            </span>
          </p>
        ))}
      </div>
      <RuleBox lead={c.rule.lead} text={c.rule.text} tone="ready" />
    </UiWindow>
  );
}
