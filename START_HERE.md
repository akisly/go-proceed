# Start here — GoProceed

## Goal

GoProceed is a pnpm/turbo monorepo. It holds the product applications, the Supabase database that enforces tenancy, and the machine catalogs and documents that define the product. [docs/product/](docs/product/) describes what the product is for and what the current release contains. Public copy is Ukrainian. Repository documentation is English.

## Read in order

1. [AGENTS.md](AGENTS.md): the rules every agent follows. They cover required independent review, commands, what "the tests pass" means here, the UI rules and the current-docs rule. Claude Code sessions also get [CLAUDE.md](CLAUDE.md), which adds host-specific notes.
2. [docs/README.md](docs/README.md): the precedence ladder. It says which source wins when two disagree.
3. [PRODUCT.md](PRODUCT.md) and [docs/product/scope-and-boundaries.md](docs/product/scope-and-boundaries.md).
4. [docs/architecture/system-overview.md](docs/architecture/system-overview.md) and [docs/architecture/tenancy-and-security.md](docs/architecture/tenancy-and-security.md).
5. [docs/delivery/version-0.1.md](docs/delivery/version-0.1.md): the current release's milestones and evidence.
6. [agents/COORDINATION.md](agents/COORDINATION.md), the role you were assigned in `agents/roles/`, and your task record in [docs/tasks/](docs/tasks/README.md).

## Implementation paths

| Path | Owns |
|---|---|
| `apps/app` | Next.js BFF: `/v1` and `/external` routes, the office dashboard, the PWA field client |
| `apps/landing` | Next.js public site and the pilot request form (`apps/landing/AGENTS.md`) |
| `apps/mobile` | Expo SDK 57 field client (`apps/mobile/AGENTS.md`) |
| `packages/contracts` | Request and response shapes of the public API |
| `packages/database` | Transaction helpers and database access |
| `packages/domain` | Domain rules |
| `packages/testing` | Contract suites and QA scripts |
| `packages/ui`, `packages/tokens` | Design system components, motion vocabulary and tokens (`docs/design/02-building-ui.md`) |
| `supabase/` | Migrations (append-only), RLS, grants, functions, auth templates, local config |
| `technical/` | Machine catalogs: route scope, errors, data-access surface, invariants, states, copy |
| `docs/` | Product, domain, architecture, delivery, design, discovery and decisions |

Use pnpm. The root `package.json` and each package's `package.json` define the commands that exist.

## Current development

The current state lives in [docs/STATUS.md](docs/STATUS.md), the task records under [docs/tasks/](docs/tasks/README.md) and the release document [docs/delivery/version-0.1.md](docs/delivery/version-0.1.md). Open and deferred work lives in [docs/BACKLOG.md](docs/BACKLOG.md). `TODOS.md` and the `HANDOFF*.md` files are dated records whose open items DEV-005 moved there; DEV-006 froze them.

Documentation describes what was observed on its date. It is not build or migration evidence: check `git log`, the build and `supabase/migrations/` before relying on it. Concurrent work on other branches is common.

Before 2026-09-13, slices kept their specs, plans and gate records under `docs/superpowers/`. That directory is a frozen archive. Applied migrations and catalogs cite files in it by path, so it is never moved or rewritten.

## Agents and handoff

**Roles.**

- Canonical profiles live in `agents/`; the generated project profiles are in `.claude/agents` and `.codex/agents`.
- Every behavior change gets `gp-reviewer` and `gp-qa`. Other roles join by trigger or route, never as an all-role pipeline, and there is no recursive delegation.
- Validate the profiles with `pnpm validate:agents` (Python 3.11+). Check that the host discovers them by invoking a role by name.

**Records.** The coordinator keeps a task record for every behavior change under `docs/tasks/`. Specialists return handoffs; they do not edit shared records.
