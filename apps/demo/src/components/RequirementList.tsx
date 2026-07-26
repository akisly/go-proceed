import { Camera, ClipboardList, FileText, Mic, Ruler } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateUk } from '../domain/format'
import type { EvidenceKind, Requirement } from '../domain/types'

/**
 * Not governed by doc 05 §5 — that lock is on `ReadinessState` only. A plain,
 * local, honest translation of the evidence kind.
 */
const EVIDENCE_KIND_LABEL_UK: Record<EvidenceKind, string> = {
  photo: 'Фото',
  file: 'Файл',
  voice_note: 'Голосова нотатка',
  quantity: 'Обсяг',
  typed_form: 'Протокол',
}

/**
 * The kind was previously text only, which made a list of six open requirements
 * a wall of identical rows. A glyph per kind gives the list a shape you can scan
 * — "two photos and a protocol" registers before any of it is read.
 *
 * The icon is `aria-hidden` and never the only carrier: the kind is still
 * spelled out in the meta line beside it. Icons chosen to be literal rather than
 * clever, because the audience for this list is not looking at it for pleasure.
 */
const EVIDENCE_KIND_ICON: Record<EvidenceKind, typeof Camera> = {
  photo: Camera,
  file: FileText,
  voice_note: Mic,
  quantity: Ruler,
  typed_form: ClipboardList,
}

/**
 * "Blocks submission" is a property of the individual requirement
 * (`Requirement.blocksSubmission`), not of the work item — an item can carry both
 * a satisfied requirement and a still-open one that never blocked anything (a
 * supplier certificate someone is waiting on). The distinction stays visible
 * here rather than being flattened into one undifferentiated "missing evidence"
 * bucket, because claiming a non-blocking gap blocks submission would itself be
 * a false consequence.
 *
 * It is carried by the icon's tone and by the meta line, not by a second alarm
 * treatment on the row: the whole list is already inside a section that names
 * which kind of gap these are, and repeating that per row would make the
 * genuinely blocking case read as no louder than its container.
 */
/**
 * THREE STATES, NOT TWO. An earlier draft keyed only on `blocksSubmission`,
 * which was fine on /app/evidence — that page only ever passes pending
 * requirements — and wrong the moment /app/rules passed a full requirement list
 * to illustrate its worked example: two already-captured records rendered in the
 * blocking tint, captioned «Блокує подання пакета», when both had been satisfied
 * days earlier. A component that is only correct for one caller's filter is a
 * bug waiting for the second caller.
 *
 * `status` is checked first, because a satisfied requirement's
 * `blocksSubmission` flag is a statement about what it WOULD block, not about
 * what it currently does.
 */
function requirementTone(req: Requirement): { chip: string; meta: string } {
  if (req.status === 'satisfied') {
    return {
      chip: 'bg-success-surface text-evidence-satisfied',
      meta:
        req.capturedAt === null ? 'Зафіксовано' : `Зафіксовано ${formatDateUk(req.capturedAt)}`,
    }
  }
  if (req.blocksSubmission) {
    return { chip: 'bg-warning-surface text-evidence-blocking', meta: 'Блокує подання пакета' }
  }
  return { chip: 'bg-surface-sunken text-evidence-pending', meta: 'Не блокує подання' }
}

export default function RequirementList({ requirements }: { requirements: readonly Requirement[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {requirements.map(req => {
        const Icon = EVIDENCE_KIND_ICON[req.kind]
        const tone = requirementTone(req)
        return (
          <li key={req.id} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid size-7 shrink-0 place-items-center rounded-control [&_svg]:size-4',
                tone.chip,
              )}
            >
              <Icon />
            </span>
            <span className="min-w-0">
              <b className="block font-semibold text-foreground">{req.label}</b>
              <span className="block text-meta text-foreground-muted">
                {EVIDENCE_KIND_LABEL_UK[req.kind]} · {tone.meta}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
