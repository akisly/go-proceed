import { defineConfig } from "vitest/config";

// Node environment, not jsdom or an RN one: `src/lib/api.ts` and its
// dependencies (`src/lib/env.ts`, `src/lib/supabase.ts`) are pure
// fetch/session logic with no react-native import anywhere in their module
// graph — see the comment at the top of api.ts. Keeping this suite node-only
// is what makes that constraint enforceable: a stray react-native import
// would fail to resolve under plain Node rather than silently working under
// jsdom.
//
// `env` below stands in for `apps/mobile/.env` (this repo's local dev
// values, not a secret — see `.env.example`) so that `src/lib/env.ts`'s
// required-var checks pass at import time; nothing here talks to a real
// Supabase project or a real `/v1` server.
export default defineConfig({
  test: {
    environment: "node",
    // The vault module's build scripts are plain Node too (minisign.mjs).
    include: ["src/**/*.test.ts", "modules/goproceed-vault/scripts/*.test.mjs"],
    env: {
      EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      EXPO_PUBLIC_API_ORIGIN: "http://localhost:3000",
    },
  },
});
