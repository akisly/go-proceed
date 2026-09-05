/**
 * A per-instance brake: five requests per ten minutes per address. It lives
 * in memory, so it resets on a cold start and is not shared between
 * serverless instances — adequate at pilot scale and filed in TODOS.md as
 * such. Separate from route.ts because a route file may export only HTTP
 * methods and segment config.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const bucket = new Map<string, number[]>();

export function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (bucket.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  bucket.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

/** Test seam. */
export function resetRateLimit(): void { bucket.clear(); }
