import type { VerificationTagValue } from "@goproceed/contracts";
import { NORM_REF_VERIFICATION_LABELS, normRefVerificationLabel } from "../norm-ref-labels";
import { requirementListDisclaimers } from "../required-disclaimers";

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
 * confirmed source. THE LINE SURVIVES, NUMBER AND ALL, because the card is the
 * assignment's own list: `telegram_occurrence_snapshot` carries every
 * occurrence id the card was published for, and a card that silently omitted
 * one would understate what the assignment obliges while looking complete.
 * The reader is told a requirement is there and that its text is withheld.
 *
 * It is NOT an alignment with the requirement-choice prompt. That prompt
 * carries no ordinals at all — `processor.ts` labels each button with the
 * criterion text and an opaque `req:<token>` — and
 * `app.resolve_telegram_evidence_context` (0071) orders by `ordinal, id` with
 * no timing rank and filters to `photo`/`document`, so its list is neither
 * this order nor this set. An earlier version of this comment claimed that
 * alignment; it was wrong, and the claim had reached
 * hidden-works-content-rules.md before it was caught.
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
  // BLANK IS ABSENT, on both halves. `requirement_occurrences_norm_ref_sourced_check`
  // (0043) btrims the source and not the text, so `norm_ref = '   '` with a tag and a
  // source is a storable row that rendered a verification label and a full source
  // attached to no normative text at all.
  if (row.norm_ref.trim().length === 0) return null;
  if (row.norm_ref_source.trim().length === 0) return null;
  if (row.norm_ref_verification === null) return null;
  // `Object.hasOwn`, NOT `in`: `in` walks the prototype chain, so «toString»,
  // «constructor» and «valueOf» passed this guard, produced a citation whose
  // verification is a function, and crashed the renderer inside
  // escapeTelegramHtml — a 500 on publication, from the one line whose job is
  // to withhold a tag it cannot label.
  if (!Object.hasOwn(NORM_REF_VERIFICATION_LABELS, row.norm_ref_verification)) return null;
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

/**
 * A stored value is ONE LINE of this message, never two. Escaping covers `&`,
 * `<` and `>`; it does nothing about a newline, and the message's structure is
 * carried by newlines — «N. …» for a requirement, «[k] …» for a source. Without
 * this, a workspace member who can author a rule could put «\n13. …» in a
 * criterion and forge a requirement inside a message that carries the bot's
 * authority in a chat where field members do not post. Whitespace is collapsed,
 * not removed: no character of a normative string is dropped and nothing is
 * abbreviated (INV-073).
 */
function flattenToOneLine(value: string): string {
  return value.replace(/[\r\n\t\f\v\u2028\u2029]+/g, " ");
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
  const instruction = "\n\nНадішліть фото у відповідь на це повідомлення.";
  const title = escapeTelegramHtml(flattenToOneLine(payload.title));
  const text = `${prefix}${title}${renderRequirements(payload.occurrences)}${instruction}`;
  if (text.length > MAX_TELEGRAM_MESSAGE_CHARACTERS) throw new AssignmentCardTooLongError();

  return {
    text,
    parseMode: "HTML",
  };
}

/**
 * The numbered requirement list and the source block under it — the ONE place
 * a citation becomes text, shared by the assignment card and the
 * requirement-choice prompt so the two renderers cannot drift apart on the rule
 * they both answer to (prohibition T of hidden-works-content-rules.md).
 *
 * One entry per DISTINCT source, numbered by first appearance. The Додаток Н
 * citation is ~300 characters and every item of a position carries the same
 * one, so a per-requirement copy costs a twelve-item card its 4096-character
 * budget and turns a lawful publication into a refusal its author cannot act
 * on. The source is never abbreviated: a truncated sha256 or a cut URL is a
 * string rendered without its source, which is the thing this slice fixes.
 *
 * THE DISCLAIMERS FOLLOW THE SOURCES (BL-156). The card is a generated
 * requirement list (prohibition T), so it carries what
 * hidden-works-content-rules.md §"Required disclaimers" puts under one: the
 * довідковий text, then the project-sourced note when a PRINTED citation is
 * `PROJECT_DOCUMENTATION` — a withheld one prints no label to explain. In full
 * and never in `<blockquote expandable>` or `<tg-spoiler>`: «never collapsed».
 * They count toward the 4096 budget; a card they push over it is refused, not
 * shortened.
 */
function renderRequirements(
  occurrences: ReadonlyArray<{ criterion: string; normRef: AssignmentCardCitation | null }>,
  heading = "Вимоги",
): string {
  const markers = new Map<string, number>();
  const lines = occurrences.map((occurrence, index) => {
    const ordinal = `${index + 1}. `;
    if (occurrence.normRef === null) return `${ordinal}${UNSOURCED_REQUIREMENT_LINE}`;
    const marker = markers.get(occurrence.normRef.source) ?? markers.size + 1;
    markers.set(occurrence.normRef.source, marker);
    return `${ordinal}${escapeTelegramHtml(flattenToOneLine(occurrence.criterion))}\n   `
      + `${escapeTelegramHtml(flattenToOneLine(occurrence.normRef.text))} — `
      + `${escapeTelegramHtml(normRefVerificationLabel(occurrence.normRef.verification))} [${marker}]`;
  });
  const sources = [...markers.entries()]
    .map(([source, marker]) => `[${marker}] ${escapeTelegramHtml(flattenToOneLine(source))}`);
  const disclaimers = requirementListDisclaimers(occurrences.map((occurrence) => occurrence.normRef))
    .map((disclaimer) => `\n\n${escapeTelegramHtml(disclaimer)}`);
  return `\n\n<b>${heading}</b>\n${lines.join("\n")}`
    + (sources.length > 0 ? `\n\n<b>Джерела</b>\n${sources.join("\n")}` : "")
    + disclaimers.join("");
}

/**
 * The prompt that offers a photo's candidate requirements back to the sender.
 * Its BUTTONS carry no normative string — a Telegram button label is far too
 * short to hold a ~300-character source, so the text that needs attribution
 * lives in the message and the button is the number of the line above it. The
 * previous shape put `left(acceptance_criterion,120)` on the button (0071),
 * which published a truncated normative string with neither tag nor source into
 * the same закрита група the card had just withheld it from.
 *
 * IT CANNOT OVERFLOW. Its lines are a subset of the card's (the candidates for
 * one file), its sources are the subset those lines cite, its disclaimers are a
 * subset of the card's (the project-sourced note needs a project-sourced
 * candidate, and every candidate is on the card), and its heading is shorter
 * than the card's title plus instruction; the card already passed the 4096 gate
 * at publication, so this fits whenever that did. A card published before
 * BL-156 carried no disclaimers and would break that argument; on 2026-09-24 no
 * hosted project held a single `communication_messages` row (DEV-075).
 */
export function formatRequirementChoicePrompt(
  occurrences: ReadonlyArray<{ criterion: string; normRef: AssignmentCardCitation | null }>,
): { text: string; parseMode: "HTML"; buttons: string[] } {
  const text = `<b>Виберіть вимогу для цих зображень</b>${renderRequirements(occurrences)}`;
  if (text.length > MAX_TELEGRAM_MESSAGE_CHARACTERS) throw new AssignmentCardTooLongError();
  return { text, parseMode: "HTML", buttons: occurrences.map((_, index) => `Вимога ${index + 1}`) };
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
