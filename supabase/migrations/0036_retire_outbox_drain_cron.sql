-- 0036: the bookkeeping drain stops competing with the claim protocol.
--
-- Additive. Unschedules one cron job and withdraws one grant. No table is
-- touched, no row is written, no object is dropped.
--
-- 0005 scheduled `outbox-drain` every 30 seconds against public.drain_outbox,
-- which sets processed_at = now() on every available unprocessed row. It
-- dispatches nothing: the comment 0005 put on the function says so itself.
-- 0008 then built the real protocol — app.claim_outbox takes a lease,
-- app.complete_outbox settles it, app.fail_outbox retries or dead-letters —
-- and its claim predicate is `processed_at is null`.
--
-- Both are live, so the two mechanisms race. The cheap reading is that the
-- cron merely empties a queue nobody consumes yet. The precise reading is
-- worse: drain_outbox has no lease check and no topic filter, so it can mark
-- a row processed while a correct consumer holds a live lease on it, and that
-- consumer's complete_outbox then fails on lease mismatch. The damage is
-- available today, not at the moment a worker is written.
--
-- drain_outbox itself is kept. Deleting it would take supabase/functions/
-- outbox-drain and its suite with it, and that is a separate decision about
-- the Edge Function, not about this race. What changes here is that nothing
-- invokes it on a schedule and no non-superuser role may invoke it at all.
--
-- Rollback:
--   select cron.schedule('outbox-drain', '30 seconds',
--                        $c$select public.drain_outbox(100)$c$);
--   grant execute on function public.drain_outbox(int) to service_role;

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
    else
      raise notice '0036: cron job outbox-drain was already absent';
    end if;
  else
    raise notice '0036: pg_cron extension not available; nothing to unschedule (verify on staging)';
  end if;
end $$;

-- The Edge Function called this over PostgREST with the service-role key.
-- With the schedule gone, that caller is the only remaining way to defeat the
-- lease protocol from outside a superuser session, so the grant goes too.
-- anon/authenticated/public were already revoked by 0005 and stay revoked.
revoke execute on function public.drain_outbox(int) from service_role;

comment on function public.drain_outbox(int) is
  'RETIRED by 0036. Marks outbox rows processed without dispatching them and '
  'without honoring the 0008 lease, so it can settle a row another worker '
  'holds. No schedule and no grant remain; only a superuser session can '
  'execute it. Kept as history rather than dropped because supabase/functions/'
  'outbox-drain and its suite still reference it. The real delivery path is '
  'app.claim_outbox / app.complete_outbox / app.fail_outbox (0008), which '
  'still has no deployed consumer.';
