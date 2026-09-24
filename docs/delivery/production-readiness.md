# M0 — fit to hold someone else's data

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-08-08

**Related decisions:** [ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md),
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](../decisions/ADR-007-pilot-field-client.md),
[ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md)

> **Version note (2026-08-08) — two decisions taken after this document was
> last reviewed. Both change what v0.1 means, and both are recorded in every
> document that states v0.1 scope.**
>
> 1. **The valuation carve happens at admission, not at recording.**
>    [ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md) (Approved,
>    2026-08-07) moves it out of `progress.record` and into the **stage closure**,
>    which is v0.1's admission event. Performed quantity is recorded **unvalued**;
>    only admitted quantity competes for the work item's pool; admission is a
>    deliberate authorised act and not a side effect of measurement (INV-089, P0).
>    Until 2026-08-08 this ADR was named in no document but the glossary.
>    **What is built is not yet what it decided:** `progress.adjust` still carves
>    at measurement time whenever the root already holds an allocation — no
>    closure, `admitted_by_closure_id` NULL — and that is an open P0, not a
>    nuance.
> 2. **The work type's carrier is a column on the work line, and it needed no
>    ADR.** Settled by the owner on 2026-08-08. Migration `0050` adds
>    `public.work_items.work_type_key`, so the requirement-rule predicate's first
>    argument has a left-hand side at last and a **hand-typed** baseline
>    materialises obligations. Two things it did not settle: the **owning
>    entity** — a table that defines the set of work types — still needs an ADR
>    ([glossary.md](../domain/glossary.md) «Work type»), so a work type is validated as *a real one* and not as *the
>    right one*; and an **imported** baseline carries no work type at all, which
>    is permanent for the life of that contract version.
>
> **Neither decision is deployed, and neither is anything else.** Migrations
> `0041`–`0050` are ten files written on an uncommitted branch and **none has
> been applied anywhere**. Against applied history (`0001`–`0040`) the runtime is
> **33 tables**, of which **9** are among the 26 that ADR-006 decision 4 builds
> in v0.1. Nothing in this package may be described as green, verified, or
> confirmed working.


## What this document gates

One question, and only this one: **is GoProceed fit to hold a real person's
data?** Not whether the acceptance loop is finished, not whether the gate
refuses, not whether an act renders. Those are milestone outcomes and they close
elsewhere ([version-0.1.md](version-0.1.md),
[test-strategy.md](test-strategy.md)). This document closes when the obligations
that attach to somebody else's photographs, contacts, prices and site addresses
are met.

[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 7 makes that list
a milestone, and **both documents that carry it have been rewritten against the
re-cut**. It reaches this document as twelve bullets in
[scope-and-boundaries.md](../product/scope-and-boundaries.md)
§"M0 — Fit to hold someone else's data" and as the exit-gate list of
[roadmap.md](../product/roadmap.md) §"v0.1-M0" — each of which now names the
milestone and the owner. A list with no milestone is a list that gets done last,
which on a one-person project means never, while a pilot with real personal data
on a real site waits on it; that is the failure M0 exists to stop, not a
description of the current lists.

**The count is twelve, and twelve is eight plus four** — the eight cross-cutting
items of `scope-and-boundaries.md` §"M0", then the four carried by
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) and
[hidden-works-content-rules.md](../product/hidden-works-content-rules.md).
ADR-006 decision 7 fixes it: "A document that says 'twelve **plus** four', or
that reaches sixteen, or that counts a merged pair as one gate, is contradicting
this decision."

**Corrected 2026-08-06.** This document previously said thirteen in five places
and attributed a thirteenth gate to `roadmap.md` and to
[version-0.1.md](version-0.1.md). Neither carries one: `roadmap.md` §"v0.1-M0"
states "**not a thirteenth gate** (ADR-006 decision 7)" in bold, and
`version-0.1.md` heads its list "Exit gates — twelve, and twelve is eight plus
four" and repeats the same denial. The retrieval record for the primary ДБН file
— exact URL, retrieval date and SHA-256 of the bytes, committed under
[`technical/requirements/`](../../technical/requirements/) — is **not** a
thirteenth gate. It is the evidence that closes **item 9** ("no normative string
renderable without its `verification` tag and its source") for every
`VERIFIED_PRIMARY` row v0.1 ships, and `hidden-works-content-rules.md` — which
is Approved and restricts at every precedence level, including over ADRs — says
so in its own Open items: "This is not a thirteenth M0 gate … M0 has twelve exit
gates and this closes one of them." This document carries the record as evidence
under gate 10 and counts no gate for it.

Three rules come with the number, and they are binding:

- it is **M0, not M5.5**. It may be built in parallel with M1–M5; it is not
  allowed to be last;
- **M6 cannot open until M0 is closed**, and closure means recorded evidence per
  item, not a checklist someone has read;
- **its owner is the owner.** There is one person, so naming anyone else would
  be fiction. What M0 adds is that the absence of an owner can no longer be the
  reason the list is not done.

### What M0 does not gate

A gate here that named a package artifact, a package version, a claim segment,
an allocation ledger row or a КЕП record would be gating v0.2, because
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5 moves every one
of those out of v0.1. The **decision batch** left this list on 2026-08-06: it
entered v0.1-M5 by owner decision (ADR-006 decision 4, amendment note), so a
gate may name it — and gate 1 does, because the batch is what carries the
confirmation-text version in v0.1. The obligation arrives with the object: when
packages ship, the retention schedule of gate 2 gains their rows, the export of
gate 3 gains their artifacts, and the confirmation-text pin of gate 1 gains their
approval requirements. Reserving the rows now would produce a gate nobody can
close and evidence nobody can record.

## Hard rule

**No real pilot data enters GoProceed until every gate below is approved and
evidenced.** Durations that are not fixed by the architecture — the 24-hour
orphan purge and the 30-minute / 12-hour session TTLs — must come from the
approved retention schedule, not from implementation defaults.

One duration leaves that sentence for v0.1. The seven-day warned quarantine of
[files-and-storage.md](../architecture/files-and-storage.md) rests on a
Keychain/Keystore-bound wrapping key, and
[ADR-007](../decisions/ADR-007-pilot-field-client.md) makes the v0.1 field client
a browser page, which has no equivalent. Quarantine is a native-client state;
v0.1 holds no quarantined original, so there is no such retention period to
approve. It returns with the native client in v0.3.

## Nothing below is closed

**Approved is not deployed.** The runtime is 33 tables defined by 40 migrations
through `0040`; `0036`–`0040` change grants, policies, scheduling and
constraints only and create no table. None of the readiness gate exists, no
statutory act renders, and no external link is issued. **No gate below is
recorded closed by this document, and no gate closes by being written.** This
document makes no test-count, green-baseline, or delivery claim.

*(Qualified 2026-08-08 — «deployed» and «written» have come apart, and every sentence above
is about the first. All of it is still exactly true of the **applied** migrations, `0001`–`0040`,
which define 33 tables. Migrations `0041`–`0050` are ten files written on an uncommitted branch and
**applied nowhere**; between them they carry `create table` for **seventeen of the twenty-six** v0.1
tables, plus every CHECK, trigger, policy and grant the readiness gate is made of. Having DDL is not
existing, and none of the ten files has ever been executed.)*

**«No statutory act renders» is true for a second and independent reason**, and
it would stay true if every one of the ten migrations were applied tomorrow:
`statutory_acts.render` and `statutory_act_versions.freeze` **refuse by design**,
on two blockers derived from artifacts this repository does not hold — the
enumerated В.1/В.2 field list of Додаток В, and the ДБН retrieval record M0 gate
10 owes. Neither is code. *[Annotated 2026-09-14 (DEV-009): both blockers have
since been lifted — `DODATOK_V_TEMPLATE` and `DBN_RETRIEVAL_RECORD` are set in
`apps/app/src/lib/statutory-act-form.ts`, and its test «both blockers are closed,
and the act renders» asserts it; the retrieval record and the file are committed
under `technical/requirements/`.]*

## The gates

Fourteen gates carry the twelve M0 exit gates — items 1–8 the cross-cutting
items of [scope-and-boundaries.md](../product/scope-and-boundaries.md)
§"M0 — Fit to hold someone else's data", items 9–12 the four carried by
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) and
[hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
(ADR-006 decision 7). The mapping is stated so that a reader can check coverage
rather than trust it, and the M0 item numbers are printed so that all twelve can
be counted here rather than taken on trust:

| M0 exit gate | Gate |
|---|---|
| 1. Privacy notice and versioned external confirmation text | 1 |
| 2. Documented retention periods and manual closure/deletion procedure | 2, 4 |
| 3. Workspace export | 3 |
| 4. Restricted audit and security telemetry | 2 |
| 5. Backup and restore verification | 5 |
| 6. Documented external-link assurance limits | 8 |
| 9. No normative string renderable without its verification tag and source — the ДБН retrieval record is the evidence that closes this item, not a thirteenth gate | 10 |
| 10. Recorded date of last verification against the Реєстр будівельних норм | 10 |
| 11. Tenant-isolation tests for every module | 11 |
| 12. Malware/content-type and resource-exhaustion controls for uploads/imports, including the frozen importer's safety limits and export neutralization against spreadsheet formula injection | 12 |
| 7. Secrets and environment separation | 14 |
| 8. Monitored job and message failure paths | 6 |

Gates 7, 9 and 13 carry no row in that table. Gate 7 (incident path) and gate 13
(demo and data separation) predate the re-cut and are kept unchanged; gate 9 is
new and its reason is stated where it stands. All three are still required
evidence under the one-dated-entry-per-gate rule below — the table maps M0's
twelve obligations onto this document's fourteen gates, and a gate with no M0
row is a gate this document owes on its own account.

### 1. Privacy notice and confirmation text

- [ ] Published privacy notice covering evidence content, EXIF/GPS policy,
      contacts, filenames, and security telemetry.
- [ ] The EXIF/GPS paragraph describes what v0.1 actually does. Under
      [ADR-007](../decisions/ADR-007-pilot-field-client.md) Cost 1 a browser may
      strip or re-encode image metadata before the page receives the bytes, so
      the notice may promise neither retention nor removal of metadata it does
      not control, in either direction.
- [ ] Versioned external confirmation text, with the version **pinned on every
      external evidence decision** recorded through a personal link. The column
      that carries it in v0.1 is
      `external_decision_batches.confirmation_text_version`
      ([schema-v0.1.sql](../../technical/database/schema-v0.1.sql)) —
      `requirement_evidence_decisions` has no such column — which is one of the
      reasons the batch entered v0.1-M5 on 2026-08-06. Package approval
      requirements pin the same text from v0.2, when packages introduce them.

### 2. Retention schedule and telemetry bounds

- [ ] A versioned retention schedule for originals, derivatives, imports,
      statutory act versions, scan-blocked content, staging data, audit-safe
      deletion metadata, and backups.
      - **Evidence, 2026-09-03:** the schedule has a mechanism —
        `app.retention_policy` (0081 §1) and `app.apply_communication_retention`
        (0081 §5, pg_cron `communication-retention`) — for the telegram and
        communication tables of the retention catalog
        (`technical/data-retention-catalog.csv`), confined per data class by a
        scope argument on the internal erasure function (`communication` or
        `identity`; the request path uses `all`). Every duration is NULL; the
        schedule itself is still owed.
- [ ] Security and audit telemetry: access, purpose, and retention bounds
      declared and restricted.

Package artifacts and local quarantine are absent from that list on purpose —
the first is v0.2, the second is a native-client state under
[ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 6. Each gains its
row in the schedule in the version that ships it.

### 3. Export

- [ ] Workspace export reproduces authorized originals and generated artifacts
      with a manifest, hashes, provenance, and named omissions. In v0.1 the
      generated artifact is the statutory act version; package artifacts join in
      v0.2.
- [ ] The export reproduces **manually entered work lines** with the same
      provenance as imported ones. Manual entry is a first-class v0.1 capability
      ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 2), and an
      export that can reproduce an imported baseline but not a typed one exports
      half the pilot.

### 4. Manual deletion

- [ ] Manual workspace closure/deletion procedure with authorization,
      separation of duties where applicable, dry-run inventory, export offer,
      confirmation, and recorded outcome.
      - **Evidence, 2026-09-03:** the identity-level half exists and was
        exercised on synthetic data — `app.erase_telegram_identity` (0081 §4),
        which requires the session to have declared the workspace (checked
        against `app.service_workspace()`, raising otherwise) and a 64-hex
        HMAC, both of which the operator script supplies — procedure in
        [README-staging.md](../../infra/README-staging.md) §7, exercise
        `packages/testing/src/telegram-erasure.test.ts` §4, CI run
        [`33696166331`](https://github.com/akisly/go-proceed/actions/runs/33696166331)
        (commit `60959f8`): `verify` red with exactly the eighteen
        pre-existing `apps/app` failures the branch already carried at its
        baseline ([run `33685727480`](https://github.com/akisly/go-proceed/actions/runs/33685727480)
        on `4846e85`, PR #62), none of them this slice's;
        `telegram-erasure.test.ts` (27) and `erase-identity-cli.test.ts` (5)
        both ran and passed in the run; `app-qa` green. See the gate record,
        [2026-09-03-telegram-identity-erasure-gate.md](../superpowers/plans/evidence/2026-09-03-telegram-identity-erasure-gate.md).
        Workspace closure is still owed.
- [ ] Deletion followed by restore does not resurrect deleted content
      (tombstones reapplied before restored data is reachable).

### 5. Backup and restore

- [ ] Encrypted backup policy with access separation, retention, and deletion
      behavior; backup expiration and deletion latency disclosed.
- [ ] One successful restore exercise verifying relational rows, object bytes,
      hashes, tenant boundaries, and the v0.1 evidence links — evidence to
      requirement occurrence, and act version to the stage closure that pins it
      ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4.5) —
      performed in an isolated environment first.

### 6. Monitoring

- [ ] The observability metrics/alerts from
      [jobs-events-and-audit.md](../architecture/jobs-events-and-audit.md)
      (outbox age, job/retry/dead-letter, lease/fence, artifact hash mismatch,
      projection lag, orphan purge, provider errors) are live and owned. In v0.1
      the artifact whose hash may mismatch is a frozen act version.

### 7. Incident path

- [ ] Security signal routing (revocation, suspicious exchange, repeated CSRF
      failure, cross-tenant denial, privileged-function denial) with a named
      responder.
- [ ] Leaked-credential playbook: revoke, rotate, scrub history, audit
      exposure window, check for abuse.

### 8. Link-assurance copy

- [ ] The external review surface and exports state that `bearer_email_link`
      proves possession of the link, not verified identity or a qualified
      signature; reviewer name/company/title are labeled self-declared; IP is
      telemetry, not identity proof.
- [ ] Every rendered decision or signatory block prints its **assurance level**,
      and a level-3 record prints the negative statement immediately after it.
      No record below level 4 of the ladder in
      [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
      renders the word «підпис» or «підписано» (prohibition S), and no level-3
      record is described, labelled, exported or demonstrated as an electronic
      signature.
- [ ] Neither article of Закон № 2155-VIII is printed anywhere in a
      customer-facing artifact. Both ст. 17 ч. 7 and ст. 18 are carried
      `UNVERIFIED` — the law's primary text was never fetched — so v0.1 prints
      only the negative statement, which asserts nothing and needs no source.

### 9. Capture-assurance copy

New with [ADR-007](../decisions/ADR-007-pilot-field-client.md) and here for the
same reason gate 8 is: a real photograph of a real site is about to enter, and
what the product says about it has to be true **before** it does. The field
client is a browser page, so the provenance claims the market analysis planned
are withdrawn from v0.1 (ADR-007 decision 5 and Cost 1), and the withdrawal has
to be enforced somewhere a UI cannot quietly reverse.

- [ ] No screen, render, export, manifest, demo or sales sentence claims
      camera-only capture for a blocking requirement, a camera-versus-gallery
      distinction, tamper-evident provenance, or verified capture-time GPS.
- [ ] What is claimed is the whole of what may be claimed: a client-computed
      content hash verified at finalization against the bytes the server
      received; a server receipt time; and a device-claimed capture time stored
      beside it and **explicitly labelled untrusted**.
- [ ] The client tells the user plainly when GoProceed has **not** saved a
      photo. A pending original is not durable in v0.1 and no screen may report
      a photo as recorded before the `available` receipt is persisted. Silent
      loss is the one outcome ADR-007 decision 6 forbids, and this gate is where
      it is checked before a real photograph depends on it.
      *[2026-09-23, DEV-042 — [ADR-013](../decisions/ADR-013-native-field-client.md) (owner, 2026-09-22) changes «a pending
      original is not durable in v0.1»: the native field client keeps durable
      encrypted pending captures in its internal beta. No success before the
      receipt, and no silent loss, still bind. Device evidence is NOT RUN
      ([DEV-042](../tasks/DEV-042-mobile-native.md)); this item stays unticked.]*

Re-asserting any withdrawn claim requires an ADR, not a UI change (ADR-007
replacement rule 1).

### 10. Regulatory content

Added 2026-08-06 with [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md);
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 7 folds both into
M0 rather than leaving them to a milestone.

- [ ] **No normative string is renderable without its `verification` tag and
      its source.** The tag and source live in the data, not in a template, so a
      string with no source is unrenderable rather than merely undecorated
      ([hidden-works-content-rules.md](../product/hidden-works-content-rules.md),
      Architectural requirement; INV-073).
- [ ] **A recorded date of last verification against the Реєстр будівельних
      норм is stored and printed in the disclaimer on every generated act.**
      Without this gate a printed act can carry content verified against a
      superseded edition and say nothing about when it was last checked.
- [ ] **The retrieval record for the primary ДБН file is committed under
      [`technical/requirements/`](../../technical/requirements/)** — exact URL,
      retrieval date, and SHA-256 of the bytes. Every `VERIFIED_PRIMARY` row the
      v0.1 library ships rests today on one download no reviewer can reopen,
      which is the open item
      [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
      records against all twelve of them. A re-fetch that does not reproduce the
      same bytes downgrades every row it touches to `VERIFIED_SECONDARY`. It is
      **not a thirteenth M0 exit gate** — `roadmap.md` §"v0.1-M0",
      `hidden-works-content-rules.md` Open items and ADR-006 decision 7 all say
      so — it is the evidence that closes **M0 item 9** for every
      `VERIFIED_PRIMARY` row v0.1 ships, which is why it stands inside this gate
      rather than beside it.
      - **Evidence, 2026-09-14:** the dated gate 10 entry in
        [version-0.1.md](version-0.1.md) §M0 «Gate evidence entries»
        ([DEV-009](../tasks/DEV-009-m0-gate10-evidence.md)) covers all three
        bullets: the storage and render checks with their CI test run; the
        registry check of 2026-09-14 in
        `technical/requirements/dbn-a31-5-2016.registry-checks.json` with its
        procedure; and `technical/requirements/dbn-a31-5-2016.pdf` with
        `dbn-a31-5-2016.retrieval.json`, bound by a test. «rests today on one
        download no reviewer can reopen» above has been untrue since 2026-08-10.
        The boxes stay unticked: this document records no gate closed.

### 11. Tenant isolation for every module

- [ ] Every module that will hold pilot data has positive and negative policy
      tests per the matrix in
      [tenancy-and-security.md](../architecture/tenancy-and-security.md), and
      they sit in the set that can never be quarantined
      ([version-0.0.md](version-0.0.md) gate 2).
- [ ] Coverage is checked against the module list rather than sampled: an
      exposed tenant relation with no positive and negative test is a gap, not
      an omission. INV-060's default-privilege and RLS coverage check is what
      makes that mechanical.
      - **Evidence toward this gate, 2026-09-16 — not closed**
        ([DEV-013](../tasks/DEV-013-m0-gate11-coverage-checker.md)): the check
        exists. [rls-coverage.csv](../../technical/database/rls-coverage.csv)
        classifies every relation a tenant-facing principal can reach (a direct
        grant, a grant to PUBLIC, ownership, or a policy naming it), one row per
        principal: 21 `covered`, 53 `gap` rows (BL-090 to BL-098, one entry per
        module) and 7 `exempt_no_grant`. `covered` means the v0.1 read minimum
        only; write denial and the rest of the tenancy test list stay review
        (BL-099). `pnpm validate:canonical-docs` checks
        it against the migrations and the cited tests, and
        `packages/testing/src/rls-coverage.test.ts` against the running
        database (all passed on 2026-09-16, local database at `0085`). **The
        gate closes only at zero gaps** (owner, 2026-09-15). The cited tests
        were not run in this task (the owner allowed only the new file), and
        nothing ran in CI.
      - **Evidence toward this gate, 2026-09-17 — not closed**
        ([DEV-014](../tasks/DEV-014-gate11-workspace-communication.md)): the
        29 gap rows of modules `workspace_access` (BL-098) and `communication`
        (BL-090) are `covered` by
        `packages/testing/src/workspace-access-rls.test.ts` and
        `packages/testing/src/communication-rls.test.ts`, each run alone and
        passing against the local database at `0085`. The registry now holds 50
        `covered`, 24 `gap` (BL-091 to BL-097) and 7 `exempt_no_grant` rows.
        BL-096's two service rows wait on BL-100 (the projection policies admit
        every workspace to the service plane). `covered` is the v0.1 read
        minimum, and the evidence run `test-strategy.md` §4 names (the
        unfiltered `pnpm --filter @goproceed/testing test`) is still owed.
        Nothing ran in CI.
      - **Evidence toward this gate, 2026-09-17 — not closed**
        ([DEV-015](../tasks/DEV-015-projection-service-policy.md)): migration
        `0086` confines the two readiness projections' service policies to the
        declared workspace (BL-100), and
        `packages/testing/src/projection-rls.test.ts` covers BL-096's two
        service rows (red at `0085`, green at `0086`, run alone locally). The
        registry holds 52 `covered`, 22 `gap` (BL-091 to BL-095, BL-097) and
        7 `exempt_no_grant` rows. `0086` is applied to the local database only.
        Nothing ran in CI.
      - **Evidence toward this gate, 2026-09-17 — not closed**
        ([DEV-016](../tasks/DEV-016-gate11-remaining-gaps.md)): six new
        `packages/testing/src/*-rls.test.ts` files cover 21 of the 22 remaining
        gap rows (BL-091 to BL-095, BL-097), each file run alone and passing
        against the local database at `0086`. The registry holds 73 `covered`,
        1 `gap` and 7 `exempt_no_grant` rows. The last gap is `capture_events`
        for `goproceed_service` (BL-102): its policy ignores the declared
        workspace, so it needs a migration first. The unfiltered evidence run
        is still owed, and nothing ran in CI.
      - **Evidence toward this gate, 2026-09-18 — not closed**
        ([DEV-017](../tasks/DEV-017-capture-event-service-workspace.md)):
        migration `0087` confines the server capture event to the workspace the
        service transaction declared (BL-102) and the finalize path declares it,
        so the registry reaches **74 `covered`, 0 `gap`, 7 `exempt_no_grant`**.
        The gate is now closable but **not closed**: closing needs the
        unfiltered `pnpm --filter @goproceed/testing test` evidence run that
        `test-strategy.md` §4 names (it resets the local database), a run of
        `rls-coverage.test.ts` at `0087`, a dated entry in `version-0.1.md` §M0
        and the owner's agreement. `0087` is applied to the local database only;
        nothing ran in CI.
      - **CLOSED 2026-09-18** by the dated gate 11 entry in
        [version-0.1.md](version-0.1.md) §M0
        ([DEV-018](../tasks/DEV-018-gate11-closure.md)): the registry holds 74
        `covered`, 0 `gap`, 7 `exempt_no_grant`, and the unfiltered
        `pnpm --filter @goproceed/testing test` passed 786 tests in 55 files with
        none skipped, against a database the run rebuilt from the migrations
        (`0087`). The boxes above stay unticked: this document records no gate
        closed, the entry does (the gate 10 precedent). Read that entry's
        *Limits* before citing this: `covered` is the v0.1 read minimum, the run
        was local, and nothing ran in CI.
      - *[2026-09-24, [DEV-076](../tasks/DEV-076-write-denial-minimum.md):
        a tightening after closure, not a reopening (owner). A covered row whose
        principal holds a write also needs a cross-workspace write denial,
        registered in `technical/database/rls-write-coverage.csv`; the 65 such
        rows are gaps (BL-164 … BL-173), due before real customer data enters
        an environment.]*
- [ ] The evidence is the test run named in
      [test-strategy.md](test-strategy.md) §"4. Tenant isolation, and the tests
      that cannot be quarantined". The same evidence closes both, and it must,
      because a pilot admitted on a sampled coverage claim is admitted on
      nothing.

Adding a module in v0.2 reopens this gate for that module. It does not reopen
the closed ones.

### 12. Upload and import safety

- [ ] Malware, content-type, and resource-exhaustion controls on uploads.
      - **Evidence toward this gate, 2026-09-15 — not closed**
        ([DEV-012](../tasks/DEV-012-m0-gate12-evidence.md)). *Content type:*
        `evidence-inspection.ts` reads the type from magic bytes (JPEG, PNG, PDF,
        HEIC) and blocks `unrecognised_content` and `declared_type_mismatch`;
        *resource exhaustion:* the private `evidence` bucket's 50 MiB
        `file_size_limit` (`0020`), the per-workspace quota (`0026`, unlimited
        until a value is set), the orphan purge (`0021`) and the seven-day
        `scan_blocked` window (`0027`). Exercised on 2026-09-15 against the
        local database: `upload-intents-create` (23), `upload-intents-finalize`
        (19) and `evidence-purge` (17), all passed, none skipped; not in CI. The
        bucket's `file_size_limit` is located in `0020`, but no test that ran
        exercises it.
      - **Malware, the owner's decision of 2026-09-15** (runbook Q-10, answered
        for the pilot): the magic-byte check, the four-type allow-list and the
        limits above are accepted **in place of a malware control**. No file is
        scanned for malware, and `inspection_status = 'passed'` means only that
        the leading bytes match an allowed type. There is no ADR. The risk the
        owner accepted:
        - a file of an allowed type can carry malicious content (a PDF with
          active content, a crafted image), and a polyglot — bytes that begin as
          JPEG, PNG or PDF and continue as HTML, SVG or script — passes, because
          only the leading bytes are read (`evidence-inspection.ts:24-35`);
        - office members open evidence through Supabase Storage signed URLs
          (`evidence-storage.ts` `createSignedReadUrls`, 60 seconds), served
          inline with the content type stored at upload rather than the detected
          one, and without `nosniff` or a sandbox (BL-089). Only the external
          review route serves the detected type with `nosniff` and a sandbox
          CSP, and Chrome's PDF viewer still renders under that CSP;
        - images decode in the viewer's browser as soon as a page shows them
          (BL-088);
        - Telegram evidence comes from group participants, who are less trusted
          than members (the webhook is enabled nowhere yet).

        The controls that do exist: a private bucket, authorization before a URL
        is signed, a 60-second URL lifetime, and `nosniff` with the sandbox CSP on
        the external plane. **It departs from**
        [files-and-storage.md](../architecture/files-and-storage.md) «Content
        validation and malware boundary» («malware/content inspection using a
        pinned scanner/policy version») and from ASVS-FILE-08 in
        [asvs-profile.csv](../../technical/asvs-profile.csv) («Quarantine and
        malware decision precede user/customer download»), whose row stays
        `specified_no_runtime_evidence`; the catalog does not define whether its
        `waiver_policy` `none` forbids a waiver. Both are unchanged. **Revisit
        before** real customer data enters an environment, before the Telegram
        webhook is enabled anywhere, before any client offers PDF evidence (the `/v1` upload API already accepts
        `application/pdf`),
        before a link goes to a real технагляд, and at the pilot's end.
      - **Open under this box:** image dimension, pixel-count and decoding
        limits do not exist (BL-088); member-plane reads are served inline with
        the stored content type (BL-089).
      - **2026-09-23, [DEV-032](../tasks/DEV-032-evidence-signed-read-download.md):**
        finalization refuses an object whose stored content type is not
        strictly the detected one, so every object finalized from DEV-032 on is
        served as one of the four allowed types; and member-plane signed reads are issued as downloads
        (`Content-Disposition: attachment`), which a URL holder can strip — the
        first control is what makes that harmless. An `<img>` still shows the
        image. Measured on the local stack only; hosted Storage and a bucket
        allow-list are BL-126. The risk bullet above is the owner's acceptance
        of 2026-09-15 and stays as accepted.
      - **2026-09-23, [DEV-033](../tasks/DEV-033-image-size-limits.md):**
        finalization reads an image's declared size from its header, without
        decoding, and refuses one over 268,402,689 pixels or 65,535 px on an
        edge, one whose size cannot be read, and an animated PNG; BL-088 is
        closed. This bounds the declared size, not the decoding cost: a bitmap
        at the limit (about 1 GB decoded) is reachable from a file of tens of
        kilobytes and decodes in every browser that shows it, as does a
        legitimate 200 MP photo (BL-129); channels the parser does not read are
        BL-132; real-phone files are unchecked (BL-131).
- [ ] The import hostile-fixture corpus still runs. Import is **frozen, not
      deleted** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md)
      decision 6): the XLSX/CSV parser built in M1 stays in the code, an object
      created by import continues to work, and the route is still reachable by a
      real user with a real file. Freezing extension work does not un-ship a
      parser, and INV-016 still guards a live path.
      - **Evidence toward this gate, 2026-09-15**
        ([DEV-012](../tasks/DEV-012-m0-gate12-evidence.md)): the corpus runs.
        `packages/domain` `src/import` 48 passed — `xlsx.test.ts` (legacy or
        encrypted CFB, non-ZIP, macro workbook, declared-size ZIP bomb without
        inflating, path traversal, malformed central directory, inert formulas,
        100 seeded mutations failing closed) and `csv.test.ts` (NUL bytes,
        invalid UTF-8, unbalanced quotes, byte, column and row limits, 200 seeded
        mutations) — and `apps/app` `imports.int.test.ts` 13 passed against the
        local database (executable bytes and ZIP bombs refused). Limits as
        coded: XLSX 20 MiB, 10 000 entries, 100 MiB uncompressed, ratio 100,
        20 000 rows, 256 columns, 32 768 characters a cell; CSV 20 MiB, 20 000
        rows, 256 columns, 32 768 characters a field. Not run in CI. **The gate
        stays open:** export neutralization against formula injection has no
        export to act on (gate 3), and BL-088 is open. *(2026-09-23: BL-088
        and BL-089 closed on the DEV-032/DEV-033 branch. Export remains, and so
        do the decoding cost of an at-limit image (BL-129) and the channels the
        size check does not read (BL-132): the gate closes with them fixed or
        owner-accepted.)*

### 13. Demo and data separation

- [ ] No production/customer data in any demo, test, or sample workspace.
- [ ] The v0.2 `/demo` design keeps a server-side demo principal structurally
      denied access to customer workspaces; `?demo=true` can never switch a
      customer session (ADR-004). Until then, no demo surface uses real data.

### 14. Environment and secrets

- [ ] Development seed credentials cannot be applied to
      preview/staging/production (v0.0 gate 4; 2026-07-30 security-gate
      finding on `supabase/seed.sql` + `[db.seed] enabled = true`).
- [ ] Per-environment secret stores with rotation runbooks; HMAC and session
      verifier keys carry key IDs.
      - **Evidence toward this gate, 2026-09-15 — not closed**
        ([DEV-010](../tasks/DEV-010-m0-gate14-evidence.md)): the rotation runbook
        [infra/secret-rotation.md](../../infra/secret-rotation.md); the deploy
        preflight refuses an HMAC key list the runtime registry would refuse. The
        gate stays open because `TELEGRAM_LINK_PEPPER`, an HMAC verifier key, carries
        no key id (owner, 2026-09-15: build one, BL-085), and because one hosted
        environment exists with no separate production project (Q-9).
      - **Evidence toward this gate, 2026-09-15 — not closed**
        ([DEV-011](../tasks/DEV-011-telegram-hmac-key-ids.md), merged in #92): the
        Telegram link and erasure HMAC keys carry key ids (migration `0085`),
        replacing `TELEGRAM_LINK_PEPPER` (BL-085). The gate stays open on Q-9, and
        no rotation has been exercised on a hosted project.

## Evidence format

Each gate closes with a dated evidence entry — a test run, an exercise record,
or an approved document — linked from the M0 record in
[version-0.1.md](version-0.1.md) §"M0 — Fit to hold someone else's data". **That
record exists**, and it requires one dated evidence entry per gate here, all
fourteen, gates 1 through 14. **Closure means recorded evidence per item, not a
checklist someone has read.** Gates stay verified throughout the pilot; a
regression reopens the gate and blocks new pilot data.

## M0 and the pilot record are two different preconditions

M0 gates what the **data** requires. The pilot record of
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 8 gates what the
**evidence** requires: a named partner, an adversarial технагляд, success
measures, a pre-gate baseline for first-time acceptance rate and
days-to-signature, a written-down sample, and stopping conditions in both
directions. **Every field of that record is empty as of 2026-08-06**, and
filling it is discovery work, not delivery work.

M6 opens only when both are complete, and neither substitutes for the other. A
closed M0 with an empty pilot record is a safe system with nothing to learn
from. A filled pilot record with an open M0 is a boundary violation regardless
of which document or schedule requests it
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) replacement rule 5).

**The discovery ledger is the reason this section exists.** It records 21
evidenced sends, zero replies, zero interviews, zero named projects, zero pilot
commitments, zero willingness-to-pay signals, and zero customer documents of any
kind ([validated-assumptions.md](../discovery/validated-assumptions.md)). Every
field of the pilot record is therefore not merely empty but unstarted, and no
gate below or above may be read as evidence that any of it was collected.
