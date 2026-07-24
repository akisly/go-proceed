-- Transactional-outbox drain: proves the enqueue -> durable-drain mechanism
-- for slice 1. There is no real consumer yet (nothing subscribes to drained
-- topics); this migration only marks rows processed_at so the mechanism is
-- exercised end to end. Rows are retained (not deleted) - draining is
-- honest bookkeeping, not delivery, until a real consumer exists.
--
-- aktflow_app has INSERT-ONLY on public.transaction_outbox (see
-- 0003_roles_and_grants.sql, data-access-surface.csv DA-099); SELECT/UPDATE
-- belong to aktflow_worker (DA-058), which is not provisioned as a login
-- role in this slice. drain_outbox is SECURITY DEFINER, owned by the
-- migration role (which already has SELECT/UPDATE as the table's owner), so
-- it can read/update the outbox without widening aktflow_app's grants or
-- creating a worker role ahead of the task that actually needs one.

-- pg_cron requires shared_preload_libraries=pg_cron. That's true on the
-- local Supabase image and on Supabase-hosted staging/production, but this
-- migration must still apply cleanly (`supabase db reset`) on an image
-- where it is absent, so the extension is created defensively and every
-- downstream cron.* call is guarded on its actual presence rather than
-- assumed.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron extension could not be created (%): outbox-drain cron schedule will be skipped', sqlerrm;
  end;
end $$;

create or replace function public.drain_outbox(batch int default 100)
returns int
language sql
security definer
set search_path = public
as $$
  with picked as (
    select id from public.transaction_outbox
    where processed_at is null and available_at <= now()
    order by available_at
    limit batch
    for update skip locked
  ), upd as (
    update public.transaction_outbox o set processed_at = now()
    from picked where o.id = picked.id
    returning 1
  )
  select count(*)::int from upd
$$;

comment on function public.drain_outbox(int) is
  'Slice-1 outbox drain: marks up to `batch` oldest available, unprocessed '
  'rows processed_at=now() using FOR UPDATE SKIP LOCKED so concurrent '
  'drainers never double-process the same row. At-least-once semantics '
  'only: no consumer dispatch, no attempt_count increment, no retry/'
  'backoff or dead-letter path yet - tracked as follow-up once a real '
  'consumer lands (spec S4.5).';

-- EXECUTE is PUBLIC by default on function creation in Postgres, and the
-- local Supabase stack's default privileges additionally grant EXECUTE on
-- every new public-schema function directly to anon and authenticated at
-- creation time (the same trap 0003_roles_and_grants.sql calls out for
-- tables) - revoking from PUBLIC alone does not strip those. Revoke from
-- all three explicitly and grant only to the roles that actually invoke
-- this: pg_cron jobs run as the role that scheduled them (postgres, a
-- superuser, so grants don't gate it), and the outbox-drain Edge Function
-- calls it over PostgREST using the service-role key. Browser-reachable
-- roles (anon, authenticated) must never be able to drain the outbox
-- directly.
revoke all on function public.drain_outbox(int) from public, anon, authenticated;
grant execute on function public.drain_outbox(int) to service_role;

-- Schedule the drain. Guarded on pg_cron actually being installed (see
-- above); re-running this block is safe because cron.schedule() upserts by
-- job name (same jobid, updated command/schedule) - but an explicit
-- unschedule-then-reschedule is used anyway to make that re-runnability
-- obvious rather than relying on unstated upsert behavior.
do $$
declare
  has_pg_cron boolean;
  job_exists boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_pg_cron;

  if has_pg_cron then
    select exists (select 1 from cron.job where jobname = 'outbox-drain') into job_exists;
    if job_exists then
      perform cron.unschedule('outbox-drain');
    end if;

    -- Every 30 seconds; adjust interval as real load appears.
    perform cron.schedule('outbox-drain', '30 seconds', $c$select public.drain_outbox(100)$c$);
  else
    raise notice 'pg_cron extension not available: outbox-drain cron job was not scheduled (verify on staging)';
  end if;
end $$;
