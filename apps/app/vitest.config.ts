import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests (tests/*.int.test.ts) share one real local Postgres
    // instance and each truncates overlapping tables (organizations,
    // memberships, ...) in beforeEach. Running test FILES in parallel lets
    // one file's truncate wipe out rows another file's in-flight test just
    // inserted, producing flaky cross-file failures. Unit tests are cheap
    // enough that running everything sequentially costs nothing measurable.
    fileParallelism: false,
  },
});
