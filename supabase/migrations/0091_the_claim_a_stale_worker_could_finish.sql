-- The claim a stale worker could finish (DEV-037, BL-031).
--
-- WHAT WAS WRONG. app.claim_upload_purge marked a row with a timestamp only,
-- and a claim older than an hour is reclaimable (0021). app.complete_upload_purge
-- and app.fail_upload_purge took only the intent id. So a worker that stalled
-- past the hour and resumed could finish a row another worker had since
-- claimed: its fail cleared the newer claim and spent the newer worker's retry
-- budget. The runner that now exists (DEV-036: Vercel Cron) delivers
-- best-effort, may deliver a run twice, and lets runs overlap
-- (https://vercel.com/docs/cron-jobs/manage-cron-jobs, 2026-08-11).
--
-- WHAT THIS CHANGES. Each claim carries a token, and only the holder of the
-- current token can finish it:
--   * upload_intents.purge_claim_token uuid, null unless the row is claimed
--     (CHECK upload_intents_purge_claim_token_needs_claim); every existing row
--     has null, so the check holds on arrival;
--   * app.claim_upload_purge sets a fresh token on every claim and reclaim, and
--     returns it;
--   * app.complete_upload_purge(intent, token) and
--     app.fail_upload_purge(intent, token, reason) apply only where the token
--     matches and the row is unpurged, and return whether they applied; both
--     clear the token. A null token matches nothing.
-- The one-argument signatures are dropped: only this branch's worker called
-- them, and it moves in the same commit. Grants as 0090: the purge role only.
--
-- A stale worker still deletes the bytes it was deleting. That is harmless:
-- keys are two random UUIDs, never reused, and no transition returns a queued
-- row to a live state; removing an absent object is not an error.
--
-- Rollback: drop the three functions, recreate 0090's, drop the column and
-- its check.

alter table public.upload_intents
  add column purge_claim_token uuid,
  add constraint upload_intents_purge_claim_token_needs_claim
    check (purge_claim_token is null or purge_claimed_at is not null);

drop function app.claim_upload_purge(integer);
drop function app.complete_upload_purge(uuid);
drop function app.fail_upload_purge(uuid, text);

create function app.claim_upload_purge(p_batch integer)
returns table (upload_intent_id uuid, workspace_id uuid, storage_bucket text, storage_key text,
               claim_token uuid)
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
       -- died mid-batch does not strand the bytes forever. The reclaim issues a
       -- new token, which is what stops the old worker from finishing it.
       and (i.purge_claimed_at is null or i.purge_claimed_at < now() - interval '1 hour')
       and i.purge_attempts < 5
     order by coalesce(i.blocked_at, i.expires_at)
     limit greatest(1, least(coalesce(p_batch, 50), 200))
     for update of i skip locked)
  update public.upload_intents u
     set purge_claimed_at = now(), purge_claim_token = gen_random_uuid()
    from picked
   where u.id = picked.id
  returning u.id, u.workspace_id, u.staging_bucket, u.staging_storage_key, u.purge_claim_token;
end $$;

create function app.complete_upload_purge(p_intent uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_applied boolean;
begin
  update public.upload_intents
     set purged_at = now(), purge_failure = null, purge_claim_token = null,
         version = version + 1
   where id = p_intent and purge_claim_token = p_token and purged_at is null
  returning true into v_applied;
  return coalesce(v_applied, false);
end $$;

create function app.fail_upload_purge(p_intent uuid, p_token uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_applied boolean;
begin
  -- The claim is released so the row is retried, the reason is kept, and THIS
  -- is where the retry budget is spent (0024) — by the claim's holder only.
  update public.upload_intents
     set purge_claimed_at = null,
         purge_claim_token = null,
         purge_attempts = purge_attempts + 1,
         purge_failure = left(p_reason, 500)
   where id = p_intent and purge_claim_token = p_token and purged_at is null
  returning true into v_applied;
  return coalesce(v_applied, false);
end $$;

revoke all on function app.claim_upload_purge(integer)          from public, anon, authenticated, service_role;
revoke all on function app.complete_upload_purge(uuid, uuid)    from public, anon, authenticated, service_role;
revoke all on function app.fail_upload_purge(uuid, uuid, text)  from public, anon, authenticated, service_role;

grant execute on function app.claim_upload_purge(integer)         to goproceed_purge_worker;
grant execute on function app.complete_upload_purge(uuid, uuid)   to goproceed_purge_worker;
grant execute on function app.fail_upload_purge(uuid, uuid, text) to goproceed_purge_worker;
