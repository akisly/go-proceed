import type { WipeOutcome } from "./runtime";

/** What the user is told after a wipe; null when everything worked. Each clause is a fact the runtime reported. */
export function wipeMessage(outcome: WipeOutcome): string | null {
  const parts: string[] = [];
  if (!(outcome.keysDeleted && outcome.ciphertextDeleted && outcome.directoryDeleted)) {
    parts.push("Фото вже не можна відкрити, але частину файлів не вдалося прибрати.");
  }
  if (outcome.signedOut === false) parts.push("Фото стерто, але вийти не вдалося. Натисніть «Вийти» ще раз.");
  if (!outcome.reopened) parts.push("Сховище й далі не відкривається. Перезапустіть застосунок; якщо не допоможе — зверніться до керівника.");
  return parts.length ? parts.join(" ") : null;
}
/** The notice for an outcome: a failure clause is an error; a clean wipe is said too (focus left with the card). */
export type WipeNote = { text: string; error: boolean };
export function wipeNote(outcome: WipeOutcome): WipeNote {
  const message = wipeMessage(outcome);
  return message ? { text: message, error: true } : { text: "Фото на пристрої стерто.", error: false };
}
export const WIPE_FAILED_MESSAGE = "Не вдалося стерти фото. Перезапустіть телефон і спробуйте ще раз. Якщо не допоможе — зверніться до керівника.";
