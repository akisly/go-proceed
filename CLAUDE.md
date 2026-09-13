@AGENTS.md
@START_HERE.md

## Working in Claude Code

Everything that applies to every host lives in `AGENTS.md`, imported above: the review rules, commands, test semantics, UI rules and the current-docs rule. This section covers only what is specific to Claude Code.

- **The coordinator starts the stages.** The primary session starts the stages root `AGENTS.md` requires with the Agent tool, naming the project roles (`gp-reviewer`, `gp-qa`, …) without waiting to be asked. The routes and task states are in `agents/COORDINATION.md`; the record template is `agents/TASK_TEMPLATE.md`.
- **Brief subagents fully.** A subagent inherits no conversation. Give it:
  - the repository path;
  - the diff file, with its base commit and `git status`;
  - the acceptance criteria;
  - the shape of the answer you expect.

  Its report is all that survives.
- **The coordinator runs browser and MCP passes.** Role profiles carry no MCP tools, so the coordinator runs browser passes and MCP lookups (Supabase MCP `search_docs`, the Vercel tools) itself and hands the evidence on. If the in-app Browser pane is hidden, use the puppeteer harnesses (`pnpm --filter @goproceed/landing qa`, `@goproceed/app qa`).
- **Project settings.** `.claude/settings.json` disables a globally installed workflow plugin for this project and caps subagent nesting at one level; `docs/ai-workflow.md` explains both.
- **Missing roles.** If `gp-*` roles are missing from the available agents, the session predates the profiles. Restart it. Until then, a stage can run as an independent general-purpose subagent told to read `agents/COMMON.md` and the role file, recorded as that fallback in the task record.
