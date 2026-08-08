# Handoff — GoProceed v0.1 build, 2026-08-08

Written at the end of the session that produced this branch. It is meant to be
read cold: everything needed to continue is here or is linked from here.

**Branch:** `claude/project-competitor-analysis-e62ed8`
**Base:** `4635932` (Merge pull request #8, rename-slice3-packages)
**Size:** 186 changed or new files, 77 tracked files at +16 206 / −1 864, 109 untracked.
**Nothing is committed.** The whole branch is a working tree.

---

## 1. Read these first, in this order

| File | Why |
|---|---|
| `docs/decisions/ADR-005-readiness-gate-and-hidden-works.md` | The product thesis as a decision. Read its amendment notes — it was amended three times. |
| `docs/decisions/ADR-006-pilot-shaped-v0.1.md` | v0.1 = six steps a customer can use unaided. Decision 4 is the v0.1 table set. |
| `docs/decisions/ADR-007-pilot-field-client.md` | PWA, not Expo, and the four provenance claims it **withdraws**. |
| `docs/decisions/ADR-008-valuation-carves-at-admission.md` | Money carves at stage closure, not at recording. |
| `docs/product/hidden-works-content-rules.md` | **Approved, and it restricts at every precedence level, including over ADRs.** Nothing outside its allow-list may be asserted, rendered or stored. |
| `docs/superpowers/plans/2026-08-06-v0.1-implementation.md` | The build plan and eight spec contradictions found while writing it. |
| `docs/superpowers/plans/2026-08-06-v0.1-implementation-progress.md` | What each slice actually landed, file by file. |
| `TODOS.md` | Everything open, including two P0s. |

---

## 2. What is verified, and what only looks verified

This distinction is the most important thing in this document. Most of the build
was written with no database and no `node_modules`, so "checked" meant static
reading. On 2026-08-08 the stack came up and three things became facts.

### Actually run, and passed

- **`supabase db reset` applied all 51 migrations in sequence**, `0001` → `0051`,
  with no error. 53 tables in `public`. The migration chain is coherent — this
  was the largest unknown in the build and it is closed.
- **`pnpm turbo run typecheck` passes, 10 of 10 packages**, after four fixes.
- **`packages/testing`: 399 tests passed** on the first correct run; the M5
  schema suite is now 40 of 42.

### Written but never executed

- `apps/app`'s 37 integration test files. **They have not run once.** The
  end-to-end path — hand-typed line → occurrences → refused closure → act →
  external decision — has been traced in code by a reviewer and never executed.
- `packages/contracts`, `packages/domain`, `apps/demo` ran partially in an
  earlier misconfigured invocation; treat their results as unknown.

### The blind spot that mattered

Every agent report before 2026-08-08 said "checked by parsing, not typechecking",
using `node --experimental-strip-types --check`. That check **passed a file that
was not valid TypeScript**: `apps/app/app/external/review/route.ts` had six
backticks inside comments inside a template literal, which closed the literal and
made the browser JS parse as TS. The stripper does not look inside template
literals; `tsc` does. Read every pre-2026-08-08 "parses" claim with that in mind.

---

## 3. How to run it

The local Supabase stack must be up. The two env vars are **not** optional —
`packages/database/src/pool.ts` throws without them, and that is what made the
first attempt look like a mass failure.

```bash
pnpm install
supabase db reset
pnpm db:local-credentials
export APP_DB_URL="postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres"
export SERVICE_DB_URL="postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres"
pnpm turbo run typecheck --concurrency=1
pnpm turbo run test --concurrency=1
```

`--concurrency=1` is load-bearing, not style: `@goproceed/database`,
`@goproceed/testing` and `@goproceed/app` all hit the same Postgres and truncate
overlapping tables. `.github/workflows/ci.yml` explains it at the `turbo run test`
step.

`node scripts/validate-canonical-docs.mjs` must exit 0. It carries thirteen
guards, several added after audits caught drift this session — including one that
cross-checks the v0.1 build list against the catalogs and the applied migrations,
so it will fail if prose and reality diverge again.

---

## 4. Do this next

### 4.1 Two failing tests in `packages/testing/src/m5-external-schema.test.ts`

Both are real. Neither is understood well enough to fix blind.

**a. `external_sessions_ttl_check` violated by the fixture.** `insertSession(...,
{ idleMinutes: -1 })` builds an "already expired" session by passing a negative
idle window, and the CHECK forbids it. The constraint is right; the fixture's way
of expressing expiry is wrong. Insert a valid session and move its timestamps
back, or seed `created_at` in the past.

**b. "THE TWO PLANES ARE MUTUALLY EXCLUSIVE" — expected 0, got 4.** I checked
`app.current_external_session()` directly against the live database: it returns
NULL whenever `app.actor_user_id` is set, exactly as `packages/database/src/tx.ts`
documents. So the function is right. The likely reading is that setting an actor
GUC does not *remove* access, it *switches plane* — and if that actor is a member
of the workspace, seeing four occurrences as a member is correct. **Do not "fix"
this by changing the assertion until you have decided what the case is meant to
prove.** It is a security claim.

### 4.2 Run `apps/app` (37 files, never executed)

This is where the thesis is exercised end to end for the first time. Expect
failures. The most informative would be in `materialisation-end-to-end.int.test.ts`
or `m3-refusal.int.test.ts` — those are the gate.

### 4.3 The two P0s in `TODOS.md`

- **The pool strands silently once an over-removal parts quantity from money.**
  `work_item_performed` sums admitted *quantity*; `work_item_allocated` sums
  *money*. An over-removal parts them and every later positive carve divides the
  pool by a denominator that no longer matches. `record 4 / admit / +6 / +5 / −8 /
  close` settles at funded 7 and strands 5 % of the pool. Nothing raises, nothing
  reports it. Reachable in one lineage and one assignment. **This should be
  settled against a running database, not by static reading** — that is why it
  was left open rather than patched.
- The second P0 is marked CLOSED IN CODE and kept for its history.

---

## 5. Owner decisions that block the pilot

None of these is a coding question. The build stopped at each of them
deliberately rather than guessing.

1. **Six capabilities are in no responsibility preset** —
   `stage_closures.close`, `evidence_decisions.decide`,
   `requirement_exceptions.decide`, `progress.adjust`, `readiness.view`,
   `statutory_acts.compose`. They are reachable only by a hand-written project
   grant, so the M3–M6 path works in tests and for no real persona. One row each
   in `technical/permissions/responsibility-presets.csv`; the question is which
   responsibility owns stage closure — internal verifier or foreman.
2. **The В.1/В.2 field list of Додаток В is committed nowhere**, so
   `DODATOK_V_TEMPLATE.fieldList` is null, `renderStatutoryAct` always returns
   `ok:false`, and `statutory_act_versions.freeze` **always refuses**. M4 ships a
   composer and no document. This is correct behaviour — inventing the field list
   is the one thing `hidden-works-content-rules.md` forbids absolutely. It
   unblocks only by transcribing the form from a sourced primary text.
3. **The two headline measures have no v0.1 definition.** ADR-005 assumption b
   makes first-time acceptance rate and days-to-signature what M6 reports
   against; both are defined over claim segments, package versions and
   `commercial_decision`, all v0.2. M6 cannot close without definitions.
4. **The owning entity for work type** — a declared vocabulary table — still needs
   an ADR. The *carrier* was settled on 2026-08-08 as a column (migration `0050`);
   see `docs/domain/glossary.md` under "Work type", which records both readings
   and which one you chose.

---

## 6. Structural facts worth knowing before you change anything

- **An imported baseline can never carry obligations.** The frozen importer
  writes no work type and a published contract version is immutable, so every
  assignment on an imported baseline materialises zero occurrences and every
  stage on it closes vacuously — permanently. The only remedy is a superseding
  hand-typed version. Recorded at `0050:517-524`.
- **The refusal genuinely refuses, on the closure path.** Five independent
  database layers stand behind the TypeScript and a reviewer could not route
  around it: the closure FK requiring an already-closed stage, the status guard,
  `app.assert_stage_closure_exists()`, `app.assert_stage_closure_set()`
  (SECURITY DEFINER, authorizes before it counts), and the satisfaction CHECKs.
- **Six paths to money without admission were found and closed** across four
  reviews. Each was found only because the previous one was closed. Treat any
  change to `valuation-writer.ts`, `admission.ts` or
  `progress-entries/[entryId]/adjustments/route.ts` as money-critical.
- **Four tests were found passing for the wrong reason** and inverted, each with
  a comment recording what it had been defending. One of them had a comment
  saying it *would* compare zero with zero if a line were missing — the line was
  there and it compared zero with zero anyway. Assume more exist.

---

## 7. Where the research lives

The session began as an analysis, not a build. Two documents carry it:

- `docs/product/competitive-landscape.md` — 30+ products analysed one by one,
  the unoccupied mechanism stated precisely with the skeptic's counter-evidence,
  54 ranked adoption decisions, pricing benchmarks, and ten questions for the
  owner. The canonical successor to the archived `docs/legacy/02`.
- `docs/delivery/package-review-2026-08-04.md` — the 230-finding audit of the
  package as it stood before any of this, including the discovery that the
  hold-point mechanism had been specified in the AktFlow era across seven
  artifacts and deleted during canonicalisation with no ADR.

Both are dated measurements. Their numbers have moved; each says so at the top.

---

## 8. Market evidence — read before believing any of this is wanted

`docs/discovery/validated-assumptions.md`. 21 evidenced sends, **0 replies, 0
interviews, 0 named projects, 0 pilot commitments, 0 willingness-to-pay signals,
and 0 customer documents of any kind.** The owner reported on 2026-08-05 that
several unnamed companies confirmed the problem and currently photograph work
through Telegram; that is recorded as founder-reported and, by that document's
own rule, moves nothing.

The whole v0.1 build rests on the owner's instruction, not on customer evidence.
That is stated in ADR-006's authority note and should stay stated.
