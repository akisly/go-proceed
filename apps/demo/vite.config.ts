import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Mirrors tsconfig.json's `paths`. Only src/components/ui/** and
    // src/lib/** use it — those are the shadcn-owned files, and the alias is
    // what makes components.json truthful, so a future `shadcn add` writes
    // imports that actually resolve. Application code keeps the relative
    // imports it already uses; one convention per layer, not a half-migration.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    target: "es2022",
    // Keep the Evidence Atlas derivatives as real files so the QA harness can
    // measure per-asset transfer size against the A.3.8 item 13 budget.
    assetsInlineLimit: 4096,
  },
});
