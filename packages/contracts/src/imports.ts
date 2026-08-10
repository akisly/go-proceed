import { z } from "zod";

export const createImportBatchRequest = z.object({});
export interface CreateImportBatchResponse { batchId: string; status: "created"; version: number }

export interface ImportFileRow {
  fileId: string;
  filename: string;
  byteSize: number;
  contentHash: string;
  detectedFormat: "xlsx" | "csv";
}
export interface AddImportFileResponse extends ImportFileRow { batchVersion: number }

const columnRef = z.string().regex(/^[A-Z]{1,3}$/);
export const importColumnMapping = z.object({
  sourceKey: columnRef.optional(),
  workCode: columnRef.optional(),
  description: columnRef,
  section: columnRef.optional(),
  unit: columnRef,
  quantity: columnRef,
  unitPrice: columnRef.optional(),
  amount: columnRef.optional(),
  location: columnRef.optional(),
  externalRef: columnRef.optional(),
});
export type ImportColumnMapping = z.infer<typeof importColumnMapping>;

export const validateImportBatchRequest = z.object({
  mapping: importColumnMapping,
  config: z.object({
    locale: z.enum(["uk-UA", "en-US"]).default("uk-UA"),
    headerRow: z.number().int().min(0).default(1),
    worksheet: z.string().min(1).optional(),
  }).default({}),
  expectedVersion: z.number().int().min(1),
});
export type ValidateImportBatchRequest = z.infer<typeof validateImportBatchRequest>;

export const createResolutionRequest = z.object({
  rowResultId: z.string().uuid(),
  chosenBasis: z.enum(["unit_price_derived", "approved_source_amount"]),
  reason: z.string().trim().min(1).max(2000),
});
export type CreateResolutionRequest = z.infer<typeof createResolutionRequest>;
export interface CreateResolutionResponse { resolutionId: string }

/**
 * `import_batches.publish` — POST /v1/import-batches/{batchId}/publish.
 *
 * THE FROZEN IMPORTER IS NOT EXTENDED BY `ruleVersionIds`, AND THIS IS WHERE
 * THAT IS ARGUED. ADR-006 decision 1 freezes import EXPANSION — no new source
 * format, no new mapping affordance, no new parsing behaviour, no new column
 * read out of a spreadsheet. This field adds none of those. It closes a
 * BYPASS: INV-083 says «contract_versions.publish and import_batches.publish
 * both REFUSE a version that carries no contract_version_rule_bindings row»,
 * and until this field existed the importer could not carry the set it is
 * required to refuse without, so the one route the pilot actually uses
 * published baselines with no obligations attached while the manual route
 * refused. Closing a gate that an existing route walks around is not
 * expansion; leaving it open is the invariant holding on one route, which
 * INV-083 says is the same as holding on neither.
 *
 * THE MANUAL PATH SPLITS THIS ACROSS TWO COMMANDS AND THIS ONE CANNOT.
 * `contract_versions.bind_rules` binds a DRAFT and `contract_versions.publish`
 * then refuses an unbound draft; the importer creates an already-published
 * version, so there is no draft to bind and no second call to make.
 * `app.guard_rule_binding_window()` (migration 0042 §5) carries an xmin
 * disjunct that exists for exactly this: the binding is permitted against a
 * published version only when that version was created by the same
 * transaction.
 */
export const publishImportBatchRequest = z.object({
  expectedVersion: z.number().int().min(1),
  confirmedManifestHash: z.string().regex(/^[0-9a-f]{64}$/),
  /**
   * The rule-version set to pin to the baseline this publication creates.
   *
   * IT DEFAULTS TO EMPTY AND EMPTY IS REFUSED BY THE COMMAND, not by this
   * schema, and that is deliberate rather than lax. `min(1)` here would answer
   * an unbound publication with 422 VALIDATION_FAILED while the manual route
   * answers 409 RULE_BINDING_REQUIRED with `userAction:
   * bind_rule_versions_then_publish` (technical/error-catalog.csv:120). One
   * refusal on two routes means one CODE on two routes — a client that has to
   * branch on which route it took is a client for which the invariant reads
   * like two different rules.
   *
   * The `max` matches `bindContractVersionRulesRequest`: a resource-exhaustion
   * control (M0 exit gate), not a domain limit.
   */
  ruleVersionIds: z.array(z.string().uuid()).max(500).default([]),
});
export type PublishImportBatchRequest = z.infer<typeof publishImportBatchRequest>;
export interface PublishImportBatchResponse {
  contractVersionId: string;
  versionNo: number;
  workItemCount: number;
  supersedesVersionId: string | null;
  /**
   * How many rule versions this baseline was pinned to. Never zero — a
   * publication that would have produced zero is refused — and returned for the
   * same reason `PublishContractVersionResponse` returns it: the caller can
   * confirm the gate held on the object it just created rather than trusting
   * that it did.
   */
  boundRuleVersionCount: number;
}

export interface ImportRowResultRow {
  rowResultId: string;
  worksheet: string | null;
  sourceRow: number;
  severity: "ok" | "warning" | "blocking";
  errorCodes: string[];
  mapped: unknown;
}
export interface ImportResolutionRow {
  resolutionId: string;
  rowResultId: string;
  chosenBasis: string;
  reason: string;
}
export interface ImportBatchResponse {
  batchId: string;
  workspaceId: string;
  projectId: string;
  contractId: string;
  status: string;
  mappingVersion: number;
  currentAttempt: number;
  rowCount: number | null;
  blockingCount: number | null;
  warningCount: number | null;
  needsResolutionCount: number | null;
  totals: unknown;
  failureCodes: string[];
  sourceManifestHash: string | null;
  publishedVersionId: string | null;
  version: number;
  files: ImportFileRow[];
  rowResults: ImportRowResultRow[];
  resolutions: ImportResolutionRow[];
}
