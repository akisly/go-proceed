import type { Tx, TenantContext } from "./tx";
import type { OutboxIntent } from "@goproceed/domain";

export interface EnqueueOutboxOpts {
  // See RecordAuditOpts.organizationId in audit.ts: bootstrap commands create
  // the org in the same transaction as the outbox row, so ctx.organizationId
  // (set before the org exists) is null; this overrides it for this call only.
  organizationId?: string;
}

export async function enqueueOutbox(
  tx: Tx, ctx: TenantContext, intent: OutboxIntent, opts: EnqueueOutboxOpts = {},
): Promise<void> {
  const organizationId = opts.organizationId ?? ctx.organizationId;
  await tx.query(
    `insert into public.transaction_outbox
       (organization_id, topic, aggregate_type, aggregate_id, payload_version, payload)
     values ($1,$2,$3,$4,$5,$6)`,
    [organizationId, intent.topic, intent.aggregate_type, intent.aggregate_id,
     intent.payload_version, intent.payload],
  );
}
