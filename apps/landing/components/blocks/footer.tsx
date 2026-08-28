import { landingContent } from "../../content/landing-content";
import { BrandMark } from "../brand-mark";

const footerLinks = [
  { label: "Продукт", href: "#product" },
  { label: "Маршрут", href: "#workflow" },
  { label: "Рішення", href: "#field-review" },
  { label: "Стан", href: "#readiness" },
  { label: "Пілот", href: "#pilot" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-line bg-canvas px-5 py-10 md:px-8 wide:px-12">
      <div className="mx-auto grid max-w-content gap-8 wide:grid-cols-[1fr_auto] wide:items-start">
        <div>
          <a href="#product" className="inline-flex min-h-11 items-center gap-3 text-ink">
            <BrandMark className="size-9 shrink-0" />
            <span className="text-h3 font-semibold">{landingContent.footer.line}</span>
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
              className="inline-flex min-h-11 items-center text-meta font-medium text-ink-muted transition-colors duration-fast ease-out hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
