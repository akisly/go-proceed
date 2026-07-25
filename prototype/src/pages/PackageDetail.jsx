import { useState } from 'react'
import { Check, Download, FileCheck2, Link2, LoaderCircle, Send, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'

const decisionLines = [
  { id: 'PL-0417', work: 'EL-04.17 · Кабель ВВГнг', submitted: 65000000 },
  { id: 'PL-1108', work: 'EL-11.08 · Щит ЩР-12', submitted: 85000000 },
  { id: 'PL-1401', work: 'EL-14.01 · Вимірювання', submitted: 115000000 },
]

const money = value => `${new Intl.NumberFormat('uk-UA').format(value / 100)} ₴`

export default function PackageDetail() {
  const [state, setState] = useState('snapshot')
  const [shared, setShared] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [activeDocument, setActiveDocument] = useState(2)
  const [lineDecisions, setLineDecisions] = useState({ 'PL-0417': 'accepted', 'PL-1108': 'returned', 'PL-1401': 'modified' })
  const [modifiedMinor, setModifiedMinor] = useState(110000000)
  const [draftSaved, setDraftSaved] = useState(false)
  const [decisionsRecorded, setDecisionsRecorded] = useState(false)
  const acceptedTotal = decisionLines.reduce((sum, line) => {
    const decision = lineDecisions[line.id]
    if (decision === 'accepted') return sum + line.submitted
    if (decision === 'modified') return sum + modifiedMinor
    return sum
  }, 0)
  const submittedTotal = decisionLines.reduce((sum, line) => sum + line.submitted, 0)
  const returnedTotal = submittedTotal - acceptedTotal

  const generate = () => {
    setState('generating')
    window.setTimeout(() => setState('ready'), 650)
  }

  return <AppShell title="Пакет AVR-2026-06 · v2" eyebrow="БЦ Horizon · Червень 2026">
    <div className="page-content package-detail-page">
      <section className="package-detail-hero"><div><span className="package-icon package-icon--ready"><FileCheck2 size={25}/></span><div><small>IMMUTABLE SNAPSHOT · CL-2026-06</small><h2>2 650 000 ₴</h2><p>428 позицій · generic evidence package · template 1.4</p></div></div><div className={`generation-state generation-state--${state}`}>{state === 'snapshot' ? <><span>Snapshot готовий</span><button className="button button--dark button--small" onClick={generate}>Згенерувати</button></> : state === 'generating' ? <><LoaderCircle className="spin" size={20}/><span><b>Формуємо 5 документів</b><small>Snapshot не змінюється під час retry</small></span></> : <><Check size={19}/><span><b>Готово до подання</b><small>22.07.2026 · 11:08</small></span></>}</div></section>
      <section className="package-builder-grid"><aside className="document-outline"><span>СКЛАД ПАКЕТА</span>{['01 · Manifest і hashes','02 · Реєстр обсягів','03 · Індекс доказів','04 · Readiness report','05 · Waivers і рішення'].map((item, index) => <button className={index === activeDocument ? 'active' : ''} aria-pressed={index === activeDocument} key={item} onClick={() => setActiveDocument(index)}>{item}<small>{index === 2 ? '84 файли' : index === 4 ? '1 waiver' : 'готово'}</small></button>)}</aside><main className="document-preview"><div className="document-sheet"><header><span>AKTFLOW · {['MANIFEST', 'QUANTITY REGISTER', 'EVIDENCE INDEX', 'READINESS REPORT', 'WAIVERS & DECISIONS'][activeDocument]}</span><b>БЦ Horizon</b><small>Червень 2026 · Snapshot 59bd…0ce4 · документ 0{activeDocument + 1} з 05</small></header><h3>{['Manifest пакета і hashes', 'Реєстр підтверджених обсягів', 'Реєстр доказів готовності', 'Звіт готовності до подання', 'Waivers і рішення періоду'][activeDocument]}</h3><table><thead><tr><th>Робота</th><th>Обсяг</th><th>Докази</th><th>Стан</th></tr></thead><tbody><tr><td>EL-04.17 · Кабель ВВГнг</td><td>648 м</td><td>12 фото</td><td>Готово</td></tr><tr><td>EL-11.08 · Щит ЩР-12</td><td>1 шт.</td><td>5 файлів</td><td>Waiver</td></tr><tr><td>EL-14.01 · Вимірювання</td><td>1 протокол</td><td>3 файли</td><td>Готово</td></tr></tbody></table><footer>Renderer 2.1 · Template 1.4 · Сторінка 7 з 18</footer></div></main><aside className="package-validation"><span>ПЕРЕВІРКА</span><h3>{state === 'ready' ? 'Пакет пройшов контроль' : 'Очікує генерації'}</h3>{[['Суми','2 650 000 ₴'],['Hard blockers','0'],['Попередження','1 waiver'],['PII/redaction','Перевірено'],['Розмір','18,4 МБ']].map(([label, value]) => <p key={label}><span>{label}</span><b>{value}</b></p>)}<button disabled={state !== 'ready'} className="button button--outline button--full" onClick={() => setDownloaded(true)}><Download size={16}/> {downloaded ? 'ZIP підготовлено' : 'Завантажити ZIP'}</button>{downloaded && <small>EXP-2207-41 · download receipt створено</small>}<button disabled={state !== 'ready' || shared} className="button button--signal button--full" onClick={() => setShared(true)}><Send size={16}/> {shared ? 'Подання зафіксовано' : 'Зафіксувати подання'}</button></aside></section>
      {shared && <section className="submission-receipt"><ShieldCheck size={23}/><div><small>SUBMISSION RECEIPT · SUB-2026-118</small><h3>Версію v2 зафіксовано як подану</h3><p>Канал: secure link · точна версія й manifest незмінні. Це операційний запис, не КЕП.</p></div><Link className="button button--dark button--small" to="/review/demo"><Link2 size={16}/> Відкрити review demo</Link></section>}
      <section className="panel package-decisions">
        <header><div><small>DECISION SET · PDS-2207-14 · EXACT PACKAGE v2</small><h2>Построчне рішення без перезапису пакета</h2><p>До final commit набір має стан pending_reconciliation і не змінює package/readiness. Суми обчислює сервер.</p></div><span className={decisionsRecorded ? 'published-pill' : 'draft-pill'}>{decisionsRecorded ? 'RECONCILED' : 'PENDING_RECONCILIATION'}</span></header>
        <div className="decision-table"><div className="decision-table__head"><span>Рядок</span><span>Подано</span><span>Рішення</span><span>Погоджено</span></div>{decisionLines.map(line => <div className="decision-line" key={line.id}><span><small>{line.id}</small><b>{line.work}</b></span><strong>{money(line.submitted)}</strong><select aria-label={`Рішення для ${line.id}`} disabled={decisionsRecorded} value={lineDecisions[line.id]} onChange={event => setLineDecisions(current => ({ ...current, [line.id]: event.target.value }))}><option value="accepted">Прийнято</option><option value="returned">Повернуто</option><option value="modified">Змінено</option></select><span>{lineDecisions[line.id] === 'returned' ? <em>0 ₴ · EVIDENCE_MISMATCH</em> : lineDecisions[line.id] === 'modified' ? <label><input aria-label={`Змінена сума ${line.id}`} disabled={decisionsRecorded} type="number" value={modifiedMinor / 100} onChange={event => setModifiedMinor(Math.max(0, Number(event.target.value) * 100))}/><small>₴</small></label> : <b>{money(line.submitted)}</b>}</span></div>)}</div>
        {draftSaved && !decisionsRecorded && <div className="pending-decision-receipt"><Check size={16}/><span><b>PDS-2207-14 · 3/3 pending · item versions v1</b><small>Збережено без package/readiness/correction effect; можна продовжити з іншого сеансу</small></span></div>}
        <footer><div><span>Подано · server</span><b>{money(submittedTotal)}</b></div><div><span>Прийнято · server</span><b>{money(acceptedTotal)}</b></div><div><span>Повернуто/зменшено · server</span><b>{money(returnedTotal)}</b></div>{decisionsRecorded ? <div className="line-decision-receipt"><Check size={18}/><span><b>PDC-2207-14 · reconciled</b><small>3/3 · {money(acceptedTotal)} + {money(returnedTotal)} = {money(submittedTotal)}</small></span></div> : <button className="button button--dark record-line-decisions" onClick={() => draftSaved ? setDecisionsRecorded(true) : setDraftSaved(true)}>{draftSaved ? 'Фіналізувати exact decision set' : 'Зберегти 3 pending рішення'}</button>}</footer>
      </section>
    </div>
  </AppShell>
}
