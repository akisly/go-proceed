-- Seed two auth users for tests (AUTH_USER_A / AUTH_USER_B).
insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a@example.test','authenticated','authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','b@example.test','authenticated','authenticated')
on conflict (id) do nothing;

-- The dev-only aktflow_app_login password is NOT set here. seed.sql can be
-- applied to reachable databases (supabase db push --include-seed, db reset
-- --linked --include-seed, and Branching preview reseeds), so it must never
-- contain credentials. Local/CI setup runs `pnpm db:local-credentials`
-- (scripts/set-local-app-password.mjs), which refuses non-local hosts.
-- Staging/production passwords stay hand-set per infra/README-staging.md §3.
