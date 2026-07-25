import { useState } from 'react'
import { BellRing, Check, Globe2, Save, ShieldCheck } from 'lucide-react'
import AppShell from '../components/AppShell'

const initialPreferences = {
  evidence_returned: true,
  close_blocker_due: true,
  payment_overdue: true,
  weekly_digest: false,
}

export default function Settings() {
  const [preferences, setPreferences] = useState(initialPreferences)
  const [saved, setSaved] = useState(false)

  const toggle = key => {
    setPreferences(current => ({ ...current, [key]: !current[key] }))
    setSaved(false)
  }

  return <AppShell
    title="Налаштування робочого простору"
    eyebrow="ЕнергоПро Монтаж · організаційна політика"
    action={<button className="button button--dark button--small" onClick={() => setSaved(true)}><Save size={16}/> Зберегти зміни</button>}
  >
    <div className="page-content settings-page">
      <section className="settings-lead">
        <div><span>WORKSPACE POLICY</span><h2>Передбачувані правила для всієї команди.</h2><p>Проєктні defaults, часовий пояс і сповіщення застосовуються до нових об’єктів. Опубліковані snapshots не змінюються.</p></div>
        <img src="/assets/evidence-atlas/blueprint-folio.png" alt="" />
      </section>

      <div className="settings-grid">
        <section className="panel settings-panel">
          <header><Globe2 size={20}/><div><small>ОРГАНІЗАЦІЯ</small><h3>Локаль і defaults</h3></div></header>
          <label>Часовий пояс<select defaultValue="Europe/Kyiv"><option>Europe/Kyiv</option></select></label>
          <label>Базова валюта<select defaultValue="UAH"><option>UAH — гривня</option></select></label>
          <label>Початок робочого тижня<select defaultValue="monday"><option value="monday">Понеділок</option></select></label>
          <p className="settings-note"><ShieldCheck size={16}/> Валюта конкретного договору фіксується його версією й не успадковує майбутню зміну default.</p>
        </section>

        <section className="panel settings-panel">
          <header><BellRing size={20}/><div><small>СПОВІЩЕННЯ</small><h3>Робочі події</h3></div></header>
          <label className="settings-toggle"><span><b>Доказ повернено</b><small>Виконавець і відповідальний ВТВ</small></span><input type="checkbox" checked={preferences.evidence_returned} onChange={() => toggle('evidence_returned')}/></label>
          <label className="settings-toggle"><span><b>Наближається blocker due</b><small>За 24 години до терміну</small></span><input type="checkbox" checked={preferences.close_blocker_due} onChange={() => toggle('close_blocker_due')}/></label>
          <label className="settings-toggle"><span><b>Проєктна оплата прострочена</b><small>Власник і Project Accountant</small></span><input type="checkbox" checked={preferences.payment_overdue} onChange={() => toggle('payment_overdue')}/></label>
          <label className="settings-toggle"><span><b>Щотижневий digest</b><small>Понеділок, 09:00 · лише in-app у Pilot</small></span><input type="checkbox" checked={preferences.weekly_digest} onChange={() => toggle('weekly_digest')}/></label>
          <label className="settings-toggle settings-toggle--locked"><span><b>Security і SaaS billing</b><small>Обов’язкові системні події</small></span><input type="checkbox" checked disabled/></label>
        </section>
      </div>

      {saved && <section className="settings-receipt" role="status"><Check size={20}/><div><small>POLICY RECEIPT · WSP-260722-04</small><b>Налаштування збережено</b><span>Каталог подій v2026-07 · зміни набрали чинності для майбутніх delivery intents.</span></div></section>}
    </div>
  </AppShell>
}
