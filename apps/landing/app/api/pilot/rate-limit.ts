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
  const recent = bucket.get(ip) ?? [];

  // Timestamps are appended in order, so everything expired is a PREFIX: find
  // where the live ones begin and cut once, in place. `filter` allocated a new
  // array on every request instead — including the requests being rejected.
  let expired = 0;
  while (expired < recent.length && now - recent[expired]! >= WINDOW_MS) expired++;
  if (expired > 0) recent.splice(0, expired);

  // A REJECTED request is not recorded. Pushing unconditionally made one
  // address's array grow once per request for the whole window, and the prune
  // above then had to walk all of it — the component whose job is to stop a
  // flood grew with the flood. Deciding before the push caps every key's array
  // at MAX_PER_WINDOW entries, so a hundred rejected calls cost nothing.
  //
  // The decision has to happen BEFORE the map is written, because the eviction
  // pass below treats a key whose timestamps have all expired as free to drop —
  // and `[].every(…)` is `true`, so storing an empty array first would make the
  // limiter evict the very key it was called about.
  const limited = recent.length >= MAX_PER_WINDOW;
  if (!limited) recent.push(now);
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

  return limited;
}

/** Test seam. */
export function resetRateLimit(): void { bucket.clear(); }

/** Test seam: the map is bounded at 500 addresses. */
export function bucketSize(): number { return bucket.size; }

/** Test seam: one key's array is bounded at MAX_PER_WINDOW entries. */
export function bucketEntries(ip: string): number { return bucket.get(ip)?.length ?? 0; }
