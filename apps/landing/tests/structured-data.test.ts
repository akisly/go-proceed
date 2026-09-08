import { describe, expect, it } from "vitest";
import { landingJsonLd } from "../content/landing-jsonld";
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
const graph = landingJsonLd("https://goproceed.app");
const node = (type: string) => graph["@graph"].find((n) => n["@type"] === type) as Record<string, unknown>;

describe("structured data", () => {
  it("names the publisher, the site, the page and the product", () => {
    for (const type of ["Organization", "WebSite", "WebPage", "SoftwareApplication", "FAQPage"]) {
      expect(node(type), type).toBeDefined();
    }
  });

  it("resolves every URL against the origin it was given", () => {
    const json = JSON.stringify(graph);
    expect(json).not.toContain("localhost");
    expect(json).not.toMatch(/"url":\s*"\//);
    expect(node("Organization").url).toBe("https://goproceed.app/");
  });

  it("describes the pilot as the free offer it is", () => {
    const offer = node("SoftwareApplication").offers as Record<string, unknown>;
    expect(offer.price).toBe(0);
    expect(node("SoftwareApplication").applicationCategory).toBe("BusinessApplication");
  });

  it("claims no rating, because there are no reviews", () => {
    const json = JSON.stringify(graph);
    expect(json).not.toContain("aggregateRating");
    expect(json).not.toContain("reviewCount");
  });

  it("carries every FAQ answer verbatim from the one source of copy", () => {
    const faq = node("FAQPage").mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(faq).toHaveLength(landingContent.faq.entries.length);
    for (const [i, entry] of landingContent.faq.entries.entries()) {
      expect(faq[i]?.name).toBe(entry.question);
      expect(faq[i]?.acceptedAnswer.text).toBe(entry.answer);
    }
  });
});
