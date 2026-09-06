import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "../app/page";
import { landingContent } from "../content/landing-content";
import { PILOT_EMAIL } from "../content/pilot-request";

// The full-page render exercises the hydrated, motion-enabled tree — the same
// technique `ui-components.test.tsx` and `motion-parity.test.tsx` use — so
// that scroll-linked words (ScrollTint's fade) and line-by-line headings
// (LineReveal) render their animated markup rather than the SSR-conservative
// fallback `useReduced()` forces before hydration. The dedicated reduced-motion
// contract lives in `motion-parity-reduced.test.tsx` and is untouched by this.
vi.mock("../../../packages/ui/src/motion/use-reduced", () => ({
  useReduced: () => false,
  shouldReduce: () => false,
}));

export const html = renderToStaticMarkup(<LandingPage />).replace(/&#x27;/g, "'");
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
  it("opens with the pill, the promise line by line, two magnetic actions and three facts", () => {
    expect(hero).toContain(landingContent.hero.pill.badge);
    expect(hero.match(/<h1/g)).toHaveLength(1);
    // LineReveal: the h1 text once for readers, once as words; the accent marked.
    expect(hero).toContain(`class="sr-only">${landingContent.hero.title}<`);
    expect(hero.match(/data-accent="true"/g)?.length).toBeGreaterThanOrEqual(1);
    expect(hero.match(/data-magnetic="off"/g)).toHaveLength(3); // pill + two buttons
    for (const f of landingContent.hero.facts) expect(hero).toContain(f.value);
  });
  it("layers the receipt and the two pills at depth, tilts the board and pulses the review tags", () => {
    expect(hero).toContain('data-depth="-0.3"');
    expect(hero).toContain('data-depth="0.35"');
    expect(hero).toContain('data-depth="0.25"');
    expect(hero.match(/data-tilt="off"/g)).toHaveLength(1);
    expect(hero.match(/pulse-dot/g)).toHaveLength(2); // the two review cards on the board
    expect(hero).toContain("drift-a");
    expect(hero).toContain("drift-b");
    expect(hero).toContain("drift-c");
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
    expect(compare).toContain(landingContent.compare.now.outcome);
  });
});

describe("roles and route", () => {
  const roles = section("roles", "stages");
  const route = section("stages", "position");
  it("renders the four role cells with pains and gains", () => {
    expect(roles.match(/data-slot="feature-cell"/g)).toHaveLength(4);
    for (const cell of landingContent.roles.cells) { expect(roles).toContain(cell.title); expect(roles).toContain(cell.pain); }
    expect(roles).toContain("Telegram-бот або мобільний застосунок, без форм");
  });
  it("stacks five route cards, alternating sides, each with its window", () => {
    expect(route.match(/data-route-card=/g)).toHaveLength(5);
    expect(route.match(/data-route-card="flip"/g)).toHaveLength(2);
    for (const s of landingContent.route.steps) expect(route).toContain(s.eyebrow);
    for (const code of ["R-041 · Кабельний лоток до закриття стелі", "Зняти фото", "goproceed.app/r/7k2…f9", "Закриття · CL-017", "ЧЕРНЕТКА"]) expect(route).toContain(code);
    expect(route).toContain("Це чернетка для підпису, а не підписаний документ.");
  });
});

describe("position, capture, provenance", () => {
  const position = section("position", "capture");
  const capture = section("capture", "trust");
  const trust = section("trust", "pilot");
  it("states the position with three pills", () => {
    expect(position).toContain(landingContent.position.quote);
    expect(position.match(/data-position-pill=/g)).toHaveLength(3);
  });
  it("shows the two foreman channels, the office web app and the converging record", () => {
    for (const ch of landingContent.capture.channels) expect(capture).toContain(ch.title);
    expect(capture).toContain("Збережено як");
    expect(capture).toContain("очікує мережу");
    expect(capture).toContain("EV-0248");
  });
  it("renders the access matrix, immutability and the limits of v0.1", () => {
    expect(trust.match(/data-slot="bento-cell"/g)).toHaveLength(3);
    expect(trust.match(/data-access=/g)).toHaveLength(28);
    expect(trust).toContain("Історія подій не редагується, лише доповнюється");
    expect(trust).toContain("Чернетка акта не є підписаним документом");
  });
});

// The four semantics the whole-branch review found wrong: a matrix whose dots
// announced nothing, two inverted lists with no labels, six requirement sources
// hidden outright, and a `role="list"` with no list items in it.
describe("what assistive technology is told", () => {
  const trust = section("trust", "pilot");
  const a = landingContent.provenance.access;

  it("renders the access matrix as a real table with headers and spoken levels", () => {
    expect(trust).toContain("<table");
    // one header row of four roles plus seven data rows
    expect(trust.match(/<th[^>]*scope="col"/g)).toHaveLength(4);
    expect(trust.match(/<th[^>]*scope="row"/g)).toHaveLength(a.rows.length);
    expect(trust.match(/<tr/g)).toHaveLength(a.rows.length + 1);
    expect(trust.match(/data-access=/g)).toHaveLength(28);
    // every cell says its level in words, not only in colour
    const spoken = trust.match(/<span class="sr-only">/g) ?? [];
    expect(spoken.length).toBeGreaterThanOrEqual(28);
    for (const level of ["full", "own", "none"] as const) expect(trust).toContain(a.legend[level]);
    // an `aria-label` on a bare <i> is prohibited by the generic role: gone
    expect(trust).not.toMatch(/<i[^>]*aria-label/);
  });

  it("labels the two halves of the v0.1 limits so the polarity is announced", () => {
    const l = landingContent.provenance.limits;
    expect(trust).toContain(l.doesTitle);
    expect(trust).toContain(l.doesNotTitle);
    expect(trust.match(/<ul[^>]*aria-labelledby=/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the six requirement sources readable and names the strip", () => {
    // slice to the strip's own closing tag: the decorative section rule that
    // follows it is legitimately aria-hidden and would mask the assertion
    const strip = section("sources", "problem");
    const sources = strip.slice(0, strip.indexOf("</section>"));
    expect(sources).not.toContain('aria-hidden="true"');
    expect(sources).toContain(`aria-label="${landingContent.sources.label}"`);
    for (const item of landingContent.sources.items) expect(sources).toContain(item.code);
  });

  it("does not claim a list of links that has no list items", () => {
    const nav = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    if (nav.includes('role="list"')) expect(nav).toMatch(/role="listitem"/);
    else expect(nav).toContain("<ul");
  });
});

describe("pilot", () => {
  const pilot = section("pilot", "faq");
  it("walks the four steps, the three cards and the author note", () => {
    expect(pilot.match(/data-slot="step"/g)).toHaveLength(4);
    for (const box of [landingContent.pilot.needs, landingContent.pilot.gets, landingContent.pilot.terms]) expect(pilot).toContain(box.title);
    expect(pilot).toContain(landingContent.pilot.author.signature);
    expect(pilot).toContain("пілот безкоштовний");
  });
  it("renders an honest form: labelled fields, a hidden honeypot, a live region, no success text", () => {
    expect(pilot).toContain("<form");
    expect(pilot).toContain('name="name"');
    expect(pilot).toContain('name="contact"');
    expect(pilot).toContain('name="website"');
    expect(pilot).toContain('tabindex="-1"');
    expect(pilot).toContain('aria-live="polite"');
    expect(pilot).toContain('data-form-state="idle"');
    expect(pilot).not.toContain(landingContent.pilot.form.sent);
  });
  // Spec §9.1: with JavaScript unavailable the form still renders, the address
  // is visible in the copy under it, and nothing claims to have sent anything.
  // Without a method the default submit is a GET, which puts the applicant's
  // name and phone into the address bar, the history and every later Referer.
  it("posts to the handler without JavaScript and shows the address unconditionally", () => {
    expect(pilot).toContain('method="post"');
    expect(pilot).toContain('action="/api/pilot"');
    expect(pilot).not.toMatch(/<form[^>]*method="get"/);
    expect(pilot).toContain(`mailto:${PILOT_EMAIL}`);
    expect(pilot).toContain(PILOT_EMAIL);
    expect(pilot).toContain(landingContent.pilot.form.mailNote);
    // the address line is copy, not a second call to action
    expect(pilot).not.toContain("bg-action-signal");
  });
});

describe("faq and cta", () => {
  it("asks the seven questions in an accordion with the plus marker", () => {
    const faq = section("faq", "cta-final");
    expect(faq.match(/data-accordion-marker="plus"/g)).toHaveLength(7);
    expect(faq).toContain("Скільки коштує пілот і хто відповідає?");
  });
  it("closes with the light card, the pilot link and the copy-link button", () => {
    const cta = section("cta-final");
    // LineReveal marks the accent phrase word by word, not as one span.
    const accentWords = landingContent.cta.titleAccent.split(" ");
    expect(cta.match(/data-accent="true"/g)).toHaveLength(accentWords.length);
    for (const word of accentWords) expect(cta).toContain(`data-accent="true" class="text-accent">${word}</span>`);
    expect(cta).toContain('href="#pilot"');
    expect(cta).toContain(landingContent.cta.share);
  });
});

describe("prototype parity — headings and statements (2026-09-06)", () => {
  it("sets every section heading line by line", () => {
    // Eight h2.lines in the prototype: compare, roles, stages, capture, trust, pilot, faq, cta.
    const h2s = html.match(/<h2[^>]*>/g) ?? [];
    expect(h2s).toHaveLength(8);
    expect(html.match(/<h2[^>]*><span class="sr-only">/g)).toHaveLength(8);
  });
  it("dims the quote's prefix and fades both statements by opacity", () => {
    const position = section("position", "capture");
    const prefixWords = landingContent.position.quoteDim.split(" ").length;
    expect(position.match(/text-ink-muted/g)?.length).toBeGreaterThanOrEqual(prefixWords);
    expect(position).toContain("opacity:0.14");
    expect(section("problem", "compare")).toContain("opacity:0.14");
  });
  it("magnetises every marketing button but the header's", () => {
    const magnetic = html.match(/data-magnetic="off"/g) ?? [];
    // hero pill + 2, cta 2, pilot form 2 (the mail fallback renders only in the failed state)
    expect(magnetic).toHaveLength(7);
    expect(html.slice(0, html.indexOf('id="main-content"'))).not.toContain("data-magnetic");
  });
});
