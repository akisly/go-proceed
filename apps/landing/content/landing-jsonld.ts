import { landingContent } from "./landing-content";

/**
 * One `@graph`, because these five nodes are one statement about one page and
 * cross-reference each other by `@id`.
 *
 * What is deliberately ABSENT is as much of the design as what is here.
 * No `aggregateRating` and no `Review`: there are no customers yet, and
 * inventing them is a manual-action risk rather than a shortcut. No
 * `BreadcrumbList`: a one-item breadcrumb on a single-page site is noise. No
 * `Product` beside `SoftwareApplication`: the specific type is the honest one,
 * and stacking both invites conflicting entity signals.
 *
 * On `FAQPage`, plainly: Google restricted FAQ rich results in August 2023 to
 * government and health sites, so this page will not get accordions in the
 * SERP and nobody should promise it will. It ships because Bing still renders
 * them, and because it hands a citation engine a machine-readable pairing of
 * exactly the questions this buyer asks. It is only legitimate because the
 * answers are already present in the server HTML — marking up content a
 * visitor cannot see is a policy violation, and this page does not do that.
 *
 * Every string comes from `landing-content.ts`. A second copy of the FAQ that
 * drifts from the visible one is worse than no markup at all.
 */
export function landingJsonLd(origin: string) {
  const c = landingContent;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
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
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: `${origin}/`,
        name: c.nav.brand,
        inLanguage: "uk-UA",
        publisher: { "@id": `${origin}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${origin}/#webpage`,
        url: `${origin}/`,
        name: c.hero.title,
        inLanguage: "uk-UA",
        isPartOf: { "@id": `${origin}/#website` },
        about: { "@id": `${origin}/#software` },
        primaryImageOfPage: `${origin}/og.png`,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#software`,
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
          url: `${origin}/#pilot`,
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${origin}/#faq`,
        inLanguage: "uk-UA",
        isPartOf: { "@id": `${origin}/#webpage` },
        mainEntity: c.faq.entries.map((e) => ({
          "@type": "Question",
          name: e.question,
          acceptedAnswer: { "@type": "Answer", text: e.answer },
        })),
      },
    ],
  };
}
