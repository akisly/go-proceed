"use client";

/**
 * The component inventory, live.
 *
 * Fifteen components, each next to the ruling it carries. This is where the QA
 * harness points its viewport, contrast and touch-target passes: a component
 * only ever exercised inside a finished screen is a component nobody can check
 * in isolation.
 *
 * EVERY CLASS NAME IS A LITERAL. Tailwind v4 finds candidates by scanning
 * source text, so `bg-${tone}` produces no CSS at all — the scanner sees the
 * template literal, not the class, and the element renders unstyled with
 * nothing warning.
 */

import { useState } from "react";
import {
  Accordion, Banner, Button, Chip, EmptyState, Field, Figure, Input, Textarea,
  Meter, Panel, PanelHeader, PanelBody, Separator, Skeleton,
  Table, Th, Td, Tr, Tooltip, TooltipProvider,
  type AccordionEntry, type MeterSegment,
} from "@goproceed/ui/components";
import { CountUp } from "@goproceed/ui/motion";

const uah = (n: number) =>
  new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(Math.round(n));

const SEGMENTS: MeterSegment[] = [
  { id: "ready", label: "Готово", count: 14, tone: "ready" },
  { id: "attention", label: "Під ризиком", count: 5, tone: "attention" },
  { id: "blocked", label: "Заблоковано", count: 3, tone: "blocked" },
  { id: "review", label: "На розгляді", count: 2, tone: "review" },
  { id: "idle", label: "Не розпочато", count: 8, tone: "idle" },
];

const FAQ: AccordionEntry[] = [
  { id: "gate", question: "Ви блокуєте роботу на майданчику?", answer: "Ні. Жодна програма не зупинить бригаду. Ми не даємо пред’явити роботу до оплати без доказів — це різні речі, і друга формулюється саме так." },
  { id: "evidence", question: "Що вважається доказом?", answer: "Те, що прив’язане до одиниці роботи до її початку: фото, вимірювання, акт прихованих робіт, підпис відповідального." },
  { id: "kep", question: "Це КЕП?", answer: "Ні. Зовнішнє рішення фіксує конкретну версію пакета і прямо зазначає, що це не КЕП." },
];

const ROWS = [
  { id: "1", scope: "Секція А · підвал · електрощитова ВРУ-1", planned: 620, done: 620, tone: "ready" as const, state: "Внутрішньо готово" },
  { id: "2", scope: "Секція Б · 3 поверх · стяжка", planned: 180, done: 150, tone: "blocked" as const, state: "Немає доказів" },
  { id: "3", scope: "Секція В · покрівля · пароізоляція", planned: 340, done: 340, tone: "attention" as const, state: "Під ризиком" },
];

function Case({ n, name, rule, children }: {
  n: string; name: string; rule: string; children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line py-14">
      <p className="index-label">{n} · {name}</p>
      <p className="measure mt-2 text-data text-ink-muted">{rule}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function ComponentSink() {
  const [value, setValue] = useState("620");
  const invalid = Number.isNaN(Number(value)) || value.trim() === "";

  return (
    <TooltipProvider>
      <main className="mx-auto max-w-content px-6 md:px-12">
        <header className="py-24">
          <p className="index-label">Kitchen sink · components</p>
          <h1 className="display mt-4 max-w-[18ch] text-mkt-display-1 text-ink">
            П’ятнадцять компонентів і причина кожного
          </h1>
          <p className="measure mt-6 text-mkt-lead leading-relaxed text-ink-muted">
            Список короткий навмисне: невикористаний варіант — перше, що поїде.
            Діалоги, меню й форми приходять із екранами, яким вони потрібні.
          </p>
        </header>

        <Case n="01" name="Button" rule="П’ять варіантів, набір закритий. Немає destructive: під /app/** нічого не видаляється, тож він міг би бути використаний лише помилково. Сигнальна дія — рівно одна на екран.">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Первинна</Button>
            <Button variant="signal">Сигнальна</Button>
            <Button variant="outline">Робоча конячка</Button>
            <Button variant="ghost">Хром</Button>
            <Button variant="link">Всередині речення</Button>
            <Button variant="outline" size="sm">Малий</Button>
            <Button variant="outline" disabled>Вимкнено</Button>
          </div>
        </Case>

        <Case n="02" name="Chip" rule="Підпис несе значення, тон лише підфарбовує. Сім станів каталогу — п’ять візуальних тонів. neutral — це надзаголовок, а не стан.">
          <div className="flex flex-wrap gap-2">
            <Chip tone="ready">Готово</Chip>
            <Chip tone="attention">Під ризиком</Chip>
            <Chip tone="blocked">Заблоковано</Chip>
            <Chip tone="review">На розгляді</Chip>
            <Chip tone="idle">Не розпочато</Chip>
            <Chip tone="neutral">v0.1 · пілот</Chip>
            <Chip tone="idle" interactive>Фільтр — це контрол</Chip>
          </div>
        </Case>

        <Case n="03" name="Panel" rule="Єдина контентна поверхня: біле на папері, 1px бордер, жодної тіні. Усе, що читається «над сторінкою», — це хром, а хром тут не контент.">
          <Panel>
            <PanelHeader title="Реєстр робіт" count={32} actions={<Button variant="outline" size="sm">Експорт</Button>} />
            <PanelBody>
              <p className="text-data text-ink-muted">Структура — це бордер і крок світлоти, а не драбина тіней.</p>
            </PanelBody>
          </Panel>
        </Case>

        <Case n="04" name="Table" rule="Справжня таблиця з table-fixed. Числові колонки праворуч і табличними цифрами: 620/620 і 180/150 різняться формою, коли їхні цифри мають спільний правий край.">
          <Panel>
            <Table>
              <thead>
                <tr>
                  <Th>Обсяг</Th>
                  <Th numeric>Заплановано</Th>
                  <Th numeric>Зафіксовано</Th>
                  <Th>Стан</Th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <Tr key={r.id}>
                    <Td>{r.scope}</Td>
                    <Td numeric>{r.planned}</Td>
                    <Td numeric>{r.done}</Td>
                    <Td><Chip tone={r.tone}>{r.state}</Chip></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </Case>

        <Case n="05" name="Figure" rule="Три важелі одночасно: надзаголовок, цифра, знаменник. Кваліфікатор обов’язковий — це юридична позиція, а не копірайт: гроші, чиїх доказів зараз немає, а не гроші, які точно не заплатять.">
          <Figure
            eyebrow="Гроші без доказів"
            value={<CountUp value={1240800} format={uah} />}
            denominator="₴ із 4 820 000 ₴"
            qualifier="Це сума, докази для якої зараз відсутні. Вона не означає, що оплату буде відмовлено."
          />
        </Case>

        <Case n="06" name="Meter" rule="Сегменти беруть flex-grow: count, ніколи відсотки — частини не можуть не скластися у ціле. Смуга aria-hidden і не несе інформації: кожен стан названо в легенді.">
          <Meter segments={SEGMENTS} />
        </Case>

        <Case n="07" name="Field + Input + Textarea" rule="Уся a11y-обв’язка написана один раз: label, description і error зшиті через aria-describedby, aria-invalid береться з наявності помилки. Помилка ніколи не є лише кольором.">
          <div className="grid max-w-xl gap-5">
            <Field
              label="Зафіксований обсяг"
              description="Одиниці — за позицією кошторису"
              required
              error={invalid ? "Введіть число" : undefined}
            >
              {({ id, describedBy, invalid: bad }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={bad}
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </Field>
            <Field label="Коментар до відмови" description="Побачить технагляд">
              {({ id, describedBy }) => (
                <Textarea id={id} aria-describedby={describedBy} placeholder="Що саме не підтверджено" />
              )}
            </Field>
          </div>
        </Case>

        <Case n="08" name="Banner" rule="Це не тост. Не з’являється, не зникає сам і не плаває: те, що треба мати змогу перечитати, не повинно вміти зникати. role=status, а не alert — відмова, яку користувач щойно спричинив, не є перебиванням.">
          <div className="grid gap-3">
            <Banner tone="blocked" title="Закриття етапу відмовлено">
              Для позиції «Секція Б · стяжка» немає доказу, який вимагається до приховування робіт.
            </Banner>
            <Banner tone="attention" title="Вікно доказу спливає за 2 дні" />
          </div>
        </Case>

        <Case n="09" name="Accordion" rule="Єдиний виняток із заборони анімувати layout: grid-template-rows 0fr→1fr не вимагає вимірювання. Аудит знає про цей виняток поіменно, тож він видимий, а не проліз крізь дірку в регулярці.">
          <Accordion entries={FAQ} className="max-w-2xl" />
        </Case>

        <Case n="10" name="Tooltip + Separator" rule="Тултип заслуговує місце рівно в одній ситуації — іконкова рейка 768–1240px. Порталований контент несе font-sans сам, бо портал виходить із базового шару. Separator через Radix, щоб decorative було рішенням, а не випадковістю.">
          <div className="flex items-center gap-4">
            <Tooltip label="Реєстр робіт" side="bottom">
              <Button variant="ghost" size="icon" aria-label="Реєстр робіт">▤</Button>
            </Tooltip>
            <Separator orientation="vertical" className="h-8" />
            <Tooltip label="Докази" side="bottom">
              <Button variant="ghost" size="icon" aria-label="Докази">◫</Button>
            </Tooltip>
          </div>
          <Separator className="mt-6" />
        </Case>

        <Case n="11" name="EmptyState + Skeleton" rule="«Немає даних» — це знизування плечима. Порожній реєстр під час закриття періоду — це або «нічого не записано», або «все відфільтровано», і це протилежні відповіді. Скелетон не мерехтить: вічна анімація в системі рівно одна.">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel>
              <EmptyState
                title="Жодного рядка не показано"
                description="Активний фільтр «Заблоковано» ховає 29 рядків із 32."
                action={<Button variant="outline" size="sm">Скинути фільтр</Button>}
              />
            </Panel>
            <Panel>
              <PanelBody className="flex flex-col gap-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </PanelBody>
            </Panel>
          </div>
        </Case>

        <div className="border-t border-line py-14">
          <Button variant="link" asChild>
            <a href="/kitchen-sink">← До motion-примітивів</a>
          </Button>
        </div>
      </main>
    </TooltipProvider>
  );
}
