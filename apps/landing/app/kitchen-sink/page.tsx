"use client";

/**
 * The motion vocabulary, live.
 *
 * Twelve primitives, each rendered next to the rule it enforces. This is the
 * code-first equivalent of a component library page in a design tool, and it
 * is where the QA harness points its viewport, contrast and touch-target
 * passes — a primitive that is only ever exercised inside a finished block is
 * a primitive nobody can check in isolation.
 *
 * The reduced-motion behaviour is the part worth looking at. Turn the OS
 * setting on and reload: every one of these changes shape rather than speed.
 * The reveals stop moving, the blur resolve becomes a fade, the marquee
 * freezes, the counter starts at its final value, the pinned tour unpins into
 * four stacked sections. Nothing here runs the same animation faster.
 */

import {
  Reveal, Stagger, StaggerItem, TextBlurIn, ScrollTint, LineDraw, NodeLock,
  CountUp, Marquee, PinnedTabs, Lift, Press, CrossFade, TrackFill, useReduced,
  type PinnedTab,
} from "@goproceed/ui/motion";
import { useState } from "react";

const uah = (n: number) =>
  new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(Math.round(n));

const CHAIN = ["Робота", "Докази", "Закриття", "Акт", "Оплата"];

const ROLES = [
  { id: "contractor", label: "Підрядник", body: "Бачить, що саме блокує закриття етапу і скільки це коштує." },
  { id: "foreman", label: "Виконроб", body: "Бачить, що треба сфотографувати до того, як роботу закриють." },
  { id: "supervisor", label: "Технагляд", body: "Приймає рішення за посиланням, без облікового запису." },
];

const TABS: PinnedTab[] = [
  { id: "register", label: "Реєстр робіт", hint: "Що виконано і що це коштує", panel: <Frame title="Реєстр робіт" /> },
  { id: "evidence", label: "Вимоги та докази", hint: "Що треба довести, відомо наперед", panel: <Frame title="Вимоги та докази" /> },
  { id: "closure", label: "Закриття етапу", hint: "Відмова, поки доказів немає", panel: <Frame title="Закриття етапу" /> },
  { id: "act", label: "Акт і рішення", hint: "Додаток В і зовнішнє рішення", panel: <Frame title="Акт і рішення" /> },
];

function Frame({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-64 items-center justify-center rounded-surface border border-line bg-surface shadow-float">
      <p className="index-label">{title}</p>
    </div>
  );
}

function Case({ n, name, rule, children }: {
  n: string; name: string; rule: string; children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line py-16">
      <p className="index-label">{n} · {name}</p>
      <p className="measure mt-2 text-data text-ink-muted">{rule}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function KitchenSink() {
  const reduced = useReduced();
  const [role, setRole] = useState(ROLES[0]!.id);
  const active = ROLES.find((r) => r.id === role) ?? ROLES[0]!;

  return (
    <main className="mx-auto max-w-content px-6 md:px-12">
      <header className="py-24">
        <p className="index-label">Kitchen sink · motion</p>
        <TextBlurIn
          as="h1"
          className="display mt-4 block max-w-[16ch] text-mkt-display-1 text-ink"
          text="Дванадцять примітивів і жодного більше"
        />
        <p className="measure mt-6 text-mkt-lead leading-relaxed text-ink-muted">
          Кожен блок нижче показує примітив і правило, яке він тримає.
          Поточний режим: <strong className="text-ink">{reduced ? "reduced motion" : "повний рух"}</strong>.
        </p>
      </header>

      <Case n="01" name="TextBlurIn" rule="Заголовок проявляється пословно через blur, крок 40 мс, пружина. Не більше двох разів на сторінку. Під reduced motion — просто поява.">
        <TextBlurIn as="p" className="display text-mkt-display-3 text-ink" text="Докази перетворюються на оплату" />
      </Case>

      <Case n="02" name="Reveal" rule="Базове появлення секції: 400 мс, ease-out-quart, спрацьовує один раз. Секція, що переанімовується на зворотному скролі, — дефект.">
        <Reveal className="rounded-panel border border-line bg-surface p-6">
          <p className="text-data text-ink">Opacity 0 → 1 плюс підйом на 16 px.</p>
        </Reveal>
      </Case>

      <Case n="03" name="Stagger" rule="Послідовність — це інформація: вона каже, що елементи впорядковані. Під reduced motion крок лишається, зсув зникає.">
        <Stagger className="grid gap-3 md:grid-cols-3">
          {["Реєстр", "Докази", "Акт"].map((t) => (
            <StaggerItem key={t} className="rounded-panel border border-line bg-surface p-5">
              <p className="index-label">{t}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </Case>

      <Case n="04" name="ScrollTint" rule="Єдине місце, де дозволена прив’язка до скролу для тексту. Колір — з ролей, не з рампи.">
        <ScrollTint
          className="display max-w-[24ch] text-mkt-display-3"
          text="Ми не блокуємо роботу на майданчику — ми не даємо її пред’явити до оплати без доказів"
        />
      </Case>

      <Case n="05" name="LineDraw + NodeLock" rule="Лінія малюється за прогресом скролу, вузли сідають слідом із кроком 80 мс. Під reduced motion лінія намальована повністю.">
        <div className="relative">
          <LineDraw className="absolute inset-x-0 top-6 h-0.5" d="M0 1 L1200 1" viewBox="0 0 1200 2" />
          <div className="relative grid grid-cols-5 gap-2">
            {CHAIN.map((node, i) => (
              <NodeLock key={node} index={i} className="flex flex-col items-center gap-3">
                <span className="size-3 rounded-pill bg-signal ring-4 ring-canvas" />
                <span className="rounded-control border border-line bg-surface px-2 py-1 text-meta text-ink">{node}</span>
              </NodeLock>
            ))}
          </div>
        </div>
      </Case>

      <Case n="06" name="CountUp" rule="Форматер передається ззовні — гроші мають валюту й локаль, і компонент не вирішує це сам. Цифри табличні, інакше анімація стає layout-анімацією.">
        <p className="tabular text-mkt-display-2 font-semibold text-ink">
          <CountUp value={1240800} format={uah} /> <span className="text-mkt-lead text-ink-muted">₴ без доказів</span>
        </p>
      </Case>

      <Case n="07" name="Marquee" rule="Єдина вічна анімація в системі. CSS, не JS: у нескінченного лінійного зсуву немає стану. Пауза на hover, зупинка під reduced motion.">
        <Marquee className="rounded-panel border border-line bg-surface py-4">
          {CHAIN.concat(CHAIN).map((t, i) => (
            <span key={`${t}-${i}`} className="index-label px-8">{t}</span>
          ))}
        </Marquee>
      </Case>

      <Case n="08" name="Lift + Press" rule="Наведення на картку: −3 px, 160 мс. Натиск: scale .98 на жорсткій пружині, миттєво. Кнопка лишається справжньою кнопкою.">
        <div className="flex flex-wrap items-start gap-4">
          <Lift className="w-64 rounded-panel border border-line bg-surface p-5">
            <p className="index-label">Folio</p>
            <p className="mt-2 text-data text-ink-muted">Аркуш на столі, а не картка, що стрибає.</p>
          </Lift>
          <Press className="h-9 touch:h-11 rounded-control bg-action px-4 text-data font-medium text-action-fg">
            Натисніть і потримайте
          </Press>
        </div>
      </Case>

      <Case n="09" name="CrossFade" rule="Симетрична крива — єдине місце, де вона доречна: у крос-фейду немає напрямку. mode=wait, щоб сторінка не стрибала.">
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r.id}
              aria-pressed={r.id === role}
              onClick={() => setRole(r.id)}
              className={
                r.id === role
                  ? "h-9 touch:h-11 rounded-pill bg-action px-4 text-meta font-medium text-action-fg"
                  : "h-9 touch:h-11 rounded-pill border border-line bg-surface px-4 text-meta font-medium text-ink-muted"
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        <CrossFade activeKey={active.id} className="mt-4 rounded-panel border border-line bg-surface p-6">
          <p className="text-data text-ink">{active.body}</p>
        </CrossFade>
      </Case>

      <Case n="10" name="PinnedTabs" rule="Клікабельні вкладки з автоперемиканням і прогресом. Ручний вибір перезапускає інтервал, пауза та reduced motion зупиняють ротацію.">
        <PinnedTabs tabs={TABS} />
      </Case>

      <Case n="11" name="TrackFill" rule="Стрічка прогресу, яка заповнюється тому, що користувач посунувся через послідовність, не тому, що сторінка скролилась. На відміну від LineDraw, відповідає на стан додатку, а не на позицію скролу.">
        <div className="flex gap-2">
          <TrackFill filled={false} className="h-1 flex-1 origin-left rounded-pill bg-line" />
          <TrackFill filled={true} className="h-1 flex-1 origin-left rounded-pill bg-signal" />
          <TrackFill filled={false} className="h-1 flex-1 origin-left rounded-pill bg-line" />
        </div>
      </Case>
    </main>
  );
}
