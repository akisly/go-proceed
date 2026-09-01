import { EmptyState } from "@goproceed/ui/components";

/**
 * `/dash/projects/{projectId}/assignments/new` renders this when
 * `listPublishedBaselines` returns none — the expected state of a fresh pilot
 * project, not an error. Доручення are created against a work item, and a
 * work item only exists on a published contract version's own line list
 * (`baseline.service.ts`'s own header: "a project with no published baseline
 * has no row here, and nothing else can enumerate its contracts"). Slice C —
 * publishing a baseline — is what ends this state; this screen has nothing to
 * offer beyond naming it.
 *
 * IT CARRIES NO ACTION, AND ITS SIBLING NOW DOES — the two are not
 * inconsistent, they are the same rule applied to two different facts.
 * `no-assignments-empty-state.tsx` gained a «Нове доручення» action in the
 * final fix wave because there IS a next act from an empty register and a real
 * screen to take it on. From HERE there is none: no operation in v0.1 publishes
 * a baseline from the office, so any control this state offered would lead
 * nowhere. `EmptyState`'s own header states the rule both follow — name the
 * condition AND the next act — and an invented action is how the second half
 * gets faked when there is no next act to name.
 *
 * THE WRAPPER MATCHES EVERY OTHER TOP-LEVEL `EmptyState` IN THIS DASH
 * (`no-projects-empty-state.tsx`, `no-workspace-empty-state.tsx`,
 * `no-assignments-empty-state.tsx`): `mx-auto max-w-112 py-16`. The route's own
 * `max-w-content p-6` wrapper is a different measurement doing a different job
 * — it is the page's column, 1240px wide, and an empty state stretched across
 * it reads as a paragraph rather than as a notice. `max-w-112`, never
 * `max-w-md`, for the reason `no-assignments-empty-state.tsx`'s header
 * measures at length: this theme clears `--container-*`, so `max-w-md` emits no
 * CSS at all on a dash route.
 *
 * Catalogued as `dash.assignment_create.no_baseline_title` /
 * `dash.assignment_create.no_baseline_body`.
 */
export function NoBaselineEmptyState() {
  return (
    <EmptyState
      className="mx-auto max-w-112 py-16"
      title="У проєкті ще немає опублікованої версії договору"
      description="Доручення створюють на рядок кошторису, тому спершу потрібна опублікована версія договору з рядками."
    />
  );
}
