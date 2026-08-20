import { landingContent } from "../../content/landing-content";

const footerLinks = [
  { label: "Продукт", href: "#product" },
  { label: "Як працює", href: "#workflow" },
  { label: "Для команди", href: "#roles" },
  { label: "Пілот", href: "#pilot" },
  { label: "Питання", href: "#faq" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-line bg-canvas px-5 py-10 md:px-8 wide:px-12">
      <div className="mx-auto grid max-w-content gap-8 wide:grid-cols-[1fr_auto] wide:items-start">
        <div>
          <a href="#product" className="inline-flex items-center gap-3 text-ink">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-pill bg-action text-meta font-semibold text-action-fg"
            >
              GP
            </span>
            <span className="text-data font-semibold">{landingContent.footer.line}</span>
          </a>
          <p className="mt-4 max-w-[66ch] text-meta leading-relaxed text-ink-muted">
            {landingContent.footer.disclaimer}
          </p>
        </div>

        <nav aria-label="Навігація у футері" className="flex flex-wrap gap-x-6 gap-y-3 wide:justify-end">
          {footerLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-meta font-medium text-ink-muted transition-colors duration-fast ease-out hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
