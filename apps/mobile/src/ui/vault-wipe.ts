import { Alert } from "react-native";
import type { NativeRuntime } from "../lib/native/runtime";
import { WIPE_FAILED_MESSAGE, wipeNote, type WipeNote } from "../lib/native/wipe-note";

export { wipeNote, type WipeNote } from "../lib/native/wipe-note";

/**
 * «Стерти» for a vault that cannot open (owner, 2026-09-24). Its journal cannot be
 * read, so the wipe cannot be limited to one person: the copy says so and gives no
 * count. `onStart` fires once confirmed; `onDone` gets the message to show, or null.
 */
export function confirmWipe(runtime: Pick<NativeRuntime, "wipe">, signedIn: boolean,
  onStart: () => void, onDone: (note: WipeNote) => void): void {
  Alert.alert(signedIn ? "Стерти фото на пристрої та вийти?" : "Стерти фото на пристрої?",
    "Захищене сховище на цьому телефоні не відкривається. Застосунок зітре всі фото на ньому, які сервер ще не підтвердив, — для всіх облікових записів і робочих просторів. Відновити їх буде неможливо, їх доведеться зняти або додати знову. Якщо надсилання якогось фото вже почалося, сервер ще може його отримати.",
    [{ text: "Скасувати", style: "cancel" },
      { text: signedIn ? "Стерти й вийти" : "Стерти", style: "destructive", onPress: () => {
        onStart();
        void runtime.wipe().then((outcome) => onDone(wipeNote(outcome)), () => onDone({ text: WIPE_FAILED_MESSAGE, error: true }));
      } }]);
}
