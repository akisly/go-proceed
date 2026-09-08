import { describe, expect, it } from "vitest";
import {
  assignmentCardCitationOf, formatAssignmentCard, formatTelegramReceipt, MAX_TELEGRAM_MESSAGE_CHARACTERS,
} from "./cards";

/**
 * THE DBN CITATION AS IT IS ACTUALLY STORED — copied from
 * `technical/requirements/dbn-a31-5-2016-dodatok-n.csv`, not shortened for the
 * test. Its length is the point: ~300 characters repeated per requirement is
 * what makes the shared source block necessary rather than decorative, and a
 * fixture typed short would hide that (test-strategy.md:139-152).
 */
const DBN_SOURCE = "ДБН А.3.1-5:2016 Додаток Н; офіційний файл e-construction.gov.ua, "
  + "https://e-construction.gov.ua/laws_detail/3879707932224390963, завантажено 2026-08-10, "
  + "sha256=4592edafaa8097d3b9305b7934d080256d649616a2741b6a5537a28606a665e3; "
  + "незалежність будь-яких додаткових копій не встановлена";

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

    expect(card.text).toContain("1. Перше.");
    expect(card.text).toContain("2. Друге.");
    expect(card.text.indexOf(`[1] ${DBN_SOURCE}`)).toBeGreaterThan(-1);
    expect(card.text).toContain("[2] Приклад-РД-2026-014, арк. 12, кресл. АР-07");
    expect(card.text.indexOf("[1] ")).toBeLessThan(card.text.indexOf("[2] "));
  });

  it("withholds the text of a requirement that carries no confirmed source, keeping its ordinal", () => {
    // Break caught: a criterion with no verification tag and no source reaches
    // a закрита група as normative text — the render half of INV-073. The
    // ordinal stays because it is the number the requirement-choice prompt
    // offers back (app.resolve_telegram_evidence_context orders by ordinal, id).
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
