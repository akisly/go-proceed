import type { Tx, TenantContext } from "./tx.js";
import type { OutboxIntent } from "@aktflow/domain";

export async function enqueueOutbox(
  tx: Tx, ctx: TenantContext, intent: OutboxIntent,
): Promise<void> {
  await tx.query(
    `insert into public.transaction_outbox
       (organization_id, topic, aggregate_type, aggregate_id, payload_version, payload)
     values ($1,$2,$3,$4,$5,$6)`,
    [ctx.organizationId, intent.topic, intent.aggregate_type, intent.aggregate_id,
     intent.payload_version, intent.payload],
  );
}
