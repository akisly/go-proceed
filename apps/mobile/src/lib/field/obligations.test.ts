import { describe, it, expect } from "vitest";
import { buildObligationScreen, COVERAGE_MESSAGE } from "./obligations";
import { DOVIDKOVYI_DISCLAIMER_TEXT } from "./disclaimer";

/**
 * PORT of apps/app/src/lib/field/obligations.test.ts — byte-identical
 * assertions. `buildObligationScreen` is the whole of the obligation
 * screen's decision layer — `src/screens/assignment.tsx` is a dumb consumer
 * of what this file proves. Node-only vitest, no RN/jsdom.
 */

// Inlined from @goproceed/contracts (not a mobile app dependency) — same
// shapes `./obligations.ts` inlines, kept in sync with it by hand.
interface NormativeCitation {
  text: string;
  // Kept in sync BY HAND with `packages/contracts/src/requirement-library.ts`'s
  // `verificationTag` — this app has no dependency on `@goproceed/contracts` to
  // import it from (see the file header). Widened to three values by migration
  // 0059/ADR-010: `PROJECT_DOCUMENTATION` names an origin (a workspace's own
  // робоча документація), not a verification strength, and is never a
  // downgrade target or source for the other two.
  verification: "VERIFIED_PRIMARY" | "VERIFIED_SECONDARY" | "PROJECT_DOCUMENTATION";
  source: string;
}

type RequirementTimingValue =
  "before_work" | "during" | "before_concealment" | "after" | "before_package";
type EvidenceKindValue = "photo" | "measurement" | "document" | "checkbox";

interface RequirementOccurrenceView {
  occurrenceId: string;
  workAssignmentId: string;
  ruleVersionId: string;
  ordinal: number;
  stage: { stageId: string | null; stageKey: string; isConcealed: boolean | null };
  interventionType: "hold" | "witness" | "review";
  blockingScope: "none" | "blocks_stage_closure" | "blocks_package_inclusion" | "blocks_both";
  timing: RequirementTimingValue;
  evidenceKind: EvidenceKindValue;
  acceptanceCriterion: string;
  performerRole: string;
  approverRole: string;
  approverIsExternal: boolean;
  minEvidenceCount: number;
  maxEvidenceCount: number | null;
  allowedMedia: { mimeTypes: string[]; maxByteSize: number } | null;
  normRef: NormativeCitation | null;
  materialisedAt: string;
}

interface ListRequirementOccurrencesResponse {
  workAssignmentId: string;
  contractVersionId: string;
  occurrences: RequirementOccurrenceView[];
  coverage: "covered" | "no_bindings" | "no_matching_rule" | "work_type_unresolved";
}

const OCCURRENCE = (over: Partial<RequirementOccurrenceView> = {}): RequirementOccurrenceView => ({
  occurrenceId: "00000000-0000-0000-0000-000000000001",
  workAssignmentId: "11111111-1111-1111-1111-111111111111",
  ruleVersionId: "22222222-2222-2222-2222-222222222222",
  ordinal: 1,
  stage: { stageId: "33333333-3333-3333-3333-333333333333", stageKey: "foundation", isConcealed: true },
  interventionType: "hold",
  blockingScope: "blocks_stage_closure",
  timing: "before_work",
  evidenceKind: "photo",
  acceptanceCriterion: "Перевірити відповідність арматурного каркаса проєкту.",
  performerRole: "foreman",
  approverRole: "site_engineer",
  approverIsExternal: false,
  minEvidenceCount: 1,
  maxEvidenceCount: 3,
  allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 10_000_000 },
  normRef: null,
  materialisedAt: "2026-08-10T09:00:00.000Z",
  ...over,
});

const RESPONSE = (
  over: Partial<ListRequirementOccurrencesResponse> = {},
): ListRequirementOccurrencesResponse => ({
  workAssignmentId: "11111111-1111-1111-1111-111111111111",
  contractVersionId: "44444444-4444-4444-4444-444444444444",
  occurrences: [OCCURRENCE()],
  coverage: "covered",
  ...over,
});

describe("order — the route sorts, this function must not re-sort", () => {
  it("keeps before_work first when the route (correctly) put it first", () => {
    const screen = buildObligationScreen(RESPONSE({
      occurrences: [
        OCCURRENCE({ occurrenceId: "occ-1", timing: "before_work" }),
        OCCURRENCE({ occurrenceId: "occ-2", timing: "during" }),
        OCCURRENCE({ occurrenceId: "occ-3", timing: "before_concealment" }),
      ],
    }));
    expect(screen.items.map((i) => i.occurrenceId)).toEqual(["occ-1", "occ-2", "occ-3"]);
    expect(screen.items[0]!.timing).toBe("before_work");
  });

  it("does not impose its own sort — an out-of-canonical-order input passes through unchanged", () => {
    // Deliberately NOT in timing order. If this function sorted on its own
    // opinion of the right order, this would come back reordered; it must not.
    const screen = buildObligationScreen(RESPONSE({
      occurrences: [
        OCCURRENCE({ occurrenceId: "occ-during", timing: "during" }),
        OCCURRENCE({ occurrenceId: "occ-before-work", timing: "before_work" }),
      ],
    }));
    expect(screen.items.map((i) => i.occurrenceId)).toEqual(["occ-during", "occ-before-work"]);
  });
});

describe("normRef — never text alone", () => {
  it("carries text WITH its verification tag and its source, unaltered", () => {
    const screen = buildObligationScreen(RESPONSE({
      occurrences: [OCCURRENCE({
        normRef: {
          text: "Дослівний текст позиції Додатка Н.",
          verification: "VERIFIED_PRIMARY",
          source: "ДБН А.3.1-5:2016, Додаток Н (довідковий), позиція Н.15",
        },
      })],
    }));
    expect(screen.items[0]!.normRef).toEqual({
      text: "Дослівний текст позиції Додатка Н.",
      verification: "VERIFIED_PRIMARY",
      source: "ДБН А.3.1-5:2016, Додаток Н (довідковий), позиція Н.15",
    });
  });

  it("renders with no citation at all when normRef is null, rather than inventing one", () => {
    const screen = buildObligationScreen(RESPONSE({
      occurrences: [OCCURRENCE({ normRef: null })],
    }));
    expect(screen.items[0]!.normRef).toBeNull();
  });
});

describe("acceptanceCriterion — verbatim, byte-for-byte", () => {
  it("is not trimmed, normalized, or otherwise 'fixed'", () => {
    // Deliberately ugly: leading/trailing space, curly quotes, an ellipsis,
    // double spacing. A formatter that "fixes" any of this changes a
    // regulatory document — this string must survive unchanged.
    const raw = "  Перевірити «якість» звʼязку   та   ущільнення…  ";
    const screen = buildObligationScreen(RESPONSE({
      occurrences: [OCCURRENCE({ acceptanceCriterion: raw })],
    }));
    expect(screen.items[0]!.acceptanceCriterion).toBe(raw);
  });
});

describe("coverage — four values, three of them refusals, none read as 'nothing required'", () => {
  const ALL_COVERAGE = [
    "covered", "no_bindings", "no_matching_rule", "work_type_unresolved",
  ] as const;

  it("gives every value a non-empty Ukrainian sentence", () => {
    for (const coverage of ALL_COVERAGE) {
      const screen = buildObligationScreen(RESPONSE({ coverage, occurrences: [] }));
      expect(screen.coverageMessage.length).toBeGreaterThan(0);
      expect(screen.coverageMessage).toBe(COVERAGE_MESSAGE[coverage]);
    }
  });

  it("never gives two coverage values the same message", () => {
    const messages = ALL_COVERAGE.map(
      (coverage) => buildObligationScreen(RESPONSE({ coverage, occurrences: [] })).coverageMessage,
    );
    expect(new Set(messages).size).toBe(ALL_COVERAGE.length);
  });
});

describe("the довідковий disclaimer — mandatory, never collapsed, imported not typed", () => {
  const ALL_COVERAGE = [
    "covered", "no_bindings", "no_matching_rule", "work_type_unresolved",
  ] as const;

  it("is present, byte-identical to DOVIDKOVYI_DISCLAIMER_TEXT, for every coverage value", () => {
    for (const coverage of ALL_COVERAGE) {
      const screen = buildObligationScreen(RESPONSE({ coverage, occurrences: [] }));
      expect(screen.disclaimer).toBe(DOVIDKOVYI_DISCLAIMER_TEXT);
    }
  });
});

describe("no satisfaction indicator of any kind", () => {
  it("carries no satisfied/status field on the screen or on any item — M3 computes that, not this", () => {
    const screen = buildObligationScreen(RESPONSE());
    expect(screen).not.toHaveProperty("satisfied");
    expect(screen).not.toHaveProperty("status");
    const item = screen.items[0] as unknown as Record<string, unknown>;
    expect(item).not.toHaveProperty("satisfied");
    expect(item).not.toHaveProperty("status");
  });
});
