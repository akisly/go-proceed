import { randomUUID } from "node:crypto";
import type { Tx } from "@goproceed/database";
import {
  sliceAllocation, unvaluedReason, ZERO,
  type AllocationState, type PoolAmounts, type WorkItemValuation,
} from "@goproceed/domain";

/** Scaled bigint (scale 6) from the string pg returns for numeric(20,6). */
export function toScaled6(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole = "0", frac = ""] = value.replace("-", "").split(".");
  const scaled = BigInt(whole + frac.padEnd(6, "0").slice(0, 6));
  return negative ? -scaled : scaled;
}

export function fromScaled6(value: bigint): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(7, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -6)}.${digits.slice(-6)}`;
}

export interface AllocationOutcome {
  valued: boolean;
  net: bigint | null;
  tax: bigint | null;
  gross: bigint | null;
  reason: string | null;
}

export interface ValuationWriterArgs {
  workspaceId: string;
  projectId: string;
  contractId: string;
  workItemId: string;
  progressEntryId: string;
  /** The root this entry belongs to: itself for a root, its parent for an adjustment. */
  rootProgressEntryId: string;
  /** The entry's own signed quantity, scale 6. */
  deltaQuantity: bigint;
  /**
   * ADR-008: the admission that carved this money, or absent for a
   * recording-time carve.
   *
   * The two columns migration 0046 §2 adds are PAIRED — «both null, or neither»
   * (`valuation_allocations_admission_pairing_check`) — so they arrive here as
   * one object rather than as two optional fields that could disagree. Their two
   * foreign keys meet on `workAssignmentId`: one into
   * `public.stage_closures (workspace_id, id, work_assignment_id)`, one into
   * `public.progress_entries (workspace_id, id, work_assignment_id)`, so «this
   * money was admitted by that closure, for work recorded under the very
   * assignment whose stage it closed» is a shape the database holds rather than
   * a promise this function makes.
   *
   * Passing it also decides which arm of the `va_insert` policy answers
   * (migration 0046 §3): with it, the write asks for `stage_closures.close`;
   * without it, for `progress.record`/`progress.adjust` per entry kind.
   */
  admission?: { closureId: string; workAssignmentId: string };
  /**
   * Quantity this same caller has QUEUED FOR REMOVAL from this entry's lineage
   * behind this entry, and has not written yet — a non-negative scaled bigint.
   * Omitted means zero, which is right for every caller that writes one row and
   * returns.
   *
   * Only `admitClosedStageQuantity` supplies it, because only it has a queue: it
   * admits a lineage as several rows in one transaction, and a root admitted at
   * its full quantity a statement before its own correction gives it back is the
   * intermediate state `app.assert_funded_within_lineage()` is deferred in order
   * to permit (migration 0048 §3). `sliceAllocation`'s lineage ceiling would
   * otherwise have to forbid that state to catch the one it is for, and the two
   * are indistinguishable from anything the database holds — a queued removal is
   * a fact about a transaction in flight. It is a separate top-level field
   * rather than a member of `admission` because it is not provenance and reaches
   * no column; nothing is stored from it.
   */
  queuedRemovalQuantity?: bigint;
}

/**
 * Serializes every money-moving command on one work item.
 *
 * An advisory lock rather than `select ... for update`: the app role holds only
 * select+insert on public.work_items (migration 0013), and advisory locks need
 * no table privilege at all. It releases with the transaction.
 *
 * The privilege argument survived migration 0042:382, which grants `update,
 * delete` on `public.work_items` — the M1 review flagged the stale reason
 * (finding 13) and the choice was still right. It is restated rather than
 * repeated: an advisory lock is the correct instrument here because it is taken
 * on an IDENTITY rather than on a row, so `admitStageQuantity` below can hold one
 * across several progress entries of the same line without locking each of them.
 */
export async function lockWorkItem(
  tx: Tx, workspaceId: string, workItemId: string,
): Promise<void> {
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`work_item|${workspaceId}|${workItemId}`]);
}

/**
 * Appends the one valuation allocation belonging to a progress fact.
 *
 * The caller must already hold the work-item lock, because every figure read
 * here is only stable under it.
 *
 * Two levels of state are read, not one. Money is carved at work-item level but
 * RETURNED at root level, so a correction that only knew the work-item totals
 * could hand back money a different root received.
 */
export async function appendValuationAllocation(
  tx: Tx, args: ValuationWriterArgs,
): Promise<AllocationOutcome> {
  const wi = await tx.query(
    `select contract_quantity::text as contract_quantity, tax_mode, unit_price_state,
            valuation_basis, net_amount_minor_units, tax_amount_minor_units,
            gross_amount_minor_units
       from public.work_items where workspace_id = $1 and id = $2`,
    [args.workspaceId, args.workItemId]);
  const r = wi.rows[0];
  if (!r) throw new Error(`valuation: work item ${args.workItemId} not visible`);

  const item: WorkItemValuation = {
    pool: {
      net: BigInt(r.net_amount_minor_units),
      tax: BigInt(r.tax_amount_minor_units),
      gross: BigInt(r.gross_amount_minor_units),
    },
    contractQuantity: toScaled6(r.contract_quantity),
    taxMode: r.tax_mode,
    unitPriceState: r.unit_price_state,
    valuationBasis: r.valuation_basis,
  };

  const reason = unvaluedReason(item);
  let slice: PoolAmounts = ZERO;
  // How much of this slice's quantity actually drew money. Differs from the
  // delta once the work item crosses its contract quantity, and a later
  // correction needs the difference or it returns money never received.
  let fundedQuantity = 0n;

  if (reason === null) {
    // Every quantity sum EXCLUDES the entry being valued. The caller has
    // already inserted it — the row has to exist for the allocation's foreign
    // key — so counting it would fold this slice's own quantity into the "state
    // before" and shrink the remaining pool it is about to carve from. Excluding
    // it by id makes the writer independent of the caller's statement order.
    //
    // ONLY ADMITTED QUANTITY COMPETES FOR THE POOL, and after ADR-008 that
    // sentence has to be in the SQL rather than in a comment.
    //
    // `work_item_performed` is the figure `sliceAllocation` turns into
    // `remainingQty = contractQuantity - workItemPerformed`, i.e. how much of the
    // line is still available to draw money.
    //
    // IT SUMS `funded_quantity`, AND UNTIL 2026-08-10 IT SUMMED THE MEASURED
    // QUANTITY OF ADMITTED ENTRIES. That is the P0 recorded at TODOS.md:585, and
    // it was settled by running the sequence rather than by reading it.
    //
    // The denominator's job is to make `unallocated / remaining` equal the
    // line's unit price, so that the n-th unit costs what the first one did.
    // That holds only while the money already carved corresponds to the
    // quantity the denominator subtracts — and the two figures came from
    // different sets. `work_item_allocated` sums MONEY, which follows
    // `funded_quantity`; `work_item_performed` summed the entries' own
    // `quantity`, which follows what was MEASURED. An over-removal parts them:
    // `record 4` → admit (funded 4, 40 % of the pool) → `+6` and `+5` wait →
    // `-8` returns all four funded units, so money reaches 0 while the summed
    // measured quantity reaches −4. The clamp in `sliceAllocation` then read it
    // as 0, the next admission carved 6 units out of the WHOLE pool at 6/10, the
    // unit after it drew 1/8 of the 40 % that was left, and seven units of a
    // ten-unit line settled holding 65 % instead of 70 %. Nothing raised: no
    // constraint compares funded quantity to money, and the line was simply
    // worth less than it should be.
    //
    // Summing `funded_quantity` makes the two figures the same rows of the same
    // table, so the unit price is constant by construction. In every ordinary
    // state the numbers are identical — an admitted entry funds its own quantity
    // — and they differ exactly where a unit was admitted and NOT funded: the
    // over-contract remainder, the lineage ceiling, and the parted case above.
    // For the first two the outcomes already agreed (both drive `remainingQty`
    // to zero); the third is the defect.
    //
    // Before ADR-008 every progress entry had an allocation the moment it
    // existed, so «all entries but this one», «all ADMITTED entries but this
    // one» and «what those entries were funded for» were one set, and this
    // figure is unchanged on every row written before that date.
    //
    // They stop being the same set the moment recording no longer carves. A
    // closure that admits several entries of one line must reproduce the state
    // each entry would have seen at recording time, or the FIRST entry it admits
    // sees the whole line as already performed, draws the entire remaining pool,
    // and every later entry of the same line draws nothing. The aggregate would
    // still reconcile and the LINEAGE would be corrupt — the exact failure
    // sliceAllocation's own header describes an earlier revision having, where
    // «each slice has to be meaningful on its own, not merely as a term in a
    // telescoping series».
    //
    // ADR-008 §"The P1 redistribution finding changes shape" states the rule in
    // these words: «only admitted quantity competes for the pool, and admission
    // is a deliberate authorised act rather than a side effect of measurement».
    //
    // A CORRECTION IS COUNTED HERE WITH THE SAME SIGN IT WAS RECORDED WITH, and
    // that is what makes «admitted quantity» the right denominator rather than
    // an approximation of one. `admitClosedStageQuantity` admits a lineage as
    // its ENTRIES — the root, then each correction, in one transaction — because
    // `valuation_allocations_progress_fact_fkey` (0025) pins an allocation's
    // quantity to its progress entry's and a single row carrying a lineage's
    // effective quantity is therefore unrepresentable. Summing the entries that
    // hold an allocation consequently sums the lineage's EFFECTIVE quantity, one
    // signed term at a time, which is exactly the figure this denominator wants.
    //
    // THE ROOT IS READ AS TWO QUANTITIES, AND UNTIL 2026-08-08 IT WAS READ AS
    // ONE. `root_quantity` counts every entry of the lineage;
    // `root_admitted_quantity` counts only the entries that hold an allocation.
    // It keeps the `exists` predicate that `work_item_performed` used to share,
    // and it is right to: this one measures how much of the LINEAGE has been put
    // to the pool, which is a question about admission, where the denominator
    // above asks what the money already carved has paid for.
    //
    // What this comment said before, and why it was right and incomplete: it
    // said `root_quantity` is DELIBERATELY NOT filtered, because it feeds the
    // negative branch's `unfunded = rootQuantity - rootFundedQuantity` and
    // «counting only admitted entries there would make an adjustment against
    // unadmitted quantity drive `newRootQty` below zero and throw, where the
    // correct answer is that it moves no money at all». That argument is about
    // the BELOW-ZERO GUARD, which is a question about measurement, and the guard
    // still reads the unfiltered figure — the reasoning is preserved, not
    // reversed. The second half of it — that the closure admits a correction
    // against a root allocated moments earlier in the same transaction, so the
    // unfunded remainder must include the over-contract part — also survives:
    // that root's own entry holds an allocation by then, so its measured
    // quantity IS its admitted quantity and the filtered figure returns exactly
    // the same number.
    //
    // What the old single figure got wrong is the case neither half covers: an
    // ADMITTED root carrying an UNADMITTED increase. `progress.adjust` writes no
    // allocation for a positive correction (ADR-008), so `root_quantity` counts
    // a quantity the pool has never been asked about, the next negative
    // correction consumes it as free headroom, and the closure that later admits
    // it funds it a second time — `app.assert_funded_within_lineage()`
    // (migration 0048 §3) then raises AT COMMIT and keeps raising, which turns an
    // over-payment into an assignment whose money can never be admitted at all.
    // `sliceAllocation`'s negative branch carries the sequence.
    const totals = await tx.query(
      `select
         coalesce((select sum(va.funded_quantity) from public.valuation_allocations va
                    where va.workspace_id = $1 and va.work_item_id = $2
                      and va.progress_entry_id <> $4), 0)::text
           as work_item_performed,
         coalesce((select sum(v.net_minor_units) from public.valuation_allocations v
                    where v.workspace_id = $1 and v.work_item_id = $2), 0)::text
           as work_item_net,
         coalesce((select sum(v.tax_minor_units) from public.valuation_allocations v
                    where v.workspace_id = $1 and v.work_item_id = $2), 0)::text
           as work_item_tax,
         coalesce((select sum(p.quantity) from public.progress_entries p
                    where p.workspace_id = $1
                      and (p.id = $3 or p.root_progress_entry_id = $3)
                      and p.id <> $4), 0)::text
           as root_quantity,
         coalesce((select sum(p.quantity) from public.progress_entries p
                    where p.workspace_id = $1
                      and (p.id = $3 or p.root_progress_entry_id = $3)
                      and p.id <> $4
                      and exists (select 1 from public.valuation_allocations va
                                   where va.workspace_id = p.workspace_id
                                     and va.progress_entry_id = p.id)), 0)::text
           as root_admitted_quantity,
         coalesce((select sum(v.net_minor_units) from public.valuation_allocations v
                    where v.workspace_id = $1 and v.root_progress_entry_id = $3), 0)::text
           as root_net,
         coalesce((select sum(v.tax_minor_units) from public.valuation_allocations v
                    where v.workspace_id = $1 and v.root_progress_entry_id = $3), 0)::text
           as root_tax,
         coalesce((select sum(v.funded_quantity) from public.valuation_allocations v
                    where v.workspace_id = $1 and v.root_progress_entry_id = $3), 0)::text
           as root_funded`,
      [args.workspaceId, args.workItemId, args.rootProgressEntryId, args.progressEntryId]);
    const t = totals.rows[0]!;

    const workItemNet = BigInt(t.work_item_net);
    const workItemTax = BigInt(t.work_item_tax);
    const rootNet = BigInt(t.root_net);
    const rootTax = BigInt(t.root_tax);

    const state: AllocationState = {
      workItemPerformed: toScaled6(t.work_item_performed),
      workItemAllocated: { net: workItemNet, tax: workItemTax, gross: workItemNet + workItemTax },
      rootQuantity: toScaled6(t.root_quantity),
      rootAdmittedQuantity: toScaled6(t.root_admitted_quantity),
      rootFundedQuantity: toScaled6(t.root_funded),
      // The one figure in this state that is NOT read from the rows, because it
      // is not in them: see the field's own comment on `ValuationWriterArgs`.
      // Defaulted here rather than made required on the args, so that the two
      // single-row callers keep saying nothing about a queue they do not have.
      queuedRemovalQuantity: args.queuedRemovalQuantity ?? 0n,
      rootAllocated: { net: rootNet, tax: rootTax, gross: rootNet + rootTax },
    };
    const result = sliceAllocation(item, state, args.deltaQuantity);
    slice = result.amounts;
    fundedQuantity = result.fundedQuantity;
  }

  await tx.query(
    `insert into public.valuation_allocations
       (id, workspace_id, project_id, contract_id, work_item_id, progress_entry_id,
        root_progress_entry_id, lineage_key, quantity, funded_quantity,
        net_minor_units, tax_minor_units, gross_minor_units, unvalued_reason,
        admitted_by_closure_id, admitted_work_assignment_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [randomUUID(), args.workspaceId, args.projectId, args.contractId, args.workItemId,
     args.progressEntryId, args.rootProgressEntryId,
     `progress:${args.progressEntryId}`, fromScaled6(args.deltaQuantity),
     fromScaled6(fundedQuantity),
     reason === null ? slice.net.toString() : null,
     reason === null ? slice.tax.toString() : null,
     reason === null ? slice.gross.toString() : null,
     reason,
     args.admission?.closureId ?? null,
     args.admission?.workAssignmentId ?? null]);

  return reason === null
    ? { valued: true, net: slice.net, tax: slice.tax, gross: slice.gross, reason: null }
    : { valued: false, net: null, tax: null, gross: null, reason };
}

/**
 * Serializes adjustment and (from M4) allocation on one root's balance head.
 *
 * Callers take this AFTER lockWorkItem, always in that order. The work-item lock
 * alone would be sufficient today — it is strictly coarser, covering every root
 * of the item — but M4's claim allocation serializes per root, and two commands
 * reaching for different advisory keys is how a serialization guarantee quietly
 * stops holding.
 */
export async function lockAllocationHead(
  tx: Tx, workspaceId: string, rootProgressEntryId: string,
): Promise<void> {
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`allocation_head|${workspaceId}|${rootProgressEntryId}`]);
}
