# Development task records

Each development change gets one record here, named `DEV-NNN-<short-title>.md`. Numbers form a single sequence; take the next unused one. Only the coordinator (the primary coding session) writes a record's state and this index. Specialist roles return handoffs instead of editing either.

A record's detail lives in the record itself. This index lists only each record's current state, which is one of:

- planned
- scoped
- researching
- designing
- implementing
- reviewing
- verifying
- rework
- blocked
- done
- cancelled

Root `AGENTS.md` makes a record mandatory for every behavior change. The routes are in `agents/COORDINATION.md` and the template is `agents/TASK_TEMPLATE.md`.

Records before DEV-001 are not converted. Earlier slices kept their plans, specs and gate records under `docs/superpowers/`, which is a frozen historical archive.

| Task | State | Scope |
|---|---|---|
| [DEV-001](DEV-001-agent-infrastructure.md) | done | Project development roles `gp-*`: canonical sources in `agents/`, generated Claude and Codex profiles, `pnpm validate:agents` in CI |
| [DEV-002](DEV-002-workflow-rules.md) | done | Workflow switch: root `AGENTS.md` rules, coordination, playbooks and template, project settings, retired-workflow validator guard |
| [DEV-003](DEV-003-runbook-process.md) | done | Pilot runbook §3, §4, §6.6 and §7 onto the `gp-*` process; retired-loop measurements moved to `docs/ai-workflow.md`; validator runbook exemption removed |
| [DEV-004](DEV-004-status-layer.md) | done | Status layer: `docs/STATUS.md`, ADR index, S-register, specs and archive READMEs, document and ADR status enums with the approval procedure, Limitation qualifiers, validator guards for the indexes |
| [DEV-005](DEV-005-backlog-triage.md) | done | Backlog triage: `TODOS.md` and the HANDOFF files into `docs/BACKLOG.md` (76 entries), their facts into STATUS and their lessons into `docs/ai-workflow.md`; live instructions point new follow-ups at the backlog |
| [DEV-006](DEV-006-freeze-todos.md) | done | Freeze of `TODOS.md` and the HANDOFF files (first-line banner, sha256 pins); live `TODOS.md` line citations re-pointed to backlog ids; validator guards against new line citations and for `docs/BACKLOG.md` against its preamble |
| [DEV-007](DEV-007-design-sources.md) | done | Design sources of truth: stale design memory files and duplicates removed with restore commands, reference folders labelled by standing, the rewrite plan Historical, `outputs/` described and reviewed for personal data |
| [DEV-008](DEV-008-types-react-dedupe.md) | done | Deterministic CI `typecheck`: one `@types/react` version in the lockfile (`apps/mobile` 19.2.4 → 19.2.18), since pnpm 9.12.0 privately hoists whichever copy the first-listed importer brings and that order varies between runs |
| [DEV-009](DEV-009-m0-gate10-evidence.md) | verifying | M0 readiness gate 10 (runbook items 9 and 10): the ДБН file and its retrieval record under `technical/requirements/`, the Реєстр будівельних норм check with its procedure, and the first dated gate evidence entry in `version-0.1.md` §M0 |
