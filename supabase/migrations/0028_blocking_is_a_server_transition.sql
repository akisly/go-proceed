-- 0028: corrections from the second adversarial pass on v0.1-M2-A.
--
-- Additive. Revokes one grant, adds one command, and tightens one helper.
--
-- Three findings, one shape: state that only the server should write was left
-- writable by the member whose upload it describes.

-- ---------------------------------------------------------------------------
-- 1. blocked_at is not the member's to set.
--
-- 0027 granted it so the finalize route could record when inspection blocked an
-- upload. But the intent's own creator can update their intent, so they could
-- null or postpone blocked_at and keep the content out of the purge queue
-- indefinitely — defeating the retention window 0027 exists to create.
--
-- Blocking also has to be a CONDITIONAL transition. The route wrote
-- status = 'scan_blocked' unconditionally, so a concurrent expiry could be
-- overwritten and the retention clock restarted from scratch.
-- ---------------------------------------------------------------------------
revoke update (blocked_at) on public.upload_intents from aktflow_app;

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
  -- Authorized on ownership, like app.orphan_upload_intent: the caller is
  -- finalizing their own upload, and blocking is the outcome of that call.
  if v_member is distinct from app.active_member_id(p_workspace) then
    raise exception 'not authorized to block this upload intent';
  end if;

  -- Only from the state that can still be blocked. An intent that expired or
  -- was claimed for purge while inspection ran stays where it is.
  update public.upload_intents
     set status = 'scan_blocked',
         failure_code = p_failure_code,
         blocked_at = now(),
         version = version + 1
   where workspace_id = p_workspace and id = p_intent
     and status = 'intent_authorized'
     and purged_at is null and purge_claimed_at is null;

  get diagnostics v_applied = row_count;
  return v_applied = 1;
end $$;
revoke all on function app.block_upload_intent(uuid, uuid, text) from public;
grant execute on function app.block_upload_intent(uuid, uuid, text) to aktflow_app;

-- ---------------------------------------------------------------------------
-- 2. The quota helper was a cross-tenant oracle.
--
-- SECURITY DEFINER, an arbitrary workspace argument, no authorization, and
-- EXECUTE to aktflow_app: any authenticated session could read another
-- tenant's evidence usage. It now answers only for a workspace the caller is
-- an active member of.
--
-- Usage also counts bytes that physically remain — expired, orphaned and
-- blocked content occupies the bucket until purged_at is set, and omitting it
-- let repeated blocked uploads consume storage the quota was meant to bound.
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
                      and (status in ('scan_blocked', 'orphaned_for_purge')
                        or (status = 'intent_authorized' and expires_at > now()))), 0);
end $$;
revoke all on function app.evidence_bytes_in_use(uuid) from public;
grant execute on function app.evidence_bytes_in_use(uuid) to aktflow_app;
