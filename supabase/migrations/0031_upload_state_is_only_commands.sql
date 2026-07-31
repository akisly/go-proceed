-- 0031: corrections from the third adversarial pass on v0.1-M2-A.
--
-- Additive. Revokes the last direct write on upload_intents, adds one command,
-- and restates three.
--
-- 0028 and 0029 moved two transitions behind commands and said the state
-- machine was now the server's. That claim was false while it was still
-- possible to write the state column directly, and it was: aktflow_app kept
-- UPDATE on (status, finalized_evidence_object_id, failure_code, version) with
-- a policy that checks WHO is writing and never WHAT the write does. The
-- creator of an intent could set status = 'available' with no evidence behind
-- it, resurrect a terminal state, or step around app.block_upload_intent
-- entirely. A command that a caller can decline to use is a suggestion.
--
-- The test that was supposed to guard this surface asserted the grant list
-- equals exactly those four columns. It was written to prove the storage key
-- and bucket are unwritable, which it does, and in doing so it froze the hole
-- next to them as expected behaviour. Asserting the shape of a write surface
-- is not the same as asking whether that surface should exist.

-- ---------------------------------------------------------------------------
-- 1. Ownership has to survive deactivation; authorization must not.
--
-- Every command here authorizes on "you created this intent". That question was
-- being answered with app.active_member_id, which returns NULL for a member
-- whose status is no longer active — so a member deactivated mid-upload could
-- not finalize (correct) and could not orphan their own bytes either
-- (INV-047's exact failure mode: the bytes stay authorized until expiry, and
-- the caller gets a 500 from an assertion that was never about them).
--
-- Identity and permission are different questions. This answers only the first.
-- ---------------------------------------------------------------------------
create or replace function app.member_id_any_status(ws uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id from public.memberships m
   where m.organization_id = ws and m.user_id = app.current_actor()
$$;
comment on function app.member_id_any_status(uuid) is
  'The caller''s membership id in this workspace regardless of status. For '
  'answering "is this yours", never "may you do this" — a deactivated member '
  'still owns what they created and must still be able to abandon it.';
revoke all on function app.member_id_any_status(uuid) from public;
grant execute on function app.member_id_any_status(uuid) to aktflow_app;

-- ---------------------------------------------------------------------------
-- 2. The state column is no longer writable at all.
-- ---------------------------------------------------------------------------
revoke update on public.upload_intents from aktflow_app;
drop policy ui_update on public.upload_intents;

-- The definers below run as owner, so they are unaffected. So are the purge
-- functions from 0021/0024/0027, which were already SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- 3. Recording a failed upload is a transition too.
--
-- The finalize route wrote failure_code and appended a failed capture event
-- unconditionally on every integrity mismatch, with no check that the intent
-- was still authorized. An expiry or purge claim landing during the storage
-- read left a terminal intent carrying failure provenance from a request that
-- arrived after it was already over.
--
-- It also corrects the reservation. The quota reserves the size the CLIENT
-- declared, and the signed upload URL cannot bound what is actually sent —
-- Supabase enforces only the bucket-wide maximum. So "declare one byte, upload
-- fifty megabytes, never finalize" reserved one byte against fifty megabytes of
-- real storage. This is the moment the server learns the true size, so it is
-- the moment to record it.
-- ---------------------------------------------------------------------------
create or replace function app.fail_upload_intent(
  p_workspace uuid, p_intent uuid, p_failure_code text, p_observed_bytes bigint)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_member uuid;
  v_applied integer;
begin
  select created_by_member_id into v_member
    from public.upload_intents
   where workspace_id = p_workspace and id = p_intent;
  if v_member is null then
    raise exception 'no such upload intent';
  end if;
  if v_member is distinct from app.member_id_any_status(p_workspace) then
    raise exception 'not authorized to fail this upload intent';
  end if;

  update public.upload_intents
     set failure_code = p_failure_code,
         -- greatest, never least: a correction may only ever admit that more
         -- bytes are held than were reserved. Lowering it here would hand back
         -- quota for content still sitting in the bucket.
         quota_reserved_bytes = greatest(quota_reserved_bytes,
                                         coalesce(p_observed_bytes, 0)),
         version = version + 1
   where workspace_id = p_workspace and id = p_intent
     and status = 'intent_authorized'
     and expires_at > now()
     and purged_at is null and purge_claimed_at is null;

  get diagnostics v_applied = row_count;
  return v_applied = 1;
end $$;
revoke all on function app.fail_upload_intent(uuid, uuid, text, bigint) from public;
grant execute on function app.fail_upload_intent(uuid, uuid, text, bigint) to aktflow_app;

-- ---------------------------------------------------------------------------
-- 4. Blocking cannot revive an intent whose grant has run out.
--
-- The predicate checked the stored status but not the clock. An intent that
-- expired while inspection was running had not been swept yet, so it still read
-- 'intent_authorized' and moved to 'scan_blocked' — which restarts the
-- retention window from zero on content that was already due for purge.
-- ---------------------------------------------------------------------------
create or replace function app.block_upload_intent(
  p_workspace uuid, p_intent uuid, p_failure_code text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_member uuid;
  v_applied integer;
begin
  select created_by_member_id into v_member
    from public.upload_intents
   where workspace_id = p_workspace and id = p_intent;
  if v_member is null then
    raise exception 'no such upload intent';
  end if;
  if v_member is distinct from app.member_id_any_status(p_workspace) then
    raise exception 'not authorized to block this upload intent';
  end if;

  update public.upload_intents
     set status = 'scan_blocked',
         failure_code = p_failure_code,
         blocked_at = now(),
         version = version + 1
   where workspace_id = p_workspace and id = p_intent
     and status = 'intent_authorized'
     and expires_at > now()
     and purged_at is null and purge_claimed_at is null;

  get diagnostics v_applied = row_count;
  return v_applied = 1;
end $$;

-- Orphaning likewise: the caller is abandoning their own upload, and a member
-- who has just lost their grant is exactly who needs to. It returns whether it
-- applied instead of void, for the same reason as the others: a transition that
-- reports nothing cannot be checked.
drop function app.orphan_upload_intent(uuid, uuid);
create function app.orphan_upload_intent(p_workspace uuid, p_intent uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_member uuid;
  v_applied integer;
begin
  select created_by_member_id into v_member
    from public.upload_intents
   where workspace_id = p_workspace and id = p_intent;
  if v_member is null then
    raise exception 'no such upload intent';
  end if;
  if v_member is distinct from app.member_id_any_status(p_workspace) then
    raise exception 'not authorized to orphan this upload intent';
  end if;

  update public.upload_intents
     set status = 'orphaned_for_purge',
         failure_code = coalesce(failure_code, 'authorization_revoked'),
         version = version + 1
   where workspace_id = p_workspace and id = p_intent
     and status = 'intent_authorized'
     and purged_at is null and purge_claimed_at is null;

  get diagnostics v_applied = row_count;
  return v_applied = 1;
end $$;
revoke all on function app.orphan_upload_intent(uuid, uuid) from public;
grant execute on function app.orphan_upload_intent(uuid, uuid) to aktflow_app;

-- ---------------------------------------------------------------------------
-- 5. Finalization says what it did, and orphans when the answer is "nothing".
--
-- Two defects, one cause: the command returned a bare uuid, so the caller could
-- not tell "I created this" from "someone else already had".
--
--   Duplicate downstream facts. Parallel finalizations of one intent produce
--   one evidence row — the row lock sees to that — but every losing call got a
--   valid uuid back and went on to append its own capture event, audit entry
--   and evidence.available outbox row. The outbox has no uniqueness constraint,
--   so a client retrying because it was unsure the first call landed published
--   the event once per retry. The concurrency test asserted exactly one
--   evidence object and never counted anything downstream of it.
--
--   Wrong status codes. Losing a capability between the route's recheck and
--   this call raised, and an unmapped raise is a 500. That reads as a server
--   defect when the truth is that the caller's access ended. It is now an
--   outcome the route can name, and the orphaning happens here under the row
--   lock rather than in a second call that could itself be denied.
--
-- The ownership and content-identity checks still raise, and those raises are
-- still meant to be unreachable: the route has verified the session owns the
-- intent and that the hash and size are the ones authorization fixed, and
-- neither can change underneath it. Reaching one means the route is wrong, not
-- the request, and 500 is the honest answer for that.
-- ---------------------------------------------------------------------------
drop function app.finalize_upload_intent(uuid, uuid, text, bigint, text, text, text);

create function app.finalize_upload_intent(
  p_workspace uuid,
  p_intent uuid,
  p_content_hash text,
  p_byte_size bigint,
  p_media_type text,
  p_inspection_status text,
  p_inspection_policy_version text
) returns table (evidence_object_id uuid, outcome text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i public.upload_intents%rowtype;
  v_evidence uuid;
begin
  select * into i from public.upload_intents
   where workspace_id = p_workspace and id = p_intent
   for update;
  if not found then
    raise exception 'no such upload intent';
  end if;

  if i.created_by_member_id is distinct from app.member_id_any_status(p_workspace) then
    raise exception 'not authorized to finalize this upload intent';
  end if;

  -- Already finished: hand back the receipt, and say that this call is not the
  -- one that made it, so the caller emits nothing a second time.
  if i.status = 'available' then
    return query select i.finalized_evidence_object_id, 'already'::text;
    return;
  end if;

  if i.status <> 'intent_authorized'
     or i.purged_at is not null or i.purge_claimed_at is not null
     or i.expires_at <= now() then
    return query select null::uuid, 'conflict'::text;
    return;
  end if;

  -- INV-047, decided here rather than trusted from the caller: authorization is
  -- what it is at the moment evidence would be created.
  if app.active_member_id(p_workspace) is null
     or not app.has_project_capability(p_workspace, i.project_id,
                                       array['evidence.record']) then
    update public.upload_intents
       set status = 'orphaned_for_purge',
           failure_code = coalesce(failure_code, 'authorization_revoked'),
           version = version + 1
     where workspace_id = p_workspace and id = p_intent;
    return query select null::uuid, 'unauthorized'::text;
    return;
  end if;

  if p_content_hash is distinct from i.expected_content_hash
     or p_byte_size is distinct from i.expected_byte_size then
    raise exception 'finalization does not match the authorized content identity';
  end if;

  v_evidence := gen_random_uuid();
  insert into public.evidence_objects
    (id, workspace_id, project_id, content_hash, byte_size, media_type,
     original_filename, storage_bucket, storage_key, storage_provider,
     origin_method, relation_kind, recorder_member_id, device_capture_id,
     claimed_capture_time, claimed_tz_offset, capture_time_trust,
     server_received_at, upload_intent_id, source_app_version,
     inspection_status, inspection_policy_version)
  values
    (v_evidence, p_workspace, i.project_id, p_content_hash, p_byte_size, p_media_type,
     i.original_filename, i.staging_bucket, i.staging_storage_key, 'supabase',
     i.origin_method, 'original', i.created_by_member_id, i.device_capture_id,
     i.claimed_capture_time, i.claimed_tz_offset,
     case when i.claimed_capture_time is null then 'unknown' else 'device_claimed' end,
     now(), p_intent, i.source_app_version,
     p_inspection_status, p_inspection_policy_version);

  update public.upload_intents
     set status = 'available', finalized_evidence_object_id = v_evidence,
         failure_code = null, version = version + 1
   where workspace_id = p_workspace and id = p_intent;

  return query select v_evidence, 'created'::text;
end $$;
revoke all on function app.finalize_upload_intent(
  uuid, uuid, text, bigint, text, text, text) from public;
grant execute on function app.finalize_upload_intent(
  uuid, uuid, text, bigint, text, text, text) to aktflow_app;

-- ---------------------------------------------------------------------------
-- 6. Usage counts bytes that are present, not bytes the server feels bad about.
--
-- 0028 widened this to include blocked and orphaned content and stated in its
-- own comment that bytes occupy the bucket "until purged_at is set" — then
-- listed statuses instead of saying that. Expired intents, and authorized ones
-- past their deadline that the fifteen-minute sweep has not reached, were
-- invisible while physically present. Since the purge worker is not deployed
-- anywhere yet, invisible meant permanent.
--
-- The rule is now the one the comment always described: unpurged bytes count.
-- 'available' is the single exclusion, because those bytes are counted through
-- their evidence_objects row and would otherwise be counted twice.
-- ---------------------------------------------------------------------------
create or replace function app.evidence_bytes_in_use(p_workspace uuid)
returns bigint
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if app.active_member_id(p_workspace) is null then
    raise exception 'not a member of this workspace';
  end if;

  return coalesce((select sum(byte_size) from public.evidence_objects
                    where workspace_id = p_workspace), 0)
       + coalesce((select sum(quota_reserved_bytes) from public.upload_intents
                    where workspace_id = p_workspace
                      and purged_at is null
                      and status <> 'available'), 0);
end $$;
