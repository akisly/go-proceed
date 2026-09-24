import { Alert } from "react-native";
import type { NativeRuntime, WipeOutcome } from "../lib/native/runtime";

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
export const WIPE_FAILED_MESSAGE = "Не вдалося стерти фото. Перезапустіть телефон і спробуйте ще раз. Якщо не допоможе — зверніться до керівника.";

/**
 * «Стерти» for a vault that cannot open (owner, 2026-09-24). Its journal cannot be
 * read, so the wipe cannot be limited to one person: the copy says so and gives no
 * count. `onStart` fires once confirmed; `onDone` gets the message to show, or null.
 */
export function confirmWipe(runtime: Pick<NativeRuntime, "wipe">, signedIn: boolean,
  onStart: () => void, onDone: (message: string | null) => void): void {
  Alert.alert(signedIn ? "Стерти фото на пристрої та вийти?" : "Стерти фото на пристрої?",
    "Захищене сховище на цьому телефоні не відкривається. Застосунок зітре всі фото на ньому, які сервер ще не підтвердив, — для всіх облікових записів і робочих просторів. Відновити їх буде неможливо, їх доведеться зняти або додати знову. Якщо надсилання якогось фото вже почалося, сервер ще може його отримати.",
    [{ text: "Скасувати", style: "cancel" },
      { text: signedIn ? "Стерти й вийти" : "Стерти", style: "destructive", onPress: () => {
        onStart();
        void runtime.wipe().then((outcome) => onDone(wipeMessage(outcome)), () => onDone(WIPE_FAILED_MESSAGE));
      } }]);
}
