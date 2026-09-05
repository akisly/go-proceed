import type { ReactNode } from "react";

/** The white UI window inside a route card's media half. */
export function UiWindow({ title, tag, children }: { title: string; tag: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-[460px] overflow-hidden rounded-panel border border-line-strong bg-surface shadow-float">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 text-data text-ink-muted">
        <b className="font-medium text-ink">{title}</b><span className="text-meta">{tag}</span>
      </div>
      <div className="grid gap-3 p-4 text-data text-ink-secondary">{children}</div>
    </div>
  );
}

/** A label/value row — the prototype's `.kv`. */
export function KeyValue({ label, value, first = false }: { label: string; value: string; first?: boolean | undefined }) {
  return (
    <p className={first ? "grid grid-cols-[110px_1fr] gap-2.5 py-2" : "grid grid-cols-[110px_1fr] gap-2.5 border-t border-line py-2"}>
      <span className="text-ink-muted">{label}</span><b className="font-medium text-ink">{value}</b>
    </p>
  );
}

/** The tinted rule box — attention by default, ready when `tone="ready"`. */
export function RuleBox({ lead, text, tone = "attention" }: { lead: string; text: string; tone?: "attention" | "ready" | undefined }) {
  return (
    <p className={tone === "ready"
      ? "rounded-panel border border-status-ready-line bg-status-ready px-3.5 py-3 text-data text-ink-secondary"
      : "rounded-panel border border-status-attention-line bg-status-attention px-3.5 py-3 text-data text-ink-secondary"}>
      <b className={tone === "ready" ? "font-medium text-status-ready-fg" : "font-medium text-status-attention-fg"}>{lead}</b> {text}
    </p>
  );
}
