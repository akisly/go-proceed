import { useMemo, useState } from 'react'
import { ArrowRight, Check, MapPin, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'

const sourceLines = [
  { id: 'EL-04.17', name: 'Прокладання кабелю ВВГнг', location: 'Секція B · Поверх 4', available: 648 },
  { id: 'EL-11.08', name: 'Монтаж щита ЩР-12', location: 'Секція B · Електрощитова', available: 1 },
  { id: 'EL-14.01', name: 'Вимірювання опору ізоляції', location: 'Секція B · Поверх 4', available: 1 },
]

export default function Assignments() {
  const [selected, setSelected] = useState(sourceLines.map(line => line.id))
  const [assignee, setAssignee] = useState('Олексій Бондар')
  const [phase, setPhase] = useState('editing')
  const [reassigned, setReassigned] = useState(false)
  const [referenceAcknowledged, setReferenceAcknowledged] = useState(false)
  const [leaseIssued, setLeaseIssued] = useState(false)
  const selectedLines = useMemo(() => sourceLines.filter(line => selected.includes(line.id)), [selected])
  const previewRows = useMemo(() => selectedLines.map(line => line.id === 'EL-14.01'
    ? { ...line, outcome: 'rejected', detail: 'REFERENCE_ACK_REQUIRED · ASN-742 тримає E-101 R6 stale' }
    : { ...line, outcome: 'committed', detail: `${line.id === 'EL-04.17' ? 4 : 2} occurrences` }), [selectedLines])
  const committedRows = previewRows.filter(row => row.outcome === 'committed')
  const rejectedRows = previewRows.filter(row => row.outcome === 'rejected')
  const occurrenceCount = committedRows.reduce((sum, row) => sum + (row.id === 'EL-04.17' ? 4 : 2), 0)
  const toggle = id => {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
    setPhase('editing')
  }
  const advance = () => setPhase(current => current === 'editing' ? 'preview' : 'receipt')

  return <AppShell title="Планувальник завдань" eyebrow="БЦ Horizon · Точні версії" action={<button className="button button--dark button--small create-assignments" disabled={!selected.length || phase === 'receipt'} onClick={advance}>{phase === 'editing' ? `Переглянути ${selected.length} рядки` : phase === 'preview' ? `Створити ${selected.length} рядки` : 'Batch зафіксовано'}</button>}>
    <div className="page-content assignments-page">
      <section className="assignment-context panel"><div><small>ASSIGNMENT BASIS</small><h2>Terms v3 · Rules 9c5d…e41a · E-101 R7</h2><p>Ця трійка версій буде незмінно записана в кожне завдання та requirement occurrence.</p></div><span className="published-pill">FRESH</span></section>
      <div className="assignment-layout">
        <section className="panel assignment-lines"><header><div><h3>Оберіть обсяг</h3><p>Позиція договору не є завданням і не має виконавця.</p></div><span>{selected.length}/{sourceLines.length}</span></header>{sourceLines.map(line => <label key={line.id} className={selected.includes(line.id) ? 'selected' : ''}><input type="checkbox" disabled={phase === 'receipt'} checked={selected.includes(line.id)} onChange={() => toggle(line.id)}/><span><small>{line.id}</small><b>{line.name}</b><em><MapPin size={13}/>{line.location}</em></span><strong>{line.available} {line.available === 1 ? 'шт.' : 'м'}</strong></label>)}</section>
        <aside className="panel assignment-config"><h3>Параметри видачі</h3><label><span><UserRound size={15}/> Виконавець</span><select disabled={phase === 'receipt'} value={assignee} onChange={event => { setAssignee(event.target.value); setPhase('editing') }}><option>Олексій Бондар</option><option>Максим Ткаченко</option></select></label><label><span>Термін</span><input disabled={phase === 'receipt'} type="date" defaultValue="2026-07-31"/></label><label><span>Пріоритет</span><select disabled={phase === 'receipt'} defaultValue="high"><option value="normal">Звичайний</option><option value="high">Високий</option><option value="critical">Критичний</option></select></label><div className="occurrence-preview"><small>PREVIEW BASIS</small><p><b>{selectedLines.length}</b><span>рядки · окрема транзакція кожного</span></p><p><b>{selectedLines.length * 3}</b><span>occurrences до валідації</span></p><p><b>100</b><span>max rows у Pilot batch</span></p></div></aside>
      </div>
      {phase === 'preview' && <section className="panel assignment-batch-preview" aria-live="polite"><header><div><small>IMPACT PREVIEW · AIP-2407-18 · expires 14:42</small><h3>Кожен рядок матиме власний clientOperationId</h3></div><b className="draft-pill">NO WRITES YET</b></header>{previewRows.map(row => <p key={row.id}><span>{row.id} · {row.location}</span><b className={row.outcome}>{row.outcome === 'committed' ? 'READY' : 'WILL REJECT'} · {row.detail}</b></p>)}<footer>Preview hash 91d4…af20 буде обов’язковим у commit; зміна параметрів зробить його stale.</footer></section>}
      {phase === 'receipt' && <>
        <section className="assignment-receipt assignment-receipt--partial" aria-live="polite"><span><Check size={24}/></span><div><small>ASSIGNMENT BATCH · ASB-2407-18 · HTTP 207</small><h3>{committedRows.length} committed · {rejectedRows.length} rejected для {assignee}</h3><p>{occurrenceCount} occurrences створено один раз у стані assigned; retry поверне той самий row receipt без повторного notification.</p><div className="assignment-row-receipts">{previewRows.map(row => <em key={row.id} className={row.outcome}>{row.outcome === 'committed' ? <Check size={12}/> : <X size={12}/>} {row.id} · {row.detail}</em>)}</div></div><Link className="button button--signal button--small" to="/app/occurrences/demo">Відкрити існуючий hold point EL-14.01 <ArrowRight size={15}/></Link></section>
        <section className="panel assignment-closure-panel">
          <article><small>ASN-741 · VERSION 4 · ASSIGNED</small><h3>Перепризначення без зміни occurrences</h3><p>Offline capture старого виконавця, зроблений під час чинного доступу, піде на manager review.</p>{reassigned ? <div className="inline-receipt reassignment-receipt"><Check size={18}/><span><b>Максим Ткаченко · assignment v5</b><small>ARR-741-05 · old/new assignee та offline policy зафіксовано</small></span></div> : <button className="button button--outline button--small reassign-assignment" onClick={() => setReassigned(true)}>Перепризначити Максиму</button>}</article>
          <article><small>ASN-742 · E-101 R6 · STALE</small><h3>Підтвердження reference не змінює lifecycle</h3><p>Міграція на R7 створить нове linked assignment; це підтвердження лише фіксує усвідомлення R6.</p>{referenceAcknowledged ? <div className="inline-receipt reference-ack-receipt"><Check size={18}/><span><b>stale_acknowledged · assignment v4</b><small>RAK-742-04 · snapshot 10aa…81f2</small></span></div> : <button className="button button--outline button--small acknowledge-reference" onClick={() => setReferenceAcknowledged(true)}>Підтвердити точну R6</button>}</article>
          <article><small>ASN-741 · VERSION 5 · OFFLINE AUTHORIZATION</small><h3>Серверний lease перед роботою без мережі</h3><p>Bundle прив’язаний до membership v12, assignment v5 і policy v3. Час пристрою не є доказом чинного доступу.</p>{leaseIssued ? <div className="inline-receipt offline-lease-receipt"><Check size={18}/><span><b>OAL-741-05 · valid until 18:30 EEST</b><small>lease hash 8f2a…19c0 · invalidation перевіряється під час sync</small></span></div> : <button className="button button--outline button--small issue-execution-bundle" onClick={() => setLeaseIssued(true)}>Видати execution bundle</button>}</article>
        </section>
      </>}
    </div>
  </AppShell>
}
