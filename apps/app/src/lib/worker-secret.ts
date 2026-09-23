import { timingSafeEqual } from "node:crypto";

/** Compare a presented secret with the configured one without exposing a prefix match. */
export function sameSecret(actual: string | null, expected: string): boolean {
  if (actual === null) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The token of an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}
