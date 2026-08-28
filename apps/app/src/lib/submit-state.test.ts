import { describe, it, expect } from "vitest";
import { nextSubmitState } from "./submit-state";

describe("nextSubmitState", () => {
  it("goes idle → submitting on submit", () => {
    expect(nextSubmitState("idle", "submit")).toBe("submitting");
  });

  it("REFUSES a second submit while one is in flight — the double-press guard", () => {
    expect(nextSubmitState("submitting", "submit")).toBe("submitting");
  });

  it("settles to created or failed", () => {
    expect(nextSubmitState("submitting", "succeeded")).toBe("created");
    expect(nextSubmitState("submitting", "failed")).toBe("failed");
  });

  it("lets a failed attempt be retried, and a created one never resubmit", () => {
    expect(nextSubmitState("failed", "submit")).toBe("submitting");
    expect(nextSubmitState("created", "submit")).toBe("created");
  });
});
