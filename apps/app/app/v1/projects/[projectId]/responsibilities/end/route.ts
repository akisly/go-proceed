import { commandRoute } from "../../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../../src/lib/http";
import {
  endResponsibilityRequest, endResponsibilityResponse, type EndResponsibilityResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `project_responsibilities.end` — POST /v1/projects/{projectId}/responsibilities/end
 * (ADR-014 decisions 2 and 3, DEV-044, BL-015).
 *
 * An assignment is an append-only fact (0013), so one written without
 * `valid_until` was permanent and the assign route's separation-of-duties
 * warnings kept counting it. This ends every assignment of the (member,
 * responsibility) pair that is live or has not started yet, at the moment of the
 * command, by appending one row per assignment to
 * `project_responsibility_assignment_ends` (0097). An end before an assignment's
 * `valid_from` cancels it. No date is accepted (owner, 2026-09-23).
 *
 * ORDER, as `project_access.revoke`: the project is resolved under RLS first
 * (404 to anyone without view on it), `authorize` requires `project.admin`
 * before any replay, and `commandRoute` hashes the path with the body.
 *
 * THE TARGET MAY HAVE ANY MEMBERSHIP STATUS: ending an ex-member's
 * accountability is part of offboarding.
 *
 * CONCURRENCY. The application role cannot lock assignment rows (it holds no
 * UPDATE on them), so the one-end-per-assignment key serializes: a concurrent
 * end of the same pair waits on it and then inserts nothing, which is 409 like
 * any other end with nothing left to end. Access is untouched (INV-021).
 */
export const POST = commandRoute(endResponsibilityRequest, async (a) => {
  const pathId = a.params.projectId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!pathId || !UUID.test(pathId)) throw notFound;
  const projectId = pathId.toLowerCase();

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const p = await tx.query<{ workspace_id: string }>(
      "select workspace_id from public.projects where id = $1", [projectId]);
    if (p.rows.length === 0) throw notFound;
    const workspaceId = p.rows[0]!.workspace_id;

    return withIdempotency<EndResponsibilityResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "project_responsibilities.end", key: a.idempotencyKey, requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "project.admin" });
      },
    }, async () => {
      const target = await tx.query(
        "select 1 from public.memberships where organization_id = $1 and id = $2", [workspaceId, a.body.memberId]);
      if (target.rows.length === 0) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Учасника не знайдено в цьому робочому просторі.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "memberId", message: "not a member of this workspace" }],
          }));
      }

      const nothingToEnd = () => new HttpProblem(409, problem("VERSION_CONFLICT",
        "Немає чинного або майбутнього призначення цієї відповідальності, яке можна завершити.", {
          requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry",
        }));

      const open = await tx.query<{ id: string }>(
        `select a.id from public.project_responsibility_assignments a
          where a.workspace_id = $1 and a.project_id = $2 and a.member_id = $3 and a.responsibility = $4
            and (a.valid_until is null or a.valid_until > now())
            and not exists (select 1 from public.project_responsibility_assignment_ends e
                             where e.workspace_id = a.workspace_id and e.assignment_id = a.id)
          order by a.id`,
        [workspaceId, projectId, a.body.memberId, a.body.responsibility]);
      if (open.rows.length === 0) throw nothingToEnd();

      const ended = await tx.query<{ assignment_id: string }>(
        `insert into public.project_responsibility_assignment_ends (workspace_id, project_id, assignment_id, ended_by)
         select $1, $2, x, $4 from unnest($3::uuid[]) as x
         on conflict on constraint prae_one_end_per_assignment_key do nothing
         returning assignment_id`,
        [workspaceId, projectId, open.rows.map((r) => r.id), a.userId]);
      if (ended.rows.length === 0) throw nothingToEnd();

      const ids = ended.rows.map((r) => r.assignment_id).sort();
      for (const assignmentId of ids) {
        await recordAudit(tx, ctx, {
          action: "project_responsibility.ended", object_type: "project_responsibility_assignment",
          object_id: assignmentId,
          details: { memberId: a.body.memberId, responsibility: a.body.responsibility },
        }, { organizationId: workspaceId });
      }
      return { status: 200, body: endResponsibilityResponse.parse({ ended: ids.map((assignmentId) => ({ assignmentId })) }) };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
