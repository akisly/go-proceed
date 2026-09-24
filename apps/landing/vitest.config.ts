import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8 transforms with Oxc; `esbuild` is deprecated there (DEV-069).
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    // Vitest 5's default exclude is only node_modules and .git; name where tests live (DEV-069).
    include: ["tests/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}", "content/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
