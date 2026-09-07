"use client";

import { useEffect, useState } from "react";
import { Button } from "@goproceed/ui/components";
import { landingContent } from "../../content/landing-content";
import { BrandMark } from "../brand-mark";

/**
 * The header (F9): permanent hairline, four links in page order with a
 * sliding underline that stays on the active section, the ink button. The
 * active section is an IntersectionObserver over the four targets — no
 * scroll listener, no motion library.
 */
export function Nav() {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const targets = landingContent.nav.items
      .map((i) => document.querySelector<HTMLElement>(i.href))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(`#${entry.target.id}`);
      }
    }, { rootMargin: "-45% 0px -45% 0px" });
    for (const t of targets) observer.observe(t);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="landing-header fixed inset-x-0 top-0 z-40 border-b border-line">
      <nav aria-label="Головна навігація" className="mx-auto flex h-(--gp-header-height-marketing) max-w-marketing items-center gap-1.5 px-4 md:px-8">
        <a href="#hero" className="mr-auto flex min-h-11 items-center gap-2.5 text-body font-semibold tracking-tight text-ink">
          <BrandMark />
          {landingContent.nav.brand}
        </a>
        {/* A real `<ul>`. `role="list"` over bare anchors is axe's
          * `aria-required-children`: a list with no list items, which screen
          * readers announce as empty and which can suppress the anchors' own
          * position information. `contents` keeps the flex row identical. */}
        <ul className="hidden gap-0.5 md:flex">
          {landingContent.nav.items.map((item) => (
            <li key={item.href} className="contents">
            <a
              href={item.href}
              aria-current={active === item.href ? "true" : undefined}
              className="landing-nav-link relative px-[0.6875rem] py-2 text-data text-ink-secondary transition-colors duration-fast ease-out hover:text-ink aria-[current=true]:text-ink"
            >
              {item.label}
            </a>
            </li>
          ))}
        </ul>
        <Button asChild size="sm" className="ml-2.5">
          <a href="#pilot">
            <span className="hidden md:inline">{landingContent.nav.action}</span>
            <span className="md:hidden">{landingContent.nav.actionShort}</span>
          </a>
        </Button>
      </nav>

      {/* The phone's way through the page.
        *
        * The row above is `hidden md:flex`, and below that width nothing
        * replaced it: no menu, no anchors, only the pilot button — on a page
        * that measures 21 323px at 390, roughly twenty-five screens with no way
        * to jump. A scrolling strip of the same four anchors is the smallest
        * thing that fixes it and the one that fits the system: a 1px rule and
        * a row of labels, no overlay, no burger, nothing that covers content.
        *
        * `aria-hidden` with `tabindex={-1}`: these are the SAME four links as
        * the row above, and announcing both would read the page's navigation
        * twice. The visible strip is for the eye and the thumb; the accessible
        * copy is the labelled `<nav>`, which stays in the tree at every width.
        */}
      <div aria-hidden="true" className="border-t border-line md:hidden">
        <ul className="flex snap-x gap-1 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {landingContent.nav.items.map((item) => (
            <li key={item.href} className="snap-start">
              <a
                href={item.href}
                tabIndex={-1}
                aria-current={active === item.href ? "true" : undefined}
                className="flex min-h-11 items-center whitespace-nowrap rounded-control px-3 text-data text-ink-secondary transition-colors duration-fast ease-out aria-[current=true]:bg-subtle aria-[current=true]:text-ink"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
