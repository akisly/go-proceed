# Creating a доручення from the dashboard — design (Plan D slice A)

**Status:** Draft, awaiting owner review

**Date:** 2026-08-28

**Owner decision implemented:** the D3 brainstorm of 2026-08-28. D3 as written
(«assignments list + create, over the full contract chain») was measured and
split into a decision slice plus three build slices; the register half was
found already shipped. This spec is the first build slice.

**Decisions taken during brainstorming (owner-confirmed 2026-08-28):**

1. **The chain gets screens as an operability surface**, serving the owner or a
   workspace admin standing up a pilot — not ПТВ, and not on the strength of
   any demand-scan sentence. Recorded in
   [ADR-009](../../decisions/ADR-009-three-pilot-surfaces.md)'s amendment of
   2026-08-28 and in `docs/design/04-role-pain-map.md`'s new operability
   section.
2. **Decisions before code.** The three documents of slice D3-0 are committed
   ahead of this spec.
3. **This slice adds no API operation.** Every read it needs already exists.
4. **`Form*` over `Field`** — the choice `packages/ui/src/components/index.ts`
   says «the first screen that has to choose between them» must make.
5. **No jsdom.** Form logic is extracted into pure functions and tested
   directly; interaction is proved in the browser harness.

---

## 1. What this slice delivers

One route — `/dash/projects/{projectId}/assignments/new` — that creates a work
assignment on an already-published contract baseline, and the write foundation
underneath it that slices B and C will reuse.

It closes the literal words of ADR-009 decision 3's «create assignment» for the
case where a baseline exists. It does **not** create the baseline; that is
slice C.

## 2. Why it needs no new API

Measured 2026-08-28. Every source the form needs is reachable through reads
that already ship:

| What the form needs | Where it comes from | Note |
|---|---|---|
| the project's contracts and their published versions | `GET /v1/projects/{projectId}/blocked-value` → `byBaseline[]` | each row carries `contractId`, `contractVersionId` **and** `contractVersionNo` (`packages/contracts/src/blocked-value.ts:144-149`) |
| the baseline's lines | `GET /v1/contracts/{contractId}/versions/{versionNo}` → `workItems[]` | keyed by NUMBER, which the row above supplies |
| the workspace's members | `GET /v1/workspaces/{workspaceId}/members` | `{memberId, userId, role, status}` — no name, no email; see §5 |
| the write | `POST /v1/contracts/{contractId}/assignments` | `Idempotency-Key` required; project capability `assignments.manage` |

`blocked_value.get` is already read by the money screen
(`src/services/blocked-value.service.ts`), so the first hop costs no new
service.

**Consequence, stated rather than discovered later:** a project with **no
published baseline** has no `byBaseline` row, so this screen has nothing to
offer. That is not a defect of the screen — it is the state slice C exists to
end — and it renders as a named empty state (§6), never as an error.

## 3. The request, and what the form must collect

`createAssignmentRequest` (`packages/contracts/src/assignments.ts:6-12`):

| Field | Contract | On the form |
|---|---|---|
| `workItemId` | **required**, guid | `Select` over the chosen baseline's `workItems[]` |
| `assigneeMemberId` | optional, guid | **present, and effectively required — see §5** |
| `plannedQuantity` | optional, decimal string | `Input`, validated by the contract's own `decimal` |
| `dueDate` | optional, `YYYY-MM-DD` | `Input type="date"` |
| `locationId` | optional, guid | **omitted** — the `locations` table is deployed, but ADR-006 decision 4.2 moved the WORK on it to v0.2 (`docs/decisions/ADR-006-pilot-shaped-v0.1.md:375`) and no operation creates or lists one, so the field has no source and an assignment simply carries none |
| `performerPartyId` | optional, guid | **omitted** — no party read exists; slice B adds one, and this field arrives with it |
| the retired template pin | accepted, deprecated | never sent |

When the project has more than one published baseline, a `Select` above the
line picker chooses the contract version; with exactly one it is rendered as
static text rather than a control with a single option.

## 4. The write foundation

Five pieces, each usable by slices B and C unchanged.

**`apiPost` in `apps/app/src/lib/api.ts`** — a port of
`apps/mobile/src/lib/api.ts:94`, which already carries the bearer token, the
`content-type`, the `Idempotency-Key` and an `AbortSignal` passthrough, and is
covered by four tests in that workspace. Ported rather than invented, and the
header says so.

**The idempotency key lives in a `useRef`, minted once per form instance.** A
retry after a network failure MUST reuse it — that is the whole point of the
header, and both existing client call sites mint per call, which turns a
timeout into a second доручення. `crypto.randomUUID` needs a secure context;
the mint site falls back rather than throwing.

**A submit state machine, as a pure function.** `idle → submitting → (created |
failed)`, where `submitting` refuses re-entry. Extracted so a double press is
testable without a DOM, and asserted again in the harness against a real
browser.

**`fieldErrors` rendered against the field they name.** The server produces
per-field paths on every zod failure (`items.1.qty` shape, pinned by
`command.test.ts`) and nothing in this product has ever read them — a 422
currently renders as one banner. A pure mapper turns the problem document into
`{field → message}` and `FormMessage` displays it; anything unmapped falls back
to the banner, so no error can vanish.

**`router.refresh()` after the write**, before navigating back to the register.
No write path in the app does this today, so the register would otherwise show
a stale list from the Router Cache.

## 5. The assignee problem, named rather than hidden

`assigneeMemberId` is optional in the contract and **effectively mandatory in
the product**: `GET /v1/projects/{projectId}/assignments` supports exactly one
filter, `?assignee=me`, matched against `assignee_member_id`
(`apps/app/app/v1/projects/[projectId]/assignments/route.ts:32-55`), and both
field clients list a foreman's work through it. **An assignment created with no
assignee is invisible to every foreman, forever.** The form therefore always
sends one.

`members.list` returns `{memberId, userId, role, status}` and no display name
or email, so the picker cannot show a person. It shows the membership role and
the first eight characters of the id, with the signed-in user marked «(ви)» and
selected by default. That is honest and it is ugly; the ugliness belongs to
slice D4, which the role-pain map already names as blocked on exactly this
question. This spec does not solve it and does not pretend to.

## 6. States

| State | Render |
|---|---|
| no published baseline in this project | `EmptyState`: the project has no published contract baseline yet, so there is nothing to assign against |
| baseline exists, zero lines | `EmptyState`, distinct copy |
| session expired | `redirect("/login?next=…")`, the pattern both sibling pages use |
| any read fails | `ShellFatalError` |
| submit refused 422 | field errors in place; unmapped ones in a `Banner` |
| submit refused 403 | `Banner` naming the missing capability — `assignments.manage` is not implied by `project.admin` |
| submit refused 409 `IDEMPOTENCY_CONFLICT` | `Banner`; the key is reused, so this means a genuinely different body under the same key |
| created | `router.refresh()`, then navigate to the register where the new row is visible — that visibility IS the confirmation. No toast: `packages/ui` refuses one on principle |

## 7. Copy

Every user-facing string is Ukrainian and gets a `technical/copy-catalog.csv`
row.

**There is already a write path's copy in the catalog, and it is the template.**
`issue-review-link` registered six rows — `dash.evidence.link_pending`
(«Створюємо посилання…», the in-flight button label),
`dash.evidence.link_issued_heading`, and four refusal rows including a generic
one and a named `link_failed_no_token` for one specific partial failure. That
shape — one pending label, one success heading, and **one row per
distinguishable refusal** rather than a single «щось пішло не так» — is what
this slice's rows copy.

(An earlier draft of this spec claimed the catalog held no creation copy at
all. It holds those six; the claim was checked and corrected before this spec
was reviewed.)

## 8. Testing

**Pure functions, tested directly** (no DOM): the problem→fieldErrors mapper,
the submit state machine, the request builder (form values → validated
`createAssignmentRequest`), and the key-mint fallback.

**Contract-level:** the request builder's output parses against the real
`createAssignmentRequest`, so the form cannot drift from the wire.

**Integration:** a test that creates an assignment through the route with the
same body the form builds, and asserts occurrences materialise — the existing
`materialisation-end-to-end` fixtures already walk this ground and are reused,
not re-typed.

**Browser harness (`apps/app/qa/field.mjs`):** a new audit that opens the
screen in the seeded world, submits, and asserts the new row appears in the
register; plus the double-submit assertion — two rapid presses produce exactly
one assignment, checked in the database.

**Gate:** the five commands of `docs/design/02-building-ui.md` §5, and the §6
visual pass at all six widths with real Ukrainian strings.

## 9. Out of scope (recorded so it is not re-derived)

- **Editing or cancelling an assignment.** No command changes an assignment's
  status after creation — none exists in either scope CSV.
- **`locationId` and `performerPartyId`** — §3 gives the reason for each.
- **A Combobox.** The line `Select` is a plain select; a pilot baseline typed by
  hand is small. When slice C makes baselines large, the Combobox becomes a
  real need and `packages/ui`'s inventory already names it as absent-until-then.
- **jsdom.** Revisit if a later form slice cannot be proved without it.
- **Assignee identity.** D4.

## 10. What this slice must not break

The register, the money screen and the evidence screen are shipped and read the
same routes. Nothing here changes a route, a contract or a capability, so the
blast radius is the new page plus `api.ts`'s new export.
