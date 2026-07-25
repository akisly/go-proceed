import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand'

const steps = [
  { title: 'Чи підходить AktFlow вашій команді?', text: 'Пілот розрахований на спеціалізованих підрядників з активним об’єктом і регулярним закриттям робіт.' },
  { title: 'Оберімо одну реальну проблему', text: 'Не просимо завантажувати документи зараз. Дані потрібні лише для короткої діагностичної розмови.' },
]

export default function Pilot() {
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  if (submitted) return <div className="pilot-page pilot-page--success">
    <header><Brand/><Link to="/">На головну</Link></header>
    <main className="pilot-success">
      <span className="success-mark synced"><Check size={38}/></span>
      <h1>Запит отримано</h1>
      <p>Ми не створили робочий простір автоматично. Спочатку звіримо процес, об’єкт і критерії пілоту.</p>
      <div className="pilot-receipt"><ShieldCheck size={20}/><div><small>ЗАПИТ НА ПІЛОТ</small><b>LEAD-26Q3H7M2 · відповідь у робочий час</b></div></div>
      <Link className="button button--dark" to="/app">Відкрити синтетичне демо</Link>
    </main>
  </div>

  return <div className="pilot-page">
    <header><Brand/><Link to="/"><ArrowLeft size={16}/> Повернутися</Link></header>
    <main className="pilot-layout">
      <aside><span>Крок {step + 1} з 2</span><h1>{steps[step].title}</h1><p>{steps[step].text}</p><div className="pilot-progress"><i style={{width: `${(step + 1) * 50}%`}}/></div></aside>
      <form onSubmit={(event) => { event.preventDefault(); step === 0 ? setStep(1) : setSubmitted(true) }} className="pilot-form">
        {step === 0 ? <>
          <label>Компанія<input name="companyName" required maxLength="180" defaultValue="ЕнергоПро Монтаж"/></label>
          <label>Спеціалізація<select name="specialization" defaultValue="electrical"><option value="electrical">Електромонтажні роботи</option><option value="hvac">ОВіК / HVAC</option><option value="plumbing">Водопостачання</option><option value="low_current">Слабкострумові системи</option><option value="general">Генпідряд</option><option value="other">Інше</option></select></label>
          <div className="field-pair"><label>Активних об’єктів<select name="activeProjectsBucket" defaultValue="2_3"><option value="1">1</option><option value="2_3">2–3</option><option value="4_10">4–10</option><option value="11_plus">11+</option></select></label><label>Команда<select name="employeeBucket" defaultValue="11_50"><option value="1_10">1–10</option><option value="11_50">11–50</option><option value="51_200">51–200</option><option value="201_plus">201+</option></select></label></div>
        </> : <>
          <label>Як зараз закриваєте роботи?<select name="closeProcess" defaultValue="spreadsheets_messengers"><option value="spreadsheets_messengers">Таблиці та месенджери</option><option value="erp_accounting">ERP / облікова система</option><option value="gc_system">Система генпідрядника</option><option value="mixed">Змішаний процес</option><option value="other">Інше</option></select></label>
          <label>Що найбільше затримує закриття?<select name="primaryPain" defaultValue="missing_evidence"><option value="missing_evidence">Не вистачає доказів або виконавчої документації</option><option value="quantity_mismatch">Не сходяться обсяги</option><option value="slow_review">Довго повертають/погоджують</option><option value="lost_variations">Губляться додаткові роботи</option><option value="other">Інше</option></select></label>
          <label>Сума останньої затримки, діапазон<select name="delayedAmountBucket" defaultValue="250k_1m_uah"><option value="none">Затримки не було</option><option value="under_250k_uah">до 250 тис. ₴</option><option value="250k_1m_uah">250 тис.–1 млн ₴</option><option value="1m_5m_uah">1–5 млн ₴</option><option value="over_5m_uah">понад 5 млн ₴</option><option value="prefer_not_to_say">Не хочу вказувати</option></select><small>Для аналітики зберігаємо діапазон, не точну суму.</small></label>
          <label>Що перевіримо в пілоті?<textarea name="desiredPilot" required minLength="2" maxLength="240" defaultValue="Один активний об’єкт і закриття робіт за липень"/><small>Один об’єкт, період або вимірний результат — без завантаження документів на цьому кроці.</small></label>
          <div className="field-pair"><label>Контактна особа<input name="contactName" required maxLength="120" defaultValue="Олена Бондар"/></label><label>Робочий email<input name="contactEmail" required type="email" maxLength="254" defaultValue="owner@energopro.ua"/></label></div>
          <label>Телефон, необов’язково<input name="contactPhone" type="tel" pattern="\+[1-9][0-9]{7,14}" defaultValue="+380670000000"/><small>Міжнародний формат без пробілів, наприклад +380670000000.</small></label>
          <label className="consent"><input name="serviceConsent" required type="checkbox"/><span>Погоджуюсь на використання даних для відповіді на запит і підтверджую ознайомлення з повідомленням про приватність (service v2026-07, privacy v2026-07).</span></label>
          <label className="consent"><input name="marketingConsent" type="checkbox"/><span>Хочу окремо отримувати продуктові новини. Це необов’язково й не впливає на розгляд пілоту.</span></label>
        </>}
        <div className="pilot-form__actions">{step > 0 && <button type="button" className="button button--outline" onClick={() => setStep(0)}>Назад</button>}<button className="button button--dark">{step === 0 ? <>Продовжити <ArrowRight size={17}/></> : 'Надіслати запит'}</button></div>
      </form>
    </main>
  </div>
}
