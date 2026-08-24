# Project-sourced requirements from робоча документація — design

**Status:** Draft, awaiting owner review

**Date:** 2026-08-24

**Owner decision implemented:** HANDOFF-2026-08-24.md §5.1 — «add a verification
category for project-supplied sources and let a workspace author requirements
from its own working documentation».

**Decisions taken during brainstorming (owner-confirmed 2026-08-24):**

1. A source is a **typed citation without a file**: document code/name, sheet
   (аркуш) and drawing number (№ креслення) are mandatory; revision is
   optional. No upload in this slice.
2. Items are **workspace-scoped with a structural project mark**
   (`project_id NOT NULL`); cross-project binding is not forbidden — the
   citation travels with the text wherever it renders.
3. **Approach A — a separate table.** The seeded `requirement_library_items`
   and every one of its constraints stay untouched.
4. The fourth vocabulary value is **`PROJECT_DOCUMENTATION`**.
5. Authoring is governed by a new workspace capability with **the same role
   set as `requirement_rules.manage`** (owner/admin —
   `packages/domain/src/authz.ts`, `WORKSPACE_CAPABILITIES`).
6. The new operations are catalogued in **`technical/openapi/scope-v0.1.csv`**,
   by the ADR-009 amendment precedent: the owner's word recorded in an ADR,
   rows in the same file as every other operation, a capability row, and the
   operations-per-milestone count in `docs/delivery/version-0.1.md`.

---

## 1. Why this is legitimate product content

ДБН А.3.1-5:2016 п. 8.4.3.3 says the binding hidden-works list for a site
comes from робоча документація, and Додаток Н is довідковий — allow-list
item 8 of `docs/product/hidden-works-content-rules.md`. The seeded twelve
items are a starter by design. Today, on any work outside Н.14/Н.15 the
product can express **no requirements at all**, which binds every pilot.

A requirement typed from a site's робоча документація is none of the three
existing vocabulary values: not `VERIFIED_PRIMARY` or `VERIFIED_SECONDARY`
(the product never saw the document), and not `UNVERIFIED` (which «must never
be shown as normative» — while this text is precisely what *is* normative for
the site, by п. 8.4.3.3). Hence the fourth value.

## 2. Change-control sequence (docs/README.md §"Change control")

Order is binding: ADR first, Approved documents before implementation
planning, machine-facing contracts before or with implementation, migrations
append-only.

### 2.1 ADR-010 «Project-sourced requirements from робоча документація»

Records: the owner's decision and date; the four brainstorm decisions above;
the vocabulary addition; the three new operations (§5) with the same
narrow-exception framing ADR-009 used (catalogued, capability-governed,
counted — nothing added quietly beside the API).

### 2.2 Edit `docs/product/hidden-works-content-rules.md` (Approved)

Three changes, one PR, each traceable to ADR-010:

**(a) Verification vocabulary** gains a fourth value:

> **PROJECT_DOCUMENTATION** — the text was typed by a workspace from its own
> робоча документація for a named project. The product has not verified it.
> Its normative force for that site follows from п. 8.4.3.3, not from this
> product; it must always render with its full structured citation (document,
> sheet, drawing number) and must never appear inside a Додаток Н block or
> carry a ДБН attribution.

**(b) A new section «Project-sourced strings»** stating what may be asserted:
the text as the workspace's own statement of its documentation, with the
citation; never as content of any ДБН/ДСТУ; the render rules (separate block,
provenance label, citation always visible); and the disclaimer under any list
that mixes seeded and project-sourced items — the existing Додаток Н
disclaimer already says the binding list comes from робоча документація, and
gains one sentence naming the project-sourced block as the workspace's own
transcription of it.

**(c) Close the stale Open item.** The first Open item says the ДБН file's
retrieval URL, date and hash «were never recorded». They are recorded — in
every `source` cell of
`technical/requirements/dbn-a31-5-2016-dodatok-n.csv`:
`https://e-construction.gov.ua/laws_detail/3879707932224390963`, завантажено
2026-08-10,
`sha256=4592edafaa8097d3b9305b7934d080256d649616a2741b6a5537a28606a665e3` —
matching the document's own header «CLOSED 2026-08-10», which describes the
reproduced fetch in full. The Open item is rewritten as closed with that
pointer. This closes one of M0's twelve exit gates (ADR-006 decision 7's
«no normative string renderable without its verification tag and its
source»). Prohibitions and tags change nowhere.

Note on prohibition **E**: it bans «шифр»/«аркуш» as fields **of the Додаток В
act form**. The source record of a project-sourced requirement is not an act
form field; the new section says so explicitly so a reviewer does not read
the schema as violating E.

### 2.3 Catalogs and contracts

- `technical/database/entity-catalog.csv` — new entity row.
- `technical/database/relationship-catalog.csv` — new rows: item→workspace,
  item→project, rule_version→item (provenance).
- `technical/permissions/capabilities.csv` — new row (§5).
- `technical/openapi/scope-v0.1.csv` — three new rows (§5).
- `technical/database/invariant-catalog.csv` — INV-073's text already demands
  tag+source; its enforcement column gains the new table. No new invariant id
  unless review finds one is needed.
- `@goproceed/contracts` — zod schemas: create/archive/list, and the publish
  request change (§6). One schema on the wire and in the form.

## 3. Vocabulary semantics (summary)

| Value | Who vouches | May render as |
|---|---|---|
| VERIFIED_PRIMARY / _SECONDARY | the product's sourcing programme | normative, with standard attribution |
| PROJECT_DOCUMENTATION | the workspace, for one named project | normative **for that site** (п. 8.4.3.3), always with the structured citation, never with ДБН attribution, never inside a Додаток Н block |
| UNVERIFIED | nobody | never as normative (unchanged) |

## 4. Schema — one new migration (append-only, next free number)

### 4.1 `project_sourced_requirement_items`

- `id uuid pk default gen_random_uuid()`
- `workspace_id uuid not null references public.organizations(id)`
- `project_id uuid not null` + `foreign key (workspace_id, project_id)
  references public.projects (workspace_id, id)` — tenant-safe composite FK,
  the structural project mark of decision 2.
- `item_text_uk text not null` with `btrim` length check
- `source_document text not null` (шифр або назва робочої документації),
  `source_sheet text not null` (аркуш), `source_drawing_no text not null`
  (№ креслення) — each with `btrim` length checks. NOT NULL alone admits
  `''` and `'   '` (the 0023 lesson, restated at
  `requirement_library_items.source_citation` in 0041).
- `source_revision text` nullable, `btrim` check when present.
- `verification text not null check (verification = 'PROJECT_DOCUMENTATION')`
  — one storable value, the `normative_character` pattern: the row cannot
  claim a tag the product did not issue.
- `status text not null default 'active' check (status in ('active','archived'))`,
  `archived_at timestamptz`, `archived_by_member_id` (+ composite FK to
  memberships), `check (status = 'active' or archived_at is not null)`.
- `created_at`, `created_by_member_id` (+ composite FK).
- `unique (workspace_id, id)`.

**Mutability:** text and source are immutable; a correction is a new item
plus archiving the old one. A guard trigger (sibling of
`requirement_library_items_immutable`, 0041 §6) rejects DELETE and any UPDATE
that touches anything except the `status`/`archived_*` transition
active→archived. Rule versions copy content at publish, so retroactive edits
could not change an obligation anyway — the guard makes the model visible
rather than merely true.

**RLS/grants:** SELECT for workspace members mirroring
`requirement_library_items`; INSERT and the archive UPDATE through the
command path under the new capability. No external-plane access: an external
grant sees the *rule version's copied* citation, never this table.

**Assembled citation:** the publish route composes the copied
`norm_ref_source` string deterministically from the four fields
(«робоча документація {document}, арк. {sheet}, креслення {drawing}
[, ревізія {rev}]; проект {project}»), the way `citationOf` composes the
library citation today. Stored fields stay structured; the composed string
exists only as the frozen copy in the rule version.

### 4.2 `requirement_rule_versions` changes (same migration)

- Widen `norm_ref_verification` CHECK to admit `'PROJECT_DOCUMENTATION'`
  (drop + re-add constraint; append-only migration, and both fidelity tests
  already read `pg_constraint`, not migration text — the §4 handoff lesson).
- New nullable column `project_sourced_requirement_item_id uuid` +
  `foreign key (workspace_id, project_sourced_requirement_item_id)
  references public.project_sourced_requirement_items (workspace_id, id)`.
- `check (requirement_library_item_id is null
  or project_sourced_requirement_item_id is null)` — at most one provenance.
- Verify `app.guard_requirement_rule_version()` (0041) covers the new column
  against post-publication mutation; extend it if it enumerates columns.

### 4.3 What does not change

`requirement_library_items`: no DDL, no new write path. Its CHECKs, its
`requirement_library_items_dodatok_n_extent_check`, its comment «Content is a
repository change …, never a runtime command», and 0041's sentence «there is
no requirement_library.create operation» all remain literally true.

## 5. API surface

Three operations, one capability. Wire ids and paths follow the existing
style (`requirement_library.list`).

| Operation | Method/path | Kind | Capability |
|---|---|---|---|
| `project_requirements.create` | `POST /v1/workspaces/{workspaceId}/project-requirements` | command, Idempotency-Key required | `project_requirements.manage` |
| `project_requirements.archive` | `POST /v1/project-requirements/{itemId}/archive` | command, Idempotency-Key required | `project_requirements.manage` |
| `project_requirements.list` | `GET /v1/workspaces/{workspaceId}/project-requirements` | query | `project_requirements.manage` (list is the authoring screen's read; members without the capability read requirements only through rule versions and occurrences) |

`project_requirements.manage` is a workspace capability granted to the same
roles as `requirement_rules.manage` (owner/admin in
`packages/domain/src/authz.ts`). The create command validates that
`project_id` names a project of this workspace (composite FK makes it
unrepresentable anyway; the command turns the 23503 into a named refusal).

## 6. Publish-path change

`requirement_rule_versions.publish` request: `requirementLibraryItemId`
becomes one arm of a zod discriminated union — exactly one of
`requirementLibraryItemId` | `projectSourcedRequirementItemId`. The route:

- reads the project-sourced row RLS-scoped inside the tenant transaction
  (same non-oracle refusal shape as the library read);
- refuses an `archived` item at publish time (archived means «do not build
  new obligations on this»; existing versions that copied it are untouched);
- copies `item_text_uk` (default acceptance criterion, as today),
  `verification = 'PROJECT_DOCUMENTATION'`, the assembled citation into
  `norm_ref_source`, and sets `norm_ref` to the composed project-source
  reference (never a ДБН citation);
- includes `projectSourcedRequirementItemId` in the frozen-content JSON so
  identical obligations from different provenance hash differently — «two
  rule versions identical in every obligation but resting on different
  standards are different obligations» applies verbatim.

The v0.1 refusal «У v0.1 правило спирається лише на постачений перелік» is
superseded by ADR-010 and is removed for the new arm; the intervention-type
restrictions (hold-only, INV-082/INV-085) are untouched — they are about
obligations, not sources.

## 7. UI — deliberately NOT in this slice

**Corrected 2026-08-24, after reading two Approved documents this design had
not consulted when §7 was first drafted.**

An earlier draft of this section proposed a requirement-library screen under
`/dash`. That would have widened an approved scope:

- [`ADR-009`](../../decisions/ADR-009-three-pilot-surfaces.md) decision 3 fixes
  the dashboard pilot at «create workspace/project + access grants; create
  assignment; view photo evidence. **Not the full register**».
- [`docs/design/04-role-pain-map.md`](../../design/04-role-pain-map.md) lists
  six screens as the owner's selection of 2026-08-21 and closes with the rule
  «Before adding a screen to the dashboard, name the role and the sentence in
  the demand scan that describes its pain. If neither exists, the screen is a
  guess.» No row covers requirement authoring.

**And the parity argument is decisive:** `requirement_rule_versions.publish`
— the operation that turns a library item into an obligation — has **no
screen either**. The whole requirement-authoring path is API-only in the
approved scope. Project-sourced items reach the product exactly where rule
publication already lives, under the same roles, and add no asymmetry.

The handoff's own framing agrees: «On any other kind of work there are no
requirements at all, which binds every pilot **regardless of screens**».
The binding constraint is the data and the API, and that is what this slice
removes.

**What a screen would cost, recorded so it is not re-derived** (it is a
separate slice and a separate owner decision, not a stretch goal here):

1. An amendment to ADR-009 decision 3 — the shape ADR-009 itself used when it
   amended ADR-007.
2. A row in `04-role-pain-map.md` naming the role (ПТВ) and the pain sentence
   from `docs/discovery/research-ua-demand-2026-08-21.md`.
3. The dashboard's **first write plumbing**: `apps/app/src/lib/api.ts` exports
   only `apiGet`; a command call needs `apiPost` carrying an
   `Idempotency-Key` header. Plan D slice D3 needs the same thing for its
   nine steps, so whichever slice lands first builds it and the other
   inherits it. Building it here, with no screen to exercise it, would ship
   an untested abstraction ahead of its consumer.
4. The full `docs/design/02-building-ui.md` procedure and its §5 gate.

A `TODOS.md` entry records this with the date and the two documents that
would have to change.

## 8. Testing

- **Storage-half INV-073 tests** for the new table, reading `pg_constraint`
  (never migration text): blank document/sheet/drawing unstorable; a
  verification value other than `PROJECT_DOCUMENTATION` unstorable; an
  archived row without `archived_at` unstorable.
- **Immutability**: UPDATE of text refused by the guard; active→archived
  allowed; DELETE refused.
- **Publish from a project source**: rule version carries the copied text,
  `PROJECT_DOCUMENTATION`, the assembled citation; hash differs from a
  library-sourced twin; archived item refused; other-workspace item
  indistinguishable from absent.
- **Contract-level separation**: `project_requirements.list` never returns a
  Додаток Н row and `requirement_library.list` never returns a project-sourced
  one — two operations, two tables, asserted by tests on both.
- No browser audit in this slice: it ships no route a browser reaches (§7).
  The rule «every new route gets an audit» attaches to the screen slice.
- All local, in CI's shape (CI billing-paused until 2026-09-01).

## 9. Out of scope (YAGNI, recorded so it is not re-derived)

- **The dashboard screen and the `apiPost` write plumbing** — §7 gives the
  reasoning and the four things a screen slice would have to carry.
- Uploading the документація sheet (decision 1 — may return as a separate
  decision later; no «optional file» column now).
- Editing item text in place; restore/unarchive; delete.
- Restricting binding to the item's own project (decision 2).
- Any change to Додаток Н content, its table, or its constraints.
- External-plane exposure of the new table.
- act_form assumption fields for project-sourced items — Додаток В/Г mapping
  stays a product assumption per prohibition G and is not extended here.
