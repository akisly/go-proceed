# 16. Prototype fidelity and interaction ledger

Дата проверки: 23 июля 2026.  
Статус: pass для product-spec prototype; не production certification.

## 1. Метод

- Выбранный visual source: `design-references/evidence-atlas/selected-direction.png` (`Direction 02 — Evidence Atlas`).
- Production assets: `design-references/evidence-atlas/assets/` и зеркальные browser assets в `prototype/public/assets/evidence-atlas/`.
- Последние рендеры: `prototype/qa-screenshots/`.
- Viewports: desktop flow checks at 1200–1487 px width; dashboard 1487×1058 (native concept size); mobile 390×844.
- Final smoke выполнен существующим repository QA harness на закреплённом packaged Chromium. Work-mode browser не открыл локальный preview в текущем workspace; это ограничение preview surface, а не product pass.
- Source и implementation first viewport объединены в `design-qa/landing-first-viewport-comparison.png` и просмотрены как один comparison input. Representative landing/dashboard/evidence/field renders также просмотрены после финальных исправлений.

## 2. Comparison ledger

| Point | Selected-direction evidence | Render evidence | Result / fix |
|---|---|---|---|
| first viewport palette | Paper-dominant hero, Carbon type, Lime CTA | same hierarchy and proportions; comparison input stored in `design-qa/` | pass |
| hero product object | layered blueprint folios, live monetary dossier, right-side evidence attachments | real generated blueprint/evidence assets, code-native 2.65m/750k dossier, evidence cards and generated receipt stamp | pass |
| asset authenticity | construction plans, site photo and audit stamp are visible artifacts | generated synthetic PNG assets, source + production copies + manifest | pass; no CSS/div placeholder media |
| landing rhythm | paper hero/ledger → workflow → Carbon mobile stage → roles/security/pricing | exact section order and evidence-to-payment story retained | pass |
| workflow blocks | compact connected hand-off blocks | one contiguous four-column ledger, Lime only on step signal | pass |
| desktop dossier shell | Carbon index + Paper working surface | grouped route navigation, nested selected state, project context, actionable notifications and route hand-off rail | pass |
| dashboard financial hierarchy | exact ready/risk/paid monetary hierarchy | contiguous KPI ledger, financial rail, dark action panel and five risk rows above fold | pass at 1487×1058 |
| evidence review | photos remain primary, amount/context visible beside decision | real evidence imagery, warning treatment, original/correction receipts and exact `CAP-742-R2` lineage | pass |
| onboarding | controlled document setup with progress | dedicated five-step setup, exact import/mapping counts and rules hand-off | pass |
| mobile field | Carbon chrome, Paper task folios, visual evidence, local/server receipt | working Today/Captures/Queue tabs, evidence thumbnail, camera review, separate local/server states | pass at 390×844 |
| external package dossier | document section index + exact-version decision rail | section navigation changes content; decision remains pinned to v2 | pass |
| trust/support routes | no dead legal/auth/settings affordance | working privacy, terms, recovery, notification/settings and support destinations | pass |
| typography/icons | heavy neo-grotesk display + practical UI sans and outline icons | Manrope Variable + Inter Variable + Lucide, Cyrillic assets bundled | pass |
| motion | folio, stamp and connector-like hand-off motion is calm and bounded | 280–460 ms transform/opacity with `prefers-reduced-motion` fallback | pass |
| keyboard/a11y baseline | visible focus, status not color-only, usable controls | skip link, `aria-current`, live receipts, labelled search/input, modal focus/escape/restore | automated baseline pass; manual WCAG audit remains release evidence |

## 3. Above-the-fold copy diff

Allowed/implemented strings match the product concept:

- `AktFlow`
- `Продукт`, `Як працює`, `Для кого`, `Безпека`, `Тарифи`
- `Увійти`, `Запустити пілот`
- `Виконані роботи мають ставати оплатою.`
- `AktFlow пов’язує кожну позицію кошторису з доказами, погодженнями та документами — ще до подання АВР.`
- `Переглянути демо`

Below-CTA proof strings (`45 днів пілоту`, `1 живий об’єкт`, `Без заміни обліку`) are product-spec functional proof, not unsupported outcome claims. No customer logos, percentages saved or invented revenue claims were added.

## 4. Interactions verified in baseline run

Automated headless Chromium run passed:

1. landing demo CTA navigates to populated dashboard;
2. risk work row opens evidence/readiness drawer;
3. onboarding validation shows deterministic result;
4. login submits to workspace;
5. work register selection produces bulk action bar;
6. billing plan selection enables confirmed change action;
7. field task opens capture;
8. two evidence taps and quantity produce durable local receipt;
9. network simulation changes local state to server-confirmed.
10. onboarding import hands off to project-scoped rule setup;
11. fresh rule impact renders exact preview proof;
12. changing the draft makes preview stale and disables publish;
13. publish dialog receives focus, Escape closes it and restores focus;
14. acknowledged fresh preview publishes an immutable v2 and completes reevaluation;
15. returned evidence creates `CAP-742-R2`, obtains a server receipt and a new review decision while `CAP-742` remains returned;
16. `/app/rules` has no horizontal overflow at 390×844 and hidden skip-link does not leak into the viewport;
17. pilot qualification enforces the service/privacy acknowledgement, keeps marketing opt-in off and returns an opaque lead receipt without creating a workspace;
18. invitation acceptance blocks until terms acknowledgement, exposes MFA consequence and returns a scoped-access activation receipt;
19. variation compose → evidence/value → preview produces a versioned operational notice receipt;
20. close flow preserves an evidence blocker after request, audits a waiver, unlocks and fixes the immutable period snapshot;
21. package generation reaches ready, produces a download receipt and records an exact-version submission receipt;
22. external reviewer opens the exact version, can return it and can separately record an operational acceptance receipt;
23. project payment allocation and least-privilege team invitation both produce durable-looking receipts;
24. package search exposes a non-dead zero-results recovery state;
25. dashboard evidence request returns a reference, explicitly keeps the blocker active and opens the exact work context;
26. both visible “add work” entry points open the same audited single-item flow and update the register count after its receipt.
27. grouped sidebar routes, nested package/occurrence selected states and contextual next-hand-off routes are code-native links rather than dead UI;
28. landing legal links, password recovery, magic-link receipt, notification menu, project context menu and workspace notification preferences have explicit local states;
29. field `Сьогодні`/`Фіксації`/`Черга` and external dossier section navigation change the visible content while retaining exact business context.

No browser console/page errors were observed in the final run.

Свежий browser smoke покрывает каждую интерактивную flow family из документа 29, включая v2.9 staged offboarding, exact execution bundle и post-invalidation quarantine copy. Даже pass подтверждает только кликабельность и локальные state consequences прототипа, а не backend authorization, durability, security, legal effect, accessibility certification или production E2E.

## 5. Final judgment

The prototype is faithfully aligned with the selected Evidence Atlas direction across public, setup, desktop, field and external-review surfaces. The selected assets and their usage rules are now part of the specification, not an orphan moodboard. Navigation, nested route state, primary tabs, conversion links and trust/support affordances are connected; the 17 business flow families still pass unchanged. Remaining production gaps are backend/security/legal/runtime evidence already tracked by the production-readiness gates, not visual or interaction omissions in this prototype revision.
