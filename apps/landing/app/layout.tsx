import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { createLandingMetadata } from "../content/landing-metadata";

// Two families, loaded as variable fonts and subset by @fontsource:
//   Onest          — every heading, all body copy, all UI, every figure
//   JetBrains Mono — index labels, evidence IDs, figure captions
// Daylight (2026-09-05): the serif display face and Inter are gone; the
// prototype sets everything in Onest. Verified on @fontsource-variable/onest
// 5.3.1: wght 100–900, `tnum`, Іі Її Єє Ґґ.
import "@fontsource-variable/onest";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

const DESIGN_CONTRACT = `<!--
THESIS: The work is ready for acceptance when the proof is in place; the page shows one work package travelling from requirement to draft act.
OWN-WORLD: Warm paper, cool ink, one cobalt mark; Onest and JetBrains Mono; recognisable 21st.dev blocks, no brutalism, no 3D.
STORY: Problem (Рис. 01) → було і стало → roles → the five-card route → position → capture channels → provenance → the free pilot → questions → CTA.
FIRST VIEWPORT: One promise, three entry facts, the product frame settling into the page.
FORM: Daylight, design-contest/daylight iteration nine, owner-approved 2026-09-05.
FINISH: Unreviewed and undocumented is unfinished; the build ends with the seven-width QA pass and DESIGN.md.
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
      <body className="landing-body">
        <template
          data-impeccable-contract="user-approved-daylight-2026-09-05"
          dangerouslySetInnerHTML={{ __html: DESIGN_CONTRACT }}
        />
        <div aria-hidden="true" className="landing-dot-field" />
        {children}
      </body>
    </html>
  );
}
