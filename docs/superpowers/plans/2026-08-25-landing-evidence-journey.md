# Landing Evidence Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current section catalogue with a six-scene, responsive Evidence Journey landing and a working temporary email enquiry flow.

**Architecture:** Keep `app/page.tsx` server-rendered and compose focused landing blocks from typed content. Use two small client leaves only: an IntersectionObserver-driven evidence scene and a native-validation mailto form; all critical copy and product visuals remain present in server HTML.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript, Tailwind CSS v4 through `@goproceed/ui/base.css`, Vitest, `next/image`, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-08-25-landing-redesign-design.md`

## Global Constraints

- Preserve the approved GoProceed product boundary: no payment-presentation gate, KEP, durable offline capture, signed-act or customer-outcome claim.
- Use existing semantic colour/type/spacing roles; do not add raw hex colours or another UI/chart dependency.
- `app/page.tsx` stays a Server Component; only browser-state leaves receive `"use client"`.
- Primary CTA is functional and targets `#pilot`; temporary submission opens a prefilled message to `akisliy2306@gmail.com` and never claims server delivery.
- Every essential chapter is present in server HTML and remains readable with reduced motion or JavaScript unavailable.
- Validate at 1440, 1024, 768, 390 and 360 pixels; touch targets remain at least 44px.
- Preserve unrelated user files and untracked workspace changes.

---

### Task 1: Lock the new narrative and enquiry contract

**Files:**
- Modify: `apps/landing/tests/landing-content.test.ts`
- Modify: `apps/landing/tests/landing-render.test.tsx`
- Modify: `apps/landing/tests/no-filler-sections.test.tsx`
- Create: `apps/landing/tests/pilot-mail.test.ts`
- Modify: `apps/landing/content/landing-content.ts`
- Create: `apps/landing/content/pilot-mail.ts`

**Interfaces:**
- Produces: `landingContent.journey`, `landingContent.fieldReview`, `landingContent.readiness`, `landingContent.trust`, `landingContent.pilot`.
- Produces: `PilotMailFields`, `buildPilotMessage(fields)`, and `buildPilotMailto(fields)`.
- Consumes: the approved Ukrainian product language and sample IDs `R-041`, `EV-0248`, `DR-0091`, `CL-017`.

- [ ] **Step 1: Replace the old structure assertions with failing Evidence Journey assertions**

```tsx
it("renders six purposeful scenes in reading order", () => {
  const ids = ["product", "workflow", "field-review", "readiness", "trust", "pilot"];
  let cursor = -1;
  for (const id of ids) {
    const next = html.indexOf(`id="${id}"`);
    expect(next).toBeGreaterThan(cursor);
    cursor = next;
  }
  expect(html).not.toContain('id="proof"');
  expect(html).not.toContain('data-tour-mode="timed-tabs"');
  expect(html).not.toContain('aria-label="Порівняння доказового контуру"');
});

it("publishes working pilot anchors instead of inert actions", () => {
  expect(html.match(/href="#pilot"/g)?.length).toBeGreaterThanOrEqual(2);
  expect(html).toContain("<form");
  expect(html).not.toContain('aria-disabled="true"');
});
```

- [ ] **Step 2: Add failing mail builder tests**

```ts
import { buildPilotMailto, buildPilotMessage } from "../content/pilot-mail";

const fields = {
  name: "Олена",
  company: "Монтаж Плюс",
  contact: "olena@example.com",
  role: "Керівник ПТВ",
  context: "Один пакет прихованих електромонтажних робіт",
};

expect(buildPilotMessage(fields)).toContain("Ім’я: Олена");
expect(decodeURIComponent(buildPilotMailto(fields))).toContain("mailto:akisliy2306@gmail.com");
expect(decodeURIComponent(buildPilotMailto(fields))).toContain("Один пакет прихованих");
```

- [ ] **Step 3: Run the focused tests and verify they fail for missing contracts**

Run: `pnpm --filter @goproceed/landing test -- tests/landing-content.test.ts tests/landing-render.test.tsx tests/no-filler-sections.test.tsx tests/pilot-mail.test.ts`

Expected: FAIL because `pilot-mail.ts` and new landing sections do not exist.

- [ ] **Step 4: Replace the content schema with the approved six-scene data**

```ts
export type JourneyChapter = {
  id: "requirement" | "capture" | "decision";
  index: string;
  eyebrow: string;
  title: string;
  lead: string;
  reference: string;
};

export const landingContent = {
  nav: {
    items: [
      { label: "Як працює", href: "#workflow" },
      { label: "Рішення", href: "#field-review" },
      { label: "Пілот", href: "#pilot" },
    ],
    action: "Обговорити пілот",
  },
  hero: {
    eyebrow: "Доказовий контур будівельних робіт",
    title: "Від вимоги на кресленні — до доказу, який прийме технагляд",
    lead: "GoProceed показує потрібний доказ до закриття конструкції та зберігає рішення разом із роботою.",
  },
  journey: {
    chapters: [
      { id: "requirement", index: "01", eyebrow: "До робіт", title: "Вимога відома до закриття", lead: "R-041 прив’язана до роботи й моменту фіксації.", reference: "R-041" },
      { id: "capture", index: "02", eyebrow: "На майданчику", title: "Доказ має автора і місце", lead: "EV-0248 записує контекст разом із матеріалом.", reference: "EV-0248" },
      { id: "decision", index: "03", eyebrow: "Після розгляду", title: "Рішення дозволяє закриття", lead: "DR-0091 стає підставою для CL-017 і чернетки акта.", reference: "DR-0091 · CL-017" },
    ],
  },
} as const;
```

- [ ] **Step 5: Implement the pure mail builder**

```ts
export const PILOT_EMAIL = "akisliy2306@gmail.com";

export type PilotMailFields = {
  name: string;
  company: string;
  contact: string;
  role: string;
  context: string;
};

export function buildPilotMessage(fields: PilotMailFields): string {
  return [
    "Нова заявка на пілот GoProceed",
    "",
    `Ім’я: ${fields.name}`,
    `Компанія: ${fields.company || "Не вказано"}`,
    `Контакт: ${fields.contact}`,
    `Роль: ${fields.role || "Не вказано"}`,
    `Контекст: ${fields.context || "Не вказано"}`,
  ].join("\n");
}

export function buildPilotMailto(fields: PilotMailFields): string {
  const subject = encodeURIComponent("Пілот GoProceed — нова заявка");
  const body = encodeURIComponent(buildPilotMessage(fields));
  return `mailto:${PILOT_EMAIL}?subject=${subject}&body=${body}`;
}
```

- [ ] **Step 6: Run the content/mail tests and commit the contract**

Run: `pnpm --filter @goproceed/landing test -- tests/landing-content.test.ts tests/pilot-mail.test.ts`

Expected: PASS.

```bash
git add apps/landing/content apps/landing/tests/landing-content.test.ts apps/landing/tests/pilot-mail.test.ts
git commit -m "feat(landing): define evidence journey content"
```

---

### Task 2: Rebuild the first viewport around a focused live dossier

**Files:**
- Modify: `apps/landing/components/blocks/nav-float.tsx`
- Modify: `apps/landing/components/blocks/hero.tsx`
- Create: `apps/landing/components/visuals/live-dossier.tsx`
- Modify: `apps/landing/app/globals.css`
- Modify: `apps/landing/tests/landing-render.test.tsx`

**Interfaces:**
- Consumes: `landingContent.nav` and `landingContent.hero` from Task 1.
- Produces: `LiveDossier`, a server-rendered labelled product visual using `/images/cable-tray-evidence.png`.

- [ ] **Step 1: Add a failing hero test for the focused dossier and working actions**

```tsx
it("opens with one linked evidence dossier", () => {
  const hero = html.slice(html.indexOf('id="product"'), html.indexOf('id="workflow"'));
  expect(hero).toContain('aria-label="Досьє доказу EV-0248"');
  expect(hero).toContain("R-041");
  expect(hero).toContain("EV-0248");
  expect(hero).toContain("Очікує рішення");
  expect(hero).toContain('href="#pilot"');
});
```

- [ ] **Step 2: Run the hero test and verify it fails**

Run: `pnpm --filter @goproceed/landing test -- tests/landing-render.test.tsx`

Expected: FAIL because `LiveDossier` is not rendered.

- [ ] **Step 3: Implement the focused dossier and hero composition**

```tsx
export function LiveDossier() {
  return (
    <figure aria-label="Досьє доказу EV-0248" className="landing-dossier-frame">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <span className="index-label text-ink-muted">GP-2026-014 · W-014</span>
        <span className="text-meta font-medium text-status-review-fg">Очікує рішення</span>
      </header>
      <div className="grid wide:grid-cols-[1.1fr_.9fr]">
        <section aria-label="Вимога R-041" className="p-6">
          <p className="index-label">R-041 · блокуюча вимога</p>
          <h2 className="mt-4 text-mkt-display-3">Кабельний лоток до закриття стелі</h2>
        </section>
        <section aria-label="Доказ EV-0248" className="border-l border-line">
          <Image src="/images/cable-tray-evidence.png" alt="Кабельний лоток у зоні ВРУ-1" width={720} height={540} priority />
          <p className="index-label p-4">EV-0248 · очікує рішення</p>
        </section>
      </div>
    </figure>
  );
}
```

Use `next/image` with explicit dimensions and `priority`, keep the evidence image's cable bend visible, and avoid rendering the previous full navigation/table dashboard in the hero.

- [ ] **Step 4: Make navigation CTA and hero CTA real anchors**

```tsx
<a
  href="#pilot"
  className="inline-flex min-h-11 items-center rounded-control bg-ink px-5 text-data font-semibold text-on-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
>
  {landingContent.nav.action}
</a>
```

Keep the logo link, three useful section links and a compact mobile action; remove the disabled `MockAction` from all first-viewport code.

- [ ] **Step 5: Run the render test and commit**

Run: `pnpm --filter @goproceed/landing test -- tests/landing-render.test.tsx`

Expected: hero assertions PASS; later section assertions may remain failing until Tasks 3–5.

```bash
git add apps/landing/components/blocks/nav-float.tsx apps/landing/components/blocks/hero.tsx apps/landing/components/visuals/live-dossier.tsx apps/landing/app/globals.css apps/landing/tests/landing-render.test.tsx
git commit -m "feat(landing): focus hero on one evidence dossier"
```

---

### Task 3: Build the scroll-linked Evidence Journey

**Files:**
- Create: `apps/landing/components/blocks/evidence-journey.tsx`
- Create: `apps/landing/components/blocks/evidence-journey-client.tsx`
- Create: `apps/landing/components/visuals/journey-scene.tsx`
- Modify: `apps/landing/app/globals.css`
- Modify: `apps/landing/tests/landing-render.test.tsx`

**Interfaces:**
- Consumes: `JourneyChapter[]` from `landingContent.journey.chapters`.
- Produces: `EvidenceJourney` server wrapper and `EvidenceJourneyClient({ chapters })` client leaf.
- Produces: `JourneyScene({ id })` with `id` equal to `requirement | capture | decision`.

- [ ] **Step 1: Add failing assertions for three server-rendered chapters and no autoplay**

```tsx
it("server-renders the evidence route without autoplay", () => {
  const section = html.slice(html.indexOf('id="workflow"'), html.indexOf('id="field-review"'));
  for (const id of ["R-041", "EV-0248", "DR-0091", "CL-017"]) expect(section).toContain(id);
  expect(section.match(/data-journey-chapter=/g)).toHaveLength(3);
  expect(section).not.toContain("Пауза");
  expect(section).not.toContain('role="tablist"');
});
```

- [ ] **Step 2: Implement the server wrapper and static scene visual**

```tsx
export function EvidenceJourney() {
  return (
    <section id="workflow" className="scroll-mt-24 px-5 py-24 md:px-8">
      <header className="mx-auto mb-14 max-w-content">
        <p className="index-label text-ink-muted">Один доказовий маршрут</p>
        <h2 className="display mt-4 max-w-[24ch] text-mkt-display-2">Одна робота. Три переходи. Жодного відновлення історії після події.</h2>
      </header>
      <EvidenceJourneyClient chapters={landingContent.journey.chapters} />
    </section>
  );
}
```

`JourneyScene` renders only code-native blueprint, image, receipt and act fragments; every scene receives an accessible label while duplicate visual copy is marked decorative.

- [ ] **Step 3: Implement stable IntersectionObserver state without hiding text**

```tsx
"use client";

const [active, setActive] = useState<JourneyChapter["id"]>(chapters[0].id);
const chapterRefs = useRef<Array<HTMLElement | null>>([]);

useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => entries.filter((entry) => entry.isIntersecting)
      .forEach((entry) => setActive(entry.target.getAttribute("data-journey-chapter") as JourneyChapter["id"])),
    { rootMargin: "-35% 0px -45%", threshold: 0 },
  );
  chapterRefs.current.forEach((node) => node && observer.observe(node));
  return () => observer.disconnect();
}, []);
```

Render all chapter text in normal flow. On desktop, keep one visual stage sticky and cross-fade the active scene; below the desktop breakpoint render one scene after each chapter. `prefers-reduced-motion` disables transitions and sticky positioning through CSS.

- [ ] **Step 4: Run render and reduced-motion contract tests**

Run: `pnpm --filter @goproceed/landing test -- tests/landing-render.test.tsx tests/use-reduced.test.ts`

Expected: PASS for the new journey and the existing safe hydration contract. Remove only the obsolete timed-tour autoplay assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/landing/components/blocks/evidence-journey.tsx apps/landing/components/blocks/evidence-journey-client.tsx apps/landing/components/visuals/journey-scene.tsx apps/landing/app/globals.css apps/landing/tests
git commit -m "feat(landing): add scroll-linked evidence journey"
```

---

### Task 4: Replace repeated feature sections with three consequential scenes

**Files:**
- Create: `apps/landing/components/blocks/field-review.tsx`
- Create: `apps/landing/components/blocks/readiness-diagram.tsx`
- Create: `apps/landing/components/blocks/trust-boundary.tsx`
- Create: `apps/landing/components/visuals/field-review-visual.tsx`
- Create: `apps/landing/components/visuals/readiness-map.tsx`
- Modify: `apps/landing/app/globals.css`
- Modify: `apps/landing/tests/landing-render.test.tsx`
- Modify: `apps/landing/tests/no-filler-sections.test.tsx`

**Interfaces:**
- Consumes: `landingContent.fieldReview`, `.readiness`, and `.trust`.
- Produces: three server-rendered sections with IDs `field-review`, `readiness`, and `trust`.

- [ ] **Step 1: Add failing semantic tests for the three scenes**

```tsx
it("shows field hand-off, state logic and provenance without card catalogues", () => {
  expect(html).toContain('id="field-review"');
  expect(html).toContain("Без облікового запису");
  expect(html).toContain('aria-label="Стан демонстраційного пакета робіт"');
  expect(html).toContain("Демонстраційні дані");
  expect(html).toContain('aria-label="Квитанція походження EV-0248"');
  expect(html).not.toContain('id="roles"');
  expect(html).not.toContain('data-mobile-comparison="true"');
});
```

- [ ] **Step 2: Implement the Carbon field-to-review interval**

```tsx
<section id="field-review" className="bg-inverse text-on-inverse">
  <FieldReviewVisual />
  <dl className="grid divide-y divide-inverse-line md:grid-cols-3 md:divide-x md:divide-y-0">
    <div><dt>Майстер</dt><dd>Фіксує потрібний матеріал.</dd></div>
    <div><dt>ПТВ</dt><dd>Перевіряє повноту контексту.</dd></div>
    <div><dt>Технагляд</dt><dd>Приймає або повертає доказ.</dd></div>
  </dl>
</section>
```

The visual includes one phone capture, the cable-tray image, an attributable receipt and a narrow supervision decision. Copy states that capture currently needs a network connection.

- [ ] **Step 3: Implement the labelled readiness map without a chart library**

```tsx
<figure aria-label="Стан демонстраційного пакета робіт">
  <figcaption>Демонстраційні дані · один пакет робіт</figcaption>
  <svg role="img" aria-labelledby="readiness-title readiness-desc" viewBox="0 0 720 240">
    <title id="readiness-title">Стан робіт у доказовому контурі</title>
    <desc id="readiness-desc">Дванадцять робіт готові, сім перебувають на розгляді, три заблоковані невиконаними вимогами.</desc>
    <path d="M120 120H600" stroke="currentColor" />
    <circle cx="120" cy="120" r="34" /><circle cx="360" cy="120" r="34" /><circle cx="600" cy="120" r="34" />
  </svg>
  <dl className="grid grid-cols-3">
    <div><dt>Готово</dt><dd>12</dd></div>
    <div><dt>На розгляді</dt><dd>07</dd></div>
    <div><dt>Заблоковано</dt><dd>03</dd></div>
  </dl>
</figure>
```

Use existing status token roles, visible labels and a blocked-node explanation. Do not imply performance improvement or customer results.

- [ ] **Step 4: Implement the provenance receipt and explicit scope boundary**

Render EV-0248 event → R-041 → author/time/source → DR-0091 → CL-017 in a single document surface. Beside it, show two short lists headed `Працює у поточному контурі` and `Не заявляємо`, including online-only capture and unsigned draft-act boundaries.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm --filter @goproceed/landing test -- tests/landing-render.test.tsx tests/no-filler-sections.test.tsx`

Expected: all three scene assertions PASS and old filler markers are absent.

```bash
git add apps/landing/components/blocks/field-review.tsx apps/landing/components/blocks/readiness-diagram.tsx apps/landing/components/blocks/trust-boundary.tsx apps/landing/components/visuals apps/landing/app/globals.css apps/landing/tests
git commit -m "feat(landing): turn product proof into three visual scenes"
```

---

### Task 5: Add the temporary email enquiry and integrated FAQ close

**Files:**
- Create: `apps/landing/components/blocks/pilot-enquiry.tsx`
- Create: `apps/landing/components/pilot-enquiry-form.tsx`
- Modify: `apps/landing/components/blocks/footer.tsx`
- Modify: `apps/landing/tests/landing-render.test.tsx`
- Modify: `apps/landing/tests/pilot-mail.test.ts`

**Interfaces:**
- Consumes: `buildPilotMailto`, `buildPilotMessage`, `landingContent.pilot`.
- Produces: `PilotEnquiryForm` with native required fields, status text and clipboard fallback.

- [ ] **Step 1: Add failing form semantics and honesty assertions**

```tsx
it("renders an honest accessible pilot form", () => {
  const pilot = html.slice(html.indexOf('id="pilot"'), html.indexOf("<footer"));
  expect(pilot).toContain('name="name"');
  expect(pilot).toContain('name="contact"');
  expect(pilot).toContain('required=""');
  expect(pilot).toContain('aria-live="polite"');
  expect(pilot).toContain("поштовий клієнт");
  expect(pilot).not.toContain("Заявку надіслано");
});
```

- [ ] **Step 2: Implement the client form using native validation**

```tsx
"use client";

function readFields(data: FormData): PilotMailFields {
  const value = (name: keyof PilotMailFields) => String(data.get(name) ?? "").trim();
  return {
    name: value("name"),
    company: value("company"),
    contact: value("contact"),
    role: value("role"),
    context: value("context"),
  };
}

function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const fields = readFields(data);
  setMessage(buildPilotMessage(fields));
  setStatus("Поштовий клієнт відкрито. Перевірте лист і натисніть «Надіслати».");
  window.location.assign(buildPilotMailto(fields));
}
```

Name and reply contact are required; company, role and context are optional. Provide useful `autocomplete` attributes. A visible `Скопіювати текст листа` action calls `navigator.clipboard.writeText(message)` and reports success/failure without a transient toast.

- [ ] **Step 3: Integrate FAQ as native disclosure inside the pilot scene**

Use native disclosure so the questions remain usable without a client component or the broken shared component barrel:

```tsx
<details className="border-t border-line py-5">
  <summary className="min-h-11 cursor-pointer font-semibold text-ink">
    Чи можна фіксувати матеріали без мережі?
  </summary>
  <p className="mt-3 max-w-prose text-data text-ink-muted">
    Ні. Поточний контур потребує активного з’єднання; незавантажений оригінал не вважається збереженим доказом.
  </p>
</details>
```

Keep only factual product-boundary/adoption questions.

- [ ] **Step 4: Update footer and run tests**

Run: `pnpm --filter @goproceed/landing test -- tests/pilot-mail.test.ts tests/landing-render.test.tsx`

Expected: PASS, with working anchors and no inert action copy.

- [ ] **Step 5: Commit**

```bash
git add apps/landing/components/blocks/pilot-enquiry.tsx apps/landing/components/pilot-enquiry-form.tsx apps/landing/components/blocks/footer.tsx apps/landing/tests
git commit -m "feat(landing): add pilot email enquiry"
```

---

### Task 6: Compose the new page, remove absorbed blocks and restore independent development

**Files:**
- Modify: `apps/landing/app/page.tsx`
- Modify: `apps/landing/app/globals.css`
- Delete: `apps/landing/components/blocks/comparison.tsx`
- Delete: `apps/landing/components/blocks/evidence-chain.tsx`
- Delete: `apps/landing/components/blocks/evidence-integrity.tsx`
- Delete: `apps/landing/components/blocks/faq.tsx`
- Delete: `apps/landing/components/blocks/field-mobile.tsx`
- Delete: `apps/landing/components/blocks/pilot-format.tsx`
- Delete: `apps/landing/components/blocks/product-tour.tsx`
- Delete: `apps/landing/components/blocks/proof-strip.tsx`
- Delete: `apps/landing/components/blocks/roles-dossier.tsx`
- Delete: `apps/landing/components/blocks/system-dashboard.tsx`
- Delete if unreferenced: `apps/landing/components/mock-action.tsx`
- Delete if unreferenced: `apps/landing/components/mock-panels.tsx`
- Modify: `apps/landing/tests/landing-render.test.tsx`
- Modify: `apps/landing/tests/no-filler-sections.test.tsx`

**Interfaces:**
- Consumes: the six block components from Tasks 2–5.
- Produces: the final server component order and a landing module graph that no longer imports `@goproceed/ui/components`.

- [ ] **Step 1: Compose exactly the approved scene order**

```tsx
<NavFloat />
<main id="main-content" tabIndex={-1} className="overflow-x-clip">
  <Hero />
  <EvidenceJourney />
  <FieldReview />
  <ReadinessDiagram />
  <TrustBoundary />
  <PilotEnquiry />
</main>
<Footer />
```

- [ ] **Step 2: Remove all absorbed blocks and stale imports**

Run: `rg -n "ProofStrip|ProductTour|RolesDossier|Comparison|EvidenceIntegrity|PilotFormat|@goproceed/ui/components" apps/landing/app apps/landing/components`

Expected: no matches outside the kitchen-sink route. Do not modify the kitchen sink in this task.

- [ ] **Step 3: Run the complete landing suite**

Run: `pnpm --filter @goproceed/landing test`

Expected: all tests PASS.

- [ ] **Step 4: Run typecheck and production build**

Run: `pnpm --filter @goproceed/landing typecheck`

Expected: exit 0.

Run: `pnpm --filter @goproceed/landing build`

Expected: exit 0 without resolving absent `@tanstack/react-table` or `react-hook-form` through the landing route.

- [ ] **Step 5: Commit**

```bash
git add apps/landing/app apps/landing/components apps/landing/tests
git commit -m "refactor(landing): compose the evidence journey page"
```

---

### Task 7: Bounded visual QA and final correction

**Files:**
- Modify only as defects require: `apps/landing/app/globals.css`
- Modify only as defects require: `apps/landing/components/**/*.tsx`
- Create ignored artifacts under: `output/playwright/landing-evidence-journey/`

**Interfaces:**
- Consumes: the production build from Task 6.
- Produces: verified desktop/mobile captures with no source-controlled QA artifacts.

- [ ] **Step 1: Start the production landing and capture desktop/mobile in one pass**

Run the production server, then use Playwright CLI to inspect `1440x1000` and `390x844`. Capture the first viewport, Evidence Journey active state, field-review interval and pilot form. Record console output and horizontal overflow.

Expected: six scenes, no blank animated sections, one visual focus per fold, no clipped Ukrainian copy, and zero console errors.

- [ ] **Step 2: Perform keyboard, form and reduced-motion checks**

Verify skip link, nav CTA, journey reading order, all form controls, native invalid state, mailto URL generation, copy fallback, FAQ disclosure and visible focus. Emulate `prefers-reduced-motion: reduce` and confirm the journey remains a static readable stack.

- [ ] **Step 3: Apply one batched correction pass**

Fix every observed spacing, overflow, contrast, focus, copy or responsive defect together. Do not add new sections, dependencies or decorative effects during polish.

- [ ] **Step 4: Re-run automated gates and one confirmation capture**

Run: `pnpm --filter @goproceed/landing test && pnpm --filter @goproceed/landing typecheck && pnpm --filter @goproceed/landing build`

Expected: all commands exit 0.

Capture one desktop and one mobile confirmation screenshot. Stop polishing after this confirmation pass.

- [ ] **Step 5: Commit the correction batch**

```bash
git add apps/landing
git commit -m "fix(landing): finish responsive evidence journey"
```
