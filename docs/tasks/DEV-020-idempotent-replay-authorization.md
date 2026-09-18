# DEV-020 — BL-103: a stored idempotent response is replayed only to a caller still authorized for the command

## Assignment

- **Objective and user-visible outcome:** a caller who repeats an `Idempotency-Key` gets the stored response back only if they may still perform the command. A user whose membership ended, an admin demoted to member, or a member whose project capability was revoked or expired gets the same 403 or 404 a fresh call gets, never the stored 2xx, and never a 409 that confirms the record exists. The database half: a stored record that carries a workspace is readable only by an active member of it.
- **State:** done
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
  8. The existing `apps/app` integration suites that exercise replay and conflict on the edited routes pass — **the coordinator's set under the owner's delegation**: `invitations`, `workspaces`, `organizations`, `requirement-templates`, `project-communications`, `telegram-bindings`, `import-publish`, `progress-record`, `concurrency` (the lock now follows `authorize`), `m3-refusal`, `upload-intents-create`, `m5-external`, one at a time; together they cover every class of call site and all three implementation slices.
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
| 2 | implementing (coordinator): red | Tests written first. **At `902c214`, local database `0088`, each file alone:** `operational-rls.test.ts` 2 failed, 3 passed — the ended member read its own record of A on the tenant plane (`:134`) and the service plane (`:142`); `idempotency-authorization.int.test.ts` 5 failed, 1 passed (the control) — after the membership ended the replay was 201 (`:126`) and a different body 409 (`:139`); after demotion 201 (`:154`); the party update 200 after demotion (`:173`); the access grant 201 after `project.admin` was revoked (`:201`). No `de20…` or `de16…` workspace left | `scratchpad/dev020-red-db-operational-rls.txt`, `dev020-red-int.txt` | Helper, `0089`, call sites |
| 3 | implementing (coordinator + `gp-implementer` ×3): fix | **Helper:** `withIdempotency<T, A>` takes a required `authorize: () => Promise<A>`, run before the lock and the lookup on every call, its result passed to `fn`; `actorScopedOnly` is the sentinel for a call with no workspace and throws for one with a workspace. `idempotency-authorize.test.ts` (no database, a fake transaction): 4 passed; against the helper at `902c214`, 4 failed for the defect (a replay never called `authorize`; a different body got `IdempotencyConflictError` before the refusal). **`0089`** written and applied by hand as `postgres` (`-1`, rc 0; self-check passed), recorded in `schema_migrations`: `idem_select` now carries `idem_insert`'s predicate; `idem_insert`, the grants and every other policy (an md5 over all other `pg_policies` rows) identical before and after; re-apply rc 0. `operational-rls.test.ts` green at `0089` (5 passed). **Call sites:** the coordinator converted 7 as exemplars (`workspaces/[workspaceId]/projects`, `…/invitations`, `parties/[partyId]`, `projects/[projectId]/access-grants`, and the three with no workspace, which pass `actorScopedOnly`); three `gp-implementer` subagents converted the other 44 in disjoint slices under one brief («who» checks move, «facts» stay, the lookup stays first). Checks they deliberately left inside: `record-evidence-decision`'s self-decision refusal (it reads rows the caller writes later), every status, version, target and duplicate check. Flagged for review: `requirePartyEditCapability` also reads whether the party is an own legal entity (moved, as the exemplar did); `import-batches/validate` phase 3 uses the phase-1 role for «can manage units» (unchanged). Audit: 51 call sites, 51 with `authorize` (3 with the sentinel). `pnpm turbo run typecheck --force` 10/10 after one fix in the new test (`rows[0]?.n`) | `scratchpad/dev020-helper-unit*.txt`, `dev020-apply-0089.txt`, `dev020-green-db-operational-rls.txt`, `dev020-implementer-brief.md`, `dev020-exemplars.diff`, `dev020-site-audit.txt`, `dev020-typecheck-all.txt` | Documents, runs |
| 4 | implementing (coordinator): documents | `rls-coverage.csv`: the `idempotency_records` row stays `covered`, its negative now cites the ended-membership test and its reason names `0089`; DA-134 privileges `SELECT\|INSERT` (no `UPDATE` is granted, `0003:65`); INV-048 gains the authorization clause; T-IDEMP-001 extended, T-RLS-011 added; dated notes in `data-model.md` and `tenancy-and-security.md` «Capability evaluation»; BL-103 `closed → DEV-020`; STATUS marker `0089`, counts, next actions. Validator rc 0 | the implementation commit | Commit; runs |
| 5 | implementing (coordinator): runs on `ef939f5` | Each file alone, clean tree, local database `0089`: `idempotency-authorization.int.test.ts` **6 passed**; `operational-rls.test.ts` 5; `rls-coverage.test.ts` 22; `packages/database/src/idempotency.test.ts` 2 (writes only null-workspace records of random actors). No `de20…`/`de16…` workspace left. **Regression (criterion 8), each alone, none skipped:** invitations 9, workspaces 7, organizations 7, requirement-templates 15, project-communications 9, telegram-bindings 8, import-publish 17, progress-record 10, concurrency 9, m3-refusal 29, upload-intents-create 23, m5-external 27 — 170 passed | `scratchpad/dev020-db-*.txt`, `dev020-reg-*.txt` | `gp-reviewer`, `gp-security` |
| 6 | reviewing (`gp-reviewer`, `gp-security`, native) on `ae675a2` | **`gp-reviewer`: CHANGES REQUESTED, documentation only** — no fact check moved into `authorize`, no «who» check left in a callback, the lookups still first, the capture patterns untouched, `0089`'s predicate identical to `idem_insert`; agreed with both judgement calls (the self-decision refusal is step-7 separation of duties; `requirePartyEditCapability` belongs in `authorize`). R1-01 to R1-03 minor, R1-04 to R1-06 nits, R1-07 follow-up. **`gp-security`: PASS** — no path returns a stored response or a 409 to a caller who lost authority, at any of the 51 sites; the service plane carries the actor; the external plane does not use the helper; the no-workspace residual holds only the caller's own receipt. S1-01, S1-02 minor; S1-03 to S1-05 informational | review reports | Stated fixes |
| 7 | rework (coordinator), stated fixes | **`validate` phase 3** (R1-03, S1-04): `authorize` returns the membership and `canManageUnits` reads its fresh role; the phase-1 `role` field and its import removed. **Static call-site test** (S1-01, R1-07) `apps/app/src/lib/idempotency-call-sites.test.ts`, no database: every `withIdempotency` call naming a workspace must reach `requireActiveMembership` or an `authorize*` helper, and `actorScopedOnly`/`organizationId: null` are allowed only on the three bootstrap operations; 2 passed; **mutation**: `workspaces/[workspaceId]/parties`'s `authorize` replaced by `async () => {}` turned it red naming that site, restored. **Two integration cases** (S1-02): `project_access.grant` after the caller's `project.admin` lapsed through `valid_until` → 403 `SCOPE_PROJECT_DENIED`; the Telegram member link (service plane) after `project.view` and `project.admin` lapsed → **404** `RESOURCE_NOT_FOUND`, not the 403 S1-02 proposed: without `project.view` the project is invisible under RLS and the lookup answers first, as for an ex-member — the case needed the project's field channel configured (the intent's foreign key). INV-048 names the no-workspace residual (R1-02); T-RLS-011's variables (R1-04); the self-decision comment (R1-05); the lock-wait window in the helper's doc (R1-06); BL-110 (P3, S1-05). The call-site list below (R1-01). **Red again, with `apps/app/app`, `apps/app/src` and the helper checked out from `902c214`, tests at `d24539f`, database at `0089`:** 4 failed — demoted (`:168`), party demoted (`:187`), `project.admin` revoked (`:215`) and lapsed (`:234`), each a 201/200 replay; the two ended-membership cases passed, which is `0089` alone refusing them under the old code (the deploy-order claim, observed); the Telegram case passed, since that route authorized before its block already (a guard, not a defect proof). Restored, tree clean. **Green on `d24539f`, each alone:** typecheck 10/10; validators rc 0; helper unit 4; call-site test 2; `idempotency-authorization` 8; `operational-rls` 5; `rls-coverage` 22; `idempotency.test.ts` 2; regression for the validate change: `imports` 13, `import-publish` 17, `concurrency` 9. No `de20…`/`de16…` workspace left | `scratchpad/dev020-r2-*.txt` | `gp-qa` |
| 8 | verifying (`gp-qa`, native) on `34b66b4` | **Verified for the scoped criteria:** 1–8 PASS, 9 NOT RUN (not required). Its own runs, each alone: `idempotency-authorization` 8, `operational-rls` 5, `rls-coverage` 22, `idempotency.test.ts` 2, helper unit 4, call-site test 2; regression `imports` 13, `import-publish` 17, `concurrency` 9, `m5-external` 27, `project-communications` 9, none skipped; app, database and testing typecheck and both validators rc 0; `0089`'s sha256 matches the apply record and the deployed `idem_select` equals `idem_insert`'s check; the «Call sites» table equals `git grep` (51 sites, the class counts). Its sensitivity check: dropping `requireWorkspaceCapability` from `projects.create`'s `authorize` turned the integration file red at `:168`, restored. Every stated fix in place; S1-02's 404 judged correct; S1-03's «not changed» justified. New: Q1-01 minor (that same mutation leaves the call-site test green: it proves membership reachability only) | QA report; `scratchpad/qa-*.txt` | Q1-01; done |
| 9 | closing (coordinator) | Q1-01: stated in «What is not true» and in the call-site test's header (a comment). Acceptance table and handoff filled from the QA matrix. Validator re-run after this row is written | `scratchpad/dev020-close-canonical-docs.txt` | Push, PR |

## Call sites (criterion 5)

All 51 `withIdempotency` call sites at `d24539f`, generated from the tree. Class, from `gp-architect`'s reading at `b3045df`: **A** authorized before the block already; **A-post** re-checks after it too; **B-role** / **B-cap** resolve their resource under RLS first (an ex-member got 404) but checked the workspace role / project capability only inside; **C** checked nothing before the block; **D** has no workspace. «authorize» is what the step now checks (`proj:` a project capability, `ws:` a workspace capability; an `authorize*()` helper does the lookup, membership and capabilities). Every «facts» check (status, version, head, duplicate, target row, business invariant) stayed in its callback; the two deliberate judgement calls are `record-evidence-decision`'s self-decision refusal (stays: step-7 separation of duties over the occurrence's facts) and `requirePartyEditCapability` (moved: it chooses which capability applies). The call-site test pins this list's rule, not its entries.

| Call site | Operation | Class | authorize |
|---|---|---|---|
| `app/v1/assignments/[assignmentId]/communication-card/route.ts:52` | `assignment_communication_cards.publish` | A | authorizeAssignment() |
| `app/v1/assignments/[assignmentId]/progress/route.ts:60` | `progress.record` | B-cap | membership, proj:progress.record |
| `app/v1/assignments/[assignmentId]/stages/route.ts:155` | `work_stages.create` | B-cap | membership, proj:assignments.manage |
| `app/v1/contract-versions/[versionId]/publish/route.ts:88` | `contract_versions.publish` | B-cap | membership, proj:contracts.edit |
| `app/v1/contract-versions/[versionId]/rule-bindings/route.ts:63` | `contract_versions.bind_rules` | B-cap | membership, proj:rule_bindings.manage |
| `app/v1/contract-versions/[versionId]/work-items/route.ts:44` | `work_items.create` | B-cap | membership, proj:contracts.edit |
| `app/v1/contracts/[contractId]/assignments/route.ts:131` | `assignments.create` | B-cap | membership, proj:assignments.manage |
| `app/v1/contracts/[contractId]/import-batches/route.ts:26` | `import_batches.create` | B-cap | membership, proj:imports.manage |
| `app/v1/contracts/[contractId]/versions/route.ts:51` | `contract_versions.create` | B-cap | membership, proj:contracts.edit |
| `app/v1/grants/[grantId]/revoke-reissue/route.ts:76` | `external_grants.revoke_reissue` | B-cap | membership, proj:project.view, proj:packages.submit |
| `app/v1/import-batches/[batchId]/files/route.ts:97` | `import_files.add` | B-cap | membership, proj:imports.manage |
| `app/v1/import-batches/[batchId]/publish/route.ts:41` | `import_batches.publish` | B-cap | membership, proj:imports.publish |
| `app/v1/import-batches/[batchId]/resolutions/route.ts:30` | `import_resolutions.create` | B-cap | membership, proj:imports.manage |
| `app/v1/import-batches/[batchId]/validate/route.ts:115` | `import_batches.validate` | A | membership, proj:imports.manage |
| `app/v1/invitations/accept/route.ts:13` | `invitations.accept` | D | actorScopedOnly |
| `app/v1/occurrences/[occurrenceId]/exceptions/route.ts:75` | `requirement_exceptions.create` | B-cap | membership, proj:project.view, proj:requirement_exceptions.decide |
| `app/v1/occurrences/[occurrenceId]/grants/route.ts:108` | `occurrence_grants.issue` | B-cap | membership, proj:project.view, proj:packages.submit |
| `app/v1/organizations/route.ts:66` | `organizations.create` | D | actorScopedOnly |
| `app/v1/parties/[partyId]/contacts/route.ts:57` | `party_contacts.create` | B-role | membership, party edit (INV-020) |
| `app/v1/parties/[partyId]/legal-profile/route.ts:24` | `parties.legal_profile.put` | B-role | membership, party edit (INV-020) |
| `app/v1/parties/[partyId]/own-profile/route.ts:23` | `parties.own_profile.create` | B-role | membership, ws:own_legal_profiles.manage |
| `app/v1/parties/[partyId]/route.ts:25` | `parties.update` | B-role | membership, party edit (INV-020) |
| `app/v1/progress-entries/[entryId]/adjustments/route.ts:84` | `progress.adjust` | B-cap | membership, proj:progress.adjust |
| `app/v1/project-requirements/[itemId]/archive/route.ts:70` | `project_requirements.archive` | B-role | membership, ws:project_requirements.manage |
| `app/v1/projects/[projectId]/access-grants/route.ts:23` | `project_access.grant` | B-cap | membership, proj:project.admin |
| `app/v1/projects/[projectId]/activate/route.ts:24` | `projects.activate` | B-cap | membership, proj:project.admin |
| `app/v1/projects/[projectId]/communications/[messageId]/retry/route.ts:90` | `project_communications.retry` | A | authorizeProject() |
| `app/v1/projects/[projectId]/communications/route.ts:241` | `project_communications.reply` | A | authorizeProject() |
| `app/v1/projects/[projectId]/contract-versions/[versionId]/requirement-occurrences/dry-run/route.ts:78` | `requirement_occurrences.dry_run` | B-cap | membership, proj:requirements.assign |
| `app/v1/projects/[projectId]/contracts/route.ts:24` | `contracts.create` | B-cap | membership, proj:contracts.edit |
| `app/v1/projects/[projectId]/field-channel/route.ts:59` | `project_field_channel.configure` | B-cap | membership, proj:project.admin |
| `app/v1/projects/[projectId]/parties/route.ts:59` | `project_parties.create` | B-cap | membership, proj:project.admin |
| `app/v1/projects/[projectId]/responsibilities/route.ts:31` | `project_responsibilities.assign` | B-cap | membership, proj:project.admin |
| `app/v1/projects/[projectId]/telegram/binding-intents/route.ts:50` | `telegram_binding_intents.create` | A | authorizeProjectAdmin() |
| `app/v1/projects/[projectId]/telegram/member-link-intents/route.ts:47` | `telegram_member_link_intents.create` | A | authorizeCurrentProjectMember() |
| `app/v1/requirement-rule-versions/[ruleVersionId]/retire/route.ts:68` | `requirement_rule_versions.retire` | B-role | membership, ws:requirement_rules.manage |
| `app/v1/requirement-templates/[templateVersionId]/publish/route.ts:33` | `requirement_templates.publish` | B-role | membership, ws:requirement_templates.manage |
| `app/v1/stages/[stageId]/closures/route.ts:144` | `stage_closures.create` | B-cap | membership, proj:project.view, proj:stage_closures.close |
| `app/v1/stages/[stageId]/statutory-acts/route.ts:116` | `statutory_acts.compose` | B-cap | membership, proj:project.view, proj:statutory_acts.compose |
| `app/v1/statutory-act-versions/[actVersionId]/freeze/route.ts:94` | `statutory_act_versions.freeze` | B-cap | membership, proj:project.view, proj:statutory_acts.compose |
| `app/v1/work-items/[workItemId]/route.ts:79` | `work_items.update` | B-cap | membership, proj:contracts.edit |
| `app/v1/work-items/[workItemId]/route.ts:260` | `work_items.remove` | B-cap | membership, proj:contracts.edit |
| `app/v1/workspaces/[workspaceId]/invitations/route.ts:46` | `invitations.create` | C | membership, owner/admin |
| `app/v1/workspaces/[workspaceId]/parties/route.ts:19` | `parties.create` | C | membership, ws:parties.manage |
| `app/v1/workspaces/[workspaceId]/project-requirements/route.ts:47` | `project_requirements.create` | C | membership, ws:project_requirements.manage |
| `app/v1/workspaces/[workspaceId]/projects/route.ts:19` | `projects.create` | C | membership, ws:projects.create |
| `app/v1/workspaces/[workspaceId]/requirement-rule-versions/route.ts:117` | `requirement_rule_versions.publish` | C | membership, ws:requirement_rules.manage |
| `app/v1/workspaces/[workspaceId]/requirement-templates/route.ts:20` | `requirement_templates.create` | C | membership, ws:requirement_templates.manage |
| `app/v1/workspaces/route.ts:16` | `workspaces.create` | D | actorScopedOnly |
| `src/lib/evidence/authorize-upload-intent.ts:87` | `upload_intents.create` | A-post | membership, proj:evidence.record |
| `src/lib/evidence/record-evidence-decision.ts:28` | `evidence_decisions.create` | B-cap | membership, proj:project.view, proj:evidence_decisions.decide |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| Q1-01 | minor | `idempotency-call-sites.test.ts`; «What is not true» | Actual: a site that keeps membership but drops its role/capability check passes the static test; unstated | coordinator | Stated in both (row 9); no code change |
| R1-01 | minor | Criterion 5; the record | Actual: a count and a scratchpad path, not the list | coordinator | «Call sites» section (row 7) |
| R1-02 | minor | INV-048 | Actual: «never the stored result» with no exception | coordinator | The no-workspace residual named (row 7) |
| R1-03 / S1-04 | minor / informational | `import-batches/[batchId]/validate` phase 3 | Actual: `canManageUnits` from the phase-1 role | coordinator | `authorize` returns `m`; `m.role` (row 7); `imports`, `import-publish`, `concurrency` green |
| R1-04 | nit | T-RLS-011 | Actual: `APP_DB_URL` unnamed | coordinator | Named (row 7) |
| R1-05 | nit | `record-evidence-decision.ts` comment | Actual: the reason unstated | coordinator | Reworded (row 7) |
| R1-06 | nit | The helper's doc | Actual: the lock-wait window unstated | coordinator | One sentence (row 7) |
| R1-07 / S1-01 | follow-up / minor | The helper's contract | Actual: a no-op `authorize` type-checks | coordinator | Static call-site test with a mutation proof (row 7) |
| S1-02 | minor | `idempotency-authorization.int.test.ts` | Actual: no service-plane case, no `valid_until` case | coordinator | Two cases (row 7); the service-plane one answers 404, not the proposed 403, because the lookup comes first |
| S1-03 | informational | `authorize` before the lock | A membership ended during the lock wait: invisible record, the callback's writes fail on RLS (500, not 403); a role/capability lost during it: may proceed; strictly better than before | coordinator | **Not changed**; the window stated in the helper's doc (R1-06) |
| S1-05 | informational | `0007` `app.delete_expired_idempotency` | Actual: `search_path = public`; not a probe | coordinator | BL-110 (P3) |

Rework count and hypothesis changes: none — no QA FAIL and no blocker.

## What is not true after this task

- **A record without a workspace** (`workspaces.create`, `organizations.create`, `invitations.accept`) is still replayed to its actor alone, whatever has happened since; its body is the caller's own receipt, and `invitations.accept`'s `role` may be out of date (owner, 2026-09-18: accepted).
- **`0089` is on the local database only.** Either deploy order is safe; a hosted project cannot take it before `0059`–`0088` and the Q-9 push decision.
- **A no-op `authorize` is refused by a static test, not by the type or the runtime**; a route that hid its check behind another name would pass it, and so would a site that keeps the membership check but drops its role or capability check (Q1-01) — that is caught only by review and by the integration cases, which exist for `projects.create`, `parties.update`, `project_access.grant` and the Telegram member link.
- **A capability lost while a same-key request waits on the lock** is not seen by that request (S1-03); the window is the lock wait.
- **Only the files named in rows 2-7 ran against the database**, each alone, locally; the other `apps/app` integration suites and the other `packages/testing` suites did not run. Nothing ran in CI.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. The route file is red at `902c214` and green after; truncates nothing, no residue | yes | `34b66b4` | `dev020-red-int.txt` (5 failed at `902c214`/`0088`), `dev020-r2-red-int.txt` (old code at `0089`: the application half's 4 cases red), `dev020-r2-db-idempotency-authorization.txt` (8 passed); `gp-qa`'s run (8) and its mutation (red at `:168`); residue 0 | PASS | assisted: local database only; the two `valid_until` cases were added in rework, and the service-plane one passes under the old code too (a guard) |
| 2. The policy cases are red at `0088` and green at `0089` | yes | `34b66b4` | `dev020-red-db-operational-rls.txt` (2 failed), `dev020-r2-db-operational-rls.txt` (5 passed); `gp-qa`'s run | PASS | assisted: local database only |
| 3. `0089` changes only `idem_select`, self-check, applies at `0088`; zero gaps; `rls-coverage.test.ts` | yes | `34b66b4` | `dev020-apply-0089.txt` (rc 0, `idem_select` = `idem_insert`'s predicate, the other policies' md5 and the grants unchanged, re-apply rc 0); `dev020-r2-db-rls-coverage.txt` (22); `gp-qa`'s sha256 and policy reads | PASS | assisted: applied by hand to the local database; no hosted project |
| 4. The required `authorize` step, its order, the sentinel; the helper's own suite | yes | `34b66b4` | `dev020-helper-unit-red.txt` (4 failed on the old helper), `dev020-r2-helper-unit.txt` (4), `dev020-r2-db-idempotency-helper.txt` (2); `gp-qa`'s runs | PASS | — |
| 5. Every call site moves its «who» checks and keeps its «facts»; the record lists every site | yes | `34b66b4` | «Call sites» (51 rows, equal to `git grep`); `gp-reviewer` read all 51 hunks, `gp-security` compared the risky ones line by line, `gp-qa` scripted all 51; `dev020-r2-audit-test.txt` and its mutation | PASS | static reading beyond the four routes with integration cases (Q1-01) |
| 6. Catalogs, notes, STATUS and BL-103 agree; validators | yes | `34b66b4` | `dev020-r2-canonical-docs.txt`, `dev020-r2-agents.txt`; `gp-qa`'s reading of INV-048, DA-134, T-IDEMP-001, T-RLS-011, the registry row, BL-103, BL-110, STATUS | PASS | — |
| 7. `pnpm turbo run typecheck` | yes | `d24539f` (code identical at `34b66b4`) | `dev020-r2-typecheck-all.txt` (10/10, `--force`); `gp-qa`'s app, database and testing typecheck | PASS | `apps/app/tsconfig.json` does not include `tests/` (pre-existing) |
| 8. The coordinator's regression set | yes | `ef939f5` / `34b66b4` | `dev020-reg-*.txt` (12 files, 170 passed at `ef939f5`); `dev020-r2-reg-*.txt` and `gp-qa`'s runs at `34b66b4` for the five that cover code changed since (`imports`, `import-publish`, `concurrency`, `m5-external`, `project-communications`) | PASS | assisted: they truncate tenant tables in the local database; seven files' evidence is on `ef939f5`, before a change that only touched `validate` |
| 9. CI `verify` on the PR head | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026; settled by CI `verify` on the PR head |

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

Gate records written before 2026-09-13 keep their own tokens; `docs/delivery/pilot-execution-runbook.md` §7.4 maps them onto this set.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

- PostgreSQL 17 `ALTER POLICY` and `CREATE POLICY` — https://www.postgresql.org/docs/17/sql-alterpolicy.html, https://www.postgresql.org/docs/17/sql-createpolicy.html — server 17.6; accessed 2026-09-18. `ALTER POLICY … USING` replaces the expression and keeps the name, roles and command; `SELECT` policies filter rows silently, so an invisible record reads as absent rather than failing.

## Completion / handoff

- Changed / inspected files: see «Owning module and allowed edit paths», plus `apps/app/src/lib/idempotency-call-sites.test.ts` (new), BL-110 and `packages/database/src/idempotency-authorize.test.ts` (new); commits `ef939f5` (implementation), `d2cd031` and `d24539f` (review round 1), the record commits and the closing commit.
- Review independence: independent — `gp-architect` (design), three `gp-implementer` slices under the coordinator's brief, `gp-reviewer` (CHANGES REQUESTED, documentation only), `gp-security` (PASS), `gp-qa` on `34b66b4`, all native subagents. No rework round was counted: no QA FAIL and no blocker.
- Verified scope: criteria 1–8 PASS; criterion 9 NOT RUN, not required.
- Remaining risks / blocked requirements: «What is not true» above; BL-110; `0089` is on the local database only.
- Next bounded action and owner: owner — review and merge the PR.
- Final state and reason: done — every required criterion PASS; every finding fixed or recorded with its reason.
