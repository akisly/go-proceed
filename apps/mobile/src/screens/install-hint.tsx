// THE INSTALL HINT BANNER — the one piece of `../lib/install-hint.ts`'s
// decision that needs a DOM: reading `beforeinstallprompt`, `navigator`,
// `matchMedia` and `localStorage`, and rendering whatever the pure decision
// module says to. `installHintVariant` itself is unit-tested with no DOM
// (`../lib/install-hint.test.ts`); everything below is the wiring that
// feeds it real browser state and has no unit coverage of its own — its
// proof is `qa/field-web.mjs`'s browser pass (iPhone-UA second load on
// `/login`, plain headless Chrome on the first), not this file.
//
// MOUNTED ONCE, IN `_layout.tsx`, BENEATH THE STACK — not per-screen. A
// foreman signed out on `/login` and a foreman signed in on `/` should see
// the same banner from the same one mount; duplicating it per-screen would
// duplicate the `beforeinstallprompt` listener and the localStorage read for
// no reason.
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { color, type ThemeName } from "@goproceed/tokens";

import {
  installHintVariant, DISMISSED_AT_STORAGE_KEY,
  INSTALL_HINT_TITLE, INSTALL_HINT_BODY_CHROMIUM, INSTALL_HINT_BODY_IOS,
  INSTALL_HINT_ACTION_INSTALL, INSTALL_HINT_ACTION_LATER,
} from "../lib/install-hint";

// Pinned, same convention and same caveat as the other screens: this
// component does not yet follow the device's own theme.
const THEME: ThemeName = "light";

/**
 * The Chromium-only, non-standard shape this file needs off the event —
 * `BeforeInstallPromptEvent` is not in TypeScript's lib.dom.d.ts at all
 * (verified 2026-08-21: no browser has standardised it, and MDN documents it
 * as a Chromium extension — developer.mozilla.org/en-US/docs/Web/API/
 * Window/beforeinstallprompt_event). A minimal structural type is enough:
 * this file calls exactly two members and never constructs one itself.
 */
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

/**
 * `navigator.standalone === false` (never `undefined`) is how this checks
 * that the UA is genuinely WebKit/Safari and not merely spoofing an iPhone
 * string — the property is a Safari-only extension (MDN, read 2026-08-21;
 * absent from Chrome, Firefox and every other engine, where reading it
 * yields `undefined`), so requiring the literal `false` is what a UA-only
 * check on its own cannot give: proof this is the engine that can actually
 * offer «Поділитися → На екран Домой», not just a UA string that claims to.
 * `CriOS`/`FxiOS` exclude Chrome-for-iOS and Firefox-for-iOS, both of which
 * still carry `Safari` in their UA (Apple requires WebKit for every iOS
 * browser) but cannot drive the manual gesture Safari's own chrome offers.
 */
function detectIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone !== false) return false;
  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
  return isIOSDevice && isSafari;
}

/**
 * Two independent ways a browser says "already installed" — the standard
 * `display-mode` media query (every Chromium install target) and the
 * Safari-only `navigator.standalone === true` (iOS/iPadOS home-screen
 * launch, which sets no `display-mode` at all) — either one is enough.
 */
function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  const mediaStandalone = typeof window.matchMedia === "function"
    && window.matchMedia("(display-mode: standalone)").matches;
  return Boolean(mediaStandalone || nav.standalone === true);
}

function readDismissedAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DISMISSED_AT_STORAGE_KEY);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function InstallHint() {
  const isWeb = Platform.OS === "web";

  // The deferred event IS the "chromium" signal
  // (`installHintVariant`'s `hasPromptEvent`) — held here, not in a ref,
  // because receiving it and spending it both need to trigger a re-render:
  // arriving turns the banner on, and `userChoice` resolving (or a stale
  // click with none pending) turns it back off.
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedAtMs, setDismissedAtMs] = useState<number | null>(() => (isWeb ? readDismissedAt() : null));

  useEffect(() => {
    if (!isWeb) return;
    // `preventDefault()` + keep the event, exactly per MDN's own recipe
    // (developer.mozilla.org/en-US/docs/Web/API/Window/
    // beforeinstallprompt_event, read 2026-08-21): the browser's default is
    // to show its own mini-infobar immediately, which this banner replaces.
    // `prompt()` is called from nowhere but the tap handler below — never
    // here — because Chrome only honours it inside a user gesture.
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, [isWeb]);

  const variant = isWeb
    ? installHintVariant({
      isWeb,
      isStandalone: detectStandalone(),
      isIOSSafari: detectIOSSafari(),
      hasPromptEvent: deferredEvent !== null,
      dismissedAtMs,
      nowMs: Date.now(),
    })
    : null;

  const handleInstall = useCallback(() => {
    if (!deferredEvent) return;
    const event = deferredEvent;
    void event.prompt()
      .then(() => event.userChoice)
      // Accepted or dismissed, the browser will never re-fire this SAME
      // event — MDN's own docs say so — so it is dropped either way rather
      // than kept around to be prompted a second time.
      .then(() => setDeferredEvent(null));
  }, [deferredEvent]);

  const handleLater = useCallback(() => {
    const now = Date.now();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISSED_AT_STORAGE_KEY, String(now));
    }
    setDismissedAtMs(now);
  }, []);

  if (variant === null) return null;

  return (
    <View testID="install-hint" style={styles.banner}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{INSTALL_HINT_TITLE}</Text>
        <Text style={styles.body}>
          {variant === "chromium" ? INSTALL_HINT_BODY_CHROMIUM : INSTALL_HINT_BODY_IOS}
        </Text>
      </View>
      <View style={styles.actions}>
        {variant === "chromium" ? (
          <Pressable
            testID="install-hint-install"
            role="button"
            onPress={handleInstall}
            style={styles.installButton}
          >
            <Text style={styles.installButtonText}>{INSTALL_HINT_ACTION_INSTALL}</Text>
          </Pressable>
        ) : null}
        <Pressable
          testID="install-hint-later"
          role="button"
          onPress={handleLater}
          style={styles.laterButton}
        >
          <Text style={styles.laterButtonText}>{INSTALL_HINT_ACTION_LATER}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Non-modal, bottom-anchored, and never absolutely positioned — it is a
  // normal flex sibling of the Stack in `_layout.tsx`, so it takes its own
  // row of height rather than overlapping the OTP form's submit button.
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    backgroundColor: color[THEME]["bg-surface"],
    borderTopWidth: 1,
    borderTopColor: color[THEME]["border-subtle"],
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: color[THEME]["text-primary"],
  },
  body: {
    fontSize: 13,
    color: color[THEME]["text-secondary"],
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  installButton: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: color[THEME]["action-primary-bg"],
  },
  installButtonText: {
    color: color[THEME]["action-primary-fg"],
    fontSize: 14,
    fontWeight: "600",
  },
  laterButton: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  laterButtonText: {
    color: color[THEME]["text-secondary"],
    fontSize: 14,
    fontWeight: "500",
  },
});
