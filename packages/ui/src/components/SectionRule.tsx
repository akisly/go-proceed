import { cx } from "./cn";

/**
 * The numbered hairline between sections — the prototype's `.sep`. A 1px
 * `border-line` with the mono label sitting on it, backed by the canvas so it
 * reads as a label on a drawing sheet rather than a line through a word.
 * Decorative: the section that follows carries its own heading, so this is
 * `aria-hidden` and never a landmark.
 */
export function SectionRule({
  index, label, className,
}: {
  index: string;
  label: string;
  className?: string | undefined;
}) {
  return (
    <div aria-hidden="true" data-section-rule={index} className={cx("relative h-px bg-line", className)}>
      <div className="mx-auto max-w-marketing px-4 md:px-8">
        <span className="index-label absolute -top-2 bg-canvas pr-2 text-ink-muted">
          {index} · {label}
        </span>
      </div>
    </div>
  );
}
