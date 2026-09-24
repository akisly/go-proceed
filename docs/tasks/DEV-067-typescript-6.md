# DEV-067 — BL-062: one TypeScript, 6.0.3, in the whole workspace

## Assignment

- Objective and user-visible outcome: the root, `packages/ui` and `apps/mobile` all declare TypeScript `6.0.3`, the version Expo SDK 57 expects, so the lockfile holds one TypeScript. Nothing a user sees changes.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): build and dependency configuration (`package.json`, `pnpm-lock.yaml`, tool configs) → `gp-researcher` for current docs, implementation, `gp-reviewer`, `gp-qa`; the full serialized database run is CI's (the local database is shared and not reset).
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: `gp-researcher` (current-docs rule). No `gp-security` trigger (no CI permission or pin, no secret); `ci.yml` gains one `run:` step (DEV-068) of a repo script.
- Owning module and allowed edit paths: `package.json`, `packages/ui/package.json`, `pnpm-lock.yaml`, `discovery/tsconfig.json`, `packages/domain/src/import/xlsx.test.ts`, `packages/{database,domain,testing}/package.json` and `discovery/package.json` (`@types/node`), `docs/BACKLOG.md` (BL-062), this record, `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md` («current docs first», «What the tests pass means here»); DEV-008.
- Linked spec (`docs/specs/…`), ADR or earlier task: BL-062; DEV-008; this cluster's DEV-066, DEV-067, DEV-068, DEV-069 share one commit because they share `package.json` files and `pnpm-lock.yaml`.
- Baseline: `origin/main` `919a8c10`.
- Dependencies / constraints / out of scope: local database suites are not run (owner's rule); CI runs them.
- Required acceptance criteria: listed in «Acceptance evidence».
- Skipped stages and rationale: none.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | Cluster «Зависимости и тулинг»; TypeScript «6.0.3 везде»; vitest «Сразу 5.0.1»; React guard «Проверка локфайла»; `apps/mobile` `react-dom` «закрепить 19.2.3» | Owner's choices in this session |

## Plan

1. Pin `typescript` `6.0.3` at the root and in `packages/ui` (`apps/mobile` already had it). Check: one `typescript@` in the lockfile; `npx tsc -v` per package.
2. Fix what TypeScript 6's `types: []` default breaks once Vitest 5 stops pulling Node's types in (DEV-069): the packages that use Node APIs declare `@types/node` `24.9.2` (the apps' version); `discovery` (a Node tool) sets `types: ["node"]`; `packages/domain`'s one Node-using test file references Node's types itself, so domain code keeps no Node globals. Check: `pnpm turbo run typecheck --force` 10/10.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-researcher | 6.0.3 recommended: Expo 57 `~6.0.3`, Next 16.3.1 supports 6, TypeScript 7 has no JS API; no deprecated option in the repo's tsconfigs; risk: `types` defaults to `[]` | Subagent report (session) | Owner |
| 2 | Owner | «6.0.3 везде» | Session | Implement |
| 3 | Coordinator | Pinned; the lockfile holds one `typescript@6.0.3` (5.9.2 and 5.9.3 gone); every package's `tsc -v` 6.0.3; typecheck 10/10 on the TypeScript change alone. After Vitest 5, `discovery` and `domain` failed (`Cannot find name 'node:fs'`, `Buffer`): four packages had used Node APIs without declaring `@types/node`, reaching it through the hoist and Vitest 3's types. Declared it, scoped the types (plan step 2); typecheck 10/10 (`--force --continue`); `apps/app` and `apps/landing` build | session | Review |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- `@types/node` still has three versions in the lockfile (14.x, 24.9.2, 26.1.1 from other packages' peers), as on `main`; only the importers now declare theirs.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 one TypeScript in the lockfile | Yes | working tree | `grep -oE '^  typescript@[0-9.]+' pnpm-lock.yaml` → `6.0.3` only; `node scripts/check-lockfile-versions.mjs` OK | PASS | |
| AC-2 every package typechecks on 6.0.3 | Yes | working tree | `pnpm turbo run typecheck --force` 10/10 | PASS | |
| AC-3 builds | Yes | working tree | `pnpm --filter @goproceed/app build`, `--filter @goproceed/landing build` exit 0 | PASS | |
| AC-4 Expo accepts it | Yes | working tree | `CI=1 npx expo install --check` in `apps/mobile` flags only six `expo*` patch versions (pre-existing on `main`), not `typescript` | PASS | |

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
