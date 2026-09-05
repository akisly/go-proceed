import { EmptyState } from "@goproceed/ui/components";

/**
 * `app/dash/assignments/[assignmentId]/page.tsx` renders this when
 * `GET /v1/assignments/{assignmentId}/evidence` returns zero groups for an
 * assignment that does exist (an empty `groups` array — no occurrence group
 * AND no unbound-photo group) — catalogued as `dash.empty.no_evidence_title`
 * / `dash.empty.no_evidence`. Mirrors `no-assignments-empty-state.tsx`'s
 * shape one level down.
 *
 * `max-w-112`, NOT `max-w-md` — the same container-namespace gap
 * `no-assignments-empty-state.tsx`'s own header documents in full. Until
 * 2026-09-05, this gap was part of the cross-stylesheet coupling a dedicated
 * `app/dash/dash-theme.css` warned against; that file was deleted in the
 * migration to a single Tailwind entry point. The gap it warned about remains
 * here, tracked in `TODOS.md`'s "Surfaced by Plan D slice D0" P2 entry as the
 * real fix (a missing container ROLE, not a fifth scattered substitution).
 * Re-verified for THIS route rather than assumed from that file's own check:
 * this route's own dash-owned CSS chunk (`static/chunks/`, named from this
 * route's own `page_client-reference-manifest.js` after `pnpm --filter
 * @goproceed/app build`) contains no `.max-w-md` rule and no
 * `--container-md` property, and does contain `.max-w-112{max-width:calc(var(
 * --spacing) * 112)}`, which resolves to the same 28rem `max-w-md` would have
 * produced on a stylesheet where that utility existed.
 */
export function NoEvidenceEmptyState() {
  return (
    <EmptyState
      className="mx-auto max-w-112 py-16"
      title="Немає доказів"
      description="Для цього доручення ще немає завантажених доказів."
    />
  );
}
