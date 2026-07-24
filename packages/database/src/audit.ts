import type { Tx } from "./tx.js";
import type { TenantContext } from "./tx.js";
import type { AuditIntent } from "@aktflow/domain";

export async function recordAudit(
  tx: Tx, ctx: TenantContext, intent: AuditIntent,
  opts: { objectVersion?: number; reasonCode?: string } = {},
): Promise<void> {
  await tx.query(
    `insert into public.audit_events
       (organization_id, actor_user_id, actor_type, action, object_type, object_id,
        request_id, details, object_version, reason_code)
     values ($1,$2,'user',$3,$4,$5,$6,$7,$8,$9)`,
    [ctx.organizationId, ctx.actorUserId, intent.action, intent.object_type, intent.object_id,
     ctx.requestId, intent.details, opts.objectVersion ?? null, opts.reasonCode ?? null],
  );
}
