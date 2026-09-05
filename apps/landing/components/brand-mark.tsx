import { cx } from "@goproceed/ui/components";

/**
 * The mark, inline. Three shapes — a rounded tile, a chevron, a cobalt dot —
 * are cheaper as vector than as an image request, and inline they take the
 * ink and the mark from the roles, so a theme change reaches the logo too.
 * Decorative by default: the wordmark beside it carries the name.
 */
export function BrandMark({ className }: { className?: string | undefined }) {
  return (
    <svg
      data-brand-mark="true"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cx("size-7 shrink-0 text-ink", className)}
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 15.5 12 8l3.2 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.8" cy="15.6" r="1.9" className="fill-signal" />
    </svg>
  );
}
