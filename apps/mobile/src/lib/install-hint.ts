/**
 * THE INSTALL HINT — a decision, then a sentence, per platform, because
 * neither platform lets this client tell the truth in the same shape.
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
 * iOS Safari NEVER fires that event — verified against the same MDN page,
 * which lists it Chromium-only — and iOS offers no programmatic install API
 * at all. The only honest thing this client can do there is tell a foreman
 * the manual gesture Apple actually ships: Поділитися → На екран Домой.
 * `isIOSSafari` is how the caller (`../screens/install-hint.tsx`) reports
 * "the UA looks like that platform"; this module does not sniff a UA
 * itself, for the same no-DOM reason `safeNext` takes a bare origin string
 * rather than reading `window.location` — see this file's test header.
 *
 * `isStandalone` wins over both — offering to install an app that is
 * already running installed is not a hint, it is noise — and the 7-day
 * dismiss window (`DISMISS_DURATION_MS`) is a plain elapsed-time gate over
 * the caller-supplied `dismissedAtMs`/`nowMs`, so this module needs no clock
 * of its own either.
 */

export type InstallHintVariant = "chromium" | "ios" | null;

export type InstallHintInputs = {
  /** `Platform.OS === "web"` at the call site — native has neither surface this describes. */
  isWeb: boolean;
  /** `matchMedia("(display-mode: standalone)").matches || navigator.standalone === true`. */
  isStandalone: boolean;
  /** An iPhone/iPad Safari UA, per the caller's own sniff — see this file's header. */
  isIOSSafari: boolean;
  /** Whether a `beforeinstallprompt` event is currently held, `preventDefault()`ed and unspent. */
  hasPromptEvent: boolean;
  /** `localStorage["goproceed.installHint.dismissedAt"]`, parsed, or `null` if never dismissed. */
  dismissedAtMs: number | null;
  /** `Date.now()` at decision time, passed in rather than read, for the same no-DOM reason as the rest. */
  nowMs: number;
};

/** Seven days, in milliseconds — how long a «Не зараз» tap silences the hint. */
export const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

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
  if (inputs.isIOSSafari) return "ios";
  return null;
}

/** `localStorage` key the component reads/writes for the dismiss timestamp. */
export const DISMISSED_AT_STORAGE_KEY = "goproceed.installHint.dismissedAt";

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
export const INSTALL_HINT_BODY_IOS =
  "Натисніть «Поділитися», потім «На екран Домой»."; // hint.install.body_ios
export const INSTALL_HINT_ACTION_INSTALL =
  "Встановити"; // hint.install.action_install
export const INSTALL_HINT_ACTION_LATER =
  "Не зараз"; // hint.install.action_later
