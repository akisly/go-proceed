import { describe, it, expect } from "vitest";
import { renderBlock, renderedStatutoryAct, type StatutoryActVersionView } from "@goproceed/contracts";
import {
  ASSURANCE_LEVEL_LABEL, DBN_RETRIEVAL_RECORD, DODATOK_V_TEMPLATE,
  DOVIDKOVYI_DISCLAIMER_TEXT, FORM_CITATION_SOURCE, FORM_CITATION_TEXT,
  LEVEL_3_NOT_A_SIGNATURE_TEXT, assuranceLevelOf, canonicalJson, findFormTemplate,
  formTemplateHashOf, pageFooterText, renderStatutoryAct,
} from "./statutory-act-form";
import { formatScaled, parsePgNumeric, printedQuantityOf } from "./statutory-act";

/**
 * The content rules, as tests over pure functions.
 *
 * WHAT IS NOT HERE, AND WHY IT CANNOT BE. The positive half — «the rendered
 * document carries every field of В.1 and В.2, in the standard's order, with the
 * standard's own captions» — is UNWRITEABLE in this repository.
 * docs/delivery/test-strategy.md:139-152:
 *
 *     «Until the В.1/В.2 field list is committed there with its `verification`
 *      tag and its source, the positive half cannot be written, and NO TEST MAY
 *      SUBSTITUTE A FIELD LIST TYPED FROM MEMORY. That substitution is precisely
 *      the fabrication class the adversarial audit behind
 *      hidden-works-content-rules.md was run to catch, and it would be worse in a
 *      fixture than in a document, because a fixture looks verified.»
 *
 * So no fixture below invents a caption of Додаток В — not even a transparently
 * fake one, because a fake caption in a fixture is the thing somebody copies into
 * the template. What IS tested is everything that does not need the field list:
 * the refusal, the block model's structural guarantee, the mandated disclaimer
 * text, the assurance ladder mapping, and the printed-quantity arithmetic.
 *
 * NOTHING HERE WAS EXECUTED. No `vitest` run, no build, no typecheck — there is
 * no node_modules in this environment. These assertions state REQUIRED behaviour
 * and have never been observed to hold.
 */

function draftView(overrides: Partial<StatutoryActVersionView> = {}): StatutoryActVersionView {
  const id = "00000000-0000-4000-8000-000000000001";
  return {
    statutoryActVersionId: id,
    statutoryActId: "00000000-0000-4000-8000-000000000002",
    projectId: "00000000-0000-4000-8000-000000000003",
    contractId: "00000000-0000-4000-8000-000000000004",
    workAssignmentId: "00000000-0000-4000-8000-000000000005",
    workItemId: "00000000-0000-4000-8000-000000000006",
    workStageId: "00000000-0000-4000-8000-000000000007",
    stageClosureId: "00000000-0000-4000-8000-000000000008",
    stageIsConcealed: true,
    actForm: "dodatok_v",
    actFormBasis: "product_assumption",
    versionNo: 1,
    status: "draft",
    predecessorVersionId: null,
    correctionReason: null,
    draftVersion: 1,
    formCitation: {
      text: FORM_CITATION_TEXT, verification: "VERIFIED_PRIMARY", source: FORM_CITATION_SOURCE,
    },
    formTemplateKey: DODATOK_V_TEMPLATE.key,
    formTemplateVersion: DODATOK_V_TEMPLATE.version,
    formTemplateHash: null,
    registryCheckedOn: "2026-08-07",
    rendererVersion: null,
    contentHash: null,
    frozenAt: null,
    frozenByMemberId: null,
    composedByMemberId: "00000000-0000-4000-8000-000000000009",
    composedAt: "2026-08-07T10:00:00.000Z",
    quantityLines: [],
    signatories: [],
    decisions: [],
    ...overrides,
  };
}

describe("the В.1/В.2 field list is not committed, and the render says so", () => {
  it("keeps the template's field list null until a sourced list is committed", () => {
    // The standing guard. If a future contributor populates `fieldList`, this
    // test stops failing on the null and starts enforcing the real rule: EVERY
    // entry carries a verification tag and a non-empty source. A field list
    // added as bare captions fails here.
    const list = DODATOK_V_TEMPLATE.fieldList;
    if (list === null) {
      expect(list).toBeNull();
      return;
    }
    expect(list.length).toBeGreaterThan(0);
    for (const f of list) {
      expect(["VERIFIED_PRIMARY", "VERIFIED_SECONDARY"]).toContain(f.verification);
      expect(f.source.trim().length).toBeGreaterThan(0);
      expect(f.caption.trim().length).toBeGreaterThan(0);
    }
  });

  it("refuses to render — for the retrieval record ONLY, now the field list is committed", () => {
    // THE FIELD-LIST BLOCKER IS GONE, and its absence is the assertion. On
    // 2026-08-10 the owner supplied the official ДБН file and confirmed the
    // edition; all 51 lines of В.1/В.2 are in
    // technical/requirements/dbn-a31-5-2016-dodatok-v.csv, machine-transcribed
    // and verified byte-for-byte, and DODATOK_V_TEMPLATE.fieldList is populated
    // from them. This case used to demand BOTH blockers and would now hide the
    // change by passing on the one that remains.
    //
    // What remains is `dbn_retrieval_record_absent`, and it is not a formality:
    // a hash proves two people hold the same bytes, and says nothing about
    // where the bytes came from. Until the URL and the retrieval date are
    // recorded, no VERIFIED_PRIMARY string reaches a customer-facing render —
    // so the act still cannot be printed, for one reason instead of two.
    const out = renderStatutoryAct(
      draftView({ status: "frozen" }), findFormTemplate("dodatok-v", "0.1.0"));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    const codes = out.blockers.map((b) => b.code).sort();
    expect(codes).not.toContain("dodatok_v_field_list_not_committed");
    expect(codes).toContain("dbn_retrieval_record_absent");
    // Every blocker says what closes it. A refusal a reader cannot act on is the
    // bare status word ADR-005 decision 6 exists to prevent.
    for (const b of out.blockers) {
      expect(b.detail.trim().length).toBeGreaterThan(0);
      expect(b.closedBy.trim().length).toBeGreaterThan(0);
    }
  });

  it("carries no ДБН retrieval record, so no VERIFIED_PRIMARY string is customer-facing", () => {
    expect(DBN_RETRIEVAL_RECORD).toBeNull();
  });

  it("refuses a draft: an unfrozen act is not a document to hand over", () => {
    const out = renderStatutoryAct(draftView(), findFormTemplate("dodatok-v", "0.1.0"));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.blockers.map((b) => b.code)).toContain("act_version_not_frozen");
  });

  it("refuses an unknown template rather than falling back to one", () => {
    const out = renderStatutoryAct(
      draftView({ status: "frozen", formTemplateVersion: "9.9.9" }),
      findFormTemplate("dodatok-v", "9.9.9"));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.blockers.map((b) => b.code)).toContain("form_template_unknown");
  });

  it("refuses a decision whose assurance level cannot be stated", () => {
    // hidden-works-content-rules.md §"Standing rules": «a package or act that
    // cannot state the level of a decision it carries must not render that
    // decision». Not «renders it unlabelled» — must not render it.
    const out = renderStatutoryAct(draftView({
      status: "frozen",
      decisions: [{
        requirementOccurrenceId: "00000000-0000-4000-8000-00000000000a",
        satisfiedBy: "evidence_decision",
        reliedOnDecisionId: "00000000-0000-4000-8000-00000000000b",
        reliedOnExceptionId: null,
        reliedOnExceptionAction: null,
        approverRole: "technical_supervision",
        acceptanceCriterion: "Приклад-критерій",
        normRef: null,
        assuranceLevel: null,
        assuranceLabel: "SOME_FUTURE_MECHANISM",
        decidedAt: "2026-08-07T09:00:00.000Z",
      }],
    }), findFormTemplate("dodatok-v", "0.1.0"));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.blockers.map((b) => b.code)).toContain("decision_assurance_level_unknown");
  });

  it("refuses a form citation that lost its source", () => {
    // INV-073's storage half already makes this unstorable (three NOT NULL
    // columns). The rule is that an unsourced normative string is UNRENDERABLE,
    // not that it is unstorable and therefore trusted.
    const out = renderStatutoryAct(draftView({
      status: "frozen",
      formCitation: { text: FORM_CITATION_TEXT, verification: "VERIFIED_PRIMARY", source: "   " },
    }), findFormTemplate("dodatok-v", "0.1.0"));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.blockers.map((b) => b.code)).toContain("form_citation_unsourced");
  });
});

describe("a string with no verification tag and source is structurally unrenderable", () => {
  it("rejects a block with no provenance at all", () => {
    expect(renderBlock.safeParse({
      blockId: "x", text: "щось", neverCollapse: false,
    }).success).toBe(false);
  });

  it("rejects a normative block with an empty source", () => {
    expect(renderBlock.safeParse({
      blockId: "x", text: "щось", neverCollapse: false,
      provenance: { kind: "normative", verification: "VERIFIED_PRIMARY", source: "  " },
    }).success).toBe(false);
  });

  it("rejects a normative block with no verification tag", () => {
    expect(renderBlock.safeParse({
      blockId: "x", text: "щось", neverCollapse: false,
      provenance: { kind: "normative", source: "десь" },
    }).success).toBe(false);
  });

  it("has no provenance kind that carries neither a tag nor a source nor a row", () => {
    // The discriminated union is the whole of the guarantee: a contributor who
    // adds a line to the renderer must choose a kind, and every kind demands
    // provenance. A fourth «free text» kind would undo it, so its absence is
    // asserted rather than assumed.
    expect(renderBlock.safeParse({
      blockId: "x", text: "щось", neverCollapse: false,
      provenance: { kind: "free_text" },
    }).success).toBe(false);
  });

  it("requires a page footer on the rendered document", () => {
    // The footer disclaimer is mandatory on EVERY page. A document model that
    // could omit it would make the omission representable, so the field is
    // required and non-nullable and this is the only thing missing below.
    const block = {
      blockId: "t", text: "T", neverCollapse: false,
      provenance: { kind: "disclaimer", mandatedBy: "x" },
    };
    const base = {
      statutoryActVersionId: "00000000-0000-4000-8000-000000000001",
      status: "frozen", actForm: "dodatok_v", rendererVersion: "r",
      formTemplateKey: "k", formTemplateVersion: "v",
      formTemplateHash: "a".repeat(64), contentHash: "b".repeat(64),
      title: block, sections: [], notes: [], pageFooterRepeatsOnEveryPage: true,
    };
    expect(renderedStatutoryAct.safeParse(base).success).toBe(false);
    expect(renderedStatutoryAct.safeParse({ ...base, pageFooter: block }).success).toBe(true);
  });

  it("keeps render-level labels out of the form's own fields", () => {
    // Prohibition E: «never add fields to Додаток В that are not in it». A note
    // is not a field, and `notes` exists so it cannot be laid out as one. A
    // section may only be В.1 or В.2 — an invented third section is a parse
    // failure rather than a heading somebody adds.
    const block = {
      blockId: "t", text: "T", neverCollapse: false,
      provenance: { kind: "disclaimer", mandatedBy: "x" },
    };
    expect(renderedStatutoryAct.safeParse({
      statutoryActVersionId: "00000000-0000-4000-8000-000000000001",
      status: "frozen", actForm: "dodatok_v", rendererVersion: "r",
      formTemplateKey: "k", formTemplateVersion: "v",
      formTemplateHash: "a".repeat(64), contentHash: "b".repeat(64),
      title: block, notes: [], pageFooter: block, pageFooterRepeatsOnEveryPage: true,
      sections: [{ sectionId: "Додатково", caption: block, fields: [] }],
    }).success).toBe(false);
  });
});

describe("the mandated disclaimers are the content rules' own text", () => {
  it("prints the registry check date in the footer", () => {
    expect(pageFooterText("2026-08-07")).toContain(
      "Перевірено за Реєстром будівельних норм: 2026-08-07.");
  });

  it("does not restore the approving order that was removed on 2026-08-06", () => {
    // hidden-works-content-rules.md §"Required disclaimers": «затвердженого
    // наказом Мінрегіону від 05.05.2016 № 115, чинного з 01.01.2017» was removed
    // and «must not be restored by a template edit». It is asserted by no
    // allow-list item, and a mandatory disclaimer carrying an unsourced string
    // would make the act blank itself unrenderable.
    const footer = pageFooterText("2026-08-07");
    expect(footer).not.toContain("наказ");
    expect(footer).not.toContain("115");
    expect(footer).not.toContain("01.01.2017");
  });

  it("states that the document is not an official edition of the norm", () => {
    expect(pageFooterText("2026-08-07")).toContain("офіційним виданням норми не є");
  });

  it("calls Додаток Н довідковий and never орієнтовний", () => {
    // Prohibition B: the string «орієнтовн» occurs ZERO times in the standard.
    // Prohibition C: the binding list comes from робоча документація.
    expect(DOVIDKOVYI_DISCLAIMER_TEXT).toContain("довідковий Додаток Н");
    expect(DOVIDKOVYI_DISCLAIMER_TEXT).not.toContain("орієнтовн");
    expect(DOVIDKOVYI_DISCLAIMER_TEXT).toContain("визначає робоча документація");
    expect(DOVIDKOVYI_DISCLAIMER_TEXT).toContain("п. 8.4.3.3");
  });

  it("titles the form АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ and never акт огляду", () => {
    // Prohibition D, first half. The second half — «do not tell users «акт
    // огляду» is obsolete» — is not this renderer's business and it says nothing
    // about it either way.
    expect(DODATOK_V_TEMPLATE.title.text).toBe("АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ");
    expect(DODATOK_V_TEMPLATE.title.text.toLowerCase()).not.toContain("огляду");
  });

  it("attributes the form exactly as allow-list item 3 gives it", () => {
    expect(FORM_CITATION_TEXT).toBe("форма за Додатком В (обов'язковим)");
    expect(FORM_CITATION_SOURCE.trim().length).toBeGreaterThan(0);
  });
});

describe("the assurance ladder, and prohibition S", () => {
  it("maps an internal member decision to level 2 and LINK_CONFIRMATION to level 3", () => {
    expect(assuranceLevelOf(null)).toBe("operational_acknowledgement");
    expect(assuranceLevelOf("LINK_CONFIRMATION")).toBe("authenticated_acceptance_record");
  });

  it("refuses to guess a level for a mechanism it does not know", () => {
    expect(assuranceLevelOf("КЕП")).toBeNull();
    expect(assuranceLevelOf("")).toBeNull();
  });

  it("never names a level below 4 with the word підпис", () => {
    // Prohibition S is about LABELLING a record, so the level NAMES are what it
    // binds here. The level-3 disclaimer below is the opposite case and is
    // asserted separately.
    for (const level of ["workflow_comment", "operational_acknowledgement",
      "authenticated_acceptance_record"] as const) {
      expect(ASSURANCE_LEVEL_LABEL[level]).not.toContain("підпис");
      expect(ASSURANCE_LEVEL_LABEL[level]).not.toContain("Підпис");
    }
  });

  it("states in Ukrainian that a level-3 record is NOT an electronic signature", () => {
    // The one place the word «підпис» is required rather than forbidden: the
    // mandated DENIAL. Prohibition S bans labelling a record as a signature, not
    // the word appearing in a sentence that says it is not one. A substring test
    // that missed this distinction would delete the disclaimer the rules mandate.
    expect(LEVEL_3_NOT_A_SIGNATURE_TEXT).toContain("Це не електронний підпис.");
    expect(LEVEL_3_NOT_A_SIGNATURE_TEXT).toContain("IP та серверним часом");
  });
});

describe("determinism", () => {
  it("serialises equal values to equal bytes regardless of key order", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] }))
      .toBe(canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }));
  });

  it("digests the whole template, so a caption edit moves the hash", () => {
    const h1 = formTemplateHashOf(DODATOK_V_TEMPLATE);
    const h2 = formTemplateHashOf({ ...DODATOK_V_TEMPLATE, title: {
      ...DODATOK_V_TEMPLATE.title, text: `${DODATOK_V_TEMPLATE.title.text} ` } });
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toBe(h2);
  });

  it("produces the same blockers for the same inputs", () => {
    const t = findFormTemplate("dodatok-v", "0.1.0");
    const a = renderStatutoryAct(draftView({ status: "frozen" }), t);
    const b = renderStatutoryAct(draftView({ status: "frozen" }), t);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});

describe("the printed quantity is a share of a recorded fact", () => {
  it("parses a pg numeric without touching a float", () => {
    expect(parsePgNumeric("12.500000")).toEqual({ scaled: 12500000n, scale: 6 });
    expect(parsePgNumeric("7")).toEqual({ scaled: 7n, scale: 0 });
    expect(parsePgNumeric("не число")).toBeNull();
  });

  it("formats at exactly the unit's precision", () => {
    expect(formatScaled(1250n, 3)).toBe("1.250");
    expect(formatScaled(7n, 0)).toBe("7");
    expect(formatScaled(5n, 3)).toBe("0.005");
  });

  it("computes share × recorded at the line's precision", () => {
    const out = printedQuantityOf({
      recordedQuantity: { scaled: 12500000n, scale: 6 },  // 12.5
      share: { scaled: 500000n, scale: 6 },               // 0.5
      unitPrecision: 3, midpoint: "half_up",
    });
    expect(out).toEqual({ ok: true, printedQuantity: "6.250" });
  });

  it("prints the whole recorded quantity at share 1", () => {
    const out = printedQuantityOf({
      recordedQuantity: { scaled: 4000n, scale: 3 },      // 4.000
      share: { scaled: 1000000n, scale: 6 },              // 1
      unitPrecision: 3, midpoint: "half_up",
    });
    expect(out).toEqual({ ok: true, printedQuantity: "4.000" });
  });

  it("REFUSES a share too small to print rather than printing a zero", () => {
    // Migration 0047 §5, deliberately: «an act that prints «0.000» as the
    // quantity performed is worse than an act that refuses to be composed».
    const out = printedQuantityOf({
      recordedQuantity: { scaled: 1000000n, scale: 6 },   // 1
      share: { scaled: 1n, scale: 6 },                    // 0.000001
      unitPrecision: 3, midpoint: "half_up",
    });
    expect(out).toEqual({ ok: false, reason: "rounds_to_zero" });
  });

  it("never prints more than the entry recorded", () => {
    // Unreachable while progress.record refuses a quantity finer than the line's
    // unit precision; checked so the day that rule relaxes this is a legible 422
    // and not a CHECK violation surfacing as a 500.
    const out = printedQuantityOf({
      recordedQuantity: { scaled: 126n, scale: 1 },       // 12.6, finer than the unit
      share: { scaled: 1000000n, scale: 6 },              // 1
      unitPrecision: 0, midpoint: "half_up",
    });
    expect(out).toEqual({ ok: false, reason: "exceeds_recorded" });
  });

  it("stays within one unit in the last place of share × recorded", () => {
    // The bound migration 0047's rounding CHECK enforces, mode-agnostically.
    for (const midpoint of ["half_up", "half_even"] as const) {
      const out = printedQuantityOf({
        recordedQuantity: { scaled: 3333333n, scale: 6 }, // 3.333333
        share: { scaled: 333333n, scale: 6 },             // 0.333333
        unitPrecision: 2, midpoint,
      });
      expect(out.ok).toBe(true);
      if (!out.ok) continue;
      const printed = Number.parseFloat(out.printedQuantity);
      expect(Math.abs(printed - 3.333333 * 0.333333)).toBeLessThan(0.01);
    }
  });
});
