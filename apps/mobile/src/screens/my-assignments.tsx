import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useNetworkState } from "expo-network";
import { apiGet, readProblem } from "../lib/api";
import { ApiError, loadMyAssignments, type Fetcher } from "../lib/field/load-assignments";
import { buildMyAssignmentsScreen, failedProjectMessage, rowSubtitle, type AssignmentRow, type MyAssignmentsScreen } from "../lib/field/assignments";
import { useSessionGate } from "../ui/session-gate";
import { AppText, Button, Card, Loading, Notice } from "../ui/primitives";
import { HeaderActions } from "../ui/header-actions";
import { corners, palette, splitWidth, touchHeight, unit } from "../ui/theme";
import { AssignmentDetail } from "./assignment";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { rememberOpenedAssignment } from "../lib/field/opened-assignment";
import { parkedBySwitch, pendingSummary } from "../lib/native/item-labels";

const fetchJson: Fetcher = async path => {
  const response = await apiGet(path);
  if (!response.ok) throw new ApiError(response.status, await readProblem(response));
  return response.json();
};
const statusLabels: Record<string, string> = { draft: "Чернетка", active: "Активний", paused: "На паузі", completed: "Завершено", cancelled: "Скасовано" };

export function MyAssignments() {
  const runtime = useSessionGate();
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  const split = width >= splitWidth && fontScale < 1.5;
  const [screen, setScreen] = useState<MyAssignmentsScreen | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [project, setProject] = useState<string | null>(null);
  const [selected, setSelected] = useState<AssignmentRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const opening = useRef(false);
  const subject = runtime.session?.user.id;
  const load = useCallback(async () => {
    if (!subject) return;
    const current = ++generation.current;
    setRefreshing(true);
    const result = await loadMyAssignments(fetchJson);
    if (current !== generation.current) return;
    setRefreshing(false);
    if (result.kind === "session_expired") { setScreen(null); router.replace("/login"); return; }
    setScreen(result.kind === "error" ? { kind: "error" } : buildMyAssignmentsScreen(result.projects, result.byProject));
  }, [subject, router]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));
  useEffect(() => { setScreen(null); setSelected(null); setProject(null); }, [subject]);
  if (!runtime.session) return <Loading />;
  const rows = screen?.kind === "list" ? screen.rows : [];
  const projects = Array.from(new Map(rows.map(row => [row.project.projectId, row.project])).values());
  const filtered = project ? rows.filter(row => row.project.projectId === project) : rows;
  function open(row: AssignmentRow) {
    // The vault sends one workspace at a time: leaving one with unsent photos parks them.
    const parked = parkedBySwitch(runtime.workspaceId, row.project.workspaceId, pendingSummary(runtime.itemsKnown, runtime.items));
    if (parked > 0) {
      Alert.alert("Є ненадіслані фото",
        `${parked} фото з поточного робочого простору не надсилатимуться, доки ви не повернетеся до його доручень.`,
        [{ text: "Залишитися", style: "cancel" }, { text: "Перейти", onPress: () => { void enter(row); } }]);
      return;
    }
    void enter(row);
  }
  async function enter(row: AssignmentRow) {
    if (opening.current) return; // a double tap must not push the detail twice
    opening.current = true;
    setError(null);
    try {
      await runtime.activateWorkspace(row.project.workspaceId);
      rememberOpenedAssignment({ assignmentId: row.assignmentId, description: row.description, projectName: row.project.name });
      setSelected(row);
      if (!split) router.push({ pathname: "/a/[assignmentId]", params: { assignmentId: row.assignmentId } });
    } catch { setError("Не вдалося перевірити доступ. Перевірте з’єднання та спробуйте ще раз."); }
    finally { opening.current = false; }
  }
  return <View style={{ flex: 1, flexDirection: "row", backgroundColor: palette["bg-canvas"] }}>
    <Stack.Screen options={{ headerRight: () => <HeaderActions /> }} />
    <FlatList data={filtered} keyExtractor={item => item.assignmentId} contentInsetAdjustmentBehavior="automatic"
      style={split ? { width: "40%", flexGrow: 0, borderRightWidth: 1, borderRightColor: palette["border-default"] } : { flex: 1 }}
      contentContainerStyle={{ padding: unit * 4, paddingBottom: insets.bottom + unit * 6, gap: unit * 3,
        paddingLeft: insets.left + unit * 4, paddingRight: (split ? 0 : insets.right) + unit * 4 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(); }} tintColor={palette["text-link"]} />}
      ListHeaderComponent={<View style={{ gap: unit * 3, paddingBottom: unit * 2 }}>
        <AppText secondary>Що потрібно зафіксувати на об’єкті</AppText>
        {network.isConnected === false ? <Notice title="Немає з’єднання">Доручення доступні онлайн. Уже збережені фото залишаються в черзі надсилання.</Notice> : null}
        {error ? <Notice error>{error}</Notice> : null}
        {runtime.status === "unavailable" || runtime.status === "error" ? <Notice error>Захищене сховище недоступне. Знімання заблоковано до відновлення сховища.</Notice> : null}
        {screen && "failedProjects" in screen ? screen.failedProjects.map(item => <Notice key={item.projectId} error>{failedProjectMessage(item)}</Notice>) : null}
        {projects.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: unit * 2 }}>
          {[{ projectId: null, name: "Усі проєкти" }, ...projects].map(item => <Pressable key={item.projectId ?? "all"}
            accessibilityRole="button" accessibilityState={{ selected: project === item.projectId }}
            onPress={() => { setProject(item.projectId); setSelected(null); }}
            style={{ minHeight: touchHeight, justifyContent: "center", paddingHorizontal: unit * 3, borderRadius: corners.pill,
              backgroundColor: palette[project === item.projectId ? "bg-accent-soft" : "bg-surface"],
              borderWidth: 1, borderColor: palette[project === item.projectId ? "border-accent" : "border-subtle"] }}>
            <AppText selectable={false}>{item.name}</AppText>
          </Pressable>)}
        </ScrollView> : null}
      </View>}
      ListEmptyComponent={!screen ? <Loading /> : screen.kind === "error" ? <Card>
        <Notice error>Не вдалося завантажити ваші доручення. Перевірте з’єднання та спробуйте ще раз.</Notice>
        <Button label="Спробувати ще раз" onPress={() => { void load(); }} /></Card> :
        <Card><AppText variant="h2">Поки немає доручень</AppText><AppText>{"message" in screen ? screen.message : "За цим проєктом немає доручень."}</AppText></Card>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => open(item)}
        accessibilityState={{ selected: selected?.assignmentId === item.assignmentId }}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Card style={selected?.assignmentId === item.assignmentId ? { borderColor: palette["border-accent"] } : undefined}>
          <AppText selectable={false} variant="meta" secondary>{item.project.name}</AppText>
          <AppText selectable={false} variant="h3">{item.description}</AppText>
          {rowSubtitle(item, false) ? <AppText selectable={false} secondary>{rowSubtitle(item, false)}</AppText> : null}
          <AppText selectable={false} variant="meta" secondary>{statusLabels[item.status] ?? "Стан уточнюється"}</AppText>
          <AppText selectable={false} variant="meta" style={{ color: palette["text-link"] }}>Відкрити вимоги →</AppText>
        </Card>
      </Pressable>} />
    {split ? <View style={{ flex: 1 }}>{selected ? <AssignmentDetail key={selected.assignmentId} assignmentId={selected.assignmentId} heading /> :
      <View style={{ flex: 1, justifyContent: "center", padding: unit * 8, gap: unit * 3 }}>
        <AppText variant="h2">Оберіть доручення</AppText><AppText secondary>Тут з’являться вимоги до фіксації та приклади фотографій.</AppText>
      </View>}</View> : null}
  </View>;
}
