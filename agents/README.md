# Development roles (Agency Agents, adapted for GoProceed)

GoProceed uses one family of adapted development roles, `gp-*`. This directory holds their canonical instructions. The host formats for Claude Code and Codex are generated from them, so edit only the sources listed under [Maintenance](#maintenance).

Every profile is the shared protocol in [COMMON.md](COMMON.md) followed by one role file under `roles/`. The shared protocol carries the project invariants: precedence, append-only migrations, tenancy and database principals, the paperwork that moves with RLS changes, checks, UI rules, records and secrets.

| Role | Use it | Returns | Claude tools | Codex sandbox |
|---|---|---|---|---|
| `gp-architect` | Before a change to migrations, RLS, grants, database roles, `/v1` or `/external` contracts, catalogs, workers, retention or erasure, or the Telegram workflow | Minimal design, invariants, failure cases, ADR needed or not | Read, Grep, Glob | read-only |
| `gp-implementer` | Only when the coordinator explicitly delegates a bounded slice; the primary session normally implements | Scoped diff and checks | + Bash, Edit, Write | inherits host |
| `gp-reviewer` | After every behavior change, over the diff file | Findings with trigger, impact and location | Read, Grep, Glob | read-only |
| `gp-security` | When the change crosses a trust boundary (see its description in `registry.json`) | Findings ranked by severity | Read, Grep, Glob | read-only |
| `gp-qa` | On the final revision of every behavior change | PASS / FAIL / NOT RUN matrix | + Bash | workspace-write |
| `gp-researcher` | A decision rests on an unverified library, service or regulatory fact | Evidence table with versions and dates | + WebSearch, WebFetch | read-only |
| `gp-ui-reviewer` | After a change to landing, app UI, mobile screens, `packages/ui`, tokens or copy | PASS / HOLD finish gate | Read, Grep, Glob | read-only |
| `gp-mobile` | Field-client installability, offline or capture behaviour, Expo, signing, store or OTA | Requirements and acceptance cases | + WebSearch, WebFetch | read-only |

When a stage is required is decided by the repository's root rules (`AGENTS.md` and `CLAUDE.md`), not by this table.

## Usage

Open the repository root as the project. Claude Code discovers `.claude/agents/*.md`, and Codex discovers `.codex/agents/*.toml`. A new session may be needed before newly generated profiles show up. Model and reasoning settings are inherited; nothing global is changed.

**Use the project roles, not global agents with similar names.** `~/.claude/agents` may contain upstream personas such as `engineering-code-reviewer` or `testing-reality-checker`. Those do not carry GoProceed's invariants. Project agents take precedence over user agents when names collide, but the names differ here, so pick `gp-*` explicitly.

Example assignments:

> Use gp-architect on the change to upload intents. Scope: supabase/migrations, packages/database and the /v1 upload routes. Return the design, the invariants touched, failure cases and whether an ADR is needed; do not edit.

> Use gp-reviewer on /tmp/dev-012.diff (base 13e256e, `git status` attached). Return actionable findings and coverage limits only.

**Differences between the hosts:**

- **Claude Code** picks a subagent from its `description` and picks up new profile files without a restart. Descriptions that say "Use proactively" invite automatic delegation. Root `AGENTS.md` makes the reviewer and QA stages mandatory for every behavior change, and makes the security and UI stages mandatory by trigger, so those four descriptions say "Use proactively". The architect, mobile, researcher and implementer descriptions do not, because the coordinator selects those by route.
- **Codex** documents spawning a custom agent on an explicit request, or when an applicable `AGENTS.md` asks for delegation. Whether it also delegates on its own at some settings is not verified here. For Codex, the root `AGENTS.md` is where the rule lives.
- **Other tools:** a host that does not discover native profiles can read `COMMON.md` plus the role file and play the role in sequence.

## Maintenance

Canonical files: [COMMON.md](COMMON.md), [registry.json](registry.json), `roles/*.md`, and the pin in [upstream.lock.json](upstream.lock.json). The generated `.claude/agents/` and `.codex/agents/` must never be edited by hand.

From the repository root, with Python 3.11+:

```sh
python3 scripts/sync-agents.py --write   # regenerate
pnpm validate:agents                      # = python3 scripts/sync-agents.py --check; CI runs it
```

The generator works offline and touches only the profiles it owns. It checks:

- the registry rules: only `gp-implementer` may write, read roles have no edit tools, and only a `*-qa` role may ask for Codex `workspace-write`;
- that TOML round-trips;
- that every role file is registered;
- that each generated file is byte-identical to its sources.

A removed or renamed role leaves its old generated files behind. The check reports them but never deletes them.

## Access boundaries

**Claude Code** restricts tools per profile:

- review and security roles have no shell and no edit tools;
- research and mobile roles have web tools;
- QA has Bash.

No profile lists the `Agent` tool, so no role can spawn another.

**Codex** read roles set `sandbox_mode = "read-only"` and QA sets `workspace-write`, because test suites write caches and connect to the local database. The implementer sets nothing and inherits the host sandbox.

In Codex, `sandbox_mode` is only a default. When Codex spawns a child it reapplies the parent turn's live runtime overrides, such as a `/permissions` change or `--yolo`, even when the custom agent file sets something different. A coordinator running with full access therefore gets a full-access reviewer too.

Bash and `workspace-write` can both write files, so QA's "no source edits" is an instruction, not isolation. Host permissions still apply. For passive review, use `gp-reviewer` or `gp-security`, and in Codex do not run the parent session with overridden permissions. No profile authorizes writes to external services.

The static check proves syntax and agreement with the canonical files. It does not prove native discovery, model behaviour, or isolation of every connector.

**Manual smoke check in a new session:** ask `gp-reviewer` to read `agents/README.md` and name the eight roles without editing, and confirm the host shows the role name and that the role reports no Bash tool.

## Sources

Checked on 2026-09-13:

- [Agency Agents](https://github.com/msitarzewski/agency-agents) at the commit pinned in `upstream.lock.json`;
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents): file locations and precedence, frontmatter fields, and nesting (subagents may spawn subagents unless `Agent` is withheld);
- [Codex custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents): `.codex/agents/*.toml`, the required `name`, `description` and `developer_instructions`, and `sandbox_mode` inherited when omitted.

Licence and adaptation notes: [third_party/agency-agents/README.md](../third_party/agency-agents/README.md).
