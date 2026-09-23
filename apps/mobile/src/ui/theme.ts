import { breakpoint, color, component, leading, radius, shadow, space, text } from "@goproceed/tokens";

/** CSS lengths become density-independent native points; never pass CSS font stacks to RN. */
export function nativeLength(value: string): number {
  if (/^\d+(\.\d+)?px$/.test(value)) return Number.parseFloat(value);
  if (/^\d+(\.\d+)?rem$/.test(value)) return Number.parseFloat(value) * 16;
  throw new Error(`Not a fixed native length: ${value}`);
}

export const palette = color.light;
export const unit = nativeLength(space.base);
export const corners = {
  control: nativeLength(radius.control), panel: nativeLength(radius.panel),
  surface: nativeLength(radius.surface), pill: nativeLength(radius.pill),
};
export const typeSize = {
  meta: nativeLength(text.meta), body: nativeLength(text.body),
  h3: nativeLength(text.h3), h2: nativeLength(text.h2), h1: nativeLength(text.h1),
  display: nativeLength(text.display),
};
export const fonts = {
  regular: "Commissioner_400Regular", medium: "Commissioner_500Medium",
  semibold: "Commissioner_600SemiBold", brand: "HankenGrotesk_600SemiBold",
};
export const lineHeight = Number(leading.normal);
export const touchHeight = Math.max(48, nativeLength(component["control-height-touch"]));
export const splitWidth = nativeLength(breakpoint.md);
export const chromeShadow = shadow.overlay;
