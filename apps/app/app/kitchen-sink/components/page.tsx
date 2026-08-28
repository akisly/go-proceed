"use client";

/**
 * apps/app's own kitchen-sink entry for the component inventory.
 *
 * apps/app had none of these before this slice — only apps/landing did
 * (`apps/landing/app/kitchen-sink/components/page.tsx`), which is the
 * marketing surface's inventory and stays on the marketing type scale.
 * `docs/design/02-building-ui.md` §3.3 draws the line apps/app must not
 * cross: no `mkt-*` scale, no `radius-card`/`surface`/`section`, no
 * `shadow-float`. This page uses the product scale only — `text-h1`,
 * `text-data`, `text-meta` — starting with the family this slice ships,
 * per §7.2: a component, its export, and its kitchen-sink entry land
 * together.
 */

import {
  Field, FieldDescription, FieldError, FieldGroup, FieldLabel, Input,
} from "@goproceed/ui/components";

function Case({ n, name, rule, children }: {
  n: string; name: string; rule: string; children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line py-10">
      <p className="text-meta font-medium text-ink-muted">{n} · {name}</p>
      <p className="mt-2 max-w-measure text-data text-ink-muted">{rule}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function ComponentSink() {
  return (
    <main className="mx-auto max-w-content px-6 md:px-12">
      <header className="py-16">
        <h1 className="text-h1 font-semibold text-ink">Компоненти й причина кожного</h1>
      </header>

      <Case
        n="01"
        name="Field family"
        rule="Примітив узятий у shadcn один в один: він презентаційний, a11y-обв'язку — id, aria-describedby, aria-invalid — збирає викликач, а не render prop. Помилка ніколи не є лише кольором: FieldError несе ✕ перед текстом."
      >
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
      </Case>
    </main>
  );
}
