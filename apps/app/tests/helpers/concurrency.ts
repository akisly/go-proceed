/**
 * Runs n operations at once and returns every outcome, successes and failures
 * alike. Under contention some callers are expected to lose, and a helper that
 * threw on the first rejection would hide exactly what these tests are for.
 *
 * Parallelism is created INSIDE a test, with its own connections. The runner
 * itself stays serialized (`turbo run test --concurrency=1`) because the suites
 * share one database; relaxing that would trade a real guarantee for a faster
 * wall clock.
 */
export async function inParallel<T>(
  n: number, fn: (i: number) => Promise<T>,
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(Array.from({ length: n }, (_, i) => fn(i)));
}

/** The fulfilled values, in completion order. */
export function fulfilled<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
}
