import type { ReadinessResponse } from "@goproceed/contracts";
import type { MeterSegment, WaffleColumn } from "@goproceed/ui/components";
import { pluralUk } from "./format-uk";

/**
 * How the project page draws `GET /v1/projects/{id}/readiness` (DEV-035).
 * Pure, so the arithmetic is tested without a route or a browser.
 *
 * THE VACUOUS STAGES GET THEIR OWN SEGMENT, AND IT IS NOT GREEN. The route
 * counts a stage with no applicable obligation as closable — `∀` over an
 * empty set is true — and reports how many of those there are in
 * `vacuouslyClosableCount` precisely so a dashboard does not read «12 of 12
 * ready» over twelve empty stages (INV-072, the note on that field in
 * `packages/contracts/src/readiness.ts`). So `closable` is split: the stages
 * whose requirements are met are «ready»; the ones with none are named for
 * what they are and take the attention tone, because a stage that closes
 * without evidence is exactly what someone should look at.
 *
 * Tones map onto STATES (the Semantic Risk Rule), each with its label beside
 * it in `Meter`'s legend: ready — can close now; attention — closes with no
 * gate; blocked — cannot close; idle — already closed, nothing to do.
 */
export function readinessSegments(summary: ReadinessResponse["summary"]): MeterSegment[] {
  const vacuous = summary.vacuouslyClosableCount;
  return [
    { id: "closable", label: "Можна закрити", count: summary.closableCount - vacuous, tone: "ready" },
    { id: "vacuous", label: "Без вимог — можна закрити без доказів", count: vacuous, tone: "attention" },
    { id: "blocked", label: "Заблоковано", count: summary.blockedCount, tone: "blocked" },
    { id: "closed", label: "Закрито", count: summary.closedCount, tone: "idle" },
  ];
}

/**
 * One column per stage that carries at least one BLOCKING requirement — an
 * occurrence that stops the stage from closing — and a cell per such
 * requirement, filled when the predicate counts it satisfied. Read from the
 * route's own `blockingOccurrenceCount` / `satisfiedOccurrenceCount`, the same
 * set the vacuous segment above is defined by (`vacuous: blocking.length ===
 * 0`, `src/lib/readiness.ts`), so the grid and the bar count the same things.
 *
 * NOT `stage.occurrences`: that list also carries requirements that block
 * nothing (`none`, `blocks_package_inclusion`) and, in v0.1, witness and
 * review requirements that no evidence decision can satisfy — drawn here they
 * would put a column of empty cells under a stage the legend calls «без
 * вимог», and understate progress for good (DEV-035 review, R1-01).
 *
 * A stage with no blocking requirement draws nothing: an open one is counted
 * by name in the vacuous segment, a closed one in «Закрито».
 */
export function readinessColumns(stages: ReadinessResponse["stages"]): WaffleColumn[] {
  return stages
    .filter((stage) => stage.blockingOccurrenceCount > 0)
    .map((stage) => ({
      id: stage.workStageId,
      filled: stage.satisfiedOccurrenceCount,
      total: stage.blockingOccurrenceCount,
    }));
}

/**
 * «11 з 14 вимог виконано · 1 етап». After «з N» the noun agrees with N's
 * last word: genitive singular after 1 (but not 11), genitive plural
 * otherwise — «з 21 вимоги», «з 2 вимог», «з 14 вимог».
 */
export function requirementsSummary(columns: WaffleColumn[]): string {
  const filled = columns.reduce((n, c) => n + c.filled, 0);
  const total = columns.reduce((n, c) => n + c.total, 0);
  return `${filled} з ${total} ${pluralUk(total, "вимоги", "вимог", "вимог")} виконано · `
    + `${columns.length} ${pluralUk(columns.length, "етап", "етапи", "етапів")}`;
}

/**
 * «з 1 етапу», «з 3 етапів», «з 21 етапу» — the KPI card's unit. After «з N»
 * the noun agrees with N's last word, as in `requirementsSummary` (DEV-035
 * reviews U1-01 / R2-01: it was «з ${n} етапів» for every n).
 */
export function stagesOutOf(n: number): string {
  return `з ${n} ${pluralUk(n, "етапу", "етапів", "етапів")}`;
}
