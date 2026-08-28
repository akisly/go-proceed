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
4. **shadcn's `Field` family, taken one-to-one from the registry** — owner
   instruction of 2026-08-28 citing
   <https://ui.shadcn.com/docs/components/radix/field>, and the standing rule
   that components come from shadcn and are never hand-rolled. This overrides
   the `Form*` recommendation an earlier draft of this spec carried, and it
   retires the hand-written `Field` in `packages/ui` — that file IS the
   hand-rolled substitute the rule forbids. See §4's «The Field family».
5. **jsdom and `@testing-library` in `apps/app`** — owner instruction, same
   date, overriding this spec's earlier «no jsdom». See §8.

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
the shape `FieldError` already accepts, and anything unmapped falls back to the
banner, so no error can vanish.

**`router.refresh()` after the write**, before navigating back to the register.
No write path in the app does this today, so the register would otherwise show
a stale list from the Router Cache.

### The Field family — the one component this slice adds to `packages/ui`

Ten components, taken **one-to-one from the shadcn registry**: `Field`,
`FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldLegend`,
`FieldSeparator`, `FieldSet`, `FieldContent`, `FieldTitle`. Read from the
registry on 2026-08-28, not from memory.

**It needs no new dependency.** Its imports are `cva` (Button already uses it),
`cn` (this package's `cx`), `Label` and `Separator` — both already exported
here.

**Why it fits this form better than the `Form*` set.** It is *presentational*:
the shadcn docs say in terms that these components do not depend on
react-hook-form context. So the markup does not bind to a form library, and
`FieldError`'s `errors?: Array<{ message?: string } | undefined>` takes zod v4
issues directly — the same shape the server's `fieldErrors` mapper produces.
One error channel, two sources, no adapter. `Field` also ships `role="group"`
and `FieldError` ships `role="alert"`, so the accessibility this form needs
arrives with the component instead of being re-derived.

**What holds the form state, since `Field` deliberately does not.** Read from
the vendor's current React Hook Form guide on 2026-08-28, not inferred:
react-hook-form stays and the `Form*` component set goes. The guide's own
words — «This form leverages React Hook Form for performant, flexible form
handling. We'll build our form using the `<Field />` component, which gives you
complete flexibility over the markup and styling» — and it states that the
Field family is the current approach rather than the older
`FormField`/`FormItem`/`FormControl` pattern.

**The binding shape, verbatim from that guide**, so the implementer copies it
rather than inventing one:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "…/field";

<Controller
  name="title"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={field.name}>Bug Title</FieldLabel>
      <Input {...field} aria-invalid={fieldState.invalid} />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

Three details that are the guide's and not decoration: `Controller`, not
`FormField`; `data-invalid` on `Field` **and** `aria-invalid` on the control,
which is where `Field`'s `data-[invalid=true]` styling and the screen reader
each get their signal; and `FieldError` fed an array, which is also how the
server's mapped `fieldErrors` enter — one component, two sources.

`zodResolver` runs the same `createAssignmentRequest` the wire uses, so the
rules are stated once. Both packages are already installed
(`react-hook-form 7.86`, `@hookform/resolvers 5.9`) and neither has ever had a
call site; this is the first. What the owner's instruction rejected is the `Form*` component
set; the library underneath it is what shadcn's own Field documentation pairs
with, and this spec follows that pairing.

**Structure and behaviour are copied; the STYLING is mapped to token roles**,
per `docs/design/02-building-ui.md` §7.2 and matching the header D0's own
shadcn ports carry («Structure follows shadcn/ui's <name> (MIT); styling is
this system's token roles»). This is not a licence to redesign it — it is
mandatory, because this system clears the stock namespaces. **Measured in the
built chunks on 2026-08-28:** `text-sm`, `text-muted-foreground` and
`rounded-md` produce **zero** rules, while `text-meta`, `text-ink-muted` and
`rounded-control` are present. Pasting the registry's classes verbatim would
ship a form with no styling and no error — §8's own trap, and the reason this
paragraph exists.

The substitutions, decided here so the implementer does not re-derive them:
`text-sm`/`text-base` → `text-meta`/`text-data`; `text-muted-foreground` →
`text-ink-muted`; `text-destructive` → `text-status-blocked-fg` (the role the
retired `Field` already used for exactly this); `bg-background` →
`bg-surface`; `rounded-md` → `rounded-control`; `border-primary` /
`bg-primary/5` on the checked-card variant → `border-line` plus the selected
state this system already uses, and **never** `bg-action-signal`, which §4.3
rule 10 rations to one element per screen.

**One trap, named because it fails silently.** `Field`'s
`orientation="responsive"` is built on `@container/field-group` and `@md/…`
container queries. `packages/ui/src/theme.generated.css:21` sets
`--container-*: initial` and defines only `measure`, `content` and `nav`, so
the `@md/` variant has no size to resolve and emits nothing. Slice A therefore
uses `vertical` and `horizontal` only. Shipping `responsive` requires a
container ROLE in `tokens.json` first (§3.3 question 2: a missing size is a
missing role), and that is not this slice's business.

**The retirement, and its one caller.** The hand-written
`packages/ui/src/components/Field.tsx` is superseded. Its only real consumer is
`apps/app/src/components/evidence/issue-review-link.tsx` — the write precedent
— and it moves to the new family in this slice, because leaving one screen on a
retired component is how a second component tree starts. The inventory note in
`index.ts` records the retirement, and «duplication 1» that note describes is
resolved by deletion rather than by a coin toss.

**§7.2's three obligations are not optional:** the components land in
`packages/ui/src/components/`, are exported from `index.ts`, and are rendered
in `/kitchen-sink/components` — all three, or `component-contract.test.ts`
fails on the orphan. That gate is also the reason this slice fixes the
four already-orphaned components' absence there only if the test demands it,
and does not otherwise expand.

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

**jsdom and `@testing-library` arrive in `apps/app` with this slice** (owner
instruction, 2026-08-28). Today the app has neither: its four `.tsx` tests use
`renderToStaticMarkup` from `react-dom/server` and can therefore assert a first
render and nothing else — no typing, no submitting, no error display, no
double press.

**It is switched on per file, never globally.** A `// @vitest-environment jsdom`
docblock on the component tests; `apps/app/vitest.config.ts` keeps its node
default so that every `tests/*.int.test.ts` suite continues to run against the
real Postgres in the environment it was written for. A global `environment:
"jsdom"` would put 82 files including the whole integration suite into a
simulated DOM, and this config's serialization (`fileParallelism: false`) is
load-bearing against a shared database — HANDOFF.md §4 records how that fails.

**The gate on the addition:** the full serialized run
(`pnpm turbo run test --concurrency=1`) is green afterwards, with the app's own
count unchanged except for the new files. A test-runner change that quietly
moves an existing suite into another environment is exactly the kind of change
that looks green and is not, so the count is compared, not assumed.

**Pure functions, tested directly** (these stay pure and stay tested without a
DOM, because logic that can be tested without a browser should be): the
problem→`FieldError` mapper, the submit state machine, the request builder
(form values → validated `createAssignmentRequest`), and the key-mint fallback.

**Component tests, now possible:** the form renders its fields; a submit with an
empty required line shows the error against that field and does not call the
API; a 422 from the server lands on the named field; the submit control is
disabled while in flight and a second press does not fire a second request.

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
- **`orientation="responsive"` on `Field`** — its container query has no size to
  resolve until a container role exists (§4). `vertical` and `horizontal` only.
- **Finding callers for the remaining orphans.** `Select` stops being one in
  this slice — it is the line picker (§3). `Form*` and `Checkbox` do not, and
  `Form*` in particular is now a set with no caller and no planned one; whether
  it stays is a decision for whoever needs a form library, not for this slice.
- **Assignee identity.** D4.

## 10. What this slice must not break

Nothing here changes a route, a contract, a capability or a migration. The
blast radius is nonetheless wider than the new page, and it is exactly three
things:

1. **`packages/ui` gains ten components and loses one.** The retired `Field`
   has one consumer, `issue-review-link.tsx`, which migrates in this slice.
   That component is the write precedent and is covered by
   `issue-review-link.test.tsx` — those tests must still pass, and if the
   migration changes rendered markup they are the place it shows.
2. **The test runner gains an environment.** Per-file, never global (§8), and
   the full serialized run is compared by count before and after.
3. **The register gains a link.** «Нове доручення» on
   `/dash/projects/{projectId}/assignments`, which the qa harness's register
   audit already visits — so the audit sees the new control and its 44px floor
   applies to it, on a screen whose touch targets that harness has already
   caught once.

The money screen and the evidence screen are untouched.
