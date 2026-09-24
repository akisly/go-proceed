import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useNetworkState } from "expo-network";
import { heldCount, pendingSummary } from "../lib/native/item-labels";
import { AppText, Button, Card, Loading, Notice, Page } from "../ui/primitives";
import { useSessionGate } from "../ui/session-gate";
import { confirmWipe } from "../ui/vault-wipe";

export function Profile() {
  const runtime = useSessionGate("/profile");
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);
  const network = useNetworkState();
  if (!runtime.session) return <Page><Loading /></Page>;
  const offline = network.isConnected === false || network.isInternetReachable === false;
  // Only a vault that cannot open; a failed reinstall reset is retried and never wiped.
  const broken = runtime.status === "error" && runtime.errorReason === "vault";

  const summary = pendingSummary(runtime.itemsKnown, runtime.items);
  const held = heldCount(runtime.items);
  async function signOut() {
    setLeaving(true); setError(null);
    try {
      await runtime.signOut();
      router.replace("/login");
    } catch (reason) {
      // Fail closed: the session stays. Only a working vault had photos to lock.
      const incomplete = reason instanceof Error && reason.message === "SIGN_OUT_INCOMPLETE";
      setError(broken || incomplete ? "Не вдалося вийти. Спробуйте ще раз."
        : "Не вдалося заблокувати ненадіслані фото, тому вийти зараз не можна. Спробуйте ще раз.");
      setLeaving(false);
    }
  }
  // Every sign-out is on this phone only; offline, the server is simply not told.
  const offlineNote = offline ? " Немає з’єднання: сервер не дізнається про вихід, але вхід буде видалено з цього телефона." : "";
  function confirmSignOut() {
    // Warn unless the journal was read and is empty: unknown is not "nothing to lose".
    if (broken) {
      Alert.alert("Вийти?", `Захищене сховище на цьому телефоні не відкривається. Ненадіслані фото, якщо вони є, залишаться заблокованими на пристрої: їх не зможе переглянути чи надіслати ніхто інший.${offlineNote}`,
        [{ text: "Залишитися", style: "cancel" }, { text: "Вийти", style: "destructive", onPress: () => { void signOut(); } }]);
      return;
    }
    if (summary.known && summary.pending === 0 && !runtime.pendingElsewhere && !runtime.othersUnknown) { void signOut(); return; }
    const certain = summary.known && summary.pending > 0;
    const count = certain
      ? `На пристрої ${runtime.pendingElsewhere || runtime.othersUnknown ? "щонайменше " : ""}${summary.pending} фото, яких сервер ще не отримав` : "На пристрої можуть бути фото, яких сервер ще не отримав";
    Alert.alert(certain ? "Є ненадіслані фото" : "Можуть бути ненадіслані фото",
      `${count}. Після виходу їх буде заблоковано: ніхто інший не зможе їх переглянути чи надіслати. Щоб надіслати їх, увійдіть знову в цей самий обліковий запис.${offlineNote}`,
      [{ text: "Залишитися", style: "cancel" },
        { text: "Відкрити надсилання", onPress: () => router.push("/queue") },
        { text: "Вийти", style: "destructive", onPress: () => { void signOut(); } }]);
  }

  return <Page contentContainerStyle={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
    <Card>
      <AppText variant="meta" secondary>Ви ввійшли як</AppText>
      <AppText variant="h3">{runtime.session.user.email ?? "Обліковий запис без пошти"}</AppText>
    </Card>
    <Card>
      <AppText variant="h3">Надсилання</AppText>
      <AppText secondary>{!summary.known ? "Стан надсилання з’явиться після відкриття доручення."
        : summary.pending > 0 ? `Очікують надсилання: ${summary.pending} фото.`
          : held > 0 ? `Ненадісланих фото немає. Видалені фото (${held}) буде прибрано, щойно сервер підтвердить, що не отримав їх.`
            : "У цьому робочому просторі всі фото підтверджено сервером."}</AppText>
      <Button secondary label="Відкрити надсилання" onPress={() => router.push("/queue")} />
    </Card>
    {broken ? <Notice error>Захищене сховище на цьому телефоні не відкривається, тому знімати й надсилати фото зараз не можна.</Notice> : null}
    {error ? <Notice error announce>{error}</Notice> : null}
    <Button label={leaving ? "Виходимо…" : "Вийти"} disabled={leaving || wiping} onPress={confirmSignOut} />
    {/* Only for a vault that cannot open (owner, 2026-09-24). Once signed out, the login
        screen shows the wipe's outcome (runtime.lastWipe); a failed sign-out stays here. */}
    {broken ? <Button destructive label={wiping ? "Стираємо…" : "Стерти фото й вийти"} disabled={leaving || wiping}
      onPress={() => confirmWipe(runtime, true, () => { setWiping(true); setError(null); },
        (note) => { setWiping(false); if (note.error) setError(note.text); })} /> : null}
    <AppText variant="meta" secondary>GoProceed {Constants.expoConfig?.version ?? ""}</AppText>
  </Page>;
}
