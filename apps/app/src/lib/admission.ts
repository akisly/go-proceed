import type { Tx } from "@goproceed/database";
import type { AdmissionView } from "@goproceed/contracts";
import {
  appendValuationAllocation, lockAllocationHead, lockWorkItem, toScaled6,
} from "./valuation-writer";

/**
 * ADR-008: the valuation carve, at admission.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT MOVED, AND WHAT DID NOT
 *
 * ADR-008 (Approved, 2026-08-07) takes the `valuation_allocations` write out of
 * `progress.record` and puts it inside the stage-closure transaction. What
 * `progress.record` keeps is unchanged and is worth stating, because the change
 * is easy to over-read: it still inserts the append-only progress entry, it still
 * opens the allocation head — the head is the serialization point for adjustments
 * and for allocation and must exist before either can be ordered — and it still
 * records audit and enqueues the outbox event. Performed quantity is therefore
 * RECORDED AND UNVALUED until it is admitted, which is a real state and is the
 * one INV-089 was written for.
 *
 * INV-065 is satisfied rather than strained: no readiness predicate enters the
 * recording path. A foreman who measured 40 metres measured 40 metres, and
 * nothing in this module is reachable from `progress.record`, `progress.adjust`
 * or the evidence path.
 *
 * A REFUSED CLOSURE CARVES NOTHING, because a refused closure writes nothing at
 * all — the command throws before reaching this module and the transaction rolls
 * back.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHICH PROGRESS FACTS A CLOSURE ADMITS — THE ONE THING ADR-008 LEAVES OPEN
 *
 * The ADR says «for the quantity the closure covers». There is no such stored
 * fact: `public.progress_entries` carries `work_assignment_id` and NO
 * `work_stage_id` (migration 0015), and one assignment may carry several stages —
 * `assignments.create` materialises one per bound `stage_key`. Migration 0046 §b
 * lists the three answers and takes none of them. This module takes the third:
 *
 *   **A closure admits the assignment's unadmitted progress only when it closes
 *   the assignment's LAST OPEN STAGE.**
 *
 * WHAT IT ADMITS IS A LINEAGE, NOT A ROW: a root progress entry AND every
 * correction recorded against it before admission, carved in that order in one
 * transaction, so the money the lineage ends up holding is the money its
 * EFFECTIVE quantity earns. A correction is part of the measurement it corrects;
 * admitting the root at 10 while a −4 sits beside it funds quantity that was
 * withdrawn before anybody authorised anything. `pendingEntries` below carries
 * the arithmetic, the failure it closes, and why the lineage cannot be admitted
 * as one row.
 *
 * Why this one, stated so it can be argued with rather than discovered:
 *
 *   * The first answer — admit every unadmitted entry of the assignment on any
 *     closure — admits money whose other stages are still open. On a multi-stage
 *     assignment the money would leave through the least demanding gate, which
 *     inverts the sentence the whole product is built on: «a quantity without its
 *     proof is not yet a claim». Its failure mode is silent and monetary.
 *   * The second answer — put `work_stage_id` on `progress_entries` — is the
 *     correct one and is not available here: it changes `progress.record`'s
 *     contract, so a foreman would have to name a stage when recording a
 *     quantity, and that is a v0.1 boundary change needing its own decision.
 *   * This one holds an assignment's whole value unadmitted while one of its
 *     stages stays open. That failure mode is VISIBLE — the money shows up as
 *     exposure on the blocked-money read — and it is the pressure the product
 *     means to apply: the price of an unmet obligation is that the money waits
 *     (ADR-005 decision 5, arrived at from the other side).
 *
 * In the shape a v0.1 pilot has WHEN THE ASSIGNMENT'S LINE IS UNTYPED — one
 * assignment, one hand-created stage, materialisation producing nothing — the
 * first and third answers are the same behaviour. They differ only where the
 * first would be wrong.
 *
 * THAT SHAPE STOPPED BEING THE ONLY ONE ON 2026-08-08. This sentence read «no
 * work line carries a work type, so materialisation produces nothing», which was
 * a fact about the whole product until migration 0050 gave
 * `public.work_items.work_type_key` a carrier. It is now a fact about a
 * population: every line the frozen importer wrote (permanently — ADR-006
 * decision 6 freezes the importer and INV-015 freezes the published line) and
 * any hand-typed line whose typist supplied no work type. A TYPED line now
 * materialises a real obligation set, so an assignment can carry several stages
 * that this module holds value behind, and the divergence between the first and
 * third answers is reachable rather than hypothetical. The choice below does not
 * change; what changes is that it is now load-bearing, which makes migration
 * 0046 §4 item 4's demand — write it into ADR-008 before a pilot sees a number —
 * more urgent and not less.
 *
 * **THIS CHOICE IS NOT RECORDED IN ANY APPROVED DOCUMENT.** Migration 0046 §4
 * item 4 says it must be written into ADR-008 or a successor before a pilot sees
 * a number, because it decides which money is admitted and when. Nothing here
 * discharges that; this comment is the route's half of it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY DOUBLE ADMISSION IS UNREPRESENTABLE AND EARLY ADMISSION IS NOT
 *
 * `unique (workspace_id, progress_entry_id)` on `public.valuation_allocations`
 * (migration 0015) means no entry is ever admitted twice, whatever this module
 * does. The exposure is the OTHER direction — admitting too early — and it is a
 * property of the rule above rather than of the schema.
 *
 * NOTHING HERE WAS EXECUTED: no test run, no route invoked, no query sent.
 */

/** The rule this module implements, named so a reader can grep for it. */
export const ADMISSION_RULE = "last_open_stage_of_assignment" as const;

interface PendingEntry {
  id: string;
  workItemId: string;
  rootProgressEntryId: string;
  quantity: bigint;
  /**
   * How much quantity this admission will still REMOVE from this entry's own
   * lineage after this entry — the sum of the negative pending quantities that
   * come strictly after it in the order below, as a non-negative figure.
   *
   * Not stored anywhere and not derivable from the rows: it is a fact about the
   * list this function just produced. `sliceAllocation`'s lineage ceiling is the
   * only reader; `pendingEntries`' own comment carries why.
   */
  queuedRemoval: bigint;
}

/**
 * SERIALIZES ADMISSION ON THE ASSIGNMENT, AND IT IS THE FIRST THING THIS MODULE
 * DOES.
 *
 * `isLastOpenStage` is a read of OTHER rows than the one this transaction
 * locked, and under READ COMMITTED two transactions closing two stages of one
 * assignment each see the other's stage still `open`. Both answer «not the last»
 * and NEITHER ADMITS. Both stages end `closed`, the assignment's quantity stays
 * unvalued forever, and no v0.1 route re-runs admission — the money is not
 * double-spent, it is silently lost, which on this product's own terms is the
 * worse failure because nothing surfaces it.
 *
 * The row locks cannot fix this: the two transactions lock DIFFERENT stage rows,
 * so they never contend. The assignment is the thing they share and the
 * assignment has no row worth locking here — `work_assignments` is not being
 * modified and a `select … for update` on it would take a lock this command has
 * no other reason to hold. An advisory transaction lock is taken on the
 * assignment IDENTITY instead, in the same shape and for the same reason as
 * `lockWorkItem` (`valuation-writer.ts`): no table privilege, releases with the
 * transaction, and taken on an identity rather than on a row.
 *
 * WITH IT, THE SECOND TRANSACTION RE-READS AFTER THE FIRST COMMITS: it sees both
 * stages closed and admits. Exactly one admission happens, whichever order the
 * two arrive in, and `unique (workspace_id, progress_entry_id)` on
 * `valuation_allocations` remains the backstop rather than the mechanism.
 *
 * LOCK ORDER, STATED BECAUSE IT IS THE PART THAT DEADLOCKS IF IT DRIFTS:
 * assignment → work item → allocation head. `progress.record` and
 * `progress.adjust` take the last two in that order and never reach for the
 * first, so no cycle exists between them and this module.
 */
async function lockAssignmentAdmission(
  tx: Tx, workspaceId: string, workAssignmentId: string,
): Promise<void> {
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`assignment_admission|${workspaceId}|${workAssignmentId}`]);
}

/**
 * Whether this closure is the one that admits — i.e. whether the assignment has
 * any stage left open.
 *
 * CALLED AFTER THE STAGE HAS BEEN UPDATED TO `closed` IN THIS TRANSACTION, so the
 * stage being closed is already excluded by its own status and needs no special
 * case, AND AFTER `lockAssignmentAdmission`, which is what makes the answer
 * stable rather than a guess about what a concurrent transaction has not
 * committed yet. `closed_without_evidence` is unreachable in v0.1 (ADR-006
 * decision 4) and is deliberately not treated as «open»: if the bypass ever
 * ships, a bypassed stage must not hold an assignment's money hostage, and v0.2
 * owes that decision explicitly rather than inheriting it from a predicate
 * written here.
 */
async function isLastOpenStage(
  tx: Tx, workspaceId: string, workAssignmentId: string,
): Promise<boolean> {
  const r = await tx.query(
    `select 1 from public.work_stages
      where workspace_id = $1 and work_assignment_id = $2 and status = 'open'
      limit 1`,
    [workspaceId, workAssignmentId]);
  return r.rows.length === 0;
}

/**
 * The assignment's progress facts that carry no allocation yet, ONE LINEAGE AT A
 * TIME.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY EVERY ENTRY OF THE LINEAGE IS ADMITTED, AND NOT THE ROOT AT ITS EFFECTIVE
 * QUANTITY
 *
 * Admitting «the lineage» is the right unit and there are two ways to write it.
 * The one that reads better is unrepresentable: `valuation_allocations` carries
 * `valuation_allocations_progress_fact_fkey` (migration 0025:28-31, APPLIED
 * HISTORY), a composite foreign key on
 * `(workspace_id, project_id, work_item_id, progress_entry_id, quantity)` into
 * `progress_entries`. An allocation's `quantity` IS its entry's quantity, by a
 * key, «so an allocation that valued a different amount of work than the fact
 * records is now unrepresentable». A single row for a root recorded at 10 and
 * carrying the lineage's effective 6 would be refused with a 23503.
 *
 * So the lineage is admitted AS ITS ENTRIES, in the order they were recorded —
 * root first, then each correction — which reproduces exactly the sequence the
 * carve would have run in when recording still carved, and lands on the same
 * numbers:
 *
 *   contract quantity 10, pool P, `record 10` then `adjust −4`, then closure
 *     root(+10) → nothing else on the line is admitted, so remainingQty = 10,
 *                 funded = 10, and the root draws 100 % of P.
 *     adj(−4)   → the negative branch, against the root's OWN allocated amounts:
 *                 rootFundedQuantity = 10, unfunded = 0, so 4 funded units come
 *                 back and the root keeps 6/10 of what it held.
 *     ───────── the lineage holds 60 % of P and funded_quantity 6, which is its
 *               effective quantity. Not 71 % and not funded 10.
 *
 * THE DEFECT THAT MADE THIS NECESSARY WAS NOT IN THIS QUERY. It was that
 * `progress.adjust` carved at once even when the root was unadmitted: the −4 then
 * held an allocation while its root did not, this query's `not exists` skipped
 * it, only `root(10)` was pending, and `work_item_performed` — which counts
 * admitted quantity — read −4, so the denominator became 10 − (−4) = 14 and the
 * root drew 10/14 ≈ 71 % of P while `progress_allocation_heads.effective_quantity`
 * said 6. Gating that carve (see the adjustments route) leaves the correction
 * unadmitted, so it arrives here WITH its root and the arithmetic above is what
 * runs. The two fixes are one fix.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A LINEAGE CAN BE ADMITTED MORE THAN ONCE, AND THE SECOND TIME IS THE DANGEROUS
 * ONE
 *
 * The `not exists` predicate selects ENTRIES and not lineages, so a root admitted
 * by one closure returns here the moment a later entry of the same lineage holds
 * no allocation. `progress.adjust` produces exactly that: an INCREASE against an
 * admitted root writes no allocation (ADR-008), so it waits for the assignment's
 * next last-open-stage closure — which in v0.1 means a second hand-created stage.
 *
 * That second admission is where a mis-measured correction comes due. Until
 * 2026-08-08 `sliceAllocation` measured a negative correction's unfunded
 * remainder against EVERY entry of the lineage, so on a root funded to its
 * contract quantity a `+2` followed by a `−2` was consumed as free headroom,
 * returned nothing, and was then funded a second time HERE — the lineage reaching
 * funded 12 against an effective 10 and
 * `app.assert_funded_within_lineage()` (migration 0048 §3) raising AT COMMIT.
 * The closure aborted, and aborted identically on every retry: no stage of that
 * assignment could ever close again and its money could never be admitted. The
 * arithmetic is fixed in `packages/domain/src/valuation.ts`, which now measures
 * that remainder against the ADMITTED part of the root. Nothing in this query
 * changed FOR THAT CASE — the next paragraph is a later, different case and does
 * change it — and it is recorded here because this is the statement the abort
 * surfaced on, and because the second admission is otherwise easy to read as
 * impossible.
 *
 * THE LAST CASE OF THAT FAMILY WAS CLOSED ON 2026-08-08, LATER THE SAME DAY, AND
 * THIS PARAGRAPH IS THE RECORD OF WHY THE SHAPE IS WHAT IT IS.
 *
 * WHAT WAS TRUE. It read «ONE CASE OF THAT FAMILY IS STILL OPEN AND IT IS THIS
 * MODULE'S TO CLOSE, NOT THE ARITHMETIC'S … NOT CLOSED HERE». The case: the
 * correction removes MORE than the lineage's ADMITTED quantity — record 4,
 * admit, adjust +6, adjust −8, leaving an effective 2. The −8 gives back all 4
 * funded units and commits (funded 0 against an effective 2). The waiting +6
 * then arrives here ALONE and was admitted at its own quantity: the line read
 * 4 + (−8) = −4 admitted, so `remainingQty` came out at 14 on a ten-unit line,
 * the entry funded 6, and the lineage reached funded 6 against an effective 2.
 * `app.assert_funded_within_lineage()` raised AT COMMIT. `packages/database/
 * src/tx.ts` runs `commit` inside the try, so the raise came back as
 * `INTERNAL_ERROR` with `retryable: true`, nothing was written, and the retry was
 * identical — that assignment could never close another stage and its money
 * could never be admitted. A permanent failure that says «retry» is worse than
 * an over-payment, because an over-payment is at least visible.
 *
 * IT WAS NOT REACHABLE ONLY THROUGH A KEY NOBODY AGREED TO. The whole-build audit
 * tied the second admission to an unimplied stage key and migration 0051 closed
 * that door — on a COVERED line. `0051:97-113` deliberately leaves an UNCOVERED
 * line's second stage legal, and an uncovered line is every line the frozen
 * importer wrote, permanently (ADR-006 decision 6, INV-015). On the population
 * that dominates v0.1 the sequence needs no unagreed key at all: two
 * `progress.adjust` calls and the ordinary next stage.
 *
 * WHAT CHANGED, AND WHERE. The bound belongs on `funded_quantity`, because
 * `valuation_allocations_progress_fact_fkey` (0025) makes an allocation's
 * `quantity` equal to its entry's BY A KEY — «admit the +6 as +2» is a 23503 —
 * while `funded_quantity` is a separate column (0022) constrained only to be no
 * larger in magnitude than the row's own quantity and of the same sign. So the
 * +6 is admitted as a row saying «six units were measured, two of them drew
 * money», which is the truth.
 *
 * WHAT THIS PARAGRAPH GOT WRONG, and it matters because the correction is the
 * reason the fix is split across two files. It said the close was «an ordering
 * decision about this query». It is not: at the second admission the pending
 * list holds EXACTLY ONE entry — the root and the −8 both hold allocations, so
 * the `not exists` skips them — and no ordering rule can change what a
 * single-entry list does. The bound is arithmetic and lives in
 * `sliceAllocation`'s positive branch, where `rootQuantity` and
 * `rootFundedQuantity` are already read under the same locks and already sum the
 * same rows the deferred trigger will read at COMMIT.
 *
 * WHAT THIS MODULE OWES IT IS ONE FACT, AND IT IS THE ONE NO QUERY CAN ANSWER:
 * `queuedRemoval` — how much this admission is still going to take back out of
 * the lineage after the entry being written. A flat ceiling («never fund past
 * the lineage's effective quantity») closes the sequence above and breaks the
 * ordinary one, because a closure admitting `root(+10)` and then that root's own
 * `−4` is momentarily funded 10 against an effective 6 — the exact intermediate
 * state migration 0048 §3 says the trigger is DEFERRABLE INITIALLY DEFERRED in
 * order to permit. A flat ceiling is that immediate trigger rewritten in
 * TypeScript. Carrying the queue distinguishes «a removal is coming in this
 * transaction» from «nothing is coming», which is precisely the difference
 * between the two sequences, and it distinguishes them by a fact rather than by
 * a guess.
 *
 * THE ORDER BELOW IS THEREFORE LOAD-BEARING TWICE. It decides which entry is
 * carved first, and — because `queuedRemoval` is «the negatives strictly after
 * this one» — it decides how much headroom each entry is given. The two readings
 * agree, and they agree because they are the same list.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ORDER IS BY LINEAGE, AND THAT IS A SECOND CORRECTION
 *
 * The previous ordering was «every root, then every adjustment». Roots before
 * their own adjustments is load-bearing and stays — an adjustment's slice is
 * computed against its ROOT's already-allocated amounts (`rootAllocated`,
 * `rootFundedQuantity`), so admitting a correction before its root would compute
 * against zero — but ACROSS lineages that ordering strands money. Two roots of
 * one assignment on a ten-unit line, `record 10`, `adjust −4`, `record 5`:
 *
 *   roots-then-adjustments: root1 draws 100 %; root2 sees the line fully
 *     performed and draws NOTHING; the −4 then returns 40 %. The line ends with
 *     60 % allocated against an effective 11 units performed, and the 40 % is
 *     unreachable by any later measurement — money stranded rather than
 *     overspent, and invisible either way.
 *   by lineage: root1 draws 100 %, the −4 returns 40 %, and root2 then sees 6
 *     units performed, 4 units of contract left, and draws the remaining 40 %.
 *
 * So the sort is: lineages in the order their ROOTS were recorded, and within a
 * lineage the root before its corrections in the order THEY were recorded. `id`
 * breaks every tie, so the order is total and reproducible.
 *
 * `coalesce(root_progress_entry_id, id)` because a root entry stores NULL there
 * and is its own root — the same convention `progress.record` uses when it opens
 * the allocation head.
 */
async function pendingEntries(
  tx: Tx, workspaceId: string, workAssignmentId: string,
): Promise<PendingEntry[]> {
  const r = await tx.query(
    `select p.id, p.work_item_id, p.quantity::text as quantity,
            coalesce(p.root_progress_entry_id, p.id) as root_progress_entry_id
       from public.progress_entries p
       join public.progress_entries root
         on root.workspace_id = p.workspace_id
        and root.id = coalesce(p.root_progress_entry_id, p.id)
      where p.workspace_id = $1 and p.work_assignment_id = $2
        and not exists (select 1 from public.valuation_allocations va
                         where va.workspace_id = p.workspace_id
                           and va.progress_entry_id = p.id)
      order by root.recorded_at, root.id,
               case p.entry_kind when 'root' then 0 else 1 end,
               p.recorded_at, p.id`,
    [workspaceId, workAssignmentId]);
  const entries: PendingEntry[] = (r.rows as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    workItemId: row.work_item_id as string,
    rootProgressEntryId: row.root_progress_entry_id as string,
    quantity: toScaled6(row.quantity as string),
    queuedRemoval: 0n,
  }));

  // The queue, filled by one walk BACKWARDS over the order just established:
  // each entry is told what is still ahead of it in its OWN lineage, then adds
  // itself if it is a removal. Per lineage and not per closure — the ceiling it
  // feeds is a bound on one root's funded quantity, and one closure may carve for
  // several roots (the `record 10, adjust −4, record 5` case above). Crediting
  // one lineage with another's queued removal would hand it headroom it does not
  // have, which is the defect this closes wearing a different hat.
  const ahead = new Map<string, bigint>();
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const e = entries[i]!;
    e.queuedRemoval = ahead.get(e.rootProgressEntryId) ?? 0n;
    if (e.quantity < 0n) ahead.set(e.rootProgressEntryId, e.queuedRemoval - e.quantity);
  }
  return entries;
}

/**
 * The work items this assignment's money can touch, locked before anything is
 * read.
 *
 * `work_assignments.work_item_id` is the authoritative one and always exists;
 * every progress entry of the assignment inherits it, so in practice this is one
 * lock. It is read from the assignment rather than derived from the pending set
 * because the pending set must itself be read UNDER the lock: `progress.adjust`
 * takes `lockWorkItem` before it inserts a correction, so a pending set computed
 * before this lock could miss a correction that commits a moment later and admit
 * a stale effective quantity.
 */
async function assignmentWorkItems(
  tx: Tx, workspaceId: string, workAssignmentId: string,
): Promise<string[]> {
  const r = await tx.query(
    `select work_item_id from public.work_assignments
      where workspace_id = $1 and id = $2`,
    [workspaceId, workAssignmentId]);
  return (r.rows as { work_item_id: string }[]).map((row) => row.work_item_id);
}

export interface AdmitArgs {
  workspaceId: string;
  projectId: string;
  contractId: string;
  workAssignmentId: string;
  /** The closure that admits. Written into `valuation_allocations.admitted_by_closure_id`. */
  stageClosureId: string;
}

/**
 * Carves, inside the closure transaction, for every progress fact this closure
 * admits. Returns what a caller may put on the 201.
 *
 * LOCK ORDER: the assignment, then the work item, then each allocation head in
 * sorted order. The last two are `progress.adjust`'s order («Stable order: pool
 * first, then this root's balance head»), sorted across roots because one
 * closure may touch several; the first is this module's alone and no other
 * command reaches for it, so it can introduce no cycle. Two commands reaching
 * for the same locks in different orders is a deadlock nobody reproduces on a
 * laptop.
 *
 * EVERYTHING THIS FUNCTION READS IS READ UNDER THOSE LOCKS. `isLastOpenStage`
 * needs the assignment lock or two concurrent closures both answer «no» and
 * neither admits; `pendingEntries` needs the work-item lock or a correction
 * committing between the read and the carve is admitted at a stale effective
 * quantity. Both used to run before any lock was taken.
 *
 * THE TOTALS ARE SUMMED PER CURRENCY-FREE COMPONENT AND NOT ACROSS WORK ITEMS OF
 * DIFFERENT CURRENCIES — because they cannot be: one assignment names one work
 * item, and a work item names one currency. The `admission` view therefore has no
 * currency field and is not a cross-currency total (INV-012).
 */
export async function admitClosedStageQuantity(
  tx: Tx, args: AdmitArgs,
): Promise<AdmissionView> {
  const none: AdmissionView = {
    admittedProgressEntryCount: 0, admittedProgressEntryIds: [],
    valued: false, netMinorUnits: null, taxMinorUnits: null, grossMinorUnits: null,
    unvaluedReason: null,
  };

  await lockAssignmentAdmission(tx, args.workspaceId, args.workAssignmentId);

  if (!await isLastOpenStage(tx, args.workspaceId, args.workAssignmentId)) return none;

  // One assignment names one work item, so this is one lock; taken through the
  // set anyway rather than assumed, because assuming it is how the assumption
  // stops being true without anybody noticing.
  for (const workItemId of [...new Set(
    await assignmentWorkItems(tx, args.workspaceId, args.workAssignmentId))].sort()) {
    await lockWorkItem(tx, args.workspaceId, workItemId);
  }

  const pending = await pendingEntries(tx, args.workspaceId, args.workAssignmentId);
  if (pending.length === 0) return none;

  // Re-locking a key already held is a no-op inside one transaction, so this
  // stays a correct belt against a progress entry whose work item is not the
  // assignment's — a shape no v0.1 route can write and no assumption worth
  // making silently.
  for (const workItemId of [...new Set(pending.map((p) => p.workItemId))].sort()) {
    await lockWorkItem(tx, args.workspaceId, workItemId);
  }
  for (const rootId of [...new Set(pending.map((p) => p.rootProgressEntryId))].sort()) {
    await lockAllocationHead(tx, args.workspaceId, rootId);
  }

  let net = 0n; let tax = 0n; let gross = 0n;
  let valued = false;
  let reason: string | null = null;
  const ids: string[] = [];

  for (const entry of pending) {
    const outcome = await appendValuationAllocation(tx, {
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      contractId: args.contractId,
      workItemId: entry.workItemId,
      progressEntryId: entry.id,
      rootProgressEntryId: entry.rootProgressEntryId,
      deltaQuantity: entry.quantity,
      // What this loop has not written yet, so the carve can tell an
      // intermediate over-funding that a queued removal will undo from one that
      // nothing will. `pendingEntries` derives it; the loop only carries it.
      queuedRemovalQuantity: entry.queuedRemoval,
      admission: {
        closureId: args.stageClosureId,
        workAssignmentId: args.workAssignmentId,
      },
    });
    // A DEFERRED ENTRY WAS NOT ADMITTED, so it is not on the receipt and it does
    // not count. `appendValuationAllocation` wrote no row for it: the pool had
    // nothing left to sell it, and it keeps its claim for a later closure rather
    // than spending its one allocation slot on a carve of zero. Owner decision
    // of 2026-08-10 on the P1 at TODOS.md:238; the writer carries the reasoning.
    if (outcome.deferred === true) continue;

    ids.push(entry.id);
    if (outcome.valued) {
      valued = true;
      net += outcome.net ?? 0n;
      tax += outcome.tax ?? 0n;
      gross += outcome.gross ?? 0n;
    } else if (reason === null) {
      // The first unvalued reason wins and there can only be one: every entry
      // here belongs to one assignment and therefore to one work item, and the
      // reason is a property of the line rather than of the measurement.
      reason = outcome.reason;
    }
  }

  return {
    admittedProgressEntryCount: ids.length,
    admittedProgressEntryIds: ids,
    valued,
    netMinorUnits: valued ? net.toString() : null,
    taxMinorUnits: valued ? tax.toString() : null,
    grossMinorUnits: valued ? gross.toString() : null,
    unvaluedReason: valued ? null : reason,
  };
}
