import type { ReadinessResponse } from "@goproceed/contracts";
import { Banner, Meter, Panel, PanelBody, PanelHeader, Waffle } from "@goproceed/ui/components";
import { readinessColumns, readinessSegments, requirementsSummary } from "../../lib/stage-readiness";

/**
 * The readiness block of the project page (DEV-035): the reference's
 * «Workflow breakdown» bar and its cell chart, over the project's work stages
 * — `GET /v1/projects/{id}/readiness`, computed live, never a projection.
 *
 * Left, every stage in one of four states, each named in the legend
 * (`readinessSegments` explains why a stage with no requirement is not
 * «ready»). Right, the requirements themselves: a column per stage, a cell
 * per BLOCKING requirement occurrence, filled when it is satisfied. The count is in
 * the caption, so the drawing can stay `aria-hidden`.
 */
export function ProjectReadiness({ readiness }: { readiness: ReadinessResponse }) {
  const { summary } = readiness;
  const columns = readinessColumns(readiness.stages);

  return (
    <Panel>
      <PanelHeader title="Готовність етапів" count={summary.stageCount} />
      <PanelBody>
        {summary.stageCount === 0 ? (
          <p className="text-data text-ink-muted">На цьому проєкті ще немає етапів робіт.</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="text-meta font-medium text-ink-secondary">Етапи за станом</h3>
              <Meter segments={readinessSegments(summary)} />
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <h3 className="text-meta font-medium text-ink-secondary">Вимоги по етапах</h3>
              {columns.length === 0 ? (
                <p className="text-data text-ink-muted">На етапах цього проєкту немає жодної вимоги, що блокує закриття.</p>
              ) : (
                <Waffle columns={columns} summary={requirementsSummary(columns)} />
              )}
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

/**
 * What the page knows about readiness, as the block needs it (DEV-035 review,
 * R1-12): `hidden` for a 403/404 — the member may not read it, and the rest of
 * the page stands — and `error` for anything else, which says so in one line
 * instead of the block silently disappearing.
 */
export type ReadinessView =
  | { kind: "ok"; readiness: ReadinessResponse }
  | { kind: "hidden" }
  | { kind: "error" };

export function ReadinessBlock({ readiness }: { readiness: ReadinessView }) {
  if (readiness.kind === "ok") return <ProjectReadiness readiness={readiness.readiness} />;
  if (readiness.kind === "error") {
    return <Banner tone="attention" title="Готовність етапів зараз недоступна. Спробуйте оновити сторінку." />;
  }
  return null;
}
