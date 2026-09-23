# DEV-035 — The office dashboard after the Autumn CRM reference: shell and project page

## Assignment

- Objective and user-visible outcome: the office dashboard (`/dash`) reads like the owner's reference, the five «Autumn CRM Dashboard» shots by Uxerflow. The shell becomes a paper sidebar with three labelled groups (menu, the workspace's projects, settings) beside a white work sheet; the project page gets a breadcrumb, the project's name as its heading, two tabs (Огляд / Доручення), a row of KPI cards with tinted index tiles, and a readiness block (a segmented bar of stage states and a cell grid of requirements); the primary action in the dashboard is pine. **Extended 2026-09-23 by the owner:** the dashboard becomes `apps/app`'s root (`/dash/**` → `/**`, old addresses redirect) and the field PWA in `app/(app)/**` is removed with every piece of code that becomes unreachable (ADR-009 amended). Closes BL-119 for the shell and the project page, BL-117, and BL-053 (the rail's four disabled placeholders).
- State: done — merged by the owner as PR #110 (`3141a33`, 2026-09-23 09:43 UTC); post-merge production checks PASS (below); the owner accepted the NOT RUN items («да, сделай PR», answering the question that named them)
- Coordinator: primary session (Claude Code, Opus 5.5)
- Execution mode: independent subagents for the stages root `AGENTS.md` requires
- Selected route and why (`agents/COORDINATION.md`): UI change through the design-system route — it starts in `packages/tokens` (five roles: three for the pine button, two for the cell chart), reaches `packages/ui` (a Button variant and three components) and lands in `apps/app`'s shell and project screens.
- Triggered stages and why: *[scope extension: no `gp-architect` — no table, `/v1` contract, catalog or policy changes, and the ADR amendment records an owner decision rather than designing one; `gp-security` not strictly triggered — `proxy.ts`, session and OTP code are untouched except comments, the matcher test covers every dashboard route, and `next.config.ts` redirects run before the proxy onto paths it still gates — but run briefly anyway, see below.]* `gp-reviewer` (always), `gp-ui-reviewer` (`apps/app/app`, `apps/app/src/components`, `packages/ui`, `packages/tokens`), `gp-qa` (always). No `gp-architect`: no table, `/v1` contract, state/capability/event catalog or policy changes (the copy catalog `technical/copy-catalog.csv` does change, which is a `gp-ui-reviewer` trigger, not an architect one) — the screens read `GET /v1/projects`, `/v1/projects/{id}/blocked-value` and `/v1/projects/{id}/readiness`, all of which exist. No `gp-security`: no auth, session, RLS, secret, env or CI permission is touched. `gp-mobile` *(run on the scope extension, 2026-09-23 — DEV-035 review R4-02: removing the installable field client and its capture path is exactly its trigger; the first line of this record said «No `gp-mobile`» when `apps/mobile` was the only field-client code in view)*; `gp-security` *(a short pass on the `/dash` redirect, the 404 page and the tenancy wording, at `gp-reviewer`'s suggestion)*.
- Owning module and allowed edit paths: `packages/tokens/src/tokens.json` and its generated files, `packages/ui/src/components/**`, `packages/ui/src/base.css`, `packages/testing/src/{contrast,component-contract}.test.ts`, `apps/landing/app/kitchen-sink/components/page.tsx`, `apps/app/app/dash/**` → `apps/app/app/(dash)/**`, `apps/app/app/(app)/**` (deleted), `apps/app/app/{layout,not-found}.tsx`, `apps/app/public/manifest.webmanifest` (deleted), `apps/app/src/{components,layouts,services,lib}/**` (incl. deleting `src/lib/{field,capture}/**`), `apps/app/tests/{proxy-cors.test.ts,helpers/upload-intent-body.ts}` and the three integration suites' import line, `packages/testing/src/app-entry.test.ts`, `agents/{COMMON.md,roles/gp-mobile.md}` and the generated profiles, `.github/workflows/ci.yml` (comment), `docs/{product,delivery,architecture}/**`, `infra/README-staging.md`, `technical/{database/invariant-catalog.csv,states/README.md}`, `apps/app/qa/field.mjs`, `apps/app/next.config.ts`, `apps/app/tests/proxy-cors.test.ts`, `apps/app/AGENTS.md`, `README.md`, `START_HERE.md`, `docs/STATUS.md`, `docs/decisions/ADR-00{7,9}-*.md`, `technical/copy-catalog.csv`, `DESIGN.md`, `docs/design/02-building-ui.md`, `docs/design/03-ui-references.md`, `docs/BACKLOG.md`, `docs/tasks/`.
- Read context and applicable local instructions: `AGENTS.md`, `apps/app/AGENTS.md`, `docs/design/02-building-ui.md`, `docs/design/03-ui-references.md`, `docs/design/04-role-pain-map.md`, `DESIGN.md`.
- Linked spec, ADR or earlier task: BL-119, BL-117; DEV-028 (the Autumn palette), DEV-029 (the `chip-*` index tints); ADR-009 (the pilot surfaces).
- Baseline: `27dea79` (merge of PR #108).
- Dependencies / constraints / out of scope: no push, PR or merge without the owner. No new `/v1` read — a time series (the reference's chart by month) and a period picker need a contract and are deferred to a backlog entry. *[Until the owner's extension of 2026-09-23: «The field client (`/`, `/a/*`) … not restyled» — it is removed instead.]* The field client (`/`, `/a/*`), the external review surface, the new-assignment form, the evidence page and the profile page are not restyled beyond what the shell gives them. The workflow editor, AI agent, chat and log frames of the reference are not this product. The money screen's invariants stay: one figure per currency and never a cross-currency total (INV-012), the honesty counts beside the sum, the cause split as one sentence.
- Required acceptance criteria:
  1. The five new roles (`action-brand-*`, `viz-brand`, `viz-empty`) have rulings and contrast pairs in `contrast.test.ts` in both themes; the generated artefacts are regenerated byte-exact; no value exists outside `tokens.json`.
  2. `Button` gains ONE variant, `brand` (pine fill, white label), and every dashboard primary action under `apps/app/app/dash/**` (`app/(dash)/**` since the extension) uses it; the landing carries none.
  3. `Stat`, `Waffle` and `TabNav`/`TabLink` exist in `packages/ui/src/components`, are exported from `index.ts` with the inventory note updated, and are rendered in the kitchen sink; none writes a colour as a value or a class as a template literal.
  4. The shell: the sidebar carries «Меню», «Проєкти» (every project the member sees, each a link, tinted by its position) and «Налаштування»; the current page is marked with `aria-current="page"`; the four disabled placeholders are gone; the work area is a white sheet on `md` and up; the 768–1240 icon rail and the mobile drawer still work, and the profile control still fills the rail.
  5. The project page: breadcrumb «Проєкти / {name}», the name as `h1`, tabs «Огляд» and «Доручення» (the latter's `href` is the register), a KPI row that keeps one money card per currency and the two honesty counts in the same row, a readiness block whose segments are labelled in Ukrainian with vacuous stages named as such (INV-072), a requirement grid with a text equivalent, and the existing register, reasons list and cause sentence unchanged in content.
  6. The register page shows the same header and tabs with «Нове доручення» as its brand action; the new-assignment page's `h1` stays «Нове доручення».
  7. `DESIGN.md`, `docs/design/02-building-ui.md` §3.3 and `docs/design/03-ui-references.md` rule 5 state the amended app rules with the owner's decisions of 2026-09-23 beside them.
  8. The gate: motion-audit, the design contract suites of `@goproceed/testing` (the database suites are NOT RUN — they reset the local stack), `@goproceed/app` unit tests, typecheck, the landing build, the app build, the app harness, `validate:canonical-docs`.
  9. Screenshots at the six widths and reduced motion (the harness's daylight pass).
  10. *(added 2026-09-23, owner)* The dashboard is served at `/`, `/projects/{id}`, `/projects/{id}/assignments[/new]`, `/assignments/{id}`, `/settings/profile`; every in-app link, redirect and `?next=` uses the new paths; `/dash` and `/dash/**` answer a temporary redirect to the same path without the prefix; every dashboard route stays behind the member-session proxy.
  11. *(added)* `app/(app)/**`, `src/lib/field/**`, the whole of `src/lib/capture/**` and the `Button` `destructive` variant are gone, and nothing references them; `buildCreateIntentBody` lives on, verbatim, as the test helper `apps/app/tests/helpers/upload-intent-body.ts` imported by three integration suites. *[First wording: «`src/lib/capture/upload.ts` and its helpers stay» — superseded when the rest proved dead.]*
  12. *(added)* The harness drops its three field audits, signs in through `?next=/projects/{id}`, and probes the `/dash` redirect; all remaining audits pass.
  13. *(added)* ADR-009 carries a dated amendment in the owner's words, ADR-007 a pointer, and README, START_HERE, `apps/app/AGENTS.md`, STATUS and BL-001 say the PWA is retired and what that costs — *[corrected after `gp-mobile`, M1-01: the first wording («no deployed web field client; Telegram is the foreman's path») was false]* the field client that remains is `apps/mobile`'s web export at Vercel `goproceed-field` (re-observed serving 2026-09-23 08:32 UTC, CORS to `/v1` passing); the Telegram channel is built but enabled in no environment; merging retires the PWA in production.
- Skipped stages and rationale: recorded above.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | «проанализируй референсы дашобоарда, это я хочу что бы наш так выглядел» — the five Autumn CRM Dashboard shots (Homepage 27537255, Workflow 27543770, Insight 27554333, Workflow Management 27557794, UX Highlight 27564607). | chat (/goal) |
| 2026-09-23 | Cards «Как в Autumn»: lift the `apps/app` density rule of `02-building-ui.md` §3.3 for the dashboard — rounded cards with a soft shadow and a lifted active navigation item. | chat, answering the coordinator's question |
| 2026-09-23 | The dashboard's primary button «Зелёная, как в Autumn» — a pine fill with white text. | chat, same question |
| 2026-09-23 | Chart data «Зелёный + акцент»: filled cells in pine, ember only for a highlighted cell or cursor. | chat, same question |
| 2026-09-23 | Start with «Каркас + страница проекта» (steps 1–3 of the analysis), then «да, запускай». | chat |
| 2026-09-23 | «сделай dash главным роутом и удали все что в (app)». Asked whether that retires the PWA before ADR-009's parity gate or moves it to `/field`: **«Удалить сейчас»**; scope: **«Всё мёртвое»** (routes plus the code nothing else imports); packaging: **«В тот же DEV-035»**. | chat, answering the coordinator's question |
| 2026-09-23 | Manifest «Убрать манифест»; assignee hint «Нейтральный»; release-scope and architecture docs «телеграм + expo-mobile». | chat, answering the coordinator's questions |
| 2026-09-23 | «сделай коммит, пуш и PR в main». | chat |
| 2026-09-23 | «закрой BL-136, goproceed-field не трогай» — BL-136 (no security headers on the field origin, script-readable session) closed as `wontfix (owner)`; the field origin is not changed. | chat |
| 2026-09-23 | The owner merged PR #110 (09:43 UTC, `3141a33`). |  GitHub |
| 2026-09-23 | «да, сделай PR» — to the coordinator's offer to record the post-merge checks, close BL-053/117/119 and mark DEV-035 done «if you accept the NOT RUN items (database suites; CI)». | chat |

## Plan

1. Tokens: `action-brand-bg` / `-fg` / `-hover` (pine-700 / white / pine-800; dark pine-300 / ink / pine-200) and `viz-brand` / `viz-empty` for the cell chart; amend the rulings of `shadow.raised`, `radius.card`. Contrast pairs first. Check: `pnpm --filter @goproceed/tokens generate`, `contrast.test.ts`, `token-fidelity.test.ts`.
2. `packages/ui`: `Button` variant `brand`; `Stat`, `Waffle`, `TabNav`/`TabLink`; index and kitchen sink. Check: `component-contract.test.ts`, landing build.
3. Shell: `DashLayout` passes the projects to `Sidebar`; sidebar groups and links with `aria-current`; the white sheet. Check: typecheck, harness `/dash` rail and drawer audits.
4. Project frame (`ProjectPage`: breadcrumb, `h1`, tabs, action) on the overview and the register; `readiness.service.ts`; the KPI row and readiness block on the overview. Check: `@goproceed/app` unit tests for the readiness mapping, harness project audit.
5. Docs: `DESIGN.md`, `02-building-ui.md`, `03-ui-references.md`, BACKLOG (BL-117, BL-119, a new entry for the time series).
6. Gate, screenshots, `gp-ui-reviewer` + `gp-reviewer`, rework, `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | analysis | The reference's brand sheet is ours (DEV-028); the gap is composition. Four rule conflicts put to the owner and answered. | this record, «Owner decisions» | implement |
| 2 | implementation | Tokens, `packages/ui` (Button `brand`, `Stat`, `Waffle`, `TabNav`/`TabLink`, `Breadcrumb`, `Panel` on `shadow-raised`, `Meter` `data-slot`), shell, project frame, readiness block, register frame, harness, docs. | working tree on `27dea79` | gate |
| 3 | numbering | The number DEV-032 was taken by a parallel session (branch `claude/evidence-hardening`: DEV-032…034, BL-126…132). This task is **DEV-035**. Its backlog entries were written as BL-126…BL-129 on `main`'s sequence; PR #109 merged first (`b16fc9b`), so on merging `main` into this branch they became **BL-133…BL-136** (time series, dashboard follow-ups, PWA-retirement loose ends, field-origin security headers). | `git log --all`; the Evidence session's message | — |
| 4 | INCIDENT | While running the non-database contract suites, the file list was built with a zsh glob that came back empty (`src/*.test.tsx` has no match), so `npx vitest run` ran EVERY `packages/testing` suite — fifteen call `resetDb()` → `supabase db reset`. The shared local database was rebuilt from `0001`–`0089` + `seed.sql` without the owner's consent, which `AGENTS.md` forbids; the login roles lost their dev passwords (restored by the other session with `scripts/set-local-app-password.mjs`). Schema intact; local data gone. Reported to the owner; memory `local-supabase-stack.md` records how to avoid it. | this session, ~02:22 | owner informed |
| 5 | gate | tokens generate; motion-audit clean; 13 non-database contract suites 206/206; `apps/app` `src` unit tests 536 pass, 1 skipped; typecheck 10/10; landing build; app build; `validate:canonical-docs` OK. | scratchpad `gate.txt` | harness |
| 6 | harness run 1–3 | Run 1: every API read failed — the copied `apps/app/.env.local` carried `NEXT_PUBLIC_APP_ORIGIN=` and `SUPABASE_SECRET_KEY=` EMPTY, which defeats both local fallbacks (environment, not code; empty lines commented out in the worktree copy). Runs 2–3: project page, register, evidence and create audits PASS; two real findings (tab «Огляд» 37px wide on touch; the status-colour-alone check firing on `Meter`) fixed; the late daylight pass failed because the shared database was truncated mid-run by another session's `apps/app` integration suites (one organization, created 02:36:59). | scratchpad `qa-run1..3.log` | clean re-run in an agreed quiet window |
| 7 | merge of `main` | PR #110 conflicted after PR #109 (Evidence, DEV-032…034, BL-126…132) merged as `b16fc9b`. Conflicts were only `docs/tasks/README.md` and `docs/BACKLOG.md`, resolved by keeping both sides (`main`'s rows first); this task's entries renumbered BL-126…129 → **BL-133…136** in the backlog, this record, `ci.yml` and `tenancy-and-security.md` (only lines this task added). No code conflict; nothing in the merged tree imports a module this task deleted. Owner: «поправь конфликты». | gate on the merged tree: 13 contract suites 202/202, `apps/app` 514 + 1 skipped, typecheck 10/10, both builds, docs and agents OK; harness 6/6, zero findings (12:33) | — |
| 8 | post-merge production | Checked read-only at 09:58 UTC on `goproceed-app` and `goproceed-field`: `/manifest.webmanifest` 404; `/dash` and `/dash/projects/…?x=1` redirect with path and query kept (then the proxy sends an anonymous visitor to `/login?next=…`); the three crafted `/dash` paths stay on the same origin (S1-04 PASS on Vercel's router); `/a/{id}` → sign-in; `goproceed-field` serves its Ukrainian sign-in and manifest (AC-01), and a cross-origin `/v1/projects` read from it is allowed (401, AC-02). | in-app browser | done |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| H-01 | minor | harness @390/360, tab «Огляд» | 44px touch floor vs 37px wide | coordinator | `TabLink` gets `touch:min-w-(--gp-control-height-touch)` |
| H-02 | minor | harness status-colour-alone check on the readiness `Meter` | Meter names every state in its legend; the check had never met one | coordinator | `Meter` root `data-slot="meter"`; the check excuses a legend dot and the `aria-hidden` bar of a Meter only (narrowed again by R1-04) |
| R1-01 | major | `stage-readiness.ts` `readinessColumns` | the grid must count the blocking requirements the bar is defined by; it counted every occurrence | coordinator | columns from `blockingOccurrenceCount` / `satisfiedOccurrenceCount`; new test with non-blocking requirements |
| R1-02 | major | `technical/copy-catalog.csv` | new strings uncatalogued, `dash.nav.*` and three rows stale | coordinator | eight `dash.nav.*` rows removed with the UI; four rows rewritten; 24 keys added |
| R1-03 | minor | KPI «Етапи до закриття» | ambiguous label, parts not adding up, under the money heading | coordinator | label «Можна закрити», unit «з N етапів», caption names blocked · vacuous · closed; row headed «Показники»; vacuous label «можна закрити без доказів» |
| R1-04 | minor | harness status check | exemption not scoped to Meter | coordinator | both exemptions scoped to `[data-slot="meter"]` |
| R1-05 | minor | rail `aria-current` | «page» on a parent link | coordinator | `page` on exact match, `location` for a sub-page; test updated |
| R1-06 | minor | icon rail | no way to tell folders apart | coordinator | every rail item carries its label as `title` (tile look left to `gp-ui-reviewer`) |
| R1-07 | minor | BL-053 | resolved by this task but open | coordinator | scheduled → DEV-035 (closed at completion) |
| R1-08 | minor | six stale/garbled comments | — | coordinator | rewritten; `border-r-0` no-op removed |
| R1-09 | remark | brand-variant contract test | no positive control | coordinator | asserts files scanned > 10 and the kitchen sink matches; regex accepts `variant={"brand"}` |
| R1-10 | remark | shadow licence wording in three texts | disagreed | coordinator | 02 §3.3, `shadow.raised` ruling and DESIGN.md name the same four surfaces |
| R1-11 | remark | this record; kitchen-sink sample grammar | drift | coordinator | fixed here; «12 з 21 вимоги» |
| R2-01 = U1-01 | major | KPI unit «з N етапів» | noun must agree with N | coordinator | `stagesOutOf` in `stage-readiness.ts` with `pluralUk` («з 1 етапу», «з 21 етапу»); test for 1, 2, 11, 21 |
| U1-02 | major | KPI row | one focal figure; the sum and three counts were one size | coordinator | `Stat` `emphasis="secondary"` (`text-h3`, secondary ink) on the three counts; the money figure alone at `text-h2` |
| U1-03 | minor | money card label wraps at 1240 | figures share a baseline | coordinator | label «Заблоковано, UAH»; the basis opens the caption «Валова сума · …» |
| U1-04 | minor | ink tile beside the h1 | one mark per object, lighter than the money | coordinator | neutral tile (`bg-subtle`, hairline, secondary ink) |
| U1-05 | minor | icon rail | projects indistinguishable without hover | coordinator | a one-or-two-letter monogram in the tile (`monogram()`, tested) |
| U1-06 | minor | `EvidenceCard` | no card-in-card elevation | coordinator | its own `shadow-raised` removed |
| U1-07 | minor | KPI row at 390/360 | readiness not pushed a phone-length down | coordinator | `grid-cols-2`; the money card spans two below `md` |
| U1-08 = R2-02 | minor | copy catalog | unrendered and duplicate rows; missing fragments | coordinator | `dash.project_overview.heading` and `dash.page.assignments_heading` removed; `gross_basis`, `kpi_unit`, `kpi_caption` added; `currency_eyebrow` re-described |
| U1-09 | minor | kitchen sink case 24 | withdrawn wording | coordinator | current labels, captions and `emphasis` |
| U1-10 | remark | action between h1 and tabs at 390 | tabs stay with the heading | coordinator | header grid; the action is `order-last` below `md` |
| U1-11…U1-14 | remark | stage identity in the chart; evidence/new screens outside the frame; `/dash` home; «Без ціни» vs «Без оцінки» | — | owner / next slice | BL-134 |
| U1-15 | remark | gate evidence | unabridged gate in the record | coordinator | «Acceptance evidence» below |
| U2-01 | remark | monogram tile | two letters fill a 20px tile | owner / next slice | deferred — BL-134 (5) |
| U2-02 | remark | KPI row at 390 | «Можна закрити» alone on a second row | owner / next slice | deferred — BL-134 (5) |
| Q2-01 | minor | this record: «typechecked» | the gate does not compile `tests/` | coordinator | reworded, with gp-qa's ad-hoc `tsc` result |
| Q2-02 | remark | three scope statements naming Telegram without the caveat | caveat | coordinator | added |
| Q2-03 | remark | two walks without positive controls | controls | coordinator | `scanned > 20` in both |
| Q2-04 | remark | contrast label named the removed variant | rename | coordinator | «the blocked border on a surface» |
| Q1-01 | remark | `02-building-ui.md` §4.2 | «twenty-seven components» vs 31 | coordinator | «thirty-one … (twenty-seven until DEV-035)» |
| Q1-02 | remark | copy catalog `dash.page.evidence_heading` | cites the removed `dash.nav.evidence` | coordinator | reworded |
| Q1-03 | remark | this record, U2-01/U2-02 | no destination | coordinator | both added to BL-134 (5) |
| Q1-04 | remark | this record | rework line, state, handoff | coordinator | closed out below |
| U2-03 | remark | `sidebar.tsx` comment | «four tinted folders» | coordinator | comment rewritten (no behaviour change) |
| R3-01 | minor | copy catalog `dash.project_money.gross_basis_suffix` | unrendered since U1-03 | coordinator | row removed (`gross_basis` carries the fact) |
| R3-02 | remark | `ProjectPage` action DOM order below `md` | reading order = visual order | coordinator | action last in the DOM, placed from `md` with `md:col-start-2 md:row-start-2` |
| R3-03 | remark | BL-133 wording; numbering note | stale | coordinator | «blocking requirement»; progress row 3 names BL-134 |
| R4-01 | major | release-scope, architecture, runbook, staging docs and agent instructions still called the PWA the field client | dated corrections in the owner's words («телеграм + expo-mobile») | coordinator + `gp-implementer` (bounded) | 12 docs rewritten with the old wording kept; `agents/COMMON.md`, `agents/roles/gp-mobile.md`, profiles regenerated (`validate:agents` OK) |
| R4-02 | major | `gp-mobile` not run | required by the field-client installability/capture trigger | coordinator | `gp-mobile` ran (M1-*); a short `gp-security` pass too (S1-*) |
| R4-03 | minor | the path rewrite falsified historical comments | history kept as written | coordinator | restored from `27dea79` with dated notes |
| R4-04 | minor | comments/harness citing deleted files | tagged or removed | coordinator | tags; harness `NOT_COVERED` rewritten; see R5-01/R5-02 |
| R4-05 | minor | catalog, docs, BL-043/049 and this record carried old paths | updated | coordinator | done |
| R4-06 | remark | `/dash` redirect untested for crafted paths | a probe | coordinator | harness asserts path + query and no off-origin `Location` for three crafted paths |
| U3-01 | major | new-assignment hint promised «Мої доручення» on a phone | owner: «Нейтральный» | coordinator | «Учасник робочого простору, який виконуватиме роботу.» |
| U3-02 | minor | the dashboard still shipped the PWA's manifest and description | owner: «Убрать манифест» | coordinator | manifest deleted; description rewritten and catalogued; harness asserts 404 and no `rel=manifest` |
| U3-03…05 | minor/remark | catalog paths; gate abridged; `danger-600` ruling | — | coordinator | fixed; `gate6.txt` unabridged |
| M1-01 | blocker | the recorded cost («no deployed web field client; Telegram is the path») was false | `goproceed-field` serves; Telegram enabled nowhere | coordinator | re-observed 2026-09-23 08:32 UTC; ADR, README, BL-001, STATUS, criterion 13 corrected |
| M1-02 | major | merging IS the production retirement | a before-merge block | coordinator | «Before merge» section |
| M1-03 | minor | old `/a/{id}` links → English 404 | Ukrainian 404 (option b) | coordinator | `app/not-found.tsx` + harness probe; redirect option → BL-135 (5) |
| M1-04 | minor | keep the manifest under a new name | superseded by the owner («Убрать манифест») | owner | recorded; BL-135 (4)(6) |
| M1-05…M1-08 | major/minor | higher-precedence docs, invariant witnesses, mobile headers, leftovers | — | coordinator | docs (R4-01), INV-081/086 notes, `ci.yml` comment, BL-135, `src/lib/capture` deleted |
| R5-01 | major | a tag after `*/}` rendered «[deleted …]» on the money-refusal screen | no stray text | coordinator | tag moved inside the comment; `project-money-forbidden.test.tsx`; `jsx-comment-guard.test.ts` scans every `.tsx` |
| R5-02 | minor | tags at line ends, mid-sentence | beside the reference | coordinator | 24 tags moved; `proxy.ts` sentence rewritten (comment only) |
| R5-03 = N1 | minor | ADR amendment and criterion 11 still said `upload.ts` stays and the manifest opens the dashboard | same-day corrections | coordinator | fixed |
| R5-04 | remark | two stale sentences | brackets | coordinator | fixed |
| N2 | minor | BL-001 «Resume» | dated bracket | coordinator | fixed |
| N3 | remark | notes naming Telegram without «not enabled» | caveat | coordinator | added in four documents |
| N4 | remark | the diff edits agent instructions | record + restart | coordinator | recorded here; `validate:agents` OK; sessions opened before this change must restart to load the new text |
| N5 = S1-03 | remark | proxy matcher still exempts `manifest.webmanifest` | harmless | owner / next proxy change | left (proxy edits take the architect + security route) |
| U4-01 | minor | 404 advice to open «the app» | neutral | coordinator | «Такої адреси в кабінеті немає — можливо, посилання застаріло.» |
| U4-02 | remark | garbled catalog note | — | coordinator | fixed |
| S1-01 | minor | field origin sends no security headers; token script-readable (pre-existing) | a control owed and tracked | coordinator → owner | BL-136, then closed by the owner as `wontfix (owner)` («goproceed-field не трогай»): accepted risk; the tenancy note says so |
| S1-02 | remark | tenancy summary missed Auth and signed-upload paths | one clause | coordinator | added |
| S1-04 | remark | redirect probes proven on `next start`, not on Vercel's router | a preview run | owner | NOT RUN — before merge, run the three probes against a preview deployment |
| R2-03 | remark | 03 rule 5 lists three surfaces | four | coordinator | fixed |
| R2-04 | remark | this record, `project-readiness.tsx` comment | stale | coordinator | fixed |
| R1-12 | remark | readiness read failure vanished | — | coordinator | `ReadinessView`: 403/404 hide the block, any other failure shows a one-line Banner (catalogued `dash.readiness.error`) |

Rework count and hypothesis changes: review rounds — `gp-reviewer` R1 (PASS with findings) → R2 → R3 (PASS with findings, R3 fixes stated); `gp-ui-reviewer` U1 HOLD → U2 PASS; one `gp-qa` pass, all nine criteria PASS, remarks Q1-01…Q1-04 fixed as prose. No QA FAIL and no new blocker after review, so zero rework rounds count toward escalation.

## Before merge (owner) — `gp-mobile` M1-02

Merging to `main` IS the production retirement of the PWA: `goproceed-app` builds Production from `main`.

- **AC-01, the field origin serves** — observed 2026-09-23 08:32 UTC: `https://goproceed-field.vercel.app/` → Ukrainian sign-in page, `lang="uk"`, `/manifest.webmanifest` 200 `application/manifest+json`. Deployed commit NOT observed. Re-check just before merge.
- **AC-02, CORS** — observed the same minute: a cross-origin `GET /v1/projects` from the field origin to `goproceed-app` is readable (401 unauthenticated), so the preflight passed. Re-check after the deploy.
- **The address pilot foremen are given** is the field origin — the owner's to announce.
- **Rollback:** Vercel instant rollback of `goproceed-app`, or a revert. No migration and no `/v1` contract change is involved.

## What is not true after this task

- **The dashboard is not «done» against the reference.** Built: the shell and the project page. Not built: the homepage KPI row and project cards (`/dash` is still a list, BL-134), the reference's chart by month and its period picker (no time series exists, BL-133), the evidence page and the new-assignment form inside the project frame (BL-134), the members screen (D4).
- **The readiness chart shows counts, not stages.** Its columns are unlabelled because the contract has only a machine `stageKey` (BL-134).
- **Dark theme not seen.** The dark `action-brand` and `viz-*` pairs are asserted by `contrast.test.ts` but no screenshot was taken.
- **Data states the seeded world does not reach were not seen:** several currencies, readiness with closable/vacuous/closed stages above zero, the readiness error banner, `stageCount = 0`, long Ukrainian project names at 360, a rail long enough to scroll.
- **The database suites were not run as a pass.** `apps/app/tests/*.int.test.ts` and the database suites of `packages/testing` are NOT RUN for this task: they truncate or reset the shared local stack. (One unintended full `packages/testing` run did happen — progress row 4 — and its result is not claimed as evidence.)
- **CI is NOT RUN** (the Actions billing block).
- **The PWA is still in production** until this change is merged and deployed; after that, an icon a foreman installed earlier opens the office dashboard (no manifest, no service worker) — what it looks like on real phones is not measured (BL-135 (6)).
- **The Telegram channel is not a path yet**: built, enabled in no environment (BL-024). The field client that remains is `apps/mobile` at `goproceed-field`.
- **The field screens have no browser pass in this repository's CI**: `apps/app`'s harness no longer reaches them and `apps/mobile`'s is in no job (BL-135 (3)).
- **Old `/a/{id}` links** land on the Ukrainian 404 after sign-in; no redirect to the field client (BL-135 (5)).
- **Three integration suites** (`field-capture`, `evidence-read`, `external-evidence`) now import `tests/helpers/upload-intent-body.ts`; they were not run (they need the database), and the gate's typecheck does not cover `tests/` (`apps/app/tsconfig.json` includes only `src` and `app`). `gp-qa` round 2 compiled them with an ad-hoc `tsc`: the helper import compiles; seven type errors remain, all present at base, none from DEV-035.
- **Local database state changed.** See progress row 4: the shared local database was reset by this session without the owner's consent.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 · five roles, rulings, contrast both themes, byte-exact generation | yes | working tree on `27dea79`, diff sha256 `30b1f218c9a856f7…` | `tokens generate` (no drift); `contrast.test.ts` 4 new pairs × light/dark; `token-fidelity`, `primitive-leak` (scratchpad `gate4.txt`; gp-qa re-run) | PASS |  |
| 2 · one `brand` variant, every dashboard primary, none on the landing | yes | working tree on `27dea79`, diff sha256 `30b1f218c9a856f7…` | code read by gp-qa; `component-contract.test.ts` with positive controls | PASS |  |
| 3 · `Stat`, `Waffle`, `TabNav`/`TabLink` (+ `Breadcrumb`) exported, in the sink, no values/templates | yes | working tree on `27dea79`, diff sha256 `30b1f218c9a856f7…` | `index.ts`, kitchen sink 24–26, `component-contract`, landing build | PASS | kitchen sink not viewed in a browser |
| 4 · shell groups, links, `aria-current`, placeholders gone, sheet, rail and drawer | yes | working tree on `27dea79`, diff sha256 `30b1f218c9a856f7…` | `sidebar.test.tsx` (6); harness rail/drawer/profile audits (`qa-run7.log`, `dash-rail-icons.png`, `dash-drawer.png`) | PASS |  |
| 5 · project page frame, KPI row, readiness with vacuous named, grid with text | yes | working tree on `27dea79`, diff sha256 `30b1f218c9a856f7…` | `project-page.test.tsx` (3), `stage-readiness.test.ts` (6); harness frame assertions; screenshots 1440/360 | PASS | one data shape seen: one currency, two blocked stages |
| 6 · register frame, brand action; new-assignment h1 unchanged | yes | working tree on `27dea79`, diff sha256 `30b1f218c9a856f7…` | harness register/empty-register/creation audits; screenshots register 1240/390 | PASS |  |
| 7 · DESIGN.md, 02 §3.3, 03 rule 5 carry the owner's decisions | yes | working tree on `27dea79`, diff sha256 `30b1f218c9a856f7…` | docs read by gp-qa; `validate:canonical-docs` OK | PASS |  |
| 8 · the gate | yes | working tree on `27dea79`, diff sha256 `30b1f218c9a856f7…` | `gate4.txt`: motion-audit clean; 13 non-DB contract suites 206/206; `apps/app` src 539 + 1 skipped; typecheck 10/10; landing + app builds; docs OK; harness `qa-run7.log` 9/9, zero findings | PASS | assisted: `.env.local` copy repaired (empty `NEXT_PUBLIC_APP_ORIGIN`, `SUPABASE_SECRET_KEY` commented out) and a quiet window on the shared database agreed with the Evidence session |
| AC-01 · the field origin serves, after merge | yes | production, `3141a33` | `https://goproceed-field.vercel.app/` → Ukrainian sign-in, `lang="uk"`, manifest 200 (09:58 UTC) | PASS | deployed commit of `goproceed-field` not observed |
| AC-02 · CORS field → app, after merge | yes | production, `3141a33` | cross-origin `GET /v1/projects` with `content-type: application/json` readable, 401 (09:58 UTC) | PASS | — |
| S1-04 · `/dash` redirect probes on Vercel | yes | production, `3141a33` | `/dash//evil.example`, `%2F%2F`, `%5C%5C` stay on `goproceed-app`; path and query kept | PASS | followed as a browser fetch, not inspected as raw `Location` headers |
| 8a · database suites (`apps/app/tests/*.int.test.ts`, `packages/testing` resetDb suites) | yes | working tree on `27dea79`, diff sha256 `30b1f218c9a856f7…` | — | NOT RUN | environmental: they truncate or reset the shared local stack; accepted by the owner 2026-09-23 («да, сделай PR»); settles with `pnpm turbo run test --concurrency=1` on a disposable stack |
| 8b · CI | yes | working tree on `27dea79`, diff sha256 `30b1f218c9a856f7…` | — | NOT RUN | not-provable-locally: GitHub Actions billing block; accepted by the owner 2026-09-23 |
| 9 · screenshots, six widths + reduced motion | yes | working tree on `27dea79`, diff sha256 `30b1f218c9a856f7…` | `apps/app/qa-output/screenshots/daylight/dash-*` at 1920/1440/1240/768/390/360 + 1440/390 reduced | PASS | assisted: as 8; daylight theme only — dark NOT RUN |
| 10 · dashboard at `/`, new paths everywhere, `/dash/**` 307, proxy gates every route | yes | working tree on `27dea79`, diff sha256 `d72c5dc2…` (before the Q2 remarks) | app build route table; `routes-manifest.json` rules exercised in Node by gp-qa; harness redirect probes (path + query, three crafted paths); `proxy-cors.test.ts` | PASS | redirects proven against `next start`; Vercel's router NOT RUN (S1-04) |
| 11 · `app/(app)`, `src/lib/{field,capture}`, the manifest and `destructive` gone; the body builder is a test helper | yes | working tree on `27dea79`, diff sha256 `d72c5dc2…` (before the Q2 remarks) | gp-qa import/orphan scan; `component-contract` asserts no `destructive`; token-level comparison of the helper against base | PASS | the three integration suites were compiled ad hoc, not run |
| 12 · harness: field audits dropped, sign-in via `?next=/projects/{id}`, redirect probe | yes | working tree on `27dea79`, diff sha256 `d72c5dc2…` (before the Q2 remarks) | `qa-run10.log` 6/6 audits, zero findings (11:53) | PASS | assisted: repaired `.env.local`, quiet window on the shared database |
| 13 · ADR-009 amendment, ADR-007 pointer, README, START_HERE, AGENTS, STATUS, BL-001 carry the retirement and its true cost | yes | working tree on `27dea79`, diff sha256 `d72c5dc2…` (before the Q2 remarks) | doc reads by gp-qa, gp-mobile, gp-reviewer; `validate:canonical-docs` OK | PASS | the `goproceed-field` observation is the coordinator's (08:32 UTC) |

## Sources

- Uxerflow, «Autumn - CRM Dashboard» series on Dribbble: https://dribbble.com/shots/27537255, /27543770, /27554333, /27557794, /27564607 — frames read in the in-app browser from `cdn.dribbble.com/userupload/…`, accessed 2026-09-23. Structure only; no asset, code or CSS is taken.

## Completion / handoff

- Changed / inspected files: the 53 files of the final diff — tokens (`tokens.json` + seven generated), `packages/ui` (Button, Panel, Meter, index, Stat, Waffle, TabNav, Breadcrumb), `packages/testing` (contrast, component-contract), the landing kitchen sink, `apps/app` dash routes, shell, project frame, readiness block and service, register, evidence/new-assignment/sign-out buttons, harness, `technical/copy-catalog.csv`, DESIGN.md, docs/design 01/02/03, BACKLOG (BL-053, BL-117, BL-119 scheduled; BL-133, BL-134 added), this record and the task index.
- Review independence: independent subagents — `gp-reviewer` (three rounds), `gp-ui-reviewer` (two rounds), `gp-qa` (one pass). No architect, security or mobile trigger.
- Verified scope: the nine acceptance criteria above; the harness 9/9 with zero findings on the final revision.
- Remaining risks / blocked requirements: database suites and CI NOT RUN; dark theme not seen; data states beyond the seeded world not seen; the local database was reset once by this session without consent (progress row 4); the BL collision with the Evidence branch is resolved: its PR #109 merged first and this task's entries are BL-133…BL-136.
- Next bounded action and owner: the owner — commit, push and PR (not done: this session commits only when asked), and a decision on the NOT RUN items. Then BL-053, BL-117 and BL-119 close → DEV-035 in the same change that lands it.
- Final state and reason: done — merged by the owner (PR #110, `3141a33`); every review stage PASS, `gp-qa` 13/13, post-merge production checks PASS; the database suites and CI are NOT RUN, accepted by the owner. BL-053, BL-117, BL-119 closed; BL-133…135 open, BL-136 `wontfix (owner)`.
