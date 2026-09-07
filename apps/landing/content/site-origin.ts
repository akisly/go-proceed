/**
 * The canonical origin, resolved at BUILD time.
 *
 * It used to be resolved per request, from `x-forwarded-host` inside
 * `generateMetadata`. That had two costs and only one of them was visible:
 * every host that served the app became its own canonical URL, and — because
 * `headers()` is a request-time API — the whole `/` route stopped being static
 * and paid for SSR on every visit. Reading the origin from the environment
 * instead restores `○ (Static)` and gives every deployment the same canonical.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` is Vercel's own system variable: "the
 * production domain name of the project, set even in preview deployments",
 * carrying no protocol scheme (verified 2026-09-07 against
 * vercel.com/docs/environment-variables/system-environment-variables). That
 * last property is the point — a preview build has to canonicalise to
 * production rather than to itself.
 */
const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

const resolved = explicit || (vercelProduction ? `https://${vercelProduction}` : "");

export const SITE_ORIGIN = (resolved || "http://localhost:3100").replace(/\/+$/, "");
