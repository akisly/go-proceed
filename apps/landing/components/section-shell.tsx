import type { ReactNode } from "react";

type SectionShellProps = {
  id?: string;
  eyebrow?: string;
  title?: string;
  lead?: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  headingClassName?: string;
  inverse?: boolean;
};

export function SectionShell({
  id,
  eyebrow,
  title,
  lead,
  children,
  className = "",
  innerClassName = "",
  headingClassName = "",
  inverse = false,
}: SectionShellProps) {
  const ink = inverse ? "text-on-inverse" : "text-ink";
  const muted = inverse ? "text-on-inverse-muted" : "text-ink-muted";

  return (
    <section id={id} className={`scroll-mt-24 px-5 py-20 md:px-8 md:py-28 wide:px-12 ${className}`}>
      <div className={`mx-auto max-w-content ${innerClassName}`}>
        {(eyebrow || title || lead) && (
          <header className="mb-12 md:mb-16">
            {eyebrow && <p className={`index-label mb-4 ${muted}`}>{eyebrow}</p>}
            {title && (
              <h2 className={`display max-w-[30ch] text-mkt-display-2 ${ink} ${headingClassName}`}>
                {title}
              </h2>
            )}
            {lead && <p className={`measure mt-5 text-mkt-lead leading-relaxed ${muted}`}>{lead}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
