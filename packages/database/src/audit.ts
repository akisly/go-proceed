import type { Tx } from "./tx";
import type { TenantContext } from "./tx";
import type { AuditIntent } from "@aktflow/domain";

export interface RecordAuditOpts {
  objectVersion?: number;
  reasonCode?: string;
  // Bootstrap commands (e.g. organization creation) create the org in the
  // same transaction the audit row belongs to, so ctx.organizationId (set
  // before the org exists) is null. Rather than force callers to fabricate a
  // second TenantContext just to carry the freshly-created id, let them pass
  // it here; it overrides ctx.organizationId for this call only.
  organizationId?: string;
  actorType?: "user" | "external" | "system" | "worker";
}

export async function recordAudit(
  tx: Tx, ctx: TenantContext, intent: AuditIntent,
  opts: RecordAuditOpts = {},
): Promise<void> {
  const organizationId = opts.organizationId ?? ctx.organizationId;
  if (!organizationId) throw new Error("recordAudit requires an organization id");
  await tx.query(
    `insert into public.audit_events
       (organization_id, actor_user_id, actor_type, action, object_type, object_id,
        request_id, details, object_version, reason_code)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [organizationId, ctx.actorUserId, opts.actorType ?? "user", intent.action, intent.object_type, intent.object_id,
     ctx.requestId, intent.details, opts.objectVersion ?? null, opts.reasonCode ?? null],
  );
}
