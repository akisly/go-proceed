import { landingContent } from "../../content/landing-content";
import { MockAction } from "../mock-action";

export function NavFloat() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 px-4 md:top-5">
      <nav
        aria-label="Головна навігація"
        className="pointer-events-auto mx-auto flex h-14 max-w-nav items-center gap-6 rounded-pill border border-line bg-surface px-3 shadow-float md:px-4"
      >
        <a href="#product" className="flex items-center gap-2 rounded-pill text-ink">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-pill bg-action text-meta font-semibold text-action-fg"
          >
            GP
          </span>
          <span className="text-data font-semibold tracking-tight">GoProceed</span>
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

        <MockAction className="ml-auto md:ml-2" variant="primary">
          <span className="hidden md:inline">{landingContent.nav.action}</span>
          <span className="md:hidden">Пілот</span>
        </MockAction>
      </nav>
    </div>
  );
}
