import { useState } from 'react'
import { ArrowLeft, Check, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand'

export default function ResetPassword() {
  const [sent, setSent] = useState(false)
  return <div className="reset-page">
    <header><Brand/><Link to="/login"><ArrowLeft size={16}/> До входу</Link></header>
    <main>
      <section className="reset-folio">
        <img src="/assets/evidence-atlas/blueprint-folio.png" alt="" />
        <div><small>ACCOUNT RECOVERY</small><h1>Відновлення без втрати контролю.</h1><p>Посилання обмежене часом і конкретним обліковим записом. Активні сесії можна буде відкликати після входу.</p></div>
      </section>
      <form onSubmit={event => { event.preventDefault(); setSent(true) }}>
        <span className="auth-lock">{sent ? <Check size={20}/> : <KeyRound size={20}/>}</span>
        <h2>{sent ? 'Перевірте робочу пошту' : 'Відновити пароль'}</h2>
        <p>{sent ? 'Якщо обліковий запис існує, ми надіслали одноразове посилання. Воно діє 20 хвилин.' : 'Вкажіть email, пов’язаний із робочим простором AktFlow.'}</p>
        {!sent && <label>Робочий email<input required type="email" defaultValue="iryna@energopro.ua"/></label>}
        {!sent ? <button className="button button--dark button--full">Надіслати захищене посилання</button> : <><div className="auth-inline-receipt">RECOVERY-260722 · запит прийнято</div><Link className="button button--outline button--full" to="/login">Повернутися до входу</Link></>}
      </form>
    </main>
  </div>
}
