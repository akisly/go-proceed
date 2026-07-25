import { useMemo, useState } from 'react'
import { ArrowUpRight, CalendarDays, Download, ListFilter, MoveRight, Plus, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import FinancialRail from '../components/FinancialRail'
import Status from '../components/Status'
import useDialogA11y from '../components/useDialogA11y'
import { formatMoney, workItems } from '../data'

export default function Dashboard() {
  const period = 'Червень 2026'
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [requested, setRequested] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exported, setExported] = useState(false)
  const navigate = useNavigate()
  const drawerRef = useDialogA11y(Boolean(selected), () => setSelected(null))
  const filtered = useMemo(() => workItems.filter(item => (item.name + item.id).toLowerCase().includes(query.toLowerCase())), [query])
  const kpis = [
    ['Виконано', '3 400 000 ₴', '+12% до травня', 'neutral'],
    ['Готово до подання', '2 650 000 ₴', '78% виконаного', 'ready'],
    ['Під ризиком', '750 000 ₴', '9 робіт', 'risk'],
    ['Прострочено до оплати', '240 000 ₴', '12 днів', 'overdue'],
  ]
  return <AppShell title="Контроль готовності до оплати" eyebrow="БЦ Horizon" action={<button className="button button--dark button--small" onClick={() => navigate('/app/work?new=1')}><Plus size={16}/> Додати роботу</button>}>
    <div className="dashboard-toolbar"><div><span className="select-button select-button--static">БЦ Horizon</span><span className="select-button select-button--static"><CalendarDays size={16}/>{period}</span></div><div className="toolbar-updated">{exported ? <span className="toolbar-receipt">EXP-DASH-41 · готово</span> : 'Оновлено 2 хв тому'} <button className="icon-button" aria-label="Експорт" onClick={() => setExported(true)}><Download size={18}/></button></div></div>
    <div className="dashboard-content">
      <section className="kpi-grid">{kpis.map(([label,value,note,tone]) => <article className={`kpi kpi--${tone}`} key={label}><div><span>{label}</span><ArrowUpRight size={18}/></div><strong>{value}</strong><small>{note}</small></article>)}</section>
      <section className="dashboard-grid">
        <article className="panel money-panel"><div className="panel-title"><div><span>ФІНАНСОВИЙ ПОТІК</span><h2>Від договору до оплати</h2></div><button className="quiet-button" onClick={() => navigate('/app/payments')}>Детальний звіт <ArrowUpRight size={15}/></button></div><FinancialRail/><div className="money-panel__foot"><p><i/> 750 000 ₴ виконаного ще не готові перейти до подання.</p><b>Найбільший блокер: фото до закриття</b></div></article>
        <aside className="attention-panel"><div className="panel-title"><div><span>ПОТРЕБУЄ УВАГИ</span><h2>Дії на сьогодні</h2></div><b>7</b></div><div className="attention-list"><button onClick={() => setSelected(workItems[0])}><span className="attention-icon risk">!</span><div><b>2 роботи закриють конструкцією</b><small>Потрібні фото до 17:00 · 482 400 ₴</small></div><MoveRight size={17}/></button><button onClick={() => navigate('/app/evidence')}><span className="attention-icon review">3</span><div><b>Очікують вашої перевірки</b><small>Найстаріша — 19 годин</small></div><MoveRight size={17}/></button><button onClick={() => navigate('/app/payments')}><span className="attention-icon overdue">₴</span><div><b>Оплата прострочена</b><small>ТОВ «Horizon» · 240 000 ₴</small></div><MoveRight size={17}/></button></div><button className="attention-all" onClick={() => navigate('/app/work')}>Відкрити всі 7 дій</button></aside>
      </section>
      <section className="panel risk-table-panel"><div className="panel-title"><div><span>РОБОТИ ПІД РИЗИКОМ</span><h2>Що блокує найбільше грошей</h2></div><div className="table-tools"><label className="search-box"><Search size={16}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Знайти роботу" aria-label="Знайти роботу під ризиком"/></label><button className="icon-button" aria-expanded={filtersOpen} aria-label="Розширені фільтри робіт" onClick={() => setFiltersOpen(value => !value)}><ListFilter size={18}/></button>{filtersOpen && <div className="dashboard-filter-menu"><span>ШВИДКИЙ ФІЛЬТР</span><button onClick={() => { setQuery('кабел'); setFiltersOpen(false) }}>Кабельні роботи</button><button onClick={() => { setQuery(''); setFiltersOpen(false) }}>Усі роботи під ризиком</button></div>}</div></div><div className="work-table"><div className="work-table__head"><span>Робота</span><span>Локація</span><span>Виконано</span><span>Готово</span><span>Блокер</span><span>Термін</span></div>{filtered.slice(0,5).map(item => <button className="work-row" key={item.id} onClick={() => setSelected(item)}><span><small>{item.id}</small><b>{item.name}</b></span><span>{item.location}</span><span>{formatMoney(item.performed)}</span><span>{formatMoney(item.ready)}</span><span><Status tone={item.state}>{item.issue}</Status></span><span>{item.due}</span></button>)}</div></section>
    </div>
    {selected && <div className="drawer"><button className="drawer__backdrop" onClick={() => setSelected(null)} aria-label="Закрити картку роботи"/><aside ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="work-drawer-title"><header><div><small>{selected.id}</small><h2 id="work-drawer-title">{selected.name}</h2></div><button className="icon-button" onClick={()=>setSelected(null)} aria-label="Закрити картку роботи"><X size={18}/></button></header><div className="drawer-money"><div><span>Виконано</span><b>{formatMoney(selected.performed)}</b></div><div><span>Під ризиком</span><b>{formatMoney(selected.performed-selected.ready)}</b></div></div><h3>Готовність доказів</h3><div className="check-list"><p className="done"><i>✓</i><span><b>Обсяг підтверджено</b><small>648 м · С. Коваль</small></span></p><p className="missing"><i>!</i><span><b>{selected.issue}</b><small>Додайте до закриття конструкції</small></span></p><p className="done"><i>✓</i><span><b>Локацію вказано</b><small>{selected.location}</small></span></p></div>{requested === selected.id && <div className="security-copy" aria-live="polite"><span><b>REQ-{selected.id.replace('.', '')}</b> створено. Блокер лишається активним до server receipt доказу.</span></div>}<button className="button button--signal button--full" disabled={requested === selected.id} onClick={() => setRequested(selected.id)}>{requested === selected.id ? 'Запит надіслано' : 'Запросити доказ'}</button><button className="button button--outline button--full" onClick={() => navigate(`/app/work?q=${selected.id}`)}>Відкрити картку роботи</button></aside></div>}
  </AppShell>
}
