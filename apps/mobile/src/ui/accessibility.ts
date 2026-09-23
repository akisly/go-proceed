import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

export function useAccessibilityPreferences() {
  const [reduceTransparency, setTransparency] = useState(true);
  const [reduceMotion, setMotion] = useState(true);
  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (current) setMotion(value); });
    if (Platform.OS === "ios") {
      void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (current) setTransparency(value); });
    } else setTransparency(false);
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setMotion);
    const transparency = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setTransparency);
    return () => { current = false; motion.remove(); transparency.remove(); };
  }, []);
  return { reduceMotion, reduceTransparency };
}
