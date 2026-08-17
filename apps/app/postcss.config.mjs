/**
 * Next's Tailwind v4 wiring, replacing apps/demo's `@tailwindcss/vite` plugin
 * (see apps/demo/vite.config.ts). Next has no Vite plugin pipeline, so v4
 * hooks in as a PostCSS plugin instead — same engine, different entry point.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
