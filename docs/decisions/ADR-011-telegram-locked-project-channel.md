# ADR-011: Telegram as the locked project channel

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-09-03

**Related decisions:** [ADR-005](ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](ADR-006-pilot-shaped-v0.1.md),
[ADR-007](ADR-007-pilot-field-client.md),
[ADR-009](ADR-009-three-pilot-surfaces.md),
[ADR-010](ADR-010-project-sourced-requirements.md)

> **Authority.** The owner approved the design of 2026-08-28 «in conversation,
> section by section» — that is the spec's own Status line
> ([`2026-08-28-telegram-project-channel-design.md`](../superpowers/specs/2026-08-28-telegram-project-channel-design.md):5),
> and it is the only record of the approval; nothing in the repository
> reproduces the conversation. Its §2 (:37-48) lists eight decisions under that
> approval, and decisions 1–8 below transcribe them verbatim.
>
> **This ADR is Draft, not Approved** — Draft being the package's word for
> «under review and not an implementation authority»
> ([docs/README.md](../README.md):80). It transcribes that approval and
> records three decisions the approval did not reach, which the owner must
> confirm before this Status becomes Approved: **decision 9**, the version
> boundary (the spec says «first messaging-channel release», :7; the delivery
> document says `v0.1-M6` and calls it a compromise,
> [version-0.1.md](../delivery/version-0.1.md):172, :191); **decision 10**,
> what M0 now carries; **decision 11**, what happens to the premise of
> [ADR-007](ADR-007-pilot-field-client.md), which recorded Telegram as the
> thing to beat. Until the owner rules, the eight approved rows are a design
> the owner accepted and nothing here is a boundary the package has adopted: by
> [docs/README.md](../README.md):64-68 the roadmap and scope documents (level 4)
> outrank an ADR (level 5), and neither mentions Telegram. The `Applies to`
> field reads `v0.1` and no more because both candidates in decision 9 lie
> inside v0.1 and this ADR rejects the only reading that would not; which
> milestone is the open question.
>
> *[Amended 2026-09-13 (DEV-004): the paragraph above describes this ADR as it
> stood on 2026-09-02. The owner ruled on decisions 9–11 on 2026-09-03, and the
> ADR moved to Approved on that ruling: see §"Open items — ruled by the owner on
> 2026-09-03" and Contradictions item 12. The paragraph is kept as the record of
> the Draft state. The approval procedure it calls undefined is now written in
> [docs/README.md](../README.md) «ADR lifecycle and approval».]*
>
> **The rule this ADR has to clear, as ADR-007 had to.**
> [`validated-assumptions.md`](../discovery/validated-assumptions.md):40 still
> carries A-8 — «The incumbent GoProceed must displace in the field is a
> Telegram group, not a competing product» — as founder-reported and
> **Unvalidated**, and :66-75 rules that until it leaves that status it «must
> not drive a capture-UX decision, a roadmap change, or a positioning
> sentence». This ADR is a capture-UX decision and a roadmap change. It is
> made on the owner's instruction of 2026-08-28 and on nothing else; A-8 is
> cited only to say where the incumbent is written down, and its status is not
> improved by this document. Decision 11 records what that does to ADR-007's
> own version of this sentence.
>
> **Approved would not mean deployed.** Everything this ADR describes exists on
> one branch and in one CI run; see §"Status against the runtime".

## Context

### What existed on 2026-08-28

- **The field client, and one step in it.**
  [ADR-007](ADR-007-pilot-field-client.md) put the v0.1 field client in a
  browser page and gave it exactly one of the six pilot steps — step 2, «The
  phone»: «show the foreman what must be photographed before covering, in the
  standard's own wording, with a reference image» and «take the photo. One
  interaction» (ADR-007:224-234).
  [ADR-009](ADR-009-three-pilot-surfaces.md) moved that client's codebase to
  `apps/mobile` (Expo-web) and promised that «the pilot is never blocked. At
  every point … a foreman has a working client» (ADR-009:56-59, :145-149).
- **Telegram as the benchmark.** ADR-007 fixed the owner's constraint as
  «capture must take **fewer actions than sending a photo to a Telegram
  group**» (ADR-007:139-140), recorded the Telegram incumbent as A-8,
  Unvalidated (:144-146), and cited the founder report «only to say where the
  Telegram comparison is written down, never as a reason for anything»
  (:60-61).
- **The named pain.** The demand scan of 2026-08-21 — non-normative — wrote:
  «A product that adds fields after the same photo was already sent to
  Telegram creates negative value. A product that takes no more effort than
  sending a photo and removes later calls from ПТВ can be adopted»
  ([research-ua-demand-2026-08-21.md](../discovery/research-ua-demand-2026-08-21.md):66),
  and the hypothesis «If a foreman can capture the required proof in no more
  time than sending a Telegram photo…» (:147).
  [04-role-pain-map.md](../design/04-role-pain-map.md):34-40 quotes the first
  sentence for the foreman and concludes «What the dashboard owes them:
  nothing … Their surface is the field client».
- **The scope test.** ADR-006 protection 1: «Adding a capability to v0.1
  requires an ADR, not a backlog item. "It is already specified", "it is
  already in the DDL", "the catalog already has the row", and "it is only one
  more table" are each explicitly not reasons. The test is decision 1: name
  the step it is necessary for» (ADR-006:684-687; restated at
  [roadmap.md](../product/roadmap.md):134-140 and
  [version-0.1.md](../delivery/version-0.1.md):867-870).
- **No ADR.** `docs/decisions/` holds ADR-001 through ADR-010; none decides
  Telegram. ADR-007 is the only one that names it — as the benchmark to beat
  (ADR-007:139-140) and as the Unvalidated incumbent A-8 (:144-146); see
  decision 11. The implementation plan
  ([`2026-08-28-telegram-project-channel.md`](../superpowers/plans/2026-08-28-telegram-project-channel.md))
  contains no occurrence of «ADR» — unlike the 2026-08-24 spec, whose §2
  opened with the ADR it needed
  ([`2026-08-24-project-sourced-requirements-design.md`](../superpowers/specs/2026-08-24-project-sourced-requirements-design.md):46-57).

### What the branch built — measured on 2026-09-02, at `7817abe`

Branch `claude/d3-0-decision-slice`, 62 commits above merge-base `1a7abbd`
with `origin/main`:

- **Nineteen migrations**, `0061_the_project_chooses_one_channel.sql` through
  `0079_project_field_channel_service_health.sql`, creating fifteen tables
  (§"Relationship to ADR-006 decision 4" lists them by file and line), three
  enums (`supabase/migrations/0061_the_project_chooses_one_channel.sql`:3-6)
  and a `projects.status` column defaulting to `active` (`0061`:8-9).
- **A public, provider-authenticated ingress.**
  `apps/app/app/integrations/telegram/webhook/route.ts`:1-9 is nine lines that
  delegate to `acceptTelegramUpdate`; its comment reads «No member session or
  tenant selector exists here.» The ingress verifies the provider secret
  header in constant time before reading a byte
  (`apps/app/src/lib/telegram/ingress.ts`:12-21, :94), bounds the body to
  1 MiB by declared length and by streamed read (:6, :23-27, :95-98), parses
  fatal-UTF-8 JSON (:100-105), enqueues the update through a SECURITY DEFINER
  function with no tenant declared (:109-119) and answers an empty 200 (:120).
  Its own contract: it «does not resolve tenant scope, download files, or call
  Telegram» (:85-89).
- **A service plane with a subject.** `app.service_workspace()` reads the
  declared workspace
  (`supabase/migrations/0062_the_group_becomes_a_project_conversation.sql`:598-601)
  and ten policies confine `goproceed_service` to it on `USING` and
  `WITH CHECK` (`0062`:669-717); `telegram_inbox_updates` has RLS
  (`0062`:627), no policy and no grant (:621). The declaration is exactly
  that —
  `packages/database/src/tx.ts`:179-199 says it «does not authorize anything»
  and «Nothing in the database enforces that discipline».
- **A job runner** at `apps/app/app/internal/telegram/jobs/route.ts` behind a
  worker bearer secret (:19-23) with bounded batch sizes (:14-17), and an
  outbox consumer for topic `communication.telegram.send`
  (`apps/app/src/lib/telegram/delivery.ts`:124-128). No scheduler calls it
  anywhere in the tree: `apps/app/vercel.json` declares no cron.
- **Evidence by card reply**, through the ordinary upload path: origin
  `origin_not_distinguished` (`apps/app/src/lib/telegram/evidence.ts`:159,
  :193), a 20 MiB provider cap (:12), the content hash computed server-side
  from the downloaded bytes (:183, :197).
- **Attributed decisions by callback**, executing the same member-plane
  `recordEvidenceDecision` the web route uses
  (`apps/app/src/lib/telegram/decisions.ts`:7;
  `apps/app/src/lib/evidence/record-evidence-decision.ts`:14-35 requires an
  active membership, `project.view` and `evidence_decisions.decide`).
- **Ten operations** tagged `v0.1-M6` in
  `technical/openapi/scope-v0.1.csv`:67-76, one of them
  `telegram_webhook.accept` on an auth plane named `provider` (:72); seven P0
  invariants INV-092–INV-098 (`technical/database/invariant-catalog.csv`:3-9);
  twelve retention rows, every one `retain_until_approved_m0_schedule` or
  `retain_hash_and_disposition_only` with `duration_external_gate`
  (`technical/data-retention-catalog.csv`:3-14).
- **CI run 33567446293** on `7817abe`: conclusion `success`, jobs `verify` and
  `app-qa` both successful, created 2026-09-01T22:40:30Z
  (`gh run view 33567446293`, read 2026-09-02). The verify job's eight vitest
  summaries sum to **2224 passed, 125 skipped**; `next build` reports
  «Compiled successfully». What the 125 skipped are is in §"Status against
  the runtime".
- **Not built:** the web screens the spec's §9 requires (:428-455 — no page or
  component under `apps/app/app` or `apps/app/src/components` mentions
  telegram or communication); plan Task 13's
  `apps/app/scripts/configure-telegram-webhook.mjs` and
  `apps/app/qa/telegram-project.mjs` (absent from disk); any Telegram line in
  `.github/workflows/ci.yml`, `infra/README-staging.md`,
  `docs/product/roadmap.md` or `TODOS.md` (grep count 0 in each). The plan
  itself has 110 unchecked boxes and none checked.

## Decision

### Owner-approved on 2026-08-28 — decisions 1–8, verbatim from the spec's §2

Source: [`2026-08-28-telegram-project-channel-design.md`](../superpowers/specs/2026-08-28-telegram-project-channel-design.md):41-48.

1. **A project has exactly one field-communication channel. It is chosen
   before activation and cannot be switched or supplemented after activation
   in this release.**
2. **Telegram is the first and only implemented channel. WhatsApp, Viber, Mini
   Apps, and channel switching are out of scope.**
3. **One closed Telegram group belongs to one project. Site participants, PTV
   staff, and the GoProceed bot share that group.**
4. **PTV may reply in the Telegram group or from the web app. A web reply
   returns only to that project's Telegram group.**
5. **Evidence is submitted by replying to a GoProceed assignment card. An
   unbound photo stays visible in communication history but is not
   evidence.**
6. **One official GoProceed bot serves all project groups. Server-side tenant
   and project resolution provide isolation.**
7. **GoProceed mirrors conversation from the time the bot is connected. It
   does not import earlier Telegram history.**
8. **Editing a Telegram message appends history and does not rewrite committed
   evidence or decisions. Removing a source message in Telegram does not erase
   GoProceed records; ordinary group-message deletions are not reported by the
   HTTP Bot API and therefore cannot be mirrored automatically.**

Decision 8's current wording is the text of commit `22b5d71` (2026-08-28,
«docs: correct Telegram deletion boundary», no body), which replaced the row
committed by `2e7e3f0` («docs: design locked Telegram project channel», the
same day). A third commit, `fe809a2` (2026-08-29, «fix(telegram): converge
processor history leases»), edited the approved document again: in
§`communication_attachments` (:341-347) it replaced «processing state» with
«lifecycle state, initially `staged` while provider metadata is retained but
no download or evidence processing has begun»; it touches no §2 row. The
spec's Status line (:5) was re-dated for neither. A document approved
«section by section» was thus edited twice after the commit that carried the
approval, and the owner's confirmation of decision 8 as it now reads and of
the attachment-lifecycle wording is owed alongside decisions 9–11.

[Ratified 2026-09-03: the owner confirmed decision 8 as `22b5d71` words it and
the attachment-lifecycle wording of `fe809a2`, both as written. The spec's
Status line carries the same date.]

Two sentences of the spec's §1 travel with the eight rows because the eight
depend on them: «Telegram is a transport and interaction surface. PostgreSQL
remains the source of truth for project scope, message identity, authorship,
evidence association, decisions, delivery state, and audit. Private object
storage remains the source of evidence bytes. Telegram is never the only copy
of an accepted evidence original» (:31-35), and «This is not a generic
messenger bridge» (:24).

### Proposed on 2026-09-02 — ruled by the owner on 2026-09-03 (decisions 9–11)

> **Decisions 9, 10 and 11 are proposals.** Each states what the owner must
> choose, what each choice costs, and — where this document has a view — a
> recommendation. None is in force.

#### 9. The version boundary — ACCEPTED 2026-09-03: (b), `v0.1-M7 — The channel`

The boundary is stated three ways today and they cannot all stand:

- the spec says «**Applies to:** first messaging-channel release» (:7), a
  phrase no other document in the tree uses;
  [roadmap.md](../product/roadmap.md) never names such a release — its
  milestones «inside v0.1 are M0–M6» (:68) and it contains no Telegram line;
- the operations catalog and the delivery document say `v0.1-M6`
  (`technical/openapi/scope-v0.1.csv`:67-76;
  [version-0.1.md](../delivery/version-0.1.md):172), and the delivery
  document calls that tag «a compromise: M6 is nominally "the blocked money"
  and these operational channel reads/writes are not that» (:191);
- the entity catalog says `v0.1-Telegram` for fourteen tables and `v0.1-M1`
  for the fifteenth (`technical/database/entity-catalog.csv`:10-24). The
  invented tag passes `scripts/validate-canonical-docs.mjs` only because its
  milestone allow-list is applied to three CSVs and never to the entity
  catalog or the invariant catalog (:1407-1415), which together carry the tag
  on seventeen rows (`technical/database/entity-catalog.csv`:11-24;
  `technical/database/invariant-catalog.csv`:6, :8, :9), and its two-way
  build-list check covers M3–M6 only (:566, :580-584).

Two candidates:

**(a) Inside `v0.1-M6`, as version-0.1.md already records.** Costs: nothing
moves in ADR-006 decision 4's table (ADR-006:275-282) or roadmap.md's (:190),
and the validator's guards 11–13 are untouched. But M6 is «The blocked money»
by ADR-006 decision 3 (:187-200), and the rule «M6 cannot open until M0 is
closed» (ADR-006:475) then attaches to the channel by accident of naming
rather than by decision. The fourteen `v0.1-Telegram` rows cannot honestly be
re-tagged `v0.1-M6`: guard 11 would fail, because none of them is in the
transcribed 26 (:580-584) — so either they stay under a tag no guard reads, or
the validator learns an exemption. And the «compromise» sentence at
version-0.1.md:191 keeps growing as the record of a milestone whose name does
not describe its contents.

**(b) A named milestone, `v0.1-M7 — The channel`.** Costs: one row in
ADR-006 decision 4's table (:275-282) — which amends decision 3's «Seven
milestones» (:187-189) by one and therefore needs this ADR to say so on
purpose; one row in roadmap.md's table (:190); one count row in
version-0.1.md's table (:164-173), which the validator checks against the
scope CSV; `v0.1-M7` added to the validator's `MILESTONES` set (:1404-1406);
and re-tagging — ten operations, four event rows
(`technical/events/event-catalog.csv`:6, :42-44) and seven invariants from
`v0.1-M6`/`v0.1-Telegram` to `v0.1-M7`, fifteen entity rows likewise. If M7
is **not** added to `FULLY_BUILT_MILESTONES` (:566), guard 11 does not compare
its tables to the 26 and the ADR-010 accounting pattern (below) carries the
fifteen. This is exactly the restructuring version-0.1.md:191 declined «to
accommodate one slice».

**Recommendation: (b).** The slice is not one slice by the package's own
measure: it builds fifteen tables where M4 builds two and M5 three
(ADR-006:280-281), ten operations where M4 and M5 carry six each
(version-0.1.md:170-171), and nineteen migrations. A milestone of that size
under a name that means something else is the contradiction the delivery
document already admits at :191; a third tag invented to avoid the question is
the symptom of the same thing. The «first messaging-channel release» reading
(spec:7) is not recommended: it would put the channel outside v0.1, which the
`v0.1-M6` tags on ten operations, four events
(`technical/events/event-catalog.csv`:6, :42-44) and four invariants already
deny, and it would detach the channel from M0's real-data rule that the spec
itself invokes (:475-477, :600-602).

Whichever the owner chooses, ADR-006:588-598 governs when this ADR takes
effect: until [roadmap.md](../product/roadmap.md),
[version-0.1.md](../delivery/version-0.1.md),
[scope-and-boundaries.md](../product/scope-and-boundaries.md), the entity
catalog and the scope CSV are rewritten against it, «the package is internally
contradictory» and the contradiction is resolved against this ADR.
scope-and-boundaries.md:798 lists «public webhooks and third-party
integrations» under «Not included in v0.1» (:692, :793) and outranks this
document at level 4 ([docs/README.md](../README.md):64-68).

#### 10. What M0 now carries — ACCEPTED 2026-09-03, as proposed

M0 is «fit to hold someone else's data», twelve gates, «eight plus four»
(ADR-006:417-448), and «M6 cannot open until M0 is closed» (:475). The spec
ties the channel to M0 in its own words: «No real pilot data enters before the
existing M0 retention and privacy gates are satisfied» (spec:475-477), and the
first rollout is «one synthetic staging project, then one named pilot project
after the existing real-data gates are closed» (:600-602). The proposal is
that the following become obligations of this work, by gate number in
ADR-006's list (:424-448):

- **Gate 1, privacy notice.** A new class of data subject: the processor
  stores the text, the Telegram sender id and display-name and username
  snapshots of every group message whether or not the sender has a member
  link (`apps/app/src/lib/telegram/processor.ts`:161-174), with disposition
  `stored_unverified_message` for an unlinked sender (:220). No file whose
  name contains «privacy» exists in the tree.
- **Gate 2, retention.** Every one of the twelve Telegram retention rows
  carries `duration_external_gate`
  (`technical/data-retention-catalog.csv`:3-14);
  `telegram_requirement_choice_sessions`
  (`supabase/migrations/0067_telegram_card_reply_evidence.sql`:48) and
  `telegram_evidence_decision_tokens`
  (`supabase/migrations/0073_telegram_evidence_decision_callbacks.sql`:6) and
  `project_field_channels`
  (`supabase/migrations/0061_the_project_chooses_one_channel.sql`:11) have no
  row at all (`grep project_field_channels technical/data-retention-catalog.csv`
  returns nothing); `telegram_inbox_updates` has no workspace column
  (`0062`:96-115) and no purge path. What IS in place: raw payloads set to
  null at both terminal paths (`0062`:481, :496) and provider handles required
  null at every terminal attachment state (`0062`:242-244), both tested
  (`apps/app/tests/telegram-schema.int.test.ts`:105-109, :123-126) — INV-094
  (`technical/database/invariant-catalog.csv`:5).
- **Gate 3, export.** Fifteen more tables an export must reproduce or name as
  omitted, and no export exists to do either: the gate's own checklist is
  unchecked
  ([production-readiness.md](../delivery/production-readiness.md):222-230),
  `technical/openapi/scope-v0.1.csv` carries no export operation (grep count
  0), and no non-test file under `apps/app/app`, `apps/app/src` or
  `packages` names a workspace export (grep count 0 for `workspace export`,
  `exportWorkspace` and `export_jobs`). The inbox cannot be exported per
  workspace at all: its identity is `bot_id + update_id` and it has no
  `workspace_id` (`0062`:96-100).
- **Gate 4, audit.** The service plane writes audit rows only through
  `app.record_service_audit`, which refuses any workspace other than the
  declared one and any actor type other than `system`/`worker`
  (`supabase/migrations/0078_service_plane_write_paths.sql`:95-111), and today
  for two actions (`apps/app/src/lib/telegram/linking.ts`:66, :104). Card
  publication writes no audit row
  (`apps/app/app/v1/assignments/[assignmentId]/communication-card/route.ts`,
  grep count 0 for audit); the processor, the evidence bridge and the decision
  worker write none.
- **Gate 5, backup and restore verification — engaged.** The branch creates
  fifteen tables (§"The tables") and downloads evidence bytes from the
  provider (`apps/app/src/lib/telegram/evidence.ts`:171) into the ordinary
  upload path, and the spec's rule «Telegram is never the only copy of an
  accepted evidence original» (spec:34-35) is a restore claim: after a
  restore, every finalized Telegram original must be in private object
  storage (spec:33-34) and every one of the fifteen tables must be back, or
  the claim is false. No gate record verifies it; a restore drill must name
  the fifteen tables and the object-storage copy as what it covers.
- **Gate 6, external-link assurance limits — not engaged.** The Telegram path
  touches no external link: the spec has no sentence on технагляд or the
  external plane (grep count 0), the only occurrence of «external» under
  `apps/app/src/lib/telegram` is a comment on sender identity
  (`linking.ts`:79), and the external plane's reach is unchanged
  (`packages/testing/src/m5-external-rls.test.ts`:452-469).
- **Gate 7, secrets and environment separation.** Seven new variables
  (`apps/app/src/lib/telegram/config.ts`:13-21) are listed in
  `apps/app/.env.example` and in neither
  `apps/app/scripts/deploy-preflight.mjs` nor `turbo.json` (grep count 0 in
  each); one official bot for every tenant (`0062`:1-2) implies a distinct
  bot per environment, written nowhere; there is no incident playbook for a
  leaked token, secret or pepper.
- **Gate 8, monitored failure paths.** The outbox now has a consumer
  (`apps/app/src/lib/telegram/delivery.ts`:124-128) — which
  [jobs-events-and-audit.md](../architecture/jobs-events-and-audit.md):45 and
  [tenancy-and-security.md](../architecture/tenancy-and-security.md):243 still
  deny — but nothing reads `outbox_dead_letters` or failed inbox rows, nothing
  schedules `POST /internal/telegram/jobs`, and no file under
  `apps/app/src/lib/telegram` emits a log or a metric; the spec's §14 metric
  families (:587-598) are unimplemented.
- **Gate 9, normative strings — engaged.** The gate is «no normative string
  renderable without its `verification` tag **and its source**»
  (ADR-006:439-440). The card route selects
  `acceptance_criterion as criterion, norm_ref`
  (`apps/app/app/v1/assignments/[assignmentId]/communication-card/route.ts`:83-84)
  and substitutes «Нормативне посилання не вказано» when `norm_ref` is null
  (:94-95); `apps/app/src/lib/telegram/cards.ts`:58 renders
  `criterion — normRef` into a Telegram message with no tag and no source.
  The card is a new renderer of regulatory strings, and ADR-007:236-237 —
  «Every regulatory string it renders is governed, without exception, by
  hidden-works-content-rules.md» — applies to it, while that file contains no
  Telegram sentence (grep count 0). Either the card carries both the tag and
  the source before a real group sees it, or the owner records that the card
  may not render the criterion text until it does. §"Relationship to ADR-006
  decision 1" records the same gap as a step 2 obligation; it is a gate 9
  obligation as well.
- **Gate 10, date of last verification on every generated act — not
  engaged.** The Telegram path renders no act: no file under
  `apps/app/src/lib/telegram` names an act, Додаток В or a render of one
  (grep count 0 for `акт`, `act`, `dodatok`, `додаток`).
- **Gate 11, tenant isolation for every module.**
  [production-readiness.md](../delivery/production-readiness.md):355 says
  «Adding a module in v0.2 reopens this gate for that module»; this module
  arrives in v0.1 and the gate must reopen for it now. What exists: RLS on all
  fifteen tables; two negative tests on `communication_messages`
  (`packages/testing/src/telegram-rls.test.ts`:39-51); an external session
  reaches exactly eight named tables and no `communication_*` or `telegram_*`
  table (`packages/testing/src/m5-external-rls.test.ts`:452-469); a
  column-level fence on `communication_attachments` (:483-490). What does
  not: the four `technical/test-catalog.csv` rows T-TG-004–007 (:6-9) whose
  subjects correspond to INV-096, INV-097 and INV-098 — no catalog links
  them: the test rows carry no INV id, `invariant-catalog.csv`:7-9
  `test_evidence` is descriptive text naming no T-TG id and no file, and
  `technical/traceability.csv` links neither (grep count 0 for `T-TG` and
  `INV-09[678]`); the mapping is this ADR's own inference by subject, and the
  missing link is itself a catalogue correction owed under Costs — had the
  integration halves of their evidence (`telegram-processing`,
  `telegram-evidence`, `m3-refusal`) skipped in the CI run this ADR cites,
  while the unit halves
  (`apps/app/src/lib/telegram/schema-contract.test.ts`,
  `apps/app/src/lib/telegram/decisions.test.ts`) ran — see §"Status against
  the runtime".
- **Gate 12, upload and resource controls.** In place at the ingress (1 MiB,
  `apps/app/src/lib/telegram/ingress.ts`:6) and the bridge (20 MiB,
  `apps/app/src/lib/telegram/evidence.ts`:12, :181), with one gap recorded
  under Costs (the provider download is buffered whole before the byte check,
  `apps/app/src/lib/telegram/api.ts`:170-173).

**Task 13 is a release blocker for enabling the webhook, not for merging.**
The rule is written twice: «Task 13 must configure and verify an edge limit of
120 requests/minute with burst 30 before this public webhook is operationally
enabled … no deployment may claim this production control exists until Task 13
records its concrete verification»
([version-0.1.md](../delivery/version-0.1.md):193-198;
`technical/rate-limits.csv`:18). The application route carries no limiter by
design (version-0.1.md:195-196); the plan's Task 13 has none of its steps
checked and none of its files on disk
([plan](../superpowers/plans/2026-08-28-telegram-project-channel.md):1523-1540);
and the plan carries no rate-limit figure at all — the number lives only in
the two documents just cited. The proposal is that the edge limit's
verification, the real-group staging pass (spec:578-579; plan:1638-1644) and
the scheduler (plan:1590-1594) are M0 evidence for gates 8 and 12, owed
before any environment enables the webhook, and that merging the branch
neither claims them nor requires them.

#### 11. The premise of ADR-007 — ACCEPTED 2026-09-03; ADR-007 carries the three amendments

**What changes.** ADR-007's binding constraint — «capture must take fewer
actions than sending a photo to a Telegram group» (:139-140) — was a benchmark
the field client had to beat. On the Telegram path it is a property the
channel satisfies by construction: capture **is** sending a photo to the
Telegram group, as a reply to an assignment card (decision 5). The sentence
stays true and stops being a comparison.

**What does not change.** ADR-007 decisions 1–2 (the field client), decision 3
(the API and the domain are client-agnostic) and decision 6 (no durable
pending original) stand. Decision 5 stands on the PWA path — the four
withdrawn provenance claims stay withdrawn, and the Telegram path asserts
none of them: the spec says so (:250-256) and the code records
`origin_not_distinguished` with no claimed capture time
(`apps/app/src/lib/telegram/evidence.ts`:159, :193) — and is **amended on the
Telegram path** in its positive half: «a client-computed content hash» is not
claimable there, because the hash is computed by the server from the
provider's bytes (:183, :197). The third block under §"Relationship to
ADR-007" carries the text.

**What is amended, and not deleted.** ADR-007:60-61 — «the founder report is
cited below only to say where the Telegram comparison is written down, never
as a reason for anything» — is amended to read that the A-8 record is never
cited **as evidence** for anything. The authority for making Telegram the
transport is the owner's instruction of 2026-08-28, and this ADR records that
the owner makes, on instruction and before validation, the capture-UX decision
[validated-assumptions.md](../discovery/validated-assumptions.md):66-75 says
would follow **if** A-8 were validated. A-8 stays Unvalidated (:40); the
evidence that would move it (:89-95 — named companies, one conversation per
company, counted delays and returns) is still owed and is not supplied by
building the channel. The prohibition on A-8 driving a positioning sentence is
untouched.

## Relationship to ADR-006 decision 1 — the scope-addition test, answered

The test is «name the step it is necessary for» (ADR-006:687). Answered
honestly: **no numbered step of ADR-006:146-160 is impossible without a
Telegram channel.**

- Step 2, «The phone», already has a working client that ADR-009 promises
  never to take away (ADR-009:145-149) and that ADR-007 makes the home of
  exactly one step (ADR-007:224-234). Telegram is a **second transport for
  step 2's capture**.
- It is also a second transport for ПТВ's evidence decision: the callback
  executes the member-plane command under the member's own capabilities
  (`apps/app/src/lib/telegram/decisions.ts`:7;
  `apps/app/src/lib/evidence/record-evidence-decision.ts`:14-35). It does not
  touch step 5: the spec contains no mention of технагляд, technical
  supervision or the external plane, and the external plane's reach is
  unchanged (`packages/testing/src/m5-external-rls.test.ts`:452-469).
- On step 2 it is the **weaker** transport today. The assignment card renders
  `criterion — normRef` per occurrence and nothing else
  (`apps/app/src/lib/telegram/cards.ts`:3-11, :58): no verification tag, no
  source, no reference image — each of which step 2 requires
  (ADR-006:149-151; ADR-007:228-233;
  [roadmap.md](../product/roadmap.md):626-628).

Therefore this ADR does **not** claim necessity. On approval it authorises
Telegram as a transport for step 2 (capture) and for the member-plane evidence
decision, on the owner's instruction, as a scope addition the owner makes knowingly, in the
name of the pain the demand scan recorded
([research-ua-demand-2026-08-21.md](../discovery/research-ua-demand-2026-08-21.md):66)
and of the incumbent A-8 names — with the status of that record exactly as
decision 11 states it. «It is already specified», «it is already in the DDL»
and «it is only one more table» are not offered as reasons, and the fifteen
tables below are not an argument for anything.

Two consequences follow and are recorded rather than left implicit. The card's
rendering is an obligation of step 2 that the Telegram path does not yet meet,
so a Telegram-locked project cannot be the pilot object on that path until it
does, or until the owner withdraws the obligation for that path and records
the cost. And ADR-006 decision 1's **list** is not amended by this ADR —
Telegram is not a seventh step — but decision 1's closing rule is: «Nothing
outside this list is v0.1» (ADR-006:174) admits no capability that is not
necessary for a numbered step, this ADR has just conceded that the channel is
not, and tagging it `v0.1-M6` or `v0.1-M7` puts it inside v0.1 anyway. This
ADR is the ADR that :174-176 says such a capability needs, and it amends that
sentence for this one capability, on the owner's instruction.

### ADR-006's replacement rule (:674-680), answered

«Changing any of the nine decisions above requires a superseding ADR that
identifies the user evidence, the version impact, the data ownership, the
security impact, and the migration cost» (ADR-006:678-680). This ADR amends
decision 1's closing rule (:174) under either option of decision 9, and
decision 3's «Seven milestones» (:189) under option (b) only; it supersedes
none. The five items, by pointer:

- **User evidence:** the demand scan's sentence
  ([research-ua-demand-2026-08-21.md](../discovery/research-ua-demand-2026-08-21.md):66)
  and the incumbent A-8, **Unvalidated** and not improved by this document
  (Authority block; decision 11). The evidence ADR-006 asks for is, on the
  package's own ledger, not yet supplied, and this ADR says so rather than
  substituting the owner's instruction for it.
- **Version impact:** decision 9 — inside v0.1 under either candidate; which
  milestone is the owner's choice.
- **Data ownership:** a new data-subject class, the text and identity
  snapshots of every group sender, member or not (§"Costs, accepted",
  «Personal data of non-members»); provider handles held until a terminal
  state and withheld from members (§"What this decision does NOT authorise").
- **Security impact:** a public provider-authenticated ingress, a service
  plane whose workspace is a declaration, and a second write path (§"Costs,
  accepted", first four items); decision 10's gate list.
- **Migration cost:** nineteen migrations, fifteen new tables and two changed
  build-list tables (§"What the branch built", §"The tables"); the
  reversibility cost recorded last under Costs.

## Relationship to ADR-006 decision 4 — the tables, and decision 7 — M0

### The tables

ADR-006 decision 4 is twenty-six tables, «every row … here because a numbered
step above cannot happen without it» (ADR-006:214-217), pinned in the
validator as `ADR006_V01_BUILD_TOTAL = 26`
(`scripts/validate-canonical-docs.mjs`:563, :1431-1437). This branch creates
**fifteen**:

| Migration | Table |
|---|---|
| `0061_the_project_chooses_one_channel.sql`:11 | `project_field_channels` |
| `0062_the_group_becomes_a_project_conversation.sql`:4, :27, :48, :72 | `telegram_chat_bindings`, `telegram_binding_intents`, `telegram_member_link_intents`, `telegram_member_links` |
| `0062`:96, :117 | `telegram_inbox_updates`, `telegram_media_groups` |
| `0062`:145, :190, :212 | `communication_messages`, `communication_message_events`, `communication_attachments` |
| `0062`:249, :273 | `telegram_requirement_choices`, `communication_delivery_attempts` |
| `0067_telegram_card_reply_evidence.sql`:48 | `telegram_requirement_choice_sessions` |
| `0073_telegram_evidence_decision_callbacks.sql`:6 | `telegram_evidence_decision_tokens` |
| `0077_telegram_decision_durable_recovery.sql`:5 | `telegram_evidence_decision_attempts` |

Two build-list tables are also **changed**: `projects` gains `status`
(`0061`:8-9) and `evidence_objects` gains
`evidence_objects_project_identity_key unique (workspace_id, project_id, id)`
(`0062`:139-143).

How they are catalogued today: `project_field_channels` as `v0.1-M1`
(`technical/database/entity-catalog.csv`:10), the other fourteen as
`v0.1-Telegram` (:11-24); [version-0.1.md](../delivery/version-0.1.md)'s
table still reads `v0.1-M6 | 13 | 0` and `Total | 75 | 26 | 26` (:172-173)
and its note says «No new table accompanies the evidence or communication
reads» (:191). The number fifteen is stated nowhere in the package before this
document.

**Proposed accounting — the ADR-010 pattern.** version-0.1.md:175-180 records
`project_sourced_requirement_items` as «a twenty-seventh v0.1 table, added by
ADR-010 … rather than by ADR-006, and it is deliberately not counted into a
list that names what ADR-006 decided». The fifteen are ADR-011 tables in the
same sense: added by this decision if approved, not by ADR-006, not counted
into the 26, the validator's pin untouched. Their milestone tag follows
decision 9; under recommendation (b) it is `v0.1-M7` for all fifteen,
including `project_field_channels`, whose `v0.1-M1` tag today names a
milestone that closed before the channel existed. The two changed build-list
tables are named here so that «26 tables, unchanged» is not read as «26
tables, untouched».

### Decision 7 — the gates now carrying this module

Decision 10 above is the list. ADR-006:417-418 says twelve «is the count, and
every other document states it this way or is wrong»; this ADR adds no
thirteenth gate, and decision 10, if approved, reopens gates 1, 2, 3, 4, 5,
7, 8, 9, 11 and 12 for the communication module and records 6 and 10 as not
engaged. Protection 5 — «Real customer data entering an
environment that has not closed M0 is a boundary violation regardless of which
document or schedule requests it» (ADR-006:701-703) — applies to the first
real Telegram group exactly as the spec says it does (:475-477).

## Relationship to ADR-007

ADR-007 is to be amended on three passages and superseded on none. **This
ADR does not edit ADR-007.** The text below is verbatim-ready and lands in ADR-007 —
with ADR-011 added to its Related decisions header, as ADR-009 was added at
ADR-007:14 — on the day the owner approves decision 11, in the dated-pointer
form ADR-007 already carries at :185-188 and :198-201. The date in brackets is
the owner's approval date, not today's.

Under the Authority block, after ADR-007:65:

> **Amended [approval date] by
> [ADR-011](ADR-011-telegram-locked-project-channel.md):** Telegram is the
> locked field-communication channel of a project, on the owner's instruction
> of 2026-08-28. The sentence above (:60-61) that cites the founder report
> «never as a reason for anything» now reads «never as evidence for anything»: A-8 is
> still Unvalidated, and ADR-011 records that the owner made the capture-UX
> decision the ledger would license only after validation, knowingly and on
> instruction. This block's own authority — the owner's instruction of
> 2026-08-06 — stands as written.

Under «The owner's constraint on the interaction», after ADR-007:154:

> **Amended [approval date] by
> [ADR-011](ADR-011-telegram-locked-project-channel.md):** on a project whose
> channel is Telegram, capture is a reply to an assignment card in the
> project's group, so the constraint above is met by construction on that
> path. The constraint is unchanged for the field client, which stays the
> pilot's capture surface under ADR-009; the field client is not replaced.

Under «May be claimed, and is all that may be claimed», after ADR-007:259:

> **Amended [approval date] by
> [ADR-011](ADR-011-telegram-locked-project-channel.md):** on a project whose
> channel is Telegram, the content hash is not client-computed. The bridge
> sends a placeholder of sixty-four zeros at preflight
> (`apps/app/src/lib/telegram/evidence.ts`:160), downloads the bytes from the
> provider (:171) and computes the hash itself (:183, :197) before
> finalization. On that path the hash proves only that the object was not
> altered between the provider download and finalization; «client-computed»
> may not be claimed for it, and nothing else in this list changes.

**Origin, and INV-086.** Telegram-sourced evidence is recorded with the same
`origin_not_distinguished` the PWA records
(`apps/app/src/lib/telegram/evidence.ts`:159, :193); the CHECK is
`supabase/migrations/0043_the_obligation_before_the_covering.sql`:911-922 and
no migration on the branch touches it, so ADR-007 protection 3 — «A
PWA-specific field on an evidence object, an upload intent, or a requirement
occurrence would destroy the replaceability that decision 3 buys» (:590-593)
— is honoured; this ADR reads the replaceability argument as reaching a
Telegram-specific field equally, and that reading is its own extension, not
the protection's wording. Two things ADR-007 does not describe are recorded
so they are not discovered later. First, the content hash on this path is
**computed by the server from the provider's bytes** (`evidence.ts`:183,
:197) after a preflight that sends a placeholder hash of sixty-four zeros
(:160), where ADR-007 decision 3 and its claim list speak of «a
**client-computed content hash**, verified at finalization» (:207-212,
:255-259); the third amendment block above is the text that records it in
ADR-007. Second, INV-086
(`technical/database/invariant-catalog.csv`:94) is written for «the v0.1 PWA»
with the client-side intent builder as «the ONLY enforcement», and does not
name the Telegram bridge as a second sender of the same value. A sibling
invariant, or an amendment of INV-086 naming both senders, is owed with the
catalogue corrections under Costs.

## Relationship to ADR-009

- **The group is not a fourth surface.** ADR-009 decision 1's three surfaces
  are the landing site, the system and the field client (ADR-009:53-55). The
  Telegram group is a provider's surface the product does not deploy, and the
  webhook that listens to it is a route inside `apps/app`
  (`apps/app/app/integrations/telegram/webhook/route.ts`:1-9), not a
  deployment. The three-surface decision is unchanged.
- **`apps/mobile` is unchanged.** Decision 2 (ADR-009:56-59) stands; the
  branch's diff against `origin/main` under `apps/mobile` is empty; the
  parity gate (:113-128) is not engaged; «the pilot is never blocked»
  (:145-149) holds because nothing here removes a client. Whether the field
  client is absent on a Telegram-locked project is a further decision this
  ADR does not make; the spec is silent on it — it excludes only «the
  GoProceed mobile app as a selectable project communication channel» (:122).
- **The ten operations.** ADR-009's amendment closed with «If a later slice
  needs a third, it needs its own dated amendment here — this one authorises
  these two and nothing else» (:226-228), and ADR-010 with «this one
  authorises these three and nothing else» (ADR-010:134-136). On approval
  this ADR is the dated authorisation for the ten operations at
  `technical/openapi/scope-v0.1.csv`:67-76 and for no others; until then they
  are catalogued without one. Nine are member-plane; the tenth,
  `telegram_webhook.accept`, is catalogued on a plane named `provider` (:72)
  that [technical/openapi/README.md](../../technical/openapi/README.md):74-83
  does not define, while `technical/permissions/capabilities.csv`:48 places
  the same operation on `service` — recorded under Costs.
- **No dashboard screen.** ADR-009 decision 3 fixes the pilot dashboard at
  «create workspace/project + access grants; create assignment; view photo
  evidence. Not the full register» (:60-62);
  [04-role-pain-map.md](../design/04-role-pain-map.md) has no row for channel
  setup, channel health or a communication timeline; the branch built none.
  The spec's §9 screens (:428-455) are a separate decision needing an ADR-009
  amendment, a role-pain-map row and the UI procedure — the same three things
  ADR-010:144-154 required.

## What this decision does NOT authorise

From the spec's §1 (:24-29) and §4 (:119-137), each an exclusion the owner
approved with the design:

- a generic messenger bridge; changing or supplementing a project's channel
  after activation; Telegram messages flowing to WhatsApp, Viber, email or the
  GoProceed mobile client; any cross-channel routing (:24-29);
- WhatsApp and Viber adapters; the mobile app as a selectable channel;
  multiple simultaneous channels; channel migration, participant-specific
  overrides or fallback delivery; replies from one messenger to another
  (:121-126);
- Telegram Mini Apps, inline mode, business-account impersonation, and
  personal bot conversations as an operational channel — the private
  deep-link handshake that binds an identity is included (:127-129);
- importing messages sent before the bot was connected (decision 7; :130);
  offline capture and durable local queues (:131); retroactively associating
  an unbound photo in the web app (:132); videos, voice messages, PDFs and arbitrary
  documents as evidence (:115-117, :133); customer-specific bot names, tokens
  or branding (:134); real-time mirroring of ordinary group-message deletions
  (:135-137).

Added by this ADR:

- **Enabling the public webhook in any environment before Task 13 records its
  verification** of the edge limit — [version-0.1.md](../delivery/version-0.1.md):193-198
  and `technical/rate-limits.csv`:18 are the rule; this ADR does not relax it.
- **Reading provider file handles from the member plane.** DA-148
  (`technical/data-access-surface.csv`:6) and INV-094
  (`technical/database/invariant-catalog.csv`:5) withhold `provider_file_id`
  and `provider_file_unique_id` from `goproceed_app` (`0062`:564-567), the m5
  fence pins that set (`packages/testing/src/m5-external-rls.test.ts`:483-490),
  and plan Task 11 step 3 forbids returning them from the timeline
  ([plan](../superpowers/plans/2026-08-28-telegram-project-channel.md):1357-1361).
- **Telegram as the only copy of any evidence** (spec:34-35).
- **Real pilot data before M0's retention and privacy gates close**
  (spec:475-477; ADR-006:701-703), and any real group before the staging pass
  on a synthetic project (spec:600-602).
- **Retroactive binding for existing projects**: they are backfilled `active`
  with no channel and «cannot bind Telegram retroactively in this release; the
  first pilot uses a newly created draft project» (spec:161-165).
- **Any dashboard screen**, per the ADR-009 section above.
- **Any claim about what a Telegram-callback decision proves** beyond «a
  linked member holding `evidence_decisions.decide`, acting through a
  single-use token»: no copy or assurance rung exists for it, and
  [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
  contains no Telegram sentence (grep count 0).

## Costs, accepted

- **A public ingress with no session in front of it.**
  `POST /integrations/telegram/webhook`
  (`apps/app/app/integrations/telegram/webhook/route.ts`:7) answers any caller
  who presents the secret header; that header, the 1 MiB bound and the
  empty responses (`apps/app/src/lib/telegram/ingress.ts`:12-27, :92-107) are
  the whole in-process defence, and the rate limit is delegated to the edge by
  decision ([version-0.1.md](../delivery/version-0.1.md):195-196). The route
  emits no telemetry: a bad-secret request is an empty 401 and nothing else.
- **One bot for all groups; isolation rests on server-side resolution.**
  `0062`:1-2 says it; decision 6 approves it. The confinement is
  `workspace_id = app.service_workspace()` on ten tables (`0062`:669-717), and
  the workspace is a **declaration** made after a SECURITY DEFINER lookup
  (`packages/database/src/tx.ts`:179-199) — a caller that declares a
  provider-supplied workspace defeats it, and no database rule prevents that.
  One table, `telegram_requirement_choice_sessions`, keeps a service grant with
  an existence-based policy instead
  (`supabase/migrations/0068_telegram_evidence_security_recovery.sql`:40-70)
  — an exception to the confinement rule that is recorded here and not yet
  decided.
- **Provider handles are required null at every terminal attachment state
  (`0062`:242-244) and live at most three retries
  (`supabase/migrations/0069_telegram_evidence_retry_leases.sql`:3-5).** They
  are withheld from members (`0062`:564-567). The four `provider_retry_*` columns
  added by `0069`:3-10 are withheld from `goproceed_app` **by omission** — no
  grant names them — and the m5 test says so in terms («asserted as "not
  readable", never as "meant to be withheld"»). **Open item, not a decision:**
  the owner rules whether they join DA-148's withheld set on purpose.
- **A second write path.** The service plane now writes communication,
  evidence and audit rows through definers
  (`supabase/migrations/0078_service_plane_write_paths.sql`:95-111) and direct
  grants; `goproceed_service` is a member of `goproceed_app` and inherits its
  grants by design (the roles were created by
  `supabase/migrations/0034_service_principal_role.sql`:23-38 under their
  pre-rename names and renamed by
  `supabase/migrations/0057_the_roles_the_rename_left_behind.sql`:96-100).
  Every service-plane policy sits outside the m5 subject check, which filters
  policies granted to `goproceed_app` only
  (`packages/testing/src/m5-external-rls.test.ts`:373-378).
- **Personal data of non-members.** Text, Telegram id, display name and
  username of every group sender are stored
  (`apps/app/src/lib/telegram/processor.ts`:161-174). This is customer data
  by the spec's own rule (:475) and a data-subject class the privacy notice
  does not yet exist to name.
- **A weaker step 2 on the Telegram path**, per the ADR-006 decision 1
  section: `criterion — normRef` and nothing else
  (`apps/app/src/lib/telegram/cards.ts`:58).
- **Operational debt that is not yet anyone's:** no scheduler for the job
  runner; no reader for `outbox_dead_letters` or failed inbox rows; the file
  download buffers the whole response before comparing it to the 20 MiB cap
  (`apps/app/src/lib/telegram/api.ts`:170-173); seven secrets absent from
  `deploy-preflight.mjs` and `turbo.json`; a link pepper with no key id
  (`apps/app/src/lib/telegram/config.ts`:19).
- **Catalogue corrections owed before an ADR can cite the catalogs cleanly:**
  `technical/data-access-surface.csv` reuses DA-145 through DA-156 for twelve
  new rows while `origin/main` already holds rows with those ids (the ids
  appear twice on the branch); DA-149 claims `SELECT|UPDATE` on
  `telegram_inbox_updates`, which `0062`:621 revokes;
  `technical/database/invariant-catalog.csv`:3-9 tags four invariants
  `v0.1-M6` and three `v0.1-Telegram`; the `provider` plane; `schema-v0.1.sql`
  grew fifteen tables under an unchanged «Last reviewed: 2026-08-06»;
  `0079`:3-5 names five confined tables where `0062`:669-717 confines ten.
- **The reversibility ADR-006 prized is spent here.** Decision 1 locks a
  project's channel at activation; ADR-006:663-668 argued its own re-cut was
  «deliberately the cheapest available» because everything moved kept its
  specification intact. Nineteen migrations and fifteen tables are not cheap
  to reverse, and this ADR does not pretend otherwise.

## Open items — ruled by the owner on 2026-09-03

Everything the owner had to rule on, in one place, with the ruling under each
item; the arguments stay where they are made. The rulings were given in
conversation, one item at a time, and this section is their only record — the
same form of record the 2026-08-28 approval has (§"Authority").

1. **Decision 8 as re-worded** by `22b5d71`, and the attachment-lifecycle
   wording of `fe809a2` — §"Owner-approved on 2026-08-28".
   **Ruled: ratified, both as written.**
2. **Decision 9**, the version boundary.
   **Ruled: (b), `v0.1-M7 — The channel`.** ADR-006 decision 3's «Seven
   milestones» becomes eight by this ADR, on purpose; ADR-006 decision 4's
   table, roadmap.md's table and version-0.1.md's count table each gain the
   row; the ten operations, the four event rows, the eight invariants
   (INV-092 to INV-099 — the argument above counted seven before INV-099
   existed) and the fifteen entity rows re-tag to `v0.1-M7`; the validator's milestone
   allow-list admits the tag and its two-way build-list check does not
   (ADR-010's accounting pattern carries the fifteen tables).
3. **Decision 10**, what M0 now carries.
   **Ruled: as proposed** — gates 1, 2, 3, 4, 5, 7, 8, 9, 11 and 12 engaged,
   6 and 10 not; Task 13's edge limit, the real-group staging pass and the
   scheduler are blockers for enabling the webhook in any environment, not
   for closing M0.
4. **Decision 11**, the amendment of ADR-007 on three passages.
   **Ruled: accepted on all three.** ADR-007 carries the dated amendments.
5. **The `provider_retry_*` columns.**
   **Ruled: withheld on purpose.** DA-148 names the four columns of `0069`
   beside the two provider handles, and the m5 sweep asserts them as «meant
   to be withheld». No grant changes.
6. **`telegram_requirement_choice_sessions`.**
   **Answered by code, not by ruling:** migration `0080` (#62, merged
   2026-09-03) replaced the existence-based policy with the
   `app.service_workspace()` confinement its ten siblings use; the exception
   no longer exists.
7. **INV-086's sibling.**
   **Ruled: amend INV-086** to name both senders of `origin_not_distinguished`
   — the PWA's intent builder and the Telegram bridge's `evidence.ts` — with
   the `0043` CHECK as the fence they share; no second invariant.
8. **Whether the field client is absent on a Telegram-locked project.**
   **Ruled: it stays available.** The channel decision governs communication,
   not capture; ADR-009's parity rule and ADR-007 decisions 1–2 are untouched;
   no code changes.
9. **The gate 9 rendering gap.**
   **Ruled: the card carries the verification tag and the source** before a
   real group sees it — `cards.ts`, the card route and one Telegram sentence
   in hidden-works-content-rules.md; a webhook-enable blocker beside Task 13,
   recorded in TODOS.md.
   *[Landed 2026-09-08.* The route selects `norm_ref_verification` and
   `norm_ref_source`; `cards.ts` takes a citation as one indivisible value and
   renders the label of `norm-ref-labels.ts` with a numbered «Джерела» block,
   so a twelve-item Додаток Н card fits 4096 characters without abbreviating a
   source; a requirement missing any of the three renders a substitute and
   keeps its ordinal. The Telegram sentence is prohibition **T** of
   hidden-works-content-rules.md. **This item leaves the webhook-enable blocker
   list; Task 13's edge limit, the real-group staging pass and the scheduler
   stay on it.** The review of that change found the same gap in the second
   renderer — the requirement-choice button, `left(criterion,120)` at
   `0071`:225, which also re-published the criterion the card had withheld —
   and closed it in the same slice with migration `0084`, so it never reached
   the blocker list.]*

## Status against the runtime

**Addendum 2026-09-03.** The branch was merged to `main` through #58
(`7bf8e4b`) after #60, #61, #62, #64 and #65 landed on it; migrations `0061`
through `0081` are on `main`. CI on the merged head (run 33735473898):
`app-qa` green; `verify` red with eighteen `apps/app` cases that were failing
on `main` before this branch and became visible only when #62 wired
`TEST_DB_ADMIN_URL` into CI (baseline #63); the branch added none. Still
deployed nowhere; Task 13, the real-group staging pass and the scheduler are
still owed before any environment enables the webhook (decision 10). The
bullets below are the 2026-09-02 reading and stay as dated history.

- **Built and CI-proven on one branch.** `claude/d3-0-decision-slice` at
  `7817abe`; CI run 33567446293, conclusion `success`, both jobs successful
  (read 2026-09-02). 2224 tests passed, 125 skipped; `next build` compiled.
- **What the 125 skipped are** — eight files in the `apps/app` package, from
  the verify job's log: `tests/m3-refusal.int.test.ts` (29 of 29),
  `tests/upload-intents-create.int.test.ts` (23 of 23),
  `tests/telegram-evidence.int.test.ts` (20 of 20),
  `tests/upload-intents-finalize.int.test.ts` (19 of 19),
  `tests/telegram-processing.int.test.ts` (17 of 17),
  `tests/telegram-delivery.int.test.ts` (9 of 9),
  `tests/project-communications.int.test.ts` (7 of 9) and
  `src/lib/evidence/evidence-service.test.ts` (1 of 1);
  29 + 23 + 20 + 19 + 17 + 9 + 7 + 1 = 125. The Telegram-family suites are
  82 of the 125. The two upload-intent suites are the automated evidence
  behind the upload protocol (ADR-007:207-212, :255-259) that
  §"Relationship to ADR-007" contrasts the Telegram hash with — so the PWA
  half of that contrast is as unexercised in this run as the Telegram half.
  All eight are gated on the same credentials: `hasIsolatedDatabaseCredentials()`
  (`apps/app/tests/telegram-processing.int.test.ts`:7;
  `apps/app/tests/telegram-evidence.int.test.ts`:20;
  `apps/app/tests/upload-intents-create.int.test.ts`:42;
  `apps/app/tests/upload-intents-finalize.int.test.ts`:27) or the same three
  variables directly (`apps/app/tests/telegram-delivery.int.test.ts`:8;
  `apps/app/src/lib/evidence/evidence-service.test.ts`:11), which require
  `TEST_DB_ADMIN_URL` (`apps/app/tests/helpers/fixtures.ts`:20), a variable
  `.github/workflows/ci.yml` never sets (grep count 0). The integration
  halves of the evidence for `technical/test-catalog.csv`:6-9 (T-TG-004–007,
  the rows whose subjects correspond to INV-096, INV-097 and INV-098 — a
  correspondence no catalog records, see decision 10 gate 11) therefore
  **did not run** in the run this ADR cites; the unit halves,
  `apps/app/src/lib/telegram/schema-contract.test.ts` and
  `apps/app/src/lib/telegram/decisions.test.ts`, are not in the skip list and
  did. «CI green» is true of the run and not of those invariants.
- **Deployed nowhere.** No migration on `origin/main` creates
  `telegram_inbox_updates` (`git grep -l telegram_inbox_updates origin/main --
  supabase/migrations` returns nothing); the last recorded apply is `0058` on
  staging as of 2026-08-18 ([infra/README-staging.md](../../infra/README-staging.md):8);
  the runbook infers, unverified, that staging is still at `0058`
  ([pilot-execution-runbook.md](../delivery/pilot-execution-runbook.md):216);
  commit `3b6fb86` states «no environment carries 0061+».
  [version-0.1.md](../delivery/version-0.1.md):191's «the already-deployed
  inbox table» has no dated source and is contradicted by `0062`:96, which
  creates that table.
- **Not merged.** PR #58 (`claude/d3-0-decision-slice` → `main`) is OPEN as
  a draft (`isDraft` true) with `mergedAt` null (read 2026-09-02); `origin/main` (`0db76dd`) is two commits
  ahead and is not an ancestor of the branch.
- **No gate record.** Task 12 (web screens) and Task 13 (webhook script, QA
  walk, CI wiring, staging gate) have no commit, no artifact and no checked
  box; the plan records 0 of 110 boxes done. The spec's own rule stands: «No
  completion claim is made from green mocks alone; the real-group staging
  pass is required before the feature is described as operational»
  (:578-579).
- **Per the package's rule** — «`Approved` does not mean deployed»
  ([docs/README.md](../README.md):84) — none of the above may be described as
  live, and this document is not Approved.

### Contradictions this ADR records rather than smooths

1. spec:517 says the webhook «resolves tenant scope internally»;
   `apps/app/src/lib/telegram/ingress.ts`:85-89 says it «does not resolve
   tenant scope», and version-0.1.md:191 agrees with the code. Resolution
   happens in the processor, after acknowledgement.
2. version-0.1.md:191 «the already-deployed inbox table» vs `0062`:96 and the
   absence of any such migration on `origin/main`.
3. [jobs-events-and-audit.md](../architecture/jobs-events-and-audit.md):45
   «The outbox has no consumer» and
   [tenancy-and-security.md](../architecture/tenancy-and-security.md):243
   «**None.**» vs `apps/app/src/lib/telegram/delivery.ts`:124-128. Both
   documents sit at level 2 and outrank this ADR until edited
   (ADR-006:600-612).
4. Three milestone tags for one slice — spec:7,
   `technical/openapi/scope-v0.1.csv`:67-76,
   `technical/database/entity-catalog.csv`:10-24 — see decision 9.
   [Resolved 2026-09-03 by decision 9(b): one tag, `v0.1-M7`.]
5. [scope-and-boundaries.md](../product/scope-and-boundaries.md):798 «public
   webhooks and third-party integrations» under «Not included in v0.1» vs
   `technical/openapi/scope-v0.1.csv`:72. Level 4 wins until edited.
   [Amended 2026-09-03: scope-and-boundaries.md now names the Telegram
   webhook as the v0.1-M7 ingress and keeps «public webhooks and third-party
   integrations» excluded as a class.]
6. `technical/openapi/scope-v0.1.csv`:72 plane `provider` vs
   `technical/permissions/capabilities.csv`:48 plane `service` vs the four
   planes of [technical/openapi/README.md](../../technical/openapi/README.md):74-83.
7. `technical/test-catalog.csv`:6-9 «automated» vs the CI run that skipped
   the integration halves of their evidence (`telegram-processing`,
   `telegram-evidence`, `m3-refusal`) while the unit halves
   (`schema-contract.test.ts`, `decisions.test.ts`) ran; and no catalog links
   those rows to INV-096–098 — the correspondence is this ADR's inference by
   subject.
8. Decision 8's wording postdates the approval it sits under (`2e7e3f0` then
   `22b5d71`, both 2026-08-28), and `fe809a2` (2026-08-29) edited the approved
   document's attachment section after that; the Status line at spec:5 is
   unchanged through all three. [Resolved 2026-09-03: ratified — open item 1;
   the Status line is re-dated.]
9. ADR-007:139-140 measures «fewer actions than sending a photo to a Telegram
   group»; the demand scan measures «no more effort than sending a photo»
   ([research-ua-demand-2026-08-21.md](../discovery/research-ua-demand-2026-08-21.md):66).
   They are different measures, and this ADR uses ADR-007's.
10. [production-readiness.md](../delivery/production-readiness.md):355 reopens
    gate 11 for a module added «in v0.2»; this module is tagged v0.1 and the
    sentence has no clause for it.
11. [`docs/legacy/31-architecture-decisions.md`](../legacy/31-architecture-decisions.md):43
    already carries a heading «ADR-011 Generic package plus adapters». That
    file is Historical and non-normative, disposed of by merge into ADR-001
    ([docs/legacy/README.md](../legacy/README.md):142); the number is reused
    here on purpose, because `docs/decisions/` is the active series and its
    next free number is 011
    ([pilot-execution-runbook.md](../delivery/pilot-execution-runbook.md):644).
    [`docs/legacy/ARCHITECTURE-AUDIT-ANSWERS.md`](../legacy/ARCHITECTURE-AUDIT-ANSWERS.md):1755,
    :1793 cite that legacy ADR-011 by number as well. Both files are under
    `docs/legacy` and non-normative; a bare «ADR-011» in a legacy file means
    the historical adapters decision, and this document means the Telegram
    channel.
12. The ADR approval procedure itself is undefined: «who moves an ADR from
    Draft to Approved, and where that is recorded — is undefined in repo»
    (runbook:644). This ADR is Draft — the package's word for a decision not
    yet in force ([docs/README.md](../README.md):80) — because the procedure
    for moving it to Approved is undefined; only the owner can change it, by
    confirming decisions 8–11 and the items under §"Open items awaiting the
    owner". [Ruled 2026-09-03: the owner ruled on all nine items in conversation;
    §"Open items — ruled by the owner on 2026-09-03" is the record, and this
    document moved to Approved on it. The procedure is still undefined in the
    repo; this is one more instance of the same form of record.]
13. [pilot-execution-runbook.md](../delivery/pilot-execution-runbook.md):644
    says «ADR-010 is the highest today» and that «every ADR on disk simply
    carries `Status: Approved`»; this file makes both clauses stale on the day
    it lands. The runbook line is a dated observation and is not edited here.
    [Noted 2026-09-03: the runbook is to be rewritten against `main`; that
    rewrite owns the correction.]
