"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Banner, Button, Field, FieldDescription, FieldError, FieldGroup, FieldLabel,
  Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@goproceed/ui/components";

import {
  createAssignment,
  type CreateAssignmentInput,
  type CreateAssignmentResult,
} from "../../services/assignment-create.service";
import type { BaselineOption } from "../../services/baseline.service";
import { fieldErrorsFrom, unmappedFrom } from "../../lib/problem-field-errors";
import { membershipRoleLabel } from "../../lib/membership-labels";
import { nextSubmitState, type SubmitState } from "../../lib/submit-state";

/**
 * «Нове доручення» — the write foundation's first real screen.
 *
 * THE BINDING SHAPE IS THE VENDOR'S, not this repository's invention: shadcn's
 * current React Hook Form guide pairs `Controller` with the `Field` family,
 * puts `data-invalid` on `Field` and `aria-invalid` on the control, and feeds
 * `FieldError` an array. The array is also the shape the server's mapped
 * `fieldErrors` arrive in, so one component renders both sources — a client
 * rule and a server refusal land in the same place, in the same colour, and
 * neither can appear somewhere the other does not.
 *
 * THE IDEMPOTENCY KEY IS MINTED ONCE PER FORM INSTANCE and reused across
 * retries. That is the whole point of the header: a request that timed out may
 * have been received, and a fresh key on the retry is how one press becomes
 * two доручення.
 *
 * THE IMPORT IS `assignment-create.service`, NOT `assignments.service`. The
 * latter imports `apiGet`, which reaches `next/headers`; pulling it into a
 * `"use client"` module breaks the Turbopack build. The split exists for this
 * file.
 */

/** Kept identical to `decimal` in `packages/contracts/src/assignments.ts`. */
const QUANTITY = /^\d+(\.\d{1,6})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The names this form can render a message beside. Anything else is a banner. */
const FORM_FIELDS = ["workItemId", "assigneeMemberId", "plannedQuantity", "dueDate"] as const;

const formSchema = z.object({
  workItemId: z.string().min(1, "Оберіть рядок кошторису."),
  assigneeMemberId: z.string().min(1, "Оберіть виконавця."),
  /**
   * Both optional fields accept "" through ONE refinement rather than through
   * `.regex(…).or(z.literal(""))`.
   *
   * NOT because the union leaks English. It does not, and an earlier version
   * of this comment said it did: measured on the installed zod 4.4.3,
   * `"12abc"` through the union yields «Вкажіть число, до шести знаків після
   * коми.» verbatim, because `handleUnionResults` returns the single
   * NON-ABORTED branch's issues — `z.literal("")` aborts, the regex branch
   * does not, so exactly one survives and is reported as itself. The English
   * `invalid_union` message «Invalid input» needs two or more non-aborted
   * branches, which this schema never has.
   *
   * The refinement stays for two smaller and true reasons. It does not depend
   * on that internal single-survivor heuristic, which is zod's to change and
   * not part of its API. And it treats a stray space as empty: `" "` trims to
   * `""` and passes here, where the union rejects it — branch 1 fails the
   * regex on the trimmed value and branch 2 compares the literal against the
   * UNTRIMMED input. Refusing an optional field because someone brushed the
   * space bar is a real refusal for no reason.
   */
  plannedQuantity: z.string().trim().refine(
    (v) => v === "" || QUANTITY.test(v),
    "Вкажіть число, до шести знаків після коми.",
  ),
  dueDate: z.string().trim().refine(
    (v) => v === "" || ISO_DATE.test(v),
    "Вкажіть дату у форматі РРРР-ММ-ДД.",
  ),
});
type FormValues = z.infer<typeof formSchema>;

export interface MemberOption { memberId: string; role: string }

/** The seam the tests inject, exactly as `grants.service.ts` injects `fetchImpl`. */
export type CreateAssignmentImpl = (
  input: CreateAssignmentInput, idempotencyKey: string,
) => Promise<CreateAssignmentResult>;

/**
 * The description/error association the retired render-prop `Field` built
 * internally and the shadcn family deliberately does not — `[descriptionId,
 * errorId]`, joined, composed by the caller.
 *
 * Without it the description is never announced at all, and the error is
 * announced exactly once through `FieldError`'s `role="alert"` and never again
 * when the reader returns to the control. That is the gap commit e54d178 closed
 * in the kitchen sink's Field case, and that case is the pattern this form is
 * meant to crib.
 */
function describedBy(...ids: Array<string | false | undefined>): string | undefined {
  return ids.filter((id): id is string => typeof id === "string").join(" ") || undefined;
}

const BANNER_TITLE = "Доручення не створено";
const NETWORK_FAILURE = "Перевірте з'єднання та спробуйте ще раз.";
const CONTRACT_REFUSED = "Перевірте заповнені поля — дані не пройшли перевірку.";
const REFUSED_FALLBACK = "Перевірте заповнені поля та спробуйте ще раз.";

export function NewAssignmentForm({
  projectId, baselines, members, currentMemberId,
  createImpl = createAssignment, initialWorkItemId = "",
}: {
  projectId: string;
  baselines: BaselineOption[];
  members: MemberOption[];
  currentMemberId: string;
  createImpl?: CreateAssignmentImpl | undefined;
  initialWorkItemId?: string | undefined;
}) {
  const router = useRouter();

  // One base id per form instance; every field's control, description and
  // error derive from it. Minted here and not inside `Field`: the shadcn Field
  // family is presentational and mints nothing, which is the same reason
  // `issue-review-link.tsx` mints its own.
  const uid = useId();
  const slots = (name: (typeof FORM_FIELDS)[number]) => ({
    control: `${uid}${name}`,
    description: `${uid}${name}-description`,
    error: `${uid}${name}-error`,
  });
  const workItem = slots("workItemId");
  const assignee = slots("assigneeMemberId");
  const quantity = slots("plannedQuantity");
  const dueDate = slots("dueDate");

  // ONE key for the life of this form instance. `useRef` and not `useState`:
  // the key must exist before the first render finishes and must never cause
  // one. `crypto.randomUUID` needs a secure context, so the fallback stays.
  const idempotencyKey = useRef<string>("");
  if (idempotencyKey.current === "") {
    idempotencyKey.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `k-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  }

  const [state, setState] = useState<SubmitState>("idle");
  const [banner, setBanner] = useState<string | null>(null);

  const baseline = baselines[0];
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      workItemId: initialWorkItemId,
      assigneeMemberId: currentMemberId,
      plannedQuantity: "",
      dueDate: "",
    },
  });

  // The unit belongs to the chosen line, so the label has to follow the
  // choice rather than name a unit the estimator is not working in.
  const chosenWorkItemId = form.watch("workItemId");
  const unitCode =
    baseline?.workItems.find((w) => w.workItemId === chosenWorkItemId)?.unitCode ?? "од.";

  async function onSubmit(values: FormValues) {
    if (state === "submitting" || state === "created" || baseline === undefined) return;
    setState((s) => nextSubmitState(s, "submit"));
    setBanner(null);

    const result = await createImpl({
      contractId: baseline.contractId,
      workItemId: values.workItemId,
      assigneeMemberId: values.assigneeMemberId,
      // Absent, never null: `createAssignmentRequest` is `.strict()` about it,
      // and `exactOptionalPropertyTypes` asks for the same shape at the type
      // level.
      ...(values.plannedQuantity ? { plannedQuantity: values.plannedQuantity } : {}),
      ...(values.dueDate ? { dueDate: values.dueDate } : {}),
    }, idempotencyKey.current);

    if (result.kind === "ok") {
      setState((s) => nextSubmitState(s, "succeeded"));
      // The Router Cache would otherwise serve the register's previous list.
      router.refresh();
      router.push(`/dash/projects/${projectId}/assignments`);
      return;
    }

    setState((s) => nextSubmitState(s, "failed"));

    if (result.kind === "session_expired") {
      router.push(`/login?next=${encodeURIComponent(`/dash/projects/${projectId}/assignments/new`)}`);
      return;
    }

    if (result.kind === "refused") {
      const byField = fieldErrorsFrom(result.problem);
      for (const name of FORM_FIELDS) {
        const first = byField[name]?.[0];
        if (first) form.setError(name, { message: first.message });
      }
      // Anything the server named that this form has no field for still has to
      // reach the reader. A message with nowhere to go is a message lost.
      const leftovers = unmappedFrom(result.problem, FORM_FIELDS);
      setBanner(
        leftovers.length > 0 ? leftovers.join(" ") : result.detail ?? REFUSED_FALLBACK,
      );
      return;
    }

    // `invalid` is the contract refusing before the network — telling the
    // reader to check their connection would name the wrong cause.
    setBanner(result.kind === "invalid" ? CONTRACT_REFUSED : NETWORK_FAILURE);
  }

  // No published baseline means there is no line to assign against. The route
  // owns that empty state; this form has nothing to render.
  if (baseline === undefined) return null;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {banner !== null && <Banner tone="blocked" title={BANNER_TITLE}>{banner}</Banner>}

        <Controller
          name="workItemId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={workItem.control}>Рядок кошторису</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id={workItem.control}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={describedBy(fieldState.invalid && workItem.error)}
                >
                  <SelectValue placeholder="Оберіть рядок" />
                </SelectTrigger>
                <SelectContent>
                  {baseline.workItems.map((w) => (
                    <SelectItem key={w.workItemId} value={w.workItemId}>
                      {w.workCode ? `${w.workCode} · ${w.description}` : w.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && (
                <FieldError id={workItem.error} errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <Controller
          name="assigneeMemberId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={assignee.control}>Виконавець</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id={assignee.control}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={describedBy(
                    assignee.description, fieldState.invalid && assignee.error,
                  )}
                >
                  <SelectValue placeholder="Оберіть виконавця" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.memberId} value={m.memberId}>
                      {/* `membershipRoleLabel`, never the raw `m.role`: the
                          column holds `pto_manager` and `field_worker`, and
                          interpolating the token puts English on a Ukrainian
                          screen — the one leak a scan for string LITERALS
                          cannot see. The id stays untranslated because
                          `members.list` returns no name and no email; D4 owns
                          that. */}
                      {`${membershipRoleLabel(m.role)} · ${m.memberId.slice(0, 8)}`
                        + (m.memberId === currentMemberId ? " (ви)" : "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription id={assignee.description}>
                Доручення з&apos;явиться в «Мої доручення» на телефоні цієї людини.
              </FieldDescription>
              {fieldState.invalid && (
                <FieldError id={assignee.error} errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <Controller
          name="plannedQuantity"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={quantity.control}>
                Планова кількість, {unitCode}
              </FieldLabel>
              <Input
                id={quantity.control}
                inputMode="decimal"
                aria-invalid={fieldState.invalid}
                aria-describedby={describedBy(
                  quantity.description, fieldState.invalid && quantity.error,
                )}
                {...field}
              />
              <FieldDescription id={quantity.description}>Необов&apos;язково.</FieldDescription>
              {fieldState.invalid && (
                <FieldError id={quantity.error} errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <Controller
          name="dueDate"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={dueDate.control}>Строк</FieldLabel>
              <Input
                id={dueDate.control}
                type="date"
                aria-invalid={fieldState.invalid}
                aria-describedby={describedBy(
                  dueDate.description, fieldState.invalid && dueDate.error,
                )}
                {...field}
              />
              <FieldDescription id={dueDate.description}>Необов&apos;язково.</FieldDescription>
              {fieldState.invalid && (
                <FieldError id={dueDate.error} errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        {/* The button keeps its own width. `FieldGroup` is a column flex
            container, which stretches its children, and a submit stretched to
            the width of a form is not a button this system draws anywhere. */}
        <div className="flex">
          <Button type="submit" disabled={state === "submitting" || state === "created"}>
            {state === "submitting" ? "Створюємо доручення…" : "Створити доручення"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
