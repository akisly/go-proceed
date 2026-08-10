-- 0051: the stage nobody agreed to — the closable unit must come from the baseline.
--
-- NOTHING HERE HAS BEEN APPLIED. No `supabase`, no `psql`, no database: this file
-- has never been run, no claim is made that it applies, and the only check
-- performed on it was reading it. It is the eleventh unapplied migration on this
-- branch (0041-0051) and none of the eleven has been applied anywhere.
--
-- THE NUMBER. 0041-0050 are taken. 0041-0050 may have their COMMENTS corrected in
-- place on this branch; a CHECK, a trigger or a policy is BEHAVIOUR and starts a
-- new file. This is behaviour, so it is 0051.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS
--
--   1. `app.stage_key_is_admissible(uuid, uuid, text)` — the predicate, SECURITY
--      DEFINER, one implementation shared by the route and the trigger.
--   2. `app.guard_work_stage_key()` + `work_stages_stage_key_guard`, a BEFORE
--      INSERT trigger on `public.work_stages`.
--   3. The table and column comments migration 0043 wrote for
--      `public.work_stages.stage_key`, RE-ISSUED: both said the stage vocabulary
--      is deliberately unconstrained, and after §2 that is true of half the cases
--      and false of the other half. 0043 keeps its text as the history of its own
--      moment and carries a marker pointing here (the two `--` lines added to
--      0043 §2 in this same change; nothing executable in 0043 is touched).
--
-- WHAT THIS DOES NOT CHANGE
--   No table is created or dropped. No column is added, dropped or widened. No
--   existing constraint is weakened, no policy is replaced, no existing trigger
--   is dropped or recreated, no grant is issued on any table. No row is written,
--   deleted or rewritten. Migrations 0001-0040 are applied history and are not
--   edited.
--
--   IT VALIDATES NOTHING RETROACTIVELY. A BEFORE INSERT trigger fires on rows
--   written from here on, so this migration cannot fail on existing data — which
--   is the usual reason a check like this is refused, and it does not apply. A
--   stage already carrying a key its baseline never implied would stay; none is
--   known to exist, because no database has run any of 0041-0050.
--
-- ROLLBACK
--   Dev only. THE ORDER IS LOAD-BEARING — the trigger before the function it
--   calls, and the guard before the resolver it calls, or the drop fails and the
--   next hand reaches for CASCADE:
--     drop trigger work_stages_stage_key_guard on public.work_stages;
--     drop function app.guard_work_stage_key();
--     drop function app.stage_key_is_admissible(uuid, uuid, text);
--   The comments in §3 are not restored by that sequence, and completing the
--   rollback means re-issuing 0043's two strings verbatim — they are still in
--   that file, at 0043:489-500 and 0043:1084-1095, kept there for exactly this
--   reason. After a rollback «any stage key is writable» is once again true and
--   the comment must say so again.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 0. THE DEFECT, IN THE SEQUENCE THAT REACHES IT
--
-- `work_stages.create` (apps/app/app/v1/assignments/[assignmentId]/stages/route.ts)
-- wrote ANY `stage_key` the caller typed. It checked `assignments.manage` and
-- `work_assignments.status = 'active'` and asked nothing about the baseline.
-- `work_stages_closable_unit_uniq` (0043:482-484) blocks only a REPEAT of the
-- same key on the same assignment, so a fresh key was always available.
--
--   1. A typed line materialises its stages inside `assignments.create` and each
--      carries the obligations the bound rule versions imply (0043 §2, §4).
--   2. They are satisfied and closed honestly. The LAST of them is the admitting
--      closure — `ADMISSION_RULE = last_open_stage_of_assignment`
--      (apps/app/src/lib/admission.ts) — and it carves the money recorded so far.
--   3. More quantity is recorded. It is unvalued, correctly (INV-089).
--   4. A member holding `assignments.manage` and `stage_closures.close` inserts a
--      stage under a key nobody agreed to. It carries no occurrence, because
--      `src/lib/occurrence-writer.ts` is the only door an occurrence comes
--      through and only `assignments.create` opens it.
--   5. `can_close_stage` over the empty set is TRUE (`∀` over ∅;
--      execution-and-evidence.md §"Closure and eligibility"), so the stage closes
--      vacuously — and being the only open stage of the assignment, THAT VACUOUS
--      CLOSURE IS THE ADMITTING ONE. Every progress fact recorded since step 2 is
--      released by a closure that proved nothing.
--
-- Every step was VISIBLE — `blockingOccurrenceCount: 0` on the 201, `vacuous:
-- true` on the closure, both in the audit — and nothing refused it. Visibility is
-- not refusal. It is also the only way to reach a SECOND admission on one
-- assignment, which is the step the double-spend between `packages/domain/src/
-- valuation.ts` and `apps/app/src/lib/valuation-writer.ts` needs; that defect is
-- fixed in its own files and this file removes the door it walks through.
--
-- WHY THE RULE IS «IMPLIED FOR THIS LINE» AND NOT «BOUND ANYWHERE IN THE
-- BASELINE», which is the wider form and the obvious one. A baseline binds rule
-- versions for several work types — masonry and electrical on one contract is the
-- ordinary case — so «any bound stage_key» leaves the mint fully reachable: the
-- electrical line's assignment takes the masonry stage key, gets an empty stage,
-- and step 5 is unchanged. The narrow form closes it completely, and closes it
-- STRUCTURALLY rather than by vigilance: for a covered line every implied key
-- already holds a stage that `assignments.create` wrote in its own transaction,
-- `public.work_stages` has no DELETE grant to `aktflow_app` (0043:958-961,
-- 0045:1466 adds only UPDATE), so an implied key collides with
-- `work_stages_closable_unit_uniq` and every other key is refused here. The
-- command becomes unreachable on a covered line, which is the point.
--
-- WHAT IS DELIBERATELY STILL LEGAL, because refusing it would buy nothing. An
-- UNCOVERED line — untyped, which is every imported line permanently (ADR-006
-- decision 6 freezes the importer, INV-015 freezes the published line), or typed
-- and matching no bound rule — implies NO stage, so any key is admitted and the
-- resulting stage is empty and closes vacuously. That is INV-072's disclosed hole
-- and this migration does not close it. It cannot be closed by a key rule: on
-- such an assignment the FIRST closure is already vacuous and already admitting,
-- so constraining the spelling of the key shuts no door. What closes THAT hole is
-- a work type on the line, which is migration 0050's carrier and the pilot's own
-- data-entry discipline.
--
-- «THE ASSIGNMENT MUST STILL HAVE AN OPEN STAGE» IS NOT ADDED EITHER, and it was
-- the other candidate. On a covered line the question cannot arise. On an
-- uncovered one, «record a tranche, make a stage, close it, make the next» is the
-- only shape an imported baseline's money has and it is exercised by
-- `apps/app/tests/admission-valuation.int.test.ts`; a rule forbidding it would
-- break the legal path and still leave the first vacuous closure untouched.
-- ═══════════════════════════════════════════════════════════════════════════

-- ===========================================================================
-- 1. THE PREDICATE
--
-- ONE IMPLEMENTATION, TWO CALLERS, FOR THE REASON `apps/app/src/lib/readiness.ts`
-- gives about `can_close_stage`: a precondition computed twice is two
-- preconditions. `work_stages.create` calls this function for the catalogued
-- field error and §2's trigger calls it for the refusal that no write path can
-- forget. They cannot drift, because there is nothing to drift from.
--
-- IT IS ALSO A THIRD STATEMENT OF A PREDICATE THAT ALREADY EXISTS IN TYPESCRIPT,
-- AND THAT IS THE ONE JOINT NOTHING ENFORCES. `planForWorkType`
-- (apps/app/src/lib/requirement-materialisation.ts) computes exactly this set —
-- `bound.filter(r => r.workTypeKey === lineKey)`, then its distinct `stage_key`s
-- — and `assignments.create` MATERIALISES from it. If the two ever disagree, a
-- stage materialisation wrote would be refused by this trigger, which is a
-- failure inside the transaction that creates an assignment. Three things hold
-- the joint: both sides read through `contract_version_rule_bindings` and never
-- by predicate over the rule table (INV-080 pins the set at publication, INV-067
-- keeps a retired version in it); both compare with BYTE EQUALITY on a key
-- normalised once at the wire (`z.string().trim()`; migration 0050 §1 and
-- `workTypeKeyOf`'s comment say why normalising twice is the failure mode); and
-- `apps/app/tests/materialisation-end-to-end.int.test.ts` asserts this function's
-- verdict against the stages materialisation actually wrote, on a typed line,
-- through the routes.
--
-- SECURITY DEFINER, AND HERE THE ARGUMENT IS NOT CONVENIENCE — IT IS THAT THE
-- CHECK WOULD OTHERWISE FAIL OPEN FOR EXACTLY THE ACTOR IT DEFENDS AGAINST. The
-- predicate reads `public.work_items` (`wi_select` asks project.view /
-- project.admin) and `public.contract_version_rule_bindings` (`cvrb_select`,
-- 0041 §9, the same). The INSERT it guards is governed by `assignments.manage`
-- (`ws_insert`, 0043 §9), and 0042 §4 already records that a capability of that
-- kind may be held WITHOUT project.view. Under SECURITY INVOKER such a caller
-- would see no line and no binding, the implied set would read EMPTY, and the
-- function would answer «admissible» to every key — silently, and only for the
-- caller who cannot be seen checking. Failing open in the invoker's favour is the
-- one direction a guard may never fail.
--
-- THE DISCLOSURE IS BOUNDED TO A BOOLEAN about (a workspace the caller is an
-- active member of, an assignment the caller is at that moment writing a stage
-- onto under `assignments.manage`, a key the caller typed). It is not an oracle:
-- the caller learns «this key is not one your baseline implied for this line» and
-- nothing else — not the implied set, not the line's work type, not which rule
-- versions the baseline bound. Returning the SET was considered and rejected for
-- that reason, even though it would have let the route name the permitted keys in
-- its refusal.
--
-- `stable`, not `volatile`: it reads and returns the same answer within a
-- statement. `set search_path = ''` with every reference schema-qualified — the
-- stricter of the two conventions in this chain (0049's; 0011's `= public` is the
-- older one) — so no search_path a caller sets can change what this function
-- reads.
-- ===========================================================================
create or replace function app.stage_key_is_admissible(ws uuid, asg uuid, k text)
returns boolean language sql stable security definer set search_path = '' as $$
  with implied as (
    -- The stage keys this baseline implies FOR THIS ASSIGNMENT'S LINE: the
    -- distinct stage_key of every rule version the version bound whose work type
    -- is the line's own. Byte equality, no normalisation — see the header.
    select distinct rv.stage_key
      from public.work_assignments a
      join public.work_items w
        on w.workspace_id = a.workspace_id
       and w.id = a.work_item_id
      join public.contract_version_rule_bindings b
        on b.workspace_id = a.workspace_id
       and b.contract_version_id = a.contract_version_id
      join public.requirement_rule_versions rv
        on rv.workspace_id = b.workspace_id
       and rv.id = b.requirement_rule_version_id
     where a.workspace_id = ws
       and a.id = asg
       -- Redundant beside the equality below, which is null-false, and kept
       -- because it is the sentence the TypeScript matcher writes first
       -- (`if (workTypeKey === null) return false`): an untyped line matches no
       -- rule and therefore implies no stage.
       and w.work_type_key is not null
       and rv.work_type_key = w.work_type_key)
  -- NO IMPLIED SET → ANY KEY (the uncovered line; header §0). AN IMPLIED SET →
  -- ONE OF ITS MEMBERS. The first disjunct is the whole of INV-072's legal case
  -- and is written first so a reader meets it before the refusal.
  select not exists (select 1 from implied)
      or exists (select 1 from implied i where i.stage_key = k)
$$;
revoke all on function app.stage_key_is_admissible(uuid, uuid, text) from public;
grant execute on function app.stage_key_is_admissible(uuid, uuid, text) to aktflow_app;

comment on function app.stage_key_is_admissible(uuid, uuid, text) is
  'True when a stage key may be written for an assignment: either the '
  'assignment''s work line implies no stage at all — it carries no work type, or '
  'none of the rule versions its baseline bound names that work type, which is '
  'the uncovered line INV-072 exists to disclose — or the key is one of the '
  'stage_key values those matched rule versions name. It is the SQL statement of '
  'the set planForWorkType derives in apps/app/src/lib/requirement-materialisation.ts '
  'and assignments.create materialises from; the two agree by byte equality on a '
  'key normalised once at the wire, and materialisation-end-to-end.int.test.ts is '
  'where that agreement is asserted. Consulted by work_stages_stage_key_guard and '
  'independently by work_stages.create, which turns a false into VALIDATION_FAILED '
  'on the stageKey field.';

-- ===========================================================================
-- 2. THE REFUSAL, STRUCTURALLY
--
-- WHY A TRIGGER AND NOT ONLY THE ROUTE CHECK. The route check is what the caller
-- should meet, and it is not the guarantee. `ws_insert` (0043 §9, narrowed by
-- 0048 §2 to a stage born `open`) admits every holder of `assignments.manage` to
-- INSERT into this table, and `aktflow_app` is the role every route, every job
-- and every hand-run statement uses. The mint in §0 needs exactly one INSERT and
-- one closure, both of which that role can already perform, so «the route checks
-- it» defends the callers that go through the route and nothing else. The rest of
-- this build resolves that the same way — 0050 §5 for the work type, 0042 §5 for
-- the binding window, 0048 §1-2 for a stage born closed — and this is that rule
-- applied to the door those three left.
--
-- BEFORE INSERT ONLY, AND NOT UPDATE. `stage_key` cannot change:
-- `app.guard_work_stage()` (0045 §6) admits exactly one UPDATE — `open` ->
-- `closed`, driven by the closure command — and refuses everything else, so an
-- UPDATE arm here would be dead code guarding a door another trigger already
-- welded. It would also fire on every closure, which is a join through four
-- tables on the hottest statement in the product.
--
-- FIRING ORDER IS NOT LEFT TO CHANCE, though here there is nothing to order
-- against: this is the ONLY BEFORE INSERT trigger on `public.work_stages`
-- (0043:975 `work_stages_immutable` and its 0045:1208 replacement
-- `work_stages_guard` are both `before update or delete`), and
-- `work_stages_closure_fact_required` (0045 §6, widened by 0048 §1) is an AFTER
-- constraint trigger deferred to COMMIT. Stated rather than assumed, because
-- «there is nothing else on this event» is a fact that stops being true silently.
--
-- IT RAISES RATHER THAN RETURNING FALSE, and the raise reaches the wire as a 500
-- (`INTERNAL_ERROR`, apps/app/src/lib/http.ts). That is the intended shape: the
-- route asks the same function first and returns a catalogued 422, so reaching
-- this raise means a write path did not check — a defect, and meant to be loud.
-- Same division as `work_items_work_type_guard` (0050 §5) and
-- `app.guard_rule_binding_window()` (0042 §5).
--
-- NOT SECURITY DEFINER, and it does not need to be: everything it reads it reads
-- through the resolver, which is.
-- ===========================================================================
create or replace function app.guard_work_stage_key() returns trigger
language plpgsql as $$
begin
  if not app.stage_key_is_admissible(
       new.workspace_id, new.work_assignment_id, new.stage_key) then
    raise exception
      'stage key % is not one this assignment''s baseline implied for its work line '
      '(public.work_stages.stage_key; app.stage_key_is_admissible)',
      new.stage_key;
  end if;

  return new;
end $$;
revoke all on function app.guard_work_stage_key() from public;

create trigger work_stages_stage_key_guard before insert
  on public.work_stages
  for each row execute function app.guard_work_stage_key();

-- ===========================================================================
-- 3. THE TWO COMMENTS 0043 WROTE, RE-ISSUED
--
-- 0043:489-500 and 0043:1084-1095 both say the stage vocabulary is «deliberately
-- NOT checked relationally» because «a stage with no bound rule is legal and is
-- the uncovered line INV-072 must print». THAT WAS TRUE WHEN IT WAS WRITTEN AND
-- IS NOW TRUE OF HALF THE CASES: it remains exactly right for a line that implies
-- no stage, and it is wrong for a line that implies some — for that line the
-- vocabulary is now closed, by §2, to what the baseline bound for its work type.
-- A comment describing a hole that has since been closed is itself a defect, so
-- the two strings are replaced here rather than left to be read as current. 0043
-- keeps its own text as the record of its moment and carries two `--` markers
-- pointing at this file; nothing executable in 0043 is touched.
--
-- STILL NOT A FOREIGN KEY, and the distinction matters. A relational constraint
-- on `stage_key` would need an entity that owns the stage vocabulary, and there
-- is none — the vocabulary is emergent, «whatever keys the workspace's published
-- rule versions carry» (0050 §3), and glossary.md:109 defers the owning entity to
-- an ADR. This is a trigger over a JOIN, which is what a key would have to be if
-- the set it pointed at were computable at all.
-- ===========================================================================
comment on table public.work_stages is
  'The closable unit: one assignment, one location node (v0.2 — no v0.1 command '
  'sets it), one stage from the vocabulary the published contract version pins, '
  'flagged concealed or not. BUILT IN v0.1-M2 THOUGH entity-catalog.csv:40 MARKS '
  'THE TABLE v0.1-M3, because a before_concealment occurrence cannot be stored '
  'without a concealed stage and that timing is the entire hidden-works case; the '
  'CLOSURE COMMAND is still M3 and migration 0043 grants no UPDATE. status is a '
  'stored lifecycle column (state-catalog.csv work_stage.status) and the closure '
  'FACTS are stage_closures and unevidenced_closures — they are what may be relied '
  'on. THE STAGE VOCABULARY IS CONSTRAINED BY app.stage_key_is_admissible AND NOT '
  'BY A FOREIGN KEY (migration 0051): where the assignment''s work line implies '
  'stages — its work_type_key names rule versions this baseline bound — the key '
  'must be one of theirs, because a stage the baseline never implied carries no '
  'obligation, closes vacuously and, being an assignment''s last open stage, '
  'admits its money. Where the line implies none, ANY key is legal and the stage '
  'is empty: that is the uncovered line INV-072 must print, and migration 0043 '
  'said so of every stage because until 0050 no line could imply one.';

comment on column public.work_stages.stage_key is
  'One value of the stage vocabulary the contract-version rule bindings pin: the '
  'set of stage_key values bound to a contract version IS that version''s stage '
  'vocabulary (0041:445-449), which is what lets assignments.create materialise '
  'stages and occurrences in one transaction from one binding. Since migration '
  '0051 a hand-made stage may not step outside the narrower set the baseline '
  'bound FOR THIS LINE''S WORK TYPE — work_stages_stage_key_guard refuses it on '
  'INSERT and work_stages.create refuses it first with a catalogued field error. '
  'A line that names no work type, or names one no bound rule version carries, '
  'implies no stage and keeps the OPEN vocabulary migration 0043 described: any '
  'key, an empty stage, a vacuous closure, disclosed as work_type_unresolved or '
  'no_matching_rule and never silently (INV-072). The MATCHING of a rule to a '
  'work line reads public.work_items.work_type_key, which carries the predicate''s '
  'first argument from migration 0050 — nullable, deliberately. The set of work '
  'types still has no owning entity: it is whatever keys the workspace''s '
  'published rule versions carry (0050 §3).';

-- ===========================================================================
-- 4. WHAT THE CATALOGS OWE, WRITTEN OUT AND NOT EDITED IN
--
-- A migration that edits prose is a migration nobody can review (0042:479-490),
-- and a migration that allocates itself an invariant id is how a catalog acquires
-- two owners (0050 §6.4, whose refusal to allocate one was settled correctly by
-- the documentation slice as INV-090). So: the row this slice owes is written out
-- here, WITHOUT AN ID, for the slice that owns technical/database/invariant-catalog.csv
-- to allocate and paste.
--
--   scope: stage_closure
--   statement: A work stage exists only under a key its assignment's baseline
--     implied for that assignment's work line — the stage_key of a rule version
--     the contract version bound whose work_type_key is the line's own — UNLESS
--     the line implies no stage at all, in which case any key is legal and the
--     empty stage that results is the uncovered line INV-072 requires be
--     disclosed rather than refused. The rule exists because an unimplied stage
--     carries no obligation, closes vacuously (∀ over ∅), and as an assignment's
--     last open stage is the ADMITTING closure under ADR-008 — so a member
--     holding assignments.manage and stage_closures.close could release every
--     progress fact recorded since the real gate closed, with a stage nobody
--     agreed to and every per-row constraint in this database still passing.
--   enforcement: app.stage_key_is_admissible (SECURITY DEFINER over workspace /
--     assignment / key; definer because ws_insert is governed by
--     assignments.manage which may be held without project.view, and an invoker
--     function would read an empty implied set and answer «admissible» to
--     everything) called by work_stages_stage_key_guard (BEFORE INSERT on
--     public.work_stages) and independently by work_stages.create, which returns
--     VALIDATION_FAILED on the stageKey field. For a COVERED line the two
--     together make the command unreachable: every implied key already holds a
--     stage assignments.create wrote, work_stages has no DELETE grant, so an
--     implied key collides with work_stages_closable_unit_uniq and any other key
--     is refused. NOT COVERED AND NAMED SO: an UNCOVERED line's stages are
--     unconstrained and vacuous by design, and no key rule can change that —
--     their first closure is already the admitting one; and this says nothing
--     about occurrences written by anything other than assignments.create, of
--     which there is no v0.1 producer (requirement_occurrences.create and
--     .bulk_instantiate are v0.2).
--   test_evidence: a fresh stage key refused on a covered assignment after its
--     materialised stages closed, with no second admission behind it; the same
--     key refused from the TABLE OWNER with RLS bypassed, so the trigger and not
--     the route is what refuses; a hand-made stage still ADMITTED on an untyped
--     line; the function's verdict compared with the stages materialisation
--     actually wrote.
--   source_document: docs/decisions/ADR-005-readiness-gate-and-hidden-works.md
--     (the closable unit) with ADR-008 (admission at the last open stage).
--   applies_to: v0.1-M3 — added 2026-08-08.
--
-- AND ONE THING THAT IS NOT A CATALOG CORRECTION. `work_stages.create` is now
-- unreachable on a covered line. technical/openapi/scope-v0.1.csv:43 still lists
-- the operation and it is still correct to list it — the operation exists and an
-- uncovered line still reaches it — but the OWNER should know that the M3 screen
-- offering «додати етап» has nothing to offer on a typed line. If free stage keys
-- on a covered line are wanted, that is a product decision, it belongs in an ADR
-- beside `vacuous`, and it must arrive with the answer to «what does closing this
-- stage prove, and why may it release money».
-- ===========================================================================
