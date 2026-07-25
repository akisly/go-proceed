import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, FileLock2, History, Play, ShieldCheck } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Status from '../components/Status'

const seedRules = [
  {
    id: 'R-EL-01',
    name: 'Маршрут до закриття конструкцією',
    applies: 'Кабельні лінії · прихований монтаж',
    requirement: '2 фото до закриття',
    enabled: true,
    affected: 74,
  },
  {
    id: 'R-EL-02',
    name: 'Кріплення та крок прокладання',
    applies: 'Кабельні лінії · усі локації',
    requirement: '1 фото крупним планом',
    enabled: true,
    affected: 126,
  },
  {
    id: 'R-EL-03',
    name: 'Виконавча схема',
    applies: 'Щити та магістральні траси',
    requirement: 'Документ + review ПТО',
    enabled: true,
    affected: 38,
  },
  {
    id: 'R-EL-04',
    name: 'Підтвердження виконаного обсягу',
    applies: 'Усі позиції з кількістю',
    requirement: 'Кількість у межах залишку',
    enabled: true,
    affected: 428,
  },
]

const formatHash = 'sha256:9c5d…e41a'

export default function Rules() {
  const [rules, setRules] = useState(seedRules)
  const [preview, setPreview] = useState(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [published, setPublished] = useState(false)
  const [jobComplete, setJobComplete] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isSetup = searchParams.get('setup') === '1'
  const publishButtonRef = useRef(null)
  const confirmButtonRef = useRef(null)
  const receiptRef = useRef(null)
  const enabled = rules.filter(rule => rule.enabled)
  const draftFingerprint = enabled.map(rule => rule.id).join('|')
  const previewFresh = preview?.fingerprint === draftFingerprint

  useEffect(() => {
    if (dialogOpen) confirmButtonRef.current?.focus()
  }, [dialogOpen])

  useEffect(() => {
    if (published) receiptRef.current?.focus()
  }, [published])

  const closeDialog = () => {
    setDialogOpen(false)
    requestAnimationFrame(() => publishButtonRef.current?.focus())
  }

  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeDialog()
      return
    }
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll('button:not([disabled])')]
    if (!controls.length) return
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const toggleRule = (id) => {
    setRules(current => current.map(rule => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule))
    setAcknowledged(false)
    setPublished(false)
    setJobComplete(false)
  }

  const runPreview = () => {
    const changed = (rules.find(rule => rule.id === 'R-EL-01')?.enabled ? 74 : 0)
      + (rules.find(rule => rule.id === 'R-EL-02')?.enabled ? 14 : 0)
      + (rules.find(rule => rule.id === 'R-EL-03')?.enabled ? 38 : 0)
    const blocked = rules.find(rule => rule.id === 'R-EL-03')?.enabled ? 38 : 0
    setPreview({
      fingerprint: draftFingerprint,
      id: 'RIP-260722-18',
      hash: formatHash,
      changed,
      blocked,
    })
    setAcknowledged(false)
    setPublished(false)
    setJobComplete(false)
  }

  const publish = () => {
    setDialogOpen(false)
    setPublished(true)
    setJobComplete(false)
  }

  return <AppShell
    title="Правила доказів"
    eyebrow="БЦ Horizon · Електромонтаж · Чернетка v2"
    action={<button ref={publishButtonRef} className="button button--dark button--small" disabled={!previewFresh || !acknowledged || published} onClick={() => setDialogOpen(true)}><FileLock2 size={16}/> {published ? 'v2 опубліковано' : 'Опублікувати v2'}</button>}
  >
    <div className="page-content rules-page">
      <section className="rules-version-strip" aria-label="Версії правил">
        <div><History size={18}/><span><small>ЧИННА ВЕРСІЯ</small><b>v1 · опублікована 02.06.2026</b></span></div>
        <ChevronRight size={18}/>
        <div className="is-draft"><FileLock2 size={18}/><span><small>{published ? 'НОВА ЧИННА ВЕРСІЯ' : 'РОБОЧА ВЕРСІЯ'}</small><b>{published ? `v2 · опублікована · ${enabled.length} правил` : `v2 · ${enabled.length} з ${rules.length} правил увімкнено`}</b></span></div>
        <p><ShieldCheck size={16}/> Пакети, створені на v1, не перераховуються.</p>
      </section>

      <div className="rules-layout">
        <section className="panel rules-editor" aria-labelledby="rules-editor-title">
          <header>
            <div><span>КОНФІГУРАЦІЯ</span><h2 id="rules-editor-title">Що має підтвердити виконання</h2></div>
            <Status tone={published ? 'ready' : 'review'}>{published ? 'Незмінна v2' : 'Чернетка'}</Status>
          </header>
          <div className="rule-table" role="list">
            {rules.map(rule => <article key={rule.id} role="listitem">
              <label className="rule-switch">
                <input type="checkbox" checked={rule.enabled} disabled={published} onChange={() => toggleRule(rule.id)}/>
                <span aria-hidden="true"/>
                <b className="sr-only">{rule.enabled ? 'Вимкнути' : 'Увімкнути'} правило {rule.name}</b>
              </label>
              <div><small>{rule.id} · {rule.applies}</small><strong>{rule.name}</strong><span>{rule.requirement}</span></div>
              <b>{rule.affected}<small> позицій</small></b>
            </article>)}
          </div>
          <footer>
            <p>{published ? 'v2 зафіксована. Наступні зміни мають починатися в новій чернетці v3.' : 'Зміни зберігаються як чернетка. Вони не впливають на готовність, доки v2 не опубліковано.'}</p>
            <button className="button button--dark" disabled={published} onClick={runPreview}><Play size={16}/> Розрахувати вплив</button>
          </footer>
        </section>

        <aside className="panel impact-panel" aria-labelledby="impact-title">
          <span>{published ? 'PUBLISH RECEIPT' : 'IMPACT PREVIEW'}</span>
          <h2 id="impact-title">{published ? 'Зафіксований вплив v2' : 'Наслідки до публікації'}</h2>
          {!preview ? <div className="impact-empty"><Play size={23}/><b>Розрахунок ще не виконано</b><p>AktFlow перевірить чернетку на чинному snapshot договору й покаже, які роботи та суми зміняться.</p></div> : !previewFresh ? <div className="impact-stale" role="alert"><AlertTriangle size={21}/><div><b>Preview застарів</b><p>Конфігурація змінилася після розрахунку. Публікацію заблоковано; виконайте новий preview.</p><small>RULE_IMPACT_STALE · {preview.id}</small></div></div> : <>
            <div className="impact-metrics" aria-live="polite">
              <p><span>Перевірено</span><strong>428</strong><small>позицій договору</small></p>
              <p><span>Змінять стан</span><strong>{preview.changed}</strong><small>позицій після publish</small></p>
              <p><span>Стануть blocked</span><strong>{preview.blocked}</strong><small>{preview.blocked ? 'на 312 400 ₴' : 'без нового ризику'}</small></p>
              <p><span>Нові вимоги</span><strong>{Math.max(enabled.length - 2, 0)}</strong><small>без silent defaults</small></p>
            </div>
            <div className="impact-delta">
              <div><span>EL-11.08 · Щит ЩР-12</span><b>ready_internal → missing</b></div>
              <div><span>EL-04.17 · Кабель ВВГнг</span><b>pending_review → missing</b></div>
              <div><span>Історичний пакет PKG-006</span><b>без змін · v1 snapshot</b></div>
            </div>
            <dl className="impact-proof"><div><dt>Preview</dt><dd>{preview.id}</dd></div><div><dt>Input hash</dt><dd>{preview.hash}</dd></div><div><dt>Snapshot</dt><dd>CTR-2026-02 · v3</dd></div></dl>
            <label className="impact-ack"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/><span>Я перевірив affected rows, суму ризику та історичну ізоляцію.</span></label>
          </>}
          {published && <div ref={receiptRef} tabIndex="-1" className="publish-receipt" role="status" aria-live="polite"><Check size={19}/><div><small>ПУБЛІКАЦІЮ ПРИЙНЯТО · JOB-RULE-118</small><b>v2 стала незмінною версією</b><span>{jobComplete ? 'Перерахунок завершено: 428/428 позицій.' : 'Перерахунок готовності поставлено в чергу.'}</span></div>{!jobComplete ? <button className="quiet-button" onClick={() => setJobComplete(true)}>Симулювати завершення</button> : isSetup && <button className="quiet-button" onClick={() => navigate('/onboarding?step=5')}>Продовжити онбординг <ChevronRight size={14}/></button>}</div>}
        </aside>
      </div>
    </div>

    {dialogOpen && <div className="modal-layer">
      <button className="drawer__backdrop" tabIndex="-1" onClick={closeDialog} aria-label="Закрити підтвердження"/>
      <section className="rule-publish-dialog" role="dialog" aria-modal="true" aria-labelledby="rule-publish-title" aria-describedby="rule-publish-description" onKeyDown={handleDialogKeyDown}>
        <span className="auth-lock"><FileLock2 size={20}/></span>
        <h2 id="rule-publish-title">Опублікувати правила v2?</h2>
        <p id="rule-publish-description">Версія стане незмінною. Нові оцінки використовуватимуть v2; уже зафіксовані package snapshots залишаться на своїй версії.</p>
        <dl><div><dt>Impact preview</dt><dd>{preview?.id}</dd></div><div><dt>Input hash</dt><dd>{preview?.hash}</dd></div><div><dt>Змінять стан</dt><dd>{preview?.changed} позицій</dd></div></dl>
        <div><button className="button button--outline" onClick={closeDialog}>Скасувати</button><button ref={confirmButtonRef} className="button button--dark" onClick={publish}>Підтвердити publish</button></div>
      </section>
    </div>}
  </AppShell>
}
