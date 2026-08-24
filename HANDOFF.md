# Handoff — GoProceed, 2026-08-10 → 2026-08-17

Written to be read cold. The previous handoff is the section «What the last
session left» below, compressed; everything else is new.

**Everything below §0 is a session record and several of its statements have
since become false.** §0 is the current state. It has been updated five times —
when the field client was built, when it merged, when the seven review residuals
closed, when the six orphaned capabilities and the five PostgreSQL roles were
mapped and renamed, and when the domains followed — and it says which sections
it supersedes.

---

## 0a. Latest: the seven P1 residuals, the six orphaned capabilities, and the GoProceed rename finished end to end. The P0 is untouched and is still first.

Fourteen pieces of work. Each is below, under its own
heading, newest first — and read the P0 warning in §0 whichever you start with:
as of 0a.14 the origin EXISTS and is public, and what the warning still guards
is the §6 evidence and custom SMTP.

---

### 0a.14 — the origin exists, and a person signed in through it: `/login` → code → «Мої доручення»

**The P0 of `TODOS.md` — «NOBODY CAN OPEN IT: there is no origin» — is closed on
2026-08-19, by its own heading's standard, at
`https://goproceed-app.vercel.app`** (attached by the owner that evening; the
`goproceed-app-akislys-projects.vercel.app` alias serves the same deployment).
A Vercel-provided hostname, not a custom domain; `{{APP_HOSTNAME}}` is still a
token, and `vercel.app` cannot carry SPF/DKIM, so the SMTP sending domain is a
separate, still-open decision.

**And the first real sign-in happened, end to end, on the real origin** — the
owner, on a laptop, 20:34 UTC. Read back from the Auth logs and the database,
not from the screen: `user_recovery_requested` → `mail.send` (`mail_type:
magic_link`) → `POST /verify` → `login` with `login_method: otp` →
`auth.users.last_sign_in_at` set, one session, one refresh token. Then, at the
same second, Supavisor: «Connection authenticated … tenant asrvzhjaueyvrfozxpzo,
mode: session, user: goproceed_app_login … Backend authenticated» — the page's
server-side self-fetch to `/v1/projects` reached Postgres through the pooler
with the §3 password and the `.<project-ref>` username, RLS answered an empty
list, and «Мої доручення» rendered its empty state («У вас немає доступу до
жодного проєкту…»), which is the correct screen for a user with no grant.
Every link of the chain the sitting had to get right — origin, proxy, cookie,
key format, pooler username, role password — was exercised by one sign-in.

**Two detours on the way, both the dashboard's.** The first email carried a
magic LINK and no code: the hosted «Magic Link» template is not the repo's
`supabase/templates/magic_link.html` — the docs say «copy the templates into
the Email Templates section of the Dashboard», and until that was done the
client's code-only flow had nothing to type. And one `POST /verify` answered
`otp_expired` before the third code worked. Still open in the dashboard: the
Auth **Site URL** is `http://localhost:3000` (GoTrue's request log names it as
the referrer on every call) — set it to `https://goproceed-app.vercel.app`; the
email rate limit was raised 2→30/h by the owner (the reloader logged it). The owner
merged PR #30, set the two role passwords and the twelve variables, and the
**[correction, 2026-08-20]** an earlier revision of this section said the
20:34 email came «from `noreply@mail.app.supabase.io` — the built-in service,
to a team address». The delivered email's own headers refute that: sent via
`ha.d.sender-sib.com`, DKIM-signed `11932482.brevosend.com` — **Brevo custom
SMTP, which the owner had configured that same evening** (with the template
fix and the rate-limit raise; Brevo rewrites the gmail sender to its
`<account>.brevosend.com` fallback and keeps gmail in Reply-To, which is why
SPF/DKIM align). The `mail.send` log line naming the built-in service must
have been one of the EARLIER sends that evening; the exact minute Brevo went
live could not be re-read because the Supabase logs backend answered
«Backend error» throughout 2026-08-20 afternoon. The consequence that
mattered — «team-addresses-only until SMTP is configured» — was therefore
already lifted on 2026-08-19; the sitting did not know it. Meanwhile the
first production build printed `deploy preflight (VERCEL_ENV=production): OK`.
Then `/` → 307 `/login`, `/login` → 200 with the OTP form, `/assignments` →
307, `/v1/*` → 401 unauthenticated; the client bundle carries the staging
Supabase URL and key and no local value; staging Postgres reads 58/58
migrations, 140 policies, 53/53 RLS, clean.

**One setting stood between the build and the public, and the runbook had
never mentioned it.** A new Vercel project ships with Vercel Authentication
protecting every URL except custom domains — the `*.vercel.app` alias included —
so every path answered 302 to `vercel.com/sso-api`. Read the docs, asked the
owner, changed it to «Only Preview Deployments» on their explicit yes (Previews
are skipped by `ignoreCommand` anyway). Runbook §5 now has the step.

**Two more runbook lines were memory, and both were caught by the owner's
questions.** «What are `<секрет-1>`/`<секрет-2>`?» — the §3 passwords, and §3's
URL shape lacked the `.<project-ref>` suffix the shared pooler routes by
(`goproceed_app_login.<ref>`), now fixed with the docs cited; and «what are the
`EXTERNAL_*` values?» — generated HMAC keys, now explained in §4.3 with the
command.

**What remains, and it is the owner's:** §6.1–6.8 (bearer-token `curl`s), §6.9
(two phones — and before it **custom SMTP**, because Supabase's default email
service refuses any address outside the project's team and allows two messages
an hour; a new P1), and the domain decision. Three small things noted on the
day: `turbo-ignore` is deprecated in favour of Vercel's built-in project
skipping (P3), an `apt-get` hang cost one CI run (P3), and the cron jobs on
staging are `idempotency-purge` and `upload-intent-expiry` — `outbox-drain` is
gone, as 0036 intended.

---

### 0a.13 — every library current, every change read from the vendor first; and the first real Vercel build found the preflight blind

**The rule first, because the rest is its first application.** `CLAUDE.md` now
says: before implementing, configuring or advising on ANY third-party library
or service, read the INSTALLED version, read the CURRENT docs for that version,
name any disagreement explicitly, record the upgrade in `TODOS.md` with its
deadline, and cite version + URL in the commit. It exists because the owner
asked «what is `NEXT_PUBLIC_SUPABASE_ANON_KEY`? the dashboard shows
`…PUBLISHABLE_KEY`» — and the honest answer needed both the installed
`supabase-js 2.47.10` and the 2026 key docs, and memory could supply neither.

**Tier 1 — the one with a deadline.** `supabase-js 2.47.10 → 2.112.3`,
`@supabase/ssr 0.5.2 → 0.12.4` (committed alone, 818/818 + a real OTP sign-in
through the browser pass), then the key family: `NEXT_PUBLIC_SUPABASE_ANON_KEY
→ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY →
SUPABASE_SECRET_KEY`, twelve files, values moved to `sb_publishable_…` /
`sb_secret_…`. Two findings: **the repo was already half on the new format** —
`evidence-storage.ts` and two tests hard-coded `sb_secret_`/`sb_publishable_`
local defaults UNDER THE OLD NAMES, name and value disagreeing for as long as
nobody looked; and **the hosted project accepts both forms today** (measured:
200 on `auth/v1/settings` with either), so an earlier claim in the session that
the new key «would break OTP» was too strong — I had read the SDK's header code,
not the server. The legacy form stops working end-2026; that is the reason to
move, not a present failure. `deploy-preflight.mjs` now **refuses a legacy JWT
pasted into either new variable** — the dashboard shows it right beside the
new key, and a deploy carrying it dies on 2027-01-01 with no earlier symptom.

**Tier 2 — every safe bump, and Next 16.3's deprecation acted on.** react
19.2.8, next 16.3.1, puppeteer 25.8, pg 8.23, turbo 2.10.11, current `@types`
(`@types/node` deliberately **kept at 24.x** — 26.x is Node 26's types and the
runtime is 24; «latest» is not «freshest»). Next 16.3 deprecated the
`middleware` file convention and the build said so; that file is the whole
auth gate, so it was not renamed by hand: the vendor's codemod ran, and the
result was **diffed against the old file with the name normalised — byte-
identical**. `proxy.ts` is live (`ƒ Proxy` in the build), the warning is gone,
the browser pass drives the unauthenticated redirect through it.

**Tier 3 — measured and deliberately NOT done.** zod 3→4 (30 files, 94
`.strict()`, 89 `.uuid()` that tighten, the `ZodError` shape `fieldErrors` is
built on), vitest 3→4 (`vitest.workspace.ts` removed; the serialised timing
against shared Postgres is load-bearing), TypeScript 7 (root 5.9.2 and mobile
6.0.3 already disagree). Each is in `TODOS.md` with blast radius and doc URLs.
Folding one in would have been the scope creep the rule prevents.

*[Update 2026-08-24: **zod 3→4 is DONE**, on the owner's later instruction to
run every library at latest. Two corrections to the estimate above, both worth
carrying: the `.uuid()` tightening was the part that bit hardest — most UUID
literals in this repository are rejected by zod 4's `.uuid()`, so every site is
now `.guid()`, which is what Postgres's own `uuid` column enforces — and
`fieldErrors` turned out not to be built on the `ZodError` shape at all
(`i.path.join(".")` over `issue.path`, unchanged in zod 4 and now pinned by a
test).
**How each class of break was found, since that is the transferable part:**
every TYPE-level break was caught by tsc, loudly, including the `ZodType`
parameter reorder that an earlier draft of this paragraph wrongly called
silent. The `.uuid()` tightening was NOT a type error and the compiler said
nothing about it — the contracts suite did. Measurements and error codes are in
`TODOS.md`'s «three major-version migrations» entry, item 1. vitest 3→4 and
TypeScript 7 remain not done.]*

**Then PR #30's first real Vercel build taught the thing this entry is named
for.** The owner had already set nine runtime variables on the project, and the
preflight reported all nine «unset». Turborepo's default strict env mode hands
the build task ONLY the names `turbo.json` declares; the preflight runs inside
that task as `prebuild`; `turbo.json` declared only the three `NEXT_PUBLIC_*`
names. The same log carried turbo's own warning naming the same nine as «set on
your Vercel project, but missing from turbo.json». Reproduced locally through
the turbo path with all twelve exported — nine false «unset» — then fixed: all
twelve plus `DEPLOY_PREFLIGHT` in `build.env`, as `env` rather than
`passThroughEnv` because the verdict is a function of the values and belongs in
the hash (measured: the hash changes with the value; the run summary records a
SHA-256, never the value). Proved three ways through turbo: passes with twelve,
refuses naming exactly the one removed, refuses a legacy JWT by name. §0a.10
said the preflight was «proved through the real turbo path» — the refusing
cases were; the passing case had only ever been proved with the variables
loaded by `next` itself, which the `prebuild` hook never sees. The coupling is
now written in three places (turbo.json, the preflight header, `.env.example`)
and in the runbook's §4.1 table.

**And CI went red twice in one day for the runner, not the code.** `supabase
start` waited eight minutes for the analytics `vector` container to go healthy
on a docs-only commit; `db reset`'s one-shot migrate container was reported
`exit 125` by the docker CLI — the daemon failing to RUN a container — while
`verify` passed the identical step minutes earlier on another runner. Read the
pinned CLI's source (`legacy-service-catalog.ts` for the `-x` vocabulary,
`restart-services.ts` for «excluded service → not found → tolerated»,
`db-setup.ts` for «the one-shot jobs key on config.toml, not on what runs»):
both jobs now start **five containers, not twelve** — Postgres, Kong, GoTrue,
Mailpit, storage-api, which is everything any suite or the browser pass talks
to (`git grep` finds no `.from(`, no `.channel(`, no `functions/v1`) — and
`db reset` retries once with a `::warning::` so the flake count stays visible.
Proved locally against the exact list in the yml: all six suites (1637 tests)
and the app-qa browser pass (5/5, a real OTP sign-in through Kong → GoTrue →
Mailpit), green on the reduced stack. One thing the proof taught in passing:
`@goproceed/database`'s `pool.ts` THROWS without `APP_DB_URL` where every other
suite defaults to the local URL — so a local `turbo run test` needs the two DB
URLs exported the way CI exports them, or six tests fail with «APP_DB_URL is
not set» and nothing else is wrong.

**Then the owner could not find the toggle the runbook told them to flip, and
the runbook was wrong.** §4.3 said «Settings → Git → uncheck Preview
Deployments». Read the current Vercel docs (project-settings, 2026-07-15;
vercel-json, 2026-06-17): Settings → Git holds the repository connection, LFS,
deploy hooks and verified commits — no such toggle exists, and that line was
written from memory, which is precisely what the rule at the top of this entry
forbids. What exists is Settings → Build and Deployment → Ignored Build Step →
«Only build production» — and `vercel.json`'s `ignoreCommand` OVERRIDES that
dashboard setting, so with `apps/app/vercel.json` carrying one (it did, for
`turbo-ignore`) the dashboard choice would have done nothing. So the rule now
lives where it can take effect: `ignoreCommand` exits 0 («ignore») for every
`VERCEL_ENV` other than `production` and runs `turbo-ignore` only for
Production. Proved with `sh` against the exact string in the file: preview →
0, production → turbo-ignore. A skipped build is CANCELED, not failed, so the
per-push red «Vercel – goproceed-app» check stops; the preflight, the runbook
§4.1/§4.3/§5.3 no longer name the phantom toggle. Building Previews later is
one commit: fill the Preview column AND drop the guard.

**And the owner's screenshot corrected my second reading of the Preview
refusals.** The four `EXTERNAL_*` variables it showed were Sensitive and
scoped to Production AND Preview — so «set for Production only» was wrong for
them. What fits every observation: the names were in the build's environment
(turbo's platform check, which lists platform names absent from the task's
env, stopped listing them once turbo.json declared them) and the values were
empty — and a Sensitive value cannot be read back to check. The preflight now
says, per variable, ABSENT (not set for this environment / not declared in
turbo.json) or PRESENT BUT EMPTY (the name exists with no value — Edit it and
enter one), proved both ways through turbo. The runbook §4.3 now also says
what the four `EXTERNAL_*` values ARE — generated HMAC keys, two different
secrets, `k1:<base64 of 32 random bytes>`, active id `k1` — because the
owner's question was «what is this and where do I get it», and the table had
only a command.

**For the P0 sitting, two variable NAMES changed**, and the Vercel project
still has the old one: rename `SUPABASE_SERVICE_ROLE_KEY → SUPABASE_SECRET_KEY`
(an `sb_secret_…` value), and add `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
(`sb_publishable_…`). The preflight says exactly this when it refuses. **And
check the origin against Settings → Domains before trusting it:** when this
was written the Vercel API listed only `goproceed-app-akislys-projects.vercel.app`
and the `git-main` alias; the owner then attached `goproceed-app.vercel.app`
(2026-08-19, ~20:20 UTC) and it is the canonical origin now — see 0a.14.
`NEXT_PUBLIC_APP_ORIGIN` and `EXTERNAL_LINK_ORIGIN` must be a hostname the
project actually owns, verbatim: `api.ts` self-fetches against it WITH the
session cookie, so a hostname this project does not own is a hostname the
cookie would be sent to.

---

### 0a.12 — the act was unreachable on any real workspace, and it was filed as a P3

**`statutory_acts.compose` — ADR-006 step 4, the акт — could not be called
through the API on any real workspace until today.** Its two mandatory signatory
slots require a `projectPartyId` and a `partyContactId`, the compose route 422s
if either row is missing, and NO route could create either row. M4 was green
only because its fixture inserted them by SQL and said so in capitals: «THE
PARTICIPANT ROWS ARE INSERTED DIRECTLY, AND THAT IS A GAP AND NOT A SHORTCUT.»
The entry tracking this was headed «P3 — dead surface added by the M1
migrations», and its own 2026-08-08 escalation three paragraphs down said what
it actually was. TODOS orders by heading. Re-measured before touching anything;
re-ranked to P1 and closed in the same breath.

**This is the wall you would have hit first after the origin.** Close a
concealed stage, try to print the act, get 422 on `signatories.builder` with no
route anywhere to make it stop.

**Two commands, no migration.** `project_parties.create`
(`POST /v1/projects/{projectId}/parties`, `project.admin`) and
`party_contacts.create` (`POST /v1/parties/{partyId}/contacts`,
`parties.manage`, tightened to `own_legal_profiles.manage` for an own party —
INV-020 — through the same `requirePartyEditCapability` the legal-profile route
uses). **The capability decision the entry said was needed had already been
taken by migration 0010:** `pp_write` requires `project.admin`, `pc_insert`
requires workspace owner/admin, and both routes match their policy exactly.
That is the whole decision, and it needed no new capability, no CHECK widening,
no preset change — `project_manager` and the workspace owner already hold what
the policies ask for.

**The M4 fixture goes through the routes now**, so all 45 M4 tests compose acts
on rows a real member could have created. `signatory-participants.int.test.ts`
(17 cases) covers the refusals — and taught two things worth keeping:

- **RLS hides an ungranted project entirely.** My first draft expected a
  workspace admin with no project grant to get 403; the database answered 404,
  because `projects_select` requires a project grant and to that member the row
  does not exist. That is the STRONGER property. The 403 branch — the route
  matching `pp_write` rather than the policy doing all the work — is reachable
  only by a member who can SEE the project but holds only `project.view`, and
  that is now the case that proves it.
- **The unique constraint's auto-generated name is truncated to 63 bytes**
  (`…party_id_relationsh_key`). A regex on the full name would have silently
  missed it and let the 23505 through as a 500. Measured in the live catalog,
  matched on the prefix, and the 409 test is what keeps it that way.

**One defect the fixture caught before any user could:** both routes built
`ctx` with `organizationId: null` and never passed the resolved workspace to
`recordAudit`, which throws — a 500 on a write that had succeeded. The
`{ organizationId }` override `assignments.create` uses; found on the first
run, fixed before the second.

**Still open and named:** `organizations.default_own_party_id` has no writer
(the other half of that entry — a workspace default, its own small decision);
`party_contacts` still lacks the qualification-certificate columns the content
rules assume, and the contract deliberately refuses them.

---

### 0a.11 — the Supabase CLI is pinned, and the pin moved while it was being chosen

**CI installs exactly `2.115.0` now, and asserts that it did.** Until this it
asked `setup-cli` for `version: latest`: the SHA-pinned ACTION was reproducible
and the TOOL it installed was not. Local ran 2.75.0; CI ran whatever shipped
that morning. §0 above already records what that costs — three red `app-qa` runs
for a magic-link template that a newer CLI default stopped populating, a failure
shaped exactly like a product bug and caused by no commit.

**The number moved during the hour it was being decided.** The CLI's own
upgrade banner said 2.114.0; the releases API said 2.115.0 when I checked
before writing the pin. That is the item's argument, live: the version CI ran
changed between asking the question and answering it, and nothing anywhere
would have recorded that it had.

**The shape, not the number, is the fix.** `.supabase-cli-version` at the root
is the single source, mirroring `.nvmrc`; both CI jobs read it AND assert the
installed CLI matches it, printing both — so «which version failed?» is now
answerable from a red run for the first time; `pnpm db:check-cli` warns
locally on a mismatch (never refuses — a developer's machine is theirs); and the
staging runbook now says which CLI to `db push` with, because pushing 58
migrations to a real project with a version CI has never run means meeting a
CLI-default difference for the first time on staging.

**Local is 2.75.0 and now says so at every `db:local-credentials`.** Upgrade at
your own pace; the warning names the case it exists to explain.

**For the P0 sitting:** run `pnpm db:check-cli` before `supabase link`. If it
warns, `brew upgrade supabase` (or your platform's installer) first. The 58
migrations have been proved against 2.115.0 in CI and against 2.75.0 locally;
they have been proved against nothing else.

---

### 0a.10 — the P0 is prepared to the last credentialed step, and two undocumented variables would have broken the first deploy

**The P0 is still open. A foreman still cannot open the client.** What this
slice did is decide and check in everything the repository CAN decide, so that
provisioning is one sitting of steps that need an account — and so that an
incomplete deploy fails at BUILD with the variable named, instead of at the
first request with a 500.

**Three findings, each of which would have made the first deploy fail or, worse,
fail open:**

1. **`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` were hard requirements that
   `.env.example` never listed.** `src/lib/evidence-storage.ts` reads both and
   DEFAULTS them to the local stack — `127.0.0.1:54321` and the published demo
   key. A deploy that set only the documented variables would have aimed every
   evidence upload at a Supabase that does not exist on the server, and the
   first photo would have been the first symptom.
2. **`NEXT_PUBLIC_APP_ORIGIN` was documented but absent from `turbo.json`'s
   `build.env`.** Turborepo hashes only declared env into the build cache, so a
   redeploy to a DIFFERENT hostname could have replayed a cached bundle with the
   old origin baked in. That is the rebuild trap the P0 note already warned
   about, arriving through the cache rather than the dashboard.
3. **`NODE_ENV` is undefined during a `prebuild` hook** (measured), so a
   preflight cannot key on it. `VERCEL=1` is the honest signal for «this build
   is going to a real origin», and the preflight is scoped to it — CI's `verify`
   and `app-qa` build without an origin deliberately (`qa/field.mjs` names its
   own at `next start` time), and a blanket refusal would have turned both red.

**What is checked in:** `apps/app/vercel.json` (root-relative install/build via
turbo, `turbo-ignore`); `apps/app/scripts/deploy-preflight.mjs` as `prebuild`,
refusing on twelve missing-or-local variables and proved in five modes and
through the real turbo path; the origin in the build-cache key; `.env.example`
as the complete contract split BUILD-TIME/RUNTIME; `infra/README-staging.md`
§4–§6 rewritten against the real config (it described a 5-migration foundation
slice; the chain is 58), with a new §6 step 9 — the field client on a real
phone at the real origin, which is the first moment ADR-007's two required
measurements can be made; `.vercel/` gitignored.

**What remains is the operator's, and it is a short list:** a Supabase project
(§1), two role passwords (§3), a Vercel project with twelve variables (§4.3), a
domain (§0 — still a `{{APP_HOSTNAME}}` token, still undecided; the runbook
forbids inventing one), and two phones (§6.9). The runbook's own Status section
says the same thing in its own words: nothing that needs an account has been
done, and this document being rewritten did not change that.

---

### 0a.9 — `/context` is deleted, because nothing was ever going to open it

**The stub is gone**, along with the QA audit 0a.1 added for it and the screen
counts in `qa/field.mjs` and `globals.css`.

`/context` was foundation-slice scaffolding — `dc59713`, the commit that added
`GET /v1/me/context` — and it never became a screen. **Nothing in the product
linked to it**, and no ADR, spec or design listed it: the field-client design's
own «In» section names exactly three screens, sign-in, «Мої доручення» and the
assignment screen. The one job it could have justified, choosing a workspace, the
architecture does not need — `GET /v1/projects` «takes no workspace or member id
from the caller at all; RLS IS the filter», so «Мої доручення» already spans
everything a session may see. What the route actually did was serve un-themed
Ukrainian placeholder text to anyone who guessed the URL.

**The `/v1/me/context` API is untouched.** It is a real route with real tests,
and `infra/README-staging.md` §6 still verifies staging through it. Only the
page is gone.

*Adding an audit for a page and then deleting the page is not wasted work in the
wrong order. The audit was right while the gap was real — and covering the route
is what finally made someone ask what it was for. The answer to «this stub has no
gate» is sometimes «this stub has no reason», and that question only gets asked
when something forces the stub to be looked at.*

---

### 0a.8 — the capability mapping broke a persona, and its own gate could not see it

**0a.2's mapping shipped a defect and a gate that was blind to it.**
`readiness.view` went onto `commercial_manager` because that preset's own
description named it as the persona's money screen. But all three money reads
call `requireProjectCapability` TWICE — for `readiness.view` AND `project.view` —
and `commercial_manager` had no `project.view`. **The persona could not open the
screen it had just been given the capability for**, and `presetCoherenceErrors`
was green throughout, because rule 1 asks whether a capability is REACHABLE from
some preset and never whether that preset can USE it.

**Reachability is not sufficiency, and the difference had four instances.**
Thirteen routes require two project capabilities; in every one the second is
`project.view`. `requirement_owner`, `internal_verifier`, `package_submitter` and
`commercial_manager` all granted something they could not exercise — and three
are responsibilities that no ui_persona bundles, which was 0a.2's deliberate
choice, so a pilot naming a verifier out of `internal_verifier` would have named
someone who could not decide.

**Fixed as a rule, not as four edits.** `capabilities.csv` gains a `requires`
column; `presetCoherenceErrors` gains a SUFFICIENCY rule. `project.admin`
satisfies `project.view` there because `IMPLIED_BY_PROJECT_ADMIN` makes the ROUTE
accept it — **a gate stricter than the routes it models is a bug in the gate**,
and modelling this one strictly would have failed `project_manager` for no
reason.

**The act coupling is accepted rather than split (owner decision).**
`statutory_acts.compose` governs two POST commands and two GET queries, so read
implies write. Recorded in the capability's own row instead of a route comment
calling it «uncomfortable». No v0.1 persona needs read-only act access —
`pto_engineer` holds it alone and an external reviewer comes through a different
plane — and splitting costs a migration, since the vocabulary is pinned by
`project_access_grants_capability_check`. The successor, `statutory_acts.view`,
should land with the first persona that must read an act without writing one.

**The pattern, now five for five.** Every substantial finding this week has been
a check that could not see what it claimed to cover: a browser gate asserting the
unsaved-photo banner must vanish on the failure it existed to catch; a whole-name
role rule blind to a `LIKE` prefix; case-sensitive greps that produced the
rename's own counts; a probe of an empty table proving zero; and now a
reachability rule mistaken for a sufficiency one. **The code was rarely the
problem. The thing measuring the code was.**

---

### 0a.7 — the least-privilege deviation was understated by forty-nine tables, and its bound was written nowhere

**`goproceed_service` is a member of `goproceed_app`**, deliberately: `0034`
rejected a parallel grant surface because «every future table grant had to be
made twice — a divergence nobody would notice until a policy quietly stopped
applying». `TODOS.md` and `tenancy-and-security.md` both recorded the resulting
deviation and both named ONE table, `evidence_objects`.

**Measured, it is fifty.** Direct grants: two tables
(`readiness_projection`, `blocked_reasons`). Inherited: `select` on 50, `insert`
on 48, `update` on 24, `delete` on 3 — including `capture_events`,
`upload_intents`, `requirement_evidence_decisions`, `statutory_acts` and
`stage_closures`.

**And the bound was in neither document, which is what actually mattered.**
`goproceed_service` is `NOBYPASSRLS`, and `withServiceTx` carries the CALLER's
`app.actor_user_id` into the service transaction rather than clearing it. Every
policy on those fifty tables evaluates against the acting member, so the service
connection sees exactly the rows that member could already see. **The grant is
wide; the reach is not.** Written down as it was, the entry read as an unbounded
read of every tenant's evidence — which would have been a far more serious
finding than the real one.

**Not narrowed, and that is the decision.** Removing the membership is precisely
the parallel grant surface `0034` argued against, and that argument still holds.
Recorded as accepted-and-bounded rather than left as pending work. The successor
is the per-workload `NOLOGIN` worker roles the Workers section of
`tenancy-and-security.md` already describes — v0.2, with its own deployment
story.

**A methodological note worth more than the finding.** My first probe of the
bound queried `evidence_objects` as a stranger, got zero rows, and proved
NOTHING: the table was empty. The test that ships runs after the suite has
created a real evidence row and carries a positive control (entitled actor sees
1) beside the negative (stranger sees 0), and I proved it non-vacuous by granting
`BYPASSRLS` and watching the stranger case turn red. An assertion about an empty
table is the quietest way to be wrong, and it is the third time this session that
the check, not the code, was the thing at fault.

---

### 0a.6 — a TRUNCATE-shaped hole under most of the evidence chain, and it was never granted

**Migration `0058`.** `TODOS.md` carried this as a P2 about ONE table
(`outbox_dead_letters`). Measured, it was **19 of 19**: every append-only or
immutable trigger in `public` is `BEFORE UPDATE OR DELETE ... FOR EACH ROW`
(`tgtype = 27`, no TRUNCATE bit), so the same hole sat under `audit_events`,
`evidence_objects`, `statutory_acts`, `stage_closures`,
`requirement_evidence_decisions` and fourteen more — most of the evidence chain,
not a dead-letter table. RLS does not gate TRUNCATE either.

**Nobody granted it, which is the part worth carrying.** There is no `grant
truncate` anywhere in the migration chain. It arrives from a default ACL the
Supabase image installs (`pg_default_acl`, schema `public`, grantor `postgres`,
`service_role=arwdDxtm` — `D` is TRUNCATE), so all **53** tables in `public`
acquired it silently at creation, and every table a future migration adds would
have too. **A privilege can enter this schema without any migration mentioning
it.** That is worth remembering the next time a grant is reasoned about from the
migration text alone.

**The entry's prescribed fix — «on its own terms, not as a grant tweak», i.e. a
trigger — was unimplementable and would have bought nothing.** TRUNCATE triggers
must be `FOR EACH STATEMENT`, and `truncateAll` truncates `public.audit_events
... cascade` between test files as the owner: a refusing trigger fails every
run, and the only way back is `session_replication_role = replica`, which
disables ALL triggers — a wider hole than the one being closed. A trigger also
cannot constrain the table's owner, who can drop it. Once you measure who
actually holds the privilege, revoking is the COMPLETE fix for every principal
that is not already the database owner.

**One correction I made mid-investigation, since the wrong number is the more
alarming one:** an intermediate query of mine omitted the schema and appeared to
show `anon` and `authenticated` holding TRUNCATE on five tables each. Filtered
properly, they hold **none in `public`** — those rows are platform `storage` and
`supabase_functions` tables. In `public` the only non-owner holder was
`service_role`.

`packages/testing/src/truncate-privilege.test.ts` asserts the invariant over the
whole schema rather than a list — a list is what let this happen — and proves
the forward half by creating a table and checking what it inherits. Both halves
were shown to fail without the migration.

**Still open in this area:** `goproceed_service` inherits SELECT on
`evidence_objects` through its membership in `goproceed_app` (verified
2026-08-18), while `tenancy-and-security.md:338` says an upload finalizer
«cannot review evidence». That is a genuine least-privilege deviation and its
own decision — the membership was granted deliberately by `0034`.

---

### 0a.5 — the rename is finished, and README's «do not overclaim» section was overclaiming

**Every runtime identifier now says GoProceed**, and the gate is a whole-brand
ban rather than a list: `staleBrandErrors` fails the build on `aktflow` in any
case in any live file. That rule could not be written until the rename was
actually done, which is why it arrives last.

**The scans that produced this entry's counts were all case-sensitive.** Every
`aktflow` grep in `TODOS.md`, mine included, was lower-case — so `AktFlow`
survived in `scripts/validate_package.py`'s own PASS/FAILED output, in
`technical/terminology.csv`'s Ukrainian terms («Оплата AktFlow»), and in the
title of `.interface-design/system.md`, a file whose second line calls it «source
of truth for every rewritten `/app/**` route». The lesson is the same one three
times over now: **the rule was narrower than the sentence describing it.** The
whole-brand ban is the answer to that, not another enumeration.

**`README.md`'s «Actual state (do not overclaim)» section said the five
PostgreSQL roles and the user-visible copy «have not moved, and each is its own
later slice».** Both had moved — the copy on 2026-08-10, the roles on
2026-08-17. A stale claim in the section named for not overclaiming is the
sharpest form of the failure this repository keeps finding, and it is corrected
with the dates.

**What deliberately keeps the old name, each argued at the gate's call site:**
`technical/openapi.yaml` and `technical/schema.sql` — the v2.9 target package
`README.md` itself calls historical, which keeps «AktFlow API» and
`LicenseRef-AktFlow-Proprietary` because a licence identifier is not a branding
string to flip and renaming a record makes it describe a package that never
existed; `prototype/` and `design-references/`, frozen and out of scope;
`docs/22-data-api-contract.md`, self-declared HISTORICAL / NON-NORMATIVE; the
pilot-draft migration constant and its test, exempt by exact LINE so those files
are still checked for every other spelling; and any line that is explicitly
historical, now allowed in `.sql` and `.md` alike rather than only under
`docs/`.

**One operational note worth keeping.** `supabase/config.toml`'s `project_id` is
`goproceed` now, and `supabase stop` reads that value to find the containers — so
a stack must be stopped BEFORE pulling this change. Editing first leaves the old
containers running and unreachable by the CLI, and `supabase start` builds a
second stack beside them. The recovery is in the config file, above the value.

---

### 0a.4 — the runbook was telling the operator to provision the wrong product's domain

**`infra/README-staging.md` — the document you follow to DO the P0 — spelled the
pre-rename hostnames in nine places**, including every `curl` of its §6
verification checklist and the Supabase project name in §1. An operator
following it would have bound DNS and a Vercel domain to a product that no
longer exists, at the one moment where that is expensive to undo.

`TODOS.md`'s rename entry had said the domains «will cost exactly the same after
staging exists». That was wrong for this one: it is not a later cost, it is a
defect sitting on the next thing you do.

**They are placeholder tokens now, not corrected literals** — `{{APP_HOSTNAME}}`
and `{{LANDING_HOSTNAME}}`, matching the `{{CONTACT_EMAIL}}` /
`{{DEMO_HOSTNAME}}` convention already here, defined in a new §0 of the runbook.
No domain for this product is recorded anywhere as registered, and
`apps/demo/README.md` §2 forbids inventing one; a plausible `goproceed.com`
would have read as settled fact. **There is deliberately no CI gate on those
tokens** — they are instructions to a human, and an unreplaced token in an
instruction is the instruction working. What is gated is the reverse:
`staleDomainErrors` fails the build if an old domain returns to a live file.

**A SILENT REGRESSION FROM 0a.3, found here rather than by that slice.**
`scripts/snapshot-db-catalog.mjs` selected roles with `rolname like 'aktflow%'`.
After migration `0057` that query still SUCCEEDS and still returns
`anon`/`authenticated`/`service_role` — it simply returns no project roles, so
`pnpm db:catalog-snapshot` produced a snapshot missing the five rows a reviewer
reads to see who can log in and who bypasses RLS. Nothing failed, and the guard
0a.3 added could not see it: it matched whole identifiers, and this was a LIKE
prefix written to match them as a set. It matches `aktflow%` now.

*That is the third time in two days a guard turned out to be checking a
narrower thing than the sentence describing it. It is worth expecting.*

**The pilot draft key was a data migration, not a substitution.**
`goproceed.pilot.draft` now, with the old key read once and moved forward on
load — renaming it outright would have shown an empty form to a contractor who
typed three free-text answers and came back after the deploy, which
`draft.ts`'s own header calls «unrecoverable». `/legal` discloses the key to the
visitor by name, so it can only be truthful about one; `Legal.tsx` now imports
the constant rather than re-declaring it under a comment saying the two «must
never disagree».

**What is left of the rename**, and it is the last of it: the catalog
identifiers (`aktflow_platform_billing`, `aktflow_external`, `aktflow_support`,
`aktflow_audit_writer`, and the `aktflow_control` / `aktflow_requirement` column
headers) plus `supabase/config.toml`'s local `project_id`. None is a live
PostgreSQL role — they are planned-role rows and column names, so renaming them
changes a catalog's shape rather than a runtime identifier.

---

### 0a.3 — the five PostgreSQL roles are renamed, and the window for it has closed behind us

**`aktflow_app`, `aktflow_app_login`, `aktflow_worker`, `aktflow_service` and
`aktflow_service_login` are now `goproceed_*`** (migration `0057`). This was the
last runtime identifier still carrying the old product name.

**The reason it is worth reading rather than just noting: it was landed because
the P0 has NOT been done.** `TODOS.md` had held the roles back with a stated
argument — «a role rename clears an md5-hashed password, every connection string
and CI secret has to move in the same window, and the rename must land in a
migration that runs against an environment whose app is already connecting under
the old name». Every clause of that describes a DEPLOYED environment, and there
is none: staging has never been provisioned, so the only databases that have run
this chain are local and CI's, both rebuilt every run. **The rename was free
today and becomes exactly that deployment-ordering problem on the day the origin
is provisioned.** If the ordering had been the other way round, this would have
cost a coordinated password reset, every connection string and every CI secret in
one window, with a rollback story.

**Two of that argument's three technical claims were also false on this stack**,
measured in a rolled-back transaction before the migration was written:
`password_encryption` is `scram-sha-256`, so no password is cleared; and 137 RLS
policies and 126 table grants followed the rename automatically, because
`pg_policy.polroles` and ACLs hold OIDs rather than names. Only the third claim
held, and it was satisfied by moving the runtime in the same commit.

**THE ONE THING THAT PROBE DID NOT COVER, AND THE MOST USEFUL THING HERE.**
`0057`'s first draft said it «renames and does nothing else». That was wrong,
and the test suite is what said so — six tests in `m2-binding-hardening` and
`m2-service-principal` failing at once with `role "aktflow_service" does not
exist`. `app.finalize_upload_intent` (migration `0035`) guards on
`pg_has_role(session_user, 'aktflow_service', 'member')`: a role name stored as
TEXT inside `prosrc`, which is not a dependency the catalog tracks, so the
rename left it pointing at nothing and every server-side finalize raised. It
fails closed — but the entire evidence path was down.

`0057` rewrites function bodies and object comments as well now, by SEARCHING
the catalog rather than naming the objects this tree happens to contain, and
asserts afterward that neither kind is left. The catalog was then swept for
every other place a name can hide as text — policy expressions, check
constraints, defaults, views, rules, trigger definitions, cron commands, default
ACLs, event triggers, per-role settings — all zero.

*A probe that measures the mechanism you thought of is not evidence about the
mechanisms you did not. The rolled-back transaction proved OIDs follow a rename,
which was true and remains true, and said nothing whatever about the one
reference that was not an OID.*

**The 40 files under `supabase/migrations/` still say `aktflow_*`, on purpose.**
Editing them would have left a textually clean tree; it was refused because a
migration is history here, and history should say what happened. A fresh
`db reset` creates the old names in `0003`/`0034` and renames them in `0057`.

**`staleRoleNameErrors` keeps them gone** — it walks every tracked file and fails
the build on any of the five old names outside a record directory. It also fixed
the branding validator's own comment, which asserted the roles «are not being
renamed» while excusing them from the branding rule.

**Not folded in, and named rather than dropped:** the four `aktflow.*` domains,
the two `AKTFLOW_*` env vars, and the documents mentioning `aktflow` in non-role
forms. None shares the closing window the roles had; they cost the same later.

> **The last sentence was wrong about the domains, and §0a.4 above is the
> correction.** One of them was on the P0's own path: the staging runbook spelled
> the pre-rename hostnames in nine places, so following it would have provisioned
> a domain for a product that no longer exists. That is not a later cost. The
> domains and env vars closed 2026-08-18.

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
