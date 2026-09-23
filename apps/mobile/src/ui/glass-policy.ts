export type GlassMaterial = "liquid" | "blur" | "solid";

/** A capability decision, not an OS-version guess. Unknown preferences fail opaque. */
export function glassMaterial(options: {
  platform: string;
  androidApi: number;
  reduceTransparency: boolean;
  liquidAvailable: boolean;
  glassEnabled: boolean;
  hasBlurTarget: boolean;
  overCamera: boolean;
}): GlassMaterial {
  // Spec: the camera overlay is solid on every platform; text must survive any live scene.
  if (options.reduceTransparency || options.overCamera) return "solid";
  if (options.platform === "ios") {
    return options.liquidAvailable && options.glassEnabled ? "liquid" : "blur";
  }
  if (options.platform === "android" && options.androidApi >= 31 &&
      options.hasBlurTarget) return "blur";
  return "solid";
}
