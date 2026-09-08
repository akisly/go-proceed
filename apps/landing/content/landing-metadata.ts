import type { Metadata } from "next";

const title = "GoProceed — робота готова до приймання, коли доказ на місці";
const description =
  "GoProceed для підрядників, які здають приховані роботи: вимога, доказ із майданчика і рішення технагляду в одному маршруті, який закінчується чернеткою акта.";

export function createLandingMetadata(origin: string): Metadata {
  return {
    metadataBase: new URL(origin),
    title,
    description,
    applicationName: "GoProceed",
    // One canonical for every host that serves this app. Without it, apex,
    // www, *.vercel.app and each preview deployment claim the page separately.
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "uk_UA",
      url: "/",
      siteName: "GoProceed",
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: "GoProceed: робота готова до приймання, коли доказ на місці",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      // An object rather than a bare string: `images: ["/og.png"]` carries no
      // alt, so the description declared beside the Open Graph image did not
      // reach the Twitter card at all.
      images: [
        {
          url: "/og.png",
          alt: "GoProceed: робота готова до приймання, коли доказ на місці",
        },
      ],
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png", sizes: "512x512" },
      ],
      apple: [
        { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
      ],
    },
  };
}
