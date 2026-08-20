import Image from "next/image";
import { Chip, type ChipTone } from "@goproceed/ui/components";
import { Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";

const content = landingContent.dashboard;

const toneByState: Record<(typeof content.rows)[number]["state"], ChipTone> = {
  "Готово": "ready",
  "На розгляді": "review",
  "Заблоковано": "blocked",
};

export function DashboardSurface() {
  return (
    <div
      role="region"
      aria-label="Огляд робочого простору GoProceed"
      className="overflow-hidden rounded-section border border-line-strong bg-surface shadow-float"
    >
          <header className="flex h-14 items-center gap-4 border-b border-line bg-surface px-4 md:px-5">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="size-2.5 rounded-pill bg-status-blocked-fg" />
              <span className="size-2.5 rounded-pill bg-status-attention-fg" />
              <span className="size-2.5 rounded-pill bg-status-ready-fg" />
            </div>
            <span className="hidden h-5 w-px bg-line md:block" aria-hidden="true" />
            <p className="truncate text-data font-semibold text-ink">{content.project}</p>
            <p className="index-label ml-auto hidden text-ink-muted md:block">Стан · 20.08.2026 · 16:24</p>
          </header>

          <div className="grid min-h-[660px] wide:grid-cols-[190px_minmax(0,1fr)_300px]">
            <aside className="hidden flex-col bg-inverse px-3 py-5 text-on-inverse wide:flex">
              <div className="flex items-center gap-3 px-2">
                <span className="grid size-8 place-items-center rounded-control bg-action-signal text-meta font-semibold text-action-signal-fg">GP</span>
                <div>
                  <p className="text-data font-semibold">GoProceed</p>
                  <p className="text-micro text-on-inverse-muted">Контур проєкту</p>
                </div>
              </div>
              <nav aria-label="Навігація макета робочого простору" className="mt-7">
                <ul className="space-y-1">
                  {content.navigation.map((item, index) => (
                    <li
                      key={item.label}
                      className={`flex items-center rounded-control px-3 py-2.5 text-meta ${
                        index === 1 ? "bg-surface text-ink" : "text-on-inverse-muted"
                      }`}
                    >
                      <span className="mr-3 font-mono text-micro">0{index + 1}</span>
                      <span className="font-medium">{item.label}</span>
                      {"count" in item && <span className="tabular ml-auto text-micro">{item.count}</span>}
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-auto border-t border-line-inverse px-2 pt-4">
                <p className="text-meta font-medium">Майстер-проєкт</p>
                <p className="mt-1 text-micro text-on-inverse-muted">Роль · ПТВ</p>
              </div>
            </aside>

            <div className="min-w-0 border-r border-line">
              <div className="border-b border-line px-4 py-5 md:px-6">
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <p className="index-label text-ink-muted">Проєкт · GP-2026-014</p>
                    <h3 className="mt-2 text-h2 font-semibold tracking-tight text-ink">Реєстр робіт</h3>
                  </div>
                  <span className="ml-auto rounded-pill border border-line bg-subtle px-3 py-1 text-meta text-ink-muted">
                    Електромонтаж · активний
                  </span>
                </div>
              </div>

              <Stagger className="grid grid-cols-2 border-b border-line md:grid-cols-4">
                {content.summary.map((item) => (
                  <StaggerItem key={item.label} y={0} className="border-b border-r border-line px-4 py-4 md:border-b-0">
                    <p className="tabular text-h2 font-semibold text-ink">{item.value}</p>
                    <p className="mt-1 text-meta text-ink-muted">{item.label}</p>
                  </StaggerItem>
                ))}
              </Stagger>

              <div className="grid grid-cols-[minmax(0,1fr)_110px] border-b border-line bg-subtle px-4 py-2 text-micro font-medium uppercase tracking-wide text-ink-muted md:grid-cols-[76px_minmax(0,1.4fr)_minmax(0,1fr)_80px_120px] md:px-6">
                <span className="hidden md:block">Код</span>
                <span>Робота</span>
                <span className="hidden md:block">Місце</span>
                <span className="hidden md:block">Докази</span>
                <span>Стан</span>
              </div>

              <div>
                {content.rows.map((row, index) => (
                  <div
                    key={row.code}
                    className={`grid min-h-20 grid-cols-[minmax(0,1fr)_110px] items-center border-b border-line px-4 py-3 text-data md:grid-cols-[76px_minmax(0,1.4fr)_minmax(0,1fr)_80px_120px] md:px-6 ${
                      index === 0 ? "border-l-2 border-l-action-signal bg-subtle" : "bg-surface"
                    }`}
                  >
                    <span className="index-label hidden text-ink-muted md:block">{row.code}</span>
                    <div>
                      <p className="font-medium text-ink">{row.work}</p>
                      <p className="mt-1 text-meta text-ink-muted md:hidden">{row.place}</p>
                    </div>
                    <span className="hidden text-meta text-ink-muted md:block">{row.place}</span>
                    <span className="tabular hidden text-meta font-medium text-ink md:block">{row.evidence}</span>
                    <Chip tone={toneByState[row.state]} className="justify-self-start px-2 md:px-3">{row.state}</Chip>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 px-4 py-4 text-meta text-ink-muted md:px-6">
                <span className="size-2 rounded-pill bg-action-signal" aria-hidden="true" />
                <span>EV-0248 додано до W-014</span>
                <span className="ml-auto font-mono text-micro">14:32</span>
              </div>
            </div>

            <aside className="hidden bg-subtle wide:block" aria-label="Інспектор вимоги">
              <div className="border-b border-line px-5 py-5">
                <p className="index-label text-ink-muted">Інспектор вимоги</p>
                <div className="mt-3 flex items-start gap-3">
                  <div>
                    <p className="text-h3 font-semibold text-ink">R-041</p>
                    <p className="mt-1 text-meta text-ink-muted">Кабельний лоток до закриття стелі</p>
                  </div>
                  <Chip tone="attention" className="ml-auto px-2">Блокуюча</Chip>
                </div>
              </div>
              <figure className="relative aspect-[4/3] overflow-hidden border-b border-line bg-sunken">
                <Image
                  src="/images/cable-tray-evidence.png"
                  alt="Доказ EV-0248 у боковому інспекторі вимоги"
                  fill
                  sizes="300px"
                  className="object-cover"
                />
                <figcaption className="absolute inset-x-3 bottom-3 rounded-control bg-inverse px-3 py-2 text-meta text-on-inverse">
                  EV-0248 · 14:32
                </figcaption>
              </figure>
              <dl className="divide-y divide-line px-5">
                <InspectorRow label="Робота" value="W-014" />
                <InspectorRow label="Етап" value="До закриття" />
                <InspectorRow label="Матеріали" value="3 з 3" />
                <InspectorRow label="Рішення" value="Очікується" />
              </dl>
              <div className="m-5 rounded-panel border border-status-review-line bg-status-review p-4">
                <p className="text-meta font-semibold text-status-review-fg">Черга доказів</p>
                <p className="mt-2 text-meta leading-relaxed text-status-review-fg">
                  Запис готовий до зовнішнього розгляду.
                </p>
              </div>
            </aside>
          </div>
    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-3 text-meta">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="ml-auto font-medium text-ink">{value}</dd>
    </div>
  );
}
