-- 0033: corrections from the pre-landing review of 0031 and 0032.
--
-- Additive. Replaces two function bodies; one loses a parameter.
--
-- Two findings, one cause: 0031 and 0032 were written to stop the commands
-- trusting the caller about facts the server can establish itself, and
-- app.fail_upload_intent was left behind on both counts.

-- ---------------------------------------------------------------------------
-- 1. The failure command reads the bucket instead of being told about it.
--
-- 0031 took the observed size as a parameter and raised the reservation to it.
-- The route passes what it actually measured, so the honest path was right —
-- but the value is the caller's assertion about server-observable state, which
-- is the exact shape 0029 removed from evidence creation and 0032 removed from
-- finalization. And quota is a SHARED workspace resource: pinning one intent's
-- reservation at an arbitrary figure stops every other member of that workspace
-- uploading, so the blast radius is wider than the caller's own upload.
--
-- 0032 established that a definer can read storage.objects. This does the same,
-- and the parameter is gone rather than ignored, so it cannot be passed at all.
-- ---------------------------------------------------------------------------
drop function app.fail_upload_intent(uuid, uuid, text, bigint);

create function app.fail_upload_intent(
  p_workspace uuid, p_intent uuid, p_failure_code text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i public.upload_intents%rowtype;
  v_stored bigint;
  v_applied integer;
begin
  select * into i from public.upload_intents
   where workspace_id = p_workspace and id = p_intent
   for update;
  if not found then
    raise exception 'no such upload intent';
  end if;
  if i.created_by_member_id is distinct from app.member_id_any_status(p_workspace) then
    raise exception 'not authorized to fail this upload intent';
  end if;

  -- What is actually held, not what anyone says is held. Absent means nothing
  -- to account for, so the reservation is left where it is.
  select (o.metadata ->> 'size')::bigint into v_stored
    from storage.objects o
   where o.bucket_id = i.staging_bucket and o.name = i.staging_storage_key;

  update public.upload_intents
     set failure_code = p_failure_code,
         -- greatest, never least: a correction may only ever admit that more
         -- bytes are held than were reserved. Lowering it would hand back quota
         -- for content still sitting in the bucket.
         quota_reserved_bytes = greatest(quota_reserved_bytes, coalesce(v_stored, 0)),
         version = version + 1
   where workspace_id = p_workspace and id = p_intent
     and status = 'intent_authorized'
     and expires_at > now()
     and purged_at is null and purge_claimed_at is null;

  get diagnostics v_applied = row_count;
  return v_applied = 1;
end $$;
revoke all on function app.fail_upload_intent(uuid, uuid, text) from public;
grant execute on function app.fail_upload_intent(uuid, uuid, text) to aktflow_app;

-- ---------------------------------------------------------------------------
-- 2. A missing object leaves a trail like every other failure.
--
-- 0032 returns 'no_content' when the bytes are absent or the wrong size, and
-- recorded nothing. Every other way an upload can fail writes a failure_code,
-- so this one read as "nothing happened" on a row the client had just been told
-- 409 about. The command is already holding the row lock and already knows, so
-- it records it here rather than leaving it to a follow-up call the caller
-- could skip.
--
-- The intent stays intent_authorized and retryable: the bytes going missing is
-- not the caller's fault and re-uploading is the right next move.
-- ---------------------------------------------------------------------------
create or replace function app.finalize_upload_intent(
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
  v_stored bigint;
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

  select (o.metadata ->> 'size')::bigint into v_stored
    from storage.objects o
   where o.bucket_id = i.staging_bucket and o.name = i.staging_storage_key;

  if v_stored is null or v_stored is distinct from p_byte_size then
    update public.upload_intents
       set failure_code = 'content_missing',
           quota_reserved_bytes = greatest(quota_reserved_bytes, coalesce(v_stored, 0)),
           version = version + 1
     where workspace_id = p_workspace and id = p_intent;
    return query select null::uuid, 'no_content'::text;
    return;
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
