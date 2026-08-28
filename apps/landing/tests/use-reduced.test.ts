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
