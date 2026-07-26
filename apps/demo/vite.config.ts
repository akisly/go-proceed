import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2022",
    // Keep the Evidence Atlas derivatives as real files so the QA harness can
    // measure per-asset transfer size against the A.3.8 item 13 budget.
    assetsInlineLimit: 4096,
  },
});
