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
        <div className="hidden gap-0.5 md:flex" role="list">
          {landingContent.nav.items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={active === item.href ? "true" : undefined}
              className="landing-nav-link relative px-[0.6875rem] py-2 text-data text-ink-secondary transition-colors duration-fast ease-out hover:text-ink aria-[current=true]:text-ink"
            >
              {item.label}
            </a>
          ))}
        </div>
        <Button asChild size="sm" className="ml-2.5">
          <a href="#pilot">
            <span className="hidden md:inline">{landingContent.nav.action}</span>
            <span className="md:hidden">{landingContent.nav.actionShort}</span>
          </a>
        </Button>
      </nav>
    </header>
  );
}
