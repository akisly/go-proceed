-- 0047: the act, and the facts it is allowed to be made of (v0.1-M4).
--
-- THE NUMBER. 0041-0046 are taken. 0045 and 0046 are v0.1-M3's two halves and
-- both were written on this uncommitted branch; this file is M4's schema half and
-- is the first free number. The four M4 routes — statutory_acts.compose,
-- statutory_act_versions.freeze, statutory_acts.get, statutory_acts.render
-- (scope-v0.1.csv:49-52) — ship in the same commit and not in this file.
--
-- WHAT THIS ADDS
--   Four tables — public.statutory_acts, public.statutory_act_versions,
--   public.statutory_act_version_quantities and
--   public.statutory_act_version_signatories — plus seven composite uniques on
--   existing tables that back their foreign keys, ONE value in the
--   project-capability CHECK (statutory_acts.compose), the draft/freeze guard,
--   the deferred completeness check the freeze has to pass, grants and RLS.
--
--   Nothing here writes a row, and no route ships in this file.
--
-- WHAT THIS DOES NOT CHANGE
--   No table is dropped. No column is dropped. No row is written, deleted or
--   rewritten. Migrations 0001-0040 are applied history and are NOT edited.
--   0041-0046 were written on this uncommitted branch and are not edited either:
--   this file only adds to what they built.
--
--   THE SEVEN COMPOSITE UNIQUES OF §2 ARE ALL (an already-unique key) + (extra
--   columns), so no two rows can collide on one of them that did not already
--   collide on the narrower key, and validation against existing rows cannot
--   fail. Four of them are on DEPLOYED tables that may hold pilot rows —
--   public.work_assignments, public.work_items, public.progress_entries,
--   public.project_parties and public.party_contacts (0010, 0012, 0015) — and
--   each takes an ACCESS EXCLUSIVE lock and builds an index. On pilot-scale
--   tables that is a moment; it is stated rather than assumed.
--
--   THE WIDENED CAPABILITY CHECK (§1) IS A WIDENING. The fifteen values 0045
--   accepts are a subset of the sixteen accepted here, so the re-added constraint
--   is validated against existing grant rows and cannot fail on them.
--
-- ROLLBACK
--   Dev only, and only while no act exists. THE ORDER IS LOAD-BEARING —
--   referencing objects before referenced ones, or the drop fails and the next
--   hand reaches for CASCADE:
--     drop table public.statutory_act_version_signatories;
--     drop table public.statutory_act_version_quantities;
--     drop function app.guard_statutory_act_content();
--     drop trigger statutory_act_versions_freeze_complete on public.statutory_act_versions;
--     drop function app.assert_statutory_act_version_complete();
--     drop trigger statutory_act_versions_guard on public.statutory_act_versions;
--     drop function app.guard_statutory_act_version();
--     drop table public.statutory_act_versions;
--     drop table public.statutory_acts;
--     alter table public.party_contacts   drop constraint party_contacts_party_key;
--     alter table public.project_parties  drop constraint project_parties_act_pin_key;
--     alter table public.progress_entries drop constraint progress_entries_act_source_key;
--     alter table public.work_items       drop constraint work_items_unit_key;
--     alter table public.work_assignments drop constraint work_assignments_line_key;
--     alter table public.work_stages      drop constraint work_stages_concealment_key;
--     alter table public.stage_closures   drop constraint stage_closures_act_pin_key;
--     alter table public.project_access_grants
--       drop constraint project_access_grants_capability_check;
--     alter table public.project_access_grants
--       add constraint project_access_grants_capability_check
--       check (capability = any (array[
--         'project.admin','project.view','contracts.edit','imports.manage','imports.publish',
--         'assignments.manage','progress.record','progress.adjust','evidence.record',
--         'rule_bindings.manage','requirements.assign',
--         'requirement_exceptions.decide','evidence_decisions.decide','stage_closures.close',
--         'readiness.view']));
--   ONCE ONE ACT VERSION HAS BEEN FROZEN THERE IS NO ROLLBACK. Dropping
--   public.statutory_act_versions destroys the frozen snapshot a printed act was
--   rendered from, and a rendered act that cannot be re-derived from its own
--   record is the artifact INV-015 exists to prevent. Narrowing the capability
--   CHECK back also fails while any grant row carries 'statutory_acts.compose',
--   because a revoke sets revoked_at rather than removing the row. Staging and
--   production take a corrective forward migration instead.
--
-- WHAT WAS NOT CHECKED
--   NOTHING HERE WAS EXECUTED. No psql, no supabase, no migration run, no test.
--   Static reading of 0010, 0011, 0012, 0013, 0015, 0016, 0017, 0034, 0042, 0043,
--   0045 and 0046, against technical/database/schema-v0.1.sql,
--   entity-catalog.csv, invariant-catalog.csv, relationship-catalog.csv,
--   state-catalog.csv, transition-catalog.csv, events.csv,
--   technical/permissions/capabilities.csv and technical/openapi/scope-v0.1.csv,
--   and against docs/product/hidden-works-content-rules.md, ADR-005 decision 10,
--   ADR-006 decision 4.5 and version-0.1.md §v0.1-M4, is the only check performed
--   on it. No claim is made that it applies.
--
-- ---------------------------------------------------------------------------
-- THE CONTENT RULES ARE THE SPECIFICATION HERE, NOT THE BACKGROUND
--
-- docs/product/hidden-works-content-rules.md is Approved and it RESTRICTS at
-- every precedence level, including over ADRs (docs/README.md §"Source of
-- truth"). For this milestone that document is not context: it is the thing the
-- schema has to make true. Four of its rules are load-bearing on the columns
-- below, and each one is a column that is ABSENT rather than a column that is
-- validated:
--
--   PROHIBITION E — «шифр», «аркуш», «ким видана», «паспорт», «Акт №», «м.п.»
--   and a fourth signatory are not fields of Додаток В. There is no column for
--   any of them anywhere in this file, and §6's primary key on (version, slot)
--   over a three-value CHECK makes a fourth signatory a constraint violation
--   rather than an omission.
--
--   THE КВАЛІФІКАЦІЙНИЙ СЕРТИФІКАТ IS NOT STORED ON THE ACT. Allow-list item 10
--   establishes that технагляд HOLDS one (ПКМУ № 903, п. 3); it does not
--   establish that Додаток В has a slot for its серія and номер, and prohibition
--   E bans the adjacent «ким видана». The certificate belongs to the participant
--   record. §6 therefore has no certificate column of any kind, and nothing in
--   this file can be printed for one. See §11 item 5: the participant record it
--   is supposed to live on does not carry it either, in the deployed database.
--
--   INV-073 — there is NO free-text quantity field. §5 is the only place a
--   quantity can be stored and every row of it is a share of one ALREADY
--   RECORDED progress entry, in the canonical unit of the line that entry was
--   recorded against, with the entry's own recorded quantity pinned INTO the row
--   by foreign key. A number a human types is not storable, and it is not
--   storable because there is nowhere to put it — not because a validator
--   rejects it.
--
--   PROHIBITION G — no source says which Додаток Н position takes form В and
--   which takes form Г. §3's act_form_basis has exactly two values,
--   'product_assumption' and 'user_selected', and there is no column on any
--   table here in which a norm reference for that choice could be recorded. The
--   mapping is storable as the product's assumption or not at all.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO: it names no field of Додаток В, adds
-- none, and stores no string of the form. Every string the act renders comes
-- either from a render template that §4 pins by key, version and hash, or from a
-- fact recorded elsewhere in this database. The one normative string this schema
-- carries is the FORM CITATION, and it carries its verification tag and its
-- source in NOT NULL columns beside it, so an unsourced act is unrenderable
-- because it is unstorable (INV-073, storage half).
--
-- ---------------------------------------------------------------------------
-- WHY THE TARGET DDL IS NOT TRANSCRIBED
--
-- technical/database/schema-v0.1.sql:1575-1661 is the SHAPE to build toward, not
-- a file to copy (0015:1-11, 0043:83-91, 0045:103-112). The three standing
-- deviations apply unchanged: the workspace table is public.organizations, the
-- membership key is public.memberships (organization_id, id), and vocabularies
-- are text + CHECK because this database has no enums. Content hashes are text
-- with a hex CHECK, matching public.import_files.content_hash and 0045's frozen
-- set hash, not the target's bytea.
--
-- SEVEN DEPARTURES, each because the target shape cannot carry the guarantee the
-- milestone is about:
--
--   1. THE PRINTED QUANTITY IS A ROW, NOT FOUR COLUMNS ON THE VERSION.
--      schema-v0.1.sql:1619-1624 gives an act version one root_progress_entry_id,
--      one share, one printed_quantity and one unit. ADR-005 decision 10 and
--      version-0.1.md §v0.1-M4 both say the composer offers «only
--      `quantity_entries` already recorded against the line, with a share
--      selector» — PLURAL, and an assignment accumulates one root entry per
--      recording, not one in total. With a single quadruple a composer facing
--      three recorded entries has exactly two options: drop two of them, or print
--      their sum. THEIR SUM IS NOT ANY RECORDED ENTRY. It is a free-text quantity
--      that arrived through arithmetic instead of through a keyboard, and INV-073
--      does not care which door it came in by. §5 makes each printed quantity its
--      own row against its own entry, so the sum on the page is the sum of facts
--      and not a fact of its own.
--
--   2. THE THREE SIGNATORY SLOTS ARE ROWS WITH TYPED COLUMNS, NOT THREE jsonb
--      COLUMNS. schema-v0.1.sql:1632-1634 carries builder_signatory,
--      technical_supervision_signatory and designer_supervision_signatory as
--      jsonb. Three jsonb columns do make a FOURTH SLOT unrepresentable — and
--      they make «ким видана» perfectly representable, as a key inside any one of
--      them, added by a contributor who never writes a migration and is never
--      reviewed. Prohibition E is a rule about FIELDS, and a jsonb blob is a
--      field that holds any field. §6 has one column per fact and no column for a
--      banned one; a fourth slot violates a CHECK and a banned field needs a
--      migration somebody has to read.
--
--   3. THE ACT IDENTITY ROW IS APPEND-ONLY. The target gives public.statutory_acts
--      `version` and `updated_at` (schema-v0.1.sql:1588-1590). Nothing on it can
--      change: the closure it is a by-product of is append-only, the stage is
--      terminal after 0045 §6, and everything a composer edits lives on the draft
--      VERSION. A version column on a row that never moves is a column that
--      invites a route to move it. entity-catalog.csv:62 marks the entity
--      `draft_mutable`; §11 item 2 records the disagreement rather than resolving
--      it here.
--
--   4. THE VERSION LINEAGE IS CONTIGUOUS, UNFORKED, AND SINGLE-DRAFTED. The
--      target gives each act `version_no` + `unique (statutory_act_id,
--      version_no)` and stops. That admits a version 5 behind a version 1 — a
--      correction chain with a hole in it — and two concurrent drafts of one act,
--      either of which may be frozen first. §4 carries a predecessor id AND a
--      predecessor ordinal CHECK-forced to `version_no - 1`, joined back by a
--      composite self-FK that also pins the predecessor's STATUS to 'frozen', so
--      «a correction is a successor version» means a successor OF SOMETHING
--      FINISHED. A partial unique index allows one draft per act at a time. This
--      is 0045's departure 2 and departure 3, in the same shape and for the same
--      reason.
--
--   5. v0.1 STORES FORM В ONLY, THROUGH A NAMED SINGLE-PURPOSE CONSTRAINT.
--      entity-catalog.csv:62 and version-0.1.md §v0.1-M4 exclusions both say v0.1
--      renders form В and that Додаток Г arrives in v0.2. 'dodatok_g' STAYS in the
--      act_form vocabulary so the v0.2 slice is additive and no v0.1 record has to
--      be reinterpreted — the shape 0043 used for 'closed_without_evidence' and
--      0045 for 'revoke' — and a separately named constraint,
--      statutory_acts_v01_form_v_only_check, forces the В arm until then. THE v0.2
--      Г SLICE DROPS EXACTLY THAT ONE CONSTRAINT. It is named, single-purpose and
--      documented for the reason 0045 §"departure 5" gives: dropping a CHECK is
--      the migration nobody reviews, and the answer is a CHECK whose removal is
--      written down in advance as another migration's stated job.
--
--   6. THERE IS NO FROZEN EVIDENCE SET ON THE ACT, BECAUSE THE CLOSURE ALREADY
--      FROZE ONE. An act version renders decision blocks, and a frozen version
--      that could gain or lose one afterwards would not be a snapshot. It cannot:
--      the act pins a stage closure, and 0045's public.stage_closure_occurrences
--      is the closure's frozen occurrence set — one row per obligation, each
--      naming the exact accepting decision or waiver/accept_risk exception it was
--      satisfied by, append-only, and unable to gain a member after the closure's
--      own transaction (app.guard_closure_member_window, 0045:1022-1048). A second
--      frozen set here would be a copy that can disagree with the original. What
--      the act adds is the quantity set (§5) and the signatory set (§6), which the
--      closure does not freeze.
--
--   7. EVERY TABLE CARRIES project_id. entity-catalog.csv:62,64 marks both
--      entities project_scoped, and every RLS policy in this database reaches its
--      answer through app.has_project_capability(workspace_id, project_id, ...).
--      This is 0045's departure 7 unchanged, and every project_id below is pinned
--      to its parent by composite foreign key, so it cannot drift.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION DOES NOT ENFORCE, NAMED SO IT IS NOT MISTAKEN FOR ENFORCED
--
-- * THE В.1/В.2 FIELD LIST IS NOT ENFORCED, AND CANNOT BE, BECAUSE IT IS NOT
--   COMMITTED ANYWHERE. Allow-list item 3 licenses «every field of В.1 and В.2, in
--   the standard's order»; docs/delivery/test-strategy.md:139-152 records that no
--   such enumeration exists in this repository — technical/requirements/ holds the
--   Додаток Н CSV and nothing else — and that NO TEST MAY SUBSTITUTE A FIELD LIST
--   TYPED FROM MEMORY. That applies to a schema exactly as it applies to a
--   fixture, and more dangerously, because a column looks decided. So this file
--   stores facts and pins a template; it does not model the form. §11 item 1
--   records what closes the gap.
--
-- * INV-015's BYTE-DETERMINISM HALF IS NOT A DATABASE RULE. «Repeated rendering
--   of one frozen version is byte-deterministic for a given renderer version» is
--   a property of the renderer over frozen inputs. What §4 can do, and does, is
--   make the inputs unable to move after the freeze (the guard), and record the
--   three things a divergence would have to be explained by: renderer_version,
--   form_template_hash and content_hash. A later render that does not reproduce
--   content_hash is then a detectable fact with a nameable cause instead of an
--   argument.
--
-- * THE PRINTED QUANTITY IS NOT CHECKED AGAINST THE EFFECTIVE QUANTITY AFTER
--   ADJUSTMENTS. §5 pins the ROOT entry's own recorded quantity by foreign key, so
--   a share cannot be taken of a quantity nobody recorded. It does not, and must
--   not, pin public.progress_allocation_heads.effective_quantity: that column
--   moves when a correction is recorded, a foreign key to it would make the
--   correction fail while an act references the old value, and INV-065 says the
--   gate never refuses to record a fact. The composer owes the comparison, and
--   owes a decision about what an adjustment recorded AFTER a freeze does to an
--   act already printed. No document in this package answers that, and §11 item 4
--   records it rather than a column deciding it by omission.
--
-- * THE ROUNDING MODE OF A PRINTED QUANTITY IS NOT FIXED. §5's rounding CHECK
--   bounds the printed value to strictly less than one unit in the last place of
--   the line's own unit precision away from share × recorded quantity, which
--   admits half-up, half-even and truncation alike and refuses a number that is
--   simply unrelated to the share. Picking one mode would be inventing a rule:
--   INV-011 and INV-037 are about MONEY rounding and no document in this package
--   states a quantity rounding rule.
--
-- * PROHIBITION S IS A RENDER RULE AND STAYS ONE. «Never render the word «підпис»
--   / «підписано» for a record below level 4» cannot be enforced by a table that
--   stores no rendered text. What the storage contributes is that there is
--   nothing here to mislabel: a §6 signatory row carries a slot, a participant, a
--   frozen name and nothing else — no signature, no assurance level, no signed-at
--   timestamp, no acceptance. In v0.1 a signatory slot is a TYPED SLOT and never a
--   record of signing; the only assurance-bearing record v0.1 has is
--   requirement_evidence_decisions.assurance_label (0045:617), which the act reads
--   through the closure's frozen set and must print the level of.
--
-- * NOTHING VERIFIES THE REGISTRY CHECK DATE. §4 requires registry_checked_on at
--   freeze, because the mandatory footer disclaimer prints «Перевірено за
--   Реєстром будівельних норм: {дата останньої перевірки}» and an act that cannot
--   fill its own mandatory disclaimer must not freeze. THERE IS NO FACT TABLE
--   BEHIND THE DATE. M0 gate 10 owns the registry check and builds nothing, so
--   until it does, the composer supplies a date this database can only check is
--   not in the future. §11 item 3.
--
-- * WHICH PARTICIPANT FIELD SUPPLIES A PRINTED ORGANISATION NAME IS RECORDED, NOT
--   VERIFIED. §6 stores the frozen string and the record it was taken from, and
--   cannot check that the two still agree: public.parties and
--   public.party_legal_profiles are both mutable, and a foreign key onto their
--   `version` would refuse a later correction to a participant record for no
--   better reason than that an act once quoted it.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 0. Arithmetic probe
--
-- §5's rounding CHECK is written in terms of power() and round() over numeric.
-- A plpgsql body is only syntax-checked at CREATE FUNCTION and a CHECK
-- expression is not evaluated until the first row, so a surprise in either
-- function would not surface until the first act is composed — which is a real
-- pilot, mid-workflow. Both are evaluated now and fail the migration loudly
-- instead. This is 0042:145-148's probe and 0045:281-292's, for the same reason.
-- ===========================================================================
do $$
begin
  -- one unit in the last place, at the two scales public.unit_definitions
  -- admits at the ends of its range (0 and 6), plus the common case
  if power(10::numeric, 0::numeric)    <> 1::numeric
  or power(10::numeric, (-3)::numeric) <> 0.001::numeric
  or power(10::numeric, (-6)::numeric) <> 0.000001::numeric then
    raise exception 'numeric power() does not agree with the printed-quantity rounding rule';
  end if;
  -- round(numeric, int) must actually reduce scale, or the precision CHECK below
  -- would accept a printed quantity finer than the unit it is printed in
  if round(1.0005::numeric, 3) = 1.0005::numeric then
    raise exception 'numeric round() does not reduce scale; the printed-quantity precision CHECK would be vacuous';
  end if;
end $$;

-- ===========================================================================
-- 1. The one capability M4's routes check
--
-- technical/permissions/capabilities.csv:32 — statutory_acts.compose, plane
-- project, milestone v0.1-M4 — governs ALL FOUR M4 operations:
-- statutory_acts.compose, statutory_act_versions.freeze, statutory_acts.get and
-- statutory_acts.render. That is the file's own related_operations column, and
-- statutory_acts.render was added to it on 2026-08-06 precisely because it was
-- governed by no capability at all. No value is invented here: this is that
-- capability_id verbatim, with its milestone already v0.1-M4.
--
-- ALL THREE HALVES OF THE VOCABULARY MOVE IN THIS SLICE. The project-capability
-- vocabulary is stated in three places and derived in none: this CHECK, the zod
-- enum `projectCapability` (packages/contracts/src/project-access.ts) and the
-- TypeScript union `ProjectCapability` (packages/domain/src/authz.ts).
-- packages/testing/src/capability-vocabulary.test.ts asserts the first two
-- enumerate the same set. 0044:48-55 records what happens when they do not move
-- together; §11 item 6 restates the obligation.
--
-- A WIDENING. The fifteen values 0045 §1 left in place are a subset of the
-- sixteen here, so validation against existing grant rows cannot fail.
-- ===========================================================================
alter table public.project_access_grants
  drop constraint project_access_grants_capability_check;
alter table public.project_access_grants
  add constraint project_access_grants_capability_check
  check (capability = any (array[
    'project.admin','project.view','contracts.edit','imports.manage','imports.publish',
    'assignments.manage','progress.record','progress.adjust','evidence.record',
    'rule_bindings.manage','requirements.assign',
    'requirement_exceptions.decide','evidence_decisions.decide','stage_closures.close',
    'readiness.view',
    'statutory_acts.compose']));

-- ===========================================================================
-- 2. The composite uniques that back the new foreign keys
--
-- Same move as 0015:13-28, 0043:293-324, 0045:350-392 and 0046:194-196: a
-- table's existing uniques cannot back the references the new tables need, so
-- the keys are declared before the tables that use them.
--
-- All seven are (an already-unique key) + (extra columns), so no two rows can
-- collide on them that did not already collide on the narrower key, and
-- validation against existing rows cannot fail. The narrower keys are
-- public.stage_closures (workspace_id, id), public.work_stages
-- (workspace_id, project_id, id), public.work_assignments (workspace_id, id),
-- public.work_items (workspace_id, id), public.progress_entries
-- (workspace_id, id), public.project_parties (workspace_id, project_id, id) and
-- public.party_contacts (workspace_id, id).
--
-- FIVE OF THE SEVEN ARE ON DEPLOYED TABLES THAT MAY HOLD ROWS. 0043's and 0045's
-- keys were all on tables their own migration had just created empty; these are
-- not. Validation still cannot fail, for the reason above, but each takes an
-- ACCESS EXCLUSIVE lock and builds an index, and that is worth saying out loud
-- rather than discovering in a deploy window.
--
-- EVERY ONE IS NAMED. PostgreSQL's auto-name for five and six columns exceeds the
-- 63-byte identifier limit and truncates, and a clipped name is one no rollback
-- line can reproduce (0043:411-413).
-- ===========================================================================

-- The whole act pin, in one key. An act is a by-product of ONE closure, and the
-- project, contract, assignment and stage it claims are the closure's own —
-- restated by the caller nowhere. Without this the act would need three separate
-- foreign keys into public.stage_closures (0045 declared the stage pin and the
-- assignment pin as separate keys for its own purposes) and could still carry a
-- contract_id belonging to a different contract of the same tenant.
alter table public.stage_closures
  add constraint stage_closures_act_pin_key
  unique (workspace_id, id, project_id, contract_id, work_assignment_id, work_stage_id);

-- An act by the form of Додаток В exists for a CONCEALED stage. ADR-005
-- decision 10, state-catalog.csv:47 and transition-catalog.csv:54 all say it in
-- terms — «a concealed stage produces a draft statutory act». Pinning
-- is_concealed through a key rather than copying the flag means the act cannot
-- claim a concealment the stage does not have.
alter table public.work_stages
  add constraint work_stages_concealment_key
  unique (workspace_id, project_id, id, is_concealed);

-- The line an assignment is a slice of. §5's printed quantity has to resolve
-- against the SAME work item the act's assignment covers, or a share of an entry
-- on another line would print under this act's heading.
alter table public.work_assignments
  add constraint work_assignments_line_key
  unique (workspace_id, id, work_item_id);

-- The canonical unit of the line, with its precision. INV-073 says a printed
-- quantity is a share of a recorded entry «in that entry's canonical unit», and
-- this is the key that makes the unit a PIN rather than a choice: §5 has no unit
-- selector because the unit resolves out of the work item and cannot be anything
-- else.
--
-- SAFE TO PIN BY FOREIGN KEY, AND THE REASON IS THE VERSION'S STATUS, NOT THE
-- TABLE'S. This paragraph read «safe because public.work_items is APPEND-ONLY —
-- work_items_immutable (0013:30-31) refuses every update and delete». That was
-- true when it was written and is false in this chain: 0042:355 DROPS
-- work_items_immutable, 0042:382 grants update and delete on the table, and
-- app.guard_work_item() (0042 §3) permits a correction to a DRAFT line — and
-- unit_definition_id and unit_precision are not in the tuple that guard pins
-- (0042:337-343), so on a draft they can both move. Corrected in place on
-- 2026-08-08; 0047 has never been applied anywhere, so the comment is edited
-- rather than superseded, and the SQL below is unchanged because the conclusion
-- it rests on is unchanged.
--
-- THE GUARANTEE THAT ACTUALLY HOLDS. An act reaches a work item only through the
-- assignment it covers, and the chain is all foreign keys:
-- statutory_act_version_quantities → statutory_act_versions on (workspace_id,
-- statutory_act_version_id, project_id, work_assignment_id, work_item_id) → the
-- act identity row on the same pair (statutory_act_versions_act_fkey) →
-- public.work_assignments on (workspace_id, work_assignment_id, work_item_id),
-- which is statutory_acts_line_fkey resolving against work_assignments_line_key
-- added above. And public.work_assignments is itself structurally confined to a
-- PUBLISHED baseline by work_assignments_published_baseline_fkey (0043:386-389,
-- on the terminal-status literal 0043:343-353 explains). app.guard_work_item() raises
-- on every update and every delete of a line whose contract version is not a
-- draft (0042:324-328, INV-015). So a line an act can name is a line of a
-- published version, and no column of it — the two unit columns included — can
-- move again. This key therefore cannot refuse a correction the database would
-- otherwise have allowed, because on these rows there is no such correction.
-- If a later slice ever lets a published line be edited, this FK and INV-073's
-- «canonical unit» both stop being true in the same instant.
alter table public.work_items
  add constraint work_items_unit_key
  unique (workspace_id, id, unit_definition_id, unit_precision);

-- The recorded fact a printed quantity is a share OF. Five columns beyond the
-- identity, and each closes a way the printed number could be wrong while every
-- row still resolved: work_assignment_id and work_item_id put the entry on THIS
-- act's line, entry_kind forces a ROOT (an adjustment is a correction to a root,
-- not a quantity of its own), and quantity copies the recorded figure INTO the
-- act row so the share is taken of a number nobody typed. Safe because
-- public.progress_entries is append-only (0016) — quantity never moves.
alter table public.progress_entries
  add constraint progress_entries_act_source_key
  unique (workspace_id, id, work_assignment_id, work_item_id, entry_kind, quantity);

-- A signatory names a party THROUGH its recorded relationship to this project.
-- The party and the relationship both travel into the foreign key, so the
-- technical-supervision slot cannot be filled by a row that says «customer» and
-- an act cannot invent a participant that the project record does not carry.
alter table public.project_parties
  add constraint project_parties_act_pin_key
  unique (workspace_id, project_id, id, party_id, relationship);

-- And the person named in a slot belongs to that party.
alter table public.party_contacts
  add constraint party_contacts_party_key
  unique (workspace_id, id, party_id);

-- ===========================================================================
-- 3. statutory_acts — the identity, and the closure it is a by-product of
--
-- ADR-005 decision 10: closing a concealed stage whose requirements are
-- satisfied produces a draft act. The relational shape carries the whole of
-- «by-product of a SATISFIED closure»: the only foreign key into this row's
-- provenance targets public.stage_closures, and 0045 makes a stage_closures row
-- storable only when can_close_stage held over the stage's complete frozen
-- obligation set. THERE IS NO RELATIONAL PATH FROM AN UNEVIDENCED CLOSURE TO AN
-- ACT, because public.unevidenced_closures does not exist in v0.1 and this table
-- could not reference it if it did.
--
-- INV-084: in v0.1 the pin is the STAGE CLOSURE and never a package version
-- (ADR-006 decision 4.5). There is no package_version_id column here, and the
-- v0.2 slice that ships packages owes the migration that adds the additional pin
-- to acts written during the pilot — invariant-catalog.csv:85 states that debt
-- and this file does not discharge it.
-- ===========================================================================
create table public.statutory_acts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  -- Departure 7.
  project_id uuid not null,
  contract_id uuid not null,
  work_assignment_id uuid not null,
  work_item_id uuid not null,
  work_stage_id uuid not null,
  stage_closure_id uuid not null,
  -- Pinned FROM the stage, never restated. An act by the form of Додаток В
  -- exists for a concealed stage; the coupling CHECK is below rather than a bare
  -- `check (stage_is_concealed)` so that the v0.2 Додаток Г slice, which covers
  -- responsible structures and is not limited to concealed work, needs no change
  -- here.
  stage_is_concealed boolean not null,

  -- 'dodatok_g' stays in the vocabulary for additivity and is shut by the named
  -- v0.1 constraint below (departure 5).
  act_form text not null default 'dodatok_v'
    check (act_form in ('dodatok_v','dodatok_g')),
  -- PROHIBITION G. No source establishes which Додаток Н position takes which
  -- form. Two values, both of which say «the product chose this»: there is no
  -- third value, and no norm-reference column anywhere on this table, so the
  -- mapping cannot be recorded as a norm even by a caller that wants to.
  act_form_basis text not null default 'product_assumption'
    check (act_form_basis in ('product_assumption','user_selected')),

  composed_by_member_id uuid not null,
  created_at timestamptz not null default now(),

  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  -- ONE act identity per closure. A second act for the same closure would be a
  -- second document asserting the same event, and «correction is a successor
  -- VERSION» (§4) is the only correction this milestone has.
  constraint statutory_acts_closure_key unique (workspace_id, stage_closure_id),
  -- backs §4's act pin: a version inherits the act's whole scope rather than
  -- restating any part of it
  constraint statutory_acts_version_pin_key
    unique (workspace_id, id, project_id, contract_id, work_assignment_id, work_item_id),

  -- ONE key, ONE foreign key, five facts: this closure is in this project, on
  -- this contract, under this assignment, and it closed this stage.
  constraint statutory_acts_closure_fkey
    foreign key (workspace_id, stage_closure_id, project_id, contract_id,
                 work_assignment_id, work_stage_id)
    references public.stage_closures
      (workspace_id, id, project_id, contract_id, work_assignment_id, work_stage_id),
  constraint statutory_acts_stage_fkey
    foreign key (workspace_id, project_id, work_stage_id, stage_is_concealed)
    references public.work_stages (workspace_id, project_id, id, is_concealed),
  constraint statutory_acts_line_fkey
    foreign key (workspace_id, work_assignment_id, work_item_id)
    references public.work_assignments (workspace_id, id, work_item_id),
  constraint statutory_acts_member_fkey
    foreign key (workspace_id, composed_by_member_id)
    references public.memberships (organization_id, id),

  -- «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ» is the act for CONCEALED works. Written
  -- against act_form rather than unconditionally so that v0.2's Додаток Г — the
  -- responsible-structures form, which no source limits to concealed work — is an
  -- addition to the CHECK and not a rewrite of it.
  constraint statutory_acts_concealment_check
    check (act_form <> 'dodatok_v' or stage_is_concealed),

  -- DEPARTURE 5. v0.1 renders form В only (entity-catalog.csv:62;
  -- version-0.1.md §v0.1-M4 exclusions: «Додаток Г is not rendered in v0.1» —
  -- step 4 names Додаток В, the ICP is MEP and electrical installation, and
  -- prohibition H forbids calling electrical installations «відповідальні
  -- конструкції», so form Г has no v0.1 use). THE v0.2 Г SLICE DROPS EXACTLY
  -- THIS CONSTRAINT AND NOTHING ELSE.
  constraint statutory_acts_v01_form_v_only_check check (act_form = 'dodatok_v')
);

comment on table public.statutory_acts is
  'Stable identity of the act produced as a by-product of a SATISFIED stage closure '
  '(ADR-005 decision 10). The only provenance foreign key targets '
  'public.stage_closures, so there is no relational path from an unevidenced closure '
  'to an act. In v0.1 the act version is pinned by that closure and never by a '
  'package version (INV-084; ADR-006 decision 4.5), and the v0.2 package slice owes '
  'the migration that adds the additional pin to acts written during the pilot. '
  'v0.1 renders FORM В ONLY: ''dodatok_g'' stays in the vocabulary so v0.2 is '
  'additive, and statutory_acts_v01_form_v_only_check is the single named '
  'constraint that slice drops. act_form_basis records the В/Г choice as the '
  'PRODUCT''S ASSUMPTION — hidden-works-content-rules.md prohibition G, «no source '
  'establishes which Додаток Н position takes which act» — and this table carries no '
  'column in which a norm reference for it could be stored. APPEND-ONLY: nothing on '
  'this row can change, and everything a composer edits lives on the draft version.';

create index statutory_acts_stage_idx
  on public.statutory_acts (workspace_id, work_stage_id);

-- ===========================================================================
-- 4. statutory_act_versions — the immutable snapshot
--
-- INV-015: immutable once frozen, and a correction is a SUCCESSOR VERSION
-- assembled from newly recorded facts. Nothing is edited in place, and nothing
-- is edited at all once frozen — the guard in §7 rejects every update whose old
-- status is not 'draft', which makes 'frozen' terminal in the same way 0045 §6
-- made 'closed' terminal on public.work_stages.
--
-- THE ONE NORMATIVE STRING THIS TABLE CARRIES is the form citation, and it
-- carries its tag and its source in NOT NULL columns beside it. Allow-list item 3
-- licenses «форма за Додатком В (обов'язковим)» and its tag rests on the SINGLE
-- UNREPRODUCED ДБН FETCH recorded in hidden-works-content-rules.md §"Open items":
-- a source no reviewer can reopen leaves the tag asserted and the source gone.
-- The plan states the consequence in terms (2026-08-06-v0.1-implementation.md:265)
-- — «M4 cannot render a VERIFIED_PRIMARY string in a customer-facing artifact
-- until the retrieval record lands». THAT IS A GATE ON RENDERING, NOT ON THIS
-- COLUMN, and this schema cannot enforce it: what it can do is refuse to store an
-- act whose citation has no tag and no source at all, which is INV-073's storage
-- half and is what the three NOT NULLs below are.
--
-- WHAT IS NOT STORED HERE. The act's TITLE, its field labels, its resolution
-- block («На основі викладеного» — prohibition F: not «На підставі», which is
-- Додаток Г's wording), the required footer disclaimer and the довідковий
-- disclaimer under a generated requirement list are all TEMPLATE content, pinned
-- by form_template_key + form_template_version + form_template_hash and licensed
-- by the one citation above. Storing them as columns would name fields of Додаток
-- В, which ADR-005 decision 10 and schema-v0.1.sql:1600 both refuse to do and
-- which prohibition E makes dangerous: a column is a field, and a field nobody
-- sourced is a field somebody will fill.
-- ===========================================================================
create table public.statutory_act_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  statutory_act_id uuid not null,
  -- Pinned FROM the act (departure 7's argument applied to the line): §5's
  -- quantity rows resolve their progress entry against these two columns, so the
  -- entry cannot belong to another assignment or another line.
  work_assignment_id uuid not null,
  work_item_id uuid not null,

  version_no integer not null check (version_no >= 1),
  status text not null default 'draft' check (status in ('draft','frozen')),

  -- Departure 4. A correction is a successor version, and a successor is a
  -- successor OF SOMETHING FINISHED.
  predecessor_version_id uuid,
  predecessor_version_no integer,
  predecessor_status text check (predecessor_status is null or predecessor_status = 'frozen'),
  correction_reason text,

  -- The render template this version was assembled against. THE HASH IS NOT
  -- DECORATION: a version string can be left unchanged by a contributor who edits
  -- the template, and then two renders of one frozen act version differ with
  -- nothing in the record to say why. INV-015's determinism half is not a
  -- database rule (see the header); this is the column that makes a divergence
  -- attributable instead of arguable.
  form_template_key text not null check (length(btrim(form_template_key)) > 0),
  form_template_version text not null check (length(btrim(form_template_version)) > 0),
  form_template_hash text check (form_template_hash ~ '^[0-9a-f]{64}$'),

  -- INV-073, storage half: tag and source are NOT NULL, so an unsourced act is
  -- unrenderable because it is unstorable. The vocabulary is
  -- hidden-works-content-rules.md §"Verification vocabulary" minus UNVERIFIED,
  -- which «must never be shown as normative» and therefore has no business being
  -- storable on a document that is nothing but normative form.
  form_citation text not null check (length(btrim(form_citation)) > 0),
  form_citation_verification text not null
    check (form_citation_verification in ('VERIFIED_PRIMARY','VERIFIED_SECONDARY')),
  form_citation_source text not null check (length(btrim(form_citation_source)) > 0),

  -- The mandatory footer disclaimer prints «Перевірено за Реєстром будівельних
  -- норм: {дата останньої перевірки}». An act that cannot fill its own mandatory
  -- disclaimer must not freeze, so this is required at freeze — and it is a DATE
  -- a composer supplies, because M0 gate 10 owns the registry check and builds no
  -- fact table for it. See the header and §11 item 3.
  registry_checked_on date,

  renderer_version text check (renderer_version is null or length(btrim(renderer_version)) > 0),
  -- sha256 of the frozen render, lowercase hex — text with a hex CHECK rather
  -- than the target's bytea, matching public.import_files.content_hash and
  -- 0045's frozen set hash.
  content_hash text check (content_hash ~ '^[0-9a-f]{64}$'),
  frozen_at timestamptz,
  frozen_by_member_id uuid,

  composed_by_member_id uuid not null,
  -- Optimistic concurrency FOR THE DRAFT ONLY. A frozen version takes no update
  -- at all, so this column stops moving when the freeze lands.
  draft_version bigint not null default 1 check (draft_version >= 1),
  created_at timestamptz not null default now(),

  -- statutory_acts.compose is idempotent (scope-v0.1.csv:49, idempotency
  -- required). The key is scoped to the act, the shape 0045 used on all three of
  -- its command tables. statutory_act_versions.freeze writes no new row, so its
  -- idempotency is carried by public.idempotency_records alone — §11 item 7.
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),

  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  -- Departure 4, root and ordinal half.
  constraint statutory_act_versions_lineage_key
    unique (workspace_id, statutory_act_id, version_no),
  -- backs the contiguity FK, carrying the act and the predecessor's terminal
  -- status so a successor cannot supersede a version of another act, cannot skip
  -- an ordinal, and cannot be opened behind a version still being edited
  constraint statutory_act_versions_chain_key
    unique (workspace_id, id, statutory_act_id, version_no, status),
  -- Departure 4, fork half: no two successors from one predecessor
  constraint statutory_act_versions_no_fork_key
    unique (workspace_id, predecessor_version_id),
  -- backs §5's and §6's content rows. status is DELIBERATELY NOT IN THIS KEY: a
  -- child pinning the parent's status would make the freeze UPDATE fail against
  -- its own content rows.
  constraint statutory_act_versions_content_pin_key
    unique (workspace_id, id, project_id, work_assignment_id, work_item_id),
  constraint statutory_act_versions_idempotency_key
    unique (workspace_id, statutory_act_id, idempotency_key),

  constraint statutory_act_versions_act_fkey
    foreign key (workspace_id, statutory_act_id, project_id, contract_id,
                 work_assignment_id, work_item_id)
    references public.statutory_acts
      (workspace_id, id, project_id, contract_id, work_assignment_id, work_item_id),
  constraint statutory_act_versions_chain_fkey
    foreign key (workspace_id, predecessor_version_id, statutory_act_id,
                 predecessor_version_no, predecessor_status)
    references public.statutory_act_versions
      (workspace_id, id, statutory_act_id, version_no, status),
  constraint statutory_act_versions_composed_by_fkey
    foreign key (workspace_id, composed_by_member_id)
    references public.memberships (organization_id, id),
  constraint statutory_act_versions_frozen_by_fkey
    foreign key (workspace_id, frozen_by_member_id)
    references public.memberships (organization_id, id),

  constraint statutory_act_versions_chain_check
    check ((version_no = 1
             and predecessor_version_id is null and predecessor_version_no is null
             and predecessor_status is null)
        or (version_no > 1
             and predecessor_version_id is not null
             and predecessor_version_no = version_no - 1
             and predecessor_status = 'frozen')),
  -- A correction says why. A version that supersedes another and gives no reason
  -- is a correction nobody can audit — 0045:887-888 draws the same line on the
  -- closure lineage.
  constraint statutory_act_versions_correction_reason_check
    check (predecessor_version_id is null
        or length(btrim(coalesce(correction_reason, ''))) > 0),

  -- A DRAFT CARRIES NO FREEZE FACTS. Without this, a draft could be written with
  -- a content_hash and a frozen_at and read as frozen by anything that trusts the
  -- columns rather than the status.
  constraint statutory_act_versions_draft_clean_check
    check (status <> 'draft'
        or (frozen_at is null and frozen_by_member_id is null
            and content_hash is null and renderer_version is null
            and form_template_hash is null)),
  -- A FROZEN VERSION CARRIES ALL OF THEM, plus the date its mandatory disclaimer
  -- prints.
  constraint statutory_act_versions_frozen_complete_check
    check (status <> 'frozen'
        or (frozen_at is not null and frozen_by_member_id is not null
            and content_hash is not null and renderer_version is not null
            and form_template_hash is not null and registry_checked_on is not null))
);

comment on table public.statutory_act_versions is
  'Immutable once frozen (INV-015) and assembled ONLY from already-recorded facts. '
  'A correction is a SUCCESSOR VERSION behind a frozen predecessor, contiguous by '
  'ordinal and unforked; nothing is edited in place and a frozen row takes no update '
  'at all. In v0.1 the pin is the stage closure the parent act names, not a package '
  'version (INV-084). THE ONE NORMATIVE STRING HERE IS THE FORM CITATION and its '
  'verification tag and source are NOT NULL beside it, so an unsourced act is '
  'unrenderable because it is unstorable (INV-073, storage half); its tag rests on '
  'the single unreproduced ДБН fetch recorded in hidden-works-content-rules.md '
  '§"Open items", and rendering a VERIFIED_PRIMARY string in a customer-facing '
  'artifact is gated on that retrieval record landing, which no column here can '
  'enforce. Every other string of Додаток В is TEMPLATE content, pinned by '
  'form_template_key + form_template_version + form_template_hash: this table names '
  'no field of the form and adds none (prohibition E).';

comment on column public.statutory_act_versions.registry_checked_on is
  'The date the footer disclaimer prints — «Перевірено за Реєстром будівельних норм: '
  '{дата останньої перевірки}» (hidden-works-content-rules.md §"Required '
  'disclaimers"). Required at freeze, because an act that cannot fill its own '
  'mandatory disclaimer must not freeze. THERE IS NO FACT TABLE BEHIND IT: M0 gate 10 '
  'owns the registry check and builds none, so the composer supplies the date and the '
  'only thing this database checks is that it is not in the future. The approving '
  'order «наказ Мінрегіону від 05.05.2016 № 115» was REMOVED from that disclaimer on '
  '2026-08-06 and is asserted by no allow-list item; there is no column for it here '
  'and a template edit must not restore it.';

-- NO SEPARATE LINEAGE INDEX. statutory_act_versions_lineage_key already indexes
-- (workspace_id, statutory_act_id, version_no), which is the only order the act's
-- versions are ever read in; a second index on the same columns would be one more
-- thing to keep and nothing more to read by.

-- Departure 4, single-draft half. Two concurrent drafts of one act are two
-- candidate documents for one event, either of which could be frozen first; the
-- lineage ordinal alone does not stop them, because both would be legal
-- version_no values behind different predecessors only if the chain forked, and
-- version 2 twice is stopped by the lineage key while version 2 and version 3
-- both open is not.
create unique index statutory_act_versions_single_draft_uniq
  on public.statutory_act_versions (workspace_id, statutory_act_id)
  where status = 'draft';

-- ===========================================================================
-- 5. statutory_act_version_quantities — the only place a quantity can be
--
-- DEPARTURE 1. INV-073: «no render exposes a free-text quantity field and the
-- composer offers only progress entries already recorded against the line with a
-- share selector». The guarantee is structural here and not procedural: every
-- column that carries a number is either copied from a recorded fact by foreign
-- key or bounded by one.
--
-- Each row's foreign key into public.progress_entries carries six columns, and
-- every one of them closes a way the printed number could be wrong while the row
-- still resolved:
--
--   (a) THE ENTRY IS A ROOT. entry_kind is CHECK-forced to 'root'. An adjustment
--       is a correction TO a root, not a quantity of its own
--       (0015:149-153), and a share of a correction is not a quantity anybody
--       performed.
--   (b) THE ENTRY IS ON THIS ACT'S ASSIGNMENT AND THIS ACT'S LINE.
--       work_assignment_id and work_item_id travel from the version, which took
--       them from the act, which took them from the closure. A share of another
--       line's entry cannot be printed under this heading.
--   (c) THE RECORDED QUANTITY IS THE ENTRY'S OWN. source_recorded_quantity is not
--       a caller's claim about the entry: it is the entry's `quantity` column,
--       pinned by the key added in §2, and public.progress_entries is append-only
--       so it cannot move afterwards.
--
-- and the unit is not chosen at all: printed_unit_id and printed_unit_precision
-- resolve against public.work_items by foreign key, so «in that entry's canonical
-- unit» is a key rather than a convention, and there is no unit selector for a
-- composer to get wrong.
--
-- WHAT IS LEFT FOR THE COMPOSER, AND IS NAMED IN THE HEADER: the comparison
-- against the effective quantity after adjustments, which no foreign key may make
-- without refusing a later correction.
--
-- A CONSEQUENCE WORTH STATING: a share too small to print at the line's unit
-- precision is UNSTORABLE, because printed_quantity must be greater than zero and
-- must round to the unit's precision. That is deliberate. An act that prints
-- «0.000» as the quantity performed is worse than an act that refuses to be
-- composed, and the composer must refuse the share rather than print a zero.
-- ===========================================================================
create table public.statutory_act_version_quantities (
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  statutory_act_version_id uuid not null,
  work_assignment_id uuid not null,
  work_item_id uuid not null,

  root_progress_entry_id uuid not null,
  source_entry_kind text not null default 'root' check (source_entry_kind = 'root'),
  source_recorded_quantity numeric(20,6) not null
    constraint statutory_act_version_quantities_source_qty_check
      check (source_recorded_quantity > 0),
  source_quantity_share numeric(9,6) not null
    check (source_quantity_share > 0 and source_quantity_share <= 1),

  printed_unit_id uuid not null,
  printed_unit_precision smallint not null check (printed_unit_precision between 0 and 6),
  printed_quantity numeric(20,6) not null check (printed_quantity > 0),

  -- The order the lines print in. Deterministic ordering is part of INV-015's
  -- determinism half: `order by created_at` over rows written in one transaction
  -- is not an order.
  line_no integer not null check (line_no >= 1),
  created_at timestamptz not null default now(),

  -- One line per recorded entry. A composer cannot print two shares of one entry
  -- and reach a total the entry does not support.
  primary key (workspace_id, statutory_act_version_id, root_progress_entry_id),
  constraint statutory_act_version_quantities_line_no_key
    unique (workspace_id, statutory_act_version_id, line_no),

  constraint statutory_act_version_quantities_version_fkey
    foreign key (workspace_id, statutory_act_version_id, project_id,
                 work_assignment_id, work_item_id)
    references public.statutory_act_versions
      (workspace_id, id, project_id, work_assignment_id, work_item_id),
  constraint statutory_act_version_quantities_entry_fkey
    foreign key (workspace_id, root_progress_entry_id, work_assignment_id,
                 work_item_id, source_entry_kind, source_recorded_quantity)
    references public.progress_entries
      (workspace_id, id, work_assignment_id, work_item_id, entry_kind, quantity),
  constraint statutory_act_version_quantities_unit_fkey
    foreign key (workspace_id, work_item_id, printed_unit_id, printed_unit_precision)
    references public.work_items (workspace_id, id, unit_definition_id, unit_precision),

  -- A share of a recorded quantity is never more than the quantity.
  constraint statutory_act_version_quantities_share_check
    check (printed_quantity <= source_recorded_quantity),
  -- The printed number is the share, to within one unit in the last place of the
  -- line's own precision. Mode-agnostic on purpose — see the header.
  constraint statutory_act_version_quantities_rounding_check
    check (abs(printed_quantity - source_recorded_quantity * source_quantity_share)
           < power(10::numeric, (-printed_unit_precision)::numeric)),
  -- And it is not finer than the unit it is printed in.
  constraint statutory_act_version_quantities_precision_check
    check (round(printed_quantity, printed_unit_precision) = printed_quantity)
);

comment on table public.statutory_act_version_quantities is
  'THE ONLY PLACE A QUANTITY CAN BE STORED ON AN ACT, and every row of it is a share '
  'of one already-recorded root progress entry, in the canonical unit of the line '
  'that entry was recorded against, with the entry''s own recorded quantity pinned '
  'into the row by foreign key (INV-073). A number a human types is not storable '
  'because there is nowhere to put it — not because a validator rejects it. Built as '
  'a TABLE rather than as the four columns of schema-v0.1.sql:1619-1624 because '
  'ADR-005 decision 10 says the composer offers «quantity_entries» — plural — and one '
  'quadruple facing three recorded entries leaves only two options, dropping two of '
  'them or printing their sum, and their sum is not any recorded entry. Content of a '
  'DRAFT: editable while the version is draft, frozen with it by '
  'app.guard_statutory_act_content(), and never afterwards.';

-- ===========================================================================
-- 6. statutory_act_version_signatories — exactly three typed slots
--
-- DEPARTURE 2. п. 8.4.3.5 names three: будівельна організація, технічний нагляд
-- замовника, авторський нагляд (ADR-005 decision 10; glossary.md §"Signatory
-- slot"). The primary key on (version, slot) over a three-value CHECK makes a
-- FOURTH SIGNATORY a constraint violation — prohibition E bans one, and
-- hidden-works-content-rules.md §"Open items" records that a Київводоканал blank
-- reportedly carries one, «two passes agree, neither fetched the file», which is
-- exactly the pressure this key exists to resist.
--
-- NOTHING IS STORED FOR THE КВАЛІФІКАЦІЙНИЙ СЕРТИФІКАТ. Allow-list item 10
-- establishes that технагляд HOLDS one; whether Додаток В has a slot for its
-- серія and номер is NOT ESTABLISHED, and prohibition E bans the adjacent «ким
-- видана». There is no certificate column here and no issuer column anywhere, so
-- the act has nothing to print for it even if a template asked.
--
-- AND NOTHING HERE IS A SIGNATURE. A row carries a slot, a participant and a
-- frozen name. There is no signature column, no assurance_label, no signed_at and
-- no acceptance: in v0.1 a signatory slot is a TYPED SLOT on a document that is
-- printed and signed elsewhere, and the assurance ladder's standing rule — «a
-- filled slot at level 3 is a filled slot at level 3» — has nothing to attach to
-- here because v0.1 records no in-product signature of an act at all. The only
-- assurance-bearing record v0.1 has is
-- requirement_evidence_decisions.assurance_label (0045:617), which the act reads
-- through the closure's frozen occurrence set. Prohibition S is a render rule and
-- stays one; see the header.
--
-- THE SLOT-TO-RELATIONSHIP MAP IS THE PRODUCT'S ASSUMPTION AND IS NAMED SO. It
-- maps п. 8.4.3.5's three roles onto public.project_parties.relationship's seven
-- values (0010:157-159). No document in this package states that map. It is
-- enforced by ONE named constraint so that a pilot which needs another
-- relationship changes a constraint somebody can find, rather than discovering
-- that the technical-supervision slot was filled by the customer.
--
-- ONE CONSEQUENCE OF THE PARTY PIN, STATED BECAUSE IT IS A REFUSAL NOBODY ASKED
-- FOR. public.project_parties is not append-only, and the foreign key below
-- carries `relationship`, so an in-place UPDATE of a project party's relationship
-- is refused while an act names it. That is defensible — the relationship IS part
-- of that table's natural key (0010:167), a party whose role on a project changes
-- gets a row for the new role, and a frozen act must keep naming the role it was
-- signed under — and it is deliberate rather than incidental. It is also the same
-- trade the header refuses for the effective quantity, and the two differ for a
-- reason: refusing a role edit blocks an administrative correction, while
-- refusing a quantity adjustment would break INV-065 and stop a crew recording
-- what it did. §11 item 11.
-- ===========================================================================
create table public.statutory_act_version_signatories (
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  statutory_act_version_id uuid not null,

  slot text not null
    check (slot in ('builder','technical_supervision','designer_supervision')),

  project_party_id uuid not null,
  party_id uuid not null,
  party_relationship text not null check (party_relationship in
    ('customer','general_contractor','subcontractor','technical_supervision',
     'designer','performer','other')),
  party_contact_id uuid not null,

  -- The frozen copies. An act version is a snapshot (INV-015): if a participant
  -- record is corrected next month the frozen act still renders what it froze, so
  -- the strings have to be here. They are COPIES OF RECORDED FACTS and never free
  -- text — which record each one came from is recorded beside it, and the two
  -- source versions let a reviewer see whether the record has moved since. The
  -- database cannot check that a copy still equals its source; a foreign key onto
  -- a participant's `version` would refuse a later correction to a participant
  -- record for no better reason than that an act once quoted it.
  -- Both CHECKs are NAMED rather than left to PostgreSQL: the auto-names here
  -- would be 64 and 71 bytes and would truncate at 63 (0043:411-413).
  frozen_organization_name text not null
    constraint statutory_act_version_signatories_org_name_check
      check (length(btrim(frozen_organization_name)) > 0),
  frozen_organization_name_source text not null
    constraint statutory_act_version_signatories_org_name_source_check
      check (frozen_organization_name_source in
        ('legal_profile_official_name','party_display_name')),
  frozen_person_name text not null check (length(btrim(frozen_person_name)) > 0),
  -- «посада» is the participant's recorded role title. Nullable because
  -- public.party_contacts.role_title is (0010:124), and no constraint here may
  -- make a field mandatory that the form is not established to have.
  frozen_person_role_title text,
  source_party_version bigint not null,
  source_contact_version bigint not null,
  created_at timestamptz not null default now(),

  -- EXACTLY ONE ROW PER SLOT, AND EXACTLY THREE SLOTS EXIST.
  primary key (workspace_id, statutory_act_version_id, slot),

  constraint statutory_act_version_signatories_version_fkey
    foreign key (workspace_id, project_id, statutory_act_version_id)
    references public.statutory_act_versions (workspace_id, project_id, id),
  -- The participant, the party behind it and the relationship it holds, in one
  -- key: an act cannot invent a participant the project record does not carry,
  -- and cannot restate the relationship differently from the project record.
  constraint statutory_act_version_signatories_party_fkey
    foreign key (workspace_id, project_id, project_party_id, party_id, party_relationship)
    references public.project_parties (workspace_id, project_id, id, party_id, relationship),
  -- And the person belongs to that party.
  constraint statutory_act_version_signatories_contact_fkey
    foreign key (workspace_id, party_contact_id, party_id)
    references public.party_contacts (workspace_id, id, party_id),

  -- THE PRODUCT'S ASSUMPTION, ENFORCED AND NAMED AS AN ASSUMPTION. No source maps
  -- п. 8.4.3.5's three roles onto this database's seven relationship values; a
  -- pilot that needs another mapping changes this constraint and records why.
  -- The name is 60 bytes and is deliberately not longer: PostgreSQL truncates an
  -- identifier at 63 and a clipped name is one no rollback line can reproduce
  -- (0043:411-413).
  constraint statutory_act_version_signatories_slot_role_assumption_check
    check ((slot = 'technical_supervision' and party_relationship = 'technical_supervision')
        or (slot = 'designer_supervision'  and party_relationship = 'designer')
        or (slot = 'builder'
            and party_relationship in ('general_contractor','subcontractor','performer')))
);

comment on table public.statutory_act_version_signatories is
  'The three typed signatory slots of п. 8.4.3.5 — будівельна організація, технічний '
  'нагляд замовника, авторський нагляд — as ROWS with typed columns rather than as '
  'the three jsonb columns of schema-v0.1.sql:1632-1634. Three jsonb columns do stop '
  'a fourth SLOT and do nothing at all about a banned FIELD: «ким видана» is a key '
  'inside a blob, added without a migration and reviewed by nobody, and prohibition E '
  'is a rule about fields. Here a fourth slot violates the primary key and a banned '
  'field needs a migration somebody reads. NOTHING IS STORED FOR THE КВАЛІФІКАЦІЙНИЙ '
  'СЕРТИФІКАТ: allow-list item 10 establishes that технагляд HOLDS one, whether '
  'Додаток В has a slot for its серія and номер is NOT established, and there is no '
  'certificate column here or issuer column anywhere. AND NOTHING HERE IS A '
  'SIGNATURE — no signature, no assurance level, no signed_at: in v0.1 a slot is a '
  'typed slot on a document signed elsewhere, and prohibition S stays a render rule '
  'because this table stores no rendered word to mislabel. The slot-to-relationship '
  'map is the PRODUCT''S ASSUMPTION; no document in this package states it.';

-- ===========================================================================
-- 7. The draft/freeze guard, and the content lock behind it
--
-- 0042 replaced contract_versions_immutable with app.guard_contract_version();
-- 0045 §6 replaced work_stages_immutable with app.guard_work_stage(). This is the
-- same shape for the same reason: the table has exactly one legal transition and
-- a blanket app.reject_mutation() cannot express it, while a bare grant can
-- express far too much.
--
-- THE ARITHMETIC, so a reviewer can check it. The guard rejects every delete;
-- rejects every update whose old status is not 'draft', which makes 'frozen'
-- TERMINAL and INV-015 a schema rule rather than a sentence; rejects any change
-- to identity, lineage, scope, provenance or idempotency, in a draft as much as
-- out of one; and requires draft_version to advance by exactly one, which makes
-- the expected-version discipline structural — two commands that both read
-- version N cannot both write N+1.
-- ===========================================================================
create or replace function app.guard_statutory_act_version() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'a statutory act version is never deleted; a correction is a successor version (INV-015)';
  end if;

  if old.status <> 'draft' then
    raise exception
      'statutory act version % is frozen and is immutable; correct it with a successor version (INV-015)',
      old.id;
  end if;

  if new.status not in ('draft','frozen') then
    raise exception 'a statutory act version moves only draft -> frozen (attempted %)', new.status;
  end if;

  if (new.id, new.workspace_id, new.project_id, new.contract_id, new.statutory_act_id,
      new.work_assignment_id, new.work_item_id, new.version_no,
      new.predecessor_version_id, new.predecessor_version_no, new.predecessor_status,
      new.composed_by_member_id, new.created_at,
      new.idempotency_key, new.request_hash)
     is distinct from
     (old.id, old.workspace_id, old.project_id, old.contract_id, old.statutory_act_id,
      old.work_assignment_id, old.work_item_id, old.version_no,
      old.predecessor_version_id, old.predecessor_version_no, old.predecessor_status,
      old.composed_by_member_id, old.created_at,
      old.idempotency_key, old.request_hash) then
    raise exception
      'the identity, lineage, scope and provenance of statutory act version % are fixed at composition',
      old.id;
  end if;

  if new.draft_version <> old.draft_version + 1 then
    raise exception
      'editing a draft act version must advance draft_version exactly once (% -> %)',
      old.draft_version, new.draft_version;
  end if;

  if new.status = 'frozen' then
    -- The columns themselves are covered by
    -- statutory_act_versions_frozen_complete_check; what a CHECK cannot see is
    -- the clock. An act that claims it was checked against the Реєстр
    -- будівельних норм on a date that has not happened is a false regulatory
    -- claim printed in a mandatory disclaimer, which is the exact failure class
    -- hidden-works-content-rules.md exists to prevent. ONE DAY OF SLACK IS A
    -- TIMEZONE ALLOWANCE AND NOT A BUSINESS RULE: the disclaimer's date is a
    -- civil date, this database compares in UTC, and Ukraine is ahead of it.
    if new.registry_checked_on > ((now() + interval '1 day') at time zone 'UTC')::date then
      raise exception
        'a statutory act cannot claim a Реєстр будівельних норм check dated in the future (%)',
        new.registry_checked_on;
    end if;
    if new.frozen_at < old.created_at then
      raise exception 'a statutory act version cannot be frozen before it was composed';
    end if;
  end if;

  return new;
end $$;
revoke all on function app.guard_statutory_act_version() from public;

create trigger statutory_act_versions_guard before update or delete
  on public.statutory_act_versions
  for each row execute function app.guard_statutory_act_version();

-- ---------------------------------------------------------------------------
-- The content of a frozen version is frozen with it.
--
-- §5 and §6 are DRAFT CONTENT: a composer adds and removes quantity lines and
-- signatories before the freeze, so unlike 0045's frozen occurrence set they
-- cannot be append-only. What they must be is SHUT once the parent freezes,
-- because a snapshot that can gain a signatory afterwards is not a snapshot and
-- INV-015 is the invariant this whole table set exists to carry.
--
-- Keyed on the parent's STATUS rather than on its xmin (0045:1022-1048 uses xmin
-- because a closure's set is fixed in the closure's own transaction; a draft's is
-- not), and NOT security definer, deliberately: it reads under the mutating role,
-- so if RLS hides the parent the guard raises rather than proceeding on a NULL.
-- That is 0042:288-291's argument and failing on an invisible parent is the safe
-- direction here too.
-- ---------------------------------------------------------------------------
create or replace function app.guard_statutory_act_content() returns trigger
language plpgsql as $$
declare
  v_workspace uuid;
  v_version   uuid;
  v_status    text;
begin
  if tg_op = 'DELETE' then
    v_workspace := old.workspace_id;
    v_version   := old.statutory_act_version_id;
  else
    v_workspace := new.workspace_id;
    v_version   := new.statutory_act_version_id;
  end if;

  select v.status into v_status
    from public.statutory_act_versions v
   where v.workspace_id = v_workspace and v.id = v_version;

  if v_status is null then
    raise exception 'statutory act version % is not visible in this workspace', v_version;
  end if;

  if v_status <> 'draft' then
    raise exception
      'statutory act version % is frozen; its % are part of the snapshot and cannot be changed (INV-015)',
      v_version, tg_table_name;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;
revoke all on function app.guard_statutory_act_content() from public;

create trigger statutory_act_version_quantities_content_guard
  before insert or update or delete on public.statutory_act_version_quantities
  for each row execute function app.guard_statutory_act_content();

create trigger statutory_act_version_signatories_content_guard
  before insert or update or delete on public.statutory_act_version_signatories
  for each row execute function app.guard_statutory_act_content();

-- ---------------------------------------------------------------------------
-- THE COMPLETENESS CHECK AT FREEZE.
--
-- schema-v0.1.sql:1656-1657 states the rule the target could express in a CHECK
-- because its signatories were columns: a frozen act version carries a
-- будівельна організація and a технічний нагляд. With departure 2's rows the same
-- rule needs a trigger, and it needs to be DEFERRED, because the freeze update
-- and the last signatory insert are in one transaction and the route may write
-- them in either order.
--
-- SECURITY DEFINER, for 0045:1066-1073's reason exactly: the function COUNTS rows
-- it must not miss. Read under the mutating role, a signatory row hidden by RLS
-- would be counted as absent and the check would refuse a complete act — and,
-- worse in the other direction, any future count that must not be under-read
-- would FAIL OPEN. It authorizes first, on the same capability the update policy
-- demands, so it is not an oracle for a project the caller does not already hold
-- (0017:78-81, applied before any count is read).
--
-- WHAT IT DOES NOT REQUIRE, and this is a judgement rather than an oversight:
--   * авторський нагляд. schema-v0.1.sql:1656-1657 makes the third slot optional
--     and п. 8.4.3.5 is quoted by no document in this package as making it
--     conditional. Following the target here means a two-signatory act can
--     freeze; §11 item 8 records the question rather than a constraint answering
--     it by omission.
--   * AT LEAST ONE PRINTED QUANTITY. The target's quadruple is entirely nullable,
--     so zero printed quantities is the shape it admits, and whether Додаток В's
--     field list makes a quantity mandatory is exactly the thing that is not
--     established. A frozen act with no quantity line is representable and the
--     composer owes the product decision.
-- ---------------------------------------------------------------------------
create or replace function app.assert_statutory_act_version_complete() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_missing text;
begin
  if not app.has_project_capability(new.workspace_id, new.project_id,
                                    array['statutory_acts.compose']) then
    raise exception 'not authorized to freeze a statutory act in this project';
  end if;

  select string_agg(required.slot, ', ' order by required.slot) into v_missing
    from (values ('builder'::text), ('technical_supervision'::text)) as required(slot)
   where not exists (
     select 1 from public.statutory_act_version_signatories s
      where s.workspace_id = new.workspace_id
        and s.statutory_act_version_id = new.id
        and s.slot = required.slot);

  if v_missing is not null then
    raise exception
      'statutory act version % cannot be frozen without its % signatory slot(s) (п. 8.4.3.5)',
      new.id, v_missing;
  end if;

  return null;
end $$;
revoke all on function app.assert_statutory_act_version_complete() from public;

create constraint trigger statutory_act_versions_freeze_complete
  after update on public.statutory_act_versions
  deferrable initially deferred
  for each row when (new.status = 'frozen')
  execute function app.assert_statutory_act_version_complete();

-- ===========================================================================
-- 8. Grants allowlist
--
-- Route by route, so an unused grant is visible:
--   statutory_acts                        SELECT  statutory_acts.get,
--                                                 statutory_acts.render
--                                         INSERT  statutory_acts.compose
--   statutory_act_versions                SELECT  statutory_acts.get, .render
--                                         INSERT  statutory_acts.compose — the
--                                                 first draft, and every
--                                                 correction's successor draft
--                                         UPDATE  the draft edits, and
--                                                 statutory_act_versions.freeze
--   statutory_act_version_quantities      SELECT  the act's own reads
--                                 INSERT/UPDATE/DELETE  composing a draft
--   statutory_act_version_signatories     SELECT  the act's own reads
--                                 INSERT/UPDATE/DELETE  composing a draft
--
-- NO UPDATE AND NO DELETE ON public.statutory_acts: the identity row is
-- append-only (departure 3) and nothing on it can change.
--
-- NO DELETE ON public.statutory_act_versions: a draft that was composed by
-- mistake is superseded, not removed. The row records that somebody composed an
-- act against a closure, which is a fact about the workflow even when the
-- document is wrong — and a delete grant on this table is the one that would let
-- a frozen version disappear if the guard were ever lost.
--
-- DELETE IS GRANTED ON THE TWO CONTENT TABLES because composing is iterative: a
-- quantity line chosen and then unchosen has to be removable while the version is
-- a draft. app.guard_statutory_act_content() is what stops that grant reaching a
-- frozen version, and it is a trigger rather than a grant for 0045:1463-1466's
-- reason — a grant can be re-issued by a later migration that never read this one.
--
-- aktflow_service GETS NOTHING HERE. event-catalog.csv:28 names projection_rebuilder as
-- the consumer of statutory_act_version.frozen, and a projection rebuilder READS
-- these tables (through aktflow_app membership, 0034) and writes
-- public.readiness_projection. Nothing about an act is written by a worker in
-- v0.1: package_artifacts and worker.artifact_renderer are v0.2, and
-- statutory_acts.render is a MEMBER-plane query that renders on demand
-- (capabilities.csv:41, corrected 2026-08-06).
-- ===========================================================================
revoke all on
    public.statutory_acts, public.statutory_act_versions,
    public.statutory_act_version_quantities, public.statutory_act_version_signatories
  from public, anon, authenticated;

grant select, insert                 on public.statutory_acts                     to aktflow_app;
grant select, insert, update         on public.statutory_act_versions             to aktflow_app;
grant select, insert, update, delete on public.statutory_act_version_quantities   to aktflow_app;
grant select, insert, update, delete on public.statutory_act_version_signatories  to aktflow_app;

-- ===========================================================================
-- 9. Append-only enforcement — the layer beyond grants
--
-- app.reject_mutation() is 0013:5-9 and is reused unchanged. A grant can be
-- re-issued by a later migration that did not read this one; the trigger cannot
-- be lost by accident, and an append-only table quietly losing its guard is a
-- failure this repository has already had once (0042:59-65).
--
-- public.statutory_act_versions is NOT in this list: it is the one table here
-- with a legal update, and §7's guard is what expresses it.
-- ===========================================================================
create trigger statutory_acts_immutable before update or delete
  on public.statutory_acts
  for each row execute function app.reject_mutation();

-- ===========================================================================
-- 10. RLS
--
-- Every write policy names the capability the route checks. 0014 exists because
-- M1's write policies asked only for active membership, so the database could not
-- catch a command-layer mistake; 0016:90-93 says that must not recur, and it does
-- not recur here.
--
-- THE READ SIDE IS statutory_acts.compose, WHICH IS NOT AN OVERSIGHT AND IS NOT
-- COMFORTABLE. technical/permissions/capabilities.csv:32 puts all four M4
-- operations — compose, freeze, get and render — behind that one capability_id,
-- so a member who may READ an act may also COMPOSE one. project.admin is admitted
-- alongside it so the pilot owner is not locked out of the document its own
-- workflow produces: statutory_acts.compose appears in NO row of
-- technical/permissions/responsibility-presets.csv, which is M1 review finding 8
-- and M3 review finding 5 arriving a third time. Widening this policy to
-- project.view would be a permissions decision taken in a migration, and §11
-- item 6 records it instead.
--
-- THE CONTENT TABLES INHERIT THE SAME PAIR. They are not separately readable and
-- not separately writable: a quantity line is part of the act, not a thing of its
-- own, and a second capability on it would be a second answer to «who may see
-- this document».
-- ===========================================================================
alter table public.statutory_acts                    enable row level security;
alter table public.statutory_act_versions            enable row level security;
alter table public.statutory_act_version_quantities  enable row level security;
alter table public.statutory_act_version_signatories enable row level security;

create policy sa_select on public.statutory_acts for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['statutory_acts.compose','project.admin']));
create policy sa_insert on public.statutory_acts for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['statutory_acts.compose']));

create policy sav_select on public.statutory_act_versions for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['statutory_acts.compose','project.admin']));
create policy sav_insert on public.statutory_act_versions for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['statutory_acts.compose']));
-- The `using` clause names the state the policy may act on, so a frozen version
-- is refused by the policy as well as by the guard — 0045:1552-1557 draws the
-- same line on public.work_stages, and the reason is the same: a guard is the
-- last defence and should not be the only one.
create policy sav_update on public.statutory_act_versions for update to aktflow_app
  using (status = 'draft'
    and app.has_project_capability(workspace_id, project_id,
        array['statutory_acts.compose']))
  with check (status in ('draft','frozen')
    and app.has_project_capability(workspace_id, project_id,
        array['statutory_acts.compose']));

create policy savq_select on public.statutory_act_version_quantities
  for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['statutory_acts.compose','project.admin']));
create policy savq_write on public.statutory_act_version_quantities
  for all to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['statutory_acts.compose']))
  with check (app.has_project_capability(workspace_id, project_id,
              array['statutory_acts.compose']));

create policy savs_select on public.statutory_act_version_signatories
  for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['statutory_acts.compose','project.admin']));
create policy savs_write on public.statutory_act_version_signatories
  for all to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['statutory_acts.compose']))
  with check (app.has_project_capability(workspace_id, project_id,
              array['statutory_acts.compose']));

-- ===========================================================================
-- 11. What the catalogs, the content rules and the route slice owe, recorded
--     here rather than edited into them
--
-- A migration that edits prose is a migration nobody can review (0042:497-508,
-- 0043:1005-1038, 0045:1651-1652). Eleven items are owed by this slice and none
-- is made here:
--
--   1. THE В.1/В.2 FIELD LIST IS COMMITTED NOWHERE. Allow-list item 3 licenses
--      «every field of В.1 and В.2, in the standard's order»;
--      docs/delivery/test-strategy.md:139-152 records that no such enumeration
--      exists in this repository and that no test may substitute one typed from
--      memory. Until it lands under technical/requirements/ with its verification
--      tag and its source, the act's render template is licensed by one citation
--      and checked against nothing, this schema can only pin the template by hash,
--      and the M4 acceptance step «check the render field by field against the
--      В.1/В.2 list» (version-0.1.md §v0.1-M4) cannot be performed. The gap closes
--      with the unretained primary ДБН file, not separately.
--      WHAT THIS ITEM DID NOT SAY, ADDED 2026-08-08 AFTER A WHOLE-BUILD AUDIT
--      READ IT AS A DOCUMENTATION GAP: it is a milestone blocker, and the tables
--      this file builds are the half of M4 that works.
--      apps/app/src/lib/statutory-act-form.ts:205 sets
--      DODATOK_V_TEMPLATE.fieldList to null; renderStatutoryAct pushes
--      `dodatok_v_field_list_not_committed` for a null field list (:510-521) and
--      returns ok:false on any non-empty blocker list (:526-528), WITHOUT
--      LOOKING AT THE ACT. So statutory_acts.render refuses for every act on
--      every input, and statutory_act_versions.freeze — which hashes the render
--      — ALWAYS REFUSES WITH IT. public.statutory_act_versions can therefore
--      hold a draft and can never hold a frozen row through any route: §7's
--      guard, §9's append-only layer and the deferred completeness check are all
--      real and all currently unreachable from the application, and only the
--      owner-level suites exercise them. M4 SHIPS A COMPOSER AND NO DOCUMENT.
--      This is CORRECT BEHAVIOUR, not a defect — a renderer that has not been
--      given the form must refuse, and inventing the captions is the one thing
--      hidden-works-content-rules.md forbids without qualification. The single
--      deliverable that unblocks it is the В.1/В.2 field list, with the
--      standard's own captions, in the standard's order, transcribed from the
--      primary ДБН file, tagged, sourced and committed under
--      technical/requirements/. No migration, route or contract change follows.
--      Recorded in TODOS.md and in the progress document's standing statement.
--
--   2. entity-catalog.csv:62 MARKS public.statutory_acts `draft_mutable`. §3
--      builds it append-only (departure 3): the closure it depends on is
--      append-only, the stage is terminal after 0045 §6, and everything a composer
--      edits lives on the version. Either the catalog row is owed the correction
--      or this table is owed an update path, and the choice is a design decision
--      rather than a migration's.
--
--   3. THE REGISTRY CHECK HAS NO FACT TABLE. The mandatory footer disclaimer
--      prints «Перевірено за Реєстром будівельних норм: {дата останньої
--      перевірки}» and M0 gate 10 owns that check. Nothing in this repository
--      records when it was performed, by whom, or against what, so §4 stores a
--      date the composer supplies and this database can only check is not in the
--      future. The M0 slice owes either the fact table or an explicit statement
--      that the date is a hand-entered operational claim.
--
--   4. WHAT AN ADJUSTMENT RECORDED AFTER A FREEZE DOES TO A PRINTED ACT IS
--      UNDECIDED. §5 pins the root entry's recorded quantity and deliberately does
--      not pin the effective quantity, because a foreign key onto
--      public.progress_allocation_heads would make a correction fail and INV-065
--      forbids refusing a recorded fact. So a frozen act can outlive the quantity
--      it printed. ADR-008 §"What this ADR does not decide" names the same
--      question for money and leaves it open; the act version of it is owed an
--      answer by whichever ADR closes that one.
--
--   5. THE PARTICIPANT RECORD DOES NOT CARRY THE КВАЛІФІКАЦІЙНИЙ СЕРТИФІКАТ.
--      hidden-works-content-rules.md and ADR-005 decision 10 both say the
--      технагляд's certificate «is held on the participant record», and
--      schema-v0.1.sql:279-283 gives public.party_contacts
--      qualification_certificate_series and qualification_certificate_number. THE
--      DEPLOYED TABLE HAS NEITHER (0010:119-133). Nothing in M4 needs them —
--      nothing is printed for the certificate and §6 has no column for it — so
--      this file does not add them, and the sentence «it lives on the participant
--      record» is false in the runtime until some slice does. Naming it here is
--      the point: a reader of the content rules would otherwise assume the fact is
--      recorded somewhere.
--
--   6. responsibility-presets.csv NAMES statutory_acts.compose IN NO PRESET, and
--      capabilities.csv:32 puts the act's READS behind it as well as its writes.
--      So no persona can compose, freeze, read or render an act without a
--      hand-issued grant, and a member who may read one may also compose one.
--      This is M1 review finding 8 and M3 review finding 5 a third time. Turning
--      it into preset rows, and deciding whether the act needs a separate view
--      capability, are permissions decisions and not a migration's.
--
--   7. statutory_act_versions.freeze WRITES NO NEW ROW, so its idempotency lives
--      only in public.idempotency_records. §4 carries compose's key on the version
--      row, the shape 0045 used on all three of its command tables; freeze has no
--      equivalent, and the route slice owes either the columns or an explicit
--      statement that the records table is the whole of it.
--
--   8. WHETHER авторський нагляд IS A REQUIRED SLOT IS NOT ESTABLISHED. §7's
--      completeness check requires builder and technical_supervision, following
--      schema-v0.1.sql:1656-1657. п. 8.4.3.5 names three roles and no document in
--      this package says the third is conditional. Either the content rules
--      allow-list the answer against the В.1/В.2 field list, or the product records
--      the two-of-three rule as its own assumption the way act_form_basis records
--      the В/Г mapping.
--
--   9. THE COMPOSER-SIDE QUANTITY REFUSAL STILL HAS NO INVARIANT ID.
--      version-0.1.md §v0.1-M4 §"Security tests" and the plan's §"Decisions this
--      plan raises and does not take" item 5 both say invariant-catalog.csv owes
--      the row and neither invents an identifier. Neither does this file: §5 makes
--      the refusal structural and the row is still owed. INV-073 covers the
--      rendering constraint and does not cover the composer's refusal.
--
--  10. state-catalog.csv:55-56 ENUMERATES statutory_act_version.status AS
--      draft / frozen AND NAMES NO OTHER MACHINE FOR THIS SLICE. There is no state
--      machine for statutory_act.act_form or act_form_basis, and §3 ships both as
--      text + CHECK with no catalog row behind either vocabulary — the same gap
--      0045 §11 item 4 recorded for readiness_projection.scope_kind. The slice
--      that ships the M4 routes owes the enumerations, and
--      transition-catalog.csv:61 owes a correction of its own: it names
--      statutory_acts.compose as the capability of the draft -> frozen transition,
--      which is right, and calls the transition's trigger the package freeze from
--      v0.2, which in v0.1 is statutory_act_versions.freeze.
--
--  11. AN ACT NOW BLOCKS AN IN-PLACE EDIT OF A PROJECT PARTY'S RELATIONSHIP.
--      §6's party foreign key carries `relationship`, public.project_parties is
--      not append-only, and no v0.1 route in scope-v0.1.csv updates that column
--      today — so the refusal is latent rather than live. The slice that ships a
--      project-party edit owes the decision: either the correct act is a new
--      project_parties row for the new role (which is what that table's natural
--      key already implies) or the pin narrows to (project_party_id, party_id) and
--      the slot-to-relationship assumption stops being enforced.
-- ===========================================================================
comment on column public.statutory_act_versions.status is
  'Moves ONLY through statutory_act_versions.freeze, and only once. '
  'app.guard_statutory_act_version() admits exactly one transition, draft -> frozen, '
  'rejects every update whose old status is not ''draft'', rejects every delete, and '
  'rejects any change to identity, lineage, scope, provenance or idempotency — so '
  '''frozen'' is TERMINAL and «a correction is a successor version» (INV-015) is a '
  'schema rule rather than a sentence. The content of a frozen version is frozen with '
  'it: app.guard_statutory_act_content() refuses every insert, update and delete on '
  'the quantity and signatory rows of a version that is no longer a draft.';
