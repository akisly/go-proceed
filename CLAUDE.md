## AI development workflow

Superpowers is the implementation methodology — brainstorming, design approval,
planning, TDD, plan execution, systematic debugging. gstack supplies gates only:
it may not expand an approved scope, and on conflict the approved design and
plan win.

| Gate | When |
|---|---|
| `/plan-ceo-review` | product-level decisions |
| `/plan-eng-review` | after an approved design |
| `/plan-design-review` | user-facing flows |
| `/review` | after implementation, before landing |
| `/cso` | security-sensitive slices |
| `/qa-only` | staging verification |
| `/ship` | approved delivery |

QA may modify RLS policies and grants, and the migration that carries them — in
this repository they are expressible nowhere else. Every such change is its own
commit naming the test it answers, and it keeps or explicitly revises the
paperwork the schema rests on (`technical/data-access-surface.csv`,
`technical/database/invariant-catalog.csv`, the slice's spec). QA still does not
modify auth code. Why the prohibition was narrowed: `docs/ai-workflow.md`.

## Agents and parallel work

28 agents are installed — backend and data, security and privacy, code quality,
verification, operations, frontend and mobile, product and content. The live
list is `ls ~/.claude/agents`; ~244 others sit in `~/.claude/agents.disabled/`,
one `mv` away. Never plan around a specialist without checking it is installed.

| Tool | When |
|---|---|
| `Explore` | read-only fan-out search — you need the conclusion, not the files |
| `general-purpose` | independent lanes dispatched in ONE message, as `/review` does |
| `superpowers:subagent-driven-development` | a plan's independent tasks |
| `superpowers:dispatching-parallel-agents` | the procedure for any fan-out |

A subagent inherits no conversation: give it the repository path, the exact
command, and the shape of the answer expected. Its report is all that survives.

## What "the tests pass" means here

The isolated suites — `apps/app/tests/*.int.test.ts` and most of
`packages/testing/` — call `hasIsolatedDatabaseCredentials()` and **skip
themselves silently** without `APP_DB_URL`, `SERVICE_DB_URL` and
`TEST_DB_ADMIN_URL`. A fresh checkout carries none of them.

- "Green locally" means the UNIT tests passed. Say it in those words; never
  report a skipped suite as a pass.
- CI runs an integration case for the first time. Expect the first failure in
  SETUP, not in behaviour: read the fixture world before adding a row to it — a
  capability `seedRulesWorld` already granted, a uniqueness slot already held.
- Migrations are applied by hand as `postgres`; `supabase db reset` is never run
  here, so each new migration is owed to every local database separately.

## UI and the design system

Touching `apps/landing/**`, `apps/app/app/**`, `packages/ui/**` or
`packages/tokens/**` — read **`docs/design/02-building-ui.md` first**. It is the
procedure, not background: read order, which skills to use and which to refuse,
the substitution table, and the gate. Reviewing UI counts as touching it. It is
deliberately not inlined here (`docs/ai-workflow.md`). Building the office
dashboard: also `docs/design/03-ui-references.md` (reference repos, licences,
where shadcn components land) and `docs/design/04-role-pain-map.md` (a screen
with no named role and no named pain is a guess).

Five things that hold even if you read nothing else:

1. **Name a role, never a value.** `bg-canvas`, not `bg-neutral-25`, never a hex.
   A ramp step is not reachable as a utility and a raw `var(--gp-neutral-*)`
   fails a test. If no role means what you mean, you found a missing role.
2. **Never edit a file whose header says GENERATED.** Edit
   `packages/tokens/src/tokens.json`, then `pnpm --filter @goproceed/tokens generate`.
3. **Animation comes from `@goproceed/ui/motion`.** Importing `motion/react`
   anywhere else fails the build; reduced motion is a different animation, never
   a faster one.
4. **Never write a Tailwind class as a template literal** (`bg-${tone}`). The
   scanner sees the template, emits no CSS, and the element renders unstyled
   with nothing warning.
5. **Before saying done, run the five commands in that file's §5 and paste the
   output.** A class that does not exist produces no error, only an unstyled
   element — compiling is not working.

## Third-party libraries and services: current docs first, never memory

Before implementing, configuring or advising on ANY external library, SDK,
platform API or hosted service, read the CURRENT documentation and check the
version installed here. Key formats, env-var names, defaults and deprecations
move faster than any model's cutoff, and a confident answer from memory is how
legacy creeps in.

1. Read the installed version (`package.json`, lockfile, `--version`).
2. Fetch the docs for THAT version — the `supabase` skill and the Supabase MCP
   `search_docs` for anything Supabase, the vendor's own source otherwise.
3. If the installed version and the docs disagree, say so, name both, and record
   the upgrade in `TODOS.md` with its deadline rather than coding to the old
   shape silently.
4. Cite version + doc URL in the commit or PR, so the next reader sees the
   guidance was current on that date, not recalled.

The case that produced this rule, and the correction that proved it works:
`docs/ai-workflow.md`.
