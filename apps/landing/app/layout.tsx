import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { createLandingMetadata } from "../content/landing-metadata";

// Three families, loaded as variable fonts and subset by @fontsource:
//   Inter        — all UI, all body copy, every figure
//   Source Serif — display headings only (D3), never below mkt-display-3
//   JetBrains Mono — index labels, evidence IDs, figure captions (D4)
// Manrope is gone: display duty moved to the serif, and three families that do
// two jobs is one family too many.
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

const DESIGN_CONTRACT = `<!--
THESIS: One evidence route turns fragmented construction proof into an accountable decision trail; this page refuses the feature-catalogue pattern.
OWN-WORLD: Paper, carbon, blueprint lines, field evidence and a single safety-lime signal.
STORY: The visitor follows R-041 through EV-0248 and DR-0091 to a readiness decision, then sees the honest product boundary and pilot action.
FIRST VIEWPORT: One promise, one live dossier and two real anchors; no decorative feature grid.
FORM: Evidence Journey, top-ranked and user-approved-evidence-journey-2026-08-25.
FINISH: Unreviewed and undocumented is unfinished; the build ends with a finish review, verdict and DESIGN.md.
-->`;

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = firstForwardedValue(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  ) ?? "localhost:3100";
  const protocol = firstForwardedValue(requestHeaders.get("x-forwarded-proto"))
    ?? (host.startsWith("localhost") ? "http" : "https");

  return createLandingMetadata(`${protocol}://${host}`);
}

function firstForwardedValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // data-theme is set explicitly rather than left to the OS. D6 ships light
  // only; the dark block in tokens.generated.css is authored and inert, and
  // this attribute is the switch that turns it on when that decision is taken.
  return (
    <html lang="uk" data-theme="light">
      <body>
        <template
          data-impeccable-contract="user-approved-evidence-journey-2026-08-25"
          dangerouslySetInnerHTML={{ __html: DESIGN_CONTRACT }}
        />
        {children}
      </body>
    </html>
  );
}
