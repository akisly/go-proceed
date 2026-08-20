import type { Metadata } from "next";
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

const title = "GoProceed | Від вимоги до доказу й акта";
const description =
  "GoProceed пов’язує вимоги, польові докази, рішення технічного нагляду та чернетки актів для будівельних робіт.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "GoProceed",
  openGraph: {
    title,
    description,
    type: "website",
    locale: "uk_UA",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "GoProceed: від вимоги до доказу й акта",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
  icons: {
    icon: "/images/verified-stamp.png",
  },
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
