import type { BlockedValueResponse } from "@goproceed/contracts";
import { Figure, Panel, PanelHeader, PanelBody } from "@goproceed/ui/components";
import { pluralUk } from "../../lib/format-uk";
import { formatMoney } from "../../lib/money";
import { ProjectOverviewHeader } from "./project-overview-header";
import { UnvaluedRegister } from "./unvalued-register";
import { BlockedReasonsList } from "./blocked-reasons-list";

/**
 * `getBlockedValue`'s `ok` branch with at least one live block — the whole
 * screen the task brief specifies, top to bottom:
 *
 *   1. the sum, per currency, beside its three honesty counts (this file)
 *   2. the unvalued register, its own block (`UnvaluedRegister`)
 *   3. the drill-down list, oldest first (`BlockedReasonsList`)
 *   4. the cause split, as one sentence (this file)
 *
 * NEVER A CROSS-CURRENCY TOTAL — INV-012 / ADR-001's financial boundary.
 * `totalsByCurrency` is mapped into one `Figure` PER ROW and nothing sums
 * across those rows; there is no field anywhere in `BlockedValueResponse`
 * that could produce one, so this is a structural guarantee and not just a
 * habit of this component.
 */
export function ProjectMoneyOverview({
  projectId, blockedValue,
}: { projectId: string; blockedValue: BlockedValueResponse }) {
  const customerRefused = blockedValue.byCause.find(
    (row) => row.code === "CUSTOMER_MOTIVATED_REFUSAL",
  )?.occurrenceCount ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-6">
      <ProjectOverviewHeader projectId={projectId} />

      <Panel>
        <PanelHeader title="Сума" />
        <PanelBody className="flex flex-col gap-6">
          {/* ONE `Figure` PER CURRENCY, laid out as its own row — never one
           * figure with several numbers, which is the shape that tempts a
           * reader (or a future edit) into adding them together. */}
          <div className="flex flex-col gap-4">
            {blockedValue.totalsByCurrency.map((total) => (
              <Figure
                key={total.currency}
                eyebrow={`Заблоковано, ${total.currency}`}
                value={formatMoney(total.grossMinorUnits, total.currency)}
                qualifier={
                  `${total.assignmentCount} `
                  + pluralUk(total.assignmentCount, "доручення", "доручення", "доручень")
                  + (total.wholeLineAttributionCount > 0
                    ? `, з них ${total.wholeLineAttributionCount} за повною сумою рядка`
                      + " (можливе завищення — рядок не поділений на частки)"
                    : "")
                }
              />
            ))}
          </div>

          {/* THE TWO PROJECT-WIDE HONESTY COUNTS — beside the sum, not behind
           * a disclosure, per the task brief in exactly those words.
           * `unvaluedAssignmentCount` and `zeroPricedAssignmentCount` are
           * top-level `BlockedValueResponse` fields (one count for the whole
           * project), unlike `wholeLineAttributionCount` above, which is
           * PER CURRENCY (`blockedValueTotal.wholeLineAttributionCount`) —
           * rendered where its own row is, not flattened into this pair. */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-4 text-meta">
            <p>
              <span className="tabular font-medium text-ink">
                {blockedValue.unvaluedAssignmentCount}
              </span>{" "}
              <span className="text-ink-muted">
                {pluralUk(blockedValue.unvaluedAssignmentCount, "доручення", "доручення", "доручень")}{" "}
                без ціни — їхній розмір є кількістю, не сумою
              </span>
            </p>
            <p>
              <span className="tabular font-medium text-ink">
                {blockedValue.zeroPricedAssignmentCount}
              </span>{" "}
              <span className="text-ink-muted">
                {pluralUk(blockedValue.zeroPricedAssignmentCount, "доручення", "доручення", "доручень")}{" "}
                за договірною нульовою ціною — усередині суми, дають нуль
              </span>
            </p>
          </div>
        </PanelBody>
      </Panel>

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
    </div>
  );
}
