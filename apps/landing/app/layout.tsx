import type { ReactNode } from "react";

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

export const metadata = {
  title: "GoProceed — Evidence-to-payment operating layer",
  description:
    "GoProceed turns field evidence into approved, auditable payments — акти, довіреності та розрахунки в одному потоці.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // data-theme is set explicitly rather than left to the OS. D6 ships light
  // only; the dark block in tokens.generated.css is authored and inert, and
  // this attribute is the switch that turns it on when that decision is taken.
  return (
    <html lang="uk" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
