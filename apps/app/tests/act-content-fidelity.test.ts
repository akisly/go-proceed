import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { renderedStatutoryAct } from "@goproceed/contracts";
import {
  ASSURANCE_LEVEL_LABEL, DODATOK_V_TEMPLATE, DOVIDKOVYI_DISCLAIMER_TEXT,
  FORM_CITATION_TEXT, LEVEL_3_NOT_A_SIGNATURE_TEXT,
  PROJECT_SOURCED_ITEMS_DISCLAIMER_PLACEMENT, PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT,
  pageFooterText,
} from "../src/lib/statutory-act-form";
import {
  CONTENT_RULES_REPO_PATH, allowListItem, assuranceLadder, prohibition,
  prohibitionEBannedFields, quoted, requiredDisclaimers, type RequiredDisclaimer,
} from "./helpers/content-rules";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `tsc`, `psql` and `supabase` were never run against it, no
 * assertion below has ever been observed to hold, and no claim is made that any
 * of them pass. Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M4: THE RENDERER'S STRINGS AGAINST THE APPROVED DOCUMENT THAT MANDATES
 * THEM, CHARACTER BY CHARACTER.
 *
 * `apps/app/src/lib/statutory-act-form.test.ts` already asserts things ABOUT
 * these strings — that the footer contains «офіційним виданням норми не є», that
 * the довідковий disclaimer does not contain «орієнтовн». Every one of those is
 * a `toContain`, and a `toContain` is satisfied by a string that has drifted
 * anywhere else. This suite asserts the whole string, BYTE FOR BYTE, against
 * `docs/product/hidden-works-content-rules.md` §"Required disclaimers" read at
 * test time.
 *
 * WHY THAT IS A DIFFERENT TEST AND NOT A STRICTER ONE. The document is Approved
 * and restricts at every precedence level, INCLUDING over ADRs. A mandatory
 * disclaimer is not a message the product composes; it is a string the product
 * is required to print. If the renderer's constant and the rule differ by one
 * character, the product is printing something no document mandates onto a
 * regulated form — and every `toContain` in the repository stays green while it
 * does. The comparison is over UTF-8 BYTES rather than over `===` so that a
 * lookalike codepoint (a Latin «c» in «сформовано», a NO-BREAK SPACE, a
 * different apostrophe) fails rather than reads the same.
 *
 * WHAT THIS SUITE CANNOT REACH, NAMED SO IT IS NOT MISTAKEN FOR COVERED:
 *
 *   THE RENDER ITSELF. `statutory_acts.render` refuses in v0.1 —
 *   `dodatok_v_field_list_not_committed` and `dbn_retrieval_record_absent` — so
 *   the footer is asserted on `pageFooterText()` and NOT on a rendered document,
 *   and «present on every page» is asserted at the only level a model without a
 *   paginator can carry it. Both gaps are asserted explicitly below rather than
 *   left implied.
 *
 *   THE PROHIBITION-G NOTE. Its two Ukrainian sentences are built inline in
 *   `renderStatutoryAct` and are exported by nothing, so no sweep below reaches
 *   them. They are unsourced product copy — `technical/copy-catalog.csv` carries
 *   no row for the act render at all — and that is reported, not tested.
 */

/** UTF-8 byte identity. `===` would pass for a lookalike normalisation. */
function sameBytes(a: string, b: string): boolean {
  return Buffer.from(a, "utf8").equals(Buffer.from(b, "utf8"));
}

/**
 * A failure message that shows WHERE two nearly identical Ukrainian strings
 * differ. Without it a mismatched NO-BREAK SPACE prints as two lines that look
 * the same and the reader concludes the test is broken.
 */
function firstDifference(a: string, b: string): string {
  const A = [...a];
  const B = [...b];
  for (let i = 0; i < Math.max(A.length, B.length); i += 1) {
    if (A[i] !== B[i]) {
      return `index ${i}: renderer ${JSON.stringify(A[i] ?? "<end>")}`
        + ` (U+${(A[i]?.codePointAt(0) ?? 0).toString(16).toUpperCase()})`
        + ` vs document ${JSON.stringify(B[i] ?? "<end>")}`
        + ` (U+${(B[i]?.codePointAt(0) ?? 0).toString(16).toUpperCase()})`;
    }
  }
  return "identical";
}

function expectSameBytes(rendered: string, mandated: string): void {
  expect(firstDifference(rendered, mandated)).toBe("identical");
  expect(sameBytes(rendered, mandated)).toBe(true);
}

const REGISTRY_CHECKED_ON = "2026-08-07";

/**
 * Every Ukrainian string the renderer can print that does NOT come out of the
 * database, so a prohibition can be swept across all of them at once.
 *
 * The database-sourced strings — an acceptance criterion, a norm reference, a
 * frozen organisation name — are not here, because they are recorded facts and
 * are asserted where they are recorded: the Додаток Н half in
 * `m4-act.int.test.ts` against the CSV, and the participant half against the
 * participant record.
 *
 * `PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT` (statutory-act-form.ts, modelled
 * `PROJECT_SOURCED_ITEMS_DISCLAIMER_PLACEMENT === "conditional"`) IS HERE NOW.
 * It was excluded while nothing called `disclaimer()` with it, and that
 * exclusion carried its own condition of ending: «WHEN A FUTURE CHANGE WIRES
 * THIS CONSTANT INTO `blocksFor` and it becomes genuinely printable, add it to
 * the list below too — but guard the prohibition-E sweep for it with a check
 * aware of its citation role, never with the blanket substring ban this file
 * uses today.» `blocksFor`'s `decision_blocks` case now pushes it directly
 * after the довідковий disclaimer whenever a decision's citation is tagged
 * `PROJECT_DOCUMENTATION`, so it is printable and both halves of that
 * instruction are carried out: it joins `printableConstants()`, and the
 * prohibition-E sweep excepts it by name and checks it a different way —
 * see `MANDATED_VERBATIM` and the case that owns it.
 *
 * WHY THE BLANKET BAN WOULD MISREAD IT. It legitimately contains «аркуша» as
 * citation prose — hidden-works-content-rules.md §"Project-sourced strings"
 * cites a project-sourced item "only with its structured citation — document,
 * аркуш, креслення, and the ревізія when one was given" — while the sweep bans
 * «аркуш» as a FIELD ADDED TO THE ДОДАТОК В FORM. The same section says why
 * conflating the two would be wrong: "Prohibition E is not weakened by the
 * source record ... nothing here prints a field into a Додаток В blank, and E
 * continues to forbid that."
 */
function printableConstants(): string[] {
  return [
    DODATOK_V_TEMPLATE.title.text,
    FORM_CITATION_TEXT,
    pageFooterText(REGISTRY_CHECKED_ON),
    DOVIDKOVYI_DISCLAIMER_TEXT,
    PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT,
    LEVEL_3_NOT_A_SIGNATURE_TEXT,
    ...Object.values(ASSURANCE_LEVEL_LABEL),
    ...Object.values(ASSURANCE_LEVEL_LABEL).map((l) => `Рівень підтвердження: ${l}.`),
  ];
}

/**
 * The printable strings the prohibition-E sweep may NOT check by substring,
 * and the reason it may not: they are not composed by this product at all.
 *
 * A mandated disclaimer is transcribed from an Approved document that
 * restricts at every precedence level. Prohibition E bans ADDING a field to
 * Додаток В; a sentence the same document orders the product to print cannot
 * be such an addition, and the only thing worth checking about it is that the
 * bytes are the document's own. That is what the case below checks, and it is
 * a stronger property than the substring ban it replaces: byte identity to the
 * source admits no added field of any kind, named in the prohibition or not.
 */
const MANDATED_VERBATIM: readonly string[] = [PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT];

describe(`the five mandated disclaimers of ${CONTENT_RULES_REPO_PATH}`, () => {
  const mandated = requiredDisclaimers();

  /**
   * One mandated disclaimer, found by the sentence that introduces it rather
   * than by its position in `mandated`. A disclaimer inserted ABOVE this one
   * in the document — exactly what happened when the project-sourced note
   * joined between the довідковий disclaimer and the assurance-level line —
   * shifts every positional index below it; an anchor phrase drawn from the
   * document's own wording does not move when the document grows.
   */
  function disclaimerIntroducedBy(anchor: string): RequiredDisclaimer {
    const found = mandated.filter((d) => d.introduction.includes(anchor));
    expect(found, `exactly one disclaimer introduced by "${anchor}"`).toHaveLength(1);
    return found[0]!;
  }

  it("mandates exactly five disclaimers, and the renderer carries a constant for each", () => {
    // THE COUNT IS THE ASSERTION. A disclaimer added to the document beyond
    // the ones named below is a string the product is required to print and
    // does not; the renderer would keep passing every other test in this
    // file, because every other test asks about a string that exists. This is
    // the one that notices a string that does not.
    expect(mandated).toHaveLength(5);
    // DISTINCT strings, each of which the tests below tie to a named renderer
    // constant. Without the distinctness check a reader bug that returned the
    // same blockquote repeatedly would satisfy the count.
    expect(new Set(mandated.map((d) => d.body)).size).toBe(5);
    for (const d of mandated) expect(d.body.trim().length).toBeGreaterThan(0);
  });

  it("prints the page footer character for character, with the check date filled in", () => {
    // «Перевірено за Реєстром будівельних норм: {дата останньої перевірки}» is
    // the ONE substitution the document itself marks. Everything else is fixed.
    expectSameBytes(
      pageFooterText(REGISTRY_CHECKED_ON),
      mandated[0]!.body.replace("{дата останньої перевірки}", REGISTRY_CHECKED_ON));
  });

  it("mandates that footer ON EVERY PAGE, and the model marks it repeating", () => {
    // The document's own words for WHERE it goes, not a paraphrase of them.
    expect(mandated[0]!.introduction).toContain("On every page of a generated act blank");

    // WHAT THE MODEL CAN CARRY, AND WHAT IT CANNOT. v0.1 paginates nothing, so
    // «on every page» is a property of whatever turns this document into paper
    // and no such thing ships. Two things are enforceable and both are asserted:
    // the footer is REQUIRED — a document without one does not parse — and the
    // repetition flag is a literal `true`, so a document that carried `false`
    // is unrepresentable rather than merely wrong.
    const block = {
      blockId: "t", text: "T", neverCollapse: true,
      provenance: { kind: "disclaimer", mandatedBy: CONTENT_RULES_REPO_PATH },
    };
    const doc = {
      statutoryActVersionId: "00000000-0000-4000-8000-000000000001",
      status: "frozen", actForm: "dodatok_v", rendererVersion: "r",
      formTemplateKey: "k", formTemplateVersion: "v",
      formTemplateHash: "a".repeat(64), contentHash: "b".repeat(64),
      title: block, sections: [], notes: [], pageFooter: block,
    };
    expect(renderedStatutoryAct.safeParse(
      { ...doc, pageFooterRepeatsOnEveryPage: true }).success).toBe(true);
    expect(renderedStatutoryAct.safeParse(
      { ...doc, pageFooterRepeatsOnEveryPage: false }).success).toBe(false);
    expect(renderedStatutoryAct.safeParse(doc).success).toBe(false);
  });

  it("prints the довідковий disclaimer character for character", () => {
    expectSameBytes(DOVIDKOVYI_DISCLAIMER_TEXT, mandated[1]!.body);
  });

  it("is told to print that one NEVER COLLAPSED", () => {
    expect(mandated[1]!.introduction).toContain("never collapsed");
    // The model's carrier for it. That the renderer actually sets it on this
    // block is on the positive render path, which refuses in v0.1; the
    // integration suite records that gap rather than this file claiming it.
    expect(renderedStatutoryAct.shape.pageFooter.shape.neverCollapse).toBeDefined();
  });

  it("prints the project-sourced items note character for character", () => {
    const projectSourcedNote = disclaimerIntroducedBy(
      "only on a list that also carries project-sourced items");
    expectSameBytes(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT, projectSourcedNote.body);
    // «immediately after it» — right after the довідковий disclaimer above,
    // never on its own and never ahead of it.
    expect(projectSourcedNote.introduction).toContain("immediately after it");
  });

  it("is told to print that one CONDITIONALLY, unlike the довідковий disclaimer or the footer", () => {
    // The document's own words draw the distinction this constant must carry:
    // the footer is mandated «on every page» (mandated[0]) and the довідковий
    // disclaimer «never collapsed» (mandated[1]) — both unconditional once
    // their host prints at all. The project-sourced note is mandated «only on
    // a list that also carries project-sourced items»: a fact about the
    // list's CONTENTS, true on a mixed list and false on a list built
    // entirely from the seeded Додаток Н library.
    expect(PROJECT_SOURCED_ITEMS_DISCLAIMER_PLACEMENT).toBe("conditional");
    expect(PROJECT_SOURCED_ITEMS_DISCLAIMER_PLACEMENT).not.toBe("never_collapsed");
    expect(PROJECT_SOURCED_ITEMS_DISCLAIMER_PLACEMENT).not.toBe("every_page");
  });

  it("prints the assurance-level line character for character, for every level", () => {
    const assuranceLevelLine = disclaimerIntroducedBy(
      "Next to every rendered decision or signatory block");
    for (const label of Object.values(ASSURANCE_LEVEL_LABEL)) {
      expectSameBytes(
        `Рівень підтвердження: ${label}.`,
        assuranceLevelLine.body.replace("{level}", label));
    }
  });

  it("prints the level-3 denial character for character, and only after the level", () => {
    const levelThreeDenial = disclaimerIntroducedBy("for level 3 only");
    expectSameBytes(LEVEL_3_NOT_A_SIGNATURE_TEXT, levelThreeDenial.body);
    // «and, for level 3 only, immediately after it» — the ORDER is the rule's,
    // so the denial cannot drift away from the level it denies.
    expect(levelThreeDenial.introduction).toContain("immediately after it");
  });

  it("does not restore the approving order that was removed on 2026-08-06", () => {
    // Asserted against the DOCUMENT and not against a memory of it: the string
    // must be absent from the mandated footer as well as from the renderer's,
    // because the two halves of this failure are «the template restored it» and
    // «the document restored it», and only the first is a code defect.
    for (const s of [mandated[0]!.body, pageFooterText(REGISTRY_CHECKED_ON)]) {
      expect(s).not.toContain("наказ");
      expect(s).not.toContain("115");
      expect(s).not.toContain("01.01.2017");
    }
  });
});

describe("the allow-list's own words", () => {
  it("titles the act exactly as item 7 gives the title", () => {
    // Prohibition D's positive half. Item 7 is the ONLY title the document
    // allow-lists, and it is the В title.
    const [title] = quoted(allowListItem(7));
    expect(title).toBeDefined();
    expectSameBytes(DODATOK_V_TEMPLATE.title.text, title as string);
  });

  it("attributes the form exactly as item 3 gives the attribution", () => {
    const [attribution] = quoted(allowListItem(3));
    expect(attribution).toBeDefined();
    expectSameBytes(FORM_CITATION_TEXT, attribution as string);
  });

  it("licenses the В.1/В.2 field list, and the repository now carries it", () => {
    // Item 3 LICENSES the fields. Until 2026-08-10 nothing supplied them and
    // this case asserted the null; the owner then supplied the official ДБН
    // file and confirmed the edition, and all 51 lines are committed under
    // technical/requirements/dbn-a31-5-2016-dodatok-v.csv.
    //
    // The assertion on item 3's wording STAYS, and is the reason this case is
    // here: if item 3 is ever narrowed, the licence stops covering what the
    // template now prints, and that must fail somewhere. The other half moves
    // from «the list is absent» to «the list is what the licence describes».
    expect(allowListItem(3)).toContain("every field of В.1 and В.2");
    const list = DODATOK_V_TEMPLATE.fieldList;
    expect(list).not.toBeNull();
    expect(list!.length).toBe(51);
    expect(new Set(list!.map((f) => f.section))).toEqual(new Set(["В.1", "В.2"]));
    // Every caption is licensed content, so every one carries its tag and where
    // it came from. Byte fidelity against the CSV is dodatok-v-fidelity.test.ts.
    for (const f of list!) {
      expect(f.verification).toBe("VERIFIED_PRIMARY");
      expect(f.source).toContain("ДБН А.3.1-5:2016");
      expect(f.source).toContain("sha256=");
    }
  });
});

describe("the assurance ladder prints in the ladder's own words", () => {
  const ladder = assuranceLadder();

  it("carries five levels and no invented sixth", () => {
    expect(ladder.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
    expect(Object.keys(ASSURANCE_LEVEL_LABEL)).toHaveLength(5);
  });

  it("labels every level byte-identically to the ladder's own table", () => {
    // THE LADDER GIVES NO UKRAINIAN LABEL and this repository must not invent
    // one: a mistranslation of level 3 is exactly the conflation the ladder
    // exists to prevent. So the English strings are printed and this is what
    // holds them to the table.
    const printed = Object.values(ASSURANCE_LEVEL_LABEL);
    for (const row of ladder) {
      const match = printed.find((p) => sameBytes(p, row.label));
      expect(match, `level ${row.level} «${row.label}» has no byte-identical label`)
        .toBeDefined();
    }
  });

  it("names no level below 4 with the word підпис (prohibition S)", () => {
    // Prohibition S read from the document rather than paraphrased, so a
    // rewording of it is visible here.
    expect(prohibition("S")).toContain("below level 4");
    for (const row of ladder.filter((l) => l.level < 4)) {
      expect(row.label).not.toContain("підпис");
    }
    for (const level of ["workflow_comment", "operational_acknowledgement",
      "authenticated_acceptance_record"] as const) {
      expect(ASSURANCE_LEVEL_LABEL[level]).not.toContain("підпис");
      expect(ASSURANCE_LEVEL_LABEL[level].toLowerCase()).not.toContain("підпис");
    }
  });

  it("requires the word підпис in exactly one printable string — the denial", () => {
    // The distinction a naive substring ban would destroy. Prohibition S bans
    // LABELLING a record as a signature; the document simultaneously MANDATES a
    // sentence containing «підпис» that says the record is not one. A test that
    // banned the substring everywhere would delete the mandated disclaimer.
    const carrying = printableConstants().filter((s) => s.includes("підпис"));
    expect(carrying).toEqual([LEVEL_3_NOT_A_SIGNATURE_TEXT]);
    expect(LEVEL_3_NOT_A_SIGNATURE_TEXT).toContain("Це не електронний підпис.");
  });
});

describe("prohibition E — the negative, over every string the renderer can print", () => {
  const banned = prohibitionEBannedFields();

  it("reads its ban list from the prohibition itself", () => {
    // If the document bans a seventh field tomorrow, the sweep below starts
    // checking it tomorrow — not on the day somebody remembers to widen an
    // array in a test file.
    expect(banned.length).toBeGreaterThanOrEqual(6);
    expect(prohibition("E")).toContain("or a fourth signatory");
  });

  it("prints none of the banned fields, in any constant, in any case", () => {
    for (const field of banned) {
      for (const s of printableConstants()) {
        // The mandated disclaimers are checked by transcription in the case
        // below, never by substring — see `MANDATED_VERBATIM`.
        if (MANDATED_VERBATIM.includes(s)) continue;
        expect(s.toLowerCase(), `«${field}» reached a printable string`)
          .not.toContain(field.toLowerCase());
      }
    }
  });

  it("checks a mandated disclaimer by transcription, because it may carry the citation's own words", () => {
    // THE EXCEPTION, AND ITS PRICE PAID IN ASSERTIONS. Three things are checked
    // and the first is the one that replaces the substring ban.
    const mandated = requiredDisclaimers();

    // 1. THE BYTES ARE THE DOCUMENT'S. Nothing was added to this string by this
    //    repository, so no field was added to it either — including a field no
    //    prohibition names yet.
    for (const s of MANDATED_VERBATIM) {
      const match = mandated.filter((d) => sameBytes(d.body, s));
      expect(match, `no mandated disclaimer is byte-identical to «${s.slice(0, 48)}…»`)
        .toHaveLength(1);
    }

    // 2. THE EXCEPTION IS NEEDED, and which banned word makes it necessary is
    //    DERIVED rather than named in this file. If the document ever bans a
    //    seventh field that also appears in this disclaimer's citation prose,
    //    this fails and a human decides whether that overlap is legitimate too
    //    — instead of the ban silently widening its own exemption.
    const carried = banned.filter((f) =>
      PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT.toLowerCase().includes(f.toLowerCase()));
    expect(carried).toEqual(["аркуш"]);

    // 3. AND IT IS AN EXCEPTION FOR ONE WORD, NOT A LICENCE FOR THE REST. Every
    //    other banned field is still absent from the excepted constant.
    for (const field of banned) {
      if (carried.includes(field)) continue;
      expect(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT.toLowerCase(),
        `«${field}» reached the mandated disclaimer`).not.toContain(field.toLowerCase());
    }
  });

  it("prints nothing for the технагляд's кваліфікаційний сертифікат", () => {
    // The document's own reasoning: allow-list item 10 establishes that
    // технагляд HOLDS a certificate; whether Додаток В has a slot for its серія
    // and номер is NOT established, and prohibition E bans the adjacent «ким
    // видана». The storage half — no column anywhere to read one from — is
    // asserted in packages/testing/src/m4-act-schema.test.ts; this is the render
    // half, and it is a sweep for the words rather than for a column.
    for (const s of printableConstants()) {
      const lower = s.toLowerCase();
      for (const word of ["сертифікат", "серія", "серії", "ким видана", "видана"]) {
        expect(lower, `«${word}» reached a printable string`).not.toContain(word);
      }
    }
  });
});

describe("prohibition B — «орієнтовн» occurs zero times in the standard", () => {
  it("occurs zero times in the renderer either, comments included", () => {
    // The one prohibition where a WHOLE-FILE sweep is the right shape. The
    // string occurs zero times in the standard, so it has no legitimate use in
    // the module that renders the standard's form — not in a constant, not in a
    // comment explaining why it is wrong, not in a variable name. The other
    // prohibitions cannot be swept this way: the module's comments quote «ким
    // видана» and «наказ … № 115» precisely in order to record that they must
    // not be printed, so those are swept over the constants above instead.
    const source = readFileSync(
      new URL("../src/lib/statutory-act-form.ts", import.meta.url), "utf-8");
    expect(source).not.toContain("орієнтовн");
    expect(DOVIDKOVYI_DISCLAIMER_TEXT).not.toContain("орієнтовн");
    expect(DOVIDKOVYI_DISCLAIMER_TEXT).toContain("довідковий Додаток Н");
  });
});

describe("the requirement-list disclaimers have one source in apps/app (BL-156)", () => {
  // The act, the Telegram card and the office's blocked-reasons list all print
  // these two texts. A second copy in any of them could drift from the one
  // the byte-for-byte cases above check; a fragment of each text may therefore
  // appear only in the module that holds them.
  const APP = join(__dirname, "..");
  const HOLDER = join("src", "lib", "required-disclaimers.ts");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? sourceFiles(join(dir, entry.name))
        : /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []);
  }

  it("keeps «відтворений дослівно» and «не перевірявся» in required-disclaimers.ts alone", () => {
    const holders = [...sourceFiles(join(APP, "src")), ...sourceFiles(join(APP, "app"))]
      .filter((file) => /відтворений дослівно|не перевірявся/.test(readFileSync(file, "utf8")))
      .map((file) => relative(APP, file).split(sep).join("/"));

    expect(holders).toEqual([HOLDER.split(sep).join("/")]);
  });
});
