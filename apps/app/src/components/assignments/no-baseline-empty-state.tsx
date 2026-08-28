import { EmptyState } from "@goproceed/ui/components";

/**
 * `/dash/projects/{projectId}/assignments/new` renders this when
 * `listPublishedBaselines` returns none — the expected state of a fresh pilot
 * project, not an error. Доручення are created against a work item, and a
 * work item only exists on a published contract version's own line list
 * (`baseline.service.ts`'s own header: "a project with no published baseline
 * has no row here, and nothing else can enumerate its contracts"). Slice C —
 * publishing a baseline — is what ends this state; this screen has nothing to
 * offer beyond naming it, matching `no-assignments-empty-state.tsx`'s own
 * shape one level up (name the condition, no dead-end action invented for it).
 *
 * Catalogued as `dash.assignment_create.no_baseline_title` /
 * `dash.assignment_create.no_baseline_body`.
 */
export function NoBaselineEmptyState() {
  return (
    <EmptyState
      title="У проєкті ще немає опублікованої версії договору"
      description="Доручення створюють на рядок кошторису, тому спершу потрібна опублікована версія договору з рядками."
    />
  );
}
