// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { NodeLock, Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";

// `useReduced()` is TRUE on the server and on the first client render, then
// flips to the real preference after hydration (use-reduced.ts). This mock
// replays that flip: `gate` starts closed, the test re-renders with it open.
// Each render builds a FRESH element — React bails out of re-rendering an
// identical element object, and then the hook is never read again.
let gate = true;
vi.mock("../../../packages/ui/src/motion/use-reduced", () => ({
  useReduced: () => gate,
  shouldReduce: () => gate,
}));

afterEach(cleanup);

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error test-only polyfill, not the real IntersectionObserver shape
global.IntersectionObserver = MockIntersectionObserver;

/**
 * Motion snapshots `initial` once, at mount. A primitive that keeps the same
 * element across the gate and only swaps its `initial`/`whileInView` objects
 * therefore stays on the reduced snapshot for ever: the entrance runs as a
 * bare fade and the transform it documents never happens (measured on the
 * built landing, 2026-09-06: every check, card and cell at `transform: none`
 * through its whole entrance). The fix is a resting `animate` target that
 * mirrors the full hidden state — Motion animates a key that newly appears
 * in `animate` — so these tests assert the transform is on the element after
 * the flip, before anything scrolls into view.
 */
describe("the entrance primitives re-apply their hidden transform once the reduced-motion gate opens", () => {
  it("Reveal takes its offset after the flip", async () => {
    gate = true;
    const tree = () => <Reveal x={-20} y={0}><p>картка</p></Reveal>;
    const { container, rerender } = render(tree());
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.opacity).toBe("0");
    expect(el.style.transform).toBe("");
    gate = false;
    rerender(tree());
    await waitFor(() => expect(el.style.transform).toContain("translateX(-20px)"));
    expect(el.style.opacity).toBe("0");
  });

  it("StaggerItem takes its scale after the flip, through the parent's label", async () => {
    gate = true;
    const tree = () => <Stagger step="loose" delay={0.35}><StaggerItem from="scale"><i /></StaggerItem></Stagger>;
    const { container, rerender } = render(tree());
    const item = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(item.style.opacity).toBe("0");
    expect(item.style.transform).toBe("");
    gate = false;
    rerender(tree());
    await waitFor(() => expect(item.style.transform).toContain("scale(0)"));
    expect(item.style.opacity).toBe("0");
  });

  it("StaggerItem takes its rise after the flip", async () => {
    gate = true;
    const tree = () => <Stagger><StaggerItem><i /></StaggerItem></Stagger>;
    const { container, rerender } = render(tree());
    const item = container.firstElementChild!.firstElementChild as HTMLElement;
    gate = false;
    rerender(tree());
    await waitFor(() => expect(item.style.transform).toContain("translateY(16px)"));
  });

  it("NodeLock takes its .96 after the flip", async () => {
    gate = true;
    const tree = () => <NodeLock><i /></NodeLock>;
    const { container, rerender } = render(tree());
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.transform).toBe("");
    gate = false;
    rerender(tree());
    await waitFor(() => expect(el.style.transform).toContain("scale(0.96)"));
  });
});
