// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ScrollProgress } from "@goproceed/ui/motion";

// Reduced motion for this file only: the word must publish its FINAL value at
// once and never animate — a different outcome, not a fast one.
vi.mock("../../../packages/ui/src/motion/use-reduced", () => ({
  useReduced: () => true,
  shouldReduce: () => true,
}));

afterEach(cleanup);

describe("ScrollProgress under reduced motion", () => {
  it("publishes --gp-progress: 1 on mount", () => {
    const { container } = render(<ScrollProgress><i /></ScrollProgress>);
    const node = container.querySelector<HTMLElement>("[data-scroll-progress]");
    expect(node?.style.getPropertyValue("--gp-progress")).toBe("1");
  });
});
