import { randomUUID } from "node:crypto";
import type { Tx } from "@aktflow/database";
import {
  sliceAllocation, unvaluedReason, ZERO,
  type AllocationState, type PoolAmounts, type WorkItemValuation,
} from "@aktflow/domain";

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
}

/**
 * Serializes every money-moving command on one work item.
 *
 * An advisory lock rather than `select ... for update`: the app role holds only
 * select+insert on public.work_items (migration 0013), and advisory locks need
 * no table privilege at all. It releases with the transaction.
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

  if (reason === null) {
    // Every quantity sum EXCLUDES the entry being valued. The caller has
    // already inserted it — the row has to exist for the allocation's foreign
    // key — so counting it would fold this slice's own quantity into the "state
    // before" and shrink the remaining pool it is about to carve from. Excluding
    // it by id makes the writer independent of the caller's statement order.
    const totals = await tx.query(
      `select
         coalesce((select sum(p.quantity) from public.progress_entries p
                    where p.workspace_id = $1 and p.work_item_id = $2
                      and p.id <> $4), 0)::text
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
         coalesce((select sum(v.net_minor_units) from public.valuation_allocations v
                    where v.workspace_id = $1 and v.root_progress_entry_id = $3), 0)::text
           as root_net,
         coalesce((select sum(v.tax_minor_units) from public.valuation_allocations v
                    where v.workspace_id = $1 and v.root_progress_entry_id = $3), 0)::text
           as root_tax`,
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
      rootAllocated: { net: rootNet, tax: rootTax, gross: rootNet + rootTax },
    };
    slice = sliceAllocation(item, state, args.deltaQuantity);
  }

  await tx.query(
    `insert into public.valuation_allocations
       (id, workspace_id, project_id, contract_id, work_item_id, progress_entry_id,
        root_progress_entry_id, lineage_key, quantity,
        net_minor_units, tax_minor_units, gross_minor_units, unvalued_reason)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [randomUUID(), args.workspaceId, args.projectId, args.contractId, args.workItemId,
     args.progressEntryId, args.rootProgressEntryId,
     `progress:${args.progressEntryId}`, fromScaled6(args.deltaQuantity),
     reason === null ? slice.net.toString() : null,
     reason === null ? slice.tax.toString() : null,
     reason === null ? slice.gross.toString() : null,
     reason]);

  return reason === null
    ? { valued: true, net: slice.net, tax: slice.tax, gross: slice.gross, reason: null }
    : { valued: false, net: null, tax: null, gross: null, reason };
}
