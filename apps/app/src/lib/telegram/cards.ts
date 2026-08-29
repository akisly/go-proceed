export const MAX_TELEGRAM_MESSAGE_CHARACTERS = 4096;

export interface AssignmentCardPayload {
  assignmentId: string;
  title: string;
  occurrences: Array<{
    occurrenceId: string;
    criterion: string;
    normRef: string;
  }>;
}

export type TelegramFormattedMessage = {
  text: string;
  parseMode: "HTML";
};

export class AssignmentCardTooLongError extends Error {
  constructor() {
    super("assignment_card_too_long");
  }
}

function escapeTelegramHtml(value: string): string {
  return value.replace(/[&<>]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  })[character]!);
}

function fitEscaped(value: string, budget: number): string {
  const encoded = escapeTelegramHtml(value);
  if (encoded.length <= budget) return encoded;
  if (budget <= 0) return "";
  if (budget === 1) return "…";

  let text = "";
  for (const character of value) {
    const escaped = escapeTelegramHtml(character);
    if (text.length + escaped.length > budget - 1) return `${text}…`;
    text += escaped;
  }
  return encoded;
}

/**
 * Assignment cards use Telegram's supported HTML formatting. Every dynamic
 * value is escaped and the rendered source is kept below Telegram's 4096
 * character sendMessage limit.
 */
export function formatAssignmentCard(payload: AssignmentCardPayload): TelegramFormattedMessage {
  const prefix = "<b>Завдання</b>\n";
  const requirementsHeading = "\n\n<b>Вимоги</b>\n";
  const instruction = "\n\nНадішліть фото у відповідь на це повідомлення.";
  const title = escapeTelegramHtml(payload.title);
  const lines = payload.occurrences.map((occurrence, index) =>
    `${index + 1}. ${escapeTelegramHtml(occurrence.criterion)} — ${escapeTelegramHtml(occurrence.normRef)}`,
  );
  const text = `${prefix}${title}${requirementsHeading}${lines.join("\n")}${instruction}`;
  if (text.length > MAX_TELEGRAM_MESSAGE_CHARACTERS) throw new AssignmentCardTooLongError();

  return {
    text,
    parseMode: "HTML",
  };
}

export function formatTelegramReceipt(detail: string): TelegramFormattedMessage {
  const prefix = "<b>GoProceed</b>\n";
  return {
    text: `${prefix}${fitEscaped(detail, MAX_TELEGRAM_MESSAGE_CHARACTERS - prefix.length)}`,
    parseMode: "HTML",
  };
}
