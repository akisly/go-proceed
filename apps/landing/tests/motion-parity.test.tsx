import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LineReveal, splitAccent } from "@goproceed/ui/motion";

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
