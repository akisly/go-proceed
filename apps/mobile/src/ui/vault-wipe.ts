import { Alert } from "react-native";
import type { NativeRuntime } from "../lib/native/runtime";

/**
 * «Стерти» for a vault that cannot open. Its journal cannot be read, so the wipe
 * cannot be limited to one person: the copy says so and gives no count.
 * `onDone` receives null on success, or the message to show.
 */
export function confirmWipe(runtime: Pick<NativeRuntime, "wipe">, signedIn: boolean, onDone: (message: string | null) => void): void {
  Alert.alert(signedIn ? "Стерти фото на пристрої та вийти?" : "Стерти фото на пристрої?",
    "Захищене сховище на цьому телефоні не відкривається. Застосунок зітре всі фото на ньому, які сервер ще не підтвердив, — для всіх облікових записів і робочих просторів. Відновити їх буде неможливо, їх доведеться зняти знову. Якщо надсилання якогось фото вже почалося, сервер ще може його отримати.",
    [{ text: "Скасувати", style: "cancel" },
      { text: signedIn ? "Стерти й вийти" : "Стерти", style: "destructive", onPress: () => {
        void runtime.wipe().then((result) => onDone(result.keysDeleted && result.ciphertextDeleted && result.directoryDeleted ? null
          : "Фото вже не можна відкрити, але частину файлів не вдалося прибрати. Якщо сховище й далі недоступне, зітріть його ще раз."))
          .catch(() => onDone("Не вдалося стерти фото. Перезапустіть телефон і спробуйте ще раз. Якщо не допоможе — зверніться до керівника."));
      } }]);
}
