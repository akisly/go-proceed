import type { AssignmentEvidenceResponse } from "@goproceed/contracts";
import { Panel, PanelBody } from "@goproceed/ui/components";
import { EvidenceCard } from "./evidence-card";
import { IssueReviewLink } from "./issue-review-link";

/**
 * `app/(dash)/assignments/[assignmentId]/page.tsx`'s landing content once at
 * least one evidence group exists — one section per
 * `GET /v1/assignments/{assignmentId}/evidence` group, in the order the
 * route already returns it. THE SCREEN THIS WHOLE SLICE EXISTS FOR: ПТВ
 * finds a photo by assignment instead of scrolling a chat.
 *
 * NO CLIENT-SIDE SORT OF ITS OWN, matching `assignments-list.tsx`'s own
 * precedent ("no client-side sort or filter of its own"). The route
 * (`app/v1/assignments/[assignmentId]/evidence/route.ts:96-132`) builds
 * `groups` by construction — a `Map` keyed on occurrence id, with the null
 * group pushed explicitly LAST after every keyed one — not by an ORDER BY a
 * later query change could disturb, so trusting that order here is trusting
 * a documented invariant, not an accident of today's SQL.
 *
 * THE NULL GROUP GETS ITS OWN UKRAINIAN LABEL, NEVER HIDDEN. An upload
 * intent may legally carry no occurrence (`packages/contracts/src/
 * evidence.ts`'s own header: "the fallback's only remaining door") — a
 * screen that dropped it would tell ПТВ an assignment has no evidence when
 * it has evidence, exactly the failure this slice exists to end.
 *
 * OCCURRENCE SECTIONS HEAD THEMSELVES WITH THE OCCURRENCE'S OWN ID, NOT A
 * HUMAN LABEL — there is no human-readable occurrence title to show. The
 * only interface this screen consumes is `assignmentEvidenceResponse`
 * (task brief's own "Interfaces" list), which carries `occurrenceId` as a
 * bare UUID and nothing else; `RequirementOccurrenceView` (the object that
 * DOES carry a description) is a different, unconsumed endpoint
 * (`GET /v1/assignments/{assignmentId}/requirement-occurrences`), and
 * fetching it here would be undocumented scope this task's interface list
 * does not authorise. `break-all`, not `truncate` and not a plain `<span>`
 * in the header's own flex row — a 36-character UUID at `text-meta` does not
 * fit a 360px viewport's panel width without wrapping (§6's own check), and
 * `break-all` is what makes it wrap instead of overflow.
 *
 * THE SECTION HEADER BELOW RE-IMPLEMENTS `PanelHeader`'S OWN SPEC
 * (title + count on one baseline, `border-b border-line px-4 py-3`) RATHER
 * THAN IMPORTING IT — named here on fix round 1's request, having shipped
 * unnamed. The reason is real: `PanelHeader`'s `title` prop is typed
 * `string`, with no slot for a second line, and this header needs one (the
 * occurrence id, directly below the title/count row). Composing
 * `<PanelHeader actions={…}>` instead was considered and rejected — the
 * `actions` slot is `ml-auto flex items-center gap-2`, a single
 * non-wrapping row, and a 36-character monospace UUID does not fit it at
 * 360px without overflowing exactly the way `break-all` on its own line
 * avoids. The cost of the inline copy, stated rather than left implicit:
 * this file's `border-b border-line px-4 py-3`/`text-h3 font-semibold
 * text-ink`/`tabular text-meta text-ink-muted` classes are a duplicate of
 * `packages/ui/src/components/Panel.tsx`'s `PanelHeader`, and will silently
 * stop matching it if that component's own spacing or type scale ever
 * changes. Revisit if `PanelHeader` grows a slot for a second line, or if a
 * second screen needs this same shape.
 */
export function EvidenceByOccurrence({
  assignmentId, groups,
}: {
  assignmentId: string;
  groups: AssignmentEvidenceResponse["groups"];
}) {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 font-semibold text-ink">Докази</h1>
        <p className="text-meta text-ink-muted">
          Доручення <span className="break-all font-mono">{assignmentId}</span>
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <Panel key={group.occurrenceId ?? "unbound"}>
            <div className="flex flex-col gap-1 border-b border-line px-4 py-3">
              <div className="flex items-baseline gap-3">
                <h2 className="text-h3 font-semibold text-ink">
                  {group.occurrenceId === null ? "Без прив'язки до вимоги" : "Вимога"}
                </h2>
                <span className="tabular text-meta text-ink-muted">{group.evidence.length}</span>
              </div>
              {group.occurrenceId !== null && (
                <p className="break-all font-mono text-meta text-ink-muted">
                  {group.occurrenceId}
                </p>
              )}
            </div>
            <PanelBody className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 wide:grid-cols-3">
                {group.evidence.map((item) => (
                  <EvidenceCard key={item.evidenceObjectId} item={item} />
                ))}
              </div>
              {/* PER GROUP, AND ONLY WHERE THERE IS AN OCCURRENCE TO SCOPE IT
               * TO. `occurrence_grants.issue` is scoped to ONE requirement
               * occurrence — that is the whole of ADR-005 decision 9, the
               * scope that lets an external approver decide before any package
               * version exists — so the null group, whose photos are bound to
               * no obligation at all, has nothing a grant could name. It is
               * not hidden and it is not disabled: there is simply no control,
               * because there is no occurrence. */}
              {group.occurrenceId !== null && (
                <IssueReviewLink occurrenceId={group.occurrenceId} />
              )}
            </PanelBody>
          </Panel>
        ))}
      </div>
    </div>
  );
}
