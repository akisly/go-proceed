import { cookies, headers } from "next/headers";

/**
 * A SERVER COMPONENT'S READ GOES THROUGH THE ROUTE, NOT AROUND IT.
 *
 * Calling `src/lib` directly would be one fewer hop and is the obvious
 * optimisation. It is refused because it would create a second authorization
 * path that has to be kept in step with the first by discipline: the route
 * checks membership, then project capability, then reads under RLS, and a page
 * that assembled its own query would be one edit away from checking less. Going
 * through `/v1` means this page and a future native client are authorised by the
 * same code, which is what ADR-007 decision 3's replaceability rests on.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const h = await headers();
  const c = await cookies();
  const base = process.env.NEXT_PUBLIC_APP_ORIGIN ?? `https://${h.get("host")}`;
  const res = await fetch(new URL(path, base), {
    headers: { cookie: c.toString() },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return await res.json() as T;
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly problem: unknown) { super("api"); }
}
