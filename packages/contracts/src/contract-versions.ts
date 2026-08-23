import { z } from "zod";

export interface WorkItemView {
  workItemId: string;
  position: number;
  sourceKey: string | null;
  workCode: string | null;
  description: string;
  /**
   * The left-hand side of the requirement-rule predicate, as typed (migration
   * 0050). NULL for every imported line and for any line whose typist supplied
   * none — such a line matches no rule and is disclosed as
   * `work_type_unresolved` rather than refused.
   *
   * IT IS IN THE LINE MANIFEST. `lineManifestHash` hashes this field with the
   * rest, so a second typist classifying a line between review and publication
   * invalidates the digest and `contract_versions.publish` refuses with
   * VERSION_CONFLICT. Leaving it out would have made the work type the one
   * property of a line that could change under a reviewer without the
   * concurrency guard noticing — which is precisely what the manifest's own
   * comment names as the cost of omitting `external_ref`.
   */
  workTypeKey: string | null;
  section: string | null;
  unitCode: string;
  unitPrecision: number;
  contractQuantity: string;
  unitPriceState: "known" | "zero" | "missing";
  unitPriceDecimal: string | null;
  valuationBasis: "unit_price_derived" | "approved_source_amount";
  netMinor: string;
  taxMinor: string;
  grossMinor: string;
  sourceAmountMinor: string | null;
  predecessorWorkItemId: string | null;
}

/**
 * `contract_versions.get` — GET /v1/contracts/{contractId}/versions/{versionNo}.
 *
 * THE THREE NULLABLE FIELDS ARE THE MANUAL BASELINE, not laxity. Until migration
 * 0042 a contract version could only be `published`, so `status` was the literal
 * `"published"` and the other two were non-null by construction. 0042 opens the
 * draft -> published transition ADR-006 decision 2 needs, and a draft has no
 * publication time, no publisher and no content address — the columns are NULL
 * under `contract_versions_draft_check`. Leaving the response as it was would
 * have made this read announce every draft as published and date it 1970-01-01.
 *
 * Widening a response union is additive for a reader that switches on it, which
 * is the same argument `RequirementRuleVersionResponse` makes for narrowing in
 * the other direction.
 *
 * THIS READ IS WHAT `contract_versions.publish` CONFIRMS AGAINST. The manifest
 * hash the publish command demands is computed over exactly the fields below —
 * the pins and the `workItems` array, in the order they appear here — so a
 * caller can recompute the digest of the line set it was SHOWN rather than
 * trusting one the server volunteered.
 */
export interface ContractVersionResponse {
  contractVersionId: string;
  contractId: string;
  versionNo: number;
  status: "draft" | "published";
  /** NULL while the version is a draft. */
  publishedAt: string | null;
  /** NULL while the version is a draft: a draft has no content address yet. */
  sourceManifestHash: string | null;
  supersedesVersionId: string | null;
  pins: {
    currency: string;
    taxMode: string;
    taxRateBps: number | null;
    roundingPolicy: unknown;
    toleranceMinorUnits: string;
    toleranceBps: number;
  };
  partySnapshots: { own: unknown; customer: unknown };
  workItems: WorkItemView[];
  diff: { added: number; removed: number; changed: number; unchanged: number } | null;
}

// ───────────────────────────────────────────────────────────────────────────
// The manual baseline: create a draft version, bind its rule set, publish it.
//
// These three operations plus the three in ./work-items are the five new rows
// of technical/openapi/scope-v0.1.csv that make a baseline typeable by hand
// (version-0.1.md §v0.1-M1, "Five are new and are the manual baseline"), plus
// the rule binding ADR-006 decision 3 merges into M1. All four are
// `command` / idempotency `required` / `member` plane, so every one of them
// carries an `Idempotency-Key` HEADER — never a body field. The header is
// required and hashed by apps/app/src/lib/command.ts:38-47, which is why no
// request schema in this package has ever declared it.
//
// The XLSX/CSV importer is FROZEN by ADR-006 decision 6. Nothing here extends
// it, reads its mapping, or replaces it: `import_batches.publish` remains the
// other, unchanged route to a published baseline, and it is subject to the
// same INV-083 refusal as `contract_versions.publish` below.
// ───────────────────────────────────────────────────────────────────────────

/**
 * `contract_versions.create` — POST /v1/contracts/{contractId}/versions.
 * Creates a DRAFT version, which is the only state in which work lines may be
 * added, corrected or removed (INV-015).
 *
 * The body is nearly empty on purpose. Every commercial pin — currency, tax
 * mode and rate, terms, approval policy, rounding policy and both tolerances —
 * and both party snapshots are COPIED from the contract inside the creating
 * transaction, exactly as the importer's publish copies them
 * (apps/app/app/v1/import-batches/[batchId]/publish/route.ts:161-176). A pin
 * accepted here would let a caller publish a baseline whose own numbers
 * contradict the contract they were agreed under, and the pinned copy is what
 * makes a published version reproducible.
 *
 * `versionNo` is likewise not accepted: it is assigned as max+1 within the
 * contract, under `unique (workspace_id, contract_id, version_no)`.
 */
export const createContractVersionRequest = z.object({
  /**
   * The published version this draft supersedes; absent for a contract's first
   * version. Named here rather than derived, because "correct version 2" and
   * "start a parallel version 3" are different intentions and the schema
   * should not guess which one the caller had.
   */
  supersedesVersionId: z.string().guid().optional(),
}).strict();
export type CreateContractVersionRequest = z.infer<typeof createContractVersionRequest>;

export interface CreateContractVersionResponse {
  contractVersionId: string;
  versionNo: number;
  status: "draft";
  supersedesVersionId: string | null;
}

/**
 * `contract_versions.bind_rules` —
 * POST /v1/contract-versions/{versionId}/rule-bindings.
 *
 * Pins the exact requirement rule-version set the work under this baseline
 * will be judged against (ADR-005 decision 2, ADR-006 decision 3). It targets
 * a DRAFT version: a published one is immutable and a rule published after
 * publication never reaches it (INV-080).
 *
 * Only version identities cross the wire. The rule id, the stage key and the
 * published-ness of each version are read from the rule version itself and
 * pinned by composite foreign key
 * (supabase/migrations/0041_requirement_rules_bound_to_the_baseline.sql:479-497),
 * so a caller cannot bind a draft version, cannot misreport the stage a
 * version names, and cannot bind two versions of one rule into one baseline.
 * Those three are structural; this schema does not restate them.
 */
export const bindContractVersionRulesRequest = z.object({
  /**
   * Upper bound is a resource-exhaustion control (M0 exit gate), not a domain
   * limit: the shipped Додаток Н library carries twelve items and a workspace
   * that has published more rule versions than this is not a v0.1 pilot.
   */
  ruleVersionIds: z.array(z.string().guid()).min(1).max(500),
}).strict();
export type BindContractVersionRulesRequest = z.infer<typeof bindContractVersionRulesRequest>;

export interface RuleBindingView {
  bindingId: string;
  requirementRuleId: string;
  ruleVersionId: string;
  workTypeKey: string;
  stageKey: string;
  interventionType: string;
  blockingScope: string;
}

export interface BindContractVersionRulesResponse {
  contractVersionId: string;
  bindings: RuleBindingView[];
  /**
   * The distinct stage keys of the bound set. This IS the version's stage
   * vocabulary — M2 materialises stages and occurrences from the binding
   * rather than from a member command — so it is returned rather than left for
   * the caller to derive.
   */
  stageKeys: string[];
}

/**
 * `contract_versions.publish` — POST /v1/contract-versions/{versionId}/publish.
 *
 * REFUSES a version that carries no `contract_version_rule_bindings` row
 * (INV-083). The refusal is the deliverable, not a side condition: no baseline
 * is published in v0.1 without a rule-version set, on this route and on
 * `import_batches.publish` alike.
 *
 * `confirmedManifestHash` mirrors `publishImportBatchRequest`: the caller
 * confirms the digest of exactly the line set it was shown, and the command
 * recomputes it over the draft's work items and refuses on mismatch. A hand
 * typed baseline gets the same content-addressed confirmation an imported one
 * gets — ADR-006 decision 2, "the same schema quality, the same provenance,
 * and the same tests as an imported line".
 *
 * There is no `expectedVersion` here because `public.contract_versions` has no
 * version column (migration 0012). The manifest hash is the concurrency guard,
 * and it is a stronger one: it names the content, not a counter.
 */
export const publishContractVersionRequest = z.object({
  confirmedManifestHash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export type PublishContractVersionRequest = z.infer<typeof publishContractVersionRequest>;

export interface PublishContractVersionResponse {
  contractVersionId: string;
  versionNo: number;
  workItemCount: number;
  /** What INV-083 was satisfied by. Zero is unreachable: publication refuses. */
  boundRuleVersionCount: number;
  supersedesVersionId: string | null;
  /**
   * WHAT THIS BASELINE'S GATE WILL ACTUALLY REACH, computed in the publish
   * transaction — the first moment both the lines and the bindings exist, which
   * is why it is here and not a constraint.
   *
   * ADR-006 decision 4.2 requires it in terms: «a work type with no matching
   * rule must still be NAMED IN THE COMMAND'S OUTPUT, because silent
   * non-coverage means there is no gate». A published baseline is immutable
   * (INV-015), so this is the last moment anyone can be told before the
   * consequence — an empty obligation set, an empty stage, a vacuous closure —
   * becomes permanent for the life of the version.
   *
   * `untypedLineCount` is not a fault: it is every imported line and every line
   * a typist left blank. `unmatchedPositions` is the ambiguous case — a work
   * type this workspace publishes rules for, whose rules THIS baseline did not
   * bind — and it is reported rather than refused, because the only escape from
   * a refusal would be to clear the work type, which is the silent hole. The
   * ONE case publication refuses is a bound set NO line reaches
   * (`boundRuleVersionCount > 0 && coveredLineCount === 0`): that is INV-083's
   * hole one level in, and it comes back as RULE_BINDING_REQUIRED with the
   * catalogue's own user action.
   *
   * CORRECTED 2026-08-08: the qualifier used to read `typedLineCount > 0`,
   * which made the refusal escapable by clearing the work type on every line —
   * the same one-field PATCH the paragraph above calls the silent hole, applied
   * once more. Every version that reaches `contract_versions.publish` is
   * manual-origin (the importer publishes its own row elsewhere) and INV-083
   * has already forced a binding onto it, so the all-untyped case is refused
   * too. `untypedLineCount` remains not-a-fault on a baseline where some other
   * line IS covered.
   */
  workTypeCoverage: {
    /** Lines carrying a work type matched by at least one bound rule version. */
    coveredLineCount: number;
    /** Lines carrying a work type. */
    typedLineCount: number;
    /** Lines carrying none. Not a fault; see above. */
    untypedLineCount: number;
    /**
     * Positions — not ids — of the typed lines no bound rule version matches,
     * ascending. Positions, because publication renumbers to 1..N in the same
     * transaction and the position is what the caller and the printed act both
     * read.
     *
     * THESE ARE POSITIONS AS THEY *WILL BE* AFTER THAT RENUMBERING, NOT AS THEY
     * ARE WHEN THE COVERAGE IS COMPUTED. The route derives them: `items` is
     * ordered by position, renumbering rewrites that same order to 1..N, so the
     * final position of `items[i]` is `i + 1`. Corrected 2026-08-08 — this said
     * «the renumbering has already happened when this is computed», which is
     * the wrong way round: coverage is computed before `renumber` runs, and a
     * future reader who trusted that sentence and "simplified" this to re-read
     * `position` from the table would emit pre-renumbering row numbers the
     * caller will never see again. A draft can carry gaps (`work_items.remove`
     * does not renumber), so the two orderings genuinely differ.
     */
    unmatchedPositions: number[];
  };
}
