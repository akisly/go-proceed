import { describe, expect, it } from "vitest";
import { createLandingMetadata } from "../content/landing-metadata";

const metadata = createLandingMetadata("https://goproceed.example");

describe("landing metadata", () => {
  it("describes the evidence product without unsupported commercial claims", () => {
    expect(metadata.title).toBe("GoProceed — робота готова до приймання, коли доказ на місці");
    expect(metadata.description).toContain(
      "GoProceed для підрядників, які здають приховані роботи: вимога, доказ із майданчика і рішення технагляду в одному маршруті, який закінчується чернеткою акта.",
    );
    expect(metadata.description?.toLowerCase()).not.toContain("оплат");
  });

  it("publishes one social preview asset", () => {
    expect(metadata.metadataBase?.toString()).toBe("https://goproceed.example/");
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "GoProceed: робота готова до приймання, коли доказ на місці",
      },
    ]);
  });

  it("publishes the project mark for browser and device icons", () => {
    expect(metadata.icons).toEqual({
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png", sizes: "512x512" },
      ],
      apple: [
        { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
      ],
    });
  });
});
