# Install Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a signed-out or signed-in person opens the field client in a browser tab, offer installation in one tap where the platform allows it (Chromium: `beforeinstallprompt` → `prompt()`), and show the only honest alternative where it does not (iOS Safari: «Поділитися → На екран Домой»); never show either inside the installed app; remember «Не зараз».

**Architecture:** A pure decision module `src/lib/install-hint.ts` (inputs: isWeb, isStandalone, isIOSSafari, hasPromptEvent, dismissedAtMs, nowMs → variant `"chromium" | "ios" | null`) with unit tests; a small RN component `src/screens/install-hint.tsx` rendered once in `src/app/_layout.tsx` beneath the `Stack` (non-modal bottom banner, never covering the OTP form's submit). Chromium branch exactly per MDN (read 2026-08-21, developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event): `preventDefault()`, keep the event, call `prompt()` only from the tap, read `userChoice`, then drop the event. iOS branch: detection `navigator.standalone === false` (iOS Safari exposes it) plus an iPhone/iPad UA with Safari and without CriOS/FxiOS; shows instruction text only. Standalone detection: `matchMedia("(display-mode: standalone)").matches || navigator.standalone === true` → variant null. Dismiss: `localStorage["goproceed.installHint.dismissedAt"]`, hide for 7 days. Chrome's criteria (web.dev/articles/install-criteria, read 2026-08-21) are already met by the shipped manifest; the event arrives after engagement (a tap + 30 s), so the Chromium banner appears when Chrome decides, not at first paint — documented in the component.

**Tech Stack:** RN/react-native-web, expo-router layout, tokens per convention, copy via `technical/copy-catalog.csv`.

**Spec:** owner request 2026-08-21 («Открыл сайт → плашка Install app → один тап → системное окно»), corrected by the platform facts above; ADR-009 field client.

## Global Constraints
- Copy Ukrainian, added to `technical/copy-catalog.csv` under `hint.install.*` keys (title, body_chromium, body_ios, action_install, action_later) and imported into the component from a generated-free constants file that cites the keys (the catalog fidelity test only checks `status.*`, verified). Strings: title «Встановити GoProceed на телефон?»; chromium body «Відкриватиметься з головного екрана, як застосунок.»; ios body «Натисніть «Поділитися», потім «На екран Домой».»; install «Встановити»; later «Не зараз».
- ≥44×44 pressables, tokens only (`bg-surface`, `border-subtle`, `text-primary`, `text-secondary`, `action-primary-bg/fg`), testIDs `install-hint`, `install-hint-install`, `install-hint-later`.
- The harness keeps ok:true; its 44×44 and overflow sweeps must include the banner when shown. Add to the unauthenticated-surface audit: (a) default headless Chrome — banner ABSENT (no event, not iOS); (b) a second page load with an iPhone Safari UA (`page.setUserAgent`) on `/login` — the iOS variant PRESENT with both pressables ≥44×44, and «Не зараз» hides it and persists across reload.
- `apps/app` untouched. Tests 123+ green, typecheck clean, `pnpm --filter @goproceed/mobile qa` ok:true.

### Task 1: decision module + component + layout + catalog (TDD on the module)
- [ ] `install-hint.test.ts` first: null when !isWeb; null when standalone; "chromium" when hasPromptEvent; "ios" when isIOSSafari && !hasPromptEvent; null when dismissed < 7 days ago; variant returns after 7 days; chromium wins over ios if both (cannot happen on iOS, but pin it).
- [ ] Implement module, component (listener added in useEffect on web only, removed on unmount; `prompt()` in the press handler; on `userChoice` → clear; dismiss writes localStorage), mount in `_layout.tsx`, catalog rows. Commit `feat(mobile): the install hint — one tap where the platform allows, honest instructions where it does not`.

### Task 2: harness additions + run
- [ ] Extend the unauthenticated-surface audit per the constraints; run `pnpm --filter @goproceed/mobile qa` → ok:true. Commit `test(mobile): the harness sees the install hint on iOS UA and not in plain Chrome`.

### Task 3: docs
- [ ] Runbook §4.5 one paragraph (what shows where; iOS has no programmatic install — Apple's design; Chrome shows after engagement); TODOS: nothing new unless found. Validate, commit.

## Self-review — spec covered by T1 (behavior) + T2 (on-screen proof) + T3; no placeholders; names consistent.
