import { describe, expect, it } from "vitest";
import type { ReadinessResponse } from "@goproceed/contracts";
import { readinessColumns, readinessSegments, requirementsSummary, stagesOutOf } from "./stage-readiness";

type Summary = ReadinessResponse["summary"];
type Stage = ReadinessResponse["stages"][number];
type Occurrence = Stage["occurrences"][number];

const summary = (s: Partial<Summary>): Summary => ({
  stageCount: 0, closableCount: 0, blockedCount: 0, closedCount: 0, vacuouslyClosableCount: 0, ...s,
});

const occurrence = (satisfied: boolean, blocksStageClosure = true): Occurrence =>
  ({ satisfied, blocksStageClosure } as Occurrence);
/** Mirrors the route: the two counts are over the BLOCKING occurrences only. */
const stage = (id: string, occurrences: Occurrence[]): Stage => {
  const blocking = occurrences.filter((o) => o.blocksStageClosure);
  return {
    workStageId: id,
    occurrences,
    blockingOccurrenceCount: blocking.length,
    satisfiedOccurrenceCount: blocking.filter((o) => o.satisfied).length,
  } as unknown as Stage;
};

describe("readinessSegments", () => {
  it("splits the closable stages into those with obligations and the vacuous ones (INV-072)", () => {
    const segments = readinessSegments(summary({
      stageCount: 12, closableCount: 5, vacuouslyClosableCount: 2, blockedCount: 4, closedCount: 3,
    }));
    expect(segments.map((s) => [s.id, s.count, s.tone])).toEqual([
      ["closable", 3, "ready"],
      ["vacuous", 2, "attention"],
      ["blocked", 4, "blocked"],
      ["closed", 3, "idle"],
    ]);
    // Every stage is counted once: the four parts make the whole.
    expect(segments.reduce((n, s) => n + s.count, 0)).toBe(12);
  });

  it("names the vacuous stages for what they are, never as «ready»", () => {
    const vacuous = readinessSegments(summary({ stageCount: 1, closableCount: 1, vacuouslyClosableCount: 1 }))
      .find((s) => s.id === "vacuous");
    expect(vacuous?.label).toBe("Без вимог — можна закрити без доказів");
  });
});

describe("readinessColumns", () => {
  it("draws one column per stage that carries requirements, filled by the satisfied ones", () => {
    const columns = readinessColumns([
      stage("a", [occurrence(true), occurrence(false), occurrence(true)]),
      stage("b", []),
      stage("c", [occurrence(false)]),
    ]);
    expect(columns).toEqual([
      { id: "a", filled: 2, total: 3 },
      { id: "c", filled: 0, total: 1 },
    ]);
  });
});

describe("readinessColumns — what it does not count (R1-01)", () => {
  it("ignores requirements that block nothing, so a vacuous stage draws no column", () => {
    const columns = readinessColumns([
      stage("vacuous", [occurrence(false, false), occurrence(false, false)]),
      stage("mixed", [occurrence(true), occurrence(false, false)]),
    ]);
    expect(columns).toEqual([{ id: "mixed", filled: 1, total: 1 }]);
  });
});

describe("requirementsSummary", () => {
  it("writes the count in words, with the Ukrainian plural (11–14 take the genitive plural)", () => {
    expect(requirementsSummary([{ id: "a", filled: 11, total: 14 }]))
      .toBe("11 з 14 вимог виконано · 1 етап");
    expect(requirementsSummary([{ id: "a", filled: 1, total: 1 }, { id: "b", filled: 0, total: 1 }]))
      .toBe("1 з 2 вимог виконано · 2 етапи");
    expect(requirementsSummary([{ id: "a", filled: 0, total: 21 }]))
      .toBe("0 з 21 вимоги виконано · 1 етап");
  });
});

describe("stagesOutOf", () => {
  it("agrees the noun with the last word of N, teens included", () => {
    expect(stagesOutOf(1)).toBe("з 1 етапу");
    expect(stagesOutOf(2)).toBe("з 2 етапів");
    expect(stagesOutOf(11)).toBe("з 11 етапів");
    expect(stagesOutOf(21)).toBe("з 21 етапу");
  });
});
