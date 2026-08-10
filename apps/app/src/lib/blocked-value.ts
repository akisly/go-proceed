import type { Tx } from "@goproceed/database";
import {
  BLOCKED_VALUE_ALGORITHM_VERSION, BLOCKED_REASON_CODE_VOCABULARY_VERSION,
  PRIMARY_CAUSE_PRECEDENCE,
  type BlockedReason, type BlockedReasonCodeValue, type BlockedValueCauseRow,
  type BlockedValueResponse, type PerformedNotAdmittedLine, type PerformedNotAdmittedView,
} from "@goproceed/contracts";
import {
  sliceAllocation, unvaluedReason, ZERO,
  type PoolAmounts, type WorkItemValuation,
} from "@goproceed/domain";
import type { AssignmentValuation } from "./readiness";
import { toScaled6, fromScaled6 } from "./valuation-writer";

/**
 * The blocked money, and the quantity waiting to become money (v0.1-M6).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTHING HERE WAS EXECUTED. No test run, no route invoked, no query sent to a
 * database. Static reading of migrations 0012, 0015, 0025, 0043, 0045 and 0046
 * against the column names used below is the only check performed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS MODULE ADDS UP. IT DOES NOT DECIDE ANYTHING.
 *
 * Every judgement about what is blocked, what a block is called, and what money
 * hangs off it was already taken in `readiness.ts` and is not retaken here:
 *
 *   * WHICH occurrences are unsatisfied — `evaluateStages`, the one place
 *     `can_close_stage` is written, which `stage_closures.create` refuses on;
 *   * WHICH of them are LIVE — `liveBlockedReasons`, which drops closed stages;
 *   * WHAT each block is called — `codeFor`, two of the seven codes;
 *   * HOW MUCH money a block carries — `attributeValue`, `planned_share` or
 *     `whole_line`, labelled per row.
 *
 * What is new here is arithmetic over those objects, and exactly two decisions:
 * the primary-cause precedence (transcribed from value-at-risk.md, see
 * `packages/contracts/src/blocked-value.ts`) and the definition of
 * `performed_not_admitted` (ADR-008, named here for the first time).
 *
 * A CONSEQUENCE WORTH STATING: because the sum is built from
 * `liveBlockedReasons`, `blocked_reasons.get` and `blocked_value.get` cannot
 * disagree about which blocks exist. They can only disagree about arithmetic,
 * and the response schema's `superRefine` refuses a response whose arithmetic
 * does not close.
 */

type Money = { net: bigint; tax: bigint; gross: bigint };
const NO_MONEY: Money = { net: 0n, tax: 0n, gross: 0n };

interface AssignmentBucket {
  workAssignmentId: string;
  currency: string | null;
  money: Money | null;
  wholeLine: boolean;
  unvalued: boolean;
  /** Every distinct code currently blocking this assignment. */
  codes: Set<BlockedReasonCodeValue>;
  /** Occurrence ids per code, for the drill-down. */
  occurrencesByCode: Map<BlockedReasonCodeValue, string[]>;
}

/**
 * INV-070's deduplication key, and it is the ASSIGNMENT and nothing else.
 *
 * «Blocked value is attributed once per work assignment; several unmet
 * occurrences on one work reference the same assignment-scoped value and are
 * deduplicated by assignment when summed.» Three missing requirements on one
 * work therefore produce three drill-down rows and ONE amount, in every view on
 * this screen.
 *
 * The FIRST reason seen for an assignment supplies the money. Every reason of
 * one assignment carries the same figure by construction — `attributeValue`
 * reads the assignment's own valuation, not the occurrence's — so «first» is a
 * choice among identical values and not a tie-break that could matter.
 */
function bucketByAssignment(reasons: BlockedReason[]): Map<string, AssignmentBucket> {
  const out = new Map<string, AssignmentBucket>();
  for (const r of reasons) {
    let b = out.get(r.workAssignmentId);
    if (!b) {
      b = {
        workAssignmentId: r.workAssignmentId,
        currency: r.blockedValue?.currency ?? null,
        money: r.blockedValue === null ? null : {
          net: BigInt(r.blockedValue.netMinorUnits),
          tax: BigInt(r.blockedValue.taxMinorUnits),
          gross: BigInt(r.blockedValue.grossMinorUnits),
        },
        wholeLine: r.valueAttribution === "whole_line",
        unvalued: r.blockedValue === null,
        codes: new Set(),
        occurrencesByCode: new Map(),
      };
      out.set(r.workAssignmentId, b);
    }
    b.codes.add(r.code);
    const ids = b.occurrencesByCode.get(r.code);
    if (ids) ids.push(r.requirementOccurrenceId);
    else b.occurrencesByCode.set(r.code, [r.requirementOccurrenceId]);
  }
  return out;
}

/**
 * The one cause an assignment's money is attributed to.
 *
 * First match in `PRIMARY_CAUSE_PRECEDENCE`. A code with no position in that
 * array cannot be attributed — value-at-risk.md calls that «an unattributable
 * code silently breaks the additive partition» — so it THROWS rather than
 * falling back to «the first code we happened to see». The vocabulary is closed
 * and CHECK-enforced on `public.blocked_reasons`, so reaching this is a defect
 * in the mapper above and not a data condition.
 */
function primaryCause(codes: Set<BlockedReasonCodeValue>): BlockedReasonCodeValue {
  for (const candidate of PRIMARY_CAUSE_PRECEDENCE) {
    if (codes.has(candidate)) return candidate;
  }
  throw new Error(
    "blocked_value: no code of " + [...codes].join(",") + " has a position in the "
    + "primary-cause precedence; an unattributable code breaks the additive partition "
    + "(value-at-risk.md §Two views, one of which is additive)");
}

interface CauseAccumulator {
  occurrenceIds: Set<string>;
  assignments: Set<string>;
  unvaluedAssignments: Set<string>;
  totals: Map<string, { m: Money; assignments: number; wholeLine: number }>;
}

function emptyCause(): CauseAccumulator {
  return {
    occurrenceIds: new Set(), assignments: new Set(),
    unvaluedAssignments: new Set(), totals: new Map(),
  };
}

function addMoney(acc: CauseAccumulator, b: AssignmentBucket): void {
  if (b.money === null || b.currency === null) {
    acc.unvaluedAssignments.add(b.workAssignmentId);
    return;
  }
  acc.assignments.add(b.workAssignmentId);
  const t = acc.totals.get(b.currency) ?? { m: { ...NO_MONEY }, assignments: 0, wholeLine: 0 };
  t.m = { net: t.m.net + b.money.net, tax: t.m.tax + b.money.tax, gross: t.m.gross + b.money.gross };
  t.assignments += 1;
  if (b.wholeLine) t.wholeLine += 1;
  acc.totals.set(b.currency, t);
}

function causeRows(acc: Map<BlockedReasonCodeValue, CauseAccumulator>): BlockedValueCauseRow[] {
  return [...acc.entries()]
    // Precedence order, not alphabetical: the row a reader must not miss is the
    // one the precedence puts first, and an alphabetical table buries it.
    .sort((a, b) => PRIMARY_CAUSE_PRECEDENCE.indexOf(a[0]) - PRIMARY_CAUSE_PRECEDENCE.indexOf(b[0]))
    .map(([code, c]) => ({
      code,
      occurrenceCount: c.occurrenceIds.size,
      assignmentCount: c.assignments.size,
      unvaluedAssignmentCount: c.unvaluedAssignments.size,
      totalsByCurrency: [...c.totals.entries()]
        .sort((x, y) => (x[0] < y[0] ? -1 : 1))
        .map(([currency, t]) => ({
          currency,
          netMinorUnits: t.m.net.toString(),
          taxMinorUnits: t.m.tax.toString(),
          grossMinorUnits: t.m.gross.toString(),
          assignmentCount: t.assignments,
          wholeLineAttributionCount: t.wholeLine,
        })),
      requirementOccurrenceIds: [...c.occurrenceIds].sort(),
    }));
}

/**
 * The performed, priced, unadmitted quantity of one project — ADR-008's bucket.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT «UNADMITTED» IS, AS A QUERY
 *
 * A progress entry is admitted exactly when it carries a `valuation_allocations`
 * row. That is not a proxy for admission — after ADR-008 it IS admission:
 * `progress.record` writes no allocation at all, `progress.adjust` writes one
 * only against an already-admitted root, and `admitClosedStageQuantity` is the
 * only other writer. The same `not exists` predicate, with the sign flipped, is
 * what `appendValuationAllocation` uses for `work_item_performed`, and the two
 * are deliberately the same shape: this screen's «waiting» and the allocator's
 * «already competing for the pool» must partition the line's entries exactly.
 *
 * THE QUANTITY IS THE LINEAGE'S EFFECTIVE ONE, because the sum is over entries
 * and a correction is an entry with a negative quantity. A root recorded at 10
 * and corrected by −4, neither admitted, contributes 6. The corrections cannot
 * be separated from their roots here — after the M3 review's fix, a correction
 * against an unadmitted root writes no allocation, so root and correction are
 * unadmitted together — which is what makes summing entries the right answer
 * rather than an approximation of one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE MONEY IS COMPUTED BY `sliceAllocation`, WHICH IS NOT A CONVENIENCE
 *
 * The figure this screen shows is «what admission would carve for this quantity
 * if it happened now», and the only way to make that sentence true rather than
 * approximately true is to call the function admission calls, against the state
 * admission would read: `workItemPerformed` = the line's already-admitted
 * quantity, `workItemAllocated` = the minor units already taken out of its pool.
 * A second formula that «does the same proportional thing» would drift the first
 * time either the coupling rules or the largest-remainder tie-break changed, and
 * the drift would be invisible because both sides would still look reasonable.
 *
 * The root-level fields are zero and unused: only the POSITIVE branch of
 * `sliceAllocation` is reachable here, and it reads neither. `quantity <= 0`
 * lines are skipped before the call, so the negative branch — which asserts
 * against a root's own funded history — is never entered with a fabricated root.
 *
 * OVER-CONTRACT IS THE SHORTFALL, NOT A SECOND CALCULATION. `sliceAllocation`
 * returns `fundedQuantity`, the part of the delta inside the remaining contract
 * quantity; the rest performed and drew nothing (INV-039). Deriving it from the
 * allocator's own answer means the two can never disagree about where the
 * contract boundary is.
 *
 * UNVALUED LINES ARE REPORTED WITH A QUANTITY AND NO MONEY (INV-038), and
 * `sliceAllocation` is not called at all — it throws on an unvalued item by
 * design, and catching that would turn a designed refusal into a shrug.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE `not exists` RUNS UNDER RLS, AND THAT IS THE ONE PLACE THIS QUERY COULD
 * LIE. A `not exists` over a table whose rows RLS can hide answers TRUE for a
 * row that is merely invisible — the FAILS-OPEN shape migration 0045's header
 * names as the reason INV-069 is not a trigger. Here an admitted entry would be
 * counted as waiting and its money reported twice: once as allocated and once as
 * about to be.
 *
 * IT CANNOT HAPPEN, AND THE REASON IS THAT THE TWO POLICIES ARE THE SAME
 * PREDICATE OVER THE SAME VALUE. `pe_select` and `va_select` (migration
 * 0016:126-146) are both
 * `app.has_project_capability(workspace_id, project_id, {project.view,
 * project.admin})`, and `valuation_allocations_progress_fact_fkey` (0025) pins
 * an allocation's `(workspace_id, project_id, work_item_id, progress_entry_id,
 * quantity)` onto its entry — so an allocation's `project_id` IS its entry's. A
 * reader who can see the entry can see its allocation; there is no visibility
 * state in which the outer row appears and the inner one does not. **This is a
 * reasoned property of two policies and a foreign key, and it has not been
 * executed** — it is named in the progress document as unverifiable by reading.
 * If a later migration narrows `va_select` without narrowing `pe_select`, this
 * query starts over-reporting silently, which is why the argument is written
 * here rather than assumed.
 */
const NOT_ADMITTED_SQL = `
  select w.id as work_item_id, w.contract_id, w.unit_code, w.currency,
         w.contract_quantity::text as contract_quantity,
         w.tax_mode, w.unit_price_state, w.valuation_basis,
         w.net_amount_minor_units::text as pool_net,
         w.tax_amount_minor_units::text as pool_tax,
         w.gross_amount_minor_units::text as pool_gross,
         coalesce((select sum(p.quantity) from public.progress_entries p
                    where p.workspace_id = w.workspace_id and p.work_item_id = w.id
                      and p.project_id = $2
                      and exists (select 1 from public.valuation_allocations va
                                   where va.workspace_id = p.workspace_id
                                     and va.progress_entry_id = p.id)), 0)::text
           as admitted_quantity,
         coalesce((select sum(p.quantity) from public.progress_entries p
                    where p.workspace_id = w.workspace_id and p.work_item_id = w.id
                      and p.project_id = $2
                      and not exists (select 1 from public.valuation_allocations va
                                       where va.workspace_id = p.workspace_id
                                         and va.progress_entry_id = p.id)), 0)::text
           as not_admitted_quantity,
         coalesce((select sum(v.net_minor_units) from public.valuation_allocations v
                    where v.workspace_id = w.workspace_id and v.work_item_id = w.id), 0)::text
           as allocated_net,
         coalesce((select sum(v.tax_minor_units) from public.valuation_allocations v
                    where v.workspace_id = w.workspace_id and v.work_item_id = w.id), 0)::text
           as allocated_tax,
         (select coalesce(array_agg(distinct p.work_assignment_id), '{}'::uuid[])
            from public.progress_entries p
           where p.workspace_id = w.workspace_id and p.work_item_id = w.id
             and p.project_id = $2
             and not exists (select 1 from public.valuation_allocations va
                              where va.workspace_id = p.workspace_id
                                and va.progress_entry_id = p.id)) as pending_assignments
    from public.work_items w
   where w.workspace_id = $1
     and w.project_id = $2
     and exists (select 1 from public.progress_entries p
                  where p.workspace_id = w.workspace_id and p.work_item_id = w.id
                    and p.project_id = $2)
   order by w.contract_version_id, w.position, w.id`;

export interface OverContractLine {
  workItemId: string;
  contractId: string;
  unitCode: string;
  contractQuantity: string;
  performedQuantity: string;
  overContractQuantity: string;
  disposition: "unapproved_unvalued_exposure";
}

export interface NotAdmittedResult {
  view: PerformedNotAdmittedView;
  overContract: OverContractLine[];
}

export async function performedNotAdmitted(
  tx: Tx, workspaceId: string, projectId: string,
): Promise<NotAdmittedResult> {
  const rows = await tx.query(NOT_ADMITTED_SQL, [workspaceId, projectId]);

  const lines: PerformedNotAdmittedLine[] = [];
  const overContract: OverContractLine[] = [];
  const totals = new Map<string, { m: Money; lineCount: number }>();
  let unvaluedLineCount = 0;
  let overContractLineCount = 0;

  for (const r of rows.rows as Record<string, unknown>[]) {
    const item: WorkItemValuation = {
      pool: {
        net: BigInt(r.pool_net as string), tax: BigInt(r.pool_tax as string),
        gross: BigInt(r.pool_gross as string),
      },
      contractQuantity: toScaled6(r.contract_quantity as string),
      taxMode: r.tax_mode as WorkItemValuation["taxMode"],
      unitPriceState: r.unit_price_state as WorkItemValuation["unitPriceState"],
      valuationBasis: r.valuation_basis as WorkItemValuation["valuationBasis"],
    };
    const admitted = toScaled6(r.admitted_quantity as string);
    const waiting = toScaled6(r.not_admitted_quantity as string);
    const performed = admitted + waiting;

    // INV-039's register covers the LINE, admitted quantity included: «is this
    // line over-performed at all» is a question about the contract boundary and
    // not about the gate, so it is answered here even for a line with nothing
    // waiting.
    if (performed > item.contractQuantity) {
      overContract.push({
        workItemId: r.work_item_id as string,
        contractId: r.contract_id as string,
        unitCode: r.unit_code as string,
        contractQuantity: fromScaled6(item.contractQuantity),
        performedQuantity: fromScaled6(performed),
        overContractQuantity: fromScaled6(performed - item.contractQuantity),
        disposition: "unapproved_unvalued_exposure",
      });
    }

    // A line with nothing waiting has no row in this bucket. Zero is not a state
    // worth a line, and a table of zeroes is how the rows that matter get lost.
    //
    // A NEGATIVE total is not silently dropped: it would mean a lineage whose
    // corrections outweigh its root while none of it is admitted, which
    // `progress.adjust` refuses at 422 («ефективна кількість відʼємна»). If it
    // ever appears, the query above found a state no command can produce and the
    // right response is to say so, not to render `-3.000000` as money waiting.
    if (waiting < 0n) {
      throw new Error(
        `blocked_value: work item ${r.work_item_id as string} carries a NEGATIVE `
        + `unadmitted quantity (${fromScaled6(waiting)}). No v0.1 command can produce `
        + "that: progress.adjust refuses an effective quantity below zero, and a "
        + "correction against an unadmitted root writes no allocation, so root and "
        + "correction are unadmitted together.");
    }
    if (waiting === 0n) continue;

    const reason = unvaluedReason(item);
    const assignments = ((r.pending_assignments as string[] | null) ?? []).slice().sort();
    if (assignments.length === 0) {
      // Unreachable while `progress_entries.work_assignment_id` is NOT NULL, and
      // asserted rather than assumed: `workAssignmentIds` is the drill-down and
      // `.min(1)` on the wire would turn this into an opaque 500 at the boundary.
      throw new Error(
        `blocked_value: work item ${r.work_item_id as string} has unadmitted quantity `
        + "and no assignment behind it; the bucket would have no drill-down target");
    }

    if (reason !== null) {
      unvaluedLineCount += 1;
      lines.push({
        workItemId: r.work_item_id as string,
        contractId: r.contract_id as string,
        unitCode: r.unit_code as string,
        quantity: fromScaled6(waiting),
        // Unknowable price means unknowable contract boundary in money terms;
        // the quantity boundary is still known, so it is still reported.
        fundedQuantity: fromScaled6(
          waiting > item.contractQuantity - admitted
            ? (item.contractQuantity - admitted > 0n ? item.contractQuantity - admitted : 0n)
            : waiting),
        overContractQuantity: fromScaled6(
          performed > item.contractQuantity
            ? (waiting < performed - item.contractQuantity
                ? waiting : performed - item.contractQuantity)
            : 0n),
        value: null,
        unvaluedReason: reason,
        workAssignmentIds: assignments,
      });
      continue;
    }

    const allocatedNet = BigInt(r.allocated_net as string);
    const allocatedTax = BigInt(r.allocated_tax as string);
    const allocated: PoolAmounts = {
      net: allocatedNet, tax: allocatedTax, gross: allocatedNet + allocatedTax,
    };
    const slice = sliceAllocation(item, {
      workItemPerformed: admitted,
      workItemAllocated: allocated,
      // Zero rather than fabricated: see the module header. A non-zero value
      // here would be a claim about a root this aggregate does not have.
      // `rootAdmittedQuantity` joined them on 2026-08-08, when the negative
      // branch stopped measuring its unfunded remainder against every entry of a
      // lineage and started measuring it against the admitted ones; this read is
      // aggregate and positive-only, so the third zero says exactly what the
      // other two say.
      //
      // «UNREAD BY THE POSITIVE BRANCH» IS NO LONGER TRUE OF ALL OF THEM, and
      // the wording above said it was until 2026-08-08 (later the same day). The
      // positive branch now bounds a slice by its lineage's ceiling,
      // `rootQuantity + delta + queuedRemovalQuantity - rootFundedQuantity`. With
      // these four zeros that ceiling is exactly `waiting`, i.e. the delta being
      // asked about, so it can never bind and this projection is arithmetically
      // unchanged. That is a property of the zeros rather than luck: an aggregate
      // with no root is a lineage of one entry, and no entry is ever bounded by
      // itself.
      rootQuantity: 0n, rootAdmittedQuantity: 0n, rootFundedQuantity: 0n,
      queuedRemovalQuantity: 0n,
      rootAllocated: ZERO,
    }, waiting);

    const over = waiting - slice.fundedQuantity;
    if (over > 0n) overContractLineCount += 1;

    lines.push({
      workItemId: r.work_item_id as string,
      contractId: r.contract_id as string,
      unitCode: r.unit_code as string,
      quantity: fromScaled6(waiting),
      fundedQuantity: fromScaled6(slice.fundedQuantity),
      overContractQuantity: fromScaled6(over),
      value: {
        currency: r.currency as string,
        netMinorUnits: slice.amounts.net.toString(),
        taxMinorUnits: slice.amounts.tax.toString(),
        grossMinorUnits: slice.amounts.gross.toString(),
      },
      unvaluedReason: null,
      workAssignmentIds: assignments,
    });

    const currency = r.currency as string;
    const t = totals.get(currency) ?? { m: { ...NO_MONEY }, lineCount: 0 };
    t.m = {
      net: t.m.net + slice.amounts.net,
      tax: t.m.tax + slice.amounts.tax,
      gross: t.m.gross + slice.amounts.gross,
    };
    t.lineCount += 1;
    totals.set(currency, t);
  }

  return {
    view: {
      bucket: "performed_not_admitted",
      isSummandOfBlockedValue: false,
      lines,
      totalsByCurrency: [...totals.entries()]
        .sort((x, y) => (x[0] < y[0] ? -1 : 1))
        .map(([currency, t]) => ({
          currency,
          netMinorUnits: t.m.net.toString(),
          taxMinorUnits: t.m.tax.toString(),
          grossMinorUnits: t.m.gross.toString(),
          lineCount: t.lineCount,
        })),
      unvaluedLineCount,
      overContractLineCount,
    },
    overContract,
  };
}

/**
 * THE WHOLE ANSWER, from the reason objects and the valuations M3 already built.
 *
 * Pure: it performs no query and takes no `Tx`. Everything it needs has already
 * been read, which is what lets `blocked-value.test.ts` exercise the partition,
 * the precedence and the reconciliation without a database — and those are the
 * three things most likely to be wrong.
 */
export function summariseBlockedValue(args: {
  projectId: string;
  calculatedAt: string;
  reasons: BlockedReason[];
  valuations: Map<string, AssignmentValuation>;
  notAdmitted: NotAdmittedResult;
}): BlockedValueResponse {
  const buckets = bucketByAssignment(args.reasons);

  const additive = new Map<BlockedReasonCodeValue, CauseAccumulator>();
  const affected = new Map<BlockedReasonCodeValue, CauseAccumulator>();
  const totals = new Map<string, { m: Money; assignments: number; wholeLine: number }>();
  const baselines = new Map<string, {
    contractId: string; contractVersionId: string; contractVersionNo: number;
    totals: Map<string, { m: Money; assignments: number; wholeLine: number }>;
    unvalued: Set<string>;
  }>();
  const unvaluedAssignments = new Set<string>();
  const unvaluedRegister = new Map<string, {
    reason: "missing_unit_price" | "unknown_tax_basis";
    unitCode: string; assignments: Set<string>; quantity: bigint;
  }>();
  let zeroPricedAssignmentCount = 0;

  for (const b of buckets.values()) {
    const primary = primaryCause(b.codes);

    // ADDITIVE, AND IT IS ADDITIVE TWICE OVER, WHICH IS THE WHOLE DESIGN:
    //
    //   * OCCURRENCES are partitioned by their OWN code. Every occurrence has
    //     exactly one, so summing `occurrenceCount` across rows reproduces the
    //     total number of live blocks.
    //   * MONEY is partitioned by PRIMARY cause. Every assignment has exactly
    //     one, so summing the currency rows reproduces the total.
    //
    // A cause therefore KEEPS ITS ROW when its money went elsewhere, holding
    // `assignmentCount: 0`, no currency row and its occurrences. Dropping it
    // would delete the only route from «this obligation is unmet» to the screen
    // — the drill-down contract's own failure mode — and a reader looking for
    // «what is waiting on the технагляд» would find nothing while two
    // obligations waited.
    for (const code of b.codes) {
      const a = additive.get(code) ?? emptyCause();
      for (const id of b.occurrencesByCode.get(code) ?? []) a.occurrenceIds.add(id);
      if (code === primary) addMoney(a, b);
      additive.set(code, a);
    }

    // NON-ADDITIVE: once per distinct code, never once per occurrence. «How much
    // money does the missing test report touch» is the question a call to the
    // laboratory is actually about, and it is not answerable from the partition
    // — under the partition that money is filed under whichever cause outranked
    // it.
    for (const code of b.codes) {
      const n = affected.get(code) ?? emptyCause();
      for (const id of b.occurrencesByCode.get(code) ?? []) n.occurrenceIds.add(id);
      addMoney(n, b);
      affected.set(code, n);
    }

    const v = args.valuations.get(b.workAssignmentId);
    if (b.money === null || b.currency === null) {
      unvaluedAssignments.add(b.workAssignmentId);
      if (v && v.unvalued !== null) {
        const key = `${v.unvalued}|${v.unitCode}`;
        const row = unvaluedRegister.get(key)
          ?? { reason: v.unvalued, unitCode: v.unitCode, assignments: new Set<string>(), quantity: 0n };
        if (!row.assignments.has(b.workAssignmentId)) {
          row.assignments.add(b.workAssignmentId);
          // The size of what waits, as a quantity: the assignment's own planned
          // slice when it declares one, the whole line when it does not — the
          // same choice `attributeValue` makes about money, so the two registers
          // describe the same scope.
          row.quantity += v.plannedQuantity ?? v.contractQuantity;
        }
        unvaluedRegister.set(key, row);
      }
    } else {
      if (v?.unitPriceState === "zero") zeroPricedAssignmentCount += 1;
      const t = totals.get(b.currency)
        ?? { m: { ...NO_MONEY }, assignments: 0, wholeLine: 0 };
      t.m = {
        net: t.m.net + b.money.net, tax: t.m.tax + b.money.tax, gross: t.m.gross + b.money.gross,
      };
      t.assignments += 1;
      if (b.wholeLine) t.wholeLine += 1;
      totals.set(b.currency, t);
    }

    if (v) {
      const key = v.contractVersionId;
      const bl = baselines.get(key) ?? {
        contractId: v.contractId, contractVersionId: v.contractVersionId,
        contractVersionNo: v.contractVersionNo,
        totals: new Map<string, { m: Money; assignments: number; wholeLine: number }>(),
        unvalued: new Set<string>(),
      };
      if (b.money === null || b.currency === null) {
        bl.unvalued.add(b.workAssignmentId);
      } else {
        const t = bl.totals.get(b.currency)
          ?? { m: { ...NO_MONEY }, assignments: 0, wholeLine: 0 };
        t.m = {
          net: t.m.net + b.money.net, tax: t.m.tax + b.money.tax, gross: t.m.gross + b.money.gross,
        };
        t.assignments += 1;
        if (b.wholeLine) t.wholeLine += 1;
        bl.totals.set(b.currency, t);
      }
      baselines.set(key, bl);
    }
  }

  const renderTotals = (m: Map<string, { m: Money; assignments: number; wholeLine: number }>) =>
    [...m.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([currency, t]) => ({
      currency,
      netMinorUnits: t.m.net.toString(),
      taxMinorUnits: t.m.tax.toString(),
      grossMinorUnits: t.m.gross.toString(),
      assignmentCount: t.assignments,
      wholeLineAttributionCount: t.wholeLine,
    }));

  return {
    projectId: args.projectId,
    source: "computed",
    algorithmVersion: BLOCKED_VALUE_ALGORITHM_VERSION,
    codeVocabularyVersion: BLOCKED_REASON_CODE_VOCABULARY_VERSION,
    primaryCausePrecedence: [...PRIMARY_CAUSE_PRECEDENCE],
    calculatedAt: args.calculatedAt,
    totalsByCurrency: renderTotals(totals),
    byCause: causeRows(additive),
    byCauseIsAdditive: true,
    affectedByCause: causeRows(affected),
    affectedByCauseIsAdditive: false,
    byBaseline: [...baselines.values()]
      .sort((x, y) => (x.contractVersionId < y.contractVersionId ? -1 : 1))
      .map((bl) => ({
        contractId: bl.contractId,
        contractVersionId: bl.contractVersionId,
        contractVersionNo: bl.contractVersionNo,
        totalsByCurrency: renderTotals(bl.totals),
        unvaluedAssignmentCount: bl.unvalued.size,
      })),
    blockedReasons: args.reasons,
    unvaluedRegister: [...unvaluedRegister.values()]
      .sort((x, y) => (`${x.reason}|${x.unitCode}` < `${y.reason}|${y.unitCode}` ? -1 : 1))
      .map((row) => ({
        reason: row.reason,
        unitCode: row.unitCode,
        assignmentCount: row.assignments.size,
        quantity: fromScaled6(row.quantity),
      })),
    unvaluedAssignmentCount: unvaluedAssignments.size,
    zeroPricedAssignmentCount,
    overContract: args.notAdmitted.overContract,
    performedNotAdmitted: args.notAdmitted.view,
  };
}
