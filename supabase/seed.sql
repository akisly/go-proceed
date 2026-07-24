-- Seed two auth users for tests (AUTH_USER_A / AUTH_USER_B).
insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a@example.test','authenticated','authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','b@example.test','authenticated','authenticated')
on conflict (id) do nothing;

-- Dev-only password for aktflow_app_login (packages/testing/src/pg.ts,
-- .github/workflows/ci.yml, apps/app/.env.example all assume 'app_pw'
-- locally). This file is ONLY applied by `supabase db reset`/`supabase
-- start` (local + CI) — `supabase db push` (staging/prod) does not run
-- seed.sql, so this known password can never land on a real project. See
-- supabase/migrations/0003_roles_and_grants.sql and
-- infra/README-staging.md §2 for the staging equivalent, which is a
-- freshly generated secret set by hand, never committed.
alter role aktflow_app_login password 'app_pw';
