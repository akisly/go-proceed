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
| [DEV-017](DEV-017-capture-event-service-workspace.md) | done | BL-102: the service plane's capture event confined to the workspace it declares (migration `0087`) |
| [DEV-018](DEV-018-gate11-closure.md) | done | M0 readiness gate 11: the unfiltered evidence run and the closing entry in `version-0.1.md` §M0 |
| [DEV-019](DEV-019-invitation-token-at-rest.md) | done | BL-104: the raw invitation token no longer stored in `idempotency_records.response_body`; a replay returns a token-free receipt (migration `0088`) |
| [DEV-020](DEV-020-idempotent-replay-authorization.md) | done | BL-103: a stored idempotent response replayed only to a caller still authorized for the command (migration `0089`, a required `authorize` step in `withIdempotency`) |
| [DEV-021](DEV-021-invitation-revoke.md) | done | BL-107: an owner or admin can revoke a pending invitation, and the create's conflict names the blocking one (ADR-012) |
| [DEV-022](DEV-022-request-hash-target.md) | done | BL-112: a command's request hash binds its path target, so a key reused for another target is 409, not a replay of the first |
| [DEV-023](DEV-023-idempotency-secret-guard.md) | done | BL-108: `withIdempotency` refuses to store a body carrying a bearer secret (INV-102 enforced in the helper) |
| [DEV-024](DEV-024-invite-token-in-fragment.md) | done | BL-109: the invitation link carries its token in the fragment (`invite#<token>`), and a static test keeps secrets out of route paths and query strings |
| [DEV-025](DEV-025-landing-multipage.md) | verifying | The landing as a short home page and three sub-pages (`/product`, `/roles`, `/pilot`); the pilot form on `/pilot` only; page links in the header and footer; per-page metadata, sitemap and structured data |
| [DEV-026](DEV-026-landing-parlo-rebuild.md) | verifying | The four landing pages rebuilt 1:1 against https://parlo-black.vercel.app/ in the Daylight colours: frame, full-viewport hero, section bands, sticky feature list, grid cards, fact band, closing block and their animations (BL-082) |
| [DEV-027](DEV-027-landing-parlo-interactions.md) | verifying | The landing's behaviour after its reference: grid cells that light under the pointer and fade (the hero's floor, the fact band), a deeper twinkling hero field, hover states on cards and rows, the requirement sources as the reference's logo row, a three.js particle sphere, and a closing ground of arcs that bend to the pointer |
| [DEV-028](DEV-028-autumn-palette-typography.md) | verifying | The design system takes the owner's brand sheet: a warm neutral ramp on paper #ECE9DF, the deep green #395A4D as the primary and the orange #FF5B04 as the secondary, the status families moved clear of both, and Hanken Grotesk with Commissioner behind it for Cyrillic — tokens, both apps, the icons and DESIGN.md |
| [DEV-029](DEV-029-autumn-depth-tints.md) | verifying | The landing keeps every page and block and stops reading as ink on paper: a warm clay stage (one treatment, one light) under every product artefact, full-bleed hairline bands, glass on the header veil and the hero's secondary pill, and four decorative index tints in the role grid only. No dark ground and no ember button — every action is the ink pill with its border
| [DEV-030](DEV-030-outputs-private-storage.md) | done | BL-079: the prospecting session's 250 files, which hold personal data, leave the tree for a private folder outside the repository, copied from git with a verified SHA-256 manifest; `outputs/README.md` becomes a pointer with no personal data; `bbfc705` still holds them (no history rewrite) |
| [DEV-031](DEV-031-outputs-guards.md) | done | BL-081: `.gitignore` ignores everything under `outputs/` but its pointer README, and the discovery store's data files; the validator refuses a tracked ProZorro `contactPoint` in a dump's forms, any other tracked `outputs/` file, any file it cannot read, anything in `discovery/` but its prose and package, and any file forced past an ignore rule; its two `outputs/` exemptions removed |
| [DEV-032](DEV-032-evidence-signed-read-download.md) | reviewing | BL-089: finalization refuses an object stored under any type but its detected one (strictly: no lists, no quoted parameters), and member-plane signed reads are issued as downloads (`Content-Disposition: attachment`, advisory: a URL holder can strip it); the evidence card's `<img>` is unchanged |
| [DEV-033](DEV-033-image-size-limits.md) | implementing | BL-088: finalization reads an image's declared size from its header without decoding (JPEG segment walk, PNG IHDR, HEIC `ispe` and grid output sizes) and refuses one over 268,402,689 pixels or 65,535 px on an edge, one whose size cannot be read, and an animated PNG; phone photos up to 200 MP and panoramas pass |
