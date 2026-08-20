import type { Metadata } from "next";

const title = "GoProceed | Від вимоги до доказу й акта";
const description =
  "GoProceed пов’язує вимоги, польові докази, рішення технічного нагляду та чернетки актів для будівельних робіт.";

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
}
