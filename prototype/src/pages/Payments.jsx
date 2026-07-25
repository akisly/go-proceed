import { useState } from 'react'
import { ArrowDownToLine, Check, CircleDollarSign, Plus } from 'lucide-react'
import AppShell from '../components/AppShell'
import Status from '../components/Status'
import useDialogA11y from '../components/useDialogA11y'

const receivables = [
  { ref: 'ACT-HR-0626', project: 'БЦ Horizon', basis: 'AVR-2026-06 · v2', due: '15.08.2026', total: 2650000, paid: 1200000, retention: 132500, tone: 'review', state: 'Частково оплачено' },
  { ref: 'ACT-HR-0526', project: 'БЦ Horizon', basis: 'AVR-2026-05 · v3', due: '15.07.2026', total: 2180000, paid: 2180000, retention: 109000, tone: 'ready', state: 'Оплачено' },
  { ref: 'ACT-WP-0526', project: 'Логістичний парк West', basis: 'AVR-2026-05 · v1', due: '10.07.2026', total: 1420000, paid: 1180000, retention: 71000, tone: 'risk', state: 'Прострочено' },
]

export default function Payments() {
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState(false)
  const dialogRef = useDialogA11y(recording, () => setRecording(false))

  return <AppShell title="Проєктні оплати" eyebrow="Усі об’єкти" action={<button className="button button--dark button--small" onClick={() => { setRecording(true); setRecorded(false) }}><Plus size={16}/> Зафіксувати платіж</button>}>
    <div className="page-content payments-page"><div className="domain-boundary"><CircleDollarSign size={19}/><div><b>Це оплати за будівельні роботи</b><span>Тариф і рахунки AktFlow знаходяться окремо в «Тариф».</span></div></div><section className="payment-kpis"><div><span>До отримання</span><strong>1 490 000 ₴</strong><small>без майбутнього retention</small></div><div><span>Прострочено</span><strong>240 000 ₴</strong><small>12 днів</small></div><div><span>Утримання</span><strong>312 500 ₴</strong><small>окремі строки release</small></div></section><section className="receivable-table"><header><span>Документ / пакет</span><span>Сума</span><span>Оплачено</span><span>Утримання</span><span>Строк</span><span>Стан</span></header>{receivables.map(item => <article key={item.ref}><div><b>{item.ref}</b><small>{item.project} · {item.basis}</small></div><strong>{new Intl.NumberFormat('uk-UA').format(item.total)} ₴</strong><strong>{new Intl.NumberFormat('uk-UA').format(item.paid)} ₴</strong><span>{new Intl.NumberFormat('uk-UA').format(item.retention)} ₴</span><span>{item.due}</span><Status tone={item.tone}>{item.state}</Status></article>)}</section></div>
    {recording && <div className="modal-layer"><button className="drawer__backdrop" onClick={() => setRecording(false)} aria-label="Закрити"/><section ref={dialogRef} className="payment-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">{recorded ? <div className="payment-recorded" aria-live="polite"><span className="success-mark synced"><Check size={36}/></span><h2 id="payment-dialog-title">Платіж розподілено</h2><p>PAY-2207-18 · 600 000 ₴ → ACT-HR-0626. Залишок до сплати 850 000 ₴.</p><button className="button button--dark button--full" onClick={() => setRecording(false)}>Закрити</button></div> : <><span className="auth-lock"><ArrowDownToLine size={20}/></span><h2 id="payment-dialog-title">Зафіксувати банківський платіж</h2><p>Це ручний запис. У production імпорт перевірить duplicate fingerprint та allocation limits.</p><label>Сума<input defaultValue="600 000 ₴"/></label><label>Дата<input type="date" defaultValue="2026-07-22"/></label><label>Розподіл<select defaultValue="act"><option value="act">ACT-HR-0626 · залишок 1 450 000 ₴</option></select></label><label>Банківське посилання<input defaultValue="UA-TRX-2207-1842"/></label><div><button className="button button--outline" onClick={() => setRecording(false)}>Скасувати</button><button className="button button--dark" onClick={() => setRecorded(true)}>Зберегти з аудитом</button></div></>}</section></div>}
  </AppShell>
}
