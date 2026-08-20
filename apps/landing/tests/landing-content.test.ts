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
  it("keeps the evidence chain in the approved operational order", () => {
    expect(landingContent.evidence.steps.map((step) => step.label)).toEqual([
      "Робота",
      "Вимога",
      "Доказ",
      "Рішення",
      "Закриття",
      "Акт",
    ]);
  });

  it.each(["оплат", "КЕП", "офлайн", "клієнти", "економія %"])(
    "does not publish the unsupported claim %s",
    (claim) => {
      expect(flatten(landingContent).toLowerCase()).not.toContain(claim.toLowerCase());
    },
  );

  it("defines four real product-tour chapters", () => {
    expect(landingContent.tour).toHaveLength(4);
    expect(
      landingContent.tour.every(
        (chapter) => chapter.id.length > 0 && chapter.label.length > 0 && chapter.hint.length > 0,
      ),
    ).toBe(true);
  });
});
