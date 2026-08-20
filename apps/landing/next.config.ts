import type { NextConfig } from "next";

// apps/landing is a static-first public marketing shell (see
// infra/README-staging.md and docs/superpowers specs §3): it must never
// grow API routes or a Supabase server client. The authenticated surface
// lives only in apps/app.
const nextConfig: NextConfig = {
  // @goproceed/ui ships TypeScript source rather than a build artefact, the
  // same way @goproceed/tokens does. That is deliberate: a package with a
  // build step is a package whose committed output can disagree with its
  // source, which is the drift class this repository spends its tests on.
  transpilePackages: ["@goproceed/ui", "@goproceed/tokens"],
};

export default nextConfig;
