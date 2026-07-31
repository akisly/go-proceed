-- 0034: the service principal.
--
-- Additive. Creates two roles and one membership edge. Enforces nothing — 0035
-- does that, once the application already speaks through this identity.
--
-- Why a second LOGIN and not `set local role` on the existing one: role
-- membership is what makes this a boundary instead of a convention.
-- aktflow_app_login is a member of aktflow_app and nothing else, so SQL
-- injected into any ordinary route runs on a connection that CANNOT reach the
-- service role. Reusing the application login would leave the same injected SQL
-- free to issue the very `set local role` the application uses.
--
-- aktflow_service is a member of aktflow_app rather than a parallel grant
-- surface. The server is the application plus the right to speak for itself,
-- and duplicating grants would mean every future table grant had to be made
-- twice — a divergence nobody would notice until a policy quietly stopped
-- applying.
--
-- No password here, for the same reason 0003 sets none: a default
-- `supabase db push` runs migrations only, and must never plant a credential.
-- Local and CI get one from scripts/set-local-app-password.mjs; staging and
-- production get one from an operator (infra/README-staging.md §3).
do $$ begin
  if not exists (select from pg_roles where rolname = 'aktflow_service') then
    create role aktflow_service nologin nobypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'aktflow_service_login') then
    create role aktflow_service_login login noinherit nobypassrls;
  end if;
end $$;

grant aktflow_app to aktflow_service;
grant aktflow_service to aktflow_service_login;

comment on role aktflow_service is
  'The server''s own identity. Everything aktflow_app can do, plus the right to '
  'record what the server observed — inspection verdicts and server-sourced '
  'capture events. Unreachable from aktflow_app_login by design.';
