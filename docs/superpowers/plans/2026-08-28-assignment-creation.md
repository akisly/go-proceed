# Creating a доручення from the dashboard — implementation plan (Plan D slice A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One route — `/dash/projects/{projectId}/assignments/new` — that creates a work assignment on an already-published contract baseline, plus the browser write foundation slices B and C reuse.

**Architecture:** A server component resolves the picker sources from two reads that already ship (`blocked_value.get` → `contractId`+`contractVersionNo`, then `contract_versions.get` → `workItems[]`) and hands them to a client form. The form is react-hook-form driven by `zodResolver` over the same `createAssignmentRequest` the wire uses, drawn with shadcn's `Field` family. The write goes through a service module shaped exactly like `grants.service.ts` — contract `safeParse` first, injected `fetchImpl`, a discriminated result — so it is testable without a browser.

**Tech Stack:** Next 16 App Router (server components + one client form), react-hook-form 7.86 + @hookform/resolvers 5.9, zod 4.4, shadcn `Field`/`Select`/`Input` in `packages/ui`, vitest with a per-file jsdom environment, puppeteer for the browser audit.

**Spec:** [`docs/superpowers/specs/2026-08-28-assignment-creation-design.md`](../specs/2026-08-28-assignment-creation-design.md)

## Global Constraints

- **No new API operation, no route change, no migration, no capability change.** Every read this slice needs already exists. If a task seems to need one, stop — that is slice B.
- **Role names only, never a value.** `bg-canvas`, not `bg-neutral-25`, never a hex. Measured 2026-08-28: `text-sm`, `text-muted-foreground` and `rounded-md` produce **zero** rules in the built chunks; `text-meta`, `text-ink-muted`, `rounded-control` are present. A stock class fails silently — no error, just an unstyled element.
- **Never write a Tailwind class as a template literal** (`bg-${tone}`). The scanner sees the template and emits no CSS.
- **Components come from shadcn one-to-one; never hand-roll a substitute.** Structure and behaviour are copied; styling is mapped to token roles (`docs/design/02-building-ui.md` §7.2). Each ported file's header names its source and licence.
- **Animation, if any, comes from `@goproceed/ui/motion`.** Importing `motion/react` anywhere else fails the build.
- **A control's height is `h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch)`**, never `h-11`/`h-9`.
- **A status shown only by colour is a defect** — colour plus its `ui_uk` label.
- **Every user-facing Ukrainian string gets a `technical/copy-catalog.csv` row** (columns: `key,ui_uk,screen,state,context`).
- **Demo data is transparently fake:** «Приклад-» prefix, never a plausible invented Ukrainian company name.
- **`exactOptionalPropertyTypes` is on:** write `error?: string | undefined`, not `error?: string`.
- **Run every command from the repo root**, and prefix DB-touching commands with:
  `APP_DB_URL=postgresql://goproceed_app_login:app_pw@127.0.0.1:54322/postgres SERVICE_DB_URL=postgresql://goproceed_service_login:service_pw@127.0.0.1:54322/postgres SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`
  After any `supabase db reset`, run `pnpm -w db:local-credentials`.

---

## File structure

| File | Responsibility |
|---|---|
| `packages/ui/src/components/Field.tsx` | **Replaced.** shadcn's ten Field components, styled in token roles. |
| `packages/ui/src/components/index.ts` | Export the family; update the inventory note. |
| `apps/app/app/kitchen-sink/components/page.tsx` | The family's required kitchen-sink entry. |
| `apps/app/src/components/evidence/issue-review-link.tsx` | Migrated off the retired render-prop `Field`. |
| `apps/app/vitest.config.ts` | Unchanged default; jsdom is opted into per file. |
| `apps/app/src/lib/api.ts` | Gains `apiPost`. |
| `apps/app/src/lib/problem-field-errors.ts` | **New.** problem+json → `FieldError`-shaped map. Pure. |
| `apps/app/src/lib/submit-state.ts` | **New.** The re-entrancy state machine. Pure. |
| `apps/app/src/services/assignments.service.ts` | Gains `createAssignment`. |
| `apps/app/src/services/baseline.service.ts` | **New.** The two-hop picker source. |
| `apps/app/src/components/assignments/new-assignment-form.tsx` | **New.** The client form. |
| `apps/app/app/dash/projects/[projectId]/assignments/new/page.tsx` | **New.** The route. |
| `apps/app/src/components/assignments/assignments-list.tsx` | Gains the «Нове доручення» link. |
| `technical/copy-catalog.csv` | The slice's copy rows. |
| `apps/app/qa/field.mjs` | The «assignment creation» audit. |

---

### Task 1: shadcn's Field family replaces the hand-written `Field`

They land together and cannot be split: both export a symbol named `Field`, so shipping the new one while the old one is still exported is a TypeScript name collision in `index.ts`.

**Files:**
- Modify: `packages/ui/src/components/Field.tsx` (replace contents)
- Modify: `packages/ui/src/components/index.ts:46` (the `Field` export) and its inventory note at `:9-40`
- Modify: `apps/app/src/components/evidence/issue-review-link.tsx` (migrate off the render prop)
- Modify: `apps/app/app/kitchen-sink/components/page.tsx` (add the entry §7.2 requires)
- Test: `apps/app/src/components/evidence/issue-review-link.test.tsx` (must keep passing, unchanged)

**Interfaces:**
- Consumes: `cx` (`./cn`), `Label` (`./Label`), `Separator` (`./Separator`), `cva` (`class-variance-authority` — already a dependency).
- Produces: `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldLegend`, `FieldSeparator`, `FieldSet`, `FieldContent`, `FieldTitle`. `FieldError` takes `errors?: Array<{ message?: string } | undefined>`. `Field` takes `orientation?: "vertical" | "horizontal"` and `data-invalid`.

- [ ] **Step 1: Read the gate first.** Read `docs/design/02-building-ui.md` §3.3, §4.1 and §7.2. Note in your report which of §3.3's three questions each new component answered.

- [ ] **Step 2: Replace `packages/ui/src/components/Field.tsx`**

`orientation="responsive"` is deliberately NOT ported: it is built on `@md/field-group` container queries, and `theme.generated.css:21` sets `--container-*: initial`, so those variants would emit nothing. Shipping it needs a container role in `tokens.json` first.

```tsx
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
```

- [ ] **Step 3: Export the family and correct the inventory note**

In `packages/ui/src/components/index.ts`, replace `export { Field } from "./Field";` with:

```ts
export {
  Field, FieldContent, FieldDescription, FieldError, FieldGroup,
  FieldLabel, FieldLegend, FieldSeparator, FieldSet, FieldTitle,
} from "./Field";
```

In the inventory note, replace the «TWO DUPLICATIONS» item 1 (the `Field` vs `FormItem` paragraph) with a dated resolution — it is a record, so this is a correction, not a deletion:

```
 *   1. RESOLVED 2026-08-28 by taking shadcn's own answer. `Field` is now the
 *      shadcn Field family (ten components, presentational, paired with
 *      react-hook-form's `Controller` per the vendor's current guide); the
 *      render-prop `Field` this note used to describe is gone. `Form`/
 *      `FormField`/`FormItem`/… remain exported and now have NO caller and no
 *      planned one — shadcn's docs name that set the older pattern. Whoever
 *      needs it decides whether it stays.
```

- [ ] **Step 4: Migrate `issue-review-link.tsx` off the render prop**

Find each `<Field label=… error=…>{({ id, describedBy, invalid }) => …}</Field>` and rewrite as the family. The ids are yours now — mint them with `useId()` in the component, as the retired `Field` did internally:

```tsx
<Field data-invalid={Boolean(emailError)}>
  <FieldLabel htmlFor={emailId}>Пошта одержувача</FieldLabel>
  <Input
    id={emailId}
    type="email"
    aria-invalid={Boolean(emailError)}
    aria-describedby={emailError ? emailErrorId : undefined}
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
  {emailError && <FieldError id={emailErrorId} errors={[{ message: emailError }]} />}
</Field>
```

- [ ] **Step 5: Add the kitchen-sink entry**

§7.2 requires all three — component, export, kitchen-sink — or `component-contract.test.ts` fails on the orphan. Render one `FieldGroup` holding a valid `Field` and an invalid one, so both states are visible:

```tsx
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="ks-field-ok">Планова кількість</FieldLabel>
    <Input id="ks-field-ok" defaultValue="12.5" />
    <FieldDescription>Необов'язкове поле.</FieldDescription>
  </Field>
  <Field data-invalid={true}>
    <FieldLabel htmlFor="ks-field-bad">Рядок кошторису</FieldLabel>
    <Input id="ks-field-bad" aria-invalid={true} />
    <FieldError errors={[{ message: "Оберіть рядок кошторису." }]} />
  </Field>
</FieldGroup>
```

- [ ] **Step 6: Run the checks**

Run: `pnpm --filter @goproceed/testing test`
Expected: PASS, including `component-contract.test.ts` and `primitive-leak.test.ts`.

Run: `pnpm turbo run typecheck`
Expected: PASS. A failure naming `Field` in `issue-review-link.tsx` means Step 4 missed a call site.

Run: `cd apps/app && pnpm vitest run src/components/evidence/issue-review-link.test.tsx`
Expected: PASS, unchanged — the migration must not alter what that component renders.

- [ ] **Step 7: Prove the styling actually compiled**

A class that does not exist produces no error, only an unstyled element — so this is measured, not assumed.

Run: `pnpm --filter @goproceed/app build`
Then: `grep -o 'text-status-blocked-fg' apps/app/.next/static/chunks/*.css | head -1`
Expected: at least one match. Zero means the error text has no colour and the ✕ is doing all the work.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/components/Field.tsx packages/ui/src/components/index.ts \
  apps/app/src/components/evidence/issue-review-link.tsx \
  apps/app/app/kitchen-sink/components/page.tsx
git commit -m "feat(ui): shadcn's Field family replaces the hand-rolled one"
```

---

### Task 2: jsdom, per file and never global

**Files:**
- Modify: `apps/app/package.json` (devDependencies)
- Modify: `apps/app/src/components/evidence/evidence-card.test.tsx` (one existing test converted, as the proof)
- Modify: `pnpm-lock.yaml` (regenerated)

**Interfaces:**
- Produces: the ability to write `// @vitest-environment jsdom` at the top of a test file and use `@testing-library/react`'s `render`/`screen` and `@testing-library/user-event`.

- [ ] **Step 1: Record the baseline count before touching anything**

Run: `cd apps/app && pnpm vitest run 2>&1 | tail -3`
Write the number down. It is `995` as of 2026-08-28. A runner change that relocates a suite looks green and is not, so this number is the control.

- [ ] **Step 2: Install**

```bash
pnpm --filter @goproceed/app add -D jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 3: Convert ONE existing test as the proof, and leave the config alone**

`apps/app/vitest.config.ts` keeps its node default: a global `environment: "jsdom"` would move all 82 files, integration suites included, into a simulated DOM, and this config's `fileParallelism: false` is load-bearing against a shared Postgres.

At the very top of `apps/app/src/components/evidence/evidence-card.test.tsx`:

```ts
// @vitest-environment jsdom
```

Then add one case that the old `renderToStaticMarkup` approach could not express:

```tsx
import { render, screen } from "@testing-library/react";

it("renders the file name as the image's accessible name", () => {
  render(<EvidenceCard evidence={anEvidenceObject()} />);
  expect(screen.getByRole("img", { name: "приклад-фото-qa.jpg" })).toBeTruthy();
});
```

- [ ] **Step 4: Run that file**

Run: `cd apps/app && pnpm vitest run src/components/evidence/evidence-card.test.tsx`
Expected: PASS, with one more test than before.

- [ ] **Step 5: Prove nothing else moved**

Run: `cd apps/app && pnpm vitest run 2>&1 | tail -3`
Expected: `996` — the baseline plus exactly the one case added. Any other change in the number means a suite changed environment; stop and find out which.

- [ ] **Step 6: Prove the whole workspace still passes serialized**

Run (with the env prefix from Global Constraints): `pnpm turbo run test --concurrency=1 --continue 2>&1 | tail -20`
Expected: `@goproceed/app` green. `@goproceed/testing` and `@goproceed/landing` carry pre-existing failures from the 2026-08-27 landing merge (TODOS' landing-motion P2) — those are not yours; confirm the failure names match that entry and no new one appeared.

- [ ] **Step 7: Commit**

```bash
git add apps/app/package.json pnpm-lock.yaml apps/app/src/components/evidence/evidence-card.test.tsx
git commit -m "test(app): jsdom, opted into per file — with the count compared before and after"
```

---

### Task 3: `apiPost`

**Files:**
- Modify: `apps/app/src/lib/api.ts`
- Test: `apps/app/src/lib/api.test.ts` (exists — add to it)

**Interfaces:**
- Produces: `apiPost(path: string, body: unknown, idempotencyKey: string, fetchImpl?: FetchLike): Promise<Response>` and `export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>`.

This is a port of `apps/mobile/src/lib/api.ts:94`, which already carries the header set and has four tests. The differences from the mobile original, both deliberate: the office session is a cookie, so there is no `authHeader()`; and `fetchImpl` is injected the way `grants.service.ts` injects it, because that is how this codebase tests a write without a browser.

- [ ] **Step 1: Write the failing tests**

```ts
describe("apiPost", () => {
  it("sends the body, the content type and the idempotency key", async () => {
    let seen: RequestInit | undefined;
    const fake: FetchLike = async (_input, init) => { seen = init; return new Response("{}", { status: 201 }); };
    await apiPost("/v1/contracts/c1/assignments", { workItemId: "w1" }, "key-1", fake);
    expect(seen?.method).toBe("POST");
    const headers = seen?.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["Idempotency-Key"]).toBe("key-1");
    expect(seen?.body).toBe(JSON.stringify({ workItemId: "w1" }));
  });

  it("returns the response rather than throwing on a refusal", async () => {
    const fake: FetchLike = async () => new Response("{}", { status: 422 });
    const res = await apiPost("/v1/x", {}, "key-2", fake);
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/app && pnpm vitest run src/lib/api.test.ts -t apiPost`
Expected: FAIL — `apiPost is not a function`.

- [ ] **Step 3: Implement**

```ts
/** The shape this module needs from `fetch`. Real global `fetch` satisfies it, so does a fake. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * A command against `/v1` from the browser.
 *
 * PORTED from `apps/mobile/src/lib/api.ts:94`, which carries the same header
 * set and is covered by four tests there. Two deliberate differences: the
 * office session is a cookie, so there is no bearer header; and `fetchImpl` is
 * injectable, the way `grants.service.ts` injects it, because that is how a
 * write is tested here without a browser.
 *
 * It RETURNS the response rather than throwing on a non-2xx: the caller
 * distinguishes 401 from 422 from 409, and each has different copy.
 */
export async function apiPost(
  path: string,
  body: unknown,
  idempotencyKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  return fetchImpl(path, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/app && pnpm vitest run src/lib/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/api.ts apps/app/src/lib/api.test.ts
git commit -m "feat(app): apiPost — the office write helper, ported from the field client"
```

---

### Task 4: the two pure functions the form leans on

**Files:**
- Create: `apps/app/src/lib/problem-field-errors.ts`
- Create: `apps/app/src/lib/problem-field-errors.test.ts`
- Create: `apps/app/src/lib/submit-state.ts`
- Create: `apps/app/src/lib/submit-state.test.ts`

**Interfaces:**
- Produces: `fieldErrorsFrom(problem: unknown): Record<string, Array<{ message: string }>>` and `unmappedFrom(problem: unknown, known: readonly string[]): string[]`; `nextSubmitState(current: SubmitState, event: SubmitEvent): SubmitState` with `type SubmitState = "idle" | "submitting" | "created" | "failed"` and `type SubmitEvent = "submit" | "succeeded" | "failed" | "retry"`.

- [ ] **Step 1: Write the failing tests for the mapper**

The server's problem document carries `fieldErrors` as an array of `{ path, message }`; `path` uses dots (`items.1.qty`), pinned by `command.test.ts`.

```ts
import { describe, it, expect } from "vitest";
import { fieldErrorsFrom, unmappedFrom } from "./problem-field-errors";

describe("fieldErrorsFrom", () => {
  it("groups messages by their path", () => {
    const problem = { fieldErrors: [
      { path: "workItemId", message: "Оберіть рядок." },
      { path: "plannedQuantity", message: "Не число." },
    ] };
    expect(fieldErrorsFrom(problem)).toEqual({
      workItemId: [{ message: "Оберіть рядок." }],
      plannedQuantity: [{ message: "Не число." }],
    });
  });

  it("keeps both messages when one path fails twice", () => {
    const problem = { fieldErrors: [
      { path: "plannedQuantity", message: "Не число." },
      { path: "plannedQuantity", message: "Забагато знаків." },
    ] };
    expect(fieldErrorsFrom(problem).plannedQuantity).toHaveLength(2);
  });

  it("returns an empty map for a problem with no fieldErrors, and never throws", () => {
    expect(fieldErrorsFrom({})).toEqual({});
    expect(fieldErrorsFrom(null)).toEqual({});
    expect(fieldErrorsFrom("not a problem")).toEqual({});
  });
});

describe("unmappedFrom", () => {
  it("reports messages whose path is not a field on this form, so nothing vanishes", () => {
    const problem = { fieldErrors: [
      { path: "workItemId", message: "Оберіть рядок." },
      { path: "somethingElse", message: "Невідоме поле." },
    ] };
    expect(unmappedFrom(problem, ["workItemId", "plannedQuantity"])).toEqual(["Невідоме поле."]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/app && pnpm vitest run src/lib/problem-field-errors.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the mapper**

```ts
/**
 * A problem+json document's per-field errors, in the shape `FieldError` takes.
 *
 * The server emits `fieldErrors: [{ path, message }]` on every zod failure and
 * NOTHING in this product has ever read them — a 422 renders as one banner
 * today. `path` is dot-joined (`items.1.qty`), pinned by `command.test.ts`.
 *
 * It never throws. A refusal that cannot be parsed must still reach the user
 * through the banner, so every unexpected shape degrades to «no field errors»
 * rather than to an exception inside a submit handler.
 */
interface FieldErrorEntry { path: string; message: string }

function entriesOf(problem: unknown): FieldErrorEntry[] {
  if (!problem || typeof problem !== "object") return [];
  const raw = (problem as { fieldErrors?: unknown }).fieldErrors;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e) => {
    if (!e || typeof e !== "object") return [];
    const { path, message } = e as { path?: unknown; message?: unknown };
    if (typeof path !== "string" || typeof message !== "string") return [];
    return [{ path, message }];
  });
}

export function fieldErrorsFrom(problem: unknown): Record<string, Array<{ message: string }>> {
  const out: Record<string, Array<{ message: string }>> = {};
  for (const { path, message } of entriesOf(problem)) {
    (out[path] ??= []).push({ message });
  }
  return out;
}

/** Messages the form has no field for. They go to the banner, so none is lost. */
export function unmappedFrom(problem: unknown, known: readonly string[]): string[] {
  return entriesOf(problem).filter((e) => !known.includes(e.path)).map((e) => e.message);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/app && pnpm vitest run src/lib/problem-field-errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for the state machine**

```ts
import { describe, it, expect } from "vitest";
import { nextSubmitState } from "./submit-state";

describe("nextSubmitState", () => {
  it("goes idle → submitting on submit", () => {
    expect(nextSubmitState("idle", "submit")).toBe("submitting");
  });

  it("REFUSES a second submit while one is in flight — the double-press guard", () => {
    expect(nextSubmitState("submitting", "submit")).toBe("submitting");
  });

  it("settles to created or failed", () => {
    expect(nextSubmitState("submitting", "succeeded")).toBe("created");
    expect(nextSubmitState("submitting", "failed")).toBe("failed");
  });

  it("lets a failed attempt be retried, and a created one never resubmit", () => {
    expect(nextSubmitState("failed", "submit")).toBe("submitting");
    expect(nextSubmitState("created", "submit")).toBe("created");
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd apps/app && pnpm vitest run src/lib/submit-state.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 7: Implement the state machine**

```ts
/**
 * The submit lifecycle, as a value.
 *
 * Extracted so the re-entrancy guard is testable without a browser: «a second
 * press while the first is in flight must not fire a second request» is a
 * transition, and a transition can be asserted directly. The component holds
 * this in state and disables its control whenever the state is `submitting`;
 * the harness then proves the wiring against a real browser.
 *
 * `created` is terminal on purpose. The assignment exists; pressing again must
 * not send the same idempotency key at a body the server would treat as a
 * conflict.
 */
export type SubmitState = "idle" | "submitting" | "created" | "failed";
export type SubmitEvent = "submit" | "succeeded" | "failed" | "retry";

export function nextSubmitState(current: SubmitState, event: SubmitEvent): SubmitState {
  if (event === "submit" || event === "retry") {
    return current === "submitting" || current === "created" ? current : "submitting";
  }
  if (current !== "submitting") return current;
  return event === "succeeded" ? "created" : "failed";
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `cd apps/app && pnpm vitest run src/lib/submit-state.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/app/src/lib/problem-field-errors.ts apps/app/src/lib/problem-field-errors.test.ts \
  apps/app/src/lib/submit-state.ts apps/app/src/lib/submit-state.test.ts
git commit -m "feat(app): the field-error mapper and the submit guard, as pure functions"
```

---

### Task 5: `createAssignment` in the assignments service

**Files:**
- Modify: `apps/app/src/services/assignments.service.ts`
- Create: `apps/app/src/services/assignments.service.test.ts`

**Interfaces:**
- Consumes: `apiPost`, `FetchLike` (Task 3); `createAssignmentRequest` from `@goproceed/contracts`.
- Produces:
  ```ts
  export interface CreateAssignmentInput {
    contractId: string;
    workItemId: string;
    assigneeMemberId: string;
    plannedQuantity?: string | undefined;
    dueDate?: string | undefined;
  }
  export type CreateAssignmentResult =
    | { kind: "ok"; assignmentId: string }
    | { kind: "invalid" }
    | { kind: "session_expired" }
    | { kind: "refused"; status: number; problem: unknown; detail: string | null }
    | { kind: "error"; error: unknown };
  export async function createAssignment(
    input: CreateAssignmentInput, idempotencyKey: string, fetchImpl?: FetchLike,
  ): Promise<CreateAssignmentResult>;
  ```

The `refused` arm carries the whole `problem` and not just its `detail`, because Task 4's mapper needs `fieldErrors` — that is the difference from `issueReviewLink`'s otherwise identical shape.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createAssignment } from "./assignments.service";
import type { FetchLike } from "../lib/api";

const input = {
  contractId: "11111111-1111-4111-8111-111111111111",
  workItemId: "22222222-2222-4222-8222-222222222222",
  assigneeMemberId: "33333333-3333-4333-8333-333333333333",
};

describe("createAssignment", () => {
  it("refuses before the network when the contract rejects the body", async () => {
    let called = false;
    const fake: FetchLike = async () => { called = true; return new Response("{}", { status: 201 }); };
    const res = await createAssignment({ ...input, workItemId: "not-a-uuid" }, "k1", fake);
    expect(res.kind).toBe("invalid");
    expect(called).toBe(false);
  });

  it("posts to the contract's assignments route with the key it was given", async () => {
    let path = ""; let key = "";
    const fake: FetchLike = async (p, init) => {
      path = p; key = (init?.headers as Record<string, string>)["Idempotency-Key"];
      return new Response(JSON.stringify({ assignmentId: "a1" }), { status: 201 });
    };
    const res = await createAssignment(input, "k2", fake);
    expect(path).toBe(`/v1/contracts/${input.contractId}/assignments`);
    expect(key).toBe("k2");
    expect(res).toEqual({ kind: "ok", assignmentId: "a1" });
  });

  it("does NOT send the contractId in the body — it is the path", async () => {
    let body: unknown;
    const fake: FetchLike = async (_p, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ assignmentId: "a1" }), { status: 201 });
    };
    await createAssignment(input, "k3", fake);
    expect(body).not.toHaveProperty("contractId");
  });

  it("hands a 422 back whole, so the field errors survive", async () => {
    const problem = { detail: "Перевірте поля.", fieldErrors: [{ path: "workItemId", message: "Оберіть рядок." }] };
    const fake: FetchLike = async () => new Response(JSON.stringify(problem), { status: 422 });
    const res = await createAssignment(input, "k4", fake);
    expect(res.kind).toBe("refused");
    if (res.kind === "refused") {
      expect(res.status).toBe(422);
      expect(res.problem).toEqual(problem);
      expect(res.detail).toBe("Перевірте поля.");
    }
  });

  it("names an expired session for what it is", async () => {
    const fake: FetchLike = async () => new Response("{}", { status: 401 });
    expect((await createAssignment(input, "k5", fake)).kind).toBe("session_expired");
  });

  it("omits an absent optional rather than sending null", async () => {
    let body: Record<string, unknown> = {};
    const fake: FetchLike = async (_p, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ assignmentId: "a1" }), { status: 201 });
    };
    await createAssignment(input, "k6", fake);
    expect("plannedQuantity" in body).toBe(false);
    expect("dueDate" in body).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/app && pnpm vitest run src/services/assignments.service.test.ts`
Expected: FAIL — `createAssignment is not exported`.

- [ ] **Step 3: Implement**

Append to `apps/app/src/services/assignments.service.ts`:

```ts
import { createAssignmentRequest } from "@goproceed/contracts";
import { apiPost, type FetchLike } from "../lib/api";

export interface CreateAssignmentInput {
  contractId: string;
  workItemId: string;
  assigneeMemberId: string;
  plannedQuantity?: string | undefined;
  dueDate?: string | undefined;
}

export type CreateAssignmentResult =
  | { kind: "ok"; assignmentId: string }
  /** Refused by the contract itself, before the network. */
  | { kind: "invalid" }
  | { kind: "session_expired" }
  /**
   * Refused by the server. Carries the WHOLE problem document, unlike
   * `issueReviewLink`'s otherwise identical arm: `fieldErrors` is what puts a
   * message next to the field that caused it, and a `detail`-only arm would
   * throw that away at the one boundary that has it.
   */
  | { kind: "refused"; status: number; problem: unknown; detail: string | null }
  | { kind: "error"; error: unknown };

export async function createAssignment(
  input: CreateAssignmentInput,
  idempotencyKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<CreateAssignmentResult> {
  // An absent optional is OMITTED, never sent as null: `createAssignmentRequest`
  // marks these `.optional()`, and `.strict()` on the request would refuse a
  // null. Building the object conditionally is also what `exactOptionalPropertyTypes`
  // asks for at the type level.
  const body = {
    workItemId: input.workItemId,
    assigneeMemberId: input.assigneeMemberId,
    ...(input.plannedQuantity ? { plannedQuantity: input.plannedQuantity } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
  };

  const parsed = createAssignmentRequest.safeParse(body);
  if (!parsed.success) return { kind: "invalid" };

  let res: Response;
  try {
    res = await apiPost(
      `/v1/contracts/${input.contractId}/assignments`, parsed.data, idempotencyKey, fetchImpl,
    );
  } catch (error) {
    return { kind: "error", error };
  }

  if (res.status === 401) return { kind: "session_expired" };

  let problem: unknown = null;
  try { problem = await res.json(); } catch { /* not JSON; the banner copes */ }

  if (!res.ok) {
    const detail =
      problem && typeof problem === "object" && typeof (problem as { detail?: unknown }).detail === "string"
        ? (problem as { detail: string }).detail
        : null;
    return { kind: "refused", status: res.status, problem, detail };
  }

  const assignmentId =
    problem && typeof problem === "object" ? (problem as { assignmentId?: unknown }).assignmentId : undefined;
  if (typeof assignmentId !== "string" || assignmentId.length === 0) {
    return { kind: "error", error: "assignments.create returned no assignmentId" };
  }
  return { kind: "ok", assignmentId };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/app && pnpm vitest run src/services/assignments.service.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/services/assignments.service.ts apps/app/src/services/assignments.service.test.ts
git commit -m "feat(app): createAssignment — the office write, shaped like issueReviewLink"
```

---

### Task 6: the baseline read that feeds the pickers

**Files:**
- Create: `apps/app/src/services/baseline.service.ts`
- Create: `apps/app/src/services/baseline.service.test.ts`

**Interfaces:**
- Consumes: `apiGet`, `isSessionExpired` (`../lib/api`); `getBlockedValue` (`./blocked-value.service`).
- Produces:
  ```ts
  export interface BaselineOption {
    contractId: string; contractVersionId: string; contractVersionNo: number;
    workItems: Array<{ workItemId: string; workCode: string | null; description: string; unitCode: string }>;
  }
  export type BaselinesResult =
    | { kind: "ok"; baselines: BaselineOption[] }
    | { kind: "session_expired" }
    | { kind: "error"; error: unknown };
  export async function listPublishedBaselines(projectId: string): Promise<BaselinesResult>;
  ```

Two hops, both existing reads: `blocked_value.get` for the published baselines a project has (`byBaseline[]` carries `contractId`, `contractVersionId` and `contractVersionNo`), then `contract_versions.get` keyed by number for each one's `workItems[]`. Zero new API.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("./blocked-value.service", () => ({
  getBlockedValue: vi.fn(async () => ({
    kind: "ok",
    blockedValue: { byBaseline: [
      { contractId: "c1", contractVersionId: "v1", contractVersionNo: 2, totalsByCurrency: [], unvaluedAssignmentCount: 0 },
    ] },
  })),
}));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  apiGet: vi.fn(async () => ({ workItems: [
    { workItemId: "w1", workCode: "1.1", description: "Приклад-прокладання кабелю", unitCode: "м" },
  ] })),
}));

import { listPublishedBaselines } from "./baseline.service";
import { apiGet } from "../lib/api";

describe("listPublishedBaselines", () => {
  it("reads each baseline's lines by contract id and version NUMBER", async () => {
    const res = await listPublishedBaselines("p1");
    expect(apiGet).toHaveBeenCalledWith("/v1/contracts/c1/versions/2");
    expect(res).toEqual({ kind: "ok", baselines: [{
      contractId: "c1", contractVersionId: "v1", contractVersionNo: 2,
      workItems: [{ workItemId: "w1", workCode: "1.1", description: "Приклад-прокладання кабелю", unitCode: "м" }],
    }] });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/app && pnpm vitest run src/services/baseline.service.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

```ts
import type { ContractVersionView } from "@goproceed/contracts";
import { apiGet, isSessionExpired } from "../lib/api";
import { getBlockedValue } from "./blocked-value.service";

/**
 * The published baselines a project has, each with its lines — the two picker
 * sources the create form needs, assembled from reads that already ship.
 *
 * WHY THE MONEY READ. `blocked_value.get` is the only operation that returns a
 * project's contract versions at all: its `byBaseline[]` rows carry
 * `contractId`, `contractVersionId` AND `contractVersionNo`
 * (`packages/contracts/src/blocked-value.ts:144-149`). There is no
 * `contracts.list` and no `contract_versions.list`, and `contract_versions.get`
 * is keyed by NUMBER — which is exactly the field those rows supply. That is
 * why this slice needs no new API, and it is also why slice B exists: a
 * project with no published baseline has no row here, and nothing else can
 * enumerate its contracts.
 */
export interface BaselineOption {
  contractId: string;
  contractVersionId: string;
  contractVersionNo: number;
  workItems: Array<{
    workItemId: string; workCode: string | null; description: string; unitCode: string;
  }>;
}

export type BaselinesResult =
  | { kind: "ok"; baselines: BaselineOption[] }
  | { kind: "session_expired" }
  | { kind: "error"; error: unknown };

export async function listPublishedBaselines(projectId: string): Promise<BaselinesResult> {
  const money = await getBlockedValue(projectId);
  if (money.kind === "session_expired") return { kind: "session_expired" };
  if (money.kind !== "ok") return { kind: "error", error: money };

  try {
    const baselines = await Promise.all(
      money.blockedValue.byBaseline.map(async (row): Promise<BaselineOption> => {
        const version = await apiGet<ContractVersionView>(
          `/v1/contracts/${row.contractId}/versions/${row.contractVersionNo}`,
        );
        return {
          contractId: row.contractId,
          contractVersionId: row.contractVersionId,
          contractVersionNo: row.contractVersionNo,
          workItems: version.workItems.map((w) => ({
            workItemId: w.workItemId,
            workCode: w.workCode ?? null,
            description: w.description,
            unitCode: w.unitCode,
          })),
        };
      }),
    );
    return { kind: "ok", baselines };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    return { kind: "error", error };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/app && pnpm vitest run src/services/baseline.service.test.ts`
Expected: PASS.

Then run: `pnpm turbo run typecheck`
Expected: PASS. If `ContractVersionView`'s field names differ from those used above, read `packages/contracts/src/contract-versions.ts` and use its real names — do not cast.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/services/baseline.service.ts apps/app/src/services/baseline.service.test.ts
git commit -m "feat(app): the published baselines and their lines, from two existing reads"
```

---

### Task 7: the form

**Files:**
- Create: `apps/app/src/components/assignments/new-assignment-form.tsx`
- Create: `apps/app/src/components/assignments/new-assignment-form.test.tsx`

**Interfaces:**
- Consumes: `BaselineOption` (Task 6), `createAssignment`/`CreateAssignmentResult` (Task 5), `fieldErrorsFrom`/`unmappedFrom` (Task 4), `nextSubmitState` (Task 4), `Field`/`FieldLabel`/`FieldError`/`FieldDescription`/`FieldGroup` (Task 1), `Select…`, `Input`, `Button`, `Banner` from `@goproceed/ui/components`.
- Produces: `NewAssignmentForm({ projectId, baselines, members, currentMemberId })`.

The binding shape is the vendor's, from shadcn's current React Hook Form guide: `Controller` (not `FormField`), `data-invalid` on `Field`, `aria-invalid` on the control, `FieldError` fed an array.

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NewAssignmentForm } from "./new-assignment-form";

const baselines = [{
  contractId: "11111111-1111-4111-8111-111111111111",
  contractVersionId: "44444444-4444-4444-8444-444444444444",
  contractVersionNo: 1,
  workItems: [{
    workItemId: "22222222-2222-4222-8222-222222222222",
    workCode: "1.1", description: "Приклад-прокладання кабелю в штробі", unitCode: "м",
  }],
}];
const members = [{ memberId: "33333333-3333-4333-8333-333333333333", role: "owner" }];

describe("NewAssignmentForm", () => {
  it("refuses to submit with no line chosen, and does not call the service", async () => {
    const create = vi.fn();
    render(<NewAssignmentForm projectId="p1" baselines={baselines} members={members}
      currentMemberId={members[0].memberId} createImpl={create} />);
    await userEvent.click(screen.getByRole("button", { name: "Створити доручення" }));
    expect(create).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Оберіть рядок кошторису.");
  });

  it("puts a server field error next to the field the server named", async () => {
    const create = vi.fn(async () => ({
      kind: "refused", status: 422, detail: "Перевірте поля.",
      problem: { fieldErrors: [{ path: "plannedQuantity", message: "Забагато знаків після коми." }] },
    }));
    render(<NewAssignmentForm projectId="p1" baselines={baselines} members={members}
      currentMemberId={members[0].memberId} createImpl={create} initialWorkItemId={baselines[0].workItems[0].workItemId} />);
    await userEvent.click(screen.getByRole("button", { name: "Створити доручення" }));
    expect(await screen.findByText("Забагато знаків після коми.")).toBeTruthy();
  });

  it("does not fire a second request when the button is pressed twice", async () => {
    let resolve!: (v: unknown) => void;
    const create = vi.fn(() => new Promise((r) => { resolve = r as (v: unknown) => void; }));
    render(<NewAssignmentForm projectId="p1" baselines={baselines} members={members}
      currentMemberId={members[0].memberId} createImpl={create} initialWorkItemId={baselines[0].workItems[0].workItemId} />);
    const button = screen.getByRole("button", { name: "Створити доручення" });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(create).toHaveBeenCalledTimes(1);
    resolve({ kind: "ok", assignmentId: "a1" });
  });

  it("reuses ONE idempotency key across a retry, so a timeout cannot create two", async () => {
    const keys: string[] = [];
    const create = vi.fn(async (_input: unknown, key: string) => {
      keys.push(key);
      return keys.length === 1 ? { kind: "error", error: "network" } : { kind: "ok", assignmentId: "a1" };
    });
    render(<NewAssignmentForm projectId="p1" baselines={baselines} members={members}
      currentMemberId={members[0].memberId} createImpl={create} initialWorkItemId={baselines[0].workItems[0].workItemId} />);
    const button = screen.getByRole("button", { name: "Створити доручення" });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/app && pnpm vitest run src/components/assignments/new-assignment-form.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`createImpl` and `initialWorkItemId` are injection seams for the tests, exactly as `grants.service.ts` injects `fetchImpl`; the route passes neither.

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Banner, Button, Field, FieldDescription, FieldError, FieldGroup, FieldLabel,
  Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@goproceed/ui/components";

import { createAssignment, type CreateAssignmentResult } from "../../services/assignments.service";
import type { BaselineOption } from "../../services/baseline.service";
import { fieldErrorsFrom, unmappedFrom } from "../../lib/problem-field-errors";
import { nextSubmitState, type SubmitState } from "../../lib/submit-state";

/**
 * «Нове доручення» — the write foundation's first real screen.
 *
 * THE BINDING SHAPE IS THE VENDOR'S, not this repository's invention: shadcn's
 * current React Hook Form guide pairs `Controller` with the `Field` family,
 * puts `data-invalid` on `Field` and `aria-invalid` on the control, and feeds
 * `FieldError` an array. The array is also the shape the server's mapped
 * `fieldErrors` arrive in, so one component renders both sources.
 *
 * THE IDEMPOTENCY KEY IS MINTED ONCE PER FORM INSTANCE and reused across
 * retries. That is the whole point of the header: a request that timed out may
 * have been received, and a fresh key on the retry is how one press becomes
 * two доручення.
 */
const FORM_FIELDS = ["workItemId", "assigneeMemberId", "plannedQuantity", "dueDate"] as const;

const formSchema = z.object({
  workItemId: z.string().min(1, "Оберіть рядок кошторису."),
  assigneeMemberId: z.string().min(1, "Оберіть виконавця."),
  plannedQuantity: z.string().trim().regex(/^\d+(\.\d{1,6})?$/, "Вкажіть число, до шести знаків після коми.").or(z.literal("")),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Вкажіть дату.").or(z.literal("")),
});
type FormValues = z.infer<typeof formSchema>;

export interface MemberOption { memberId: string; role: string }

export function NewAssignmentForm({
  projectId, baselines, members, currentMemberId, createImpl = createAssignment, initialWorkItemId = "",
}: {
  projectId: string;
  baselines: BaselineOption[];
  members: MemberOption[];
  currentMemberId: string;
  createImpl?: (
    input: Parameters<typeof createAssignment>[0], key: string,
  ) => Promise<CreateAssignmentResult>;
  initialWorkItemId?: string;
}) {
  const router = useRouter();
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

  async function onSubmit(values: FormValues) {
    if (state === "submitting" || state === "created" || baseline === undefined) return;
    setState((s) => nextSubmitState(s, "submit"));
    setBanner(null);

    const result = await createImpl({
      contractId: baseline.contractId,
      workItemId: values.workItemId,
      assigneeMemberId: values.assigneeMemberId,
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
      const leftovers = unmappedFrom(result.problem, [...FORM_FIELDS]);
      setBanner(leftovers.length > 0 ? leftovers.join(" ") : result.detail ?? "Доручення не створено.");
      return;
    }
    setBanner("Доручення не створено. Перевірте з'єднання та спробуйте ще раз.");
  }

  if (baseline === undefined) return null;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {banner && <Banner tone="blocked" title="Доручення не створено">{banner}</Banner>}

        <Controller
          name="workItemId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="workItemId">Рядок кошторису</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="workItemId" aria-invalid={fieldState.invalid}>
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
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="assigneeMemberId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="assigneeMemberId">Виконавець</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="assigneeMemberId" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Оберіть виконавця" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.memberId} value={m.memberId}>
                      {m.memberId === currentMemberId
                        ? `${m.role} · ${m.memberId.slice(0, 8)} (ви)`
                        : `${m.role} · ${m.memberId.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Доручення без виконавця не потрапляє в «Мої доручення» на телефоні.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="plannedQuantity"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="plannedQuantity">
                Планова кількість, {baseline.workItems.find((w) => w.workItemId === form.watch("workItemId"))?.unitCode ?? "од."}
              </FieldLabel>
              <Input id="plannedQuantity" inputMode="decimal" aria-invalid={fieldState.invalid} {...field} />
              <FieldDescription>Необов'язково.</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="dueDate"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="dueDate">Строк</FieldLabel>
              <Input id="dueDate" type="date" aria-invalid={fieldState.invalid} {...field} />
              <FieldDescription>Необов'язково.</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Button type="submit" disabled={state === "submitting" || state === "created"}>
          {state === "submitting" ? "Створюємо доручення…" : "Створити доручення"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/app && pnpm vitest run src/components/assignments/new-assignment-form.test.tsx`
Expected: PASS, 4 tests. If `Banner`'s or `Select`'s prop names differ, read their source in `packages/ui/src/components/` and use the real ones — never cast.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/components/assignments/new-assignment-form.tsx \
  apps/app/src/components/assignments/new-assignment-form.test.tsx
git commit -m "feat(dash): the new-assignment form — Controller + Field, one key across retries"
```

---

### Task 8: the route, the register's link, and the copy rows

**Files:**
- Create: `apps/app/app/dash/projects/[projectId]/assignments/new/page.tsx`
- Create: `apps/app/src/components/assignments/no-baseline-empty-state.tsx`
- Modify: `apps/app/src/components/assignments/assignments-list.tsx`
- Modify: `technical/copy-catalog.csv`

**Interfaces:**
- Consumes: `listPublishedBaselines` (Task 6), `NewAssignmentForm` (Task 7), `getMeContext` (`../../services/workspaces.service`), `apiGet` for the members read.
- Produces: the route at `/dash/projects/{projectId}/assignments/new`.

- [ ] **Step 1: The empty state for a project with no published baseline**

This is the expected state of a fresh pilot project, not an error — slice C is what ends it.

```tsx
import { EmptyState } from "@goproceed/ui/components";

export function NoBaselineEmptyState() {
  return (
    <EmptyState
      title="У проєкті ще немає опублікованої версії договору"
      description="Доручення створюють на рядок кошторису, тому спершу потрібна опублікована версія договору з рядками."
    />
  );
}
```

- [ ] **Step 2: `listMembers` in the workspaces service**

The assignee picker needs members, and members are read per WORKSPACE while
this route has a PROJECT. Measured: `ProjectListRow` carries `workspaceId`
(`packages/contracts/src/projects.ts`), `GET /v1/workspaces/{workspaceId}/members`
returns `{ members: [{ memberId, userId, role, status }] }`, and
`meContextResponse` carries `userId` but **no member id** — so «who am I» is
resolved by matching that `userId` against the members list. All three are
existing reads.

Append to `apps/app/src/services/workspaces.service.ts`:

```ts
export interface MemberRow { memberId: string; userId: string; role: string; status: string }

export type MembersResult =
  | { kind: "ok"; members: MemberRow[] }
  | { kind: "session_expired" }
  | { kind: "error"; error: unknown };

/**
 * The workspace's members.
 *
 * NO NAME AND NO EMAIL, and that is the route's shape rather than an omission
 * here: `members.list` selects `id, user_id, role, status` and nothing else.
 * Every screen that shows a person therefore shows a role and an id fragment
 * until slice D4 settles what identity to display — see the spec's §5.
 */
export async function listMembers(workspaceId: string): Promise<MembersResult> {
  try {
    const { members } = await apiGet<{ members: MemberRow[] }>(
      `/v1/workspaces/${workspaceId}/members`,
    );
    return { kind: "ok", members };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    return { kind: "error", error };
  }
}
```

- [ ] **Step 3: The route**

```tsx
import { redirect } from "next/navigation";

import { listPublishedBaselines } from "../../../../../../src/services/baseline.service";
import { getMeContext } from "../../../../../../src/services/workspaces.service";
import { NewAssignmentForm } from "../../../../../../src/components/assignments/new-assignment-form";
import { NoBaselineEmptyState } from "../../../../../../src/components/assignments/no-baseline-empty-state";
import { ShellFatalError } from "../../../../../../src/components/dash-shell/shell-error";

/**
 * `/dash/projects/{projectId}/assignments/new` — Plan D slice A.
 *
 * THIN, like every sibling: resolve the params, call the services, render one
 * of three things. The session-expiry branch is re-checked here even though
 * `app/dash/layout.tsx` checked it once, for the reason the sibling routes
 * record: a soft navigation re-renders only this segment.
 */
type NewAssignmentPageProps = { params: Promise<{ projectId: string }> };

export default async function NewAssignmentPage({ params }: NewAssignmentPageProps) {
  const { projectId } = await params;
  const back = `/dash/projects/${projectId}/assignments/new`;

  // Three reads, and the order is forced: the members read is keyed by
  // WORKSPACE, and the only thing that maps this project to its workspace is
  // `projects.list`'s own `workspaceId` column.
  const [baselines, projects, me] = await Promise.all([
    listPublishedBaselines(projectId),
    listProjects(),
    getMeContext(),
  ]);

  if (baselines.kind === "session_expired" || projects.kind === "session_expired"
      || me.kind === "session_expired") {
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  if (baselines.kind === "error" || projects.kind !== "ok" || me.kind !== "ok") {
    return <ShellFatalError />;
  }

  const workspaceId = projects.projects.find((p) => p.projectId === projectId)?.workspaceId;
  if (workspaceId === undefined) return <ShellFatalError />;

  const members = await listMembers(workspaceId);
  if (members.kind === "session_expired") redirect(`/login?next=${encodeURIComponent(back)}`);
  if (members.kind !== "ok") return <ShellFatalError />;

  if (baselines.baselines.length === 0) return <NoBaselineEmptyState />;

  // «Who am I» is a JOIN the API does not do: meContext carries userId, the
  // members list carries userId → memberId, and no read carries both plus a
  // name. This is the spec's §5 in three lines.
  const active = members.members.filter((m) => m.status === "active");
  const currentMemberId =
    active.find((m) => m.userId === me.meContext.userId)?.memberId ?? "";

  return (
    <NewAssignmentForm
      projectId={projectId}
      baselines={baselines.baselines}
      members={active.map((m) => ({ memberId: m.memberId, role: m.role }))}
      currentMemberId={currentMemberId}
    />
  );
}
```

Imports this route needs, in addition to those already listed:
`listProjects` and `listMembers` from `../../../../../../src/services/workspaces.service`
(`listProjects` lives in `projects.service.ts` — import it from there).

- [ ] **Step 4: The register's link**

In `assignments-list.tsx`, above the table:

```tsx
<Button asChild>
  <Link href={`/dash/projects/${projectId}/assignments/new`}>Нове доручення</Link>
</Button>
```

`AssignmentsList` currently takes only `assignments`; add `projectId: string` to its props and pass it from `app/dash/projects/[projectId]/assignments/page.tsx`.

- [ ] **Step 5: The copy rows**

Append to `technical/copy-catalog.csv`, following `issue-review-link`'s six-row shape — a pending label, and one row per distinguishable refusal:

```csv
dash.assignment_create.heading,Нове доручення,dash,heading,new-assignment-form.tsx — the route's own heading
dash.assignment_create.submit,Створити доручення,dash,label,new-assignment-form.tsx — the submit control at rest
dash.assignment_create.pending,Створюємо доручення…,dash,label,new-assignment-form.tsx — the submit control in flight
dash.assignment_create.work_item_label,Рядок кошторису,dash,label,new-assignment-form.tsx — the line picker
dash.assignment_create.work_item_required,Оберіть рядок кошторису.,dash,error,new-assignment-form.tsx — client-side; the only required field
dash.assignment_create.assignee_label,Виконавець,dash,label,new-assignment-form.tsx — the assignee picker
dash.assignment_create.assignee_required,Оберіть виконавця.,dash,error,new-assignment-form.tsx — client-side
dash.assignment_create.assignee_hint,Доручення без виконавця не потрапляє в «Мої доручення» на телефоні.,dash,label,new-assignment-form.tsx — why the optional field is not optional in practice
dash.assignment_create.quantity_label,"Планова кількість, {од.}",dash,label,new-assignment-form.tsx — unit comes from the chosen line
dash.assignment_create.quantity_invalid,"Вкажіть число, до шести знаків після коми.",dash,error,new-assignment-form.tsx — client-side
dash.assignment_create.due_label,Строк,dash,label,new-assignment-form.tsx — optional
dash.assignment_create.optional,Необов'язково.,dash,label,new-assignment-form.tsx — description under the optional fields
dash.assignment_create.failed_title,Доручення не створено,dash,label,new-assignment-form.tsx — Banner title above any refusal
dash.assignment_create.failed_generic,Доручення не створено. Перевірте з'єднання та спробуйте ще раз.,dash,error,new-assignment-form.tsx — network failure
dash.assignment_create.no_baseline_title,У проєкті ще немає опублікованої версії договору,dash,empty,no-baseline-empty-state.tsx
dash.assignment_create.no_baseline_body,"Доручення створюють на рядок кошторису, тому спершу потрібна опублікована версія договору з рядками.",dash,empty,no-baseline-empty-state.tsx
dash.assignments.new_link,Нове доручення,dash,label,assignments-list.tsx — the register's create control
```

- [ ] **Step 6: Build and typecheck**

Run: `pnpm turbo run typecheck`
Expected: PASS.

Run: `pnpm --filter @goproceed/app build`
Expected: PASS, and the route list includes `/dash/projects/[projectId]/assignments/new`.

- [ ] **Step 7: Commit**

```bash
git add "apps/app/app/dash/projects/[projectId]/assignments/new/page.tsx" \
  apps/app/src/components/assignments/no-baseline-empty-state.tsx \
  apps/app/src/components/assignments/assignments-list.tsx \
  "apps/app/app/dash/projects/[projectId]/assignments/page.tsx" \
  technical/copy-catalog.csv
git commit -m "feat(dash): the new-assignment route, the register's link, and its copy rows"
```

---

### Task 9: proof — integration, the browser audit, and the gate

**Files:**
- Create: `apps/app/tests/assignment-creation.int.test.ts`
- Modify: `apps/app/qa/field.mjs`

**Interfaces:**
- Consumes: `baselineFixture`, `q`, `jsonReq` (`./helpers/fixtures`), the manual-baseline helpers.

- [ ] **Step 1: The integration test — the body the form builds is a body the route accepts**

The form's own tests use a fake `fetch`; this is what proves the shape against the real route and the real database.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq, baselineFixture } from "./helpers/fixtures";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

beforeEach(async () => { await truncateAll(); current = A; });

describe("the body the create form builds is one assignments.create accepts", () => {
  it("creates an assignment and materialises its obligations", async () => {
    // Reuse the published-baseline fixture rather than re-typing the chain:
    // `materialisation-end-to-end.int.test.ts`'s `typedBaseline` walks rule
    // publish → draft → typed line → bind → publish and is the shortest path
    // to a work item that materialises. Import it there rather than copying.
    const fx = await baselineFixture(A);
    // …build a published baseline with one typed line (see that file), then:
    const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
    const res = await POST(
      jsonReq("http://x", { workItemId: fx.workItemId, assigneeMemberId: fx.memberId }),
      { params: Promise.resolve({ contractId: fx.contractId }) },
    );
    expect(res.status, await res.clone().text()).toBe(201);
    const { assignmentId } = await res.json();

    const occurrences = await q<{ n: number }>(
      `select count(*)::int as n from public.requirement_occurrences
        where workspace_id = $1 and work_assignment_id = $2`, [fx.workspaceId, assignmentId]);
    expect(occurrences[0]!.n).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it**

Run (with the env prefix): `cd apps/app && pnpm vitest run tests/assignment-creation.int.test.ts`
Expected: PASS. A 403 means the fixture's grant list lacks `assignments.manage` — add it, do not widen the route.

- [ ] **Step 3: The browser audit**

In `apps/app/qa/field.mjs`, add `"assignment creation"` to the expected-audits list, and the audit itself beside the register's. It must assert three things: the form renders, one submit creates exactly one assignment, and a double press creates exactly one.

```js
await runAudit(ctx, "assignment creation", async () => {
  await withPage(browser, async (page) => {
    await page.goto(`${server.baseUrl}/dash/projects/${projectId}/assignments/new`,
      { waitUntil: "networkidle0" });
    const before = await countAssignments(projectId);

    await page.select("#workItemId", workItemId);
    // TWO PRESSES, deliberately: the guard is a claim about a real browser,
    // and the pure state machine cannot prove the button was actually disabled.
    const submit = await page.$("button[type=submit]");
    await submit.click();
    await submit.click().catch(() => {});
    await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});

    const after = await countAssignments(projectId);
    if (after !== before + 1) {
      ctx.findings.push(`assignment creation: expected exactly one new assignment, got ${after - before}`);
    }
  });
});
```

`countAssignments` queries the database through the harness's existing SQL helper — read how the register audit seeds and counts, and follow it.

- [ ] **Step 4: Run the harness**

Run (with the env prefix): `cd apps/app && pnpm build && pnpm qa`
Expected: `QA passed: 8 of 8 expected audits ran … zero findings`.

- [ ] **Step 5: The §5 gate, in order, output pasted**

```bash
node packages/testing/qa/motion-audit.mjs
pnpm --filter @goproceed/testing test
pnpm turbo run typecheck
pnpm --filter @goproceed/landing build
```

`motion-audit` and the contract suite carry the pre-existing landing failures (TODOS' landing-motion P2). Confirm the failing names are exactly those and that nothing new joined them. Skip step 1 of the gate — `tokens.json` is untouched by this slice.

- [ ] **Step 6: The §6 visual pass**

Six widths — `1920 · 1440 · 1240 · 768 · 390 · 360` — with real Ukrainian strings, then reduced motion on and reload. Check: nothing overflows, the submit control keeps its 44px target at 390, and the error state is legible with colour removed.

- [ ] **Step 7: Commit**

```bash
git add apps/app/tests/assignment-creation.int.test.ts apps/app/qa/field.mjs
git commit -m "test(dash): the create path proved end to end, and twice-pressed once"
```

---

## Self-review

**Spec coverage.** §2's «no new API» — Tasks 5, 6, 8 use only existing reads and the existing write. §3's field table — Task 7 implements `workItemId`, `assigneeMemberId`, `plannedQuantity`, `dueDate` and omits `locationId`/`performerPartyId`. §4's five foundation pieces — `apiPost` (Task 3), the key in a `useRef` (Task 7), the state machine (Task 4), `fieldErrors` (Tasks 4 + 7), `router.refresh()` (Task 7). §4's Field family — Task 1. §5's assignee problem — Task 7's picker and its `FieldDescription`. §6's states — Task 7 (refusals) and Task 8 (no baseline, session expiry, fatal). §7's copy — Task 8. §8's testing — Tasks 2, 4, 5, 6, 7, 9. §10's blast radius — Task 1 (the migration), Task 2 (the count), Task 8 (the register link).

**Placeholders.** One deliberate ellipsis remains, in Task 9 Step 1: the published-baseline setup points at `materialisation-end-to-end.int.test.ts`'s `typedBaseline` rather than re-typing forty lines of fixture. That is a pointer to real code in this repository, not a TBD.

**Type consistency.** `FetchLike` is defined in Task 3 and consumed in Task 5. `CreateAssignmentInput`/`CreateAssignmentResult` are defined in Task 5 and consumed in Task 7. `BaselineOption` is defined in Task 6 and consumed in Tasks 7 and 8. `SubmitState`/`nextSubmitState` and `fieldErrorsFrom`/`unmappedFrom` are defined in Task 4 and consumed in Task 7. `Field`/`FieldError` are produced in Task 1 and consumed in Task 7. `FORM_FIELDS` is the single source of the field-name list used by both `setError` and `unmappedFrom`.

**Two things the self-review measured rather than deferred.** The first draft of Task 8 read members off `getMeContext()`; that result carries `{ userId, memberships[] }` and **no member id**, so the task as written was unimplementable. It now resolves the chain that actually exists — `projects.list` carries `workspaceId`, `members.list` carries `userId → memberId`, and `meContext.userId` is the join key — and Task 8 gained a `listMembers` step for it. `EmptyState({title, description})` and `Banner({tone, title, children})` were checked against their sources, and `blocked` is a real `Banner` tone.

**One soft spot left, and it says read rather than cast:** `ContractVersionView`'s field names in Task 6. If they differ from `workItemId`/`workCode`/`description`/`unitCode`, read `packages/contracts/src/contract-versions.ts` and use the real ones.

**A note for whoever executes this in the shared checkout:** a second effort (the Telegram project channel) was being committed into `/Users/akisliy/Downloads/GoProceed` on 2026-08-28 and has already modified `packages/contracts/src/projects.ts`, `capabilities.csv`, `scope-v0.1.csv` and `authz.ts`. This plan's branch, `claude/d3-decisions`, is based on the clean commit `aa8f412` and is checked out in its own worktree for that reason. Verify what your tree holds before trusting a line number.
