-- The purge that ran nowhere (DEV-036, BL-030).
--
-- WHAT WAS WRONG. The byte-deleting half of INV-047 (apps/app/src/lib/
-- evidence-purge.ts) had no runner: nothing scheduled it, and its only callers
-- were tests. It also had no principal of its own. It connected with
-- SUPABASE_DB_URL and fell back to the local superuser URL, and 0038 granted
-- its four functions to goproceed_worker (formerly aktflow_worker) and
-- service_role — neither of which a deployment can use for it:
--   * goproceed_worker holds app.claim_outbox / complete_outbox / fail_outbox
--     (0008) and is the principal the data-access surface names for future
--     workers; a login on it would carry all of that, against
--     tenancy-and-security.md §Workers («separate roles and separate login
--     credentials per workload»).
--   * goproceed_service is a member of goproceed_app, so a purge credential
--     there would hold every tenant table grant (and 0038 refused it).
--   * service_role is the Data API's key: the four functions sat in the exposed
--     `public` schema as SECURITY DEFINER with a `public` search_path.
--
-- WHAT THIS CHANGES.
--   1. A role for the purge alone, goproceed_purge_worker (NOLOGIN,
--      NOBYPASSRLS), and its login goproceed_purge_worker_login (LOGIN,
--      NOINHERIT, NOBYPASSRLS, member of that role only) — the 0034 pattern.
--      No password here: scripts/set-local-app-password.mjs sets the local
--      one, and infra/README-staging.md the hosted one.
--   2. The four functions move to the unexposed `app` schema with an empty
--      search_path and fully qualified bodies, unchanged in behaviour except
--      that the claim's batch is clamped to 1..200. The `public` versions are
--      dropped: no deployed build calls them (nothing ran the purge), and the
--      pg_cron expiry job is repointed below.
--   3. app.upload_purge_health() — counts only — so the runner can keep
--      alerting after a row stops being claimed (INV-047 «repeated failure
--      alerts»; a row with five failed attempts is never claimed again, so a
--      per-run failure count goes quiet after one red run):
--        exhausted: unpurged rows in the purge queue with 5+ attempts;
--        overdue:   unpurged rows due for more than 24 hours. «Due» is
--                   expires_at for an expired or orphaned intent (an orphan
--                   is always orphaned before its expiry, so this
--                   under-states its wait, never over-states it), and
--                   blocked_at + the workspace's retention for blocked
--                   content.
--   4. EXECUTE on the five to goproceed_purge_worker only; revoked explicitly
--      from PUBLIC, anon, authenticated and service_role (the local stack
--      grants the last three directly at creation).
--
-- The runner is apps/app/app/internal/evidence/purge/route.ts, called by
-- Vercel Cron (apps/app/vercel.json) — the owner's decision on Q-12 for the
-- purge, 2026-09-23. Claim fencing is DEV-037 (0091).
--
-- Rollback (restores 0038's state; the role stays unless no deployment uses it):
--   drop function app.upload_purge_health();
--   recreate public.expire_upload_intents / claim_upload_purge /
--   complete_upload_purge / fail_upload_purge from 0021, 0024 and 0027 with
--   0038's grants, repoint the cron job, then drop the app.* versions.

do $$ begin
  if not exists (select from pg_roles where rolname = 'goproceed_purge_worker') then
    create role goproceed_purge_worker nologin nobypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'goproceed_purge_worker_login') then
    create role goproceed_purge_worker_login login noinherit nobypassrls;
  end if;
end $$;

grant goproceed_purge_worker to goproceed_purge_worker_login;
grant usage on schema app to goproceed_purge_worker;

comment on role goproceed_purge_worker is
  'The evidence purge worker (INV-047). EXECUTE on the five app.*upload*purge* '
  'functions and nothing else: no table, no other function, no other role.';
comment on role goproceed_purge_worker_login is
  'Login for the purge worker only (PURGE_DB_URL). NOINHERIT: it acts only '
  'after SET LOCAL ROLE goproceed_purge_worker.';

-- ---------------------------------------------------------------------------
-- The functions, in app.
-- ---------------------------------------------------------------------------

create function app.expire_upload_intents() returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  with expired as (
    update public.upload_intents
       set status = 'expired', failure_code = coalesce(failure_code, 'intent_expired'),
           version = version + 1
     where status in ('intent_authorized', 'staged', 'integrity_verified', 'scan_pending')
       and expires_at <= now()
    returning 1)
  select count(*) into v_count from expired;
  return v_count;
end $$;

create function app.claim_upload_purge(p_batch integer)
returns table (upload_intent_id uuid, workspace_id uuid, storage_bucket text, storage_key text)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with picked as (
    select i.id
      from public.upload_intents i
      join public.organizations o on o.id = i.workspace_id
     where i.purged_at is null
       and (
            i.status in ('expired', 'orphaned_for_purge')
         or (i.status = 'scan_blocked'
             and i.blocked_at is not null
             and i.blocked_at < now()
                 - make_interval(days => o.blocked_content_retention_days))
       )
       -- A claim older than an hour is treated as abandoned, so a worker that
       -- died mid-batch does not strand the bytes forever.
       and (i.purge_claimed_at is null or i.purge_claimed_at < now() - interval '1 hour')
       and i.purge_attempts < 5
     order by coalesce(i.blocked_at, i.expires_at)
     limit greatest(1, least(coalesce(p_batch, 50), 200))
     for update of i skip locked)
  update public.upload_intents u
     set purge_claimed_at = now()
    from picked
   where u.id = picked.id
  returning u.id, u.workspace_id, u.staging_bucket, u.staging_storage_key;
end $$;

create function app.complete_upload_purge(p_intent uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.upload_intents
     set purged_at = now(), purge_failure = null, version = version + 1
   where id = p_intent and purged_at is null;
end $$;

create function app.fail_upload_purge(p_intent uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- The claim is released so the row is retried, the reason is kept, and THIS
  -- is where the retry budget is spent (0024). At five attempts the row stops
  -- being claimed and app.upload_purge_health counts it until someone acts.
  update public.upload_intents
     set purge_claimed_at = null,
         purge_attempts = purge_attempts + 1,
         purge_failure = left(p_reason, 500)
   where id = p_intent and purged_at is null;
end $$;

create function app.upload_purge_health()
returns table (exhausted integer, overdue integer)
language sql stable security definer set search_path = ''
as $$
  select
    count(*) filter (where i.purge_attempts >= 5)::integer,
    count(*) filter (where
      case when i.status = 'scan_blocked'
           then i.blocked_at + make_interval(days => o.blocked_content_retention_days)
           else i.expires_at
      end < now() - interval '24 hours')::integer
    from public.upload_intents i
    join public.organizations o on o.id = i.workspace_id
   where i.purged_at is null
     and (i.status in ('expired', 'orphaned_for_purge')
          or (i.status = 'scan_blocked' and i.blocked_at is not null
              and i.blocked_at < now()
                  - make_interval(days => o.blocked_content_retention_days)));
$$;

revoke all on function app.expire_upload_intents()          from public, anon, authenticated, service_role;
revoke all on function app.claim_upload_purge(integer)      from public, anon, authenticated, service_role;
revoke all on function app.complete_upload_purge(uuid)      from public, anon, authenticated, service_role;
revoke all on function app.fail_upload_purge(uuid, text)    from public, anon, authenticated, service_role;
revoke all on function app.upload_purge_health()            from public, anon, authenticated, service_role;

grant execute on function app.expire_upload_intents()       to goproceed_purge_worker;
grant execute on function app.claim_upload_purge(integer)   to goproceed_purge_worker;
grant execute on function app.complete_upload_purge(uuid)   to goproceed_purge_worker;
grant execute on function app.fail_upload_purge(uuid, text) to goproceed_purge_worker;
grant execute on function app.upload_purge_health()         to goproceed_purge_worker;

-- ---------------------------------------------------------------------------
-- The in-database expiry schedule follows the function (guarded as 0021 was:
-- pg_cron may be absent and the migration must not fail when it is).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'upload-intent-expiry') then
      perform cron.unschedule('upload-intent-expiry');
    end if;
    perform cron.schedule('upload-intent-expiry', '*/15 * * * *',
      $c$select app.expire_upload_intents()$c$);
  else
    raise notice 'pg_cron unavailable: upload-intent-expiry not scheduled (the purge route expires intents too)';
  end if;
end $$;

drop function public.expire_upload_intents();
drop function public.claim_upload_purge(integer);
drop function public.complete_upload_purge(uuid);
drop function public.fail_upload_purge(uuid, text);
