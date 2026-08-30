# `discovery/` — Child B outreach and discovery workflow

Implements doc 40 §B (`docs/40-phase1-discovery-outreach.md`) under the B0 execution plan at
`docs/superpowers/plans/2026-07-26-phase1-child-b0-discovery-research.md`.

## B0 is research-only. Gmail is never written to.

This package covers **ungated** Child B work only. Child A (`feat/p0a-child-a-prototype`)
remains the hard gate for: final outreach emails containing the public demo URL, Gmail draft
creation, sending or contacting prospects, and reply/follow-up tracking against a live mailbox.

**Nothing in this package imports a Gmail tool, and nothing here composes an email body.**
The §B.8 label taxonomy is *specified* in `reply-classification.md` and deliberately **not
created** — `create_label` writes to the founder's real mailbox and is deferred to the gated
phase, subject to founder approval at that time.

Hard rules carried from the spec:

- **Never guess, infer, pattern-match or construct an email address.** No `firstname.lastname@`,
  no `info@` invented from a domain. No public business email → `unreachable` (D5, recoverable).
- **A stored URL is not verification.** Open the source, confirm it supports the specific claim,
  and record what on the page supports it. A URL that exists but does not support the claim is
  not verified.
- **Never invent a fact to fill a column. Empty beats wrong.**
- Publicly available information only. No purchased lists, scraped databases, leaked data,
  paywall/login circumvention, or personal (non-business) addresses.

## Personal data

`leads.csv`, `outreach-log.csv`, `suppression.csv`, `drafts/` and `*.db` are **gitignored**.
They hold personal data under ЗУ «Про захист персональних даних» regardless of its business
character. Lawful basis: legitimate interest for B2B discovery contact; the source URL is
disclosed on request. Retention 12 months from `last_contact_date`; `suppression.csv` is exempt
and permanent, because honoring an opt-out requires remembering it.

## Environment baseline — do not fix

Recorded per founder instruction of 26.07.2026. **Do not attempt to fix these. Do not apply
migrations, reset Supabase, or modify the shared local database.** Protecting the active
Child A environment takes priority.

| Fact | Evidence |
|---|---|
| `APP_DB_URL` is unset in this worktree | `packages/database/src/pool.ts:7` throws `APP_DB_URL is not set`; CI sets it at `.github/workflows/ci.yml:18` |
| The shared local Supabase instance does not carry the AktFlow migrations | Instance answers on `127.0.0.1:54322` and authenticates, but schemas `app` and `api` both hold **0 tables** |
| These failures are outside Child B scope | Every failure is a DB-backed integration test in `packages/database` (4) and `apps/app` (6 `*.int.test.ts`). Child B0 touches no Postgres code |

Baseline measured at `aa10481` after `pnpm install --frozen-lockfile`:

| Package | Result |
|---|---|
> **Поправка 2026-08-30.** Пакет переименован из `@aktflow/discovery` в
> `@goproceed/discovery` — он был последним под старой областью имён, потому что
> эта ветка отошла до переименования репозитория. Команды выше уже исправлены.
> Таблица ниже — снимок прогона от 2026-07-26 и оставлена как есть: имена
> `@aktflow/*` в ней были верны на ту дату.

| `@aktflow/domain` | 3 passed |
| `@aktflow/contracts` | 6 passed |
| `@aktflow/testing` | 6 passed |
| `@aktflow/app` | 20 passed, 6 failed (DB-backed) |
| `@aktflow/database` | 4 failed (DB-backed) |

**Definition of green:** the 35 passing unit tests still pass, the 10 DB-backed failures are
unchanged in count and cause, and every `@aktflow/discovery` test passes. A *new* failure
outside `discovery/` means something broke — stop and investigate.

## Layout

| Path | Committed? | What |
|---|---|---|
| `src/` | yes | Normalization, store, triage, gates, export |
| `sources.md` | yes | Verified source registry — nothing is used unless verified here |
| `reply-classification.md` | yes | R1–R11 rules, detection mechanics, label taxonomy (spec only) |
| `experiments.md` | yes | Pre-registered 50-send stop rule, per-trade metric definitions |
| `per-trade-report.md` | yes | Results reported separately by trade, never blended |
| `findings/` | yes | doc 30 §4 findings |
| `artifacts/` | yes | Intermediary one-pager, data terms, artifact checklist, audit scope |
| `evals/replies/` | yes | 15 reply fixtures |
| `discovery.db`, `*.csv`, `drafts/` | **no** | Personal data |

## Commands

```bash
pnpm --filter @goproceed/discovery test
```

```bash
pnpm --filter @goproceed/discovery exec tsc --noEmit
```
