import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireWorkspaceCapability, type ActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  createRequirementTemplateRequest, type CreateRequirementTemplateResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

export const POST = commandRoute(createRequirementTemplateRequest, async (a) => {
  const workspaceId = a.params.workspaceId;
  if (!workspaceId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Робочий простір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) =>
    withIdempotency<CreateRequirementTemplateResponse, ActiveMembership>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "requirement_templates.create", key: a.idempotencyKey,
      requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        requireWorkspaceCapability(a.requestId, m.role, "requirement_templates.manage");
        return m;
      },
    }, async (m) => {
      // Serialize version numbering per template key. max(version_no)+1 read
      // outside a lock lets two concurrent creates compute the same number; the
      // unique constraint would then reject one caller with a raw 23505 instead
      // of giving them version N+1. The advisory lock needs no table grant and
      // releases with the transaction.
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`rtv|${workspaceId}|${a.body.templateKey}`]);

      const prev = await tx.query(
        `select coalesce(max(version_no), 0) as v from public.requirement_template_versions
          where workspace_id = $1 and template_key = $2`,
        [workspaceId, a.body.templateKey]);
      const versionNo = Number(prev.rows[0].v) + 1;

      const id = randomUUID();
      await tx.query(
        `insert into public.requirement_template_versions
           (id, workspace_id, template_key, version_no, status, evidence_type,
            allowed_media, multiplicity, severity, created_by_member_id)
         values ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9)`,
        [id, workspaceId, a.body.templateKey, versionNo, a.body.evidenceType,
         JSON.stringify(a.body.allowedMedia), JSON.stringify(a.body.multiplicity),
         a.body.severity, m.memberId]);

      await recordAudit(tx, ctx, {
        action: "requirement_template.drafted", object_type: "requirement_template_version",
        object_id: id, details: { templateKey: a.body.templateKey, versionNo },
      }, { organizationId: workspaceId });

      return { status: 201, body: { templateVersionId: id, versionNo, version: 1 } };
    }));
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
