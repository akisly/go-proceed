import { landingContent, type PageKey } from "./landing-content";

/**
 * One `@graph` per page (DEV-025), because its nodes are one statement about
 * one page and cross-reference each other by `@id`. Every page carries the
 * publisher, the site and itself; the home page describes the product in full,
 * with its free offer, and a sub-page names it by the same `@id` and no more,
 * so `WebPage.about` resolves inside the page's own graph (R-04); /pilot adds
 * the questions, because that is where a visitor can read the answers; every
 * sub-page adds its two-step breadcrumb, referenced from its `WebPage`.
 *
 * What is deliberately ABSENT is as much of the design as what is here.
 * No `aggregateRating` and no `Review`: there are no customers yet, and
 * inventing them is a manual-action risk rather than a shortcut. No
 * `BreadcrumbList` on the home page: a one-item breadcrumb is noise. No
 * `Product` beside `SoftwareApplication`: the specific type is the honest one,
 * and stacking both invites conflicting entity signals.
 *
 * On `FAQPage`, plainly: Google restricted FAQ rich results in August 2023 to
 * government and health sites, so this page will not get accordions in the
 * SERP and nobody should promise it will. It ships because Bing still renders
 * them, and because it hands a citation engine a machine-readable pairing of
 * exactly the questions this buyer asks. It is only legitimate because the
 * answers are already present in the server HTML OF THE SAME PAGE — marking up
 * content a visitor cannot see is a policy violation, which is why the node
 * moved to /pilot with the accordion and did not stay on `/`.
 *
 * Every string comes from `landing-content.ts`. A second copy of the FAQ that
 * drifts from the visible one is worse than no markup at all.
 */
export function pageJsonLd(origin: string, page: PageKey) {
  const c = landingContent;
  const { path, title } = c.pages[page];
  const pageUrl = `${origin}${path}`;
  const softwareId = `${origin}/#software`;

  const organization = {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: c.nav.brand,
    url: `${origin}/`,
    logo: `${origin}/icon.png`,
    description: c.footer.tagline,
    // No `email`. Schema.org makes it optional, and the pilot mailbox is a
    // personal address: #76 took it off the page, and structured data is
    // read by more crawlers than the copy is. `landing-render.test.tsx`
    // asserts it appears nowhere a reader or a crawler can see it — that
    // guard is what caught this on the merge.
    areaServed: { "@type": "Country", name: "Україна" },
    knowsLanguage: ["uk"],
  };
  const website = {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: `${origin}/`,
    name: c.nav.brand,
    inLanguage: "uk-UA",
    publisher: { "@id": `${origin}/#organization` },
  };
  const webpage = {
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: page === "home" ? c.hero.title : title,
    inLanguage: "uk-UA",
    isPartOf: { "@id": `${origin}/#website` },
    about: { "@id": softwareId },
    primaryImageOfPage: `${origin}/og.png`,
    ...(page === "home" ? {} : { breadcrumb: { "@id": `${pageUrl}#breadcrumb` } }),
  };
  /** The same entity, named and not described: the full node is the home page's. */
  const softwareRef = {
    "@type": "SoftwareApplication",
    "@id": softwareId,
    name: c.nav.brand,
    url: `${origin}/`,
  };
  const software = {
    "@type": "SoftwareApplication",
    "@id": softwareId,
    name: c.nav.brand,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Construction quality assurance",
    operatingSystem: "Web, iOS, Android",
    inLanguage: "uk",
    url: `${origin}/`,
    publisher: { "@id": `${origin}/#organization` },
    description: c.hero.lead,
    featureList: c.route.steps.map((s) => s.title),
    softwareVersion: "0.1",
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "UAH",
      name: `${c.hero.pill.badge} · ${c.pilot.title}`,
      availability: "https://schema.org/InStock",
      url: `${origin}${c.pages.pilot.path}`,
    },
  };
  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: c.nav.brand, item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: c.nav.items.find((i) => i.href === path)?.label ?? title, item: pageUrl },
    ],
  };
  const faq = {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    inLanguage: "uk-UA",
    isPartOf: { "@id": `${pageUrl}#webpage` },
    mainEntity: c.faq.entries.map((e) => ({
      "@type": "Question",
      name: e.question,
      acceptedAnswer: { "@type": "Answer", text: e.answer },
    })),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      website,
      webpage,
      ...(page === "home" ? [software] : [softwareRef, breadcrumb]),
      ...(page === "pilot" ? [faq] : []),
    ],
  };
}
