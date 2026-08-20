import { describe, expect, it } from "vitest";
import { metadata } from "../app/layout";

describe("landing metadata", () => {
  it("describes the evidence product without unsupported commercial claims", () => {
    expect(metadata.title).toBe("GoProceed | Від вимоги до доказу й акта");
    expect(metadata.description).toContain("будівельних робіт");
    expect(metadata.description?.toLowerCase()).not.toContain("оплат");
  });

  it("publishes one social preview asset", () => {
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "GoProceed: від вимоги до доказу й акта",
      },
    ]);
  });
});
