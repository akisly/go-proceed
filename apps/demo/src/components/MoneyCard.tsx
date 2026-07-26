const UAH = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const UAH_MILLIONS = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Full money form for tables (doc 05 §5). Tabular numerals come from the CSS. */
// eslint-disable-next-line react-refresh/only-export-components -- tests/unrecoverable.test.ts and UnrecoverableNote.tsx import this function directly from the money component (see task interface contract).
export function formatUah(value: number): string {
  return `${UAH.format(value)} ₴`
}

/**
 * Task 15 controller RULING 5: the brief's <768px compact row showed a
 * fixture figure («2,65 млн ₴») that does not exist in this dataset — the
 * real project total is ₴1,732,300 (src/data/project.ts). This formatter
 * derives its output from whatever value it is actually given rather than
 * ever rendering a hard-coded figure, so it produces «1,73 млн ₴» for that
 * total today and would track any future change to the dataset without
 * edits here.
 *
 * Below the million threshold, `formatUah`'s own output is already short
 * enough to read on a narrow screen (e.g. «455 400,00 ₴»), so there is
 * nothing this function should abbreviate further — abbreviating into a
 * thousands form as well was considered and rejected: it would add a
 * second, undocumented switching point beyond the one the controller
 * ruling actually calls for, for a gain the brief never asked for.
 * `formatUah` itself always stays reachable through `MoneyCard`'s
 * `aria-label` (below), so assistive tech never sees the abbreviated form.
 */
// eslint-disable-next-line react-refresh/only-export-components -- exported for the same interface-contract reason as formatUah (see tests/format-compact.test.ts).
export function formatUahCompact(value: number): string {
  if (Math.abs(value) < 1_000_000) return formatUah(value)
  return `${UAH_MILLIONS.format(value / 1_000_000)} млн ₴`
}

export default function MoneyCard({ label, value, denominator }: {
  label: string
  value: number
  denominator?: string
}) {
  return (
    <div className="money-card">
      <small>{label}</small>
      {/* The exact value always reaches assistive tech even when the visual
          form is abbreviated (doc 05 §5) — aria-label on the wrapping
          element replaces its accessible name entirely, so it wins over
          whichever of the two child spans CSS is currently showing
          (RULING 5, task 15 controller ruling: <768px switches to the
          compact form, ≥768px keeps the full form — see .money-card__full /
          .money-card__compact in styles/demo.css). */}
      <b aria-label={formatUah(value)} data-money>
        <span className="money-card__full">{formatUah(value)}</span>
        <span className="money-card__compact">{formatUahCompact(value)}</span>
      </b>
      {denominator ? <span>{denominator}</span> : null}
    </div>
  )
}
