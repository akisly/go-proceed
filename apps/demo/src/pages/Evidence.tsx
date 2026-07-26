import { AlertTriangle } from 'lucide-react'
import { PROJECT } from '../data/project'
import { formatUah } from '../components/MoneyCard'
import type { EvidenceKind, WorkItem } from '../domain/types'

/** Not governed by doc 05 §5 (that lock is on ReadinessState only) — a plain, local, honest translation of the evidence kind. */
const EVIDENCE_KIND_LABEL_UK: Record<EvidenceKind, string> = {
  photo: 'Фото',
  file: 'Файл',
  voice_note: 'Голосова нотатка',
  quantity: 'Обсяг',
  typed_form: 'Протокол',
}

/**
 * "Blocks submission" is a property of the individual requirement
 * (Requirement.blocksSubmission), not of the work item — an item can have
 * both a satisfied requirement and a still-open one that never blocked
 * anything (e.g. a supplier certificate someone is still waiting on). This
 * page keeps that distinction visible instead of flattening every pending
 * record into one undifferentiated "missing evidence" bucket, because
 * claiming a non-blocking gap blocks submission would itself be a false
 * consequence — the opposite of doc 05 §3's "missing requirements explain
 * why and financial impact".
 */
function hasBlockingGap(item: WorkItem): boolean {
  return item.requirements.some(req => req.status === 'pending' && req.blocksSubmission)
}
function hasOnlyNonBlockingGap(item: WorkItem): boolean {
  return !hasBlockingGap(item) && item.requirements.some(req => req.status === 'pending')
}

const BLOCKING_ITEMS = PROJECT.workItems.filter(hasBlockingGap)
const NON_BLOCKING_ITEMS = PROJECT.workItems.filter(hasOnlyNonBlockingGap)

export default function Evidence() {
  return (
    <>
      <h1>Вимоги до доказів</h1>
      <p>
        Кожен рядок робіт має власний перелік вимог до доказів. Поки вимога, що блокує подання, залишається
        невиконаною, вся вартість рядка залишається під ризиком — саме це і показано нижче.
      </p>

      <section aria-label="Вимоги, що блокують подання">
        <h2>Вимоги, що блокують подання</h2>
        {BLOCKING_ITEMS.map(item => {
          const blockingRequirements = item.requirements.filter(req => req.status === 'pending' && req.blocksSubmission)
          return (
            <article key={item.id} className="panel blockers-panel">
              <header>
                <div>
                  <span>{item.code}</span>
                  <b>{item.title}</b>
                </div>
                <b>{blockingRequirements.length}</b>
              </header>
              <p>
                Під ризиком {formatUah(item.valueUah)} за цим рядком, доки нижченаведені вимоги не закрито.
              </p>
              <div className="blocker-list">
                {blockingRequirements.map(req => (
                  <article key={req.id}>
                    <span className="attention-icon overdue">
                      <AlertTriangle size={14} aria-hidden="true" />
                    </span>
                    <div>
                      <b>{req.label}</b>
                      <small>{EVIDENCE_KIND_LABEL_UK[req.kind]} · Блокує подання пакета</small>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          )
        })}
        {BLOCKING_ITEMS.length === 0 && <p>Наразі немає вимог, що блокують подання.</p>}
      </section>

      <section aria-label="Вимоги без блокування">
        <h2>Вимоги без блокування</h2>
        <p>Ці вимоги ще не закрито, але окремо вони подання пакета не зупиняють.</p>
        {NON_BLOCKING_ITEMS.map(item => {
          const openRequirements = item.requirements.filter(req => req.status === 'pending')
          return (
            <article key={item.id} className="panel blockers-panel">
              <header>
                <div>
                  <span>{item.code}</span>
                  <b>{item.title}</b>
                </div>
              </header>
              <div className="blocker-list">
                {openRequirements.map(req => (
                  <article key={req.id}>
                    <span className="attention-icon">
                      <AlertTriangle size={14} aria-hidden="true" />
                    </span>
                    <div>
                      <b>{req.label}</b>
                      <small>{EVIDENCE_KIND_LABEL_UK[req.kind]} · Не блокує подання</small>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          )
        })}
        {NON_BLOCKING_ITEMS.length === 0 && <p>Немає відкритих вимог, що не блокують подання.</p>}
      </section>
    </>
  )
}
