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

describe("hero and sources", () => {
  const hero = section("hero", "sources");
  it("opens with the pill, the accented promise, two actions and three facts", () => {
    expect(hero).toContain('data-slot="pill"');
    expect(hero).toContain('data-accent="true">доказ</span>');
    expect(hero).toContain('href="#pilot"');
    expect(hero).toContain('href="#compare"');
    for (const f of landingContent.hero.facts) expect(hero).toContain(f.value);
  });
  it("shows the board with three columns, the selected card, the receipt and the beam", () => {
    expect(hero).toContain('aria-label="Стан пакету робіт у веб-застосунку GoProceed"');
    expect(hero).toContain("Готово");
    expect(hero).toContain("На розгляді");
    expect(hero).toContain("Заблоковано");
    expect(hero).toContain('data-board-card="selected"');
    expect(hero).toContain('aria-label="Квитанція доказу EV-0248"');
    expect(hero).toContain('class="beam"');
    expect(hero).toContain(landingContent.hero.dimension);
  });
  it("lists the six requirement sources", () => {
    const sources = section("sources", "problem");
    for (const s of landingContent.sources.items) expect(sources).toContain(s.code);
  });
});

describe("problem and compare", () => {
  const problem = section("problem", "compare");
  const compare = section("compare", "roles");
  it("tints the statement and shows Рис. 01 with the found message and the record", () => {
    expect(problem).toContain(landingContent.problem.statement);
    expect(problem).toContain("Рис. 01");
    expect(problem).toContain('data-message="hit"');
    for (const m of ["без осі", "без вимоги", "без рішення"]) expect(problem).toContain(m);
    expect(problem).toContain("DR-0091 · прийнято технаглядом · 16:18");
  });
  it("pairs five rows across the two cards and states both outcomes", () => {
    expect(compare.match(/data-compare-row=/g)).toHaveLength(10);
    expect(compare).toContain(landingContent.compare.was.outcome);
    // now.outcome contains "пам'ять" — React's static-markup renderer escapes
    // the apostrophe in text children to &#x27; (verified: this is not a
    // component bug, `renderToStaticMarkup(<p>{"a'b"}</p>)` does the same).
    // task-16's hero test avoids this by never toContain-ing hero.lead, which
    // has the same apostrophe; here the outcome is the one thing worth
    // asserting, so decode that one entity instead of skipping the check.
    expect(compare.replace(/&#x27;/g, "'")).toContain(landingContent.compare.now.outcome);
  });
});
