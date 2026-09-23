-- The lock a stranger could take (DEV-038, gp-security S1-01).
--
-- WHAT WAS WRONG. 0092's app.abandon_unauthorized_upload_intent locked the
-- intent FOR UPDATE by id and only then asked whether the caller created it.
-- The finalize route reaches the function for any signed-in caller whose
-- tenant read found nothing, with any id. So anyone who knew another member's
-- intent id held that row's lock for the length of a service transaction, and
-- could delay the real finalize — no data leaked, but a stranger could slow the
-- creator down, on a pool of four connections.
--
-- WHAT THIS CHANGES. The ownership test moves into the locking select: only
-- the creator's own intent is locked. Everything else is 0092's, unchanged —
-- the service-login assertion, the idempotent answer, the state and
-- authorization tests, the update, and the grants (CREATE OR REPLACE keeps
-- them).
--
-- Rollback: re-run 0092's CREATE (drop this function first, then restore
-- 0092's grants).

create or replace function app.abandon_unauthorized_upload_intent(p_intent uuid) returns boolean
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

  -- The creator test is part of the lock: a caller who did not create the
  -- intent never holds its row.
  select * into i from public.upload_intents u
   where u.id = p_intent
     and u.created_by_member_id = app.member_id_any_status(u.workspace_id)
   for update;
  if not found then
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
