"use client";

/**
 * The motion vocabulary, live.
 *
 * Sixteen primitives, each rendered next to the rule it enforces. This is the
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
  CountUp, Marquee, PinnedTabs, Lift, Press, CrossFade, TrackFill, SlideSwap,
  InViewProgress, ScrollSettle, LineReveal, Depth, Tilt, useReduced,
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

  const CHAPTERS = ["Почин", "Роботи", "Закриття"];
  const [chapterIndex, setChapterIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

  const handleNextChapter = () => {
    if (chapterIndex < CHAPTERS.length - 1) {
      setSlideDirection(1);
      setChapterIndex(chapterIndex + 1);
    }
  };

  const handlePrevChapter = () => {
    if (chapterIndex > 0) {
      setSlideDirection(-1);
      setChapterIndex(chapterIndex - 1);
    }
  };

  return (
    <main className="mx-auto max-w-content px-6 md:px-12">
      <header className="py-24">
        <p className="index-label">Kitchen sink · motion</p>
        <TextBlurIn
          as="h1"
          className="display mt-4 block max-w-[16ch] text-mkt-display-1 text-ink"
          text="Шістнадцять примітивів і жодного більше"
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
          <TrackFill filled={false} className="h-1 flex-1 rounded-pill bg-line" />
          <TrackFill filled={true} className="h-1 flex-1 rounded-pill bg-signal" />
          <TrackFill filled={false} className="h-1 flex-1 rounded-pill bg-line" />
        </div>
      </Case>

      <Case n="12" name="SlideSwap" rule="На відміну від CrossFade, SlideSwap має напрямок: користувач натиснув «далі» або «назад», і крива приходу говорить чесно про рух. На reduced motion напрямок ВІДПАДАЄ, а не скорочується — 24 px за 120 мс все ще слайд.">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              onClick={handlePrevChapter}
              disabled={chapterIndex === 0}
              className="h-9 touch:h-11 rounded-control bg-action px-4 text-data font-medium text-action-fg disabled:bg-line disabled:text-ink-muted"
            >
              Назад
            </button>
            <button
              onClick={handleNextChapter}
              disabled={chapterIndex === CHAPTERS.length - 1}
              className="h-9 touch:h-11 rounded-control bg-action px-4 text-data font-medium text-action-fg disabled:bg-line disabled:text-ink-muted"
            >
              Далі
            </button>
          </div>
          <SlideSwap
            activeKey={CHAPTERS[chapterIndex]!}
            direction={slideDirection}
            className="rounded-panel border border-line bg-surface p-6"
          >
            <div className="min-h-32 flex items-center justify-center">
              {chapterIndex === 0 && (
                <p className="text-data text-ink">Етап початку робіт. Всі сторони узгодили послідовність дій і готові почати.</p>
              )}
              {chapterIndex === 1 && (
                <p className="text-data text-ink">Виконання робіт. Команда працює, фотографує прогрес, готує докази для наступного етапу.</p>
              )}
              {chapterIndex === 2 && (
                <p className="text-data text-ink">Закриття етапу. Підрядник надіслав докази, технагляд їх перевіряє, прийняв рішення про оплату.</p>
              )}
            </div>
          </SlideSwap>
        </div>
      </Case>

      <Case n="13" name="InViewProgress" rule="Єдиний примітив без власного малюнка: публікує 0 → 1 як --gp-progress на своєму вузлі, а смугу малює виклик. Під reduced motion значення одразу 1, без анімації.">
        <InViewProgress className="block h-2 overflow-hidden rounded-pill bg-line">
          <div
            aria-hidden="true"
            className="h-full rounded-pill bg-signal"
            style={{ width: "calc(var(--gp-progress, 0) * 100%)" }}
          />
        </InViewProgress>
        <p className="measure mt-4 text-data text-ink-muted">
          Сам примітив нічого не малює — він лише публікує число. Ця смуга належить виклику, а не бібліотеці.
        </p>
      </Case>

      <Case n="14" name="ScrollSettle" rule="Кадр продукту в'їжджає нахиленим і вирівнюється по скролу — 21st.dev Container Scroll. Другий і останній scroll-linked елемент сторінки; нижче md і під reduced motion кадр плаский одразу. Промінь по рамці робить два оберти після посадки і зупиняється: вічна анімація тут лише одна, і це стрічка.">
        <ScrollSettle className="mx-auto max-w-content">
          <div className="relative rounded-surface border border-line-strong bg-surface p-8 shadow-float">
            <i className="beam" aria-hidden="true" />
            <p className="index-label">Стан пакету робіт</p>
            <p className="mt-3 text-data text-ink-muted">Готово 12 · На розгляді 07 · Заблоковано 03</p>
          </div>
        </ScrollSettle>
      </Case>

      <Case n="15" name="LineReveal" rule="Заголовок виїжджає з масок рядок за рядком, 1200 мс, ease-out-expo, крок 80 мс. Рядки знаходяться за розкладкою (offsetTop), не SplitText; під reduced motion — один fade.">
        <LineReveal as="p" className="display max-w-[20ch] text-mkt-display-2 text-ink" text="На нараді більше не сперечаються про те, що вже сховано" accent="що вже сховано" />
      </Case>

      <Case n="16" name="Depth" rule="Шар рухається проти скролу в межах своєї секції: від depth·80px до depth·−80px. Нижче md і під reduced motion — нерухомий, той самий DOM.">
        <section className="relative h-64 overflow-hidden rounded-panel border border-line bg-surface">
          <Depth depth={-0.3} className="absolute left-6 top-6 rounded-card border border-line-strong bg-canvas px-3 py-2 text-data text-ink">depth −0.3</Depth>
          <Depth depth={0.35} className="absolute bottom-6 right-6 rounded-pill border border-line-strong bg-canvas px-3 py-1.5 text-data text-ink">depth 0.35</Depth>
        </section>
      </Case>

      <Case n="17" name="Tilt" rule="Поверхня нахиляється до курсору на пружині, до 3°; лише pointer:fine, вище md, не під reduced motion. Батько задає perspective.">
        <div className="grid gap-4 md:grid-cols-2 [perspective:1600px]">
          <Tilt maxX={2.5} maxY={3} className="rounded-surface border border-line-strong bg-surface p-6"><p className="text-data text-ink">rotateX ±2.5° · rotateY ±3°</p></Tilt>
          <Tilt maxX={1.5} maxY={2} className="rounded-surface border border-line-strong bg-surface p-6"><p className="text-data text-ink">rotateX ±1.5° · rotateY ±2°</p></Tilt>
        </div>
      </Case>
    </main>
  );
}
