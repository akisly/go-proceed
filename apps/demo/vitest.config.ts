import { defineConfig } from "vitest/config";

export default defineConfig({
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
