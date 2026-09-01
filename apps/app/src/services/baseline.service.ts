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
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `forbidden` IS ITS OWN ARM, AND IT WAS FOLDED INTO `error` UNTIL THE FINAL
 * FIX WAVE. `getBlockedValue` returns a dedicated `{kind:"forbidden"}` and
 * this module answered `{ kind: "error", error: money }` to it — which the
 * create route renders as `ShellFatalError`, «щось пішло не так», the copy for
 * a system that broke.
 *
 * NOTHING IS BROKEN IN THAT CASE, AND THE PERSON IS REAL.
 * `blocked_value.get` needs `readiness.view`, which is implied only by
 * `project.admin`; `technical/permissions/responsibility-presets.csv` grants
 * `project.view` WITHOUT it to four presets — `requirement_owner` (line 6),
 * `internal_verifier` (line 8), `package_submitter` (line 9) and `foreman`
 * (line 12). A member holding one of those AND `assignments.manage` opens the
 * register, sees «Нове доручення» (which is rendered with no capability check
 * — nothing client-side can read a capability), presses it, and gets a fatal
 * error on a screen whose real answer is «you may create доручення here, but
 * not read this project's money». They can create an assignment by curl and
 * not by the screen this slice shipped.
 *
 * `blocked-value.service.ts`'s own header argues this at length for its own
 * caller and ends «the refusal needs its own legible state rather than falling
 * through to `error`'s generic wording, for a real persona this product
 * already names». That sentence governs this module too, because this module
 * is the second caller of the same read.
 *
 * THE ARM CARRIES NO `detail`, UNLIKE THE ONE IT FORWARDS — a deliberate
 * narrowing, not an omission. That route has exactly one 403
 * (`SCOPE_PROJECT_DENIED`, «Немає доступу до цього проєкту.»), so the detail is
 * a known constant rather than information; and on THIS screen it is actively
 * misleading, because the reader plainly can reach the project — they
 * navigated here from its own register. The money screen keeps it because
 * there the sentence is on-subject. Nothing is lost that this caller could
 * have rendered.
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
  /** The caller can see the project but not its money — see the header. */
  | { kind: "forbidden" }
  | { kind: "error"; error: unknown };

export async function listPublishedBaselines(projectId: string): Promise<BaselinesResult> {
  const money = await getBlockedValue(projectId);
  if (money.kind === "session_expired") return { kind: "session_expired" };
  if (money.kind === "forbidden") return { kind: "forbidden" };
  // `not_found` STAYS IN `error`, AND ONLY `forbidden` LEAVES IT. A 404 from
  // that route means the caller cannot see the PROJECT at all (RLS returns no
  // row before any capability check runs), and the create route already has a
  // branch for that shape: it looks the project up in `listProjects()` and
  // renders the same generic fatal error for an id that names nothing there.
  // Splitting it out here would give this screen two different renderings of
  // one condition.
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
