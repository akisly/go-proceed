import { describe, it, expect } from "vitest";
import { installHintVariant, classifyIOSBrowser, DISMISS_DURATION_MS, IOS_DWELL_THRESHOLD_MS } from "./install-hint";

/**
 * `installHintVariant` is the one decision the install banner is built on:
 * given what the platform told this tab (a `beforeinstallprompt` event
 * arrived, or the UA looks like one of the iOS browsers, and how long the
 * visitor has been dwelling on the page) and what the person already did
 * (dismissed it, or not), decide what — if anything — to show. It takes
 * plain booleans/numbers rather than `window`/`navigator`/`localStorage`/
 * `sessionStorage` directly for the same reason `safe-next.ts` takes a bare
 * origin string: this suite runs in plain Node `vitest` with no DOM
 * (`vitest.config.ts`), and the real browser-facing reads (UA sniffing,
 * `matchMedia`, `localStorage`, `sessionStorage`) live in
 * `../screens/install-hint.tsx`, which is component-only surface with no
 * unit coverage of its own — see that file's header for why this split is
 * deliberate, not an oversight.
 *
 * `classifyIOSBrowser` is the other pure piece: a plain UA-string classifier
 * (CriOS → chrome, FxiOS → firefox, EdgiOS → other, otherwise-on-iOS →
 * safari, not-iOS-at-all → null), tested here on its own rather than only
 * through `installHintVariant`, so a future UA-suffix change fails at the
 * exact line responsible instead of at the composed variant.
 */

const NOW = 1_700_000_000_000; // an arbitrary fixed instant; every "days ago" case below is relative to it

function inputs(overrides: Partial<Parameters<typeof installHintVariant>[0]> = {}) {
  return {
    isWeb: true,
    isStandalone: false,
    iosBrowser: null,
    hasPromptEvent: false,
    dismissedAtMs: null,
    nowMs: NOW,
    // At the dwell threshold by default, so cases below that are not
    // themselves testing the dwell gate are not accidentally gated by it.
    dwellMs: IOS_DWELL_THRESHOLD_MS,
    ...overrides,
  };
}

describe("installHintVariant — platform gates", () => {
  it("is null when the build is not running on web at all", () => {
    // Native (iOS/Android) has no browser install prompt to defer and no
    // Safari "Add to Home Screen" gesture for this component to describe —
    // this is a web-only feature by construction, not by omission.
    expect(installHintVariant(inputs({ isWeb: false, hasPromptEvent: true }))).toBeNull();
    expect(installHintVariant(inputs({ isWeb: false, iosBrowser: "safari" }))).toBeNull();
  });

  it("is null once the app is already running standalone", () => {
    // Installed already — offering to install it again is not an honest
    // instruction, whichever platform said so.
    expect(installHintVariant(inputs({ isStandalone: true, hasPromptEvent: true }))).toBeNull();
    expect(installHintVariant(inputs({ isStandalone: true, iosBrowser: "safari" }))).toBeNull();
    expect(installHintVariant(inputs({ isStandalone: true, iosBrowser: "chrome" }))).toBeNull();
    expect(installHintVariant(inputs({ isStandalone: true, iosBrowser: "firefox" }))).toBeNull();
    expect(installHintVariant(inputs({ isStandalone: true, iosBrowser: "other" }))).toBeNull();
  });
});

describe("installHintVariant — which variant, per platform signal", () => {
  it('is "chromium" when the browser has already handed over a beforeinstallprompt event', () => {
    expect(installHintVariant(inputs({ hasPromptEvent: true }))).toBe("chromium");
  });

  it('is "ios-safari" for Safari, at or past the dwell threshold', () => {
    expect(installHintVariant(inputs({ iosBrowser: "safari" }))).toBe("ios-safari");
  });

  it('is "ios-chrome" for Chrome-for-iOS (CriOS), at or past the dwell threshold', () => {
    expect(installHintVariant(inputs({ iosBrowser: "chrome" }))).toBe("ios-chrome");
  });

  it('is "ios-other" for Firefox-for-iOS (FxiOS), at or past the dwell threshold', () => {
    expect(installHintVariant(inputs({ iosBrowser: "firefox" }))).toBe("ios-other");
  });

  it('is "ios-other" for every other iOS browser (e.g. Edge-for-iOS/EdgiOS), at or past the dwell threshold', () => {
    expect(installHintVariant(inputs({ iosBrowser: "other" }))).toBe("ios-other");
  });

  it("is null when neither platform signal is present", () => {
    expect(installHintVariant(inputs())).toBeNull();
  });

  it('prefers "chromium" over any iOS variant if both signals were somehow true at once', () => {
    // Cannot happen on a real device — `beforeinstallprompt` is Chromium-only
    // and no iOS browser fires it (MDN, read 2026-08-21; WebKit blog 13878) —
    // but the precedence is pinned anyway so a future platform change can't
    // make this an unconsidered branch.
    expect(installHintVariant(inputs({ hasPromptEvent: true, iosBrowser: "safari" }))).toBe("chromium");
    expect(installHintVariant(inputs({ hasPromptEvent: true, iosBrowser: "chrome" }))).toBe("chromium");
  });
});

describe("installHintVariant — the 10-second dwell gate (iOS variants only)", () => {
  it("is null for every iOS variant while dwellMs is strictly below the threshold", () => {
    for (const iosBrowser of ["safari", "chrome", "firefox", "other"] as const) {
      expect(
        installHintVariant(inputs({ iosBrowser, dwellMs: IOS_DWELL_THRESHOLD_MS - 1 })),
        `iosBrowser=${iosBrowser}`,
      ).toBeNull();
    }
    expect(installHintVariant(inputs({ iosBrowser: "safari", dwellMs: 0 }))).toBeNull();
  });

  it("shows the variant once dwellMs reaches the threshold exactly (inclusive)", () => {
    expect(installHintVariant(inputs({ iosBrowser: "safari", dwellMs: IOS_DWELL_THRESHOLD_MS }))).toBe("ios-safari");
  });

  it("shows the variant for any dwellMs past the threshold", () => {
    expect(installHintVariant(inputs({ iosBrowser: "chrome", dwellMs: IOS_DWELL_THRESHOLD_MS + 60_000 }))).toBe("ios-chrome");
  });

  it("chromium is unaffected by dwell — Chrome already gates on its own engagement heuristic", () => {
    expect(installHintVariant(inputs({ hasPromptEvent: true, dwellMs: 0 }))).toBe("chromium");
  });
});

describe("installHintVariant — the 7-day dismiss window", () => {
  it("is null immediately after a dismissal", () => {
    expect(installHintVariant(inputs({
      hasPromptEvent: true, dismissedAtMs: NOW,
    }))).toBeNull();
    expect(installHintVariant(inputs({
      iosBrowser: "safari", dismissedAtMs: NOW,
    }))).toBeNull();
  });

  it("stays null for any instant strictly inside the 7-day window", () => {
    for (const elapsedMs of [1, 60_000, DISMISS_DURATION_MS - 1]) {
      expect(installHintVariant(inputs({
        hasPromptEvent: true, dismissedAtMs: NOW - elapsedMs, nowMs: NOW,
      })), `elapsed ${elapsedMs}ms`).toBeNull();
    }
  });

  it("the variant returns once 7 days have fully elapsed", () => {
    expect(installHintVariant(inputs({
      hasPromptEvent: true, dismissedAtMs: NOW - DISMISS_DURATION_MS, nowMs: NOW,
    }))).toBe("chromium");
    expect(installHintVariant(inputs({
      iosBrowser: "safari", dismissedAtMs: NOW - DISMISS_DURATION_MS, nowMs: NOW,
    }))).toBe("ios-safari");
    expect(installHintVariant(inputs({
      iosBrowser: "chrome", dismissedAtMs: NOW - DISMISS_DURATION_MS, nowMs: NOW,
    }))).toBe("ios-chrome");
  });

  it("is unaffected by a null dismissedAtMs (never dismissed)", () => {
    expect(installHintVariant(inputs({ hasPromptEvent: true, dismissedAtMs: null }))).toBe("chromium");
  });
});

describe("classifyIOSBrowser — UA sniffing", () => {
  const IOS_SAFARI_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    + "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const IOS_CHROME_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    + "(KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1";
  const IOS_FIREFOX_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    + "(KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15";
  const IOS_EDGE_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    + "(KHTML, like Gecko) Version/17.5 EdgiOS/125.2535.85 Mobile/15E148 Safari/604.1";
  const ANDROID_CHROME_UA =
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) "
    + "Chrome/125.0.0.0 Mobile Safari/537.36";
  const DESKTOP_CHROME_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    + "Chrome/125.0.0.0 Safari/537.36";

  it('is "safari" for a plain iPhone Safari UA', () => {
    expect(classifyIOSBrowser(IOS_SAFARI_UA)).toBe("safari");
  });

  it('is "chrome" for an iPhone UA carrying CriOS', () => {
    expect(classifyIOSBrowser(IOS_CHROME_UA)).toBe("chrome");
  });

  it('is "firefox" for an iPhone UA carrying FxiOS', () => {
    expect(classifyIOSBrowser(IOS_FIREFOX_UA)).toBe("firefox");
  });

  it('is "other" for an iPhone UA carrying EdgiOS', () => {
    expect(classifyIOSBrowser(IOS_EDGE_UA)).toBe("other");
  });

  it("is null for a non-iOS UA (Android Chrome, desktop Chrome)", () => {
    expect(classifyIOSBrowser(ANDROID_CHROME_UA)).toBeNull();
    expect(classifyIOSBrowser(DESKTOP_CHROME_UA)).toBeNull();
  });

  it('is "safari" for an iPad Safari UA too, not just iPhone', () => {
    const ipadUa =
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
      + "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    expect(classifyIOSBrowser(ipadUa)).toBe("safari");
  });
});
