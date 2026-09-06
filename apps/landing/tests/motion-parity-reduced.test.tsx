// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ScrollProgress, ScrollTint } from "@goproceed/ui/motion";

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

describe("ScrollTint under reduced motion", () => {
  it("renders the muted prefix and the accent word statically, with no scroll-driven style", () => {
    const { container } = render(
      <ScrollTint text="Ми не зупиняємо роботу — поки доказ не отримано" dimUntil={4} accent="доказ" />,
    );
    const visible = container.querySelector('[aria-hidden="true"]');
    expect(visible).not.toBeNull();
    const words = [...visible!.querySelectorAll("span")];
    expect(words).toHaveLength(9);
    expect(words.filter((w) => w.classList.contains("text-ink-muted"))).toHaveLength(4);
    expect(words.filter((w) => w.classList.contains("text-accent"))).toHaveLength(1);
    expect(words.filter((w) => w.classList.contains("text-ink"))).toHaveLength(4);
    for (const w of words) expect(w.getAttribute("style")).toBeNull();
    expect(container.querySelector(".sr-only")?.textContent).toBe("Ми не зупиняємо роботу — поки доказ не отримано");
  });
});
