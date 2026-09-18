# DEV-020 — BL-103: a stored idempotent response is replayed only to a caller still authorized for the command

## Assignment

- **Objective and user-visible outcome:** a caller who repeats an `Idempotency-Key` gets the stored response back only if they may still perform the command. A user whose membership ended, an admin demoted to member, or a member whose project capability was revoked or expired gets the same 403 or 404 a fresh call gets, never the stored 2xx, and never a 409 that confirms the record exists. The database half: a stored record that carries a workspace is readable only by an active member of it.
- **State:** scoped
- **Coordinator:** primary Claude Code session, 2026-09-18.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** an RLS policy change (migration `0089`), a shared helper's contract and every `/v1` command that uses it: `gp-architect` → failing tests → `0089`, helper, call sites → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (`supabase/migrations/**`, RLS, `apps/app/app/v1/**`); `gp-security` (RLS, and the idempotency of authorization). `gp-ui-reviewer` is not triggered: the files under `apps/app/app` are route handlers, not UI. `gp-mobile` is not triggered.
- **Owning module and allowed edit paths:** `supabase/migrations/0089_the_replay_that_outlived_the_membership.sql` (new); `packages/database/src/idempotency.ts` and its tests; every `withIdempotency` caller under `apps/app/app/v1/**` and `apps/app/src/lib/evidence/**`, and the two callers in `apps/app/tests/m3-refusal.int.test.ts` and `m5-external.int.test.ts` if they call the helper; `apps/app/tests/idempotency-authorization.int.test.ts` (new); `packages/testing/src/operational-rls.test.ts`; `technical/database/rls-coverage.csv` (the `idempotency_records` row); `technical/data-access-surface.csv` (DA-134); `technical/database/invariant-catalog.csv` (INV-048); `technical/test-catalog.csv` (T-IDEMP-001, T-RLS-011); `docs/architecture/data-model.md`, `docs/architecture/tenancy-and-security.md` (dated notes); `docs/BACKLOG.md` (BL-103 closed); `docs/STATUS.md`; this record and the index.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/BACKLOG.md` BL-103, BL-104, BL-014, BL-019, BL-101; [DEV-016](DEV-016-gate11-remaining-gaps.md) (S1-01); [DEV-017](DEV-017-capture-event-service-workspace.md) (migration practice); [DEV-019](DEV-019-invitation-token-at-rest.md); `docs/architecture/tenancy-and-security.md` «Capability evaluation» (steps 1-6 decide who, step 7 includes idempotency).
- **Linked spec, ADR or earlier task:** BL-103; DEV-016 (found it); DEV-019 (BL-104, merged in #100).
- **Baseline:** `902c214` (main after PR #100).
- **Dependencies / constraints / out of scope:** local database at `0088`, test fixtures only; `0089` is applied locally by hand as `postgres`, never through `supabase db reset` and never to a hosted project by this task; database test files run one at a time, chosen by the coordinator under the owner's delegation. Out of scope: records without a workspace (owner, 2026-09-18: accepted and recorded); BL-014 (re-admission); BL-101.
- **Required acceptance criteria:**
  1. `apps/app/tests/idempotency-authorization.int.test.ts` is red at `902c214` for the defect and green after the fix: after a membership ends, a replay of `projects.create` is 403 `MEMBERSHIP_INACTIVE` with no stored body and no `Idempotency-Replay-Until`, and a different body under the same key is 403, not 409; after demotion it is 403 `SCOPE_DENIED`; `parties.update` is 403 `SCOPE_DENIED` after demotion and 404 after the membership ends; `project_access.grant` is 403 `SCOPE_PROJECT_DENIED` after the caller's `project.admin` is revoked; an unchanged caller still gets the stored response and header. The file truncates nothing and leaves no `de20…` workspace.
  2. `packages/testing/src/operational-rls.test.ts` gains the policy cases — an ended member of A reads none of its own records of A, on the tenant and on the service plane, beside an active control — red at `0088`, green at `0089`.
  3. `0089` changes only `idem_select` (the `idem_insert` predicate, so a record is readable exactly when it could be written), carries a self-check, applies cleanly at `0088`; every other policy and grant is unchanged. `technical/database/rls-coverage.csv` stays at zero gaps and `packages/testing/src/rls-coverage.test.ts` passes.
  4. `withIdempotency` takes a required `authorize` step that runs before the lock and the lookup on every call and hands its result to the callback; a workspace-scoped call cannot pass the no-workspace sentinel; unit tests prove the order, and the existing `packages/database/src/idempotency.test.ts` still passes.
  5. Every `withIdempotency` caller moves its «who» checks (membership, workspace role, project capability, responsibility) into `authorize` and keeps its «facts» checks (state, versions, targets) in the callback; the record lists every call site.
  6. INV-048, DA-134, T-IDEMP-001, T-RLS-011, the tenancy note, STATUS and BL-103 agree; `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  7. `pnpm turbo run typecheck` passes.
  8. The existing `apps/app` integration suites that exercise the edited routes pass — **scope set by the coordinator** (see Owner decisions).
  9. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-ui-reviewer`, `gp-mobile`: not triggered.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-18 | BL-104 and BL-103 are two PRs, one after the other; BL-103 starts after #100 merged | chat, «Два PR, по очереди»; «смержил, давай BL-103» |
| 2026-09-18 | Full scope: `0089`, the required `authorize` step and all 51 call sites | chat, answer «Полный» |
| 2026-09-18 | An unauthorized caller reusing a key with a different body gets 403/404, not 409 | chat, answer «403/404» |
| 2026-09-18 | Records without a workspace: accept the residual and record it | chat, answer «Принять и записать» |
| 2026-09-18 | Which database runs: the coordinator chooses what is necessary | chat, answer «только необходимое по твоему мнению» |

## Plan

1. Red: the new route file and the two policy cases; run each alone and show the defect.
2. `0089`; the helper's `authorize` step with unit tests; the call sites.
3. Apply `0089` by hand; the red files green; `rls-coverage.test.ts`, `idempotency.test.ts`; the chosen regression suites.
4. Catalogs and documents; validators; typecheck.
5. `gp-reviewer` + `gp-security` → stated fixes → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native) on `b3045df` | **Design returned, read-only; no ADR** (the approved order in `tenancy-and-security.md` already puts authorization before idempotency; this restores conformance). 51 call sites in 50 files: A 6 (authorize before the block), A-post 1 (`authorize-upload-intent` re-checks after), **B 35** (an RLS lookup first, so an ex-member gets 404, but the role or capability check only inside: 7 workspace-role, 28 project-capability — the grant expiry `valid_until` is the one reduction a v0.1 user can cause through the product), **C 6** (the `workspaces/[workspaceId]/*` routes: no check before the block), D 3 (no workspace). Recommended: `0089` giving `idem_select` the `idem_insert` predicate (closes membership end for every route, including future ones; does not see role or capability), plus a required `authorize` step in `withIdempotency` run before the lock and the lookup, its result handed to the callback, so a future route cannot forget it. Rule: only «who» checks move (steps 1-6); «facts» checks stay in the callback, or a legitimate replay would turn into 409/422. Either deploy order is safe; ship together. INV-048 amended; DA-134's `UPDATE` corrected (drift found by DEV-019) | architect report (DEV-019 session) | Owner decisions |
