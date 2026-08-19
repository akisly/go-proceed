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
