// WARNS WHEN THE LOCAL SUPABASE CLI DIFFERS FROM THE PINNED ONE. Warns — never
// refuses — because a developer's machine is theirs, and the point is to make a
// silent difference into a printed one, not to block work.
//
// `.supabase-cli-version` is the single source: CI installs exactly that version
// and asserts it took (.github/workflows/ci.yml, `verify` and `app-qa`). Local
// and CI running different CLIs is not hypothetical here — HANDOFF.md §0 records
// app-qa going red three times on CI alone because a newer CLI's default
// magic-link template stopped carrying `{{ .Token }}`, while local (2.75.0 at
// the time) kept passing. Anything a suite relies on that comes from a CLI
// DEFAULT rather than from supabase/config.toml can differ between the two, and
// will surface as a CI-only failure shaped like a product bug. Knowing the two
// versions differ is the first step of that diagnosis, and this prints it.
//
// Run by hand (`pnpm db:check-cli`) or by the db:* scripts before they touch the
// stack. Exit code is always 0 unless the CLI is missing entirely.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const want = readFileSync(resolve(root, ".supabase-cli-version"), "utf8").trim();

let have;
try {
  have = execFileSync("supabase", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")[0].trim();
} catch {
  console.error(`supabase CLI: not found on PATH. CI pins ${want} (.supabase-cli-version); install it — https://supabase.com/docs/guides/cli`);
  process.exit(1);
}

if (have === want) {
  console.log(`supabase CLI ${have} — matches the pin.`);
} else {
  console.warn(
    `supabase CLI: local ${have}, CI pins ${want} (.supabase-cli-version).\n`
    + `  A CI-only failure in a Supabase step may be this difference and not your change —\n`
    + `  see HANDOFF.md §0 for the magic-link case. To match CI: brew upgrade supabase\n`
    + `  (or the installer for your platform), then re-run.`);
}
