import { useMemo, useState } from 'react'
import { ArrowRight, Check, Clock3, FileLock2, Paperclip, RotateCcw, Search, ShieldAlert, UploadCloud } from 'lucide-react'
import AppShell from '../components/AppShell'
import Status from '../components/Status'

const captures = [
  { id: 'CAP-742', code: 'EL-04.17', name: 'Прокладання кабелю ВВГнг 5×16', place: 'Секція B · 4 поверх', author: 'С. Коваль', age: '19 хв', amount: '204 400 ₴', state: 'review', warning: 'Фото 2 має слабке освітлення' },
  { id: 'CAP-739', code: 'EL-09.05', name: 'Аварійні світильники', place: 'Паркінг · P2', author: 'С. Коваль', age: '1 год', amount: '35 900 ₴', state: 'review', warning: 'Усі вимоги виконано' },
  { id: 'CAP-731', code: 'EL-11.08', name: 'Встановлення щита ЩР-12', place: 'Секція C · 7 поверх', author: 'М. Литвин', age: '4 год', amount: '98 000 ₴', state: 'risk', warning: 'Немає виконавчої схеми' },
]

export default function Evidence() {
  const [activeId, setActiveId] = useState(captures[0].id)
  const [query, setQuery] = useState('')
  const [decision, setDecision] = useState(null)
  const [reason, setReason] = useState('Недостатньо видно трасу та кріплення')
  const [correctionStage, setCorrectionStage] = useState(null)
  const [replacementAdded, setReplacementAdded] = useState(false)
  const active = captures.find(item => item.id === activeId)
  const filtered = useMemo(() => captures.filter(item => `${item.code} ${item.name}`.toLowerCase().includes(query.toLowerCase())), [query])
  const reviewStatus = correctionStage === 'approved'
    ? { tone: 'ready', label: 'Схвалено · R2' }
    : correctionStage === 'submitted'
      ? { tone: 'review', label: 'R2 очікує рішення' }
      : decision?.type === 'returned'
        ? { tone: 'risk', label: 'Повернено' }
        : decision?.type === 'approved'
          ? { tone: 'ready', label: 'Схвалено' }
          : { tone: 'review', label: 'Очікує рішення' }

  return <AppShell title="Перевірка доказів" eyebrow="БЦ Horizon · Внутрішня черга">
    <div className="review-page">
      <aside className="review-queue"><div className="review-search"><label className="search-box"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Робота або код" aria-label="Пошук роботи або коду"/></label><span>{filtered.length} очікують</span></div>{filtered.map(item => <button key={item.id} className={activeId === item.id ? 'active' : ''} onClick={() => { setActiveId(item.id); setDecision(null); setCorrectionStage(null); setReplacementAdded(false) }}><div><small>{item.code} · {item.age}</small><b>{item.name}</b><span>{item.place}</span></div><Status tone={item.state}>{item.amount}</Status></button>)}</aside>
      <main className="evidence-inspector">
        <header><div><small>{active.id} · надіслав {active.author}</small><h2>{active.name}</h2><p>{active.place} · 48 м · {active.amount}</p></div><Status tone={reviewStatus.tone}>{reviewStatus.label}</Status></header>
        <section className="evidence-media">
          <figure>
            <img src="/assets/evidence-atlas/cable-tray-evidence.png" alt="Загальний вигляд прокладеної кабельної траси" />
            <figcaption><span>01 · ОРИГІНАЛ</span><b>Фото маршруту</b><small>hash 6f2a…91c0 · 22.07.2026 18:42</small></figcaption>
          </figure>
          <figure className="evidence-media--warning">
            <img src="/assets/evidence-atlas/cable-tray-evidence.png" alt="Кріплення кабельної траси крупним планом" />
            <figcaption><span>02 · ПОТРЕБУЄ УВАГИ</span><b>Кріплення крупним планом</b><small>Попередження: слабке світло</small></figcaption>
          </figure>
        </section>
        <section className="review-context"><div><small>ВПЛИВ НА ГОТОВНІСТЬ</small><strong>{active.amount}</strong><span>перейде в «готово» після схвалення</span></div><div className="review-checks"><p className="done"><Check size={16}/> Обсяг 48 м у межах залишку</p><p className="done"><Check size={16}/> Локація відповідає завданню</p><p className={active.state === 'risk' ? 'warn' : 'done'}><ShieldAlert size={16}/> {active.warning}</p></div></section>
        {decision ? <section className={`decision-receipt decision-receipt--${decision.type}`} role="status" aria-live="polite"><span>{decision.type === 'approved' ? <Check/> : <RotateCcw/>}</span><div><small>РІШЕННЯ ЗБЕРЕЖЕНО · RVW-2207-84</small><h3>{decision.type === 'approved' ? 'Докази схвалено' : 'Повернено на виправлення'}</h3><p>{decision.type === 'approved' ? 'Readiness буде перераховано. Рішення можна змінити лише новим записом.' : decision.reason}</p></div>{decision.type === 'returned' && !correctionStage ? <button className="button button--dark button--small" onClick={() => setCorrectionStage('draft')}>Відкрити виправлення <ArrowRight size={15}/></button> : !correctionStage && <button className="quiet-button" onClick={() => setDecision(null)}>Нове рішення</button>}</section> : <section className="decision-panel"><label>Причина повернення<select value={reason} onChange={(event) => setReason(event.target.value)}><option>Недостатньо видно трасу та кріплення</option><option>Невірна локація</option><option>Обсяг потребує уточнення</option><option>Потрібен інший документ</option></select></label><div><button className="button button--outline" onClick={() => { setDecision({type: 'returned', reason}); setCorrectionStage(null) }}><RotateCcw size={16}/> Повернути</button><button className="button button--signal" onClick={() => setDecision({type: 'approved'})}><Check size={17}/> Схвалити доказ</button></div><small><Clock3 size={14}/> Рішення незмінне; виправлення створить новий запис.</small></section>}

        {correctionStage === 'draft' && <section className="correction-workspace" aria-labelledby="correction-title">
          <header><div><small>ЗАВДАННЯ FIX-742-01 · ВИКОНАВЕЦЬ С. КОВАЛЬ</small><h3 id="correction-title">Нова ревізія CAP-742-R2</h3><p>Причина: {decision.reason}</p></div><Status tone="review">Чернетка</Status></header>
          <div className="revision-lineage"><FileLock2 size={18}/><div><b>CAP-742 · оригінал незмінний</b><span>RVW-2207-84 → FIX-742-01 → CAP-742-R2</span></div></div>
          <div className="correction-fields"><label>Виконаний обсяг<input defaultValue="48" inputMode="decimal"/><span>м · зміна створить окрему quantity correction</span></label><button className={`replacement-upload ${replacementAdded ? 'is-added' : ''}`} onClick={() => setReplacementAdded(true)}><UploadCloud size={22}/><span><b>{replacementAdded ? '2 нові оригінали додано' : 'Додати нові фото'}</b><small>{replacementAdded ? 'hash a8d1…77bf · старі файли збережені' : 'Потрібні маршрут і кріплення крупним планом'}</small></span></button></div>
          <footer><p><Paperclip size={15}/> Повторна відправка не перезаписує CAP-742 або рішення RVW-2207-84.</p><button className="button button--dark" disabled={!replacementAdded} onClick={() => setCorrectionStage('submitted')}>Надіслати CAP-742-R2 <ArrowRight size={16}/></button></footer>
        </section>}

        {correctionStage === 'submitted' && <section className="correction-receipt" role="status" aria-live="polite"><span><Check size={21}/></span><div><small>СЕРВЕРНИЙ RECEIPT · RCP-742-R2</small><h3>CAP-742-R2 у новій review-черзі</h3><p>2 нові оригінали, 48 м · lineage і попереднє рішення збережені.</p></div><button className="button button--signal button--small" onClick={() => setCorrectionStage('approved')}>Схвалити ревізію</button></section>}

        {correctionStage === 'approved' && <section className="correction-receipt correction-receipt--approved" role="status" aria-live="polite"><span><Check size={21}/></span><div><small>НОВЕ РІШЕННЯ · RVW-2207-91</small><h3>CAP-742-R2 схвалено</h3><p>Readiness перераховано: 204 400 ₴ перейшли в ready_internal. CAP-742 залишається returned.</p></div><button className="quiet-button" onClick={() => { setDecision(null); setCorrectionStage(null); setReplacementAdded(false) }}>До черги</button></section>}
      </main>
    </div>
  </AppShell>
}
