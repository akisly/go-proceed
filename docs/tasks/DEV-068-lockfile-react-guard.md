# DEV-068 — BL-083: one `@types/react`, and every `react-dom` paired with its own `react`

## Assignment

- Objective and user-visible outcome: the type packages the web and mobile importers share resolve to one version each (`pnpm.overrides`, mirrored in `pnpm-workspace.yaml`), `apps/mobile` declares `react-dom` `19.2.3` to match its `react`, and CI fails when the lockfile splits either again. Nothing a user sees changes.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): build and dependency configuration (`package.json`, `pnpm-lock.yaml`, tool configs) → `gp-researcher` for current docs, implementation, `gp-reviewer`, `gp-qa`; the full serialized database run is CI's (the local database is shared and not reset).
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: `gp-researcher` (current-docs rule). No `gp-security` trigger (no CI permission or pin, no secret); `ci.yml` gains one `run:` step (DEV-068) of a repo script.
- Owning module and allowed edit paths: `package.json` (`pnpm.overrides`, `validate:lockfile`), `pnpm-workspace.yaml` (`overrides`), `apps/mobile/package.json` (`react-dom`), `pnpm-lock.yaml`, `scripts/check-lockfile-versions.mjs` (new), `.github/workflows/ci.yml` (one step), `docs/BACKLOG.md` (BL-083), this record, `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md` («current docs first», «What the tests pass means here»); DEV-008.
- Linked spec (`docs/specs/…`), ADR or earlier task: BL-083; DEV-008; this cluster's DEV-066, DEV-067, DEV-068, DEV-069 share one commit because they share `package.json` files and `pnpm-lock.yaml`.
- Baseline: `origin/main` `919a8c10`.
- Dependencies / constraints / out of scope: local database suites are not run (owner's rule); CI runs them.
- Required acceptance criteria: listed in «Acceptance evidence».
- Skipped stages and rationale: none.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | Cluster «Зависимости и тулинг»; TypeScript «6.0.3 везде»; vitest «Сразу 5.0.1»; React guard «Проверка локфайла»; `apps/mobile` `react-dom` «закрепить 19.2.3» | Owner's choices in this session |

## Plan

1. `scripts/check-lockfile-versions.mjs`: one version of `@types/react`, `@types/react-dom`, `typescript`; every `react-dom` snapshot paired with the same `react`; the web importers agree on `react` and `react-dom`; inline self-tests first. It must fail on `main`'s lockfile. Check: red, then green.
2. `pnpm.overrides` for `@types/react` `19.2.18` and `@types/react-dom` `19.2.4` (within Expo's ranges), mirrored in `pnpm-workspace.yaml` as D-048 mirrors the build-script list; `react-dom` `19.2.3` in `apps/mobile`. React itself is not overridden: Expo pins `apps/mobile` to 19.2.3, the web apps need ≥19.2.8. Check: the check passes; `expo install --check`.
3. `pnpm validate:lockfile` and a CI step in `verify`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-researcher | pnpm 9.12.0 reads overrides from root `package.json` only (pnpm ≥10 from `pnpm-workspace.yaml`); forcing `react` breaks either Expo (exact 19.2.3) or `vinext`/`react-server-dom-webpack` (≥19.2.8); found `react-dom@19.2.8` paired with `react@19.2.3` in `apps/mobile` | Subagent report (session) | Owner |
| 2 | Owner | Lockfile check; pin `apps/mobile` `react-dom` 19.2.3 | Session | Implement |
| 3 | Coordinator | The check on the lockfile before the fix: exit 1, `react-dom@19.2.8(react@19.2.3) is paired with react 19.2.3`. After: `lockfile versions: OK`; the lockfile carries the `overrides:` block. Peer warnings after install: `react-server-dom-webpack@19.2.8` (Expo's web/RSC path under `apps/mobile`) wants `react`/`react-dom` ^19.2.8 and gets 19.2.3 — its `react` half was already unmet on `main`; `@react-native/metro-config` 0.86.2 vs 0.86.3 is on `main` too. `CI=1 npx expo install --check` flags only `expo`, `expo-build-properties`, `expo-glass-effect`, `expo-image-picker`, `expo-linking`, `expo-router` patch versions (pre-existing), nothing this task pins | session | Review |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- React itself has two versions by design (19.2.3 for `apps/mobile`, 19.2.8 for the web apps); the check holds each side, it does not unify them.
- Expo's own `react-server-dom-webpack@19.2.8` still peers `react`/`react-dom` ^19.2.8 on the native app's optional web/RSC path; that path is not used by the native build.
- Six `expo*` packages are a patch behind what `expo install --check` expects; pre-existing, not changed here.
- pnpm 9 prints «The "pnpm" field in package.json is no longer read» from a global pnpm 11 shim before handing over to 9.12.0 (DEV-008); the overrides are read, as the lockfile's `overrides:` block shows.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 the check fails on the split and passes after | Yes | working tree | row 3 | PASS | |
| AC-2 self-tests cover each rule and an empty lockfile | Yes | working tree | `selfTest()` runs before every check | PASS | |
| AC-3 overrides in the lockfile | Yes | working tree | `pnpm-lock.yaml` `overrides:` `@types/react 19.2.18`, `@types/react-dom 19.2.4` | PASS | |
| AC-4 Expo accepts `react-dom` 19.2.3 | Yes | working tree | `expo install --check` (row 3) | PASS | |
| AC-5 CI runs the check | Yes | working tree | `ci.yml` `verify` step `pnpm validate:lockfile`; YAML parses | PASS | first CI run pending |

## Sources

- TypeScript 6.0 release notes, https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ (2026-03-23, accessed 2026-09-24): `types` defaults to `[]`, `noUncheckedSideEffectImports` and `rootDir` defaults; TypeScript 7.0, https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ (2026-07-08): no JS API.
- Expo SDK 57 expected versions, https://api.expo.dev/v2/versions (live, accessed 2026-09-24): `typescript ~6.0.3`, `react`/`react-dom 19.2.3`, `@types/react ~19.2.4`, `@types/react-dom ~19.2.3`.
- Vitest 5 migration guide, https://vitest.dev/guide/migration (accessed 2026-09-24); Vitest 4 migration guide, https://v4.vitest.dev/guide/migration; npm dist-tags (latest 5.0.1, 2026-09-15).
- pnpm 9.12.0 (installed, `packageManager`): overrides read from root `package.json` `pnpm.overrides` (installed source); pnpm ≥10 reads `pnpm-workspace.yaml` `overrides` (https://pnpm.io/10.x/settings).
- All gathered by `gp-researcher` in this session; its report is the session record.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: local typecheck, builds and every DB-free test set.
- Remaining risks / blocked requirements: the full serialized run is CI's.
- Next bounded action and owner: `gp-reviewer`, `gp-qa`, CI; then the owner merges.
- Final state and reason: implementing.
