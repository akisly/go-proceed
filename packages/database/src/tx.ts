import type { PoolClient } from "pg";
import { getPool } from "./pool.js";

export interface TenantContext {
  actorUserId: string;
  organizationId: string | null;
  requestId: string;
  membershipVersion?: number;
}
export interface Tx { query: PoolClient["query"] }

export async function withTenantTx<T>(
  ctx: TenantContext, fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  let released = false;
  try {
    await client.query("begin");
    await client.query("set local role aktflow_app");
    await client.query("select set_config('app.actor_user_id', $1, true)", [ctx.actorUserId]);
    await client.query("select set_config('app.organization_id', $1, true)", [ctx.organizationId ?? ""]);
    await client.query("select set_config('app.request_id', $1, true)", [ctx.requestId]);
    await client.query("select set_config('app.membership_version', $1, true)",
      [ctx.membershipVersion != null ? String(ctx.membershipVersion) : ""]);
    const result = await fn({ query: client.query.bind(client) });
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch (rollbackErr) {
      client.release(rollbackErr as Error); // destroy, don't return a poisoned client
      released = true;
    }
    throw err; // always the ORIGINAL error
  } finally {
    if (!released) client.release(); // GUCs are transaction-local; nothing leaks to the pooled connection
  }
}
