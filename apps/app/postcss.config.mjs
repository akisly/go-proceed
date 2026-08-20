/**
 * Next's Tailwind v4 wiring. It replaced the `@tailwindcss/vite` plugin the
 * retired apps/demo used. Next has no Vite plugin pipeline, so v4
 * hooks in as a PostCSS plugin instead — same engine, different entry point.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
