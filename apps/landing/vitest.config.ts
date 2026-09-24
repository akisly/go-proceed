import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8 transforms with Oxc; `esbuild` is deprecated there (DEV-065).
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
  },
});
