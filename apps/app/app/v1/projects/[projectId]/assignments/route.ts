import { queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import type { ListAssignmentsResponse } from "@goproceed/contracts";
import { withTenantTx } from "@goproceed/database";

export const runtime = "nodejs";

export const GET = queryRoute(async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx) => {
    const p = await tx.query(
      `select workspace_id from public.projects where id = $1`, [projectId]);
    if (p.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = p.rows[0].workspace_id;
    const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
    await requireProjectCapability(tx, a.requestId,
      { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });

    // Effective quantity is derived from the entries, never from a cached
    // column: progress is append-only, so the sum is the fact and anything
    // stored alongside it is a second version of the truth.
    const rows = await tx.query(
      `select a.id, a.work_item_id, a.planned_quantity, a.status,
              a.requirement_template_version_id,
              w.work_code, w.description, w.unit_code,
              coalesce((select sum(p.quantity) from public.progress_entries p
                         where p.workspace_id = a.workspace_id
                           and p.work_assignment_id = a.id), 0)::text as effective_quantity
         from public.work_assignments a
         join public.work_items w
           on w.workspace_id = a.workspace_id and w.id = a.work_item_id
        where a.workspace_id = $1 and a.project_id = $2
        order by a.created_at desc, a.id`,
      [workspaceId, projectId]);

    const out: ListAssignmentsResponse = {
      assignments: rows.rows.map((r) => ({
        assignmentId: r.id,
        workItemId: r.work_item_id,
        workCode: r.work_code,
        description: r.description,
        unitCode: r.unit_code,
        plannedQuantity: r.planned_quantity,
        effectiveQuantity: r.effective_quantity,
        status: r.status,
        requirementTemplateVersionId: r.requirement_template_version_id,
      })),
    };
    return out;
  });
  return { status: 200, body };
});
