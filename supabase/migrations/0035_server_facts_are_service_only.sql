-- 0035: the two columns that speak for the server become the server's to write.
--
-- Additive. Replaces one function body and one policy, and adds one policy.
--
-- Until now both were assertions made by the party they exist to distinguish
-- from. A holder of evidence.record could authorize an intent, upload bytes
-- nobody looked at, and pass inspection_status = 'passed'; the same member could
-- write event_source = 'server' on their own capture event. 0032 closed the
-- adjacent hole — evidence for bytes that are not in the bucket — but whether
-- anyone INSPECTED those bytes was still whatever the caller said.
--
-- The check is pg_has_role on session_user, not a login name. SECURITY DEFINER
-- changes current_user to the owner and leaves session_user as the connecting
-- role, which is the only reason this is expressible inside the definer at all.
-- Asking about role membership rather than a literal name means a deployment
-- may name its login whatever it likes, and it keeps superusers working, which
-- fixtures and migrations depend on.

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
  -- The inspection verdict arrives as a parameter and always will; what changes
  -- is who is allowed to supply it. Raised rather than returned as an outcome:
  -- the route reaches this only through the service connection, so a caller on
  -- any other connection is a defect or an attack, not a state the client can
  -- act on.
  if not pg_has_role(session_user, 'aktflow_service', 'member') then
    raise exception 'evidence may only be created by the service principal';
  end if;

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

-- ---------------------------------------------------------------------------
-- capture_events: the member records the device, the server records itself.
--
-- ce_insert keeps every condition it had and gains one: a member may only write
-- what their device did. aktflow_service is a member of aktflow_app, so this
-- policy still applies to the service role — RLS combines permissive policies
-- with OR, and the server writing a device-sourced event is harmless. The
-- direction that matters is the other one, and it is now closed.
-- ---------------------------------------------------------------------------
drop policy ce_insert on public.capture_events;
create policy ce_insert on public.capture_events for insert to aktflow_app
  with check (
    event_source = 'device'
    and app.has_project_capability(workspace_id, project_id,
          array['project.view','project.admin'])
    and app.has_project_capability(workspace_id, project_id, array['evidence.record'])
    and (upload_intent_id is null or exists (
          select 1 from public.upload_intents u
           where u.workspace_id = capture_events.workspace_id
             and u.id = capture_events.upload_intent_id
             and u.project_id = capture_events.project_id
             and u.created_by_member_id = app.active_member_id(capture_events.workspace_id))));

-- The intent is required, not merely checked when present. capture_events has no
-- foreign key on project_id or work_assignment_id, so a null-intent branch would
-- scope a server-sourced event to nothing at all: any workspace, any project id
-- the caller cares to type. All three server call sites name an intent, so the
-- branch had no user and was only surface.
create policy ce_insert_server on public.capture_events for insert to aktflow_service
  with check (
    event_source = 'server'
    and exists (
          select 1 from public.upload_intents u
           where u.workspace_id = capture_events.workspace_id
             and u.id = capture_events.upload_intent_id
             and u.project_id = capture_events.project_id));

-- The guard above is a raise; this is the same boundary expressed as a
-- privilege. It survives a future `create or replace` that drops the guard,
-- and it makes a mis-wired connection fail with 42501 at the door rather than
-- P0001 from inside the body.
--
-- aktflow_service is a member of aktflow_app (0034), so revoking from
-- aktflow_app takes the inherited grant with it — the explicit grant below is
-- what keeps the server able to finalize at all.
revoke execute on function app.finalize_upload_intent(
  uuid, uuid, text, bigint, text, text, text) from aktflow_app;
grant execute on function app.finalize_upload_intent(
  uuid, uuid, text, bigint, text, text, text) to aktflow_service;
