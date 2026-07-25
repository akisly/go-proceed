# 29. Prototype Coverage and Interaction Contract

## 1. Purpose

Интерактивный прототип доказывает information architecture, decision surfaces, copy and recovery comprehension. Он не симулирует backend security/legal effect.

## 2. Required interactive flow families

| Flow | Route/surface | Required interaction |
|---|---|---|
| acquisition | `/`, `/pilot` | qualification steps and success |
| auth | `/login`, `/invite/demo` | sign-in and invite/MFA consequence |
| onboarding/import/rules handoff | `/onboarding`, `/app/rules?setup=1` | mapping validation → rule setup handoff → return to team step |
| rule versioning | `/app/rules` | edit → impact preview → stale-preview block → acknowledge → immutable publish/job receipt |
| executive/work detail | `/app`, `/app/work` | filter/select/detail blocker → evidence-request receipt/exact context; single-item create → audit receipt/register consequence |
| review/correction | `/app/evidence` | select → return → linked correction revision → server receipt → re-review/approve; direct approve also supported |
| variation | `/app/variations` | compose → preview → issue acknowledgement state |
| close/package | `/app/close`, `/app/packages`, `/app/packages/current` | resolve/override blocker → immutable snapshot → generate → download receipt → submit receipt; filters expose zero-results recovery |
| external review | `/review/demo` | identity/OTP simulation → return/accept → receipt |
| project commercials | `/app/payments` | partial payment/allocation state |
| SaaS subscription | `/app/billing` | plan preview/change state |
| team/access | `/app/team` | scope/role preview and invite state |
| field offline | `/field` | capture → local receipt → server receipt |
| contract terms/reference revision | `/app/baseline` | impact preview → immutable terms publish → controlled reference revision receipt |
| assignment/occurrence | `/app/assignments` | persisted preview → row-level committed/rejected receipt → exact due/location/quantity/versions → deterministic occurrence receipt |
| typed evidence/hold point | `/app/occurrences/demo` | typed measurement validation → review task → hold decision → concealment receipt |
| package line decision | `/app/packages/current` | exact source set → saved pending item versions/no effect → resumable finalize → line return/modified amount → server-derived total reconciliation → immutable receipt |

Release interpretation: acquisition/auth/onboarding/rules/work/review, Pilot portions of close/package, team/access and field offline are Pilot interaction evidence. Variation, secure external review, project commercials and plan-change interactions are deliberately GA-forward prototypes and do not grant Pilot entitlement. The prototype does not need a separate platform-operator console: Pilot payment-request issue/manual settlement, notification read receipts and organization closure are fully specified by screen/action/API/state/test contracts and remain text-only implementation flows; notification preferences themselves are interactive in `/app/settings` (§6).

## 3. Text-only state specification

Separate mockup is not required when the same layout supports:

- loading skeleton;
- basic empty state;
- retryable fetch error;
- filter zero results;
- archived/read-only banner;
- ordinary validation errors;
- generic plan/permission block;
- job retry-wait;
- share expired/revoked/locked;
- organization grace/suspended banner;
- notification preferences/delivery history;
- Pilot SaaS payment-request issue/manual settlement and due/grace/suspension recovery;
- integration secret rotation/replay;
- export/deletion progress;
- platform incident workflow.
- contract-policy/reference publish race and stale-assignment acknowledgement;
- repeated date/batch/quantity occurrence dedupe and controlled evidence reuse;
- partial package-decision total mismatch and line-correction lifecycle.
- paginated staged offboarding plan with explicit unresolved/stale dependency recovery;
- claimed versus authoritative reporting date and post-invalidation security quarantine;
- package decision issue owner/due/resolution while financial outcome remains immutable;
- audit search and safe export cancel/cancel-requested states.

These states remain implementation requirements through documents 18–27 and traceability CSV.

## 4. Prototype data rules

- synthetic company/projects/people/amounts only;
- label demo data in public/auth surfaces;
- no fake customer logos, testimonials or measured savings;
- dates and states internally consistent;
- project commercials and SaaS billing navigation separated;
- `ready_internal`, `operational acknowledgement` and `KEP` wording never conflated.

## 5. Interaction acceptance

Every prototyped family has:

- visible actor/context;
- primary decision;
- downstream value/state consequence;
- at least one blocker/error/confirmation;
- durable receipt/timeline for irreversible-looking action;
- responsive behavior at desktop and relevant mobile width;
- keyboard/focus/labels for web controls;
- no inert primary CTA.

The automated smoke must additionally prove that changing a rule after preview raises the visible `RULE_IMPACT_STALE` recovery state and disables publish; a published version is no longer editable; a returned capture creates a new ID while retaining the original and both review receipts; public marketing consent remains opt-in; requested evidence does not prematurely clear a close blocker; exact-version package/external decisions produce separate receipts; contract/reference publish retains old assignments; one mixed assignment batch shows committed and rejected rows with deterministic occurrence count; concealment is unavailable before an eligible hold decision; a saved item-version receipt stays pending with no package effect and the subsequent reconciled exact-package finalize returns one receipt. It additionally executes: the direct-approve review path; the SaaS plan-change confirmation receipt; the rules setup hand-off publish that returns to onboarding step 5 and completes to the workspace; a negative check that the concealment control is unreachable before an eligible hold decision; a read-model sweep proving every core register renders its data; and the post-invalidation quarantine copy in the field sync queue. The v2.9 markers in `qa-results.json` (`businessLogicDelta`) are derived from these executed assertions — a marker is recorded only when its assertion ran and passed in that run. Marker checks prove prototype/spec alignment, not runtime enforcement.

## 6. Visual system

`Direction 02 — Evidence Atlas` is the only selected visual reference. The source board, generated synthetic assets and usage/crop rules are preserved in `design-references/evidence-atlas/`. Earlier concept boards remain historical inputs only.

The implementation uses Carbon `#171717`, Lime `#c6ff34`, Slate `#484c5e` and Paper `#fbfbfb`, Manrope/Inter, a paper-dominant dossier grammar, a Carbon route index, exact file labels, real synthetic evidence media, low-radius ledger surfaces and restrained folio/stamp motion. Lime is limited to the next action or verified state. Landing explicitly presents the iOS/Android field client as Pilot core and links to `/field` without claiming store availability.

Prototype-only trust/support routes are also interactive:

- `/reset-password`: bounded recovery request and receipt;
- `/legal/privacy`, `/legal/terms`: honest demo privacy/terms boundary;
- `/app/settings`: workspace defaults and notification preferences with mandatory-event lock.

The shell groups navigation by the business chain, calculates selected state for nested routes, exposes actionable notifications and shows the exact dossier/process hand-off on every authenticated workspace route. The field bottom navigation and external package section navigation change visible states rather than acting as static decoration.

Do not redesign Evidence Atlas into a generic card grid or reintroduce the rejected dark-first landing direction.

## 7. Prototype disclaimer

Prototype footer/README states: local React state, synthetic data, no actual authentication/payment/upload/legal decision. Production rules live in normative docs/data/API contracts.
