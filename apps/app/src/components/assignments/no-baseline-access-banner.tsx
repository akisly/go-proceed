import { Banner } from "@goproceed/ui/components";

/**
 * `listPublishedBaselines`'s `forbidden` branch on
 * `/projects/{projectId}/assignments/new` — the refusal that used to
 * render as `ShellFatalError`.
 *
 * WHO SEES IT, TRACED RATHER THAN ASSUMED. The screen's only source of a
 * project's published baselines is `blocked_value.get`
 * (`baseline.service.ts`'s header: no `contracts.list` exists), and that route
 * calls `requireProjectCapability(…, "readiness.view")` before anything else
 * it does. `readiness.view` is implied only by `project.admin`
 * (`authz.ts`'s `IMPLIED_BY_PROJECT_ADMIN`), and four presets in
 * `technical/permissions/responsibility-presets.csv` grant `project.view`
 * without it — `requirement_owner`, `internal_verifier`, `package_submitter`
 * and `foreman`. Such a member ALSO holding `assignments.manage` can create a
 * доручення through the API and could not, until this state existed, create
 * one through the screen built for it: the register offered «Нове доручення»
 * (nothing client-side can read a capability, so the control is unconditional)
 * and the destination answered «щось пішло не так».
 *
 * IT NAMES WHAT IS MISSING, IN UKRAINIAN, AND NOT THE CAPABILITY TOKEN.
 * `readiness.view` is an English identifier out of a CSV; putting it in front
 * of a reader is the same defect class this branch already caught once with
 * the raw membership roles in the виконавець picker. The sentence names the
 * thing the reader actually lacks — the project's readiness and money view —
 * and the person who can grant it.
 *
 * THE SERVER'S OWN `detail` IS NOT RENDERED HERE, unlike
 * `project-money-forbidden.tsx` one screen over, and the difference is not an
 * oversight. That route's single 403 says «Немає доступу до цього проєкту.»,
 * which is true of the money read and false of what the reader is looking at:
 * they reached this screen from this project's own register, so telling them
 * they have no access to the project contradicts the page they came from.
 * `baseline.service.ts`'s `forbidden` arm therefore carries no `detail` at
 * all, and its header records why.
 *
 * `tone="attention"` AND NOT `blocked`: nothing here is a failure or a
 * hold — it is a boundary, and it is the same tone
 * `project-money-forbidden.tsx` gives the identical refusal. `Banner` renders
 * a title and a sentence, so the state is never carried by colour alone.
 *
 * Catalogued as `dash.assignment_create.no_readiness_title` /
 * `dash.assignment_create.no_readiness_body`.
 */
export function NoBaselineAccessBanner() {
  return (
    <Banner tone="attention" title="Немає доступу до кошторисів цього проєкту">
      Щоб створити доручення, цей екран читає опубліковані версії договору разом із
      готовністю та заблокованою вартістю проєкту — а на цей перегляд у вас немає
      доступу. Попросіть адміністратора проєкту відкрити його, або створіть доручення
      через того, хто вже його має.
    </Banner>
  );
}
