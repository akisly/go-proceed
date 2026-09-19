import Link from "next/link";
import { Button } from "@goproceed/ui/components";
import { landingContent, type PageKey } from "../../content/landing-content";
import { BrandMark } from "../brand-mark";

/**
 * The header (F9): permanent hairline, the page links with a sliding underline
 * that stays on the current page, the ink button.
 *
 * [DEV-022] The landing is four pages, so the links are page links and the
 * current one is the page being served — a prop from `SiteShell`, not an
 * IntersectionObserver over in-page targets. That makes this a server
 * component: no effect, no router hook, and `aria-current` is right in the
 * first byte of HTML instead of after hydration.
 */
export function Nav({ current }: { current: PageKey }) {
  const currentPath = landingContent.pages[current].path;
  return (
    <header className="landing-header fixed inset-x-0 top-0 z-40 border-b border-line">
      <nav aria-label="Головна навігація" className="mx-auto flex h-(--gp-header-height-marketing) max-w-marketing items-center gap-1.5 px-4 md:px-8">
        <Link href="/" className="mr-auto flex min-h-11 items-center gap-2.5 text-body font-semibold tracking-tight text-ink">
          <BrandMark />
          {landingContent.nav.brand}
        </Link>
        {/* A real `<ul>`. `role="list"` over bare anchors is axe's
          * `aria-required-children`: a list with no list items, which screen
          * readers announce as empty and which can suppress the anchors' own
          * position information. `contents` keeps the flex row identical. */}
        <ul className="hidden gap-0.5 md:flex">
          {landingContent.nav.items.map((item) => (
            <li key={item.href} className="contents">
              <Link
                href={item.href}
                aria-current={currentPath === item.href ? "page" : undefined}
                className="landing-nav-link relative px-[0.6875rem] py-2 text-data text-ink-secondary transition-colors duration-fast ease-out hover:text-ink aria-[current=page]:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <Button asChild size="sm" className="ml-2.5">
          <Link href={current === "pilot" ? landingContent.nav.actionHrefOnPilot : landingContent.nav.actionHref}>
            <span className="hidden md:inline">{landingContent.nav.action}</span>
            <span className="md:hidden">{landingContent.nav.actionShort}</span>
          </Link>
        </Button>
      </nav>

      {/* The phone's way between the pages.
        *
        * The row above is `hidden md:flex`, so below `md` it is `display: none`
        * and out of the accessibility tree along with everything else. This
        * strip is therefore the ONLY set of page links a phone has, for a thumb
        * and for a screen reader alike, and it is a labelled `<nav>` of its
        * own. Until DEV-022 it was `aria-hidden` with `tabindex={-1}`, written
        * on the belief that the row above stayed announced at every width; it
        * did not, and on a one-page site the cost was four anchors. On a
        * four-page site it would be the whole navigation.
        *
        * Only one of the two is ever rendered, so nothing is announced twice:
        * this one is `md:hidden`, the other `hidden md:flex`.
        */}
      <nav aria-label="Сторінки сайту" className="border-t border-line md:hidden">
        <ul className="flex snap-x gap-1 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {landingContent.nav.items.map((item) => (
            <li key={item.href} className="snap-start">
              <Link
                href={item.href}
                aria-current={currentPath === item.href ? "page" : undefined}
                className="flex min-h-11 items-center whitespace-nowrap rounded-control px-3 text-data text-ink-secondary transition-colors duration-fast ease-out aria-[current=page]:bg-subtle aria-[current=page]:text-ink"
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
