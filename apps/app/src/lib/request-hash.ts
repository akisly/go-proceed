import { createHash } from "node:crypto";

/**
 * The request hash `commandRoute` gives `withIdempotency` (DEV-022, BL-112,
 * INV-048).
 *
 * It covers the command's TARGET as well as its body. Until DEV-022 it was the
 * raw body's digest alone, and the idempotency record is keyed on (workspace,
 * actor, operation, key), so a key reused with the same body on another target
 * of the same command — every empty-body command, and any whose body happened
 * to repeat — found the first target's record and replayed its result, and the
 * second target was never touched.
 *
 * The target is the route's resolved path parameters: sorted `[name, value]`
 * pairs, UUID values lower-cased (Postgres resolves either case to the same
 * row, DEV-021 S2-01), anything else as sent. Not the concrete path, which
 * varies by trailing slash, encoding or rewrite, and not the query string or a
 * header: no command reads its target from either, and one that ever does must
 * be bound here too. The operation id, already in the record's key, stands for
 * the method and the route.
 *
 * Pure: no auth, no I/O, so it can be tested and reused without mocks. Changing
 * the envelope changes every stored hash — a retry that spans such a deploy is
 * answered 409 — so the pinned vectors in request-hash.test.ts must move with it.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export const COMMAND_REQUEST_HASH_SCHEME = "goproceed-command-request/1";

export function commandRequestHash(params: Readonly<Record<string, string>>, rawBody: string): string {
  const target = Object.keys(params).sort()
    .map((name) => {
      const value = params[name]!;
      return [name, UUID.test(value) ? value.toLowerCase() : value];
    });
  return sha256(JSON.stringify([COMMAND_REQUEST_HASH_SCHEME, target, sha256(rawBody)]));
}
