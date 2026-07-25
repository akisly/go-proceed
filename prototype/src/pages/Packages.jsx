import { FileCheck2, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Status from '../components/Status'
import useDialogA11y from '../components/useDialogA11y'
import { packages } from '../data'

export default function Packages(){
  const [filter, setFilter] = useState('Усі')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState(null)
  const dialogRef = useDialogA11y(Boolean(detail), () => setDetail(null))
  const visiblePackages = useMemo(() => packages.filter(pack => {
    const matchesQuery = `${pack.version} ${pack.project} ${pack.period}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'Усі'
      || (filter === 'Готові' && pack.status.includes('Готово'))
      || (filter === 'Подані' && pack.status.includes('Подано'))
      || (filter === 'Прийняті' && pack.status.includes('Прийнято'))
    return matchesQuery && matchesFilter
  }), [filter, query])
  return <AppShell title="Пакети та подання" eyebrow="Усі об’єкти" action={<Link className="button button--dark button--small" to="/app/close"><Plus size={16}/> Закрити період</Link>}><div className="page-content"><section className="package-summary"><div><span>Готово до подання</span><strong>2 650 000 ₴</strong><small>1 пакет</small></div><div><span>Очікує рішення</span><strong>1 420 000 ₴</strong><small>6 днів у замовника</small></div><div><span>Прийнято цього місяця</span><strong>3 140 000 ₴</strong><small>2 пакети</small></div></section><div className="filter-bar"><div className="segmented">{['Усі','Готові','Подані','Прийняті'].map(option => <button key={option} aria-pressed={filter===option} className={filter===option ? 'active' : ''} onClick={() => setFilter(option)}>{option}</button>)}</div><label className="search-box"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Знайти пакет" aria-label="Знайти пакет за версією, об’єктом або періодом"/></label></div><section className="package-list" aria-live="polite">{visiblePackages.map(pack => <article key={pack.version}><span className={`package-icon package-icon--${pack.tone}`}><FileCheck2 size={22}/></span><div className="package-name"><small>{pack.project} · {pack.period}</small><b>{pack.version}</b></div><strong>{pack.amount}</strong><Status tone={pack.tone}>{pack.status}</Status><span>{pack.updated}</span>{pack.version === packages[0].version ? <Link className="button button--outline button--small" to="/app/packages/current">Відкрити</Link> : <button className="button button--outline button--small" onClick={() => setDetail(pack)}>Деталі</button>}</article>)}{visiblePackages.length === 0 && <p className="filter-empty">За цим фільтром пакетів немає. Змініть статус або пошук.</p>}</section></div>
    {detail && <div className="modal-layer"><button className="drawer__backdrop" onClick={() => setDetail(null)} aria-label="Закрити деталі пакета"/><section ref={dialogRef} className="invite-dialog" role="dialog" aria-modal="true" aria-labelledby="package-detail-title"><header style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}><div><small>{detail.project} · {detail.period}</small><h2 id="package-detail-title">{detail.version}</h2></div><button className="icon-button" onClick={() => setDetail(null)} aria-label="Закрити деталі пакета"><X size={18}/></button></header><div className="role-preview"><b>Сума:</b><span>{detail.amount}</span><b>Стан:</b><span>{detail.status}</span><b>Оновлено:</b><span>{detail.updated}</span></div><p>Це поданий/архівний snapshot: склад, manifest і рішення незмінні. Порівняння версій та повторне подання створюють нову версію пакета.</p><button className="button button--dark button--full" onClick={() => setDetail(null)}>Закрити</button></section></div>}
  </AppShell>
}
