# Sources

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-09-13

**Related decisions:** None

The register of third-party sources that a GoProceed decision, rule or task record relies on. It follows root `AGENTS.md` («Third-party libraries and services: current docs first, never memory»): a task that checks a source gives it an S-id here and cites that id in its record's Sources section.

**Rules.**

- **One heading per source**, `## Snn`, never reused and never renumbered. `scripts/validate-canonical-docs.mjs` fails on a duplicate S-id.
- **Publication date and access date are separate fields.** A live documentation page usually has no publication date; say so rather than substituting the access date. An access date describes the revision read that day, not an archived snapshot.
- **What it proves, and what it does not.** A source supports only the claim written next to it.
- **Refused or failed access** is recorded under «Access refused», with the date, so a later session does not repeat the attempt blind.
- **Ukrainian regulatory sources** keep their own register in [hidden-works-content-rules.md](../product/hidden-works-content-rules.md); this file does not duplicate its allow-list. Discovery candidates (people and companies) are not sources and stay in `docs/discovery/`.

## S01

Anthropic. [Create custom subagents — Claude Code](https://code.claude.com/docs/en/sub-agents). Live documentation; publication date not established. Accessed: 2026-09-13.

- **Proves:** project subagents in `.claude/agents/` take precedence over user subagents; the frontmatter fields; subagents may spawn subagents unless `Agent` is withheld; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` set to 1 disables nesting.
- **Does not prove:** how the desktop app discovers profiles added after a session starts.
- **Cited by:** [DEV-001](../tasks/DEV-001-agent-infrastructure.md), [DEV-002](../tasks/DEV-002-workflow-rules.md), `agents/README.md`.

## S02

Anthropic. [Claude Code settings](https://code.claude.com/docs/en/settings). Live documentation; publication date not established. Accessed: 2026-09-13.

- **Proves:** settings precedence runs managed > command line > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`; a higher-level key overrides the same key below it.
- **Does not prove:** that a project-level `enabledPlugins` entry overrides a user-level one. In Claude Code 2.1.266 (desktop) it did not ([DEV-002](../tasks/DEV-002-workflow-rules.md) criterion 8b).
- **Cited by:** DEV-002.

## S03

Anthropic. [Claude Code settings reference](https://code.claude.com/docs/en/settings-reference). Live documentation; publication date not established. Accessed: 2026-09-13.

- **Proves:** `enabledPlugins` turns plugins on or off per scope and may appear in all four settings files.
- **Does not prove:** whether the object merges per key; whether the desktop app applies it as the CLI does; whether plugin hooks follow the skills' enabled state. The page is silent on all three.
- **Cited by:** DEV-002.

## S04

Anthropic. [Discover and install plugins — Claude Code](https://code.claude.com/docs/en/discover-plugins). Live documentation; publication date not established. Accessed: 2026-09-13.

- **Proves:** plugins are enabled per scope; `claude plugin disable <plugin>@<marketplace> --scope project` is the documented per-project disable.
- **Does not prove:** that the per-project disable takes effect over a user-level enable (see S02).
- **Cited by:** DEV-002.

## S05

OpenAI. [Custom agents — Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents) (redirected from `developers.openai.com/codex/subagents`). Live documentation; publication date not established. Accessed: 2026-09-13.

- **Proves:** custom agents live in `.codex/agents/*.toml`; `name`, `description` and `developer_instructions` are required; `sandbox_mode` is optional and inherited when omitted; a spawned child inherits the parent turn's live overrides.
- **Does not prove:** that a Codex session in this repository discovers the profiles. No Codex session has checked it ([DEV-001](../tasks/DEV-001-agent-infrastructure.md) criterion 7, NOT RUN).
- **Cited by:** DEV-001, `agents/README.md`.

## S06

OpenAI. [Configuration reference — Codex](https://learn.chatgpt.com/docs/config-file/config-reference) (redirected from `developers.openai.com/codex/config-reference`). Live documentation; publication date not established. Accessed: 2026-09-13.

- **Proves:** `sandbox_mode` accepts `read-only`, `workspace-write` or `danger-full-access`.
- **Does not prove:** that `gp-qa`'s `workspace-write` lets it run the suites in practice; nobody has exercised it.
- **Cited by:** DEV-001.

## S07

msitarzewski. [agency-agents](https://github.com/msitarzewski/agency-agents), pinned at commit `ad9264e`. Repository; the pin, file hashes and per-file access dates are in `agents/upstream.lock.json`. Accessed: 2026-09-13.

- **Proves:** the upstream persona text each `agents/roles/gp-*.md` was adapted from, byte for byte at the pin.
- **Does not prove:** anything about GoProceed's own rules; the adapted roles, not the upstream personas, are normative.
- **Cited by:** DEV-001, `agents/COORDINATION.md` «Provenance», `third_party/agency-agents/`.

## Access refused

None recorded.
