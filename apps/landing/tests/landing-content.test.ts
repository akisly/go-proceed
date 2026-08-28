import { describe, expect, it } from "vitest";
import { landingContent } from "../content/landing-content";

const flatten = (value: unknown): string =>
  typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.map(flatten).join(" ")
      : value && typeof value === "object"
        ? Object.values(value).map(flatten).join(" ")
        : "";

describe("landing product truth", () => {
  it("keeps the evidence journey in the approved operational order", () => {
    expect(landingContent.journey.chapters.map((chapter) => chapter.id)).toEqual([
      "requirement",
      "capture",
      "decision",
    ]);
    expect(flatten(landingContent.journey)).toContain("R-041");
    expect(flatten(landingContent.journey)).toContain("EV-0248");
    expect(flatten(landingContent.journey)).toContain("DR-0091");
    expect(flatten(landingContent.journey)).toContain("CL-017");
  });

  it("publishes exactly the six approved scene records", () => {
    expect(Object.keys(landingContent)).toEqual([
      "nav",
      "hero",
      "journey",
      "fieldReview",
      "readiness",
      "trust",
      "pilot",
      "footer",
    ]);
  });

  it.each(["оплат", "КЕП", "офлайн", "клієнти", "економія %"])(
    "does not publish the unsupported claim %s",
    (claim) => {
      expect(flatten(landingContent).toLowerCase()).not.toContain(claim.toLowerCase());
    },
  );

  it("states the online-only and unsigned-draft boundaries", () => {
    expect(flatten(landingContent)).toContain("активного з’єднання");
    expect(flatten(landingContent)).toContain("Чернетка акта не є підписаним документом");
  });
});
