import { describe, expect, it, vi } from "vitest";
import { landingContent } from "../content/landing-content";
import { PILOT_EMAIL } from "../content/pilot-request";
import { PAGE_KEYS, renderPage, sectionOf } from "./helpers/pages";

// The full-page render exercises the hydrated, motion-enabled tree — the same
// technique `ui-components.test.tsx` and `motion-parity.test.tsx` use — so
// that scroll-linked words (ScrollTint's fade) render their animated markup
// rather than the SSR-conservative fallback `useReduced()` forces before
// hydration. The dedicated reduced-motion contract lives in
// `motion-parity-reduced.test.tsx` and is untouched by this.
vi.mock("../../../packages/ui/src/motion/use-reduced", () => ({
  useReduced: () => false,
  shouldReduce: () => false,
}));

// [DEV-022] Four pages, each one whole document body; `all` is what a claim
// about «the site» is checked on.
// [DEV-023] The pages took the form of the owner's reference («1 в 1», our
// colours). What each block CLAIMS is pinned as before; what changed is the
// composition those claims sit in, and every assertion below that names a
// composition names the reference's.
const pages = Object.fromEntries(PAGE_KEYS.map((key) => [key, renderPage(key)])) as Record<(typeof PAGE_KEYS)[number], string>;
const { home, product, roles: rolesPage, pilot: pilotPage } = pages;
const all = Object.values(pages).join("\n");
const inHome = sectionOf(home);
const inProduct = sectionOf(product);
const inRoles = sectionOf(rolesPage);
const inPilot = sectionOf(pilotPage);
const headerOf = (html: string) => html.slice(html.indexOf("<header"), html.indexOf("</header>"));
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

/** The blocks each page renders, in order — DEV-022's site map in DEV-023's form. */
const COMPOSITION = {
  home: ["hero", "intro", "scenes", "facts", "sources", "cta-final"],
  product: ["stages", "board", "capture", "trust", "position", "cta-final"],
  roles: ["roles", "problem", "compare", "cta-final"],
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

  it("lives inside the reference's frame, a raster band between the sections and before the footer", () => {
    // [DEV-023] The numbered section rules are gone with the one-page form.
    expect(all).not.toContain("data-section-rule");
    const bands = { home: 5, product: 5, roles: 4, pilot: 2 } as const;
    for (const key of PAGE_KEYS) {
      expect(count(pages[key], /data-band=""/g), key).toBe(bands[key]);
      expect(pages[key], key).toContain('class="landing-frame"');
      // the header sits between the inner guide lines, not across the viewport
      expect(headerOf(pages[key]), key).toContain("landing-header-rail");
      // [DEV-024, seventh pass; 2026-09-22, owner] the header's ground is a layer of its own, first in the header and
      // decorative. It is PERMANENT now — no script writes to it, so the header has one appearance at the top of the
      // page, half-way down it and without JavaScript. `data-at-top` is the attribute the lifted state used to carry.
      expect(headerOf(pages[key]), key).toMatch(/<header[^>]*class="landing-header [^"]*isolate[^"]*"[^>]*><i aria-hidden="true" data-header-veil="" class="landing-header-veil"><\/i>/);
      expect(headerOf(pages[key]), key).not.toContain("data-at-top");
      expect(headerOf(pages[key]), key).not.toContain("inset-x-0");
    }
  });

  it.each(PAGE_KEYS)("%s: the header links to the three sub-pages in order, with the ink pill to the form", (key) => {
    const nav = headerOf(pages[key]);
    const at = landingContent.nav.items.map((item) => nav.indexOf(`href="${item.href}"`));
    for (const i of at) expect(i).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(nav).toContain('href="/"');
    expect(nav).toContain(landingContent.nav.action);
    expect(nav).toContain('data-pill="ink"');
    expect(nav).not.toContain("bg-action-signal");
    expect(nav).not.toContain('href="#');
    // the header's control does not follow the pointer (parity spec 2026-09-06)
    expect(nav).not.toContain("data-magnetic");
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

describe("the first screen (DEV-023: the reference's)", () => {
  const hero = inHome("hero", "intro");
  it("fills the viewport under a pixel-rain field and over a perspective floor, both decorative", () => {
    expect(hero).toContain("min-h-dvh");
    expect(hero).toMatch(/<canvas[^>]*aria-hidden="true"[^>]*data-pixel-rain="running"/);
    expect(hero).toMatch(/<div[^>]*aria-hidden="true"[^>]*class="landing-floor/);
  });
  it("lights the floor's cells under the pointer, on the floor's own plane, and leaves the middle of the screen to a light (DEV-024)", () => {
    // The plane is an element so that it can carry the field; the field reads the
    // pointer in the plane's own coordinates, so the browser resolves the perspective.
    expect(hero).toMatch(/class="landing-floor-plane"><canvas[^>]*aria-hidden="true"[^>]*data-cell-field="off"[^>]*class="pointer-events-auto/);
    // [owner, third pass] a lit cell is the accent; the pixel field above stays ink
    expect(hero).toMatch(/class="landing-floor-plane"><canvas[^>]*class="[^"]*text-accent/);
    expect(hero).toMatch(/<canvas[^>]*data-pixel-rain[^>]*class="[^"]*text-ink/);
    expect(hero).toMatch(/<div[^>]*aria-hidden="true"[^>]*class="landing-hero-light/);
    // Two fifths of the first screen, where DEV-023 gave it a quarter.
    expect(hero).toMatch(/<canvas[^>]*data-pixel-rain[^>]*class="[^"]*h-\[42%\]/);
  });
  it("turns the product's name on an arc over the heading, hidden from assistive technology", () => {
    expect(hero).toMatch(/<div[^>]*aria-hidden="true"[^>]*data-orbit="turning"/);
    expect(hero).toContain("orbit-spin");
    // glyph by glyph — the phrase itself is never a text node here
    expect(hero).not.toContain(landingContent.hero.orbit);
  });
  it("states the promise as the page's h1, plain text that paints on the first frame, then the definition", () => {
    expect(hero.match(/<h1/g)).toHaveLength(1);
    // The whole title, in the markup, with one word in the accent inside it
    // [2026-09-22]: the tags are stripped before the comparison, so the h1 is
    // still asserted to say exactly what the content file says and nothing else.
    const h1 = hero.match(/<h1[\s\S]*?<\/h1>/)![0];
    // Entities decoded [R2-14]: the hero's title has no apostrophe today and the
    // product's copy is full of them.
    expect(h1.replace(/<[^>]+>/g, "").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")).toBe(landingContent.hero.title);
    expect(h1).toContain(`<span class="text-accent">${landingContent.hero.titleAccent}</span>`);
    expect(hero).toContain(landingContent.hero.lead);
    expect(hero.indexOf("<h1")).toBeLessThan(hero.indexOf(landingContent.hero.lead));
  });
  it("offers two pills — the ink one to the form's page with a travelling light, the paper one to the route", () => {
    expect(hero).toMatch(new RegExp(`href="${landingContent.pages.pilot.path}"[^>]*data-pill="ink"|data-pill="ink"[^>]*href="${landingContent.pages.pilot.path}"`));
    expect(hero).toMatch(new RegExp(`href="${landingContent.pages.product.path}"[^>]*data-pill="paper"|data-pill="paper"[^>]*href="${landingContent.pages.product.path}"`));
    // [DEV-024, owner] the primary pill's light is the reference's moving border in our accent:
    // `beam-pill` (2px, 3 s), not the 1px `beam` — and only the ink pill carries it.
    // [owner, sixth pass] …built the reference's way: a constant border, a light travelling along the outline, the pill's
    // face over both — three decorative layers, in that order, before the label; the pill clips them.
    expect(count(hero, /<i aria-hidden="true" data-pill-layer="ring" class="pill-ring"><\/i><i aria-hidden="true" data-beam="pill" class="pill-light in-focus-visible:hidden"><\/i><i aria-hidden="true" data-pill-layer="face" class="pill-face"><\/i>/g)).toBe(1);
    expect(hero).not.toContain('class="beam"');
    expect(hero).toMatch(/data-pill="ink"[^>]*class="[^"]*overflow-hidden[^"]*"|class="[^"]*overflow-hidden[^"]*"[^>]*data-pill="ink"/);
    expect(hero).not.toMatch(/data-pill="paper"[^>]*><i/);
    expect(hero).not.toMatch(/data-pill="paper"[^>]*class="[^"]*overflow-hidden|class="[^"]*overflow-hidden[^"]*"[^>]*data-pill="paper"/);
    expect(count(hero, /rounded-pill/g)).toBeGreaterThanOrEqual(2);
    expect(count(hero, /data-magnetic-area="self"/g)).toBe(2);
    // [DEV-022] the role facts live on /roles; [DEV-023] the state board on /product
    expect(hero).not.toContain("data-role-facts");
    expect(hero).not.toContain("data-board-card");
  });
});

describe("the home page's split, cards and fact band (DEV-023)", () => {
  const intro = inHome("intro", "scenes");
  const scenes = inHome("scenes", "facts");
  const facts = inHome("facts", "cta-final");

  it("says what the product is beside the records of one work, over two rows of drifting tags", () => {
    expect(intro).toContain(landingContent.intro.lead);
    expect(intro).toContain(landingContent.intro.rest);
    expect(intro).toContain(landingContent.intro.body);
    expect(intro).toContain(`href="${landingContent.intro.actionHref}"`);
    // the picture is one labelled image; its parts are not read out twice
    expect(intro).toContain(`role="img" aria-label="${landingContent.intro.menuLabel}. ${landingContent.intro.tagsLabel}."`);
    expect(count(intro, /marquee-track/g)).toBe(2);
    for (const code of ["EV-0248", "DR-0091", "CL-017"]) expect(intro).toContain(code);
  });

  it("numbers the four roles 01–04, the payer first", () => {
    const strip = landingContent.intro.strip;
    expect(strip.map((s) => s.index)).toEqual(["01", "02", "03", "04"]);
    expect(strip[0]?.title).toBe("Власник");
    const at = strip.map((s) => intro.indexOf(s.text));
    for (const i of at) expect(i).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("shows three cards on a grid ground, a product widget floating in each and the caption at its foot", () => {
    expect([...scenes.matchAll(/data-scene="([a-z]+)"/g)].map((m) => m[1])).toEqual(["capture", "review", "act"]);
    expect(count(scenes, /landing-gridcard/g)).toBe(3);
    for (const item of landingContent.scenes.items) { expect(scenes).toContain(item.eyebrow); expect(scenes).toContain(item.title); expect(scenes).toContain(item.note); }
    // the widgets draw the demonstration records, not strings of their own
    for (const mark of ["Лоток до закриття стелі", "Рішення DR-0091", "ЧЕРНЕТКА"]) expect(scenes).toContain(mark);
    expect(scenes).not.toContain("data-tilt");
    expect(scenes).not.toContain("data-scroll-stack");
  });

  it("says the draft act is a draft in text a sighted reader sees, on the page where the act first appears", () => {
    // [R-07] For one revision the notes were `sr-only`, and this test passed on
    // text nobody could see. The claim must not sit inside a visually hidden node.
    const disclaimer = "Це чернетка для підпису, а не підписаний документ.";
    expect(scenes).toContain(disclaimer);
    const at = scenes.indexOf(disclaimer);
    const opening = scenes.slice(scenes.lastIndexOf("<", at), at);
    expect(opening).not.toContain("sr-only");
    expect(scenes).not.toMatch(/class="sr-only">[^<]*чернетка/i);
  });

  it("reveals each card on its own, so a stacked phone column paints as it arrives", () => {
    // [R-02, and DEV-022's U-01 before it] One entrance keyed to the whole
    // column — ~1 300px below `wide` — leaves a blank fold under the heading.
    // The animated element must be the card's own wrapper, one per card.
    const wrappers = [...scenes.matchAll(/<div class="grid" style="[^"]*opacity:0[^"]*"><article[^>]*data-scene="([a-z]+)"/g)].map((m) => m[1]);
    expect(wrappers).toEqual(["capture", "review", "act"]);
  });

  it("titles each card with its title alone — the sentence after it is a paragraph, not heading text", () => {
    // [B-07 / R-14] A heading-navigation user heard 30–40 words per heading.
    for (const item of landingContent.scenes.items) {
      expect(scenes).toMatch(new RegExp(`<h3[^>]*>${item.title}\\.</h3>`));
    }
  });

  it("fills the reference's statistics band with terms of the pilot — no figure of merit is invented", () => {
    expect(count(facts, /data-fact=""/g)).toBe(4);
    for (const tile of landingContent.facts.tiles) { expect(facts).toContain(tile.value); expect(facts).toContain(tile.label); }
    expect(facts).toContain("landing-gridfield");
    // [DEV-024] The grid answers the pointer from a canvas UNDER the content, which takes no pointer events itself.
    expect(facts).toMatch(/<canvas[^>]*aria-hidden="true"[^>]*data-cell-field="off"[^>]*class="pointer-events-none/);
    // [DEV-024, owner] …but never under the dome: its box is barred to the field.
    // [seventh pass] …from the dome ITSELF — the box that publishes its disc — not from the strip it stands in
    expect(facts).toMatch(/<canvas[^>]*data-cell-exclude="\[data-particle-sphere\], \[data-tiles\]"/);
    expect(facts).not.toMatch(/data-cell-exclude="[^"]*\[data-dome\]/);
    // [owner, third pass] …nor under the tiles, which stand in a box of their own for that; and a lit cell is the accent
    expect(facts).toMatch(/<div data-tiles="" class="mt-12"><div class="grid border/);
    expect(facts).toMatch(/<canvas[^>]*data-cell-field="off"[^>]*class="[^"]*text-accent/);
    expect(facts).toContain(`href="${landingContent.facts.actionHref}"`);
    const said = landingContent.facts.tiles.map((t) => `${t.value} ${t.label}`).join(" ");
    expect(said).not.toMatch(/%|грн|₴|клієнт|економ/i);
  });

  it("raises a particle dome under the tiles: decorative, a still 2D layer under the WebGL one, nothing fetched at render (DEV-024)", () => {
    const dome = facts.slice(facts.indexOf('data-dome=""'));
    expect(dome).toMatch(/<div[^>]*aria-hidden="true"[^>]*data-particle-sphere="still"[^>]*class="pointer-events-none/);
    // [DEV-024, owner] the dots are the accent — chosen by a text role, which the canvas reads; and its lights are the block's own ground
    expect(dome).toMatch(/data-particle-sphere="still"[^>]*class="[^"]*text-accent/);
    expect(dome).not.toMatch(/data-particle-sphere="still"[^>]*class="[^"]*text-ink/);
    // [owner, third pass] the lights are a layer TALLER than the dome's box (they climb past its apex), and the
    // dome's canvas reaches 96px above the box too — headroom, so its top dots are not cut at the canvas's edge.
    expect(facts).toMatch(/data-dome=""[^>]*><div aria-hidden="true" class="landing-dome-light pointer-events-none absolute inset-x-0 bottom-0 h-\[160%\] wide:h-\[210%\]"><\/div>/);
    expect(dome).toMatch(/data-particle-sphere="still"[^>]*class="[^"]*-top-24 bottom-0/);
    expect(facts).not.toMatch(/data-dome=""[^>]*class="[^"]*landing-dome-light/);
    expect(dome).toMatch(/<canvas[^>]*data-sphere-layer="still"/);
    expect(dome).toMatch(/<canvas[^>]*data-sphere-layer="scene"/);
    // the dome stands between the tiles and the sources
    expect(facts.indexOf('data-fact=""')).toBeLessThan(facts.indexOf('data-dome=""'));
    expect(facts.indexOf('data-dome=""')).toBeLessThan(facts.indexOf('id="sources"'));
  });

  it("sets the six sources as one even row of equal cells (DEV-024): every cell the same box, hairlines from the grid's gaps", () => {
    const strip = inHome("sources", "cta-final");
    const sources = strip.slice(0, strip.indexOf("</section>"));
    const cells = [...sources.matchAll(/<li class="([^"]*)"/g)].map((m) => m[1]);
    expect(cells).toHaveLength(6);
    // one class string for all six: no «first cell» exception, which is what left the old strip ragged
    expect(new Set(cells).size).toBe(1);
    expect(cells[0]).toContain("min-h-[116px]");
    expect(cells[0]).toContain("justify-items-center");
    // whole rows at every breakpoint: 2 × 3, 3 × 2, 6 × 1
    expect(sources).toMatch(/<ul class="[^"]*grid-cols-2[^"]*gap-px[^"]*md:grid-cols-3[^"]*wide:grid-cols-6/);
    for (const item of landingContent.sources.items) expect(sources).toMatch(new RegExp(`<b[^>]*>${item.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</b>`));
  });

  it("lists the six requirement sources where the reference sets its customers' logos — readable, and named", () => {
    const strip = inHome("sources", "cta-final");
    const sources = strip.slice(0, strip.indexOf("</section>"));
    expect(sources).not.toContain('aria-hidden="true"');
    expect(sources).toContain(`aria-label="${landingContent.sources.label}"`);
    for (const item of landingContent.sources.items) expect(sources).toContain(item.code);
  });
});

describe("the route on /product (DEV-023: the reference's sticky list)", () => {
  const route = inProduct("stages", "board");
  it("names the five steps in a sticky list that links to each row", () => {
    expect(route).toMatch(new RegExp(`<nav[^>]*aria-label="${landingContent.route.eyebrow}"`));
    for (const s of landingContent.route.steps) expect(route).toContain(`href="#step-${s.index}"`);
    expect(count(route, /aria-current="true"/g)).toBe(1);
  });
  it("gives each step a lead, short rows and a large rounded card with its window", () => {
    expect(count(route, /data-route-step=/g)).toBe(5);
    expect(count(route, /data-route-card=""/g)).toBe(5);
    for (const s of landingContent.route.steps) { expect(route).toContain(s.eyebrow); expect(route).toContain(s.title); expect(route).toContain(s.note); }
    for (const code of ["R-041 · Кабельний лоток до закриття стелі", "Зняти фото", "goproceed.app/r/7k2…f9", "Закриття · CL-017", "ЧЕРНЕТКА"]) expect(route).toContain(code);
    expect(route).toContain("Це чернетка для підпису, а не підписаний документ.");
    expect(route).not.toContain("data-scroll-stack");
  });
});

describe("the application view on /product", () => {
  const board = inProduct("board", "capture");
  it("layers the receipt and the two pills at depth, tilts the board and pulses the review tags", () => {
    expect(board).toContain('data-depth="-0.3"');
    expect(board).toContain('data-depth="0.35"');
    expect(board).toContain('data-depth="0.25"');
    expect(board.match(/data-tilt="off"/g)).toHaveLength(1);
    // The three satellites follow the pointer by translating instead — see
    // pointer-tilt.test.tsx for why rotation cannot carry an object this small.
    expect(board.match(/data-magnetic-area="section"/g)).toHaveLength(3);
    expect(board.match(/pulse-dot/g)).toHaveLength(2); // the two review cards on the board
    for (const drift of ["drift-a", "drift-b", "drift-c"]) expect(board).toContain(drift);
  });
  it("shows the board with three columns, the selected card, the receipt and the beam", () => {
    expect(board).toContain('aria-label="Стан пакету робіт у веб-застосунку GoProceed"');
    for (const label of ["Готово", "На розгляді", "Заблоковано"]) expect(board).toContain(label);
    expect(board).toContain('data-board-card="selected"');
    expect(board).toContain('aria-label="Квитанція доказу EV-0248"');
    expect(board).toContain('class="beam"');
    expect(board).toContain(landingContent.hero.dimension);
    // B-01: the view is headed by what it shows, not by the capture block's title
    expect(board).toContain(landingContent.board.lead);
    expect(board).not.toContain(landingContent.capture.title);
  });
  it("names the three channels and the record they converge on, in one row of statements", () => {
    for (const ch of landingContent.capture.channels) expect(board).toContain(ch.title);
    expect(board).toContain(landingContent.capture.converge.text);
  });
});

describe("problem and compare, on /roles", () => {
  const problem = inRoles("problem", "compare");
  const compare = inRoles("compare", "cta-final");
  it("tints the statement and shows Рис. 01 with the found message and the record", () => {
    expect(problem).toContain("Рис. 01");
    expect(problem).toContain('data-message="hit"');
    for (const m of ["без осі", "без вимоги", "без рішення"]) expect(problem).toContain(m);
    expect(problem).toContain("DR-0091 · прийнято технаглядом · 16:18");
    expect(problem).toContain("opacity:0.14");
  });
  it("pairs five rows across the two cards and states both outcomes", () => {
    expect(compare.match(/data-compare-row=/g)).toHaveLength(10);
    expect(compare).toContain(landingContent.compare.was.outcome);
    expect(compare).toContain(landingContent.compare.now.outcome);
  });
  it("slides the two compare cards in from their sides and pops the checks", () => {
    expect(compare).toContain("translateX(-20px)");
    expect(compare).toContain("translateX(20px)");
    expect(compare.match(/scale\(0\)/g)).toHaveLength(landingContent.compare.now.rows.length);
    expect(compare).toContain("shadow-float-accent");
  });
});

describe("roles", () => {
  const roles = inRoles("roles", "problem");
  it("renders the four role cells with pains and gains, the payer first, and one fact per role", () => {
    expect(roles.match(/data-slot="feature-cell"/g)).toHaveLength(4);
    for (const cell of landingContent.roles.cells) { expect(roles).toContain(cell.title); expect(roles).toContain(cell.pain); }
    expect(roles).toContain("Telegram-бот або мобільний застосунок, без форм");
    const order = landingContent.roles.cells.map((cell) => roles.indexOf(cell.pain));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(roles).toContain("data-role-facts");
    for (const f of landingContent.roles.facts) expect(roles).toContain(f.value);
    // [2026-09-08] Only the application view follows the cursor — see pointer-tilt.test.tsx.
    expect(roles).not.toContain("data-tilt");
  });
});

describe("capture, provenance, position — on /product", () => {
  const capture = inProduct("capture", "trust");
  const trust = inProduct("trust", "position");
  const position = inProduct("position", "cta-final");
  it("states the position with three pills and the way on to the pilot", () => {
    expect(position).toContain(landingContent.position.quote);
    expect(position.match(/data-position-pill=/g)).toHaveLength(3);
    // R-09: on /product the limits are the block directly above, so the way on is the pilot
    expect(position).toContain(`href="${landingContent.position.more.href}"`);
    expect(landingContent.position.more.href).toBe("/pilot");
    const prefixWords = landingContent.position.quoteDim.split(" ").length;
    expect(position.match(/text-ink-muted/g)?.length).toBeGreaterThanOrEqual(prefixWords);
    expect(position).toContain("opacity:0.14");
  });
  it("shows the two foreman channels, the office web app and the converging record", () => {
    for (const ch of landingContent.capture.channels) expect(capture).toContain(ch.title);
    expect(capture).toContain("Збережено як");
    // ADR-007 decision 6: the client uploads at once and shows no queue.
    expect(capture).toContain("надсилається");
    expect(capture).not.toContain("очікує мережу");
    expect(capture).toContain("EV-0248");
    expect(capture).not.toContain("data-tilt");
    expect(capture.match(/pulse-dot/g)).toHaveLength(1);
    expect(capture.match(/flow-dash/g)).toHaveLength(3);
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
  const trust = inProduct("trust", "position");
  const a = landingContent.provenance.access;

  it("renders the access matrix as a real table with headers and spoken levels", () => {
    expect(trust).toContain("<table");
    expect(trust.match(/<th[^>]*scope="col"/g)).toHaveLength(4);
    expect(trust.match(/<th[^>]*scope="row"/g)).toHaveLength(a.rows.length);
    expect(trust.match(/<tr/g)).toHaveLength(a.rows.length + 1);
    expect(trust.match(/data-access=/g)).toHaveLength(28);
    const spoken = trust.match(/<span class="sr-only">/g) ?? [];
    expect(spoken.length).toBeGreaterThanOrEqual(28);
    for (const level of ["full", "own", "none"] as const) expect(trust).toContain(a.legend[level]);
    expect(trust).not.toMatch(/<i[^>]*aria-label/);
  });

  it("labels the two halves of the v0.1 limits so the polarity is announced", () => {
    const l = landingContent.provenance.limits;
    expect(trust).toContain(l.doesTitle);
    expect(trust).toContain(l.doesNotTitle);
    expect(trust.match(/<ul[^>]*aria-labelledby=/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("does not claim a list of links that has no list items", () => {
    const nav = headerOf(home);
    if (nav.includes('role="list"')) expect(nav).toMatch(/role="listitem"/);
    else expect(nav).toContain("<ul");
  });

  it("hides every decorative widget, canvas and mark, and never a claim", () => {
    // [DEV-023] The reference's form adds pictures of product moments. Each is
    // `aria-hidden` or one labelled image; the sentence beside it is the claim.
    expect(count(home, /<canvas(?![^>]*aria-hidden="true")/g)).toBe(0);
    expect(count(all, /<div(?![^>]*aria-hidden="true")[^>]*data-band=""/g)).toBe(0);
    expect(count(all, /<div[^>]*aria-hidden="true"[^>]*data-band=""/g)).toBeGreaterThan(0);
    for (const item of landingContent.scenes.items) expect(home).toContain(item.body);
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
  it("posts to the handler without JavaScript and keeps a mail path that needs none", () => {
    expect(pilot).toContain('method="post"');
    expect(pilot).toContain('action="/api/pilot"');
    expect(pilot).not.toMatch(/<form[^>]*method="get"/);
    expect(pilot).toContain(`mailto:${PILOT_EMAIL}`);
    expect(pilot).toContain(landingContent.pilot.form.mailNote);
    expect(pilot).not.toContain("bg-action-signal");
  });

  it("never prints the pilot address as text anywhere on the site", () => {
    // Tags only: the JSON-LD script's text stays in `visible`, so structured
    // data is held to the same rule as the copy.
    const visible = all.replace(/<[^>]*>/g, " ");
    expect(visible).not.toContain(PILOT_EMAIL);
    expect(all).toContain(`mailto:${PILOT_EMAIL}`);
  });
});

describe("faq and the closing block", () => {
  it("asks the seven questions in a chevron accordion beside a two-tone heading", () => {
    const faq = inPilot("faq");
    for (const entry of landingContent.faq.entries) expect(faq).toContain(entry.question);
    expect(faq).toContain("Скільки коштує пілот і хто відповідає?");
    expect(faq).not.toContain('data-accordion-marker="plus"');
    expect(count(faq, /data-two-tone=""/g)).toBe(1);
  });
  it.each(["home", "product", "roles"] as const)("%s closes on a fan of arcs: the five record codes round a breathing mark, the offer in three phrases, the way to the form and the copy-link button", (key) => {
    const cta = sectionOf(pages[key])("cta-final");
    // [DEV-024] arcs that lean toward the pointer, where DEV-023 drew straight conic rays in CSS
    expect(cta).toMatch(/<canvas[^>]*aria-hidden="true"[^>]*data-arc-field="still"[^>]*class="arc-mask pointer-events-none/);
    // [owner, third pass] the arcs are the accent
    expect(cta).toMatch(/data-arc-field="still"[^>]*class="[^"]*text-accent/);
    expect(cta).not.toContain("landing-burst");
    expect(cta).toContain("breathe");
    for (const code of landingContent.cta.codes) expect(cta).toContain(`>${code}<`);
    expect(cta).toContain(landingContent.cta.title);
    // [B2-01] The measure sits on the element that carries the 60px size. On its
    // wrapper `ch` resolves at 16px and the heading broke into six one-word lines.
    expect(cta).toMatch(/<h2[^>]*class="[^"]*max-w-\[22ch\][^"]*text-\[clamp\(32px,4\.2vw,60px\)\]/);
    expect(cta).not.toMatch(/<div[^>]*class="[^"]*max-w-\[22ch\]/);
    // U-02: «Заповнити запит» lands on the form, which a phone shows ~1 650px down /pilot
    expect(cta).toContain('href="/pilot#request"');
    expect(pilotPage).toContain('id="request"');
    expect(cta).toContain(landingContent.cta.share);
    expect(cta).toContain("data-offer-points");
    for (const point of landingContent.cta.points) expect(cta).toContain(point);
  });
  it("has no closing offer on /pilot — the page is the offer", () => {
    expect(pilotPage).not.toContain("data-arc-field");
    expect(pilotPage).not.toContain('id="cta-final"');
  });
});

describe("headings (DEV-023: two-tone, the statement in ink and its close muted)", () => {
  it("sets every section heading in two tones, the sub-pages' h1 included", () => {
    // home: intro, scenes, facts (its h1 and its closing h2 are one tone).
    // product: route (h1), board, capture, trust. roles: roles (h1), compare.
    // pilot: pilot (h1), faq.
    // The closing block's heading is `TwoTone` too (one tone: it has no second line).
    const twoTone = { home: 4, product: 5, roles: 3, pilot: 2 } as const;
    for (const key of PAGE_KEYS) expect(count(pages[key], /data-two-tone=""/g), key).toBe(twoTone[key]);
    for (const key of ["product", "roles", "pilot"] as const) expect(pages[key], key).toMatch(/<h1[^>]*data-two-tone=""/);
    expect(all).toMatch(/<span class="block text-ink-muted">/);
  });

  it.each(PAGE_KEYS)("%s: the page's h1 paints with the HTML — it never waits for JavaScript at opacity 0", (key) => {
    // [R-01] `Reveal` server-renders `opacity:0`. Wrapped in one, the LCP
    // heading of each sub-page waited for hydration, an IntersectionObserver
    // and a 900ms fade, on a phone too. No ancestor of the h1 may be hidden.
    const html = pages[key];
    const at = html.indexOf("<h1");
    const before = html.slice(html.indexOf('id="main-content"'), at);
    // every element opened before the h1 and not yet closed is an ancestor or an earlier sibling's ancestor;
    // the nearest wrapper is what matters, and it is the tag that ends right before `<h1`
    const wrapper = before.slice(before.lastIndexOf("<div"));
    expect(wrapper, key).not.toMatch(/opacity:\s*0(?![.\d])/);
    expect(html.slice(at, html.indexOf("</h1>", at)), key).not.toMatch(/opacity:\s*0(?![.\d])/);
  });

  it.each(PAGE_KEYS)("%s: no two section headings say the same thing", (key) => {
    // [B-01 / R-08] /product showed «Два способи надіслати доказ…» twice in
    // consecutive folds, the first over a board that is not about sending evidence.
    const h2s = [...pages[key].matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1]!.replace(/<[^>]*>/g, "").trim());
    expect(new Set(h2s).size, h2s.join(" | ")).toBe(h2s.length);
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

  it("magnetises every marketing pill link but the header's", () => {
    // The copy-link button beside the closing pill is a button, not a pill link, and stands still.
    // `area="self"` is what a CONTROL uses. home: the hero's two, the split's,
    // the fact band's, the closing block's. product and roles: the closing
    // block's. pilot: the form's two. The `section` magnets are the receipt and
    // two pills round the application view on /product — decoration.
    const self = { home: 5, product: 1, roles: 1, pilot: 2 } as const;
    for (const key of PAGE_KEYS) {
      expect(count(pages[key], /data-magnetic-area="self"/g), key).toBe(self[key]);
      expect(count(pages[key], /data-magnetic-area="section"/g), key).toBe(key === "product" ? 3 : 0);
      expect(pages[key].slice(0, pages[key].indexOf('id="main-content"')), key).not.toContain("data-magnetic");
    }
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
    // [DEV-022] Until then the strip was `aria-hidden` with `tabindex=-1`, on
    // the belief that the row above stayed announced at every width. It does
    // not — `hidden` is `display: none`. Only one of the two navs is ever
    // displayed, so nothing is announced twice.
    expect(nav.match(/<nav /g)).toHaveLength(2);
    expect(nav.match(/aria-label="Головна навігація"/g)).toHaveLength(1);
    expect(nav.match(/aria-label="Сторінки сайту"/g)).toHaveLength(1);
    const strip = nav.slice(nav.indexOf('aria-label="Сторінки сайту"'));
    expect(strip).not.toContain("aria-hidden");
    expect(strip).not.toContain('tabindex="-1"');
  });
});
