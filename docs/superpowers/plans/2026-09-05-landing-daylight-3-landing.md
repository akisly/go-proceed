# Landing Daylight — Plan 3 of 3: the page, the form, QA and the documents

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Evidence Journey page with the Daylight page — thirteen sections in the prototype's order, the copy in one typed content file, a working pilot form with a server side and an honest fallback, browser QA at seven widths, and every document that describes the landing brought into agreement.

**Architecture:** `app/page.tsx` stays a Server Component that composes blocks from `components/blocks/`; each block reads `content/landing-content.ts` (copy) and `content/demo-records.ts` (the demonstration records the visuals draw) and renders shared components from `@goproceed/ui/components` and motion from `@goproceed/ui/motion`. Three client leaves only: the nav (active section), the pilot form, the CTA's copy-link button. The form posts to `app/api/pilot/route.ts`, whose delivery step is a pure module the tests drive with an injected `fetch`.

**Tech Stack:** Next 16.3.1 (App Router, route handlers per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`), React 19.2.8, Tailwind 4.3.3, `@goproceed/ui`, vitest 3.2.4 + jsdom 30 + `@testing-library/react` 16.3 (already in the workspace via `apps/app`), puppeteer 25.8.0, Telegram Bot API `sendMessage` (https://core.telegram.org/bots/api#sendmessage, read 2026-09-05), Resend `POST /emails` (https://resend.com/docs/api-reference/emails/send-email, read 2026-09-05: `from` required, `reply_to` accepted).

**Spec:** [`docs/superpowers/specs/2026-09-05-landing-daylight-design.md`](../specs/2026-09-05-landing-daylight-design.md) — §3 (page), §6.2 (motion mapping), §7 (deviations), §8 (content), §9 (form and tests), §10 (responsive), §11 (gate).

**Prerequisites:** Plans 1 and 2 green.

## Global Constraints

- Branch `claude/practical-chatterjee-c8d64a`; commit per task; never touch auth code or `supabase/**`.
- Public copy is Ukrainian and comes only from `content/*.ts`; no block invents a string. Forbidden (§8): `електромонтаж` as an audience word, `польова вебпрограма`, `оплат`, `КЕП`, `офлайн`, `клієнт`, `економія`, `%`, any price but «безкоштовний», any company name in the author block, any testimonial.
- Required strings (§8): «Чернетка акта не є підписаним документом», «потребує з'єднання», «безкоштовний», «без договору і передоплати», «Telegram-бот», «мобільний застосунок», «без облікового запису».
- Classes name roles; no template-literal classes; `motion/react` only through `@goproceed/ui/motion`; at most two scroll-linked elements per page (`ScrollSettle` in the hero, `ScrollTint` in the problem statement) and never in one fold; `TextBlurIn` at most twice (hero h1, CTA h2); no `bg-action-signal` on this page.
- Every visual's demonstration data is labelled by the footer disclaimer; the board carries `role="img"` with an `aria-label` that says it is the web app's state.
- Repo docs English; owner conversation Russian.
- Run every command from the repo root.

**Class vocabulary reminder** (everything else compiles to nothing): sizes `text-micro|meta|data|body|h3|h2|h1|display|mkt-caption|mkt-index|mkt-body|mkt-lead|mkt-display-3|-2|-1`; colours by role (`bg-canvas|surface|subtle|sunken|inverse|signal|accent-soft|status-*`, `text-ink|ink-secondary|ink-muted|ink-subtle|on-inverse|on-inverse-muted|on-signal|link|brand|accent|status-*-fg`, `border-line|line-subtle|line-strong|line-inverse|line-accent|status-*-line`, `fill-*`/`stroke-*` with the same names); radii `rounded-control|field|panel|card|surface|section|pill`; shadows `shadow-raised|overlay|modal|float`; widths `max-w-measure|content|nav|marketing`; breakpoints `md:` `wide:` `touch:`; durations `duration-instant|fast|base|slow|deliberate`; eases `ease-out|enter|emphatic|soft`; utilities `index-label`, `measure`, `tabular`, `display`, `beam`, `spotlight`.

---

### Task 14: Content, demonstration records, the request builder

**Files:**
- Replace: `apps/landing/content/landing-content.ts`
- Create: `apps/landing/content/demo-records.ts`
- Replace: `apps/landing/content/pilot-mail.ts` → `apps/landing/content/pilot-request.ts` (delete the old file)
- Modify: `apps/landing/content/landing-metadata.ts`
- Replace tests: `apps/landing/tests/landing-content.test.ts`, `apps/landing/tests/pilot-mail.test.ts` → `tests/pilot-request.test.ts`, `apps/landing/tests/metadata.test.ts`

**Interfaces:**
- Produces: `landingContent` (shape below, `as const`); `demoRecords` (board, receipt, fig01, route windows, channels); `PilotFields`, `PILOT_EMAIL`, `PILOT_LIMITS`, `buildPilotMessage(fields)`, `buildPilotMailto(fields)`, `validatePilotFields(input: unknown): { ok: true; fields: PilotFields } | { ok: false; error: "required" }`.

- [ ] **Step 1: Write the failing content test**

Replace `apps/landing/tests/landing-content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { landingContent } from "../content/landing-content";
import { demoRecords } from "../content/demo-records";

const flatten = (value: unknown): string =>
  typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.map(flatten).join(" ")
      : value && typeof value === "object"
        ? Object.values(value).map(flatten).join(" ")
        : "";

const copy = flatten(landingContent);
const everything = `${copy} ${flatten(demoRecords)}`;

describe("landing copy — the Daylight page", () => {
  it("publishes the fourteen sections in the prototype's order", () => {
    expect(Object.keys(landingContent)).toEqual([
      "nav", "hero", "sources", "problem", "compare", "roles", "route",
      "position", "capture", "provenance", "pilot", "faq", "cta", "footer",
    ]);
  });

  it("keeps the header links in page order", () => {
    expect(landingContent.nav.items.map((i) => i.href)).toEqual(["#compare", "#roles", "#stages", "#faq"]);
  });

  it.each([
    "польова вебпрограма", "оплат", "кеп", "офлайн", "клієнт", "економія", "%",
    "тов ", "llc", "грн", "usd", "€", "$",
  ])("does not publish «%s»", (claim) => {
    expect(everything.toLowerCase()).not.toContain(claim.toLowerCase());
  });

  it("names no electrical audience, while the example work stays cable trays", () => {
    expect(copy.toLowerCase()).not.toContain("електромонтаж");
    expect(everything).toContain("Монтаж кабельних трас");
    expect(copy).toContain("від монолітчиків до інженерних мереж");
  });

  it("states the owner's facts F1–F6", () => {
    expect(copy).toContain("пілот безкоштовний");
    expect(copy).toContain("без договору і передоплати");
    expect(copy).toContain("Telegram-бот");
    expect(copy).toContain("мобільний застосунок");
    expect(copy).toContain("без облікового запису");
    expect(landingContent.pilot.author.signature).toBe("Автор GoProceed · відповідаю протягом робочого дня");
  });

  it("states the product boundaries", () => {
    expect(copy).toContain("Чернетка акта не є підписаним документом");
    expect(copy).toContain("потребує з'єднання");
    expect(copy).toContain("Фізичну роботу не зупиняє");
  });

  it("carries the example route through every code", () => {
    for (const code of ["W-014", "R-041", "EV-0248", "DR-0091", "CL-017"]) {
      expect(everything).toContain(code);
    }
  });

  it("asks seven questions", () => {
    expect(landingContent.faq.entries).toHaveLength(7);
    expect(landingContent.faq.entries.map((e) => e.id)).toContain("cost");
  });
});
```

- [ ] **Step 2: Run** — `pnpm --filter @goproceed/landing exec vitest run tests/landing-content.test.ts` → FAIL (old shape).

- [ ] **Step 3: Write `landing-content.ts`**

```ts
export type NavItem = { label: string; href: `#${string}` };
export type Fact = { value: string; label: string };
export type CompareRowContent = { key: "photo" | "requirement" | "decision" | "closure" | "act"; question: string; answer: string; ref?: string };
export type RoleCell = { id: string; title: string; subtitle: string; pain: string; gets: readonly string[] };
export type RouteStep = { index: string; eyebrow: string; title: string; titleAccent: string; body: string; note: string };
export type Channel = { id: "telegram" | "app" | "web"; index: string; status: { tone: "ready" | "review"; label: string }; title: string; body: string; foot: string };
export type AccessLevel = "none" | "own" | "full";
export type FaqEntry = { id: string; question: string; answer: string };

export const landingContent = {
  nav: {
    items: [
      { label: "Що зміниться", href: "#compare" },
      { label: "Для кого", href: "#roles" },
      { label: "Як працює", href: "#stages" },
      { label: "Питання", href: "#faq" },
    ] satisfies readonly NavItem[],
    action: "Обговорити пілот",
    actionShort: "Пілот",
    brand: "GoProceed",
  },
  hero: {
    pill: { badge: "Безкоштовний пілот", text: "для субпідрядників із прихованими роботами", href: "#pilot" },
    title: "Робота готова до приймання, коли доказ на місці.",
    titleAccent: "доказ",
    lead: "GoProceed показує майстру потрібний кадр до закриття конструкції і передає його технагляду разом із вимогою. Акт збирається з фактів, а не з чатів, тож на нараді сперечаються про посилання, а не про пам'ять.",
    primaryAction: "Обговорити пілот",
    secondaryAction: "Що зміниться на нараді",
    secondaryHref: "#compare",
    facts: [
      { value: "ПТВ: дві години", label: "на старті пілота" },
      { value: "Майстер: свій телефон", label: "Telegram-бот або мобільний застосунок" },
      { value: "Технагляд: одне посилання", label: "без облікового запису" },
    ] satisfies readonly Fact[],
    frameLabel: "Стан пакету робіт у веб-застосунку GoProceed",
    dimension: "W-014 · ВРУ-1 · секція А · відм. +3.300",
  },
  sources: {
    label: "Джерела вимог",
    items: [
      { code: "ДБН А.3.1-5:2016", title: "Організація будівельного виробництва" },
      { code: "Додаток В", title: "Акт освідчення прихованих робіт" },
      { code: "ДБН В.2.6-98:2009", title: "Бетонні та залізобетонні конструкції" },
      { code: "ПКМУ № 903", title: "Порядок прийняття в експлуатацію" },
      { code: "ДБН В.2.6-31:2021", title: "Теплова ізоляція та енергоефективність" },
      { code: "ДБН В.2.5-64:2012", title: "Внутрішній водопровід та каналізація" },
    ],
  },
  problem: {
    rule: { index: "01", label: "Проблема" },
    statement: "Кожен, хто закривав конструкцію без фото, знає, скільки коштує потім довести, що під нею все зроблено.",
    aside: "GoProceed не зупиняє бригаду і не замінює кошторис. Він тримає разом три факти, без яких приймання перетворюється на суперечку: вимогу, доказ і рішення.",
    figure: {
      number: "Рис. 01",
      title: "той самий кадр",
      note: "у чаті бригади → у записі GoProceed",
      footChat: "у чаті: фото є, але без осі, вимоги й рішення",
      footRecord: "у записі: те саме фото відповідає на всі питання наради",
    },
  },
  compare: {
    rule: { index: "02", label: "Було і стало" },
    eyebrow: "Було і стало",
    title: "На нараді більше не сперечаються про те, що вже сховано",
    titleAccent: "що вже сховано",
    lead: "Затримка приймання затримує гроші. Ось той самий етап W-014: як його доводять зараз і на що посилаються з GoProceed.",
    was: {
      eyebrow: "Зараз",
      title: "Чати, диск, пам'ять",
      rows: [
        { key: "photo", question: "Де фото?", answer: "У чаті бригади або на телефоні того, хто знімав" },
        { key: "requirement", question: "За якою вимогою?", answer: "У проєкті, у листуванні із замовником або в пам'яті ПТВ" },
        { key: "decision", question: "Хто прийняв і коли?", answer: "Усно на майданчику, іноді голосовим" },
        { key: "closure", question: "Коли закрили?", answer: "Приблизно, за спогадами і датою фото" },
        { key: "act", question: "Що в акті?", answer: "Переписують вручну, часто після повернення" },
      ] satisfies readonly CompareRowContent[],
      outcome: "Акт повертають. Нарада йде по колу. Гроші чекають.",
    },
    now: {
      eyebrow: "З GoProceed",
      title: "Один запис на кожну роботу",
      rows: [
        { key: "photo", question: "Де фото?", answer: "На роботі W-014, з часом і місцем", ref: "EV-0248 · 14:32 · ВРУ-1" },
        { key: "requirement", question: "За якою вимогою?", answer: "Вимога прив'язана до роботи ще до старту", ref: "R-041 · ДБН А.3.1-5" },
        { key: "decision", question: "Хто прийняв і коли?", answer: "Рішення технагляду з автором і часом", ref: "DR-0091 · 16:18" },
        { key: "closure", question: "Коли закрили?", answer: "Запис закриття посилається на рішення", ref: "CL-017 · 16:19" },
        { key: "act", question: "Що в акті?", answer: "Чернетка Додатка В зібрана з фактів, кожне поле має походження" },
      ] satisfies readonly CompareRowContent[],
      outcome: "Суперечка про посилання, а не про пам'ять. Акт не повертають за браком доказу.",
    },
  },
  roles: {
    rule: { index: "03", label: "Ролі" },
    eyebrow: "Для кого",
    title: "Кожна роль отримує своє, і ні від кого не вимагається зайвого",
    titleAccent: "і ні від кого не вимагається зайвого",
    lead: "Ролі й болі взяті зі сканування попиту серед українських субпідрядників, які здають приховані роботи: від монолітчиків до інженерних мереж. Правило одне: майстру не можна додавати роботу після того, як фото вже надіслано.",
    cells: [
      { id: "pto", title: "ПТВ", subtitle: "виробничо-технічний відділ", pain: "Дні на пошук фото по чатах, переписування у Word, дзвінки виконробу перед місячною папкою, повернення від замовника.", gets: ["доказ знаходиться по роботі, а не по стрічці чату", "чернетка акта з того, що вже записано", "повернення видно з причинами"] },
      { id: "foreman", title: "Майстер", subtitle: "дільниці", pain: "Обов'язок знімати і вести журнали, але нульова терпимість до адміністрування. Друге поле після того самого фото — вже мінус.", gets: ["один екран: що зняти, до якого моменту", "жодних форм після фото", "Telegram-бот або мобільний застосунок, без форм"] },
      { id: "owner", title: "Власник", subtitle: "комерційний директор", pain: "Затримка приймання затримує гроші. Потрібно бачити, який обсяг заблокований, чому і як довго.", gets: ["стан пакету за причинами, не за кольором", "заблоковані роботи з назвою вимоги", "час від фіксації до рішення"] },
      { id: "supervision", title: "Технагляд", subtitle: "зовнішній розгляд", pain: "Відповідальність без інструменту і небажання входити в чужий проєкт або відкривати обліковий запис.", gets: ["одне посилання на одну вимогу", "нейтральна квитанція з джерелами", "прийняти, повернути або уточнити за хвилину"] },
    ] satisfies readonly RoleCell[],
  },
  route: {
    rule: { index: "04", label: "Маршрут" },
    eyebrow: "Один маршрут",
    title: "Одна робота проходить весь шлях. Без втрати контексту.",
    titleAccent: "Без втрати контексту.",
    lead: "Вимога, кадр, рішення, закриття і чернетка акта тримаються разом на одній роботі. Ніхто не переказує контекст усно, і нікому не треба шукати, з чого все почалось.",
    codes: [
      { code: "W", label: "робота" }, { code: "R", label: "вимога" }, { code: "EV", label: "доказ" },
      { code: "DR", label: "рішення" }, { code: "CL", label: "закриття" },
    ],
    steps: [
      { index: "01", eyebrow: "Вимога відома до робіт", title: "Пункт ДБН прив'язаний до роботи ще до першого фото", titleAccent: "ще до першого фото", body: "ПТВ один раз вказує, що саме блокує закриття: джерело, місце, момент і скільки матеріалів потрібно. Далі ця вимога супроводжує роботу до акта.", note: "Вимогу не треба згадувати на майданчику. Вона вже там." },
      { index: "02", eyebrow: "Фіксація з майданчика", title: "Майстер бачить потрібний кадр, а не «завантажте фото»", titleAccent: "потрібний кадр", body: "Телефон показує вимогу і кадр у контексті роботи. Час, місце й автор записуються самі. Жодних полів після того, як фото вже зроблено.", note: "Один екран, одна кнопка, один запис EV." },
      { index: "03", eyebrow: "Зовнішній перегляд", title: "Технагляд вирішує по посиланню, без облікового запису", titleAccent: "без облікового запису", body: "Одна вимога, її матеріали й історія. Прийняти, повернути або запитати уточнення. Рішення зберігається з автором і часом, а не в голосовому.", note: "Нейтральна квитанція замість доступу до чужого проєкту." },
      { index: "04", eyebrow: "Закриття записано", title: "Запис закриття посилається на рішення, а не на пам'ять", titleAccent: "посилається на рішення", body: "Без прийнятого рішення GoProceed відмовляє у записі закриття. Порядок і час подій фіксує система, тож на нараді немає чого відновлювати.", note: "Фізичну роботу ніхто не зупиняє. Зупиняється лише запис без підстави." },
      { index: "05", eyebrow: "Чернетка акта", title: "Додаток В збирається з чотирьох фактів, не переписується", titleAccent: "з чотирьох фактів", body: "Роботи, вимога, докази, рішення й закриття підставляються з того, що вже записано. Кожен рядок знає своє походження.", note: "Це чернетка для підпису, а не підписаний документ." },
    ] satisfies readonly RouteStep[],
  },
  position: {
    eyebrow: "Позиція GoProceed",
    quoteDim: "Ми не зупиняємо роботу на майданчику —",
    quote: "ми не даємо записати її закритою, поки доказ не отримано і не погоджено технаглядом.",
    quoteAccent: "доказ",
    pills: [
      { kind: "no", text: "не зупиняє фізичну роботу" },
      { kind: "yes", text: "не дає записати закриття без доказу" },
      { kind: "lock", text: "фото не можна замінити або відкріпити пізніше" },
    ] as const,
  },
  capture: {
    rule: { index: "05", label: "Фіксація" },
    eyebrow: "Фіксація з майданчика",
    title: "Два способи надіслати доказ. Один запис у веб-застосунку",
    titleAccent: "Один запис у веб-застосунку",
    lead: "Майстер знімає там, де йому зручно: у Telegram або в мобільному застосунку. Обидва бачать ту саму вимогу і віддають кадр у той самий запис EV, з яким далі працюють ПТВ, керівник і технагляд у веб-застосунку.",
    channels: [
      { id: "telegram", index: "01 · Telegram-бот · майстер", status: { tone: "ready", label: "доступно" }, title: "Для бригади, яка вже живе в месенджері", body: "Бот отримує фото, питає одне: до якої роботи воно належить, і повертає код EV. Жодних встановлень і форм. Потребує з'єднання.", foot: "→ EV-0248 у веб-застосунку" },
      { id: "app", index: "02 · Мобільний застосунок · майстер", status: { tone: "review", label: "пілот" }, title: "Показує, що зняти, і тримає чергу, поки немає мережі", body: "iOS та Android. Вимога і потрібний кадр у контексті роботи; кадр стає доказом, щойно завантажиться. Для пілота обираємо роботи з покриттям.", foot: "→ той самий EV-0248" },
      { id: "web", index: "03 · Веб-застосунок · офіс", status: { tone: "ready", label: "доступно" }, title: "Для ПТВ і керівника: реєстр, вимоги, рішення, акти", body: "Сюди приходить кожен EV. ПТВ бачить стан за причинами, готує вимоги і чернетки актів; технагляд отримує звідси посилання на одну вимогу.", foot: "→ рішення, закриття, акт" },
    ] satisfies readonly Channel[],
    converge: { code: "EV-0248", text: "один запис у веб-застосунку · очікує рішення технагляду" },
  },
  provenance: {
    rule: { index: "06", label: "Походження" },
    eyebrow: "Походження",
    title: "Кому що видно, і що не можна підробити",
    titleAccent: "що не можна підробити",
    lead: "Довіра до запису тримається на двох речах: хто має до нього доступ і що в ньому не можна змінити після факту.",
    access: {
      eyebrow: "Доступ · хто що бачить",
      title: "Кожна роль бачить рівно стільки, скільки їй потрібно",
      body: "Майстер не бачить реєстру, технагляд не заходить у проєкт, а ПТВ і керівник працюють з усім пакетом у веб-застосунку.",
      small: "Технагляд отримує одне посилання на одну вимогу і не потребує облікового запису.",
      columns: ["Майстер", "ПТВ", "Керівник", "Технагляд"],
      rows: [
        { label: "Реєстр робіт", cells: ["none", "full", "full", "none"] },
        { label: "Вимоги до роботи", cells: ["own", "full", "full", "own"] },
        { label: "Фото-докази", cells: ["own", "full", "full", "own"] },
        { label: "Рішення технагляду", cells: ["none", "full", "full", "full"] },
        { label: "Стан за причинами", cells: ["none", "full", "full", "none"] },
        { label: "Чернетка акта", cells: ["none", "full", "full", "none"] },
        { label: "Історія подій", cells: ["none", "full", "full", "own"] },
      ] satisfies readonly { label: string; cells: readonly AccessLevel[] }[],
      legend: { full: "весь пакет", own: "лише своя робота або вимога", none: "немає" },
    },
    immutability: {
      eyebrow: "Незмінність",
      title: "Що не можна виправити заднім числом",
      items: [
        "Фото не можна замінити або відкріпити від роботи після завантаження",
        "Час, місце і автора ставить система, а не той, хто заповнює акт",
        "Запис закриття посилається на конкретне рішення технагляду",
        "Історія подій не редагується, лише доповнюється",
      ],
    },
    limits: {
      eyebrow: "Межі v0.1",
      title: "Що GoProceed робить зараз, і чого не обіцяє",
      does: ["Вимога прив'язана до роботи до старту", "Онлайн-фіксація з телефону", "Зовнішній розгляд без доступу до проєкту", "Записане блокування закриття"],
      doesNot: ["Матеріал без мережі не зберігається", "Чернетка акта не є підписаним документом", "Фізичну роботу не зупиняє"],
    },
  },
  pilot: {
    rule: { index: "07", label: "Пілот" },
    eyebrow: "Пілот",
    title: "Як проходить пілот на одному пакеті робіт",
    titleAccent: "на одному пакеті робіт",
    lead: "Орієнтовний план на два тижні. Без інтеграцій, без міграції даних, без демо-акаунтів із вигаданими об'єктами: працюємо на вашому пакеті робіт.",
    steps: [
      { when: "День 1 · об'єкт і реєстр", title: "Заносимо один пакет робіт і вимоги до нього", body: "Разом із ПТВ: роботи, місця, пункти ДБН і проєктні рішення, які блокують закриття. Дві години." },
      { when: "Тиждень 1 · майданчик", title: "Майстер знімає докази за вимогами", body: "Через Telegram-бот або мобільний застосунок, на своєму телефоні. Ми дивимось, де процес ламається, і правимо." },
      { when: "Тиждень 2 · зовнішній розгляд", title: "Технагляд приймає або повертає по посиланню", body: "Перший запис закриття з підставою. Якщо технагляд відмовляється від посилання, ми дізнаємось про це на пілоті, а не після впровадження." },
      { when: "Підсумок", title: "Чернетка акта і рішення про продовження", body: "Збираємо Додаток В із фактів, показуємо, що заблоковано і чому, і чесно називаємо межі v0.1." },
    ],
    needs: { title: "Що потрібно від вас", items: ["один об'єкт і один пакет робіт", "ПТВ на дві години", "майстер із телефоном", "контакт технагляду: він отримає одне посилання і за хвилину прийме або поверне, без реєстрації"] },
    gets: { title: "Що ви отримаєте", items: ["реєстр із вимогами, доказами й рішеннями", "чернетку акта за Додатком В", "стан пакету за причинами", "список меж v0.1 без прикрас"] },
    terms: { title: "Умови", items: ["пілот безкоштовний: два тижні на одному пакеті робіт, без договору і передоплати", "продовження після двох тижнів — окреме рішення, нічого не вмикається автоматично", "якщо майстер не знімає за вимогами без нагадувань, ми це побачимо на першому тижні і скажемо чесно"] },
    author: {
      title: "Від автора",
      initials: "GP",
      body: "Я роблю GoProceed сам і читаю кожну заявку особисто. Без відділу продажів і без демо-акаунтів: пілот проходить на вашому пакеті робіт, і якщо на першому тижні видно, що бригада не знімає, я скажу це прямо, а не тягнутиму впровадження.",
      signature: "Автор GoProceed · відповідаю протягом робочого дня",
    },
    form: {
      title: "Опишіть об'єкт і пакет робіт",
      note: "Заявка приходить мені одразу. Якщо відправка з якоїсь причини не спрацює, сторінка запропонує скопіювати текст і надіслати його поштою.",
      fields: {
        name: { label: "Ім'я", placeholder: "Ірина" },
        company: { label: "Компанія", placeholder: "БудМонтаж Сервіс" },
        role: { label: "Роль" },
        contact: { label: "Телефон або Telegram", placeholder: "+380… або @нік" },
        context: { label: "Об'єкт і пакет робіт", placeholder: "ЖК або БЦ, монолітні роботи чи інженерні мережі, технагляд від замовника…" },
      },
      roles: ["Власник / керівник", "Керівник ПТВ", "Майстер", "Технагляд", "Інша роль"],
      submit: "Надіслати запит на пілот",
      submitting: "Надсилаю…",
      copy: "Скопіювати текст заявки",
      copied: "Скопійовано",
      sent: "Заявку надіслано. Відповім протягом робочого дня на вказаний контакт.",
      failed: "Не вдалося надіслати автоматично. Текст заявки скопійовано — надішліть його на",
      failedTail: "або натисніть «Відкрити поштовий клієнт».",
      mail: "Відкрити поштовий клієнт",
      fine: "Демонстраційні дані на сторінці не є даними замовників. Пілот проводиться на ваших роботах.",
    },
  },
  faq: {
    rule: { index: "08", label: "Питання" },
    eyebrow: "Питання",
    title: "Що зазвичай питають перед пілотом",
    titleAccent: "перед пілотом",
    entries: [
      { id: "replace-tools", question: "GoProceed замінює чати, диск і кошторисну систему?", answer: "Ні. Він утримує доказовий контур роботи: вимогу, фіксацію, рішення, закриття й факти для чернетки акта. Інші інструменти можуть залишатися у своєму призначенні." },
      { id: "supervision", question: "Технагляду потрібен доступ до внутрішнього проєкту?", answer: "Ні. Зовнішній перегляд показує конкретну вимогу, матеріали й історію рішення без доступу до решти робочого простору." },
      { id: "connection", question: "Чи можна фіксувати матеріали без мережі?", answer: "Фіксація потребує з'єднання: незавантажений оригінал не вважається збереженим доказом. У мобільному застосунку є черга відправки, тож кадр піде, щойно з'явиться мережа; для пілота обираємо роботи з покриттям." },
      { id: "adoption", question: "Що, як бригада не буде цим користуватись?", answer: "Майстер не отримує нових форм: у Telegram-боті або мобільному застосунку телефон показує один кадр, який треба зняти, і одну кнопку. Вимоги заносить ПТВ заздалегідь. Якщо на першому тижні пілота майстер не знімає без нагадувань, ми бачимо це в реєстрі і зупиняємось, а не тягнемо впровадження." },
      { id: "refusal", question: "Технагляд замовника не хоче посилання. Що тоді?", answer: "Посилання відкриває одну вимогу з матеріалами, без реєстрації і без доступу до вашого проєкту. Якщо технагляд усе одно відмовляється, це з'ясовується на другому тижні пілота, і ми чесно кажемо, що GoProceed для цього об'єкта поки не підходить." },
      { id: "cost", question: "Скільки коштує пілот і хто відповідає?", answer: "Пілот безкоштовний: два тижні на одному пакеті робіт, без договору і передоплати. Продовження після пілота є окремим рішенням і не вмикається автоматично. Відповідає автор продукту особисто, без відділу продажів. Фото зберігаються разом із полями і не можуть бути замінені або відкріплені від роботи пізніше." },
      { id: "act", question: "Чернетка акта є готовим підписаним документом?", answer: "Ні. Це підготовлена чернетка з записаних фактів. Перевірка й формальне підписання залишаються окремими діями відповідальних сторін." },
    ] satisfies readonly FaqEntry[],
  },
  cta: {
    title: "Перевірте маршрут на одному пакеті робіт",
    titleAccent: "на одному пакеті робіт",
    lead: "Візьмемо одну чинну вимогу, один польовий сценарій і один зовнішній розгляд. Цього достатньо, щоб побачити, де процес зберігає доказовість.",
    primary: "Заповнити запит на пілот",
    share: "Скопіювати посилання для ПТВ",
    shared: "Посилання скопійовано",
    shareText: "GoProceed — приймання прихованих робіт з доказом. Подивись «Було і стало» і план пілота: ",
  },
  footer: {
    tagline: "Доказовий контур будівельних робіт: вимога, доказ, рішення, закриття, чернетка акта.",
    columns: [
      { title: "Продукт", links: [{ label: "Маршрут", href: "#stages" }, { label: "Фіксація з майданчика", href: "#capture" }, { label: "Походження і межі v0.1", href: "#trust" }, { label: "Для кого", href: "#roles" }] },
      { title: "Пілот", links: [{ label: "Як проходить", href: "#pilot" }, { label: "Було і стало", href: "#compare" }, { label: "Питання", href: "#faq" }, { label: "Написати", href: "mailto" }] },
    ],
    trust: { title: "Довіра", items: ["Технагляд без облікового запису", "Демо на реальних формах: ДБН А.3.1-5:2016, Додаток В", "Межі версії названі поруч із перевагами"] },
    copyright: "© 2026 GoProceed",
    disclaimer: "Демонстраційні дані. Частина показаних сценаріїв перебуває у розробці. Чернетка акта не є підписаним документом.",
  },
} as const;
```

(`href: "mailto"` in the footer is a marker the footer block resolves to `mailto:${PILOT_EMAIL}`; the address lives in `pilot-request.ts` only.)

- [ ] **Step 4: Write `demo-records.ts`**

```ts
/**
 * The demonstration records the visuals draw. Plausible Ukrainian
 * construction records, no customer data — the footer disclaimer labels them
 * on every render (PRODUCT.md §Capabilities and Constraints).
 */
export type BoardTone = "ready" | "review" | "blocked";
export type BoardCard = { code: string; title: string; tag: string; tone: BoardTone; selected?: boolean };

export const demoRecords = {
  board: {
    project: "БЦ Поділ",
    scope: "Приховані роботи · Секція А",
    tabs: ["Список", "Стан", "Акти"],
    activeTab: "Стан",
    columns: [
      { id: "ready", label: "Готово", count: 12, tone: "ready", cards: [
        { code: "W-012 · R-038", title: "Армування плити, захватка 2", tag: "закриття дозволено", tone: "ready" },
        { code: "W-016 · R-044", title: "Гідроізоляція санвузлів, 4 поверх", tag: "закриття дозволено", tone: "ready" },
        { code: "W-019 · R-046", title: "Закладні у стінах, секція Б", tag: "закриття дозволено", tone: "ready" },
      ] },
      { id: "review", label: "На розгляді", count: 7, tone: "review", cards: [
        { code: "W-014 · R-041", title: "Монтаж кабельних трас", tag: "EV-0248 · 14:32", tone: "review", selected: true },
        { code: "W-017 · R-047", title: "Трубопроводи в стяжці, коридор", tag: "очікує рішення", tone: "review" },
      ] },
      { id: "blocked", label: "Заблоковано", count: 3, tone: "blocked", cards: [
        { code: "W-015 · R-052", title: "Утеплення фасаду, осі 1–4", tag: "1 з 2 матеріалів", tone: "blocked" },
        { code: "W-021 · R-055", title: "Гільзи у перекритті, зона С", tag: "доказу немає", tone: "blocked" },
      ] },
    ] satisfies readonly { id: string; label: string; count: number; tone: BoardTone; cards: readonly BoardCard[] }[],
  },
  receipt: {
    code: "EV-0248",
    when: "сьогодні · 14:32",
    photoCaption: "14:32 · ВРУ-1 · Секція А",
    rows: [
      { label: "Робота", value: "W-014 · ВРУ-1" },
      { label: "Вимога", value: "R-041 · до закриття стелі" },
      { label: "Автор", value: "Майстер дільниці" },
      { label: "Стан", value: "Очікує рішення", tone: "review" as const },
    ],
    pills: [
      { id: "closure", lead: "CL-017", text: "· запис закриття дозволено · 16:19" },
      { id: "decision", lead: "прийнято о 16:18", text: "Технагляд · " },
    ],
  },
  fig01: {
    chat: {
      title: "Бригада · Л-3",
      members: "47 учасників",
      messages: [
        { who: "Олег Т.", text: "Привезли лотки на 4-й, розвантажили біля ліфта", time: "09:12" },
        { who: "Ігор К.", photo: "other" as const, time: "10:05" },
        { who: "Ігор К.", text: "штроба по Б-3 готова", time: "10:05" },
        { who: "Марина (ПТВ)", me: true, text: "Хто сьогодні на об'єкті? Потрібен акт по гільзах", time: "11:40" },
        { who: "Олег Т.", text: "+", time: "11:41" },
        { who: "Ігор К.", photo: "tray" as const, text: "Лоток над ВРУ поставили, можна закривати?", time: "14:32", hit: true, missing: ["без осі", "без вимоги", "без рішення"] },
        { who: "Сергій Р.", text: "де ключі від щитової?", time: "14:50" },
        { who: "Ігор К.", text: "у Олега", time: "14:51" },
        { who: "Марина (ПТВ)", me: true, text: "Завтра бетон о 8, стелю на 4-му закриваємо після обіду", time: "16:02" },
        { who: "Ігор К.", photo: "other" as const, time: "16:40" },
        { who: "Ігор К.", text: "кріплення, теж 4-й", time: "16:40" },
        { who: "Сергій Р.", text: "ок", time: "16:41" },
        { who: "Олег Т.", text: "Стелю закрили, 4-й готовий", time: "18:15" },
      ],
      footer: { lead: "пошук «лоток»:", strong: "1 фото", tail: "серед 214 повідомлень · час є, осі й вимоги немає" },
    },
    record: {
      code: "EV-0248",
      state: "запис доказу · очікує рішення",
      photoCaption: "14:32 · ВРУ-1 · Секція А · вісь Б-4",
      rows: [
        { label: "Робота", value: "W-014 · Монтаж кабельних трас" },
        { label: "Вимога", value: "R-041 · лоток до закриття стелі" },
        { label: "Місце", value: "ВРУ-1 · Секція А · вісь Б-4 · +3.300" },
        { label: "Автор", value: "Ігор К. · майстер дільниці" },
        { label: "Час", value: "20.08.2026 · 14:32" },
        { label: "Рішення", value: "DR-0091 · прийнято технаглядом · 16:18", tone: "ready" as const },
      ],
    },
  },
  route: {
    requirement: {
      title: "R-041 · Кабельний лоток до закриття стелі", tag: "блокуюча",
      rows: [
        { label: "Джерело", value: "ДБН А.3.1-5:2016, п. 6.3" },
        { label: "Робота", value: "W-014 · Монтаж кабельних трас" },
        { label: "Місце", value: "ВРУ-1 · Секція А · відм. +3.300" },
        { label: "Момент", value: "до закриття стелі" },
        { label: "Матеріали", value: "2 фото · загальний вигляд і кріплення" },
      ],
      rule: { lead: "Правило.", text: "W-014 не може бути записана закритою, поки R-041 не має прийнятого доказу." },
    },
    capture: {
      title: "Фіксація · мобільний застосунок", tag: "сьогодні · 14:32",
      phone: { work: "W-014 · Кабельні траси", requirementLabel: "Вимога R-041", requirement: "Лоток до закриття стелі", shot: "Загальний вигляд · 1 з 2", action: "Зняти фото" },
      rows: [
        { label: "Час", value: "14:32 · сьогодні" }, { label: "Місце", value: "ВРУ-1 · Секція А" },
        { label: "Автор", value: "Майстер дільниці" }, { label: "Код", value: "EV-0248" },
      ],
    },
    review: {
      title: "Зовнішній перегляд", tag: "без облікового запису",
      url: "goproceed.app/r/7k2…f9 · доступ до R-041",
      rows: [{ label: "Вимога", value: "Кабельний лоток до закриття стелі" }, { label: "Матеріали", value: "2 фото · EV-0248 · 14:32" }],
      actions: [{ label: "Прийняти", active: true }, { label: "Повернути" }, { label: "Запитати уточнення" }],
      decision: "Рішення DR-0091 · О. Мельник · 16:18",
    },
    closure: {
      title: "Закриття · CL-017", tag: "дозволено",
      log: [
        { time: "14:32", code: "EV-0248", text: "матеріал додано", tags: [{ label: "майстер" }, { label: "на розгляді", tone: "review" as const }] },
        { time: "14:33", text: "походження зафіксовано", tags: [{ label: "система" }, { label: "застосунок" }] },
        { time: "16:18", code: "DR-0091", text: "матеріал прийнято", tags: [{ label: "технагляд" }, { label: "прийнято", tone: "ready" as const }] },
        { time: "16:19", code: "CL-017", text: "запис закриття дозволено", tags: [{ label: "система" }, { label: "закрито", tone: "ready" as const }] },
      ],
      rule: { lead: "Запис закриття", text: "посилається на рішення DR-0091." },
    },
    act: {
      title: "Чернетка акта · Додаток В", tag: "з 4 фактів", stamp: "ЧЕРНЕТКА", heading: "Акт освідчення прихованих робіт",
      rows: [
        { label: "Роботи", value: "Монтаж кабельних трас, ВРУ-1, секція А" },
        { label: "Вимога", value: "ДБН А.3.1-5:2016 · R-041" },
        { label: "Докази", value: "EV-0248 · 2 фото · 14:32" },
        { label: "Рішення", value: "DR-0091 · прийнято технаглядом · 16:18" },
        { label: "Закриття", value: "CL-017 · 16:19" },
      ],
    },
  },
  channels: {
    telegram: [
      { me: true, photo: true, text: "Лоток над ВРУ-1, секція А" },
      { me: false, text: "Знайшов W-014. Це для R-041 «до закриття стелі»?" },
      { me: true, text: "Так" },
      { me: false, text: "Збережено як EV-0248. Передано на розгляд.", strong: "EV-0248" },
    ],
    app: { header: "W-014 · R-041", rows: [{ title: "Загальний вигляд", text: "1 з 2 · зняти" }, { title: "Черга відправки", text: "EV-0251 · очікує мережу" }] },
    web: [{ left: "W-014 · R-041", right: "на розгляді" }, { left: "EV-0248 · 14:32", right: "доказ" }, { left: "DR-0091 · технагляд", right: "прийнято" }],
  },
} as const;
```

- [ ] **Step 5: Write `pilot-request.ts` and its test**

`apps/landing/content/pilot-request.ts`:

```ts
export const PILOT_EMAIL = "akisliy2306@gmail.com";

export type PilotFields = { name: string; company: string; contact: string; role: string; context: string };

export const PILOT_LIMITS: Record<keyof PilotFields, number> = { name: 120, company: 160, contact: 160, role: 60, context: 2000 };

/** Strip control characters, trim, cap the length. Never throws on a non-string. */
export function cleanField(value: unknown, max: number): string {
  return String(value ?? "").replace(/[ -]/g, "").trim().slice(0, max);
}

export function validatePilotFields(input: unknown): { ok: true; fields: PilotFields } | { ok: false; error: "required" } {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const fields: PilotFields = {
    name: cleanField(body.name, PILOT_LIMITS.name),
    company: cleanField(body.company, PILOT_LIMITS.company),
    contact: cleanField(body.contact, PILOT_LIMITS.contact),
    role: cleanField(body.role, PILOT_LIMITS.role),
    context: cleanField(body.context, PILOT_LIMITS.context),
  };
  if (!fields.name || !fields.contact) return { ok: false, error: "required" };
  return { ok: true, fields };
}

export function buildPilotMessage(fields: PilotFields): string {
  return [
    "Нова заявка на пілот GoProceed",
    "",
    `Ім'я: ${fields.name || "—"}`,
    `Компанія: ${fields.company || "—"}`,
    `Контакт: ${fields.contact || "—"}`,
    `Роль: ${fields.role || "—"}`,
    `Об'єкт і пакет робіт: ${fields.context || "—"}`,
  ].join("\n");
}

/** The text the fallback copies: the message plus where to send it. */
export function buildPilotClipboardText(fields: PilotFields): string {
  return `${buildPilotMessage(fields)}\n\nНадіслати на: ${PILOT_EMAIL}`;
}

export function buildPilotMailto(fields: PilotFields): string {
  const subject = encodeURIComponent("Пілот GoProceed — нова заявка");
  const body = encodeURIComponent(buildPilotMessage(fields));
  return `mailto:${PILOT_EMAIL}?subject=${subject}&body=${body}`;
}
```

`apps/landing/tests/pilot-request.test.ts` (delete `pilot-mail.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import {
  PILOT_EMAIL, buildPilotClipboardText, buildPilotMailto, buildPilotMessage, cleanField, validatePilotFields,
} from "../content/pilot-request";

const fields = { name: "Ірина", company: "", contact: "@iryna", role: "Керівник ПТВ", context: "БЦ, інженерні мережі" };

describe("pilot request", () => {
  it("builds the seven-line message with dashes for empty fields", () => {
    const lines = buildPilotMessage(fields).split("\n");
    expect(lines[0]).toBe("Нова заявка на пілот GoProceed");
    expect(lines[3]).toBe("Компанія: —");
    expect(lines[6]).toBe("Об'єкт і пакет робіт: БЦ, інженерні мережі");
  });

  it("appends the address for the clipboard fallback", () => {
    expect(buildPilotClipboardText(fields)).toContain(`Надіслати на: ${PILOT_EMAIL}`);
  });

  it("encodes the mailto to the pilot address", () => {
    const href = buildPilotMailto(fields);
    expect(href.startsWith(`mailto:${PILOT_EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(href)).toContain("Ім'я: Ірина");
  });

  it("requires a name and a contact, and strips control characters", () => {
    expect(validatePilotFields({ name: "", contact: "x" })).toEqual({ ok: false, error: "required" });
    expect(validatePilotFields({ name: "x", contact: "" })).toEqual({ ok: false, error: "required" });
    expect(validatePilotFields(null)).toEqual({ ok: false, error: "required" });
    const ok = validatePilotFields({ name: " Ірина  ", contact: "+380", context: "a".repeat(5000) });
    expect(ok.ok && ok.fields.name).toBe("Ірина");
    expect(ok.ok && ok.fields.context.length).toBe(2000);
    expect(cleanField(42, 10)).toBe("42");
  });
});
```

- [ ] **Step 6: Metadata**

`landing-metadata.ts`: `title = "GoProceed — робота готова до приймання, коли доказ на місці"`, `description = "GoProceed для підрядників, які здають приховані роботи: вимога, доказ із майданчика і рішення технагляду в одному маршруті, який закінчується чернеткою акта."`, OG alt `"GoProceed: робота готова до приймання, коли доказ на місці"`. Update `tests/metadata.test.ts` to those three strings (icons unchanged).

- [ ] **Step 7: Run** — `pnpm --filter @goproceed/landing exec vitest run tests/landing-content.test.ts tests/pilot-request.test.ts tests/metadata.test.ts` → PASS. Typecheck will be red until Task 15 replaces the blocks that import the old content — expected.

- [ ] **Step 8: Commit** — `git add apps/landing/content apps/landing/tests/landing-content.test.ts apps/landing/tests/pilot-request.test.ts apps/landing/tests/metadata.test.ts && git rm -q apps/landing/content/pilot-mail.ts apps/landing/tests/pilot-mail.test.ts && git commit -m "feat(landing): the Daylight copy, demonstration records and the pilot request builder

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"`

---

### Task 15: The page skeleton — layout, background, nav, footer, section rules

**Files:**
- Modify: `apps/landing/app/layout.tsx`, `apps/landing/app/globals.css`, `apps/landing/app/page.tsx`
- Create: `apps/landing/components/blocks/nav.tsx` (client), `footer.tsx`, `accent-text.tsx`, `section-head.tsx`; placeholder blocks for every section (each a `<section id>` with its heading; filled by Tasks 16–20)
- Delete: `components/blocks/{evidence-journey,evidence-journey-client,field-review,hero,nav-float,pilot-enquiry,readiness-diagram,trust-boundary}.tsx`, `components/visuals/*`, `components/marker-text.tsx`, `components/pilot-enquiry-form.tsx`, `public/images/*`, `tests/{landing-craft,no-filler-sections}.test.tsx`
- Copy: the four contest JPEGs → `apps/landing/public/images/photo-{blueprint,tray-card,tray-thumb,tray-wide}.jpg`
- Replace test: `apps/landing/tests/landing-render.test.tsx`, modify `tests/design-contract.test.tsx`

**Interfaces:**
- Produces: `AccentText({ text, accent })` — wraps `accent` inside `text` in `<span class="text-accent" data-accent="true">`; `SectionHead({ eyebrow, title, titleAccent, lead?, children?, layout?: "split" | "stack" })` — the prototype's `.head`: eyebrow + h2 left, lead (and optional children) right; every section uses it. The page's section ids in order: `hero`, `sources`, `problem`, `compare`, `roles`, `stages`, `position`, `capture`, `trust`, `pilot`, `faq`, `cta-final`.

- [ ] **Step 1: The failing render test**

Replace `apps/landing/tests/landing-render.test.tsx` with the skeleton assertions (the block tasks append to this file):

```tsx
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../app/page";
import { landingContent } from "../content/landing-content";

export const html = renderToStaticMarkup(<LandingPage />);
export const section = (id: string, next?: string) =>
  html.slice(html.indexOf(`id="${id}"`), next ? html.indexOf(`id="${next}"`) : undefined);

describe("the Daylight page — skeleton", () => {
  it("has one main heading, a skip link and the mark twice", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('href="#main-content"');
    expect(html.match(/data-brand-mark="true"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("renders the twelve sections in the prototype's order", () => {
    const ids = ["hero", "sources", "problem", "compare", "roles", "stages", "position", "capture", "trust", "pilot", "faq", "cta-final"];
    let cursor = -1;
    for (const id of ids) {
      const at = html.indexOf(`id="${id}"`);
      expect(at, id).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("numbers the eight section rules 01–08 in order", () => {
    expect(html.match(/data-section-rule="\d\d"/g)).toEqual(
      ["01", "02", "03", "04", "05", "06", "07", "08"].map((n) => `data-section-rule="${n}"`),
    );
  });

  it("puts the four header links in page order and the ink action", () => {
    const nav = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    for (const item of landingContent.nav.items) expect(nav).toContain(`href="${item.href}"`);
    expect(nav.indexOf('href="#compare"')).toBeLessThan(nav.indexOf('href="#roles"'));
    expect(nav.indexOf('href="#roles"')).toBeLessThan(nav.indexOf('href="#stages"'));
    expect(nav.indexOf('href="#stages"')).toBeLessThan(nav.indexOf('href="#faq"'));
    expect(nav).toContain(landingContent.nav.action);
    expect(nav).not.toContain("bg-action-signal");
  });

  it("uses no signal button anywhere on the page", () => {
    expect(html).not.toContain("bg-action-signal");
  });

  it("ends with the factual footer", () => {
    const footer = html.slice(html.indexOf("<footer"));
    expect(footer).toContain(landingContent.footer.disclaimer);
    expect(footer).toContain("mailto:akisliy2306@gmail.com");
    expect(footer).toContain("© 2026 GoProceed");
  });
});
```

`tests/design-contract.test.tsx`: change the contract id to `user-approved-daylight-2026-09-05` and the two `toContain` strings to `THESIS: The work is ready` and `FINISH: Unreviewed and undocumented is unfinished`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Delete the old page and copy the photos**

```bash
git rm -q apps/landing/components/blocks/*.tsx apps/landing/components/visuals/*.tsx apps/landing/components/marker-text.tsx apps/landing/components/pilot-enquiry-form.tsx apps/landing/tests/landing-craft.test.tsx apps/landing/tests/no-filler-sections.test.tsx apps/landing/public/images/*
cp design-references/contest-2026-09/daylight/assets/*.jpg apps/landing/public/images/
```

- [ ] **Step 4: Layout and globals**

`apps/landing/app/layout.tsx` — replace `DESIGN_CONTRACT` and the body:

```tsx
const DESIGN_CONTRACT = `<!--
THESIS: The work is ready for acceptance when the proof is in place; the page shows one work package travelling from requirement to draft act.
OWN-WORLD: Warm paper, cool ink, one cobalt mark; Onest and JetBrains Mono; recognisable 21st.dev blocks, no brutalism, no 3D.
STORY: Problem (Рис. 01) → було і стало → roles → the five-card route → position → capture channels → provenance → the free pilot → questions → CTA.
FIRST VIEWPORT: One promise, three entry facts, the product frame settling into the page.
FORM: Daylight, design-contest/daylight iteration nine, owner-approved 2026-09-05.
FINISH: Unreviewed and undocumented is unfinished; the build ends with the seven-width QA pass and DESIGN.md.
-->`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk" data-theme="light">
      <body className="landing-body">
        <template
          data-impeccable-contract="user-approved-daylight-2026-09-05"
          dangerouslySetInnerHTML={{ __html: DESIGN_CONTRACT }}
        />
        <div aria-hidden="true" className="landing-dot-field" />
        {children}
      </body>
    </html>
  );
}
```

`apps/landing/app/globals.css` — keep the `@import`, the `@source` lines and the `@layer base` block; replace everything from `@layer components {` to the end with:

```css
@layer components {
  /* The Dot Pattern (21st.dev): a fixed, aria-hidden dot field masked to the
   * top of the page, behind everything. Static — the prototype's scrolling
   * glows were removed in its sixth iteration. */
  .landing-dot-field {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image: radial-gradient(color-mix(in srgb, var(--color-ink) 22%, transparent) 1px, transparent 1.2px);
    background-size: 22px 22px;
    -webkit-mask-image: radial-gradient(ellipse 70% 55% at 50% 0%, #000 20%, transparent 100%);
    mask-image: radial-gradient(ellipse 70% 55% at 50% 0%, #000 20%, transparent 100%);
    opacity: 0.9;
  }

  .landing-body > header,
  .landing-body > main,
  .landing-body > footer {
    position: relative;
    z-index: 1;
  }

  /* The header's hairline is permanent (F9); the backdrop blurs the page under it. */
  .landing-header {
    background: color-mix(in srgb, var(--color-canvas) 86%, transparent);
    -webkit-backdrop-filter: blur(14px) saturate(1.2);
    backdrop-filter: blur(14px) saturate(1.2);
  }

  /* Nav link underline: slides in from the left on hover, stays on the active section in the accent. */
  .landing-nav-link::after {
    content: "";
    position: absolute;
    left: 0.6875rem;
    right: 0.6875rem;
    bottom: 3px;
    height: 1.5px;
    background: var(--color-ink);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform var(--gp-duration-base) var(--gp-ease-emphatic);
  }
  .landing-nav-link:hover::after { transform: scaleX(1); }
  .landing-nav-link[aria-current="true"]::after { transform: scaleX(1); background: var(--color-accent); }

  /* The drafting grid inside a route card's media half, masked to its centre. */
  .landing-media-grid::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background-image:
      linear-gradient(color-mix(in srgb, var(--color-ink) 5%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--color-ink) 5%, transparent) 1px, transparent 1px);
    background-size: 28px 28px;
    -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%);
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%);
  }

  /* A photo with the caption strip the prototype burns into it. */
  .landing-photo {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-field);
  }
  .landing-photo::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 50%, color-mix(in srgb, var(--color-ink) 45%, transparent));
  }
  .landing-photo > figcaption {
    position: absolute;
    left: 8px;
    bottom: 6px;
    z-index: 1;
    font-family: var(--gp-font-mono);
    font-size: 9px;
    letter-spacing: 0.06em;
    color: var(--color-surface);
  }

  /* The sticky route stack: cards pin under the header on wide screens only. */
  @media (width >= 1240px) {
    .landing-route-card { position: sticky; top: 90px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .landing-route-card { position: relative; top: auto; }
  }
}
```

(`--color-*` are the Tailwind theme aliases of the roles, resolvable in CSS; `#000` inside `mask-image` is a mask alpha, not a colour. The `1240px` media query repeats the `wide` token because `@variant` is not available inside a plain class rule at this layer; `SectionRule`'s use of `@variant` in `base.css` is the pattern for utilities, and this is the one place a literal breakpoint appears in the landing — noted in the file.)

- [ ] **Step 5: The helpers**

`components/blocks/accent-text.tsx`:

```tsx
/** Wraps `accent` inside `text` in the accent colour (F8: colour, never underline). Falls back to the plain text when the phrase is absent. */
export function AccentText({ text, accent }: { text: string; accent: string }) {
  const at = text.indexOf(accent);
  if (at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-accent" data-accent="true">{accent}</span>
      {text.slice(at + accent.length)}
    </>
  );
}
```

`components/blocks/section-head.tsx`:

```tsx
import type { ReactNode } from "react";
import { Reveal } from "@goproceed/ui/motion";
import { AccentText } from "./accent-text";

/**
 * The prototype's `.head`: eyebrow and h2 on the left, the lead on the right,
 * aligned to the bottom. `stack` puts the lead under the heading (the FAQ and
 * the problem statement do not use this component at all).
 */
export function SectionHead({
  eyebrow, title, titleAccent, lead, children, layout = "split",
}: {
  eyebrow: string;
  title: string;
  titleAccent: string;
  lead?: string | undefined;
  children?: ReactNode | undefined;
  layout?: "split" | "stack" | undefined;
}) {
  return (
    <div className={layout === "split" ? "mb-8 grid gap-6 md:mb-12 wide:grid-cols-2 wide:items-end wide:gap-10" : "mb-8 grid gap-6 md:mb-12"}>
      <div>
        <Reveal><p className="index-label">{eyebrow}</p></Reveal>
        <Reveal>
          <h2 className="display mt-3.5 max-w-[20ch] text-mkt-display-2 text-ink">
            <AccentText text={title} accent={titleAccent} />
          </h2>
        </Reveal>
      </div>
      {(lead || children) && (
        <Reveal>
          {lead && <p className="measure text-mkt-lead leading-relaxed text-ink-secondary">{lead}</p>}
          {children}
        </Reveal>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Nav and footer**

`components/blocks/nav.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@goproceed/ui/components";
import { landingContent } from "../../content/landing-content";
import { BrandMark } from "../brand-mark";

/**
 * The header (F9): permanent hairline, four links in page order with a
 * sliding underline that stays on the active section, the ink button. The
 * active section is an IntersectionObserver over the four targets — no
 * scroll listener, no motion library.
 */
export function Nav() {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const targets = landingContent.nav.items
      .map((i) => document.querySelector<HTMLElement>(i.href))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(`#${entry.target.id}`);
      }
    }, { rootMargin: "-45% 0px -45% 0px" });
    for (const t of targets) observer.observe(t);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="landing-header fixed inset-x-0 top-0 z-40 border-b border-line">
      <nav aria-label="Головна навігація" className="mx-auto flex h-(--gp-header-height-marketing) max-w-marketing items-center gap-1.5 px-4 md:px-8">
        <a href="#hero" className="mr-auto flex min-h-11 items-center gap-2.5 text-body font-semibold tracking-tight text-ink">
          <BrandMark />
          {landingContent.nav.brand}
        </a>
        <div className="hidden gap-0.5 md:flex" role="list">
          {landingContent.nav.items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={active === item.href ? "true" : undefined}
              className="landing-nav-link relative px-[0.6875rem] py-2 text-data text-ink-secondary transition-colors duration-fast ease-out hover:text-ink aria-[current=true]:text-ink"
            >
              {item.label}
            </a>
          ))}
        </div>
        <Button asChild size="sm" className="ml-2.5">
          <a href="#pilot">
            <span className="hidden md:inline">{landingContent.nav.action}</span>
            <span className="md:hidden">{landingContent.nav.actionShort}</span>
          </a>
        </Button>
      </nav>
    </header>
  );
}
```

`components/blocks/footer.tsx`:

```tsx
import { landingContent } from "../../content/landing-content";
import { PILOT_EMAIL } from "../../content/pilot-request";
import { BrandMark } from "../brand-mark";

export function Footer() {
  const f = landingContent.footer;
  return (
    <footer className="border-t border-line px-4 py-10 text-data text-ink-muted md:px-8">
      <div className="mx-auto max-w-marketing">
        <div className="mb-8 grid gap-8 md:grid-cols-2 wide:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="mb-2.5 flex items-center gap-2.5 text-body font-semibold text-ink"><BrandMark />{landingContent.nav.brand}</p>
            <p className="max-w-[40ch] leading-relaxed">{f.tagline}</p>
          </div>
          {f.columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h4 className="mb-3 text-meta font-semibold text-ink">{col.title}</h4>
              {col.links.map((l) => (
                <a
                  key={l.label}
                  href={l.href === "mailto" ? `mailto:${PILOT_EMAIL}` : l.href}
                  className="block py-1 transition-colors duration-fast ease-out hover:text-ink"
                >
                  {l.label}
                </a>
              ))}
            </nav>
          ))}
          <div>
            <h4 className="mb-3 text-meta font-semibold text-ink">{f.trust.title}</h4>
            {f.trust.items.map((t) => <p key={t} className="py-1">{t}</p>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <span>{f.copyright}</span>
          <p className="max-w-[70ch] text-meta text-ink-subtle">{f.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 7: The page and the placeholder blocks**

`apps/landing/app/page.tsx`:

```tsx
import { SectionRule } from "@goproceed/ui/components";
import { landingContent as c } from "../content/landing-content";
import { Nav } from "../components/blocks/nav";
import { Hero } from "../components/blocks/hero";
import { Sources } from "../components/blocks/sources";
import { Problem } from "../components/blocks/problem";
import { Compare } from "../components/blocks/compare";
import { Roles } from "../components/blocks/roles";
import { Route } from "../components/blocks/route";
import { Position } from "../components/blocks/position";
import { Capture } from "../components/blocks/capture";
import { Provenance } from "../components/blocks/provenance";
import { Pilot } from "../components/blocks/pilot";
import { Faq } from "../components/blocks/faq";
import { Cta } from "../components/blocks/cta";
import { Footer } from "../components/blocks/footer";

export default function LandingPage() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-5 focus:top-3 focus:z-50 focus:rounded-control focus:bg-action focus:px-4 focus:py-3 focus:text-data focus:font-semibold focus:text-action-fg"
      >
        Перейти до основного вмісту
      </a>
      <Nav />
      <main id="main-content" tabIndex={-1} className="overflow-x-clip">
        <Hero />
        <Sources />
        <SectionRule index={c.problem.rule.index} label={c.problem.rule.label} />
        <Problem />
        <SectionRule index={c.compare.rule.index} label={c.compare.rule.label} />
        <Compare />
        <SectionRule index={c.roles.rule.index} label={c.roles.rule.label} />
        <Roles />
        <SectionRule index={c.route.rule.index} label={c.route.rule.label} />
        <Route />
        <Position />
        <SectionRule index={c.capture.rule.index} label={c.capture.rule.label} />
        <Capture />
        <SectionRule index={c.provenance.rule.index} label={c.provenance.rule.label} />
        <Provenance />
        <SectionRule index={c.pilot.rule.index} label={c.pilot.rule.label} />
        <Pilot />
        <SectionRule index={c.faq.rule.index} label={c.faq.rule.label} />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
```

Placeholders — one file each for `hero`, `sources`, `problem`, `compare`, `roles`, `route`, `position`, `capture`, `provenance`, `pilot`, `faq`, `cta` in `components/blocks/`, of this exact shape (ids as listed in the Interfaces; `hero` uses `<h1>`, the others `<h2>`):

```tsx
import { landingContent } from "../../content/landing-content";

export function Compare() {
  return (
    <section id="compare" className="scroll-mt-20 px-4 py-16 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <h2 className="display text-mkt-display-2 text-ink">{landingContent.compare.title}</h2>
      </div>
    </section>
  );
}
```

(`position` renders `id="position"`, `provenance` renders `id="trust"`, `route` renders `id="stages"`, `cta` renders `id="cta-final"`; `sources` renders `<div id="sources" aria-hidden="true">` with no heading; `hero` renders `<section id="hero">` with `<h1>`.)

- [ ] **Step 8: Run** — `pnpm --filter @goproceed/landing exec vitest run && pnpm --filter @goproceed/landing typecheck && pnpm --filter @goproceed/landing build` → PASS (render skeleton, design contract, content, request, metadata, brand, ui-components, use-reduced).

- [ ] **Step 9: Commit** — `git add -A apps/landing && git commit -m "feat(landing): the Daylight skeleton — layout, dot field, header, footer, section rules, placeholder blocks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"`

---

### Task 16: Hero with the product frame, and the sources row

**Files:**
- Replace: `components/blocks/hero.tsx`, `components/blocks/sources.tsx`
- Create: `components/visuals/product-frame.tsx`, `components/visuals/board.tsx`, `components/visuals/receipt.tsx`
- Test: append to `tests/landing-render.test.tsx`

**Interfaces:**
- Consumes: `Pill`, `PillContent`, `Button` (`size="lg"`), `Chip` (`dot`), `ScrollSettle`, `TextBlurIn`, `Reveal`, `Stagger`, `StaggerItem`, `CountUp`.
- Produces: `<section id="hero">`, `<div id="sources">`.

- [ ] **Step 1: Failing tests** (append; `html`/`section` are exported by the skeleton test file)

```tsx
describe("hero and sources", () => {
  const hero = section("hero", "sources");
  it("opens with the pill, the accented promise, two actions and three facts", () => {
    expect(hero).toContain('data-slot="pill"');
    expect(hero).toContain('data-accent="true">доказ</span>');
    expect(hero).toContain('href="#pilot"');
    expect(hero).toContain('href="#compare"');
    for (const f of landingContent.hero.facts) expect(hero).toContain(f.value);
  });
  it("shows the board with three columns, the selected card, the receipt and the beam", () => {
    expect(hero).toContain('aria-label="Стан пакету робіт у веб-застосунку GoProceed"');
    expect(hero).toContain("Готово");
    expect(hero).toContain("На розгляді");
    expect(hero).toContain("Заблоковано");
    expect(hero).toContain('data-board-card="selected"');
    expect(hero).toContain('aria-label="Квитанція доказу EV-0248"');
    expect(hero).toContain('class="beam"');
    expect(hero).toContain(landingContent.hero.dimension);
  });
  it("lists the six requirement sources", () => {
    const sources = section("sources", "problem");
    for (const s of landingContent.sources.items) expect(sources).toContain(s.code);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Visuals**

`components/visuals/board.tsx`:

```tsx
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
            <Stagger className="grid gap-2">
              {col.cards.map((card) => (
                <StaggerItem key={card.code}>
                  <article
                    data-board-card={card.selected ? "selected" : "card"}
                    className={card.selected
                      ? "grid gap-1.5 rounded-field border border-line-accent bg-surface p-2.5 text-meta ring-3 ring-accent-soft"
                      : "grid gap-1.5 rounded-field border border-line bg-surface p-2.5 text-meta"}
                  >
                    <span className="font-mono text-micro text-ink-muted">{card.code}</span>
                    <span className="font-medium leading-snug text-ink">{card.title}</span>
                    <Chip tone={card.tone} dot className="w-fit px-2 py-0.5 text-micro">{card.tag}</Chip>
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
```

(`ring-3 ring-accent-soft` — Tailwind's ring colour reads the colour namespace, so the role resolves.)

`components/visuals/receipt.tsx`:

```tsx
import Image from "next/image";
import { demoRecords } from "../../content/demo-records";
import photoThumb from "../../public/images/photo-tray-thumb.jpg";

/** The EV-0248 receipt that floats over the board's corner. Demonstration data. */
export function Receipt() {
  const r = demoRecords.receipt;
  return (
    <aside aria-label="Квитанція доказу EV-0248" className="w-full rounded-card border border-line-strong bg-surface p-3.5 text-meta shadow-float md:absolute md:-bottom-20 md:right-[-3%] md:w-[236px]">
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
```

`components/visuals/product-frame.tsx`:

```tsx
import { Reveal, ScrollSettle, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { demoRecords } from "../../content/demo-records";
import { landingContent } from "../../content/landing-content";
import { Board } from "./board";
import { Receipt } from "./receipt";

/** 21st.dev's Container Scroll: the board settles into the page; the receipt and two pills sit over it. */
export function ProductFrame() {
  const pills = demoRecords.receipt.pills;
  return (
    <Reveal delay={0.35} className="mt-11 md:mt-16">
      <ScrollSettle className="pb-4 md:pb-24">
        <div className="relative mx-auto max-w-[1040px]">
          <Board />
          <Receipt />
          <Stagger step="loose" className="hidden md:contents">
            <StaggerItem className="absolute -bottom-9 left-0 whitespace-nowrap rounded-pill border border-line-strong bg-surface px-3 py-1.5 text-data text-ink-secondary shadow-overlay">
              <b className="font-medium text-ink">{pills[0]!.lead}</b> {pills[0]!.text}
            </StaggerItem>
            <StaggerItem className="absolute -top-12 left-0 whitespace-nowrap rounded-pill border border-line-strong bg-surface px-3 py-1.5 text-data text-ink-secondary shadow-overlay">
              {pills[1]!.text}<b className="font-medium text-ink">{pills[1]!.lead}</b>
            </StaggerItem>
          </Stagger>
        </div>
        <p aria-hidden="true" className="mt-24 hidden items-center gap-2.5 font-mono text-micro uppercase tracking-wide text-ink-subtle md:flex">
          <span className="h-px flex-1 bg-line-strong" />
          {landingContent.hero.dimension}
          <span className="h-px flex-1 bg-line-strong" />
        </p>
      </ScrollSettle>
    </Reveal>
  );
}
```

(`md:contents` on the Stagger wrapper lets the absolutely positioned pills position against the frame; below `md` they are hidden as in the prototype.)

- [ ] **Step 4: Blocks**

`components/blocks/hero.tsx`:

```tsx
import { ArrowRight } from "lucide-react";
import { Button, Pill, PillContent } from "@goproceed/ui/components";
import { Reveal, TextBlurIn } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { ProductFrame } from "../visuals/product-frame";

export function Hero() {
  const h = landingContent.hero;
  return (
    <section id="hero" className="px-4 pt-32 md:px-8 md:pt-36">
      <div className="mx-auto max-w-marketing">
        <div className="mx-auto grid max-w-[780px] justify-items-center text-center">
          <Reveal>
            <Pill asChild>
              <a href={h.pill.href}><PillContent badge={h.pill.badge}>{h.pill.text}</PillContent></a>
            </Pill>
          </Reveal>
          <h1 className="display mt-5 max-w-[16ch] text-mkt-display-1 tracking-tightest text-ink">
            <TextBlurIn text={h.title.slice(0, h.title.indexOf(h.titleAccent))} />
            <span className="text-accent" data-accent="true">{h.titleAccent}</span>
            <TextBlurIn text={h.title.slice(h.title.indexOf(h.titleAccent) + h.titleAccent.length)} delay={0.4} />
          </h1>
          <Reveal delay={0.15}><p className="measure mt-5 text-mkt-lead leading-relaxed text-ink-secondary">{h.lead}</p></Reveal>
          <Reveal delay={0.25} className="mt-6 flex flex-wrap justify-center gap-2.5">
            <Button asChild size="lg"><a href="#pilot">{h.primaryAction}</a></Button>
            <Button asChild size="lg" variant="outline">
              <a href={h.secondaryHref}>{h.secondaryAction}<ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.6} /></a>
            </Button>
          </Reveal>
          <Reveal delay={0.3} className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-left text-data text-ink-muted">
            {h.facts.map((f) => (
              <p key={f.value}><b className="block font-medium text-ink">{f.value}</b>{f.label}</p>
            ))}
          </Reveal>
        </div>
        <ProductFrame />
      </div>
    </section>
  );
}
```

`TextBlurIn` renders an `as="span"` by default; the h1 is the one accessible node and the accent span sits between two blur-in spans — the sr-only copies inside each `TextBlurIn` plus the accent read as the whole sentence. `AccentText` is not used here because the two halves animate separately.

`components/blocks/sources.tsx`:

```tsx
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";

/** The requirement sources: a static six-cell grid (the prototype's `.marq`, which is not a marquee). */
export function Sources() {
  const s = landingContent.sources;
  return (
    <div id="sources" aria-hidden="true" className="border-t border-line px-4 md:px-8">
      <Reveal className="mx-auto max-w-marketing">
        <p className="index-label pt-3.5">{s.label}</p>
        <ul className="grid grid-cols-2 gap-y-3 py-2.5 pb-4 md:grid-cols-3 wide:grid-cols-6">
          {s.items.map((item, i) => (
            <li key={item.code} className={i === 0 ? "grid gap-0.5 pr-3.5 text-meta leading-snug text-ink-muted" : "grid gap-0.5 border-l border-line pl-3 pr-3.5 text-meta leading-snug text-ink-muted"}>
              <b className="font-mono text-micro font-medium tracking-wide text-ink">{item.code}</b>
              {item.title}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
```

- [ ] **Step 5: Run** — landing tests + typecheck + `node packages/testing/qa/motion-audit.mjs` → PASS, clean.

- [ ] **Step 6: Commit** — `feat(landing): hero — pill, promise, three facts, the product frame settling in; the sources row`.

---

### Task 17: Problem (statement + Рис. 01) and Compare

**Files:**
- Replace: `components/blocks/problem.tsx`, `components/blocks/compare.tsx`
- Create: `components/visuals/fig-01.tsx`
- Test: append to `tests/landing-render.test.tsx`

**Interfaces:**
- Consumes: `ScrollTint` (its one use), `Reveal`, `Stagger`, `ComparePair`, `CompareCard`, `CompareArrow`, `Chip`.

- [ ] **Step 1: Failing tests**

```tsx
describe("problem and compare", () => {
  const problem = section("problem", "compare");
  const compare = section("compare", "roles");
  it("tints the statement and shows Рис. 01 with the found message and the record", () => {
    expect(problem).toContain(landingContent.problem.statement);
    expect(problem).toContain("Рис. 01");
    expect(problem).toContain('data-message="hit"');
    for (const m of ["без осі", "без вимоги", "без рішення"]) expect(problem).toContain(m);
    expect(problem).toContain("DR-0091 · прийнято технаглядом · 16:18");
  });
  it("pairs five rows across the two cards and states both outcomes", () => {
    expect(compare.match(/data-compare-row=/g)).toHaveLength(10);
    expect(compare).toContain(landingContent.compare.was.outcome);
    expect(compare).toContain(landingContent.compare.now.outcome);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Рис. 01**

`components/visuals/fig-01.tsx`:

```tsx
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
    <figure className="mt-8 overflow-hidden rounded-card border border-line-strong bg-surface md:mt-12">
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
                  <span className="font-mono text-micro text-ink-subtle">{m.who}</span>
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
                    <span className="block text-right font-mono text-micro text-ink-subtle">{m.time}</span>
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
```

- [ ] **Step 4: Blocks**

`components/blocks/problem.tsx`:

```tsx
import { Reveal, ScrollTint } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { Fig01 } from "../visuals/fig-01";

export function Problem() {
  const p = landingContent.problem;
  return (
    <section id="problem" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <div className="grid gap-8 wide:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] wide:items-end wide:gap-16">
          <ScrollTint text={p.statement} className="display max-w-[20ch] text-mkt-display-2 leading-tight text-ink" />
          <Reveal><p className="max-w-[34ch] text-body leading-relaxed text-ink-secondary">{p.aside}</p></Reveal>
        </div>
        <Reveal y={0}><Fig01 /></Reveal>
      </div>
    </section>
  );
}
```

`components/blocks/compare.tsx`:

```tsx
import { CompareArrow, CompareCard, ComparePair } from "@goproceed/ui/components";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionHead } from "./section-head";

export function Compare() {
  const c = landingContent.compare;
  return (
    <section id="compare" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={c.eyebrow} title={c.title} titleAccent={c.titleAccent} lead={c.lead} />
        <Reveal y={0}>
          <ComparePair>
            <CompareCard tone="was" eyebrow={c.was.eyebrow} title={c.was.title} rows={[...c.was.rows]} outcome={c.was.outcome} />
            <CompareArrow />
            <CompareCard tone="now" eyebrow={c.now.eyebrow} title={c.now.title} rows={c.now.rows.map((r) => ({ ...r }))} outcome={c.now.outcome} />
          </ComparePair>
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run** tests + typecheck + audit → PASS.

- [ ] **Step 6: Commit** — `feat(landing): 01 Проблема with Рис. 01, and 02 Було і стало`.

---

### Task 18: Roles and the route stack

**Files:**
- Replace: `components/blocks/roles.tsx`, `components/blocks/route.tsx`
- Create: `components/visuals/ui-window.tsx` (shared chrome), `ui-requirement.tsx`, `ui-capture.tsx`, `ui-review.tsx`, `ui-closure.tsx`, `ui-act.tsx`
- Test: append

**Interfaces:**
- Consumes: `FeatureGrid`, `FeatureCell`, `Chip`, `Stagger`, `StaggerItem`, `Reveal`.
- Produces: `UiWindow({ title, tag, children })` — the white window with its header used by the five route visuals.

- [ ] **Step 1: Failing tests**

```tsx
describe("roles and route", () => {
  const roles = section("roles", "stages");
  const route = section("stages", "position");
  it("renders the four role cells with pains and gains", () => {
    expect(roles.match(/data-slot="feature-cell"/g)).toHaveLength(4);
    for (const cell of landingContent.roles.cells) { expect(roles).toContain(cell.title); expect(roles).toContain(cell.pain); }
    expect(roles).toContain("Telegram-бот або мобільний застосунок, без форм");
  });
  it("stacks five route cards, alternating sides, each with its window", () => {
    expect(route.match(/data-route-card=/g)).toHaveLength(5);
    expect(route.match(/data-route-card="flip"/g)).toHaveLength(2);
    for (const s of landingContent.route.steps) expect(route).toContain(s.eyebrow);
    for (const code of ["R-041 · Кабельний лоток до закриття стелі", "Зняти фото", "goproceed.app/r/7k2…f9", "Закриття · CL-017", "ЧЕРНЕТКА"]) expect(route).toContain(code);
    expect(route).toContain("Це чернетка для підпису, а не підписаний документ.");
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Roles block**

```tsx
import { Building2, ClipboardList, ShieldCheck, Smartphone } from "lucide-react";
import { FeatureCell, FeatureGrid } from "@goproceed/ui/components";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionHead } from "./section-head";

const ICON = {
  pto: <ClipboardList aria-hidden="true" strokeWidth={1.6} />,
  foreman: <Smartphone aria-hidden="true" strokeWidth={1.6} />,
  owner: <Building2 aria-hidden="true" strokeWidth={1.6} />,
  supervision: <ShieldCheck aria-hidden="true" strokeWidth={1.6} />,
} as const;

export function Roles() {
  const r = landingContent.roles;
  return (
    <section id="roles" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={r.eyebrow} title={r.title} titleAccent={r.titleAccent} lead={r.lead} />
        <Reveal y={0}>
          <FeatureGrid columns={4}>
            {r.cells.map((cell) => (
              <FeatureCell
                key={cell.id}
                icon={ICON[cell.id as keyof typeof ICON]}
                title={cell.title}
                subtitle={cell.subtitle}
                footer={cell.gets.map((g) => <span key={g}><span className="text-ink-muted">→ </span>{g}</span>)}
              >
                {cell.pain}
              </FeatureCell>
            ))}
          </FeatureGrid>
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: The window chrome and five visuals**

`components/visuals/ui-window.tsx`:

```tsx
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
```

`ui-requirement.tsx`:

```tsx
import { demoRecords } from "../../content/demo-records";
import { KeyValue, RuleBox, UiWindow } from "./ui-window";

export function UiRequirement() {
  const r = demoRecords.route.requirement;
  return (
    <UiWindow title={r.title} tag={r.tag}>
      <div>{r.rows.map((row, i) => <KeyValue key={row.label} label={row.label} value={row.value} first={i === 0} />)}</div>
      <RuleBox lead={r.rule.lead} text={r.rule.text} />
    </UiWindow>
  );
}
```

`ui-capture.tsx`:

```tsx
import Image from "next/image";
import { demoRecords } from "../../content/demo-records";
import photoThumb from "../../public/images/photo-tray-thumb.jpg";
import { KeyValue, UiWindow } from "./ui-window";

export function UiCapture() {
  const c = demoRecords.route.capture;
  return (
    <UiWindow title={c.title} tag={c.tag}>
      <div className="grid gap-5 md:grid-cols-[200px_1fr] md:items-start">
        <div className="mx-auto w-full max-w-[200px] rounded-section bg-inverse p-2 shadow-float" style={{ aspectRatio: "9 / 17" }}>
          <div className="grid h-full content-start gap-1.5 rounded-surface bg-canvas px-2.5 pb-2.5 pt-6 text-micro text-ink-secondary">
            <span className="text-meta font-semibold text-ink">{c.phone.work}</span>
            <span className="grid gap-0.5 rounded-field border border-line bg-surface px-2 py-1.5"><span>{c.phone.requirementLabel}</span><b className="font-medium text-ink">{c.phone.requirement}</b></span>
            <span className="landing-photo grid h-[86px] items-end p-1.5"><Image src={photoThumb} alt="" fill sizes="200px" className="object-cover" /><span className="relative z-10 text-surface">{c.phone.shot}</span></span>
            <span className="rounded-panel bg-action py-1.5 text-center font-medium text-action-fg">{c.phone.action}</span>
          </div>
        </div>
        <div>{c.rows.map((row, i) => <KeyValue key={row.label} label={row.label} value={row.value} first={i === 0} />)}</div>
      </div>
    </UiWindow>
  );
}
```

(`style={{ aspectRatio }}` is a layout number; the `aspect-*` namespace is cleared by the theme.)

`ui-review.tsx`:

```tsx
import { demoRecords } from "../../content/demo-records";
import { KeyValue, UiWindow } from "./ui-window";

export function UiReview() {
  const r = demoRecords.route.review;
  return (
    <UiWindow title={r.title} tag={r.tag}>
      <div className="overflow-hidden rounded-card border border-line">
        <p className="flex items-center gap-2 bg-subtle px-3 py-2 font-mono text-micro text-ink-muted"><i className="size-2 rounded-pill bg-status-ready-fg" />{r.url}</p>
        <div className="grid gap-2.5 p-3.5">
          {r.rows.map((row, i) => <KeyValue key={row.label} label={row.label} value={row.value} first={i === 0} />)}
          <div className="flex flex-wrap gap-2">
            {r.actions.map((a) => (
              <span key={a.label} className={"active" in a && a.active ? "rounded-field bg-action px-3 py-1.5 text-data font-medium text-action-fg" : "rounded-field border border-line-strong px-3 py-1.5 text-data text-ink"}>{a.label}</span>
            ))}
          </div>
        </div>
      </div>
      <p className="text-data">{r.decision}</p>
    </UiWindow>
  );
}
```

`ui-closure.tsx`:

```tsx
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
```

`ui-act.tsx`:

```tsx
import { demoRecords } from "../../content/demo-records";
import { UiWindow } from "./ui-window";

export function UiAct() {
  const a = demoRecords.route.act;
  return (
    <UiWindow title={a.title} tag={a.tag}>
      <div className="relative rounded-panel border border-line bg-canvas px-4 py-4 text-data">
        <span aria-hidden="true" className="absolute right-4 top-3 rotate-[4deg] rounded-control border-[1.5px] border-status-attention-fg bg-surface px-2 py-0.5 font-mono text-micro tracking-[0.12em] text-status-attention-fg">{a.stamp}</span>
        <h5 className="mb-2.5 text-body font-semibold text-ink">{a.heading}</h5>
        {a.rows.map((row) => (
          <p key={row.label} className="grid grid-cols-[110px_1fr] gap-2.5 border-t border-dashed border-line-strong py-1.5 text-ink-secondary">
            <span>{row.label}</span><b className="font-medium text-ink">{row.value}</b>
          </p>
        ))}
      </div>
    </UiWindow>
  );
}
```

- [ ] **Step 5: The route block**

```tsx
import type { ReactNode } from "react";
import { Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { AccentText } from "./accent-text";
import { SectionHead } from "./section-head";
import { UiAct } from "../visuals/ui-act";
import { UiCapture } from "../visuals/ui-capture";
import { UiClosure } from "../visuals/ui-closure";
import { UiRequirement } from "../visuals/ui-requirement";
import { UiReview } from "../visuals/ui-review";

const MEDIA: ReactNode[] = [<UiRequirement key="1" />, <UiCapture key="2" />, <UiReview key="3" />, <UiClosure key="4" />, <UiAct key="5" />];

/** Fora's sticky feature stack: five cards, sides alternating, each pinned under the header on wide screens (CSS only). */
export function Route() {
  const r = landingContent.route;
  return (
    <section id="stages" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={r.eyebrow} title={r.title} titleAccent={r.titleAccent} lead={r.lead}>
          <p className="mt-4 flex flex-wrap gap-1.5">
            {r.codes.map((c) => (
              <span key={c.code} className="rounded-control border border-line bg-surface px-2.5 py-1 text-meta text-ink-muted">
                <b className="mr-1.5 font-mono font-medium text-ink">{c.code}</b>{c.label}
              </span>
            ))}
          </p>
        </SectionHead>
        <Stagger className="grid gap-4">
          {r.steps.map((step, i) => {
            const flip = i % 2 === 1;
            return (
              <StaggerItem key={step.index}>
                <article
                  data-route-card={flip ? "flip" : "card"}
                  className="landing-route-card grid overflow-hidden rounded-surface border border-line-strong bg-surface shadow-float wide:min-h-[min(600px,calc(100vh-130px))] wide:grid-cols-2"
                >
                  <div className={flip ? "flex flex-col gap-4 p-6 md:p-10 wide:order-2" : "flex flex-col gap-4 p-6 md:p-10"}>
                    <p className="flex items-center gap-2.5">
                      <span className="rounded-control border border-line-strong px-1.5 py-0.5 font-mono text-meta tracking-wide text-ink-muted">{step.index}</span>
                      <span className="index-label">{step.eyebrow}</span>
                    </p>
                    <h3 className="display max-w-[16ch] text-mkt-display-3 leading-tight tracking-tight text-ink">
                      <AccentText text={step.title} accent={step.titleAccent} />
                    </h3>
                    <p className="max-w-[44ch] text-body leading-relaxed text-ink-secondary">{step.body}</p>
                    <p className="mt-auto flex items-center gap-2.5 border-t border-line pt-5 text-data text-ink-muted">
                      <i aria-hidden="true" className="size-3.5 rounded-control border border-line-strong" />{step.note}
                    </p>
                  </div>
                  <div className={flip
                    ? "landing-media-grid relative isolate grid place-items-center border-t border-line bg-subtle p-5 md:p-10 wide:order-1 wide:border-r wide:border-t-0"
                    : "landing-media-grid relative isolate grid place-items-center border-t border-line bg-subtle p-5 md:p-10 wide:border-l wide:border-t-0"}>
                    {MEDIA[i]}
                  </div>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
```

The prototype's five gradient tints are not carried; the media half is `bg-subtle` with the drafting grid (deviation noted in the docs task).

- [ ] **Step 6: Run** tests + typecheck + audit → PASS.

- [ ] **Step 7: Commit** — `feat(landing): 03 Ролі as grid feature cells, 04 Маршрут as five sticky cards with their windows`.

---

### Task 19: Position, capture channels, provenance bento

**Files:**
- Replace: `components/blocks/position.tsx`, `capture.tsx`, `provenance.tsx`
- Create: `components/visuals/channel-telegram.tsx`, `channel-app.tsx`, `channel-web.tsx`, `access-matrix.tsx`
- Test: append

**Interfaces:**
- Consumes: `FeatureCell`-free — the channel cards are `bg-canvas` cards with the `spotlight` utility applied by a small client wrapper `SpotlightCard`; `Bento`, `BentoCell`, `Chip`, `Reveal`, `Stagger`, `StaggerItem`.

- [ ] **Step 1: Failing tests**

```tsx
describe("position, capture, provenance", () => {
  const position = section("position", "capture");
  const capture = section("capture", "trust");
  const trust = section("trust", "pilot");
  it("states the position with three pills", () => {
    expect(position).toContain(landingContent.position.quote);
    expect(position.match(/data-position-pill=/g)).toHaveLength(3);
  });
  it("shows the two foreman channels, the office web app and the converging record", () => {
    for (const ch of landingContent.capture.channels) expect(capture).toContain(ch.title);
    expect(capture).toContain("Збережено як");
    expect(capture).toContain("очікує мережу");
    expect(capture).toContain("EV-0248");
  });
  it("renders the access matrix, immutability and the limits of v0.1", () => {
    expect(trust.match(/data-slot="bento-cell"/g)).toHaveLength(3);
    expect(trust.match(/data-access=/g)).toHaveLength(28);
    expect(trust).toContain("Історія подій не редагується, лише доповнюється");
    expect(trust).toContain("Чернетка акта не є підписаним документом");
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Position**

```tsx
import { Check, Lock } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { AccentText } from "./accent-text";

const ICON = {
  no: <i aria-hidden="true" className="size-4 rounded-pill border-[1.5px] border-line-strong bg-[linear-gradient(135deg,transparent_44%,var(--gp-border-strong)_44%_56%,transparent_56%)]" />,
  yes: <span className="grid size-4 place-items-center rounded-pill border-[1.5px] border-status-ready-fg text-status-ready-fg"><Check aria-hidden="true" strokeWidth={2} className="size-2.5" /></span>,
  lock: <span className="grid size-4 place-items-center rounded-pill border-[1.5px] border-ink-muted text-ink-secondary"><Lock aria-hidden="true" strokeWidth={1.75} className="size-2.5" /></span>,
} as const;

export function Position() {
  const p = landingContent.position;
  return (
    <section id="position" className="scroll-mt-20 px-4 pt-10 md:px-8 md:pt-20">
      <div className="mx-auto max-w-marketing">
        <div className="relative border-t border-line px-4 pb-10 pt-14 text-center md:px-15 md:pb-10 md:pt-24">
          <span aria-hidden="true" className="display pointer-events-none absolute left-2 top-5 hidden select-none text-[clamp(120px,16vw,220px)] font-bold leading-[.8] text-accent opacity-10 md:block md:left-6 md:top-10">“</span>
          <span aria-hidden="true" className="display pointer-events-none absolute right-2 top-5 hidden select-none text-[clamp(120px,16vw,220px)] font-bold leading-[.8] text-accent opacity-10 md:block md:right-6 md:top-10">”</span>
          <div className="relative mx-auto grid max-w-[860px] justify-items-center gap-5">
            <Reveal><p className="index-label">{p.eyebrow}</p></Reveal>
            <Reveal>
              <p className="display text-[clamp(24px,3vw,40px)] font-medium leading-tight tracking-tight text-ink">
                <span className="text-ink-muted">{p.quoteDim}</span> <AccentText text={p.quote} accent={p.quoteAccent} />
              </p>
            </Reveal>
            <Stagger className="flex flex-wrap justify-center gap-2">
              {p.pills.map((pill) => (
                <StaggerItem key={pill.text}>
                  <span data-position-pill={pill.kind} className="inline-flex h-(--gp-control-height-desk) items-center gap-2 rounded-pill border border-line-strong bg-surface pl-2.5 pr-3.5 text-data text-ink-secondary">
                    {ICON[pill.kind]}{pill.text}
                  </span>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </div>
    </section>
  );
}
```

(`text-[clamp(120px,16vw,220px)]` is the one arbitrary size on the page — the giant quote glyphs have no scale step and the alternative is an SVG; `md:px-15` is the spacing scale.)

- [ ] **Step 4: Channel visuals**

`components/visuals/spotlight-card.tsx`:

```tsx
"use client";

import { useCallback, type PointerEvent, type ReactNode } from "react";

/** The channel card's pointer-tracked dot spotlight — the same two variables `FeatureCell` writes. */
export function SpotlightCard({ children, className }: { children: ReactNode; className: string }) {
  const onMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--gp-spot-x", `${((event.clientX - r.left) / r.width) * 100}%`);
    event.currentTarget.style.setProperty("--gp-spot-y", `${((event.clientY - r.top) / r.height) * 100}%`);
  }, []);
  return (
    <article onPointerMove={onMove} className={className}>
      <i aria-hidden="true" className="spotlight -z-10 opacity-0 transition-opacity duration-slow ease-out group-hover:opacity-100" />
      {children}
    </article>
  );
}
```

`channel-telegram.tsx`:

```tsx
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
```

`channel-app.tsx`:

```tsx
import { Chip } from "@goproceed/ui/components";
import { demoRecords } from "../../content/demo-records";

export function ChannelApp() {
  const a = demoRecords.channels.app;
  return (
    <div className="relative w-[min(150px,60%)] rounded-section bg-inverse p-1.5" style={{ aspectRatio: "9 / 16" }}>
      <div className="grid h-full content-start gap-1.5 rounded-surface bg-canvas px-2 pb-2 pt-5 text-micro text-ink-muted">
        <span>{a.header}</span>
        {a.rows.map((r) => <span key={r.title} className="rounded-field border border-line bg-surface px-1.5 py-1"><b className="block font-medium text-ink">{r.title}</b>{r.text}</span>)}
      </div>
      <span className="absolute inset-0 grid place-items-center rounded-section"><Chip tone="review" className="border-transparent bg-action text-action-fg">пілот</Chip></span>
    </div>
  );
}
```

(The prototype blurred the phone under the badge; the badge stays, the blur goes — `backdrop-filter` on a 150px toy is not worth a compositor layer.)

`channel-web.tsx`:

```tsx
import { demoRecords } from "../../content/demo-records";

export function ChannelWeb() {
  return (
    <div className="grid w-full gap-1.5 rounded-panel border border-line-strong bg-surface p-2.5 text-micro text-ink-secondary shadow-float">
      <span className="flex gap-1">{[0, 1, 2].map((i) => <i key={i} className="size-1.5 rounded-pill bg-line-strong" />)}</span>
      {demoRecords.channels.web.map((r) => (
        <span key={r.left} className="flex justify-between rounded-field border border-line px-2 py-1.5"><span>{r.left}</span><b className="font-medium text-ink">{r.right}</b></span>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Capture block**

```tsx
import { Chip } from "@goproceed/ui/components";
import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionHead } from "./section-head";
import { ChannelApp } from "../visuals/channel-app";
import { ChannelTelegram } from "../visuals/channel-telegram";
import { ChannelWeb } from "../visuals/channel-web";
import { SpotlightCard } from "../visuals/spotlight-card";

const DEVICE = { telegram: <ChannelTelegram />, app: <ChannelApp />, web: <ChannelWeb /> } as const;

export function Capture() {
  const c = landingContent.capture;
  return (
    <section id="capture" className="scroll-mt-20 bg-surface px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={c.eyebrow} title={c.title} titleAccent={c.titleAccent} lead={c.lead} />
        <Stagger className="grid gap-3.5 md:grid-cols-3">
          {c.channels.map((ch) => (
            <StaggerItem key={ch.id}>
              <SpotlightCard className="group relative isolate grid h-full grid-rows-[auto_1fr_auto] gap-4 overflow-hidden rounded-surface border border-line-strong bg-canvas p-5.5">
                <p className="flex items-center justify-between"><span className="index-label">{ch.index}</span><Chip tone={ch.status.tone} dot>{ch.status.label}</Chip></p>
                <div>
                  <h3 className="mt-2 max-w-[16ch] text-h3 font-semibold text-ink">{ch.title}</h3>
                  <p className="mt-2 max-w-[34ch] text-data leading-relaxed text-ink-secondary">{ch.body}</p>
                  <div className="grid place-items-center py-6">{DEVICE[ch.id]}</div>
                </div>
                <p className="text-meta text-ink-muted">{ch.foot}</p>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="grid justify-items-center">
          <svg aria-hidden="true" viewBox="0 0 1000 96" preserveAspectRatio="none" className="hidden h-24 w-full md:block">
            <path d="M167 0C167 70 500 30 500 96" className="fill-none stroke-ink-subtle" strokeWidth="1.2" strokeDasharray="4 7" />
            <path d="M500 0V96" className="fill-none stroke-ink-subtle" strokeWidth="1.2" strokeDasharray="4 7" />
            <path d="M833 0C833 70 500 30 500 96" className="fill-none stroke-ink-subtle" strokeWidth="1.2" strokeDasharray="4 7" />
          </svg>
          <p className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-pill border border-line-strong bg-canvas px-3.5 py-2 text-center text-data text-ink-secondary md:mt-0">
            <i className="size-1.5 rounded-pill bg-status-ready-fg" /><b className="font-medium text-ink">{c.converge.code}</b> · {c.converge.text}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Access matrix and the provenance block**

`components/visuals/access-matrix.tsx`:

```tsx
import { landingContent, type AccessLevel } from "../../content/landing-content";

const DOT: Record<AccessLevel, string> = {
  full: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-status-ready-fg bg-status-ready-fg",
  own: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-status-ready-fg bg-[linear-gradient(90deg,var(--gp-status-ready-fg)_50%,transparent_50%)]",
  none: "mx-auto block size-3.5 rounded-pill border-[1.5px] border-line-strong",
};

/** Who sees what — four roles across, seven surfaces down. Colour never alone: the legend names each dot and the cell carries its level as data. */
export function AccessMatrix() {
  const a = landingContent.provenance.access;
  return (
    <div className="grid self-start text-data">
      <div className="grid grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] items-center gap-1.5 pb-3">
        <span />
        {a.columns.map((c) => <span key={c} className="text-center font-mono text-[9.5px] uppercase leading-tight tracking-wide text-ink-muted [overflow-wrap:anywhere]">{c}</span>)}
      </div>
      {a.rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] items-center gap-1.5 border-t border-line py-3">
          <span className="text-ink-secondary">{row.label}</span>
          {row.cells.map((level, i) => <i key={i} data-access={level} aria-label={a.legend[level]} className={DOT[level]} />)}
        </div>
      ))}
      <p className="flex flex-wrap gap-3.5 pt-3 text-meta text-ink-muted">
        {(["full", "own", "none"] as const).map((l) => <span key={l} className="inline-flex items-center gap-1.5"><i className={DOT[l].replace("mx-auto ", "")} />{a.legend[l]}</span>)}
      </p>
    </div>
  );
}
```

(`text-[9.5px]` is the prototype's matrix header size; below `micro`. It is aria-labelled dots and uppercase mono — the one sub-11px size on the page, and it sits nowhere near `/app`.)

`components/blocks/provenance.tsx`:

```tsx
import { Check, Minus } from "lucide-react";
import { Bento, BentoCell } from "@goproceed/ui/components";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionHead } from "./section-head";
import { AccessMatrix } from "../visuals/access-matrix";

export function Provenance() {
  const p = landingContent.provenance;
  return (
    <section id="trust" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={p.eyebrow} title={p.title} titleAccent={p.titleAccent} lead={p.lead} />
        <Reveal y={0}>
          <Bento>
              <BentoCell span="rows-2" className="md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)] md:items-start md:gap-10">
                <div>
                  <p className="index-label">{p.access.eyebrow}</p>
                  <h3 className="mt-2 max-w-[20ch] text-h2 font-semibold tracking-tight text-ink">{p.access.title}</h3>
                  <p className="mt-2 text-data leading-relaxed text-ink-secondary">{p.access.body}</p>
                  <p className="mt-2 text-meta text-ink-muted">{p.access.small}</p>
                </div>
                <AccessMatrix />
              </BentoCell>
              <BentoCell eyebrow={p.immutability.eyebrow} title={p.immutability.title}>
                <ul className="grid gap-2.5 text-data text-ink-secondary">
                  {p.immutability.items.map((t) => <li key={t} className="grid grid-cols-[16px_1fr] gap-2.5"><Check aria-hidden="true" strokeWidth={2} className="mt-0.5 size-3.5 rounded-control border-[1.5px] border-ink p-px text-ink" />{t}</li>)}
                </ul>
              </BentoCell>
              <BentoCell eyebrow={p.limits.eyebrow} title={p.limits.title}>
                <div className="grid gap-3.5 md:grid-cols-2">
                  <ul className="grid gap-2 text-data text-ink-secondary">
                    {p.limits.does.map((t) => <li key={t} className="grid grid-cols-[14px_1fr] gap-2"><i className="mt-0.5 size-3 rounded-pill border-[1.5px] border-status-ready-fg" />{t}</li>)}
                  </ul>
                  <ul className="grid gap-2 text-data text-ink-secondary">
                    {p.limits.doesNot.map((t) => <li key={t} className="grid grid-cols-[14px_1fr] gap-2"><Minus aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-3 rounded-pill border-[1.5px] border-line-strong text-ink-subtle" />{t}</li>)}
                  </ul>
                </div>
              </BentoCell>
          </Bento>
        </Reveal>
      </div>
    </section>
  );
}
```

(One `Reveal` around the whole bento: a `Stagger` would need wrappers between the grid and its cells, and a wrapper with `display: contents` cannot carry the transform the stagger animates. `BentoCell` renders `data-slot="bento-cell"` three times — the test count.)

- [ ] **Step 7: Run** tests + typecheck + audit → PASS. If `primitive-leak` flags `--gp-status-ready-fg`: it does not — that is a role, and the regex matches `--gp-<ramp>-<digits>` only.

- [ ] **Step 8: Commit** — `feat(landing): the position, 05 Фіксація channels, 06 Походження bento`.

---

### Task 20: The pilot block and the form (client)

**Files:**
- Replace: `components/blocks/pilot.tsx`
- Create: `components/blocks/pilot-form.tsx` (client)
- Modify: `apps/landing/package.json` (devDependencies: `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` at the versions `apps/app` carries)
- Test: append to `tests/landing-render.test.tsx`; create `tests/pilot-form.test.tsx`

**Interfaces:**
- Consumes: `Stepper`, `Step`, `Button`, `Input`, `Textarea`, `Label`, `Select*`, `Reveal`, `Stagger`; `validatePilotFields`, `buildPilotClipboardText`, `buildPilotMailto`, `PILOT_EMAIL`.
- Produces: `PilotForm()` — posts JSON `{ name, company, contact, role, context, website }` to `/api/pilot`; `data-form-state` ∈ `idle | sending | sent | failed` on the `<form>`.

- [ ] **Step 1: Failing tests**

Append to `landing-render.test.tsx`:

```tsx
describe("pilot", () => {
  const pilot = section("pilot", "faq");
  it("walks the four steps, the three cards and the author note", () => {
    expect(pilot.match(/data-slot="step"/g)).toHaveLength(4);
    for (const box of [landingContent.pilot.needs, landingContent.pilot.gets, landingContent.pilot.terms]) expect(pilot).toContain(box.title);
    expect(pilot).toContain(landingContent.pilot.author.signature);
    expect(pilot).toContain("пілот безкоштовний");
  });
  it("renders an honest form: labelled fields, a hidden honeypot, a live region, no success text", () => {
    expect(pilot).toContain("<form");
    expect(pilot).toContain('name="name"');
    expect(pilot).toContain('name="contact"');
    expect(pilot).toContain('name="website"');
    expect(pilot).toContain('tabindex="-1"');
    expect(pilot).toContain('aria-live="polite"');
    expect(pilot).toContain('data-form-state="idle"');
    expect(pilot).not.toContain(landingContent.pilot.form.sent);
  });
});
```

Create `tests/pilot-form.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { PilotForm } from "../components/blocks/pilot-form";
import { landingContent } from "../content/landing-content";
import { PILOT_EMAIL } from "../content/pilot-request";

afterEach(cleanup);

const f = landingContent.pilot.form;
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(f.fields.name.label), "Ірина");
  await user.type(screen.getByLabelText(f.fields.contact.label), "@iryna");
}

describe("PilotForm", () => {
  it("posts JSON and shows the sent state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, via: ["telegram"] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: f.submit }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(f.sent));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/pilot");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ name: "Ірина", contact: "@iryna", website: "" });
    expect(screen.getByRole("form")).toHaveAttribute("data-form-state", "sent");
  });

  it("falls back to the clipboard and the mail client when the server fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "delivery" }), { status: 502 })));
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: f.submit }));
    await waitFor(() => expect(screen.getByRole("form")).toHaveAttribute("data-form-state", "failed"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`Надіслати на: ${PILOT_EMAIL}`));
    expect(screen.getByRole("link", { name: f.mail })).toHaveAttribute("href", expect.stringContaining(`mailto:${PILOT_EMAIL}`));
    expect(screen.getByRole("status")).toHaveTextContent(PILOT_EMAIL);
  });

  it("does not post when a required field is empty, and focuses it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PilotForm />);
    await user.type(screen.getByLabelText(f.fields.name.label), "Ірина");
    await user.click(screen.getByRole("button", { name: f.submit }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(f.fields.contact.label)).toHaveFocus();
  });

  it("copies the request text on demand", async () => {
    const user = userEvent.setup();
    render(<PilotForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: f.copy }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Ім'я: Ірина"));
    await waitFor(() => expect(screen.getByRole("button", { name: f.copied })).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Install the test deps and run**

```bash
pnpm --filter @goproceed/landing add -D jsdom@^30.0.1 @testing-library/react@^16.3.3 @testing-library/user-event@^14.6.6 @testing-library/jest-dom@^7.0.1
pnpm --filter @goproceed/landing exec vitest run tests/pilot-form.test.tsx tests/landing-render.test.tsx
```

Expected: FAIL (no `PilotForm`).

- [ ] **Step 3: The form**

`components/blocks/pilot-form.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, cx } from "@goproceed/ui/components";
import { landingContent } from "../../content/landing-content";
import {
  PILOT_EMAIL, buildPilotClipboardText, buildPilotMailto, type PilotFields, validatePilotFields,
} from "../../content/pilot-request";

type FormState = "idle" | "sending" | "sent" | "failed";
const f = landingContent.pilot.form;
const CONTROL = "h-(--gp-control-height-marketing) bg-canvas";

/**
 * The pilot request. Posts to /api/pilot; on any failure copies the request
 * text to the clipboard and offers the mail client — the prototype's honest
 * fallback. Required fields are checked here before a request is made, and
 * the first empty one takes focus. One live region announces every state.
 */
export function PilotForm() {
  const [state, setState] = useState<FormState>("idle");
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<string>(f.roles[0]);
  const [fields, setFields] = useState<PilotFields>({ name: "", company: "", contact: "", role: f.roles[0], context: "" });

  const read = (form: HTMLFormElement): PilotFields & { website: string } => {
    const data = new FormData(form);
    const s = (k: string) => String(data.get(k) ?? "");
    return { name: s("name"), company: s("company"), contact: s("contact"), role, context: s("context"), website: s("website") };
  };

  async function copy(text: string): Promise<boolean> {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const all = read(form);
    setFields(all);
    const checked = validatePilotFields(all);
    if (!checked.ok) {
      const first = form.elements.namedItem(all.name ? "contact" : "name");
      if (first instanceof HTMLInputElement) first.focus();
      return;
    }
    setState("sending");
    try {
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(all),
      });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean };
      if (response.ok && json.ok) { setState("sent"); form.reset(); return; }
      throw new Error(String(response.status));
    } catch {
      await copy(buildPilotClipboardText(checked.fields));
      setState("failed");
    }
  }

  async function onCopy() {
    const ok = await copy(buildPilotClipboardText(fields));
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form
      onSubmit={onSubmit}
      onChange={(e) => setFields(read(e.currentTarget))}
      aria-label="Заявка на пілот GoProceed"
      data-form-state={state}
      noValidate
      className="grid gap-3 rounded-surface border border-line-strong bg-surface p-5 shadow-float md:sticky md:top-24 md:p-7"
    >
      <AuthorNote />
      <h3 className="text-h3 font-semibold text-ink">{f.title}</h3>
      <p className="text-data text-ink-muted">{f.note}</p>
      <label className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden="true">
        Website<input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="pilot-name">{f.fields.name.label}</Label>
          <Input id="pilot-name" name="name" required autoComplete="name" placeholder={f.fields.name.placeholder} className={CONTROL} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pilot-company">{f.fields.company.label}</Label>
          <Input id="pilot-company" name="company" autoComplete="organization" placeholder={f.fields.company.placeholder} className={CONTROL} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="pilot-role">{f.fields.role.label}</Label>
          <Select value={role} onValueChange={setRole} name="role">
            <SelectTrigger id="pilot-role" className={cx("w-full", CONTROL)}><SelectValue /></SelectTrigger>
            <SelectContent>{f.roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pilot-contact">{f.fields.contact.label}</Label>
          <Input id="pilot-contact" name="contact" required placeholder={f.fields.contact.placeholder} className={CONTROL} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pilot-context">{f.fields.context.label}</Label>
        <Textarea id="pilot-context" name="context" placeholder={f.fields.context.placeholder} className="bg-canvas" />
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Button type="submit" size="lg" disabled={state === "sending"}>{state === "sending" ? f.submitting : f.submit}</Button>
        <Button type="button" size="lg" variant="outline" onClick={onCopy}>{copied ? f.copied : f.copy}</Button>
      </div>
      <p role="status" aria-live="polite" className={state === "sent"
        ? "rounded-card border border-status-ready-line bg-status-ready px-3.5 py-3 text-data text-ink"
        : state === "failed"
          ? "rounded-card border border-status-attention-line bg-status-attention px-3.5 py-3 text-data text-ink"
          : "sr-only"}>
        {state === "sent" && f.sent}
        {state === "failed" && (
          <>
            {f.failed} <a className="font-medium underline underline-offset-4" href={`mailto:${PILOT_EMAIL}`}>{PILOT_EMAIL}</a> {f.failedTail}
            <span className="mt-2 block"><Button asChild variant="outline" size="sm"><a href={buildPilotMailto(fields)}>{f.mail}</a></Button></span>
          </>
        )}
      </p>
      <p className="text-meta text-ink-subtle">{f.fine}</p>
    </form>
  );
}

function AuthorNote() {
  const a = landingContent.pilot.author;
  return (
    <div className="mb-1.5 grid grid-cols-[44px_1fr] gap-3.5 rounded-card border border-line bg-canvas px-4 py-3.5">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-pill bg-action text-data font-semibold tracking-wide text-action-fg">{a.initials}</span>
      <div>
        <b className="mb-1 block text-data font-semibold text-ink">{a.title}</b>
        <p className="text-data leading-relaxed text-ink-secondary">{a.body}</p>
        <span className="mt-2 block text-meta text-ink-muted">{a.signature}</span>
      </div>
    </div>
  );
}
```

The required-field focus goes through `form.elements.namedItem` rather than refs: `Input`'s props are `InputHTMLAttributes`, which carry no `ref`, and adding `forwardRef` to a shared control for one caller is the wrong trade. `cx` composes the trigger's classes so no class is ever inside a template literal.

- [ ] **Step 4: The pilot block**

```tsx
import { Step, Stepper } from "@goproceed/ui/components";
import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { PilotForm } from "./pilot-form";
import { SectionHead } from "./section-head";

export function Pilot() {
  const p = landingContent.pilot;
  const boxes = [p.needs, p.gets, p.terms] as const;
  return (
    <section id="pilot" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={p.eyebrow} title={p.title} titleAccent={p.titleAccent} lead={p.lead} />
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-start md:gap-14">
          <div>
            <Stepper>
              {p.steps.map((s, i) => <Step key={s.when} index={i} count={p.steps.length} when={s.when} title={s.title}>{s.body}</Step>)}
            </Stepper>
            <Stagger className="mt-2 grid gap-3.5 md:grid-cols-2">
              {boxes.map((box, i) => (
                <StaggerItem key={box.title} className={i === 2 ? "md:col-span-2" : ""}>
                  <div className="grid h-full gap-1.5 rounded-card border border-line-strong bg-surface px-4 py-3.5 text-data text-ink-secondary">
                    <b className="font-semibold text-ink">{box.title}</b>
                    {box.items.map((t) => <span key={t}>· {t}</span>)}
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
          <Reveal y={0}><PilotForm /></Reveal>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run** — `pnpm --filter @goproceed/landing exec vitest run && pnpm --filter @goproceed/landing typecheck && node packages/testing/qa/motion-audit.mjs` → PASS. The `@source not "../tests"` line in `globals.css` keeps the test file's strings out of the CSS bundle.

- [ ] **Step 6: Commit** — `feat(landing): 07 Пілот — the stepper, the three cards, the author note and the form with its fallback`.

---

### Task 21: The route handler and its delivery

**Files:**
- Create: `apps/landing/app/api/pilot/route.ts`, `apps/landing/app/api/pilot/deliver.ts`, `apps/landing/app/api/pilot/rate-limit.ts`, `apps/landing/.env.example`
- Modify: `apps/landing/next.config.ts` (the comment), `turbo.json` (`build.env`, `dev`), `apps/landing/AGENTS.md`, `infra/README-staging.md` §4.4
- Test: `apps/landing/tests/pilot-route.test.ts`

**Interfaces:**
- Produces: `deliverPilotRequest({ fields, referer, env, fetchImpl }): Promise<{ ok: true; via: string[] } | { ok: false; error: "not-configured" | "delivery" }>`; `POST(request: Request): Promise<Response>`; `rateLimited(ip: string, now?: number): boolean` and `resetRateLimit()` in `rate-limit.ts` (a route file may export only HTTP methods and segment config — Next's type check refuses anything else).

- [ ] **Step 1: Failing test**

`apps/landing/tests/pilot-route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverPilotRequest } from "../app/api/pilot/deliver";
import { resetRateLimit } from "../app/api/pilot/rate-limit";
import { POST } from "../app/api/pilot/route";

const fields = { name: "Ірина", company: "", contact: "iryna@example.com", role: "Керівник ПТВ", context: "БЦ" };
const ok = () => new Response("{}", { status: 200 });
const bad = () => new Response("{}", { status: 500 });

function post(body: unknown, ip = "1.1.1.1") {
  return POST(new Request("http://localhost/api/pilot", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body),
  }));
}

afterEach(() => { vi.unstubAllEnvs(); resetRateLimit(); });

describe("deliverPilotRequest", () => {
  it("answers not-configured when no channel has its variables", async () => {
    expect(await deliverPilotRequest({ fields, referer: null, env: {}, fetchImpl: vi.fn() })).toEqual({ ok: false, error: "not-configured" });
  });

  it("sends to Telegram with the seven-line text and reports the channel", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const result = await deliverPilotRequest({ fields, referer: "https://goproceed.example/", env: { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c" }, fetchImpl });
    expect(result).toEqual({ ok: true, via: ["telegram"] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/bott/sendMessage");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.chat_id).toBe("c");
    expect(body.text).toContain("Ім'я: Ірина");
    expect(body.text).toContain("Сторінка: https://goproceed.example/");
  });

  it("sends through Resend with a reply_to when the contact is an email", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const result = await deliverPilotRequest({ fields, referer: null, env: { RESEND_API_KEY: "k", PILOT_TO_EMAIL: "to@x", PILOT_FROM_EMAIL: "GoProceed <from@x>" }, fetchImpl });
    expect(result).toEqual({ ok: true, via: ["email"] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer k" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.to).toEqual(["to@x"]);
    expect(body.reply_to).toBe("iryna@example.com");
  });

  it("reports delivery failure only when every channel failed", async () => {
    const env = { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c", RESEND_API_KEY: "k", PILOT_TO_EMAIL: "to@x" };
    const half = vi.fn().mockResolvedValueOnce(bad()).mockResolvedValueOnce(ok());
    expect(await deliverPilotRequest({ fields, referer: null, env, fetchImpl: half })).toEqual({ ok: true, via: ["email"] });
    const none = vi.fn().mockResolvedValue(bad());
    expect(await deliverPilotRequest({ fields, referer: null, env, fetchImpl: none })).toEqual({ ok: false, error: "delivery" });
  });
});

describe("POST /api/pilot", () => {
  it("rejects a bad body with 400 and stores nothing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    const res = await post({ name: "", contact: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "required" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("pretends success for a filled honeypot and delivers nothing", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    const res = await post({ ...fields, website: "spam" });
    expect(res.status).toBe(200);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers 503 when no channel is configured", async () => {
    const res = await post(fields);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: "not-configured" });
  });

  it("answers 200 with the channels that took the message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    const res = await post(fields);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, via: ["telegram"] });
  });

  it("answers 502 when delivery failed everywhere", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(bad()));
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    expect((await post(fields)).status).toBe(502);
  });

  it("limits one address to five requests in ten minutes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t"); vi.stubEnv("TELEGRAM_CHAT_ID", "c");
    for (let i = 0; i < 5; i++) expect((await post(fields, "2.2.2.2")).status).toBe(200);
    expect((await post(fields, "2.2.2.2")).status).toBe(429);
    expect((await post(fields, "3.3.3.3")).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run** → FAIL (modules missing).

- [ ] **Step 3: `deliver.ts`**

```ts
import { type PilotFields, buildPilotMessage } from "../../../content/pilot-request";

/**
 * Forwards one pilot request to whichever channels are configured. Stores
 * nothing; logs a failure reason and never the fields.
 *
 * Telegram Bot API `sendMessage` — https://core.telegram.org/bots/api#sendmessage
 * (read 2026-09-05): POST JSON {chat_id, text, disable_web_page_preview}.
 * Resend `POST /emails` — https://resend.com/docs/api-reference/emails/send-email
 * (read 2026-09-05): `from` required, `to` an array, `reply_to` accepted.
 * Both through `fetch`; no SDK, so nothing new is on the wire or in the
 * lockfile.
 */
export type DeliveryEnv = Partial<Record<
  "TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_ID" | "RESEND_API_KEY" | "PILOT_TO_EMAIL" | "PILOT_FROM_EMAIL", string>>;

export type DeliveryResult = { ok: true; via: string[] } | { ok: false; error: "not-configured" | "delivery" };

const escapeHtml = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
const looksLikeEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s);

export async function deliverPilotRequest({
  fields, referer, env, fetchImpl,
}: {
  fields: PilotFields;
  referer: string | null;
  env: DeliveryEnv;
  fetchImpl: typeof fetch;
}): Promise<DeliveryResult> {
  const text = `${buildPilotMessage(fields)}\n\nСторінка: ${referer ?? "—"}`;
  const tasks: Array<Promise<string>> = [];

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    tasks.push(
      fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
      }).then((r) => (r.ok ? "telegram" : Promise.reject(new Error(`telegram ${r.status}`)))),
    );
  }
  if (env.RESEND_API_KEY && env.PILOT_TO_EMAIL) {
    tasks.push(
      fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: env.PILOT_FROM_EMAIL || "GoProceed <onboarding@resend.dev>",
          to: [env.PILOT_TO_EMAIL],
          ...(looksLikeEmail(fields.contact) ? { reply_to: fields.contact } : {}),
          subject: `Пілот GoProceed — заявка від ${fields.name}`,
          text,
          html: `<pre style="font:14px/1.5 -apple-system,Segoe UI,sans-serif">${escapeHtml(text)}</pre>`,
        }),
      }).then((r) => (r.ok ? "email" : Promise.reject(new Error(`email ${r.status}`)))),
    );
  }
  if (tasks.length === 0) return { ok: false, error: "not-configured" };

  const results = await Promise.allSettled(tasks);
  const via = results.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled").map((r) => r.value);
  if (via.length === 0) {
    console.error("pilot delivery failed", results.map((r) => (r.status === "rejected" ? String(r.reason) : "ok")));
    return { ok: false, error: "delivery" };
  }
  return { ok: true, via };
}
```

- [ ] **Step 4: `rate-limit.ts` and `route.ts`**

`rate-limit.ts`:

```ts
/**
 * A per-instance brake: five requests per ten minutes per address. It lives
 * in memory, so it resets on a cold start and is not shared between
 * serverless instances — adequate at pilot scale and filed in TODOS.md as
 * such. Separate from route.ts because a route file may export only HTTP
 * methods and segment config.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const bucket = new Map<string, number[]>();

export function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (bucket.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  bucket.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

/** Test seam. */
export function resetRateLimit(): void { bucket.clear(); }
```

`route.ts`:

```ts
import { validatePilotFields } from "../../../content/pilot-request";
import { deliverPilotRequest, type DeliveryEnv } from "./deliver";
import { rateLimited } from "./rate-limit";

/**
 * POST /api/pilot — the landing's one server-side handler. Not a product API
 * and not a Supabase client: it validates a contact form, forwards it to the
 * owner (deliver.ts) and stores nothing. next.config.ts records the dated
 * correction to «never grow API routes».
 *
 * Route handler contract per Next 16.3.1:
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
 * (Web Request/Response; `runtime` defaults to nodejs).
 *
 * The rate limit lives in rate-limit.ts (per instance, resets on a cold start).
 */
const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "?";
  if (rateLimited(ip)) return json(429, { ok: false, error: "rate" });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.website === "string" && body.website.length > 0) {
    return json(200, { ok: true }); // a bot filled the honeypot: pretend, deliver nothing
  }
  const checked = validatePilotFields(body);
  if (!checked.ok) return json(400, { ok: false, error: checked.error });

  const env: DeliveryEnv = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    PILOT_TO_EMAIL: process.env.PILOT_TO_EMAIL,
    PILOT_FROM_EMAIL: process.env.PILOT_FROM_EMAIL,
  };
  const result = await deliverPilotRequest({ fields: checked.fields, referer: request.headers.get("referer"), env, fetchImpl: fetch });
  if (result.ok) return json(200, result);
  return json(result.error === "not-configured" ? 503 : 502, result);
}
```

Next answers `405` for methods a route file does not export, so no `GET` is written (route.md, «HTTP Methods»). If `exactOptionalPropertyTypes` rejects `process.env.X` (type `string | undefined`) into `Partial<Record<…, string>>`, build `env` with a conditional spread per key: `...(process.env.TELEGRAM_BOT_TOKEN ? { TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN } : {})`.

- [ ] **Step 5: Configuration and the documents**

`apps/landing/.env.example`:

```
# Delivery channels for POST /api/pilot — set at least one in Vercel → goproceed-landing → Environment Variables.
# Nothing is stored; the handler forwards the request and answers 503 when neither channel is configured
# (the page then copies the text and offers the mail client).
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
RESEND_API_KEY=
PILOT_TO_EMAIL=
PILOT_FROM_EMAIL=
```

`turbo.json`: add the five names to `build.env` (turbo's strict mode withholds undeclared variables from `next build`, and `next start`/Vercel read them at request time regardless — declaring them keeps `pnpm turbo run dev` honest too).

`apps/landing/next.config.ts` — replace the header comment:

```ts
// apps/landing is a static-first public marketing shell (see
// infra/README-staging.md and docs/superpowers specs §3): it carries no
// product API and no Supabase server client. The authenticated surface lives
// only in apps/app.
// [Correction, 2026-09-05: this comment used to say «must never grow API
// routes». One route handler exists — app/api/pilot — a contact form that
// forwards to Telegram/Resend and stores nothing. The invariant that matters,
// no product API and no Supabase client, is unchanged; the spec at
// docs/superpowers/specs/2026-09-05-landing-daylight-design.md §2 D2 records
// the decision.]
```

`apps/landing/AGENTS.md` — append below the generated Next block:

```markdown
## Pilot form delivery

`POST /api/pilot` (`app/api/pilot/route.ts`) forwards the pilot request to the
owner and stores nothing. Configure at least one channel in the Vercel project
`goproceed-landing`: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (a bot and the
chat it may write to) and/or `RESEND_API_KEY` + `PILOT_TO_EMAIL` (+
`PILOT_FROM_EMAIL` on a verified domain). Copy `.env.example` to `.env.local`
for a local run. With no channel the handler answers 503 and the page falls
back to copying the request text and opening the mail client to the address
in `content/pilot-request.ts`. The rate limit (5 per 10 min per IP) is per
instance and resets on a cold start. Tests: `tests/pilot-route.test.ts`,
`tests/pilot-form.test.ts`.
```

`infra/README-staging.md` §4.4 — after the «Created:» paragraph add:

```markdown
**Environment (added 2026-09-05, the Daylight landing):** the pilot form's
handler reads `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RESEND_API_KEY`,
`PILOT_TO_EMAIL`, `PILOT_FROM_EMAIL` — set at least one channel's pair in the
dashboard for Production. Owner action; nothing else in the project changed.
```

- [ ] **Step 6: Run** — `pnpm --filter @goproceed/landing exec vitest run tests/pilot-route.test.ts && pnpm --filter @goproceed/landing typecheck && pnpm --filter @goproceed/landing build && pnpm validate:canonical-docs` → PASS; the build lists `ƒ /api/pilot`.

- [ ] **Step 7: Commit** — `feat(landing): POST /api/pilot — Telegram/Resend delivery, honeypot, rate limit, nothing stored (D2)` with the two doc URLs in the body.

---

### Task 22: FAQ and the closing CTA

**Files:**
- Replace: `components/blocks/faq.tsx`, `components/blocks/cta.tsx`; create `components/blocks/share-link.tsx` (client)
- Test: append

- [ ] **Step 1: Failing tests**

```tsx
describe("faq and cta", () => {
  it("asks the seven questions in an accordion with the plus marker", () => {
    const faq = section("faq", "cta-final");
    expect(faq.match(/data-accordion-marker="plus"/g)).toHaveLength(7);
    expect(faq).toContain("Скільки коштує пілот і хто відповідає?");
  });
  it("closes with the light card, the pilot link and the copy-link button", () => {
    const cta = section("cta-final");
    expect(cta).toContain('data-accent="true">на одному пакеті робіт</span>');
    expect(cta).toContain('href="#pilot"');
    expect(cta).toContain(landingContent.cta.share);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Blocks**

`faq.tsx`:

```tsx
import { Accordion } from "@goproceed/ui/components";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { AccentText } from "./accent-text";

export function Faq() {
  const q = landingContent.faq;
  return (
    <section id="faq" className="scroll-mt-20 px-4 pb-10 pt-20 md:px-8 md:pb-14 md:pt-28">
      <div className="mx-auto grid max-w-marketing gap-8 wide:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] wide:gap-10">
        <div>
          <Reveal><p className="index-label">{q.eyebrow}</p></Reveal>
          <Reveal><h2 className="display mt-3.5 max-w-[12ch] text-mkt-display-2 text-ink"><AccentText text={q.title} accent={q.titleAccent} /></h2></Reveal>
        </div>
        <Reveal y={0}><Accordion entries={[...q.entries]} marker="plus" className="border-t border-line" /></Reveal>
      </div>
    </section>
  );
}
```

`share-link.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@goproceed/ui/components";
import { landingContent } from "../../content/landing-content";

/** «Скопіювати посилання для ПТВ»: the page URL with the compare anchor and one sentence, onto the clipboard. */
export function ShareLink() {
  const [done, setDone] = useState(false);
  async function copy() {
    const url = `${window.location.href.split("#")[0]}#compare`;
    try {
      await navigator.clipboard.writeText(`${landingContent.cta.shareText}${url}`);
      setDone(true);
      window.setTimeout(() => setDone(false), 2200);
    } catch { setDone(false); }
  }
  return <Button type="button" size="lg" variant="outline" onClick={copy}>{done ? landingContent.cta.shared : landingContent.cta.share}</Button>;
}
```

`cta.tsx`:

```tsx
import { Button } from "@goproceed/ui/components";
import { Reveal, TextBlurIn } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { ShareLink } from "./share-link";

/** 21st.dev's Cta-4: a light card, copy left, actions right. The second and last TextBlurIn on the page. */
export function Cta() {
  const c = landingContent.cta;
  const at = c.title.indexOf(c.titleAccent);
  return (
    <section id="cta-final" className="px-4 pb-16 pt-8 md:px-8 md:pb-24 md:pt-12">
      <div className="mx-auto max-w-marketing">
        <div className="grid items-center gap-8 rounded-section border border-line-strong bg-surface p-7 md:grid-cols-[minmax(0,1.3fr)_auto] md:p-12">
          <div>
            <h2 className="display max-w-[18ch] text-[clamp(26px,3vw,38px)] leading-tight tracking-tight text-ink">
              <TextBlurIn text={c.title.slice(0, at)} />
              <span className="text-accent" data-accent="true">{c.titleAccent}</span>
              <TextBlurIn text={c.title.slice(at + c.titleAccent.length)} delay={0.3} />
            </h2>
            <Reveal><p className="mt-3 max-w-[48ch] text-body leading-relaxed text-ink-secondary">{c.lead}</p></Reveal>
          </div>
          <Reveal className="flex flex-wrap gap-2.5 md:justify-self-end">
            <Button asChild size="lg"><a href="#pilot">{c.primary}</a></Button>
            <ShareLink />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run** all landing tests + typecheck + audit → PASS. **Step 5: Commit** — `feat(landing): 08 Питання and the closing card`.

---

### Task 23: Browser QA at seven widths, and the OG image

**Files:**
- Create: `apps/landing/qa/landing.mjs`, `apps/landing/app/og/page.tsx`
- Modify: `apps/landing/package.json` (`"qa": "node qa/landing.mjs"`, devDependency `puppeteer@25.8.0`), `.gitignore` (`apps/landing/qa-output/`), `apps/landing/app/globals.css` (`@source not "../qa";`)
- Regenerate: `apps/landing/public/og.png`

- [ ] **Step 1: The OG route**

`apps/landing/app/og/page.tsx` — a 1200×630 frame the QA script photographs:

```tsx
import { landingContent } from "../../content/landing-content";
import { BrandMark } from "../../components/brand-mark";

export const metadata = { robots: { index: false } };

export default function OgPage() {
  const h = landingContent.hero;
  return (
    <main className="relative grid h-[630px] w-[1200px] content-between bg-canvas p-16">
      <p className="flex items-center gap-4 text-h1 font-semibold text-ink"><BrandMark className="size-12" />{landingContent.nav.brand}</p>
      <div>
        <h1 className="display max-w-[16ch] text-[72px] leading-[1.05] tracking-tightest text-ink">
          {h.title.slice(0, h.title.indexOf(h.titleAccent))}<span className="text-accent">{h.titleAccent}</span>{h.title.slice(h.title.indexOf(h.titleAccent) + h.titleAccent.length)}
        </h1>
        <p className="mt-6 max-w-[40ch] text-[24px] leading-relaxed text-ink-secondary">{h.pill.badge} · {h.pill.text}</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: The script**

`apps/landing/qa/landing.mjs`:

```js
#!/usr/bin/env node
// Builds and starts the landing, then photographs it at seven widths, checks
// for horizontal overflow and console errors, repeats under reduced motion,
// and writes public/og.png from /og. Run: pnpm --filter @goproceed/landing qa
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(app, "qa-output");
mkdirSync(out, { recursive: true });
const PORT = 3111;
const WIDTHS = [1920, 1440, 1240, 1024, 768, 390, 360];

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: app, stdio: "inherit", ...opts });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

await run("pnpm", ["exec", "next", "build"]);
const server = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], { cwd: app, stdio: "inherit" });
await new Promise((r) => setTimeout(r, 4000));

const report = { widths: {}, reduced: {}, errors: [] };
const browser = await puppeteer.launch({
  ...(process.env.GOPROCEED_CHROME_PATH ? { executablePath: process.env.GOPROCEED_CHROME_PATH } : {}),
  headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

async function audit(width, reduced) {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle0" });
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.floor(900 * 0.8);
  let shot = 0;
  for (let y = 0; y < total; y += step) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await new Promise((r) => setTimeout(r, 350));
    await page.screenshot({ path: join(out, `${reduced ? "reduced-" : ""}${width}-${String(shot++).padStart(2, "0")}.png`) });
  }
  const overflow = await page.evaluate(() => {
    const vw = window.innerWidth;
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1; })
      .map((el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className).split(" ")[0]}`)
      .slice(0, 10);
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, wide };
  });
  await page.close();
  const ok = overflow.scrollWidth === overflow.innerWidth && overflow.wide.length === 0 && errors.length === 0;
  (reduced ? report.reduced : report.widths)[width] = { ok, ...overflow, errors };
  console.log(`${reduced ? "reduced " : ""}${width}px: ${ok ? "ok" : "PROBLEM"} scrollWidth=${overflow.scrollWidth} wide=${overflow.wide.length} errors=${errors.length}`);
}

for (const w of WIDTHS) await audit(w, false);
for (const w of [1440, 390]) await audit(w, true);

const og = await browser.newPage();
await og.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await og.goto(`http://localhost:${PORT}/og`, { waitUntil: "networkidle0" });
await og.screenshot({ path: join(app, "public/og.png"), clip: { x: 0, y: 0, width: 1200, height: 630 } });
console.log("wrote public/og.png");

await browser.close();
server.kill();
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
const allOk = [...Object.values(report.widths), ...Object.values(report.reduced)].every((r) => r.ok);
console.log(allOk ? "landing qa: ok" : "landing qa: PROBLEMS — see qa-output/report.json");
process.exit(allOk ? 0 : 1);
```

- [ ] **Step 3: Wire it**

```bash
pnpm --filter @goproceed/landing add -D puppeteer@25.8.0
```

`package.json` scripts: `"qa": "node qa/landing.mjs"`. `.gitignore`: append `apps/landing/qa-output/` under the mobile entry with a one-line comment. `globals.css`: add `@source not "../qa";` beside the tests exclusion.

- [ ] **Step 4: Run it and fix what it finds**

Run: `pnpm --filter @goproceed/landing qa`
Expected: nine `ok` lines and `landing qa: ok`. A `PROBLEM` line names the element; fix the block, re-run. Common causes at 360–390: a `whitespace-nowrap` pill, the board's third column, a `min-w` on a grid child — the prototype's own fixes were the receipt at 1024 and the «Технагляд» pill over the frame header.

- [ ] **Step 5: Look, in the Browser pane**

`preview_start` the landing and check at 1440 and 390 with real eyes: the header hairline, the accent phrases, the frame settling, the sticky stack at 1440, the form's focus ring; then reduced motion via `resize_window`'s colour scheme is not motion — use the QA screenshots for the reduced pass.

- [ ] **Step 6: Commit** — `git add apps/landing/qa apps/landing/app/og apps/landing/package.json apps/landing/public/og.png apps/landing/app/globals.css .gitignore pnpm-lock.yaml && git commit -m "test(landing): browser QA at seven widths and reduced motion; og.png from /og

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"`

---

### Task 24: The documents

**Files:**
- Rewrite: `DESIGN.md`
- Modify: `docs/design/02-building-ui.md` (§4.1 table rows, §4.3 rule 10, §9 two sentences — dated corrections), `docs/design/03-ui-references.md` (new section), `design-references/visual-directions/README.md` (Direction 04, 02 superseded), `docs/design/2026-08-19-design-system-rewrite-plan.md` §9 (pointer), `docs/superpowers/specs/2026-07-29-goproceed-baseline-zero-design.md:94` (dated correction), `docs/superpowers/specs/2026-09-05-landing-daylight-design.md` (§4.6 correction about `apps/app`'s legacy stylesheet), `TODOS.md`, `HANDOFF.md`

- [ ] **Step 1: `DESIGN.md`** — keep the frontmatter shape; replace the values and the prose. Frontmatter: `name: GoProceed Daylight`, `description: Warm paper, cool ink and one cobalt mark for accountable construction evidence.`, colours from the regenerated `docs/design/01-tokens.md` (paper `#F6F5F1`, surface `#FFFFFF`, paper-subtle `#EFEEE8`, ink `#15161A`, ink-secondary `#4E5158`, ink-muted `#5E626B`, ink-subtle `#7A7E87`, line `#D9D9D6`, line-strong `#CFCFCC`, cobalt `#2B4BFF`, accent `#5568DE`, accent-soft `#EAEDFF`, ready-surface `#E8F4EE`, ready-ink `#17754A`, review-surface `#EAEDFF`, review-ink `#1E36B8`, attention-surface `#FAEFE8`, attention-ink `#A6511A`, blocked-* unchanged), typography (display/body/data in Onest with the §4.3 sizes and weights, label in JetBrains Mono), rounded (`field 8px`, `panel 10px`, `card 12px`, `surface 14px`, `section 16px`, `pill 999px`), components (`button-ink`, `button-outline`, `pill`, `field`, `status-chip`, `feature-cell`, `bento-cell`, `compare-card`). Body sections in the same order as today (Overview → Colors → Typography → Layout → Elevation → Shapes → Components → Do/Don't), written for Daylight: the North Star is «the work is ready when the proof is in place, shown on paper in daylight»; one cobalt mark, no lime; recognisable 21st.dev blocks; motion is the sixteen-word vocabulary and two scroll-linked elements. Don'ts: no brutalism, no 3D or tilt, no perpetual animation but the marquee, no colour-only status, no signed-act claim, no testimonial, price or logo.

- [ ] **Step 2: `02-building-ui.md`** — add rows to §4.1:

```markdown
| `text-accent` on body copy | `text-accent` only inside a display heading | It clears 3:1, not 4.5:1 — large text only |
| `h-11` on a marketing control | `size="lg"` on `Button`; `h-(--gp-control-height-marketing)` on an input | The literal stops tracking the token |
| a lime fill, `bg-signal` as decoration | `bg-action-signal` on at most one action, or ink | The mark is cobalt since 2026-09-05 and the landing uses none |
```

§4.3 rule 10: `10. At most one \`bg-action-signal\` per screen *(corrected 2026-09-05: was «exactly one»; the Daylight landing's primary is ink and carries none)*`. §9: after «Typography does the work.» paragraph add `*[Correction, 2026-09-05: Onest for display and everything else, JetBrains Mono for indices; the serif is retired. Weights 400 / 500 / 600 / 700.]*`; after «The signal is rationed.» add `*[Correction, 2026-09-05: the signal is cobalt, not lime — the same ration applies.]*`.

- [ ] **Step 3: `03-ui-references.md`** — append:

```markdown
## Landing references — 21st.dev patterns (added 2026-09-05)

**Status:** Approved (owner decision, 2026-09-05, with the Daylight prototype)
**Applies to:** `apps/landing/**`

The landing is built after recognisable community components from
[21st.dev](https://21st.dev), taken as **structure** and restyled in token
roles — no registry install, no pasted CSS variables, no raw hex (the same
rule the dashboard applies to shadcn). Each block names its source:

| Block | Pattern | What we take | What we do not |
|---|---|---|---|
| Hero pill | Announcement | badge + copy + arrow, `asChild` link | its gradient border |
| Product frame | Container Scroll Animation + Border Beam | the tilt-and-settle entry (`ScrollSettle`), the ring of light (finite, two passes) | the perpetual beam; pointer tilt |
| Background | Dot Pattern | the dot field with a radial mask | any animated variant |
| Roles | Grid Feature Cards | 1px-gap cells, pointer spotlight | 3D hover |
| Provenance | Bento Grid | a two-row cell beside two stacked cells | icon-led filler cells |
| Route | Fora's sticky feature stack | five sticky cards, sides alternating | the scale/veil scrub (scroll-linked budget) |
| Pilot plan | Steppers | vertical steps with a progress line | timed autoplay |
| Closing | Cta-4 | light card, copy left, actions right | a second signal button |

Spec: `docs/superpowers/specs/2026-09-05-landing-daylight-design.md` §6.
```

- [ ] **Step 4: `visual-directions/README.md`** — under «Direction 02 — Evidence Atlas» heading add `> **Superseded 2026-09-05.** The owner's design contest (`design-references/contest-2026-09/`) chose the light «Daylight» prototype; the reasons are in its README. Direction 04 below is the shipped direction.` and append a `## Direction 04 — Daylight (approved 2026-09-05)` section with a short description (paper `#F6F5F1`, ink `#15161A`, cobalt `#2B4BFF`, Onest + JetBrains Mono, 21st.dev blocks, sixteen-word motion vocabulary) and a pointer to `DESIGN.md`. Change the closing recommendation line to point at Direction 04.

- [ ] **Step 5: The three corrections**

Rewrite plan §9 first line: `> **Superseded 2026-09-05.** The landing block catalogue is now §3 of `docs/superpowers/specs/2026-09-05-landing-daylight-design.md`; this table is kept as the record of the Evidence Journey page.`

Baseline spec line 94 — append to the row's last cell: ` *(corrected 2026-09-05: one contact-forwarding route handler, `app/api/pilot`, exists; still no product API and no Supabase client — spec 2026-09-05 §2 D2)*`.

Daylight spec §4.6 — append: `**Correction, found in Plan 1 Task 3 (2026-09-05):** `apps/app/app/globals.css` is a legacy stylesheet with its own hard-coded theme; only the dashboard under `/dash/**` (`dash-theme.css` → `@goproceed/ui/base.css`) and `apps/mobile` are on the token system. The field-client pages of `apps/app` keep the Evidence Atlas palette and Inter until the Phase 4 restyle; the P2 in TODOS names them.`

- [ ] **Step 6: `TODOS.md`** — append a section:

```markdown
## Opened by the Daylight landing (2026-09-05)

- **P2 — visual pass of `/dash/**` and `apps/mobile` under the Daylight palette.** The tokens moved system-wide (spec §2 D1); the dashboard and the field client re-coloured through the roles with no visual pass. Six viewports each, reduced motion, real strings; the sign-out dialog and the OTP form use the `signal` button variant and are the first two screens to look at.
- **P2 — `apps/app`'s field-client pages are on a legacy stylesheet** (`app/globals.css`, hard-coded Evidence Atlas hex, Inter). They did not move and will not until Phase 4 of the rewrite plan; until then the mark in the browser tab is cobalt and the button is lime.
- **P3 — not carried from the prototype, by decision D4:** Lenis smooth scrolling, `data-depth` parallax, pointer tilt on the board and cards, magnetic buttons, the receipt/pill idle drift, the pulsing review dot, the animated dashed «flow» lines, the sticky stack's scale/veil scrub, the five tinted media gradients, the cobalt-tinted «now» card shadow. Each is either forbidden by the motion rules or excluded by the owner's «no 3D»; re-opening any of them is a §7.3 decision.
- **P3 — the pilot form's rate limit is per serverless instance** and resets on a cold start (`app/api/pilot/route.ts`). Adequate at pilot scale; a shared store is the fix if the form is ever abused.
- **P3 — `landing-route-card` carries a literal `1240px` media query** in `apps/landing/app/globals.css` because `@variant` is unavailable inside a plain class rule at that layer. The one place the breakpoint is typed outside the token; fold it into a `base.css` utility when a second sticky pattern appears.
```

- [ ] **Step 7: `HANDOFF.md`** — insert `### 0a.15 — the Daylight landing: prototype ported, palette and mark system-wide, the form has a server side` above `### 0a.14`, five paragraphs: what shipped (the page, the sixteenth word, seven components, cobalt everywhere), what the owner decided (D1–D5, one line each), what was measured (the QA report figures, the gate), what did not move (the `apps/app` legacy sheet, the TODOS above), where to look (spec, three plans, evidence file).

- [ ] **Step 8: Run** `pnpm validate:canonical-docs` → OK. **Step 9: Commit** — `docs(design): Daylight — DESIGN.md, building-ui corrections, 21st.dev references, superseded Evidence Atlas, TODOS and HANDOFF`.

---

### Task 25: Plan 3 gate, evidence, and the branch

- [ ] **Step 1: The five commands and the workspace**

```bash
pnpm --filter @goproceed/tokens generate
node packages/testing/qa/motion-audit.mjs
pnpm --filter @goproceed/testing test
pnpm turbo run typecheck
pnpm --filter @goproceed/landing build
pnpm turbo run test --concurrency=1
pnpm --filter @goproceed/landing qa
pnpm validate:canonical-docs
```

Expected: `motion-audit: clean`; every suite green; `landing qa: ok`; `canonical documentation: OK`. Paste the output — not a paraphrase — under `## Plan 3 — landing` in `docs/superpowers/plans/evidence/2026-09-05-landing-daylight-gate.md`, with the QA report's per-width lines.

- [ ] **Step 2: The §6 visual pass, with the Browser pane**

1920 · 1440 · 1240 · 768 · 390 · 360, then reduced motion: nothing overflows, the fold holds the promise and the pill at 390, the header button is 44px on touch, every status carries its label, the frame is flat and the beam absent under reduced motion. Note anything fixed in the evidence file.

- [ ] **Step 3: Commit the evidence and hand the branch over**

```bash
git add docs/superpowers/plans/evidence/2026-09-05-landing-daylight-gate.md
git commit -m "docs(evidence): Plan 3 gate — the Daylight landing is green at seven widths

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin claude/practical-chatterjee-c8d64a
```

Then invoke `superpowers:finishing-a-development-branch` and open the PR with the gate output, the four cited library docs (Onest fontsource, Next route.md, Telegram sendMessage, Resend send-email) and the QA screenshots at 1440 and 390 attached; end the description with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
