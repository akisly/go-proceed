// Root vitest discovers per-package projects instead of running every test
// file under a bare default config. Without this, `vitest run` from the repo
// root ignored apps/demo/vitest.config.ts and its `@` alias, so the three
// demo suites failed collection with "Cannot find package '@/lib/utils'"
// while per-package runs were green (baseline-verification.md, 2026-07-30
// correction). Entries without a vitest.config.ts run with defaults rooted
// at their directory.
//
// packages/contracts and packages/domain were missing here, so a bare root
// `vitest run` silently skipped 11 files — including the money and allocation
// property walks. `turbo run test` reached them anyway through each package's
// own script, so CI was unaffected; this file existed precisely because a root
// run once diverged from per-package runs, and it still diverged.
//
// supabase/functions/outbox-drain stays listed and stays outside the pnpm
// workspace globs (apps/*, packages/*), so `turbo run test` does NOT reach it
// and its 2 tests are unreachable by the pipeline that certifies them. Moving
// it is a separate change: adding supabase/functions/* to pnpm-workspace.yaml
// forces a lockfile regeneration, and ci.yml runs --frozen-lockfile.
export default [
  "apps/app/vitest.config.ts",
  "apps/demo/vitest.config.ts",
  "packages/contracts",
  "packages/database",
  "packages/domain",
  "packages/testing",
  "supabase/functions/outbox-drain",
];
