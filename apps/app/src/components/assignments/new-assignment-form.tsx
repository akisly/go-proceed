"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createAssignmentRequest } from "@goproceed/contracts";

import {
  Banner, Button, Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle,
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

/**
 * THE CONTRACT'S OWN RULES, UNWRAPPED — not a second copy of them.
 *
 * These two lines used to be `const QUANTITY = /^\d+(\.\d{1,6})?$/` and
 * `const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/`, transcribed from
 * `packages/contracts/src/assignments.ts` under a comment that promised they
 * were «kept identical». Nothing kept them. Narrow the contract's `decimal` to
 * two places and this form still accepts six: `createAssignment`'s own
 * `safeParse` refuses the body, the reader gets the generic
 * «дані не пройшли перевірку» banner with no message against the quantity
 * field, and not one test in this repository fails. The spec's §4 states the
 * rule this restores — «`zodResolver` runs the same `createAssignmentRequest`
 * the wire uses, so the rules are stated once».
 *
 * `.unwrap()` IS WHAT MAKES IT REACHABLE, and it was measured on the installed
 * zod 4.4.3 rather than assumed: both fields are `.optional()` on the request,
 * so `shape.plannedQuantity` is a `ZodOptional` whose `safeParse("")` is FALSE
 * (an optional accepts `undefined`, never the empty string). `.unwrap()` hands
 * back the inner `ZodString` carrying the regex, which answers the only
 * question this form asks it: is this NON-EMPTY string one the wire will take.
 * The empty case is the refinement's own `v === ""` arm below, where it belongs
 * — it is a fact about the FORM (this field may be left blank and is then not
 * sent), not about the request.
 *
 * THE TWO REQUIRED FIELDS ARE NOT DERIVED, DELIBERATELY. `workItemId` and
 * `assigneeMemberId` are `z.string().guid()` on the request and
 * `z.string().min(1, …)` here, and those are different rules rather than a
 * duplicated one: the form is asking «did you choose», the contract is asking
 * «is this a guid», and both values come from a `Select` populated with server
 * ids where a non-guid cannot be typed. Deriving them would replace a message
 * that names the missing choice with one that cannot be acted on.
 */
const quantityRule = createAssignmentRequest.shape.plannedQuantity.unwrap();
const dueDateRule = createAssignmentRequest.shape.dueDate.unwrap();

/**
 * The names this form can render a message beside. Anything else is a banner.
 *
 * `contractVersionId` is deliberately NOT here even though it is a form field.
 * With a single baseline it renders as static text and has no `FieldError` to
 * receive a message, so treating it as mapped would send a server refusal to a
 * field that cannot display it — the message would vanish, which is the one
 * thing `unmappedFrom` exists to prevent. Routed to the banner instead, where
 * it is visible in both the one-baseline and many-baseline shapes.
 */
const FORM_FIELDS = ["workItemId", "assigneeMemberId", "plannedQuantity", "dueDate"] as const;

const formSchema = z.object({
  contractVersionId: z.string().min(1, "Оберіть кошторис."),
  workItemId: z.string().min(1, "Оберіть рядок кошторису."),
  assigneeMemberId: z.string().min(1, "Оберіть виконавця."),
  /**
   * Both optional fields accept "" through ONE refinement rather than through
   * `.regex(…).or(z.literal(""))` — and the rule inside the refinement is the
   * CONTRACT'S, read through `quantityRule`/`dueDateRule` above rather than
   * transcribed. The refinement is what keeps the Ukrainian message: a derived
   * `.pipe()` or a bare `.and()` would surface zod's own English string for the
   * inner schema, and the message is the half of this that a person reads.
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
    (v) => v === "" || quantityRule.safeParse(v).success,
    "Вкажіть число, до шести знаків після коми.",
  ),
  dueDate: z.string().trim().refine(
    (v) => v === "" || dueDateRule.safeParse(v).success,
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

/**
 * A baseline's identity, from the three fields `BaselineOption` actually
 * carries. Nothing else is available: `blocked_value.get`'s rows supply
 * `contractId`, `contractVersionId` and `contractVersionNo`, and there is no
 * contract title anywhere on the wire.
 *
 * THE TRUNCATED CONTRACT ID IS LOAD-BEARING, not decoration. Two baselines on
 * one project can be different CONTRACTS, each with its own version numbering,
 * so «версія 1» and «версія 1» is a real collision and the version number
 * alone cannot name the choice being made. Same treatment as the виконавець
 * picker, for the same reason and with the same honesty about what the read
 * returns.
 */
function baselineLabel(baseline: BaselineOption): string {
  return `Договір ${baseline.contractId.slice(0, 8)} · версія ${baseline.contractVersionNo}`;
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
  const slots = (name: keyof FormValues) => ({
    control: `${uid}${name}`,
    description: `${uid}${name}-description`,
    error: `${uid}${name}-error`,
  });
  const contractVersion = slots("contractVersionId");
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contractVersionId: baselines[0]?.contractVersionId ?? "",
      workItemId: initialWorkItemId,
      assigneeMemberId: currentMemberId,
      plannedQuantity: "",
      dueDate: "",
    },
  });

  /**
   * THE CHOSEN BASELINE, not `baselines[0]`.
   *
   * The first version of this file took the head of the list and every use
   * followed from it — `workItems` to populate the line picker, `contractId`
   * to address the write. On a project with two published baselines that
   * silently created the доручення against whichever contract happened to sort
   * first, with nothing on screen saying so and no way to correct it. The
   * spec's rule is the one implemented here: more than one baseline is a
   * `Select`, exactly one is static text — never a control with a single
   * option.
   */
  const chosenVersionId = form.watch("contractVersionId");
  const baseline =
    baselines.find((b) => b.contractVersionId === chosenVersionId) ?? baselines[0];

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
      router.push(`/projects/${projectId}/assignments`);
      return;
    }

    setState((s) => nextSubmitState(s, "failed"));

    if (result.kind === "session_expired") {
      router.push(`/login?next=${encodeURIComponent(`/projects/${projectId}/assignments/new`)}`);
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

        {baselines.length > 1 ? (
          <Controller
            name="contractVersionId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={contractVersion.control}>Кошторис</FieldLabel>
                <Select
                  value={field.value}
                  onValueChange={(next) => {
                    field.onChange(next);
                    // THE RESET IS THE WHOLE POINT OF HANDLING THE CHANGE
                    // HERE. A `workItemId` chosen under the previous baseline
                    // is not a line of this one, and leaving it would send a
                    // work item belonging to another contract.
                    //
                    // MEASURED, by removing this line and reading what the
                    // trigger renders: it goes completely BLANK — not the
                    // stale text, and not the placeholder either, because a
                    // non-empty value suppresses the placeholder while no
                    // rendered item matches it. So the visible failure is a
                    // line picker showing nothing at all while still holding
                    // another contract's work item, ready to submit it.
                    form.setValue("workItemId", "");
                  }}
                >
                  <SelectTrigger
                    id={contractVersion.control}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={describedBy(
                      contractVersion.description, fieldState.invalid && contractVersion.error,
                    )}
                  >
                    <SelectValue placeholder="Оберіть кошторис" />
                  </SelectTrigger>
                  <SelectContent>
                    {baselines.map((b) => (
                      <SelectItem key={b.contractVersionId} value={b.contractVersionId}>
                        {baselineLabel(b)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription id={contractVersion.description}>
                  Доручення створюється за цим кошторисом. Зміна кошторису очищає обраний рядок.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError id={contractVersion.error} errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        ) : (
          // Exactly one baseline: static text, NOT a Select with a single
          // option. A control that can only produce the value it already has
          // asks the reader to make a choice that does not exist. It is still
          // shown, because the доручення is created against this contract and
          // that is a fact the reader has to be able to check.
          <Field>
            <FieldTitle>Кошторис</FieldTitle>
            <p className="text-data text-ink">{baselineLabel(baseline)}</p>
          </Field>
        )}

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
                {/* DEV-035 (owner: «Нейтральный»): this promised «Мої доручення» on the
                  * assignee's phone, a screen of the field PWA the owner retired. */}
                Учасник робочого простору, який виконуватиме роботу.
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
          <Button type="submit" variant="brand" disabled={state === "submitting" || state === "created"}>
            {state === "submitting" ? "Створюємо доручення…" : "Створити доручення"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
