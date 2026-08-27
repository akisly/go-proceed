import { describe, it, expect } from "vitest";
import {
  createContractVersionRequest,
  bindContractVersionRulesRequest,
  publishContractVersionRequest,
} from "./contract-versions";
import {
  createWorkItemRequest,
  updateWorkItemRequest,
  removeWorkItemRequest,
} from "./work-items";
import { requirementLibraryItem, requirementLibraryListResponse } from "./requirement-library";
import {
  publishRequirementRuleVersionRequest,
  retireRequirementRuleVersionRequest,
} from "./requirement-rules";
import { publishImportBatchRequest } from "./imports";

// Covers the nine v0.1-M1 operations that had no route on 2026-08-06.
//
// Every assertion below is written against the REQUIRED behaviour named by a
// numbered authority — ADR-006, the invariant catalog, or
// hidden-works-content-rules.md — and not against the shape these schemas
// happen to have. A test that pins the current shape defends whatever defect
// the shape contains.
//
// No route, no database and no migration is exercised here. These are pure
// schema tests: they say what a caller may send, never what the command does
// with it.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const HEX64 = "a".repeat(64);

describe("contract_versions.create", () => {
  it("accepts an empty body: the first version of a contract names nothing", () => {
    expect(createContractVersionRequest.safeParse({}).success).toBe(true);
  });

  it("accepts the version it supersedes", () => {
    const r = createContractVersionRequest.safeParse({ supersedesVersionId: uuid(1) });
    expect(r.success).toBe(true);
  });

  // The pins are copied from the contract inside the creating transaction. A
  // caller that could send one could publish a baseline whose numbers
  // contradict the contract they were agreed under.
  it.each(["currency", "taxMode", "taxRateBps", "roundingPolicy", "versionNo"])(
    "refuses %s: pins and version numbers are not client-supplied",
    (field) => {
      const r = createContractVersionRequest.safeParse({ [field]: "UAH" });
      expect(r.success).toBe(false);
    },
  );
});

describe("contract_versions.bind_rules", () => {
  it("accepts a set of rule versions", () => {
    const r = bindContractVersionRulesRequest.safeParse({ ruleVersionIds: [uuid(1), uuid(2)] });
    expect(r.success).toBe(true);
  });

  // INV-083: publication refuses a version with no bound set, so a binding
  // call that binds nothing is a call that cannot help it.
  it("refuses an empty set", () => {
    const r = bindContractVersionRulesRequest.safeParse({ ruleVersionIds: [] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["ruleVersionIds"]);
  });

  it("refuses a non-uuid rule version id", () => {
    const r = bindContractVersionRulesRequest.safeParse({ ruleVersionIds: ["rule-1"] });
    expect(r.success).toBe(false);
  });

  it("refuses more ids than a pilot workspace can hold", () => {
    const r = bindContractVersionRulesRequest.safeParse({
      ruleVersionIds: Array.from({ length: 501 }, (_, i) => uuid(i)),
    });
    expect(r.success).toBe(false);
  });
});

describe("contract_versions.publish", () => {
  it("requires the confirmed manifest hash", () => {
    expect(publishContractVersionRequest.safeParse({}).success).toBe(false);
    expect(publishContractVersionRequest.safeParse({ confirmedManifestHash: HEX64 }).success)
      .toBe(true);
  });

  // Same 64-hex shape publishImportBatchRequest takes: one baseline, one
  // content-addressed confirmation, whichever route produced it.
  it.each([HEX64.slice(1), `${HEX64}a`, HEX64.toUpperCase(), "not-a-hash"])(
    "refuses %s as a manifest hash",
    (hash) => {
      expect(publishContractVersionRequest.safeParse({ confirmedManifestHash: hash }).success)
        .toBe(false);
    },
  );
});

describe("import_batches.publish carries the same rule-version set", () => {
  const READY = { expectedVersion: 2, confirmedManifestHash: HEX64 };

  it("accepts the set the baseline will be judged against", () => {
    const r = publishImportBatchRequest.safeParse({ ...READY, ruleVersionIds: [uuid(1), uuid(2)] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ruleVersionIds).toEqual([uuid(1), uuid(2)]);
  });

  // INV-083 REFUSES AN UNBOUND BASELINE ON BOTH ROUTES, AND THE REFUSAL IS THE
  // COMMAND'S, NOT THIS SCHEMA'S. `bindContractVersionRulesRequest` refuses an
  // empty set above because binding nothing is a call that cannot help; here
  // the request IS the publication, so `min(1)` would answer 422
  // VALIDATION_FAILED where contract_versions.publish answers 409
  // RULE_BINDING_REQUIRED with `userAction: bind_rule_versions_then_publish`
  // (technical/error-catalog.csv:120). One invariant on two routes must be one
  // code on two routes, so the schema admits the empty set and the command
  // refuses it.
  //
  // These two cases are why: adding `.min(1)` here — which reads like a
  // tightening — silently changes the refusal a pilot estimator sees from an
  // instruction into a complaint about their JSON, and both would go red.
  it("admits an empty set, so the command's 409 is the refusal a caller sees", () => {
    const r = publishImportBatchRequest.safeParse({ ...READY, ruleVersionIds: [] });
    expect(r.success).toBe(true);
  });

  it("defaults an absent set to empty rather than refusing the request", () => {
    const r = publishImportBatchRequest.safeParse(READY);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ruleVersionIds).toEqual([]);
  });

  it("refuses a non-uuid rule version id", () => {
    expect(publishImportBatchRequest.safeParse({ ...READY, ruleVersionIds: ["rule-1"] }).success)
      .toBe(false);
  });

  it("refuses more ids than a pilot workspace can hold", () => {
    expect(publishImportBatchRequest.safeParse({
      ...READY, ruleVersionIds: Array.from({ length: 501 }, (_, i) => uuid(i)),
    }).success).toBe(false);
  });
});

const LINE = {
  description: "Улаштування бетонної підготовки під підлогу",
  unitCode: "м2",
  contractQuantity: "124.500000",
  unitPriceState: "known" as const,
  unitPrice: "412.75",
};

describe("work_items.create", () => {
  it("accepts a hand-typed line and defaults its valuation basis", () => {
    const r = createWorkItemRequest.parse(LINE);
    expect(r.valuationBasis).toBe("unit_price_derived");
  });

  it("accepts the provenance fields an imported line carries", () => {
    const r = createWorkItemRequest.safeParse({
      ...LINE,
      sourceKey: "3.2.14",
      workCode: "Е11-1-2",
      section: "Розділ 3. Підлоги",
      externalRef: "КБ-2в/17",
      sourceAmountMinor: "5138738",
      predecessorWorkItemId: uuid(7),
    });
    expect(r.success).toBe(true);
  });

  // INV-054: an approved source amount is a recorded approval with a reason,
  // and public.source_amount_resolutions is keyed on an import row result. The
  // refusal must name the field, not read as an unknown-key error.
  it("refuses the approved-source-amount basis and names the field", () => {
    const r = createWorkItemRequest.safeParse({ ...LINE, valuationBasis: "approved_source_amount" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["valuationBasis"]);
  });

  // INV-038: missing and zero are different facts, and the pairing rule is the
  // deployed CHECK (unit_price_state = 'known') = (unit_price_decimal is not null).
  it("refuses state 'known' with no price", () => {
    const r = createWorkItemRequest.safeParse({ ...LINE, unitPriceState: "known", unitPrice: undefined });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["unitPrice"]);
  });

  it("refuses state 'zero' carrying a price", () => {
    const r = createWorkItemRequest.safeParse({ ...LINE, unitPriceState: "zero" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["unitPrice"]);
  });

  it("refuses a zero price dressed as 'known', because that is state 'zero'", () => {
    for (const price of ["0", "0.00", "0.000000"]) {
      const r = createWorkItemRequest.safeParse({ ...LINE, unitPriceState: "known", unitPrice: price });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(["unitPrice"]);
    }
  });

  it.each(["zero", "missing"] as const)("accepts state %s with no price", (state) => {
    const r = createWorkItemRequest.safeParse({ ...LINE, unitPriceState: state, unitPrice: undefined });
    expect(r.success).toBe(true);
  });

  // Quantity is numeric(18,6): scale 6 is the storable precision, and a
  // seventh digit silently rounded is a quantity nobody agreed to.
  it("refuses a quantity beyond scale 6", () => {
    const r = createWorkItemRequest.safeParse({ ...LINE, contractQuantity: "1.0000001" });
    expect(r.success).toBe(false);
  });

  it("refuses a negative quantity", () => {
    const r = createWorkItemRequest.safeParse({ ...LINE, contractQuantity: "-1.000" });
    expect(r.success).toBe(false);
  });

  // numeric(18,6) holds twelve integer digits. A value that cannot be written
  // must fail as a field error here, not as a numeric overflow inside the
  // transaction — the caller sees a 500 for a correctable typo otherwise.
  it("refuses a quantity or a price beyond what numeric(18,6) stores", () => {
    const twelve = "9".repeat(12);
    expect(createWorkItemRequest.safeParse({ ...LINE, contractQuantity: `${twelve}.000000` })
      .success).toBe(true);
    const over = createWorkItemRequest.safeParse({ ...LINE, contractQuantity: `${twelve}9.000000` });
    expect(over.success).toBe(false);
    if (!over.success) expect(over.error.issues[0]?.path).toEqual(["contractQuantity"]);
    expect(createWorkItemRequest.safeParse({ ...LINE, unitPrice: `${twelve}9.00` }).success)
      .toBe(false);
    expect(updateWorkItemRequest.safeParse({ contractQuantity: `${twelve}9` }).success).toBe(false);
  });

  it("refuses money as a JSON number and refuses a digit run beyond bigint", () => {
    expect(createWorkItemRequest.safeParse({ ...LINE, sourceAmountMinor: 5138738 }).success)
      .toBe(false);
    expect(createWorkItemRequest.safeParse({ ...LINE, sourceAmountMinor: "1".repeat(20) }).success)
      .toBe(false);
  });

  it("refuses a blank description", () => {
    const r = createWorkItemRequest.safeParse({ ...LINE, description: "   " });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["description"]);
  });

  // The unit is resolved to a unit_definitions row by the command, the same
  // find-or-create the importer runs. A caller naming a uuid would be naming a
  // precision it did not measure.
  it("refuses a unit definition id in place of the unit as written", () => {
    const r = createWorkItemRequest.safeParse({ ...LINE, unitDefinitionId: uuid(3) });
    expect(r.success).toBe(false);
  });

  // The importer computes these under one pin generation and publish writes
  // exactly what it computed. Accepting them here would let a caller state
  // what a line is worth.
  it.each(["netMinor", "taxMinor", "grossMinor", "position", "currency", "taxMode"])(
    "refuses %s: it is derived, not declared",
    (field) => {
      const r = createWorkItemRequest.safeParse({ ...LINE, [field]: "1" });
      expect(r.success).toBe(false);
    },
  );
});

describe("work_items.update", () => {
  it("accepts a single-field correction", () => {
    const r = updateWorkItemRequest.safeParse({ contractQuantity: "126.000000" });
    expect(r.success).toBe(true);
  });

  it("clears an optional field with null and leaves an absent one alone", () => {
    const r = updateWorkItemRequest.parse({ workCode: null });
    expect(r.workCode).toBeNull();
    expect("section" in r).toBe(false);
  });

  it("refuses a body that changes nothing", () => {
    const r = updateWorkItemRequest.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual([]);
  });

  it("refuses a price without its state", () => {
    const r = updateWorkItemRequest.safeParse({ unitPrice: "500.00" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["unitPriceState"]);
  });

  it("keeps the price-state pairing on a correction", () => {
    expect(updateWorkItemRequest.safeParse({ unitPriceState: "known" }).success).toBe(false);
    expect(updateWorkItemRequest.safeParse({ unitPriceState: "missing", unitPrice: "1.00" }).success)
      .toBe(false);
    expect(updateWorkItemRequest.safeParse({ unitPriceState: "missing", unitPrice: null }).success)
      .toBe(true);
    expect(updateWorkItemRequest.safeParse({ unitPriceState: "known", unitPrice: "0.00" }).success)
      .toBe(false);
  });

  it("refuses a field no correction may touch", () => {
    expect(updateWorkItemRequest.safeParse({ valuationBasis: "unit_price_derived" }).success)
      .toBe(false);
    expect(updateWorkItemRequest.safeParse({ contractVersionId: uuid(4) }).success).toBe(false);
  });
});

describe("work_items.remove", () => {
  it("takes no body, and a DELETE sent with none validates", () => {
    expect(removeWorkItemRequest.safeParse({}).success).toBe(true);
  });

  it("refuses a smuggled field", () => {
    expect(removeWorkItemRequest.safeParse({ reason: "typo" }).success).toBe(false);
  });
});

// A published rule version that would satisfy every v0.1 refusal. Kept whole so
// each test below changes exactly one thing.
const RULE = {
  workTypeKey: "internal_sanitary",
  stageKey: "before_concealment",
  interventionType: "hold" as const,
  blockingScope: "blocks_stage_closure" as const,
  timing: "before_concealment" as const,
  evidenceKind: "photo" as const,
  performerRole: "foreman",
  approverRole: "internal_verifier",
  allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 10 * 1024 * 1024 },
  requirementLibraryItemId: uuid(11),
};

describe("requirement_rule_versions.publish", () => {
  it("accepts a v0.1 hold and defaults the counts, the ordinal and the approver plane", () => {
    const r = publishRequirementRuleVersionRequest.parse(RULE);
    expect(r.ordinal).toBe(1);
    expect(r.minEvidenceCount).toBe(1);
    expect(r.maxEvidenceCount).toBeNull();
    expect(r.approverIsExternal).toBe(false);
  });

  it("starts a new lineage without a rule id and continues one with it", () => {
    expect(publishRequirementRuleVersionRequest.safeParse(RULE).success).toBe(true);
    expect(publishRequirementRuleVersionRequest
      .safeParse({ ...RULE, requirementRuleId: uuid(12) }).success).toBe(true);
  });

  // INV-082 / ADR-006 decision 4.3. Storable in the database on purpose so
  // v0.2 is additive; refused by the command, and the refusal names the field
  // rather than reading as an invalid enum value.
  it.each(["witness", "review"] as const)("refuses intervention_type %s", (type) => {
    const r = publishRequirementRuleVersionRequest.safeParse({ ...RULE, interventionType: type });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["interventionType"]);
  });

  // INV-082 / ADR-006 decision 4.4. blocks_both is what ADR-005 required and
  // what the v0.2 widening migration owes; in v0.1 the other half of `both`
  // has nothing to block.
  it.each(["blocks_both", "none", "blocks_package_inclusion"] as const)(
    "refuses a hold whose scope is %s",
    (scope) => {
      const r = publishRequirementRuleVersionRequest.safeParse({ ...RULE, blockingScope: scope });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(["blockingScope"]);
    },
  );

  // ADR-010 supersedes ADR-006 decision 4.1's "only source": a version now
  // rests on exactly one of two sources, enforced by the superRefine below
  // and by requirement_rule_versions_one_provenance_check in the database.
  it("refuses a rule version that cites no source at all", () => {
    const { requirementLibraryItemId: _drop, ...noCitation } = RULE;
    const r = publishRequirementRuleVersionRequest.safeParse(noCitation);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message)
        .toContain("exactly one of requirementLibraryItemId or projectSourcedRequirementItemId");
    }
  });

  it("refuses a rule version citing both sources", () => {
    const r = publishRequirementRuleVersionRequest.safeParse({
      ...RULE, requirementLibraryItemId: uuid(11), projectSourcedRequirementItemId: uuid(13),
    });
    expect(r.success).toBe(false);
  });

  it("accepts a rule version citing only a project-sourced item", () => {
    const { requirementLibraryItemId: _drop, ...rest } = RULE;
    expect(publishRequirementRuleVersionRequest
      .safeParse({ ...rest, projectSourcedRequirementItemId: uuid(13) }).success).toBe(true);
  });

  // INV-073 and hidden-works-content-rules.md: the citation, its verification
  // tag and its source are COPIED from the cited library row. A caller that
  // could send them could assert a normative string with a tag it invented.
  it.each(["normRef", "normRefVerification", "normRefSource"])(
    "refuses a caller-supplied %s",
    (field) => {
      const r = publishRequirementRuleVersionRequest.safeParse({ ...RULE, [field]: "VERIFIED_PRIMARY" });
      expect(r.success).toBe(false);
    },
  );

  // ADR-006 decision 4.2: the v0.1 predicate is (work type, stage). The
  // location half moves to v0.2 with the location tree.
  it("refuses a location predicate", () => {
    const r = publishRequirementRuleVersionRequest.safeParse({ ...RULE, locationPredicate: {} });
    expect(r.success).toBe(false);
  });

  // The column defaults to '[]', an array, and the deployed upload gate reads
  // an object. A photo rule that relied on the default would hand M2 a media
  // policy it cannot interpret.
  it("requires allowed media for the kinds that produce an uploaded original", () => {
    const { allowedMedia: _drop, ...noMedia } = RULE;
    for (const kind of ["photo", "document"] as const) {
      const r = publishRequirementRuleVersionRequest.safeParse({ ...noMedia, evidenceKind: kind });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(["allowedMedia"]);
    }
    for (const kind of ["measurement", "checkbox"] as const) {
      expect(publishRequirementRuleVersionRequest
        .safeParse({ ...noMedia, evidenceKind: kind }).success).toBe(true);
      expect(publishRequirementRuleVersionRequest
        .safeParse({ ...RULE, evidenceKind: kind }).success).toBe(false);
    }
  });

  // Identical to createRequirementTemplateRequest.allowedMedia, because the
  // deployed upload gate reads that exact object.
  it("keeps the media bounds the upload gate already enforces", () => {
    expect(publishRequirementRuleVersionRequest.safeParse({
      ...RULE, allowedMedia: { mimeTypes: [], maxByteSize: 100 },
    }).success).toBe(false);
    expect(publishRequirementRuleVersionRequest.safeParse({
      ...RULE, allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 60 * 1024 * 1024 },
    }).success).toBe(false);
  });

  it("refuses a maximum evidence count below the minimum", () => {
    const r = publishRequirementRuleVersionRequest
      .safeParse({ ...RULE, minEvidenceCount: 3, maxEvidenceCount: 2 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["maxEvidenceCount"]);
  });

  // INV-085 is the command's, lifted within v0.1 by the change that ships the
  // occurrence grant. A request contract that changed between M4 and M5 would
  // start failing clients that were already correct.
  it("accepts an external approver on the wire and leaves INV-085 to the command", () => {
    const r = publishRequirementRuleVersionRequest.safeParse({ ...RULE, approverIsExternal: true });
    expect(r.success).toBe(true);
  });

  it("refuses a blank acceptance criterion but accepts its absence", () => {
    expect(publishRequirementRuleVersionRequest.safeParse({ ...RULE, acceptanceCriterion: "  " })
      .success).toBe(false);
    expect(publishRequirementRuleVersionRequest.safeParse(RULE).success).toBe(true);
  });

  // INV-067: publish or retire only. There is no status on this wire and no
  // update request in the package.
  it("refuses a caller-declared status", () => {
    expect(publishRequirementRuleVersionRequest.safeParse({ ...RULE, status: "published" }).success)
      .toBe(false);
  });
});

describe("requirement_rule_versions.retire", () => {
  it("takes no body", () => {
    expect(retireRequirementRuleVersionRequest.safeParse({}).success).toBe(true);
  });

  it("refuses a reason it has nowhere to store", () => {
    expect(retireRequirementRuleVersionRequest.safeParse({ reason: "superseded" }).success)
      .toBe(false);
  });
});

// Synthetic content. The verbatim Додаток Н text lives in
// technical/requirements/dbn-a31-5-2016-dodatok-n.csv and is not copied into a
// test fixture: a second copy of a regulatory string is a second thing that can
// drift from the source, and this file asserts the SHAPE of a library row.
const LIB = {
  libraryItemId: uuid(20),
  sourceStandard: "Приклад-стандарт",
  positionCode: "Н.14" as const,
  positionTitleUk: "Приклад-назва позиції",
  itemNo: 1,
  itemTextUk: "Приклад-текст пункту",
  normativeCharacter: "dovidkovyi" as const,
  verification: "VERIFIED_PRIMARY" as const,
  sourceCitation: "Приклад-джерело",
  actFormAssumption: "dodatok_v" as const,
  actFormBasis: "product_assumption" as const,
};

describe("requirement_library.list", () => {
  it("accepts a row that carries its tag and its source", () => {
    expect(requirementLibraryListResponse.safeParse({ items: [LIB] }).success).toBe(true);
  });

  it("accepts an empty library rather than inventing one", () => {
    expect(requirementLibraryListResponse.safeParse({ items: [] }).success).toBe(true);
  });

  // INV-073, storage half, restated at the boundary. UNVERIFIED is not a
  // storable value and must not become a returnable one.
  it("refuses UNVERIFIED as a verification tag", () => {
    const r = requirementLibraryItem.safeParse({ ...LIB, verification: "UNVERIFIED" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["verification"]);
  });

  it.each([undefined, null, "", "   "])("refuses a source citation of '%s'", (citation) => {
    const r = requirementLibraryItem.safeParse({ ...LIB, sourceCitation: citation });
    expect(r.success).toBe(false);
  });

  // Prohibition A: Н.14 has exactly five items and Н.15 exactly seven.
  it("refuses an item number beyond the position's extent", () => {
    expect(requirementLibraryItem.safeParse({ ...LIB, itemNo: 5 }).success).toBe(true);
    const sixth = requirementLibraryItem.safeParse({ ...LIB, itemNo: 6 });
    expect(sixth.success).toBe(false);
    if (!sixth.success) expect(sixth.error.issues[0]?.path).toEqual(["itemNo"]);

    const n15 = { ...LIB, positionCode: "Н.15" as const };
    expect(requirementLibraryItem.safeParse({ ...n15, itemNo: 7 }).success).toBe(true);
    expect(requirementLibraryItem.safeParse({ ...n15, itemNo: 8 }).success).toBe(false);
  });

  // «Н.1–Н.13» is not an allow-listed range and there is no value that holds one.
  it.each(["Н.1", "Н.13", "Н.16", "В.1"])("refuses position %s", (position) => {
    expect(requirementLibraryItem.safeParse({ ...LIB, positionCode: position }).success).toBe(false);
  });

  // Prohibitions B and C: Додаток Н is довідковий, never орієнтовний and never
  // mandatory or exhaustive. Prohibition G: the act-form mapping is the
  // product's assumption and can be returned as nothing else.
  it("admits one normative character and one act-form basis", () => {
    expect(requirementLibraryItem.safeParse({ ...LIB, normativeCharacter: "obovyazkovyi" }).success)
      .toBe(false);
    expect(requirementLibraryItem.safeParse({ ...LIB, actFormBasis: "standard" }).success)
      .toBe(false);
    expect(requirementLibraryItem.safeParse({ ...LIB, actFormAssumption: null }).success).toBe(true);
  });
});
