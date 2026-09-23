-- The upload its creator could not abandon (DEV-038, BL-032).
--
-- WHAT WAS WRONG. INV-047 asks for prompt purge when authorization is lost
-- mid-upload. app.finalize_upload_intent (0029 onward) orphans the intent when
-- the creator is no longer an active member or has lost evidence.record — but
-- the route only reaches it after reading the intent in a tenant transaction,
-- and that read sees nothing once the creator lost the membership or the
-- project read (policy ui_select needs project.view through an active
-- membership). So a suspended or ended creator, or an active one stripped of
-- the project's grants, got 404 and the staged bytes waited for the 24-hour
-- intent TTL instead of the next purge run.
--
-- WHAT THIS CHANGES. app.abandon_unauthorized_upload_intent(p_intent), a
-- second authorization path for exactly this case, callable by the service
-- principal only. It applies — orphaned_for_purge, failure_code
-- 'authorization_revoked', version + 1, exactly finalize's own unauthorized
-- branch — only when ALL of:
--   * the transaction carries an actor (app.current_actor());
--   * that actor created the intent (app.member_id_any_status of the intent's
--     workspace, any membership status — the same ownership test finalize
--     makes);
--   * the intent is intent_authorized, unexpired, not purged, not claimed;
--   * the actor is NOT fully authorized: no active membership, or no
--     evidence.record, or no project.view/project.admin on the intent's
--     project. (Without the read the route cannot see the row at all, so a
--     creator holding evidence.record but not the read was stuck too.)
-- An intent it already orphaned for this reason answers true again, so a
-- retry gets the same 403. Anything else answers false and the route gives
-- the response it gives today, so a non-creator, another workspace's member
-- or an outsider learns nothing.
--
-- It writes no capture event and no audit record, as finalize's unauthorized
-- branch does not. The service transaction declares no workspace
-- (app.service_workspace() is NULL); the function writes only inside itself.
--
-- Rollback: drop function app.abandon_unauthorized_upload_intent(uuid);

create function app.abandon_unauthorized_upload_intent(p_intent uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  i public.upload_intents%rowtype;
  v_actor uuid := app.current_actor();
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'an upload may only be abandoned through the service principal';
  end if;
  if v_actor is null then
    return false;
  end if;

  select * into i from public.upload_intents where id = p_intent for update;
  if not found then
    return false;
  end if;

  if i.created_by_member_id is distinct from app.member_id_any_status(i.workspace_id) then
    return false;
  end if;

  if i.status = 'orphaned_for_purge' and i.failure_code = 'authorization_revoked' then
    return true;
  end if;

  if i.status <> 'intent_authorized'
     or i.purged_at is not null or i.purge_claimed_at is not null
     or i.expires_at <= now() then
    return false;
  end if;

  if app.active_member_id(i.workspace_id) is not null
     and app.has_project_capability(i.workspace_id, i.project_id, array['evidence.record'])
     and app.has_project_capability(i.workspace_id, i.project_id,
                                    array['project.view', 'project.admin']) then
    return false;
  end if;

  update public.upload_intents
     set status = 'orphaned_for_purge',
         failure_code = coalesce(failure_code, 'authorization_revoked'),
         version = version + 1
   where id = p_intent;
  return true;
end $$;

revoke all on function app.abandon_unauthorized_upload_intent(uuid)
  from public, anon, authenticated, service_role, goproceed_app;
grant execute on function app.abandon_unauthorized_upload_intent(uuid) to goproceed_service;
