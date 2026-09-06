import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  LineReveal, splitAccent, Depth, Tilt, Magnetic,
  ScrollStack, ScrollStackCard, ScrollStackMedia, ScrollProgress,
} from "@goproceed/ui/motion";
import { Stepper, Step } from "@goproceed/ui/components";

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

describe("ScrollStack", () => {
  it("renders every card with its veil and media, unstuck and unscaled on the server", () => {
    const html = renderToStaticMarkup(
      <ScrollStack className="grid gap-4">
        <ScrollStackCard index={0} count={2}><ScrollStackMedia><p>панель</p></ScrollStackMedia></ScrollStackCard>
        <ScrollStackCard index={1} count={2}><p>друга</p></ScrollStackCard>
      </ScrollStack>,
    );
    expect(html).toContain('data-scroll-stack="off"');
    expect(html.match(/data-stack-card="\d"/g)).toEqual(['data-stack-card="0"', 'data-stack-card="1"']);
    expect(html.match(/data-stack-veil=""/g)).toHaveLength(2);
    expect(html).toContain('data-stack-media=""');
    expect(html).not.toContain("sticky");
    expect(html).not.toMatch(/scale\(0\.9/);
  });
  it("refuses a card outside a stack", () => {
    expect(() => renderToStaticMarkup(<ScrollStackCard index={0} count={1}>x</ScrollStackCard>)).toThrow(/inside ScrollStack/);
  });
});

describe("ScrollProgress", () => {
  it("renders the wrapper the stepper reads from, and the stepper now uses it", () => {
    expect(renderToStaticMarkup(<ScrollProgress><i /></ScrollProgress>)).toContain('data-scroll-progress=""');
    const stepper = renderToStaticMarkup(
      <Stepper><Step index={0} count={2} when="День 1" title="Реєстр">тіло</Step><Step index={1} count={2} when="Тиждень 1" title="Майданчик">тіло</Step></Stepper>,
    );
    expect(stepper).toContain('data-scroll-progress=""');
    expect(stepper).toContain("scaleY(var(--gp-progress, 0))");
  });
});
