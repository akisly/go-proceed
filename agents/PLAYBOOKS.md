# Development playbooks

These are routes, not commands to launch every role. [COORDINATION.md](COORDINATION.md) holds the authority, triggers and state rules. The coordinator picks a route and records it in the task record.

## New feature or contract slice

1. **Intent before design.**
   - The coordinator states the goal, the user it serves (`docs/design/04-role-pain-map.md` for a screen) and what is out of scope.
   - Questions only the owner can answer are put to the owner one at a time.
   - Each answer is recorded with its date in the task record's Owner decisions table.
2. **Scope check.** If the slice would expand scope, weaken a refusal or change an approved decision, it needs an ADR first; see the Research or decision playbook.
3. **Design.**
   - `gp-researcher` resolves only the unknowns that matter.
   - `gp-architect` designs whenever tables, policies, contracts, catalogs or workflows change.
   - `gp-mobile` joins for field-client or device behaviour.
   - A slice with a real design gets a spec under `docs/specs/`; the owner approves it before implementation.
4. **Plan.** The task record's Plan section lists ordered steps, the files each step touches, and the checks that prove it.
5. **Tests first where a contract exists.** For a contract, refusal, invariant, token or audit rule, write the failing test before the code. The test is the deliverable, not ceremony.
6. **Implement.** The implementer delivers a complete, bounded slice, including failure handling, catalog updates and migrations.
7. **Review.** `gp-reviewer` always; `gp-security` and `gp-ui-reviewer` when triggered. All are independent subagents over the diff file.
8. **Rework.** The implementer resolves the findings. `gp-qa`, as an independent subagent, verifies the resulting revision.
9. **Finish.** The coordinator integrates the evidence and records done or an exact blocker. The owner decides the merge.

## Bug fix

1. **Reproduce first.** Establish an observed failure or a precise failure model, and turn it into a failing test where possible.
2. **Find the cause systematically.**
   - State a hypothesis.
   - Collect evidence that could refute it (logs, a narrowed test, the actual SQL or request).
   - Change one thing at a time.
   - A fix that has never been seen failing without itself is not verified. Revert it and watch the test go red.
3. **Fix the owning module.** The implementer fixes the cause, not the symptom. Unrelated cleanup becomes a follow-up.
4. **Review and verify.** `gp-reviewer` checks regression risk. `gp-qa` validates the trigger and the affected negative cases.
5. **Add roles only when needed.** Add `gp-researcher` only for uncertain provider behaviour, and `gp-architect` only if the fix changes a boundary.
6. **Environment failures are separate.** A failure caused by environment setup, such as a missing `APP_DB_URL` or a local stack that is down, is recorded separately from a product defect.

## Research or decision

1. **Bounded question.** `gp-researcher` receives the question, the installed version and the date that matter, and the decision it feeds. It returns primary sources, contradictions, and anything only an account can settle.
2. **Local decision.** `gp-architect` turns the evidence into a local decision only when one is needed.
3. **Record the conclusion.** The coordinator records it in the task record, or drafts an ADR under `docs/decisions/` when the decision needs one.
   - The owner rules on the ADR, and the ADR records the ruling with its date.
   - Agents never mark an ADR approved on their own.
4. **Limits.** No implementer is invoked unless implementation is in scope. A completed research task does not mean the integration works.

## UI change

1. **Procedure.** Follow the loop in `docs/design/02-building-ui.md`: orient, decide, build, gate, see, verify.
2. **Gate and screenshots.** The coordinator runs the §5 gate and pastes its output. It then runs the browser harness for §6 (`pnpm --filter @goproceed/landing qa` or `@goproceed/app qa`): six viewports plus reduced motion, with real Ukrainian strings.
3. **Review.** `gp-reviewer` and `gp-ui-reviewer` both review the diff. The UI reviewer also gets the gate output and the screenshots, and returns PASS or HOLD.
4. **Verify.** `gp-qa` verifies the final revision, including the negative states the UI reviewer named.

## Migration, RLS or grant change

1. **Design.** `gp-architect` designs the change against `docs/architecture/tenancy-and-security.md`, naming the affected principals and `INV-*` invariants.
2. **Implement.**
   - Add a new `supabase/migrations/00NN_<slug>.sql` file; never edit an applied migration.
   - Revoke `EXECUTE` from `public`, `anon` and `authenticated` on any new function.
   - Update `technical/data-access-surface.csv` and `technical/database/invariant-catalog.csv` in the same change.
3. **Local database.**
   - Migrations are applied to the local stack by hand as `postgres`. Never run `supabase db reset` without the owner.
   - Only the `apps/app` integration suites that check database credentials skip without them. They check through `hasIsolatedDatabaseCredentials()` or an inline `APP_DB_URL`/`SERVICE_DB_URL` check.
   - The rest use the local stack and mostly truncate tenant tables, so they also need the owner's confirmation before running against a local stack.
   - The `packages/testing` suites that call `resetDb()` run `supabase db reset` themselves, so they need the owner's confirmation before running against a local stack.
   - `@goproceed/testing` and `apps/app` suites must not run concurrently against the same local database.
4. **Review.** `gp-reviewer` and `gp-security` review the diff.
5. **QA.** `gp-qa` runs the policy and refusal suites with a positive control, and reports any RLS or grant defect as root `AGENTS.md` describes.

## Documentation or agent configuration

1. **Edit and regenerate.** The coordinator, acting as implementer, updates the canonical documents or the profile inputs (`agents/`), then regenerates the profiles with `python3 scripts/sync-agents.py --write`.
2. **Check.** Run `pnpm validate:agents` and `pnpm validate:canonical-docs`, and inspect scope and authority for consistency.
3. **Which route applies.**
   - Agent profiles, and rules that decide when agents run, count as behavior changes and get the independent `gp-reviewer` and `gp-qa` stages.
   - Prose-only documentation does not.
4. **Discovery.** Whether a host actually finds the profiles is a separate smoke check, run in a fresh session.
