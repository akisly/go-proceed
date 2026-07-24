import type { Tx } from "./tx.js";

export interface IdempotencyArgs {
  organizationId: string | null;
  actorScope: string;   // e.g. `user:${userId}` - bounds the key to an actor
  operationId: string;  // logical operation, e.g. "organizations.create"
  key: string;          // the Idempotency-Key header value
  requestHash: string;  // 64-char lowercase sha256 hex of the raw request body
  ttlSeconds?: number;  // idempotency window; default 86400 (24h)
}
export interface IdempotencyHit<T> { replayed: boolean; status: number; body: T }

/**
 * Idempotency against public.idempotency_records (exact schema.sql shape:
 * unique (organization_id, actor_scope, operation_id, idempotency_key), with a
 * state/response check constraint and a not-null expires_at > created_at).
 * On replay of a completed record, returns the stored status + body.
 * Otherwise runs fn and stores a single 'completed' record.
 * MUST run inside a withTenantTx transaction. Requires only SELECT+INSERT grants.
 *
 * DEVIATION FROM BRIEF: the brief's version does SELECT, then (if no completed
 * row) calls fn() and INSERTs ... ON CONFLICT DO NOTHING, trusting the unique
 * constraint to prevent duplicate idempotency_records rows on a race. That
 * does prevent duplicate ledger rows, but NOT duplicate domain side effects:
 * two concurrent callers with the same idempotency key can both pass the
 * initial SELECT (neither sees a completed row yet), both execute fn() -
 * e.g. both INSERT a new organization with distinct generated ids - and only
 * then race on the idempotency insert. The loser's INSERT is silently
 * dropped by ON CONFLICT DO NOTHING, but its fn() side effects (the
 * duplicate organization row, in the same still-open transaction) are NOT
 * undone, and the loser returns its own (non-authoritative) response instead
 * of the winner's. That is exactly the "no duplicate rows / return the
 * ORIGINAL response" property this primitive is supposed to guarantee.
 *
 * Fix: take a transaction-scoped advisory lock (pg_advisory_xact_lock) keyed
 * on the same tuple that uniquely identifies the idempotency record, BEFORE
 * the SELECT. Advisory locks need no table grant (built-in, executable by
 * any role), so this fits inside the deliberately tight select+insert-only
 * grant on idempotency_records. A second concurrent caller with the same key
 * now blocks until the first caller's transaction commits or rolls back; by
 * the time it acquires the lock and re-runs the SELECT, the first caller's
 * row is either visible (completed -> replay, fn() never runs twice) or
 * absent (first caller rolled back -> proceed normally). This closes the
 * duplicate-side-effect race while keeping the single-INSERT, no-UPDATE
 * shape the brief specifies.
 */
export async function withIdempotency<T>(
  tx: Tx, args: IdempotencyArgs, fn: () => Promise<{ status: number; body: T }>,
): Promise<IdempotencyHit<T>> {
  const lockKey = [args.organizationId ?? "", args.actorScope, args.operationId, args.key].join("|");
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [lockKey]);

  const found = await tx.query(
    `select state, response_status, response_body
       from public.idempotency_records
      where organization_id is not distinct from $1
        and actor_scope = $2 and operation_id = $3 and idempotency_key = $4`,
    [args.organizationId, args.actorScope, args.operationId, args.key],
  );
  const prior = found.rows[0] as { state: string; response_status: number; response_body: T } | undefined;
  if (prior && prior.state === "completed") {
    return { replayed: true, status: prior.response_status, body: prior.response_body };
  }
  const result = await fn();
  await tx.query(
    `insert into public.idempotency_records
       (organization_id, actor_scope, operation_id, idempotency_key, request_hash,
        state, response_status, response_body, response_headers, expires_at, completed_at)
     values ($1,$2,$3,$4,$5,'completed',$6,$7,'{}'::jsonb,
             now() + make_interval(secs => $8), now())
     on conflict (organization_id, actor_scope, operation_id, idempotency_key) do nothing`,
    [args.organizationId, args.actorScope, args.operationId, args.key, args.requestHash,
     result.status, result.body, args.ttlSeconds ?? 86400],
  );
  return { replayed: false, status: result.status, body: result.body };
}
