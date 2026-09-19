import { describe, expect, it, vi } from "vitest";
import { landingContent } from "../content/landing-content";
import { PAGE_KEYS, renderPage, sectionOf } from "./helpers/pages";
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

// [DEV-022] Four pages. `home`, `product`, `roles` and `pilot` are each one
// whole document body; `all` is what a claim about «the site» is checked on.
const pages = Object.fromEntries(PAGE_KEYS.map((key) => [key, renderPage(key)])) as Record<(typeof PAGE_KEYS)[number], string>;
const { home, product, roles: rolesPage, pilot: pilotPage } = pages;
const all = Object.values(pages).join("\n");
const inHome = sectionOf(home);
const inProduct = sectionOf(product);
const inRoles = sectionOf(rolesPage);
const inPilot = sectionOf(pilotPage);
const headerOf = (html: string) => html.slice(html.indexOf("<header"), html.indexOf("</header>"));

/** The blocks each page renders, in order — the site map of DEV-022. */
const COMPOSITION = {
  home: ["hero", "sources", "problem", "scenes", "position", "cta-final"],
  product: ["stages", "capture", "trust", "cta-final"],
  roles: ["roles", "compare", "cta-final"],
  pilot: ["pilot", "faq"],
} as const;
const ALL_BLOCKS = [...new Set(Object.values(COMPOSITION).flat())];

describe("the four pages — skeleton", () => {
  it.each(PAGE_KEYS)("%s has one main heading, a skip link and the mark twice", (key) => {
    expect(pages[key].match(/<h1/g)).toHaveLength(1);
    expect(pages[key]).toContain('href="#main-content"');
    expect(pages[key]).toContain('id="main-content"');
    expect(pages[key].match(/data-brand-mark="true"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it.each(PAGE_KEYS)("%s renders its own blocks, in order, and no other page's", (key) => {
    let cursor = -1;
    for (const id of COMPOSITION[key]) {
      const at = pages[key].indexOf(`id="${id}"`);
      expect(at, id).toBeGreaterThan(cursor);
      cursor = at;
    }
    const foreign = ALL_BLOCKS.filter((id) => !(COMPOSITION[key] as readonly string[]).includes(id));
    for (const id of foreign) expect(pages[key], `${key} must not render #${id}`).not.toContain(`id="${id}"`);
  });

  it("keeps the home page to six blocks", () => {
    expect(home.match(/<section/g)).toHaveLength(6);
  });

  it("numbers the section rules from 01 on each page", () => {
    const rules = (html: string) => (html.match(/data-section-rule="\d\d"/g) ?? []).map((m) => m.slice(19, 21));
    expect(rules(home)).toEqual(["01", "02", "03"]);
    expect(rules(product)).toEqual(["01", "02", "03"]);
    expect(rules(rolesPage)).toEqual(["01", "02"]);
    expect(rules(pilotPage)).toEqual(["01"]);
  });

  it.each(PAGE_KEYS)("%s: the header links to the three sub-pages in order, with the ink action to the form", (key) => {
    const nav = headerOf(pages[key]);
    const at = landingContent.nav.items.map((item) => nav.indexOf(`href="${item.href}"`));
    for (const i of at) expect(i).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(nav).toContain('href="/"');
    expect(nav).toContain(landingContent.nav.action);
    expect(nav).not.toContain("bg-action-signal");
    expect(nav).not.toContain('href="#');
  });

  it("marks the page being served as current, and only that one", () => {
    expect(headerOf(home)).not.toContain("aria-current");
    // U-03: on /pilot the ink action goes to the form, not to the page it is on
    expect(headerOf(pilotPage)).toContain(`href="${landingContent.nav.actionHrefOnPilot}"`);
    expect(headerOf(home)).not.toContain(landingContent.nav.actionHrefOnPilot);
    for (const key of ["product", "roles", "pilot"] as const) {
      const nav = headerOf(pages[key]);
      const path = landingContent.pages[key].path;
      // once in the desktop row and once in the phone strip
      expect(nav.match(/aria-current="page"/g), key).toHaveLength(2);
      expect(nav.match(new RegExp(`aria-current="page"[^>]*href="${path}"|href="${path}"[^>]*aria-current="page"`, "g")), key).toHaveLength(2);
    }
  });

  it("uses no signal button anywhere on the site", () => {
    expect(all).not.toContain("bg-action-signal");
  });

  it.each(PAGE_KEYS)("%s ends with the factual footer, its links page links", (key) => {
    const footer = pages[key].slice(pages[key].indexOf("<footer"));
    expect(footer).toContain(landingContent.footer.disclaimer);
    expect(footer).toContain("mailto:akisliy2306@gmail.com");
    expect(footer).toContain("© 2026 GoProceed");
    expect(footer).toContain('href="/product#trust"');
    expect(footer).not.toContain('href="#');
  });

  it("holds the one form on /pilot", () => {
    expect(pilotPage.match(/<form/g)).toHaveLength(1);
    for (const key of ["home", "product", "roles"] as const) expect(pages[key], key).not.toContain("<form");
  });
});

describe("hero and sources", () => {
  const hero = inHome("hero", "sources");
  it("opens with the pill, the promise line by line, the definition and two magnetic actions", () => {
    expect(hero).toContain(landingContent.hero.pill.badge);
    expect(hero.match(/<h1/g)).toHaveLength(1);
    // LineReveal: the h1 text once for readers, once as words; the accent marked.
    expect(hero).toContain(`class="sr-only">${landingContent.hero.title}<`);
    expect(hero.match(/data-accent="true"/g)?.length).toBeGreaterThanOrEqual(1);
    // Controls only — `area="self"`. The hero also carries three `section`
    // magnets on the frame's satellites, which are decoration, not controls.
    expect(hero.match(/data-magnetic-area="self"/g)).toHaveLength(3); // pill + two buttons
    expect(hero).toContain(landingContent.hero.lead);
    expect(hero).toContain(`href="${landingContent.pages.pilot.path}"`);
    expect(hero).toContain(`href="${landingContent.pages.product.path}"`);
    // [DEV-022] the role facts moved to /roles
    expect(hero).not.toContain("data-role-facts");
  });
  it("layers the receipt and the two pills at depth, tilts the board and pulses the review tags", () => {
    expect(hero).toContain('data-depth="-0.3"');
    expect(hero).toContain('data-depth="0.35"');
    expect(hero).toContain('data-depth="0.25"');
    expect(hero.match(/data-tilt="off"/g)).toHaveLength(1);
    // The three satellites follow the pointer by translating instead — see
    // pointer-tilt.test.tsx for why rotation cannot carry an object this small.
    expect(hero.match(/data-magnetic-area="section"/g)).toHaveLength(3);
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
    const sources = inHome("sources", "problem");
    for (const s of landingContent.sources.items) expect(sources).toContain(s.code);
  });
});

describe("problem and compare", () => {
  const problem = inHome("problem", "scenes");
  const compare = inRoles("compare", "cta-final");
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
  const roles = inRoles("roles", "compare");
  const route = inProduct("stages", "capture");
  it("renders the four role cells with pains and gains, the payer first, and one fact per role", () => {
    expect(roles.match(/data-slot="feature-cell"/g)).toHaveLength(4);
    for (const cell of landingContent.roles.cells) { expect(roles).toContain(cell.title); expect(roles).toContain(cell.pain); }
    expect(roles).toContain("Telegram-бот або мобільний застосунок, без форм");
    const order = landingContent.roles.cells.map((cell) => roles.indexOf(cell.pain));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(roles.indexOf("Власник")).toBeLessThan(roles.indexOf("ПТВ"));
    expect(roles).toContain("data-role-facts");
    for (const f of landingContent.roles.facts) expect(roles).toContain(f.value);
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
  const position = inHome("position", "cta-final");
  const capture = inProduct("capture", "trust");
  const trust = inProduct("trust", "cta-final");
  it("states the position with three pills and the way on to the limits", () => {
    expect(position).toContain(landingContent.position.quote);
    expect(position.match(/data-position-pill=/g)).toHaveLength(3);
    expect(position).toContain('href="/product#trust"');
  });
  it("shows the two foreman channels, the office web app and the converging record", () => {
    for (const ch of landingContent.capture.channels) expect(capture).toContain(ch.title);
    expect(capture).toContain("Збережено як");
    // ADR-007 decision 6: the client uploads at once and shows no queue.
    expect(capture).toContain("надсилається");
    expect(capture).not.toContain("очікує мережу");
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
  const trust = inProduct("trust", "cta-final");
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
    const strip = inHome("sources", "problem");
    const sources = strip.slice(0, strip.indexOf("</section>"));
    expect(sources).not.toContain('aria-hidden="true"');
    expect(sources).toContain(`aria-label="${landingContent.sources.label}"`);
    for (const item of landingContent.sources.items) expect(sources).toContain(item.code);
  });

  it("does not claim a list of links that has no list items", () => {
    const nav = headerOf(home);
    if (nav.includes('role="list"')) expect(nav).toMatch(/role="listitem"/);
    else expect(nav).toContain("<ul");
  });
});

describe("pilot", () => {
  const pilot = inPilot("pilot", "faq");
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
  it("posts to the handler without JavaScript and keeps a mail path that needs none", () => {
    expect(pilot).toContain('method="post"');
    expect(pilot).toContain('action="/api/pilot"');
    expect(pilot).not.toMatch(/<form[^>]*method="get"/);
    expect(pilot).toContain(`mailto:${PILOT_EMAIL}`);
    expect(pilot).toContain(landingContent.pilot.form.mailNote);
    // the mail line is copy, not a second call to action
    expect(pilot).not.toContain("bg-action-signal");
  });

  it("never prints the pilot address as text anywhere on the site", () => {
    // It is a personal mailbox, and naming it said «one developer» louder than
    // any sentence in the copy (2026-09-08). It survives only inside `href`,
    // where the mail client reads it and the reader does not.
    // Tags only: the JSON-LD script's text stays in `visible`, so structured
    // data is held to the same rule as the copy.
    const visible = all.replace(/<[^>]*>/g, " ");
    expect(visible).not.toContain(PILOT_EMAIL);
    expect(all).toContain(`mailto:${PILOT_EMAIL}`);
  });
});

describe("faq and cta", () => {
  it("asks the seven questions in an accordion with the plus marker", () => {
    const faq = inPilot("faq");
    expect(faq.match(/data-accordion-marker="plus"/g)).toHaveLength(7);
    expect(faq).toContain("Скільки коштує пілот і хто відповідає?");
  });
  it.each(["home", "product", "roles"] as const)("%s closes with the offer: the light card, three marks, the way to the form and the copy-link button", (key) => {
    const cta = sectionOf(pages[key])("cta-final");
    // LineReveal marks the accent phrase word by word, not as one span.
    const accentWords = landingContent.cta.titleAccent.split(" ");
    expect(cta.match(/data-accent="true"/g)).toHaveLength(accentWords.length);
    for (const word of accentWords) expect(cta).toContain(`data-accent="true" class="text-accent">${word}</span>`);
    // U-02: «Заповнити запит» lands on the form, which a phone shows ~1 650px down /pilot
    expect(cta).toContain('href="/pilot#request"');
    expect(pilotPage).toContain('id="request"');
    expect(cta).toContain(landingContent.cta.share);
    expect(cta).toContain("data-offer-points");
    for (const point of landingContent.cta.points) expect(cta).toContain(point);
  });
});

describe("prototype parity — headings and statements (2026-09-06)", () => {
  it("sets every section heading line by line, the sub-pages' h1 included", () => {
    // [DEV-022] home: scenes, offer. product: capture, trust, offer (the route
    // is its h1). roles: compare, offer. pilot: faq.
    // A sub-page's cards, cells and steps are h2 as well (R-02); those are
    // titles, not section headings, and are not set line by line.
    const count = { home: 2, product: 3, roles: 2, pilot: 1 } as const;
    for (const key of PAGE_KEYS) {
      expect(pages[key].match(/<h2[^>]*><span class="sr-only">/g), key).toHaveLength(count[key]);
      expect(pages[key].match(/<h1[^>]*><span class="sr-only">/g), key).toHaveLength(1);
    }
  });

  it.each(PAGE_KEYS)("%s: the heading outline never skips a level", (key) => {
    // [R-02] Promoting a block's heading to the page's h1 left its cards at h3:
    // h1 → h3 on all three sub-pages, which is axe's `heading-order`.
    const levels = [...pages[key].matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    expect(levels[0], "the first heading is the h1").toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]! - levels[i - 1]!, `${key}: h${levels[i - 1]} → h${levels[i]} at heading ${i}`).toBeLessThanOrEqual(1);
    }
  });
  it("dims the quote's prefix and fades both statements by opacity", () => {
    const position = inHome("position", "cta-final");
    const prefixWords = landingContent.position.quoteDim.split(" ").length;
    expect(position.match(/text-ink-muted/g)?.length).toBeGreaterThanOrEqual(prefixWords);
    expect(position).toContain("opacity:0.14");
    expect(inHome("problem", "scenes")).toContain("opacity:0.14");
  });
  it("magnetises every marketing button but the header's", () => {
    // Counted by `area="self"`, which is what a CONTROL uses: hero pill + 2,
    // the offer 2, pilot form 2 (the mail fallback renders only in the failed
    // state). The `section` magnets are the hero's receipt and two pills —
    // decoration that follows the pointer, not something you click.
    const self = { home: 5, product: 2, roles: 2, pilot: 2 } as const;
    for (const key of PAGE_KEYS) {
      expect(pages[key].match(/data-magnetic-area="self"/g) ?? [], key).toHaveLength(self[key]);
      expect(pages[key].match(/data-magnetic-area="section"/g) ?? [], key).toHaveLength(key === "home" ? 3 : 0);
      expect(pages[key].slice(0, pages[key].indexOf('id="main-content"')), key).not.toContain("data-magnetic");
    }
  });
});

describe("prototype parity — compare, roles, provenance (2026-09-06)", () => {
  it("slides the two compare cards in from their sides and pops the checks", () => {
    const compare = inRoles("compare", "cta-final");
    expect(compare).toContain("translateX(-20px)");
    expect(compare).toContain("translateX(20px)");
    expect(compare.match(/scale\(0\)/g)).toHaveLength(landingContent.compare.now.rows.length);
    expect(compare).toContain("shadow-float-accent");
  });
  it("staggers the four role cells, and leaves them still", () => {
    // [2026-09-08] The cells used to carry a tilt. Only the hero's frame
    // follows the cursor now — see pointer-tilt.test.tsx.
    const roles = inRoles("roles", "compare");
    expect(roles).not.toContain("data-tilt");
    expect(roles.match(/data-slot="feature-cell"/g)).toHaveLength(4);
  });
  it("staggers the three bento cells", () => {
    const trust = inProduct("trust", "cta-final");
    expect(trust.match(/data-slot="bento-cell"/g)).toHaveLength(3);
  });
});

describe("prototype parity — route and capture (2026-09-06)", () => {
  const route = inProduct("stages", "capture");
  const capture = inProduct("capture", "trust");
  it("stacks the five route cards in one ScrollStack, each media half tinted, glowing and leaning", () => {
    expect(route).toContain('data-scroll-stack="off"');
    expect(route.match(/data-stack-card="\d"/g)).toHaveLength(5);
    expect(route.match(/data-stack-media=""/g)).toHaveLength(5);
    for (const n of [1, 2, 3, 4, 5]) expect(route).toContain(`media-tint-${n}`);
    expect(route.match(/media-glow-/g)).toHaveLength(5);
    expect(route).not.toContain("landing-route-card");
  });
  it("gives every route card the ground of its own stage — five distinct photographs, in route order", () => {
    // The grounds are the only images in the section carrying `-z-20`; the
    // photograph inside the capture mockup is a different element. Before
    // 2026-09-08 only card 01 had one and the other four sat on a gradient.
    const grounds = [...route.matchAll(/-z-20 object-cover[^>]*?url=%2Fpublic%2Fimages%2F([a-z0-9-]+)\.jpg/g)].map((m) => m[1]);
    expect(grounds).toEqual(["photo-blueprint", "photo-site-trays", "photo-schematic", "photo-plan-stamped", "photo-tracing"]);
    expect(new Set(grounds).size).toBe(5);
  });
  it("leaves the three channel cards still, pulses the pilot chip and flows the dashes to one record", () => {
    expect(capture).not.toContain("data-tilt");
    expect(capture.match(/pulse-dot/g)).toHaveLength(1);
    expect(capture.match(/flow-dash/g)).toHaveLength(3);
  });
});

describe("the home page's three product scenes (DEV-022)", () => {
  const scenes = inHome("scenes", "position");

  it("shows three scenes, sides alternating, each beside its live UI window", () => {
    expect(scenes.match(/data-scene=/g)).toHaveLength(3);
    expect([...scenes.matchAll(/data-scene="([a-z]+)"/g)].map((m) => m[1])).toEqual(["capture", "review", "act"]);
    for (const item of landingContent.scenes.items) { expect(scenes).toContain(item.eyebrow); expect(scenes).toContain(item.note); }
    // the same windows the route cards show on /product
    for (const mark of ["Зняти фото", "goproceed.app/r/7k2…f9", "ЧЕРНЕТКА"]) expect(scenes).toContain(mark);
    expect(scenes.match(/wide:order-2/g)).toHaveLength(1);
  });

  it("reveals the copy and the media of a scene separately, so a tall phone row paints as it arrives", () => {
    // [U-01] One `Reveal` around a whole row — ~1 000px tall below `wide` —
    // needs 35 % of that in view before anything paints: a blank fold under
    // the section head, under reduced motion too. The row itself must not be
    // the animated element; its two halves are.
    const rows = [...scenes.matchAll(/<article[^>]*data-scene="[a-z]+"[^>]*>/g)].map((m) => m[0]);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).not.toMatch(/opacity|transform/);
    // the scene titles carry no accent (U-05): the section h2 owns the fold's cobalt
    const afterHead = scenes.slice(scenes.indexOf("data-scene="));
    expect(afterHead).not.toContain('data-accent="true"');
  });

  it("is the short form of the route: no sticky stack, no scroll source, no tilt", () => {
    expect(scenes).not.toContain("data-scroll-stack");
    expect(scenes).not.toContain("data-stack-card");
    expect(scenes).not.toContain("data-tilt");
  });

  it("leads on to the whole route", () => {
    expect(scenes).toContain(`href="${landingContent.scenes.more.href}"`);
    expect(scenes).toContain(landingContent.scenes.more.label);
  });

  it("says the draft act is a draft, on the page where the act first appears", () => {
    expect(scenes).toContain("Це чернетка для підпису, а не підписаний документ.");
  });
});

describe("navigation reaches the pages on a phone", () => {
  // The desktop links are `hidden md:flex` — `display: none` below `md`, and
  // so out of the accessibility tree as well as out of sight. The strip under
  // the bar is the only set of page links a phone has.
  const nav = headerOf(home);

  it("offers the same links below md, not only above it", () => {
    for (const item of landingContent.nav.items) {
      const links = nav.split(`href="${item.href}"`).length - 1;
      expect(links, item.href).toBeGreaterThanOrEqual(2); // the desktop row and the phone strip
    }
  });

  it("hides the phone strip once the desktop row appears", () => {
    expect(nav).toContain("md:hidden");
  });

  it("keeps the strip reachable: a labelled nav of its own, focusable, not aria-hidden", () => {
    // [DEV-022] Until now the strip was `aria-hidden` with `tabindex=-1`, on
    // the belief that the row above stayed announced at every width. It does
    // not — `hidden` is `display: none` — so a phone's screen reader had no
    // links at all. Only one of the two navs is ever displayed, so nothing is
    // announced twice.
    expect(nav.match(/<nav /g)).toHaveLength(2);
    expect(nav.match(/aria-label="Головна навігація"/g)).toHaveLength(1);
    expect(nav.match(/aria-label="Сторінки сайту"/g)).toHaveLength(1);
    const strip = nav.slice(nav.indexOf('aria-label="Сторінки сайту"'));
    expect(strip).not.toContain("aria-hidden");
    expect(strip).not.toContain('tabindex="-1"');
  });
});
