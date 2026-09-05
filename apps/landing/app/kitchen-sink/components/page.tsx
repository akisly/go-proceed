"use client";

/**
 * The component inventory, live.
 *
 * Each case sits next to the ruling it carries. This is where the QA
 * harness points its viewport, contrast and touch-target passes: a component
 * only ever exercised inside a finished screen is a component nobody can check
 * in isolation.
 *
 * EVERY CLASS NAME IS A LITERAL. Tailwind v4 finds candidates by scanning
 * source text, so `bg-${tone}` produces no CSS at all — the scanner sees the
 * template literal, not the class, and the element renders unstyled with
 * nothing warning.
 */

import { useId, useState } from "react";
import {
  Accordion, Banner, Button, Checkbox, Chip, DataTable, EmptyState,
  Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel,
  FieldLegend, FieldSeparator, FieldSet, FieldTitle, Figure,
  Input, Label, Textarea,
  Meter, Panel, PanelHeader, PanelBody, Separator, Skeleton,
  Avatar, AvatarFallback,
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
  Pill, PillContent, SectionRule,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Tooltip, TooltipProvider,
  type AccordionEntry, type DataTableColumnDef, type MeterSegment,
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

/**
 * The same three rows, described as DATA rather than as markup — which is the
 * whole difference the DataTable case below exists to show. The widths and the
 * numeric ruling ride on `meta`, where a fifth column cannot be added without
 * the percentages visibly failing to sum.
 */
const SINK_COLUMNS: DataTableColumnDef<(typeof ROWS)[number]>[] = [
  { id: "scope", header: "Обсяг", meta: { className: "w-2/5" }, cell: ({ row }) => row.original.scope },
  { id: "planned", header: "Заплановано", meta: { className: "w-1/5", numeric: true }, cell: ({ row }) => row.original.planned },
  { id: "done", header: "Зафіксовано", meta: { className: "w-1/5", numeric: true }, cell: ({ row }) => row.original.done },
  { id: "state", header: "Стан", meta: { className: "w-1/5" }, cell: ({ row }) => <Chip tone={row.original.tone}>{row.original.state}</Chip> },
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
  const fixedFieldId = useId();
  const fixedDescriptionId = useId();
  const fixedErrorId = useId();
  const commentFieldId = useId();
  const commentDescriptionId = useId();
  const acceptedFieldId = useId();
  const acceptedDescriptionId = useId();
  const partialFieldId = useId();
  const partialDescriptionId = useId();

  return (
    <TooltipProvider>
      <main className="mx-auto max-w-content px-6 md:px-12">
        <header className="py-24">
          <p className="index-label">Kitchen sink · components</p>
          <h1 className="display mt-4 max-w-[18ch] text-mkt-display-1 text-ink">
            Компоненти й причина кожного
          </h1>
          <p className="measure mt-6 text-mkt-lead leading-relaxed text-ink-muted">
            Список короткий навмисне: невикористаний варіант — перше, що поїде.
            Примітиви, взяті з shadcn/ui, названі у своїх файлах разом із ліцензією.
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
            <Button size="lg">Маркетинговий</Button>
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
            <Chip tone="review" dot>на розгляді</Chip>
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

        <Case n="04" name="Table" rule="Примітиви — один в один із shadcn/ui, стилі — ролі цієї системи. Справжня таблиця з table-fixed. Числові колонки праворуч і табличними цифрами: 620/620 і 180/150 різняться формою, коли їхні цифри мають спільний правий край.">
          <Panel>
            {/* `min-w-160` (640px) IS THE PRODUCT'S OWN MEASURED FLOOR, not a
              * decoration on a demo. Under `table-fixed` a column does not
              * widen to fit its content, so at 390px each `w-1/5` cell is
              * ~68px while «ЗАПЛАНОВАНО» needs 118 — an eleven-character
              * uppercase word with no break opportunity, which overflows into
              * its neighbour rather than wrapping. That defect shipped once on
              * `/dash/projects/{id}/assignments` and `apps/app/qa/field.mjs`
              * now measures it per `th`. The kitchen sink demonstrates the
              * ruling or it teaches the defect. */}
            <Table className="min-w-160">
              <TableHeader>
                <TableRow>
                  <TableHead>Обсяг</TableHead>
                  <TableHead numeric>Заплановано</TableHead>
                  <TableHead numeric>Зафіксовано</TableHead>
                  <TableHead>Стан</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROWS.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.scope}</TableCell>
                    <TableCell numeric>{r.planned}</TableCell>
                    <TableCell numeric>{r.done}</TableCell>
                    <TableCell><Chip tone={r.tone}>{r.state}</Chip></TableCell>
                  </TableRow>
                ))}
              </TableBody>
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

        <Case n="07" name="Field + Input + Textarea" rule="Примітив узятий у shadcn один в один: він презентаційний, a11y-обв’язку — id, aria-describedby, aria-invalid — тепер збирає викликач, а не render prop. Помилка ніколи не є лише кольором: FieldError несе ✕ перед текстом.">
          <div className="grid max-w-xl gap-5">
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor={fixedFieldId}>Зафіксований обсяг</FieldLabel>
              <Input
                id={fixedFieldId}
                aria-invalid={invalid}
                aria-describedby={
                  [fixedDescriptionId, invalid ? fixedErrorId : undefined].filter(Boolean).join(" ")
                  || undefined
                }
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <FieldDescription id={fixedDescriptionId}>Одиниці — за позицією кошторису</FieldDescription>
              {invalid && <FieldError id={fixedErrorId} errors={[{ message: "Введіть число" }]} />}
            </Field>
            <Field>
              <FieldLabel htmlFor={commentFieldId}>Коментар до відмови</FieldLabel>
              <Textarea
                id={commentFieldId}
                aria-describedby={commentDescriptionId}
                placeholder="Що саме не підтверджено"
              />
              <FieldDescription id={commentDescriptionId}>Побачить технагляд</FieldDescription>
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
          <p className="index-label mt-8">marker="plus"</p>
          <Accordion entries={FAQ} marker="plus" className="max-w-2xl" />
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

        <Case n="12" name="DataTable" rule="Одна поведінка таблиці на весь продукт: колонки описані даними, а не розміткою. Ширини й «числова колонка» їдуть у column.meta, тож п’ята колонка не з’явиться так, щоб ніхто не помітив, що відсотки більше не складаються. Сортування підключене, але вимкнене за замовчуванням — вмикає його екран, у якого є вимір ширини на 390px.">
          <Panel>
            <DataTable columns={SINK_COLUMNS} data={ROWS} className="min-w-160" empty="Немає рядків." />
          </Panel>
        </Case>

        <Case n="13" name="Label + Checkbox + Select" rule="Три контролі, яких бракувало першій справжній формі. Жоден із них не малює власне кільце фокуса — воно одне на весь продукт і живе в base.css. Checkbox поки НЕ дотягує до 44px на дотик: це записано в TODOS.md, а не приховано тут.">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="sink-checkbox" />
              <Label htmlFor="sink-checkbox">Показати лише заблоковані</Label>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sink-select">Одиниця виміру</Label>
              <Select>
                <SelectTrigger id="sink-select" className="w-64">
                  <SelectValue placeholder="Оберіть одиницю" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m2">м² — квадратний метр</SelectItem>
                  <SelectItem value="m3">м³ — кубічний метр</SelectItem>
                  <SelectItem value="mp">м. п. — метр погонний</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Case>

        <Case n="14" name="FieldSet + FieldLegend + FieldGroup + FieldSeparator + FieldContent + FieldTitle" rule="Решта родини Field, яку ніщо не малювало. Компонент, який ніде не відрендерено, — це компонент, на який ніхто не дивився: саме так FieldSeparator приїхав із bg-canvas там, де таблиця замін вимагає bg-surface, і це стало видно лише тут. FieldTitle, а не FieldLabel, над фактом без контрола: мітка, якій нема що позначати, бреше зчитувачу екрана.">
          <Panel>
            <PanelBody>
              <FieldSet>
                <FieldLegend>Приймання роботи</FieldLegend>
                <FieldGroup>
                  {/* A FACT, NOT A CONTROL — so `FieldTitle`, never
                    * `FieldLabel`. `htmlFor` would have nothing to point at,
                    * and a `<label>` with no control is announced as one
                    * anyway. This is the same pair `new-assignment-form.tsx`
                    * renders for a single published кошторис. */}
                  <Field>
                    <FieldTitle>Позиція кошторису</FieldTitle>
                    <p className="text-data text-ink">1.1 · Приклад-улаштування стяжки · м²</p>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor={acceptedFieldId}>Прийнятий обсяг</FieldLabel>
                    <Input
                      id={acceptedFieldId}
                      aria-describedby={acceptedDescriptionId}
                      inputMode="decimal"
                      defaultValue="180"
                    />
                    <FieldDescription id={acceptedDescriptionId}>
                      Одиниці — за позицією кошторису
                    </FieldDescription>
                  </Field>

                  {/* THE SEPARATOR SITS ON A PANEL, WHICH IS WHY ITS TOKEN
                    * MATTERS. The label punches a hole in the rule behind it
                    * by painting what is BEHIND that rule — `bg-surface`
                    * here, the panel's own colour. With `bg-canvas` (the page
                    * ground, one layer further back) it draws a
                    * paper-coloured band across a white panel. */}
                  <FieldSeparator>або</FieldSeparator>

                  <Field orientation="horizontal">
                    <Checkbox id={partialFieldId} aria-describedby={partialDescriptionId} />
                    <FieldContent>
                      <FieldLabel htmlFor={partialFieldId}>Прийнято частково</FieldLabel>
                      <FieldDescription id={partialDescriptionId}>
                        Решту повертають виконавцю; до оплати рахується лише прийняте.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </PanelBody>
          </Panel>
        </Case>

        <Case n="15" name="Dialog + DialogTrigger + DialogContent + DialogHeader + DialogTitle + DialogDescription + DialogFooter + DialogClose" rule="Єдине під /app, чому дозволено накривати вміст, — тому shadow-modal носить саме він і більше ніхто. Родина працювала у трьох екранах оболонки, але не була відрендерена тут жодного разу: рівно так FieldSeparator приїхав із чужим токеном і ніхто не подивився.">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Завершити зміну</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Завершити зміну?</DialogTitle>
                <DialogDescription>
                  Незакриті приписи залишаться на об&apos;єкті до наступної зміни.
                  Секція А · підвал · електрощитова ВРУ-1 — 3 позиції.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Скасувати</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Завершити</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Case>

        <Case n="16" name="DropdownMenu + DropdownMenuTrigger + DropdownMenuContent + DropdownMenuLabel + DropdownMenuItem + DropdownMenuSeparator" rule="Хром рівня поповера, а не модалка: shadow-overlay, один крок від батька, — той самий, що вже носить Tooltip. Різниця з Dialog вище видно лише поруч, і саме тому обидва стоять на одній сторінці.">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Об&apos;єкт-простір</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Простори</DropdownMenuLabel>
              <DropdownMenuItem>ТОВ «Приклад-Власна»</DropdownMenuItem>
              <DropdownMenuItem>ЖК «Лівобережний», черга 2</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Налаштування профілю</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Case>

        <Case n="17" name="Avatar + AvatarFallback" rule="Лише ініціали. Джерела зображень у продукті ще немає, тому AvatarImage свідомо відсутній — компонент під майбутнє джерело це і є пастка «сорока умоглядних компонентів», про яку попереджає шапка index.ts. Ініціали передає той, хто викликає.">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>ОК</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-data text-ink">Олена Ковальчук</span>
              <span className="text-meta text-ink-muted">Технічний нагляд</span>
            </div>
          </div>
        </Case>

        <Case n="18" name="Pill" rule="Анонс над hero (21st.dev Announcement): тёмний бейдж, рядок і стрілка, що зсувається при наведенні. Одна фраза, одне посилання; як посилання — через asChild, ніколи div з onClick.">
          <Pill asChild>
            <a href="#pilot"><PillContent badge="Безкоштовний пілот">для субпідрядників із прихованими роботами</PillContent></a>
          </Pill>
        </Case>

        <Case n="19" name="SectionRule" rule="Нумерована лінія між розділами: волосяна лінія та моно-підпис на тлі паперу. Декоративна, aria-hidden — заголовок розділу несе секція, що йде далі.">
          <div className="py-6"><SectionRule index="01" label="Проблема" /></div>
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
