import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Every file in this package hits the SAME local Postgres and
    // rls.test.ts resets the whole database; parallel files would race.
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
  },
});
