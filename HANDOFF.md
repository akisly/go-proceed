# Handoff — GoProceed, 2026-08-10 (second session of the day)

Written to be read cold. The previous handoff is the section «What the last
session left» below, compressed; everything else is new.

**Branch:** `claude/handoff-continuation-9607a0`, working tree not yet committed
at the time of writing.
**Base:** the merge of PR #11.

---

## 0. Update — 2026-08-11: the PWA field client landed. §1, §5.1 and §6 below are stale.

This section is the correction; everything below it is the record of the
session that wrote «the field client… is still approved and still not
built» — which was true then and is not true now.

**What changed.** `docs/superpowers/plans/2026-08-10-pwa-field-client.md`'s
eleven tasks are all done: the app shell (`apps/app`'s viewport/manifest/no-
service-worker shell), email-OTP sign-in, «Мої доручення», the obligation
screen (acceptance criterion in the standard's own wording, plus the capture
control), the capture core and its state machine, the `beforeunload` guard
for an at-risk photo (INV-081), and `apps/app/qa/field.mjs` — a puppeteer
pass, in its own CI job (`app-qa`), that drives the whole thing authenticated:
mints a real Supabase Auth user through the local Admin API, signs in through
the real email-OTP form (code read back out of Mailpit), seeds a real
workspace/project/contract/assignment entirely over `/v1`, and asserts on the
real rendered obligation screen — the довідковий disclaimer genuinely
visible (not merely present in the DOM — see that file's own header for a
negative-case correction made while building it), every control at least
44×44 CSS px at 375px, and the unsaved-photo banner up while a capture is in
flight and gone once it resolves.

**Row 2 of §6's table is now wrong** — the PWA field client exists; see the
corrected table there is NOT edited in place (this document keeps its
session-scoped record intact) but the answer as of 2026-08-11 is: yes, a
foreman can sign in and see the obligation screen and use the capture
control, on `apps/app`.

**§5 item 1 ("The PWA") is done.** Current priority order, unchanged from §5
items 2–4 below plus one addition:

1. The six project-plane capabilities in no responsibility preset (§5 item 2
   below) — unchanged, still open.
2. The eight blank Додаток В fields (§5 item 3 below) — unchanged, still open.
3. **NEW — the reference image.** ADR-007 decision 4 names one for the
   obligation screen and it exists in no form (no column, no asset, no
   owner, no licence); the owner decided 2026-08-10 to ship without it. The
   documents disagree about which milestone owns it — ADR-007 decision 4 and
   `glossary.md` say v0.1-M2, `competitive-landscape.md` says v0.3,
   `version-0.1.md`'s own M2 exit-gate list omits it. Recorded as owed in
   `TODOS.md` §"CLOSED 2026-08-10/11 — ADR-007 is implemented"; needs an
   owner decision before anything else about it.
4. The two headline measures (§5 item 4 below) — unchanged, still open.

**Local verification this session (`supabase db reset` fresh, then
`pnpm db:local-credentials`, `pnpm turbo run typecheck`, `pnpm turbo run
build`, `node scripts/validate-canonical-docs.mjs`, `pnpm --filter
@goproceed/demo preflight`, and `cd apps/app && pnpm build && pnpm qa`, plus
`pnpm turbo run test --concurrency=1` — one at a time, per this document's
own §4 warning below, which is still exactly correct and still worth
reading before touching this database from a second shell):** see
`.superpowers/sdd/2026-08-10-pwa-field-client/task-11-report.md` for the
full record, including the two regressions this task's own browser harness
was deliberately made to catch (a disclaimer collapsed into a closed
`<details>`, a shrunk touch target) and reverted before landing.

---

## 1. The one-paragraph version

The previous session left four next steps. **All four are done, and the third
one turned out to be the milestone.** The owner supplied the ДБН download URL;
the file was re-fetched from it and hashed independently, which closed the last
of M4's two render blockers. **`statutory_acts.render` now returns a document,
`statutory_act_versions.freeze` succeeds, and the act renders twice to identical
bytes** — the acceptance walk of `docs/delivery/version-0.1.md` §v0.1-M4 is
performable end to end for the first time. Making it work immediately exposed a
P0 that had been sitting behind the refusal for the whole of v0.1: **every act
would have frozen successfully and then been permanently unrenderable.**

What has not changed: **a customer still cannot click through the pilot.** The
field client from ADR-007 is still approved and still not built. That is now the
single largest item, with nothing ahead of it.

---

## 2. Read these first

| File | Why |
|---|---|
| `TODOS.md` | Everything open. Four entries moved to CLOSED today; one new P0 was opened and closed. |
| `docs/decisions/ADR-007-pilot-field-client.md` | The PWA. **Approved, and not built.** This is the next thing. |
| `docs/product/hidden-works-content-rules.md` | Approved, and restricts at every level including over ADRs. Its §"Open items" first bullet closed today. |
| `docs/decisions/ADR-006-pilot-shaped-v0.1.md` | v0.1 = six steps. Decision 4 is the table set. |

---

## 3. What this session changed

### M4 prints — both blockers closed, and neither was closed by code

TODOS.md's BLOCKER entry carried its own rule: «no slice may close this item with
code, and any change that makes the render succeed without the artifact below is
a regression, not a fix». That held to the end.

- `dodatok_v_field_list_not_committed` closed in the morning (previous session):
  all 51 lines of В.1/В.2 machine-transcribed and byte-verified.
- `dbn_retrieval_record_absent` closed this session. The owner supplied
  `https://e-construction.gov.ua/laws_detail/3879707932224390963` and a direct
  download link. **The bytes were fetched and hashed independently of everything
  the repository had already written down**: 636 603 bytes and
  `sha256=4592eda…`, matching the digest the transcription had been verified
  against. The fetch that «no reviewer could reproduce» has been reproduced.

`DBN_RETRIEVAL_RECORD.url` is the durable `laws_detail` page, **not** the
`files-token` link the bytes actually came from — a signed token link expires,
and a record that stops resolving leaves the tag asserted again, which is the
exact failure the field exists to end. Both URLs are named in the code.

**Neither refusal was deleted.** Both are still derived from the absence of their
datum, so setting the record back to `null` makes the render refuse again with no
other edit. The suites assert the ABSENCE of the two closed codes.

### The P0 that was hiding behind the refusal

**Every act would have frozen and then been permanently unrenderable.** The
freeze rendered the DRAFT view — where `frozen_at` is still null — hashed it into
`content_hash`, and only then wrote `frozen_at = now()`. Додаток В's act date
binds to `frozenAt ?? composedAt` and carries the column it came from in its
provenance, so the hashed document was dated `…composed_at` and the stored row
`…frozen_at`. The next render produced different bytes and refused with
`frozen_content_hash_divergence` — naming nothing, because renderer version and
template hash both matched.

INV-015 makes `frozen` terminal, so there is no correction except a successor
version, which would have done the same thing. Found within minutes of the render
first working, by the acceptance walk's own «render twice and diff the bytes».
The freeze now reads `select now()` before rendering and passes that same value
to the UPDATE.

### The act names the works and the object

Ordinals 6 and 8 of Додаток В printed blank while both facts sat in the database.
**Ten blank fields are now eight.** It was not the two read-only view fields the
last handoff predicted:

- `work_items.description` **is** read live, and safely — a line an act can name
  belongs to a published contract version and `app.guard_work_item()` refuses
  every update to one. Same chain `unit_code` already rides on.
- `projects.name`/`address` **cannot be**. `projects_update` admits any
  `project.admin` at any time, with no trigger and no terminal state. A live read
  would mean that renaming a project destroys every act ever frozen under it.
  Migration **0056** pins them at the freeze, the way a signatory's organisation
  name already is, and `loadActVersionView` branches on `status` rather than
  coalescing — a coalesce would let an address added later start printing into an
  act frozen without one.

The frozen arc had no end-to-end cover when it was written, because no act could
freeze. It has one now: «SURVIVES a rename once frozen» freezes an act, renames
the project, and asserts the document is byte-identical.

### Додаток Н's provenance line, corrected after the merge

Closing the render made a stale sentence customer-facing: every row of the
Додаток Н CSV said «URL/дата/хеш не збережені», which is the `norm_ref_source`
printed inside every decision block. All 12 rows and the constant generated from
them now carry the URL, the date and the hash instead.

**Rows already written keep the old string, and the schema decided that, not
this work.** `requirement_library_items_immutable` and
`requirement_occurrences_immutable` reject every update, so there was no backfill
to perform — and it is the right answer twice over: a citation records what was
cited, and an occurrence's `norm_ref_source` is inside the `content_hash` of
every frozen act, so a backfill would have broken every act ever frozen. That is
migration 0056's failure mode arriving from a second direction, and the tables
were already armed against it.

### The privacy page no longer names a service that does not exist

`/legal/privacy` rendered `{{FORM_PROCESSOR}}` four times, inside `<code>`, in
the sentences naming who processes a visitor's data. The owner chose removal over
a red CI. The three submission states are still disclosed; the third-party one is
described by its ROLE, which is true, rather than by a name this deployment does
not have.

**Only then** did `preflight` go into CI — before `build` in demo-qa. That order
is the point: added while the token was live, the gate would have been
permanently red, which `preflight.mjs`'s own header argues against in terms.

A new hole opened where the old one closed and is covered: setting
`VITE_PILOT_ENDPOINT` would send nine field values to an unnamed processor.
`apps/demo/tests/claims.test.ts` asserts the implication and exercises the
predicate against both sides.

---

## 4. State, measured rather than asserted

On a clean run (`supabase db reset`, `pnpm db:local-credentials`, then ONE
`pnpm turbo run test --concurrency=1`):

- **6 of 6 packages green, 1482 tests.** contracts 104, demo 137, testing 455,
  domain 101, database 7, app 678 across 45 files.
- `pnpm turbo run typecheck` — 10 of 10.
- `pnpm turbo run build` — 3 of 3.
- `node scripts/validate-canonical-docs.mjs` — exit 0.
- `pnpm --filter @goproceed/demo preflight` — exit 0, and now in CI.
- **56 migrations** apply in sequence.

**The trap the last handoff named is real, I hit it, and it is worse than
described.** These suites share ONE local Postgres, and it is not only a second
TEST RUN that breaks them — **any query at all against that database while a
suite is running will do it.** I lost two runs to `deadlock detected` and «Hook
timed out in 10000ms» by doing nothing more than
`select count(*) from public.organizations` in another shell to check whether the
suite was progressing. `truncateAll` takes ACCESS EXCLUSIVE on every table
between test files; a queued ACCESS EXCLUSIVE blocks every reader behind it, and
the hook budget is ten seconds.

The failures land in `purge worker`, `progress.adjust`, `upload_intents` and
`import_batches` — areas unrelated to whatever you changed — with absurd
durations, single tests reporting seventeen minutes. **Before believing a red
apps/app run: check that nothing else touched the database, then re-run.** Do not
probe the database to see how far along it is. Read the vitest output file
instead, or just wait.

---

## 5. Do this next

**In the order I would take them.**

1. **The PWA.** ADR-007, approved and unbuilt. Nothing else is close in value —
   it is what stands between the owner and a pilot anyone can hold. `apps/app`
   still has exactly two stub pages, no manifest, no service worker, no
   `public/`.
2. **The six capabilities in no responsibility preset.** `stage_closures.close`,
   `evidence_decisions.decide`, `requirement_exceptions.decide`,
   `progress.adjust`, `readiness.view`, `statutory_acts.compose`. M3–M6 works in
   tests and for no real persona. This is an owner decision, not a code change —
   the open question is which responsibility owns stage closure.
3. **The eight fields Додаток В still prints blank.** проектна документація,
   матеріали з сертифікатами, відхилення, дати початку/закінчення. Unlike the two
   closed today, **no column anywhere in the data model holds any of them**, so
   each is a schema decision and not a wiring one. The owner's standing decision
   of 2026-08-10 is «fill what the product knows, leave the rest for the hand
   that signs», so this is optional rather than owed.
4. **The two headline measures.** First-time acceptance rate and days-to-signature
   are defined over claim segments, package versions and `commercial_decision`,
   all v0.2. M6 cannot close without them.

---

## 6. What a customer can touch today

Unchanged from the last handoff except step 4, and the change there is real.

| ADR-006 step | Screen |
|---|---|
| 1. The object, lines by hand | none |
| 2. The phone, field client | **none — no PWA exists** |
| 3. The refusal | none (enforced in DB and routes) |
| 4. The act | composer only — but the act now FREEZES and RENDERS through the API |
| 5. The link | the one real screen |
| 6. The money | none |

The act is a document behind an API and not behind a screen. That is a real
change from «M4 ships a composer and no document», and it is not yet something a
customer can click.

---

## 7. Habits this codebase rewards

Carried forward, with one added at the top by today.

- **A refusal that has never stopped refusing is hiding whatever is behind it.**
  Two blockers stood in front of the freeze's date bug for the whole milestone.
  When a long-standing refusal is about to be closed, expect the code behind it
  to have never executed, and write the positive assertions before believing it.
- **A guard that fires is doing its job.** Several tests here were written to fail
  on the day the retrieval record landed, and said so in their comments. Assert
  the ABSENCE of the closed condition rather than deleting the check.
- **Never bend a test to green.**
- **Verify the fix fails without itself.** Migration 0056's constraints were
  checked by reverting them on the live database and watching the new schema test
  go red.
- **Do not compute an expectation the product computes.**
- **Regulatory content is generated, never typed.**
- **A provenance string maintained in step with a record will one day contradict
  it.** `DBN_SINGLE_FETCH_SOURCE` said «URL/дата/хеш не збережені» and became
  false the moment the record landed. It is derived from the record now.

---

## 8. Market evidence — unchanged, and still the largest risk

`docs/discovery/validated-assumptions.md`: **0 replies, 0 interviews, 0 named
projects, 0 pilot commitments, 0 willingness-to-pay signals, 0 customer
documents.** The owner has reported several unnamed companies confirming the
problem and photographing work through Telegram; that is recorded as
founder-reported and, by that document's own rule, moves nothing.

The whole build rests on the owner's instruction, not on customer evidence.
ADR-006's authority note says so, and it should stay saying so.

**M4 shipping a document does not change this.** A document nobody outside this
repository has read is not evidence that the document is the right one — entry
evidence «one signed акт на закриття прихованих робіт from the target workflow,
sanitized» is still owed and still absent (`version-0.1.md` §v0.1-M4).
