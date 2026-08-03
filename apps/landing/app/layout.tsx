import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "@aktflow/ui/tokens.css";
import "@aktflow/ui/base.css";

export const metadata = {
  title: "AktFlow — Evidence-to-payment operating layer",
  description:
    "AktFlow turns field evidence into approved, auditable payments — акти, довіреності та розрахунки в одному потоці.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
