import type { BlockedReason } from "@goproceed/contracts";
import { Panel, PanelHeader, PanelBody } from "@goproceed/ui/components";
import { formatMoney } from "../../lib/money";
import { daysSinceUk } from "../../lib/format-uk";
import { evidenceKindLabel } from "../../lib/evidence-kind-labels";
import { normRefVerificationLabel } from "../../lib/norm-ref-labels";

/**
 * Task item 3: the drill-down list, "sorted by `since` ascending — oldest
 * first", each row carrying what is missing, who owes the decision, how long
 * it has been blocked, the money or the unvalued quantity, and the
 * requirement in the standard's own wording with its source.
 *
 * SORTED HERE, NOT TRUSTED FROM THE ROUTE — `blockedReasons` arrives in
 * whatever order `evaluateStages`/`liveBlockedReasons` produced it
 * (`apps/app/src/lib/readiness.ts`), which is stage/occurrence materialisation
 * order, not `since` order. Sorting client-side against a copy (`.slice()`,
 * never mutating the prop) makes the ordering a property of THIS component
 * rather than an assumption about the route that nothing enforces.
 *
 * `awaitingApproverRole` IS RENDERED RAW, WITH NO LABEL MAP — a decision,
 * not an oversight. `approver_role` carries only a non-blank CHECK on every
 * table it lives on (`requirement_occurrences_approver_role_check`,
 * `supabase/migrations/0052_the_whitespace_that_counted_as_content.sql:144-145`;
 * originally `check (length(btrim(approver_role)) > 0)`,
 * `0043_the_obligation_before_the_covering.sql:575`) — free text a
 * requirement-template author types per requirement, not a closed roster.
 * Fixture values in this very repository (`technical_supervisor`,
 * `apps/app/tests/helpers/fixtures.ts:234`) do not even match `membership-
 * labels.ts`'s thirteen membership roles, so mapping this field through that
 * table would be inventing a translation the data does not support. This
 * is the same "raw but truthful" choice `membershipRoleLabel`'s own fallback
 * makes for a role its map has not learned — except here it is the ONLY
 * available rendering, because there is no closed vocabulary to build a map
 * against in the first place (the binding rule this repository applies to
 * label maps needs a `pg_constraint` enum to test against; a bare
 * non-blank CHECK is not one).
 *
 * `code` (the seven-value `blockedReasonCode`) IS NEVER PRINTED AS A RAW
 * VALUE PER ROW — the task brief's item 4 already renders the one code v0.1
 * can distinguish meaningfully (`CUSTOMER_MOTIVATED_REFUSAL`) as its own
 * sentence, and `V01_PRODUCIBLE_BLOCKED_REASON_CODES` names
 * `SUPERVISION_SIGNATURE_MISSING` as "everything else" (`packages/
 * contracts/src/readiness.ts`), which is not information a reader can act on
 * as an enum word. `code` IS STILL READ, though, to choose between two
 * fallback sentences when `missingEvidence` is empty (see below) — a row
 * can be empty-evidence for two different reasons and they are not the same
 * sentence.
 */
export function BlockedReasonsList({ reasons }: { reasons: BlockedReason[] }) {
  const sorted = [...reasons].sort(
    (a, b) => new Date(a.since).getTime() - new Date(b.since).getTime(),
  );

  return (
    <Panel>
      <PanelHeader title="Заблоковані вимоги" count={sorted.length} />
      <PanelBody className="p-0">
        <ul className="flex flex-col">
          {sorted.map((reason, i) => (
            <li
              key={reason.requirementOccurrenceId}
              className={
                i < sorted.length - 1
                  ? "flex flex-col gap-2 border-b border-line px-4 py-3"
                  : "flex flex-col gap-2 px-4 py-3"
              }
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-data font-medium text-ink">{reason.acceptanceCriterion}</p>
                <span className="tabular text-meta text-ink-muted">
                  заблоковано {daysSinceUk(reason.since)}
                </span>
              </div>

              {/* INV-073: normRef travels with its verification tag and its
               * source or not at all — never render `normRef.text` alone.
               *
               * `break-words` IS LOAD-BEARING, NOT DECORATION — measured,
               * not guessed: this screen's own QA audit
               * (`qa/field.mjs`'s project-overview step) reported real
               * 149px/178px sideways page scroll at 390/360 with this
               * class absent, traced to THIS paragraph's `scrollWidth`
               * (497px in a 308px box) via a one-off debug pass over every
               * element whose scrollWidth exceeds its clientWidth. The
               * seeded `normRef.source` is `docs/product/
               * hidden-works-content-rules.md`'s own real provenance
               * shape — "офіційний файл e-construction.gov.ua,
               * https://…, sha256=…" — a URL and a 64-character hex hash,
               * NEITHER of which contains a break opportunity. This is the
               * exact defect class `757c949` ("every screen was 24px wider
               * than the phone it is for") already fixed once on the field
               * client's own norm-ref line for the identical reason; that
               * fix never reached this new screen because this component
               * did not exist yet. */}
              {reason.normRef && (
                <p className="measure break-words text-meta text-ink-muted">
                  {reason.normRef.text} ({normRefVerificationLabel(reason.normRef.verification)},{" "}
                  {reason.normRef.source})
                </p>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-meta">
                <div>
                  <dt className="text-ink-muted">Хто вирішує</dt>
                  <dd className="text-ink">{reason.awaitingApproverRole ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Гроші</dt>
                  <dd className="tabular text-ink">
                    {reason.blockedValue
                      ? formatMoney(reason.blockedValue.grossMinorUnits, reason.blockedValue.currency)
                      : `${reason.unvaluedQuantity} (без оцінки)`}
                  </dd>
                </div>
              </dl>

              {reason.missingEvidence.length > 0 ? (
                <ul className="flex flex-col gap-0.5 text-meta text-ink-muted">
                  {reason.missingEvidence.map((item, j) => (
                    <li key={j}>
                      {evidenceKindLabel(item.evidenceKind)} — {item.acceptanceCriterion}:{" "}
                      <span className="tabular">
                        {item.availableCount}/{item.requiredCount}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-meta text-ink-muted">
                  {/* Two different reasons a row can carry no missing
                   * evidence, and they are not the same sentence:
                   * CUSTOMER_MOTIVATED_REFUSAL means a decision was already
                   * made and it was a RETURN (state-catalog.csv:116, via
                   * `codeFor`, `apps/app/src/lib/readiness.ts:466-472`) — the
                   * block is not "awaiting a first decision", it is stuck on
                   * a refusal that needs a resubmission. Every other v0.1
                   * code is genuinely still awaiting one. */}
                  {reason.code === "CUSTOMER_MOTIVATED_REFUSAL"
                    ? "Усі фіксації надано — замовник повернув із зауваженнями."
                    : "Усі фіксації надано — очікує рішення."}
                </p>
              )}
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}
