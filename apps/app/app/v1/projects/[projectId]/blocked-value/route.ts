import { queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { blockedValueResponse } from "@goproceed/contracts";
import { withTenantTx } from "@goproceed/database";
import { assignmentValuations, evaluateStages, liveBlockedReasons } from "../../../../../src/lib/readiness";
import { performedNotAdmitted, summariseBlockedValue } from "../../../../../src/lib/blocked-value";

export const runtime = "nodejs";

/**
 * `blocked_value.get` — GET /v1/projects/{projectId}/blocked-value
 * (technical/openapi/scope-v0.1.csv:59; query, idempotency natural, member
 * plane, governed by `readiness.view` — capabilities.csv:31 names this operation
 * in terms, so no capability was invented and no CHECK was widened. **M6 adds no
 * table and no migration**, which is what version-0.1.md §v0.1-M6 means by «a
 * query over `blocked_reasons` and `work_items`».)
 *
 * STEP 6 OF THE PILOT, AND THE LAST OPERATION OF v0.1. «The owner opens one
 * screen and sees what is blocked and how much money sits behind it, broken down
 * by cause.»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS ROUTE DOES NOT DO, listed first because the temptation is real
 *
 *   * IT IS NOT THE SEVEN-STATE VALUE-AT-RISK PROJECTION. ADR-006 decision 5
 *     moves that to v0.2 — five of its seven states name packaging, submission
 *     or internal review — and INV-071, its precedence invariant, has no v0.1
 *     form at all. Nothing here is a workflow state.
 *   * IT COMPUTES NO HEADLINE MEASURE. First-time acceptance rate and
 *     days-to-signature have NO v0.1 definition (glossary.md:218-219,
 *     ADR-005 assumption b), and version-0.1.md §v0.1-M6 settles that neither is
 *     computed inside the product in v0.1: both are recorded beside it, in the
 *     ADR-006 decision 8 pilot record, by the owner. This route therefore
 *     reports blocked value with nothing to report it BESIDE — which is the
 *     M6-cannot-close blocker, not a missing field, and it is recorded in the
 *     progress document rather than papered over with an invented ratio.
 *   * IT CREATES NO ACCOUNTING FACT. Blocked value is exposure, never a
 *     receivable: no entry, no obligation, no cross-currency total anywhere in
 *     the payload (ADR-001's financial boundary; INV-012).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPUTED, NOT READ — the third route to say so, and the reason has not changed
 * since M3: `public.blocked_reasons` is written by nothing, so a route that read
 * it would answer `0` in every real workspace and pass every fixture that
 * inserted rows by hand. The list this sums is `liveBlockedReasons`, the same
 * one `blocked_reasons.get` renders and `stage_closures.create` refuses with.
 *
 * THE ARITHMETIC IS CHECKED ON THE WIRE. `blockedValueResponse.parse` refuses a
 * response whose additive partition does not reconcile to its own totals, whose
 * non-additive view is smaller than its additive one, or whose cause rows name
 * an occurrence that is in no drill-down target (value-at-risk.md
 * §"Reconciliation of the decomposition" and §"Drill-down contract"). A
 * projection error is therefore a 500 here rather than a wrong number on a
 * screen in a meeting with the general contractor.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No route invoked, no query run.
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
    // AND `project.view`, for the reason `readiness.get` states at length: this
    // route reads the AUTHORITATIVE facts — `work_stages`, `requirement_
    // occurrences`, the two heads, `work_items`, `progress_entries` and
    // `valuation_allocations` — every one of them behind `project.view` or
    // `project.admin`, and none behind `readiness.view`. An actor holding only
    // `readiness.view` would be handed a total of ZERO rather than a denial, and
    // a money screen that reports zero because of a missing grant is the worst
    // of the three possible outcomes.
    //
    // THE COUPLING IS A GAP AND NOT A DESIGN: `readiness.view` is in no row of
    // responsibility-presets.csv, so a member who is not a project admin needs
    // both grants issued by hand to open the screen this milestone exists to
    // ship. Recorded, four milestones running, and not routed around here —
    // widening this route to `project.view` alone would hide the gap AND put the
    // money read behind a capability capabilities.csv does not put it behind.
    //
    // NARROWED 2026-08-08: it said «the pilot owner needs both grants issued by
    // hand», and that was true of the code and false of the database. Both
    // checks admit `project.admin` from that date — `rp_select`/`br_select`
    // (migration 0045:1640-1642, :1652-1654) always did, and 0045:1556-1560 says
    // why — so this route was refusing the pilot owner a read the policies
    // behind it would have answered. That is M3 review finding 5, which this
    // route made the third instance of; the fix is one map in src/lib/authz.ts
    // and nothing here changed. The PRESET gap is untouched and still owed.
    await requireProjectCapability(tx, a.requestId,
      { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });

    const stages = await evaluateStages(tx, { workspaceId, projectId, stageIds: null });
    const valuations = await assignmentValuations(tx, workspaceId,
      stages.map((s) => s.workAssignmentId));
    const reasons = liveBlockedReasons(stages, valuations);

    // ADR-008's bucket is read over the PROJECT and not over the blocked stages:
    // its whole point is quantity nobody has tried to close a stage for, so
    // scoping it to stages that are already blocked would empty exactly the
    // case it exists to surface.
    const notAdmitted = await performedNotAdmitted(tx, workspaceId, projectId);

    return blockedValueResponse.parse(summariseBlockedValue({
      projectId,
      calculatedAt: new Date().toISOString(),
      reasons,
      valuations,
      notAdmitted,
    }));
  });
  return { status: 200, body };
});
