export default function FinancialRail({ compact = false }) {
  const items = [
    { label: 'Договір', value: '18,4 млн', width: 100, tone: 'muted' },
    { label: 'Виконано', value: '3,4 млн', width: 82, tone: 'dark' },
    { label: 'Готово', value: '2,65 млн', width: 64, tone: 'signal' },
    { label: 'Подано', value: '2,18 млн', width: 53, tone: 'blue' },
    { label: 'Оплачено', value: '1,94 млн', width: 47, tone: 'ink' },
  ]
  return (
    <div className={`financial-rail ${compact ? 'financial-rail--compact' : ''}`}>
      {items.map((item) => <div className="financial-rail__row" key={item.label}>
        <span>{item.label}</span>
        <div className="financial-rail__track"><i className={`rail-${item.tone}`} style={{ width: `${item.width}%` }} /></div>
        <b>{item.value}</b>
      </div>)}
    </div>
  )
}
