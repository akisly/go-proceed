import { useRef, useState } from "react";
import { Alert, Pressable, RefreshControl } from "react-native";
import { useNetworkState } from "expo-network";
import { useRouter } from "expo-router";
import { heldCount, itemDetail, itemProblem, itemTitle, pendingSummary } from "../lib/native/item-labels";
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
  // One discard per item at a time; its outcome is a modal alert, read by VoiceOver.
  const [discarding, setDiscarding] = useState<ReadonlySet<string>>(new Set());
  // Requirement text is verbatim (content rules): two lines until the user opens it, as on the camera screen.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const discardingNow = useRef(new Set<string>()); // synchronous guard; state lags a render
  if (!runtime.session || runtime.status === "booting") return <Page><Loading /></Page>;

  async function send() {
    setSending(true); setError(null);
    try { await runtime.send(); } catch { setError("Не вдалося почати надсилання. Спробуйте ще раз."); }
    finally { setSending(false); }
  }
  function discard(item: VaultItem) {
    if (discardingNow.current.has(item.id)) return;
    discardingNow.current.add(item.id);
    setDiscarding((set) => new Set([...set, item.id]));
    void runtime.discard(item.id).catch((reason: unknown) => {
      const code = (reason as { code?: string }).code;
      if (code === "ITEM_GONE") return Alert.alert("Цього фото вже немає на пристрої");
      if (code === "DISCARD_HELD") return Alert.alert("Фото буде видалено пізніше",
        "Сервер ще може отримати це фото, тому одразу видалити його не можна. Застосунок більше не надсилатиме його й видалить, щойно сервер підтвердить, що не отримав його. Якщо сервер уже отримав фото, ми вам скажемо.");
      Alert.alert("Фото не видалено", code === "ALREADY_RECEIVED"
        ? "Сервер уже отримав це фото. Воно зникне зі списку, щойно сервер це підтвердить."
        : "Не вдалося видалити фото. Спробуйте ще раз.");
    }).finally(() => {
      discardingNow.current.delete(item.id);
      setDiscarding((set) => new Set([...set].filter((id) => id !== item.id)));
    });
  }
  function confirmDiscard(item: VaultItem) {
    const redo = item.originMethod === "photo_picker" ? "доведеться додати його знову" : "доведеться зняти його знову";
    Alert.alert("Видалити фото з пристрою?",
      item.intentId
        ? `Надсилання цього фото вже почалося. Якщо сервер ще може його отримати, застосунок більше не надсилатиме фото й видалить його пізніше. Після видалення фото не можна буде надіслати — ${redo}.`
        : `Сервер ще не отримав це фото. Після видалення його не можна буде надіслати — ${redo}.`,
      [{ text: "Скасувати", style: "cancel" },
        { text: "Видалити", style: "destructive", onPress: () => discard(item) }]);
  }

  const summary = pendingSummary(runtime.itemsKnown, runtime.items);
  const held = heldCount(runtime.items);
  const active = runtime.items.some((item) => item.state === "sending");
  return <Page contentContainerStyle={{ width: "100%", maxWidth: 720, alignSelf: "center" }}
    refreshControl={<RefreshControl refreshing={sending} onRefresh={() => { void send(); }} tintColor={palette["text-brand"]} />}>
    {runtime.status === "unavailable" || runtime.status === "error" ?
      <Notice error>Захищене сховище недоступне. Фото на цьому пристрої зараз не можна переглянути чи надіслати.</Notice> : null}
    {runtime.accessChanged ? <Notice error title="Доступ змінився">Сервер більше не приймає фото від вас у цьому робочому просторі. Фото залишаються на пристрої заблокованими. Зверніться до керівника проєкту.</Notice> : null}
    {/* Held photos are never sent, so «надішлемо» only speaks for unsent ones (or an unread journal). */}
    {network.isConnected === false && (!summary.known || summary.pending > 0) ? <Notice title="Немає з’єднання">Фото залишаються збереженими на пристрої. Надішлемо, коли з’явиться зв’язок і застосунок буде відкритий.</Notice> : null}
    {error ? <Notice error>{error}</Notice> : null}
    {runtime.receivedAnyway.length > 0 ? <>
      <Notice title="Сервер уже отримав фото, яке ви видаляли" announce>Воно залишиться в дорученні. Якщо його не слід було надсилати, повідомте керівника проєкту.</Notice>
      <Button secondary label="Зрозуміло" onPress={runtime.dismissReceivedAnyway} />
    </> : null}
    {runtime.pendingElsewhere ? <Notice title="Є фото в іншому робочому просторі">Вони чекають, доки ви знову відкриєте доручення того робочого простору. Лише тоді їх буде надіслано.</Notice> : null}
    {!summary.known ? (runtime.status === "ready" && !runtime.accessChanged ?
      <Notice>Відкрийте доручення, щоб побачити фото цього робочого простору.</Notice> : null)
    : summary.pending === 0 && held === 0 ? <Card>
      <AppText variant="h2">У цьому робочому просторі все надіслано</AppText>
      <AppText secondary>Тут показано лише цей робочий простір. Фото інших робочих просторів з’являться, коли ви відкриєте їхні доручення.</AppText>
      {runtime.othersUnknown || runtime.pendingElsewhere ?
        <AppText secondary>Не видаляйте застосунок, доки не перевірите всі свої робочі простори: ненадіслані фото зберігаються лише на цьому пристрої.</AppText> : null}
    </Card> : <>
      {summary.pending > 0 ? <>
        <AppText secondary>Фото надсилаються, лише поки застосунок відкритий. Не видаляйте застосунок, доки на пристрої є ненадіслані фото — навіть з інших робочих просторів.</AppText>
        <Button label={sending || active ? "Надсилаємо…" : "Надіслати зараз"} disabled={sending || active || runtime.status !== "ready"}
          onPress={() => { void send(); }} />
      </> : null}
      {runtime.items.filter((item) => item.state !== "server_confirmed").map((item) => {
        const problem = itemProblem(item), detail = itemDetail(item);
        return <Card key={item.id}>
          <AppText variant="meta" secondary>{item.originMethod === "photo_picker" ? "З галереї" : "Камера"} · {formatTime(item.claimedCaptureTime)}</AppText>
          <AppText variant="h3">{itemTitle(item)}</AppText>
          {item.requirementLabel ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded.has(item.id) }}
            accessibilityHint={expanded.has(item.id) ? "Згорнути вимогу" : "Показати вимогу повністю"}
            onPress={() => setExpanded((set) => set.has(item.id) ? new Set([...set].filter((id) => id !== item.id)) : new Set([...set, item.id]))}
            style={{ minHeight: touchHeight, justifyContent: "center" }}>
            <AppText selectable={false} numberOfLines={expanded.has(item.id) ? undefined : 2}>{item.requirementLabel}</AppText>
          </Pressable> : null}
          {detail ? <AppText secondary>{detail}</AppText> : null}
          {problem ? <Notice error>{problem}</Notice> : null}
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/a/[assignmentId]", params: { assignmentId: item.assignmentId } })}
            style={{ minHeight: touchHeight, justifyContent: "center", alignSelf: "flex-start" }}>
            <AppText selectable={false} style={{ color: palette["text-link"] }}>Відкрити доручення</AppText>
          </Pressable>
          {(item.state === "failed" || item.state === "not_sent") && !item.discardRequestedAt ?
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: discarding.has(item.id) }}
              disabled={discarding.has(item.id)} onPress={() => confirmDiscard(item)}
              style={{ minHeight: touchHeight, justifyContent: "center", alignSelf: "flex-start", opacity: discarding.has(item.id) ? 0.5 : 1 }}>
              <AppText selectable={false} style={{ color: palette["status-attention-fg"] }}>{discarding.has(item.id) ? "Видаляємо…" : "Видалити з пристрою"}</AppText>
            </Pressable> : null}
        </Card>;
      })}
    </>}
  </Page>;
}
