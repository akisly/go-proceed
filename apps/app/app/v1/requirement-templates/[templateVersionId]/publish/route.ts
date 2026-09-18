import { createHash } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireWorkspaceCapability, type ActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  publishRequirementTemplateRequest, type PublishRequirementTemplateResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";

export const runtime = "nodejs";

export const POST = commandRoute(publishRequirementTemplateRequest, async (a) => {
  const templateVersionId = a.params.templateVersionId;
  if (!templateVersionId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Версію шаблону не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND",
    "Версію шаблону не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    // Resolve the workspace before opening the idempotency scope: the scope is
    // keyed on it. RLS is not yet in play here (organizationId is null), so the
    // membership check below is what makes this row readable to this actor.
    const found = await tx.query(
      `select workspace_id from public.requirement_template_versions where id = $1`,
      [templateVersionId]);
    if (found.rows.length === 0) throw notFound;
    const workspaceId: string = found.rows[0].workspace_id;

    return withIdempotency<PublishRequirementTemplateResponse, ActiveMembership>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "requirement_templates.publish", key: a.idempotencyKey,
      requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        requireWorkspaceCapability(a.requestId, m.role, "requirement_templates.manage");
        return m;
      },
    }, async (m) => {
      const row = await tx.query(
        `select template_key, version_no, status, evidence_type,
                allowed_media, multiplicity, severity
           from public.requirement_template_versions
          where workspace_id = $1 and id = $2
          for update`,
        [workspaceId, templateVersionId]);
      if (row.rows.length === 0) throw notFound;
      const t = row.rows[0];

      if (t.status === "published") {
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Цю версію шаблону вже опубліковано.",
          { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
      }

      // Fixed key order, so identical frozen content always hashes identically.
      // Only the fields M2-A actually freezes take part; the M3 columns are
      // still at their defaults and are not part of the agreement yet.
      const frozen = JSON.stringify({
        templateKey: t.template_key,
        versionNo: t.version_no,
        evidenceType: t.evidence_type,
        allowedMedia: t.allowed_media,
        multiplicity: t.multiplicity,
        severity: t.severity,
      });
      const templateHash = createHash("sha256").update(frozen).digest("hex");

      await tx.query(
        `update public.requirement_template_versions
            set status = 'published', template_hash = $3,
                published_at = now(), published_by_member_id = $4
          where workspace_id = $1 and id = $2`,
        [workspaceId, templateVersionId, templateHash, m.memberId]);

      await recordAudit(tx, ctx, {
        action: "requirement_template.published", object_type: "requirement_template_version",
        object_id: templateVersionId,
        details: { templateKey: t.template_key, versionNo: t.version_no, templateHash },
      }, { organizationId: workspaceId, objectVersion: Number(t.version_no) });
      await enqueueOutbox(tx, ctx, {
        topic: "requirement_template.published", aggregate_type: "requirement_template_version",
        aggregate_id: templateVersionId, payload_version: 1,
        payload: { workspaceId, templateVersionId, templateKey: t.template_key,
                   versionNo: Number(t.version_no), templateHash },
      }, { organizationId: workspaceId });

      return {
        status: 200,
        body: { templateVersionId, templateHash, versionNo: Number(t.version_no) },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
