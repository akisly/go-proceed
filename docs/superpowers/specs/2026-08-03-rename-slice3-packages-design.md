# Rename slice 3 — the workspace identifiers — design

**Date:** 2026-08-03
**Branch:** `claude/rename-slice3-packages`, from `claude/docs-slice2-archive` @ `d59fa17`
**Slice:** the fourth of the restructure, and the first that renames rather than moves.
**Corrections:** this is a point-in-time record of what was believed when the slice was scoped, and several of its counts were later measured to be wrong or to rest on an unstated counting rule. They are deliberately not edited here. [The gate record](../plans/evidence/2026-08-03-rename-slice3-gate.md) carries every corrected figure with the command that reproduces it, and is the authority where the two disagree.

## What this slice is, and what it deliberately is not

The owner ruled on 2026-08-03 that the product is GoProceed. `apps/mobile`'s deep-link
scheme was corrected immediately because it had just landed; nothing else followed.
`README.md:19` already asserts "**Product name is GoProceed.** `AktFlow` survives only
as legacy history" — which is false today, and is the same class of claim slices 0
through 2 existed to remove.

The rename is not one job. Measuring it separates three, and this slice takes exactly
one of them:

| | Surface | This slice |
|---|---|---|
| **Identifiers** | 10 `@aktflow/*` workspace packages, the root package name, one CSS class | **yes** |
| **Database roles** | `aktflow_app`, `aktflow_app_login`, `aktflow_worker`, `aktflow_service`, `aktflow_service_login` — 351 + 44 + 36 + 30 + 29 occurrences | no |
| **Product copy** | 89 `AktFlow` occurrences including user-visible UI, four domains, two `AKTFLOW_*` env vars | no |

**The roles are excluded by a standing owner ruling.** `ALTER ROLE … RENAME TO` is not
a text substitution: it clears an md5-hashed password, every connection string and CI
secret must move in the same window, and the migration runs against an environment
whose app is already connected under the old name. That is a deployment-ordering
problem with its own rollback story.

**Product copy is excluded because it is a different kind of work.** The 89 occurrences
include `<h1>AktFlow — вхід</h1>` in the login page and
`<title>AktFlow — демонстраційний прототип</title>` in the demo. That is Ukrainian and
English product copy that no tool can verify — a question about what a person should
see, not about what compiles. Mixing it with a mechanical refactor would mean neither
gets the review it needs.

## The boundary, measured rather than assumed

Six identifiers look like they belong and do not. They were checked individually:

- `aktflow_platform_billing`, `aktflow_support`, `aktflow_external`,
  `aktflow_audit_writer` are **role names** in `technical/data-access-surface.csv` and
  `technical/permissions.csv` — planned v2.9 roles, not created by any migration, but
  role identifiers all the same.
- `aktflow_requirement` and `aktflow_control` are **CSV column headers** in
  `technical/mobile-security-profile.csv` and `technical/asvs-profile.csv`.
  `scripts/validate_package.py` asserts those header sets by name through
  `read_csv_contract(required_headers=…)`, so renaming a column reds the build.

All six live under `technical/`, whose own slice has not happened yet. None is touched.

`prototype/package.json` is named `aktflow-product-prototype`. It is not an
`@aktflow/*` package, `prototype/` carries disposition `keep`, and no workspace
depends on it. Not touched.

## What changes

**Ten package names**, `@aktflow/X` → `@goproceed/X`: `app`, `demo`, `landing`,
`mobile`, `contracts`, `database`, `domain`, `testing`, `tokens`, `ui`. Plus the root
`package.json`'s `"name": "aktflow"` → `"goproceed"`.

**One CSS class**, `aktflow-app` → `goproceed-app`, defined at
`apps/demo/src/styles/theme.css:251` and used in nine other files plus
`.interface-design/system.md`.

**Directories do not move.** `packages/contracts/` stays `packages/contracts/`. Only
the `name` field and the specifiers that reference it change, which is what keeps the
lockfile edit tractable.

### The measured surface

**74 files** contain `@aktflow/` or the root name:

| Kind | Count |
|---|---|
| source (`.ts`, `.tsx`, `.js`, `.mjs`) | 56 |
| `package.json` | 11 |
| Markdown (`TODOS.md`, `apps/demo/README.md`, `infra/README-staging.md`) | 3 |
| `.github/workflows/ci.yml` | 1 |
| `apps/demo/vercel.json` | 1 |
| `packages/ui/src/base.css` | 1 |
| `pnpm-lock.yaml` | 1 |

Plus **11 files** carrying the `aktflow-app` CSS class.

`TODOS.md:324` records this as 10 `package.json` files and 55 source files. The
difference is a counting rule, not a disagreement: 11 includes the root
`package.json`, whose name is `aktflow` rather than `@aktflow/*`, and 56 counts one
file that names a package only in a comment.

**Two sites are easy to miss and would fail outside the test suite.**
`apps/demo/vercel.json:3` carries
`"buildCommand": "cd ../.. && pnpm turbo run build --filter=@aktflow/demo"` — a
deployment configuration, so a stale filter breaks the Vercel build rather than CI.
And `.github/workflows/ci.yml` mixes both worlds: lines 22, 25 and 65 are **role
names inside connection strings** and must not change, while lines 72-73 and 142-146
are package names and must. That file is edited by hand, never by substitution.

## The lockfile, and what cannot be proven here

`pnpm-lock.yaml` carries nine `importers:` entries keyed by package name, each of the
form:

```yaml
      '@aktflow/contracts':
        specifier: workspace:*
        version: link:../../packages/contracts
```

Only the key changes. `specifier` and the `link:` path are unaffected because no
directory moves. The edit is mechanical and structurally checkable — but
`pnpm install --frozen-lockfile`, which is what CI runs and what would actually
validate it, cannot run in this checkout: `exceljs@4.4.0` is declared and
lockfile-present but absent from the installed tree, and pnpm will only reconcile by
purging and rebuilding node_modules across all 11 workspace projects. The owner ruled
on 2026-08-03 to hand-edit and let CI prove it.

**So this slice ships one claim it cannot verify locally, and says so.** That is the
same treatment slices 1 and 2 gave their unprovable checks, and the gate record must
name the exact command that would settle it.

## How this slice is verified

Three checks are genuinely local, and they are the argument:

1. **Static consistency, which is the strongest of the three.** Every `@goproceed/X`
   import specifier resolves to a package whose `package.json` declares that name;
   every lockfile `importers:` key matches a declared name; every `link:` path is
   byte-identical to before; and zero `@aktflow/` references survive outside the
   excluded sets. A rename is exactly the kind of change where a mechanical
   cross-check beats a passing test, because a missed reference is a resolution
   failure rather than a wrong answer.
2. **Per-package `tsc --noEmit`.** Nine of the ten packages carry a `tsconfig.json` —
   `packages/ui` is the exception — and of those nine, `apps/app` and `packages/domain`
   declare `exceljs` and cannot resolve. That leaves seven candidates. Two were run on
   2026-08-03 and exit 0: `packages/tokens` and `packages/contracts`. The plan must
   establish which of the remaining five actually run before relying on them, rather
   than assuming a `tsconfig.json` means a working typecheck. Typecheck is what
   catches a broken import specifier, so this is the check worth spending time on.
3. **`packages/testing/src/token-fidelity.test.ts`**, the one suite that needs neither
   a database nor the missing package. Its full suite hangs on the RLS fixtures.

**Not proven, and recorded as such:** `pnpm install --frozen-lockfile`,
`pnpm turbo run typecheck`, `pnpm turbo run test`, `pnpm turbo run build`, and the
Vercel build that reads `vercel.json`. CI is the proof for all five, and CI has never
run on this stack — nothing has been pushed across four slices.

## The claim that becomes true

`README.md:19` says `AktFlow` survives only as legacy history. After this slice it is
still false, because the roles and the product copy remain. The honest move is to
correct that sentence here to say what is actually true — the identifiers have moved,
the roles and the user-facing copy have not — rather than leave a claim that this
slice makes *look* closer to true without making it so.

## Out of scope

The five PostgreSQL roles and everything that names them. The 89 `AktFlow` prose
occurrences, including all user-visible UI. The four domains `aktflow.app`,
`aktflow.com`, `aktflow.example`, `aktflow.pilot`. `AKTFLOW_CHROME_PATH` and
`AKTFLOW_BASE_URL`. `aktflow-product-prototype`. Everything under `technical/`,
`docs/legacy/` and `migration/`. The `technical/` layer's own restructure, which needs
a product ruling on whether the v2.9 contract is retired before it can be scoped.
