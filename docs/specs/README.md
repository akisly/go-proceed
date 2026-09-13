# Design specs

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-09-13

**Related decisions:** None

New design specs live here, one file per slice, named `YYYY-MM-DD-<slug>.md` by the date the spec was first written. Specs written before 2026-09-13 stay in the frozen archive [docs/superpowers/specs/](../superpowers/README.md), which is never moved or rewritten.

## When a slice needs a spec

A spec is written when a slice has a real design: a user-facing flow, a schema-and-route slice, or anything the owner must approve before implementation ([pilot-execution-runbook.md](../delivery/pilot-execution-runbook.md) §4.1 step 3). A slice that only implements an already approved design needs a task record, not a spec.

## What a spec carries

Every spec starts with the metadata block [docs/README.md](../README.md) requires:

```markdown
**Status:** Draft | Approved | Superseded | Historical

**Applies to:** v0.0 | v0.1 | v0.2+ | all

**Last reviewed:** YYYY-MM-DD

**Related decisions:** ADR links or None
```

- **Draft** until the owner approves it. An agent never writes `Approved`.
- **Approved** only with the owner's dated approval recorded in the spec itself («Approved by the owner on YYYY-MM-DD», with where: conversation, PR review), and linked from the slice's task record.
- **Superseded** with a `**Superseded by:**` line naming the replacing spec or ADR.
- Whether a spec's slice shipped is not a spec status. It belongs in the task record and in [docs/STATUS.md](../STATUS.md).

A spec links its task record (`docs/tasks/DEV-NNN-…`) and the ADR or numbered ADR-006 step it serves.
