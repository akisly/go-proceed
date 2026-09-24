# DEV-069 — BL-061: vitest 3.2.4 → 5.0.1

## Assignment

- Objective and user-visible outcome: every package tests on Vitest `5.0.1` with an explicit Vite `8.0.13`; `vitest.workspace.ts` becomes `test.projects` in a root `vitest.config.ts`; each package still runs its own files, serialized where it was. Nothing a user sees changes.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): build and dependency configuration (`package.json`, `pnpm-lock.yaml`, tool configs) → `gp-researcher` for current docs, implementation, `gp-reviewer`, `gp-qa`; the full serialized database run is CI's (the local database is shared and not reset).
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: `gp-researcher` (current-docs rule). No `gp-security` trigger (no CI permission or pin, no secret); `ci.yml` gains one `run:` step (DEV-068) of a repo script.
- Owning module and allowed edit paths: `package.json`, `apps/{app,landing,mobile}/package.json` (`vitest`, `vite`), `pnpm-lock.yaml`, `vitest.workspace.ts` (deleted), `vitest.config.ts` (new), `apps/app/vitest.config.ts`, `apps/landing/vitest.config.ts` (`esbuild` → `oxc`), `apps/landing/tests/pilot-form.test.tsx`, `docs/BACKLOG.md` (BL-061), this record, `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md` («current docs first», «What the tests pass means here»); DEV-008.
- Linked spec (`docs/specs/…`), ADR or earlier task: BL-061; DEV-008; this cluster's DEV-066, DEV-067, DEV-068, DEV-069 share one commit because they share `package.json` files and `pnpm-lock.yaml`.
- Baseline: `origin/main` `919a8c10`.
- Dependencies / constraints / out of scope: local database suites are not run (owner's rule); CI runs them.
- Required acceptance criteria: listed in «Acceptance evidence».
- Skipped stages and rationale: none.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | Cluster «Зависимости и тулинг»; TypeScript «6.0.3 везде»; vitest «Сразу 5.0.1»; React guard «Проверка локфайла»; `apps/mobile` `react-dom` «закрепить 19.2.3» | Owner's choices in this session |

## Plan

1. Bump `vitest` to `5.0.1` wherever declared; declare `vite` `8.0.13` beside it (a peer only in 5); move the workspace list into `test.projects`; `esbuild.jsx` → `oxc.jsx.runtime` (Vite 8). Check: `vitest list --filesOnly` per package equals `main`'s.
2. Run every DB-free test set; fix what breaks. Check: counts.
3. The full serialized run (`pnpm turbo run test --concurrency=1`, database suites included) on CI. Check: the PR's CI.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-researcher | Latest 5.0.1 (2026-09-15); 4.1.11 recommended as the scoped step; v5 adds `clearMocks` default, top-level `vi.mock`, Node ≥22.12, Vite ≥6.4 peer, and drops the parent-directory config lookup that made a root config risky in v4 | Subagent report (session) | Owner |
| 2 | Owner | «Сразу 5.0.1» | Session | Implement |
| 3 | Coordinator | `vitest list --filesOnly` in each of the eight packages: 265 files, identical to `main`'s 266 except `packages/testing/src/temporary-privilege.test.ts`, which #133 added to `main` after this branch was cut (base drift, not Vitest). DB-free runs on 5.0.1: `apps/mobile` 199/22, `apps/landing` 272/23, `packages/contracts` 153/11, `packages/domain` 102/10, `discovery` 73/6, `apps/app` 650 in 67 files (all non-`.int` files except `src/lib/evidence/evidence-service.test.ts`, which connects), `packages/testing`'s 13 DB-free files 202. One regression: `apps/landing/tests/pilot-form.test.tsx` «aborts a stalled request» threw `The "event" argument must be an instance of Event` — under Vitest 5's jsdom environment the form's `AbortSignal.timeout` signal and the test's `new Event` come from different realms; the test now replaces `AbortSignal.timeout` with a controller it aborts (the same listener path). Vitest 5 also stopped pulling Node's types in, which DEV-067 step 2 fixes | session | Review, CI |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- The database suites (`apps/app` `*.int.test.ts`, `evidence-service.test.ts`, `packages/testing`'s `resetDb()` suites, `packages/database`) did not run locally; CI's serialized run is their evidence.
- `supabase/functions/outbox-drain` stays a root project outside `turbo run test`, as before.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 same test files per package | Yes | working tree | row 3 | PASS | |
| AC-2 DB-free sets pass | Yes | working tree | row 3 | PASS | |
| AC-3 full serialized run incl. database suites | Yes | — | CI on the PR | NOT RUN | pending CI (environmental until it runs) |
| AC-4 typecheck and builds | Yes | working tree | DEV-067 AC-2, AC-3 | PASS | |

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
