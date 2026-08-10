-- 0046: the valuation carve leaves recording and moves to admission (v0.1-M3).
--
-- THE NUMBER. 0045 is this milestone's schema half and is taken. This file is
-- separate from it on purpose: 0045 builds tables nothing has ever written, and
-- THIS ONE CHANGES THE BEHAVIOUR OF A DEPLOYED ROUTE. ADR-008 says so in its own
-- Consequences — «This is a behaviour change to a deployed route, not a
-- target-design change. progress.record shipped in v0.1-M2-A and is live in the
-- 33-table runtime.» A change of that kind deserves its own rollback line and its
-- own review, which is the reason 0044 was split out of 0043.
--
-- THE AUTHORITY. docs/decisions/ADR-008-valuation-carves-at-admission.md, Status
-- Approved, 2026-08-07. «The valuation carve leaves the recording path and moves
-- to the moment of admission», and in v0.1 «admission is the stage closure
-- command (M3) … the carve happens inside the stage-closure transaction, against
-- the same allocation head, for the quantity the closure covers. A closure that
-- is refused carves nothing, because a refused closure writes nothing at all.»
--
-- WHAT THIS ADDS
--   1. one composite unique on public.progress_entries;
--   2. two nullable columns on public.valuation_allocations —
--      admitted_by_closure_id and admitted_work_assignment_id — with the pairing
--      CHECK and the two foreign keys that make «carved by THAT closure, for a
--      progress fact of THAT closure's assignment» structural rather than
--      procedural;
--   3. one index;
--   4. a replacement va_insert policy whose second arm is the admission path.
--
--   No table is created. No row is written. No command ships in this file.
--
-- WHAT THIS DOES NOT CHANGE
--   No table, column, index, trigger or grant is dropped. Migrations 0001-0045
--   are applied history or are this branch's own and are not edited. The one
--   policy that is dropped is dropped and immediately re-created in the same
--   transaction, by the technique 0025:64-65 and 0030:50-51 used on this same
--   policy before.
--
--   public.valuation_allocations keeps every constraint 0015, 0022, 0025 and 0030
--   put on it: one allocation per progress fact
--   (unique (workspace_id, progress_entry_id)), the same quantity as the fact it
--   values (valuation_allocations_progress_fact_fkey), a root that is a root, and
--   funded_quantity inside the slice. The append-only trigger from 0016:55 is
--   untouched.
--
--   BOTH NEW FOREIGN KEYS ARE MATCH SIMPLE ON NULLABLE COLUMNS, so every row that
--   already exists — all of which carry NULL in both new columns — satisfies them
--   and validation cannot fail.
--
-- ROLLBACK
--   Dev only, and only while no closure has carved anything:
--     drop policy va_insert on public.valuation_allocations;
--     create policy va_insert on public.valuation_allocations for insert to aktflow_app
--       with check (
--         app.has_project_capability(workspace_id, project_id,
--           array['project.view','project.admin'])
--         and exists (
--           select 1 from public.progress_entries p
--            where p.workspace_id = valuation_allocations.workspace_id
--              and p.id = valuation_allocations.progress_entry_id
--              and app.has_project_capability(p.workspace_id, p.project_id,
--                    case p.entry_kind
--                      when 'root' then array['progress.record']
--                      else             array['progress.adjust']
--                    end)));
--     drop index valuation_allocations_admission_idx;
--     alter table public.valuation_allocations
--       drop constraint valuation_allocations_admitted_entry_fkey,
--       drop constraint valuation_allocations_admitting_closure_fkey,
--       drop constraint valuation_allocations_admission_pairing_check,
--       drop column admitted_work_assignment_id,
--       drop column admitted_by_closure_id;
--     alter table public.progress_entries
--       drop constraint progress_entries_assignment_scope_key;
--   ONCE ONE CLOSURE HAS CARVED, dropping admitted_by_closure_id destroys the only
--   record of WHICH admission produced which money — and ADR-008 §"What this ADR
--   does not decide" makes that column the thing the v0.2 re-anchoring migration
--   has to key on. Staging and production take a corrective forward migration.
--
-- WHAT WAS NOT CHECKED
--   NOTHING HERE WAS EXECUTED. No psql, no supabase, no migration run, no test.
--   Static reading of 0015, 0016, 0017, 0022, 0025, 0030, 0043 and 0045, of
--   apps/app/src/lib/valuation-writer.ts and of ADR-008 is the only check
--   performed on it.
--
-- ---------------------------------------------------------------------------
-- THE DEPLOY ORDER, STATED BECAUSE GETTING IT WRONG IS EXPENSIVE
--
-- This migration WIDENS what may be written; it does not narrow it. Applied
-- before the route change, progress.record keeps carving exactly as it does
-- today and nothing breaks. Applied after, the closure can carve. There is no
-- window in which a recorded fact is refused — which matters, because INV-065
-- says the gate never refuses to record a fact, and a migration that made
-- progress.record fail for the length of a deploy would break it for real
-- quantities in a real pilot.
--
-- ---------------------------------------------------------------------------
-- THE CONSTRAINT THIS MIGRATION DELIBERATELY DOES NOT ADD
--
-- The obvious way to make ADR-008 structural is
--   alter table public.valuation_allocations
--     add constraint valuation_allocations_admission_only_check
--     check (admitted_by_closure_id is not null) not valid;
-- — NOT VALID so the rows already carved at recording time survive, enforced on
-- every new row. That would make «progress.record no longer writes a
-- valuation_allocations row» a database rule instead of a route's promise.
--
-- IT IS NOT ADDED, AND THE REASON IS NOT CAUTION. The same CHECK also forbids
-- progress.adjust from carving, and ADR-008 §"What this ADR does not decide"
-- names that question and leaves it open: «Whether an admitted-then-corrected
-- quantity releases its allocation, and by what command… v0.1 needs its own
-- answer for a closure that is later found wrong, and this ADR does not give
-- one.» With the CHECK in place and no answer written, an adjustment to already
-- admitted quantity could never move the money at all: the stage is closed, the
-- guard of 0045 §6 forbids reopening it, and a second closure requires a
-- correction lineage. A migration that made an undecided question unrepresentable
-- would have decided it by omission, which is the failure mode this package keeps
-- naming.
--
-- So the constraint is written here, in a comment, ready to apply, and it belongs
-- to the ADR that decides correction — not to this one. Until then ADR-008's
-- "no carve at recording time" half is enforced by the route, and this file says
-- so plainly rather than letting a reader infer enforcement from the presence of
-- two new columns.
--
-- ---------------------------------------------------------------------------
-- WHAT BELONGS TO THE ROUTE AND NOT TO ANY MIGRATION
--
-- Written out because «provide whatever the SQL side needs» is only honest
-- beside a list of what the SQL side cannot provide:
--
--   a. REMOVING THE CALL. apps/app/app/v1/assignments/[assignmentId]/progress/
--      route.ts calls appendValuationAllocation after opening the allocation
--      head. ADR-008 says record «continues to insert the append-only progress
--      entry, unchanged; open the allocation head, unchanged … It no longer
--      writes a valuation_allocations row.» Only the route can stop calling it.
--
--   b. CHOOSING WHICH PROGRESS FACTS A CLOSURE ADMITS — AND THIS IS THE ONE
--      GENUINELY UNDECIDED THING IN ADR-008'S v0.1 FORM. The ADR says «for the
--      quantity the closure covers». public.progress_entries carries
--      work_assignment_id and NO work_stage_id (0015), and one assignment may
--      carry several stages — assignments.create materialises one stage per bound
--      stage_key (0043:109-113). So there is no stored fact that attributes a
--      measured quantity to a stage, and «the quantity the closure covers» is not
--      derivable from the database as it stands.
--      Three answers, and the cost of each:
--        * ADMIT EVERY NOT-YET-ADMITTED ENTRY OF THE ASSIGNMENT. Requires no
--          schema change and is the only one v0.1 can do today. Its cost is real
--          and must not be discovered later: closing ANY one stage of an
--          assignment admits quantity whose other stages are still open, so a
--          multi-stage assignment can have money admitted through its least
--          demanding gate. unique (workspace_id, progress_entry_id) on
--          public.valuation_allocations means no entry is ever admitted twice, so
--          the failure is early admission, never double admission.
--        * ADD work_stage_id TO public.progress_entries. Correct, and it changes
--          progress.record's contract — the foreman would have to name a stage
--          when recording a quantity — which is a v0.1 boundary change and needs
--          its own decision.
--        * ADMIT ONLY WHEN THE LAST OPEN STAGE OF THE ASSIGNMENT CLOSES. Needs no
--          schema either, and it makes an assignment with one never-closed stage
--          hold its whole value unadmitted forever.
--      This migration builds the columns that record the answer and takes none of
--      the three. Whichever is chosen must be written into ADR-008 or a successor,
--      because it decides which money a pilot sees.
--
--   c. THE VALUE-AT-RISK BUCKET ADR-008 OWES. «A quantity that is recorded but
--      not admitted is performed, priced, and not allocated… The projection owes
--      it a bucket, and blocked_value.get (M6) owes it a line.» After this
--      migration that state is readable without a new column — a progress entry
--      with no public.valuation_allocations row — and naming it is a projection
--      and glossary change.
--
--   d. INV-069 AND HEAD CURRENCY, unchanged from 0045's header: the closure
--      command still has to prove the facts it froze are the CURRENT heads, and
--      still has to refuse a decider who was the capturer.
--
--   e. THE CLOSER MUST BE ABLE TO READ THE PROJECT, AND THE POLICY IN §3 IS WHAT
--      MAKES THAT NON-OPTIONAL. appendValuationAllocation computes every total
--      with coalesce(sum(...), 0) over public.progress_entries and
--      public.valuation_allocations. Under RLS, rows the actor cannot see read as
--      ZERO — not as an error — so a carve run by an actor holding
--      stage_closures.close and NOT project.view would see an untouched pool and
--      carve the whole of it. That is a silent money bug, and the first conjunct
--      of va_insert (kept from 0030, which added it for this class of reason) is
--      the thing that stops it: no allocation may be inserted into a project the
--      actor cannot see.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. The composite unique that backs the admitted-entry foreign key
--
-- (already-unique key) + (one column): public.progress_entries already has
-- unique (workspace_id, id) (0015), so no two rows can collide on this that did
-- not already collide on that, and validation against existing rows cannot fail.
-- ===========================================================================
alter table public.progress_entries
  add constraint progress_entries_assignment_scope_key
  unique (workspace_id, id, work_assignment_id);

-- ===========================================================================
-- 2. An allocation says which admission carved it, and cannot lie about it
--
-- TWO COLUMNS RATHER THAN ONE, and the second is what makes the first worth
-- having. With only admitted_by_closure_id, a carve could name any closure in the
-- workspace — including one that closed a stage of a different assignment, on a
-- different contract — and every row would still resolve. The assignment column
-- is the join: it is checked against the CLOSURE on one side and against the
-- PROGRESS ENTRY on the other, and the two keys meet on it. The sentence «this
-- money was admitted by that closure, for work recorded under the very assignment
-- whose stage it closed» is then a shape the database holds, not a comment.
--
-- BOTH NULLABLE, and paired. NULL in both means «carved at recording time», which
-- is every row written before ADR-008 and every row a route still writes until
-- the call in progress.record is removed. There is no third state: a closure with
-- no assignment, or an assignment with no closure, is unrepresentable.
-- ===========================================================================
alter table public.valuation_allocations
  add column admitted_by_closure_id uuid,
  add column admitted_work_assignment_id uuid;

alter table public.valuation_allocations
  add constraint valuation_allocations_admission_pairing_check
    check ((admitted_by_closure_id is null) = (admitted_work_assignment_id is null)),

  -- The closure exists, is in this workspace, and closed a stage of this
  -- assignment. stage_closures_assignment_pin_key (0045 §5) is the key.
  add constraint valuation_allocations_admitting_closure_fkey
    foreign key (workspace_id, admitted_by_closure_id, admitted_work_assignment_id)
    references public.stage_closures (workspace_id, id, work_assignment_id),

  -- The progress fact this allocation values was recorded under that same
  -- assignment. MATCH SIMPLE with a nullable admitted_work_assignment_id, so a
  -- recording-time allocation is unconstrained by it and an admission-time one is
  -- fully constrained: progress_entry_id is NOT NULL, so as soon as the
  -- assignment column is non-null both legs are present and the key must resolve.
  add constraint valuation_allocations_admitted_entry_fkey
    foreign key (workspace_id, progress_entry_id, admitted_work_assignment_id)
    references public.progress_entries (workspace_id, id, work_assignment_id);

comment on column public.valuation_allocations.admitted_by_closure_id is
  'The admission that carved this money (ADR-008). NULL means the row was carved '
  'at RECORDING time — every allocation written before ADR-008, and every one a '
  'route still writes until the call is removed from progress.record. It is the '
  'column the v0.2 migration ADR-008 §"What this ADR does not decide" describes has '
  'to key on: when packages arrive, admission moves from stage closure to package '
  'eligibility and a v0.1 allocation carved at closure must either be re-anchored '
  'or read as already-admitted, and neither is possible without knowing which ones '
  'those are. NOT ENFORCED AS MANDATORY, deliberately — see migration 0046''s '
  'header: the CHECK that would forbid a recording-time carve would also forbid '
  'progress.adjust from correcting admitted money, and whether an '
  'admitted-then-corrected quantity releases its allocation is exactly what ADR-008 '
  'declines to decide.';

comment on column public.valuation_allocations.admitted_work_assignment_id is
  'Pinned from BOTH sides: it is checked against the closure''s assignment and '
  'against the progress entry''s assignment by two foreign keys that meet on this '
  'column. Without it admitted_by_closure_id could name any closure in the '
  'workspace and every row would still resolve. Paired with '
  'admitted_by_closure_id by valuation_allocations_admission_pairing_check — both '
  'null, or neither.';

-- «Which money did this closure admit» is the question an act, a correction and
-- the v0.2 re-anchoring migration all ask.
create index valuation_allocations_admission_idx
  on public.valuation_allocations (workspace_id, admitted_by_closure_id)
  where admitted_by_closure_id is not null;

-- ===========================================================================
-- 3. The insert policy gains the admission arm
--
-- 0030:36-48 replaced this policy to state its real requirement: writing into a
-- project you cannot see must fail, and the read capability was required in fact
-- while being stated nowhere. That first conjunct is KEPT UNCHANGED and is doing
-- more work after this migration than before it — see §e of the header: under
-- RLS an invisible progress entry sums to zero rather than to an error, so an
-- actor who can write an allocation into a project he cannot read would carve
-- from a pool he believes untouched.
--
-- TWO ARMS, discriminated by the column and not by the actor:
--   * admitted_by_closure_id IS NOT NULL — the carve at admission. It asks for
--     stage_closures.close, the capability that authorises the act the money now
--     follows, and the foreign keys of §2 have already proved the closure is real
--     and is about this progress fact's own assignment.
--   * admitted_by_closure_id IS NULL — the recording-time arm, in exactly the
--     shape 0030 left it, including the per-entry-kind capability split. It stays
--     because removing it would make progress.record fail before its own route
--     change lands, and INV-065 does not permit a window in which recording a
--     measured fact is refused.
--
--     IT DOES NOT BECOME DEAD SURFACE when appendValuationAllocation leaves
--     progress.record. An earlier revision of this paragraph said it did, and
--     contradicted itself two lines up by keeping the per-entry-kind capability
--     split for an entry kind it had just called dead: progress.adjust uses this
--     arm, which is exactly why the split is here. The claim is corrected in
--     place — 0046 has not been applied — because a comment asserting a live
--     write path is dead is what made a P0 hole in that path invisible to
--     everyone who read this file.
--
--     WHAT MAY USE IT, stated because the header asked and did not answer.
--     ONLY A CORRECTION TO QUANTITY THAT ALREADY HOLDS MONEY. progress.adjust
--     now writes an allocation only when the corrected root already carries one
--     (apps/app/app/v1/progress-entries/[entryId]/adjustments/route.ts); against
--     an unadmitted root it writes no row at all, and the stage closure admits
--     the whole lineage — the root and its corrections, in recording order — when
--     it admits anything. Without that gate two calls walked around the ADR-005
--     gate entirely for money: record 0.000001, adjust +9.999999, and the
--     correction drew essentially the whole pool with this arm's blessing, no
--     stage, no closure and no decision anywhere.
--
--     THE ARM IS THEREFORE STILL LIVE AND STILL NARROW, and it retires with the
--     CHECK named in the header on the day ADR-008's successor decides what a
--     correction to ADMITTED quantity does — the question this migration and that
--     route both leave exactly where the ADR left it.
--
-- The two arms cannot be confused: an actor holding only stage_closures.close
-- cannot write a recording-time allocation, and an actor holding only
-- progress.record cannot write an admission one.
-- ===========================================================================
drop policy va_insert on public.valuation_allocations;
create policy va_insert on public.valuation_allocations for insert to aktflow_app
  with check (
    app.has_project_capability(workspace_id, project_id,
      array['project.view','project.admin'])
    and (
      (admitted_by_closure_id is not null
        and app.has_project_capability(workspace_id, project_id,
              array['stage_closures.close']))
      or
      (admitted_by_closure_id is null
        and exists (
          select 1 from public.progress_entries p
           where p.workspace_id = valuation_allocations.workspace_id
             and p.id = valuation_allocations.progress_entry_id
             and app.has_project_capability(p.workspace_id, p.project_id,
                   case p.entry_kind
                     when 'root' then array['progress.record']
                     else             array['progress.adjust']
                   end)))));

comment on table public.valuation_allocations is
  'INV-055: append-only lineage splitting the work-item valuation pool into '
  'exposure slices. FROM ADR-008 (2026-08-07) THE CARVE HAPPENS AT ADMISSION, NOT '
  'AT RECORDING: in v0.1 admission is the stage-closure command, so a row written '
  'by that path names the closure that carved it and the assignment whose stage was '
  'closed, and performed quantity is recorded and UNVALUED until it is admitted. A '
  'refused closure carves nothing, because a refused closure writes nothing at all. '
  'A row with admitted_by_closure_id NULL was carved at recording time; that is '
  'every row written before this migration, and the recording-time write path is '
  'retired by the route rather than by a constraint — migration 0046''s header says '
  'why, and names the CHECK that becomes available once ADR-008''s successor decides '
  'what a correction to admitted quantity does.';

-- ===========================================================================
-- 4. What the catalogs owe, recorded here rather than edited into them
--
--   1. INV-089 WAS ADDED TO invariant-catalog.csv IN THIS SLICE, not left owed.
--      ADR-008 §Consequences asks for it in terms: «progress_allocation_heads
--      gains a state it did not have. A head can now exist with
--      reserved_quantity = 0 and no allocation row, for an arbitrary period. The
--      columns already permit it; nothing writes that state today. The invariant
--      catalogue should say so explicitly rather than leaving it inferable.» No
--      SQL here is needed for the head half — 0015's head CHECKs already admit
--      the state and app.open_allocation_head (0017) already writes a head with
--      no allocation beside it — so what the ADR asked for was the ROW, and the
--      row is the place its «NOT COVERED» half is recorded too. The catalog edit
--      is a sibling of this migration and not part of it: a migration that edits
--      prose is a migration nobody can review.
--
--   2. entity-catalog.csv:25 says of valuation_allocations «DEPLOYED (migration
--      0015) AND NOT EXTENDED IN v0.1 — the allocation-ledger WORK moves to
--      v0.2». This migration extends it by two columns. The row predates ADR-008
--      (approved 2026-08-07) and is owed a correction naming the ADR: the
--      allocation LEDGER stays v0.2, and the admission provenance is v0.1-M3
--      because the carve moved.
--
--   3. ADR-008 NAMES THREE TEST FILES THAT MUST MOVE RATHER THAN BE REWRITTEN —
--      apps/app/tests/vertical-m2a.int.test.ts:98,
--      apps/app/tests/progress-record.int.test.ts:40 and
--      packages/domain/src/valuation.test.ts. «Rewriting these to keep passing
--      without moving the assertion would freeze the inverted ordering. The matrix
--      must be exercised somewhere; that somewhere is now the admission command.»
--      That is test work in the route slice, and this migration does none of it.
--
--   4. THE THREE-WAY CHOICE OF §b IS UNRECORDED ANYWHERE. Whichever of the three
--      answers the route takes must be written into ADR-008 or a successor before
--      a pilot sees a number, because it decides which money is admitted and when.
-- ===========================================================================
