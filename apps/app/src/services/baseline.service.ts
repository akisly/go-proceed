import type { ContractVersionResponse } from "@goproceed/contracts";
import { apiGet, isSessionExpired } from "../lib/api";
import { getBlockedValue } from "./blocked-value.service";

/**
 * The published baselines a project has, each with its lines — the two picker
 * sources the create form needs, assembled from reads that already ship.
 *
 * WHY THE MONEY READ. `blocked_value.get` is the only operation that returns a
 * project's contract versions at all: its `byBaseline[]` rows carry
 * `contractId`, `contractVersionId` AND `contractVersionNo`
 * (`packages/contracts/src/blocked-value.ts`, `blockedValueBaselineRow`).
 * There is no `contracts.list` and no `contract_versions.list`, and
 * `contract_versions.get` is keyed by NUMBER — which is exactly the field
 * those rows supply. That is why this slice needs no new API, and it is also
 * why slice B exists: a project with no published baseline has no row here,
 * and nothing else can enumerate its contracts.
 */
export interface BaselineOption {
  contractId: string;
  contractVersionId: string;
  contractVersionNo: number;
  workItems: Array<{
    workItemId: string; workCode: string | null; description: string; unitCode: string;
  }>;
}

export type BaselinesResult =
  | { kind: "ok"; baselines: BaselineOption[] }
  | { kind: "session_expired" }
  | { kind: "error"; error: unknown };

export async function listPublishedBaselines(projectId: string): Promise<BaselinesResult> {
  const money = await getBlockedValue(projectId);
  if (money.kind === "session_expired") return { kind: "session_expired" };
  if (money.kind !== "ok") return { kind: "error", error: money };

  try {
    const baselines = await Promise.all(
      money.blockedValue.byBaseline.map(async (row): Promise<BaselineOption> => {
        const version = await apiGet<ContractVersionResponse>(
          `/v1/contracts/${row.contractId}/versions/${row.contractVersionNo}`,
        );
        return {
          contractId: row.contractId,
          contractVersionId: row.contractVersionId,
          contractVersionNo: row.contractVersionNo,
          workItems: version.workItems.map((w) => ({
            workItemId: w.workItemId,
            workCode: w.workCode ?? null,
            description: w.description,
            unitCode: w.unitCode,
          })),
        };
      }),
    );
    return { kind: "ok", baselines };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    return { kind: "error", error };
  }
}
