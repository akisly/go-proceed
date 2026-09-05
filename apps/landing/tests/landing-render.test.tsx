import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../app/page";
import { landingContent } from "../content/landing-content";

export const html = renderToStaticMarkup(<LandingPage />);
export const section = (id: string, next?: string) =>
  html.slice(html.indexOf(`id="${id}"`), next ? html.indexOf(`id="${next}"`) : undefined);

describe("the Daylight page — skeleton", () => {
  it("has one main heading, a skip link and the mark twice", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('href="#main-content"');
    expect(html.match(/data-brand-mark="true"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("renders the twelve sections in the prototype's order", () => {
    const ids = ["hero", "sources", "problem", "compare", "roles", "stages", "position", "capture", "trust", "pilot", "faq", "cta-final"];
    let cursor = -1;
    for (const id of ids) {
      const at = html.indexOf(`id="${id}"`);
      expect(at, id).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("numbers the eight section rules 01–08 in order", () => {
    expect(html.match(/data-section-rule="\d\d"/g)).toEqual(
      ["01", "02", "03", "04", "05", "06", "07", "08"].map((n) => `data-section-rule="${n}"`),
    );
  });

  it("puts the four header links in page order and the ink action", () => {
    const nav = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    for (const item of landingContent.nav.items) expect(nav).toContain(`href="${item.href}"`);
    expect(nav.indexOf('href="#compare"')).toBeLessThan(nav.indexOf('href="#roles"'));
    expect(nav.indexOf('href="#roles"')).toBeLessThan(nav.indexOf('href="#stages"'));
    expect(nav.indexOf('href="#stages"')).toBeLessThan(nav.indexOf('href="#faq"'));
    expect(nav).toContain(landingContent.nav.action);
    expect(nav).not.toContain("bg-action-signal");
  });

  it("uses no signal button anywhere on the page", () => {
    expect(html).not.toContain("bg-action-signal");
  });

  it("ends with the factual footer", () => {
    const footer = html.slice(html.indexOf("<footer"));
    expect(footer).toContain(landingContent.footer.disclaimer);
    expect(footer).toContain("mailto:akisliy2306@gmail.com");
    expect(footer).toContain("© 2026 GoProceed");
  });
});
