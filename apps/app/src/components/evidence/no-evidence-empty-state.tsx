import { EmptyState } from "@goproceed/ui/components";

/**
 * `app/(dash)/assignments/[assignmentId]/page.tsx` renders this when
 * `GET /v1/assignments/{assignmentId}/evidence` returns zero groups for an
 * assignment that does exist (an empty `groups` array — no occurrence group
 * AND no unbound-photo group) — catalogued as `dash.empty.no_evidence_title`
 * / `dash.empty.no_evidence`. Mirrors `no-assignments-empty-state.tsx`'s
 * shape one level down.
 *
 * `max-w-md`: stock Tailwind's 28rem, back since the theme stopped clearing
 * stock namespaces (2026-09-24, DEV-073, BL-047).
 */
export function NoEvidenceEmptyState() {
  return (
    <EmptyState
      className="mx-auto max-w-md py-16"
      title="Немає доказів"
      description="Для цього доручення ще немає завантажених доказів."
    />
  );
}
