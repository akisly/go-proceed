// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { LineReveal, Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";

// The gate is open: the flip has happened. `useResolvedReduce` (use-gates)
// reads matchMedia itself, so the polyfill below answers "no preference".
vi.mock("../../../packages/ui/src/motion/use-reduced", () => ({
  useReduced: () => false,
  shouldReduce: () => false,
}));

afterEach(cleanup);

window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

// An observer that NEVER reports intersection — the hero's frame sits below
// the fold at load, and the prototype enters it on a timeline (index.html
// l.1109–1113: `#stage` at .35 s, `#receipt` at .7 s, the floats at .9 s),
// not on scroll. `on="load"` must therefore finish with no help from here.
class SilentIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error test-only polyfill, not the real IntersectionObserver shape
global.IntersectionObserver = SilentIntersectionObserver;

describe("entrances on load — the prototype's hero timeline", () => {
  it("Reveal on=\"load\" arrives without ever intersecting", async () => {
    const { container } = render(<Reveal on="load" y={60}><p>рамка</p></Reveal>);
    const el = container.firstElementChild as HTMLElement;
    await waitFor(() => expect(el.style.opacity).toBe("1"), { timeout: 3000 });
    expect(el.style.transform === "none" || el.style.transform === "").toBe(true);
  });

  it("Stagger on=\"load\" brings every item in without ever intersecting", async () => {
    const { container } = render(
      <Stagger on="load"><StaggerItem><i /></StaggerItem><StaggerItem from="scale"><i /></StaggerItem></Stagger>,
    );
    const items = [...container.firstElementChild!.children] as HTMLElement[];
    expect(items).toHaveLength(2);
    await waitFor(() => { for (const it of items) expect(it.style.opacity).toBe("1"); }, { timeout: 3000 });
  });

  it("Reveal on=\"view\" (the default) still waits for the observer", async () => {
    const { container } = render(<Reveal><p>секція</p></Reveal>);
    const el = container.firstElementChild as HTMLElement;
    await new Promise((r) => setTimeout(r, 700));
    expect(el.style.opacity).toBe("0");
  });
});

describe("LineReveal re-measures without painting the flat words", () => {
  it("has its line masks back the moment the resize callback returns — no flat frame between", () => {
    let callback: ((entries: { contentRect: { width: number } }[]) => void) | null = null;
    class CapturingResizeObserver {
      constructor(cb: typeof callback) { callback = cb; }
      observe() {}
      disconnect() {}
    }
    const original = global.ResizeObserver;
    // @ts-expect-error test-only stand-in
    global.ResizeObserver = CapturingResizeObserver;
    try {
      const { container } = render(<LineReveal as="h2" text="На нараді більше не сперечаються" accent="не сперечаються" />);
      const visible = container.querySelector('h2 > [aria-hidden="true"]') as HTMLElement;
      expect(visible.querySelectorAll("[data-line]").length).toBeGreaterThan(0);
      expect(callback).not.toBeNull();
      // A width that differs from the one measured: the fonts-swapped /
      // resized path. Before the fix this unmounted the masks and re-measured
      // on the next animation frame, painting one frame of the bare heading
      // at full opacity — the "two animations" the hero showed on 2026-09-06.
      // `act` flushes the state update the callback queues, the way the
      // browser would before its next paint.
      act(() => { callback!([{ contentRect: { width: 1234.5 } }]); });
      expect(visible.querySelectorAll("[data-line]").length).toBeGreaterThan(0);
      expect([...visible.children].every((c) => c.hasAttribute("data-line"))).toBe(true);
    } finally {
      global.ResizeObserver = original;
    }
  });
});
