# Handoff — GoProceed, 2026-08-10 → 2026-08-17

Written to be read cold. The previous handoff is the section «What the last
session left» below, compressed; everything else is new.

**Everything below §0 is a session record and several of its statements have
since become false.** §0 is the current state. It has been updated three times —
once when the field client was built, once when it merged, once when the seven
review residuals were closed — and it says which sections it supersedes.

---

## 0a. Latest — 2026-08-17: the seven P1 residuals AND the six orphaned capabilities are closed. The P0 is untouched and is still first.

Two pieces of work, in two PRs. The second is below the first, under its own
heading — read both, and read the P0 warning in §0 either way.

---

### 0a.2 — the six orphaned capabilities now have a persona, and a gate

**What was wrong.** Six v0.1 project-plane capabilities —
`stage_closures.close`, `evidence_decisions.decide`,
`requirement_exceptions.decide`, `progress.adjust`, `readiness.view`,
`statutory_acts.compose` — were in no preset for the whole of M3–M6. Every
route built, every invariant enforced, every suite green, and no named persona
could invoke any of them. The suites granted them by hand, which is the shape of
a gap a fixture hides, and it was the third recurrence of one finding.

**The mapping** (owner decisions, taken against the invariants rather than an
org chart): `progress.adjust` → `progress_recorder` + `foreman`;
`readiness.view` → `pto_engineer` + `commercial_manager`;
`statutory_acts.compose` and `stage_closures.close` → `pto_engineer`;
`evidence_decisions.decide` → `internal_verifier`;
`requirement_exceptions.decide` → `requirement_owner`. The last two are on
responsibilities that **no v0.1 persona bundles**, deliberately.

**The finding worth carrying.** `TODOS.md`'s own entry had warned that
`stage_closures.close` «should not land on the same persona as
`evidence_decisions.decide`» — and it named one capability too few. An
occurrence becomes satisfied TWO ways: `readiness.ts`'s `satisfiedFor()` counts
a current `waiver` or `accept_risk` head exactly as it counts an accepting
decision, and INV-063 keeps both available even on a `hold`. So
`requirement_exceptions.decide` is a second route past `can_close_stage`, and
bundling it with the closure is the same hazard — with INV-069 silent, because
the closer never captured anything. **A draft of this change put it on
`pto_engineer` and was withdrawn for exactly that reason.** `readiness.ts:407`
had already been reasoning from «The CLOSER holds `stage_closures.close` and
need not hold either» — an assumption about a CSV that nothing validated.

So `pto_engineer` closes the stage and composes the act it pins (INV-084) and
holds **neither** way of satisfying an occurrence.

**The gate is the durable half.** `validate-canonical-docs.mjs` held
`responsibility-presets.csv` to EXISTENCE only, which is how six went orphaned
for four milestones with everything green. `presetCoherenceErrors` enforces
reachability, resolvability, plane discipline and that separation of duties, and
its exemption set is empty.

*Plane discipline was measured, not guessed: the first draft required a preset
for every v0.1 capability and produced 13 false positives — workspace
capabilities come from the governance role, service from the service principal's
login, external from a bearer grant held by a non-member, and none of the three
is expressible as a preset.*

**Seventeen stale claims swept with it** — every `*_PRESET_GAP` constant and
every comment asserting one of the six «is in no responsibility preset», across
four routes, nine suites, two fixtures and the progress document. **Two were
already wrong before this change**: `rule_bindings.manage` had been in two
presets since 2026-08-07 and `packages.submit` since 2026-08-08. Same lesson as
0a.1's items 4 and 6, from a different direction — a recorded claim decays, and
nothing here was checking.

---

### 0a.1 — the seven field-client review residuals

**Nothing in this section changes the P0.** `apps/app` still has no deployed
origin, a foreman still cannot open it, and everything §0 below says about that
is exactly as true as when it was written. This session did the only unblocked
engineering work there was: **every other item in §0's priority list needs an
owner decision or the owner's Vercel/Supabase credentials.** That is worth
noticing on its own — the repository's queue is now owner-blocked almost end to
end.

**What closed.** All seven of `TODOS.md`'s «P1 — seven residuals from the
field-client final review». That entry now carries the full account per item;
the three findings worth carrying into the next session are here.

**1. A green gate was defending a defect.** `invariant-catalog.csv:82` requires
the unsaved-photo warning on «every failed or abandoned in-flight upload». The
banner was gated on `holdsUnsavedBytes`, which excludes `failed` — so a failed
upload took the banner down and left the route's `detail` string in its place. A
server `detail` (a storage quota, a media-policy refusal) says why a request was
refused and nothing about a photo being lost; only the `GENERIC_FAILURE`
fallback mentions the photo, which is why this looked correct for as long as the
server stayed quiet. **`qa/field.mjs` drove that precise failure — with a
`detail` — and asserted the banner MUST have cleared.** The harness that existed
to prove INV-081 was pinning its violation. The owner's call was to widen the
banner rather than narrow the row, so the invariant is now true rather than
smaller; the fix is a second predicate (`serverDoesNotHaveThePhoto`) because the
unload prompt must NOT follow the banner into `failed`, where the bytes have
already left the closure.

**2. Two of the seven parked items were recorded WRONG, and both had been
adjudicated on the description rather than on the behaviour.**

- Item 6 said a bracketless `Host: ::1` passes the allowlist and then makes
  `new URL` throw. It does not and never did: the port-strip regex matches the
  trailing `:1` and normalises `::1` to `":"`, which is refused with the error
  that names the remedy. The real defect was the inverse — a
  `hostname === "::1"` arm unreachable from the day it was written, while the
  comment above it advertised the spelling as accepted.
- Item 4's proposed fix — refuse when `NODE_ENV === "production"` — would have
  turned the `app-qa` job red, because `qa/field.mjs` runs `next start`, which
  IS production, on a loopback port with no origin set. The harness now names
  its own origin instead, which is strictly better: the browser pass exercises
  the branch a real deployment takes rather than a developer fallback no
  deployment may use.

  **The lesson generalises past these two:** a parked item's description is a
  hypothesis, and re-measuring it costs less than the work it describes.

**3. Two facts about `NEXT_PUBLIC_APP_ORIGIN`, measured against `.next/server`
output, that the P0 will need.** A value **present** at build is inlined as a
literal and beats the runtime environment — that is the documented rebuild
requirement. A value **absent** at build survives, on the server only, as a real
runtime `process.env` read. So a runtime-only value appears to work on a build
that never had one and silently does nothing on a build that did, which is a
debugging trap sitting directly on the P0's path. `TODOS.md`'s P0 note said only
the first half and now says both.

**Also closed, and smaller:** the 429 split that had landed on the send path
only (a foreman rate-limited at the VERIFY step was told the correct code he was
reading off his phone was wrong); the missing `a` reset, which turned each
obligation row purple as a foreman worked down his list, and which now has the
gate `TODOS.md` said it lacked; `/context`, which had no audit at all rather
than merely no overflow gate; and a dated header on the plan document naming its
three superseded sections.

**Still open and NOT closed by this session:** `/context` is still a two-line
stub with an inline `style={{ padding: 32 }}` and none of the design system. The
new audit holds it to the floor any served route must meet; it does not make it
a screen. Building it is owed a decision.

**Verified locally on 2026-08-17**, on a fresh `supabase db reset` followed by
`pnpm db:local-credentials`, running one thing at a time per §4 below:

- `pnpm turbo run typecheck` — **10 of 10**.
- `pnpm turbo run test --concurrency=1` — **6 of 6 packages green**, 7m37s.
  apps/app alone: **801 tests across 57 files** (678/45 when §4 was written; the
  difference is this branch's new tests plus everything added since that run).
- `pnpm turbo run build` — **3 of 3**.
- `node scripts/validate-canonical-docs.mjs` — exit 0.
- `pnpm --filter @goproceed/demo preflight` — exit 0.
- `cd apps/app && pnpm qa` — **6 of 6 audits, zero findings** (`context screen`
  is the sixth), and the run left no tracked file modified.

**Both new gates were proved to fail without their fix, not merely to pass with
it** — the habit §7 names, applied here because this session's central finding
was a green gate defending a defect. Reverting the banner to `holdsUnsavedBytes`
and deleting the `a` reset, then rebuilding and re-running `pnpm qa`, produces
exactly two findings and no others:

```
/ @375: anchor "Приклад-улаштування прокладки кабелю QAм" (href=/a/fef2a39b-…)
  renders with user-agent link styling — color rgb(0, 0, 238), text-decoration
  underline; app/globals.css's `a` reset has been lost
capture pass: the unsaved-photo banner ("GoProceed не зберіг це фото…") is gone
  after the upload FAILED — invariant-catalog.csv:82 requires it on every failed
  upload, and this stub supplies a server `detail` that says nothing about the
  photo being lost
```

That first line is also the plainest evidence the anchor item was misfiled as «a
design decision rather than a bug»: it is a real obligation row, on the screen a
foreman lands on, rendering in the user agent's link blue.

---

## 0. Current state — 2026-08-17: the field client is MERGED, and reachable by nobody. §1, §5.1 and §6 below are stale.

**Merged.** [PR #14](https://github.com/akisly/go-proceed/pull/14) landed on
`main` as `0880214`, and CI on `main` is green — `verify`, `demo-qa`,
`package-validate` and the new `app-qa` browser job. The three PRs before it
(#12, #13, #14) are all in.

This section is the correction; everything below it is the record of the
sessions that wrote «the field client… is still approved and still not
built» — which was true then and is not true now.

**READ THIS BEFORE ANYTHING ELSE IN THIS SECTION.** The client is merged and
green in CI. **There is no deployed origin for `apps/app`, so a foreman still
cannot open it.** Merging changed nothing about that: no `vercel.json` for the
app, no deploy step in `.github/workflows/ci.yml`, and `infra/README-staging.md`
still records that staging has never been provisioned. The only Vercel project
in this repository builds `apps/demo`. The implementation plan says the same
thing in its own words — «none of them puts the client in a foreman's hand».

An earlier version of this section, and of `TODOS.md`'s matching entry, declared
the pilot unblocked and did not mention this at all; both were corrected on
2026-08-11 by the final whole-branch review. In a repository whose documents are
read cold as the source of truth, that omission is the failure class this project
cares most about, which is why it sits above everything else here — and why it is
repeated now that «merged» makes it easier than ever to assume otherwise. It is
`TODOS.md`'s first P0, with its own heading.

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

**Row 2 of §6's table is now wrong** — the PWA field client exists. **That
table is NOT edited in place** (this document keeps its session-scoped record
intact); the answer as of 2026-08-11 is: yes, the sign-in, «Мої доручення»,
the obligation screen and the capture control are built and work, on
`apps/app`, **when it is run locally** — and no, a foreman cannot reach any of
it, because nothing serves `apps/app` on the public internet.

**§5 item 1 ("The PWA") is BUILT, not delivered.** Current priority order, §5
items 2–4 below plus two additions, the first of which now outranks
everything:

1. **NEW, AND FIRST — provision an HTTPS origin for `apps/app`.** Nothing
   below it can be pilot-tested by a real person until this exists: no
   `vercel.json` for the app, no CI deploy step, staging never provisioned.
   Two things wait specifically on it:
   - **ADR-007's two required measurements** — how each engine handles EXIF
     and the `capture` attribute, and the storage-eviction rule. Both need
     real devices against a real origin (ADR-007 §"What must be measured, not
     assumed", §"Also to be measured, not assumed"). The decision stands
     either way; the claims this client may print do not.
   - **`crypto.subtle` needs a secure context** for the content hash.
     `localhost` qualifies, so local work and the CI browser pass are fine,
     and nothing else is.
   When it is provisioned, set `NEXT_PUBLIC_APP_ORIGIN` to that origin.
   `src/lib/api.ts` refuses to self-fetch with the session cookie against any
   non-loopback host it has not been told to trust, so the app will render its
   error screen until this is set.
2. The six project-plane capabilities in no responsibility preset (§5 item 2
   below) — unchanged, still open.
3. The eight blank Додаток В fields (§5 item 3 below) — unchanged, still open.
4. **NEW — the reference image.** ADR-007 decision 4 names one for the
   obligation screen and it exists in no form (no column, no asset, no
   owner, no licence); the owner decided 2026-08-10 to ship without it. The
   documents disagree about which milestone owns it — ADR-007 decision 4 and
   `glossary.md` say v0.1-M2, `competitive-landscape.md` says v0.3,
   `version-0.1.md`'s own M2 exit-gate list omits it. Recorded as owed in
   `TODOS.md` §"CLOSED 2026-08-10/11 — ADR-007 is implemented"; needs an
   owner decision before anything else about it.
5. The two headline measures (§5 item 4 below) — unchanged, still open.

**Local verification this session (`supabase db reset` fresh, then
`pnpm db:local-credentials`, `pnpm turbo run typecheck`, `pnpm turbo run
build`, `node scripts/validate-canonical-docs.mjs`, `pnpm --filter
@goproceed/demo preflight`, and `cd apps/app && pnpm build && pnpm qa`, plus
`pnpm turbo run test --concurrency=1` — one at a time, per this document's
own §4 warning below, which is still exactly correct and still worth
reading before touching this database from a second shell):** the SDD workspace
that held the per-task reports was deleted when the branch finished, as that
process prescribes — the record is the git history now, and the branch's
commit messages carry the reasoning.

**`supabase/templates/magic_link.html` exists because of CI, and the reason is
worth thirty seconds of your time before you touch it.** `app-qa` passed locally
and failed on CI three times running, for three different real causes, none of
which was sufficient alone:

1. The harness read the OTP out of Mailpit's list-endpoint `Snippet`. CI resolves
   `supabase/setup-cli@… version: latest` and pulled Mailpit v1.30.2; the local
   CLI (2.75.0) runs v1.22.3. Different build, different shape.
2. The relaxed fallback that replaced it — a bare six-digit scan — matched digits
   *inside the magic link's PKCE token*, which is ~62 % numeric, before it
   reached the real code. Measured at 2 failures in 5 runs; 20/20 after.
3. **And then the real one: CI's email contained no six-digit code at all.** The
   CLI's default magic-link template had stopped carrying `{{ .Token }}`. No
   parser can read a code that was never sent.

So the template is pinned in this repository via
`[auth.email.template.magic_link]` → `content_path`, which makes local and CI
identical and immune to the next default change. **The general lesson, which
applies well beyond email:** this repository's local stack and CI run different
Supabase CLI versions, so anything you rely on that comes from a CLI *default*
rather than from `supabase/config.toml` can differ between them — and will
surface as a CI-only failure shaped like a product bug. The first round's fix
was to make the harness say which of three failures it actually hit; that
diagnostic is what turned round three into one log read instead of another guess,
and it is the part most worth preserving.

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
| `TODOS.md` | Everything open. **Start at its first P0 — «the field client is built and NOBODY CAN OPEN IT».** Four entries moved to CLOSED on 2026-08-10; one P0 was opened and closed the same day. |
| `docs/decisions/ADR-007-pilot-field-client.md` | The PWA. Was «approved, and not built» when this table was written; **as of 2026-08-17 it is built, merged, and served nowhere** — see §0 above, which supersedes this row. |
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
