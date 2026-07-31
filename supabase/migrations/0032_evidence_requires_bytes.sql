-- 0032: correction from the third adversarial pass on v0.1-M2-A.
--
-- Additive. Replaces one function body.
--
-- Why: app.finalize_upload_intent copied provenance from the intent and checked
-- the content identity against what authorization fixed, but it never asked
-- whether the object was there. Everything it verified was about the INTENT.
-- Present the hash and size the intent already declared and it would write an
-- evidence row — a receipt, with a storage key, for bytes nobody ever uploaded.
--
-- The route does verify: it reads the object's size from storage and downloads
-- it to hash it, so through the front door this cannot happen. That is exactly
-- the argument 0029 rejected for inspection_status, and it is no better here.
-- The command exists so the guarantee does not depend on the caller having
-- checked, and the object's existence is the one thing the whole evidence chain
-- rests on: an evidence row is a claim that specific bytes are held at a
-- specific key.
--
-- What this does NOT close is whether inspection ran. That still needs the
-- service principal the capability catalog anticipates, and it stays recorded
-- in TODOS.md. This closes the narrower and more damaging case: evidence whose
-- bytes do not exist.
--
-- On reading storage.objects: it is Supabase's table, not ours, which is a
-- coupling worth naming. The alternative is to keep trusting the caller about
-- the one fact the receipt is about. The read is narrow — a bucket, a key and
-- the size in metadata — and the definer runs as owner, so it needs no grant.

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

  -- The bytes have to be there, and be the size that was authorized.
  --
  -- Returned rather than raised, because both ways of failing it mean the
  -- object moved under a caller that had already checked: it was deleted, or
  -- replaced with something else, between the route reading it and this call.
  -- That is a race the client can act on, not a defect in the route.
  select (o.metadata ->> 'size')::bigint into v_stored
    from storage.objects o
   where o.bucket_id = i.staging_bucket and o.name = i.staging_storage_key;

  if v_stored is null or v_stored is distinct from p_byte_size then
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
