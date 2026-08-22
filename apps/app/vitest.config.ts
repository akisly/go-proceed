import { defineConfig } from "vitest/config";

export default defineConfig({
  // FIX ROUND 1, Task 6: every `.tsx` component in this app (`evidence-
  // card.tsx` included) has NO `import React` anywhere, because Next's own
  // build compiles JSX through the "automatic" runtime
  // (`apps/app/tsconfig.json`'s `"jsx": "preserve"` hands the actual
  // transform to Next/SWC, which defaults to automatic). Vitest's own
  // transform is separate — plain esbuild, defaulting to the CLASSIC
  // runtime (`React.createElement`, `React` required in scope) — so any
  // `.tsx` SOURCE file (not just a test file) rendered under vitest failed
  // with `ReferenceError: React is not defined` before this change, proven
  // by running `evidence-card.test.tsx`/`evidence-by-occurrence.test.tsx`
  // without it. Setting esbuild's own `jsx` to `"automatic"` here makes
  // vitest's transform match what Next actually does, for every `.tsx` file
  // vitest ever touches — not a one-off `import React` in the two new test
  // files, which would have fixed only those two files' OWN JSX and left
  // every component they import still broken.
  esbuild: {
    jsx: "automatic",
  },
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
