-- Least-privilege application roles + schema/table grants.
-- aktflow_app: NOLOGIN group role used via `set local role` by the BFF connection.
-- aktflow_app_login: LOGIN role (dev-only password below) that is a member of
-- aktflow_app; the BFF connects as this role, then `set local role aktflow_app`
-- for the duration of a request so RLS policies (scoped to aktflow_app) apply.
do $$ begin
  if not exists (select from pg_roles where rolname = 'aktflow_app') then
    create role aktflow_app nologin nobypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'aktflow_app_login') then
    create role aktflow_app_login login noinherit nobypassrls;
  end if;
end $$;
grant aktflow_app to aktflow_app_login;

-- SECURITY: aktflow_app_login intentionally gets NO password here. Membership
-- in aktflow_app IS full tenant-table read/write privilege (app.actor_user_id
-- is a plain session GUC any authenticated connection can set via `set local
-- role aktflow_app`), so this credential is top-tier and must never be a
-- known/shared value on anything reachable from the internet.
--
-- A DEFAULT `supabase db push` (staging/prod) runs ONLY this file — the
-- role is created LOGIN-capable but with a NULL password, so nothing can
-- password-authenticate as it until an operator sets a real secret
-- (infra/README-staging.md §3, mandatory before any app deploy connects).
--
-- `supabase db reset` (local/CI) additionally applies supabase/seed.sql,
-- which sets a fixed dev-only password there — never in a migration.
-- That password is NOT unreachable from a real project in every case,
-- though: `supabase db push --include-seed`, `supabase db reset --linked
-- --include-seed`, and Supabase Branching preview branches (automatic,
-- no flag) all apply seed.sql. See supabase/seed.sql and
-- infra/README-staging.md §3 for the do-not-run list this implies.
create schema if not exists app;
grant usage on schema app to aktflow_app;

grant usage on schema public to aktflow_app;
create schema if not exists api;
grant usage on schema api to aktflow_app, authenticated;

-- Supabase's local stack applies `alter default privileges ... grant all on
-- tables to anon, authenticated, service_role` in schema public, so every
-- table created by the (postgres-owned) migration runner inherits ALL
-- privileges for anon/authenticated at creation time. That silently defeats
-- the least-privilege allowlist below for any table that isn't
-- RLS-protected against those roles (audit_events, transaction_outbox,
-- idempotency_records have no RLS policies in this slice). Strip it back to
-- nothing before applying the explicit allowlist below. service_role is left
-- untouched: it has rolbypassrls=true and is the trusted server-side key,
-- never exposed to the browser.
revoke all on public.organizations, public.legal_entities, public.memberships,
  public.audit_events, public.transaction_outbox, public.idempotency_records
  from public, anon, authenticated;
revoke all on sequence public.audit_events_id_seq from public, anon, authenticated;

-- least-privilege table grants (allowlist; extend per technical/data-access-surface.csv)
grant select, insert, update on public.organizations to aktflow_app;
grant select, insert on public.legal_entities to aktflow_app;
grant select, insert, update on public.memberships to aktflow_app;
grant select, insert on public.audit_events to aktflow_app;
grant usage on sequence public.audit_events_id_seq to aktflow_app;
-- INSERT-only per data-access-surface.csv DA-099: the BFF may only enqueue event
-- intents; reading/draining them belongs to aktflow_worker (DA-058).
grant insert on public.transaction_outbox to aktflow_app;
grant select, insert on public.idempotency_records to aktflow_app;

-- actor helper
create or replace function app.current_actor() returns uuid
language sql stable as $$
  select nullif(current_setting('app.actor_user_id', true), '')::uuid
$$;

-- SECURITY DEFINER so the membership-bootstrap policy can check whether an org
-- already has members WITHOUT being narrowed by memberships' own RLS.
create or replace function app.org_has_members(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where organization_id = org)
$$;
revoke all on function app.org_has_members(uuid) from public;
grant execute on function app.org_has_members(uuid) to aktflow_app;
