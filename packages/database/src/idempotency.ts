import type { Tx } from "./tx";

// Retention classes per docs/22-data-api-contract.md:166 and
// technical/error-catalog.csv:14. standard_30d applies to ordinary
// idempotent commands; ledger_400d applies to financial/ledger-affecting
// operations that must stay replayable for the audit retention window.
export const IDEMPOTENCY_CLASS_TTL = { standard_30d: 2_592_000, ledger_400d: 34_560_000 } as const;
export type IdempotencyClass = keyof typeof IDEMPOTENCY_CLASS_TTL;

// docs/22-data-api-contract.md:166 / technical/error-catalog.csv:14: reusing
// an Idempotency-Key with a different request body is a client error
// (409 IDEMPOTENCY_CONFLICT), not a silent replay and not a fresh execution.
export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_CONFLICT";
  constructor() { super("Idempotency-Key reused with a different request body."); }
}

export interface IdempotencyArgs {
  organizationId: string | null;
  actorScope: string;   // e.g. `user:${userId}` - bounds the key to an actor
  operationId: string;  // logical operation, e.g. "organizations.create"
  key: string;          // the Idempotency-Key header value
  requestHash: string;  // 64-char lowercase sha256 hex of the raw request body
  idempotencyClass?: IdempotencyClass; // default "standard_30d"
}
export interface IdempotencyHit<T> { replayed: boolean; status: number; body: T; expiresAt: Date }

/**
 * Idempotency against public.idempotency_records (exact schema.sql shape:
 * unique (organization_id, actor_scope, operation_id, idempotency_key), with a
 * state/response check constraint and a not-null expires_at > created_at).
 * On replay of a completed record, returns the stored status + body + the
 * expires_at to surface as the Idempotency-Replay-Until response header.
 * Same key + a DIFFERENT request hash throws IdempotencyConflictError.
 * Otherwise runs fn and stores a single 'completed' record.
 * MUST run inside a withTenantTx transaction. Requires only SELECT+INSERT grants.
 *
 * Concurrency: takes a transaction-scoped advisory lock (pg_advisory_xact_lock)
 * keyed on the same tuple that uniquely identifies the idempotency record,
 * BEFORE the SELECT. Advisory locks need no table grant (built-in, executable
 * by any role), so this fits inside the deliberately tight select+insert-only
 * grant on idempotency_records. A second concurrent caller with the same key
 * now blocks until the first caller's transaction commits or rolls back; by
 * the time it acquires the lock and re-runs the SELECT, the first caller's
 * row is either visible (completed -> replay, fn() never runs twice) or
 * absent (first caller rolled back -> proceed normally). This closes the
 * duplicate-side-effect race while keeping the single-INSERT, no-UPDATE
 * shape the schema's grants require. Correctness of "lock, then SELECT sees
 * everything the lock-holder committed" relies on READ COMMITTED isolation
 * (withTenantTx's default: each statement in READ COMMITTED sees a fresh
 * snapshot as of when it starts, so the post-lock SELECT is guaranteed to
 * see a just-committed row from the previous lock holder).
 */
export async function withIdempotency<T>(
  tx: Tx, args: IdempotencyArgs, fn: () => Promise<{ status: number; body: T }>,
): Promise<IdempotencyHit<T>> {
  const lockKey = ["idem", args.organizationId ?? "", args.actorScope, args.operationId, args.key].join("|");
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [lockKey]);

  const found = await tx.query(
    `select state, response_status, response_body, request_hash, expires_at
       from public.idempotency_records
      where organization_id is not distinct from $1
        and actor_scope = $2 and operation_id = $3 and idempotency_key = $4`,
    [args.organizationId, args.actorScope, args.operationId, args.key],
  );
  const prior = found.rows[0] as
    | { state: string; response_status: number; response_body: T; request_hash: string; expires_at: Date }
    | undefined;

  if (prior && prior.request_hash !== args.requestHash) {
    throw new IdempotencyConflictError();
  }
  if (prior && prior.state === "completed") {
    return { replayed: true, status: prior.response_status, body: prior.response_body, expiresAt: prior.expires_at };
  }

  const result = await fn();
  const ttl = IDEMPOTENCY_CLASS_TTL[args.idempotencyClass ?? "standard_30d"];
  const ins = await tx.query(
    `insert into public.idempotency_records
       (organization_id, actor_scope, operation_id, idempotency_key, request_hash,
        state, response_status, response_body, response_headers, expires_at, completed_at)
     values ($1,$2,$3,$4,$5,'completed',$6,$7::jsonb,'{}'::jsonb,
             now() + make_interval(secs => $8), now())
     on conflict (organization_id, actor_scope, operation_id, idempotency_key) do nothing
     returning expires_at`,
    [args.organizationId, args.actorScope, args.operationId, args.key, args.requestHash,
     result.status, JSON.stringify(result.body ?? null), ttl],
  );
  if (ins.rowCount === 0) {
    // Another transaction won the race after we took the advisory lock (should
    // not happen under READ COMMITTED + the lock above) - never claim a fresh
    // execution succeeded when nothing was actually persisted for it.
    throw new Error("idempotency record lost a race after the advisory lock");
  }
  return { replayed: false, status: result.status, body: result.body, expiresAt: ins.rows[0].expires_at };
}
