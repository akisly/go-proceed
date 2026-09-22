import Link from "next/link";
import { landingContent, type PageKey } from "../../content/landing-content";
import { BrandMark } from "../brand-mark";
import { PillLink } from "./pill-link";

/**
 * The header. [DEV-023] The reference's: fixed between the inner guide lines,
 * a hairline at its foot, the mark at left, the page links centred, one pill
 * at right.
 *
 * [DEV-022] The landing is four pages, so the links are page links and the
 * current one is the page being served — a prop from `SiteShell`. That makes
 * this a server component: no effect, no router hook, and `aria-current` is
 * right in the first byte of HTML instead of after hydration.
 *
 * [DEV-024, seventh pass; changed 2026-09-22] Its ground is a static frosted layer. It was a client leaf that at the top
 * of the page, from `md`, the header is glass over the hero's pixel field, as
 * the reference's is; scrolled, below `md`, and without JavaScript it is the bar
 * it always was. The header itself stays a server component.
 */
export function Nav({ current }: { current: PageKey }) {
  const currentPath = landingContent.pages[current].path;
  return (
    <header className="landing-header landing-header-rail fixed top-0 z-40 isolate border-b border-line">
      {/* The header’s ground. [2026-09-22, owner: «хедер всегда сделай таким типа
        * прозрачным, а не только на скрол».] It used to be a client leaf that lifted
        * this layer while the page stood at its top, so the hero’s field ran under a
        * header with no ground at all (DEV-024, seventh pass). The owner wants the
        * frosted glass at every scroll position, so the layer is static, the listener
        * is gone, and the header is one thing at the top, half-way down and without
        * JavaScript. */}
      <i aria-hidden="true" data-header-veil="" className="landing-header-veil" />
      <nav aria-label="Головна навігація" className="relative flex h-(--gp-header-height-marketing) items-center gap-1.5 px-4 md:px-6">
        <Link href="/" className="mr-auto flex min-h-11 items-center gap-2.5 text-body font-semibold tracking-tight text-ink">
          <BrandMark />
          {landingContent.nav.brand}
        </Link>
        {/* A real `<ul>`. `role="list"` over bare anchors is axe's
          * `aria-required-children`. Centred on the bar, as the reference's. */}
        <ul className="absolute left-1/2 hidden -translate-x-1/2 gap-2 md:flex">
          {landingContent.nav.items.map((item) => (
            <li key={item.href} className="contents">
              <Link
                href={item.href}
                aria-current={currentPath === item.href ? "page" : undefined}
                className="landing-nav-link relative px-3 py-2 text-data text-ink-muted transition-colors duration-fast ease-out hover:text-ink aria-[current=page]:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <PillLink href={current === "pilot" ? landingContent.nav.actionHrefOnPilot : landingContent.nav.actionHref} size="sm" magnetic={false}>
          <span className="hidden md:inline">{landingContent.nav.action}</span>
          <span className="md:hidden">{landingContent.nav.actionShort}</span>
        </PillLink>
      </nav>

      {/* The phone's way between the pages.
        *
        * The row above is `hidden md:flex`, so below `md` it is `display: none`
        * and out of the accessibility tree along with everything else. This
        * strip is therefore the ONLY set of page links a phone has, for a thumb
        * and for a screen reader alike, and it is a labelled `<nav>` of its
        * own (DEV-022). Only one of the two is ever displayed, so nothing is
        * announced twice: this one is `md:hidden`, the other `hidden md:flex`.
        */}
      <nav aria-label="Сторінки сайту" className="border-t border-line md:hidden">
        <ul className="flex snap-x gap-1 overflow-x-auto px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {landingContent.nav.items.map((item) => (
            <li key={item.href} className="snap-start">
              <Link
                href={item.href}
                aria-current={currentPath === item.href ? "page" : undefined}
                className="flex min-h-11 items-center whitespace-nowrap rounded-pill px-3 text-data text-ink-muted transition-colors duration-fast ease-out aria-[current=page]:bg-subtle aria-[current=page]:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
