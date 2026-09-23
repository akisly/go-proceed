import type { BlockedValueResponse } from "@goproceed/contracts";
import { CircleDashed, CircleSlash, ListChecks, Wallet } from "lucide-react";
import { Stat, type StatTint } from "@goproceed/ui/components";
import { pluralUk } from "../../lib/format-uk";
import { formatMoney } from "../../lib/money";
import { stagesOutOf } from "../../lib/stage-readiness";
import { ProjectPage } from "./project-page";
import { ReadinessBlock, type ReadinessView } from "./project-readiness";
import { UnvaluedRegister } from "./unvalued-register";
import { BlockedReasonsList } from "./blocked-reasons-list";

/** The KPI row's index tints, by POSITION in the row (DESIGN.md, DEV-029). */
const ROW_TINTS: readonly StatTint[] = ["clay", "violet", "pine", "stone"];
const tintAt = (i: number): StatTint => ROW_TINTS[i % ROW_TINTS.length]!;

/**
 * `getBlockedValue`'s `ok` branch with at least one live block — the whole
 * screen the task brief specifies, top to bottom:
 *
 *   1. the sum, per currency, beside its three honesty counts (this file) —
 *      since DEV-035 (2026-09-23) as a ROW OF KPI CARDS after the owner's
 *      Autumn CRM reference: one money card per currency, then the two
 *      project-wide counts in the SAME row (still «beside the sum, not behind
 *      a disclosure»), then the stages that can close, from readiness
 *   1b. the readiness block (`ProjectReadiness`), when readiness is readable
 *   2. the unvalued register, its own block (`UnvaluedRegister`)
 *   3. the drill-down list, oldest first (`BlockedReasonsList`)
 *   4. the cause split, as one sentence (this file)
 *
 * NEVER A CROSS-CURRENCY TOTAL — INV-012 / ADR-001's financial boundary.
 * `totalsByCurrency` is mapped into one `Stat` card PER CURRENCY [one
 * `Figure` per row until DEV-035 — the shape changed, the rule did not] and nothing sums
 * across those rows; there is no field anywhere in `BlockedValueResponse`
 * that could produce one, so this is a structural guarantee and not just a
 * habit of this component.
 */
export function ProjectMoneyOverview({
  projectId, projectName, blockedValue, readiness,
}: {
  projectId: string;
  projectName: string | null;
  blockedValue: BlockedValueResponse;
  readiness: ReadinessView;
}) {
  const customerRefused = blockedValue.byCause.find(
    (row) => row.code === "CUSTOMER_MOTIVATED_REFUSAL",
  )?.occurrenceCount ?? 0;

  const n = blockedValue.totalsByCurrency.length;

  return (
    <ProjectPage projectId={projectId} projectName={projectName} tab="overview">
      {/* The row is headed «Показники», not «Заблокована вартість»: its last
        * card is a readiness figure, not money (DEV-035 review, R1-03). The
        * money cards name the money in their own labels. */}
      <section aria-labelledby="kpi-heading" className="flex flex-col gap-3">
        <h2 id="kpi-heading" className="text-h3 font-semibold text-ink">Показники</h2>
        {/* ONE `Stat` CARD PER CURRENCY [a `Figure` per row until DEV-035],
         * each its own card — never one
         * figure with several numbers, which is the shape that tempts a
         * reader (or a future edit) into adding them together.
         *
         * IMPORTANT 4 (fix round 1): the eyebrow now names the basis.
         * `grossMinorUnits` is net+tax by construction regardless of a
         * work item's own `taxMode` (exclusive/inclusive/exempt) — the
         * INVARIANT `gross = net + tax` is what makes GROSS well-defined
         * across a mix of tax modes, so gross stays the right figure to
         * total. What was missing was saying so: a Ukrainian construction
         * contract is typically quoted NET, and an unlabelled gross total
         * next to a net contract figure reads as either overstating the
         * exposure or disagreeing with the contract — the design brief
         * never named a basis, so this was a silent judgement call rather
         * than a violation, and on a money screen the basis has to be on
         * the page. */}
        {/* Below `md` the money card spans the row and the counts sit two to a
          * row, so the readiness block is not pushed a phone-length down by
          * three small figures (UI review U1-07). */}
        <div className="grid grid-cols-2 gap-3 wide:grid-cols-4">
          {blockedValue.totalsByCurrency.map((total, i) => (
            <Stat
              key={total.currency}
              className="col-span-2 md:col-span-1"
              tint={tintAt(i)}
              icon={<Wallet />}
              // The basis «валова сума» opens the caption rather than
              // lengthening the label: a two-line label pushed this figure
              // off the row's baseline at 1240 (UI review U1-03). It stays on
              // the page, beside the figure (IMPORTANT 4 above).
              label={`Заблоковано, ${total.currency}`}
              value={formatMoney(total.grossMinorUnits, total.currency)}
              caption={
                // FINDING A (fix round 1): `wholeLineAttributionCount`
                // now renders UNCONDITIONALLY, at zero included — the
                // contract's own header on `blockedValueTotal` calls a
                // headline that hides this count "exactly the unreadable
                // number this screen exists to replace", and hiding it
                // AT ZERO left the reader unable to tell "this total is
                // not over-attributed" from "this screen does not tell me
                // about over-attribution". The overstatement caveat stays
                // conditional — it is only a true statement when the
                // count is positive.
                `Валова сума · ${total.assignmentCount} `
                + pluralUk(total.assignmentCount, "доручення", "доручення", "доручень")
                + `, з них ${total.wholeLineAttributionCount} за повною сумою рядка`
                + (total.wholeLineAttributionCount > 0
                  ? " (можливе завищення — рядок не поділений на частки)"
                  : "")
              }
            />
          ))}

          {/* THE TWO PROJECT-WIDE HONESTY COUNTS — beside the sum, not behind
           * a disclosure, per the task brief in exactly those words.
           * `unvaluedAssignmentCount` and `zeroPricedAssignmentCount` are
           * top-level `BlockedValueResponse` fields (one count for the whole
           * project), unlike `wholeLineAttributionCount` above, which is
           * PER CURRENCY (`blockedValueTotal.wholeLineAttributionCount`) —
           * rendered where its own row is, not flattened into this pair. */}
          <Stat
            tint={tintAt(n)}
            icon={<CircleDashed />}
            emphasis="secondary"
            label="Без ціни"
            value={blockedValue.unvaluedAssignmentCount}
            caption={
              `${pluralUk(blockedValue.unvaluedAssignmentCount, "доручення", "доручення", "доручень")} `
              + "без ціни — їхній розмір є кількістю, не сумою"
            }
          />
          <Stat
            tint={tintAt(n + 1)}
            icon={<CircleSlash />}
            emphasis="secondary"
            label="Нульова ціна"
            value={blockedValue.zeroPricedAssignmentCount}
            caption={
              `${pluralUk(blockedValue.zeroPricedAssignmentCount, "доручення", "доручення", "доручень")} `
              + "за договірною нульовою ціною — усередині суми, дають нуль"
            }
          />
          {readiness.kind === "ok" && (
            // «Можна закрити», the legend's own word: the stages whose
            // requirements are met, out of every stage. The caption names the
            // other three states, so the four parts add up (R1-03).
            <Stat
              tint={tintAt(n + 2)}
              icon={<ListChecks />}
              emphasis="secondary"
              label="Можна закрити"
              value={readiness.readiness.summary.closableCount - readiness.readiness.summary.vacuouslyClosableCount}
              unit={stagesOutOf(readiness.readiness.summary.stageCount)}
              caption={
                `${readiness.readiness.summary.blockedCount} заблоковано · `
                + `${readiness.readiness.summary.vacuouslyClosableCount} без вимог · `
                + `${readiness.readiness.summary.closedCount} закрито`
              }
            />
          )}
        </div>
      </section>

      <ReadinessBlock readiness={readiness} />

      <UnvaluedRegister register={blockedValue.unvaluedRegister} />

      <BlockedReasonsList reasons={blockedValue.blockedReasons} />

      {/* Task item 4: the cause split as ONE sentence, never a chart —
       * `V01_PRODUCIBLE_BLOCKED_REASON_CODES` is two of seven and one of the
       * two is defined as "everything else" (`packages/contracts/src/
       * readiness.ts`), so a by-cause chart would be a single sector next to
       * an unlabelled remainder. `byCause` only — never `affectedByCause`,
       * which the schema marks `affectedByCauseIsAdditive: false` and would
       * invite a reader to compare it against this additive sentence. */}
      <p className="text-data text-ink-muted">
        з них повернуто замовником: <span className="tabular font-medium text-ink">{customerRefused}</span>
      </p>
    </ProjectPage>
  );
}
