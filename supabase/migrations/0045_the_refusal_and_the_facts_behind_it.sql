-- 0045: the refusal, and the facts it is made of (v0.1-M3).
--
-- THE NUMBER. 0041-0044 are taken; 0041:369-372 already names 0045 as the next
-- free number. This file is v0.1-M3's schema half. Its second half is 0046,
-- which moves the valuation carve to admission (ADR-008) and is separate for the
-- reason 0044 was separate from 0043: 0046 is a BEHAVIOUR CHANGE TO A DEPLOYED
-- ROUTE and deserves its own rollback and its own review.
--
-- WHAT THIS ADDS
--   Six tables — public.requirement_exceptions, public.requirement_exception_heads,
--   public.requirement_evidence_decisions,
--   public.requirement_evidence_decision_heads, public.stage_closures and
--   public.stage_closure_occurrences — plus the two projections
--   public.readiness_projection and public.blocked_reasons; the composite uniques
--   on public.requirement_occurrences and public.work_stages that back their
--   foreign keys; four values in the project-capability CHECK; and THE ONE
--   TRANSITION public.work_stages.status exists for — open -> closed — which
--   migration 0043 declared and deliberately did not open
--   (0043:462-470, 0043:898-903).
--
--   Nothing here writes a row and no route ships in this file.
--
-- WHAT THIS DOES NOT CHANGE
--   No table is dropped. No column is dropped. No row is written, deleted or
--   rewritten. Migrations 0001-0044 are applied history and are NOT edited.
--   0043 and 0044 were written on this uncommitted branch and are not edited
--   either — this file only adds to what they built.
--
--   ONE EXISTING GUARANTEE IS REPLACED RATHER THAN WEAKENED, and the arithmetic
--   is stated here so a reviewer can check it. `work_stages_immutable` (0043:935)
--   rejected EVERY update and delete. It is replaced by app.guard_work_stage(),
--   which rejects every delete, rejects every update whose old status is not
--   'open', rejects every update whose new status is not 'closed', rejects any
--   change outside {status, version, updated_at}, and rejects a version that does
--   not advance by exactly one. A CLOSED stage is therefore exactly as immutable
--   as every stage was on 0043, an OPEN stage may take exactly one step, and
--   'closed_without_evidence' — the v0.2 bypass — is unreachable through the
--   guard rather than through a CHECK somebody would have to drop. This is the
--   replacement 0043:929-933 named as owed, in the shape 0042:280-283 used.
--
--   ONE CONSTRAINT IS ADDED TO A DEPLOYED TABLE AND VALIDATED AGAINST EXISTING
--   ROWS: the widened project-capability CHECK (§1). It is a widening, so every
--   value it accepted before is still accepted and validation cannot fail.
--   The six uniques of §2 are all (already-unique key) + (extra columns) on
--   tables created empty by 0043, so none of them can fail either.
--
-- ROLLBACK
--   Dev only, and only while no closure, decision or exception exists. THE ORDER
--   IS LOAD-BEARING — referencing objects before referenced ones, or the drop
--   fails and the next hand reaches for CASCADE:
--     drop trigger work_stages_closure_fact_required on public.work_stages;
--     drop trigger work_stages_guard on public.work_stages;
--     create trigger work_stages_immutable before update or delete
--       on public.work_stages for each row execute function app.reject_mutation();
--     revoke update on public.work_stages from aktflow_app;
--     drop policy ws_update on public.work_stages;
--     drop function app.assert_stage_closure_exists();
--     drop function app.guard_work_stage();
--     drop table public.blocked_reasons;
--     drop table public.readiness_projection;
--     drop table public.stage_closure_occurrences;   -- takes its policies and
--     drop table public.stage_closures;              -- triggers with it
--     drop function app.assert_stage_closure_set();
--     drop function app.guard_closure_member_window();
--     drop table public.requirement_evidence_decision_heads;
--     drop table public.requirement_evidence_decisions;
--     drop table public.requirement_exception_heads;
--     drop table public.requirement_exceptions;
--     drop function app.guard_requirement_head();
--     alter table public.requirement_occurrences
--       drop constraint requirement_occurrences_type_scope_key,
--       drop constraint requirement_occurrences_role_scope_key,
--       drop constraint requirement_occurrences_stage_blocking_key,
--       drop constraint requirement_occurrences_attribution_key;
--     alter table public.work_stages
--       drop constraint work_stages_closure_scope_key;
--     alter table public.project_access_grants
--       drop constraint project_access_grants_capability_check;
--     alter table public.project_access_grants
--       add constraint project_access_grants_capability_check
--       check (capability = any (array[
--         'project.admin','project.view','contracts.edit','imports.manage',
--         'imports.publish','assignments.manage','progress.record','progress.adjust',
--         'evidence.record','rule_bindings.manage','requirements.assign']));
--   ONCE ONE STAGE HAS BEEN CLOSED THERE IS NO ROLLBACK. Dropping
--   public.stage_closures destroys the only record that a hidden stage was closed
--   with its evidence satisfied, and the stage row keeps `status = 'closed'` with
--   nothing behind it — the exact shape this migration exists to make
--   unrepresentable. Narrowing the capability CHECK back also fails while any
--   grant row carries one of the four new values, and a revoke sets revoked_at
--   rather than removing the row. Staging and production take a corrective
--   forward migration instead.
--
-- WHAT WAS NOT CHECKED
--   NOTHING HERE WAS EXECUTED. No psql, no supabase, no migration run, no test.
--   Static reading of 0011, 0013, 0015, 0016, 0017, 0025, 0030, 0034, 0035, 0041,
--   0042, 0043 and 0044, against technical/database/schema-v0.1.sql,
--   entity-catalog.csv, invariant-catalog.csv, state-catalog.csv,
--   transition-catalog.csv, capabilities.csv and error-catalog.csv, is the only
--   check performed on it. No claim is made that it applies.
--
-- ---------------------------------------------------------------------------
-- WHY THE TARGET DDL IS NOT TRANSCRIBED
--
-- technical/database/schema-v0.1.sql is the SHAPE to build toward, not a file to
-- copy (0015:1-11, 0043:83-91). The three standing deviations apply unchanged:
-- the workspace table is public.organizations, the membership key is
-- public.memberships (organization_id, id), and vocabularies are text + CHECK
-- because this database has no enums. Content hashes are text with a hex CHECK,
-- matching public.import_files.content_hash — which is why the frozen occurrence
-- set hash below is `text ~ '^[0-9a-f]{64}$'` and not the target's `bytea`.
--
-- SEVEN DEPARTURES FROM THE TARGET DDL, each because the target shape cannot
-- carry the guarantee the milestone is about:
--
--   1. THE FROZEN OCCURRENCE SET IS A TABLE, NOT THREE jsonb ARRAYS.
--      schema-v0.1.sql:1447-1451 carries evaluated_occurrence_ids,
--      relied_on_decision_ids and relied_on_notice_outcome_ids as jsonb arrays.
--      A jsonb array of uuids REFERENCES NOTHING: the ids may name another
--      workspace's occurrences, a decision that returned rather than accepted,
--      or nothing at all, and no constraint can tell. §5 replaces them with
--      public.stage_closure_occurrences — one row per occurrence the predicate
--      quantified over, each pinned by foreign key to an occurrence OF THIS
--      STAGE and to the exact accepting decision or waiver/accept_risk exception
--      it was satisfied by. The count and the set hash STAY on the closure, and
--      §5's deferred constraint trigger proves they describe the rows.
--      relied_on_notice_outcome_ids is not built at all: notices and attendance
--      outcomes are v0.2 (ADR-006 decision 5) and a column with no producer in
--      the version that ships it is surface, not lineage.
--
--   2. THE PREDECESSOR ORDINAL IS A PLAIN COLUMN, CHECK-FORCED.
--      The target gives each lineage `closure_no` + `unique (predecessor)`,
--      which stops forks and stops two roots but lets a successor claim
--      closure_no = 5 behind a root at 1 — a chain with a hole in it. Every
--      lineage here carries a predecessor ORDINAL as well as a predecessor id,
--      CHECK-forced to `ordinal - 1` and joined back by a composite self-FK, so
--      the chain is contiguous. It is a plain column rather than
--      `generated always as (...) stored` for the reason 0015 keeps
--      `root_is_root` beside the generated `is_root`: this database's precedent
--      puts generated columns on the REFERENCED side of a foreign key only.
--
--   3. ROOT UNIQUENESS IS A KEY, NOT ONLY A HEAD.
--      INV-035 says the exception and occurrence-decision lineages «cannot fork
--      and cannot carry two independent roots». `unique (workspace_id,
--      predecessor_id)` stops the fork; it does NOT stop two roots, because two
--      NULLs do not collide in SQL. entity-catalog.csv resolves that with the
--      two head tables, and they are built here — but the head enforces root
--      uniqueness only PROCEDURALLY, through a command that remembers to lock it
--      and to check that `current_*_id is null` before writing a root. So each
--      lineage also carries `unique (workspace_id, <lineage scope>, ordinal)`,
--      which makes a second root a 23505 with no command involved. The heads
--      keep both of their other jobs: they are the row a command LOCKS, and they
--      are the «current» pointer satisfied(o) reads.
--
--   4. THE HEAD PINS WHAT IT POINTS AT.
--      The target's heads carry `foreign key (workspace_id, current_*_id)`, which
--      permits a head for occurrence A and role R to point at a decision on
--      occurrence B in role R'. Both heads here carry the occurrence and the role
--      or scope INTO the foreign key, and additionally carry the pointed-at row's
--      OUTCOME or ACTION as a pinned copy, so readiness can ask «does the current
--      head accept» without a join and without a column that can disagree with
--      the row it copies. Safe as a copied literal for the reason 0043:303-311
--      gives: outcome and action are TERMINAL on append-only tables.
--
--   5. THE THREE EXTERNAL COLUMNS EXIST AND ARE SHUT.
--      schema-v0.1.sql:1255-1257 puts external_session_id,
--      external_access_grant_id and decision_batch_id on the decision and adds
--      their foreign keys after section 7 — that is, in M5. The columns are built
--      here so M5 adds FOREIGN KEYS rather than COLUMNS, and one separately named
--      constraint, requirement_evidence_decisions_v01_internal_only_check,
--      forces the internal arm until then. WITHOUT IT the three columns would be
--      uuid columns with no referent for the whole of v0.1, and a decision could
--      be stored with no attributable actor at all — `decided_by_member_id` null
--      and three invented uuids. THE M5 SLICE DROPS EXACTLY THAT ONE CONSTRAINT
--      AND ADDS THE THREE FOREIGN KEYS IN THE SAME STATEMENT. It is named,
--      single-purpose and documented for that reason: 0043:529-532 is right that
--      «dropping a CHECK is the migration nobody reviews», and the answer is a
--      CHECK whose removal is written down as another migration's stated job.
--
--   6. A RETURNED DECISION CARRIES FREE TEXT AND SAYS SO.
--      state-catalog.csv:120 records requirement_evidence_decision.return_reason
--      as NOT_ENUMERATED — «a recorded gap that BLOCKS v0.1-M5» — and gives the
--      v0.1-shaped alternative in terms: «or the return to record free text plus
--      the requirement occurrence it concerns and say so». That is what is built:
--      `reason` is required for outcome 'returned' and there is NO code column
--      and no vocabulary CHECK, because inventing one here is exactly what that
--      row forbids.
--
--   7. NO project_id ON THE TARGET'S EXCEPTION AND HEAD ROWS; THERE IS ONE HERE.
--      entity-catalog.csv marks every one of these entities project_scoped, and
--      every RLS policy in this database reaches its answer through
--      app.has_project_capability(workspace_id, project_id, ...). Without the
--      column each policy would need a subquery into
--      public.requirement_occurrences, whose own SELECT policy would then decide
--      who may write — the failure 0030:36-48 corrected once already. The column
--      is pinned to the occurrence by composite FK, so it cannot drift.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION DOES NOT ENFORCE, NAMED SO IT IS NOT MISTAKEN FOR ENFORCED
--
-- * INV-061 IS ENFORCED HERE ONLY UP TO CURRENCY. After §5, a stage_closures row
--   can exist only if EVERY applicable blocking occurrence of that stage carries
--   a member row, and every member row names an ACCEPTING decision on that
--   occurrence or a waiver/accept_risk exception on it. What the database cannot
--   see is whether that decision or exception is the CURRENT head at closure
--   time: a superseded acceptance and a revoked waiver are both still rows, and
--   satisfied(o) quantifies over the head (execution-and-evidence.md
--   §Satisfaction, «"Current" always means the head selected by the serialized
--   lineage»). THE COMMAND MUST COMPARE THE MEMBER'S FACT WITH THE HEAD, under
--   the head lock, inside the closure transaction — INV-061's own enforcement
--   column says the predicate is «evaluated inside the closure transaction under
--   the stage row lock», and this migration narrows what that evaluation can get
--   wrong without removing it.
--
-- * INV-069 IS NOT ENFORCED HERE AT ALL. «The decider may never be the capturer»
--   needs a join from the decision to the occurrence to the upload intents
--   captured against it and to the progress entries of its assignment.
--   invariant-catalog.csv:70 assigns it to the command, and a trigger would have
--   to be SECURITY DEFINER to be sound: a non-definer guard reads under the
--   mutating role, finds nothing where RLS hides rows, and FAILS OPEN — the exact
--   reverse of the case 0042:288-291 reasons about, where failing on a NULL was
--   the safe direction. A definer guard is writable and is not written here,
--   because it would have to encode which capture and progress facts count as
--   «their own» and no document in this package fixes that set.
--
-- * INV-051 IS NOT ENFORCED HERE. «Older projection results cannot overwrite
--   newer» needs an ORDER over source_watermark, and no document in this package
--   gives the watermark a format, let alone an ordering. A guard comparing two
--   texts would enforce a rule nobody wrote. §7 records it as owed by the slice
--   that defines the watermark.
--
-- * NOTHING WRITES EITHER PROJECTION. There is no projection rebuilder in this
--   repository: event-catalog.csv names `projection_rebuilder` as the consumer of
--   work_stage.closed, requirement_evidence_decision.recorded and
--   requirement_exception.recorded, and supabase/functions/outbox-drain/index.ts
--   says in terms that drained rows have no deployed consumer. §7 builds the two
--   tables the M3 route set reads and gives the write grant to aktflow_service
--   alone; until a rebuilder exists, readiness.get and blocked_reasons.get answer
--   with nothing. This is recorded, not hidden: it is the same shape as M1 review
--   finding 2, where a table existed and nothing in production put rows in it.
--
-- * INV-065'S THIRD CLAUSE HAS NO v0.1 FORM, AND THIS MIGRATION MAKES THAT
--   VISIBLE RATHER THAN CAUSING IT. The invariant reads «recording performed
--   quantity — recording evidence capture — and recording that a stage was in
--   fact covered are always permitted», and version-0.1.md §v0.1-M3 lists the
--   third as an exit gate AND as a security test. The first two are untouched
--   here: nothing in this file is reachable from progress.record, progress.adjust
--   or the evidence path, and §6 grants UPDATE on public.work_stages to nobody
--   but the closure. THE THIRD HAS NO CARRIER IN v0.1. The fact that records «it
--   was covered and the evidence was not there» is public.unevidenced_closures,
--   and ADR-006 decision 4 puts it in v0.2 — so after this migration a stage may
--   reach 'closed' only through a satisfied closure, and a crew that covered work
--   without its evidence has nowhere to say so. That is the correct reading of
--   the scope decisions and it is NOT what the invariant says. Either INV-065
--   gains a v0.1 qualifier the way INV-061, INV-062 and INV-071 already carry
--   one, or version-0.1.md §M3 stops listing an exit gate no v0.1 route can meet.
--   Neither is a migration's to make.
--
-- * THE MONEY ON A blocked_reason IS NOT DEFINED ANYWHERE. §7 builds the columns
--   ADR-005 decision 6 names and the CHECKs that couple them, and it cannot build
--   the rule that fills them: ADR-006 step 6 says «the amount of the work lines
--   under a blocked stage, at the price on the published baseline, attributed once
--   per assignment», and public.work_assignments is a SLICE of a work item
--   (planned_quantity, nullable), so two assignments on one line would each
--   attribute the line's whole amount and INV-070's per-assignment deduplication
--   would not prevent it. That is a product decision, not a column.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 0. Capability probes
--
-- §5's deferred constraint trigger recomputes the frozen set hash with
-- sha256(bytea), a core function since PostgreSQL 11 that needs no extension,
-- and §5's insert-window guard compares a row's xmin against the current
-- transaction id, which needs the xid8 -> xid cast (PostgreSQL 13+) — the same
-- probe 0042:145-148 runs for the same reason. A plpgsql body is only
-- syntax-checked at CREATE FUNCTION, so a missing function or cast would not
-- surface until the first closure. Both are evaluated now and fail the migration
-- loudly instead.
-- ===========================================================================
do $$
begin
  perform pg_current_xact_id()::xid;
  -- The empty-set hash is asserted, not merely computed: it is the value every
  -- vacuous closure carries (a stage with no blocking occurrence closes, and
  -- that is correct behaviour — schema-v0.1.sql:1482), and a TypeScript caller
  -- has to produce the identical constant.
  if encode(sha256(convert_to('', 'UTF8')), 'hex')
     <> 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' then
    raise exception 'sha256/convert_to/encode do not agree with the frozen-set hash definition';
  end if;
end $$;

-- ===========================================================================
-- 1. The four capabilities M3's routes check
--
-- The project-capability vocabulary is stated in THREE places and derived in
-- none: this CHECK, the zod enum `projectCapability`
-- (packages/contracts/src/project-access.ts) and the TypeScript union
-- `ProjectCapability` (packages/domain/src/authz.ts).
-- packages/testing/src/capability-vocabulary.test.ts asserts that the first two
-- enumerate the same set. ALL THREE MOVE IN THIS SLICE — that is the discipline
-- 0044:48-55 records 0041 failing and 0044 keeping, and the two TypeScript
-- halves are route work in the same commit as this file.
--
-- The four values and their rows in technical/permissions/capabilities.csv:
--   requirement_exceptions.decide  :24  requirement_exceptions.create
--   evidence_decisions.decide      :26  evidence_decisions.create
--   stage_closures.close           :28  stage_closures.create
--   readiness.view                 :31  readiness.get blocked_reasons.get
--                                       blocked_value.get
-- No value is invented: every one is a capability_id already in that file, with
-- its milestone already v0.1-M3.
--
-- A WIDENING. Every value previously accepted is still accepted, so the re-added
-- constraint is validated against existing rows and cannot fail on them: the old
-- eleven-value set is a subset of the new fifteen.
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
    'readiness.view']));

-- ===========================================================================
-- 2. The composite uniques that back the new foreign keys
--
-- Same move as 0015:13-28, 0023:19-21 and 0043:293-324: a table's existing
-- uniques cannot back the references the new tables need, so the keys are
-- declared before the tables that use them.
--
-- All six are on (an already-unique key) + (extra columns), so no two rows can
-- collide on them that did not already collide on the narrower key, and
-- validation against existing rows cannot fail — the narrower keys here are
-- public.requirement_occurrences (workspace_id, project_id, id) and
-- public.work_stages (workspace_id, project_id, id), both declared by 0043 on
-- tables 0043 created empty. Each takes an ACCESS EXCLUSIVE lock and builds an
-- index; on pilot-scale tables that is a moment, and it is stated rather than
-- assumed.
--
-- Every one is NAMED. PostgreSQL's auto-name for five and six columns exceeds
-- the 63-byte identifier limit and truncates, and a clipped name is one no
-- rollback line can reproduce (0043:411-413).
-- ===========================================================================

-- An exception may only be written against the intervention type the occurrence
-- ACTUALLY carries. INV-063 — «a hold can never carry a not_applicable
-- exception» — is then a CHECK over a column the occurrence pinned, not over a
-- second opinion the command supplied.
alter table public.requirement_occurrences
  add constraint requirement_occurrences_type_scope_key
  unique (workspace_id, project_id, id, intervention_type);

-- A decision may only exist in the role the occurrence names, which is what
-- satisfied(o) quantifies over for a hold (INV-061). 0043 declared
-- unique (workspace_id, id, approver_role) for exactly this; this is the same
-- key with project_id, so one foreign key carries the tenancy leg too.
alter table public.requirement_occurrences
  add constraint requirement_occurrences_role_scope_key
  unique (workspace_id, project_id, id, approver_role);

-- The frozen closure set. A member row names an occurrence, and the key it
-- resolves against carries the STAGE and the BLOCKING SCOPE, so a closure cannot
-- freeze an occurrence of a different stage, and cannot pad its set with an
-- advisory one to make the count come out right.
alter table public.requirement_occurrences
  add constraint requirement_occurrences_stage_blocking_key
  unique (workspace_id, project_id, id, work_stage_id, blocking_scope);

-- INV-070's deduplication key. A blocked_reason attributes money to ONE work
-- assignment; without this key work_assignment_id on that row is free text and
-- the per-assignment deduplication sums whatever the projection typed.
alter table public.requirement_occurrences
  add constraint requirement_occurrences_attribution_key
  unique (workspace_id, project_id, id, work_assignment_id, rule_version_id);

-- The stage identity a closure may pin, in one key: the project, the assignment,
-- the contract, and the status. 0043:426 declared
-- unique (workspace_id, project_id, id, status) and said in terms that it was
-- «declared now though nothing in M2 uses it»; this is that key plus the two
-- columns the closure would otherwise carry unpinned. Copying the 'closed'
-- literal onto the closure is safe for the reason 0043:303-311 gives and this
-- migration makes true: after §6, 'closed' is TERMINAL on public.work_stages —
-- app.guard_work_stage() rejects every update whose old status is not 'open'.
alter table public.work_stages
  add constraint work_stages_closure_scope_key
  unique (workspace_id, project_id, id, work_assignment_id, contract_id, status);

-- ===========================================================================
-- 3. requirement_exceptions — the only escape v0.1 has
--
-- ADR-006 decision 4 keeps the bypass out of v0.1 because its whole price is
-- package ineligibility and a version with no packages has no price to charge.
-- So this table is it: «One attributed, visible escape exists, which is what
-- ADR-005's argument against an absolute lock actually requires»
-- (execution-and-evidence.md §"Closure without evidence").
--
-- THE VOCABULARY. state-catalog.csv:109-111 enumerates requirement_exception.kind
-- as waiver / accept_risk / not_applicable, and execution-and-evidence.md:506 and
-- ADR-005 decision 3 use the same three words. schema-v0.1.sql:102's enum reads
-- ('waive','not_applicable','accept_risk','revoke') — a different first token and
-- a fourth value. THE CATALOG WINS ON THE TOKEN: state-catalog.csv is the
-- stored_vocabulary authority and 'waiver' is what three documents write.
-- 'revoke' is KEPT in the CHECK and is written by no v0.1 route: the same shape,
-- and the same reason, as 0043 keeping 'closed_without_evidence' on
-- work_stages.status — the head has to be able to stop pointing at a live
-- exception, execution-and-evidence.md:388 requires «an authorized explicit
-- exception successor/revocation», scope-v0.1.csv has no revoke operation, and a
-- value added later would reinterpret v0.1 records. A 'revoke' NEVER SATISFIES:
-- §5's member row admits only 'waiver' and 'accept_risk'.
-- ===========================================================================
create table public.requirement_exceptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  -- Departure 7: not in the target DDL. Every RLS policy in this database asks
  -- app.has_project_capability(workspace_id, project_id, ...), and the column is
  -- pinned to the occurrence by the composite FK below.
  project_id uuid not null,
  requirement_occurrence_id uuid not null,
  -- Pinned FROM the occurrence, never restated by the caller. This is what makes
  -- INV-063 a table CHECK rather than a command's memory.
  occurrence_intervention_type text not null
    check (occurrence_intervention_type in ('hold','witness','review')),
  -- v0.1 uses the whole occurrence as the only exception scope
  -- (execution-and-evidence.md:499-500). The value stays a column rather than
  -- becoming an assumption, so v0.2's narrower scopes are additive.
  exception_scope text not null default 'occurrence'
    check (exception_scope = 'occurrence'),
  action text not null
    check (action in ('waiver','accept_risk','not_applicable','revoke')),

  -- Departures 2 and 3: the lineage is a contiguous chain with exactly one root.
  exception_no integer not null default 1 check (exception_no >= 1),
  predecessor_exception_id uuid,
  predecessor_exception_no integer,

  -- «An authorised actor», and the authorisation is a capability the RLS policy
  -- in §10 names. The member is recorded because an exception that hides who
  -- took it is the exception ADR-005 decision 3 argues against.
  authority_member_id uuid not null,
  reason text not null check (length(btrim(reason)) > 0),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),

  -- NAMED, all of them: PostgreSQL's auto-name for these column lists reaches 64
  -- and 81 bytes and identifiers truncate at 63, so the constraint would carry a
  -- clipped name that no rollback line and no test could reproduce (0043:411-413).
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  -- backs the contiguity FK below. It carries the OCCURRENCE and the SCOPE as
  -- well as the ordinal: a key of (workspace_id, id, exception_no) alone would
  -- tie a fact to its own number and to nothing else, so exception #2 on
  -- occurrence A could name exception #1 on occurrence B as its predecessor and
  -- both lineages would still look like chains.
  constraint requirement_exceptions_chain_key
    unique (workspace_id, id, requirement_occurrence_id, exception_scope, exception_no),
  -- backs the head pointer (departure 4) and §5's member row: both need to know
  -- WHICH occurrence and WHICH action the referenced row carries
  constraint requirement_exceptions_pin_key
    unique (workspace_id, id, requirement_occurrence_id, action),
  -- INV-035, root half: exactly one exception_no = 1 per (occurrence, scope), so
  -- two independent roots are a 23505 and not a command's oversight
  constraint requirement_exceptions_lineage_key
    unique (workspace_id, requirement_occurrence_id, exception_scope, exception_no),
  -- INV-035, fork half
  constraint requirement_exceptions_no_fork_key
    unique (workspace_id, predecessor_exception_id),
  -- INV-048 at the grain the command replays on
  constraint requirement_exceptions_idempotency_key
    unique (workspace_id, requirement_occurrence_id, idempotency_key),

  constraint requirement_exceptions_occurrence_fkey
    foreign key (workspace_id, project_id, requirement_occurrence_id,
                 occurrence_intervention_type)
    references public.requirement_occurrences
      (workspace_id, project_id, id, intervention_type),
  constraint requirement_exceptions_authority_fkey
    foreign key (workspace_id, authority_member_id)
    references public.memberships (organization_id, id),
  constraint requirement_exceptions_chain_fkey
    foreign key (workspace_id, predecessor_exception_id, requirement_occurrence_id,
                 exception_scope, predecessor_exception_no)
    references public.requirement_exceptions
      (workspace_id, id, requirement_occurrence_id, exception_scope, exception_no),

  -- A root has no predecessor and a successor has one, and the successor's
  -- ordinal is exactly one more than the fact it supersedes. Without the second
  -- half, `unique (workspace_id, requirement_occurrence_id, exception_scope,
  -- exception_no)` still admits a successor numbered 7 behind a root numbered 1
  -- — a chain with a hole, which is a chain nobody can walk.
  constraint requirement_exceptions_chain_check
    check ((exception_no = 1
             and predecessor_exception_id is null and predecessor_exception_no is null)
        or (exception_no > 1
             and predecessor_exception_id is not null
             and predecessor_exception_no = exception_no - 1)),

  -- INV-063 / ADR-005 decision 3. A hold occurrence can NEVER carry a
  -- not_applicable exception. waiver and accept_risk stay available to an
  -- authorised actor and stay visible — an exception that hides itself is worse
  -- than no exception — but the exception that asserts the obligation never
  -- existed cannot be written against a hold AT ALL, by any command, role or UI
  -- affordance. The intervention type it reads is the occurrence's own, pinned
  -- by requirement_exceptions_occurrence_fkey above.
  constraint requirement_exceptions_hold_not_applicable_check
    check (action <> 'not_applicable' or occurrence_intervention_type <> 'hold')
);

comment on table public.requirement_exceptions is
  'Append-only. THE ONLY ESCAPE v0.1 HAS: ADR-006 decision 4 keeps the bypass out '
  'because its whole price is package ineligibility and there are no packages to '
  'make ineligible, so the attributed and visible waiver/accept_risk is what stands '
  'in its place (INV-063). An exception never mutates the occurrence into a second '
  'truth and is never edited: a correction is a successor row referencing the exact '
  'prior fact, one ordinal higher, and the chain is contiguous by '
  'requirement_exceptions_chain_fkey. The hold/not_applicable prohibition is a table '
  'CHECK over an intervention type pinned FROM the occurrence, so it holds '
  'regardless of which command, role or UI affordance is involved. ''revoke'' is in '
  'the vocabulary and is written by no v0.1 route — scope-v0.1.csv has no revoke '
  'operation — and it satisfies nothing: a closure member row admits only ''waiver'' '
  'and ''accept_risk''.';

create index requirement_exceptions_occurrence_idx
  on public.requirement_exceptions (workspace_id, requirement_occurrence_id, exception_no);

-- The serialized head. It does two jobs the lineage key cannot do: it is the row
-- a command LOCKS so two exceptions cannot be appended concurrently, and it is
-- the «current» pointer satisfied(o) reads (execution-and-evidence.md:741-744,
-- «"Current" always means the head selected by the serialized lineage»).
create table public.requirement_exception_heads (
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  requirement_occurrence_id uuid not null,
  exception_scope text not null default 'occurrence'
    check (exception_scope = 'occurrence'),
  current_exception_id uuid,
  -- Departure 4: the pointed-at row's action, pinned by foreign key rather than
  -- copied on trust. Safe as a copy because public.requirement_exceptions is
  -- append-only, so `action` is terminal and the FK is never re-validated into
  -- a different answer (0043:303-311).
  current_action text
    check (current_action is null
        or current_action in ('waiver','accept_risk','not_applicable','revoke')),
  version bigint not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),

  primary key (workspace_id, requirement_occurrence_id, exception_scope),

  constraint requirement_exception_heads_occurrence_fkey
    foreign key (workspace_id, project_id, requirement_occurrence_id)
    references public.requirement_occurrences (workspace_id, project_id, id),
  constraint requirement_exception_heads_current_fkey
    foreign key (workspace_id, current_exception_id, requirement_occurrence_id, current_action)
    references public.requirement_exceptions
      (workspace_id, id, requirement_occurrence_id, action),

  constraint requirement_exception_heads_pointer_check
    check ((current_exception_id is null) = (current_action is null))
);

comment on table public.requirement_exception_heads is
  'One serialized head per (workspace, occurrence, exception_scope) — INV-035. It '
  'is NOT what makes root uniqueness true here: requirement_exceptions_lineage_key '
  'does that with a unique constraint, because a head enforces it only through a '
  'command that remembers to lock and to check. What the head is for is the two '
  'things a key cannot be: the row a command locks with an expected version, and '
  'the CURRENT pointer satisfied(o) reads. A superseded fact never satisfies '
  'anything. The head''s exception_scope leg is absent from '
  'requirement_exception_heads_current_fkey because both sides are CHECK-forced to '
  '''occurrence'' in v0.1; the v0.2 slice that widens exception_scope MUST add that '
  'leg in the same change or a head could point at an exception of a different '
  'scope.';

-- ===========================================================================
-- 4. requirement_evidence_decisions — the fact a hold releases on
--
-- satisfied(o) for a hold, in its v0.1 form (execution-and-evidence.md:729-734):
-- «∃ current accepting evidence decision on o by o.approver_role ∧ no current
-- return on o». Both halves are the head: the current decision is either
-- accepted or returned, and there is exactly one per (occurrence, role).
--
-- INV-075, first half: this decision governs admission and NEVER money. There is
-- no column here from which a quantity or a valuation could be derived, and
-- migration 0046 — which moves the valuation carve to admission — reaches
-- public.valuation_allocations through public.stage_closures and never through
-- this table.
-- ===========================================================================
create table public.requirement_evidence_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  requirement_occurrence_id uuid not null,
  -- Pinned FROM the occurrence, never typed into the decision.
  approver_role text not null check (length(btrim(approver_role)) > 0),
  outcome text not null check (outcome in ('accepted','returned')),

  -- Departures 2 and 3, as on the exception lineage.
  decision_no integer not null default 1 check (decision_no >= 1),
  superseded_decision_id uuid,
  superseded_decision_no integer,

  -- Exactly one deciding authority. In v0.1 it is always the member.
  decided_by_member_id uuid,
  -- Departure 5: built now, shut now, and given their foreign keys by M5.
  external_session_id uuid,
  external_access_grant_id uuid,
  decision_batch_id uuid,
  -- v0.1 external assurance is LINK_CONFIRMATION — email link, IP, server time —
  -- and is NOT an electronic signature (ADR-005 assumption d). No other value and
  -- no absent value is storable beside an external session.
  assurance_label text
    check (assurance_label is null or assurance_label = 'LINK_CONFIRMATION'),

  -- Departure 6: free text, and no invented code vocabulary.
  reason text,
  issues jsonb not null default '[]'::jsonb
    check (jsonb_typeof(issues) = 'array'),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  decided_at timestamptz not null default now(),

  -- NAMED for the same reason as on the exception lineage: this table's name is
  -- thirty bytes on its own, so PostgreSQL's auto-name for the last two reaches
  -- 71 and 88 bytes and would be truncated at 63.
  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  -- backs the contiguity FK, and carries the occurrence and the role with the
  -- ordinal for the reason the exception lineage does: a bare (id, ordinal) key
  -- lets a successor supersede a fact on another occurrence entirely.
  constraint requirement_evidence_decisions_chain_key
    unique (workspace_id, id, requirement_occurrence_id, approver_role, decision_no),
  -- backs §5's member row: the closure names an ACCEPTING decision ON THIS
  -- occurrence, and cannot freeze a return as if it satisfied anything
  constraint requirement_evidence_decisions_outcome_pin_key
    unique (workspace_id, id, requirement_occurrence_id, outcome),
  -- backs the head pointer's role leg
  constraint requirement_evidence_decisions_role_pin_key
    unique (workspace_id, id, requirement_occurrence_id, approver_role),
  -- INV-035, root half: one root decision per (occurrence, approver_role). This
  -- is the case packages-and-acceptance.md and schema-v0.1.sql:1297-1300 name as
  -- «the case the predicate cannot resolve», and it is a key here.
  constraint requirement_evidence_decisions_lineage_key
    unique (workspace_id, requirement_occurrence_id, approver_role, decision_no),
  -- INV-035, fork half
  constraint requirement_evidence_decisions_no_fork_key
    unique (workspace_id, superseded_decision_id),
  constraint requirement_evidence_decisions_idempotency_key
    unique (workspace_id, requirement_occurrence_id, idempotency_key),

  constraint requirement_evidence_decisions_occurrence_fkey
    foreign key (workspace_id, project_id, requirement_occurrence_id, approver_role)
    references public.requirement_occurrences
      (workspace_id, project_id, id, approver_role),
  constraint requirement_evidence_decisions_member_fkey
    foreign key (workspace_id, decided_by_member_id)
    references public.memberships (organization_id, id),
  constraint requirement_evidence_decisions_chain_fkey
    foreign key (workspace_id, superseded_decision_id, requirement_occurrence_id,
                 approver_role, superseded_decision_no)
    references public.requirement_evidence_decisions
      (workspace_id, id, requirement_occurrence_id, approver_role, decision_no),

  constraint requirement_evidence_decisions_chain_check
    check ((decision_no = 1
             and superseded_decision_id is null and superseded_decision_no is null)
        or (decision_no > 1
             and superseded_decision_id is not null
             and superseded_decision_no = decision_no - 1)),

  -- Exactly one deciding authority: an internal member, or an occurrence-scoped
  -- external session together with the grant it was exchanged from and the batch
  -- that receipts it. Never both, never neither, never a session without its
  -- grant (schema-v0.1.sql:1275-1283, transcribed unchanged).
  constraint requirement_evidence_decisions_authority_check
    check ((decided_by_member_id is not null
             and external_session_id is null and external_access_grant_id is null
             and decision_batch_id is null)
        or (external_session_id is not null and external_access_grant_id is not null
             and decision_batch_id is not null and decided_by_member_id is null)),
  constraint requirement_evidence_decisions_assurance_check
    check ((external_session_id is null and assurance_label is null)
        or (external_session_id is not null and assurance_label = 'LINK_CONFIRMATION')),

  -- THE ONE CONSTRAINT v0.1-M5 DROPS. Until public.external_sessions,
  -- public.external_access_grants and public.external_decision_batches exist,
  -- the three columns above have no referent, and without this line a decision
  -- could be stored naming three invented uuids and no member at all. M5 drops
  -- exactly this constraint and adds the three foreign keys in the same
  -- statement; nothing else here is in its way.
  constraint requirement_evidence_decisions_v01_internal_only_check
    check (decided_by_member_id is not null),

  -- state-catalog.csv:120 records the return reason as NOT_ENUMERATED and offers
  -- the v0.1-shaped alternative: free text plus the occurrence it concerns, said
  -- plainly. A return with nothing written on it is a refusal the crew cannot
  -- act on, which is what «a refusal is a support surface» (ADR-005
  -- §Consequences) exists to prevent.
  constraint requirement_evidence_decisions_return_reason_check
    check (outcome <> 'returned' or length(btrim(coalesce(reason, ''))) > 0)
);

comment on table public.requirement_evidence_decisions is
  'Append-only accept/return on ONE requirement occurrence, in the role the '
  'occurrence names (INV-075 first half). It governs ADMISSION and never money: '
  'there is no path from this outcome to a quantity or a valuation row, and '
  'migration 0046 reaches public.valuation_allocations through public.stage_closures '
  'rather than through here. INV-069 — no member decides their own capture or their '
  'own recorded progress — is NOT enforced by any constraint on this row and is the '
  'decision command''s job (invariant-catalog.csv:70); see this migration''s header '
  'for why a trigger would fail open. The three external columns are built and shut: '
  'requirement_evidence_decisions_v01_internal_only_check is the one constraint the '
  'v0.1-M5 slice drops, in the same statement that adds their foreign keys.';

create index requirement_evidence_decisions_occurrence_idx
  on public.requirement_evidence_decisions
     (workspace_id, requirement_occurrence_id, approver_role, decision_no);

create table public.requirement_evidence_decision_heads (
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  requirement_occurrence_id uuid not null,
  approver_role text not null,
  current_decision_id uuid,
  -- Departure 4: pinned, not copied on trust. Terminal on an append-only table.
  current_outcome text
    check (current_outcome is null or current_outcome in ('accepted','returned')),
  version bigint not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),

  primary key (workspace_id, requirement_occurrence_id, approver_role),

  constraint requirement_evidence_decision_heads_occurrence_fkey
    foreign key (workspace_id, project_id, requirement_occurrence_id, approver_role)
    references public.requirement_occurrences
      (workspace_id, project_id, id, approver_role),
  -- Two legs, two keys: the head may not point at a decision on another
  -- occurrence, may not point at one taken in another role, and may not
  -- misreport the outcome of the one it points at.
  constraint requirement_evidence_decision_heads_outcome_fkey
    foreign key (workspace_id, current_decision_id, requirement_occurrence_id, current_outcome)
    references public.requirement_evidence_decisions
      (workspace_id, id, requirement_occurrence_id, outcome),
  constraint requirement_evidence_decision_heads_role_fkey
    foreign key (workspace_id, current_decision_id, requirement_occurrence_id, approver_role)
    references public.requirement_evidence_decisions
      (workspace_id, id, requirement_occurrence_id, approver_role),

  constraint requirement_evidence_decision_heads_pointer_check
    check ((current_decision_id is null) = (current_outcome is null))
);

comment on table public.requirement_evidence_decision_heads is
  'One serialized head per (workspace, occurrence, approver_role) — INV-035, moved '
  'into v0.1 by the owner on 2026-08-06 (ADR-006 decision 4 amendment note). Root '
  'uniqueness is carried by requirement_evidence_decisions_lineage_key rather than '
  'by this table; what this table carries is the lock a submit takes with an '
  'expected version, and the CURRENT decision — accepted or returned — that '
  'satisfied(o) reads. «No current return on o» is answerable from '
  'current_outcome alone, which is why the outcome is pinned here rather than '
  'joined for.';

-- ===========================================================================
-- 5. stage_closures — the fact, and the set it froze
--
-- ADR-005 decision 1: the gate blocks exactly two recorded acts, and v0.1 ships
-- the first of them. It never refuses to record a FACT (INV-065): nothing in this
-- section appears as a precondition on progress.record, progress.adjust,
-- upload_intents.* or the evidence path, and nothing here is reachable from them.
--
-- DOUBLE-CLOSING ONE STAGE IS UNREPRESENTABLE (INV-076), by the same guarantee
-- the AktFlow-era concealment_events carried and ADR-005 restores: exactly one
-- root closure per stage (the lineage key), no two successors from one
-- predecessor (the fork key), and a contiguous chain (the chain FK). A mistaken
-- closure is corrected by APPENDING a superseding closure that states a reason;
-- there is no edit and there is no reopen.
-- ===========================================================================
create table public.stage_closures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  work_assignment_id uuid not null,
  work_stage_id uuid not null,
  -- The literal discriminator (0023:28-48, 0043:303-311). This row may exist
  -- only against a stage RECORDED CLOSED — never against one closed by bypass,
  -- because a stage has exactly one status to satisfy and unevidenced_closures
  -- (v0.2) will pin the other value. Safe as a copied literal because §6 makes
  -- 'closed' terminal.
  stage_status text not null default 'closed' check (stage_status = 'closed'),

  closure_no integer not null default 1 check (closure_no >= 1),
  predecessor_closure_id uuid,
  predecessor_closure_no integer,
  correction_reason text,

  closed_by_member_id uuid not null,
  closed_at timestamptz not null default now(),          -- SERVER time
  -- Untrusted, exactly like a claimed capture time. The vocabulary is the
  -- deployed one (0015:324-325), not the target enum's.
  claimed_covered_at timestamptz,
  claimed_covered_tz_offset text,
  claimed_time_trust text not null default 'unknown'
    check (claimed_time_trust in ('device_claimed','server_estimated','unknown')),

  -- The predicate result is not a reported field, it is this table's
  -- precondition: a SATISFIED closure is the only thing it can record
  -- (INV-061). The unsatisfied case is an unevidenced_closures row and nothing
  -- else, and that table is v0.2 — so in v0.1 the unsatisfied case is a REFUSAL
  -- and no row at all.
  can_close_stage_result boolean not null check (can_close_stage_result),

  -- The EXACT occurrence set the predicate quantified over, frozen into the
  -- fact so the closure can be re-defended years later without asking the
  -- runtime what the requirements were at the time. The MEMBERS are
  -- public.stage_closure_occurrences (departure 1); these two columns are the
  -- closure's own claim ABOUT that set, and stage_closures_frozen_set below
  -- proves the claim against the rows before the transaction commits.
  --
  -- COUNT MAY BE ZERO. A stage with no applicable blocking occurrence closes
  -- vacuously, which is correct behaviour and exactly why the dry run has to
  -- print uncovered lines (INV-072). Coverage is the gate; this fact only
  -- records what coverage produced.
  evaluated_occurrence_count integer not null check (evaluated_occurrence_count >= 0),
  -- sha256, lowercase hex, over the member occurrence ids as canonical uuid text
  -- sorted ascending and joined with a single ',' — and the empty string for an
  -- empty set, whose digest is the constant probed in §0. uuid ordering is
  -- memcmp over sixteen bytes and the canonical text form is lowercase hex, so
  -- a caller that sorts the lowercase strings lexicographically produces the
  -- same order the recomputation below does.
  evaluated_occurrence_set_hash text not null
    check (evaluated_occurrence_set_hash ~ '^[0-9a-f]{64}$'),

  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),

  unique (workspace_id, id),
  unique (workspace_id, project_id, id),
  -- backs the member row's stage leg. project_id is IN the key rather than left
  -- to a transitive argument: without it a member row could carry a project_id
  -- of its own and both of its foreign keys would still resolve, and the RLS
  -- policy that decides who may write that row reads exactly that column.
  constraint stage_closures_stage_pin_key
    unique (workspace_id, id, project_id, work_stage_id),
  -- backs migration 0046's admission FK: an allocation carved at admission
  -- belongs to a progress entry of the very assignment whose stage was closed
  constraint stage_closures_assignment_pin_key
    unique (workspace_id, id, work_assignment_id),
  -- backs the contiguity FK, carrying the stage with the ordinal so a correction
  -- cannot supersede a closure of a different stage
  constraint stage_closures_chain_key
    unique (workspace_id, id, work_stage_id, closure_no),
  -- INV-076, root half: exactly one closure_no = 1 per stage
  constraint stage_closures_lineage_key unique (workspace_id, work_stage_id, closure_no),
  -- INV-076, fork half
  constraint stage_closures_no_fork_key unique (workspace_id, predecessor_closure_id),
  constraint stage_closures_idempotency_key
    unique (workspace_id, work_stage_id, idempotency_key),

  -- ONE key, ONE foreign key, five facts: the stage is in this project, under
  -- this assignment, on this contract, and it is recorded closed.
  constraint stage_closures_stage_fkey
    foreign key (workspace_id, project_id, work_stage_id, work_assignment_id,
                 contract_id, stage_status)
    references public.work_stages
      (workspace_id, project_id, id, work_assignment_id, contract_id, status),
  constraint stage_closures_member_fkey
    foreign key (workspace_id, closed_by_member_id)
    references public.memberships (organization_id, id),
  constraint stage_closures_chain_fkey
    foreign key (workspace_id, predecessor_closure_id, work_stage_id, predecessor_closure_no)
    references public.stage_closures (workspace_id, id, work_stage_id, closure_no),

  constraint stage_closures_chain_check
    check ((closure_no = 1
             and predecessor_closure_id is null and predecessor_closure_no is null)
        or (closure_no > 1
             and predecessor_closure_id is not null
             and predecessor_closure_no = closure_no - 1)),
  -- A correction says why. A closure that supersedes another and gives no reason
  -- is a closure nobody can audit.
  constraint stage_closures_correction_reason_check
    check (predecessor_closure_id is null or length(btrim(coalesce(correction_reason, ''))) > 0),
  -- A closure with no claimed covering time claims no trust level either
  -- (0029:115 draws the same line on the capture path).
  constraint stage_closures_claimed_time_check
    check (claimed_covered_at is not null or claimed_time_trust = 'unknown')
);

comment on table public.stage_closures is
  'Append-only fact that a work stage was recorded closed with can_close_stage '
  'satisfied (INV-061). Closing does not by itself satisfy occurrences or make '
  'scope eligible: it records that the physical opportunity to inspect has passed. '
  'From migration 0046 it is ALSO the admission event — the moment ADR-008 moves '
  'the valuation carve to — so a refused closure carves nothing, because a refused '
  'closure writes nothing at all. DOUBLE-COVERING ONE STAGE IS UNREPRESENTABLE '
  '(INV-076): one root per stage, no two successors from one predecessor, and a '
  'contiguous chain. A refused closure returns the blocked_reason objects naming '
  'the requirement, the missing evidence, the owed role and the money — never a '
  'bare status word. evaluated_occurrence_count MAY be zero: a stage with no '
  'applicable blocking occurrence closes vacuously, which is correct and is exactly '
  'why the dry run must print uncovered lines (INV-072).';

create index stage_closures_stage_idx
  on public.stage_closures (workspace_id, work_stage_id, closure_no);

-- ---------------------------------------------------------------------------
-- The frozen set itself (departure 1).
--
-- Each row is one occurrence the predicate quantified over, and the exact fact
-- that satisfied it. Every leg of both foreign keys closes a way the sentence
-- «this closure satisfied these obligations» could be false while every row
-- still looked well-formed:
--
--   (a) THE OCCURRENCE IS ONE OF THIS STAGE'S, AND IT BLOCKS CLOSURE.
--       -> requirement_occurrences (workspace_id, project_id, id, work_stage_id,
--          blocking_scope), the key added in §2, meeting stage_closures
--          (workspace_id, id, project_id, work_stage_id) on this table's
--          project_id and work_stage_id columns.
--       Without the stage leg a closure could freeze another stage's obligations
--       and satisfy its own count. Without the blocking leg it could pad the set
--       with advisory occurrences until the count matched.
--
--   (b) THE FACT RELIED ON IS ABOUT THIS OCCURRENCE AND IS OF THE RIGHT KIND.
--       -> requirement_evidence_decisions (workspace_id, id,
--          requirement_occurrence_id, outcome) with outcome CHECK-forced to
--          'accepted', or requirement_exceptions (workspace_id, id,
--          requirement_occurrence_id, action) with action CHECK-forced to
--          'waiver' or 'accept_risk'.
--       A return cannot be frozen as if it satisfied anything, a not_applicable
--       cannot either (and cannot exist on a hold at all), and neither can a
--       decision about a different occurrence.
--
-- WHAT NEITHER KEY PINS, so it is not mistaken for pinned: whether the relied-on
-- fact was the CURRENT head at closure time. See the header.
-- ---------------------------------------------------------------------------
create table public.stage_closure_occurrences (
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  stage_closure_id uuid not null,
  work_stage_id uuid not null,
  requirement_occurrence_id uuid not null,
  occurrence_blocking_scope text not null
    check (occurrence_blocking_scope in ('blocks_stage_closure','blocks_both')),

  satisfied_by text not null check (satisfied_by in ('evidence_decision','exception')),
  relied_on_decision_id uuid,
  relied_on_decision_outcome text
    check (relied_on_decision_outcome is null or relied_on_decision_outcome = 'accepted'),
  relied_on_exception_id uuid,
  relied_on_exception_action text
    check (relied_on_exception_action is null
        or relied_on_exception_action in ('waiver','accept_risk')),
  created_at timestamptz not null default now(),

  -- One row per occurrence per closure. A duplicate cannot inflate the count
  -- into agreement with a set that is missing a member.
  primary key (workspace_id, stage_closure_id, requirement_occurrence_id),

  constraint stage_closure_occurrences_closure_fkey
    foreign key (workspace_id, stage_closure_id, project_id, work_stage_id)
    references public.stage_closures (workspace_id, id, project_id, work_stage_id),
  constraint stage_closure_occurrences_occurrence_fkey
    foreign key (workspace_id, project_id, requirement_occurrence_id, work_stage_id,
                 occurrence_blocking_scope)
    references public.requirement_occurrences
      (workspace_id, project_id, id, work_stage_id, blocking_scope),
  constraint stage_closure_occurrences_decision_fkey
    foreign key (workspace_id, relied_on_decision_id, requirement_occurrence_id,
                 relied_on_decision_outcome)
    references public.requirement_evidence_decisions
      (workspace_id, id, requirement_occurrence_id, outcome),
  constraint stage_closure_occurrences_exception_fkey
    foreign key (workspace_id, relied_on_exception_id, requirement_occurrence_id,
                 relied_on_exception_action)
    references public.requirement_exceptions
      (workspace_id, id, requirement_occurrence_id, action),

  -- Exactly one satisfying fact, and it matches the kind the row declares. The
  -- v0.1 form of satisfied(o) has exactly two disjuncts
  -- (execution-and-evidence.md:729-734) and this is them.
  constraint stage_closure_occurrences_satisfaction_check
    check ((satisfied_by = 'evidence_decision'
             and relied_on_decision_id is not null
             and relied_on_decision_outcome = 'accepted'
             and relied_on_exception_id is null and relied_on_exception_action is null)
        or (satisfied_by = 'exception'
             and relied_on_exception_id is not null
             and relied_on_exception_action is not null
             and relied_on_decision_id is null and relied_on_decision_outcome is null))
);

comment on table public.stage_closure_occurrences is
  'The frozen occurrence set of one stage closure, as ROWS rather than as a jsonb '
  'array of uuids (this migration''s departure 1): a jsonb array references '
  'nothing, and «the exact occurrence set it claims to satisfy» has to be checkable '
  'to be worth freezing. Each row pins an occurrence OF THIS CLOSURE''S STAGE whose '
  'blocking scope blocks closure, and the exact accepting decision or '
  'waiver/accept_risk exception it was satisfied by. Append-only, and it cannot be '
  'appended to later: app.guard_closure_member_window() refuses a member row whose '
  'closure was not created by the same transaction, so a later occurrence cannot '
  'retroactively join — or complete — a past closure''s set.';

-- ---------------------------------------------------------------------------
-- The set is frozen at the moment of closure, and never afterwards.
--
-- The xmin comparison is the technique of app.guard_rule_binding_window()
-- (0042:435-458) and it is here for the mirror-image reason: that guard asks
-- «was this parent created here?» to permit an insert the general rule forbids;
-- this one asks the same question to FORBID an insert nothing else would stop.
--
-- NOT security definer, deliberately: it reads under the mutating role, so if
-- RLS hides the closure the guard raises rather than proceeding on a NULL. That
-- is 0042:288-291's argument and this is a case where it applies unchanged —
-- failing on an invisible parent is the safe direction.
-- ---------------------------------------------------------------------------
create or replace function app.guard_closure_member_window() returns trigger
language plpgsql as $$
declare
  v_born_here boolean;
begin
  select sc.xmin = pg_current_xact_id()::xid into v_born_here
    from public.stage_closures sc
   where sc.workspace_id = new.workspace_id and sc.id = new.stage_closure_id;

  if v_born_here is null then
    raise exception 'stage closure % is not visible in this workspace',
      new.stage_closure_id;
  end if;

  if not v_born_here then
    raise exception
      'the frozen occurrence set of stage closure % is fixed at the moment of closure and cannot be added to later',
      new.stage_closure_id;
  end if;

  return new;
end $$;
revoke all on function app.guard_closure_member_window() from public;

create trigger stage_closure_occurrences_insert_window before insert
  on public.stage_closure_occurrences
  for each row execute function app.guard_closure_member_window();

-- ---------------------------------------------------------------------------
-- THE COMPLETENESS CHECK — the one that makes INV-061 a database rule.
--
-- Three equalities, at COMMIT, for every closure row inserted:
--   the closure's claimed count = the number of member rows
--                               = the number of applicable blocking occurrences
--                                 of that stage,
--   and the closure's claimed hash = the digest of the member ids.
--
-- The middle equality is the gate. Combined with the primary key (no duplicate
-- members) and stage_closure_occurrences_occurrence_fkey (every member is a
-- blocking occurrence OF THIS STAGE), equal counts force set EQUALITY — so a
-- closure cannot exist while one blocking obligation of the stage was left out
-- of the frozen set, and every member of that set already had to name an
-- accepting decision or a waiver/accept_risk exception to be storable at all.
--
-- SECURITY DEFINER, and this is the one place in this file where that is the
-- right call rather than the convenient one. The function COUNTS rows it must
-- not miss: read under the mutating role, an occurrence hidden by RLS would be
-- counted as absent, the equality would hold, and the check would FAIL OPEN on
-- exactly the obligation somebody wanted skipped. It authorizes first, on the
-- same capability the insert policy demands, so it is not an oracle for a
-- project the caller does not already hold — 0017:78-81's lesson, applied before
-- any count is read.
--
-- DEFERRED, because the closure row and its members are inserted in one
-- transaction and the members necessarily come second. A constraint trigger is
-- the only shape that can ask the question after both.
--
-- «APPLICABLE» IS «ATTACHED TO THE STAGE», and that is not this migration's
-- reading: execution-and-evidence.md:695-705 says it in terms — «There is no
-- separate "applicability fact", and both definitions above are free of one…
-- An occurrence is applicable if the scope matches; whether an exception has
-- since withdrawn it is a satisfaction question, not a membership question.»
-- So the expected set is every occurrence of the stage whose blocking_scope
-- blocks closure, and a waived one is IN the set with its waiver named beside
-- it rather than absent from it. That is also what keeps a waiver visible: an
-- escape that removed the obligation from the closure's own record would be the
-- exception that hides itself.
--
-- WHAT WOULD BREAK THIS IF IT CHANGED. The frozen set is defensible in v0.1
-- because no v0.1 route can add an occurrence to an existing assignment —
-- materialisation happens once, at assignment creation, and
-- requirement_occurrences.create and .bulk_instantiate are v0.2
-- (0043:481-483). The v0.2 slice that ships bulk instantiation makes «a later
-- occurrence appears on a closed stage» reachable, and owes a decision about
-- what that does to a closure already recorded.
-- ---------------------------------------------------------------------------
create or replace function app.assert_stage_closure_set() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_members  integer;
  v_hash     text;
  v_expected integer;
begin
  if not app.has_project_capability(new.workspace_id, new.project_id,
                                    array['stage_closures.close']) then
    raise exception 'not authorized to close a stage in this project';
  end if;

  select count(*),
         encode(sha256(convert_to(
           coalesce(string_agg(m.requirement_occurrence_id::text, ','
                               order by m.requirement_occurrence_id), ''),
           'UTF8')), 'hex')
    into v_members, v_hash
    from public.stage_closure_occurrences m
   where m.workspace_id = new.workspace_id
     and m.stage_closure_id = new.id;

  select count(*) into v_expected
    from public.requirement_occurrences o
   where o.workspace_id = new.workspace_id
     and o.work_stage_id = new.work_stage_id
     and o.blocking_scope in ('blocks_stage_closure','blocks_both');

  if v_members <> new.evaluated_occurrence_count then
    raise exception
      'stage closure % claims % evaluated occurrences and froze % (INV-061)',
      new.id, new.evaluated_occurrence_count, v_members;
  end if;

  if v_expected <> v_members then
    raise exception
      'stage closure % left % of the % blocking obligations of stage % out of its frozen set (INV-061)',
      new.id, v_expected - v_members, v_expected, new.work_stage_id;
  end if;

  if v_hash <> new.evaluated_occurrence_set_hash then
    raise exception
      'stage closure %: the frozen occurrence set hash does not describe the set that was frozen',
      new.id;
  end if;

  return null;
end $$;
revoke all on function app.assert_stage_closure_set() from public;

create constraint trigger stage_closures_frozen_set
  after insert on public.stage_closures
  deferrable initially deferred
  for each row execute function app.assert_stage_closure_set();

-- ===========================================================================
-- 6. The one transition public.work_stages.status exists for
--
-- 0043:462-470 promised it in terms: «Moves ONLY through the M3 closure command.
-- v0.1-M2 grants no UPDATE on this table and app.reject_mutation() refuses every
-- update and delete, so in M2 the column is storable and immovable. M3 replaces
-- that trigger with a guard that admits open -> closed, exactly as migration 0042
-- replaced contract_versions_immutable.» This is that replacement.
--
-- 'closed_without_evidence' stays in the CHECK and is unreachable through the
-- guard. ADR-006 decision 4 keeps the bypass out of v0.1; v0.2 widens the GUARD,
-- which is a `create or replace function`, and not a CHECK anybody has to drop.
-- ===========================================================================
create or replace function app.guard_work_stage() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'work stage % is not deletable; a closure is a fact and the stage is its subject', old.id;
  end if;

  if old.status <> 'open' then
    -- ADR-005 defines no reopen, and this is what that has to mean in a schema:
    -- once a stage is closed its status can never move again, in either
    -- direction, by any route.
    raise exception 'work stage % is already %; ADR-005 defines no reopen', old.id, old.status;
  end if;

  if new.status <> 'closed' then
    raise exception
      'work stage % admits only the open -> closed transition in v0.1; attempted % -> % (the bypass is v0.2, ADR-006 decision 4)',
      old.id, old.status, new.status;
  end if;

  -- Whole-row jsonb comparison rather than a named column list, for the reason
  -- 0042:237-241 gives: a column added by a later migration is frozen from the
  -- moment it exists, without anybody remembering to extend a list. The ::text
  -- casts on `-` are explicit for the reason 0041:615-617 gives.
  if (to_jsonb(new) - 'status'::text - 'version'::text - 'updated_at'::text)
     is distinct from
     (to_jsonb(old) - 'status'::text - 'version'::text - 'updated_at'::text) then
    raise exception 'closing work stage % must not alter anything else about it', old.id;
  end if;

  if new.version <> old.version + 1 then
    raise exception
      'closing work stage % must advance its version exactly once (% -> %)',
      old.id, old.version, new.version;
  end if;

  return new;
end $$;
revoke all on function app.guard_work_stage() from public;

drop trigger work_stages_immutable on public.work_stages;
create trigger work_stages_guard before update or delete
  on public.work_stages
  for each row execute function app.guard_work_stage();

-- ---------------------------------------------------------------------------
-- A CLOSED STAGE HAS A CLOSURE FACT. Without this, `update public.work_stages
-- set status = 'closed'` is the whole gate: the foreign key runs from the
-- closure to the stage and not back, so a status word set by anybody holding
-- stage_closures.close would close a stage with no frozen set, no satisfying
-- decisions and no evidence that the predicate was ever evaluated. Readiness
-- would then be a status column, which is the one thing ADR-005 decision 7 says
-- it must never be.
--
-- AND IT SHUTS ONLY THE UPDATE DOOR AS WRITTEN BELOW. `after update` was too
-- narrow: `status` has a CHECK admitting 'closed', so an INSERT could choose it
-- and produce a stage that is terminal from birth, carries no closure, is skipped
-- by blocked_reasons.get, and counts as not-open when admission asks whether the
-- assignment has a stage left open — i.e. it releases the money. No v0.1 route
-- writes `status`, which is the same «no route does it today» that this trigger
-- exists in spite of. MIGRATION 0048 recreates the trigger as `after insert or
-- update` and narrows ws_insert to a stage born 'open'. This note is corrected in
-- place — 0045 has not been applied — rather than deleted, so the door and its
-- fix are both findable from here.
--
-- Deferred, because the closure row is inserted after the stage is updated in
-- at least one legible ordering, and this constraint must not dictate statement
-- order inside the command.
--
-- NOT security definer: it reads public.stage_closures under the mutating role,
-- and a closure hidden by RLS makes the check RAISE. Failing closed is the safe
-- direction here, which is why the definer argument of §5 does not apply.
-- ---------------------------------------------------------------------------
create or replace function app.assert_stage_closure_exists() returns trigger
language plpgsql as $$
begin
  if new.status = 'closed' and not exists (
       select 1 from public.stage_closures sc
        where sc.workspace_id = new.workspace_id and sc.work_stage_id = new.id) then
    raise exception
      'work stage % was recorded closed with no stage_closures fact behind it (INV-061/INV-076)',
      new.id;
  end if;
  return null;
end $$;
revoke all on function app.assert_stage_closure_exists() from public;

create constraint trigger work_stages_closure_fact_required
  after update on public.work_stages
  deferrable initially deferred
  for each row execute function app.assert_stage_closure_exists();

-- ===========================================================================
-- 7. The two projections the M3 read routes answer from
--
-- Rebuildable, never client-writable, and — today — never written at all. See
-- the header: this repository has no projection rebuilder, so readiness.get and
-- blocked_reasons.get answer with nothing until one exists. The tables are built
-- here because version-0.1.md §v0.1-M3 §"Schema slice" names both among the
-- eight, and because building them with a SERVICE-ONLY write grant is what keeps
-- «no editable status column and no manual override of a derived state» true in
-- the database rather than in a route.
--
-- THE REFUSAL DOES NOT READ THESE TABLES. schema-v0.1.sql:2492-2493 says stage
-- closure «reads» the readiness projection; INV-061's enforcement column says the
-- predicate is «evaluated inside the closure transaction under the stage row
-- lock». They disagree and INV-061 wins: a projection carries a watermark and a
-- stale flag, and a gate that admits a closure on a stale row is not a gate.
-- What these tables are for is the two read operations and the screens behind
-- them.
-- ===========================================================================
create table public.readiness_projection (
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  -- NO VOCABULARY CHECK, AND THAT IS A RECORDED GAP RATHER THAN A CHOICE.
  -- schema-v0.1.sql:2480 gives «e.g. work_assignment | occurrence_scope» — an
  -- example, not an enumeration — and technical/states/state-catalog.csv has no
  -- stored_vocabulary machine for it. v0.1's closable unit is the work stage, so
  -- the set this needs is not even the set the example lists. Inventing it here
  -- is what the unevidenced_closure.reason_code row (state-catalog.csv:119)
  -- forbids doing, so the column is only required to be non-blank and the
  -- vocabulary is owed by the slice that ships readiness.get.
  scope_kind text not null check (length(btrim(scope_kind)) > 0),
  scope_ref uuid not null,
  ready boolean not null,
  blocking jsonb not null default '[]'::jsonb
    check (jsonb_typeof(blocking) = 'array'),
  source_watermark text not null,
  algorithm_version text not null,
  calculated_at timestamptz not null default now(),
  stale boolean not null default false,
  error text,
  primary key (workspace_id, scope_kind, scope_ref),
  -- INV-001 at the FK layer, and the reason the service write policy below can
  -- be unconditional: one key pins workspace, project and contract together, so
  -- a mis-wired rebuilder cannot write a row whose project belongs to another
  -- tenant. scope_ref carries NO foreign key on purpose — its referent varies
  -- with scope_kind, and a projection is rebuilt by deletion and replacement, so
  -- a key into the fact tables would make a rebuild order-dependent.
  constraint readiness_projection_contract_fkey
    foreign key (workspace_id, project_id, contract_id)
    references public.contracts (workspace_id, project_id, id)
);

comment on table public.readiness_projection is
  'Rebuildable projection. It is NOT the closure precondition: INV-061 evaluates '
  'can_close_stage inside the closure transaction under the stage row lock, and a '
  'row carrying a watermark and a stale flag cannot be a gate. There is no writable '
  'readiness anywhere in this schema — aktflow_app holds SELECT and nothing else, '
  'and the write grant belongs to aktflow_service (capabilities.csv '
  'service.projection_rebuild). INV-051 — an older result may not overwrite a newer '
  'one — is NOT enforced here: it needs an ORDER over source_watermark and no '
  'document in this package gives the watermark a format. scope_kind has no '
  'enumerated vocabulary and one is owed before readiness.get ships.';

create table public.blocked_reasons (
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  -- INV-070: the deduplication key for value. Several unmet occurrences on one
  -- work reference the same assignment-scoped value, and the sum takes DISTINCT
  -- assignments per currency so three missing requirements on one work cannot
  -- report three times the money.
  work_assignment_id uuid not null,
  requirement_occurrence_id uuid not null,
  -- What was agreed, and in which version. NOT NULL here where the target DDL
  -- leaves it nullable: public.requirement_occurrences.rule_version_id is NOT
  -- NULL (0043:509), so a blocked reason with no rule version would be a
  -- projection of an obligation that cannot exist.
  rule_version_id uuid not null,

  -- Closed, versioned vocabulary (ADR-005 decision 6; state-catalog.csv:112-118).
  -- An unknown code is a projection error, never a free label, so it cannot be
  -- stored. Two values are UNREACHABLE IN v0.1 and stay in the set so v0.2 is
  -- additive: NOTICE_PERIOD_NOT_ELAPSED needs a witness occurrence and witness is
  -- v0.2, and CLOSED_WITHOUT_ACT needs the bypass, which v0.1 does not have.
  code text not null check (code in (
    'ACT_NOT_SIGNED',
    'TEST_REPORT_MISSING',
    'MATERIAL_CERTIFICATE_MISSING',
    'SUPERVISION_SIGNATURE_MISSING',
    'CUSTOMER_MOTIVATED_REFUSAL',
    'NOTICE_PERIOD_NOT_ELAPSED',
    'CLOSED_WITHOUT_ACT')),
  code_vocabulary_version text not null check (length(btrim(code_vocabulary_version)) > 0),
  missing_evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(missing_evidence) = 'array'),
  awaiting_approver_role text,
  since timestamptz not null,

  currency char(3),
  net_minor_units bigint,
  tax_minor_units bigint,
  gross_minor_units bigint,
  unvalued_quantity numeric(20,6),

  source_watermark text not null,
  algorithm_version text not null,
  calculated_at timestamptz not null default now(),
  stale boolean not null default false,

  primary key (workspace_id, requirement_occurrence_id, code),

  -- The occurrence, its assignment and its rule version are ONE fact, not three
  -- columns the projection filled in independently. Without this key
  -- work_assignment_id is free text and INV-070's deduplication sums whatever
  -- the projection typed.
  constraint blocked_reasons_occurrence_fkey
    foreign key (workspace_id, project_id, requirement_occurrence_id,
                 work_assignment_id, rule_version_id)
    references public.requirement_occurrences
      (workspace_id, project_id, id, work_assignment_id, rule_version_id),
  -- INV-001 at the FK layer, as on the readiness projection.
  constraint blocked_reasons_contract_fkey
    foreign key (workspace_id, project_id, contract_id)
    references public.contracts (workspace_id, project_id, id),

  -- Coupled money (INV-037) per currency; there is no cross-currency total
  -- anywhere (INV-012). All three components present or all three absent, and a
  -- valued row always names its currency.
  constraint blocked_reasons_money_check
    check ((net_minor_units is null and tax_minor_units is null and gross_minor_units is null)
        or (currency is not null
            and net_minor_units is not null and tax_minor_units is not null
            and gross_minor_units = net_minor_units + tax_minor_units)),
  -- Every refusal names the money: either a valued amount, or the quantity of
  -- scope whose price state is missing. Missing price is unvalued, never zero
  -- (INV-038).
  constraint blocked_reasons_names_money_check
    check (net_minor_units is not null or unvalued_quantity is not null)
);

comment on table public.blocked_reasons is
  'The structured block object of ADR-005 decision 6, not a UI state: a gate is '
  'worth what you can point at in a meeting with the general contractor. '
  'Rebuildable, and written by aktflow_service alone. Blocked VALUE is attributed '
  'once per work_assignment_id and the sum takes DISTINCT assignments per currency '
  '(INV-070). WHAT FILLS THE MONEY COLUMNS IS NOT DEFINED IN THIS PACKAGE: ADR-006 '
  'step 6 says «the amount of the work lines under a blocked stage, at the price on '
  'the published baseline, attributed once per assignment», and a work assignment is '
  'a SLICE of a work item, so two assignments on one line would each attribute the '
  'line''s whole amount and the per-assignment deduplication would not prevent it. '
  'That is a product decision and this table only refuses to store an incoherent '
  'answer to it. CLOSED_WITHOUT_ACT is a code inside evidence_blocked and no eighth '
  'value-at-risk state exists for the bypass (ADR-005 decision 8).';

create index blocked_reasons_assignment_idx
  on public.blocked_reasons (workspace_id, work_assignment_id, currency);

-- ===========================================================================
-- 8. Grants allowlist
--
-- Route by route, so an unused grant is visible:
--   requirement_exceptions              SELECT  the exception history on an
--                                               occurrence; readiness
--                                       INSERT  requirement_exceptions.create
--   requirement_exception_heads         SELECT  satisfied(o)'s current pointer
--                                       INSERT  the first exception on an
--                                               occurrence opens its head
--                                       UPDATE  every later exception advances it
--   requirement_evidence_decisions      SELECT  the decision history; readiness
--                                       INSERT  evidence_decisions.create, and in
--                                               M5 external.occurrence_decision_submit
--   requirement_evidence_decision_heads SELECT/INSERT/UPDATE  as above
--   stage_closures                      SELECT  the closure record; M4's act pin
--                                       INSERT  stage_closures.create
--   stage_closure_occurrences           SELECT  the frozen set, on the closure screen
--                                       INSERT  stage_closures.create
--   work_stages                         UPDATE  stage_closures.create, and nothing
--                                               else — 0043 deliberately withheld it
--   readiness_projection                SELECT  readiness.get
--   blocked_reasons                     SELECT  blocked_reasons.get, blocked_value.get
--
-- NO UPDATE and NO DELETE on the four fact tables: all four are append_only_fact
-- in entity-catalog.csv and a correction is a successor row. UPDATE on the two
-- heads and nothing else, because a head is a pointer and advancing it IS its
-- only mutation; no DELETE, because a lineage that has ever had a head keeps one.
--
-- The two projections are aktflow_service's alone to write
-- (capabilities.csv:43, service.projection_rebuild). aktflow_service is a member
-- of aktflow_app (0034), so it inherits the SELECT grants without a second line.
-- ===========================================================================
revoke all on
    public.requirement_exceptions, public.requirement_exception_heads,
    public.requirement_evidence_decisions, public.requirement_evidence_decision_heads,
    public.stage_closures, public.stage_closure_occurrences,
    public.readiness_projection, public.blocked_reasons
  from public, anon, authenticated;

grant select, insert         on public.requirement_exceptions               to aktflow_app;
grant select, insert, update on public.requirement_exception_heads          to aktflow_app;
grant select, insert         on public.requirement_evidence_decisions       to aktflow_app;
grant select, insert, update on public.requirement_evidence_decision_heads  to aktflow_app;
grant select, insert         on public.stage_closures                       to aktflow_app;
grant select, insert         on public.stage_closure_occurrences            to aktflow_app;
grant select                 on public.readiness_projection                 to aktflow_app;
grant select                 on public.blocked_reasons                      to aktflow_app;

grant update on public.work_stages to aktflow_app;

grant insert, update, delete on public.readiness_projection to aktflow_service;
grant insert, update, delete on public.blocked_reasons      to aktflow_service;

-- ===========================================================================
-- 9. Append-only enforcement, and the head guard — the layer beyond grants
--
-- app.reject_mutation() is 0013:5-9 and is reused unchanged. A grant can be
-- re-issued by a later migration that did not read this one; the trigger cannot
-- be lost by accident, and an append-only table quietly losing its guard is a
-- failure this repository has already had once (0042:59-65).
-- ===========================================================================
create trigger requirement_exceptions_immutable before update or delete
  on public.requirement_exceptions
  for each row execute function app.reject_mutation();

create trigger requirement_evidence_decisions_immutable before update or delete
  on public.requirement_evidence_decisions
  for each row execute function app.reject_mutation();

create trigger stage_closures_immutable before update or delete
  on public.stage_closures
  for each row execute function app.reject_mutation();

create trigger stage_closure_occurrences_immutable before update or delete
  on public.stage_closure_occurrences
  for each row execute function app.reject_mutation();

-- A head advances; it does not move, and it does not go backwards. The version
-- check is the expected-version discipline made structural: a command that reads
-- version N and writes N+1 cannot be beaten by a concurrent command that also
-- read N, because the second update writes N+1 over a row already at N+1 and the
-- guard raises. One function for both heads, branching on the table, because the
-- rule is identical and two copies of it are two places for it to drift.
create or replace function app.guard_requirement_head() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'a % row is a lineage head and is never deleted; the lineage it serialises does not stop existing',
      tg_table_name;
  end if;

  if tg_table_name = 'requirement_exception_heads' then
    if (new.workspace_id, new.project_id, new.requirement_occurrence_id, new.exception_scope)
       is distinct from
       (old.workspace_id, old.project_id, old.requirement_occurrence_id, old.exception_scope) then
      raise exception 'an exception head may not change the lineage it serialises';
    end if;
  else
    if (new.workspace_id, new.project_id, new.requirement_occurrence_id, new.approver_role)
       is distinct from
       (old.workspace_id, old.project_id, old.requirement_occurrence_id, old.approver_role) then
      raise exception 'a decision head may not change the lineage it serialises';
    end if;
  end if;

  if new.version <> old.version + 1 then
    raise exception
      'advancing a % must move its version exactly once (% -> %)',
      tg_table_name, old.version, new.version;
  end if;

  return new;
end $$;
revoke all on function app.guard_requirement_head() from public;

create trigger requirement_exception_heads_guard before update or delete
  on public.requirement_exception_heads
  for each row execute function app.guard_requirement_head();

create trigger requirement_evidence_decision_heads_guard before update or delete
  on public.requirement_evidence_decision_heads
  for each row execute function app.guard_requirement_head();

-- ===========================================================================
-- 10. RLS
--
-- Every write policy names the capability the route checks. 0014 exists because
-- M1's write policies asked only for active membership, so the database could not
-- catch a command-layer mistake; 0016:90-93 says that must not recur, and it does
-- not recur here.
--
-- THE READ SIDE IS project.view ON THE FOUR FACT TABLES. A foreman who is shown
-- «не готово» and cannot see which decision is missing has been shown a status
-- word, which is the thing version-0.1.md §M3 says closes nothing. project.view
-- is how the same persona already reads the occurrence set (capabilities.csv:14).
--
-- THE READ SIDE IS readiness.view ON THE TWO PROJECTIONS, because that is the
-- capability capabilities.csv:31 puts readiness.get, blocked_reasons.get and
-- blocked_value.get behind. project.admin is admitted alongside it so the pilot
-- is not locked out of its own money screen: readiness.view is in NO row of
-- technical/permissions/responsibility-presets.csv, which is the shape of gap M1
-- review finding 8 found on rule_bindings.manage, and it is recorded in §11
-- rather than worked around by widening this policy to project.view.
--
-- THE WRITE SIDE ON public.work_stages IS stage_closures.close AND NOT
-- assignments.manage. 0043's ws_insert asks for assignments.manage because
-- assignments.create materialises stages; closing one is a different act with a
-- different capability and a different persona, and the `using` clause names the
-- state it may act on so a closed stage is refused by the policy as well as by
-- the guard.
-- ===========================================================================
alter table public.requirement_exceptions               enable row level security;
alter table public.requirement_exception_heads          enable row level security;
alter table public.requirement_evidence_decisions       enable row level security;
alter table public.requirement_evidence_decision_heads  enable row level security;
alter table public.stage_closures                       enable row level security;
alter table public.stage_closure_occurrences            enable row level security;
alter table public.readiness_projection                 enable row level security;
alter table public.blocked_reasons                      enable row level security;

create policy re_select on public.requirement_exceptions for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy re_insert on public.requirement_exceptions for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['requirement_exceptions.decide']));

create policy reh_select on public.requirement_exception_heads for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy reh_insert on public.requirement_exception_heads for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['requirement_exceptions.decide']));
create policy reh_update on public.requirement_exception_heads for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['requirement_exceptions.decide']))
  with check (app.has_project_capability(workspace_id, project_id,
              array['requirement_exceptions.decide']));

create policy red_select on public.requirement_evidence_decisions for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy red_insert on public.requirement_evidence_decisions for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['evidence_decisions.decide']));

create policy redh_select on public.requirement_evidence_decision_heads
  for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy redh_insert on public.requirement_evidence_decision_heads
  for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['evidence_decisions.decide']));
create policy redh_update on public.requirement_evidence_decision_heads
  for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['evidence_decisions.decide']))
  with check (app.has_project_capability(workspace_id, project_id,
              array['evidence_decisions.decide']));

create policy sc_select on public.stage_closures for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy sc_insert on public.stage_closures for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['stage_closures.close']));

create policy sco_select on public.stage_closure_occurrences for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy sco_insert on public.stage_closure_occurrences for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['stage_closures.close']));

create policy ws_update on public.work_stages for update to aktflow_app
  using (status = 'open'
    and app.has_project_capability(workspace_id, project_id, array['stage_closures.close']))
  with check (status = 'closed'
    and app.has_project_capability(workspace_id, project_id, array['stage_closures.close']));

create policy rp_select on public.readiness_projection for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['readiness.view','project.admin']));
-- Unconditional, and the tenant chain is not lost by it: a rebuild deletes and
-- replaces rows for a scope and has no actor to resolve a capability against,
-- and readiness_projection_contract_fkey already makes a row whose project
-- belongs to another tenant unrepresentable (INV-001). aktflow_service is a
-- member of aktflow_app (0034), so it reads through rp_select and this policy
-- adds only the write side.
create policy rp_write_server on public.readiness_projection for all to aktflow_service
  using (true) with check (true);

create policy br_select on public.blocked_reasons for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['readiness.view','project.admin']));
create policy br_write_server on public.blocked_reasons for all to aktflow_service
  using (true) with check (true);

-- ===========================================================================
-- 11. What the catalogs and the route slice owe, recorded here rather than
--     edited into them
--
-- A migration that edits prose is a migration nobody can review (0042:497-508,
-- 0043:1005-1038). Eight items are owed by this slice and none is made here:
--
--   1. THE TWO TypeScript HALVES OF THE CAPABILITY VOCABULARY. §1 widens the
--      CHECK by four values; `projectCapability`
--      (packages/contracts/src/project-access.ts) and `ProjectCapability`
--      (packages/domain/src/authz.ts) must gain the same four in this same
--      commit, or packages/testing/src/capability-vocabulary.test.ts goes red and
--      no grant row carrying them can be written by a route. 0044:48-55 records
--      what happens when they do not move together.
--
--   2. responsibility-presets.csv NAMES NONE OF THE FOUR. No preset carries
--      stage_closures.close, evidence_decisions.decide,
--      requirement_exceptions.decide or readiness.view, so no persona can close a
--      stage, decide an occurrence, record the only escape v0.1 has, or read the
--      blocked money — every one of them needs a hand-issued grant. This is M1
--      review finding 8 exactly, one milestone later and four times over.
--      capabilities.csv already says which personas they belong to in prose
--      (:26 «whoever holds the occurrence''s approver_role»; :28 ADR-006 step 3),
--      and turning that into preset rows is a permissions decision, not a
--      migration.
--
--   3. entity-catalog.csv:83-84 marks readiness_projection and blocked_reasons
--      `projection_scope+source_watermark` as their identity. The primary keys
--      built here are (workspace_id, scope_kind, scope_ref) and
--      (workspace_id, requirement_occurrence_id, code), which is what
--      schema-v0.1.sql:2489 and :2525 declare and what a rebuild can actually
--      key on. The catalog rows are owed a correction.
--
--   4. state-catalog.csv HAS NO MACHINE FOR readiness_projection.scope_kind, and
--      §7 therefore ships the column with no vocabulary CHECK. The slice that
--      ships readiness.get owes the enumeration.
--
--   5. schema-v0.1.sql:102's `exception_action` enum reads
--      ('waive','not_applicable','accept_risk','revoke'). Three documents —
--      state-catalog.csv:109-111, execution-and-evidence.md:506 and ADR-005
--      decision 3 — write 'waiver'. §3 follows the three; the target DDL is owed
--      the correction, and 'revoke' is owed a row in state-catalog.csv or an
--      explicit statement that it is a head-clearing action and not a kind.
--
--   6. schema-v0.1.sql:2492-2493 says stage closure READS readiness_projection.
--      INV-061's enforcement column says the predicate is evaluated inside the
--      closure transaction. §7 follows INV-061; the target DDL comment is owed
--      the correction.
--
--   7. execution-and-evidence.md:583-588 describes the closure correction lineage
--      as running under «one serialized head per stage, expected version
--      required». There is no stage-closure head in entity-catalog.csv and none
--      is built: stage_closures_lineage_key and the chain FK give the same
--      guarantee without one, because a closure lineage has no «current pointer»
--      any predicate reads. The document is owed either the correction or the
--      table.
--
--   8. INV-065's third clause and version-0.1.md §M3's «recording that a stage
--      was in fact covered stays permitted under a live block» name a v0.1
--      behaviour with no v0.1 carrier — see the header. One of the two documents
--      is owed a correction, and the choice between them is a scope decision.
--
--   9. NOTHING WRITES EITHER PROJECTION, and event-catalog.csv:19, :22 and :23
--      name `projection_rebuilder` as the consumer of the three M3 events.
--      supabase/functions/outbox-drain/index.ts says drained rows have no
--      deployed consumer. The slice that ships readiness.get and
--      blocked_reasons.get owes that consumer, or the two routes answer with
--      nothing on a real pilot — the shape of M1 review finding 2.
-- ===========================================================================
comment on column public.work_stages.status is
  'Moves ONLY through the M3 closure command. Migration 0045 replaced '
  'work_stages_immutable with app.guard_work_stage(), which admits exactly one '
  'transition, open -> closed, alters nothing but status/version/updated_at, and '
  'refuses every update whose old status is not ''open'' — so ''closed'' is TERMINAL '
  'and «ADR-005 defines no reopen» is a schema rule rather than a sentence. A stage '
  'UPDATED to closed with no public.stage_closures fact behind it is refused at '
  'commit by work_stages_closure_fact_required. THAT COVERS ONE OF THE TWO DOORS '
  'AS THIS MIGRATION WRITES IT: the trigger here is `after update` only, so a row '
  'INSERTED with status = ''closed'' needs no closure fact and is terminal from '
  'birth. Migration 0048 widens the trigger to `after insert or update` and '
  'narrows ws_insert to a stage born ''open''; this comment is corrected in place '
  'rather than left claiming the unqualified guarantee, because 0045 has not been '
  'applied and a comment that overstates a rule is how the gap stayed invisible. '
  '''closed_without_evidence'' remains '
  'unreachable in v0.1: ADR-006 decision 4 keeps the bypass out because its whole '
  'price is package ineligibility and there are no packages to make ineligible, and '
  'v0.2 widens the GUARD rather than dropping a CHECK.';
