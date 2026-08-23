import { describe, it, expect } from "vitest";
import { pluralUk, daysUk, daysSinceUk } from "./format-uk";

describe("pluralUk", () => {
  it("picks «one» for 1, 21, 31 but not 11", () => {
    expect(pluralUk(1, "рядок", "рядки", "рядків")).toBe("рядок");
    expect(pluralUk(21, "рядок", "рядки", "рядків")).toBe("рядок");
    expect(pluralUk(31, "рядок", "рядки", "рядків")).toBe("рядок");
    expect(pluralUk(11, "рядок", "рядки", "рядків")).toBe("рядків");
  });

  it("picks «few» for 2-4, 22-24 but not 12-14", () => {
    expect(pluralUk(2, "рядок", "рядки", "рядків")).toBe("рядки");
    expect(pluralUk(4, "рядок", "рядки", "рядків")).toBe("рядки");
    expect(pluralUk(22, "рядок", "рядки", "рядків")).toBe("рядки");
    expect(pluralUk(12, "рядок", "рядки", "рядків")).toBe("рядків");
    expect(pluralUk(14, "рядок", "рядки", "рядків")).toBe("рядків");
  });

  it("picks «many» for 0, 5-20, 25-30", () => {
    expect(pluralUk(0, "рядок", "рядки", "рядків")).toBe("рядків");
    expect(pluralUk(5, "рядок", "рядки", "рядків")).toBe("рядків");
    expect(pluralUk(20, "рядок", "рядки", "рядків")).toBe("рядків");
    // 25 ends in 5, not 2-4, so it is «many» too — «25-30» in the docstring
    // means "the range where many resumes after the 22-24 few window", not
    // that every number in it is few.
    expect(pluralUk(25, "рядок", "рядки", "рядків")).toBe("рядків");
  });
});

describe("daysUk", () => {
  it("renders the count with the correct plural form", () => {
    expect(daysUk(1)).toBe("1 день");
    expect(daysUk(2)).toBe("2 дні");
    expect(daysUk(11)).toBe("11 днів");
    expect(daysUk(0)).toBe("0 днів");
  });
});

describe("daysSinceUk", () => {
  it("floors to whole days, never rounds up", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    // 23 hours ago — under one whole day.
    expect(daysSinceUk("2026-08-22T13:00:00.000Z", now)).toBe("0 днів");
    // Exactly 25 hours ago — one whole day and a bit.
    expect(daysSinceUk("2026-08-22T11:00:00.000Z", now)).toBe("1 день");
  });

  it("clamps a negative age (clock skew) to zero rather than printing it", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    expect(daysSinceUk("2026-08-24T12:00:00.000Z", now)).toBe("0 днів");
  });
});
