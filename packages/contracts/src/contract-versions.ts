export interface WorkItemView {
  workItemId: string;
  position: number;
  sourceKey: string | null;
  workCode: string | null;
  description: string;
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

export interface ContractVersionResponse {
  contractVersionId: string;
  contractId: string;
  versionNo: number;
  status: "published";
  publishedAt: string;
  sourceManifestHash: string;
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
