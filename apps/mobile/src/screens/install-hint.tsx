// THE INSTALL HINT BANNER — the one piece of `../lib/install-hint.ts`'s
// decision that needs a DOM: reading `beforeinstallprompt`, `navigator`,
// `matchMedia`, `localStorage` and `sessionStorage`, and rendering whatever
// the pure decision module says to. `installHintVariant` and
// `classifyIOSBrowser` are both unit-tested with no DOM
// (`../lib/install-hint.test.ts`); everything below is the wiring that
// feeds them real browser state and has no unit coverage of its own — its
// proof is `qa/field-web.mjs`'s browser pass (iPhone Safari UA and iPhone
// Chrome UA loads on `/login`, plain headless Chrome on the first, and a
// dwell-gate-off load proving the banner stays absent before 10s).
//
// MOUNTED ONCE, IN `_layout.tsx`, BENEATH THE STACK — not per-screen. A
// foreman signed out on `/login` and a foreman signed in on `/` should see
// the same banner from the same one mount; duplicating it per-screen would
// duplicate the `beforeinstallprompt` listener and the storage reads for no
// reason — including the dwell clock: `firstSeenAtMs` is read once per
// MOUNT of this component, not per screen navigated to, which is what makes
// "ten seconds since the visitor's first page" a session-wide fact instead
// of resetting every time the Stack swaps screens.
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { color, type ThemeName } from "@goproceed/tokens";

import {
  installHintVariant, classifyIOSBrowser, type InstallHintVariant, type IOSBrowser,
  DISMISSED_AT_STORAGE_KEY, FIRST_SEEN_AT_STORAGE_KEY, IOS_DWELL_THRESHOLD_MS,
  INSTALL_HINT_TITLE, INSTALL_HINT_BODY_CHROMIUM,
  INSTALL_HINT_BODY_IOS_SAFARI, INSTALL_HINT_BODY_IOS_CHROME, INSTALL_HINT_BODY_IOS_OTHER,
  INSTALL_HINT_ACTION_INSTALL, INSTALL_HINT_ACTION_LATER,
} from "../lib/install-hint";

/** The body sentence for every non-null variant — keyed by `InstallHintVariant`, one row per catalog key. */
const BODY_BY_VARIANT: Record<Exclude<InstallHintVariant, null>, string> = {
  chromium: INSTALL_HINT_BODY_CHROMIUM,
  "ios-safari": INSTALL_HINT_BODY_IOS_SAFARI,
  "ios-chrome": INSTALL_HINT_BODY_IOS_CHROME,
  "ios-other": INSTALL_HINT_BODY_IOS_OTHER,
};

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
 * that the UA is genuinely WebKit and not merely spoofing an iPhone
 * string — the property is a WebKit-engine extension (MDN, read 2026-08-21;
 * absent from every other engine, where reading it yields `undefined`), and
 * every iOS browser runs on WebKit (Apple requires it), so requiring the
 * literal `false` is what a UA-only check on its own cannot give: proof this
 * is an engine that can actually offer the Share → Add-to-Home-Screen
 * gesture, not just a UA string that claims to. `true` is excluded too —
 * that means already standalone, handled separately by `detectStandalone()`.
 * The actual browser classification (`classifyIOSBrowser`, `../lib/install-hint`)
 * is a pure UA-string check with its own unit coverage; this function's own
 * job is only the DOM-dependent part that module cannot do itself.
 */
function detectIOSBrowser(): IOSBrowser {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone !== false) return null;
  return classifyIOSBrowser(navigator.userAgent);
}

/**
 * The dwell gate's own clock (`../lib/install-hint`'s header) — read once,
 * on first mount, and written back only when absent, so a reload mid-visit
 * does not reset it. `sessionStorage`, not `localStorage`: this is a
 * per-tab-session clock (closing the tab and coming back later is a new
 * "first look"), unlike the 7-day dismiss window above, which is meant to
 * survive exactly that.
 */
function readOrSetFirstSeenAt(): number {
  if (typeof window === "undefined") return Date.now();
  const raw = window.sessionStorage.getItem(FIRST_SEEN_AT_STORAGE_KEY);
  if (raw !== null) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  const now = Date.now();
  window.sessionStorage.setItem(FIRST_SEEN_AT_STORAGE_KEY, String(now));
  return now;
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
  const [firstSeenAtMs] = useState<number>(() => (isWeb ? readOrSetFirstSeenAt() : 0));
  // Forces one re-render at the moment dwell crosses the 10s mark — nothing
  // reads this value itself; `dwellMs` below is recomputed from `Date.now()`
  // on every render regardless, this just makes sure a render happens once
  // more, at the one instant it can flip `installHintVariant`'s answer for
  // an iOS visitor already sitting on the page with nothing else changing.
  const [, forceDwellRerender] = useState(0);

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

  // ONE TIMER, FIRING AT THE 10S MARK — never polling. If the threshold has
  // already elapsed (a mount well after `firstSeenAtMs`, e.g. this same tab
  // navigated here from another route past the dwell window) no timer is
  // even set, since `dwellMs` computed below is already past the gate.
  useEffect(() => {
    if (!isWeb) return;
    const remaining = IOS_DWELL_THRESHOLD_MS - (Date.now() - firstSeenAtMs);
    if (remaining <= 0) return;
    const timer = setTimeout(() => forceDwellRerender((n) => n + 1), remaining);
    return () => clearTimeout(timer);
  }, [isWeb, firstSeenAtMs]);

  const variant = isWeb
    ? installHintVariant({
      isWeb,
      isStandalone: detectStandalone(),
      iosBrowser: detectIOSBrowser(),
      hasPromptEvent: deferredEvent !== null,
      dismissedAtMs,
      nowMs: Date.now(),
      dwellMs: Date.now() - firstSeenAtMs,
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
          {BODY_BY_VARIANT[variant]}
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
