# Project-sourced requirements from робоча документація — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a workspace author requirements from its own робоча документація, so the product can express obligations on work outside Додаток Н positions Н.14/Н.15, where today it can express none at all.

**Architecture:** A new table `public.project_sourced_requirement_items` holds workspace-authored requirement text with a structured citation (document, sheet, drawing number, optional revision). The seeded `requirement_library_items` and every one of its constraints are untouched. `requirement_rule_versions` gains a second, mutually exclusive provenance column, and the shared verification vocabulary gains a third storable value, `PROJECT_DOCUMENTATION`. Three catalogued operations author and read the new rows; the existing publish command grows a second source arm. No dashboard screen — see the spec's §7.

**Tech Stack:** PostgreSQL 17 (Supabase local), Next.js route handlers in `apps/app/app/v1/**`, zod 4.4.3 contracts in `packages/contracts`, vitest, pnpm + turbo.

**Spec:** [`docs/superpowers/specs/2026-08-24-project-sourced-requirements-design.md`](../specs/2026-08-24-project-sourced-requirements-design.md)

## Global Constraints

Every task's requirements implicitly include this section.

- **Change-control order is binding** ([`docs/README.md`](../../README.md) §"Change control"): the ADR first, Approved documents before implementation, machine-facing contracts before or with implementation, migrations append-only. Tasks 1–3 precede all code.
- **`docs/product/hidden-works-content-rules.md` binds Ukrainian regulatory content at every precedence level, including over ADRs.** ADR-010 may not introduce `PROJECT_DOCUMENTATION` by asserting it; the content-rules document is where the vocabulary changes.
- **Run `pnpm install` before trusting any local result.** This worktree's `node_modules` is stale: `packages/contracts/node_modules/zod` resolves to `.pnpm/zod@3.24.1` while `package.json` and `pnpm-lock.yaml` say `4.4.3`, and 3.24.1 has no `.guid()`.
- **Database role name is `goproceed_app`.** Migration `0057_the_roles_the_rename_left_behind.sql` renamed `aktflow_* → goproceed_*`. Every worked create-table/grants/RLS example in the repo (0041, 0043) predates the rename and says `aktflow_app`; **0059 is the first post-rename block and has no template to copy verbatim** — copy the shape, change the role.
- **New text columns use the two-argument btrim with the exact whitespace set 0052 standardised on:** `btrim(col, E' \t\n\r\f\v\u00A0')`. One-argument `btrim()` strips spaces only, so `E'\t\n'` passes a `length > 0` guard. **Type the six characters `\u00A0`; never paste the invisible character they stand for** — 0052 writes it as an escape because a literal NBSP is invisible in a diff, and this plan's first draft contained the pasted character.
- **No counts in source comments** and **no claims about what other files contain.** Cite the symbol, never the line number.
- **CI is billing-paused until 2026-09-01.** Verify locally in CI's shape; a red check before then is billing, not code.
- **Owner-approved copy, use verbatim:** the Ukrainian label for the new tag is **«за робочою документацією об'єкта»**.
- **Owner decision:** the external технагляд **does** see a project-sourced requirement, so `packages/contracts/src/external.ts` widens with the rest.

## Environment setup (run once, before Task 4)

```bash
pnpm install
```

```bash
supabase start
```

```bash
export APP_DB_URL=postgresql://goproceed_app_login:app_pw@127.0.0.1:54322/postgres
export SERVICE_DB_URL=postgresql://goproceed_service_login:service_pw@127.0.0.1:54322/postgres
export SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
```

`packages/database`'s pool throws on an unset `APP_DB_URL` or `SERVICE_DB_URL`, so both must be exported even for `pnpm --filter @goproceed/app test`.

## File Structure

**Documents (Tasks 1–3)**
- Create: `docs/decisions/ADR-010-project-sourced-requirements.md` — the decision record.
- Modify: `docs/product/hidden-works-content-rules.md` — vocabulary, a new section, the disclaimer, one stale Open item.
- Modify: `technical/database/entity-catalog.csv`, `technical/database/relationship-catalog.csv`, `technical/database/schema-v0.1.sql`, `technical/permissions/capabilities.csv`, `technical/openapi/scope-v0.1.csv`, `docs/delivery/version-0.1.md`.

**Database (Tasks 4–6)**
- Create: `supabase/migrations/0059_the_requirement_a_site_supplies.sql` — one file, three sections.
- Create: `packages/testing/src/m1-project-sourced-schema.test.ts` — constraints, grants, RLS.

**Types and contracts (Tasks 7–10)**
- Modify: `packages/contracts/src/requirement-library.ts` (`verificationTag`), `packages/contracts/src/external.ts` (`externalNormRef`), `packages/contracts/src/index.ts` (barrel), `packages/contracts/src/requirement-rules.ts` (publish request), `packages/contracts/src/m1-baseline-and-rules.test.ts`.
- Create: `packages/contracts/src/project-requirements.ts`.
- Modify: `apps/app/src/lib/norm-ref-labels.ts`, `apps/app/tests/norm-ref-labels.int.test.ts`.
- Modify: `packages/domain/src/authz.ts`.
- Modify: `apps/mobile/src/lib/field/obligations.ts`, `apps/mobile/src/screens/assignment.tsx`, `apps/mobile/src/lib/field/obligations.test.ts` (the deliberate port; its header says fix bugs in both copies).

**Routes (Tasks 11–14)**
- Create: `apps/app/app/v1/workspaces/[workspaceId]/project-requirements/route.ts` (POST create, GET list).
- Create: `apps/app/app/v1/project-requirements/[itemId]/archive/route.ts` (POST archive).
- Modify: `apps/app/src/lib/requirement-content.ts` (citation composer), `apps/app/app/v1/workspaces/[workspaceId]/requirement-rule-versions/route.ts` (the second source arm).
- Create: `apps/app/tests/project-requirements.int.test.ts`.

**Closing (Tasks 15–16)**
- Modify: `apps/app/tests/field-capture.int.test.ts` or a new sibling — the end-to-end proof.
- Modify: `TODOS.md`.

---

### Task 1: ADR-010 — the decision record

**Files:**
- Create: `docs/decisions/ADR-010-project-sourced-requirements.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the authority every later task cites. Tasks 2, 3 and 6 reference it by filename.

There is **no ADR index to extend**: `docs/decisions/` holds nine ADR files and no README, and `scripts/validate-canonical-docs.mjs`'s `REQUIRED` array lists ADR-001, 002, 003, 004, 005, 007, 008 — it does not list ADR-006 or ADR-009, so precedent says a new ADR need not be added there. Do not touch `docs/legacy/31-architecture-decisions.md`; it is an AktFlow-era file with its own unrelated ADR-001…ADR-009 numbering.

- [ ] **Step 1: Write the ADR with the exact four-key metadata block**

The validator's `METADATA_KEYS` are `Status`, `Applies to`, `Last reviewed`, `Related decisions`, each its own paragraph, in that order.

```markdown
# ADR-010: Requirements a site supplies from its own робоча документація

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-08-24

**Related decisions:** [ADR-005](ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](ADR-006-pilot-shaped-v0.1.md),
[ADR-009](ADR-009-three-pilot-surfaces.md)

## Context

ДБН А.3.1-5:2016 п. 8.4.3.3 says the binding hidden-works list for a site comes
from робоча документація, and Додаток Н is довідковий — allow-list item 8 of
[hidden-works-content-rules.md](../product/hidden-works-content-rules.md). The
shipped library is twelve items across positions Н.14 and Н.15, and a CHECK in
`0041_requirement_rules_bound_to_the_baseline.sql` makes any other position
unrepresentable. **On any other kind of work the product can express no
requirement at all**, which binds every pilot regardless of screens.

## Decision

The owner's decision of 2026-08-24:

1. **A workspace may author requirements from its own робоча документація**,
   in a table of their own. The seeded library and its constraints are not
   touched, so the verified set cannot be corrupted by authoring.
2. **A fourth verification value, `PROJECT_DOCUMENTATION`**, added to the
   vocabulary by hidden-works-content-rules.md — this ADR does not introduce
   it, because that document binds over ADRs.
3. **A source is a typed citation, not a file:** document, sheet (аркуш) and
   drawing number (№ креслення) are mandatory; revision is optional. INV-073
   requires the text to travel with its tag and its source or not at all, and
   «робоча документація» alone is a word, not a source.
4. **The item is workspace-scoped and carries `project_id NOT NULL`.** Binding
   an item into another project's baseline is not forbidden; the citation
   travels with the text wherever it renders.
5. **Three catalogued operations** — `project_requirements.create`,
   `.archive`, `.list` — under one new workspace capability held by the same
   roles as `requirement_rules.manage`.
6. **No dashboard screen.** ADR-009 decision 3 fixes the dashboard pilot at
   «Not the full register», and `requirement_rule_versions.publish` — the
   command that turns a requirement into an obligation — has no screen either.
   The whole authoring path stays API-only. A screen is a separate decision.

## Relationship to ADR-006 decision 4.1

ADR-006 decision 4.1 made the shipped library **the only rule source in v0.1**.
This decision adds a second source and **supersedes that clause and nothing
else**: the hold-only intervention restriction (decision 4.3), the
`blocks_stage_closure` allowance (4.4) and the location deferral (4.2) are
untouched. The refusal copy at the publish route's library read — «У v0.1
правило спирається лише на постачений перелік Додатка Н» — is the sentence this
supersedes, and it is rewritten rather than deleted.

## Relationship to ADR-009

ADR-009's amendment of 2026-08-22 bent the «no new API» rule for two reads and
said «this one authorises these two and nothing else». **This decision is that
own dated authorisation**, for three operations, on the member plane, catalogued
in the same `technical/openapi/scope-v0.1.csv` every other operation lives in,
governed by a capability row, and counted in `docs/delivery/version-0.1.md`.
Nothing is added quietly beside the API.

## What this decision does NOT claim

- It does not add a Додаток Н item, a Додаток В field or a clause number.
  A project-sourced string is never attributed to a ДБН and never renders
  inside a Додаток Н block.
- It does not upgrade any `UNVERIFIED` row, and it does not assert that the
  product verified anything a workspace types.
- It does not authorise a dashboard screen.
```

- [ ] **Step 2: Verify the metadata block parses**

Run: `pnpm validate:canonical-docs`
Expected: no error naming `ADR-010`. (The validator checks metadata keys on documents in `METADATA_DOCS`; a new ADR that follows the four-key shape cannot fail it.)

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/ADR-010-project-sourced-requirements.md && git commit -m "docs(adr): ADR-010 — requirements a site supplies from its own робоча документація"
```

---

### Task 2: The Approved content-rules document

**Files:**
- Modify: `docs/product/hidden-works-content-rules.md`

**Interfaces:**
- Consumes: ADR-010 (Task 1) as the recorded decision.
- Produces: the vocabulary value `PROJECT_DOCUMENTATION` and its render rules, which Tasks 6, 7 and 14 implement.

Three edit sites, by heading: `## Verification vocabulary`, `## Required disclaimers` (the block introduced by «**Under every generated requirement list**, never collapsed:»), and the first bullet of `## Open items`.

- [ ] **Step 1: Add the fourth vocabulary bullet**

After the `UNVERIFIED` bullet, before the closing rule «Several sites repeating an identical block is one source, not corroboration.»:

```markdown
- **PROJECT_DOCUMENTATION** — the text was typed by a workspace from its own
  робоча документація for a named project, and carries that document's шифр,
  аркуш and номер креслення. The product has not verified it. Its normative
  force for that site follows from п. 8.4.3.3, not from this product: it must
  always render with its full structured citation, must never be attributed to
  a ДБН or ДСТУ, and must never appear inside a Додаток Н block.
```

- [ ] **Step 2: Add the section that says what may be asserted**

Immediately after `## What the product MUST NOT assert`'s last prohibition (**S**), add:

```markdown
## Project-sourced strings

A requirement a workspace types from its own робоча документація is not an
assertion about any standard. What the product asserts is narrower and it is
this: *a named workspace states that this text stands in its own working
documentation for this project, at this sheet and this drawing.*

- The text renders as **the workspace's own statement of its documentation**,
  never as content of ДБН А.3.1-5:2016, ДСТУ 9258:2023 or any other standard.
- It renders **only with its structured citation** — document, аркуш,
  креслення, and the revision when one was given. The architectural
  requirement below applies unchanged: the tag and the source live in the
  data, so a string with no source is unrenderable rather than unrendered.
- It renders in **its own block**, never inside the Додаток Н list, and never
  under that list's attribution. Prohibition **A** is untouched and stays
  structural: the seeded library is a different table with a different
  constraint, and nothing here can add a line to Н.15.
- The one thing the product may say about *why* it binds is allow-list item 8,
  in item 8's own words: the binding list for a given site comes from робоча
  документація (п. 8.4.3.3), and Додаток Н is довідковий.

**Prohibition E is not weakened by the source record.** E bans «шифр»,
«аркуш» and «ким видана» as **fields added to the Додаток В act form**. The
citation fields above are the provenance of a requirement, not slots on an act
blank; nothing here prints a field into Додаток В.
```

- [ ] **Step 3: Extend the requirement-list disclaimer**

The existing blockquote under «**Under every generated requirement list**, never collapsed:» ends with «За потреби такими актами оформлюють й інші види робіт.» Append one sentence to that blockquote:

```markdown
> Пункти, позначені «за робочою документацією об'єкта», внесені виконавцем з
> робочої документації цього об'єкта із зазначенням аркуша та номера
> креслення; їх текст не є витягом з ДБН і видавцем не перевірявся.
```

- [ ] **Step 4: Close the stale Open item**

The first bullet of `## Open items` opens «**The primary ДБН file is not retained in the repository, and the fetch was never recorded.**» That is contradicted by the document's own header, which carries a **CLOSED 2026-08-10** paragraph describing a reproduced fetch, and by the CSV. Replace the bullet's opening claim with the closure, and **do not restate any gate count** — the existing sentence «M0 has twelve exit gates and this closes one of them» is a count that was measured once; delete it rather than re-derive it inline.

```markdown
- **CLOSED 2026-08-10, recorded here 2026-08-24.** The retrieval record this
  item asked for exists and is in the data rather than in prose: every row of
  [`technical/requirements/dbn-a31-5-2016-dodatok-n.csv`](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv)
  names the retrieval URL
  `https://e-construction.gov.ua/laws_detail/3879707932224390963`, the
  retrieval date 2026-08-10 and
  `sha256=4592edafaa8097d3b9305b7934d080256d649616a2741b6a5537a28606a665e3`,
  matching this document's own CLOSED 2026-08-10 paragraph above. A reviewer
  can repeat the fetch, hash it and compare. What remains open is unchanged
  and is stated where it belongs: one fetch reproduced is not two independent
  sources agreeing, and «незалежність будь-яких додаткових копій не
  встановлена» stays on every row.
```

- [ ] **Step 5: Verify no prohibition or tag was altered**

Run: `git diff docs/product/hidden-works-content-rules.md`
Expected: additions in the four places above and nothing else — in particular no change to any lettered prohibition, no change to any allow-list row, and no `UNVERIFIED` row upgraded.

- [ ] **Step 6: Commit**

```bash
git add docs/product/hidden-works-content-rules.md && git commit -m "docs(content-rules): PROJECT_DOCUMENTATION, project-sourced render rules, and one stale open item closed"
```

---

### Task 3: Catalogs, design DDL, and the operation counts

**Files:**
- Modify: `technical/database/entity-catalog.csv`, `technical/database/relationship-catalog.csv`, `technical/database/schema-v0.1.sql`, `technical/permissions/capabilities.csv`, `technical/openapi/scope-v0.1.csv`, `docs/delivery/version-0.1.md`

**Interfaces:**
- Consumes: ADR-010.
- Produces: the operation ids `project_requirements.create` / `.archive` / `.list` and the capability id `project_requirements.manage`, which Tasks 8, 11, 12 and 13 use verbatim.

**These edits are ONE commit.** `scripts/validate-canonical-docs.mjs` couples them in three directions and fails in both directions of each: every scope operation must be named by some capability row and every capability's operations must exist in a scope CSV; every entity-catalog row must have a matching `create table public.<name>` in `technical/database/schema-v0.1.sql`; every relationship endpoint must be an entity-catalog entity and every relationship's `invariant_id` must exist in `invariant-catalog.csv`.

Milestone tag is **`v0.1-M1`**, for two reasons: the sibling operations `requirement_rule_versions.publish` and `requirement_library.list` are M1, and the validator's two-way ADR-006 build-list check runs only for M3–M6, so an M1 tag does not force edits to `ADR006_V01_BUILD_LIST`, ADR-006 decision 4's table, or `docs/product/roadmap.md`.

- [ ] **Step 1: Add the three scope rows**

`technical/openapi/scope-v0.1.csv` — command rows and query rows have distinct shapes:

```
project_requirements.create,POST,/v1/workspaces/{workspaceId}/project-requirements,command,required,member,@goproceed/contracts,@goproceed/contracts,v0.1-M1
project_requirements.archive,POST,/v1/project-requirements/{itemId}/archive,command,required,member,@goproceed/contracts,@goproceed/contracts,v0.1-M1
project_requirements.list,GET,/v1/workspaces/{workspaceId}/project-requirements,query,natural,member,@goproceed/contracts,@goproceed/contracts,v0.1-M1
```

- [ ] **Step 2: Add the capability row**

`technical/permissions/capabilities.csv`. `related_operations` is **space**-separated; `requires` stays empty (it is populated only on project-plane rows); the description is unquoted and **must contain no comma**.

```
project_requirements.manage,workspace,Author and archive requirement items a workspace takes from its own робоча документація and read them back; the text and its citation are immutable and a correction is a new item plus an archive of the old one. Held by the same roles as requirement_rules.manage per ADR-010. The seeded Додаток Н library is a different table and has no create operation in either scope CSV,project_requirements.create project_requirements.archive project_requirements.list,v0.1-M1,
```

Do **not** add this capability to `technical/permissions/responsibility-presets.csv`: the validator rejects a preset naming a non-project capability.

- [ ] **Step 3: Add the entity and relationship rows and the design DDL**

Add one row to `technical/database/entity-catalog.csv` for `project_sourced_requirement_items` (module `requirements`, milestone `v0.1-M1`), matching the column shape of the `requirement_library_items` row.

Add to `technical/database/relationship-catalog.csv`, matching the existing `requirement_rule_versions,cites,requirement_library_items` row's column shape, with `INV-073` as the invariant:

```
project_sourced_requirement_items,belongs_to,workspaces,N:1,yes,workspace_id -> workspaces(id),restrict,INV-073
project_sourced_requirement_items,scoped_to,projects,N:1,yes,workspace_id+project_id -> projects(workspace_id+id),restrict,INV-073
requirement_rule_versions,cites,project_sourced_requirement_items,N:1,no,workspace_id+project_sourced_requirement_item_id -> project_sourced_requirement_items(workspace_id+id),restrict,INV-073
```

Add a `create table public.project_sourced_requirement_items (...)` to `technical/database/schema-v0.1.sql` **in that file's own vocabulary**: its tenant root is `public.workspaces`, not `public.organizations`. The design DDL and the migration legitimately differ in their FK targets, and a comment on the table should say so in one line.

- [ ] **Step 4: Move the operation counts in all four places**

In `docs/delivery/version-0.1.md`: the table row `| \`v0.1-M1\` | 32 | 8 | 8 |` becomes `35`; the prose «the 32 `v0.1-M1` operations» becomes `35` **and its explicit enumeration of operation ids gains the three new names**; the `| Total | 62 | 26 | 26 |` row becomes `65`; and the free prose «62 operations in v0.1» becomes `65`. The validator matches only the first two forms — the Total row and the free prose are unchecked, so a stale number there is silent and must be changed by hand.

- [ ] **Step 5: Run the validator**

Run: `pnpm validate:canonical-docs`
Expected: `canonical documentation: OK`. If it names a missing design table, Step 3's DDL is absent or misspelled; if it names a capability/operation mismatch, Steps 1–2 disagree.

- [ ] **Step 6: Commit**

```bash
git add technical docs/delivery/version-0.1.md && git commit -m "docs(catalogs): catalogue the three project-requirement operations and their capability"
```

---

### Task 4: Migration 0059 §1 — the table

**Files:**
- Create: `supabase/migrations/0059_the_requirement_a_site_supplies.sql`
- Create: `packages/testing/src/m1-project-sourced-schema.test.ts`

**Interfaces:**
- Consumes: the entity name from Task 3.
- Produces: `public.project_sourced_requirement_items` with columns `id, workspace_id, project_id, item_text_uk, source_document, source_sheet, source_drawing_no, source_revision, verification, status, created_at, created_by_member_id, archived_at, archived_by_member_id`. Tasks 5, 6, 9, 11–14 all read these names.

`packages/testing`'s vitest `include` is `src/**/*.test.ts`, so the file must be named exactly as above to be collected at all.

- [ ] **Step 1: Write the failing constraint test**

Create `packages/testing/src/m1-project-sourced-schema.test.ts`. Copy the fixture and helper style of `packages/testing/src/m1-rules-schema.test.ts` (which exports `sqlstate(fn)` returning the SQLSTATE so a CHECK (23514) is distinguishable from a policy denial).

```ts
it("refuses a source field that is only whitespace", async () => {
  // one-argument btrim strips spaces only; E'\t\n' is the probe that caught
  // the weaker guard in 0052.
  for (const blank of ["", "   ", "\t\n"]) {
    expect(await sqlstate(() => insertItem({ sourceSheet: blank }))).toBe("23514");
    expect(await sqlstate(() => insertItem({ sourceDocument: blank }))).toBe("23514");
    expect(await sqlstate(() => insertItem({ sourceDrawingNo: blank }))).toBe("23514");
    expect(await sqlstate(() => insertItem({ itemTextUk: blank }))).toBe("23514");
  }
});

it("refuses any verification value but PROJECT_DOCUMENTATION", async () => {
  expect(await sqlstate(() => insertItem({ verification: "VERIFIED_PRIMARY" }))).toBe("23514");
  expect(await sqlstate(() => insertItem({ verification: "UNVERIFIED" }))).toBe("23514");
});

it("refuses an archived row that records neither when nor who", async () => {
  expect(await sqlstate(() => insertItem({ status: "archived" }))).toBe("23514");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @goproceed/testing test -- m1-project-sourced-schema`
Expected: FAIL — the relation `public.project_sourced_requirement_items` does not exist.

- [ ] **Step 3: Write §1 of the migration**

Open the file with a prose header in the shape 0041 uses (WHAT THIS ADDS / WHAT THIS DOES NOT CHANGE / ROLLBACK (dev only)), then a `-- ====` banner per numbered section.

```sql
-- ===========================================================================
-- 1. project_sourced_requirement_items — what a site's own documentation says
--
-- ДБН А.3.1-5:2016 п. 8.4.3.3: the binding hidden-works list for a site comes
-- from робоча документація, and Додаток Н is довідковий
-- (hidden-works-content-rules.md allow-list item 8). ADR-010 lets a workspace
-- author from that documentation.
--
-- THIS IS NOT THE LIBRARY AND MUST NEVER BECOME IT. requirement_library_items
-- keeps its Н.14/Н.15 CHECK, its item_no extent CHECK and its two-value
-- verification CHECK, and this migration does not touch that table. A row here
-- can never add a line to Н.15 because it is not in that relation.
-- ===========================================================================
create table public.project_sourced_requirement_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,

  item_text_uk text not null
    check ((length(btrim(item_text_uk, E' \t\n\r\f\v\u00A0')) > 0)),

  -- INV-073's source half, made structural. «Робоча документація» without a
  -- sheet and a drawing number is a word, not a source (ADR-010 decision 3),
  -- so the three identifying fields are NOT NULL and non-blank rather than one
  -- free-text citation column.
  source_document text not null
    check ((length(btrim(source_document, E' \t\n\r\f\v\u00A0')) > 0)),
  source_sheet text not null
    check ((length(btrim(source_sheet, E' \t\n\r\f\v\u00A0')) > 0)),
  source_drawing_no text not null
    check ((length(btrim(source_drawing_no, E' \t\n\r\f\v\u00A0')) > 0)),
  source_revision text
    check (source_revision is null
        or (length(btrim(source_revision, E' \t\n\r\f\v\u00A0')) > 0)),

  -- INV-073's tag half. One storable value, the normative_character pattern:
  -- a row cannot claim a verification the product never performed.
  verification text not null
    check (verification = 'PROJECT_DOCUMENTATION'),

  status text not null default 'active'
    check (status in ('active','archived')),

  created_at timestamptz not null default now(),
  created_by_member_id uuid not null,
  archived_at timestamptz,
  archived_by_member_id uuid,

  unique (workspace_id, id),
  foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  -- memberships predates the workspace_id naming convention: its tenant column
  -- is organization_id and that is what the composite FK must name.
  foreign key (workspace_id, created_by_member_id)
    references public.memberships (organization_id, id),
  foreign key (workspace_id, archived_by_member_id)
    references public.memberships (organization_id, id),

  constraint project_sourced_requirement_items_archived_check
    check (status = 'active'
        or (archived_at is not null and archived_by_member_id is not null))
);

create index project_sourced_requirement_items_project_idx
  on public.project_sourced_requirement_items (workspace_id, project_id)
  where status = 'active';

comment on table public.project_sourced_requirement_items is
  'Requirement text a workspace takes from its own робоча документація for one '
  'project, with the sheet and drawing number that identify it. Never a ДБН '
  'extract and never rendered inside a Додаток Н block '
  '(docs/product/hidden-works-content-rules.md §"Project-sourced strings"). '
  'Text and citation are immutable; a correction is a new row plus an archive '
  'of the old one.';
```

- [ ] **Step 4: Apply and run the test**

```bash
supabase db reset
```

```bash
pnpm -w db:local-credentials
```

Run: `pnpm --filter @goproceed/testing test -- m1-project-sourced-schema`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0059_the_requirement_a_site_supplies.sql packages/testing/src/m1-project-sourced-schema.test.ts && git commit -m "feat(db): the table a site's own documentation writes into"
```

---

### Task 5: Migration 0059 §2 — grants, RLS, immutability, the archive function

**Files:**
- Modify: `supabase/migrations/0059_the_requirement_a_site_supplies.sql`
- Modify: `packages/testing/src/m1-project-sourced-schema.test.ts`

**Interfaces:**
- Consumes: the table from Task 4.
- Produces: `app.archive_project_sourced_requirement_item(p_workspace uuid, p_item uuid) returns void`, called by Task 12's route.

Three whole-schema audits already in the suite go red on a table created without RLS, and a fourth requires every permissive policy granted to `goproceed_app` to name a subject-resolving function. **Nothing** in the suite fails when a table appears with RLS but zero grants — every positive grant assertion is scoped to a hard-coded table list — so this task adds its own.

- [ ] **Step 1: Write the failing grant and RLS tests**

Assert the **whole** grant set rather than a negative check, the way `m1-rules-schema.test.ts` does, so a grant added later is visible here.

```ts
it("the app role may read and append and nothing else", async () => {
  const r = await adminQuery(
    `select privilege_type from information_schema.role_table_grants
      where grantee = 'goproceed_app' and table_name = $1 order by privilege_type`,
    ["project_sourced_requirement_items"]);
  expect(r.rows.map((x) => x.privilege_type)).toEqual(["INSERT", "SELECT"]);
});

it("shows a row to any active member of its workspace and to nobody else", async () => {
  expect(await visible(USER_A, WS_A, "project_sourced_requirement_items", itemA)).toBe(1);
  expect(await visible(USER_M, WS_A, "project_sourced_requirement_items", itemA)).toBe(1);
  expect(await visible(USER_B, WS_B, "project_sourced_requirement_items", itemA)).toBe(0);
});

it("refuses an UPDATE of the text and permits only active -> archived", async () => {
  expect(await sqlstate(() => appUpdate(itemA, "item_text_uk = 'інше'"))).toBe("P0001");
  await expect(archiveViaFunction(WS_A, itemA)).resolves.toBeUndefined();
  // idempotent by state: the operation is idempotency-required, a replay must not raise
  await expect(archiveViaFunction(WS_A, itemA)).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @goproceed/testing test -- m1-project-sourced-schema`
Expected: FAIL — no grants, no policies, no function.

- [ ] **Step 3: Write §2**

Grants are deny-by-default; the preamble is a bulk revoke then one grant line. The role is **`goproceed_app`** (see Global Constraints). `goproceed_service` gets nothing: this table records no server-observed fact.

```sql
-- ===========================================================================
-- 2. Grants, RLS, and the one admissible transition
--
-- Route by route, so an unused grant is visible:
--   project_sourced_requirement_items  SELECT  project_requirements.list,
--                                              the publish route's source read
--                                      INSERT  project_requirements.create
-- There is deliberately NO UPDATE grant. Archiving goes through the definer
-- function below, for the reason 0041 §7 gives about retirement: the
-- application role never holds the privilege that would make immutability a
-- convention.
-- ===========================================================================
revoke all on public.project_sourced_requirement_items
  from public, anon, authenticated;
grant select, insert on public.project_sourced_requirement_items to goproceed_app;

alter table public.project_sourced_requirement_items enable row level security;

-- Any active member reads, for the reason rli_select gives: the foreman who
-- reads an occurrence reads the text behind it, and the text reaches him
-- through a rule version that is already member-readable.
create policy psri_select on public.project_sourced_requirement_items
  for select to goproceed_app
  using (app.active_member_id(workspace_id) is not null);

-- Owner/admin writes — the same role mapping packages/domain/src/authz.ts uses
-- for workspace capabilities, which is where project_requirements.manage lands.
create policy psri_insert on public.project_sourced_requirement_items
  for insert to goproceed_app
  with check (app.member_role(workspace_id) in ('owner','admin'));

-- The guard is a hybrid of app.reject_mutation() (0013) and
-- app.guard_requirement_rule_version() (0041): DELETE is refused outright, and
-- the only admissible UPDATE is active -> archived setting exactly the two
-- archival columns. The content comparison is whole-row rather than
-- column-by-column, so a column added by a later migration is frozen from the
-- moment it exists without anybody remembering to extend a list.
create or replace function app.guard_project_sourced_requirement_item()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'project-sourced requirement items are not deletable';
  end if;

  if old.status <> 'active' or new.status <> 'archived' then
    raise exception
      'project-sourced requirement item % admits only the active -> archived transition; attempted % -> %',
      old.id, old.status, new.status;
  end if;

  if new.archived_at is null or new.archived_by_member_id is null then
    raise exception 'archiving item % must record archived_at and the archiving member', old.id;
  end if;

  if (to_jsonb(new) - 'status'::text - 'archived_at'::text - 'archived_by_member_id'::text)
     is distinct from
     (to_jsonb(old) - 'status'::text - 'archived_at'::text - 'archived_by_member_id'::text) then
    raise exception 'archiving must not alter the requirement text or its citation';
  end if;

  return new;
end $$;
revoke all on function app.guard_project_sourced_requirement_item() from public;

create trigger project_sourced_requirement_items_guard
  before update or delete on public.project_sourced_requirement_items
  for each row execute function app.guard_project_sourced_requirement_item();

-- The only write path for the transition. SECURITY DEFINER bypasses RLS, so
-- authorization is this function's own job; it runs BEFORE anything is read so
-- a raise message cannot become a cross-tenant oracle, and the actor comes from
-- app.active_member_id and never from an argument. search_path is the strict
-- form 0051 established, with fully-qualified names.
create or replace function app.archive_project_sourced_requirement_item(
  p_workspace uuid, p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
  v_status text;
begin
  v_member := app.active_member_id(p_workspace);
  if v_member is null or app.member_role(p_workspace) not in ('owner','admin') then
    raise exception 'not authorized to archive a project-sourced requirement item in this workspace';
  end if;

  select status into v_status
    from public.project_sourced_requirement_items
   where workspace_id = p_workspace and id = p_item;

  if v_status is null then
    raise exception 'unknown project-sourced requirement item';
  end if;
  -- Idempotent by state: the operation is idempotency-required in
  -- scope-v0.1.csv and a replay must not raise.
  if v_status = 'archived' then
    return;
  end if;

  update public.project_sourced_requirement_items
     set status = 'archived', archived_at = now(), archived_by_member_id = v_member
   where workspace_id = p_workspace and id = p_item;
end $$;
revoke all on function app.archive_project_sourced_requirement_item(uuid, uuid) from public;
grant execute on function app.archive_project_sourced_requirement_item(uuid, uuid) to goproceed_app;
```

- [ ] **Step 4: Apply and run**

```bash
supabase db reset
```

Run: `pnpm --filter @goproceed/testing test`
Expected: PASS, including the pre-existing whole-schema RLS and policy-subject audits.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0059_the_requirement_a_site_supplies.sql packages/testing/src/m1-project-sourced-schema.test.ts && git commit -m "feat(db): grants, RLS and the single admissible transition for project-sourced items"
```

---

### Task 6: Migration 0059 §3 — the vocabulary widening and the second provenance

**Files:**
- Modify: `supabase/migrations/0059_the_requirement_a_site_supplies.sql`
- Modify: `packages/testing/src/m1-project-sourced-schema.test.ts`

**Interfaces:**
- Consumes: the table from Task 4.
- Produces: `requirement_rule_versions.project_sourced_requirement_item_id`, read by Task 14.

**Two CHECKs widen, not one.** The identical two-value CHECK exists in four places; the spec named one. `requirement_rule_versions.norm_ref_verification` (0041) **and** `requirement_occurrences.norm_ref_verification` (0043) must both widen, because `materialiseOccurrences` in `apps/app/src/lib/occurrence-writer.ts` copies the tag from the rule version into the occurrence — without the second widening, `assignments.create` raises 23514 on a well-formed publish. `requirement_library_items.verification` (0041) stays two-valued: the seeded library never carries the new tag. `statutory_act_versions.form_citation_verification` (0047) **also stays**, and the reason is in 0047's own comment — it tags the citation of the **act form** («a document that is nothing but normative form»), which is the Додаток В form regardless of where a requirement came from.

- [ ] **Step 1: Write the failing test**

```ts
it("stores a rule version and an occurrence tagged PROJECT_DOCUMENTATION", async () => {
  await expect(insertRuleVersion({ normRefVerification: "PROJECT_DOCUMENTATION" }))
    .resolves.toBeDefined();
  await expect(insertOccurrence({ normRefVerification: "PROJECT_DOCUMENTATION" }))
    .resolves.toBeDefined();
});

it("refuses a rule version citing both a library item and a project-sourced item", async () => {
  expect(await sqlstate(() => insertRuleVersion({
    requirementLibraryItemId: libItem, projectSourcedRequirementItemId: psItem,
  }))).toBe("23514");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @goproceed/testing test -- m1-project-sourced-schema`
Expected: FAIL with 23514 on the first test (the CHECK is still two-valued) and an undefined-column error on the second.

- [ ] **Step 3: Write §3**

Use the single-statement drop+add form (one `alter table`, comma-separated, one lock, no window where neither constraint exists). Do **not** write `drop constraint if exists`: a name mismatch would skip silently and leave both constraints in place, with the narrow one still refusing. Inline column CHECKs carry PostgreSQL's default name `{table}_{column}_check`.

```sql
-- ===========================================================================
-- 3. The vocabulary widens by one value, in the two places a tag travels
--
-- A WIDENING. Every value previously accepted is still accepted, so the
-- re-added constraints are validated against existing rows and cannot fail on
-- them.
--
-- WHY TWO AND NOT ONE. A rule version's norm_ref_verification is COPIED into
-- requirement_occurrences at materialisation (apps/app/src/lib/occurrence-writer.ts,
-- materialiseOccurrences). Widening only the rule-version CHECK would leave a
-- publish that succeeds and an assignment creation that raises 23514.
--
-- WHY NOT THE OTHER TWO. requirement_library_items.verification stays
-- two-valued: the seeded Додаток Н set never carries this tag, and making it
-- storable there would let authoring corrupt the verified set.
-- statutory_act_versions.form_citation_verification stays two-valued because it
-- tags the ACT FORM's own citation, which is Додаток В whatever the
-- requirement's source is (0047 §"INV-073, storage half").
-- ===========================================================================
alter table public.requirement_rule_versions
  drop constraint requirement_rule_versions_norm_ref_verification_check,
  add constraint requirement_rule_versions_norm_ref_verification_check
    check (norm_ref_verification in
      ('VERIFIED_PRIMARY','VERIFIED_SECONDARY','PROJECT_DOCUMENTATION'));

alter table public.requirement_occurrences
  drop constraint requirement_occurrences_norm_ref_verification_check,
  add constraint requirement_occurrences_norm_ref_verification_check
    check (norm_ref_verification in
      ('VERIFIED_PRIMARY','VERIFIED_SECONDARY','PROJECT_DOCUMENTATION'));

-- The second provenance. requirement_library_item_id was already nullable
-- because making it NOT NULL would have baked v0.1 into the schema; this column
-- is its sibling and the CHECK below is what makes them exclusive.
--
-- No edit to app.guard_requirement_rule_version() is needed: it compares
-- to_jsonb(new) against to_jsonb(old) with four keys subtracted rather than
-- enumerating columns, so this column is frozen from the moment it exists.
alter table public.requirement_rule_versions
  add column project_sourced_requirement_item_id uuid,
  add constraint requirement_rule_versions_project_sourced_fkey
    foreign key (workspace_id, project_sourced_requirement_item_id)
    references public.project_sourced_requirement_items (workspace_id, id),
  add constraint requirement_rule_versions_one_provenance_check
    check (requirement_library_item_id is null
        or project_sourced_requirement_item_id is null);
```

- [ ] **Step 4: Apply and run the whole suite**

```bash
supabase db reset
```

Run: `pnpm --filter @goproceed/testing test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0059_the_requirement_a_site_supplies.sql packages/testing/src/m1-project-sourced-schema.test.ts && git commit -m "feat(db): widen the verification vocabulary where a tag travels, and add the second provenance"
```

---

### Task 7: The shared vocabulary in TypeScript, and every site that restates it

**Files:**
- Modify: `packages/contracts/src/requirement-library.ts`, `packages/contracts/src/external.ts`
- Modify: `apps/app/src/lib/norm-ref-labels.ts`, `apps/app/tests/norm-ref-labels.int.test.ts`
- Modify: `apps/app/src/lib/statutory-act-form.ts`, `apps/app/src/lib/dodatok-n.ts` (only where they restate the tag set)
- Modify: `apps/mobile/src/lib/field/obligations.ts`, `apps/mobile/src/screens/assignment.tsx`, `apps/mobile/src/lib/field/obligations.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `verificationTag` with three values and `VerificationTagValue` including `"PROJECT_DOCUMENTATION"`. Tasks 9, 13 and 14 depend on it.

The canonical constant is `verificationTag` in `packages/contracts/src/requirement-library.ts`. Three modules reuse it and need no edit. **One module inside the package restates it inline — `externalNormRef` in `external.ts`** — and it is parsed on the way out, so an external технагляд reading a project-sourced occurrence would throw at the response boundary. `apps/mobile` duplicates deliberately (it does not depend on `@goproceed/contracts`) and its own header says bugs are fixed in both copies.

- [ ] **Step 1: Write the failing label test**

`apps/app/tests/norm-ref-labels.int.test.ts` currently asserts `expect(permitted.length).toBe(2)` against the CHECK it reads from `pg_constraint`. Change the expectation to `3` and add the label assertion:

```ts
expect(permitted).toContain("PROJECT_DOCUMENTATION");
expect(permitted.length).toBe(3);
expect(NORM_REF_VERIFICATION_LABELS.PROJECT_DOCUMENTATION)
  .toBe("за робочою документацією об'єкта");
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @goproceed/app test -- norm-ref-labels`
Expected: FAIL — the label map has no such key and does not compile.

- [ ] **Step 3: Widen the constant and every restatement**

```ts
// packages/contracts/src/requirement-library.ts
export const verificationTag = z.enum([
  "VERIFIED_PRIMARY", "VERIFIED_SECONDARY", "PROJECT_DOCUMENTATION",
]);
```

```ts
// packages/contracts/src/external.ts — reuse the constant instead of a third copy
import { verificationTag } from "./requirement-library";

export const externalNormRef = z.object({
  text: z.string().min(1),
  verification: verificationTag,
  source: z.string().min(1),
}).strict();
```

```ts
// apps/app/src/lib/norm-ref-labels.ts
export const NORM_REF_VERIFICATION_LABELS: Readonly<Record<VerificationTagValue, string>> =
  Object.freeze({
    VERIFIED_PRIMARY: "перевірено за першоджерелом",
    VERIFIED_SECONDARY: "перевірено за вторинним джерелом",
    PROJECT_DOCUMENTATION: "за робочою документацією об'єкта",
  });
```

The label's doc comment says what the two existing values mean, so extend it: this value **does not** state a verification strength — it states origin, and the product verified nothing.

Then run a search and fix each remaining restatement so the three-value set is stated once per package:

```bash
grep -rn "VERIFIED_SECONDARY" apps packages --include=*.ts --include=*.tsx | grep -v node_modules
```

- [ ] **Step 4: Run the label test and the typecheck**

Run: `pnpm --filter @goproceed/app test -- norm-ref-labels`
Expected: PASS.

Run: `pnpm turbo run typecheck`
Expected: PASS. A missed restatement surfaces here as an exhaustiveness error, which is the loud failure the typed map exists to produce.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src apps/app/src/lib apps/app/tests/norm-ref-labels.int.test.ts apps/mobile/src && git commit -m "feat(contracts): a third storable verification tag, stated once per package"
```

---

### Task 8: The capability

**Files:**
- Modify: `packages/domain/src/authz.ts`

**Interfaces:**
- Consumes: the capability id from Task 3.
- Produces: `"project_requirements.manage"` as a `WorkspaceCapability`, required by Tasks 11–13.

A **workspace** capability needs no contracts change and no database CHECK — unlike a project capability, whose vocabulary lives in three places that must agree. This is a two-file change and the CSV half landed in Task 3.

**The trap:** `MAP` is a `Record<GovernanceRole, readonly WorkspaceCapability[]>`, a record over **roles**, not over capabilities. A new union member added to no array still compiles; omitting it only makes the capability ungrantable, producing a silent 403 `SCOPE_DENIED` for every role. Nothing guards `WorkspaceCapability` against the CSV.

- [ ] **Step 1: Write the failing test**

Add to `packages/domain`'s existing authz test file:

```ts
it("grants project_requirements.manage to exactly the roles that hold requirement_rules.manage", () => {
  for (const role of ["owner", "admin", "member", "viewer"] as const) {
    expect(workspaceCapabilities(role).includes("project_requirements.manage"))
      .toBe(workspaceCapabilities(role).includes("requirement_rules.manage"));
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @goproceed/domain test`
Expected: FAIL — `"project_requirements.manage"` is not assignable to `WorkspaceCapability`.

- [ ] **Step 3: Add the union member and both MAP entries**

```ts
export type WorkspaceCapability =
  | "workspace.manage" | "members.manage" | "parties.manage"
  | "own_legal_profiles.manage" | "projects.create" | "units.manage"
  | "requirement_templates.manage" | "requirement_rules.manage"
  | "project_requirements.manage";
```

Add `"project_requirements.manage"` to the `owner` array and the `admin` array of `MAP`, beside `"requirement_rules.manage"` in each.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @goproceed/domain test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain && git commit -m "feat(domain): project_requirements.manage, held by the roles that hold requirement_rules.manage"
```

---

### Task 9: The wire contract for the three operations

**Files:**
- Create: `packages/contracts/src/project-requirements.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: `verificationTag` (Task 7).
- Produces: `createProjectRequirementRequest`, `archiveProjectRequirementRequest`, `projectSourcedRequirementItem`, `projectRequirementListResponse`, and the types `CreateProjectRequirementRequest`, `ProjectSourcedRequirementItemResponse`, `ArchiveProjectRequirementResponse`. Tasks 11–13 import all of these.

Naming follows the package: a request is `export const <verb><Noun>Request = z.object({...}).strict()` immediately followed by `export type <Verb><Noun>Request = z.infer<typeof ...>`. `packages/contracts/src` is flat; a new module is one file plus one `export *` line in the barrel. **Responses are zod-parsed on the way out only when they carry regulatory strings** — this one does, so the list response is a schema and not a bare interface.

- [ ] **Step 1: Write the failing contract test**

Add to `packages/contracts/src/m1-baseline-and-rules.test.ts` or a new sibling test file:

```ts
it("refuses a create with a blank sheet or drawing number", () => {
  for (const field of ["sourceSheet", "sourceDrawingNo", "sourceDocument", "itemTextUk"]) {
    const r = createProjectRequirementRequest.safeParse({ ...validCreate, [field]: "   " });
    expect(r.success).toBe(false);
  }
});

it("accepts an absent revision and refuses a blank one", () => {
  expect(createProjectRequirementRequest.safeParse(validCreate).success).toBe(true);
  expect(createProjectRequirementRequest.safeParse({ ...validCreate, sourceRevision: " " }).success)
    .toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @goproceed/contracts test`
Expected: FAIL — `createProjectRequirementRequest` is not exported.

- [ ] **Step 3: Write the module**

```ts
import { z } from "zod";
import { verificationTag } from "./requirement-library";

/**
 * ADR-010: a workspace authors a requirement from its own робоча документація.
 * INV-073's source half is on the wire as three mandatory identifying fields
 * rather than one free-text citation: «робоча документація» without a sheet and
 * a drawing number is a word, not a source.
 *
 * verification is NOT on the wire. It is returned, never accepted — the only
 * storable value is PROJECT_DOCUMENTATION and a caller may not choose a tag.
 */
export const createProjectRequirementRequest = z.object({
  projectId: z.string().guid(),
  itemTextUk: z.string().trim().min(1),
  sourceDocument: z.string().trim().min(1),
  sourceSheet: z.string().trim().min(1),
  sourceDrawingNo: z.string().trim().min(1),
  sourceRevision: z.string().trim().min(1).optional(),
}).strict();
export type CreateProjectRequirementRequest =
  z.infer<typeof createProjectRequirementRequest>;

/** Identity is in the path; replay protection is the Idempotency-Key header. */
export const archiveProjectRequirementRequest = z.object({}).strict();
export type ArchiveProjectRequirementRequest =
  z.infer<typeof archiveProjectRequirementRequest>;

export const projectSourcedRequirementItem = z.object({
  itemId: z.string().guid(),
  projectId: z.string().guid(),
  itemTextUk: z.string().min(1),
  sourceDocument: z.string().min(1),
  sourceSheet: z.string().min(1),
  sourceDrawingNo: z.string().min(1),
  sourceRevision: z.string().min(1).nullable(),
  verification: verificationTag,
  status: z.enum(["active", "archived"]),
  createdAt: z.string(),
  archivedAt: z.string().nullable(),
});
export type ProjectSourcedRequirementItemResponse =
  z.infer<typeof projectSourcedRequirementItem>;

export const projectRequirementListResponse = z.object({
  items: z.array(projectSourcedRequirementItem),
});
export type ProjectRequirementListResponse =
  z.infer<typeof projectRequirementListResponse>;

export interface ArchiveProjectRequirementResponse {
  itemId: string;
  status: "archived";
  archivedAt: string;
}
```

Append to `packages/contracts/src/index.ts`:

```ts
export * from "./project-requirements";
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @goproceed/contracts test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src && git commit -m "feat(contracts): the wire shape for authoring from робоча документація"
```

---

### Task 10: The publish request grows a second source arm

**Files:**
- Modify: `packages/contracts/src/requirement-rules.ts`
- Modify: `packages/contracts/src/m1-baseline-and-rules.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `publishRequirementRuleVersionRequest` accepting exactly one of `requirementLibraryItemId` | `projectSourcedRequirementItemId`. Task 14 reads both.

**Not a discriminated union.** `z.discriminatedUnion` is used exactly once in the tree and needs a literal discriminator key; two mutually exclusive optional uuids have none. There is **no exactly-one-of-two precedent** anywhere and `z.union` is used zero times. The idiom that exists — and that this very schema already ends with — is a `superRefine`, so add to it rather than restructure. This also keeps the schema a plain `ZodObject`, which `commandRoute`'s `z.ZodType<T, unknown>` already accepts today.

- [ ] **Step 1: Update the test that pins the old requiredness**

`it("refuses a rule version that cites no library item")` asserts `r.error.issues[0]?.path` equals `["requirementLibraryItemId"]`. That assertion **must** change deliberately in this commit, not be discovered failing later.

```ts
it("refuses a rule version that cites no source at all", () => {
  const r = publishRequirementRuleVersionRequest.safeParse(noCitation);
  expect(r.success).toBe(false);
  if (!r.success) {
    expect(r.error.issues[0]?.message)
      .toContain("exactly one of requirementLibraryItemId or projectSourcedRequirementItemId");
  }
});

it("refuses a rule version citing both sources", () => {
  const r = publishRequirementRuleVersionRequest.safeParse({
    ...valid, requirementLibraryItemId: A, projectSourcedRequirementItemId: B,
  });
  expect(r.success).toBe(false);
});

it("accepts a rule version citing only a project-sourced item", () => {
  const { requirementLibraryItemId, ...rest } = valid;
  expect(publishRequirementRuleVersionRequest
    .safeParse({ ...rest, projectSourcedRequirementItemId: B }).success).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @goproceed/contracts test`
Expected: FAIL — the schema still requires `requirementLibraryItemId`.

- [ ] **Step 3: Relax the field and add the refusal**

Make `requirementLibraryItemId` optional, add its sibling, and add one branch to the existing `superRefine`:

```ts
  requirementLibraryItemId: z.string().guid().optional(),
  projectSourcedRequirementItemId: z.string().guid().optional(),
```

```ts
  // ADR-010: v0.1 has two rule sources and a version rests on exactly one.
  // The database says the same thing in
  // requirement_rule_versions_one_provenance_check; this is the refusal that
  // names the field instead of raising 23514.
  if ((v.requirementLibraryItemId != null) === (v.projectSourcedRequirementItemId != null)) {
    ctx.addIssue({
      code: "custom",
      path: ["requirementLibraryItemId"],
      message: "exactly one of requirementLibraryItemId or projectSourcedRequirementItemId is required",
    });
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @goproceed/contracts test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/requirement-rules.ts packages/contracts/src/m1-baseline-and-rules.test.ts && git commit -m "feat(contracts): a rule version rests on exactly one source"
```

---

### Task 11: `project_requirements.create`

**Files:**
- Create: `apps/app/app/v1/workspaces/[workspaceId]/project-requirements/route.ts`
- Create: `apps/app/tests/project-requirements.int.test.ts`

**Interfaces:**
- Consumes: `createProjectRequirementRequest` (Task 9), `"project_requirements.manage"` (Task 8), the table (Task 4).
- Produces: `POST` returning `ProjectSourcedRequirementItemResponse` with status 201.

Copy the seven-step shape of the retire route, and `validationFailed` from `apps/app/src/lib/manual-baseline.ts` by relative path, as seven routes already do. Use only catalogued problem codes — `VALIDATION_FAILED` (422) and `RESOURCE_NOT_FOUND` (404) are both in `technical/error-catalog.csv`, so **no catalog edit is needed**; a standing guard test walks `apps/app/app/v1` and fails on any code absent from that CSV.

- [ ] **Step 1: Write the failing route test**

Follow the driver pattern: mock `../src/lib/auth` module-wide with a mutable current user, `import()` the route module inside a helper, call the exported `POST` with `jsonReq` (which attaches a fresh Idempotency-Key) and `{ params: Promise.resolve({ workspaceId }) }` — Next 16 params are a Promise.

```ts
it("creates an item and returns it tagged PROJECT_DOCUMENTATION", async () => {
  const res = await createProjectRequirement(WS, {
    projectId: PROJECT, itemTextUk: "Приховані роботи з гідроізоляції санвузла",
    sourceDocument: "Приклад-РД-2026-014", sourceSheet: "12", sourceDrawingNo: "АР-07",
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.verification).toBe("PROJECT_DOCUMENTATION");
  expect(body.status).toBe("active");
});

it("refuses a project of another workspace without disclosing it exists", async () => {
  const res = await createProjectRequirement(WS, { ...valid, projectId: OTHER_WS_PROJECT });
  expect(res.status).toBe(422);
});

it("refuses a plain member, who holds no project_requirements.manage", async () => {
  asUser(MEMBER);
  expect((await createProjectRequirement(WS, valid)).status).toBe(403);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @goproceed/app test -- project-requirements`
Expected: FAIL — the route module does not exist.

- [ ] **Step 3: Write the route**

```ts
export const POST = commandRoute(createProjectRequirementRequest, async (a) => {
  const workspaceId = a.params.workspaceId;
  if (!workspaceId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Робочий простір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }

  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) =>
    withIdempotency<ProjectSourcedRequirementItemResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "project_requirements.create", key: a.idempotencyKey,
      requestHash: a.requestHash,
      // Default retention class. Authoring a requirement carves no money.
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      requireWorkspaceCapability(a.requestId, m.role, "project_requirements.manage");

      // RLS-scoped: a project in another workspace is indistinguishable from an
      // absent one, so the refusal is never an oracle for another tenant.
      const proj = await tx.query(
        `select id from public.projects where workspace_id = $1 and id = $2`,
        [workspaceId, a.body.projectId]);
      if (proj.rows.length === 0) {
        throw validationFailed(a.requestId,
          "Проєкт не знайдено в цьому робочому просторі.",
          [{ path: "projectId", message: "unknown project in this workspace" }]);
      }

      const inserted = await tx.query(
        `insert into public.project_sourced_requirement_items
           (workspace_id, project_id, item_text_uk, source_document, source_sheet,
            source_drawing_no, source_revision, verification, created_by_member_id)
         values ($1,$2,$3,$4,$5,$6,$7,'PROJECT_DOCUMENTATION',$8)
         returning *`,
        [workspaceId, a.body.projectId, a.body.itemTextUk, a.body.sourceDocument,
         a.body.sourceSheet, a.body.sourceDrawingNo, a.body.sourceRevision ?? null,
         m.memberId]);

      await recordAudit(tx, { /* organizationId passed explicitly, as the retire route does */ });
      return { status: 201, body: itemView(inserted.rows[0]) };
    }));

  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
```

Write `itemView(row)` in the same file as the hand-written mapper, mirroring `ruleVersionView`'s style.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @goproceed/app test -- project-requirements`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/v1/workspaces apps/app/tests/project-requirements.int.test.ts && git commit -m "feat(api): project_requirements.create"
```

---

### Task 12: `project_requirements.archive`

**Files:**
- Create: `apps/app/app/v1/project-requirements/[itemId]/archive/route.ts`
- Modify: `apps/app/tests/project-requirements.int.test.ts`

**Interfaces:**
- Consumes: `archiveProjectRequirementRequest` (Task 9), `app.archive_project_sourced_requirement_item` (Task 5).
- Produces: `POST` returning `ArchiveProjectRequirementResponse`.

The retire route is the template, and it resolves the workspace from the path id by an RLS-scoped SELECT inside the transaction but **outside** the idempotency scope, because the idempotency scope needs the workspace it has not resolved yet. **Do not assume a refusal-coverage precedent to imitate:** the retire route has no test file of its own, and no suite asserts its 404, 403 or scope refusals. Write them here.

- [ ] **Step 1: Write the failing tests**

```ts
it("archives an item and is idempotent on replay by state", async () => {
  expect((await archiveProjectRequirement(item)).status).toBe(200);
  expect((await archiveProjectRequirement(item)).status).toBe(200);
});

it("refuses an unknown or foreign item with 404 and no oracle", async () => {
  expect((await archiveProjectRequirement(randomUUID())).status).toBe(404);
  expect((await archiveProjectRequirement(otherWorkspaceItem)).status).toBe(404);
});

it("refuses a plain member with 403", async () => {
  asUser(MEMBER);
  expect((await archiveProjectRequirement(item)).status).toBe(403);
});

it("leaves the text and the citation untouched", async () => {
  const before = await readItem(item);
  await archiveProjectRequirement(item);
  const after = await readItem(item);
  expect(after.itemTextUk).toBe(before.itemTextUk);
  expect(after.sourceDrawingNo).toBe(before.sourceDrawingNo);
  expect(after.status).toBe("archived");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @goproceed/app test -- project-requirements`
Expected: FAIL — the archive route module does not exist.

- [ ] **Step 3: Write the route**

Resolve the workspace first, then authorize inside the idempotency callback, then call the definer function — the application role holds no UPDATE grant, so this cannot be a route UPDATE:

```ts
      await tx.query(
        `select app.archive_project_sourced_requirement_item($1, $2)`,
        [workspaceId, itemId]);
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @goproceed/app test -- project-requirements`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/v1/project-requirements apps/app/tests/project-requirements.int.test.ts && git commit -m "feat(api): project_requirements.archive"
```

---

### Task 13: `project_requirements.list`

**Files:**
- Modify: `apps/app/app/v1/workspaces/[workspaceId]/project-requirements/route.ts` (add `GET`)
- Modify: `apps/app/tests/project-requirements.int.test.ts`

**Interfaces:**
- Consumes: `projectRequirementListResponse` (Task 9).
- Produces: `GET` returning `{ items: [...] }`.

`queryRoute(handler)` takes **no** schema and has no body, key or hash. Copy `requirement_library.list`: no pagination, no filter, and the response parsed on the way out with `projectRequirementListResponse.parse(...)` because it carries regulatory strings.

- [ ] **Step 1: Write the failing tests**

```ts
it("returns the workspace's project-sourced items and never a Додаток Н row", async () => {
  const body = await (await listProjectRequirements(WS)).json();
  expect(body.items.every((i) => i.verification === "PROJECT_DOCUMENTATION")).toBe(true);
});

it("is not the library: requirement_library.list returns no project-sourced row", async () => {
  const lib = await (await listRequirementLibrary(WS)).json();
  expect(lib.items.every((i) => i.verification !== "PROJECT_DOCUMENTATION")).toBe(true);
});

it("shows archived items with their status rather than hiding them", async () => {
  await archiveProjectRequirement(item);
  const body = await (await listProjectRequirements(WS)).json();
  expect(body.items.find((i) => i.itemId === item).status).toBe("archived");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @goproceed/app test -- project-requirements`
Expected: FAIL — no `GET` export.

- [ ] **Step 3: Write the GET handler**

Order by `created_at, id` so the list is stable, and map with the same `itemView` Task 11 wrote.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @goproceed/app test -- project-requirements`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/v1/workspaces apps/app/tests/project-requirements.int.test.ts && git commit -m "feat(api): project_requirements.list"
```

---

### Task 14: The publish route's second source arm

**Files:**
- Modify: `apps/app/src/lib/requirement-content.ts`
- Modify: `apps/app/app/v1/workspaces/[workspaceId]/requirement-rule-versions/route.ts`
- Modify: `apps/app/tests/project-requirements.int.test.ts`

**Interfaces:**
- Consumes: the relaxed publish request (Task 10), the table (Task 4), the widened CHECKs (Task 6).
- Produces: a published `requirement_rule_versions` row carrying `norm_ref_verification = 'PROJECT_DOCUMENTATION'` and `project_sourced_requirement_item_id`.

`citationOf(sourceStandard, positionCode)` in `apps/app/src/lib/requirement-content.ts` is the sibling this composer belongs beside. **The composed citation must land in `norm_ref_source`, not only `norm_ref`:** `requirement_rule_versions_norm_ref_sourced_check` requires a non-blank source whenever `norm_ref` is present.

**The project name is deliberately not in the citation.** A name is mutable and the citation is frozen into a hash; the structured fields identify the document, and `project_id` carries the project mark.

**Both provenance keys go into the frozen JSON unconditionally**, one of them null. Two code paths building two JSON shapes is how key-order drift starts, and nothing pins a literal `rule_version_hash`: the only hash assertion in the suite is relative (`rule_version_hash` unchanged across retirement).

- [ ] **Step 1: Write the failing test**

```ts
it("publishes a rule version from a project-sourced item", async () => {
  const res = await publishRuleVersion(WS, { ...validRule,
    requirementLibraryItemId: undefined, projectSourcedRequirementItemId: item });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.normRefVerification).toBe("PROJECT_DOCUMENTATION");
  expect(body.normRefSource).toContain("Приклад-РД-2026-014");
  expect(body.normRefSource).toContain("арк. 12");
  expect(body.normRefSource).toContain("кресл. АР-07");
  expect(body.normRef).not.toContain("Додаток Н");
});

it("refuses publishing from an archived item", async () => {
  await archiveProjectRequirement(item);
  const res = await publishRuleVersion(WS, { ...validRule,
    requirementLibraryItemId: undefined, projectSourcedRequirementItemId: item });
  expect(res.status).toBe(422);
});

it("copies the item text as the default acceptance criterion", async () => {
  const body = await (await publishRuleVersion(WS, { ...validRule,
    acceptanceCriterion: undefined,
    requirementLibraryItemId: undefined, projectSourcedRequirementItemId: item })).json();
  expect(body.acceptanceCriterion).toBe("Приховані роботи з гідроізоляції санвузла");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @goproceed/app test -- project-requirements`
Expected: FAIL — the route still reads only `requirement_library_items` and refuses a body with no library id.

- [ ] **Step 3: Write the composer**

```ts
/**
 * The citation of a requirement a workspace took from its own робоча
 * документація. Allow-list item 8 is the only thing asserted about WHY it
 * binds: «the binding list for a given site comes from робоча документація
 * (п. 8.4.3.3)». Nothing here attributes the TEXT to a ДБН.
 */
export function projectSourceNormRef(): string {
  return "Робоча документація об'єкта (п. 8.4.3.3 ДБН А.3.1-5:2016)";
}

export function projectSourceCitationOf(
  document: string, sheet: string, drawingNo: string, revision: string | null,
): string {
  const base = `${document}, арк. ${sheet}, кресл. ${drawingNo}`;
  return revision === null ? base : `${base}, ревізія ${revision}`;
}
```

- [ ] **Step 4: Branch the route's source read**

Replace the unconditional library read with a branch on which id the body carries. Keep the RLS-scoped read and the non-oracle refusal shape. Rewrite the superseded refusal copy — ADR-010 supersedes «У v0.1 правило спирається лише на постачений перелік Додатка Н» — and refuse an archived item by name.

Then build the frozen content with both keys always present:

```ts
        normRef,
        normRefVerification,
        normRefSource,
        requirementLibraryItemId: libraryItemId,          // null on the project arm
        projectSourcedRequirementItemId: projectItemId,   // null on the library arm
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @goproceed/app test`
Expected: PASS, including the pre-existing rule-version suites.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/lib/requirement-content.ts apps/app/app/v1/workspaces apps/app/tests && git commit -m "feat(api): publish a rule version from a site's own documentation"
```

---

### Task 15: The end-to-end proof

**Files:**
- Create: `apps/app/tests/project-sourced-chain.int.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing; it is the evidence the slice works.

`boundOccurrence()` in `apps/app/tests/field-capture.int.test.ts` is the fixture that already drives the whole chain — reuse its order rather than reinventing it. **The order is load-bearing:** `requireBindableWorkType` refuses a work item whose `workTypeKey` names no rule version already published in the workspace, so rules are published **before** classified lines and a typed line added first returns 422.

- [ ] **Step 1: Write the test**

```ts
it("carries a site's own requirement all the way to the external reviewer", async () => {
  // author → publish a rule version from it → bind → publish baseline →
  // create assignment → the occurrence exists and carries the project tag
  const item = await createItem();
  const rv = await publishRuleVersion(WS, { ...rule, projectSourcedRequirementItemId: item });
  const occ = await boundOccurrenceFrom(rv);
  expect(occ.normRefVerification).toBe("PROJECT_DOCUMENTATION");

  // and the no-account reviewer can read it — the response is zod-parsed on the
  // way out, so a two-value externalNormRef would throw here rather than 200.
  const grant = await issueOccurrenceGrant(occ.id);
  const res = await externalOccurrenceScope(grant.token);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.requirement.normRef.verification).toBe("PROJECT_DOCUMENTATION");
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @goproceed/app test -- project-sourced-chain`
Expected: PASS. A failure at the external step means Task 7 missed `externalNormRef`.

- [ ] **Step 3: Commit**

```bash
git add apps/app/tests/project-sourced-chain.int.test.ts && git commit -m "test: a site's own requirement reaches the no-account reviewer"
```

---

### Task 16: The residual list and the gate

**Files:**
- Modify: `TODOS.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Record what this slice deliberately left**

Add one dated entry naming: the dashboard screen and the four things it would need (an ADR-009 amendment, a `04-role-pain-map.md` row, a browser command call, the `02-building-ui.md` procedure and gate); the fact that `apps/mobile` duplicates the verification vocabulary by design and both copies were changed; and that `TODOS.md`'s own «the unapplied chain is `0041`–`0051`, eleven files» is stale as of this slice — the chain now runs to `0059`. Give the date and the command that shows it (`ls supabase/migrations | tail -1`).

- [ ] **Step 2: Run the gate yourself, and paste the output**

Do not accept numbers from a report. Run each, in order, from the repo root:

```bash
pnpm install
```

```bash
supabase db reset
```

```bash
pnpm validate:canonical-docs
```

```bash
pnpm turbo run typecheck
```

```bash
pnpm turbo run test --concurrency=1
```

The concurrency limit is load-bearing: `@goproceed/database`, `@goproceed/testing` and `apps/app` share one local Postgres.

- [ ] **Step 3: Commit**

```bash
git add TODOS.md && git commit -m "docs(todos): what the project-sourced slice left, and the migration chain's real end"
```

---

## Self-Review

**Spec coverage.** §2.1 → Task 1. §2.2 → Task 2. §2.3 → Tasks 3, 8, 9. §3 → Tasks 2, 7. §4.1 → Tasks 4, 5. §4.2 → Task 6. §4.3 (nothing changes in the library) → asserted by Task 13's second test and by the untouched fidelity suite. §5 → Tasks 11–13. §6 → Tasks 10, 14. §7 (no screen) → no task, deliberately; recorded in Task 16. §8 → Tasks 4–7 and 15. §9 → Task 16.

**Three spec statements this plan corrects, each from a read symbol.** The spec said the frozen-content guard might enumerate columns — `app.guard_requirement_rule_version()` compares whole rows, so no edit is needed. The spec said the archive is an UPDATE through the command path — the application role holds no UPDATE grant and the established path is a SECURITY DEFINER function. The spec said one verification CHECK widens — two do, because `materialiseOccurrences` copies the tag into `requirement_occurrences`, and a third and fourth deliberately do not.

**Type consistency.** `itemView` is defined in Task 11 and reused in Task 13. `projectSourcedRequirementItemId` is spelled identically in Tasks 6, 10 and 14. `project_requirements.manage` matches between Task 3's CSV row and Task 8's union member. The label string «за робочою документацією об'єкта» is identical in Tasks 2 and 7.
