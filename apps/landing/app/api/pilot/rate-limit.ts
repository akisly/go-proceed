/**
 * A per-instance brake: five requests per ten minutes per address. It lives
 * in memory, so it resets on a cold start and is not shared between
 * serverless instances — adequate at pilot scale and filed in TODOS.md as
 * such. The map is bounded at 500 addresses: `x-forwarded-for` is
 * attacker-controlled, so an unbounded map would let a script vary the
 * header per request and grow memory without limit within a warm instance.
 * Separate from route.ts because a route file may export only HTTP methods
 * and segment config.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const MAX_KEYS = 500;
const bucket = new Map<string, number[]>();

export function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (bucket.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  bucket.set(ip, recent);

  if (bucket.size > MAX_KEYS) {
    for (const [key, timestamps] of bucket) {
      if (bucket.size <= MAX_KEYS) break;
      if (timestamps.every((t) => now - t >= WINDOW_MS)) bucket.delete(key);
    }
    if (bucket.size > MAX_KEYS) {
      for (const key of bucket.keys()) {
        if (bucket.size <= MAX_KEYS) break;
        bucket.delete(key);
      }
    }
  }

  return recent.length > MAX_PER_WINDOW;
}

/** Test seam. */
export function resetRateLimit(): void { bucket.clear(); }

/** Test seam: the map is bounded at 500 addresses. */
export function bucketSize(): number { return bucket.size; }
