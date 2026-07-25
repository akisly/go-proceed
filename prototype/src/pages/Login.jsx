import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'

export default function Login() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const navigate = useNavigate()
  const submit = (event) => { event.preventDefault(); setBusy(true); window.setTimeout(() => navigate('/app'), 500) }
  return <div className="auth-page">
    <div className="auth-aside"><Brand light/><div><span className="auth-figure">2,65 млн ₴</span><h1>Готові до подання.<br/>Ще до кінця періоду.</h1><p>БЦ Horizon · Червень 2026</p><img className="auth-aside__stamp" src="/assets/evidence-atlas/verified-stamp.png" alt="Evidence sealed"/></div><small>Демонстраційні дані · AktFlow</small></div>
    <main className="auth-main"><div className="auth-card"><Brand/><div className="auth-card__title"><span className="auth-lock"><LockKeyhole size={20}/></span><h2>Поверніться до контролю</h2><p>Увійдіть у робочий простір AktFlow.</p></div><form onSubmit={submit}><label>Робочий email<input required type="email" defaultValue="iryna@energopro.ua" /></label><label>Пароль<div className="password-field"><input required type={show ? 'text' : 'password'} defaultValue="demoaktflow"/><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Приховати пароль' : 'Показати пароль'}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label><div className="form-row"><label className="check"><input type="checkbox"/> Запам’ятати мене</label><Link to="/reset-password">Забули пароль?</Link></div><button className="button button--dark button--full" disabled={busy}>{busy ? 'Входимо…' : 'Увійти'}</button><button type="button" className="magic-link" onClick={() => setMagicSent(true)}>{magicSent ? 'Посилання надіслано' : 'Надіслати захищене посилання'}</button>{magicSent && <div className="auth-inline-receipt" role="status">MAGIC-260722 · посилання надіслано на iryna@energopro.ua</div>}</form><p className="auth-foot">Ще немає простору? <Link to="/onboarding">Запустити пілот</Link></p></div></main>
  </div>
}
