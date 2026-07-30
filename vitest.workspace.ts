// Root vitest discovers per-package projects instead of running every test
// file under a bare default config. Without this, `vitest run` from the repo
// root ignored apps/demo/vitest.config.ts and its `@` alias, so the three
// demo suites failed collection with "Cannot find package '@/lib/utils'"
// while per-package runs were green (baseline-verification.md, 2026-07-30
// correction). Entries without a vitest.config.ts run with defaults rooted
// at their directory.
export default [
  "apps/app/vitest.config.ts",
  "apps/demo/vitest.config.ts",
  "packages/database",
  "packages/testing",
  "supabase/functions/outbox-drain",
];
