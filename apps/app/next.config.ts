import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DEV-035 (owner, 2026-09-23: «сделай dash главным роутом»): the office
  // dashboard moved from `/dash/**` to the root (`app/(dash)/**`), where the
  // retired field PWA's «Мої доручення» used to be. Old dashboard links and
  // bookmarks keep working through these redirects. Temporary (307), not
  // permanent, so a browser does not cache them while the URL scheme may still
  // move. The field client's own `/a/{id}` is not redirected: that screen no
  // longer exists here (the field client is `apps/mobile`, ADR-009 as amended).
  // Form per the installed Next 16.3.1 guide,
  // node_modules/next/dist/docs/01-app/02-guides/redirecting.md.
  async redirects() {
    return [
      { source: "/dash", destination: "/", permanent: false },
      { source: "/dash/:path*", destination: "/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
