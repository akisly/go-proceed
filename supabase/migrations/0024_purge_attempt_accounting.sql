-- 0024: correction from the pre-landing review of v0.1-M2-A.
--
-- Additive. Replaces two functions from 0021; nothing is dropped.
--
-- Why: purge_attempts was incremented when a row was CLAIMED, before any
-- storage call. A worker that died between claiming and deleting burned a
-- retry it never spent, and five such deaths excluded the row permanently with
-- purge_failure still null — bytes that should be gone, silently unattended,
-- and not even visible as a failure.
--
-- The budget now counts attempts that actually failed. A crashed worker leaves
-- the claim behind instead, and 0021's one-hour reclaim window is what brings
-- the row back. That window is the throttle; the counter is the give-up rule,
-- and conflating the two meant neither worked.
--
-- Rollback (dev only): restore the 0021 bodies.

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
     set purge_claimed_at = now()
    from picked
   where u.id = picked.id
  returning u.id, u.workspace_id, u.staging_bucket, u.staging_storage_key;
end $$;

create or replace function public.fail_upload_purge(p_intent uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- The claim is released so the row is retried, the reason is kept, and THIS
  -- is where the retry budget is spent — a deletion was attempted and it
  -- failed. Once purge_attempts reaches 5 the row stops being claimed and
  -- stands as an operational alert with a reason attached, rather than a silent
  -- exclusion.
  update public.upload_intents
     set purge_claimed_at = null,
         purge_attempts = purge_attempts + 1,
         purge_failure = p_reason
   where id = p_intent and purged_at is null;
end $$;

revoke all on function public.claim_upload_purge(integer) from public;
revoke all on function public.fail_upload_purge(uuid, text) from public;
