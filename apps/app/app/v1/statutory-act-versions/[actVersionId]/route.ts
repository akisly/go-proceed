import { queryRoute } from "../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../src/lib/http";
import { withTenantTx } from "@goproceed/database";
import { loadActVersionView, locateActVersion } from "../../../../src/lib/statutory-act";

export const runtime = "nodejs";

/**
 * `statutory_acts.get` — GET /v1/statutory-act-versions/{actVersionId}
 * (technical/openapi/scope-v0.1.csv:51; query, natural idempotency, member
 * plane, governed by `statutory_acts.compose`).
 *
 * IT RETURNS RECORDED FACTS, NOT A DOCUMENT. This route names no field of
 * Додаток В and lays out no form: it returns the act's scope, its lineage, its
 * form citation with the citation's tag and source, the printed quantity lines
 * with the recorded quantities they are shares of, the three typed slots with
 * the strings they froze and which record each came from, and the decision
 * blocks read through the closure's frozen occurrence set. The laid-out form is
 * `statutory_acts.render`'s job and refuses on its own terms.
 *
 * IT IS THE COMPOSER'S ONLY PRE-FREEZE VIEW, and that is a consequence of a
 * judgement made in the render route: `statutory_acts.render` refuses a draft,
 * so a composer checks their work here — against the facts — and not against a
 * laid-out preview. See that route's header for the trade.
 *
 * WHY `statutory_acts.compose` GOVERNS A READ. capabilities.csv:32 puts all four
 * M4 operations behind that one capability_id, so a member who may READ an act
 * may also COMPOSE one. That is uncomfortable and it is the catalog's shape, not
 * this route's: widening the read to `project.view` would be a permissions
 * decision taken in a route. Migration 0047 §11 item 6 records it. The second
 * half of that record — that `statutory_acts.compose` «appears in no
 * responsibility preset at all» — was CLOSED 2026-08-17: it is on `pto_engineer`.
 * The read/compose coupling above is untouched by that and is still the catalog's
 * shape.
 *
 * `project.view` IS REQUIRED BESIDE IT for the reason `readiness.get` gives: the
 * decision blocks come from `public.stage_closure_occurrences` and
 * `public.requirement_occurrences`, and the quantity lines join
 * `public.work_items` — all behind `project.view`/`project.admin`. An actor
 * without it would get an act with no decisions and no unit codes, which is an
 * EMPTY ANSWER rather than a denial and is the worst of the three outcomes.
 *
 * A 404 FOR AN ACT IN ANOTHER WORKSPACE IS DELIBERATE (INV-001/INV-002): the row
 * is invisible to `sav_select`, so nothing here can be used as an oracle. The
 * cost is that a member of the right workspace who merely lacks the capability
 * also gets a 404 rather than a 403 — a `project.admin` still gets the 403,
 * because the policy admits them and this route then refuses them by name.
 *
 * NOTHING HERE WAS EXECUTED: no test run, no route invoked, no migration applied.
 */
export const GET = queryRoute(async (a) => {
  const actVersionId = a.params.actVersionId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Версію акта не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!actVersionId) throw notFound;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx) => {
    const located = await locateActVersion(tx, actVersionId);
    if (!located) throw notFound;

    const m = await requireActiveMembership(tx, a.requestId, a.userId, located.workspaceId);
    await requireProjectCapability(tx, a.requestId, {
      workspaceId: located.workspaceId, projectId: located.projectId,
      memberId: m.memberId, capability: "project.view",
    });
    await requireProjectCapability(tx, a.requestId, {
      workspaceId: located.workspaceId, projectId: located.projectId,
      memberId: m.memberId, capability: "statutory_acts.compose",
    });

    const view = await loadActVersionView(tx, located.workspaceId, actVersionId);
    if (!view) throw notFound;
    return view;
  });
  return { status: 200, body };
});
