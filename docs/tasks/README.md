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

The rules that make records mandatory, the routes and the record template come with the workflow switch that follows DEV-001.

Records before DEV-001 are not converted. Earlier slices kept their plans, specs and gate records under `docs/superpowers/`, which is a frozen historical archive.

| Task | State | Scope |
|---|---|---|
| [DEV-001](DEV-001-agent-infrastructure.md) | verifying | Project development roles `gp-*`: canonical sources in `agents/`, generated Claude and Codex profiles, `pnpm validate:agents` in CI |
