import { describe, expect, it } from "vitest";
import { landingContent } from "../content/landing-content";
import { demoRecords } from "../content/demo-records";

const flatten = (value: unknown): string =>
  typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.map(flatten).join(" ")
      : value && typeof value === "object"
        ? Object.values(value).map(flatten).join(" ")
        : "";

const copy = flatten(landingContent);
const everything = `${copy} ${flatten(demoRecords)}`;

describe("landing copy — the Daylight page", () => {
  it("publishes the fourteen blocks, the home page's scenes and the page table", () => {
    // [DEV-022] Which block renders on which page, and in what order, is pinned
    // on the DOM in landing-render.test.tsx; this pins that no block's copy
    // disappears or appears unnoticed.
    expect(Object.keys(landingContent)).toEqual([
      "nav", "hero", "intro", "facts", "sources", "problem", "scenes", "compare", "roles", "route",
      "position", "board", "capture", "provenance", "pilot", "faq", "cta", "footer", "pages",
    ]);
  });

  it("links the header to the three sub-pages, and the action to the form's page", () => {
    expect(landingContent.nav.items.map((i) => i.href)).toEqual(["/product", "/roles", "/pilot"]);
    expect(landingContent.nav.actionHref).toBe(landingContent.pages.pilot.path);
  });

  it("points every link in the copy at a page that exists", () => {
    const paths = new Set<string>(Object.values(landingContent.pages).map((p) => p.path));
    const links = [
      ...landingContent.nav.items.map((i) => i.href), landingContent.nav.actionHref, landingContent.nav.actionHrefOnPilot,
      landingContent.hero.pill.href, landingContent.hero.primaryHref, landingContent.hero.secondaryHref,
      landingContent.intro.actionHref, landingContent.facts.actionHref, landingContent.position.more.href,
      landingContent.cta.primaryHref, landingContent.cta.shareHref,
      ...landingContent.footer.columns.flatMap((col) => col.links.map((l) => l.href)).filter((h) => h !== "mailto"),
    ];
    for (const href of links) {
      expect(href.startsWith("/"), href).toBe(true);
      expect(paths.has(href.split("#")[0]!), href).toBe(true);
    }
  });

  it("ends every block title with its closing phrase, so the two-tone split never mangles a heading (R-13)", () => {
    // `splitTitle` leaves a title whole when the phrase is not its suffix; this
    // is the copy-side guard, so a reworded title is caught here and not on a page.
    const blocks = ["compare", "roles", "route", "capture", "provenance", "pilot", "faq", "scenes"] as const;
    for (const key of blocks) {
      const { title, titleAccent } = landingContent[key];
      expect(title.endsWith(titleAccent), `${key}: «${titleAccent}» must close «${title}»`).toBe(true);
      expect(title.length).toBeGreaterThan(titleAccent.length);
    }
  });

  it("states no send queue: a frame is evidence once uploaded, and not before (ADR-007 decision 6)", () => {
    expect(everything.toLowerCase()).not.toContain("черг");
    expect(everything).not.toContain("очікує мережу");
  });

  it.each([
    "польова вебпрограма", "кеп", "офлайн", "клієнти", "клієнтів", "економія", "%",
    "тов ", "llc", "грн", "usd", "€", "$",
  ])("does not publish «%s»", (claim) => {
    expect(everything.toLowerCase()).not.toContain(claim.toLowerCase());
  });

  it("never speaks of payment — but requires free-pilot transmission", () => {
    expect(everything).toContain("передоплати");
    expect(everything.match(/(^|[^\p{L}''])оплат/giu)).toBeNull();
  });

  it("names no electrical audience, while the example work stays cable trays", () => {
    expect(copy.toLowerCase()).not.toContain("електромонтаж");
    expect(everything).toContain("Монтаж кабельних трас");
    expect(copy).toContain("від монолітчиків до інженерних мереж");
  });

  it("states the owner's facts F1–F6", () => {
    expect(copy).toContain("пілот безкоштовний");
    expect(copy).toContain("без договору і передоплати");
    expect(copy).toContain("Telegram-бот");
    expect(copy).toContain("мобільний застосунок");
    expect(copy).toContain("без облікового запису");
    expect(landingContent.pilot.author.signature).toBe("Команда GoProceed · відповідаємо протягом робочого дня");
  });

  it("states the product boundaries", () => {
    expect(copy).toContain("Чернетка акта не є підписаним документом");
    expect(copy).toContain("потребує з'єднання");
    expect(copy).toContain("Фізичну роботу не зупиняє");
  });

  it("carries the example route through every code", () => {
    for (const code of ["W-014", "R-041", "EV-0248", "DR-0091", "CL-017"]) {
      expect(everything).toContain(code);
    }
  });

  it("asks seven questions", () => {
    expect(landingContent.faq.entries).toHaveLength(7);
    expect(landingContent.faq.entries.map((e) => e.id)).toContain("cost");
  });
});

describe("the first viewport names the consequence and the payer", () => {
  const hero = landingContent.hero;

  // The page addresses four roles, and the one that signs is the owner. Until
  // 2026-09-07 the three hero facts named ПТВ, майстер and технагляд — every
  // role except the payer — and the word «гроші» appeared once on the whole
  // page, in the lead of the fourth block.
  it("states the cost of a late acceptance in the lead, not four blocks down", () => {
    expect(hero.lead).toContain("гроші");
  });

  it("says what the product is before it says why it matters", () => {
    // [DEV-022] The home page is short, so the lead carries the definition.
    expect(hero.lead.indexOf("веб-застосунок")).toBeGreaterThan(-1);
    expect(hero.lead.indexOf("веб-застосунок")).toBeLessThan(hero.lead.indexOf("гроші"));
  });

  it("gives the owner a fact of his own, and puts it first — on /roles since DEV-022", () => {
    expect(landingContent.roles.facts[0]?.value).toContain("Власник");
    expect(landingContent.roles.cells[0]?.id).toBe("owner");
  });

  it("does not repeat the money line in the compare block that used to own it", () => {
    expect(landingContent.compare.lead).not.toContain("гроші");
  });

  it("claims only what the demo board already shows — no invented figure", () => {
    // The board renders reasons and a blocked count; it renders no hryvnia.
    const ownerFact = landingContent.roles.facts[0];
    expect(`${ownerFact?.value} ${ownerFact?.label}`).not.toMatch(/\d|грн|₴|%/);
  });
});
