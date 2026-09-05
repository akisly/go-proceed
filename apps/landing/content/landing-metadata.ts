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
          alt: "GoProceed: робота готова до приймання, коли доказ на місці",
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
