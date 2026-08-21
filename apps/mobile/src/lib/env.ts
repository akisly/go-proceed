/**
 * Every `EXPO_PUBLIC_*` read in this file is written as a literal
 * `process.env.EXPO_PUBLIC_…` expression on purpose. Metro only inlines that
 * exact dot-notation form at bundle time — `process.env[name]`,
 * destructuring, or building the key from a variable all silently resolve to
 * `undefined` in a built app. `expo start`'s dev server does NOT have this
 * restriction (there `process.env` is the real Node object), which is why
 * that class of bug survives local testing and only shows up in a build. Do
 * not "simplify" the three reads below into a loop or a shared helper that
 * takes the variable name as an argument.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy apps/mobile/.env.example to apps/mobile/.env and fill it in.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  "EXPO_PUBLIC_SUPABASE_URL",
  process.env.EXPO_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_PUBLISHABLE_KEY = required(
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/** Base origin for every `/v1` call `src/lib/api.ts` makes — apps/app's server. */
export const API_ORIGIN = required(
  "EXPO_PUBLIC_API_ORIGIN",
  process.env.EXPO_PUBLIC_API_ORIGIN,
);
