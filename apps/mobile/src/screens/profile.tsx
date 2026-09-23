import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { pendingSummary } from "../lib/native/item-labels";
import { AppText, Button, Card, Loading, Notice, Page } from "../ui/primitives";
import { useSessionGate } from "../ui/session-gate";

export function Profile() {
  const runtime = useSessionGate("/profile");
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!runtime.session) return <Page><Loading /></Page>;

  const summary = pendingSummary(runtime.itemsKnown, runtime.items);
  async function signOut() {
    setLeaving(true); setError(null);
    try {
      await runtime.signOut();
      router.replace("/login");
    } catch {
      // Fail closed: without the vault, unsent photos cannot be locked before the session goes.
      setError(runtime.status === "error"
        ? "Захищене сховище недоступне, тому ненадіслані фото не можна заблокувати, і вийти зараз не можна. Перезапустіть застосунок. Якщо не допоможе — зверніться до керівника."
        : "Не вдалося вийти. Спробуйте ще раз.");
      setLeaving(false);
    }
  }
  function confirmSignOut() {
    // Warn unless the journal was read and is empty: unknown is not "nothing to lose".
    if (summary.known && summary.pending === 0 && !runtime.pendingElsewhere && !runtime.othersUnknown) { void signOut(); return; }
    const certain = summary.known && summary.pending > 0;
    const count = certain
      ? `На пристрої ${runtime.pendingElsewhere || runtime.othersUnknown ? "щонайменше " : ""}${summary.pending} фото, яких сервер ще не отримав` : "На пристрої можуть бути фото, яких сервер ще не отримав";
    Alert.alert(certain ? "Є ненадіслані фото" : "Можуть бути ненадіслані фото",
      `${count}. Після виходу їх буде заблоковано: ніхто інший не зможе їх переглянути чи надіслати. Щоб надіслати їх, увійдіть знову в цей самий обліковий запис.`,
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
    {error ? <Notice error>{error}</Notice> : null}
    <Button label={leaving ? "Виходимо…" : "Вийти"} disabled={leaving} onPress={confirmSignOut} />
    <AppText variant="meta" secondary>GoProceed {Constants.expoConfig?.version ?? ""}</AppText>
  </Page>;
}
