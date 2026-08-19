"use client";

import { useId, type ReactNode } from "react";
import { cx } from "./cn";

/**
 * The accessibility plumbing every input needs, written once.
 *
 * A label bound by `htmlFor`, a description and an error both wired into
 * `aria-describedby`, and `aria-invalid` set from the presence of an error
 * rather than from a separate prop that can disagree with it.
 *
 * The children receive the ids as a render prop. That is deliberately more
 * verbose than cloning the child: cloning silently overwrites props the caller
 * set, and an input whose `aria-describedby` was quietly replaced is a defect
 * nobody sees until someone uses a screen reader.
 *
 * ERROR TEXT IS NEVER COLOUR ALONE. It carries an icon slot and a word; the
 * red is the third signal, not the first.
 */
export function Field({
  label, description, error, required = false, children, className,
}: {
  label: string;
  description?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
  className?: string | undefined;
}) {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-meta font-medium text-ink">
        {label}
        {required && <span className="ml-1 text-status-blocked-fg" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (обов’язкове)</span>}
      </label>
      {description && (
        <p id={descId} className="text-meta text-ink-muted">{description}</p>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && (
        <p id={errId} className="flex items-center gap-1.5 text-meta text-status-blocked-fg">
          <span aria-hidden="true">✕</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
