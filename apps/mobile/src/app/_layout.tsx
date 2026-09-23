import { Stack } from "expo-router/stack";
import { useFonts } from "expo-font";
import { Commissioner_400Regular, Commissioner_500Medium, Commissioner_600SemiBold } from "@expo-google-fonts/commissioner";
import { HankenGrotesk_600SemiBold } from "@expo-google-fonts/hanken-grotesk";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NativeRuntimeProvider } from "../lib/native/runtime";
import { useAccessibilityPreferences } from "../ui/accessibility";
import { MobileGlassSurface } from "../ui/mobile-glass-surface";
import { Loading, Notice, Page } from "../ui/primitives";
import { fonts, palette } from "../ui/theme";

export default function RootLayout() {
  const [loaded, error] = useFonts({ Commissioner_400Regular, Commissioner_500Medium,
    Commissioner_600SemiBold, HankenGrotesk_600SemiBold });
  const { reduceMotion } = useAccessibilityPreferences();
  return <SafeAreaProvider>
    {!loaded && !error ? <Page><Loading /></Page> : error ?
      <Page><Notice error>Не вдалося завантажити шрифти. Перезапустіть застосунок.</Notice></Page> :
      <NativeRuntimeProvider>
        <Stack screenOptions={{ contentStyle: { backgroundColor: palette["bg-canvas"] },
          headerTintColor: palette["text-link"], headerTitleStyle: { fontFamily: fonts.semibold },
          headerShadowVisible: false, headerBackButtonDisplayMode: "minimal",
          animation: reduceMotion ? "none" : "default",
          headerBackground: () => <MobileGlassSurface style={{ flex: 1, borderRadius: 0 }} /> }}>
          <Stack.Screen name="index" options={{ title: "Мої доручення" }} />
          <Stack.Screen name="login" options={{ title: "Вхід", headerBackVisible: false }} />
          <Stack.Screen name="a/[assignmentId]" options={{ title: "Доручення" }} />
          <Stack.Screen name="camera" options={{ headerShown: false, presentation: "fullScreenModal", gestureEnabled: false }} />
          <Stack.Screen name="queue" options={{ title: "Надсилання" }} />
          <Stack.Screen name="profile" options={{ title: "Профіль", presentation: "modal" }} />
        </Stack>
      </NativeRuntimeProvider>}
  </SafeAreaProvider>;
}
