# 05. Design system and interaction language

## 1. Design thesis

AktFlow should feel like a precise commercial instrument used on a construction site: calm, legible and consequential. It must not look like a generic blue CRM, a toy AI interface or a dense accounting program.

Three qualities:

1. **Financial clarity:** large totals, explicit denominators and visible formulas.
2. **Field resilience:** high contrast, large targets, short tasks, honest offline state.
3. **Document trust:** versions, timestamps and provenance are always findable.

## 2. Visual foundation

### Color tokens

| Token | Value | Use |
|---|---:|---|
| `ink-950` | `#171717` | primary ink/sidebar (Evidence Atlas Carbon) |
| `ink-800` | `#2A2D2F` | secondary surfaces |
| `paper` | `#FBFBFB` | app background (Evidence Atlas Paper) |
| `white` | `#FFFFFF` | cards |
| `signal-500` | `#C6FF34` | brand/action/readiness (Evidence Atlas Lime) |
| `slate-600` | `#484C5E` | structural surfaces/dividers (Evidence Atlas Slate) |
| `signal-700` | `#84A625` | accessible text/accent |
| `amber-500` | `#F2B84B` | warning/at risk |
| `red-500` | `#E45C55` | blocked/destructive |
| `blue-500` | `#5278D8` | informational/submitted |
| `line` | `#D9DBD5` | borders |
| `muted` | `#686E6A` | secondary text |

Signal lime is not body text on white. Ready state always combines icon/label/color.

### Typography

- Display: Manrope Variable, 700–800.
- UI/body: Inter Variable, 400–700.
- Financial figures: tabular numerals.
- Hero desktop: clamp 56–88 px; page title 28–36; body 15–17; metadata 12–13.
- Minimum field-app body 16 px.

### Spacing/radius/elevation

- 4 px base grid; common spaces 8/12/16/24/32/48/72.
- Card radius 16 px desktop, 14 px mobile; input radius 10 px; pills fully rounded.
- Shadows are shallow (`0 8px 30px rgba(21,23,25,.07)`); borders carry most structure.
- Content max width 1240 px; dashboard may use full width.

## 3. Core components

### Buttons

Primary ink or signal background, secondary outline, tertiary text, destructive red. Labels use verb + object. Loading preserves width. Destructive actions name the consequence. Disabled control exposes reason via nearby helper text, not tooltip alone.

### Status chip

An icon, localized label and semantic tone. Canonical states are mapped centrally. Chip is never a mutation control by itself.

### Money card

Label, value, currency, comparison/denominator, timestamp and drill-down affordance. Display raw exact value to assistive tech even if visual number is abbreviated.

### Work table

Sticky header, optional pinned columns, column chooser, saved filters, density modes. Selection bar states item count and total value. Sorting/filter state appears in URL. Row actions live in a menu; primary row click opens detail.

### Requirement checklist

Each requirement has state, rule source/version, evidence/reviewer and resolution CTA. Missing requirements explain why and financial impact.

### Evidence viewer

Original/annotated toggle, metadata, linked work/location, annotations, download permission. Thumbnail grid uses lazy loading; full media requires explicit open.

### Timeline/audit

Actor avatar/name, humanized action, exact timestamp and affected version. System activity is visually quieter but never hidden.

### Toast and banners

Toast confirms reversible/light actions; durable outcome appears in the page. Error banners remain until resolved. Offline and sync state is persistent.

### Inline-editable table cell

Used in import mapping (S07), close include/exclude (S19) and package decision (S42). Click/Enter enters edit; Esc cancels to prior value; Tab commits and advances; commit shows optimistic pending state until server ack, and a version-conflict returns the field to the server value with an inline notice (never silent overwrite). Invalid value blocks commit with inline reason. Read-only cells (published/submitted snapshots) render non-editable with lock affordance.

### Date input

Format `DD.MM.YYYY` (uk-UA), keyboard-first with a calendar popover; parses partial/ambiguous input to the uk locale; disallowed ranges (closed period, future reporting date) are visibly disabled with reason; stores ISO date, displays localized. Never accepts device-locale ambiguity silently.

### Numeric / quantity input

Accepts UA decimal comma and space thousands separators, normalizes to canonical minor units; enforces the contract-unit precision (`quantity_scale`) and min/max bounds with inline validation; shows unit suffix from the contract line; rejects negative unless the field is an explicit correction. Assistive tech receives the exact raw value.

### File dropzone

Used in import (S07) and evidence/reference upload (S39). Drag-drop or browse; shows per-file type/size validation against the purpose policy before upload; resumable progress with pause/retry; rejected file states its reason (type/size/scan); never blocks the whole batch on one bad file. Quarantine/scan-pending state is explicit.

### Confirmation dialog (risky command)

For destructive, legal, financial and irreversible actions. Names the exact consequence, requires focus-trapped explicit confirm (Esc cancels, focus restores), and for high-risk commands shows the guard context — e.g. rule publish confirm names preview ID, input hash and contract snapshot; offboarding confirm names affected projects and resource resolutions; recent-auth-gated commands surface the step-up inline. The confirm button carries the verb+object, not "OK".

## 4. Motion

- 120–180 ms for small feedback; 220–320 ms for panels/page transitions.
- Use transform/opacity; avoid layout-jank animation.
- Landing financial flow may animate once when visible.
- Readiness number changes count smoothly only when it aids causality.
- Respect reduced motion: replace movement with instant state and subtle highlight.
- No confetti for commercial approvals or payments.

## 5. Content design

### Voice

Direct, professional, non-accusatory. Prefer `Не вистачає 2 фото до закриття стелі` over `Помилка валідації`. Prefer `Збережено на пристрої` over false `Успішно` while offline.

### Status vocabulary

Use a controlled Ukrainian glossary; every label below is the canonical `ui_uk` value from `technical/state-catalog.csv` for the named domain state and may not be reworded per page:

- У роботі (`work_item.in_progress`)
- Виконано (`work_item.performed`)
- Бракує доказів (`readiness.evidence_missing`)
- Очікує перевірки (`readiness.review_pending`)
- Внутрішньо готово (`readiness.ready_internal`)
- У пакеті (`readiness.packaged`)
- Готово до подання (`package.ready_to_submit`)
- Подано (`package.submitted`)
- Прийнято (`package.accepted`)
- Видано (`receivable.issued`)
- Оплачено (`receivable.paid`)

Avoid changing nouns by page (`акт`, `пакет`, `подання`) without definition. User/customer terminology can be aliases, not new system states.

### Date, money and units

- Full money in tables: `2 650 000,00 ₴`; compact dashboards: `2,65 млн ₴` with exact accessible label.
- Quantities keep imported precision; display unit-aware decimal rules.
- Relative time is accompanied by exact timestamp on detail.

## 6. Data visualization

Prefer financial rail, stacked bars, aging buckets and ranked tables. Do not use pie charts for more than four categories. Every chart includes textual summary, visible units, tooltip and downloadable underlying data. Never combine values from different currencies.

## 7. Field-specific rules

- Primary capture CTA remains reachable by thumb.
- Camera flow uses one requirement per screen where possible.
- Connectivity, local-save and sync confirmation are three distinct states.
- UI remains usable in bright sunlight; do not rely on gray-on-gray.
- Gloves/wet conditions: no precision sliders or tiny drag targets.
- Safety: app never encourages capturing while driving/operating machinery.

## 8. Design tokens implementation

Tokens live in one platform-neutral JSON source and generate CSS variables plus React Native tokens. Components can consume semantic tokens (`surface-danger`) but not literal colors. Brand can be themed for external portals without changing semantic states.

## 9. Normative visual direction: Evidence Atlas

`design-references/evidence-atlas/selected-direction.png` is the selected visual direction. Its application rules and complete asset inventory live in `design-references/evidence-atlas/README.md`. Earlier landing/dashboard/mobile/onboarding boards remain historical exploration and must not override Evidence Atlas.

The product is a living evidence dossier, not a generic CRM:

- Paper/White occupies 74–78% of a typical desktop surface.
- Carbon occupies 17–21% and is reserved for navigation, high-consequence workflow stages and field chrome.
- Lime occupies at most 4–5% and means `next action` or `verified`; it is not ambient decoration.
- Slate carries annotations, reference rules and secondary document structure.
- Layered folios, exact file labels, audit stamps and cross-reference rails make provenance visible before detailed metadata is read.

The selected production assets are:

- `blueprint-folio.png`: synthetic construction-plan texture for hero, auth, setup and document surfaces;
- `cable-tray-evidence.png`: synthetic construction evidence used in field, review and landing demonstrations;
- `verified-stamp.png`: generated synthetic audit stamp used only at durable receipt moments.

All assets are synthetic, contain no people/customer data/logo/readable customer document and are copied under both the design-reference catalog and prototype public assets. UI must use the source assets rather than approximate them with CSS/div drawings.

## 10. Evidence Atlas layout grammar

### Public/landing

The first viewport is paper-dominant: compact navigation, large left statement and a layered blueprint + live dossier product object on the right. Above-the-fold order is fixed: outcome statement → explanation → pilot/demo CTA → conservative proof boundary. The object must show ready/risk values and linked evidence; it cannot be a decorative screenshot.

The subsequent rhythm is:

1. financial summary ledger;
2. four-step evidence-to-payment chain;
3. Carbon mobile field stage;
4. role dossier;
5. security/archive ownership;
6. plans;
7. Carbon pilot CTA.

### Auth and onboarding

Authentication uses one document-controlled form and one contextual dossier surface. Onboarding keeps a dedicated setup journey and does not expose an incomplete app navigation. Progress, exact import counts, version consequences and `save and exit` are visible.

### Desktop workspace

The sidebar is the Carbon dossier index. Navigation groups follow the business model:

1. work → assignments → evidence;
2. rules/terms → close → package → project payment;
3. variation/team/SaaS plan/settings.

Every route header shows the project breadcrumb, screen title, exact dossier/file identity, current process chain and optional next logical hand-off. The route rail supplements the sidebar; it never replaces it.

Tables and KPI areas behave like ledgers: contiguous rules, low radius, exact monetary hierarchy and sparse elevation. Do not turn every row or metric into an isolated rounded card.

### Field mobile

The field client uses Carbon chrome and Paper task folios. Its primary navigation is exactly `Сьогодні`, `Фіксації`, `Черга`. Capture, local receipt and server receipt are distinct states. Real synthetic evidence imagery is visible at the task, capture review and capture register levels.

### External review

The external reviewer sees an exact package dossier. Section navigation (`Огляд`, quantities, evidence index, waivers, versions) must change the visible document state. The decision rail stays pinned to the exact package version and always states that operational acceptance is not KEP.

## 11. Navigation and interaction conventions

- Logo returns to public home; project breadcrumb returns to `/app`.
- Project/org switch opens a bounded context chooser and never silently changes data.
- Notification bell opens actionable deep links; notification preferences live in workspace settings.
- Sidebar selected state is computed from the route and handles nested package/occurrence routes.
- Legal links open actual privacy/terms surfaces.
- Password recovery and magic-link actions show durable-looking demo receipts.
- Main tabs, menus, filters, toggles and CTAs have a working local state; controls outside the core journey may be read-only only when the limitation is stated beside them.
- Help opens a real support contact rather than a dead anchor.

## 12. Direction-specific motion

- Folio enter: 8–12 px vertical offset, 420–460 ms, once.
- Dossier card enter: 10 px, 460 ms with short stagger.
- Verification stamp: 280 ms scale/opacity only after a receipt.
- Route hand-off icon: maximum 3 px horizontal shift on hover.
- Mobile receipt: 360 ms from local state into dossier state.
- Reduced-motion mode removes transforms and continuous decorative movement.

## 13. Visual QA contract

Design QA must:

1. render at least landing desktop, dashboard desktop, evidence review desktop, onboarding desktop and field 390×844;
2. compare the selected direction and current render in the same visual input;
3. check crop quality, header/route context, money hierarchy, evidence visibility, responsive overflow, focus states and reduced-motion fallback;
4. record the final decision in project-root `design-qa.md`;
5. keep generated asset source, production copy and usage manifest aligned.

## 14. Governance

- All new components require visual states, accessibility API, content example and test ID policy.
- Product may add a component only after checking existing primitives.
- Quarterly audit: contrast, focus order, terminology drift and unused tokens.
- Screenshots in sales materials must use synthetic/redacted data and visible demo label.
- Evidence Atlas is the single selected direction. A replacement requires a documented product-design decision and a full flow visual regression, not a one-screen restyle.
