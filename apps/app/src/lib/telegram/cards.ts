import type { VerificationTagValue } from "@goproceed/contracts";
import { NORM_REF_VERIFICATION_LABELS, normRefVerificationLabel } from "../norm-ref-labels";

export const MAX_TELEGRAM_MESSAGE_CHARACTERS = 4096;

/**
 * A citation is INDIVISIBLE — the text, its verification tag and its source are
 * one value or there is no citation. INV-073's rendering half («`normRef`
 * travels with its verification tag and its source or not at all — never render
 * the text without both») is expressed here as a type rather than as a rule the
 * caller is trusted to keep, because the card route used to pass the text alone
 * and substitute «Нормативне посилання не вказано» for a missing one, which is
 * exactly the string M0 gate 9 forbids (ADR-011 open item 9, ruled 2026-09-03).
 */
export interface AssignmentCardCitation {
  text: string;
  verification: VerificationTagValue;
  source: string;
}

export interface AssignmentCardPayload {
  assignmentId: string;
  title: string;
  occurrences: Array<{
    occurrenceId: string;
    criterion: string;
    normRef: AssignmentCardCitation | null;
  }>;
}

/**
 * What stands where a requirement's own words would be when it carries no
 * confirmed source. The ORDINAL SURVIVES: it is the number the requirement
 * choice prompt offers back, and `app.resolve_telegram_evidence_context`
 * (0071) orders occurrences by `ordinal, id` exactly as the card route does,
 * so dropping the line would misalign the two.
 */
const UNSOURCED_REQUIREMENT_LINE = "Вимога без підтвердженого джерела — текст не показано.";

/**
 * The one place a `public.requirement_occurrences` row becomes a citation, and
 * the only way one enters a card. It ASKS THE ROW rather than trusting
 * `requirement_occurrences_norm_ref_sourced_check` (0043): a constraint is a
 * promise about rows already written, and this renderer must stay correct on
 * the day the promise is widened — the verification vocabulary was already
 * widened once, by 0059. A tag with no Ukrainian label costs the citation
 * rather than reaching a закрита група as a storage token.
 */
export function assignmentCardCitationOf(row: {
  norm_ref: string | null;
  norm_ref_verification: string | null;
  norm_ref_source: string | null;
}): AssignmentCardCitation | null {
  if (row.norm_ref === null || row.norm_ref_source === null) return null;
  if (row.norm_ref_source.trim().length === 0) return null;
  if (row.norm_ref_verification === null) return null;
  if (!(row.norm_ref_verification in NORM_REF_VERIFICATION_LABELS)) return null;
  return {
    text: row.norm_ref,
    verification: row.norm_ref_verification as VerificationTagValue,
    source: row.norm_ref_source,
  };
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
  const sourcesHeading = "\n\n<b>Джерела</b>\n";
  const instruction = "\n\nНадішліть фото у відповідь на це повідомлення.";
  const title = escapeTelegramHtml(payload.title);

  // One entry per DISTINCT source, numbered by first appearance. The Додаток Н
  // citation is ~300 characters and every item of a position carries the same
  // one, so a per-requirement copy costs a twelve-item card its 4096-character
  // budget and turns a lawful publication into a refusal its author cannot act
  // on. The source is never abbreviated: a truncated sha256 or a cut URL is a
  // string rendered without its source, which is the thing this slice fixes.
  const markers = new Map<string, number>();
  const lines = payload.occurrences.map((occurrence, index) => {
    const ordinal = `${index + 1}. `;
    if (occurrence.normRef === null) return `${ordinal}${UNSOURCED_REQUIREMENT_LINE}`;
    const marker = markers.get(occurrence.normRef.source) ?? markers.size + 1;
    markers.set(occurrence.normRef.source, marker);
    return `${ordinal}${escapeTelegramHtml(occurrence.criterion)}\n   `
      + `${escapeTelegramHtml(occurrence.normRef.text)} — `
      + `${escapeTelegramHtml(normRefVerificationLabel(occurrence.normRef.verification))} [${marker}]`;
  });
  const sources = [...markers.entries()].map(([source, marker]) => `[${marker}] ${escapeTelegramHtml(source)}`);
  const text = `${prefix}${title}${requirementsHeading}${lines.join("\n")}`
    + (sources.length > 0 ? `${sourcesHeading}${sources.join("\n")}` : "")
    + instruction;
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

/** Explicit controls only: ordinary chat text is never an evidence decision. */
export function formatEvidenceDecisionActions(input: { acceptedCallback: string; returnedCallback: string }): {
  text: string;
  inlineKeyboard: Array<Array<{ text: string; callbackData: string }>>;
} {
  return {
    text: "GoProceed\nОберіть явну дію щодо доказів.",
    inlineKeyboard: [[
      { text: "Прийняти", callbackData: input.acceptedCallback },
      { text: "Повернути", callbackData: input.returnedCallback },
    ]],
  };
}
