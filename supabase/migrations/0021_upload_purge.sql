-- 0021: orphan purge for upload intents (INV-047).
--
-- Additive. Adds bookkeeping columns to public.upload_intents and the claim /
-- complete / fail functions a purge worker uses.
--
-- NOT built on the transaction outbox, which the engineering review found
-- unusable for this (finding D4): public.drain_outbox marks every claimed row
-- processed on a 30-second schedule with no topic filter and no dispatch, so a
-- purge request would be marked done while the bytes lived on. Coupling the two
-- would also tie unrelated lifecycles — purge has its own retry budget and its
-- own failure queue, and a shared drainer has neither.
--
-- Byte deletion cannot happen inside PostgreSQL, so the loop is: this database
-- decides WHAT to purge and records the outcome; a worker holding storage
-- credentials does the deleting.
--
-- Rollback (dev only): drop the functions and columns, unschedule the cron job.

alter table public.upload_intents
  add column purge_claimed_at timestamptz,
  add column purged_at        timestamptz,
  add column purge_attempts   integer not null default 0,
  add column purge_failure    text;

create index upload_intents_purge_queue_idx
  on public.upload_intents (status, purge_claimed_at)
  where purged_at is null and status in ('expired', 'orphaned_for_purge');

-- ---------------------------------------------------------------------------
-- An intent that was authorized but never finalized stops being usable at its
-- expiry. Marking it is pure SQL, so it runs in-database on a schedule.
--
-- scan_blocked is deliberately NOT swept here: blocked content follows
-- restricted retention and remediation (files-and-storage.md), which is a
-- different policy from "the caller never came back".
-- ---------------------------------------------------------------------------
create or replace function public.expire_upload_intents() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
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

-- ---------------------------------------------------------------------------
-- The purge worker's claim/complete/fail cycle.
--
-- Not granted to aktflow_app: purging is a system action across tenants, and a
-- member-facing role must not be able to trigger byte deletion in another
-- workspace. The worker connects with elevated credentials, as the outbox drain
-- does.
-- ---------------------------------------------------------------------------
create or replace function public.claim_upload_purge(batch integer default 50)
returns table (
  upload_intent_id uuid,
  workspace_id uuid,
  storage_bucket text,
  storage_key text
)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query
  with picked as (
    select i.id
      from public.upload_intents i
     where i.purged_at is null
       and i.status in ('expired', 'orphaned_for_purge')
       -- A claim older than an hour is treated as abandoned, so a worker that
       -- died mid-batch does not strand the bytes forever.
       and (i.purge_claimed_at is null or i.purge_claimed_at < now() - interval '1 hour')
       and i.purge_attempts < 5
     order by i.expires_at
     limit batch
     for update skip locked)
  update public.upload_intents u
     set purge_claimed_at = now(), purge_attempts = u.purge_attempts + 1
    from picked
   where u.id = picked.id
  returning u.id, u.workspace_id, u.staging_bucket, u.staging_storage_key;
end $$;

create or replace function public.complete_upload_purge(p_intent uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.upload_intents
     set purged_at = now(), purge_failure = null, version = version + 1
   where id = p_intent and purged_at is null;
end $$;

create or replace function public.fail_upload_purge(p_intent uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- The claim is released so the row is retried, and the reason is kept. Once
  -- purge_attempts reaches 5 the row stops being claimed and stands as an
  -- operational alert: bytes that should be gone and are not.
  update public.upload_intents
     set purge_claimed_at = null, purge_failure = p_reason
   where id = p_intent and purged_at is null;
end $$;

revoke all on function public.expire_upload_intents() from public;
revoke all on function public.claim_upload_purge(integer) from public;
revoke all on function public.complete_upload_purge(uuid) from public;
revoke all on function public.fail_upload_purge(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- Schedule the expiry sweep. Guarded exactly as 0005 guards the outbox drain:
-- pg_cron may be absent locally and the migration must not fail when it is.
--
-- Only the expiry marking is scheduled here. Byte deletion needs storage
-- credentials, so wiring the worker is an operations step, recorded as such
-- rather than claimed as done.
-- ---------------------------------------------------------------------------
do $$
declare
  has_pg_cron boolean;
  job_exists boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_pg_cron;
  if has_pg_cron then
    select exists (select 1 from cron.job where jobname = 'upload-intent-expiry') into job_exists;
    if job_exists then
      perform cron.unschedule('upload-intent-expiry');
    end if;
    perform cron.schedule('upload-intent-expiry', '*/15 * * * *',
      $c$select public.expire_upload_intents()$c$);
  else
    raise notice 'pg_cron unavailable: upload-intent-expiry not scheduled (verify on staging)';
  end if;
end $$;
