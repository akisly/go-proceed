/**
 * Token proof, not a landing page.
 *
 * apps/landing is greenfield and the fourteen blocks of the landing land in
 * Phase 3. What this route has to do first is prove the pipeline end to end:
 * that a role compiles to a utility, that the four elevations differ, that the
 * type scale is reachable, and that the status triplets read. Everything below
 * renders from semantic utilities only — no ramp step is named, which is the
 * rule packages/testing/src/primitive-leak.test.ts enforces.
 *
 * EVERY CLASS NAME HERE IS A LITERAL, AND THAT IS NOT STYLE.
 * Tailwind v4 finds candidates by scanning source text. `bg-${role}` produces
 * no CSS at all: the scanner sees the template literal, not the class, and the
 * element renders unstyled with nothing warning. Class names are therefore
 * written out in full, even where a loop would be shorter.
 *
 * When Phase 3 starts, this file is replaced. It is not a component library
 * and nothing should import from it.
 */
import type { ReactNode } from "react";

const STATUSES = [
  { label: "Готово", className: "bg-status-ready border-status-ready-line text-status-ready-fg" },
  { label: "Під ризиком", className: "bg-status-attention border-status-attention-line text-status-attention-fg" },
  { label: "Заблоковано", className: "bg-status-blocked border-status-blocked-line text-status-blocked-fg" },
  { label: "На розгляді", className: "bg-status-review border-status-review-line text-status-review-fg" },
  { label: "Не розпочато", className: "bg-status-idle border-status-idle-line text-status-idle-fg" },
];

const ELEVATIONS = [
  { name: "raised", className: "shadow-raised", scope: "Наведення на картку" },
  { name: "overlay", className: "shadow-overlay", scope: "Тултип, поповер, ⌘K" },
  { name: "modal", className: "shadow-modal", scope: "Діалог, висувна рейка" },
  { name: "float", className: "shadow-float", scope: "Тільки маркетинг" },
];

const SURFACES = [
  { name: "bg-canvas", className: "bg-canvas" },
  { name: "bg-surface", className: "bg-surface" },
  { name: "bg-subtle", className: "bg-subtle" },
  { name: "bg-sunken", className: "bg-sunken" },
];

const TYPE_STEPS = [
  { name: "micro", className: "text-micro" },
  { name: "meta", className: "text-meta" },
  { name: "data", className: "text-data" },
  { name: "body", className: "text-body" },
  { name: "h3", className: "text-h3" },
  { name: "h2", className: "text-h2" },
  { name: "h1", className: "text-h1" },
  { name: "display", className: "text-display" },
];

function Section({ index, title, children }: {
  index: string; title: string; children: ReactNode;
}) {
  return (
    <section className="border-t border-line py-16">
      <p className="index-label">{index}</p>
      <h2 className="mt-2 text-h2 font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function TokenProof() {
  return (
    <main className="mx-auto max-w-content px-6 md:px-12">
      <header className="py-24">
        <p className="index-label">GoProceed · дизайн-система v2</p>
        <h1 className="display mt-4 max-w-[14ch] text-mkt-display-1 text-ink">
          Evidence-to-payment operating layer
        </h1>
        <p className="measure mt-6 text-mkt-lead leading-relaxed text-ink-muted">
          Ця сторінка доводить, що токени компілюються: ролі, шкала, чотири рівні
          глибини та п’ять станів. Блоки лендінгу — фаза 3.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {/* 44px on touch, 36px at the desk — the size floor is about the
              pointing device, so it is expressed as one. */}
          <button className="h-9 touch:h-11 rounded-control bg-action px-4 text-data font-medium text-action-fg transition-colors duration-fast ease-out hover:bg-action-hover">
            Первинна дія
          </button>
          <button className="h-9 touch:h-11 rounded-control border border-line-strong bg-surface px-4 text-data font-medium text-ink transition-colors duration-fast ease-out hover:bg-action-ghost-hover">
            Вторинна дія
          </button>
          <button className="h-9 touch:h-11 rounded-control bg-action-signal px-4 text-data font-semibold text-action-signal-fg transition-colors duration-fast ease-out hover:bg-action-signal-hover">
            Сигнальна дія — одна на екран
          </button>
        </div>
      </header>

      <Section index="П. 01 · Типографіка" title="Дві шкали, три родини">
        <div className="space-y-3">
          {TYPE_STEPS.map((step) => (
            <p key={step.name} className={`${step.className} text-ink`}>
              <span className="index-label mr-4 align-middle">{step.name}</span>
              Секція А · підвал · електрощитова ВРУ-1
            </p>
          ))}
          <p className="display text-mkt-display-3 text-ink">
            Дисплейна гарнітура — тільки маркетинг, ніколи не в застосунку
          </p>
          <p className="text-data text-ink-muted tabular">
            620/620 · 180/150 · 1 240 800,00 ₴ — табличні цифри
          </p>
        </div>
      </Section>

      <Section index="П. 02 · Поверхні" title="Чотири рівні, і панель не отримує жодного">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ELEVATIONS.map((level) => (
            <div key={level.name} className={`rounded-panel bg-surface p-5 ${level.className}`}>
              <p className="index-label">{level.name}</p>
              <p className="mt-2 text-data text-ink-muted">{level.scope}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {SURFACES.map((surface) => (
            <div key={surface.name} className={`rounded-panel border border-line p-5 ${surface.className}`}>
              <p className="index-label">{surface.name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section index="П. 03 · Стани" title="Сім станів каталогу — п’ять візуальних тонів">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <span
              key={status.label}
              className={`inline-flex items-center rounded-pill border px-3 py-1 text-meta font-medium ${status.className}`}
            >
              {status.label}
            </span>
          ))}
        </div>
        <p className="measure mt-4 text-data text-ink-muted">
          Колір ніколи не є єдиним сигналом: підпис завжди несе значення, тон
          лише підфарбовує його.
        </p>
      </Section>

      <Section index="П. 04 · Інверсія" title="Carbon — це поле й один банер, а не рейка">
        <div className="rounded-surface bg-inverse p-10">
          <p className="index-label text-on-inverse-muted">bg-inverse</p>
          <p className="mt-3 text-h2 font-semibold text-on-inverse">
            Мобільна зйомка на майданчику
          </p>
          <p className="measure mt-2 text-data text-on-inverse-muted">
            Під D2 темна поверхня лишається там, де вона потрібна фізично —
            в полі, під сонцем.
          </p>
        </div>
      </Section>
    </main>
  );
}
