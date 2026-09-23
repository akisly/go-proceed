import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { pendingSummary } from "../lib/native/item-labels";
import { useNativeRuntime } from "../lib/native/runtime";
import { AppText } from "./primitives";
import { palette, touchHeight, unit } from "./theme";

export function HeaderActions() {
  const router = useRouter();
  const { items, itemsKnown } = useNativeRuntime();
  const summary = pendingSummary(itemsKnown, items);
  return <View style={{ flexDirection: "row", gap: unit }}>
    <Pressable accessibilityRole="button" accessibilityLabel={summary.known ? `Надсилання. У черзі: ${summary.pending}` : "Надсилання"}
      onPress={() => router.push("/queue")} style={{ minHeight: touchHeight, minWidth: touchHeight, justifyContent: "center", paddingHorizontal: unit * 2 }}>
      <AppText selectable={false} style={{ color: palette["text-brand"], fontVariant: ["tabular-nums"] }}>↑{summary.known ? ` ${summary.pending}` : ""}</AppText>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Відкрити профіль" onPress={() => router.push("/profile")}
      style={{ minHeight: touchHeight, minWidth: touchHeight, alignItems: "center", justifyContent: "center" }}>
      <AppText selectable={false} variant="h2">⋯</AppText>
    </Pressable>
  </View>;
}
