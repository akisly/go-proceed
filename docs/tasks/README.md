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
| [DEV-009](DEV-009-m0-gate10-evidence.md) | done | M0 readiness gate 10 (runbook items 9 and 10): the ДБН file and its retrieval record under `technical/requirements/`, the Реєстр будівельних норм check with its procedure, and the first dated gate evidence entry in `version-0.1.md` §M0 |
| [DEV-010](DEV-010-m0-gate14-evidence.md) | done | Evidence toward M0 readiness gate 14 (runbook item 7): the deploy preflight and the key registry refuse unusable HMAC keys without printing them, a standalone secret rotation runbook, the `version-0.0.md` role-password tick; the gate stays open on BL-085 |
| [DEV-011](DEV-011-telegram-hmac-key-ids.md) | done | Key ids for the Telegram link-token and erasure-registry HMAC keys (BL-085), which readiness gate 14 waits on |
| [DEV-012](DEV-012-m0-gate12-evidence.md) | done | Evidence toward M0 readiness gate 12 (runbook item 12): the built upload and import controls with their tests, and the owner's pilot malware decision with its risk; the gate stays open on export neutralization, BL-088 and BL-089 |
| [DEV-013](DEV-013-m0-gate11-coverage-checker.md) | done | M0 readiness gate 11: a mechanical coverage checker for positive and negative tenant-isolation tests per exposed relation (INV-060) |
| [DEV-014](DEV-014-gate11-workspace-communication.md) | done | Readiness gate 11: tenant-isolation tests for the workspace-access and communication gap rows (BL-098, BL-090) |
| [DEV-015](DEV-015-projection-service-policy.md) | done | BL-100: the service plane confined to its declared workspace on the readiness projections (migration `0086`) |
| [DEV-016](DEV-016-gate11-remaining-gaps.md) | done | Readiness gate 11: tenant-isolation tests for the remaining gap rows (BL-091 to BL-095, BL-097) |
| [DEV-017](DEV-017-capture-event-service-workspace.md) | reviewing | BL-102: the service plane's capture event confined to the workspace it declares (migration `0087`) |
