-- 0029: correction from the second adversarial pass on v0.1-M2-A.
--
-- Additive. Revokes one grant, drops one policy that becomes unreachable, and
-- adds the command that replaces them.
--
-- Why: 0023 bound an evidence row's hash, key, size, project and recorder to
-- the intent it named, which stopped a caller inventing provenance. It did not
-- bind inspection_status. A holder of evidence.record could authorize an
-- intent, upload nothing, insert an evidence row claiming
-- inspection_status = 'passed', and then mark their own intent available. The
-- inspection story was decorative for anyone willing to write SQL.
--
-- Constraining more columns from a policy would not have fixed the shape.
-- Evidence is the product of ONE transition — the server verified bytes and
-- promoted an intent — and a transition is a command, not an INSERT the caller
-- assembles. So the insert grant goes, and this is the only way to create
-- evidence.
--
-- What this does and does not buy, stated plainly:
--
--   It does fix: provenance is copied from the intent rather than supplied
--   (storage key, bucket, provider, origin method, recorder, device capture id,
--   claimed capture time); the content hash and byte size MUST equal what the
--   intent declared at authorization, so they are fixed before any bytes move;
--   the intent must still be authorized, unexpired, unclaimed and unpurged; and
--   the promotion to available happens in the same statement, so one intent
--   yields at most one evidence row and the state machine cannot be stepped
--   around.
--
--   It does not fix: whether inspection actually ran. The route IS the server
--   in v0.1-M2-A, so nothing here can distinguish the server's verdict from a
--   member's claim about their own upload. That needs the service principal the
--   capability catalog already anticipates (service.upload_finalize), and it is
--   recorded in TODOS.md rather than implied to be solved.

revoke insert on public.evidence_objects from aktflow_app;
drop policy eo_insert on public.evidence_objects;

-- On raising versus returning NULL, since the two answer differently at the
-- HTTP boundary: NULL means "the intent moved", which is a race the client can
-- see and act on, so the route turns it into 409. Every RAISE below is an
-- assertion the route has already checked — ownership, capability, and that the
-- content matches what authorization fixed — so reaching one means the ROUTE is
-- wrong, not the request. Those surface as 500, which is the honest answer.
-- Do not map them to 4xx: that would present a server defect as a user error.
create or replace function app.finalize_upload_intent(
  p_workspace uuid,
  p_intent uuid,
  p_content_hash text,
  p_byte_size bigint,
  p_media_type text,
  p_inspection_status text,
  p_inspection_policy_version text
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i public.upload_intents%rowtype;
  v_evidence uuid;
begin
  -- FOR UPDATE, so the command serializes its own concurrency rather than
  -- relying on a caller to hold a lock. Without it four parallel finalizations
  -- all read 'intent_authorized', all insert, and three lose to the unique
  -- constraint on (workspace_id, upload_intent_id) — surfacing as 500s to the
  -- client most likely to be retrying because it is unsure the first call
  -- landed. The definer runs as owner, so it may take the row lock even though
  -- the app role's grant on this table is narrow.
  select * into i from public.upload_intents
   where workspace_id = p_workspace and id = p_intent
   for update;
  if not found then
    raise exception 'no such upload intent';
  end if;

  -- Ownership, as with orphaning and blocking: this is the creator finishing
  -- their own upload.
  if i.created_by_member_id is distinct from app.active_member_id(p_workspace) then
    raise exception 'not authorized to finalize this upload intent';
  end if;
  if not app.has_project_capability(p_workspace, i.project_id, array['evidence.record']) then
    raise exception 'not authorized to record evidence in this project';
  end if;

  -- Idempotent by intent identity: a caller that already finished gets the
  -- receipt back rather than an error.
  if i.status = 'available' then
    return i.finalized_evidence_object_id;
  end if;

  if i.status <> 'intent_authorized'
     or i.purged_at is not null or i.purge_claimed_at is not null
     or i.expires_at <= now() then
    return null;   -- the intent moved; the caller reports a conflict
  end if;

  -- The identity of the content was fixed when the upload was authorized. A
  -- caller cannot present different bytes as this intent's evidence.
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

  return v_evidence;
end $$;
revoke all on function app.finalize_upload_intent(
  uuid, uuid, text, bigint, text, text, text) from public;
grant execute on function app.finalize_upload_intent(
  uuid, uuid, text, bigint, text, text, text) to aktflow_app;
