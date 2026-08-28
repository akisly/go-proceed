import { landingContent } from "../../content/landing-content";
import { BrandMark } from "../brand-mark";

export function NavFloat() {
  return (
    <header className="landing-glass-nav fixed inset-x-0 top-0 z-50 px-5 md:px-8 wide:px-12">
      <nav
        aria-label="Головна навігація"
        className="mx-auto flex h-16 max-w-content items-center gap-6"
      >
        <a href="#product" className="flex min-h-11 items-center gap-2 rounded-pill text-ink">
          <BrandMark className="size-8 shrink-0" priority />
          <span className="text-h3 font-semibold tracking-tight landing-marker-accent">
            GoProceed
          </span>
        </a>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          {landingContent.nav.items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-pill px-3 py-2 text-meta font-medium text-ink-muted transition-colors duration-fast ease-out hover:bg-action-ghost-hover hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </div>

        <a
          href="#pilot"
          className="ml-auto inline-flex min-h-11 items-center justify-center rounded-control bg-action px-4 text-data font-semibold text-action-fg transition-colors duration-fast ease-out hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:ml-2"
        >
          <span className="hidden md:inline">{landingContent.nav.action}</span>
          <span className="md:hidden">Пілот</span>
        </a>
      </nav>
    </header>
  );
}
