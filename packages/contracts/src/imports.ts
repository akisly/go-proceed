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

export const publishImportBatchRequest = z.object({
  expectedVersion: z.number().int().min(1),
  confirmedManifestHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type PublishImportBatchRequest = z.infer<typeof publishImportBatchRequest>;
export interface PublishImportBatchResponse {
  contractVersionId: string;
  versionNo: number;
  workItemCount: number;
  supersedesVersionId: string | null;
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
