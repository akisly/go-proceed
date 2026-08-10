import { describe, it, expect } from "vitest";
import {
  createUploadIntentRequest, listRequirementOccurrencesResponse, projectCapability,
  requirementOccurrenceDryRunRequest,
} from "./index";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written with no node_modules,
 * no database and no docker available: `vitest` and `tsc` were never run against
 * it, and no claim is made that any assertion below passes. Static reading is
 * the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M2, application layer: the two occurrence operations and the two deployed
 * contracts they change. What is asserted here is the REQUIRED shape — the
 * things that must be true of the wire for the gate to be a gate — and not the
 * shape the code happens to have.
 */

const OCCURRENCE = {
  occurrenceId: "11111111-1111-1111-1111-111111111111",
  workAssignmentId: "22222222-2222-2222-2222-222222222222",
  ruleVersionId: "33333333-3333-3333-3333-333333333333",
  ordinal: 1,
  stage: {
    stageId: "44444444-4444-4444-4444-444444444444",
    stageKey: "prykhovani-roboty",
    isConcealed: true,
  },
  interventionType: "hold" as const,
  blockingScope: "blocks_stage_closure" as const,
  timing: "before_concealment" as const,
  evidenceKind: "photo" as const,
  acceptanceCriterion: "Приклад-критерій приймання",
  performerRole: "foreman",
  approverRole: "technical_supervisor",
  approverIsExternal: false,
  minEvidenceCount: 1,
  maxEvidenceCount: null,
  allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 5 * 1024 * 1024 },
  normRef: {
    text: "ДБН А.3.1-5:2016, Додаток Н (довідковий), позиція Н.15",
    verification: "VERIFIED_PRIMARY" as const,
    source: "Приклад-джерело",
  },
  materialisedAt: "2026-08-07T09:00:00.000Z",
};

const RESPONSE = {
  workAssignmentId: OCCURRENCE.workAssignmentId,
  contractVersionId: "55555555-5555-5555-5555-555555555555",
  occurrences: [OCCURRENCE],
  coverage: "covered" as const,
};

describe("requirement_occurrences.list — the foreman's read before work starts", () => {
  it("accepts a fully attributed occurrence", () => {
    expect(listRequirementOccurrencesResponse.safeParse(RESPONSE).success).toBe(true);
  });

  // INV-073, rendering half. A normative string may be SHOWN only with its
  // verification tag and its source; the storage half is
  // requirement_occurrences_norm_ref_sourced_check (migration 0043) and this is
  // the boundary that refuses to render what somehow got past it.
  it("refuses a citation with no verification tag", () => {
    const bad = { ...RESPONSE, occurrences: [{ ...OCCURRENCE,
      normRef: { text: OCCURRENCE.normRef.text, source: "Приклад-джерело" } }] };
    expect(listRequirementOccurrencesResponse.safeParse(bad).success).toBe(false);
  });

  it("refuses a citation with a blank source", () => {
    // NOT NULL admits '' and '   ', and neither is a source. The btrim form is
    // the same one the library row and the rule version use.
    const bad = { ...RESPONSE, occurrences: [{ ...OCCURRENCE,
      normRef: { ...OCCURRENCE.normRef, source: "   " } }] };
    expect(listRequirementOccurrencesResponse.safeParse(bad).success).toBe(false);
  });

  it("carries no satisfaction and no status field", () => {
    // Satisfaction is a projection over decisions, exceptions and review heads
    // and M3 ships it. A field here would be read as «not yet satisfied» by the
    // milestone that cannot compute it, and .strict() is what stops one being
    // added without this test failing.
    const bad = { ...RESPONSE, occurrences: [{ ...OCCURRENCE, satisfied: false }] };
    expect(listRequirementOccurrencesResponse.safeParse(bad).success).toBe(false);
  });

  it("makes an empty set explain itself", () => {
    // Silent non-coverage means there is no gate (INV-072). An empty array with
    // no reason cannot distinguish «no obligation», «no bindings» and «could not
    // be computed», and those have three different owners.
    const empty = { ...RESPONSE, occurrences: [] };
    expect(listRequirementOccurrencesResponse.safeParse(
      { ...empty, coverage: "no_bindings" }).success).toBe(true);
    expect(listRequirementOccurrencesResponse.safeParse(
      { ...empty, coverage: "work_type_unresolved" }).success).toBe(true);
    const { coverage: _dropped, ...withoutReason } = empty;
    expect(listRequirementOccurrencesResponse.safeParse(withoutReason).success).toBe(false);
  });
});

describe("requirement_occurrences.dry_run", () => {
  it("takes an empty body, because the baseline is in the path", () => {
    expect(requirementOccurrenceDryRunRequest.safeParse({}).success).toBe(true);
  });

  it("refuses a contract version named in the body", () => {
    // The decision version-0.1.md left open is resolved by the PATH gaining the
    // version. Accepting one in the body as well would let the two disagree
    // while both are well-formed, and the coverage report would be true of a
    // baseline the caller did not name.
    expect(requirementOccurrenceDryRunRequest
      .safeParse({ contractVersionId: "55555555-5555-5555-5555-555555555555" })
      .success).toBe(false);
  });
});

describe("upload_intents.create — the occurrence becomes the media authority", () => {
  const VALID = {
    expectedContentHash: "a".repeat(64),
    expectedByteSize: 1024,
    claimedMediaType: "image/jpeg",
    deviceCaptureId: "device-capture-1",
    originMethod: "photo_picker" as const,
  };

  it("accepts the requirement occurrence the original is captured against", () => {
    expect(createUploadIntentRequest.safeParse(
      { ...VALID, requirementOccurrenceId: OCCURRENCE.occurrenceId }).success).toBe(true);
  });

  it("still accepts an intent that names none", () => {
    // The column is nullable and an intent captured outside the requirement
    // flow is legal. Requiring it would have broken every deployed caller on a
    // day when no occurrence can be materialised at all.
    expect(createUploadIntentRequest.safeParse(VALID).success).toBe(true);
  });
});

describe("the project capability vocabulary", () => {
  it("carries requirements.assign, the governor of the dry run", () => {
    // The vocabulary lives in three places and is derived in none: this enum,
    // ProjectCapability in @goproceed/domain, and the CHECK on
    // public.project_access_grants (widened by migration 0044).
    // capability-vocabulary.test.ts asserts the enum and the CHECK agree; this
    // asserts the value exists at all, which is what makes the dry-run route's
    // capability check satisfiable by a grant row.
    expect(projectCapability.options).toContain("requirements.assign");
  });
});
