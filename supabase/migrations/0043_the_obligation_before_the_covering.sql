-- 0043: the obligation the phone shows before the covering (v0.1-M2).
--
-- THE NUMBER. The brief for this slice said «next free number is 0042 (0041 is
-- taken)». 0042 IS ALSO TAKEN: supabase/migrations/0042_the_baseline_a_person_types.sql
-- exists in this tree, is the migration 0041:143-156 named as owed, and is cited
-- by line number throughout the M1 review. Numbering this file 0042 would collide
-- with it. This is 0043 and the brief's statement is stale, not overruled.
--
-- WHAT THIS ADDS
--   two tables — public.work_stages and public.requirement_occurrences — with
--   their grants, RLS and append-only enforcement; the composite uniques on
--   three deployed tables that back their foreign keys; the activation of the
--   deferred FK public.upload_intents.requirement_occurrence_id; and the
--   widening of the origin_method vocabulary on public.upload_intents and
--   public.evidence_objects by one value, 'origin_not_distinguished'.
--
--   Nothing here writes a row. No command ships in this file: assignments.create
--   materialises stages and occurrences, work_stages.create is M3, and both are
--   route work in their own slices.
--
-- WHAT THIS DOES NOT CHANGE
--   No table is dropped. No column is dropped. No row is written, deleted or
--   rewritten. Migrations 0001-0042 are applied history and are not edited. Two
--   existing CHECK constraints are WIDENED by one value each (§6); every value
--   they accepted before is still accepted. Nothing else that exists is altered.
--
--   THREE CONSTRAINTS ARE ADDED TO DEPLOYED TABLES AND ARE VALIDATED AGAINST
--   EXISTING ROWS (§1). Each can fail the migration, and each failure would be
--   the constraint reporting a row that should not exist rather than a reason to
--   weaken the constraint:
--     * work_assignments (workspace_id, project_id, id, contract_id,
--       contract_version_id) unique — cannot fail: (workspace_id, project_id, id)
--       is already unique (0015:93), so this one is implied by it;
--     * contract_versions (workspace_id, id, status) unique — cannot fail for the
--       same reason (0012:138);
--     * work_assignments.baseline_status + its FK into
--       contract_versions (workspace_id, id, status) — CAN fail, on an assignment
--       whose contract version is a DRAFT. No such row can exist in any
--       environment where migrations 0001-0042 applied in order: 0012:120
--       defaulted status to 'published' and 0013:28 forbade every update, so no
--       draft could exist before 0042, and 0042 has not been followed by a route
--       that creates an assignment against one. If it fails anyway, an assignment
--       is hanging off an unagreed baseline and that is the finding.
--
-- ROLLBACK
--   Dev only, and only while both new tables are still empty and no upload
--   intent has named an occurrence. THE ORDER IS LOAD-BEARING: the referencing
--   constraint goes before the table it points at, or the drop fails and the
--   next hand reaches for CASCADE.
--     alter table public.upload_intents
--       drop constraint upload_intents_occurrence_fkey;
--     drop table public.requirement_occurrences;      -- takes ro_* policies and
--     drop table public.work_stages;                  -- the triggers with them
--     alter table public.work_assignments
--       drop constraint work_assignments_published_baseline_fkey,
--       drop column baseline_status,
--       drop constraint work_assignments_baseline_scope_key;
--     alter table public.contract_versions
--       drop constraint contract_versions_status_key;
--     alter table public.requirement_rule_versions
--       drop constraint requirement_rule_versions_occurrence_copy_key;
--     alter table public.upload_intents
--       drop constraint upload_intents_origin_method_check;
--     alter table public.upload_intents
--       add constraint upload_intents_origin_method_check check (origin_method in
--         ('native_camera','photo_picker','file_picker','form','import','generated_derivative'));
--     alter table public.evidence_objects
--       drop constraint evidence_objects_origin_method_check;
--     alter table public.evidence_objects
--       add constraint evidence_objects_origin_method_check check (origin_method in
--         ('native_camera','photo_picker','file_picker','form','import','generated_derivative'));
--   ONCE ONE OCCURRENCE EXISTS THERE IS NO ROLLBACK: dropping the table destroys
--   the obligation set a baseline imposed on work already under way, and the
--   occurrences cannot be re-derived — the binding they were materialised from
--   says which rule versions applied to the CONTRACT VERSION, not which of them
--   were matched onto which assignment at which moment. ONCE ONE OBJECT HAS BEEN
--   CAPTURED AS 'origin_not_distinguished' THE VOCABULARY CANNOT NARROW EITHER:
--   the narrow CHECK would refuse the row that is already stored, and there is no
--   other value that would be true of it. Staging and production take a
--   corrective forward migration instead.
--
-- ---------------------------------------------------------------------------
-- WHY THE TARGET DDL IS NOT TRANSCRIBED
--
-- technical/database/schema-v0.1.sql is the SHAPE to build toward, not a file to
-- copy. 0015:1-11 records three standing deviations of the realized database from
-- it and all three apply here: the workspace table is public.organizations, the
-- membership key is memberships (organization_id, id) (0015:21-22), and state
-- columns are text + CHECK because this database has no enums — which is also how
-- §6 widens a vocabulary that schema-v0.1.sql:97 carries as an enum value.
--
-- ---------------------------------------------------------------------------
-- THE FOUR PLAN CONTRADICTIONS THAT LAND HERE
-- (docs/superpowers/plans/2026-08-06-v0.1-implementation.md §"Where existing code
-- contradicts the new spec")
--
-- CONTRADICTION 5 — a `before_concealment` occurrence needs a stage, and stages
-- were a milestone later. RESOLVED BEFORE THIS FILE, by the owner, as the plan's
-- option (A): THE work_stages TABLE IS BUILT IN M2 AND THE CLOSURE COMMAND SHIPS
-- IN M3. That is why a migration titled M2 creates two tables where
-- version-0.1.md §v0.1-M2 §"Schema slice" says it builds one.
--   Why the alternative was worse: schema-v0.1.sql:1131-1133's
--   `check (timing <> 'before_concealment' or stage_is_concealed is true)` is the
--   one structural guarantee that «a requirement that must precede a covering that
--   never happens is unreachable» (execution-and-evidence.md §"Timing"), and
--   before_concealment is the entire hidden-works case — essentially every v0.1
--   occurrence. Relaxing the CHECK to keep a build order would have traded a
--   permanent weakening of the schema for a scheduling convenience.
--   The stage set needs no member command in M2: the stage_key values bound to a
--   contract version ARE that version's stage vocabulary (0041:445-449), so
--   assignments.create materialises stages and occurrences in one transaction from
--   one binding. M3 then adds work_stages.create for the stages the baseline did
--   not imply, and the closure command that moves `status`.
--   version-0.1.md §v0.1-M2 §"Schema slice" and its «M2 builds one» sentence are a
--   SCOPE-DOCUMENT CORRECTION THIS MIGRATION OWES AND DOES NOT MAKE. A migration
--   that edits prose is a migration nobody can review (0042:479-490 is the
--   precedent for recording rather than editing).
--
-- CONTRADICTION 6 — the `hold` CHECK of the target DDL. schema-v0.1.sql:1128
-- copies `check (intervention_type <> 'hold' or blocking_scope = 'blocks_both')`
-- onto requirement_occurrences under the comment «INV-066: the copied scope obeys
-- the same rule as the published version». IT IS NOT TRANSCRIBED HERE, for exactly
-- the reason 0041:85-102 does not transcribe it onto the rule version: ADR-006
-- decision 4.4 requires a v0.1 hold to be `blocks_stage_closure`, so the CHECK
-- would make every v0.1 hold — and therefore every v0.1 occurrence — UNSTORABLE.
-- The occurrence keeps all three intervention types and all four blocking scopes.
--   The refusal is the PUBLICATION COMMAND's and it is upstream of this table:
--   requirement_rule_versions.publish rejects an intervention_type other than
--   `hold` (decision 4.3) and a `hold` whose blocking_scope is other than
--   `blocks_stage_closure` (decision 4.4) — two refusals, INV-082, neither of them
--   in this file and neither of them the materialisation command's either.
--   WHAT THIS FILE DOES INSTEAD, AND IT IS STRONGER THAN THE CHECK WOULD HAVE
--   BEEN: the occurrence cannot carry a blocking_scope its pinned rule version
--   does not carry, because the pair is a foreign key (§4,
--   requirement_occurrences_pinned_scope_fkey). A CHECK would have constrained the
--   occurrence against a rule stated twice; the FK constrains it against the rule
--   version itself, which is what INV-066 says the value is a COPY of. Whatever
--   the publication command admits, the copy is exact; whatever it refuses, no
--   occurrence can invent.
--   The v0.2 package milestone still owes the migration that widens every v0.1
--   hold to blocks_both (INV-066, 0041:427-433) — AND IT NOW HAS A SECOND TABLE
--   TO WIDEN. The rule version and the occurrence must be widened in the same
--   statement or the FK above will refuse the update; the migration cannot widen
--   one and come back for the other.
--
-- CONTRADICTION 7 — requirement_rule_versions must not gain an FK to
-- public.requirement_rules, which v0.1 does not build (ADR-006 decision 4.1;
-- entity-catalog.csv:31 marks it v0.2). THIS MIGRATION ALTERS
-- requirement_rule_versions (§1 adds one composite unique) AND DOES NOT ADD THAT
-- FOREIGN KEY, and does not create the table either. requirement_rule_id stays a
-- NOT NULL lineage key with no referent, carrying its meaning through
-- unique (workspace_id, requirement_rule_id, version_no) on the version and
-- unique (workspace_id, contract_version_id, requirement_rule_id) on the binding
-- — one rule contributes at most one version to a baseline. 0041:64-83 is the
-- full argument and it is unchanged by anything here.
--   The occurrence does NOT carry requirement_rule_id either, and that is the same
--   decision: it would be a second copy of a key with no referent, and the lineage
--   is one join away through the rule version the occurrence pins.
--
-- CONTRADICTION 8 — no origin_method value exists for a PWA capture, so M2 cannot
-- record one at all (INV-086). THE WIDENING IS ADDITIVE AND SAFE AND IT IS DONE
-- HERE (§6). The full argument, including the one way it would NOT have been safe,
-- is in §6 rather than in this summary. What the widening does not do is implement
-- INV-086: making the value storable is not the same as writing it, and the
-- refusal of `native_camera` on the PWA path is a route and client behaviour with
-- no counterpart in this file.
--
-- ---------------------------------------------------------------------------
-- FIVE DEPARTURES FROM schema-v0.1.sql BEYOND THE THREE STANDING ONES, EACH
-- DELIBERATE
--
-- 1. requirement_occurrences GAINS contract_version_id AND stage_key. Neither is
--    in schema-v0.1.sql:1076-1135, and without them THE PIN THIS MILESTONE EXISTS
--    FOR CANNOT BE STRUCTURAL — see §4's opening block. contract_id, which the
--    target DDL declares and then uses in no constraint at all, is given a job by
--    the same change.
--
-- 2. requirement_occurrences GAINS max_evidence_count. entity-catalog.csv:35 lists
--    MULTIPLICITY among the nine pinned fields and 0041:263-264 defines
--    multiplicity as the pair min/max. The target DDL copies only the lower half,
--    so a rule that says «at most three photos» could not be copied onto the
--    obligation it governs. Copying half of a pinned field is not pinning it.
--
-- 3. requirement_occurrences DOES NOT GAIN requirement_template_version_id,
--    which schema-v0.1.sql:1084 carries as «v0.1-M2 lineage only» and
--    relationship-catalog.csv:54 keeps «for deployed lineage only and never
--    written by a v0.1 command». THERE IS NO DEPLOYED LINEAGE TO RETAIN: this
--    table is created empty by this migration, no row of it has ever pinned a
--    template, and ADR-005 decision 2 retires the model the column points at. A
--    column that no command may write, on a table with no history, is the dead
--    surface the M1 review flagged in a different place
--    (packages/domain/src/authz.ts:11-16). relationship-catalog.csv:54 therefore
--    describes a relationship this schema does not have, and OWES A CORRECTION
--    that this migration does not make. v0.2 can add the column additively if a
--    reason ever appears.
--
-- 4. work_stages AND requirement_occurrences GAIN created_by_member_id (the
--    occurrence has it in the target DDL; the stage does not). Every deployed
--    module in this database attributes the row that creates a fact — 0012:103,
--    0015:55, 0015:89, 0041:340 — and a closable unit nobody created is a unit
--    nobody can be asked about. 0041 departure 5 is the same argument.
--
-- 5. THE btrim FORM IS USED WHERE THE TARGET DDL USES NOT NULL. `norm_ref_source
--    is not null` (schema-v0.1.sql:1134) admits '' and '   ', which carry no
--    source while satisfying the column; INV-073 is a claim about content, not
--    about nullability. 0041:212-217 and 0023:54-56 are the standing lesson in
--    this codebase about constraints written the obvious way.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION DOES NOT ENFORCE, NAMED SO IT IS NOT MISTAKEN FOR ENFORCED
--
-- * THE STAGE VOCABULARY IS NOT CHECKED RELATIONALLY, and that is the target
--   DDL's own decision (schema-v0.1.sql:687-691): «a stage with no bound rule and
--   therefore no occurrence is legal and is exactly what the bulk-instantiation
--   dry run must disclose as an uncovered line (INV-072)». A work_stages row whose
--   stage_key matches no binding is storable here BY DESIGN. Making it
--   unstorable would delete the finding INV-072 exists to print.
-- * INV-072 ITSELF IS NOT HERE AND HAS NO TABLE. The dry run's uncovered-line list
--   is the command's own output, not a report someone may run and not a row anyone
--   may read later; nothing in this file persists it, and nothing should.
-- * INV-065 IS NOT HERE AND ITS ABSENCE IS THE POINT. «The gate never refuses to
--   record a fact.» There is no readiness predicate on this table, no trigger on
--   progress_entries or upload_intents added by this file, and no column on the
--   occurrence that any recording path must consult. An occurrence exists and
--   blocks a CONCLUSION; it never blocks a RECORDING. If a later migration adds a
--   precondition to a recording path that reads this table, INV-065 is what it
--   breaks.
-- * INV-086 IS NOT IMPLEMENTED HERE, only made possible — see §6.
-- * SATISFACTION HAS NO COLUMN, deliberately (schema-v0.1.sql:1137-1140;
--   state-catalog.csv:88-90). It is a projection over decisions, exceptions and
--   review heads, all of which are M3. An occurrence in this table is an
--   obligation that EXISTS; whether it is met is never stored beside it.
-- * work_assignments.requirement_template_version_id IS STILL NOT CHECK-
--   CONSTRAINED TO NULL. 0041:819-850 sets the order: M2 makes the occurrence the
--   media source, THEN the write stops, THEN the CHECK lands and the template read
--   is removed. This file completes only the first of those three, and the other
--   two are route changes it does not ship. Landing the CHECK now would refuse
--   every write the deployed assignments route
--   (apps/app/app/v1/contracts/[contractId]/assignments/route.ts:81) still makes.
--   THE CHECK BELONGS IN THE MIGRATION THAT SHIPS WITH THAT ROUTE CHANGE, and
--   0041:838-850's comment on the column stays accurate until then.
-- * THE MEDIA GATE HAS NO SHAPE CONSTRAINT ON ITS NEW SOURCE. When the upload gate
--   stops reading requirement_template_versions.allowed_media it will read
--   requirement_rule_versions.allowed_media (0041:321), which has NO equivalent of
--   0023:57-63 — the CHECK that exists precisely so a malformed shape cannot
--   silently widen the gate to the route's FALLBACK_MEDIA. That CHECK belongs on
--   the rule version, in the slice that moves the read. Adding it here would put a
--   constraint on another slice's table for a route that does not yet exist; NOT
--   adding it in that slice would repeat, on the new path, the exact regression
--   0041:826-837 was written to prevent.
--
-- ---------------------------------------------------------------------------
-- WHAT COULD NOT BE CHECKED HERE
--
-- This checkout has no node_modules, no database and no docker. Nothing below has
-- been executed. No claim in this file rests on a run: not that it applies, not
-- that a constraint fires, not that a policy admits or refuses. Static reading of
-- migrations 0010-0042, technical/database/schema-v0.1.sql, the four catalogs and
-- the two ADRs is the only check performed.
--
-- ONE FURTHER GAP, FOUND WHILE WRITING THIS AND NOT IN THE PLAN'S EIGHT:
-- THE LEFT-HAND SIDE OF THE RULE PREDICATE HAS NOWHERE TO LIVE. The v0.1 predicate
-- is (work_type_key, stage_key) (ADR-006 decision 4.2; 0041:294-297), and
-- glossary.md:109 says work_type_key is «carried as work_type_key ON THE WORK ITEM
-- and on the rule version». public.work_items HAS NO SUCH COLUMN (0012:219-254),
-- and neither does schema-v0.1.sql's work_items — the string occurs there twice,
-- both times on the rule side (:951, :1009). So at assignment creation there is
-- nothing to match a bound rule version's work_type_key AGAINST, and the
-- materialisation command has no predicate to evaluate: it would have to
-- materialise every bound rule version onto every assignment, or none.
-- THIS MIGRATION DOES NOT CLOSE IT AND MUST NOT. glossary.md:109 says in terms
-- that work type «is a key with no owning fact… giving it one is a scope decision
-- an ADR must make», and entity-catalog.csv:40 records the same as an unresolved
-- M1 ENTRY CONDITION. Adding a column to public.work_items to get the M2 command
-- compiling would take that decision by writing DDL. It is raised here, at the
-- boundary, and left there.
--
-- CORRECTED IN PLACE — MIGRATION 0050 CLOSES THE COLUMN HALF OF THIS GAP.
-- 0043 has never been applied anywhere, so this is a correction to an unapplied
-- file and not an edit to history, in the same style as 0041:286-294. What
-- changed and what did not:
--   * «public.work_items HAS NO SUCH COLUMN» is true of 0012 and FALSE after
--     0050, which adds public.work_items.work_type_key — nullable, additive,
--     shape-checked, and refused by work_items_work_type_guard when it names no
--     rule version the workspace can bind. Assignment creation now has a
--     left-hand side to match, and materialisation evaluates a real predicate
--     instead of matching everything or nothing.
--   * technical/database/schema-v0.1.sql CARRIES THE COLUMN TOO, on both sides
--     of the predicate. Line side: `work_type_key text` at :562 with the same
--     shape check at :608-609. Rule side: :972, indexed at :1030. That file is
--     the SHAPE to build toward and a migration does not edit it — the same
--     change that wrote 0050 edited it directly — so NO NEW DEVIATION from the
--     three 0015:1-11 records is created by this column.
--
--     CORRECTED AGAIN 2026-08-08, AND THE FIRST CORRECTION IS LEFT ON THE
--     RECORD BECAUSE IT IS THE MISTAKE THIS FILE MUST NOT MAKE TWICE. This
--     bullet first read: «schema-v0.1.sql still carries work_type_key only on
--     the rule side (:951, :1009). … the deviation is now one MORE than the
--     three 0015:1-11 records, and 0050 §1 states it.» Every clause of it was
--     false when it was written — the file already carried the line-side column
--     at :562; the two rule-side line numbers had moved to :972 and :1030
--     because that edit shifted them; and 0050 §1 is about the `alter table …
--     add column` being catalog-only, mentions schema-v0.1.sql nowhere, and
--     0050's ONLY mention of the file is §8's list of what was read.
--     A correction that introduces three new false statements is worse than
--     the staleness it replaced, so what it asserted is quoted here rather
--     than quietly overwritten.
--   * THE PARAGRAPH ABOVE WAS RIGHT FOR 0043 AND STAYS AS WRITTEN. The scope
--     decision glossary.md:109 defers is the OWNING ENTITY — a table that
--     defines the set of work types, with an operation that creates one — and
--     0050 does not take it (0050 §3 weighs it and says what adding it would
--     cost in five documents and in the validator's transcribed list). What
--     0050 lands is the CARRIER, which ADR-006 decision 1 step 1 already
--     requires in terms: ПТВ «enters the work lines by hand, PICKS A WORK TYPE».
--     The vocabulary stays emergent — whatever keys a workspace's published rule
--     versions carry — and entity-catalog.csv still has no row for it.
--
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. The composite uniques that back the new foreign keys
--
-- Same move as 0015:13-28 and 0023:19-21: a deployed table's existing uniques
-- cannot back the references the new tables need, so the keys are declared before
-- the tables that use them.
--
-- All three are on (already-unique key) + (extra columns), so no two rows can
-- collide on them that did not already collide on the narrower key. Validation
-- against existing rows cannot fail. Each takes an ACCESS EXCLUSIVE lock and
-- builds an index; on pilot-scale tables that is a moment, and it is stated
-- rather than assumed.
-- ===========================================================================

-- Backs BOTH children: a stage and an occurrence must hang off the assignment's
-- OWN contract and contract version, not merely off the assignment. Without the
-- contract_version_id leg, an occurrence could name assignment A and pin a rule
-- version bound to some other baseline entirely, and the composite FK into the
-- binding (§4) would still resolve.
alter table public.work_assignments
  add constraint work_assignments_baseline_scope_key
  unique (workspace_id, project_id, id, contract_id, contract_version_id);

-- Backs work_assignments_published_baseline_fkey below. The literal-discriminator
-- technique of 0023:28-48, and it is SAFE HERE for the reason 0041:111-125 gives
-- for why it was NOT safe there: a copied status literal is re-validated whenever
-- the referenced row is updated, so it may only pin a TERMINAL status. On
-- public.contract_versions 'published' is terminal — app.guard_contract_version()
-- (0042:247-277) rejects every delete, and rejects every update whose old row is
-- not a draft. A published version can never move again. The draft -> published
-- update is likewise safe: no referencing row can carry 'draft', because the
-- column below is CHECK-forced to 'published'.
alter table public.contract_versions
  add constraint contract_versions_status_key unique (workspace_id, id, status);

-- Backs requirement_occurrences_pinned_scope_fkey (§4): the occurrence's copy of
-- blocking_scope and timing must be the pinned version's own values (INV-066) and
-- not a second opinion about them. 0041:358-362 already declared
-- unique (workspace_id, id, intervention_type) as «the M2 anchor» for the same
-- purpose and it is used unchanged; these are the two axes it did not cover, and
-- both have structural consequences downstream — blocking_scope IS the consequence
-- (ADR-005 decision 4), and timing is what the before_concealment CHECK reads.
alter table public.requirement_rule_versions
  add constraint requirement_rule_versions_occurrence_copy_key
  unique (workspace_id, id, blocking_scope, timing);

-- An assignment may not execute a baseline nobody has agreed. 0042 made a DRAFT
-- contract version representable for the first time, and its work_items are
-- editable and deletable while it stays a draft (0042:302-352) — so an obligation
-- materialised from a draft baseline could be silently rewritten underneath the
-- foreman reading it. Before 0042 this was true by construction and needed no
-- constraint; after 0042 it needs one, and the constraint belongs to the milestone
-- that starts creating assignments.
alter table public.work_assignments
  add column baseline_status text not null default 'published'
    check (baseline_status = 'published');

comment on column public.work_assignments.baseline_status is
  'Literal discriminator (0023:28-48), not a state: it is CHECK-forced to '
  '''published'' and exists only so work_assignments_published_baseline_fkey can '
  'resolve against contract_versions (workspace_id, id, status). An assignment '
  'against a DRAFT baseline is unrepresentable rather than refused in one route. '
  'Safe as a copied literal because ''published'' is terminal on that table '
  '(app.guard_contract_version(), migration 0042) — the failure mode 0041:111-125 '
  'describes needs a status that can move after it is pinned.';

alter table public.work_assignments
  add constraint work_assignments_published_baseline_fkey
  foreign key (workspace_id, contract_version_id, baseline_status)
  references public.contract_versions (workspace_id, id, status);

-- ===========================================================================
-- 2. work_stages — the closable unit
--
-- BUILT IN M2, CLOSED IN M3 (contradiction 5, resolved above). This file gives
-- the table, its identity and its immutability floor; migration M3 opens the
-- one transition its `status` column exists for, exactly as 0042 opened the one
-- transition contract_versions needed and replaced the reject_mutation trigger
-- with a guard in the same statement.
--
-- The stage is a v0.1 object with a v0.2 column: location_id stays because the
-- closable unit is «one assignment, one location node, one stage» in ADR-005 and
-- ADR-006 decision 4.2 moves locations to v0.2. relationship-catalog.csv:34 says
-- so in terms — «NOT a v0.1 relationship… the FK stays deployed-optional and no
-- v0.1 command sets it». Dropping the column would make v0.2 a schema change
-- rather than an additive one; that is 0041's argument for location_predicate
-- (0041:266-272) and it is the same column doing the same job.
-- ===========================================================================
create table public.work_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  contract_version_id uuid not null,
  work_assignment_id uuid not null,
  location_id uuid,
  -- From the vocabulary the contract-version rule bindings pin. NOT constrained
  -- relationally — see the header: an uncovered stage is a finding INV-072 must
  -- be able to print, not a row the database must refuse.
  stage_key text not null check (length(btrim(stage_key)) > 0),
  is_concealed boolean not null default false,
  -- 'closed_without_evidence' stays in the vocabulary and is UNREACHABLE in v0.1:
  -- ADR-006 decision 4 keeps the bypass out because its whole price is package
  -- ineligibility and v0.1 has no packages to make ineligible
  -- (state-catalog.csv:48). The value stays so v0.2 is additive and no v0.1 record
  -- is reinterpreted — the same shape as contradiction 6's blocking scopes, and
  -- the same reason.
  status text not null default 'open'
    check (status in ('open','closed','closed_without_evidence')),
  version bigint not null default 1,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  -- THE STAGE IDENTITY A CHILD MAY PIN, in one key. schema-v0.1.sql:672 declares
  -- (workspace_id, project_id, id, is_concealed) for the occurrence's timing pin
  -- and stops there; this key carries two more columns and each one closes a way
  -- the occurrence could be wrong while every row still resolved:
  --   work_assignment_id — the target DDL's narrower key lets an occurrence of
  --     assignment A attach to a stage of assignment B in the same project. The
  --     obligation would then be evaluated over a closable unit nobody assigned it
  --     to, and M3's closure of B would be reading A's requirements;
  --   stage_key         — an occurrence may not sit on a stage other than the one
  --     its pinned rule version names (§4 leg (d));
  --   is_concealed      — the target DDL's own reason: an occurrence timed
  --     before_concealment cannot attach to a stage that is not concealed
  --     (execution-and-evidence.md §"Timing").
  -- One key and one foreign key rather than three of each, because the four
  -- columns are one statement: THIS obligation belongs on THAT unit.
  -- NAMED, unlike the short keys above: PostgreSQL's auto-name for six columns is
  -- 84 bytes and identifiers truncate at 63, so the constraint would carry a
  -- clipped name that no rollback line could reproduce.
  constraint work_stages_occurrence_scope_key
    unique (workspace_id, project_id, work_assignment_id, id, stage_key, is_concealed),
  -- The status is a pin of its own. M3's stage_closures may reference only a stage whose
  -- status is 'closed' and unevidenced_closures only one whose status is
  -- 'closed_without_evidence'; since a stage has exactly one status, the two kinds
  -- of closure become mutually exclusive RELATIONALLY rather than by convention,
  -- and once either closure exists the status can never move again — which is what
  -- «ADR-005 defines no reopen» has to mean in a schema.
  -- DECLARED NOW THOUGH NOTHING IN M2 USES IT: adding a unique constraint to a
  -- populated table is a migration that can fail on data, and this one cannot,
  -- because the table is empty in the transaction that creates it. 0041:358-361
  -- made the same call for the same reason.
  unique (workspace_id, project_id, id, status),

  foreign key (workspace_id, project_id, work_assignment_id, contract_id, contract_version_id)
    references public.work_assignments (workspace_id, project_id, id, contract_id, contract_version_id),
  foreign key (workspace_id, project_id, location_id)
    references public.locations (workspace_id, project_id, id),
  foreign key (workspace_id, created_by_member_id)
    references public.memberships (organization_id, id)
);

-- One assignment + one location node + one stage key is ONE stage. Without this,
-- «close the same stage twice» is reachable through duplicate stage IDENTITIES
-- instead of duplicate closures, and M3's closure guard would be defending the
-- wrong door. coalesce over the nullable location, because in SQL two NULLs do
-- not collide and in v0.1 every location_id is NULL — without the coalesce this
-- index would constrain nothing at all in the version that ships.
create unique index work_stages_closable_unit_uniq
  on public.work_stages (workspace_id, work_assignment_id,
    coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), stage_key);

create index work_stages_assignment_idx
  on public.work_stages (workspace_id, project_id, work_assignment_id, stage_key);

-- SUPERSEDED BY MIGRATION 0051 §3, and kept verbatim as the record of this
-- moment: the sentence below about the vocabulary being deliberately
-- unconstrained is true of every stage in THIS migration's world, where no work
-- line can carry a work type. 0050 landed the carrier and 0051 closed the
-- vocabulary for a line that implies stages, leaving it open for one that does
-- not. 0051 re-issues this comment; restoring this text is how 0051's rollback
-- completes.
comment on table public.work_stages is
  'The closable unit: one assignment, one location node (v0.2 — no v0.1 command '
  'sets it), one stage from the vocabulary the published contract version pins, '
  'flagged concealed or not. BUILT IN v0.1-M2 THOUGH entity-catalog.csv:40 MARKS '
  'THE TABLE v0.1-M3, because a before_concealment occurrence cannot be stored '
  'without a concealed stage and that timing is the entire hidden-works case; the '
  'CLOSURE COMMAND is still M3 and this migration grants no UPDATE. status is a '
  'stored lifecycle column (state-catalog.csv work_stage.status) and the closure '
  'FACTS are stage_closures and unevidenced_closures — they are what may be relied '
  'on. The stage vocabulary is deliberately NOT checked relationally: a stage with '
  'no bound rule and therefore no occurrence is legal, and is exactly what the dry '
  'run must disclose as an uncovered line (INV-072).';

comment on column public.work_stages.status is
  'Moves ONLY through the M3 closure command. v0.1-M2 grants no UPDATE on this '
  'table and app.reject_mutation() refuses every update and delete, so in M2 the '
  'column is storable and immovable. M3 replaces that trigger with a guard that '
  'admits open -> closed, exactly as migration 0042 replaced '
  'contract_versions_immutable with app.guard_contract_version(). '
  '''closed_without_evidence'' is v0.2 and unreachable in v0.1: ADR-006 decision 4 '
  'keeps the bypass out because its whole price is package ineligibility and there '
  'are no packages to make ineligible.';

-- ===========================================================================
-- 3. requirement_occurrences — the obligation, materialised in advance
--
-- Materialised WHEN THE ASSIGNMENT IS CREATED, with no evidence yet linked, and
-- visible in the field client BEFORE WORK STARTS (ADR-005 decision 2; ADR-006
-- step 2). A placeholder that appears only after the work is covered is not
-- advance notice, and this table is where that promise either becomes checkable
-- or stays a sentence.
--
-- There is no create route and no remove route: requirement_occurrences.create
-- and .bulk_instantiate leave v0.1 (version-0.1.md §v0.1-M2 §"API slice"), and a
-- hand-made obligation is also a hand-removed one.
-- ===========================================================================
create table public.requirement_occurrences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  -- Departure 1: not in the target DDL. The baseline whose binding this
  -- occurrence was materialised from — see §4.
  contract_version_id uuid not null,
  work_assignment_id uuid not null,
  -- The closable unit this obligation is evaluated over. Nullable, per
  -- relationship-catalog.csv:52, and NOT nullable in practice for the v0.1 case:
  -- a before_concealment occurrence needs a concealed stage (the CHECK below).
  work_stage_id uuid,
  -- Pinned with the stage so timing is checkable HERE, without reading the stage
  -- row and without trusting that it has not moved.
  stage_is_concealed boolean,
  -- Departure 1: not in the target DDL. Carried so the occurrence's stage and its
  -- rule version can be pinned to the SAME stage key by two foreign keys that meet
  -- on this column.
  stage_key text not null check (length(btrim(stage_key)) > 0),

  -- Pinned identity, never a live rule (INV-067). Retiring the version afterwards
  -- changes nothing here, which is why retirement is a trigger on the binding
  -- (0041:697-733) and not a foreign key.
  rule_version_id uuid not null,
  ordinal integer not null default 1 check (ordinal >= 1),

  -- ── the nine pinned fields, COPIED at materialisation (INV-066) ──────────
  -- Stored values, never a severity word interpreted at read time. The three axes
  -- with structural consequences downstream are pinned to the rule version by
  -- foreign key in §4; the rest are copies this schema cannot verify — named as
  -- such at the end of §4 rather than left to look enforced.
  intervention_type text not null
    check (intervention_type in ('hold','witness','review')),
  -- CONTRADICTION 6: all four scopes stay storable. See the header.
  blocking_scope text not null
    check (blocking_scope in ('none','blocks_stage_closure','blocks_package_inclusion','blocks_both')),
  timing text not null
    check (timing in ('before_work','during','before_concealment','after','before_package')),
  evidence_kind text not null
    check (evidence_kind in ('photo','measurement','document','checkbox')),
  acceptance_criterion text not null check (length(btrim(acceptance_criterion)) > 0),
  performer_role text not null check (length(btrim(performer_role)) > 0),
  approver_role text not null check (length(btrim(approver_role)) > 0),
  -- INV-085 (while M5 is open a hold names an INTERNAL approver) is the rule
  -- publication command's refusal, not a CHECK — 0041:313-317 gives the reason and
  -- it applies unchanged to the copy: a CHECK here would have to be DROPPED to lift
  -- the restriction in M5, and dropping a CHECK is the migration nobody reviews.
  approver_is_external boolean not null default false,
  min_evidence_count integer not null default 1 check (min_evidence_count >= 1),
  -- Departure 2: the other half of multiplicity.
  max_evidence_count integer
    check (max_evidence_count is null or max_evidence_count >= min_evidence_count),

  -- ── the normative citation, copied with its tag and its source ───────────
  norm_ref text,
  norm_ref_verification text
    check (norm_ref_verification in ('VERIFIED_PRIMARY','VERIFIED_SECONDARY')),
  norm_ref_source text,

  -- v0.2 shape kept so v0.2 is additive: no v0.1 command writes anything but the
  -- defaults. ADR-006 decision 4.2 moves locations out of v0.1
  -- (relationship-catalog.csv:55), and the exact quantity scope of an obligation
  -- has no v0.1 producer either.
  location_id uuid,
  quantity_scope jsonb not null default '{}'::jsonb,

  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),

  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  -- Children pin the axis they are only allowed to touch: an M3 notice may exist
  -- only for a witness, an exception kind is coupled to the type, and a decision
  -- may only be made in the role the occurrence names. Declared now for the reason
  -- 0041:358-361 gives — the table is empty exactly once.
  unique (workspace_id, id, intervention_type),
  unique (workspace_id, id, approver_role),
  -- Backs the strengthened upload-intent FK in §5: the captured original answers
  -- an obligation OF THE ASSIGNMENT IT WAS CAPTURED UNDER. Named for the same
  -- reason as work_stages_occurrence_scope_key — the auto-name is 73 bytes and
  -- identifiers truncate at 63.
  constraint requirement_occurrences_assignment_scope_key
    unique (workspace_id, project_id, work_assignment_id, id),

  -- THE CHECK THAT IS NOT HERE: schema-v0.1.sql:1128's
  -- `check (intervention_type <> 'hold' or blocking_scope = 'blocks_both')`.
  -- Contradiction 6 — it would make every v0.1 occurrence unstorable, and
  -- requirement_occurrences_pinned_scope_fkey (§4) enforces INV-066 better than
  -- it could have.
  --
  -- The stage and its concealment flag arrive together or not at all. Without
  -- this, an occurrence could carry stage_is_concealed = true with no stage and
  -- satisfy the before_concealment CHECK below on a flag answering to nothing.
  check ((work_stage_id is null) = (stage_is_concealed is null)),
  -- A requirement that must precede a covering that never happens is unreachable
  -- (execution-and-evidence.md §"Timing"; ADR-005 decision 2). `is true` rather
  -- than a bare column reference, so an occurrence with no stage at all cannot
  -- slip through on a NULL — a CHECK that evaluates to NULL PASSES, which is the
  -- lesson 0023:57-63 paid for.
  check (timing <> 'before_concealment' or stage_is_concealed is true),
  -- INV-073, storage half, in the btrim form — departure 5.
  constraint requirement_occurrences_norm_ref_sourced_check
    check (norm_ref is null
        or (norm_ref_verification is not null
            and length(btrim(coalesce(norm_ref_source, ''))) > 0))
);

-- ===========================================================================
-- 4. THE PIN, MADE STRUCTURAL
--
-- «An occurrence is materialised from a binding when an assignment is created,
-- and pins the exact rule version.» Stated as a sentence, that is a command's
-- promise; stated as four legs and six foreign keys, it is a shape the database
-- will not hold otherwise. Each leg closes a way the sentence could be false
-- while every row still looked well-formed:
--
--   (a) THE OCCURRENCE BELONGS TO ITS ASSIGNMENT'S OWN BASELINE.
--       -> work_assignments (workspace_id, project_id, id, contract_id,
--          contract_version_id). Without the version leg, contract_version_id
--          would be a free-floating column and leg (b) could resolve against a
--          baseline this assignment does not execute.
--
--   (b) THE PINNED RULE VERSION IS ONE THIS BASELINE ACTUALLY BOUND.
--       -> contract_version_rule_bindings (workspace_id, contract_version_id,
--          requirement_rule_version_id), the unique at 0041:477.
--       This is the leg that makes «materialised FROM A BINDING» structural: an
--       occurrence pinning a rule version that the baseline never bound is
--       UNREPRESENTABLE, not merely unwritten by the one command that exists. It
--       also inherits, transitively and for free, everything the binding already
--       proves — that the version was PUBLISHED when it was bound
--       (contract_version_rule_bindings_published_version_fkey, 0041:495-497),
--       that it belongs to the rule the binding names (0041:482-483), and that it
--       entered the baseline inside the publication window
--       (app.guard_rule_binding_window(), 0042:435-466). None of that has to be
--       re-checked here and none of it can be bypassed here.
--       Its cost is worth stating: an assignment on a baseline with NO bindings
--       can materialise NOTHING. That is INV-083 doing its job — and it is also
--       why M1 review finding 1 matters more than it looks. import_batches.publish
--       currently publishes a baseline with zero bindings, and every assignment
--       created against such a baseline will show the foreman an EMPTY obligation
--       set, silently and with no error anywhere.
--
--   (c) THE COPIED CONSEQUENCE IS THE PINNED VERSION'S OWN (INV-066).
--       -> requirement_rule_versions (workspace_id, id, intervention_type), the
--          «M2 anchor» 0041:358-362 declared for this, and
--          (workspace_id, id, blocking_scope, timing) added in §1.
--       The occurrence cannot misreport what it is a copy of. This is what stands
--       in place of the CHECK contradiction 6 forbids, and it is strictly
--       stronger: a CHECK would compare the occurrence against a rule stated
--       twice, while these compare it against the row it copied.
--
--   (d) THE OCCURRENCE SITS ON A STAGE OF ITS OWN ASSIGNMENT, THE STAGE ITS RULE
--       NAMES, AND THAT STAGE IS CONCEALED IF THE TIMING SAYS IT MUST BE.
--       -> requirement_rule_versions (workspace_id, id, stage_key) (0041:357) and
--          work_stages (workspace_id, project_id, work_assignment_id, id,
--          stage_key, is_concealed), meeting on this table's stage_key column.
--       The rule-side key is all-NOT-NULL, so the occurrence's stage_key equals
--       its rule version's stage_key ALWAYS — including when there is no stage row
--       at all. The stage-side key is MATCH SIMPLE and carries work_stage_id, so an
--       occurrence with no stage is unconstrained by it, which is the optionality
--       relationship-catalog.csv:52 declares. That is not a hole: the CHECK above
--       makes a before_concealment occurrence without a concealed stage
--       unstorable, and before_concealment is the v0.1 case.
--       The assignment leg is the one the target DDL does not have. Without it an
--       occurrence of assignment A could attach to a stage of assignment B in the
--       same project — the obligation evaluated over a closable unit nobody
--       assigned it to, and M3 closing B while reading A's requirements.
--
-- WHAT NO FOREIGN KEY HERE PINS, so it is not mistaken for pinned:
-- evidence_kind, acceptance_criterion, performer_role, approver_role,
-- approver_is_external, min/max_evidence_count and the three norm_ref columns are
-- COPIES THIS SCHEMA CANNOT VERIFY. A materialisation command that copied the
-- wrong acceptance criterion would store a well-formed row. Pinning them by key
-- would mean a composite unique over most of the rule version's content — an
-- index holding a second copy of the text to prove the first copy is a copy. The
-- guarantee those columns get instead is a test that materialises an occurrence
-- and compares every copied field with the pinned version's own, and that test is
-- REQUIRED, not optional, because it is the only thing standing behind them.
-- ===========================================================================
alter table public.requirement_occurrences
  add constraint requirement_occurrences_assignment_baseline_fkey
    foreign key (workspace_id, project_id, work_assignment_id, contract_id, contract_version_id)
    references public.work_assignments
      (workspace_id, project_id, id, contract_id, contract_version_id),

  add constraint requirement_occurrences_from_binding_fkey
    foreign key (workspace_id, contract_version_id, rule_version_id)
    references public.contract_version_rule_bindings
      (workspace_id, contract_version_id, requirement_rule_version_id),

  add constraint requirement_occurrences_pinned_type_fkey
    foreign key (workspace_id, rule_version_id, intervention_type)
    references public.requirement_rule_versions (workspace_id, id, intervention_type),

  add constraint requirement_occurrences_pinned_scope_fkey
    foreign key (workspace_id, rule_version_id, blocking_scope, timing)
    references public.requirement_rule_versions
      (workspace_id, id, blocking_scope, timing),

  add constraint requirement_occurrences_pinned_stage_key_fkey
    foreign key (workspace_id, rule_version_id, stage_key)
    references public.requirement_rule_versions (workspace_id, id, stage_key),

  add constraint requirement_occurrences_stage_fkey
    foreign key (workspace_id, project_id, work_assignment_id, work_stage_id,
                 stage_key, stage_is_concealed)
    references public.work_stages
      (workspace_id, project_id, work_assignment_id, id, stage_key, is_concealed),

  add constraint requirement_occurrences_location_fkey
    foreign key (workspace_id, project_id, location_id)
    references public.locations (workspace_id, project_id, id),

  add constraint requirement_occurrences_author_fkey
    foreign key (workspace_id, created_by_member_id)
    references public.memberships (organization_id, id);

-- MATERIALISATION HAPPENS ONCE. One assignment, one stage, one rule version is one
-- obligation; a second run of the same materialisation must collide rather than
-- double every requirement the foreman is shown, with no way to tell the copies
-- apart. Beyond the target DDL, and the coalesce is there for the same reason as
-- work_stages_closable_unit_uniq: two NULL stages do not collide in SQL.
-- ordinal is DELIBERATELY NOT part of this key. It is the rule's position in an
-- ordered set, nothing constrains it to be distinct (M1 review finding 6), and
-- including it would let a duplicate pass by carrying a different ordinal — the
-- key would then enforce nothing that matters.
create unique index requirement_occurrences_materialisation_uniq
  on public.requirement_occurrences (workspace_id, work_assignment_id,
    coalesce(work_stage_id, '00000000-0000-0000-0000-000000000000'::uuid),
    rule_version_id);

-- requirement_occurrences.list reads one assignment's set in the order the field
-- client shows it (timing orders and prompts; ordinal breaks the tie).
create index requirement_occurrences_assignment_idx
  on public.requirement_occurrences (workspace_id, work_assignment_id, timing, ordinal, id);
-- M3's readiness projection reads the set of one stage.
create index requirement_occurrences_stage_idx
  on public.requirement_occurrences (workspace_id, project_id, work_stage_id)
  where work_stage_id is not null;
-- «Which obligations pin this version» — the question a retirement raises.
create index requirement_occurrences_rule_version_idx
  on public.requirement_occurrences (workspace_id, rule_version_id);

comment on table public.requirement_occurrences is
  'Materialised WHEN THE ASSIGNMENT IS CREATED, from the rule versions the '
  'published contract version binds, with no evidence yet linked and visible in '
  'the field client BEFORE WORK STARTS (ADR-005 decision 2; ADR-006 step 2). A '
  'placeholder that appears only after the work is covered is not advance notice. '
  'The pin is structural, not procedural: four foreign keys make it impossible to '
  'store an obligation that its assignment''s own baseline did not bind, that '
  'misreports the intervention type, blocking scope or timing of the version it '
  'pins, or that sits on a stage other than the one that version names. There is '
  'no status column and no satisfaction column: satisfaction is a projection over '
  'decisions, exceptions and review heads (state-catalog.csv '
  'requirement_occurrence.satisfaction) and it is never stored beside the '
  'obligation. Append-only — no UPDATE or DELETE grant plus app.reject_mutation(); '
  'v0.1 has no create route and no remove route, because a hand-made obligation is '
  'also a hand-removed one.';

comment on column public.requirement_occurrences.blocking_scope is
  'COPIED from the pinned rule version and pinned to it by '
  'requirement_occurrences_pinned_scope_fkey — never inferred from a severity word '
  'at read time (INV-066). All four scopes are storable; schema-v0.1.sql:1128''s '
  '«hold implies blocks_both» CHECK is deliberately not transcribed, because '
  'ADR-006 decision 4.4 makes a v0.1 hold blocks_stage_closure and the CHECK would '
  'make every v0.1 occurrence unstorable. THE v0.2 PACKAGE MILESTONE OWES a '
  'migration that widens every v0.1 hold to blocks_both, and it must widen the rule '
  'version and this column IN THE SAME STATEMENT: the foreign key above refuses a '
  'row that disagrees with the version it pins, in either direction.';

comment on column public.requirement_occurrences.rule_version_id is
  'The pinned version identity, never a live rule (INV-067). Retiring the version '
  'later changes nothing about this obligation — that is why retirement is a '
  'BEFORE INSERT trigger on the binding (0041:697-733) and not a foreign key '
  'anywhere. public.requirement_rules does not exist in v0.1 (ADR-006 decision '
  '4.1), and this column deliberately does not carry its lineage key beside the '
  'version: a second copy of a key with no referent proves nothing that the '
  'version''s own unique (workspace_id, requirement_rule_id, version_no) does not.';

-- ===========================================================================
-- 5. The deferred FK, activated — and the comment it corrects
--
-- supabase/migrations/0015_execution_evidence_module.sql:251 reads
-- «requirement_occurrence_id uuid,   -- FK deferred to v0.1-M3 with the table».
-- THE TABLE IS v0.1-M2, not M3: entity-catalog.csv:35 says so, ADR-006 decision
-- 4's milestone table says so, and version-0.1.md §v0.1-M2 §"Schema slice" says
-- so. 0015 is applied history and is never edited, so THIS COMMENT IS THE
-- CORRECTION (version-0.1.md:787 requires it to land exactly here): the FK is
-- added in migration 0043, 0015:251 said M3, and requirement_occurrences is M2.
--
-- STRONGER THAN THE CATALOGUED FORM, DELIBERATELY. relationship-catalog.csv:46
-- and schema-v0.1.sql:1141-1143 both declare
-- (workspace_id, requirement_occurrence_id) -> (workspace_id, id). That form lets
-- an upload intent in project A, under assignment X, name an occurrence in
-- project B under assignment Y, as long as both live in one workspace. The
-- four-column form below permits none of it: the original answers an obligation
-- OF THE ASSIGNMENT IT WAS CAPTURED UNDER, which is what «binds a captured
-- original to the obligation it was captured against» (version-0.1.md §v0.1-M2)
-- has to mean. 0015:103-107 is the precedent for being stricter than the target
-- document and saying so. relationship-catalog.csv:46 OWES A CORRECTION.
--
-- MATCH SIMPLE: requirement_occurrence_id is nullable, and every deployed
-- upload_intents row carries NULL there (no occurrence has ever existed), so the
-- constraint is satisfied by every existing row and validation cannot fail. An
-- intent that names no occurrence stays legal — in v0.1 that is every intent
-- until the capture path starts sending one.
-- ===========================================================================
alter table public.upload_intents
  add constraint upload_intents_occurrence_fkey
  foreign key (workspace_id, project_id, work_assignment_id, requirement_occurrence_id)
  references public.requirement_occurrences
    (workspace_id, project_id, work_assignment_id, id);

comment on column public.upload_intents.requirement_occurrence_id is
  'The obligation this original was captured against. THE FK IS ADDED IN MIGRATION '
  '0043; supabase/migrations/0015_execution_evidence_module.sql:251 said «deferred '
  'to v0.1-M3 with the table» and that is wrong about the milestone — '
  'requirement_occurrences is v0.1-M2 (entity-catalog.csv:35, ADR-006 decision 4, '
  'version-0.1.md §v0.1-M2). 0015 is applied history and is never edited, so this '
  'comment is where the correction lives. The key is (workspace, project, '
  'assignment, occurrence) rather than the (workspace, occurrence) form of '
  'relationship-catalog.csv:46: a captured original may only answer an obligation '
  'of the assignment it was captured under, and the narrower catalogued form would '
  'have permitted a cross-project pairing inside one workspace. Nullable, so an '
  'intent that names no occurrence stays legal; in v0.1 one original answers one '
  'occurrence through this column and evidence_requirement_links is v0.2.';

-- ===========================================================================
-- 6. CONTRADICTION 8 — the origin_method vocabulary gains its seventh value
--
-- INV-086: an object captured through the v0.1 PWA is recorded with an origin
-- method meaning the origin is NOT DISTINGUISHED, and never as native_camera. A
-- browser page has no camera-session identity and may be handed bytes the browser
-- stripped or transcoded, so the origin cannot be established (ADR-007 decision 5).
-- state-catalog.csv:127 carries the token and says «IT DOES NOT YET EXIST WHERE IT
-- MUST»; schema-v0.1.sql:97 carries it in the target enum; the deployed CHECKs at
-- 0015:254-255 and 0015:311-312 carry six values. Until they carry seven, no PWA
-- capture may be recorded at all.
--
-- IT IS ADDITIVE AND IT IS SAFE, and here is the whole of why:
--   * a widening admits every value it admitted before, so no stored row becomes
--     unstorable and no existing write path changes behaviour;
--   * the new constraint is validated against existing rows on ADD; every existing
--     row satisfies the six-value list, which is a subset of the seven-value list,
--     so validation cannot fail;
--   * this database has no enum type for capture origin (0015:1-11), so there is
--     no ALTER TYPE ... ADD VALUE, no transaction restriction and no ordering
--     question. The deployed shape is text + CHECK and a CHECK is replaceable.
--
-- THE ONE WAY IT WOULD NOT HAVE BEEN SAFE, AND WHY BOTH TABLES ARE HERE:
-- origin_method is COPIED from the intent onto the evidence object by the
-- finalization function (0035:101-108, and 0029/0032/0033 before it). Widening
-- only upload_intents would let a PWA intent be created and then fail at
-- finalization, inside a SECURITY DEFINER function, at the moment the foreman is
-- told his photo is saved. The two CHECKs are one vocabulary and they move
-- together or not at all.
--
-- THE CONSTRAINT NAMES are PostgreSQL's defaults for the inline column CHECKs at
-- 0015:254-255 and 0015:311-312 ({table}_{column}_check). 0016:20-26 dropped
-- 0010's inline capability CHECK by exactly this convention. The drops below are
-- NOT written `if exists`: were the name different, `if exists` would skip
-- silently and the ADD would leave BOTH constraints in place — the narrow one
-- still refusing the new value, with nothing in any log to say so. A loud failure
-- here is the correct outcome.
--
-- WHAT THIS DOES NOT DO. It makes the value STORABLE. It does not make INV-086
-- true. Three things still owe, in the slice that ships the PWA capture path:
--   * packages/contracts/src/uploads.ts:9 carries FOUR values
--     (native_camera, photo_picker, file_picker, form) and must carry
--     origin_not_distinguished — note it has never carried the six the database
--     accepts, because `import` and `generated_derivative` are written by server
--     paths and never by a client request;
--   * the PWA sends origin_not_distinguished and never native_camera;
--   * a test asserts that a request carrying native_camera from the PWA client
--     build is REJECTED — the required behaviour, which has no current
--     counterpart because there is no PWA.
-- ===========================================================================
alter table public.upload_intents
  drop constraint upload_intents_origin_method_check;
alter table public.upload_intents
  add constraint upload_intents_origin_method_check
  check (origin_method in ('native_camera','photo_picker','file_picker','form',
                           'import','generated_derivative','origin_not_distinguished'));

alter table public.evidence_objects
  drop constraint evidence_objects_origin_method_check;
alter table public.evidence_objects
  add constraint evidence_objects_origin_method_check
  check (origin_method in ('native_camera','photo_picker','file_picker','form',
                           'import','generated_derivative','origin_not_distinguished'));

comment on column public.evidence_objects.origin_method is
  'How the bytes reached the product. ''origin_not_distinguished'' is MANDATORY for '
  'any object captured through the v0.1 PWA and was added to both CHECKs by '
  'migration 0043 (INV-086; ADR-007 decision 5; state-catalog.csv:127). A browser '
  'page has no camera-session identity and may be handed bytes the browser stripped '
  'or transcoded, so the origin cannot be established and must not be asserted. '
  'THIS COLUMN IS NOT PROVENANCE: no value here is evidence of where a photo came '
  'from, and no UI, package, render, demo or sales sentence may claim '
  'camera-versus-gallery discrimination on the strength of it. Storability is not '
  'the invariant — the capture path must WRITE the value, and '
  'packages/contracts/src/uploads.ts must accept it, before any PWA capture may be '
  'recorded at all.';

-- ===========================================================================
-- 7. Grants allowlist
--
-- NO UPDATE and NO DELETE on either table, for different reasons that both end in
-- the same grant:
--   requirement_occurrences is an append_only_fact (entity-catalog.csv:35) and
--     stays one in every version — there is no correction path for an obligation,
--     only a new assignment;
--   work_stages is draft_mutable (entity-catalog.csv:40) and its one mutation is
--     the M3 closure. M3 grants the UPDATE together with the guard that bounds it,
--     which is the order 0042 used for contract_versions. Granting it now would
--     leave an ungoverned UPDATE on a table whose closure semantics do not exist
--     yet, and «once either closure exists the status can never move again» would
--     be a sentence in a comment.
--
-- Route by route, so an unused grant is visible:
--   work_stages              SELECT  requirement_occurrences.list's join,
--                                    assignments.list, M3 readiness
--                            INSERT  assignments.create (materialisation), and in
--                                    M3 work_stages.create
--   requirement_occurrences  SELECT  requirement_occurrences.list — the foreman's
--                                    read before work starts — and the M2 dry run
--                            INSERT  assignments.create, and nothing else in v0.1
--
-- aktflow_service gets nothing: neither table records a server-observed fact, so
-- 0035's server-only plane does not apply. The service principal's one M2 job is
-- upload finalization, which touches neither.
-- ===========================================================================
revoke all on public.work_stages, public.requirement_occurrences
  from public, anon, authenticated;

grant select, insert on public.work_stages             to aktflow_app;
grant select, insert on public.requirement_occurrences to aktflow_app;

-- ===========================================================================
-- 8. Append-only enforcement — the layer beyond grants
--
-- app.reject_mutation() is 0013:5-9 and is reused unchanged.
--
-- On work_stages this trigger is REPLACED IN M3, not dropped: the closure
-- migration does `drop trigger work_stages_immutable; create trigger
-- work_stages_guard ...` in one statement, exactly as 0042:280-283 replaced
-- contract_versions_immutable. An append-only table quietly losing its guard is a
-- failure this repository has already had once (0042:59-65).
-- ===========================================================================
create trigger work_stages_immutable before update or delete
  on public.work_stages
  for each row execute function app.reject_mutation();

create trigger requirement_occurrences_immutable before update or delete
  on public.requirement_occurrences
  for each row execute function app.reject_mutation();

-- ===========================================================================
-- 9. RLS
--
-- Every write policy names the capability the route checks. 0014 exists because
-- M1's write policies asked only for active membership, so the database could not
-- catch a command-layer mistake; 0016:90-93 says that must not recur, and it does
-- not recur here.
--
-- THE READ SIDE IS project.view ON PURPOSE. capabilities.csv:14 says it in terms:
-- «this is also how the foreman reads the occurrence set for an assignment before
-- work starts (ADR-006 step 2)», and lists requirement_occurrences.list among its
-- operations. The foreman holds progress.record and evidence.record through the
-- `foreman` preset, and reads the obligation through project.view; a narrower read
-- policy here would make the central M2 screen unreachable for the persona it was
-- built for.
--
-- THE WRITE SIDE IS assignments.manage, AND ONE CAPABILITY ROW DISAGREES WITH
-- ANOTHER ABOUT THAT. capabilities.csv:18 (assignments.manage, v0.1-M2) says
-- «Create and maintain work assignments and the work stages beneath them;
-- assignment creation materialises the requirement occurrences from the bound rule
-- versions before work starts», and names assignments.create and
-- work_stages.create. capabilities.csv:23 (requirements.assign, v0.1-M2) ALSO
-- claims materialisation — «Materialise requirement occurrences from bound rule
-- versions AT ASSIGNMENT CREATION and run the uncovered-line dry run» — while
-- naming exactly one operation, requirement_occurrences.dry_run, which writes
-- nothing at all, and while saying itself that «the only way an occurrence exists
-- in v0.1 is materialisation through assignments.create (assignments.manage)».
-- The policies below follow the operation, not the prose: the command that INSERTS
-- is assignments.create and it runs under assignments.manage. Naming
-- requirements.assign here would deadlock the persona that creates assignments —
-- project_manager holds project.admin and assignments.manage and not
-- requirements.assign (responsibility-presets.csv) — which is the shape of gap M1
-- review finding 8 found in a different table.
--   AND requirements.assign COULD NOT BE NAMED HERE EVEN IF IT SHOULD BE: it is
--   in NONE of the three places the project-capability vocabulary lives. Not in
--   the CHECK on public.project_access_grants (0016:24-26, widened by 0041:539-546
--   to ten values), not in projectCapability (packages/contracts/src/
--   project-access.ts:17-21), not in ProjectCapability (packages/domain/src/
--   authz.ts:18-21). No grant row carrying it can be written today, so a policy
--   naming it would be unsatisfiable and the dry-run route would fail at grant
--   time with the 422 that packages/testing/src/capability-vocabulary.test.ts was
--   written after. THE SLICE THAT SHIPS requirement_occurrences.dry_run MUST WIDEN
--   ALL THREE IN ONE CHANGE. It is not widened here, because a capability with no
--   route is dead surface and this migration ships no route.
-- ===========================================================================
alter table public.work_stages             enable row level security;
alter table public.requirement_occurrences enable row level security;

create policy ws_select on public.work_stages for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy ws_insert on public.work_stages for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['assignments.manage']));

create policy ro_select on public.requirement_occurrences for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy ro_insert on public.requirement_occurrences for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['assignments.manage']));

-- ===========================================================================
-- 10. What the catalogs owe, recorded here rather than edited into them
--
-- A migration that edits prose is a migration nobody can review (0042:479-490).
-- Five corrections are owed by this slice and none of them is made here:
--
--   1. version-0.1.md §v0.1-M2 §"Schema slice" says M2 «builds one» table and
--      names five. It builds TWO, and the fifth is work_stages (contradiction 5,
--      resolved by the owner as the plan's option A).
--   2. entity-catalog.csv:40 marks work_stages v0.1-M3. The TABLE is v0.1-M2 and
--      the CLOSURE COMMAND is v0.1-M3. ADR-006 decision 4's own rule — «no catalog
--      may re-tag a deployed table to a future version» — is about the opposite
--      direction, and once this migration applies, a v0.1-M3 marker on a table
--      that exists in the runtime asserts something false about the world.
--   3. relationship-catalog.csv:54 keeps requirement_occurrences ->
--      requirement_template_versions «for deployed lineage only». There is no
--      deployed lineage: the table is created empty here and the column is not
--      built (departure 3).
--   4. relationship-catalog.csv:46 declares the upload-intent FK as
--      (workspace_id, requirement_occurrence_id). It is built four columns wide
--      and deliberately stricter (§5).
--   5. state-catalog.csv:127 says of origin_not_distinguished «IT DOES NOT YET
--      EXIST WHERE IT MUST», naming the deployed CHECK and
--      packages/contracts/src/uploads.ts. After this migration ONE HALF of that
--      sentence is stale and the other half is not: the CHECKs carry it, the
--      contract does not, and «until both carry it no PWA capture may be recorded
--      at all» still holds.
--
-- And one gap that is NOT a documentation correction, restated at the bottom
-- because it blocks the command this table exists for: the rule predicate's first
-- argument, work_type_key, has no carrier on public.work_items and therefore no
-- value to match at assignment creation. See the header. It is a scope decision an
-- ADR must make (glossary.md:109), not a column a migration may add on the way
-- past.
--   CORRECTED IN PLACE: migration 0050 adds public.work_items.work_type_key, so
--   the carrier exists and the sentence above is true of 0043's own moment only.
--   The comment below is corrected with it. The OWNING ENTITY for the work-type
--   vocabulary is still not created and is still an ADR's decision — 0050 §3.
-- ===========================================================================
-- SUPERSEDED BY MIGRATION 0051 §3 — same reason as the table comment above.
-- «NOT constrained relationally, deliberately» stayed literally true (0051 adds
-- a trigger over a join and not a foreign key, because the stage vocabulary
-- still has no owning entity), but «a stage with no bound rule is legal» became
-- true only of a line that implies no stage.
comment on column public.work_stages.stage_key is
  'One value of the stage vocabulary the contract-version rule bindings pin: the '
  'set of stage_key values bound to a contract version IS that version''s stage '
  'vocabulary (0041:445-449), which is what lets assignments.create materialise '
  'stages and occurrences in one transaction from one binding. NOT constrained '
  'relationally, deliberately — a stage with no bound rule is legal and is the '
  'uncovered line INV-072 must print. The MATCHING of a rule to a work line also '
  'needs the predicate''s first argument, and public.work_items.work_type_key '
  'carries it from migration 0050 — nullable, so a line that names no work type '
  'matches nothing and is disclosed as work_type_unresolved rather than refused. '
  'The set of work types still has no owning entity: it is whatever keys the '
  'workspace''s published rule versions carry (0050 §3).';
