## AI development workflow

Superpowers is the primary implementation methodology.

Use Superpowers for:
- brainstorming before new implementation
- design approval
- implementation planning
- TDD
- plan execution
- systematic debugging

Use gstack only as explicit quality gates:
- /plan-ceo-review for product-level decisions
- /plan-eng-review after an approved design
- /plan-design-review for user-facing flows
- /review after implementation
- /cso for security-sensitive slices
- /qa-only for staging verification
- /ship for approved delivery

Do not let gstack expand an already approved scope.
Do not let QA automatically modify auth, RLS, grants, or migration code.
When workflows conflict, the approved design and implementation plan take precedence.

## UI and the design system

Touching `apps/landing/**`, `apps/app/app/**`, `packages/ui/**` or
`packages/tokens/**` — read **`docs/design/02-building-ui.md` first**. It is the
procedure, not background: read order, which skills to use and which to refuse,
the substitution table, and the gate. Reviewing UI counts as touching it.

Not loaded here on purpose. It is 300+ lines and most work in this repo is not
UI; inlining it would spend context on every migration and every route handler.

Five things that hold even if you read nothing else:

1. **Name a role, never a value.** `bg-canvas`, not `bg-neutral-25`, never a hex.
   A ramp step is not reachable as a utility and a raw `var(--gp-neutral-*)`
   fails a test. If no role means what you mean, you found a missing role.
2. **Never edit a file whose header says GENERATED.** Edit
   `packages/tokens/src/tokens.json`, then `pnpm --filter @goproceed/tokens generate`.
   Colours there are OKLCH triples; the hex is output.
3. **Animation comes from `@goproceed/ui/motion`.** Importing `motion/react`
   anywhere else fails the build. Reduced motion is a different animation, never
   a faster one.
4. **Never write a Tailwind class as a template literal** (`bg-${tone}`). The
   scanner sees the template, not the class, and emits no CSS — the element
   renders unstyled with nothing warning.
5. **Before saying done, run the five commands in that file's §5 and paste the
   output.** A UI change that compiles is not a UI change that works: a class
   that does not exist produces no error, only an unstyled element.

## Third-party libraries and services: current docs first, never memory

Before implementing, configuring, or advising on ANY external library, SDK,
platform API or hosted service (Supabase, Vercel, Next.js, supabase-js,
@supabase/ssr, puppeteer, pg, …), read the CURRENT documentation first and
check the version actually installed in this repository. Do not implement from
training-data memory: API shapes, key formats, env-var names, defaults and
deprecations move faster than any model's cutoff, and a confident answer from
memory is how legacy creeps in.

Concretely, for every such task:
1. Read the installed version (`package.json`, lockfile, `--version`).
2. Fetch the current docs for THAT version — the `supabase` skill and the
   Supabase MCP `search_docs` for anything Supabase; the vendor's docs or
   changelog otherwise — and prefer the vendor's own source over a summary.
3. If the installed version and the current docs disagree (a renamed variable,
   a new key format, a deprecated call), say so explicitly, name both, and
   record the upgrade as an item in `TODOS.md` with its deadline rather than
   silently coding to the old shape.
4. Cite what was checked — version + doc URL — in the commit or PR, so the
   next reader can see the guidance was current on that date, not recalled.

Why this rule exists (2026-08-19): Supabase renamed the browser key from the
legacy `anon` JWT to `sb_publishable_…` and the variable in its docs from
`NEXT_PUBLIC_SUPABASE_ANON_KEY` to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. This
repo's installed `supabase-js 2.47.10` still sends the key as a Bearer JWT and
cannot accept the new format, so the correct answer today is the LEGACY key in
the OLD variable name — and that is only discoverable by checking both the
installed version and the current docs, neither of which memory could supply.
The legacy keys stop working at the end of 2026; the upgrade is tracked in
`TODOS.md`.
