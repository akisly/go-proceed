import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { assignResponsibilityRequest, type AssignResponsibilityResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";
import { refuseEndNotAfterNow } from "../../../../../src/lib/grant-window";

export const runtime = "nodejs";

// Separation-of-duties pairs (ADR-002: warn, never block).
const SOD_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["performer", "internal_verifier"],
  ["progress_recorder", "internal_verifier"],
  ["package_compiler", "internal_verifier"],
];

export const POST = commandRoute(assignResponsibilityRequest, async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const p = await tx.query(`select workspace_id from public.projects where id = $1`, [projectId]);
    if (p.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = p.rows[0].workspace_id;
    return withIdempotency<AssignResponsibilityResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "project_responsibilities.assign", key: a.idempotencyKey, requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "project.admin" });
      },
    }, async () => {
      // DEV-053 / BL-148: without validFrom the assignment starts at now(); with
      // it, the schema has already compared the two.
      if (a.body.validFrom === undefined) await refuseEndNotAfterNow(tx, a.requestId, a.body.validUntil);
      const target = await tx.query(
        `select 1 from public.memberships where organization_id = $1 and id = $2 and status = 'active'`,
        [workspaceId, a.body.memberId]);
      if (target.rows.length === 0) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Відповідальність можна призначити лише активному учаснику цього робочого простору.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "memberId", message: "not an active member" }],
          }));
      }
      // An ended assignment (DEV-044, 0097) is no longer held, whatever its window said.
      const existing = await tx.query(
        `select distinct a.responsibility from public.project_responsibility_assignments a
          where a.workspace_id=$1 and a.project_id=$2 and a.member_id=$3
            and (a.valid_until is null or a.valid_until > now())
            and not exists (select 1 from public.project_responsibility_assignment_ends e
                             where e.workspace_id = a.workspace_id and e.assignment_id = a.id)`,
        [workspaceId, projectId, a.body.memberId]);
      const held = new Set<string>(existing.rows.map((r: { responsibility: string }) => r.responsibility));
      const warnings = SOD_PAIRS
        .filter(([x, y]) =>
          (a.body.responsibility === x && held.has(y)) || (a.body.responsibility === y && held.has(x)))
        .map(([x, y]) => `sod:${x}+${y}`);
      const assignmentId = randomUUID();
      await tx.query(
        `insert into public.project_responsibility_assignments
           (id, workspace_id, project_id, member_id, responsibility, valid_from, valid_until, assigned_by)
         values ($1,$2,$3,$4,$5, coalesce($6::timestamptz, now()), $7, $8)`,
        [assignmentId, workspaceId, projectId, a.body.memberId, a.body.responsibility,
         a.body.validFrom ?? null, a.body.validUntil ?? null, a.userId]);
      // The explicit SoD fact (ADR-002): recorded, surfaced, never blocking.
      await recordAudit(tx, ctx, {
        action: "project_responsibility.assigned", object_type: "project_responsibility_assignment",
        object_id: assignmentId, details: { responsibility: a.body.responsibility, warnings },
      }, { organizationId: workspaceId });
      return { status: 201, body: { assignmentId, warnings } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
