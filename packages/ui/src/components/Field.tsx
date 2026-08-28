"use client";

// Structure follows shadcn/ui's field (MIT); styling is this system's token roles.
//
// REPLACES the render-prop `Field` this file used to hold. That component was a
// hand-rolled substitute for exactly this one, and the standing rule is that
// components come from shadcn and are never hand-rolled.
//
// `orientation="responsive"` is NOT ported. shadcn builds it on `@md/field-group`
// container queries; `theme.generated.css:21` clears `--container-*`, so the
// variant would compile to nothing — the silent-failure class §8 warns about.
import { useMemo, type ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cx } from "./cn";
import { Label } from "./Label";
import { Separator } from "./Separator";

export function FieldSet({ className, ...rest }: ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cx("flex flex-col gap-6", className)}
      {...rest}
    />
  );
}

export function FieldLegend({
  className, variant = "legend", ...rest
}: ComponentProps<"legend"> & { variant?: "legend" | "label" | undefined }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cx(
        "mb-3 font-medium text-ink",
        variant === "legend" ? "text-h3" : "text-meta",
        className,
      )}
      {...rest}
    />
  );
}

export function FieldGroup({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cx("group/field-group flex w-full flex-col gap-6", className)}
      {...rest}
    />
  );
}

const fieldVariants = cva(
  "group/field flex w-full gap-3 data-[invalid=true]:text-status-blocked-fg",
  {
    variants: {
      orientation: {
        vertical: "flex-col [&>*]:w-full [&>.sr-only]:w-auto",
        horizontal: "flex-row items-center [&>[data-slot=field-label]]:flex-auto",
      },
    },
    defaultVariants: { orientation: "vertical" },
  },
);

export function Field({
  className, orientation = "vertical", ...rest
}: ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cx(fieldVariants({ orientation }), className)}
      {...rest}
    />
  );
}

export function FieldContent({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cx("group/field-content flex flex-1 flex-col gap-1.5", className)}
      {...rest}
    />
  );
}

export function FieldLabel({ className, ...rest }: ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cx("group/field-label flex w-fit gap-2", className)}
      {...rest}
    />
  );
}

export function FieldTitle({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      data-slot="field-title"
      className={cx("flex w-fit items-center gap-2 text-meta font-medium text-ink", className)}
      {...rest}
    />
  );
}

export function FieldDescription({ className, ...rest }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cx("text-meta text-ink-muted", className)}
      {...rest}
    />
  );
}

export function FieldSeparator({ children, className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      data-slot="field-separator"
      data-content={Boolean(children)}
      className={cx("relative -my-2 h-5 text-meta", className)}
      {...rest}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          data-slot="field-separator-content"
          className="relative mx-auto block w-fit bg-canvas px-2 text-ink-muted"
        >
          {children}
        </span>
      )}
    </div>
  );
}

export function FieldError({
  className, children, errors, ...rest
}: ComponentProps<"div"> & {
  errors?: Array<{ message?: string | undefined } | undefined> | undefined;
}) {
  const content = useMemo(() => {
    if (children) return children;
    if (!errors?.length) return null;
    const unique = [...new Map(errors.map((e) => [e?.message, e])).values()];
    if (unique.length === 1) return unique[0]?.message;
    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {unique.map((e, i) => e?.message && <li key={i}>{e.message}</li>)}
      </ul>
    );
  }, [children, errors]);

  if (!content) return null;

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cx("flex items-center gap-1.5 text-meta text-status-blocked-fg", className)}
      {...rest}
    >
      <span aria-hidden="true">✕</span>
      <span>{content}</span>
    </div>
  );
}
