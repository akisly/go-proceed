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
  it("publishes the fourteen sections in the prototype's order", () => {
    expect(Object.keys(landingContent)).toEqual([
      "nav", "hero", "sources", "problem", "compare", "roles", "route",
      "position", "capture", "provenance", "pilot", "faq", "cta", "footer",
    ]);
  });

  it("keeps the header links in page order", () => {
    expect(landingContent.nav.items.map((i) => i.href)).toEqual(["#compare", "#roles", "#stages", "#faq"]);
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

  it("gives the owner a fact of his own, and puts it first", () => {
    expect(hero.facts[0]?.value).toContain("Власник");
  });

  it("does not repeat the money line in the compare block that used to own it", () => {
    expect(landingContent.compare.lead).not.toContain("гроші");
  });

  it("claims only what the demo board already shows — no invented figure", () => {
    // The board renders reasons and a blocked count; it renders no hryvnia.
    const ownerFact = hero.facts[0];
    expect(`${ownerFact?.value} ${ownerFact?.label}`).not.toMatch(/\d|грн|₴|%/);
  });
});
