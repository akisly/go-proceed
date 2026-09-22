import { describe, expect, it } from "vitest";
import { pageJsonLd } from "../content/landing-jsonld";
import { landingContent } from "../content/landing-content";

/**
 * The page carried no structured data at all, so nothing told a search engine
 * or a citation engine what GoProceed *is* — a name in a title tag and a
 * paragraph of Ukrainian is all they had to work with.
 *
 * On FAQPage specifically, and stated plainly because it is the one place this
 * gets oversold: Google restricted FAQ rich results in August 2023 to
 * government and health sites, so this page will NOT get accordions in the
 * SERP. It ships because Bing still renders them and because the block gives a
 * citation engine a clean machine-readable pairing of exactly the questions
 * this buyer asks. The answers are already in the server HTML, which is what
 * makes the markup legitimate rather than a policy violation.
 */
const ORIGIN = "https://goproceed.app";
const PAGES = ["home", "product", "roles", "pilot"] as const;
const graphOf = (page: (typeof PAGES)[number]) => pageJsonLd(ORIGIN, page);
const nodeOf = (page: (typeof PAGES)[number], type: string) =>
  graphOf(page)["@graph"].find((n) => n["@type"] === type) as Record<string, unknown> | undefined;

const graph = graphOf("home");
const node = (type: string) => nodeOf("home", type) as Record<string, unknown>;

describe("structured data", () => {
  it("names the publisher, the site, the page and the product on the home page", () => {
    for (const type of ["Organization", "WebSite", "WebPage", "SoftwareApplication"]) {
      expect(node(type), type).toBeDefined();
    }
  });

  it("names the publisher, the site and the page itself on every page", () => {
    for (const page of PAGES) {
      for (const type of ["Organization", "WebSite", "WebPage"]) expect(nodeOf(page, type), `${page} ${type}`).toBeDefined();
      expect(nodeOf(page, "WebPage")?.url).toBe(`${ORIGIN}${landingContent.pages[page].path}`);
    }
    expect(new Set(PAGES.map((p) => nodeOf(p, "WebPage")?.["@id"])).size).toBe(PAGES.length);
  });

  it("marks the questions up only where a visitor can read the answers", () => {
    // [DEV-025] The accordion moved to /pilot. FAQPage on a page that does not
    // show the answers is marking up invisible content — a policy violation.
    expect(nodeOf("pilot", "FAQPage")).toBeDefined();
    for (const page of ["home", "product", "roles"] as const) expect(nodeOf(page, "FAQPage"), page).toBeUndefined();
  });

  it("gives each sub-page a two-step breadcrumb, and the home page none", () => {
    expect(nodeOf("home", "BreadcrumbList")).toBeUndefined();
    for (const page of ["product", "roles", "pilot"] as const) {
      const items = nodeOf(page, "BreadcrumbList")?.itemListElement as { item: string }[];
      expect(items.map((i) => i.item)).toEqual([`${ORIGIN}/`, `${ORIGIN}${landingContent.pages[page].path}`]);
    }
  });

  it("resolves every @id a page refers to inside that page's own graph", () => {
    // [R-04] A parser reads one page. `WebPage.about` used to point at a
    // SoftwareApplication that only the home page emitted, and the breadcrumb
    // was a node nothing referred to.
    for (const page of PAGES) {
      const nodes = graphOf(page)["@graph"] as Record<string, unknown>[];
      const defined = new Set(nodes.map((n) => n["@id"]));
      const refs = [...JSON.stringify(nodes).matchAll(/\{"@id":"([^"]+)"\}/g)].map((m) => m[1]);
      expect(refs.length, page).toBeGreaterThan(0);
      for (const ref of refs) expect(defined.has(ref), `${page}: ${ref}`).toBe(true);
    }
    for (const page of ["product", "roles", "pilot"] as const) {
      expect(nodeOf(page, "WebPage")?.breadcrumb).toEqual({ "@id": nodeOf(page, "BreadcrumbList")?.["@id"] });
      // named, not described: the offer and the feature list are the home page's
      expect(nodeOf(page, "SoftwareApplication")).not.toHaveProperty("offers");
    }
  });

  it("sends the free offer to the page that holds the form", () => {
    const offer = node("SoftwareApplication").offers as Record<string, unknown>;
    expect(offer.url).toBe(`${ORIGIN}/pilot`);
  });

  it("resolves every URL against the origin it was given", () => {
    const json = PAGES.map((p) => JSON.stringify(graphOf(p))).join("");
    expect(json).not.toContain("localhost");
    expect(json).not.toMatch(/"(url|item)":\s*"\//);
    expect(node("Organization").url).toBe("https://goproceed.app/");
  });

  it("describes the pilot as the free offer it is", () => {
    const offer = node("SoftwareApplication").offers as Record<string, unknown>;
    expect(offer.price).toBe(0);
    expect(node("SoftwareApplication").applicationCategory).toBe("BusinessApplication");
  });

  it("claims no rating, because there are no reviews", () => {
    const json = PAGES.map((p) => JSON.stringify(graphOf(p))).join("");
    expect(json).not.toContain("aggregateRating");
    expect(json).not.toContain("reviewCount");
  });

  it("carries every FAQ answer verbatim from the one source of copy", () => {
    const faq = nodeOf("pilot", "FAQPage")?.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(faq).toHaveLength(landingContent.faq.entries.length);
    for (const [i, entry] of landingContent.faq.entries.entries()) {
      expect(faq[i]?.name).toBe(entry.question);
      expect(faq[i]?.acceptedAnswer.text).toBe(entry.answer);
    }
  });
});
