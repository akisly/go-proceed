import { describe, expect, it } from "vitest";
import {
  assignmentCardCitationOf, formatAssignmentCard, formatRequirementChoicePrompt, formatTelegramReceipt,
  MAX_TELEGRAM_MESSAGE_CHARACTERS,
} from "./cards";
import { readDodatokN } from "../../../tests/helpers/dodatok-n";
import { DOVIDKOVYI_DISCLAIMER_TEXT, PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT } from "../required-disclaimers";

/**
 * THE DBN CITATION AS IT IS ACTUALLY STORED — read from
 * `technical/requirements/dbn-a31-5-2016-dodatok-n.csv` rather than transcribed
 * here. Its length is the point (~300 characters, identical on every item of a
 * position, which is what makes the shared source block necessary rather than
 * decorative), and a regulatory string has exactly one place its wording comes
 * from: a copy in a fixture is a second source that can drift from the first
 * (dodatok-n.ts's own header; test-strategy.md:139-152). A re-fetch that
 * changes the sha256 or the download date reaches this test with no edit.
 */
const DBN_SOURCE = readDodatokN()[0]!.source;

/** The line that carries requirement N's citation: the line after «N. …». */
function citationLineOf(text: string, ordinal: number): string {
  const lines = text.split("\n");
  const index = lines.findIndex((line) => line.startsWith(`${ordinal}. `));
  if (index < 0) throw new Error(`no line for requirement ${ordinal}`);
  return lines[index + 1] ?? "";
}

describe("Telegram card formatting", () => {
  it("renders a citation with its verification label and its full source", () => {
    // Break caught: the card renders `criterion — normRef` with no tag and no
    // source, which is a normative string rendered unattributed (INV-073,
    // M0 gate 9, ADR-011 open item 9).
    const card = formatAssignmentCard({
      assignmentId: "assignment-1",
      title: "Монтаж внутрішньої каналізації",
      occurrences: [{
        occurrenceId: "o1",
        criterion: "Підготовка ніш, каналів та борозен.",
        normRef: {
          text: "ДБН А.3.1-5:2016, Додаток Н",
          verification: "VERIFIED_PRIMARY",
          source: DBN_SOURCE,
        },
      }],
    });

    expect(card.text).toContain("1. Підготовка ніш, каналів та борозен.");
    expect(card.text).toContain("ДБН А.3.1-5:2016, Додаток Н");
    expect(card.text).toContain("перевірено за першоджерелом");
    expect(card.text).toContain(DBN_SOURCE);
  });

  it("labels a project-sourced citation as an origin rather than a verification strength", () => {
    // Break caught: the card invents its own tag vocabulary instead of the one
    // norm-ref-labels.ts already renders in the field client, and
    // PROJECT_DOCUMENTATION acquires a «перевірено» word it must never carry
    // (hidden-works-content-rules.md §"Verification vocabulary").
    const card = formatAssignmentCard({
      assignmentId: "assignment-2",
      title: "Армування плити",
      occurrences: [{
        occurrenceId: "o1",
        criterion: "Крок стрижнів за кресленням.",
        normRef: {
          text: "Робоча документація об'єкта",
          verification: "PROJECT_DOCUMENTATION",
          source: "Приклад-РД-2026-014, арк. 12, кресл. АР-07",
        },
      }],
    });

    expect(card.text).toContain("за робочою документацією об'єкта");
    expect(card.text).not.toContain("перевірено");
  });

  it("prints one source block entry for requirements that share a source", () => {
    // Break caught: repeating a ~300-character citation per requirement pushes
    // a twelve-item Додаток Н card past 4096 characters and turns a publication
    // into a refusal the author cannot act on.
    const occurrence = (id: string, criterion: string) => ({
      occurrenceId: id,
      criterion,
      normRef: {
        text: "ДБН А.3.1-5:2016, Додаток Н",
        verification: "VERIFIED_PRIMARY" as const,
        source: DBN_SOURCE,
      },
    });
    const card = formatAssignmentCard({
      assignmentId: "assignment-3",
      title: "Внутрішні санітарно-технічні роботи",
      occurrences: [occurrence("o1", "Підготовка ніш."), occurrence("o2", "Правильність уклонів.")],
    });

    expect(card.text.split(DBN_SOURCE).length - 1).toBe(1);
    expect(card.text).toContain("1. Підготовка ніш.");
    expect(card.text).toContain("2. Правильність уклонів.");
    expect(card.text).toContain("[1]");
    expect(card.text).not.toContain("[2]");
  });

  it("numbers distinct sources in order of first appearance", () => {
    // Break caught: a marker that does not identify its own source attributes
    // a requirement to the wrong document.
    const card = formatAssignmentCard({
      assignmentId: "assignment-4",
      title: "Змішана картка",
      occurrences: [
        {
          occurrenceId: "o1", criterion: "Перше.",
          normRef: { text: "ДБН А.3.1-5:2016, Додаток Н", verification: "VERIFIED_PRIMARY", source: DBN_SOURCE },
        },
        {
          occurrenceId: "o2", criterion: "Друге.",
          normRef: {
            text: "Робоча документація об'єкта", verification: "PROJECT_DOCUMENTATION",
            source: "Приклад-РД-2026-014, арк. 12, кресл. АР-07",
          },
        },
      ],
    });

    // The citation line of requirement N, not merely the presence of a marker
    // somewhere: pointing every requirement at [1] passed this case until the
    // assertion was made per-line, which is the exact defect the case names.
    expect(citationLineOf(card.text, 1)).toContain("[1]");
    expect(citationLineOf(card.text, 2)).toContain("[2]");
    expect(card.text.indexOf(`[1] ${DBN_SOURCE}`)).toBeGreaterThan(-1);
    expect(card.text).toContain("[2] Приклад-РД-2026-014, арк. 12, кресл. АР-07");
    expect(card.text.indexOf("[1] ")).toBeLessThan(card.text.indexOf("[2] "));
  });

  it("distinguishes two project-sourced requirements by their markers alone", () => {
    // Break caught: `projectSourceNormRef()` is a CONSTANT, so on the ADR-010
    // arm every citation line reads identically and the marker is the only
    // thing tying a requirement to its own sheet and drawing. A marker bound to
    // the wrong source misattributes the obligation with nothing on the line to
    // show it.
    const projectRef = (source: string) => ({
      text: "Робоча документація об'єкта", verification: "PROJECT_DOCUMENTATION" as const, source,
    });
    const card = formatAssignmentCard({
      assignmentId: "assignment-9", title: "Дві вимоги з різних аркушів",
      occurrences: [
        { occurrenceId: "o1", criterion: "Крок стрижнів.", normRef: projectRef("РД-014, арк. 12, кресл. АР-07") },
        { occurrenceId: "o2", criterion: "Захисний шар.", normRef: projectRef("РД-014, арк. 31, кресл. КЗ-02") },
      ],
    });

    expect(citationLineOf(card.text, 1)).toContain("[1]");
    expect(citationLineOf(card.text, 2)).toContain("[2]");
    expect(card.text).toContain("[1] РД-014, арк. 12, кресл. АР-07");
    expect(card.text).toContain("[2] РД-014, арк. 31, кресл. КЗ-02");
  });

  it("withholds the text of a requirement that carries no confirmed source, keeping its ordinal", () => {
    // Break caught: a criterion with no verification tag and no source reaches
    // a закрита група as normative text — the render half of INV-073. The line
    // and its number stay because the card is the assignment's own list: a card
    // that silently dropped a requirement would understate the obligation while
    // looking complete.
    const card = formatAssignmentCard({
      assignmentId: "assignment-5",
      title: "Картка з неатрибутованою вимогою",
      occurrences: [
        {
          occurrenceId: "o1", criterion: "Перше.",
          normRef: { text: "ДБН А.3.1-5:2016, Додаток Н", verification: "VERIFIED_PRIMARY", source: DBN_SOURCE },
        },
        { occurrenceId: "o2", criterion: "Текст без джерела.", normRef: null },
      ],
    });

    expect(card.text).not.toContain("Текст без джерела.");
    expect(card.text).toContain("2. Вимога без підтвердженого джерела — текст не показано.");
  });

  it("escapes provider markup in assignment data", () => {
    // Break caught: interpolating project data directly lets it become Telegram
    // HTML instead of literal assignment content.
    const card = formatAssignmentCard({
      assignmentId: "assignment-6",
      title: "Лоток <секція & 2>",
      occurrences: [{
        occurrenceId: "o1", criterion: "Загальний план",
        normRef: {
          text: "ДБН <Н.15>", verification: "VERIFIED_SECONDARY",
          source: "Довідник <вид. 2> & передрук",
        },
      }],
    });

    expect(card.text).toContain("Лоток &lt;секція &amp; 2&gt;");
    expect(card.text).toContain("ДБН &lt;Н.15&gt;");
    expect(card.text).toContain("Довідник &lt;вид. 2&gt; &amp; передрук");
    expect(card.parseMode).toBe("HTML");
  });

  it("flattens newlines so no stored value can forge a line of the message", () => {
    // Break caught: only &, < and > were escaped, so a holder of
    // requirement_rules.manage could put «\n13. …» in a criterion or «\n[3] …»
    // in a source and forge a numbered requirement or a source entry inside a
    // message that carries the bot's authority.
    const card = formatAssignmentCard({
      assignmentId: "assignment-10", title: "Підробка",
      occurrences: [{
        occurrenceId: "o1", criterion: "Справжній критерій.\n13. Підроблена вимога.",
        normRef: {
          text: "ДБН\nпідробка", verification: "VERIFIED_PRIMARY",
          source: "Джерело\n[3] Підроблене джерело",
        },
      }],
    });

    expect(card.text).not.toContain("\n13. Підроблена вимога.");
    expect(card.text).not.toContain("\n[3] Підроблене джерело");
    expect(card.text).toContain("Справжній критерій. 13. Підроблена вимога.");
    expect(card.text).toContain("[1] Джерело [3] Підроблене джерело");
  });

  it("rejects an assignment card that cannot retain every ordered occurrence", () => {
    // Break caught: truncating a card silently removes the evidence choices
    // that participants must be able to reply against.
    expect(() => formatAssignmentCard({
      assignmentId: "assignment-7",
      title: "Робота ".repeat(900),
      occurrences: [{
        occurrenceId: "o1", criterion: "Критерій ".repeat(900),
        normRef: { text: "ДБН", verification: "VERIFIED_PRIMARY", source: DBN_SOURCE },
      }],
    })).toThrow("assignment_card_too_long");
  });

  it("keeps a twelve-requirement Додаток Н card inside one Telegram message", () => {
    // Break caught: Н.14 (5 items) and Н.15 (7 items) is a real assignment
    // shape, and a per-requirement copy of the citation would refuse it.
    const card = formatAssignmentCard({
      assignmentId: "assignment-8",
      title: "Приховані роботи: санітарно-технічні та електромонтажні",
      occurrences: Array.from({ length: 12 }, (_, index) => ({
        occurrenceId: `o${index + 1}`,
        criterion: `Вимога ${index + 1}: перевірка виконання прихованих робіт за проєктом.`,
        normRef: {
          text: "ДБН А.3.1-5:2016, Додаток Н", verification: "VERIFIED_PRIMARY" as const, source: DBN_SOURCE,
        },
      })),
    });

    expect(card.text.length).toBeLessThanOrEqual(MAX_TELEGRAM_MESSAGE_CHARACTERS);
    expect(card.text).toContain("12. Вимога 12");
  });

  it("escapes receipt details before rendering provider HTML", () => {
    // Break caught: a provider-derived detail becomes executable Telegram HTML.
    expect(formatTelegramReceipt("Документ <не прийнято & перевірте>").text)
      .toContain("Документ &lt;не прийнято &amp; перевірте&gt;");
  });
});

describe("the citation a requirement_occurrences row is allowed to carry into a card", () => {
  it("takes the text, the tag and the source from a fully cited row", () => {
    expect(assignmentCardCitationOf({
      norm_ref: "ДБН А.3.1-5:2016, Додаток Н",
      norm_ref_verification: "VERIFIED_PRIMARY",
      norm_ref_source: DBN_SOURCE,
    })).toEqual({
      text: "ДБН А.3.1-5:2016, Додаток Н", verification: "VERIFIED_PRIMARY", source: DBN_SOURCE,
    });
  });

  it("carries no citation when the row has no norm_ref", () => {
    expect(assignmentCardCitationOf({
      norm_ref: null, norm_ref_verification: null, norm_ref_source: null,
    })).toBeNull();
  });

  it("withholds a citation whose source is missing or blank", () => {
    // Break caught: `requirement_occurrences_norm_ref_sourced_check` (0043)
    // forbids this row, and a renderer that trusts a CHECK instead of the value
    // in front of it prints the normative text unattributed the day the
    // constraint is widened.
    expect(assignmentCardCitationOf({
      norm_ref: "ДБН А.3.1-5:2016, Додаток Н", norm_ref_verification: "VERIFIED_PRIMARY", norm_ref_source: null,
    })).toBeNull();
    expect(assignmentCardCitationOf({
      norm_ref: "ДБН А.3.1-5:2016, Додаток Н", norm_ref_verification: "VERIFIED_PRIMARY", norm_ref_source: "   ",
    })).toBeNull();
    expect(assignmentCardCitationOf({
      norm_ref: "ДБН А.3.1-5:2016, Додаток Н", norm_ref_verification: null, norm_ref_source: DBN_SOURCE,
    })).toBeNull();
  });

  it("withholds a citation whose tag has no Ukrainian label", () => {
    // Break caught: the verification CHECK was widened once already (0059 added
    // PROJECT_DOCUMENTATION). A value the label table does not know must cost
    // the card its citation, never render as an untranslated storage token.
    expect(assignmentCardCitationOf({
      norm_ref: "ДБН А.3.1-5:2016, Додаток Н", norm_ref_verification: "UNVERIFIED", norm_ref_source: DBN_SOURCE,
    })).toBeNull();
  });
});

describe("what the citation guard refuses", () => {
  it.each(["toString", "constructor", "valueOf", "hasOwnProperty"])(
    "withholds a citation whose tag is only an inherited property (%s)", (tag) => {
      // Break caught: `in` walks the prototype chain, so these tags produced a
      // citation whose label is a function and crashed the renderer with a 500
      // instead of withholding the text.
      expect(assignmentCardCitationOf({
        norm_ref: "ДБН А.3.1-5:2016, Додаток Н", norm_ref_verification: tag, norm_ref_source: DBN_SOURCE,
      })).toBeNull();
    });

  it("withholds a citation whose text is blank", () => {
    // Break caught: 0043's CHECK btrims the SOURCE and not the text, so a
    // whitespace-only norm_ref is storable and rendered a verification label
    // and a full source attached to no normative text.
    expect(assignmentCardCitationOf({
      norm_ref: "   ", norm_ref_verification: "VERIFIED_PRIMARY", norm_ref_source: DBN_SOURCE,
    })).toBeNull();
  });
});

describe("the requirement-choice prompt", () => {
  const cited = {
    occurrenceId: "o1", criterion: "Підготовка ніш, каналів та борозен.",
    normRef: { text: "ДБН А.3.1-5:2016, Додаток Н", verification: "VERIFIED_PRIMARY" as const, source: DBN_SOURCE },
  };
  const uncited = { occurrenceId: "o2", criterion: "Текст вимоги, який ніхто не атрибутував.", normRef: null };

  it("carries the tag and the source of every requirement it offers", () => {
    // Break caught: the prompt labelled each button `left(acceptance_criterion,120)`
    // (0071), so a normative string reached a закрита група truncated, with no
    // verification tag and no source — prohibition T, in the renderer the card
    // hands over to.
    const prompt = formatRequirementChoicePrompt([cited]);

    expect(prompt.text).toContain("1. Підготовка ніш, каналів та борозен.");
    expect(prompt.text).toContain("перевірено за першоджерелом");
    expect(prompt.text).toContain(DBN_SOURCE);
  });

  it("withholds the text of an unattributed requirement here too", () => {
    // Break caught: the card withheld this criterion and the prompt printed it
    // in the same chat a moment later.
    const prompt = formatRequirementChoicePrompt([cited, uncited]);

    expect(prompt.text).not.toContain("Текст вимоги, який ніхто не атрибутував.");
    expect(prompt.text).toContain("2. Вимога без підтвердженого джерела — текст не показано.");
  });

  it("puts no normative string on a button", () => {
    // Break caught: a Telegram button label cannot carry a ~300-character
    // source, so nothing normative may ride on one. The button is the number of
    // the line above it and nothing else.
    const prompt = formatRequirementChoicePrompt([cited, uncited]);

    expect(prompt.buttons).toEqual(["Вимога 1", "Вимога 2"]);
    for (const button of prompt.buttons) {
      expect(button).not.toContain("Підготовка");
      expect(button).not.toContain("ДБН");
    }
  });

  it("is never longer than the card the same requirements were published on", () => {
    // The budget argument this renderer rests on: the prompt's lines are a
    // SUBSET of the card's and its sources are a subset of the card's, so a card
    // that passed the 4096 gate at publication guarantees the prompt fits.
    const occurrences = [cited, uncited, { ...cited, occurrenceId: "o3" }];
    const card = formatAssignmentCard({ assignmentId: "a", title: "Заголовок картки", occurrences });

    expect(formatRequirementChoicePrompt(occurrences).text.length).toBeLessThanOrEqual(card.text.length);
    expect(formatRequirementChoicePrompt(occurrences).text.length).toBeLessThanOrEqual(MAX_TELEGRAM_MESSAGE_CHARACTERS);
  });
});

describe("the requirement-list disclaimers on the card and the prompt (BL-156)", () => {
  const seeded = {
    occurrenceId: "o1", criterion: "Підготовка ніш, каналів та борозен.",
    normRef: { text: "ДБН А.3.1-5:2016, Додаток Н", verification: "VERIFIED_PRIMARY" as const, source: DBN_SOURCE },
  };
  const project = {
    occurrenceId: "o2", criterion: "Крок стрижнів за кресленням.",
    normRef: {
      text: "Робоча документація об'єкта", verification: "PROJECT_DOCUMENTATION" as const,
      source: "Приклад-РД-2026-014, арк. 12, кресл. АР-07",
    },
  };
  const withheldProject = { occurrenceId: "o3", criterion: "Текст без джерела.", normRef: null };
  const instruction = "Надішліть фото у відповідь на це повідомлення.";

  function card(occurrences: Array<typeof seeded | typeof project | typeof withheldProject>, title = "Заголовок") {
    return formatAssignmentCard({ assignmentId: "a", title, occurrences }).text;
  }

  it("prints the довідковий disclaimer once, after the sources and before the instruction", () => {
    // Break caught: the card is a generated requirement list (prohibition T)
    // and printed no disclaimer, so Додаток Н items read as the mandatory list
    // for the object (prohibition C).
    const text = card([seeded]);

    expect(text.split(DOVIDKOVYI_DISCLAIMER_TEXT)).toHaveLength(2);
    expect(text.indexOf(DOVIDKOVYI_DISCLAIMER_TEXT)).toBeGreaterThan(text.indexOf("<b>Джерела</b>"));
    expect(text.indexOf(DOVIDKOVYI_DISCLAIMER_TEXT)).toBeLessThan(text.indexOf(instruction));
    expect(text).not.toContain(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT);
  });

  it("prints the project-sourced note immediately after it when one item is project-sourced", () => {
    for (const occurrences of [[seeded, project], [project], [project, seeded]]) {
      const text = card(occurrences);
      const both = `${DOVIDKOVYI_DISCLAIMER_TEXT}\n\n${PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT}`;
      expect(text).toContain(both);
      expect(text.split(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT)).toHaveLength(2);
    }
  });

  it("adds no project-sourced note for a requirement whose citation was withheld", () => {
    // A withheld citation prints no label, so there is no label to explain.
    const text = card([seeded, withheldProject]);

    expect(text).toContain(DOVIDKOVYI_DISCLAIMER_TEXT);
    expect(text).not.toContain(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT);
  });

  it("prints the same disclaimers on the requirement-choice prompt", () => {
    expect(formatRequirementChoicePrompt([seeded]).text.split(DOVIDKOVYI_DISCLAIMER_TEXT)).toHaveLength(2);
    expect(formatRequirementChoicePrompt([seeded]).text).not.toContain(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT);
    const mixed = formatRequirementChoicePrompt([seeded, project]).text;
    expect(mixed).toContain(`${DOVIDKOVYI_DISCLAIMER_TEXT}\n\n${PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT}`);
    expect(mixed.split(DOVIDKOVYI_DISCLAIMER_TEXT)).toHaveLength(2);
    expect(mixed.split(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT)).toHaveLength(2);
  });

  it("keeps the prompt no longer than the card when a project-sourced item is on both", () => {
    const occurrences = [seeded, project, withheldProject];
    const published = card(occurrences, "Заголовок картки");

    for (const candidates of [occurrences, [project], [seeded], [seeded, withheldProject]]) {
      expect(formatRequirementChoicePrompt(candidates).text.length).toBeLessThanOrEqual(published.length);
    }
  });

  it("keeps twelve Додаток Н items, one project item and a long title inside one message", () => {
    const text = card([
      ...Array.from({ length: 12 }, (_, index) => ({
        ...seeded, occurrenceId: `s${index + 1}`,
        criterion: `Вимога ${index + 1}: перевірка виконання прихованих робіт за проєктом.`,
      })),
      project,
    ], "Приховані роботи ".repeat(12));

    expect(text.length).toBeLessThanOrEqual(MAX_TELEGRAM_MESSAGE_CHARACTERS);
    expect(text).toContain(PROJECT_SOURCED_ITEMS_DISCLAIMER_TEXT);
  });

  it("refuses a card that fits only without its disclaimers, rather than dropping them", () => {
    // Without the disclaimers this card is a few characters under the limit;
    // with them it is over, and the refusal is the existing one.
    const base = card([seeded]).length - DOVIDKOVYI_DISCLAIMER_TEXT.length - 2;
    const title = "я".repeat(MAX_TELEGRAM_MESSAGE_CHARACTERS - base + "Заголовок".length - 10);

    expect(() => card([seeded], title)).toThrow("assignment_card_too_long");
  });
});
