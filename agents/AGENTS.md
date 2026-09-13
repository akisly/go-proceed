# Development profiles boundary

Read the root `CLAUDE.md` first, and the root `AGENTS.md` when it exists. This directory holds the canonical development-role instructions, the role registry and the upstream provenance. It holds no product runtime prompts.

## Editing a role

1. Edit `COMMON.md`, `roles/*.md` or `registry.json`.
2. From the repository root, regenerate the host profiles: `python3 scripts/sync-agents.py --write`.
3. Validate: `pnpm validate:agents` (the same as `python3 scripts/sync-agents.py --check`; CI runs it).

Do not edit the generated host files in `.claude/agents/` and `.codex/agents/` directly.

## What must stay intact

- Role scopes and access levels.
- The licence.
- The upstream pin.
- The rule against recursive delegation.

Do not add model, reasoning, concurrency or global permission overrides unless the owner asks for them.
