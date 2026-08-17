import { z } from "zod";
import { blockedReason, blockedReasonCode, blockedValue, blockedValueTotal } from "./readiness";

/**
 * The blocked money (v0.1-M6).
 *
 * ONE operation (technical/openapi/scope-v0.1.csv:59), governed by
 * `readiness.view` (capabilities.csv:31, which names `blocked_value.get` in
 * terms):
 *
 *   `blocked_value.get`   GET /v1/projects/{projectId}/blocked-value
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS, AND — LOUDER — WHAT IT IS NOT
 *
 * It is step 6 of the pilot: «the owner opens one screen and sees what is
 * blocked and how much money sits behind it, broken down by cause»
 * (version-0.1.md §v0.1-M6). A sum over the lines ПТВ typed by hand in step 1,
 * per currency, attributed once per assignment, drillable to the specific
 * missing requirement.
 *
 * IT IS NOT THE SEVEN-STATE VALUE-AT-RISK PROJECTION. ADR-006 decision 5 moves
 * that to v0.2 with its exposure slices, its claim segments, its allocation
 * ledger and its `evidence_blocked` precedence, because five of its seven states
 * name packaging, submission or internal review and none of those exists in
 * v0.1. `value_at_risk.get` and `acceptance.get` are v0.2 operations and are in
 * no row of `scope-v0.1.csv`. Nothing in this module is a workflow state, and
 * `INV-071` — the precedence invariant — has no v0.1 form at all.
 *
 * BLOCKED VALUE IS EXPOSURE, NEVER A RECEIVABLE. v0.1 creates no accounting
 * entry, no payment obligation and no cross-currency total, so ADR-001's
 * financial boundary is untouched. Every figure below is minor units of one
 * named currency and there is no field anywhere in this file that adds two
 * currencies together.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPUTED, NOT READ — the same statement `readiness.get` and
 * `blocked_reasons.get` make. `public.blocked_reasons` is built by migration
 * 0045 §7, its write grant belongs to `goproceed_service` alone, and NOTHING
 * WRITES IT: there is no projection rebuilder in this repository. A route that
 * read it would answer `0` in every real workspace while passing any fixture
 * that inserted rows by hand. `source: "computed"` says so on the wire.
 *
 * The `blockedReasons` array below is produced by `blockedReasonFor` — the same
 * builder `blocked_reasons.get` renders and `stage_closures.create` REFUSES
 * with. Three surfaces, one implementation, and therefore nothing to drift from.
 */

/**
 * Bumped when the PARTITION's meaning changes: the precedence, the
 * deduplication key, the not-admitted bucket's definition, or which assignments
 * are in scope. Distinct from `READINESS_ALGORITHM_VERSION`, which versions the
 * `can_close_stage` predicate: this operation can change how it adds up money
 * without the predicate moving, and the reverse is also true.
 */
export const BLOCKED_VALUE_ALGORITHM_VERSION = "blocked_value.v0.1/2026-08-07";

/**
 * PRIMARY-CAUSE PRECEDENCE, first match wins.
 *
 * TRANSCRIBED FROM `docs/domain/value-at-risk.md` §"Two views, one of which is
 * additive", NOT INVENTED HERE, and the difference matters: that document sits
 * at precedence level 2 (docs/README.md §"Source of truth"), above the ADRs, and
 * it fixes this order in a fenced block. It also says in terms that ADR-005 does
 * NOT fix the order — «the precedence above is this document's choice» — and
 * that it may be changed without a superseding ADR provided both views keep
 * their reconciliation rules and `CLOSED_WITHOUT_ACT` stays first.
 *
 * WHY A v0.1 OPERATION NEEDS IT AT ALL. The same document calls the
 * additive/non-additive pair and this precedence «v0.2 machinery», because v0.2
 * partitions exposure slices and v0.1 has none. But the problem the precedence
 * solves is not a v0.2 problem: one work assignment can carry two unmet
 * obligations whose codes differ — a returned decision on one occurrence and an
 * undecided one on another — and ADR-005 decision 6 says its money is attributed
 * ONCE. Under which code is then a question the sum cannot avoid, and the two
 * available answers are to transcribe an approved order or to invent one. This
 * transcribes.
 *
 * FIVE OF THE SEVEN CODES HAVE NO v0.1 PRODUCER, and the array carries all seven
 * anyway: a closed vocabulary that changes shape between versions is not closed
 * (packages/contracts/src/readiness.ts), and a code with no position in the
 * precedence cannot be attributed at all. `V01_PRODUCIBLE_BLOCKED_REASON_CODES`
 * names the two a v0.1 record can actually carry.
 */
export const PRIMARY_CAUSE_PRECEDENCE = [
  "CLOSED_WITHOUT_ACT",
  "CUSTOMER_MOTIVATED_REFUSAL",
  "SUPERVISION_SIGNATURE_MISSING",
  "ACT_NOT_SIGNED",
  "TEST_REPORT_MISSING",
  "MATERIAL_CERTIFICATE_MISSING",
  "NOTICE_PERIOD_NOT_ELAPSED",
] as const;

/**
 * One cause row, in either view.
 *
 * `requirementOccurrenceIds` IS THE DRILL-DOWN AND IT IS NON-EMPTY BY SCHEMA.
 * value-at-risk.md §"Drill-down contract": «Every rendered blocked sum is one tap
 * from the list of `blocked_reason` objects that produced it… A rendered sum
 * with no reachable drill-down target is a projection error.» Stating that as
 * `.min(1)` makes the projection error a 500 at this boundary instead of an
 * unclickable number on a screen in a meeting with the general contractor. Every
 * id here resolves to an element of the response's own `blockedReasons` array —
 * checked below, so «one tap» is a property of the payload and not of the
 * client's routing.
 *
 * THE ADDITIVE VIEW IS ADDITIVE TWICE OVER, and the two partitions have
 * different keys:
 *
 *   * OCCURRENCES are partitioned by their OWN code — every occurrence has
 *     exactly one, so `occurrenceCount` sums across rows to the number of live
 *     blocks;
 *   * MONEY is partitioned by PRIMARY cause — every assignment has exactly one,
 *     so the currency rows sum to `totalsByCurrency`.
 *
 * `assignmentCount` MAY THEREFORE BE ZERO in the additive view and never in the
 * non-additive one: a cause whose occurrences sit on assignments that some
 * higher-ranked cause owns holds no money and keeps its row, because dropping it
 * would delete the drill-down for those obligations.
 */
export const blockedValueCauseRow = z.object({
  code: blockedReasonCode,
  /** Unsatisfied blocking occurrences carrying this code, in this view's scope. */
  occurrenceCount: z.number().int().min(1),
  /** Distinct assignments whose money this row holds. Zero is legal — see above. */
  assignmentCount: z.number().int().min(0),
  totalsByCurrency: z.array(blockedValueTotal),
  /** Assignments in this row whose line has no usable price (INV-038). */
  unvaluedAssignmentCount: z.number().int().min(0),
  requirementOccurrenceIds: z.array(z.string().uuid()).min(1),
}).strict();
export type BlockedValueCauseRow = z.infer<typeof blockedValueCauseRow>;

/**
 * One published baseline's share of the sum.
 *
 * version-0.1.md §v0.1-M6 exit gate: summed «within one baseline and never
 * across baselines in different currencies». Currency separation alone does not
 * carry that sentence — two baselines of one project can share a currency — so
 * the baseline is a reported dimension rather than an assumption, and a reader
 * can always see which agreed price list a figure came from.
 */
export const blockedValueBaselineRow = z.object({
  contractId: z.string().uuid(),
  contractVersionId: z.string().uuid(),
  contractVersionNo: z.number().int().min(1),
  totalsByCurrency: z.array(blockedValueTotal),
  unvaluedAssignmentCount: z.number().int().min(0),
}).strict();

/**
 * INV-038's register: a quantity and a reason, never a zero.
 *
 * «Missing price and zero price are distinct; missing is unvalued and excluded
 * from numeric VaR.» A line whose money is not knowable contributes NOTHING to
 * any total on this screen and appears here instead, by unit and by count. The
 * reason is the domain's own `unvaluedReason` value, so «we have no price» and
 * «we do not know the tax basis» stay different sentences.
 *
 * There is deliberately NO money field on this row. A `netMinorUnits: "0"` here
 * is how «we do not know» becomes «it is free».
 */
export const unvaluedRegisterRow = z.object({
  reason: z.enum(["missing_unit_price", "unknown_tax_basis"]),
  unitCode: z.string().min(1),
  assignmentCount: z.number().int().min(1),
  /** Decimal text at the line's own scale. Never converted to money. */
  quantity: z.string(),
}).strict();

/**
 * INV-039's register: over-contract performance, by quantity, never valued.
 *
 * «Over-contract performance is never silently valued at the contract rate…
 * over-contract quantity reported separately as `unapproved_unvalued_exposure`.»
 * `disposition` is that literal, and it is the only value v0.1 can produce:
 * value-at-risk.md §"Over-contract exposure" also admits «whether a formally
 * approved adjustment exists» and «explicitly approved over-contract price», and
 * v0.1 implements no change-order lifecycle at all, so neither has a carrier.
 */
export const overContractRow = z.object({
  workItemId: z.string().uuid(),
  contractId: z.string().uuid(),
  unitCode: z.string().min(1),
  contractQuantity: z.string(),
  performedQuantity: z.string(),
  overContractQuantity: z.string(),
  disposition: z.literal("unapproved_unvalued_exposure"),
}).strict();

/**
 * ONE WORK LINE'S PERFORMED, PRICED, UNADMITTED QUANTITY — the bucket ADR-008
 * says this operation owes.
 *
 * ADR-008 §"What this does to the numbers": «A quantity that is recorded but not
 * admitted is performed, priced, and not allocated. That is a real state and it
 * needs a name in the value-at-risk projection rather than being folded into an
 * existing bucket: it is not `evidence_blocked` (a blocker may not exist yet —
 * nobody has tried to close the stage), and it is not `ready_not_packaged`
 * (readiness is not established). The projection owes it a bucket, and
 * `blocked_value.get` (M6) owes it a line.»
 *
 * THE NAME IS GIVEN HERE AND BY NOTHING ELSE. `performed_not_admitted`, in the
 * shape of the two states ADR-008 distinguishes it from. `state-catalog.csv` has
 * no machine for it and `value-at-risk.md` has no row — both are recorded as
 * owed rather than edited by this slice, because the seven-state projection they
 * would join is v0.2 and a v0.1 read may not write v0.2 vocabulary into a
 * level-2 document.
 *
 * `value` IS WHAT ADMISSION WOULD ACTUALLY CARVE, not an independent estimate:
 * the server computes it with `sliceAllocation` — the same function
 * `admitClosedStageQuantity` calls — against the line's real current state. So
 * the number on this screen and the number a stage closure would write cannot
 * differ, because there is one implementation of it.
 *
 * `overContractQuantity` is the part of `quantity` outside the contract
 * quantity. It draws nothing (INV-039) and it is reported here as well as in
 * `overContract` because the two questions differ: that register asks «is this
 * line over-performed at all», this field asks «how much of what is waiting for
 * admission could never be admitted at this price».
 */
export const performedNotAdmittedLine = z.object({
  workItemId: z.string().uuid(),
  contractId: z.string().uuid(),
  unitCode: z.string().min(1),
  /** Effective, corrections included: the lineage sum, not the roots' sum. */
  quantity: z.string(),
  /** The part inside the contract quantity — the part that would draw money. */
  fundedQuantity: z.string(),
  overContractQuantity: z.string(),
  /** Null when the line's money is not knowable (INV-038). Never a zero stand-in. */
  value: blockedValue.nullable(),
  unvaluedReason: z.enum(["missing_unit_price", "unknown_tax_basis"]).nullable(),
  /** Drill-down: the assignments whose recorded facts are waiting. */
  workAssignmentIds: z.array(z.string().uuid()).min(1),
}).strict();
export type PerformedNotAdmittedLine = z.infer<typeof performedNotAdmittedLine>;

export const performedNotAdmittedTotal = z.object({
  currency: z.string().length(3),
  netMinorUnits: z.string(),
  taxMinorUnits: z.string(),
  grossMinorUnits: z.string(),
  lineCount: z.number().int().min(0),
}).strict();

/**
 * The bucket itself.
 *
 * `bucket` IS A LITERAL AND NOT A LABEL. It is the name ADR-008 asked for,
 * emitted so a client cannot render this money under a heading of its own
 * invention, and so the day `state-catalog.csv` gains the machine the two can be
 * compared rather than reconciled by eye.
 *
 * `isSummandOfBlockedValue: false` IS ON THE WIRE FOR THE SAME REASON THE
 * NON-ADDITIVE VIEW CARRIES ITS FLAG. This bucket OVERLAPS blocked value: a
 * blocked stage's quantity is both unadmitted and blocked, so adding the two
 * would double-count the same work. The overlap is the point — «nobody has tried
 * to close the stage» and «somebody tried and was refused» are different
 * operational facts about the same money, and a screen that showed only the
 * second would report a pilot as unblocked on the day nobody used it.
 */
export const performedNotAdmittedView = z.object({
  bucket: z.literal("performed_not_admitted"),
  isSummandOfBlockedValue: z.literal(false),
  lines: z.array(performedNotAdmittedLine),
  totalsByCurrency: z.array(performedNotAdmittedTotal),
  /** Lines whose quantity is waiting and whose money is not knowable (INV-038). */
  unvaluedLineCount: z.number().int().min(0),
  /** Lines carrying quantity beyond the contract quantity (INV-039). */
  overContractLineCount: z.number().int().min(0),
}).strict();
export type PerformedNotAdmittedView = z.infer<typeof performedNotAdmittedView>;

const totalKeys = ["netMinorUnits", "taxMinorUnits", "grossMinorUnits"] as const;

/**
 * net, tax, gross, assignmentCount — a TUPLE and not `bigint[]`, because under
 * `noUncheckedIndexedAccess` every element of an array reads as
 * `bigint | undefined` and `acc[0] += …` does not compile. Naming the arity in
 * the type is also the honest thing: these four slots are positional and a
 * fifth would be a different reconciliation.
 */
type CurrencyTotals = [net: bigint, tax: bigint, gross: bigint, assignments: bigint];

function sumRows(rows: readonly z.infer<typeof blockedValueTotal>[]): Map<string, CurrencyTotals> {
  const out = new Map<string, CurrencyTotals>();
  for (const r of rows) {
    const acc: CurrencyTotals = out.get(r.currency) ?? [0n, 0n, 0n, 0n];
    acc[0] += BigInt(r.netMinorUnits);
    acc[1] += BigInt(r.taxMinorUnits);
    acc[2] += BigInt(r.grossMinorUnits);
    acc[3] += BigInt(r.assignmentCount);
    out.set(r.currency, acc);
  }
  return out;
}

/**
 * `blocked_value.get`'s 200.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RECONCILIATION IS A SCHEMA RULE, NOT A TEST
 *
 * value-at-risk.md §"Reconciliation of the decomposition" states two identities
 * over every currency `c` and every component `k ∈ {net, tax, gross}`:
 *
 *     sum(blocked_value_by_cause_k(c, cause) for cause in CAUSES) = total_k(c)
 *     blocked_value_affected_by_cause_k(c, cause) ≥ blocked_value_by_cause_k(c, cause)
 *
 * They are checked HERE, at the boundary, on every response. A test can only
 * check the fixtures somebody thought of; a `superRefine` checks the pilot's own
 * data on the day it is read, and a partition that stopped adding up becomes a
 * loud failure instead of a headline number that is quietly wrong. The failure
 * mode this rules out is the one the product will be judged on: «reporting a
 * per-cause table that quietly counts such a slice several times inflates the
 * very number the product will be judged on».
 *
 * The same identity is required of `byBaseline`, for the same reason and with
 * one extra consequence: it is what makes «within one baseline» checkable rather
 * than asserted.
 */
export const blockedValueResponse = z.object({
  projectId: z.string().uuid(),
  source: z.literal("computed"),
  algorithmVersion: z.string().min(1),
  /** The `blocked_reason.code` vocabulary this answer was computed under. */
  codeVocabularyVersion: z.string().min(1),
  /** The precedence this answer's additive partition used, in order. */
  primaryCausePrecedence: z.array(blockedReasonCode).min(1),
  calculatedAt: z.string().datetime({ offset: true }),

  /**
   * THE SUM. Per currency, DISTINCT assignments (INV-070), never added across
   * currencies (INV-012). `wholeLineAttributionCount` travels with it because
   * `blocked_reasons.get`'s own header explains that the whole-line reading can
   * over-attribute, and a headline that hid how many of its assignments were
   * attributed whole would be exactly the unreadable number this screen exists
   * to replace.
   */
  totalsByCurrency: z.array(blockedValueTotal),

  /** ADDITIVE: each assignment's money appears under exactly one cause. */
  byCause: z.array(blockedValueCauseRow),
  byCauseIsAdditive: z.literal(true),
  /** NON-ADDITIVE: an assignment appears under every distinct code blocking it. */
  affectedByCause: z.array(blockedValueCauseRow),
  affectedByCauseIsAdditive: z.literal(false),

  byBaseline: z.array(blockedValueBaselineRow),

  /** The drill-down targets themselves — the same objects `blocked_reasons.get` renders. */
  blockedReasons: z.array(blockedReason),

  unvaluedRegister: z.array(unvaluedRegisterRow),
  unvaluedAssignmentCount: z.number().int().min(0),
  /**
   * Contractually zero-priced assignments, counted apart from unvalued ones.
   * They ARE inside `totalsByCurrency`, contributing zero — «zero price receives
   * a known monetary value of zero» — and the count is what keeps a reader from
   * reading a small total as a small exposure.
   */
  zeroPricedAssignmentCount: z.number().int().min(0),

  overContract: z.array(overContractRow),
  performedNotAdmitted: performedNotAdmittedView,
}).strict().superRefine((v, ctx) => {
  const totals = sumRows(v.totalsByCurrency);
  const byCause = sumRows(v.byCause.flatMap((r) => r.totalsByCurrency));
  const byBaseline = sumRows(v.byBaseline.flatMap((r) => r.totalsByCurrency));

  for (const [label, got] of [["byCause", byCause], ["byBaseline", byBaseline]] as const) {
    for (const currency of new Set([...totals.keys(), ...got.keys()])) {
      const want = totals.get(currency) ?? [0n, 0n, 0n, 0n];
      const have = got.get(currency) ?? [0n, 0n, 0n, 0n];
      for (let i = 0; i < 4; i++) {
        if (want[i] !== have[i]) {
          const field = i < 3 ? totalKeys[i]! : "assignmentCount";
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [label],
            message: `${label} does not reconcile to totalsByCurrency for ${currency}.`
              + ` ${field}: partition ${have[i]}, total ${want[i]}`
              + " (value-at-risk.md §Reconciliation of the decomposition)",
          });
        }
      }
    }
  }

  const affected = new Map(
    v.affectedByCause.map((r) => [r.code, sumRows(r.totalsByCurrency)] as const));
  for (const row of v.byCause) {
    const a = affected.get(row.code);
    for (const t of row.totalsByCurrency) {
      const seen = a?.get(t.currency) ?? [0n, 0n, 0n, 0n];
      for (let i = 0; i < 3; i++) {
        if (seen[i]! < BigInt([t.netMinorUnits, t.taxMinorUnits, t.grossMinorUnits][i]!)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["affectedByCause"],
            message: `the non-additive view of ${row.code} is smaller than the additive one`
              + ` in ${t.currency}: it must be ≥ at every component`,
          });
        }
      }
    }
  }

  const reachable = new Set(v.blockedReasons.map((r) => r.requirementOccurrenceId));
  for (const [label, rows] of
    [["byCause", v.byCause], ["affectedByCause", v.affectedByCause]] as const) {
    for (const row of rows) {
      for (const id of row.requirementOccurrenceIds) {
        if (!reachable.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [label],
            message: `${row.code} names occurrence ${id}, which is in no blockedReasons row.`
              + " A rendered sum with no reachable drill-down target is a projection error"
              + " (value-at-risk.md §Drill-down contract)",
          });
        }
      }
    }
  }
});
export type BlockedValueResponse = z.infer<typeof blockedValueResponse>;
