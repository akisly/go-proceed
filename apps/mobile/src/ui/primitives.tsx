import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, type ScrollViewProps,
  type TextProps, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { corners, fonts, lineHeight, palette, touchHeight, typeSize, unit } from "./theme";

export function AppText({ variant = "body", secondary = false, style, ...props }: TextProps & {
  variant?: keyof typeof typeSize; secondary?: boolean;
}) {
  return <Text selectable {...props} style={[{ fontFamily: variant === "body" || variant === "meta" ? fonts.regular : fonts.semibold,
    fontSize: typeSize[variant], lineHeight: typeSize[variant] * lineHeight,
    color: palette[secondary ? "text-secondary" : "text-primary"] }, style]} />;
}

export function Button({ label, onPress, disabled = false, secondary = false, testID }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; testID?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} testID={testID} style={({ pressed }) => ({ minHeight: touchHeight,
      paddingHorizontal: unit * 4, paddingVertical: unit * 3, borderRadius: corners.control,
      justifyContent: "center", alignItems: "center", opacity: disabled ? 0.5 : 1,
      backgroundColor: secondary ? palette[pressed ? "action-ghost-hover" : "bg-subtle"]
        : palette[pressed ? "action-primary-hover" : "action-primary-bg"] })}>
    <AppText selectable={false} style={{ textAlign: "center", fontFamily: fonts.semibold,
      color: palette[secondary ? "text-brand" : "action-primary-fg"] }}>{label}</AppText>
  </Pressable>;
}

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ backgroundColor: palette["bg-surface"], borderRadius: corners.panel,
    borderWidth: 1, borderColor: palette["border-subtle"], padding: unit * 4, gap: unit * 3 }, style]} />;
}

export function Notice({ title, children, error = false }: { title?: string; children: ReactNode; error?: boolean }) {
  return <View accessibilityRole={error ? "alert" : undefined} style={{ padding: unit * 4, gap: unit * 2,
    borderRadius: corners.panel, borderWidth: 1,
    borderColor: palette[error ? "status-attention-border" : "border-default"],
    backgroundColor: palette[error ? "status-attention-surface" : "bg-subtle"] }}>
    {title ? <AppText variant="h3">{title}</AppText> : null}
    {typeof children === "string" ? <AppText>{children}</AppText> : children}
  </View>;
}

export function Page({ contentContainerStyle, style, ...props }: ScrollViewProps) {
  const insets = useSafeAreaInsets();
  return <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
    {...props} style={[{ flex: 1, backgroundColor: palette["bg-canvas"] }, style]}
    contentContainerStyle={[{ padding: unit * 4, paddingBottom: insets.bottom + unit * 6,
      gap: unit * 4, flexGrow: 1 }, contentContainerStyle]} />;
}

export function Loading({ label = "Завантажуємо…" }: { label?: string }) {
  return <View accessibilityLiveRegion="polite" style={{ gap: unit * 3, padding: unit * 6 }}>
    <ActivityIndicator color={palette["text-brand"]} /><AppText style={{ textAlign: "center" }}>{label}</AppText>
  </View>;
}
