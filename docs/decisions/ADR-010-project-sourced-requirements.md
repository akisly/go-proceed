# ADR-010: Requirements a site supplies from its own робоча документація

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-08-24

**Related decisions:** [ADR-005](ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](ADR-006-pilot-shaped-v0.1.md),
[ADR-009](ADR-009-three-pilot-surfaces.md)

> **Authority.** The owner's decision of 2026-08-24, taken after the seeded
> library's closure was presented as the thing binding every pilot. This ADR
> supersedes one clause of [ADR-006](ADR-006-pilot-shaped-v0.1.md) decision 4.1
> and nothing else, and it takes for itself the dated authorisation
> [ADR-009](ADR-009-three-pilot-surfaces.md)'s amendment required of any later
> slice that adds an operation.

## Context

ДБН А.3.1-5:2016 п. 8.4.3.3 says the binding hidden-works list for a site comes
from **робоча документація**, and that Додаток Н is довідковий. Both statements
are allow-list item 8 of
[hidden-works-content-rules.md](../product/hidden-works-content-rules.md), which
is to say the product is already permitted to say them.

What the product could not do is act on them. The shipped requirement library is
twelve items across Додаток Н positions Н.14 (внутрішні санітарно-технічні
роботи) and Н.15 (монтаж електротехнічних установок), and
`requirement_library_items_dodatok_n_extent_check` in
`0041_requirement_rules_bound_to_the_baseline.sql` makes any other position
unrepresentable rather than merely unwritten. Neither scope CSV carries a create
operation for library content, and the table's own comment says content is a
repository change and never a runtime command.

The consequence is not a missing feature, it is a floor: **on any kind of work
outside those two positions the product can express no requirement at all**,
therefore no occurrence, therefore no gate, therefore no act. That binds every
pilot regardless of which screens exist.

The seeded set was always a starter by design — the standard's own text says the
binding list comes from elsewhere — and this decision is what makes «by design»
true in the software rather than only in the documentation.

## Decision

1. **A workspace may author requirements from its own робоча документація**, in
   a table of their own. The seeded library, its constraints and its lack of a
   write path are untouched, so authoring cannot corrupt the verified set. The
   two are different relations, which is why no row a workspace types can ever
   become a line of Н.15.

2. **The verification vocabulary gains a fourth value,
   `PROJECT_DOCUMENTATION`.** This ADR does not introduce it and could not:
   [hidden-works-content-rules.md](../product/hidden-works-content-rules.md) is
   binding on Ukrainian regulatory content **at every precedence level,
   including over ADRs** ([docs/README.md](../README.md) §"Source of truth"), so
   the value, its meaning and its render rules are added there. This decision
   records that the owner asked for it and why the three existing values do not
   fit: the text is not `VERIFIED_PRIMARY` or `VERIFIED_SECONDARY`, because the
   product never read the document; and it is not `UNVERIFIED`, which «must
   never be shown as normative», because this text is precisely what **is**
   normative for that site, by п. 8.4.3.3.

3. **A source is a typed citation, not an uploaded file.** Document (шифр or
   назва), аркуш and номер креслення are mandatory; ревізія is optional. INV-073
   requires a normative string to travel with its tag **and** its source or not
   at all, and «робоча документація» on its own is a word, not a source. No file
   is uploaded in this decision's scope; the person who must check the citation
   — технагляд — has the documentation on the site.

4. **The item is workspace-scoped and carries a project mark that cannot be
   omitted.** Робоча документація always belongs to an object, so the project is
   `NOT NULL`. Binding an item into another project's baseline is **not**
   forbidden: the citation travels with the text wherever it renders, and a
   contractor who repeats a detail across two objects of the same customer is
   doing something normal.

5. **Three catalogued operations** — `project_requirements.create`,
   `project_requirements.archive`, `project_requirements.list` — governed by one
   new workspace capability, `project_requirements.manage`, held by exactly the
   roles that hold `requirement_rules.manage`. Text and citation are immutable
   once written; a correction is a new item plus an archive of the old one,
   because a published rule version has already copied the content and no edit
   could reach it.

   *[Amended 2026-08-28 — the `list` third of the first sentence.* The slice's
   own build departed from it for the read alone: migration 0059's
   `psri_select` admits **any active member** («the foreman who reads an
   occurrence reads the text behind it», the policy's own words), and the list
   route asks for membership and no capability, recording the departure in its
   header. The permission catalog followed on 2026-08-28 (TODOS 2026-08-27
   residual 6): `project_requirements.list` is a membership-governed read,
   listed with the capability-exempt operations in
   `technical/openapi/README.md` §Conventions. `create` and `archive` stay
   governed by `project_requirements.manage`, held exactly as this decision
   says.]

6. **No dashboard screen.** See «What this decision does not authorise» below.

## Relationship to ADR-006 decision 4.1

ADR-006 decision 4.1 made the shipped library **the only rule source in v0.1**.
This decision adds a second source and **supersedes that clause alone**. Every
other part of decision 4 stands unchanged and is not reopened here: the
hold-only intervention restriction (4.3), the `blocks_stage_closure` allowance
for a version with no packages (4.4), the deferral of location predicates (4.2),
and the act pinned at closure (4.5). INV-082 and INV-085 are untouched — they
are about what an obligation may be, not about where its text came from.

One sentence in running code states the superseded clause to a user: the publish
route refuses an unknown library item with «У v0.1 правило спирається лише на
постачений перелік Додатка Н». That sentence is rewritten by the slice that
implements this ADR, not deleted — the refusal it belongs to is still correct
for a caller who cites a library item that does not exist.

## Relationship to ADR-009

ADR-009's amendment of 2026-08-22 bent the standing «reads go through the
existing `/v1`, and a new operation needs the owner's word» rule for two read
operations, and closed with: «If a later slice needs a third, it needs its own
dated amendment here — this one authorises these two and nothing else.»

**This ADR is that own dated authorisation**, and it is narrow in the same way:

- Three operations, all on the **member plane**, all catalogued in
  [`technical/openapi/scope-v0.1.csv`](../../technical/openapi/scope-v0.1.csv)
  where every other operation is catalogued, all governed by a capability row in
  [`technical/permissions/capabilities.csv`](../../technical/permissions/capabilities.csv),
  and all counted in
  [`docs/delivery/version-0.1.md`](../delivery/version-0.1.md)'s
  operations-per-milestone table. Nothing is added quietly beside the API.
- **The rule itself is not repealed.** A later slice that needs a fourth
  operation needs its own dated decision; this one authorises these three and
  nothing else.
- Unlike D1's amendment, this one **does** carry a migration, a new table, new
  grants and new policies. That is not the rule bending further — the rule
  ADR-009 protects is about the API surface, and a new obligation source is a
  data change by nature.

## What this decision does NOT authorise

- **No dashboard screen.** ADR-009 decision 3 fixes the dashboard pilot at
  «create workspace/project + access grants; create assignment; view photo
  evidence. Not the full register», and
  [docs/design/04-role-pain-map.md](../design/04-role-pain-map.md) requires a
  named role and a named pain sentence before a screen is added — no row covers
  requirement authoring. The parity argument settles it independently:
  `requirement_rule_versions.publish`, the command that turns a requirement into
  an obligation, has no screen either. The whole authoring path is API-only in
  the approved scope and stays that way. A screen is a separate decision and
  would need an amendment here, a role-pain-map row, and the UI procedure in
  [docs/design/02-building-ui.md](../design/02-building-ui.md).
- **No Додаток Н item, no Додаток В field, no clause number.** A project-sourced
  string is never attributed to a ДБН or a ДСТУ and never renders inside a
  Додаток Н block. Prohibitions **A**, **C** and **E** of the content rules are
  untouched, and **E** in particular is not weakened: the citation fields are the
  provenance of a requirement, not slots added to an act blank.
- **No claim that the product verified anything.** `PROJECT_DOCUMENTATION` names
  an origin, not a verification strength. No `UNVERIFIED` row is upgraded by
  this decision, and nothing here bears on the ЗУ № 2155-VIII citations that the
  content rules carry as unverified.
- **No file upload, and no change to evidence storage.**

## Costs, accepted

- **A workspace can now write a normative-looking string.** The mitigation is
  structural rather than editorial: the tag is unforgeable (one storable value),
  the citation is mandatory and non-blank in three fields, the text is immutable
  once written, and the render rules in the content-rules document forbid ДБН
  attribution and Додаток Н adjacency.
- **The verification vocabulary is no longer «two values that both mean
  verified».** Every place that restates the set has to grow, including the
  external plane's contract and the field client's copy. That breadth is the
  argument for a shared constant, and the slice moves the remaining
  restatements onto it where it can.
- **A second provenance column on `requirement_rule_versions`.** A rule version
  rests on exactly one source: **at most one in the database, exactly one on
  the wire.** `requirement_rule_versions_one_provenance_check` reads
  `requirement_library_item_id is null or project_sourced_requirement_item_id
  is null` — it makes citing BOTH unstorable and leaves citing NEITHER
  storable. The exactly-one half is the publish request's `superRefine`
  (`packages/contracts/src/requirement-rules.ts`), which is therefore not a
  friendlier restating of the CHECK but the only place the neither-id case is
  refused at all.
