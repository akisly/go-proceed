/**
 * THE INSTALL HINT — a decision, then a sentence, per platform/browser,
 * because none of the affected browsers lets this client tell the truth in
 * the same shape.
 *
 * Chromium (desktop and Android Chrome, and every other Chromium browser
 * that implements it) fires `beforeinstallprompt` on the `window` once its
 * own install criteria are met AND the visitor has engaged with the page —
 * MDN (developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event,
 * read 2026-08-21) documents the engagement heuristic as roughly a tap plus
 * ~30 seconds; the manifest/service-worker criteria this build already meets
 * are catalogued at web.dev/articles/install-criteria (read 2026-08-21). So
 * the event — and therefore `hasPromptEvent` below — arrives on the
 * BROWSER's own schedule, not at first paint, and this module has no opinion
 * about when that happens; it only reacts to whether it already has.
 *
 * NO iOS browser ever fires that event, and iOS offers no programmatic
 * install API at all, in any browser — verified against WebKit blog 13878
 * (read 2026-08-21): since iOS/iPadOS 16.4, third-party browsers add web
 * apps to the Home Screen "from the Share menu" too, the same manual gesture
 * Safari itself uses, because every iOS browser is required to run on
 * WebKit. The only honest thing this client can do on iOS is tell a foreman
 * the manual gesture — and WHICH one, because the Share control lives in a
 * different place depending on the browser: Safari's is the bottom-centre
 * toolbar button; Chrome-for-iOS puts it beside the address bar at the top
 * (and again in its «⋮» menu); every other iOS browser is told to find its
 * own Share menu, since this client has no verified location for it.
 * `classifyIOSBrowser` below is the pure UA-string classifier behind that
 * choice; `iosBrowser` is how the caller (`../screens/install-hint.tsx`)
 * reports its result — this module does not sniff a UA itself, for the same
 * no-DOM reason `safeNext` takes a bare origin string rather than reading
 * `window.location` — see this file's test header.
 *
 * THE 10-SECOND DWELL GATE is what keeps this from interrupting the first
 * look: unlike Chromium, no iOS browser gates the Share/Add-to-Home-Screen
 * gesture on engagement at all, so without a gate of this module's own an
 * iOS variant would render at first paint, on every visit, before a foreman
 * has even read the page. `dwellMs` — milliseconds since the visitor's first
 * page load in this tab session — is computed by the caller from a
 * `sessionStorage`-persisted `firstSeenAt` (so a reload mid-dwell does not
 * reset the clock) and passed in already-computed, same no-DOM reason as
 * everything else here. Chromium ignores it: Chrome has already done its own
 * engagement gating before `hasPromptEvent` can even become true, so gating
 * it a second time here would be redundant, not safer.
 *
 * `isStandalone` wins over every other signal — offering to install an app
 * that is already running installed is not a hint, it is noise — and the
 * 7-day dismiss window (`DISMISS_DURATION_MS`) is a plain elapsed-time gate
 * over the caller-supplied `dismissedAtMs`/`nowMs`, so this module needs no
 * clock of its own either.
 */

export type InstallHintVariant = "chromium" | "ios-safari" | "ios-chrome" | "ios-other" | null;

/**
 * Which iOS browser the UA looks like, or `null` when the UA is not iOS at
 * all. `"firefox"` and `"other"` both resolve to the same `"ios-other"`
 * variant (see `installHintVariant`) — they are kept distinct here, rather
 * than collapsed at classification time, so a future browser that DOES earn
 * its own instruction (Firefox, say) only needs a new `installHintVariant`
 * branch, not a `classifyIOSBrowser` change too.
 */
export type IOSBrowser = "safari" | "chrome" | "firefox" | "other" | null;

/**
 * Pure UA-string classifier. `CriOS` → Chrome-for-iOS, `FxiOS` →
 * Firefox-for-iOS, `EdgiOS` → Edge-for-iOS (folded into `"other"` — see
 * `IOSBrowser`'s own comment), anything else on an iPhone/iPad/iPod UA →
 * Safari, and anything not carrying an iOS device token → `null`. Every iOS
 * browser's UA also carries a trailing `Safari/…` token regardless of engine
 * — Apple requires WebKit under every one of them — so that token alone
 * proves nothing; the browser-specific `*iOS` suffix is what actually
 * distinguishes them, verified against real UA strings for each (see this
 * file's test header for the exact strings and their sources).
 *
 * Takes a plain string, not `navigator.userAgent`, for the same no-DOM
 * reason the rest of this module does — the real read lives in
 * `../screens/install-hint.tsx`.
 */
export function classifyIOSBrowser(userAgent: string): IOSBrowser {
  if (!/iPad|iPhone|iPod/.test(userAgent)) return null;
  if (/CriOS/.test(userAgent)) return "chrome";
  if (/FxiOS/.test(userAgent)) return "firefox";
  if (/EdgiOS/.test(userAgent)) return "other";
  return "safari";
}

export type InstallHintInputs = {
  /** `Platform.OS === "web"` at the call site — native has neither surface this describes. */
  isWeb: boolean;
  /** `matchMedia("(display-mode: standalone)").matches || navigator.standalone === true`. */
  isStandalone: boolean;
  /** The caller's own `classifyIOSBrowser(navigator.userAgent)` result, gated on a genuine WebKit engine — see this file's header and the component's own comment. */
  iosBrowser: IOSBrowser;
  /** Whether a `beforeinstallprompt` event is currently held, `preventDefault()`ed and unspent. */
  hasPromptEvent: boolean;
  /** `localStorage["goproceed.installHint.dismissedAt"]`, parsed, or `null` if never dismissed. */
  dismissedAtMs: number | null;
  /** `Date.now()` at decision time, passed in rather than read, for the same no-DOM reason as the rest. */
  nowMs: number;
  /** Milliseconds since this tab session's `firstSeenAt` (`sessionStorage["goproceed.installHint.firstSeenAt"]`) — only iOS variants are gated on it; see this file's header. */
  dwellMs: number;
};

/** Seven days, in milliseconds — how long a «Не зараз» tap silences the hint. */
export const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Ten seconds, in milliseconds — how long an iOS variant waits before it may render at all; see this file's header. Chromium ignores this. */
export const IOS_DWELL_THRESHOLD_MS = 10_000;

export function installHintVariant(inputs: InstallHintInputs): InstallHintVariant {
  if (!inputs.isWeb) return null;
  if (inputs.isStandalone) return null;
  if (inputs.dismissedAtMs !== null && inputs.nowMs - inputs.dismissedAtMs < DISMISS_DURATION_MS) {
    return null;
  }
  // Chromium checked first and unconditionally — pinned by
  // install-hint.test.ts's own precedence case, not merely convenient: the
  // two signals cannot both be true on a real device (see this file's
  // header), so this order is untested by any real browser and must stay
  // deliberate rather than incidental.
  if (inputs.hasPromptEvent) return "chromium";
  if (inputs.iosBrowser !== null) {
    // The dwell gate applies to every iOS variant, before branching on WHICH
    // one — none of them earns an exemption, because none of them has
    // Chromium's own engagement heuristic behind it (see this file's header).
    if (inputs.dwellMs < IOS_DWELL_THRESHOLD_MS) return null;
    switch (inputs.iosBrowser) {
      case "safari": return "ios-safari";
      case "chrome": return "ios-chrome";
      case "firefox":
      case "other":
        return "ios-other";
    }
  }
  return null;
}

/** `localStorage` key the component reads/writes for the dismiss timestamp. */
export const DISMISSED_AT_STORAGE_KEY = "goproceed.installHint.dismissedAt";

/** `sessionStorage` key the component reads/writes for the dwell gate's clock — see this file's header. */
export const FIRST_SEEN_AT_STORAGE_KEY = "goproceed.installHint.firstSeenAt";

/**
 * copy-catalog.csv:hint.install.*, verbatim — see technical/copy-catalog.csv
 * for the added rows. A plain constants module, not generated: the catalog
 * fidelity test (packages/testing/src/copy-catalog-fidelity.test.ts) checks
 * only the `status.*` prefix against the database's permitted values, the
 * same scope `otp-error.ts` and `capture/state.ts` rely on for their own
 * hand-copied strings.
 */
export const INSTALL_HINT_TITLE =
  "Встановити GoProceed на телефон?"; // hint.install.title
export const INSTALL_HINT_BODY_CHROMIUM =
  "Відкриватиметься з головного екрана, як застосунок."; // hint.install.body_chromium
export const INSTALL_HINT_BODY_IOS_SAFARI =
  "Натисніть «Поділитися» ↓ внизу екрана, потім «На Початковий екран»."; // hint.install.body_ios_safari
export const INSTALL_HINT_BODY_IOS_CHROME =
  "Натисніть «Поділитися» ↗ біля адресного рядка (або меню ⋮), прокрутіть униз і виберіть «На Початковий екран»."; // hint.install.body_ios_chrome
export const INSTALL_HINT_BODY_IOS_OTHER =
  "Відкрийте меню «Поділитися» вашого браузера та виберіть «На Початковий екран»."; // hint.install.body_ios_other
export const INSTALL_HINT_ACTION_INSTALL =
  "Встановити"; // hint.install.action_install
export const INSTALL_HINT_ACTION_LATER =
  "Не зараз"; // hint.install.action_later
