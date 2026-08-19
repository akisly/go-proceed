/**
 * Tailwind v4 hooks into Next as a PostCSS plugin — same engine as apps/demo's
 * `@tailwindcss/vite`, different entry point, because Next has no Vite plugin
 * pipeline. Mirrors apps/app/postcss.config.mjs deliberately: two Next apps in
 * one repo compiling Tailwind two different ways is a difference that only
 * ever surprises someone.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
