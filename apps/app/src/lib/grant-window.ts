import type { Tx } from "@goproceed/database";
import { HttpProblem, problem } from "./http";

/**
 * DEV-053 / BL-148: a window that starts at the transaction's `now()` must end
 * after it, or the insert's CHECK `valid_until > valid_from` (0010) raises 23514
 * and the route answers 500.
 *
 * Checked inside `withIdempotency`'s body, never in the request schema: the
 * clock is a fact, and a replay of a request that was valid when it committed
 * must return the stored response, not 422 (`idempotency.ts`, R1-01). Compared
 * with the transaction's own `now()` — the value the insert uses — so no gap is
 * left between the check and the CHECK.
 */
export async function refuseEndNotAfterNow(tx: Tx, requestId: string, validUntil: string | undefined): Promise<void> {
  if (validUntil === undefined) return;
  const r = await tx.query<{ past: boolean }>("select $1::timestamptz <= now() as past", [validUntil]);
  if (r.rows[0]!.past) {
    throw new HttpProblem(422, problem("VALIDATION_FAILED", "Дата завершення має бути в майбутньому.", {
      requestId, retryable: false, userAction: "correct_fields",
      fieldErrors: [{ path: "validUntil", message: "must be in the future" }],
    }));
  }
}
