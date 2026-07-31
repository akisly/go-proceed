-- 0027: correction from the pre-landing review of v0.1-M2-A.
--
-- Additive. Adds two columns and extends one function from 0021/0024.
--
-- Why: scan_blocked was excluded from every expiry and purge path, so content
-- that failed inspection accumulated in the bucket permanently. That exclusion
-- was deliberate — blocked content follows "restricted retention and
-- remediation", which is a different policy from "the caller never came back" —
-- but no retention was ever implemented, so the policy was an exclusion with
-- nothing on the other side of it.
--
-- The window is SEVEN DAYS, and it is not invented here. Three things fix it:
--
--   1. docs/domain/execution-and-evidence.md already sets seven days for the
--      analogous case: a pending original whose authorization was revoked is
--      "quarantined for up to seven days under an explicit recovery/deletion
--      policy". docs/architecture/files-and-storage.md puts scan-blocked and
--      orphaned bytes in ONE class, "Restricted quarantine". One product, one
--      quarantine window.
--
--   2. Nothing is lost by deleting them. Local cleanup on the client "requires
--      persisted server receipt and integrity match", and a blocked upload
--      never produces a receipt — so the capturing device still holds the
--      original. Server-side retention buys diagnosis time, not data.
--
--   3. The bytes carry no lineage. A blocked upload never creates an
--      evidence_objects row, and the diagnostic record — failure code, expected
--      hash and size, device capture id, claimed media type — lives on the
--      intent and survives the deletion. Provenance of the failure is kept;
--      only the content goes.
--
-- Seven days also covers the field case that a shorter window would not: a
-- capture on Friday, noticed and reported on Monday.
--
-- Configurable per workspace because technical/data-retention-catalog.csv marks
-- every duration in this product as an external gate; the default is a
-- defensible starting point, not a decision that forecloses the schedule.

alter table public.organizations
  add column blocked_content_retention_days integer not null default 7
    check (blocked_content_retention_days > 0);

comment on column public.organizations.blocked_content_retention_days is
  'How long bytes that failed content inspection are kept before the purge '
  'worker deletes them. The intent row and its failure code are kept '
  'regardless — only the content goes. Default matches the seven-day quarantine '
  'window docs/domain/execution-and-evidence.md sets for a revoked pending '
  'original.';

-- The exact moment inspection blocked the upload. Without it the window would
-- have to run from intent creation, which is up to the 24-hour intent TTL
-- earlier and would delete early by that much.
alter table public.upload_intents add column blocked_at timestamptz;

grant update (blocked_at) on public.upload_intents to aktflow_app;

-- ---------------------------------------------------------------------------
-- Blocked content joins the purge queue once its window closes.
--
-- The row keeps status 'scan_blocked' after purging: that is the durable fact
-- about what happened. purged_at records that the bytes are gone.
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
     limit batch
     for update skip locked)
  update public.upload_intents u
     set purge_claimed_at = now()
    from picked
   where u.id = picked.id
  returning u.id, u.workspace_id, u.staging_bucket, u.staging_storage_key;
end $$;

revoke all on function public.claim_upload_purge(integer) from public;
