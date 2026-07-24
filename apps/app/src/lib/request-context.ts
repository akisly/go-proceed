export function organizationIdFrom(req: Request): string | null {
  return req.headers.get("x-organization-id");
}

export function idempotencyKeyFrom(req: Request): string | null {
  return req.headers.get("idempotency-key");
}
