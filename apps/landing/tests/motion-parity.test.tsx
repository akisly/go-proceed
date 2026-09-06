import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LineReveal, splitAccent, Depth, Tilt, Magnetic } from "@goproceed/ui/motion";

vi.mock("../../../packages/ui/src/motion/use-reduced", () => ({
  useReduced: () => false,
  shouldReduce: () => false,
}));

describe("LineReveal", () => {
  const text = "На нараді більше не сперечаються";
  it("renders the text once for readers and once as flat words before measurement, the accent marked", () => {
    const html = renderToStaticMarkup(<LineReveal as="h2" text={text} accent="не сперечаються" />);
    expect(html.startsWith("<h2")).toBe(true);
    expect(html).toContain(`class="sr-only">${text}<`);
    expect(html.match(/data-word=""/g)).toHaveLength(5);
    expect(html.match(/data-accent="true"/g)).toHaveLength(2);
    // The masks arrive after layout measurement; the server never sends them.
    expect(html).not.toContain("data-line");
    // Separators sit between word spans, never inside one (the ScrollTint lesson).
    const visible = html.slice(html.indexOf('aria-hidden="true"'));
    expect(visible).not.toMatch(/\s<\/span>/);
    expect(visible.match(/<\/span> <span/g)).toHaveLength(4);
  });
  it("marks accent words by their position in the sentence", () => {
    expect(splitAccent("Робота готова, коли доказ на місці.", "доказ").map((w) => w.accent))
      .toEqual([false, false, false, true, false, false]);
    expect(splitAccent("Без акценту").every((w) => !w.accent)).toBe(true);
  });
});

describe("Depth", () => {
  it("renders one wrapper carrying its depth and no offset on the server", () => {
    const html = renderToStaticMarkup(<Depth depth={-0.3} className="absolute"><span>квитанція</span></Depth>);
    expect(html).toContain('data-depth="-0.3"');
    expect(html).toContain('class="absolute');
    expect(html).not.toMatch(/translateY\(-?[1-9]/);
  });
});

describe("Tilt", () => {
  it("is off on the server and carries no rotation", () => {
    const html = renderToStaticMarkup(<Tilt maxX={2.5} maxY={3}><article>картка</article></Tilt>);
    expect(html).toContain('data-tilt="off"');
    expect(html).not.toMatch(/rotate[XY]\(-?[1-9]/);
    expect(html).toContain("<article>картка</article>");
  });
});

describe("Magnetic", () => {
  it("wraps a control inline, off on the server, no offset", () => {
    const html = renderToStaticMarkup(<Magnetic><button type="button">Обговорити пілот</button></Magnetic>);
    expect(html).toContain('data-magnetic="off"');
    expect(html).toContain("inline-flex");
    expect(html).not.toMatch(/translate[XY]\(-?[1-9]/);
  });
});
