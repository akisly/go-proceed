-- Task 6 follow-up: Telegram workers have a verified provider identity, not a
-- membership actor. Keep that exception narrow rather than weakening general
-- transaction_outbox RLS.

create unique index transaction_outbox_telegram_processor_identity_uniq
  on public.transaction_outbox
    (organization_id, topic, aggregate_type, aggregate_id, (payload ->> 'providerUpdateId'), (payload ->> 'eventKind'))
  where topic in ('telegram.message.normalized', 'telegram.channel.health_changed');

create or replace function app.enqueue_telegram_processor_outbox(
  p_workspace_id uuid,
  p_project_id uuid,
  p_topic text,
  p_message_id uuid,
  p_provider_update_id bigint,
  p_event_kind text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_aggregate_type text;
  v_aggregate_id text;
  v_payload jsonb;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram processor outbox requires the service principal';
  end if;
  if p_workspace_id is null or p_project_id is null or p_message_id is null
     or p_provider_update_id is null then
    raise exception 'telegram processor outbox identity is required';
  end if;

  if p_topic = 'telegram.message.normalized' then
    if p_event_kind is null or p_event_kind not in ('message', 'edited') then
      raise exception 'telegram normalized event kind is not allowed';
    end if;
    perform 1 from public.communication_messages m
     where m.workspace_id = p_workspace_id and m.project_id = p_project_id and m.id = p_message_id;
    if not found then
      raise exception 'telegram normalized message aggregate does not match tenant';
    end if;
    if p_event_kind = 'edited' then
      perform 1 from public.communication_message_events e
       where e.workspace_id = p_workspace_id and e.project_id = p_project_id
         and e.message_id = p_message_id and e.event_kind = 'edited'
         and e.provider_update_id = p_provider_update_id;
      if not found then
        raise exception 'telegram normalized edit source does not match provider update';
      end if;
    end if;
    v_aggregate_type := 'communication_message';
    v_aggregate_id := p_message_id::text;
    v_payload := jsonb_build_object(
      'messageId', p_message_id, 'projectId', p_project_id,
      'providerUpdateId', p_provider_update_id, 'eventKind', p_event_kind
    );
  elsif p_topic = 'telegram.channel.health_changed' then
    if p_event_kind is null or p_event_kind not in ('bot_removed', 'bot_restored') then
      raise exception 'telegram channel-health event kind is not allowed';
    end if;
    perform 1 from public.project_field_channels c
     where c.workspace_id = p_workspace_id and c.project_id = p_project_id and c.channel = 'telegram';
    if not found then
      raise exception 'telegram channel aggregate does not match tenant';
    end if;
    perform 1 from public.communication_messages m
      join public.communication_message_events e
        on e.workspace_id = m.workspace_id and e.project_id = m.project_id and e.message_id = m.id
     where m.workspace_id = p_workspace_id and m.project_id = p_project_id and m.id = p_message_id
       and m.direction = 'system' and m.provider_message_id = p_provider_update_id
       and e.event_kind = p_event_kind;
    if not found then
      raise exception 'telegram channel-health source does not match provider update';
    end if;
    v_aggregate_type := 'project_field_channel';
    v_aggregate_id := p_project_id::text;
    v_payload := jsonb_build_object(
      'projectId', p_project_id, 'messageId', p_message_id,
      'providerUpdateId', p_provider_update_id, 'eventKind', p_event_kind
    );
  else
    raise exception 'telegram processor outbox topic is not allowed';
  end if;

  insert into public.transaction_outbox
    (organization_id, topic, aggregate_type, aggregate_id, payload_version, payload)
  values (p_workspace_id, p_topic, v_aggregate_type, v_aggregate_id, 1, v_payload)
  on conflict do nothing;
end $$;

revoke all on function app.enqueue_telegram_processor_outbox(uuid, uuid, text, uuid, bigint, text)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.enqueue_telegram_processor_outbox(uuid, uuid, text, uuid, bigint, text)
  to goproceed_service;
