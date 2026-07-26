import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest does not read vite.config.ts here (this is its own config file), so
  // the alias has to be repeated. tests/nav.test.ts imports AppShell, which
  // reaches src/components/ui/* and therefore `@/lib/utils`.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Node environment only. Component/DOM behaviour is asserted by the
    // puppeteer harness in qa/, matching the repo's existing split. No jsdom
    // and no @testing-library dependency is introduced.
    environment: "node",
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    // No test files exist until Task 2. Without this, an empty (or
    // filtered) run fails the pipeline instead of passing trivially.
    passWithNoTests: true,
  },
});
