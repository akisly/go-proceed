import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useNetworkState } from "expo-network";
import { pendingSummary } from "../lib/native/item-labels";
import { AppText, Button, Card, Loading, Notice, Page } from "../ui/primitives";
import { useSessionGate } from "../ui/session-gate";
import { confirmWipe } from "../ui/vault-wipe";

export function Profile() {
  const runtime = useSessionGate("/profile");
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After a sign-out that could not lock the photos, offer the wipe as the way out.
  const [lockFailed, setLockFailed] = useState(false);
  const network = useNetworkState();
  if (!runtime.session) return <Page><Loading /></Page>;
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const broken = runtime.status === "error";

  const summary = pendingSummary(runtime.itemsKnown, runtime.items);
  async function signOut() {
    setLeaving(true); setError(null);
    try {
      await runtime.signOut();
      router.replace("/login");
    } catch {
      // Fail closed: the session stays when unsent photos could not be locked first.
      setError("Не вдалося заблокувати ненадіслані фото, тому вийти зараз не можна. Спробуйте ще раз.");
      setLockFailed(true);
      setLeaving(false);
    }
  }
  const offlineNote = offline ? " Немає з’єднання, тому вихід відбудеться лише на цьому телефоні: вхід буде стерто з пристрою одразу." : "";
  function confirmSignOut() {
    // Warn unless the journal was read and is empty: unknown is not "nothing to lose".
    if (broken) {
      Alert.alert("Вийти?", `Захищене сховище на цьому телефоні не відкривається. Ненадіслані фото, якщо вони є, залишаться заблокованими на пристрої: їх не зможе переглянути чи надіслати ніхто інший.${offlineNote}`,
        [{ text: "Залишитися", style: "cancel" }, { text: "Вийти", style: "destructive", onPress: () => { void signOut(); } }]);
      return;
    }
    if (summary.known && summary.pending === 0 && !runtime.pendingElsewhere && !runtime.othersUnknown) {
      if (!offline) { void signOut(); return; }
      Alert.alert("Вийти?", offlineNote.trim(), [{ text: "Залишитися", style: "cancel" }, { text: "Вийти", style: "destructive", onPress: () => { void signOut(); } }]);
      return;
    }
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
        : summary.pending === 0 ? "У цьому робочому просторі всі фото підтверджено сервером." : `Очікують надсилання: ${summary.pending} фото.`}</AppText>
      <Button secondary label="Відкрити надсилання" onPress={() => router.push("/queue")} />
    </Card>
    {broken ? <Notice error>Захищене сховище на цьому телефоні не відкривається, тому знімати й надсилати фото зараз не можна.</Notice> : null}
    {error ? <Notice error announce>{error}</Notice> : null}
    <Button label={leaving ? "Виходимо…" : "Вийти"} disabled={leaving} onPress={confirmSignOut} />
    {broken || lockFailed ? <Button secondary label="Стерти фото й вийти" disabled={leaving}
      // The session gate leaves this screen once the session is gone; a message stays for a partial wipe.
      onPress={() => confirmWipe(runtime, true, (message) => { if (message) setError(message); })} /> : null}
    <AppText variant="meta" secondary>GoProceed {Constants.expoConfig?.version ?? ""}</AppText>
  </Page>;
}
