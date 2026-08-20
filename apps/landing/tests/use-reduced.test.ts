import * as motionVocabulary from "@goproceed/ui/motion";
import { describe, expect, it } from "vitest";

const { shouldReduce } = motionVocabulary;

describe("the shared reduced-motion hydration contract", () => {
  it("keeps the server and first client frame on the same safe branch", () => {
    expect(shouldReduce({ hydrated: false, preference: null })).toBe(true);
    expect(shouldReduce({ hydrated: false, preference: false })).toBe(true);
    expect(shouldReduce({ hydrated: false, preference: true })).toBe(true);
  });

  it("honours the media preference after hydration", () => {
    expect(shouldReduce({ hydrated: true, preference: false })).toBe(false);
    expect(shouldReduce({ hydrated: true, preference: true })).toBe(true);
    expect(shouldReduce({ hydrated: true, preference: null })).toBe(true);
  });
});

describe("the timed-tour visibility contract", () => {
  it("advances only while autoplay is enabled and the tour is in view", () => {
    const shouldAutoAdvance = (motionVocabulary as Record<string, unknown>).shouldAutoAdvance;

    expect(typeof shouldAutoAdvance).toBe("function");
    if (typeof shouldAutoAdvance !== "function") return;

    expect(shouldAutoAdvance({ auto: true, reduced: false, inView: true, tabCount: 4 })).toBe(true);
    expect(shouldAutoAdvance({ auto: true, reduced: false, inView: false, tabCount: 4 })).toBe(false);
    expect(shouldAutoAdvance({ auto: false, reduced: false, inView: true, tabCount: 4 })).toBe(false);
    expect(shouldAutoAdvance({ auto: true, reduced: true, inView: true, tabCount: 4 })).toBe(false);
  });
});
