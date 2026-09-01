import type { Tx } from "./tx";
import type { TenantContext } from "./tx";
import type { AuditIntent } from "@goproceed/domain";

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
  const actorType = opts.actorType ?? "user";
  if (actorType === "system" || actorType === "worker") {
    // The service plane, which has no account and therefore no membership to
    // satisfy `audit_insert` (0006) and no session to satisfy
    // `audit_insert_external` (0049). It writes through a definer that forces
    // actor_user_id null, refuses any actor_type that could read as a person's
    // act, and refuses any workspace other than the one the transaction
    // declared. Branching here rather than at each call site so a new
    // service-plane audit cannot be written without the guard.
    await tx.query(
      `select app.record_service_audit($1::uuid, $2::text, $3::text, $4::text,
         $5::text, $6::text, $7::jsonb, $8::bigint, $9::text)`,
      [organizationId, actorType, intent.action, intent.object_type, intent.object_id,
       ctx.requestId, intent.details, opts.objectVersion ?? null, opts.reasonCode ?? null],
    );
    return;
  }
  await tx.query(
    `insert into public.audit_events
       (organization_id, actor_user_id, actor_type, action, object_type, object_id,
        request_id, details, object_version, reason_code)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    // `ctx.actorUserId || null`, added by v0.1-M5. On the external plane there
    // is NO account: `withExternalTx` sets the actor GUC to "" and this context
    // carries the same "", which is not a uuid and would be a 22P02 rather than
    // an audit row. `public.audit_events.actor_user_id` is nullable and
    // `actor_type` has carried 'external' since 0002, so the shape was always
    // there; the coercion is what makes it reachable. An empty string is never
    // a valid actor on the member plane either, so nothing else changes.
    [organizationId, ctx.actorUserId || null, actorType,
     intent.action, intent.object_type, intent.object_id,
     ctx.requestId, intent.details, opts.objectVersion ?? null, opts.reasonCode ?? null],
  );
}
