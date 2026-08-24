"use client";

// Structure follows shadcn/ui's Form (MIT) —
// https://github.com/shadcn-ui/ui, `apps/v4/registry/new-york-v4/ui/form.tsx`,
// read through the shadcn MCP `get_component("form")` on 2026-08-23.
// Styling is this system's token roles; the Radix import is the unified
// `radix-ui` package this repository already depends on.

import { createContext, useContext, useId, type ComponentProps } from "react";
import { Label as LabelPrimitive, Slot } from "radix-ui";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { cx } from "./cn";
import { Label } from "./Label";

/**
 * The react-hook-form half of this package's form story.
 *
 * WHY IT EXISTS BESIDE `Field.tsx` RATHER THAN REPLACING IT, stated plainly
 * because the overlap is the first thing a reader will notice. `Field` is a
 * RENDER PROP: it mints ids, wires `aria-describedby` and `aria-invalid`, and
 * hands them to the caller. It needs no library and it is what every screen
 * shipped so far uses. `Form` is the CONTEXT shape: `FormField` renders a
 * react-hook-form `Controller`, and `FormItem`/`FormLabel`/`FormControl`/
 * `FormMessage` read the field's state off two React contexts instead of a
 * closure argument. That is what lets the error message come from a zod schema
 * — the same schema the route parses — rather than from a hand-written
 * conditional at the call site.
 *
 * They are not interchangeable and they should not both survive indefinitely.
 * Which one wins is a decision the first real form makes with real screens in
 * front of it, not one this commit makes ahead of time; `index.ts` records the
 * duplication so it cannot go unnoticed.
 *
 * THE ONE RULE ADDED TO SHADCN'S OWN STRUCTURE: **an error is never colour
 * alone.** `02-building-ui.md` §4.1 — «a status shown only by colour → colour
 * PLUS its `ui_uk` label» — and this audience reads refusals on a phone in
 * direct sunlight. `Field.tsx` already encodes it with a glyph beside the
 * sentence; `FormMessage` carries the same one, so a form written either way
 * fails the same way. shadcn's `FormMessage` is `text-sm text-destructive` and
 * nothing else, which is exactly the colour-only failure the rule names.
 *
 * `text-meta`, not `text-sm`: the stock size namespace is cleared, so
 * `text-sm` compiles to nothing.
 */
export const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = createContext<FormFieldContextValue>({} as FormFieldContextValue);

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

type FormItemContextValue = { id: string };

const FormItemContext = createContext<FormItemContextValue>({} as FormItemContextValue);

export function useFormField() {
  const fieldContext = useContext(FormFieldContext);
  const itemContext = useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

export function FormItem({ className, ...rest }: ComponentProps<"div">) {
  const id = useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cx("grid gap-1.5", className)} {...rest} />
    </FormItemContext.Provider>
  );
}

export function FormLabel({
  className, ...rest
}: ComponentProps<typeof LabelPrimitive.Root>) {
  const { error, formItemId } = useFormField();

  return (
    <Label
      data-slot="form-label"
      data-error={Boolean(error)}
      className={cx("data-[error=true]:text-status-blocked-fg", className)}
      htmlFor={formItemId}
      {...rest}
    />
  );
}

/**
 * `Slot.Root` merges its props onto the single child, which is how the control
 * itself — an `Input`, a `Textarea`, a `SelectTrigger` — receives the id and
 * the `aria-*` wiring without this file knowing what it is.
 *
 * NEVER pass a function-valued `className` or `children` through this: Slot
 * merges by string concatenation, so the function is stringified into the
 * class attribute. React does not warn and TypeScript cannot see it
 * (`02-building-ui.md` §7.2).
 */
export function FormControl({ ...rest }: ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot.Root
      data-slot="form-control"
      id={formItemId}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={Boolean(error)}
      {...rest}
    />
  );
}

export function FormDescription({ className, ...rest }: ComponentProps<"p">) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cx("text-meta text-ink-muted", className)}
      {...rest}
    />
  );
}

export function FormMessage({ className, children, ...rest }: ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message ?? "") : children;

  if (!body) return null;

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cx(
        "flex items-center gap-1.5 text-meta text-status-blocked-fg",
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true">✕</span>
      <span>{body}</span>
    </p>
  );
}
