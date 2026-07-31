import type { PoolClient } from "pg";
import { getPool, getServicePool } from "./pool";

export interface TenantContext {
  actorUserId: string;
  organizationId: string | null;
  requestId: string;
  membershipVersion?: number;
}
export interface Tx { query: PoolClient["query"] }

async function runTx<T>(
  pool: ReturnType<typeof getPool>, role: string,
  ctx: TenantContext, fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let released = false;
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
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

export async function withTenantTx<T>(
  ctx: TenantContext, fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return runTx(getPool(), "aktflow_app", ctx, fn);
}

/**
 * A transaction on the server's own connection.
 *
 * Same shape as withTenantTx, and it still carries the actor GUC: this is the
 * server acting ON BEHALF OF a member, so ownership and capability checks keep
 * working exactly as they did. The service principal authorizes nothing by
 * itself; it only vouches for what the server observed.
 *
 * Use it for writes made AFTER the server has looked at the bytes. Reads and
 * authorization stay on withTenantTx, so an ordinary request never touches this
 * connection.
 */
export async function withServiceTx<T>(
  ctx: TenantContext, fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return runTx(getServicePool(), "aktflow_service", ctx, fn);
}
