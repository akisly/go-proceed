import { describe, expect, it } from "vitest";
import { formatAssignmentCard, formatTelegramReceipt, MAX_TELEGRAM_MESSAGE_CHARACTERS } from "./cards";

describe("Telegram card formatting", () => {
  it("escapes provider markup in assignment data", () => {
    // Break caught: interpolating project data directly lets it become Telegram
    // HTML instead of literal assignment content.
    const card = formatAssignmentCard({
      assignmentId: "assignment-1",
      title: "Лоток <секція & 2>",
      occurrences: [{ occurrenceId: "o1", criterion: "Загальний план", normRef: "ДБН <Н.15>" }],
    });

    expect(card.text).toContain("Лоток &lt;секція &amp; 2&gt;");
    expect(card.text).toContain("ДБН &lt;Н.15&gt;");
    expect(card.parseMode).toBe("HTML");
  });

  it("keeps a long assignment card within Telegram's text limit", () => {
    // Break caught: a large but valid assignment can make the provider reject
    // the entire card before participants can reply to it.
    const card = formatAssignmentCard({
      assignmentId: "assignment-2",
      title: "Робота ".repeat(900),
      occurrences: [{ occurrenceId: "o1", criterion: "Критерій ".repeat(900), normRef: "ДБН" }],
    });

    expect(card.text.length).toBeLessThanOrEqual(MAX_TELEGRAM_MESSAGE_CHARACTERS);
    expect(card.text).toContain("…");
  });

  it("escapes receipt details before rendering provider HTML", () => {
    // Break caught: a provider-derived detail becomes executable Telegram HTML.
    expect(formatTelegramReceipt("Документ <не прийнято & перевірте>").text)
      .toContain("Документ &lt;не прийнято &amp; перевірте&gt;");
  });
});
