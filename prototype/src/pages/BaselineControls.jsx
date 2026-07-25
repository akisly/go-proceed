import { useState } from 'react'
import { BookOpenCheck, Check, FileStack, ShieldCheck } from 'lucide-react'
import AppShell from '../components/AppShell'

const impactRows = [
  ['Активні завдання', '14 зберігають v2 / R6'],
  ['Нові завдання', 'отримають v3 / R7'],
  ['Потребують дії', '0 — історія не переписується'],
]

export default function BaselineControls() {
  const [termsPreviewed, setTermsPreviewed] = useState(false)
  const [termsPublished, setTermsPublished] = useState(false)
  const [referencePreviewed, setReferencePreviewed] = useState(false)
  const [referencePublished, setReferencePublished] = useState(false)

  return <AppShell title="Умови й контрольні документи" eyebrow="БЦ Horizon · Baseline controls">
    <div className="page-content baseline-page">
      <section className="baseline-hero panel">
        <div><span className="eyebrow-chip">EXACT VERSION BOUNDARY</span><h2>Нова версія не змінює вже видану роботу</h2><p>Спочатку impact preview, потім незмінна публікація. Кожне завдання зберігає точні terms, rule та reference hashes.</p></div>
        <ShieldCheck size={34}/>
      </section>
      <section className="baseline-grid">
        <article className="panel baseline-card terms-card">
          <header><span className="baseline-icon"><BookOpenCheck size={20}/></span><div><small>CONTRACT TERMS</small><h3>{termsPublished ? 'Версія v3 · опублікована' : 'Чернетка v3'}</h3></div><b className={termsPublished ? 'published-pill' : 'draft-pill'}>{termsPublished ? 'PUBLISHED' : 'DRAFT'}</b></header>
          <div className="terms-matrix"><p><span>Валюта</span><b>UAH</b></p><p><span>Точність обсягу</span><b>0,001</b></p><p><span>Округлення</span><b>Half up</b></p><p><span>Утримання</span><b>5,00%</b></p><p><span>Строк оплати</span><b>15 днів</b></p><p><span>Оцінка</span><b>Contract rate</b></p></div>
          {termsPreviewed && <div className="impact-preview"><small>FRESH IMPACT · TIP-2407-03 · hash 6ac1…bd09</small>{impactRows.map(([label,value]) => <p key={label}><span>{label}</span><b>{value}</b></p>)}</div>}
          {termsPublished ? <div className="inline-receipt"><Check size={18}/><span><b>CTR-TERMS-v3 · 7f0a…39c1</b><small>Preview TIP-2407-03 спожито · формули заморожено</small></span></div> : termsPreviewed ? <button className="button button--dark button--full publish-terms" onClick={() => setTermsPublished(true)}>Підтвердити preview й опублікувати v3</button> : <button className="button button--outline button--full preview-terms" onClick={() => setTermsPreviewed(true)}>Створити impact preview</button>}
        </article>
        <article className="panel baseline-card reference-card">
          <header><span className="baseline-icon baseline-icon--blue"><FileStack size={20}/></span><div><small>CONTROLLED REFERENCE</small><h3>{referencePublished ? 'E-101 · ревізія R7' : 'E-101 · ревізія R7 draft'}</h3></div><b className={referencePublished ? 'published-pill' : 'draft-pill'}>{referencePublished ? 'CURRENT' : 'VALIDATED'}</b></header>
          <div className="reference-sheet"><span>ОДНОЛІНІЙНА СХЕМА</span><strong>E-101</strong><b>Ревізія R7</b><small>SHA-256 · 20bd…7aa9 · 4,2 МБ</small></div>
          {referencePreviewed && <div className="impact-preview"><small>REVISION IMPACT · RIP-2407-11 · hash 10aa…81f2</small>{impactRows.map(([label,value]) => <p key={label}><span>{label}</span><b>{value}</b></p>)}</div>}
          {referencePublished ? <div className="inline-receipt"><Check size={18}/><span><b>REF-E101-R7 · 20bd…7aa9</b><small>Preview RIP-2407-11 спожито · R6 лишається в 14 завданнях</small></span></div> : referencePreviewed ? <button className="button button--signal button--full publish-reference" onClick={() => setReferencePublished(true)}>Підтвердити preview й опублікувати R7</button> : <button className="button button--outline button--full preview-reference" onClick={() => setReferencePreviewed(true)}>Переглянути вплив ревізії</button>}
        </article>
      </section>
    </div>
  </AppShell>
}
