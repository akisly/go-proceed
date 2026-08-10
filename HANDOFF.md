# Handoff — GoProceed, 2026-08-10

Written at the end of the session that followed the v0.1 build. Meant to be read
cold: everything needed to continue is here or linked from here.

**Branch:** `claude/p0-stranded-pool` → open as [PR #10](https://github.com/akisly/go-proceed/pull/10), 6 commits.
**Base:** `main`, which now contains the whole v0.1 build (PR #9, merged by the owner).

---

## 1. The one-paragraph version

The previous session shipped v0.1 as a **complete, tested backend with no front
end**. This session made CI green for the first time, found four genuine product
defects in code that had never executed, closed both money P0/P1s against a
running database, and transcribed Додаток В from the official standard. What has
not changed: **a customer still cannot click through the pilot**, because the
field client from ADR-007 was approved and never built.

---

## 2. Read these first

| File | Why |
|---|---|
| `TODOS.md` | Everything open. Two P1s were added on 2026-08-10 and are the shortest path to a pilot. |
| `docs/decisions/ADR-006-pilot-shaped-v0.1.md` | v0.1 = six steps. Decision 4 is the table set. |
| `docs/decisions/ADR-007-pilot-field-client.md` | The PWA. **Approved, and not built.** |
| `docs/product/hidden-works-content-rules.md` | Approved, and restricts at every level including over ADRs. Its "Open items" moved on 2026-08-10. |
| `docs/decisions/ADR-005-readiness-gate-and-hidden-works.md` | The product thesis as a decision. |

---

## 3. State, measured rather than asserted

On a **clean single run** (`supabase db reset`, then one `pnpm turbo run test --concurrency=1`):

- **6 of 6 packages green.** `apps/app` 45 files, `packages/testing` 454 tests,
  demo 16, domain 10, contracts 4, database 2.
- `pnpm turbo run typecheck` — 10 of 10.
- `node scripts/validate-canonical-docs.mjs` — exit 0.
- 55 migrations apply in sequence.

**One trap, and it cost this session an hour.** These suites share ONE local
Postgres. `--concurrency=1` orders tasks *within* one turbo run and does nothing
between two. Running a second full suite while the first is still going produces
`deadlock detected`, hook timeouts and a red result that is an artefact. If you
see failures in `concurrency`, `progress-record` or `progress-adjust`, check for
a stray run before believing them.

---

## 4. What this session changed

### CI, 199 red → 0

CI's own run-by-run counts: **199 → 147 → 45 → 36 → 22 → 15 → 6 → 0**. The
reported failure was 54 tests in `packages/testing`; fixing it let CI reach
`apps/app`'s 37 integration files, **which had never executed once**.

The large causes were not many:

- A teardown whose hand-written FK order was seven tables short and had four
  latent order violations. 37 of the first 54 were downstream of it. Its own
  comment had predicted exactly this. Replaced by a catalog-driven delete under
  `session_replication_role = 'replica'` (`packages/testing/src/pg.ts`).
- **52 CHECK constraints** where one-argument `btrim` strips spaces only, so a
  tab or a pasted U+00A0 passed as a source citation. Migration `0052`.
- Four hand-written `materialiseFor` harnesses that each guarded themselves with
  an error naming their own deletion. The guards fired; the rewrites were taken.

### Four product defects, all in never-executed code

1. **`exchange_external_grant` raised 42702 on every call** (`0053`). `RETURNS
   TABLE` made `token_hmac` a variable and the scan read it unqualified. No
   external link could be exchanged, ever.
2. **A session could mint its successor and not read it back** (`0054`). RLS
   applies the SELECT policy to `RETURNING`. No decision could be submitted.
3. **A version that could not be LOCKED was reported as not existing.**
   `cv_update`'s `USING (status = 'draft')` applies to `SELECT … FOR UPDATE`, so
   `requireDraft`'s catalogued 409 was dead code in four routes; three answered
   404 and two threw 500. Fixed in the routes — the RLS is right and is not QA's
   to change.
4. **INV-007 did not survive a rotation** (`0055`). A reviewer who retried a
   submit got 409 instead of the receipt they had already earned.

(1) and (2) together meant the технагляд flow did not work end to end. None was
findable by reading: all four are valid SQL that deploys and fails only when run.

### Money: both open items closed against a running database

- **P0, the stranded pool.** `record 4 / admit / +6 / +5 / −8 / close` settled at
  65 % of the pool where 70 % was owed. The carve denominator summed *measured*
  admitted quantity while the money followed *funded* quantity; an over-removal
  parts them. The denominator now answers to the money. One subquery.
- **P1, first-come funding.** Re-run as the entry demanded: the pool sat entirely
  idle with work fully within contract. Owner chose *admission is a standing
  claim*; an entry that funded nothing no longer spends its allocation slot, so a
  later closure can pay it. No migration — and it does not weaken
  `unique (workspace_id, progress_entry_id)`, which `0046` relies on.

Both are covered, and **both covers were verified to fail without the fix**.

### Додаток В

The owner supplied the official ДБН file. All 51 lines of В.1/В.2 are committed,
machine-transcribed, byte-verified. See `TODOS.md` §"M4 prints nothing".

---

## 5. Do this next

**In the order I would take them.**

1. **Two strings finish the act.** `DBN_RETRIEVAL_RECORD` needs the URL the ДБН
   file came from and the date. The hash is recorded. Then M4 prints.
2. **`preflight` into CI** — one line, stops `{{FORM_PROCESSOR}}` reaching a live
   privacy page. `TODOS.md` P1.
3. **Widen `StatutoryActVersionView`** by `work_items.description` and
   `projects.name`: ten blank fields on the act become eight.
4. **The PWA.** This is the big one and it is what stands between the owner and a
   pilot anyone can hold. Nothing below matters as much.

---

## 6. What a customer can touch today, and it is very little

Walked by hand on 2026-08-10 with both servers running.

| ADR-006 step | Screen |
|---|---|
| 1. The object, lines by hand | none |
| 2. The phone, field client | **none — no PWA exists** |
| 3. The refusal | none (enforced in DB and routes) |
| 4. The act | composer only; freeze always refuses |
| 5. The link | **the one real screen** |
| 6. The money | none |

`apps/app` has exactly two pages and both are stubs: `/login` says «UI-форма — у
наступному слайсі», `/context` says the list «завантажується через
/v1/me/context» and loads nothing. No manifest, no service worker, no `public/`.

`apps/demo` is 2482 lines across nine pages with a five-step walkthrough and
**no API calls at all** — a static prototype, honest about itself. Its own QA
passes (10 routes, 18 redirects, 5-step journey, focus trap) *after* `build`; run
`build` first or it fails on a missing `dist`.

`.claude/launch.json` has both servers wired with `autoPort`, so
`preview_start` works without fighting whatever holds 3000 or 5173.

---

## 7. Habits this codebase rewards, learned the hard way here

- **A guard that fires is doing its job.** Four guards in the act suite were
  written to fail on the day Додаток В landed, and said so in their comments.
  When one fires, read what it was written to protect before changing it — and
  assert the ABSENCE of the closed condition rather than deleting the check.
- **Never bend a test to green.** Two suites ordered money allocations by
  `created_at`, which ADR-008 made meaningless when it moved the carve into the
  closure transaction: every row a closure writes shares one `now()`, so the sort
  fell through to a random uuid. The assertions had been passing by luck.
- **Verify the fix fails without itself.** Both money fixes were checked by
  reverting the change and watching the new test go red.
- **Do not compute an expectation the product computes.** `pool * 7 / 10` is
  167991 where the carve lands on 167992, because gross is built from
  independently carved net and tax. Assert against a control instead.
- **Regulatory content is generated, never typed.** `dodatok-v.ts` comes out of
  the CSV and is re-compared every run. The captions mix two apostrophes and
  carry a missing space that its neighbour two lines below has.

---

## 8. Market evidence — unchanged, and still the largest risk

`docs/discovery/validated-assumptions.md`: **0 replies, 0 interviews, 0 named
projects, 0 pilot commitments, 0 willingness-to-pay signals, 0 customer
documents.** The owner has reported several unnamed companies confirming the
problem and photographing work through Telegram; that is recorded as
founder-reported and, by that document's own rule, moves nothing.

The whole build rests on the owner's instruction, not on customer evidence.
ADR-006's authority note says so, and it should stay saying so.

---

## 9. Owner decisions still outstanding

1. **Six capabilities are in no responsibility preset** — `stage_closures.close`,
   `evidence_decisions.decide`, `requirement_exceptions.decide`,
   `progress.adjust`, `readiness.view`, `statutory_acts.compose`. Verified by
   reading `maps_to_capabilities`: not one appears. M3–M6 works in tests and for
   no real persona. The question is which responsibility owns stage closure —
   `internal_verifier` or `foreman`.
2. **The two headline measures have no v0.1 definition.** First-time acceptance
   rate and days-to-signature are defined over claim segments, package versions
   and `commercial_decision`, all v0.2. M6 cannot close without them.
3. **The owning entity for work type** still needs an ADR. The carrier was
   settled as a column (`0050`).
