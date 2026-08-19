// A DEPLOYMENT BUILD REFUSES TO PRODUCE A BUNDLE IT KNOWS WILL NOT WORK.
//
// Two facts about apps/app make "the first request 500s" the default outcome
// of an incomplete deploy, and both are invisible at build time unless
// something looks:
//
//   1. `NEXT_PUBLIC_APP_ORIGIN` is required by every production build.
//      src/lib/api.ts refuses to self-fetch with the session cookie against
//      any origin it has not been told to trust, and since 2026-08-17 there is
//      no header-derived fallback in a production build at all. Unset, every
//      authenticated page renders its error screen — and because NEXT_PUBLIC_*
//      is inlined at build, setting it afterward in the dashboard changes
//      NOTHING until the next build. So the moment to notice is now, not
//      after the deploy is live.
//
//   2. `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are read by
//      src/lib/evidence-storage.ts and default to THE LOCAL STACK
//      (127.0.0.1:54321 and the published demo key). They are runtime, not
//      build-time, and .env.example did not list them until 2026-08-18. A
//      deploy that sets only the documented NEXT_PUBLIC_* variables aims every
//      evidence upload at a Supabase that does not exist on the server, and
//      the first upload is the first symptom. Checked here as a courtesy: the
//      build cannot see the runtime environment, but a Vercel build DOES see
//      the project's environment variables, so an unset one is visible now.
//
// SCOPED TO DEPLOYMENT BUILDS ONLY. Keyed on `VERCEL=1`, which Vercel sets on
// every build it runs, and on nothing else — because:
//   - `NODE_ENV` is NOT set for a `prebuild` hook (measured: undefined), so it
//     cannot distinguish `next build` for a deploy from `next build` in CI;
//   - CI's `verify` and `app-qa` jobs build without any origin, deliberately —
//     `qa/field.mjs` names its own ephemeral origin at `next start` time, and
//     that only works BECAUSE the build left the variable unset (see the
//     comment beside NEXT_PUBLIC_APP_ORIGIN in that file). A blanket refusal
//     would turn both jobs red for no defect.
//   - `next dev` on a developer's machine may leave everything unset and the
//     loopback fallback carries it.
// So this is silent everywhere except on a build that is about to be served
// from a real origin, and there it is loud.
//
// `DEPLOY_PREFLIGHT=1` forces the check outside Vercel — for proving it fires,
// and for any other host that does not set VERCEL. `DEPLOY_PREFLIGHT=0`
// disables it on Vercel, and there is exactly one legitimate reason to: a
// build whose output is never served (a compile-only check). Anything else is
// somebody turning off the alarm.

const isDeploy = process.env.VERCEL === "1" || process.env.DEPLOY_PREFLIGHT === "1";
if (!isDeploy || process.env.DEPLOY_PREFLIGHT === "0") process.exit(0);

const problems = [];

const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "";
if (!origin) {
  problems.push(
    "NEXT_PUBLIC_APP_ORIGIN is unset. Every authenticated page will render its error screen: "
    + "src/lib/api.ts refuses to self-fetch with the session cookie against an origin it was not "
    + "told to trust, and a production build has no fallback. It is inlined at BUILD time — set it "
    + "in the Vercel project's environment (Production AND Preview) and REBUILD; setting it after "
    + "this build ships changes nothing.");
} else {
  let u;
  try { u = new URL(origin); } catch { u = null; }
  if (!u) problems.push(`NEXT_PUBLIC_APP_ORIGIN is not a URL: ${JSON.stringify(origin)}`);
  else if (u.protocol !== "https:") {
    problems.push(
      `NEXT_PUBLIC_APP_ORIGIN must be https on a deployment (got ${u.protocol}//): crypto.subtle, `
      + "which the capture hash needs, exists only in a secure context, and the session cookie must "
      + "never travel in the clear.");
  } else if (u.pathname !== "/" || u.search || u.hash) {
    problems.push(`NEXT_PUBLIC_APP_ORIGIN must be an ORIGIN with no path, query or hash: ${origin}`);
  }
}

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {
  if (!process.env[name]) problems.push(`${name} is unset — it is compiled into the client bundle and the OTP sign-in cannot work without it.`);
}

// THE KEY FORMAT, because the dashboard still shows the legacy JWT right beside
// the new key and the variable name alone does not stop anyone pasting the wrong
// one. A legacy `anon`/`service_role` JWT works TODAY — measured on the hosted
// project, both forms answer 200 — and stops working at the end of 2026, so a
// deploy that carries one has no symptom until 2027-01-01. Refusing it here
// turns a silent future outage into a named build failure now. The legacy JWT
// is recognisable by its three base64url segments beginning `eyJ`; the new
// keys are `sb_publishable_…` / `sb_secret_…` and are not JWTs at all.
const looksLikeLegacyJwt = (v) => /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v);
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
if (pub && looksLikeLegacyJwt(pub)) {
  problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY carries a LEGACY anon JWT (eyJ…). Use the `sb_publishable_…` key from Project Settings → API → Publishable key. The legacy form stops working at the end of 2026 and this build would die then with no earlier symptom.");
} else if (pub && !pub.startsWith("sb_publishable_")) {
  problems.push(`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY does not look like a publishable key (expected to start with sb_publishable_): ${pub.slice(0, 12)}…`);
}
const sec = process.env.SUPABASE_SECRET_KEY ?? "";
if (sec && looksLikeLegacyJwt(sec)) {
  problems.push("SUPABASE_SECRET_KEY carries a LEGACY service_role JWT (eyJ…). Use an `sb_secret_…` key from Project Settings → API → Secret keys. Same end-of-2026 cliff as the publishable key.");
} else if (sec && !sec.startsWith("sb_secret_")) {
  problems.push(`SUPABASE_SECRET_KEY does not look like a secret key (expected to start with sb_secret_): ${sec.slice(0, 10)}…`);
}
if ((process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("127.0.0.1")) {
  problems.push("NEXT_PUBLIC_SUPABASE_URL points at the local stack — a served bundle would ask the visitor's browser to reach 127.0.0.1.");
}

// Runtime variables the build can nonetheless see on Vercel. Missing here means
// missing at the first request.
const runtime = {
  APP_DB_URL: "packages/database/src/pool.ts — every tenant read and write; the app is inert without it",
  SERVICE_DB_URL: "packages/database/src/pool.ts — every upload finalization 500s without it (README-staging.md §3.2)",
  SUPABASE_URL: "src/lib/evidence-storage.ts — DEFAULTS TO 127.0.0.1:54321 when unset, so every evidence upload would target a Supabase that does not exist on the server",
  SUPABASE_SECRET_KEY: "src/lib/evidence-storage.ts — the signed-upload issuer (an sb_secret_ key, not the legacy service_role JWT); without it the module throws at import on any non-local SUPABASE_URL",
  EXTERNAL_LINK_ORIGIN: "src/lib/external-link.ts — the only Origin the external exchange accepts",
  EXTERNAL_LINK_HMAC_KEYS: "src/lib/external-link.ts — no default, by design",
  EXTERNAL_LINK_ACTIVE_KEY_ID: "src/lib/external-link.ts",
  EXTERNAL_SESSION_HMAC_KEYS: "src/lib/external-session.ts",
  EXTERNAL_SESSION_ACTIVE_KEY_ID: "src/lib/external-session.ts",
};
for (const [name, why] of Object.entries(runtime)) {
  if (!process.env[name]) problems.push(`${name} is unset (${why}).`);
}
for (const name of ["APP_DB_URL", "SERVICE_DB_URL"]) {
  const v = process.env[name] ?? "";
  if (/app_pw|service_pw|127\.0\.0\.1|localhost/.test(v)) {
    problems.push(`${name} carries a LOCAL dev value — a real deployment must use the secrets from README-staging.md §3, never app_pw / service_pw or a loopback host.`);
  }
}
if ((process.env.APP_DB_URL ?? "") && process.env.APP_DB_URL === process.env.SERVICE_DB_URL) {
  problems.push("APP_DB_URL and SERVICE_DB_URL are identical — they must authenticate as different roles (README-staging.md §3.2), or withServiceTx fails closed on every service write.");
}

if (problems.length) {
  console.error("\ndeploy preflight: REFUSING TO BUILD — this bundle would not work where it is going.\n");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\nSee apps/app/.env.example for the full contract and infra/README-staging.md §4 for where each value comes from.\n");
  process.exit(1);
}
console.log("deploy preflight: OK — origin, Supabase, database and external-link variables are all present and non-local.");
