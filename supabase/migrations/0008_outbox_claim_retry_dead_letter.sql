-- 0008_outbox_claim_retry_dead_letter.sql
-- v0.0 gate: real claim/retry/backoff/error/dead-letter paths
-- (docs/architecture/jobs-events-and-audit.md). drain_outbox (0005) remains
-- untouched for compatibility; the lease-based protocol below is what a real
-- consumer uses. Retry policy v0.0-1 pinned in app.fail_outbox: base 30s,
-- multiplier 2, cap 1 hour, max 5 attempts.

alter table public.transaction_outbox
  add column if not exists claimed_by text,
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_error text;

create table if not exists public.outbox_dead_letters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  outbox_id uuid not null references public.transaction_outbox(id),
  reason text not null,
  attempts int not null,
  first_failed_at timestamptz,
  last_failed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (outbox_id)
);
revoke all on public.outbox_dead_letters from public, anon, authenticated;

-- Dead letters are append-only failure evidence (never silently dropped or
-- reset to make a dashboard green).
create trigger outbox_dead_letters_append_only
  before update or delete on public.outbox_dead_letters
  for each row execute function app.reject_mutation();

do $$ begin
  if not exists (select from pg_roles where rolname = 'aktflow_worker') then
    create role aktflow_worker nologin nobypassrls;
  end if;
end $$;
grant usage on schema app to aktflow_worker;
grant usage on schema public to aktflow_worker;
grant select on public.outbox_dead_letters to aktflow_worker;

create or replace function app.claim_outbox(p_batch int, p_worker text, p_lease_seconds int)
returns setof public.transaction_outbox
language sql security definer set search_path = public as $$
  with picked as (
    select id from public.transaction_outbox
    where processed_at is null and available_at <= now()
      and (lease_expires_at is null or lease_expires_at < now())
    order by available_at
    limit p_batch
    for update skip locked)
  update public.transaction_outbox o
     set claimed_by = p_worker,
         lease_token = gen_random_uuid(),
         lease_expires_at = now() + make_interval(secs => p_lease_seconds)
    from picked where o.id = picked.id
  returning o.*
$$;

create or replace function app.complete_outbox(p_id uuid, p_lease uuid) returns void
language plpgsql security definer set search_path = public as $$
declare updated int;
begin
  update public.transaction_outbox
     set processed_at = now(), lease_expires_at = null
   where id = p_id and lease_token = p_lease and processed_at is null;
  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'outbox complete rejected: lease mismatch or already processed for %', p_id;
  end if;
end $$;

create or replace function app.fail_outbox(p_id uuid, p_lease uuid, p_error text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.transaction_outbox; updated int;
begin
  update public.transaction_outbox
     set attempt_count = attempt_count + 1,
         last_error = left(p_error, 500),
         lease_expires_at = null,
         available_at = now() + least(interval '1 hour',
           make_interval(secs => 30 * (2 ^ attempt_count)))
   where id = p_id and lease_token = p_lease and processed_at is null
   returning * into r;
  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'outbox fail rejected: lease mismatch or already processed for %', p_id;
  end if;
  if r.attempt_count >= 5 then
    insert into public.outbox_dead_letters (organization_id, outbox_id, reason, attempts, first_failed_at)
    values (r.organization_id, p_id, left(p_error, 500), r.attempt_count, r.created_at)
    on conflict (outbox_id) do nothing;
    update public.transaction_outbox set processed_at = now() where id = p_id;
  end if;
end $$;

revoke all on function app.claim_outbox(int, text, int) from public, anon, authenticated;
revoke all on function app.complete_outbox(uuid, uuid) from public, anon, authenticated;
revoke all on function app.fail_outbox(uuid, uuid, text) from public, anon, authenticated;
grant execute on function app.claim_outbox(int, text, int) to aktflow_worker, service_role;
grant execute on function app.complete_outbox(uuid, uuid) to aktflow_worker, service_role;
grant execute on function app.fail_outbox(uuid, uuid, text) to aktflow_worker, service_role;
