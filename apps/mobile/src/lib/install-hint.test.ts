import { describe, it, expect } from "vitest";
import { installHintVariant, DISMISS_DURATION_MS } from "./install-hint";

/**
 * `installHintVariant` is the one decision the install banner is built on:
 * given what the platform told this tab (a `beforeinstallprompt` event
 * arrived, or the UA looks like iOS Safari) and what the person already did
 * (dismissed it, or not), decide what — if anything — to show. It takes
 * plain booleans/numbers rather than `window`/`navigator`/`localStorage`
 * directly for the same reason `safe-next.ts` takes a bare origin string:
 * this suite runs in plain Node `vitest` with no DOM (`vitest.config.ts`),
 * and the real browser-facing reads (UA sniffing, `matchMedia`,
 * `localStorage`) live in `../screens/install-hint.tsx`, which is
 * component-only surface with no unit coverage of its own — see that
 * file's header for why this split is deliberate, not an oversight.
 */

const NOW = 1_700_000_000_000; // an arbitrary fixed instant; every "days ago" case below is relative to it

function inputs(overrides: Partial<Parameters<typeof installHintVariant>[0]> = {}) {
  return {
    isWeb: true,
    isStandalone: false,
    isIOSSafari: false,
    hasPromptEvent: false,
    dismissedAtMs: null,
    nowMs: NOW,
    ...overrides,
  };
}

describe("installHintVariant — platform gates", () => {
  it("is null when the build is not running on web at all", () => {
    // Native (iOS/Android) has no browser install prompt to defer and no
    // Safari "Add to Home Screen" gesture for this component to describe —
    // this is a web-only feature by construction, not by omission.
    expect(installHintVariant(inputs({ isWeb: false, hasPromptEvent: true }))).toBeNull();
    expect(installHintVariant(inputs({ isWeb: false, isIOSSafari: true }))).toBeNull();
  });

  it("is null once the app is already running standalone", () => {
    // Installed already — offering to install it again is not an honest
    // instruction, whichever platform said so.
    expect(installHintVariant(inputs({ isStandalone: true, hasPromptEvent: true }))).toBeNull();
    expect(installHintVariant(inputs({ isStandalone: true, isIOSSafari: true }))).toBeNull();
  });
});

describe("installHintVariant — which variant, per platform signal", () => {
  it('is "chromium" when the browser has already handed over a beforeinstallprompt event', () => {
    expect(installHintVariant(inputs({ hasPromptEvent: true }))).toBe("chromium");
  });

  it('is "ios" when the UA looks like iOS Safari and no prompt event exists', () => {
    expect(installHintVariant(inputs({ isIOSSafari: true, hasPromptEvent: false }))).toBe("ios");
  });

  it("is null when neither platform signal is present", () => {
    expect(installHintVariant(inputs())).toBeNull();
  });

  it('prefers "chromium" over "ios" if both signals were somehow true at once', () => {
    // Cannot happen on a real device — `beforeinstallprompt` is Chromium-only
    // and iOS Safari never fires it (MDN, read 2026-08-21) — but the
    // precedence is pinned anyway so a future platform change can't make
    // this an unconsidered branch.
    expect(installHintVariant(inputs({ hasPromptEvent: true, isIOSSafari: true }))).toBe("chromium");
  });
});

describe("installHintVariant — the 7-day dismiss window", () => {
  it("is null immediately after a dismissal", () => {
    expect(installHintVariant(inputs({
      hasPromptEvent: true, dismissedAtMs: NOW,
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
      isIOSSafari: true, dismissedAtMs: NOW - DISMISS_DURATION_MS, nowMs: NOW,
    }))).toBe("ios");
  });

  it("is unaffected by a null dismissedAtMs (never dismissed)", () => {
    expect(installHintVariant(inputs({ hasPromptEvent: true, dismissedAtMs: null }))).toBe("chromium");
  });
});
