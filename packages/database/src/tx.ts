import type { PoolClient } from "pg";
import { getPool, getPurgePool, getServicePool } from "./pool";

export interface TenantContext {
  /**
   * The Supabase user id, or "" on the EXTERNAL plane, where there is no
   * account at all. `app.current_actor()` is `nullif(...,'')::uuid`, so ""
   * resolves to SQL NULL and every member policy in this database — all of
   * which key off it — denies every row.
   */
  actorUserId: string;
  organizationId: string | null;
  requestId: string;
  membershipVersion?: number;
  /**
   * v0.1-M5. The external session this transaction acts as, or undefined.
   * Set ONLY by `withExternalTx`; `withTenantTx` and `withServiceTx` always
   * clear it, and GUCs are transaction-local so nothing survives into the
   * pooled connection.
   */
  externalSessionId?: string | null;
}
export interface Tx { query: PoolClient["query"] }

async function runTx<T>(
  pool: ReturnType<typeof getPool>, role: string,
  ctx: TenantContext, fn: (tx: Tx) => Promise<T>,
  afterRole?: (client: PoolClient) => Promise<void>,
): Promise<T> {
  const client = await pool.connect();
  let released = false;
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    if (afterRole) await afterRole(client);
    await client.query("select set_config('app.actor_user_id', $1, true)", [ctx.actorUserId]);
    await client.query("select set_config('app.organization_id', $1, true)", [ctx.organizationId ?? ""]);
    await client.query("select set_config('app.request_id', $1, true)", [ctx.requestId]);
    await client.query("select set_config('app.membership_version', $1, true)",
      [ctx.membershipVersion != null ? String(ctx.membershipVersion) : ""]);
    // SET UNCONDITIONALLY, INCLUDING TO "". Every path through this function
    // writes this GUC, so a member transaction cannot inherit an external
    // session from anywhere — not from a caller that reused a context object,
    // not from a pooled connection, not from a future overload. `set_config`
    // with is_local = true is rolled back with the transaction regardless.
    await client.query("select set_config('app.external_session_id', $1, true)",
      [ctx.externalSessionId ?? ""]);
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
  // The external session is CLEARED here rather than passed through, whatever
  // the caller put in the context. A member transaction is a member
  // transaction.
  return runTx(getPool(), "goproceed_app", { ...ctx, externalSessionId: null }, fn);
}

/**
 * A transaction on the EXTERNAL plane (v0.1-M5).
 *
 * Same pool, same `goproceed_app` role, same `NOBYPASSRLS` posture — and a
 * different subject. `app.actor_user_id` is forced to "" and
 * `app.external_session_id` carries the session, so:
 *
 *   * every member policy in this database evaluates
 *     `m.user_id = app.current_actor()` against NULL and matches nothing;
 *   * the SIXTEEN external policies migration 0049 §10 adds, over TEN tables,
 *     read an external subject function — ten of them
 *     `app.external_session_occurrence()`, which resolves ONE occurrence for a
 *     live session and NULL for an expired, revoked or replaced one.
 *
 * (The count said «nine» until 2026-08-08, matching nothing: not the sixteen
 * policies, not the ten tables, not the eight of those ten that are readable
 * from this plane. It had never been counted against the migration. The test
 * named below now counts it from `pg_policies` on every run, so the number in
 * this comment cannot drift again without a red suite.)
 *
 * There is no third database role and that is a decision, not an omission. A
 * separate login would need a credential in the secret manager, a third pool, a
 * third entry in `scripts/set-local-app-password.mjs` and a CI change, and it
 * would buy nothing that the empty actor GUC does not already buy: with no
 * actor, `goproceed_app`'s grants reach no row on any table that has no external
 * policy, because RLS with no matching policy denies. The residual risk it does
 * NOT close is a table gaining a permissive policy that reads neither subject —
 * `packages/testing/src/m5-external-rls.test.ts` is where that is caught, by
 * sweeping every base table from an external session and asserting the reachable
 * set. That file EXISTS as of 2026-08-08; between M5 and that date this
 * paragraph named a mitigation that had not been written, which is the worst
 * shape a security note can take, because it reads as coverage.
 *
 * `app.current_external_session()` additionally returns NULL whenever an actor
 * GUC is set, so a transaction that somehow carried both collapses towards the
 * MEMBER plane — the one that requires a real active membership to see anything
 * — rather than towards the anonymous one.
 */
export async function withExternalTx<T>(
  ctx: Omit<TenantContext, "actorUserId" | "membershipVersion"> & { externalSessionId: string },
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  // `membershipVersion` is OMITTED, not set to undefined: with
  // `exactOptionalPropertyTypes` the two are different types, and the external
  // plane has no membership to carry a version of. `Omit` already removed it
  // from `ctx`, so spreading and adding nothing is the accurate expression —
  // writing `membershipVersion: undefined` claimed a key this plane does not
  // have.
  return runTx(getPool(), "goproceed_app", { ...ctx, actorUserId: "" }, fn);
}

/**
 * A transaction with NEITHER subject, for the two subject-less steps of the
 * external protocol: the token exchange (there is no session yet) and the
 * cookie resolution (the session is what we are looking up).
 *
 * It can reach exactly two things: `app.exchange_external_grant` and
 * `app.resolve_external_session`, both `SECURITY DEFINER`, both bounded to one
 * lookup by a 256-bit keyed verifier, both granted to `goproceed_app` alone
 * (migration 0049 §7). Every table policy denies it, which is the point: an
 * anonymous transaction that could read a table would be the hole this whole
 * plane exists to avoid.
 */
export async function withAnonymousTx<T>(
  ctx: { requestId: string }, fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return runTx(getPool(), "goproceed_app",
    { actorUserId: "", organizationId: null, requestId: ctx.requestId,
      externalSessionId: null }, fn);
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
  return runTx(getServicePool(), "goproceed_service",
    { ...ctx, externalSessionId: null }, fn, async (client) => {
    // Checked on every service transaction, because the boundary is a property
    // of the CONNECTION and nothing in the database can tell us it was wired
    // correctly. The guard in migration 0035 asks pg_has_role(session_user,
    // 'goproceed_service', 'member'), which is TRUE for a superuser: point
    // SERVICE_DB_URL at the postgres URL by mistake and every check passes, the
    // server-attested columns keep being written, and nothing anywhere reports
    // a symptom. Pointed at APP_DB_URL it fails closed on its own (42501), so
    // this is the one misconfiguration that needs the application to refuse
    // rather than trust its own configuration.
    const who = await client.query<{ ok: boolean }>(
      "select session_user = 'goproceed_service_login' as ok");
    if (who.rows[0]?.ok !== true) {
      throw new Error(
        "SERVICE_DB_URL is not the service login; refusing to write server-attested facts");
    }
  });
}

/**
 * Declare the workspace a service transaction is acting for, once it has been
 * RESOLVED rather than supplied — a Telegram verifier hash, a bot/chat pair.
 * `withServiceTx` sets `app.organization_id` from the context it was given,
 * which for these paths is null because the tenant is the OUTPUT of the first
 * statement, not an input to it.
 *
 * This is a declaration, exactly like the one `withServiceTx` makes, and it
 * carries the same weight: `app.service_workspace()` confines every subsequent
 * statement to this workspace. It does not authorize anything, and it MUST be
 * called with a workspace a SECURITY DEFINER lookup just returned — never with
 * one parsed out of provider input. Nothing in the database enforces that
 * discipline; a caller that passes a webhook-supplied workspace gets exactly
 * the cross-tenant write the confinement was meant to stop.
 *
 * `set_config(..., true)` is transaction-local and is rolled back with the
 * transaction, so nothing reaches the pooled connection (see runTx's note).
 */
export async function adoptServiceWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  await tx.query("select set_config('app.organization_id', $1, true)", [workspaceId]);
}

/**
 * A transaction on the evidence purge worker's connection (DEV-036).
 *
 * No actor and no workspace: the purge crosses tenants by nature, and the
 * functions it may call (migration 0090) take neither. Keep each one short —
 * one claim, or one completion — because the byte deletion between them is
 * HTTP to Storage and must not hold a connection in `begin`.
 */
export async function withPurgeWorkerTx<T>(
  ctx: { requestId: string }, fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return runTx(getPurgePool(), "goproceed_purge_worker",
    { actorUserId: "", organizationId: null, requestId: ctx.requestId, externalSessionId: null },
    fn, async (client) => {
      // The same reason as withServiceTx: a superuser URL passes every role
      // check, so the connection is asked who it is. `set local role` has
      // already refused any login that is not a member of the purge role.
      const who = await client.query<{ ok: boolean }>(
        "select session_user = 'goproceed_purge_worker_login' as ok");
      if (who.rows[0]?.ok !== true) {
        throw new Error("PURGE_DB_URL is not the purge login; refusing to purge");
      }
    });
}
