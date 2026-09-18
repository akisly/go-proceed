# DEV-021 — BL-107: an owner or admin can revoke a pending invitation

## Assignment

- **Objective and user-visible outcome:** an owner or admin can revoke a pending, unexpired invitation, after which its link admits no one and its address is free for a new invitation; and the create's pending-address conflict names the blocking invitation's id, so an admin who lost the create response can find it. Recovery from a lost token is revoke, then create. Scope set by [ADR-012](../decisions/ADR-012-invitation-revoke.md).
- **State:** done
- **Coordinator:** primary Claude Code session, 2026-09-18.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** a scope change (ADR) and a new `/v1` command: `gp-architect` → coordinator drafts ADR-012 → **owner rules** → failing tests → contract, route, catalogs → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (`apps/app/app/v1/**`, `packages/contracts/**`, catalogs, the ADR); `gp-security` (the lifecycle of a bearer credential, as in DEV-019, and authorization of a new command). `gp-ui-reviewer` is not triggered: no UI; `apps/app/app` gains a route handler only. `gp-mobile` is not triggered.
- **Owning module and allowed edit paths:** `docs/decisions/ADR-012-invitation-revoke.md` (new) and `docs/decisions/README.md`; `apps/app/app/v1/invitations/[invitationId]/revoke/route.ts` (new); `apps/app/app/v1/workspaces/[workspaceId]/invitations/route.ts` (the 409 `details`); `packages/contracts/src/invitations.ts` and its test; `apps/app/tests/invitation-revoke.int.test.ts` (new); `technical/openapi/scope-v0.1.csv`; `technical/permissions/capabilities.csv`; `technical/events/event-catalog.csv`; `technical/database/invariant-catalog.csv` (INV-103); `technical/test-catalog.csv` (T-INVITATION-001 evidence); `docs/delivery/version-0.1.md` (operation counts); `docs/BACKLOG.md` (BL-107 closed, BL-013 note, reissue entry); `docs/STATUS.md`; this record and the index.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/README.md` «ADR lifecycle and approval»; ADR-006 decision 1 and replacement rule 1; `docs/BACKLOG.md` BL-107, BL-013, BL-014, BL-108, BL-109; [DEV-019](DEV-019-invitation-token-at-rest.md); [DEV-020](DEV-020-idempotent-replay-authorization.md).
- **Linked spec, ADR or earlier task:** ADR-012; BL-107 (filed by DEV-019).
- **Baseline:** `65d7935` (main after PR #101).
- **Dependencies / constraints / out of scope:** no migration (the local database stays at `0089`); database test files run one at a time, chosen by the coordinator under the owner's delegation. Out of scope: reissue (not approved), an invitation list, BL-013, BL-014, BL-108, BL-109, a transition-guard trigger.
- **Required acceptance criteria:**
  1. `apps/app/tests/invitation-revoke.int.test.ts` (truncates nothing, seeds and removes its own `de21…` workspaces) fails at `65d7935` and passes after the fix: an owner, and an admin, revoke a pending invitation (200 `{ invitationId, status: "revoked" }`, row `revoked`, version 2) and its token then accepts no one (404); revoke frees the address — before it, a create for the same address is 409 with `details.invitationId` naming the pending invitation, after it the create is 201 and its token admits; a member and an auditor get 403 `SCOPE_DENIED` and the token still admits; an outsider and another workspace's owner get 404; an ended member 404 and a demoted admin 403, also on a replay of their own earlier key; a same-key replay returns the identical body with one audit and one outbox row; an accepted, an already-revoked and a pending-but-expired invitation are 409 with nothing written; a non-UUID id is 404; no stored record carries the token.
  2. The contract: the revoke request is strict and empty, the response strict with `status: "revoked"`, and the conflict `details` strict; `packages/contracts/src/invitations.test.ts` proves it.
  3. The route resolves the invitation under RLS before `withIdempotency` (404 before 403), authorizes owner/admin in `authorize`, locks the row and compares its status, writes audit and outbox token-free and email-free, and returns no secret; `idempotency-call-sites.test.ts` stays green.
  4. ADR-012 is `Approved` with the owner's dated ruling in its Approval section, and the index agrees.
  5. `scope-v0.1.csv`, `capabilities.csv`, `event-catalog.csv`, INV-103, T-INVITATION-001, `version-0.1.md` (36 and 76), BL-107, BL-013, the reissue backlog entry and STATUS agree; `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  6. `pnpm turbo run typecheck` passes; `@goproceed/contracts` tests pass.
  7. The existing suites that drive the invitation routes pass — the coordinator's set under the owner's delegation: `invitations.int.test.ts`, `review-fixes.int.test.ts`, `vertical-m1.int.test.ts` (they truncate tenant tables), and `packages/testing`'s `error-catalog-fidelity.test.ts` if it touches the database.
  8. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-ui-reviewer`, `gp-mobile`: not triggered.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-18 | BL-107 (P2), a revoke/reissue backlog entry | chat, DEV-019 answer «Да, P2» |
| 2026-09-18 | Start BL-107 (after #101 merged) | chat, «смержил, давай BL-107» |
| 2026-09-18 | ADR-012: revoke only; reissue not approved | chat, answer «Только revoke» |
| 2026-09-18 | The create's 409 carries the blocking invitation's id | chat, answer «409 create несёт id» |
| 2026-09-18 | A pending invitation past its expiry: 409, nothing written | chat, answer «409, ничего не писать» |
| 2026-09-18 | Which database runs: the coordinator chooses what is necessary | chat, answer «Выбери необходимые» |

## Plan

1. ADR-012 drafted and the owner's ruling transcribed.
2. Red: the contract cases and the new route file; run the route file alone at `65d7935`.
3. Contract, revoke route, the create's 409 `details`; the same file green.
4. Catalogs and documents; validators; typecheck; the chosen regression suites.
5. `gp-reviewer` + `gp-security` → stated fixes → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native) on `65d7935` | **Design returned, read-only. An ADR is required**: `scope-v0.1.csv` is the route set, and ADR-006 decision 1 and replacement rule 1 refuse «already catalogued» as a reason — the state catalogs describe the whole target design and `ui-actions.csv` is a legacy catalog; every route added after ADR-006 came with an ADR. Recommended: `invitations.revoke` (`POST /v1/invitations/{invitationId}/revoke`, owner/admin, `pending → revoked`, no `expectedVersion` — a pending row's version is always 1 and the status compare under the row lock is the check), the create's 409 carrying `details.invitationId`, and reissue deferred (a second route that mints a secret while BL-108 is open). **No migration**: `revoked` status, `version` and `inv_update` (owner/admin, `0014`) exist, and the app role holds `UPDATE` (`0011:59`); a plain UPDATE under RLS, not a definer. No new error code; new event `invitation.revoked`; new INV-103. Found in passing: sibling routes return 500 on a non-UUID id | architect report | ADR-012; owner |
| 2 | coordinator: ADR-012 | Drafted from the design; the owner ruled in conversation (revoke only; the 409 names the id; an expired pending invitation is 409 with nothing written), transcribed into its Approval section with Status `Approved`, per `docs/README.md`: the owner's merge ratifies it | `docs/decisions/ADR-012-invitation-revoke.md` | Red |
| 3 | implementing (coordinator): red | Tests first. **At `65d7935`, local database `0089`:** `packages/contracts/src/invitations.test.ts` 2 failed, 2 passed (the revoke and conflict-details schemas do not exist — a specification red). `apps/app/tests/invitation-revoke.int.test.ts` alone: **11 failed** — ten because the route module does not exist (a specification red), and **one behavioural red at `:137`**: the create's 409 for an address with a pending invitation carried no `details` (`undefined` for `{ invitationId }`), which is the gap itself: nothing named the invitation that blocks the address, and nothing could withdraw it | `scratchpad/dev021-red-contracts.txt`, `dev021-red-int.txt` | Fix |
| 4 | implementing (coordinator): fix, catalogs | **Contract:** `invitationPendingConflictDetails`, `revokeInvitationRequest` (strict, empty), `revokeInvitationResponse` (strict, `status: "revoked"`). **Create:** after the lazy expiry, a pending invitation for the address is refused 409 `VERSION_CONFLICT` with `details.invitationId`; the unique-violation catch stays for the race, without the id. **Revoke route** `apps/app/app/v1/invitations/[invitationId]/revoke/route.ts`: a non-UUID id is 404; the invitation resolved under RLS before `withIdempotency` (404 before 403); `authorize` = active membership + owner/admin; under `for update`, anything but pending-and-unexpired is 409 with nothing written; the UPDATE compares `status = 'pending'` and counts its row (RLS filters silently); audit `invitation.revoked` and outbox `invitation.revoked`, id-only; a strict receipt. **Catalogs:** `scope-v0.1.csv` row, `members.manage` related operations, `invitation.revoked` event, INV-103, T-INVITATION-001 evidence, `version-0.1.md` (M1 36, total 76, the list, a dated note), BL-107 closed, a BL-013 note, BL-111 (reissue, P3), STATUS. No migration, no error-catalog row | the implementation commit | Runs |
| 5 | implementing (coordinator): runs on `f4d491e` | Each alone, clean tree, local database `0089`: `pnpm turbo run typecheck --force` 10/10; validators rc 0; `@goproceed/contracts` 140; `idempotency-call-sites` 2 (the new call site passes the static rule); `error-catalog-fidelity` 1; **`invitation-revoke.int.test.ts` 11 passed**, no `de21…` workspace left. Regression for the create's changed 409, each alone, none skipped: `invitations` 9, `review-fixes` 10, `vertical-m1` 9 | `scratchpad/dev021-*.txt` | `gp-reviewer`, `gp-security` |
| 6 | reviewing (`gp-reviewer`, `gp-security`, native) on `73b4454` | **`gp-security`: HOLD** on **S1-01 major**: the body is always `{}`, so the raw-body request hash is the same for every revoke, and a key reused for invitation B after A replays A's 200 while B's link stays live — the one control ADR-012 adds for BL-013, failing silently. S1-02 (the `inv_update` layer untested), S1-03 (email-free untested) minor; S1-04 to S1-06 informational. Everything else sound: authorization order, revoke killing the token, the revoke/accept race, the create's `details` reaching owner/admin only. **`gp-reviewer`: APPROVE** — R1-01 to R1-08 minor (R1-02 = S1-01), R1-09, R1-10 nits; agreed the ADR procedure was followed | review reports | Stated fixes |
| 7 | rework (coordinator), stated fixes | **S1-01 / R1-02**, test first: the reused-key case red on the unchanged route (`:298`, 200 for 409); fix — the route hashes `invitations.revoke`, the invitation id and the raw-body hash together, so the reuse is 409 `IDEMPOTENCY_CONFLICT` after `authorize`; green. **S1-02**: a SQL case as `goproceed_app` — a member sees the invitation but locks and updates nothing, an admin does (`[1,0,0]`, `[1,1,1]`), matching PostgreSQL 17's policy table (Sources). **S1-03**: the email swept from the revoke's records. **R1-01**: the expired invitation's token admits no one (404, no membership). **R1-06**: the recipients' accept records (no workspace) removed by actor; residue query 0 and 0. **R1-07**: codes asserted on the replays. **R1-03**: ADR-012's Approval says which clauses are detail the merge ratifies. **R1-04**: Sources. **R1-05**: `next build` ran. **R1-08**: T-INVITATION-001 says the race is not exercised. **R1-09**: «with a new `Idempotency-Key`». **R1-10**: the index quotes the ADR. **S1-04, S1-06**: «What is not true». **BL-112** (P2) for the same gap in other path-targeted commands; a BL-013 note. **Runs on `fd37b9e`**, each alone: typecheck 10/10, validators rc 0, contracts 140, call-site test 2, **revoke file 13 passed**, residue 0/0, `pnpm --filter @goproceed/app build` rc 0 (the route listed) | `scratchpad/dev021-r2-*.txt`, `dev021-r2-red-int.txt` | `gp-security` re-check of S1-01; `gp-qa` |
| 8 | reviewing (`gp-security` re-check, native) on `ff4bc3c` | **S1-01 CLOSED**: a reused key for another invitation is 409 before any write and after `authorize`, no oracle; a genuine retry still replays; the combined hash satisfies the 64-hex check; nothing sound in round 1 weakened; S1-02, S1-03 and BL-112 adequate. New S2-01 informational: the id check is case-insensitive but the raw path id was hashed, so a retry with a differently-cased id got 409 (fails safe). Taken: the hash uses the lower-cased id. Runs after it are taken after this row is written | re-check report; `scratchpad/dev021-r3-*.txt` | `gp-qa` |
| 9 | verifying (`gp-qa`, native) on `df9f2c5` | **Verified for the scoped criteria:** 1–7 PASS, 8 NOT RUN (not required). Its own runs, each alone: revoke file 13, regression `invitations` 9, `review-fixes` 10, `vertical-m1` 9 (none skipped); contracts 140; call-site test 2; `error-catalog-fidelity` 1; turbo typecheck 10/10; validators; `next build` with the route listed; residue 0/0. Sensitivity: with the S1-01 hash binding reverted the reused-key case alone goes red, restored. All 17 stated fixes in place; three «no change» justified. New: Q1-01 informational (the id was lower-cased in the hash only, not in the audit object id, outbox or response), Q1-02 minor (the admin case checked the status only), Q1-03 informational (the shared conflict message says «different request body») | QA report; `scratchpad/dev021-qa-*.txt` | Q1 fixes |
| 10 | rework (coordinator) and re-verify (`gp-qa`) on `957487c` | Q1-01: the path id is lower-cased once after the UUID check, so the hash, the audit object id, the outbox payload and the response carry the canonical id. Q1-02: the admin case revokes with the upper-cased id and asserts the canonical response, the row at version 2, one audit row under the canonical id, the token dead. Q1-03: a note in BL-112. **`gp-qa` re-verified**: both in place, only the route, the test and BL-112 changed; revoke file 13, call-site test 2, typecheck, validator; removing the lower-casing turns the admin case red, restored; criteria 1–7 still PASS. The coordinator's `pnpm turbo run typecheck --force` on `957487c`: 10/10 | `scratchpad/qa2-*.txt`, `dev021-r4-*.txt` | Done |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| Q1-01 | informational | revoke route | Actual: the id lower-cased in the hash only | coordinator | Canonical id once after the check (row 10) |
| Q1-02 | minor | the admin case | Actual: status only | coordinator | Row, audit and token asserted (row 10) |
| Q1-03 | informational | the shared 409 message | Actual: «different request body» for a reused target | coordinator | Note in BL-112 |
| S2-01 | informational | revoke route, the hash | Actual: a differently-cased id retried as 409 | coordinator | Lower-cased in the hash (row 8) |
| S1-01 / R1-02 | major / minor | revoke route, the request hash | Actual: a key reused for another invitation replayed the first revoke's 200; the second link stayed live | coordinator | Target bound into the hash; red then green (row 7); BL-112 for the other routes |
| S1-02 | minor | `inv_update` | Actual: the policy layer untested | coordinator | SQL case (row 7) |
| S1-03 | minor | revoke records | Actual: email-free untested | coordinator | Email sweep (row 7) |
| S1-04 | informational | BL-014 | A stranger who already accepted keeps the role | coordinator | «What is not true», BL-013 note |
| S1-05 | informational | 403 vs 404 inside a workspace | No cross-workspace oracle | coordinator | No change |
| S1-06 | informational | admins revoking each other's invitations | Audited, no rate limit | coordinator | «What is not true» |
| R1-01 | minor | INV-103, expired half | Actual: untested | coordinator | Case added (row 7) |
| R1-03 | minor | ADR-012 Approval | Actual: detail presented as ruled | coordinator | Clarified (row 7) |
| R1-04 | minor | Sources | Actual: empty | coordinator | PostgreSQL 17 and Next.js 16.3.1 cited |
| R1-05 | minor | Evidence | Actual: no `next build` | coordinator | Ran, rc 0 |
| R1-06 | minor | Test cleanup | Actual: accept records survived | coordinator | Removed by actor; residue 0 |
| R1-07 | nit | Replay cases | Actual: status only | coordinator | Codes asserted |
| R1-08 | minor | T-INVITATION-001 | Actual: implied the race was covered | coordinator | Worded |
| R1-09 | nit | ADR-012 decision 2 | Actual: «then create» | coordinator | «with a new Idempotency-Key» |
| R1-10 | nit | ADR index | Actual: paraphrase | coordinator | Quoted |

Rework count and hypothesis changes: none counted — no QA FAIL; `gp-security`'s major was fixed before QA.

## What is not true after this task

- **Reissue does not exist** (not approved; BL-111): recovery from a lost token is revoke, then create with a new `Idempotency-Key` (the original key replays the old receipt), and the invitation gets a new id.
- **There is no invitation list**: an admin finds the id from the create's 409, or by replaying the create with its key.
- **The token is still a bearer credential not bound to the invited email** (BL-013); revoke ends it, nothing prevents its use before.
- **Revoke helps only before acceptance**: a stranger who has already accepted a leaked link keeps the invited role, because no route ends or suspends a membership (BL-014); the admin can see the join in `members.list` (S1-04).
- **An owner or admin can revoke invitations another admin issued, repeatedly**: each revoke is audited with the acting user; there is no rate limit and no notice to the issuer (S1-06, a governance matter ADR-012 leaves out).
- **Other path-targeted commands still let a reused key replay another target's result** (BL-112); `invitations.revoke` alone binds its target into the hash.
- **Only the files named in rows 3-5 ran against the database**, each alone, locally. Nothing ran in CI.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. The revoke file fails at `65d7935` and passes after; truncates nothing | yes | `957487c` | `dev021-red-int.txt` (11 failed at `65d7935`: 10 for the missing route, one behavioural at `:137`), `dev021-r2-red-int.txt` (the reused-key case red on the unfixed route); `dev021-r4-db-revoke.txt` and `gp-qa`'s runs (13 passed); residue 0/0 | PASS | assisted: local database only; the revoke/accept race is not exercised |
| 2. The contract | yes | `957487c` | `dev021-red-contracts.txt` (2 failed, a specification red), `gp-qa`'s contracts run (140) | PASS | — |
| 3. Lookup first, `authorize`, row lock and status compare, token- and email-free, no secret; call-site test green | yes | `957487c` | the route; the S1-02 SQL case (`[1,0,0]` / `[1,1,1]`); `dev021-r4-call-sites.txt`; `gp-qa`'s reading and sensitivity runs | PASS | — |
| 4. ADR-012 `Approved` with the owner's dated ruling; the index agrees | yes | `957487c` | the ADR's Approval section; `gp-reviewer` and `gp-qa` read it against `docs/README.md` | PASS | the owner's merge ratifies the transcription |
| 5. Catalogs, counts, backlog and STATUS agree; validators | yes | `957487c` | `gp-qa`'s reading; `dev021-r2-canonical-docs.txt`, `gp-qa`'s validator runs | PASS | — |
| 6. `pnpm turbo run typecheck`; contracts tests | yes | `957487c` | `dev021-r4-typecheck-all.txt` (10/10, `--force`); contracts 140 at `df9f2c5` (the contracts package is unchanged since) | PASS | — |
| 7. The coordinator's regression set | yes | `df9f2c5` | `dev021-reg-*.txt` (on `f4d491e`) and `gp-qa`'s runs at `df9f2c5`: `invitations` 9, `review-fixes` 10, `vertical-m1` 9, none skipped; `error-catalog-fidelity` 1 | PASS | assisted: they truncate tenant tables in the local database; the change after `df9f2c5` touches only the revoke route, which none of them calls |
| 8. CI `verify` on the PR head | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026; settled by CI `verify` on the PR head |

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

Gate records written before 2026-09-13 keep their own tokens; `docs/delivery/pilot-execution-runbook.md` §7.4 maps them onto this set.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

- PostgreSQL 17 `CREATE POLICY`, «Policies Applied by Command Type» — https://www.postgresql.org/docs/17/sql-createpolicy.html — local server 17.6; accessed 2026-09-18. `SELECT … FOR UPDATE` applies the SELECT policy's and the UPDATE policy's `USING` as filters on the existing row, and an `UPDATE` sees only the rows its `USING` admits, silently: so a member-role session locks and updates nothing (the route counts the UPDATE's rows). The route file's S1-02 case observes it on 17.6.
- Next.js 16.3.1, dynamic route segments (`params` is a Promise) — `apps/app/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`, read by `gp-architect`; accessed 2026-09-18.

## Completion / handoff

- Changed / inspected files: see «Owning module and allowed edit paths», plus BL-112; commits `f4d491e` (implementation), `fd37b9e` (review round 1), `df9f2c5` (S2-01), `957487c` (QA findings), the record commits and the closing commit.
- Review independence: independent — `gp-architect` (design), `gp-reviewer` (APPROVE), `gp-security` (HOLD on S1-01, then CLOSED on re-check), `gp-qa` on `df9f2c5` and its re-verification on `957487c`, all native subagents. ADR-012's ruling is the owner's (2026-09-18). No rework round was counted: no QA FAIL, and the one major was fixed before QA.
- Verified scope: criteria 1–7 PASS; criterion 8 NOT RUN, not required.
- Remaining risks / blocked requirements: «What is not true» above; BL-111 (reissue), BL-112 (P2, reused keys on other path-targeted commands), BL-013, BL-014.
- Next bounded action and owner: owner — review ADR-012 and the PR, and merge; the merge ratifies ADR-012's Approval transcription.
- Final state and reason: done — every required criterion PASS; every finding fixed or recorded with its reason.
