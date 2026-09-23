import { useState } from "react";
import { Alert, Pressable, RefreshControl } from "react-native";
import { useNetworkState } from "expo-network";
import { useRouter } from "expo-router";
import { itemDetail, itemProblem, itemTitle, pendingSummary } from "../lib/native/item-labels";
import type { VaultItem } from "../lib/vault";
import { AppText, Button, Card, Loading, Notice, Page } from "../ui/primitives";
import { useSessionGate } from "../ui/session-gate";
import { palette, touchHeight } from "../ui/theme";

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" });
}

export function Queue() {
  const runtime = useSessionGate("/queue");
  const network = useNetworkState();
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!runtime.session || runtime.status === "booting") return <Page><Loading /></Page>;

  async function send() {
    setSending(true); setError(null);
    try { await runtime.send(); } catch { setError("Не вдалося почати надсилання. Спробуйте ще раз."); }
    finally { setSending(false); }
  }
  function confirmDiscard(item: VaultItem) {
    Alert.alert("Видалити фото з пристрою?",
      item.intentId
        ? "Надсилання цього фото вже почалося. Якщо сервер його ще може отримати, фото не буде видалено, і ми вас попередимо. Після видалення фото не можна буде надіслати — доведеться зняти його знову."
        : "Сервер його не отримав. Після видалення фото не можна буде надіслати — доведеться зняти його знову.",
      [{ text: "Скасувати", style: "cancel" },
        { text: "Видалити", style: "destructive", onPress: () => {
          void runtime.discard(item.id).catch((reason: unknown) => {
            const code = (reason as { code?: string }).code;
            setError(code === "ALREADY_RECEIVED"
              ? "Сервер уже отримав це фото, тому його не видалено. Воно зникне зі списку після підтвердження."
              : code === "RECEIPT_PENDING"
                ? "Сервер ще може отримати це фото, тому його не видалено. Застосунок завершить його надсилання, щойно буде зв’язок."
                : "Не вдалося видалити фото. Спробуйте ще раз.");
          });
        } }]);
  }

  const summary = pendingSummary(runtime.itemsKnown, runtime.items);
  const active = runtime.items.some((item) => item.state === "sending");
  return <Page contentContainerStyle={{ width: "100%", maxWidth: 720, alignSelf: "center" }}
    refreshControl={<RefreshControl refreshing={sending} onRefresh={() => { void send(); }} tintColor={palette["text-brand"]} />}>
    {runtime.status === "unavailable" || runtime.status === "error" ?
      <Notice error>Захищене сховище недоступне. Фото на цьому пристрої зараз не можна переглянути чи надіслати.</Notice> : null}
    {runtime.accessChanged ? <Notice error title="Доступ змінився">Сервер більше не приймає фото від вас у цьому робочому просторі. Фото залишаються на пристрої заблокованими. Зверніться до керівника проєкту.</Notice> : null}
    {network.isConnected === false ? <Notice title="Немає з’єднання">Фото залишаються збереженими на пристрої. Надішлемо, коли з’явиться зв’язок і застосунок буде відкритий.</Notice> : null}
    {error ? <Notice error>{error}</Notice> : null}
    {runtime.pendingElsewhere ? <Notice title="Є фото в іншому робочому просторі">Вони чекають, доки ви знову відкриєте доручення того робочого простору. Лише тоді їх буде надіслано.</Notice> : null}
    {!summary.known ? (runtime.status === "ready" && !runtime.accessChanged ?
      <Notice>Відкрийте доручення, щоб побачити фото цього робочого простору.</Notice> : null)
    : summary.pending === 0 ? <Card>
      <AppText variant="h2">У цьому робочому просторі все надіслано</AppText>
      <AppText secondary>Тут показано лише цей робочий простір. Фото інших робочих просторів з’являться, коли ви відкриєте їхні доручення.</AppText>
      {runtime.othersUnknown || runtime.pendingElsewhere ?
        <AppText secondary>Не видаляйте застосунок, доки не перевірите всі свої робочі простори: ненадіслані фото зберігаються лише на цьому пристрої.</AppText> : null}
    </Card> : <>
      <AppText secondary>Фото надсилаються, лише поки застосунок відкритий. Не видаляйте застосунок, доки на пристрої є ненадіслані фото — навіть з інших робочих просторів.</AppText>
      <Button label={sending || active ? "Надсилаємо…" : "Надіслати зараз"} disabled={sending || active || runtime.status !== "ready"}
        onPress={() => { void send(); }} />
      {runtime.items.filter((item) => item.state !== "server_confirmed").map((item) => {
        const problem = itemProblem(item), detail = itemDetail(item);
        return <Card key={item.id}>
          <AppText variant="meta" secondary>{item.originMethod === "photo_picker" ? "З галереї" : "Камера"} · {formatTime(item.claimedCaptureTime)}</AppText>
          <AppText variant="h3">{itemTitle(item)}</AppText>
          {detail ? <AppText secondary>{detail}</AppText> : null}
          {problem ? <Notice error>{problem}</Notice> : null}
          {/* Which requirement it answers is on the assignment; an offline label needs a journal snapshot (deferred). */}
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/a/[assignmentId]", params: { assignmentId: item.assignmentId } })}
            style={{ minHeight: touchHeight, justifyContent: "center", alignSelf: "flex-start" }}>
            <AppText selectable={false} style={{ color: palette["text-link"] }}>Відкрити доручення</AppText>
          </Pressable>
          {item.state === "failed" || item.state === "not_sent" ?
            <Pressable accessibilityRole="button" onPress={() => confirmDiscard(item)}
              style={{ minHeight: touchHeight, justifyContent: "center", alignSelf: "flex-start" }}>
              <AppText selectable={false} style={{ color: palette["status-attention-fg"] }}>Видалити з пристрою</AppText>
            </Pressable> : null}
        </Card>;
      })}
    </>}
  </Page>;
}
