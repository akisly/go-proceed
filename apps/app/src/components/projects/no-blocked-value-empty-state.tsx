import { EmptyState } from "@goproceed/ui/components";
import { ProjectPage } from "./project-page";
import { ReadinessBlock, type ReadinessView } from "./project-readiness";

/**
 * `getBlockedValue`'s `ok` branch with an empty `blockedReasons` array —
 * every additive field the money screen renders (`totalsByCurrency`,
 * `byCause`, `unvaluedRegister`, `unvaluedAssignmentCount`,
 * `zeroPricedAssignmentCount`) is built FROM `blockedReasons`
 * (`apps/app/src/lib/blocked-value.ts`'s `summariseBlockedValue`), so an
 * empty drill-down array is both necessary and sufficient for "nothing is
 * blocked" — checked against that module, not assumed from the field's name
 * alone.
 *
 * «НІЧОГО НЕ ЗАБЛОКОВАНО» IS AN ACHIEVEMENT, NOT AN ABSENCE OF DATA — the
 * task brief's own instruction, and `EmptyState`'s own header backs the
 * shape this takes: "«Немає даних» is not an empty state; it is a shrug…
 * every empty state… names the condition and the next act." The condition
 * here is genuinely good news (every live obligation on this project is
 * either satisfied or has no money behind it), so the description says that
 * in terms rather than the neutral "nothing found" wording a generic empty
 * state would reach for.
 *
 * `max-w-md`: stock Tailwind's 28rem, back since the theme stopped clearing
 * stock namespaces (2026-09-24, DEV-073, BL-047).
 */
export function NoBlockedValueEmptyState({
  projectId, projectName, readiness,
}: {
  projectId: string;
  projectName: string | null;
  readiness: ReadinessView;
}) {
  return (
    <ProjectPage projectId={projectId} projectName={projectName} tab="overview">
      <EmptyState
        className="mx-auto max-w-md py-16"
        title="Нічого не заблоковано"
        description="Жодна вимога на цьому проєкті не тримає гроші заблокованими: усе або підтверджено, або ще не має ціни, за якою можна щось заблокувати."
      />
      {/* DEV-035: nothing blocked is not nothing to show — the stages may
        * still be open, and the readiness block says which. */}
      <ReadinessBlock readiness={readiness} />
    </ProjectPage>
  );
}
