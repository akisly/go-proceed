# AI workflow: the cases behind the rules

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-09-09

**Related decisions:** [ADR-011](decisions/ADR-011-telegram-locked-project-channel.md)

Why this file exists. `CLAUDE.md` is read at the start of every session, so it
carries the rules and nothing else. The cases that produced those rules are
worth keeping — a rule whose reason is lost gets deleted by the next reader who
finds it arbitrary — but they do not need to be resident. They are here, and
`CLAUDE.md` points at them.

## Why QA may modify RLS, grants, and the migration that carries them

The rule in `CLAUDE.md` §"AI development workflow" read, until 2026-09-02:

> Do not let QA automatically modify auth, RLS, grants, or migration code.

The owner lifted the RLS-and-grants half after PR #58's first CI run found the
tenant-isolation sweep and the schema disagreeing on one column-level grant, and
the prohibition left that fix in nobody's hands. RLS and grants live only in
`supabase/migrations/`, so the permission has to reach the migration that
carries them or it is empty. Auth code stays out of QA's hands.

## Why `docs/design/02-building-ui.md` is not inlined into CLAUDE.md

It is 300+ lines and most work in this repository is not UI; inlining it would
spend context on every migration and every route handler. The pointer costs
three lines and the procedure loads when someone actually touches the UI.

## Why third-party documentation is read before every external integration

**The case, 2026-08-19.** Supabase renamed the browser key from the legacy
`anon` JWT to `sb_publishable_…` and the variable in its docs from
`NEXT_PUBLIC_SUPABASE_ANON_KEY` to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. This
repository's installed `supabase-js 2.47.10` still sent the key as a Bearer JWT
and could not accept the new format, so the correct answer that day was the
LEGACY key in the OLD variable name — and that is only discoverable by checking
both the installed version and the current docs, neither of which memory could
supply. The legacy keys stop working at the end of 2026; the upgrade is tracked
in `TODOS.md`.

**The correction, 2026-08-21, which is itself an instance of the rule.** The
«installed supabase-js 2.47.10 cannot accept the new format» premise is stale:
PR #30 bumped the workspace to 2.112.3, which handles `sb_publishable_` keys.
The legacy-key workaround is no longer needed anywhere, and the Expo field
client uses the publishable key directly. The RULE the story motivates stands
unchanged — the fact was re-checked against the installed version before being
relied on, which is exactly what the rule asks for.
