-- 0007_idempotency_expiry.sql
-- v0.0 gate (docs/delivery/version-0.0.md): idempotency expiry is enforced,
-- not just stored. The app role deliberately has no DELETE grant; removing
-- exactly one expired matching row goes through a SECURITY DEFINER command
-- the caller can only aim at its own actor scope (mirrors the 0006 RLS).
create or replace function app.delete_expired_idempotency(
  p_org uuid, p_scope text, p_op text, p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare deleted int;
begin
  if p_scope <> 'user:' || app.current_actor()::text then
    return false;
  end if;
  delete from public.idempotency_records
   where organization_id is not distinct from p_org
     and actor_scope = p_scope and operation_id = p_op
     and idempotency_key = p_key and expires_at <= now();
  get diagnostics deleted = row_count;
  return deleted > 0;
end $$;
revoke all on function app.delete_expired_idempotency(uuid, text, text, text) from public, anon, authenticated;
grant execute on function app.delete_expired_idempotency(uuid, text, text, text) to aktflow_app;

-- Bulk purge for scheduled maintenance (cron/service only, never browser roles).
create or replace function app.purge_expired_idempotency(batch int default 1000) returns int
language sql security definer set search_path = public as $$
  with del as (
    delete from public.idempotency_records
     where id in (select id from public.idempotency_records
                  where expires_at <= now() limit batch)
    returning 1)
  select count(*)::int from del
$$;
revoke all on function app.purge_expired_idempotency(int) from public, anon, authenticated;
grant execute on function app.purge_expired_idempotency(int) to service_role;

do $$
declare has_pg_cron boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_pg_cron;
  if has_pg_cron then
    if exists (select 1 from cron.job where jobname = 'idempotency-purge') then
      perform cron.unschedule('idempotency-purge');
    end if;
    perform cron.schedule('idempotency-purge', '17 3 * * *', $c$select app.purge_expired_idempotency(5000)$c$);
  else
    raise notice 'pg_cron not available: idempotency-purge not scheduled';
  end if;
end $$;
