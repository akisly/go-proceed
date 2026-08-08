import { queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { blockedReasonsResponse, type BlockedReason } from "@goproceed/contracts";
import { withTenantTx } from "@goproceed/database";
import {
  READINESS_ALGORITHM_VERSION, assignmentValuations, evaluateStages, liveBlockedReasons,
} from "../../../../../src/lib/readiness";

export const runtime = "nodejs";

/**
 * `blocked_reasons.get` — GET /v1/projects/{projectId}/blocked-reasons
 * (technical/openapi/scope-v0.1.csv:48; query, idempotency natural, member
 * plane, governed by `readiness.view`).
 *
 * «A gate is worth what you can point at in a meeting with the general
 * contractor.» This is that list: one structured object per unsatisfied blocking
 * occurrence — the requirement, its rule version, what is missing by kind and
 * criterion, who owes the decision, since when, the code from the closed
 * versioned vocabulary, and the money (ADR-005 decision 6).
 *
 * THE SAME OBJECTS THE CLOSURE REFUSES WITH. `blockedReasonFor` is the one
 * builder and `stage_closures.create` calls it too, so what a foreman is told on
 * refusal and what the owner reads on this screen cannot describe the same block
 * differently.
 *
 * COMPUTED, NOT READ FROM `public.blocked_reasons` — see the sibling
 * `readiness.get` for the whole of why, and for what it costs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INV-070, AND THE PART OF IT THE PACKAGE DOES NOT SETTLE
 *
 * «Blocked value is attributed once per work assignment; several unmet
 * occurrences on one work reference the same assignment-scoped value and are
 * deduplicated by assignment when summed.» `totalsByCurrency` below sums DISTINCT
 * assignments per currency and never across currencies (INV-012). Three missing
 * requirements on one work therefore report three blocked reasons and one amount.
 *
 * What the package does not settle is what that amount IS. ADR-006 step 6 says
 * «the amount of the work lines under a blocked stage, at the price on the
 * published baseline», and a work assignment is a SLICE of a work item, so two
 * assignments on one line would each attribute the LINE's whole amount and the
 * per-assignment deduplication would not prevent it — migration 0045's header
 * says so in terms and calls it a product decision. `attributeValue` in
 * src/lib/readiness.ts takes the pro-rata reading where a planned quantity exists
 * and the whole-line reading where it does not, and LABELS every row with which
 * one produced it. `wholeLineAttributionCount` carries that label into the
 * totals, so the headline number can never be read without knowing how many of
 * the assignments behind it could over-attribute.
 *
 * A line with no usable price contributes NO money and is counted separately:
 * missing price is unvalued, never zero (INV-038), and folding it into a total as
 * a zero is how «we do not know» becomes «it is free».
 */
export const GET = queryRoute(async (a) => {
  const projectId = a.params.projectId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!projectId) throw notFound;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx) => {
    const p = await tx.query(
      `select workspace_id from public.projects where id = $1`, [projectId]);
    if (p.rows.length === 0) throw notFound;
    const workspaceId: string = p.rows[0].workspace_id;

    const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
    await requireProjectCapability(tx, a.requestId,
      { workspaceId, projectId, memberId: m.memberId, capability: "readiness.view" });
    // AND `project.view` — see the sibling `readiness.get` for the whole
    // argument. Computing from the authoritative facts means reading tables
    // `readiness.view` does not govern, and an actor without `project.view`
    // would be handed an empty list rather than a denial.
    //
    // Both checks admit `project.admin` since 2026-08-08 — `br_select`
    // (migration 0045:1652-1654) always did, and until that date this route did
    // not, so a project admin was refused the blocked-money list the database
    // would have shown them (M3 review finding 5). The implication is central,
    // in `IMPLIED_BY_PROJECT_ADMIN` (src/lib/authz.ts); nothing is widened here.
    await requireProjectCapability(tx, a.requestId,
      { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });

    const stages = await evaluateStages(tx, { workspaceId, projectId, stageIds: null });
    const valuations = await assignmentValuations(tx, workspaceId,
      stages.map((s) => s.workAssignmentId));

    // A CLOSED stage has no live block: its obligations were satisfied at
    // closure, and a reason left on the list after the gate opened would be an
    // exposure figure nobody can act on. THAT RULE NOW LIVES IN ONE PLACE —
    // `liveBlockedReasons` — because `blocked_value.get` (M6) SUMS this exact
    // list, and a filter written twice is a total that stops equalling the list
    // beneath it the first time one copy is edited.
    const reasons: BlockedReason[] = liveBlockedReasons(stages, valuations);

    const byCode = new Map<string, number>();
    for (const r of reasons) byCode.set(r.code, (byCode.get(r.code) ?? 0) + 1);

    // INV-070's deduplication, done here rather than in SQL because the
    // attribution rule that produced each amount is a TypeScript decision and a
    // sum computed anywhere else would be a second opinion about it. The key is
    // the assignment, so several unmet requirements on one work contribute once.
    const perAssignment = new Map<string, BlockedReason>();
    const unvaluedAssignments = new Set<string>();
    for (const r of reasons) {
      if (r.blockedValue === null) { unvaluedAssignments.add(r.workAssignmentId); continue; }
      if (!perAssignment.has(r.workAssignmentId)) perAssignment.set(r.workAssignmentId, r);
    }

    const totals = new Map<string, {
      net: bigint; tax: bigint; gross: bigint; assignments: number; wholeLine: number;
    }>();
    for (const r of perAssignment.values()) {
      const v = r.blockedValue!;
      const t = totals.get(v.currency)
        ?? { net: 0n, tax: 0n, gross: 0n, assignments: 0, wholeLine: 0 };
      t.net += BigInt(v.netMinorUnits);
      t.tax += BigInt(v.taxMinorUnits);
      t.gross += BigInt(v.grossMinorUnits);
      t.assignments += 1;
      if (r.valueAttribution === "whole_line") t.wholeLine += 1;
      totals.set(v.currency, t);
    }

    // Parsed before it goes on the wire: every object here carries a normative
    // citation, and one that reached a screen without its verification tag or its
    // source must fail loudly rather than render as normative (INV-073,
    // hidden-works-content-rules.md).
    return blockedReasonsResponse.parse({
      projectId,
      source: "computed",
      algorithmVersion: READINESS_ALGORITHM_VERSION,
      calculatedAt: new Date().toISOString(),
      blockedReasons: reasons,
      byCode: [...byCode.entries()]
        .sort((x, y) => (x[0] < y[0] ? -1 : 1))
        .map(([code, occurrenceCount]) => ({ code, occurrenceCount })),
      totalsByCurrency: [...totals.entries()]
        .sort((x, y) => (x[0] < y[0] ? -1 : 1))
        .map(([currency, t]) => ({
          currency,
          netMinorUnits: t.net.toString(),
          taxMinorUnits: t.tax.toString(),
          grossMinorUnits: t.gross.toString(),
          assignmentCount: t.assignments,
          wholeLineAttributionCount: t.wholeLine,
        })),
      unvaluedAssignmentCount: unvaluedAssignments.size,
    });
  });
  return { status: 200, body };
});
