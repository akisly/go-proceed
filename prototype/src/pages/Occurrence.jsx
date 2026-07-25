import { useState } from 'react'
import { Camera, Check, Eye, LockKeyhole, ShieldCheck } from 'lucide-react'
import AppShell from '../components/AppShell'

const steps = ['Докази', 'Перевірка', 'Рішення', 'Приховано']

export default function Occurrence() {
  const [stage, setStage] = useState(0)
  const [invalidated, setInvalidated] = useState(false)
  const [measurement, setMeasurement] = useState('0.48')
  const [certificate, setCertificate] = useState('CERT-26-0718')
  const measurementValue = Number(measurement)
  const measurementValid = Number.isFinite(measurementValue) && measurementValue >= 0.5

  return <AppShell title="Hold point · OCC-742-03" eyebrow="EL-14.01 · Вимірювання опору">
    <div className="page-content occurrence-page">
      <section className="occurrence-head panel"><div><span className="baseline-icon"><LockKeyhole size={19}/></span><div><small>EXACT SUBJECT · PRJ-HZN / EL-14.01 / ASN-742 / LOC-B4 / OCC-742-03</small><h2>Перед приховуванням кабельних трас</h2><p>Rules v1 · E-101 R6 (stale acknowledged · RAK-742-04) · Terms v3 · link на інший assignment/location буде відхилено</p></div></div><b className={invalidated || stage < 2 ? 'draft-pill' : 'published-pill'}>{invalidated ? 'STALE' : stage === 3 ? 'CLOSED' : stage < 2 ? 'BLOCKED' : 'PASSED'}</b></section>
      <ol className="occurrence-steps">{steps.map((step,index) => <li key={step} className={index <= stage ? 'active' : ''}><i>{index < stage ? <Check size={13}/> : index + 1}</i><span>{step}</span></li>)}</ol>
      <div className="occurrence-grid">
        <section className="panel typed-form"><header><div><small>TYPED EVIDENCE · TEST FORM v2</small><h3>Протокол вимірювання</h3></div><span className="published-pill">ALLOWLISTED</span></header><label>Опір ізоляції<input disabled={stage > 0} value={measurement} onChange={event => setMeasurement(event.target.value)}/><em>МОм · мінімум 0,50</em></label><label>Номер сертифіката<input disabled={stage > 0} value={certificate} onChange={event => setCertificate(event.target.value)}/></label><button className={`evidence-drop ${stage > 0 ? 'complete' : ''}`} disabled={stage > 0}><Camera size={22}/><span><b>{stage > 0 ? '3 оригінали перевірено' : 'Додати фото приладу й схеми'}</b><small>Незмінні originals · metadata окремо</small></span></button>{stage === 0 && !measurementValid && <p className="field-warning">Значення має бути числом не нижче правила 0,50. Для demo змініть на 0.52.</p>}<button className="button button--dark button--full validate-evidence" disabled={stage > 0 || !measurementValid || !certificate} onClick={() => setStage(1)}>Перевірити й передати reviewer</button></section>
        <aside className="panel hold-decision"><small>REVIEW TASK · RVW-2207-93</small><h3>{invalidated ? 'Evidence invalidated · потрібна корекція' : stage === 0 ? 'Очікує валідних даних' : stage === 1 ? 'Готово до рішення' : 'Рішення зафіксовано'}</h3><div className="reviewer-chip"><Eye size={18}/><span><b>Ірина Коваленко</b><small>Internal reviewer · MFA · не автор capture</small></span></div><dl><div><dt>Target version</dt><dd>OCC-742-03 · v4</dd></div><div><dt>SLA</dt><dd>ще 03:42</dd></div><div><dt>Reference</dt><dd>E-101 · R6 · stale_acknowledged</dd></div><div><dt>Typed response</dt><dd>{invalidated ? 'invalidated · original retained' : stage ? `${measurement} МОм · valid` : 'warning'}</dd></div></dl>{stage === 1 && <button className="button button--signal button--full pass-hold" onClick={() => setStage(2)}><ShieldCheck size={17}/> Пройти hold point</button>}{stage >= 2 && <div className="inline-receipt"><Check size={18}/><span><b>HLD-742-18 · passed</b><small>Occurrence v4 · рішення append-only</small></span></div>}{stage === 2 && <button className="button button--dark button--full conceal-work" onClick={() => setStage(3)}>Зафіксувати факт приховування</button>}{stage === 3 && <div className="concealment-receipt"><Check size={19}/><span><b>CON-742-19 · серверний receipt</b><small>Факт не переписується; readiness може стати stale</small></span></div>}{stage === 3 && !invalidated && <button className="button button--outline button--full invalidate-evidence" onClick={() => setInvalidated(true)}>Інвалідувати evidence з причиною</button>}{invalidated && <div className="state-banner state-banner--warning invalidation-receipt"><ShieldCheck size={17}/><div><b>EVI-742-20 · original/hash збережено</b><span>Readiness stale · створено correction CR-742-21; submitted snapshot незмінний</span></div></div>}</aside>
      </div>
    </div>
  </AppShell>
}
