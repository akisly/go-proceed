-- 0048: the two doors the M3 gate left open, and the money rule behind them.
--
-- NOTHING HERE HAS BEEN APPLIED. No `supabase`, no `psql`, no database: this file
-- has never been run, no claim is made that it applies, and the only check
-- performed on it was reading it.
--
-- THE NUMBER. 0041-0047 are taken; 0041-0046 are v0.1-M3's schema and 0047 is
-- M4's. This is the first free number and it is the correction slice for the M3
-- pre-landing review's findings 2 and 4.
--
-- WHY A NEW MIGRATION AND NOT AN EDIT TO 0045. 0045 has not shipped either, and
-- the review's own suggestion was to change its trigger in place. This branch's
-- rule is narrower — 0041-0047 may have their COMMENTS corrected in place, and
-- new DDL starts at 0048 — and the narrower rule is the safer one here: anybody
-- who has already applied 0045 into a scratch database gets the fix by running
-- forward, where an in-place edit would leave them with the old trigger and a
-- file that says otherwise. 0045's and 0046's comments ARE corrected in place in
-- this same change, and each correction says which door it now points at.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS
--
--   1. `work_stages_closure_fact_required` fires on INSERT as well as UPDATE.
--   2. `ws_insert` admits only a stage born `open`.
--   3. `valuation_allocations_funded_within_lineage` — a deferred, definer
--      constraint trigger asserting that a root's funded quantity never exceeds
--      the quantity its lineage actually performed.
--
-- WHAT THIS DOES NOT CHANGE
--   No table is created or dropped. No column is added or dropped. No row is
--   written, deleted or rewritten. Migrations 0001-0040 are applied history and
--   are not edited.
--
--   §3 ADDS A CHECK OVER EXISTING ROWS AND COULD IN PRINCIPLE FIND ONE. A
--   constraint trigger validates nothing retroactively — it fires on rows written
--   from here on — so this migration cannot fail on pilot data. That is stated
--   because it is the usual reason a check like this is refused, and it does not
--   apply. What it also means is that a row already carrying the defect stays: no
--   repair is attempted here, and none is owed until the defect is known to have
--   reached a database that matters.
--
-- ROLLBACK
--   Dev only. THE ORDER IS LOAD-BEARING — the trigger before the function it
--   calls, or the drop fails and the next hand reaches for CASCADE:
--     drop trigger valuation_allocations_funded_within_lineage
--       on public.valuation_allocations;
--     drop function app.assert_funded_within_lineage();
--     drop policy ws_insert on public.work_stages;
--     create policy ws_insert on public.work_stages for insert to aktflow_app
--       with check (app.has_project_capability(workspace_id, project_id,
--                   array['assignments.manage']));
--     drop trigger work_stages_closure_fact_required on public.work_stages;
--     create constraint trigger work_stages_closure_fact_required
--       after update on public.work_stages
--       deferrable initially deferred
--       for each row execute function app.assert_stage_closure_exists();
-- ═══════════════════════════════════════════════════════════════════════════

-- ===========================================================================
-- 1. A stage may not be BORN closed
--
-- 0045 §6 built `work_stages_closure_fact_required` as `after update` only, and
-- both its reasoning (0045:1213-1219) and the column comment it writes
-- (0045:1716-1726) claim the unqualified guarantee: «a stage marked closed with
-- no closure fact behind it is refused at commit, so `update work_stages set
-- status = 'closed'` cannot become the whole gate». The UPDATE door is shut. The
-- INSERT door was not even locked: `status` has a CHECK admitting 'closed' and a
-- default of 'open', and nothing looked at which one an INSERT chose.
--
-- WHAT A STAGE INSERTED `closed` WOULD BE. Terminal — `app.guard_work_stage()`
-- rejects every update whose old status is not 'open', so it can never move
-- again and can never acquire a closure. Carrying no frozen set, so nothing
-- records which obligations were evaluated. Skipped by `blocked_reasons.get`,
-- which filters to open stages. And counted as NOT OPEN by
-- `isLastOpenStage` in apps/app/src/lib/admission.ts — so it RELEASES THE
-- ASSIGNMENT'S MONEY. The whole ADR-005 gate, walked around by choosing a value
-- for one column at insert time.
--
-- LATENT RATHER THAN LIVE, and recorded as such: no v0.1 route writes `status` on
-- this table. `work_stages.create` leaves the default deliberately and says why.
-- This is the mirror of the door 0045 was written to shut, and «no route does it
-- today» is the reason the other door was shut anyway.
--
-- THE FUNCTION IS UNCHANGED. `app.assert_stage_closure_exists()` already reads
-- `new.status` and `new.id` and makes no reference to `old`, so it is correct for
-- INSERT exactly as written; only the trigger's event list was too narrow. It
-- stays NOT security definer for the reason 0045 gives — under RLS a closure it
-- cannot see makes it RAISE, and failing closed is the safe direction here.
--
-- DEFERRABLE INITIALLY DEFERRED for the reason 0045 gives and which now applies
-- to a second ordering: the closure row is inserted after the stage exists, and
-- this constraint must not dictate statement order inside a command.
-- ===========================================================================
drop trigger work_stages_closure_fact_required on public.work_stages;

create constraint trigger work_stages_closure_fact_required
  after insert or update on public.work_stages
  deferrable initially deferred
  for each row execute function app.assert_stage_closure_exists();

comment on column public.work_stages.status is
  'open -> closed, and nothing else, in v0.1. The transition is opened by '
  'app.guard_work_stage() (migration 0045 §6) and is reachable only through '
  'stage_closures.create; ''closed_without_evidence'' stays in the CHECK so v0.2 '
  'is additive (ADR-006 decision 4) and is unreachable through the guard. A row '
  'recorded ''closed'' — WHETHER BY INSERT OR BY UPDATE — must have a '
  'public.stage_closures fact behind it at COMMIT: '
  'work_stages_closure_fact_required (widened to INSERT by migration 0048, which '
  'says why the UPDATE-only form was not the guarantee it claimed). ws_insert '
  'admits only a stage born ''open'', so the two layers disagree about nothing.';

-- ===========================================================================
-- 2. The belt: `ws_insert` admits only an OPEN stage
--
-- §1 is the suspenders and answers at COMMIT with a message about closure facts.
-- This answers at the statement, in the policy that already decides who may
-- create a stage, and it says the simpler true thing: creating a stage is not
-- closing one. `assignments.manage` creates; `stage_closures.close` closes; 0045
-- §10 keeps the two capabilities and the two personas apart deliberately, and an
-- INSERT that set `status` would have let the first do the second's work.
--
-- IT IS A NARROWING OF AN UNSHIPPED POLICY, so there is no grant to migrate and
-- no writer to update: `work_stages.create` never names `status`, and
-- `assignments.create`'s materialisation does not either.
--
-- The capability conjunct is 0043 §9's, unchanged and re-stated rather than
-- referenced, because a policy that has to be read against another file to be
-- understood is a policy nobody reads.
-- ===========================================================================
drop policy ws_insert on public.work_stages;
create policy ws_insert on public.work_stages for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
                array['assignments.manage'])
              and status = 'open');

-- ===========================================================================
-- 3. A root's funded quantity never exceeds what its lineage performed
--
-- THE DEFECT THIS WOULD HAVE CAUGHT, in the numbers the review found it in.
-- Contract quantity 10, pool P. `progress.record 10`; `progress.adjust −4` while
-- the root was still unadmitted, which under the old route carved at once, so the
-- CORRECTION held an allocation and its ROOT did not; then the stage closure,
-- which admitted the root alone at its recorded 10. The lineage ended holding
-- funded_quantity 10 against a progress_allocation_heads.effective_quantity of 6,
-- and about 71 % of P where 60 % is correct. Every constraint on the table was
-- satisfied: valuation_allocations_funded_within_quantity_check (0025) compares
-- funded_quantity with the ROW's quantity and 10 <= 10; the components check
-- compares net, tax and gross with each other. NOTHING COMPARED THE LINEAGE'S
-- MONEY WITH THE LINEAGE'S QUANTITY.
--
-- THE RULE. For a root progress entry R, summing over every allocation whose
-- root_progress_entry_id is R:
--
--     0 <= sum(funded_quantity) <= sum of R's lineage quantities
--
-- The upper bound is an inequality and not an equality, and that is the
-- over-contract case rather than slack: a root recording 12 against a ten-unit
-- line is funded for 10 and performed 12, and INV-039 owes the remaining
-- exposure a bucket in M6. The lower bound is the one that says a lineage never
-- hands back money it never received.
--
-- WHY A TRIGGER AND NOT A CHECK. Both sides are sums across rows of two tables.
-- A CHECK sees one row.
--
-- DEFERRABLE INITIALLY DEFERRED, AND THAT IS NOT A CONVENIENCE. The closure
-- transaction admits a lineage as its ENTRIES — the root at +10, then the
-- correction at −4 — because valuation_allocations_progress_fact_fkey (0025) pins
-- an allocation's quantity to its progress entry's and a single row carrying the
-- effective 6 is unrepresentable. Between those two statements the sum IS 10
-- against an effective 6. An immediate trigger would refuse the correct
-- transaction and permit nothing extra; a deferred one asks the question when the
-- transaction has finished answering it.
--
-- SECURITY DEFINER, for the reason 0045 §5 gives and with the sign that matters
-- here: RLS hiding an allocation row makes the SUM SMALLER, so the check would
-- pass where it should fail. That is failing OPEN, which is the direction 0017's
-- lesson is about, and it is the opposite of §1's situation where invisibility
-- makes the check raise. A definer function reads the whole lineage or the rule
-- is decorative.
--
-- IT COMPARES AGAINST public.progress_entries AND NOT AGAINST
-- public.progress_allocation_heads. The head is the serialization point and
-- app.assert_reservation_invariant() keeps its effective_quantity in step with
-- the entries, but the entries are the append-only fact and the head is derived
-- from them. A rule that checked money against a derived number would be
-- satisfiable by a wrong head.
-- ===========================================================================
create or replace function app.assert_funded_within_lineage() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  performed numeric(20,6);
  funded    numeric(20,6);
begin
  select coalesce(sum(p.quantity), 0) into performed
    from public.progress_entries p
   where p.workspace_id = new.workspace_id
     and (p.id = new.root_progress_entry_id
          or p.root_progress_entry_id = new.root_progress_entry_id);

  select coalesce(sum(v.funded_quantity), 0) into funded
    from public.valuation_allocations v
   where v.workspace_id = new.workspace_id
     and v.root_progress_entry_id = new.root_progress_entry_id;

  if funded < 0 then
    raise exception
      'root progress entry % holds funded quantity % — a lineage cannot hand back money it never received',
      new.root_progress_entry_id, funded;
  end if;

  if funded > performed then
    raise exception
      'root progress entry % is funded for % against an effective quantity of % (ADR-008: only admitted quantity competes for the pool)',
      new.root_progress_entry_id, funded, performed;
  end if;

  return null;
end $$;
revoke all on function app.assert_funded_within_lineage() from public;

create constraint trigger valuation_allocations_funded_within_lineage
  after insert on public.valuation_allocations
  deferrable initially deferred
  for each row execute function app.assert_funded_within_lineage();

comment on function app.assert_funded_within_lineage() is
  'ADR-008/INV-089, the part no single-row constraint can see: the money a root '
  'progress entry''s lineage holds is bounded below by zero and above by the '
  'quantity that lineage actually performed. Deferred, because a closure admits a '
  'root and its corrections as separate rows in one transaction and the sum is '
  'only meaningful once they are all in. SECURITY DEFINER, because an allocation '
  'hidden by RLS makes the sum smaller and the check would fail OPEN.';

-- ===========================================================================
-- 4. What the catalogs owe, recorded here rather than edited into them
--
-- A migration that edits prose is a migration nobody can review (0042:479-490).
-- Three items are owed by this slice and none is written here:
--
--   1. THE RULE IN §3 IS IN NO INVARIANT CATALOGUE ROW. It is not INV-089 — that
--      one is about performed quantity being recorded UNVALUED until admission,
--      which is the route's obligation and is enforced by
--      apps/app/src/lib/admission.ts and by the gate in progress.adjust. §3 is
--      the arithmetic consequence: once admitted, a lineage's funded quantity is
--      bounded by what it performed. An id must be allocated in
--      technical/database/invariant-catalog.csv with enforcement «deferred
--      constraint trigger, migration 0048» before this ships. NO ID IS INVENTED
--      HERE, because an invariant id that appears first in a migration is an id
--      no catalogue agreed to.
--
--   2. INV-089's «NOT COVERED AND NAMED SO» clause names only the missing CHECK
--      on recording-time allocation. It should now also record that the
--      recording-time write path stayed live for progress.adjust until this
--      slice gated it, and that the gate is a route predicate rather than a
--      constraint — the CHECK 0046's header names still becomes available only
--      when ADR-008's successor decides what a correction to ADMITTED quantity
--      does.
--
--   3. technical/states/transition-catalog.csv describes the work_stage
--      open -> closed transition and says nothing about the state a stage may be
--      CREATED in. §1 and §2 make «every stage is born open» a database rule; the
--      catalogue should carry it, because a rule that exists only in DDL is a
--      rule the next state diagram contradicts.
-- ===========================================================================
