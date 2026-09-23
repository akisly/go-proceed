import type { RefObject } from "react";
import { Platform, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { useAccessibilityPreferences } from "./accessibility";
import { glassMaterial } from "./glass-policy";
import { chromeShadow, corners, palette } from "./theme";

export function MobileGlassSurface({ blurTarget, overCamera = false, style, ...props }: ViewProps & {
  blurTarget?: RefObject<View | null>;
  overCamera?: boolean;
}) {
  const { reduceTransparency } = useAccessibilityPreferences();
  const material = glassMaterial({
    platform: Platform.OS, androidApi: Number(Platform.Version), reduceTransparency,
    liquidAvailable: Platform.OS === "ios" && isLiquidGlassAvailable(),
    glassEnabled: Platform.OS === "ios" && isGlassEffectAPIAvailable(),
    hasBlurTarget: Boolean(blurTarget), overCamera,
  });
  const surface = [{ borderRadius: corners.surface, borderWidth: 1,
    borderColor: palette["border-subtle"], boxShadow: chromeShadow,
    overflow: "hidden" as const }, style];
  if (material === "liquid") return <GlassView {...props} colorScheme="light" glassEffectStyle="regular" style={surface} />;
  if (material === "blur") return <BlurView {...props} blurTarget={blurTarget}
    blurMethod="dimezisBlurViewSdk31Plus" tint="systemMaterialLight" intensity={80} style={surface} />;
  return <View {...props} style={[surface, { backgroundColor: palette["bg-surface"] }]} />;
}
