-- The one telegram-family table the service plane still cannot reach.
--
-- 0062 gave every table in this family a service policy confined to
-- app.service_workspace(): communication_messages, communication_attachments,
-- telegram_chat_bindings, telegram_media_groups, telegram_requirement_choices.
-- public.project_field_channels was never in that list, because it is not
-- telegram's table — it is the project's channel configuration, and its three
-- policies (pfc_select, pfc_update, pfc_insert, all `to goproceed_app`) are
-- keyed on app.has_project_capability, with pfc_update demanding project.admin.
--
-- That is correct for a member. It is impossible for a worker. The channel
-- health transition — the bot was removed from the group, the bot was added
-- back — is observed by a Telegram update and has no member behind it, so
-- processor.ts's UPDATE resolved app.current_actor() to NULL, matched zero rows,
-- and returned early. No system message, no communication_message_events row,
-- no telegram.channel.health_changed outbox row. A channel that lost its bot
-- has never once been marked unhealthy.
--
-- NOT a service policy. `for all to goproceed_service using (true)` would turn
-- this green and hand the service plane blanket UPDATE over field-channel
-- configuration — including `locked_at`, `channel` and the archived state —
-- which is precisely the reach 0062 withdrew. A definer that writes ONE
-- transition is the narrower instrument, and it keeps the m5 invariant intact:
-- no new policy, no new table grant.
create or replace function app.set_project_field_channel_health(
  p_workspace_id uuid, p_project_id uuid, p_unhealthy boolean
) returns text
language plpgsql security definer set search_path = '' as $$
declare v_state text;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'project field channel health requires the service principal';
  end if;
  if p_workspace_id is null or p_project_id is null or p_unhealthy is null then
    raise exception 'project field channel health identity is required';
  end if;
  if p_workspace_id is distinct from app.service_workspace() then
    raise exception 'project field channel workspace is not the declared workspace';
  end if;
  -- Exactly the transition processor.ts used to write inline, and nothing else:
  -- state moves between unhealthy and connected/active, last_healthy_at is
  -- stamped only on restoration, and an archived channel is left alone. The
  -- function cannot touch `channel`, `locked_at` or `locked_by_member_id`, so
  -- the service plane gains the health transition and no part of the channel's
  -- configuration.
  update public.project_field_channels
     set state = case when p_unhealthy then 'unhealthy'::public.project_field_channel_state
                      when locked_at is null then 'connected'::public.project_field_channel_state
                      else 'active'::public.project_field_channel_state end,
         last_healthy_at = case when p_unhealthy then last_healthy_at else now() end,
         updated_at = now()
   where workspace_id = p_workspace_id and project_id = p_project_id and state <> 'archived'
  returning state::text into v_state;
  return v_state;
end $$;

revoke all on function app.set_project_field_channel_health(uuid, uuid, boolean)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.set_project_field_channel_health(uuid, uuid, boolean)
  to goproceed_service;
