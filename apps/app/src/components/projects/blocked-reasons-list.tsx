import type { BlockedReason } from "@goproceed/contracts";
import { Panel, PanelHeader, PanelBody } from "@goproceed/ui/components";
import { formatMoney } from "../../lib/money";
import { formatQuantity } from "../../lib/quantity";
import { daysSinceUk } from "../../lib/format-uk";
import { evidenceKindLabel } from "../../lib/evidence-kind-labels";
import { normRefVerificationLabel } from "../../lib/norm-ref-labels";
import { approverRoleLabel } from "../../lib/approver-role-labels";

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
 * never mutating the prop) makes the PRIMARY key — `since` — a property of
 * THIS component rather than an assumption about the route.
 *
 * CORRECTED IN FIX ROUND 1: this used to also claim the sort "removes … an
 * assumption about the route that nothing enforces" in full, which
 * overclaims the TIE case. `Array.prototype.sort` has been stable since
 * ES2019, so two rows sharing one `since` keep their INCOMING relative
 * order rather than being reordered arbitrarily — and their incoming order
 * IS the route's own `order by o.ordinal, o.id` — the tail of the
 * `OCCURRENCES_SQL` constant in `apps/app/src/lib/readiness.ts` — which this
 * component has no
 * independent way to reproduce: `blockedReason` carries no `ordinal` field
 * on the wire (`packages/contracts/src/readiness.ts`), only
 * `requirementOccurrenceId` — a different key than `o.id`'s row-materialisation
 * meaning would need. Ties are therefore NOT independent of the route; they
 * correctly INHERIT its order via sort stability, which is a real guarantee
 * worth naming rather than a gap to paper over with a second sort key that
 * would only produce a THIRD, unrelated tie-break (UUID text order). Ties
 * are the normal case here, not the edge: `since` is materialisation-time
 * `created_at`, and every occurrence on one assignment materialises inside
 * one transaction, so a whole assignment's rows typically share a
 * millisecond.
 *
 * `awaitingApproverRole` GOES THROUGH `approverRoleLabel`
 * (`../../lib/approver-role-labels.ts`), NOT RAW — CORRECTED IN FIX ROUND 1.
 * The previous round concluded "no closed vocabulary" ruled out a label
 * entirely; it only rules out a SCHEMA-DERIVED FIDELITY TEST (`approver_role`
 * carries a non-blank CHECK, never an enumerated one, on every table it
 * lives on — `supabase/migrations/
 * 0052_the_whitespace_that_counted_as_content.sql:144-145`). A best-effort
 * map with a raw fallback is exactly `membershipRoleLabel`'s own shape for a
 * `z.string()`-typed field, and that file's own module carries the
 * reasoning and the one concretely known value.
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
                  <dd className="text-ink">
                    {reason.awaitingApproverRole ? approverRoleLabel(reason.awaitingApproverRole) : "—"}
                  </dd>
                </div>
                <div>
                  {/* IMPORTANT 4 (fix round 1): the figure is GROSS
                   * (`grossMinorUnits`), and the label now says so — a
                   * Ukrainian construction contract is typically quoted
                   * net, and an unlabelled gross figure reads as
                   * disagreeing with it. */}
                  <dt className="text-ink-muted">Гроші (валова сума)</dt>
                  <dd className="tabular text-ink">
                    {reason.blockedValue
                      ? formatMoney(reason.blockedValue.grossMinorUnits, reason.blockedValue.currency)
                      : (
                        // IMPORTANT 2 (fix round 1): `unvaluedQuantity` is
                        // `fromScaled6` output — a fixed six-decimal DOT
                        // string ("1.250000") with no unit anywhere on
                        // `blockedReason` (unlike `unvaluedRegisterRow`,
                        // which carries `unitCode`). `formatQuantity`
                        // trims it to Ukrainian-comma shape; the missing
                        // unit is stated outright rather than left for the
                        // reader to notice its absence.
                        <>
                          {formatQuantity(reason.unvaluedQuantity ?? "")} — кількість без оцінки,
                          {" "}одиниця виміру не передається
                        </>
                      )}
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
                   * made and it was a RETURN — the block is not "awaiting a
                   * first decision", it is stuck on a refusal that needs a
                   * resubmission. Every other v0.1 code is genuinely still
                   * awaiting one.
                   *
                   * ROUND 3 CORRECTION, TWO PARTS.
                   *
                   * Part 1 — WHAT `codeFor` (`apps/app/src/lib/readiness.ts`)
                   * ACTUALLY BRANCHES ON, stated directly rather than left to
                   * a catalog citation to imply: `EvaluatedOccurrence.
                   * currentDecisionOutcome`, read off `requirement_evidence_
                   * decision_heads.current_outcome` — `check (current_outcome
                   * is null or current_outcome in ('accepted','returned'))`
                   * (`supabase/migrations/
                   * 0045_the_refusal_and_the_facts_behind_it.sql`, the `create
                   * table public.requirement_evidence_decision_heads` block).
                   * `codeFor` returns `CUSTOMER_MOTIVATED_REFUSAL` exactly
                   * when that column reads `'returned'`, `SUPERVISION_
                   * SIGNATURE_MISSING` otherwise — that is the real, DB-level
                   * source this branch reads, verified against the migration
                   * directly, not assumed from a catalog row.
                   *
                   * Part 2 — a prior citation to a CSV file this same comment
                   * used to lean on for WHY the mapping is named what it is.
                   * TWO FILES SHARE THE BASENAME `state-catalog.csv` in this
                   * repository — `technical/state-catalog.csv` (legacy,
                   * explicitly non-normative per `docs/README.md`, quoted in
                   * `assignment-status-labels.ts`'s own header: "the flat CSV
                   * catalogs are not v0.1 implementation authority") and
                   * `technical/states/state-catalog.csv` (current, 23
                   * references elsewhere in this codebase) — and a bare,
                   * unqualified citation to "state-catalog.csv" is genuinely
                   * ambiguous between them. VERIFIED, BYTE FOR BYTE: `awk
                   * 'NR==115||NR==116'` on `technical/states/state-catalog.
                   * csv` (the plural, canonical one — confirmed via 23
                   * existing references and `docs/README.md`'s own 
                   * precedence ruling, not assumed) returns exactly the
                   * `blocked_reason.code,SUPERVISION_SIGNATURE_MISSING` and
                   * `blocked_reason.code,CUSTOMER_MOTIVATED_REFUSAL` rows —
                   * "The occurrence awaits a decision from the approver_role
                   * that owes it" and "A current return by the approver_role
                   * names a motivated refusal" respectively — which is what
                   * this reasoning has always meant. Cited here by the CSV
                   * row's own key, not a line number that a future edit to
                   * either file could silently point at the wrong one again:
                   * `technical/states/state-catalog.csv`'s
                   * `blocked_reason.code,CUSTOMER_MOTIVATED_REFUSAL` /
                   * `,SUPERVISION_SIGNATURE_MISSING` rows. `TODOS.md` records
                   * the ambiguity itself as owed: `readiness.ts`'s own
                   * `codeFor` comment — the one this file's text was
                   * originally copied from — still cites the bare, unqualified
                   * filename. */}
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
