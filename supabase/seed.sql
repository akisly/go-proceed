-- Seed two auth users for tests (AUTH_USER_A / AUTH_USER_B).
insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a@example.test','authenticated','authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','b@example.test','authenticated','authenticated')
on conflict (id) do nothing;

-- Dev-only password for aktflow_app_login (packages/testing/src/pg.ts,
-- .github/workflows/ci.yml, apps/app/.env.example all assume 'app_pw'
-- locally). This file is applied by `supabase db reset`/`supabase start`
-- (local + CI) by default. A DEFAULT `supabase db push` (the documented
-- staging/prod path) does NOT apply seed.sql — but seed.sql is NOT
-- unreachable from a real project in general: `supabase db push
-- --include-seed`, `supabase db reset --linked --include-seed`, and
-- (automatically, no flag needed) Supabase Branching preview branches all
-- apply this file. Never run the first two flag combinations against
-- staging/production, and if Branching is ever enabled for this project,
-- set `[db.seed] enabled = false` in `supabase/config.toml` first — with
-- it left `true`, every preview branch gets reseeded with the password
-- below on an internet-reachable database. Because of these paths, this
-- file must never contain a credential that is meant to stay secret. See
-- supabase/migrations/0003_roles_and_grants.sql and
-- infra/README-staging.md §3 for the staging equivalent, which is a
-- freshly generated secret set by hand, never committed.
alter role aktflow_app_login password 'app_pw';
