import type { NextConfig } from "next";

// apps/landing is a static-first public marketing shell (see
// infra/README-staging.md and docs/superpowers specs §3): it carries no
// product API and no Supabase server client. The authenticated surface lives
// only in apps/app.
// [Correction, 2026-09-05: this comment used to say «must never grow API
// routes». One route handler exists — app/api/pilot — a contact form that
// forwards to Telegram/Resend and stores nothing. The invariant that matters,
// no product API and no Supabase client, is unchanged; the spec at
// docs/superpowers/specs/2026-09-05-landing-daylight-design.md §2 D2 records
// the decision.]
const nextConfig: NextConfig = {
  // @goproceed/ui ships TypeScript source rather than a build artefact, the
  // same way @goproceed/tokens does. That is deliberate: a package with a
  // build step is a package whose committed output can disagree with its
  // source, which is the drift class this repository spends its tests on.
  transpilePackages: ["@goproceed/ui", "@goproceed/tokens"],
};

export default nextConfig;
