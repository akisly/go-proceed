// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { LineReveal, ScrollProgress, ScrollTint } from "@goproceed/ui/motion";

// Reduced motion for this file only: the word must publish its FINAL value at
// once and never animate — a different outcome, not a fast one.
vi.mock("../../../packages/ui/src/motion/use-reduced", () => ({
  useReduced: () => true,
  shouldReduce: () => true,
}));

afterEach(cleanup);

// jsdom carries no IntersectionObserver. LineReveal calls useInView()
// unconditionally (both branches share it so the ref survives the switch),
// so mounting it here needs a stub even though the reduced branch never
// reads `inView`.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error test-only polyfill, not the real IntersectionObserver shape
global.IntersectionObserver = MockIntersectionObserver;

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

describe("LineReveal under reduced motion", () => {
  it("keeps the observed aria-hidden span as the outer node, fading its child, so the observer survives the branch switch", () => {
    const { container } = render(<LineReveal as="h2" text="На нараді більше не сперечаються" accent="не сперечаються" />);
    const h2 = container.querySelector("h2");
    expect(h2?.children).toHaveLength(2);
    expect(h2?.children[0]?.className).toBe("sr-only");
    const visible = h2?.children[1] as HTMLElement;
    expect(visible.getAttribute("aria-hidden")).toBe("true");
    expect(visible.hasAttribute("style")).toBe(false);
    expect(visible.children).toHaveLength(1);
    expect(visible.querySelectorAll("[data-word]")).toHaveLength(5);
    expect(visible.querySelectorAll("[data-accent='true']")).toHaveLength(2);
  });
});

describe("the entrance primitives under reduced motion", () => {
  it("carry no transform in their hidden state — the resting target that re-applies the transform for everyone else never reaches a reduced reader", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { NodeLock, Reveal, Stagger, StaggerItem } = await import("@goproceed/ui/motion");
    const reveal = renderToStaticMarkup(<Reveal x={-20} y={16}><p>картка</p></Reveal>);
    const stagger = renderToStaticMarkup(<Stagger><StaggerItem from="scale"><i /></StaggerItem><StaggerItem><i /></StaggerItem></Stagger>);
    const node = renderToStaticMarkup(<NodeLock><i /></NodeLock>);
    for (const html of [reveal, stagger, node]) {
      expect(html).toContain("opacity:0");
      expect(html).not.toContain("transform");
    }
  });
});
