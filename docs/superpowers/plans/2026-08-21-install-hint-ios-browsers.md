# Install Hint — every iOS browser, with a dwell gate (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the install hint on iPhone Chrome / Firefox / Edge too (today they get nothing — the iOS variant excluded `CriOS`/`FxiOS`), with a browser-specific instruction, the correct Ukrainian iOS menu labels, a directional pointer, and a 10-second dwell gate so the banner never interrupts the first look.

**Platform facts (read 2026-08-21):** WebKit blog 13878 — since iOS/iPadOS 16.4 third-party browsers add web apps to the Home Screen «from the Share menu»; no programmatic install API exists on iOS in any browser (all are WebKit). ADR-007's support floor is iOS 16.4+ already. Chrome iOS exposes Share as the icon beside the address bar (top) and also via its «⋮» menu; Safari iPhone's Share is the bottom-centre toolbar button.

**Architecture:** `installHintVariant` grows from `"chromium" | "ios" | null` to `"chromium" | "ios-safari" | "ios-chrome" | "ios-other" | null`; inputs gain `iosBrowser: "safari" | "chrome" | "firefox" | "other" | null` (UA: `CriOS` → chrome, `FxiOS` → firefox, `EdgiOS` → other, otherwise-on-iOS → safari) and `dwellMs` (ms since the visitor's first page in this tab session, persisted in `sessionStorage["goproceed.installHint.firstSeenAt"]` so reloads do not reset it). Rule: iOS variants need `dwellMs ≥ 10_000`; chromium ignores dwell (Chrome already gates on engagement). Component: per-variant body + a pointer glyph — Safari «↓» (toolbar below), Chrome «↗» (address bar, top-right), other «⋯» (menu) — plain text glyph in the body, no imitation of browser chrome.

**Copy (Ukrainian, the REAL iOS menu labels):** Share = «Поділитися»; Add to Home Screen = **«На Початковий екран»** (Apple's Ukrainian label; the previous row's «На екран Домой» was a Russianism — corrected here; the owner verifies the exact label on a Ukrainian-locale iPhone and records it in the runbook). Rows in `technical/copy-catalog.csv`:
- `hint.install.body_ios_safari` — «Натисніть «Поділитися» ↓ внизу екрана, потім «На Початковий екран».»
- `hint.install.body_ios_chrome` — «Натисніть «Поділитися» ↗ біля адресного рядка (або меню ⋮), прокрутіть униз і виберіть «На Початковий екран».»
- `hint.install.body_ios_other` — «Відкрийте меню «Поділитися» вашого браузера та виберіть «На Початковий екран».»
- `hint.install.body_ios` row: retire (remove the row and its constant; the catalog's history lives in git).

### Task 1: module + component + catalog (TDD on the module)
- [ ] Tests first: every existing case re-pinned under the new variant names; new — `CriOS` UA → `"ios-chrome"`; `FxiOS` → `"ios-other"`; Safari → `"ios-safari"`; any iOS variant null while `dwellMs < 10_000`, shown at ≥10_000; chromium unaffected by dwell; standalone still null for all.
- [ ] Implement: module, UA classifier (pure, tested), `firstSeenAt` in sessionStorage set on first mount, `dwellMs` computed at render and re-evaluated on a single timer that fires at the 10 s mark (no polling), component bodies + glyphs, catalog rows, tests green, typecheck clean. Commit `feat(mobile): the install hint knows which iOS browser it is in — and waits ten seconds`.

### Task 2: harness
- [ ] Extend the unauthenticated-surface audit: pre-seed `sessionStorage["goproceed.installHint.firstSeenAt"] = Date.now() - 20_000` via `evaluateOnNewDocument` for the UA loads; assert — iPhone Safari UA → `ios-safari` body text; **iPhone Chrome UA** (`CriOS/`) → `ios-chrome` body text; both with ≥44×44 pressables; a load WITHOUT the pre-seed and iPhone UA → banner ABSENT (dwell gate works); plain Chrome → absent; synthetic `beforeinstallprompt` → chromium path as before (unchanged). `pnpm --filter @goproceed/mobile qa` → ok:true, twice. Commit `test(mobile): the harness sees the Safari and Chrome iOS hints, and the dwell gate holding them back`.

### Task 3: docs
- [ ] Runbook §4.5: the browser matrix (Safari / Chrome / other iOS → which text; Android Chrome → prompt after engagement), the 10 s dwell, and the owner's verification item: confirm the exact Ukrainian menu label on a real iPhone. Validate, commit.

## Self-review — the owner's three asks (Chrome instruction, delay, pointer) each map to a task; no placeholders; variant names consistent across module/component/harness.
