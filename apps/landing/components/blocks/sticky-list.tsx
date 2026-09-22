"use client";

import { useEffect, useState } from "react";

/**
 * The reference's sticky feature list (DEV-026): the names of the rows beside
 * it, the one in view marked. An IntersectionObserver over the rows' ids — no
 * scroll listener and no motion library, the same technique the one-page
 * header used for its sections. Links, so the list also works as navigation
 * and without JavaScript.
 */
export function StickyList({ label, items }: { label: string; items: readonly { id: string; label: string }[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");
  useEffect(() => {
    const targets = items.map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    }, { rootMargin: "-40% 0px -50% 0px" });
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label={label} className="sticky top-24 hidden h-fit wide:block">
      <p className="mb-5 text-data text-ink-muted">{label}</p>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "true" : undefined}
              className="block border-l-2 border-transparent py-1.5 pl-3 touch:py-3 text-data text-ink-muted transition-colors duration-fast ease-out hover:text-ink rounded-field aria-[current=true]:border-line-accent aria-[current=true]:bg-tint-warm aria-[current=true]:font-medium aria-[current=true]:text-ink"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
