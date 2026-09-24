// Root vitest discovers per-package projects instead of running every test
// file under a bare default config. Entries without a vitest.config.ts run
// with defaults rooted at their directory. (This file was originally written
// because a root run ignored apps/demo's `@` alias while per-package runs were
// green; apps/demo was retired on 2026-08-20, but the divergence it proved is
// why the list is still explicit.)
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
//
// Vitest 4 removed `vitest.workspace.ts` for `test.projects` in a config file
// (BL-061, DEV-069). Vitest 5 no longer searches parent directories for a
// config, so a package without its own `vitest.config.ts` still runs with
// defaults rooted at its directory and never picks this file up.
//
// A root `vitest run` reaches apps/app (truncates tenant tables) AND
// packages/testing (runs `supabase db reset`) together: never run it against
// a local stack whose data matters (root AGENTS.md).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/app/vitest.config.ts",
      "apps/mobile/vitest.config.ts",
      "packages/contracts",
      "packages/database",
      "packages/domain",
      "packages/testing",
      "supabase/functions/outbox-drain",
    ],
  },
});
