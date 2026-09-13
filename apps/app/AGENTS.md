<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## GoProceed app

This is the BFF: the `/v1` and `/external` routes, the office dashboard and the PWA field client. The repository rules in the root `AGENTS.md` apply here, including required independent review. Tenancy and database principals are described in `docs/architecture/tenancy-and-security.md`. UI work follows `docs/design/02-building-ui.md`.

**Integration tests and the local database.** Only the integration suites under `tests/*.int.test.ts` that check database credentials skip themselves. They check in one of two ways:

- through `hasIsolatedDatabaseCredentials()` in `tests/helpers/fixtures.ts`, which needs `APP_DB_URL`, `SERVICE_DB_URL` and `TEST_DB_ADMIN_URL`;
- through an inline check of their own, and some of those test only `APP_DB_URL` and `SERVICE_DB_URL`.

The others use the local stack and most of them truncate tenant tables. The stack means Postgres on `127.0.0.1:54322`, either hard-coded or through the `ADMIN_URL` fallback, plus, depending on the suite, the Storage API on `127.0.0.1:54321`.

- Running `pnpm --filter @goproceed/app test` while the stack is up erases local data.
- A skipped suite is not a passing one.

The browser harness (`pnpm --filter @goproceed/app qa`) needs `apps/app/.env.local`. It must contain the local database URLs and `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, because those are inlined at build time. The file is gitignored, so a fresh worktree has none.
