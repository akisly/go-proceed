# GoProceed — rules for coding agents

These rules apply to every coding agent working in this repository, whatever host it runs in. `CLAUDE.md` imports this file; Codex reads it directly.

Read [START_HERE.md](START_HERE.md) before your first change. `apps/app/AGENTS.md`, `apps/landing/AGENTS.md` and `apps/mobile/AGENTS.md` add rules for their own trees.

Read files before you change them, and preserve edits made by others. Current user instructions and host policy stay authoritative.

## Development roles

- **Where the roles live.** The canonical sources are in `agents/`. The profiles in `.claude/agents/` and `.codex/agents/` are generated from them: regenerate with `python3 scripts/sync-agents.py --write`, and never edit the generated files by hand.
- **Which roles to use.** Use the project roles `gp-*`. Do not use similarly named global agents: they do not carry this repository's invariants.
- **Other workflows.** Globally installed skill packs that define their own development process are not part of this repository's workflow.
- **Delegation.** Only the coordinator delegates; specialists never spawn other agents.
- **Procedure.** [agents/COORDINATION.md](agents/COORDINATION.md) sets out the coordination procedure, routes and task states. [agents/PLAYBOOKS.md](agents/PLAYBOOKS.md) walks through the common routes.

## Required independent review

This applies to every behavior change, even when the request does not mention agents.

### What counts as a behavior change

A behavior change is a change to any of these:

- **Code:** executed code under `apps/`, `packages/` or `scripts/`.
- **Supabase:** anything under `supabase/` — migrations, RLS policies, grants, functions, templates, `config.toml`, `seed.sql`.
- **Catalogs:** machine-readable files under `technical/` that tests or `scripts/validate-canonical-docs.mjs` read.
- **Tokens:** `packages/tokens/src/tokens.json` and every file generated from it.
- **Build, runtime and CI configuration:** `.github/workflows/`, `turbo.json`, `package.json`, `pnpm-lock.yaml`, `next.config.*`, `app.json`, `eas.json`, and every `.env.example`.
- **Tool-directive comments:** `eslint-disable`, `@ts-expect-error`, `@ts-ignore`.
- **Agent instructions:**
  - `agents/` and the generated `.claude/agents/` and `.codex/agents/`;
  - `.claude/settings.json`;
  - every `AGENTS.md` and `CLAUDE.md`;
  - `START_HERE.md`;
  - `docs/design/02-building-ui.md`;
  - any other text that decides when agents run or what they check.

Only other prose documentation and plain comments are exempt.

### Who runs the stages

The primary session is the coordinator. It implements the change itself, or delegates a bounded slice to `gp-implementer`. It then starts every stage below itself, without waiting to be asked, as an independent subagent (in Claude Code, with the Agent tool). A subagent never starts a stage.

| Stage | When it runs | What it works from |
|---|---|---|
| `gp-architect` | Before implementing a change to a table, constraint or migration; an RLS policy, grant, `SECURITY DEFINER` function or database role; a `/v1` or `/external` contract or error code; a state, transition, capability, preset or event catalog; an outbox, worker, retention or erasure job; or the Telegram channel workflow | The task and the affected paths |
| `gp-mobile` | Before design or review, when the change involves the field client's installation, offline or capture behaviour or encrypted local vault, `apps/mobile`, signing, store or OTA distribution, or physical-device behaviour | The task and the affected paths |
| `gp-reviewer` | **Always** | The implementation diff file (below) |
| `gp-security` | When a security trigger (below) applies | The same diff file |
| `gp-ui-reviewer` | When the change touches `apps/landing`, `apps/app/app`, `apps/app/src/components`, `apps/mobile/src`, `packages/ui`, `packages/tokens` or `technical/copy-catalog.csv` | The diff, the pasted output of the §5 gate in `docs/design/02-building-ui.md`, and the §6 screenshots |
| `gp-qa` | **Always**, on the final revision, once review findings are resolved | The confirmed fixes, the checks it can run, and evidence the coordinator gathered (for example a browser pass) |

**Security triggers.** `gp-security` reviews the diff when the change touches any of these:

- RLS, grants, `SECURITY DEFINER` functions or database roles;
- Supabase Auth, sessions, the proxy, or auth email templates;
- external capability links or HMAC keys;
- evidence storage, signed URLs or uploads;
- the Telegram webhook, bot tokens or identity erasure;
- `apps/landing` `/api/pilot`;
- application environment variables (`.env*`, `NEXT_PUBLIC_*`, hosted secrets) or secrets;
- CI permissions or action pins;
- retention and deletion of personal data.

**The diff file.** Review roles have no shell. Build the diff with `git diff <base>`, plus `git diff --no-index /dev/null <file>` for each untracked file; this leaves the index untouched. Supply it with the base commit and `git status`.

**What QA returns.** `gp-qa` confirms each finding's stated fix is in place and runs the checks it can. It returns PASS, FAIL or NOT RUN for each acceptance criterion. A skipped suite is NOT RUN, and a required NOT RUN blocks done.

### Records, rework and escalation

- **Records.** Every behavior change gets a task record under [docs/tasks/](docs/tasks/README.md), made from [agents/TASK_TEMPLATE.md](agents/TASK_TEMPLATE.md). Fix or explicitly defer every finding before committing.
- **Scope of rework.** After review, limit changes to the findings' stated fixes; QA verifies them. `gp-reviewer` runs again if rework changes behaviour beyond a stated fix. `gp-security` re-checks the fixes to its own blocker and major findings.
- **Rounds.** A round is one rework and re-verification cycle that ends in a QA FAIL or a new blocker; the first review does not count.
- **Escalation.** After three rounds, stop. Record an escalation in the task record: the failure history, the root cause, and the options (decompose, revise the approach, accept with documented limits, or defer). Then ask the user to choose. Accepting with limits and deferring are the user's decisions.
- **When subagents aren't available.** If subagents are unavailable, or the user declines them, say so in the final report and record the stage as skipped. A same-session self-review is never reported as independent.
- **Session restarts.** Instruction files and this section load when a session starts. Restart any session opened before they changed.

## RLS and grants found in QA

`gp-qa` stays read-only. When it finds an RLS or grant defect:

1. It records FAIL, with the smallest justified fix and the test that exposes the defect.
2. The implementer (normally the primary session) applies the fix as its own commit, and the commit names that test.
3. In the same change, the implementer keeps `technical/data-access-surface.csv`, `technical/database/invariant-catalog.csv` and the governing spec or task record in agreement.
4. `gp-security` re-checks the fix and `gp-qa` re-verifies it.

Auth code (`apps/app/proxy.ts`, session and OTP code, `supabase/templates/`, and the auth settings in `supabase/config.toml`) always takes the `gp-architect` and `gp-security` route. It is never fixed as a QA fix.

The history of this rule is in [docs/ai-workflow.md](docs/ai-workflow.md).

## Commands

| What | Command |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Types | `pnpm turbo run typecheck` |
| Tests, in CI's shape | `pnpm turbo run test --concurrency=1` (see below before running it locally) |
| Build | `pnpm turbo run build` |
| Docs and catalogs | `pnpm validate:canonical-docs` |
| Agent profiles | `pnpm validate:agents` (regenerate with `python3 scripts/sync-agents.py --write`) |
| Tokens | `pnpm --filter @goproceed/tokens generate` |
| Local database | `supabase start -x studio,postgres-meta,logflare,vector,edge-runtime,realtime,postgrest`, then `pnpm db:local-credentials` |
| Browser harnesses | `pnpm --filter @goproceed/landing qa`, `pnpm --filter @goproceed/app qa` (the native field client has no harness yet: DEV-042) |

## What "the tests pass" means here

Most database suites do **not** skip when credentials are missing. They connect to the local stack and change its data.

**`apps/app/tests/*.int.test.ts` mostly do not skip.** Only the suites that check database credentials skip themselves silently. They check in one of two ways:

- through `hasIsolatedDatabaseCredentials()` in `tests/helpers/fixtures.ts`, which needs `APP_DB_URL`, `SERVICE_DB_URL` and `TEST_DB_ADMIN_URL`;
- through an inline check of their own. Some inline checks test only `APP_DB_URL` and `SERVICE_DB_URL`; `telegram-ingress` is one.

A fresh checkout has none of these variables.

The rest use the local Supabase stack. That means Postgres on `127.0.0.1:54322`, either hard-coded or through the `ADMIN_URL` fallback in the fixtures, and, depending on the suite, the Storage API on `127.0.0.1:54321`. Most of these suites **truncate tenant tables**.

To know which suites a run skipped, read that run's output, not this paragraph.

**`packages/testing` does not skip either.** Its database suites fall back to the local stack's default URLs. The suites that call `resetDb()` run `supabase db reset` and then `pnpm -w db:local-credentials` themselves; `rls.test.ts` is one of them.

**What that means for running them locally:**

- **Stack down:** those suites fail.
- **Stack up:** `apps/app` truncates the local data and `packages/testing` **resets the whole local database**.
- **Owner confirmation:** running `pnpm turbo run test`, `pnpm --filter @goproceed/app test` or `pnpm --filter @goproceed/testing test` against a local stack needs the owner's confirmation that the local data can go. In CI the stack is disposable.

Rules that follow:

- **Name what ran.** Say which suites ran. A skipped suite is NOT RUN, never a pass. "Green locally" without the database means the unit tests passed.
- **Setup fails first in CI.** CI runs some integration cases for the first time, so expect the first failure in setup, not in behaviour. Before adding a row to the fixture world, read it: a capability `seedRulesWorld` already granted, or a uniqueness slot already held.
- **Migrations are applied by hand.** Locally they are applied as `postgres`, and no one runs `supabase db reset` without the owner — neither directly nor through the suites above. Each new migration is owed to every local database separately.
- **One suite tree at a time.** Never run `@goproceed/testing` and `apps/app` suites concurrently against one local database.

## UI and the design system

If you touch `apps/landing/**`, `apps/app/app/**`, `packages/ui/**` or `packages/tokens/**`, read **`docs/design/02-building-ui.md` first**. It is the procedure, not background: read order, which skills to use and which to refuse, the substitution table, and the gate. Reviewing UI counts as touching it. It is deliberately not inlined here (`docs/ai-workflow.md`).

Building the office dashboard? Also read `docs/design/03-ui-references.md` (the reference repositories, their licences — plane's AGPL means structure only — and where shadcn components land, `packages/ui`) and `docs/design/04-role-pain-map.md` (a screen with no named role and no named pain is a guess).

Five rules hold even if you read nothing else:

1. **Name a role, never a value.** `bg-canvas`, not `bg-neutral-25`, and never a hex. A ramp step is not reachable as a utility, and a raw `var(--gp-neutral-*)` fails a test. If no role means what you mean, you have found a missing role.
2. **Never edit a file whose header says GENERATED.** Edit `packages/tokens/src/tokens.json`, then run `pnpm --filter @goproceed/tokens generate`. Colours in `tokens.json` are OKLCH triples; the hex is output.
3. **Animation comes from `@goproceed/ui/motion`.** Importing `motion/react` anywhere else fails the build. Reduced motion is a different animation, never a faster one.
4. **Never write a Tailwind class as a template literal** (`bg-${tone}`). The scanner sees the template, not the class, and emits no CSS, so the element renders unstyled with no warning.
5. **Before saying done, run the five commands in that file's §5 and paste the output.** A UI change that compiles is not a UI change that works: a class that does not exist produces no error, only an unstyled element.

## Third-party libraries and services: current docs first, never memory

Before implementing, configuring or advising on any external library, SDK, platform API or hosted service (Supabase, Vercel, Next.js, Expo, supabase-js, `@supabase/ssr`, puppeteer, pg, …), read the current documentation and check the version installed in this repository. API shapes, key formats, env-var names, defaults and deprecations move faster than any model's cutoff. A confident answer from memory is how legacy creeps in.

1. Read the installed version (`package.json`, lockfile, `--version`).
2. Fetch the docs for that version, and prefer the vendor's own source. In Claude Code, use the `supabase` skill and the Supabase MCP `search_docs` for anything Supabase. `gp-researcher` does this when a subagent's decision depends on it.
3. If the installed version and the docs disagree, say so and name both. Record the upgrade in `docs/BACKLOG.md` with its deadline, rather than silently coding to the old shape.
4. Cite the version and doc URL you checked in the commit or PR, and in the task record's Sources.

The case behind this rule, and the correction that proved it works, are in `docs/ai-workflow.md`.

## Authority

A PASS from any stage, and invoking any role, grants no authority to merge, deploy, apply migrations to a hosted project, send outbound messages or make paid calls. Merging is the owner's decision.
