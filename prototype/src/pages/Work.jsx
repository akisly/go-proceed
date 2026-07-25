import { useMemo, useState } from 'react'
import { Check, Download, ListFilter, Plus, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Status from '../components/Status'
import useDialogA11y from '../components/useDialogA11y'
import { formatMoney, workItems } from '../data'

export default function Work() {
  const [params] = useSearchParams()
  const [filter, setFilter] = useState('Усі')
  const [search, setSearch] = useState(params.get('q') || '')
  const [selected, setSelected] = useState([])
  const [createOpen, setCreateOpen] = useState(params.get('new') === '1')
  const [createdItem, setCreatedItem] = useState(null)
  const [created, setCreated] = useState(false)
  const [exported, setExported] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dueSoonOnly, setDueSoonOnly] = useState(false)
  const [bulkReceipt, setBulkReceipt] = useState(null)
  const dialogRef = useDialogA11y(createOpen, () => setCreateOpen(false))
  const sourceItems = useMemo(() => createdItem ? [createdItem, ...workItems] : workItems, [createdItem])
  const items = useMemo(() => sourceItems.filter(x => (filter === 'Усі' || (filter === 'Під ризиком' && x.state === 'risk') || (filter === 'Готово' && x.state === 'ready')) && (!dueSoonOnly || x.due === '31.07' || x.due === 'сьогодні') && (x.name+x.id).toLowerCase().includes(search.toLowerCase())), [filter, search, sourceItems, dueSoonOnly])
  const toggle = (id) => { setSelected(v => v.includes(id) ? v.filter(x=>x!==id) : [...v,id]); setBulkReceipt(null) }
  const allVisibleSelected = items.length > 0 && items.every(item => selected.includes(item.id))
  const createWork = (event) => {
    event.preventDefault()
    setCreatedItem({ id: 'EL-16.03', name: 'Маркування кабельних ліній', location: 'Секція B', performed: 0, ready: 0, state: 'risk', issue: 'Очікує виконання', owner: 'Не призначено', due: '31.07' })
    setCreated(true)
  }
  return <AppShell title="Реєстр робіт" eyebrow="БЦ Horizon" action={<button className="button button--dark button--small" onClick={() => { setCreateOpen(true); setCreated(false) }}><Plus size={16}/> Додати роботу</button>}>
    <div className="page-content"><section className="page-intro"><div><h2>{createdItem ? '429' : '428'} позицій · 3 400 000 ₴ виконано</h2><p>Договір EL-HR-24 · версія 4 · оновлено 18.06.2026</p></div><span className="toolbar-updated">{exported && <span className="toolbar-receipt">EXP-WORK-42 · CSV готово</span>} <button className="button button--outline button--small" onClick={() => setExported(true)}><Download size={16}/> Експорт</button></span></section><div className="filter-bar"><div className="segmented">{['Усі','Під ризиком','Готово'].map(x=><button key={x} onClick={()=>setFilter(x)} aria-pressed={filter===x} className={filter===x?'active':''}>{x}{x==='Під ризиком'&&<span>9</span>}</button>)}</div><label className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Код або назва" aria-label="Пошук роботи за кодом або назвою"/></label><span className="table-tools"><button className="icon-button" aria-expanded={filtersOpen} aria-label="Розширені фільтри робіт" onClick={() => setFiltersOpen(value => !value)}><ListFilter size={18}/></button>{filtersOpen && <div className="dashboard-filter-menu"><span>ШВИДКИЙ ФІЛЬТР</span><button aria-pressed={dueSoonOnly} onClick={() => { setDueSoonOnly(true); setFiltersOpen(false) }}>Термін до 31.07</button><button onClick={() => { setDueSoonOnly(false); setFiltersOpen(false) }}>Без обмеження терміну</button></div>}</span></div><section className="panel full-work-table"><div className="work-table work-table--select"><div className="work-table__head"><span><input type="checkbox" aria-label="Обрати всі видимі роботи" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? selected.filter(id => !items.some(item => item.id === id)) : [...new Set([...selected, ...items.map(item => item.id)])])}/></span><span>Робота</span><span>Виконано</span><span>Готово</span><span>Стан доказів</span><span>Відповідальний</span><span>Термін</span></div>{items.map(item=><div className={`work-row ${selected.includes(item.id)?'selected':''}`} key={item.id}><span><input type="checkbox" aria-label={`Обрати ${item.id} ${item.name}`} checked={selected.includes(item.id)} onChange={()=>toggle(item.id)}/></span><span><small>{item.id} · {item.location}</small><b>{item.name}</b></span><span>{formatMoney(item.performed)}</span><span>{formatMoney(item.ready)}</span><span><Status tone={item.state}>{item.issue}</Status></span><span>{item.owner}</span><span>{item.due}</span></div>)}</div></section>{selected.length>0&&<div className="selection-bar" aria-live="polite"><b>Обрано: {selected.length}</b><span>{formatMoney(sourceItems.filter(x=>selected.includes(x.id)).reduce((s,x)=>s+x.performed,0))}</span>{bulkReceipt && <span className="toolbar-receipt">{bulkReceipt}</span>}<button onClick={() => setBulkReceipt(`ASG-BULK-2207 · ${selected.length} робіт передано в планувальник`)}>Призначити</button><button onClick={() => setBulkReceipt(`PKG-DRAFT-07 · ${selected.length} робіт додано до чернетки пакета`)}>Додати до пакета</button><button onClick={()=>{ setSelected([]); setBulkReceipt(null) }}>Скасувати</button></div>}</div>
    {createOpen && <div className="modal-layer"><button className="drawer__backdrop" onClick={() => setCreateOpen(false)} aria-label="Закрити створення роботи"/><section ref={dialogRef} className="invite-dialog" role="dialog" aria-modal="true" aria-labelledby="create-work-title">{created ? <div className="payment-recorded" aria-live="polite"><span className="success-mark synced"><Check size={36}/></span><h2 id="create-work-title">Роботу додано</h2><p>EL-16.03 створено в contract version 4. Позиція ще не має виконаного обсягу й відповідального.</p><button className="button button--dark button--full" onClick={() => setCreateOpen(false)}>Відкрити в реєстрі</button></div> : <form onSubmit={createWork}><h2 id="create-work-title">Додати позицію договору</h2><p>Для масового додавання використовуйте versioned import. Тут створюється одна audit-visible позиція.</p><label>Код<input required defaultValue="EL-16.03"/></label><label>Назва<input required defaultValue="Маркування кабельних ліній"/></label><label>Локація<select defaultValue="section-b"><option value="section-b">Секція B</option><option value="section-a">Секція A</option></select></label><label>Одиниця<select defaultValue="m"><option value="m">м</option><option value="unit">шт.</option><option value="set">комплект</option></select></label><button className="button button--dark button--full">Створити з аудитом</button></form>}</section></div>}
  </AppShell>
}
