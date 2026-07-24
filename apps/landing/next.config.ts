import type { NextConfig } from "next";

// apps/landing is a static-first public marketing shell (see
// infra/README-staging.md and docs/superpowers specs §3): it must never
// grow API routes or a Supabase server client. The authenticated surface
// lives only in apps/app.
const nextConfig: NextConfig = {};

export default nextConfig;
