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

-- Dev-only password so packages/testing can connect as aktflow_app_login.
-- Staging/prod must set this via a managed secret, not a migration.
alter role aktflow_app_login password 'app_pw';

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
grant select, insert, update on public.transaction_outbox to aktflow_app;
grant select, insert on public.idempotency_records to aktflow_app;

-- actor helper
create or replace function app.current_actor() returns uuid
language sql stable as $$
  select nullif(current_setting('app.actor_user_id', true), '')::uuid
$$;
