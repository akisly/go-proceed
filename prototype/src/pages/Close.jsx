import { useState } from 'react'
import { AlertTriangle, ArrowRight, Check, FileCog, LockKeyhole } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Status from '../components/Status'
import useDialogA11y from '../components/useDialogA11y'

const initialBlockers = [
  { id: 'B1', type: 'hard', title: 'Фото до закриття · EL-04.17', owner: 'С. Коваль', amount: '204 400 ₴', value: 204400, requested: false, action: 'Запросити доказ' },
  { id: 'B2', type: 'hard', title: 'Виконавча схема · EL-11.08', owner: 'М. Литвин', amount: '98 000 ₴', value: 98000, action: 'Створити waiver' },
  { id: 'B3', type: 'warn', title: 'Погодження обсягу старше 24 год', owner: 'І. Коваленко', amount: '79 500 ₴', action: 'Нагадати' },
]

export default function Close() {
  const [blockers, setBlockers] = useState(initialBlockers)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const navigate = useNavigate()
  const dialogRef = useDialogA11y(overrideOpen, () => setOverrideOpen(false))
  const hard = blockers.filter(item => item.type === 'hard')
  const blockedValue = hard.reduce((total, item) => total + item.value, 0)
  const readiness = 100 - hard.length * 7

  const handleBlocker = (item) => {
    if (item.id === 'B1' && !item.requested) {
      setBlockers(blockers.map(row => row.id === item.id ? {...row, requested: true, action: 'Симулювати отримання'} : row))
      return
    }
    if (item.id === 'B2') {
      setOverrideOpen(true)
      return
    }
    setBlockers(blockers.filter(row => row.id !== item.id))
  }

  return <AppShell title="Закриття періоду" eyebrow="БЦ Horizon · Червень 2026">
    <div className="page-content close-page">
      <section className="close-hero"><div><span>ГОТОВНІСТЬ ПЕРІОДУ</span><strong>{readiness}%</strong><p>{hard.length ? `${hard.length} обов’язкові блокери не дозволяють зафіксувати пакет.` : 'Обов’язкові блокери закриті. Попередження залишаться в manifest.'}</p></div><div className="close-money"><p><span>Виконано</span><b>3 400 000 ₴</b></p><p><span>Заплановано до пакета</span><b>2 650 000 ₴</b></p><p><span>У пакеті під hard blockers</span><b>{new Intl.NumberFormat('uk-UA').format(blockedValue)} ₴</b></p><p><span>Виключено до іншої версії</span><b>750 000 ₴</b></p></div></section>
      {locked && <div className="state-banner state-banner--success"><LockKeyhole size={18}/><div><b>Snapshot періоду зафіксовано</b><span>CL-2026-06 · calculation v2.4 · зміни створять нову версію.</span></div></div>}
      <section className="close-grid"><article className="panel blockers-panel"><header><div><span>ПЕРЕД ГЕНЕРАЦІЄЮ</span><h2>Блокери й попередження</h2></div><b>{blockers.length}</b></header><div className="blocker-list">{blockers.map(item => <article key={item.id}><span className={`attention-icon ${item.type === 'hard' ? 'overdue' : 'risk'}`}>{item.type === 'hard' ? '!' : '△'}</span><div><b>{item.title}</b><small>{item.owner} · {item.amount}{item.requested ? ' · запит надіслано, блокер активний' : ''}</small></div><Status tone={item.type === 'hard' ? 'risk' : 'review'}>{item.type === 'hard' ? 'Обов’язково' : 'Попередження'}</Status><button className="button button--outline button--small" onClick={() => handleBlocker(item)}>{item.action}</button></article>)}</div></article><aside className="panel close-checklist"><span>КОНТРОЛЬНА ВЕРСІЯ</span><h2>Що ввійде до пакета</h2>{['428 позицій договору','2 650 000 ₴ готового обсягу','84 оригінали доказів','6 review-рішень','1 waiver із причиною та строком'].map(item => <p key={item}><Check size={16}/>{item}</p>)}<div className="assurance-note"><AlertTriangle size={16}/> Generic evidence package. Customer form requires validated adapter.</div><button className="button button--dark button--full" disabled={hard.length > 0 || locked} onClick={() => setLocked(true)}><FileCog size={17}/> Зафіксувати snapshot</button>{locked && <button className="button button--signal button--full" onClick={() => navigate('/app/packages/current')}>До генерації <ArrowRight size={17}/></button>}</aside></section>
    </div>
    {overrideOpen && <div className="modal-layer"><button className="drawer__backdrop" onClick={() => setOverrideOpen(false)} aria-label="Закрити"/><section ref={dialogRef} className="override-dialog" role="dialog" aria-modal="true" aria-labelledby="waiver-dialog-title"><span className="auth-lock"><AlertTriangle size={20}/></span><h2 id="waiver-dialog-title">Створити тимчасовий waiver?</h2><p>Вимога не зникне. Причина, строк і 98 000 ₴ потраплять до manifest пакета.</p><label>Причина<select defaultValue="customer"><option value="customer">Документ надає замовник після подання</option><option value="technical">Технічна затримка оформлення</option></select></label><label>Діє до<input type="date" defaultValue="2026-07-31"/></label><div><button className="button button--outline" onClick={() => setOverrideOpen(false)}>Скасувати</button><button className="button button--dark" onClick={() => { setBlockers(blockers.filter(item => item.id !== 'B2')); setOverrideOpen(false) }}>Підтвердити з аудитом</button></div></section></div>}
  </AppShell>
}
