"use client";

import { Chip } from "@goproceed/ui/components";
import { CountUp, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { demoRecords } from "../../content/demo-records";

const two = (n: number) => String(Math.round(n)).padStart(2, "0");

/** The web app's state board — three columns of work cards. Demonstration data. */
export function Board() {
  const b = demoRecords.board;
  return (
    <div role="img" aria-label="Стан пакету робіт у веб-застосунку GoProceed" className="relative overflow-hidden rounded-surface border border-line-strong bg-surface shadow-float">
      <i className="beam" aria-hidden="true" />
      <div className="flex items-center justify-between border-b border-line px-3.5 py-3 text-meta text-ink-muted">
        <span><b className="font-medium text-ink">{b.project}</b> · {b.scope}</span>
        <div className="flex gap-1">
          {b.tabs.map((t) => (
            <span key={t} className={t === b.activeTab ? "rounded-field bg-subtle px-2 py-1 text-ink" : "px-2 py-1"}>{t}</span>
          ))}
        </div>
      </div>
      <div className="grid gap-2.5 p-3 md:grid-cols-3">
        {b.columns.map((col, i) => (
          <div key={col.id} className={i === 0 ? "hidden grid content-start gap-2 md:grid" : "grid content-start gap-2"}>
            <div className="flex justify-between px-1 text-meta text-ink-muted">
              <b className="font-medium text-ink">{col.label}</b>
              <CountUp value={col.count} format={two} className="tabular font-mono" />
            </div>
            <Stagger delay={0.7} className="grid gap-2">
              {col.cards.map((card) => (
                <StaggerItem key={card.code} size="stately">
                  <article
                    data-board-card={card.selected ? "selected" : "card"}
                    className={card.selected
                      ? "grid gap-1.5 rounded-field border border-line-accent bg-surface p-2.5 text-meta ring-3 ring-accent-soft"
                      : "grid gap-1.5 rounded-field border border-line bg-surface p-2.5 text-meta"}
                  >
                    <span className="font-mono text-micro text-ink-muted">{card.code}</span>
                    <span className="font-medium leading-snug text-ink">{card.title}</span>
                    <Chip tone={card.tone} dot pulse={card.tone === "review"} className="w-fit px-2 py-0.5 text-micro">{card.tag}</Chip>
                  </article>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        ))}
      </div>
    </div>
  );
}
