import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "../app/page";

// Same mock the full-page render uses: `useReduced()` is conservative before
// hydration, and without this the motion trees render their reduced branch.
vi.mock("../../../packages/ui/src/motion/use-reduced", () => ({
  useReduced: () => false,
  shouldReduce: () => false,
}));

/**
 * Every content card leans toward the pointer.
 *
 * It used to be four surfaces — the hero's product frame, the three capture
 * channels and the four role cells (the last through `FeatureGrid`, which
 * tilts its own cells). The comparison cards, the provenance cells, the pilot
 * boxes and the five route mocks did not move at all, which read as a page
 * where some things are alive and most are not.
 *
 * THE PART THAT FAILS SILENTLY is not the tilt, it is the 3D chain. `Tilt`
 * only rotates in space if an ancestor establishes `perspective` and nothing
 * between the two flattens it — `overflow`, `opacity` and filters all reset
 * `transform-style` to `flat`. When that happens the element still renders
 * `data-tilt="on"` and still runs its springs; it simply does not lean, and
 * nothing anywhere reports it. So this asserts the chain, not just the count.
 *
 * The computed-style half of the same check lives in `qa/landing.mjs`, which
 * walks real ancestors in a real browser. This one runs on every commit.
 */
const dom = new JSDOM(renderToStaticMarkup(<LandingPage />));
const doc = dom.window.document;
const tilts = [...doc.querySelectorAll("[data-tilt]")];

/**
 * Perspective arrives two ways in this codebase and both count: an arbitrary
 * Tailwind class on a layout container, and an inline style — `ScrollSettle`
 * sets `perspective: 1500` itself, which is what the hero's frame hangs from.
 */
const hasPerspective = (el: Element) =>
  /\[perspective:/.test(el.className) || /perspective:/.test(el.getAttribute("style") ?? "");

describe("pointer tilt reaches every content card", () => {
  it("covers all twenty-one surfaces", () => {
    // 1 board · 3 capture channels · 4 roles · 2 comparison cards
    // · 3 provenance cells · 3 pilot boxes · 5 route mocks.
    expect(tilts).toHaveLength(21);
  });

  it("moves the small things around the board by translating them, not rotating them", () => {
    // Rotation displaces a corner in proportion to the element's size: on the
    // built page 1.72° moved the 1054px board 15.8px and 2.58° moved the 251px
    // receipt 0.6px. So the receipt and the two pills take
    // `Magnetic area="section"` — a pointer-driven translation, legible at any
    // size — and the board keeps the tilt, which suits a large surface.
    expect(doc.querySelectorAll("#hero [data-tilt]")).toHaveLength(1);
    const magnets = [...doc.querySelectorAll("#hero [data-magnetic-area='section']")];
    expect(magnets).toHaveLength(3);
  });

  it("keeps the hero's layers flat, so the board cannot paint over the pills", () => {
    // `Tilt` forces `transform-style: preserve-3d` up its chain, and a 3D
    // context re-sorts children by depth instead of DOM order — which is
    // exactly how the board ended up covering both status pills. Translation
    // needs no 3D context; nothing around the satellites may reintroduce one.
    const stagger = doc.querySelector("#hero [data-magnetic-area='section']")?.closest("div");
    expect(stagger?.outerHTML ?? "").not.toContain("preserve-3d");
  });

  it("gives each one an ancestor that establishes perspective", () => {
    const orphans = tilts
      .filter((el) => {
        for (let node = el.parentElement; node; node = node.parentElement) {
          if (hasPerspective(node)) return false;
        }
        return true;
      })
      .map((el) => el.parentElement?.className.slice(0, 60) ?? "(detached)");
    expect(orphans).toEqual([]);
  });

  it("reads the pointer across the whole section, the way the hero's board does", () => {
    // `area="self"` only reacts when the pointer is physically over the card,
    // which is why the page read as «only the dashboard moves»: measured on the
    // built page, the board tilts from a pointer anywhere in the hero while a
    // comparison card did not move at all until the pointer was on top of it.
    // Every tilted surface now tracks its section.
    const areas = tilts.map((el) => el.getAttribute("data-tilt-area"));
    expect(new Set(areas)).toEqual(new Set(["section"]));
  });

  it("leans the big surfaces less than the small ones", () => {
    // The contract caps pointer tilt at 3°, and a card 600px wide reads 3° as
    // a wobble rather than a lean. Asserted through the blocks that own them.
    const compare = doc.querySelector("#compare [data-tilt]");
    const roles = doc.querySelector("#roles [data-tilt]");
    expect(compare).not.toBeNull();
    expect(roles).not.toBeNull();
  });

  it("does not tilt the form, the lists or the table", () => {
    // A surface someone is typing into must not move; FAQ rows and the source
    // strip are lists, and the access matrix is a real table, where a leaning
    // cell reads as breakage rather than as life.
    for (const id of ["faq", "sources"]) {
      expect(doc.querySelectorAll(`#${id} [data-tilt]`)).toHaveLength(0);
    }
    expect(doc.querySelectorAll("form [data-tilt]")).toHaveLength(0);
    expect(doc.querySelectorAll("table [data-tilt]")).toHaveLength(0);
  });

  it("reaches each block that gained one", () => {
    for (const [id, count] of [["compare", 2], ["trust", 3], ["stages", 5]] as const) {
      expect(doc.querySelectorAll(`#${id} [data-tilt]`), `#${id}`).toHaveLength(count);
    }
  });
});
