const UAH = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Full money form for tables (doc 05 §5). Tabular numerals come from the CSS. */
// eslint-disable-next-line react-refresh/only-export-components -- tests/unrecoverable.test.ts and UnrecoverableNote.tsx import this function directly from the money component (see task interface contract).
export function formatUah(value: number): string {
  return `${UAH.format(value)} ₴`
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
          form is abbreviated (doc 05 §5). */}
      <b aria-label={formatUah(value)}>{formatUah(value)}</b>
      {denominator ? <span>{denominator}</span> : null}
    </div>
  )
}
