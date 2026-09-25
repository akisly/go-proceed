import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ENTRANCE_ATTRIBUTE, LineReveal, NO_SCRIPT_ENTRANCE_CSS, NodeLock, Reveal, Stagger, StaggerItem, TextBlurIn,
} from "@goproceed/ui/motion";

// See design-contract.test.tsx: the layout calls `next/font/local` at module scope.
vi.mock("next/font/local", () => ({
  default: (options: { variable?: string }) => ({ variable: options.variable ?? "--font-test", className: "", style: { fontFamily: "test" } }),
}));

const { default: RootLayout } = await import("../app/layout");
const { Hero } = await import("../components/blocks/hero");

/**
 * WHAT A READER WITHOUT JAVASCRIPT SEES (BL-116, DEV-091).
 *
 * `Reveal` and `StaggerItem` server-render their hidden first frame inline and
 * only JavaScript clears it; with scripting off, `/pilot` painted its h1 and
 * not its form. Each now marks its element, and the root layout carries a
 * `<noscript>` rule scoped to that mark. The harness measures the built pages
 * with scripting off (`qa/landing.mjs`, «no-script»); these hold the three
 * links of the chain that a unit render can see.
 */
describe("entrances are shown at rest when scripting is off", () => {
  it("marks every element an entrance hides at first paint", () => {
    const html = renderToStaticMarkup(
      <>
        <Reveal><p>Звичайна поява</p></Reveal>
        <Reveal on="load"><p>Поява під час завантаження</p></Reveal>
        <Stagger><StaggerItem><p>Перший</p></StaggerItem><StaggerItem from="scale"><p>Другий</p></StaggerItem></Stagger>
        <NodeLock><p>Вузол</p></NodeLock>
        <TextBlurIn text="Проявлений текст" />
        <LineReveal text="Рядок за рядком" />
      </>,
    );
    // Every element rendered at opacity 0 carries the mark, and nothing else does
    // (gp-reviewer R1: every word that renders opacity 0 on the server).
    const hidden = [...html.matchAll(/<(?:div|span)([^>]*)>/g)].map((m) => m[1]!).filter((a) => /opacity:\s*0/.test(a));
    expect(hidden).toHaveLength(7);
    for (const attrs of hidden) expect(attrs).toContain(`${ENTRANCE_ATTRIBUTE}=""`);
    expect(html.match(new RegExp(`${ENTRANCE_ATTRIBUTE}=""`, "g"))).toHaveLength(7);
  });

  it("the hero's CSS entrances carry the mark too, so the scriptless fold does not wait on an animation (U1)", () => {
    const html = renderToStaticMarkup(<Hero />);
    const wrappers = [...html.matchAll(/<div([^>]*class="entrance[^"]*"[^>]*)>/g)].map((m) => m[1]!);
    expect(wrappers).toHaveLength(2);
    for (const attrs of wrappers) expect(attrs).toContain(`${ENTRANCE_ATTRIBUTE}=""`);
  });

  it("the rule names the mark alone, and undoes every property an entrance hides with", () => {
    expect(NO_SCRIPT_ENTRANCE_CSS.startsWith(`[${ENTRANCE_ATTRIBUTE}]{`)).toBe(true);
    // One selector: a rule on `opacity` in general would show a word's inactive panel too.
    expect(NO_SCRIPT_ENTRANCE_CSS.match(/\{/g)).toHaveLength(1);
    expect(NO_SCRIPT_ENTRANCE_CSS).not.toContain(",");
    for (const declaration of ["opacity:1!important", "transform:none!important", "filter:none!important"]) {
      expect(NO_SCRIPT_ENTRANCE_CSS).toContain(declaration);
    }
  });

  it("the root layout ships the rule inside <noscript>, where only a scriptless browser reads it", () => {
    const html = renderToStaticMarkup(<RootLayout><main /></RootLayout>);
    expect(html).toContain(`<noscript><style>${NO_SCRIPT_ENTRANCE_CSS}</style></noscript>`);
    // Nowhere else: outside <noscript> it would flatten every entrance for everyone.
    expect(html.split(NO_SCRIPT_ENTRANCE_CSS)).toHaveLength(2);
  });
});
