import { queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { readinessResponse } from "@goproceed/contracts";
import { withTenantTx } from "@goproceed/database";
import {
  READINESS_ALGORITHM_VERSION, assignmentValuations, evaluateStages, stageReadinessViewOf,
} from "../../../../../src/lib/readiness";

export const runtime = "nodejs";

/**
 * `readiness.get` — GET /v1/projects/{projectId}/readiness
 * (technical/openapi/scope-v0.1.csv:47; query, idempotency natural, member
 * plane, governed by `readiness.view`).
 *
 * IT COMPUTES THE SAME PREDICATE THE CLOSURE COMMAND REFUSES ON, from the same
 * function — `evaluateStages` in src/lib/readiness.ts. Not «a second
 * implementation that matches»: there is one implementation, and this route and
 * `stage_closures.create` are two callers of it. The failure this rules out is
 * the one that is invisible until it costs a day on site — a screen that says
 * ready and a command that refuses, or worse, a screen that says blocked and a
 * command that closes.
 *
 * IT DOES NOT READ `public.readiness_projection`. That table is built by
 * migration 0045 §7 with a write grant to `aktflow_service` alone and is WRITTEN
 * BY NOTHING: there is no projection rebuilder in this repository, and
 * `supabase/functions/outbox-drain/index.ts` records that drained rows have no
 * deployed consumer. A route that read it would answer `{stages: []}` in every
 * real workspace while passing any fixture that inserted rows by hand — M1 review
 * finding 2, one milestone later. `source: "computed"` says so on the wire.
 *
 * WHAT THAT COSTS, stated rather than discovered: every call recomputes, three
 * queries regardless of stage count but O(stages × occurrences) in rows. At pilot
 * scale that is a handful of rows; it is not the shape a year of production data
 * should keep, and the rebuilder is what changes it. INV-051 — «older projection
 * results cannot overwrite newer» — has nothing to bite on while nothing is
 * stored, and stays owed by the slice that ships the rebuilder together with the
 * `source_watermark` format no document in this package gives.
 *
 * `readiness.view` OR `project.admin`, matching `rp_select` (migration 0045 §10)
 * and capabilities.csv:31. NOT widened to `project.view`: widening the route to
 * route around a permissions gap would hide the gap and put the money read
 * behind a capability the catalog does not put it behind.
 *
 * CORRECTED 2026-08-08 — until this date the header said «`readiness.view` AND
 * `project.admin`, matching `rp_select`» and the code matched neither. The check
 * below asked for a LITERAL `readiness.view` grant, because `requireProjectCapability`
 * implied `project.admin` for `project.view` alone; `rp_select` reads
 * `array['readiness.view','project.admin']` and 0045:1556-1560 says why. A
 * project admin was therefore locked out of the money screen by the route while
 * the database would have answered — M3 review finding 5, raised to HIGH by the
 * v0.1 final review because by then three routes did it. The implication now
 * lives in `IMPLIED_BY_PROJECT_ADMIN` (src/lib/authz.ts) so all three inherit it,
 * and `readiness.view` is STILL in no responsibility preset (0045 §11 item 2):
 * a non-admin member still needs a hand-issued grant, and that gap is the
 * permissions decision this route does not get to take.
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
    // AND `project.view`, WHICH IS A CONSEQUENCE OF COMPUTING RATHER THAN
    // READING, AND IS A FINDING AS MUCH AS A LINE OF CODE.
    //
    // `readiness.view` governs `public.readiness_projection` (`rp_select`,
    // migration 0045 §10) — the table this route deliberately does not read,
    // because nothing writes it. What it DOES read is the authoritative facts:
    // `public.work_stages` (`ws_select`), `public.requirement_occurrences`
    // (`ro_select`) and the two head tables, every one of them behind
    // `project.view` or `project.admin`. An actor holding only `readiness.view`
    // would therefore get `{stages: []}` — not a denial, an EMPTY ANSWER, which
    // is the worst of the three possible outcomes.
    //
    // Requiring it turns that into a legible 403. It also means the v0.1 money
    // screen needs BOTH capabilities, and whatever responsibility preset ends up
    // carrying `readiness.view` must carry `project.view` with it. That coupling
    // disappears on the day a rebuilder writes the projection and this route
    // reads it instead; until then it is real and it is stated here rather than
    // discovered by a pilot owner staring at an empty screen.
    //
    // A `project.admin` holder satisfies BOTH checks on one grant since
    // 2026-08-08 (`IMPLIED_BY_PROJECT_ADMIN` in src/lib/authz.ts), which is the
    // whole of what M3 review finding 5 asked for. The coupling above still
    // binds every OTHER persona, because `project.admin` is the only capability
    // either check implies.
    await requireProjectCapability(tx, a.requestId,
      { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });

    const stages = await evaluateStages(tx, { workspaceId, projectId, stageIds: null });
    const valuations = await assignmentValuations(tx, workspaceId,
      stages.map((s) => s.workAssignmentId));

    const open = stages.filter((s) => s.status === "open");
    return readinessResponse.parse({
      projectId,
      source: "computed",
      algorithmVersion: READINESS_ALGORITHM_VERSION,
      calculatedAt: new Date().toISOString(),
      stages: stages.map((s) => stageReadinessViewOf(s, valuations)),
      summary: {
        stageCount: stages.length,
        // Counted over OPEN stages only: a closed stage is not «closable», it is
        // closed, and folding the two together would make a project look
        // increasingly ready as it finished rather than as it was proved.
        closableCount: open.filter((s) => s.canCloseStage).length,
        blockedCount: open.filter((s) => !s.canCloseStage).length,
        closedCount: stages.filter((s) => s.status !== "open").length,
        // The number that stops «12 of 12 ready» being read as twelve proved
        // stages when it is twelve empty ones (INV-072). Silent non-coverage
        // means there is no gate, and this is the only place a reader learns of
        // it before trusting the dashboard.
        vacuouslyClosableCount: open.filter((s) => s.vacuous).length,
      },
    });
  });
  return { status: 200, body };
});
