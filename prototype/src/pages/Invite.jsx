import { useState } from 'react'
import { ArrowRight, Check, KeyRound, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'

export default function Invite() {
  const [step, setStep] = useState(0)
  const [accepted, setAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const navigate = useNavigate()

  if (accepted) return <div className="invite-page"><main className="invite-card invite-card--success"><Brand/><span className="success-mark synced"><Check size={38}/></span><h1>Доступ активовано</h1><p>Роль і межі доступу збережені. Інші об’єкти компанії вам не відкриті.</p><div className="access-summary"><span>Роль<b>Внутрішня перевірка</b></span><span>Об’єкт<b>БЦ Horizon</b></span><span>Локації<b>Секція B</b></span></div><button className="button button--dark button--full" onClick={() => navigate('/app/evidence')}>До черги перевірки</button></main></div>

  return <div className="invite-page"><main className="invite-card"><Brand/><div className="invite-org"><span>ЕП</span><div><small>ЗАПРОШЕННЯ ДО КОМПАНІЇ</small><b>ЕнергоПро Монтаж</b><p>Ірина Коваленко запросила вас 20 липня</p></div></div>{step === 0 ? <>
    <h1>Перевірте майбутній доступ</h1><p>AktFlow активує лише зазначені роль, об’єкт і локації.</p>
    <div className="access-summary"><span>Роль<b>Внутрішня перевірка</b></span><span>Об’єкт<b>БЦ Horizon</b></span><span>Локації<b>Секція B</b></span></div>
    <label className="consent"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)}/><span>Приймаю умови сервісу та повідомлення безпеки. Маркетинг налаштовується окремо.</span></label>
    <button disabled={!termsAccepted} className="button button--dark button--full" onClick={() => setStep(1)}>Продовжити <ArrowRight size={17}/></button>
  </> : <>
    <span className="auth-lock"><ShieldCheck size={20}/></span><h1>Захистіть рішення перевірки</h1><p>Для цієї ролі компанія вимагає другий фактор. У прототипі використайте будь-які 6 цифр.</p>
    <label className="otp-field">Код підтвердження<input autoFocus inputMode="numeric" defaultValue="248 190"/></label>
    <div className="security-copy"><KeyRound size={18}/><span><b>Резервні коди</b> будуть доступні після активації у налаштуваннях безпеки.</span></div>
    <button className="button button--dark button--full" onClick={() => setAccepted(true)}>Увімкнути MFA й прийняти</button>
    <button className="quiet-button button--full" onClick={() => setStep(0)}>Назад до прав</button>
  </>}</main></div>
}
