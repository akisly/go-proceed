import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./cn";

const CONTROL =
  "w-full rounded-field border bg-surface px-3 text-data text-ink " +
  "placeholder:text-ink-muted transition-colors duration-fast ease-out " +
  "disabled:bg-subtle disabled:text-ink-muted " +
  "aria-invalid:border-status-blocked-fg";

/**
 * Placeholder colour is `text-ink-muted`, which is the body-text floor
 * (5.07:1 on canvas) and not a lighter step. A placeholder is text: it is read,
 * and in this product it often carries the format an estimator is expected to
 * type. `text-ink-subtle` would clear only the large-text threshold.
 */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(CONTROL, "h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch) border-line-strong", className)}
      {...rest}
    />
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(CONTROL, "min-h-24 border-line-strong py-2 leading-normal", className)}
      {...rest}
    />
  );
}
