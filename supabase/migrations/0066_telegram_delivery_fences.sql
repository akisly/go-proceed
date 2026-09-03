-- A Telegram send is a side effect, so its active channel and exact outbox
-- lease must be fenced together. These service-only commands avoid broad
-- transaction_outbox SELECT/UPDATE grants and expose only this delivery topic.

create or replace function app.prepare_telegram_delivery(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_bot_id bigint,
  p_lease_seconds integer
) returns table (
  message_id uuid,
  workspace_id uuid,
  project_id uuid,
  chat_id text,
  text text,
  kind text,
  reply_provider_message_id text,
  eligible boolean
)
language plpgsql security definer set search_path = '' as $$
declare v_outbox public.transaction_outbox;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram delivery requires the service principal';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 2 and 900 then
    raise exception 'telegram delivery lease seconds must be between 2 and 900';
  end if;

  select * into v_outbox from public.transaction_outbox
   where id = p_outbox_id and lease_token = p_lease_token and processed_at is null
     and lease_expires_at > now()
   for update;
  if not found then
    raise exception 'telegram delivery lease rejected';
  end if;
  if v_outbox.topic <> 'communication.telegram.send'
     or v_outbox.aggregate_type <> 'communication_message'
     or v_outbox.aggregate_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or (v_outbox.payload ->> 'messageId') is distinct from v_outbox.aggregate_id then
    raise exception 'telegram delivery outbox identity rejected';
  end if;

  update public.transaction_outbox
     set lease_expires_at = now() + make_interval(secs => p_lease_seconds)
   where id = v_outbox.id and lease_token = p_lease_token and processed_at is null;

  return query
    select m.id, m.workspace_id, m.project_id, b.chat_id::text, coalesce(m.text, ''), m.kind,
           reply.provider_message_id::text,
           (m.text is not null and m.kind in ('assignment_card', 'text')
            and b.bot_id = p_bot_id and b.disconnected_at is null and p.status = 'active'
            and c.channel = 'telegram' and c.state = 'active' and c.locked_at is not null)
      from public.communication_messages m
      join public.telegram_chat_bindings b
        on b.workspace_id = m.workspace_id and b.project_id = m.project_id
       and b.id = m.telegram_chat_binding_id
      join public.project_field_channels c
        on c.workspace_id = m.workspace_id and c.project_id = m.project_id
      join public.projects p on p.workspace_id = m.workspace_id and p.id = m.project_id
      left join public.communication_messages reply
        on reply.workspace_id = m.workspace_id and reply.project_id = m.project_id
       and reply.id = m.reply_to_message_id and reply.delivery_state = 'provider_accepted'
     where m.id = v_outbox.aggregate_id::uuid and m.workspace_id = v_outbox.organization_id
       and m.project_id::text = v_outbox.payload ->> 'projectId'
       and m.direction = 'outbound' and m.delivery_state = 'queued'
       and m.provider_message_id is null
     for update of c;
end $$;

create or replace function app.complete_telegram_delivery_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_message_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_outbox public.transaction_outbox;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram delivery requires the service principal';
  end if;
  select * into v_outbox from public.transaction_outbox
   where id = p_outbox_id and lease_token = p_lease_token and processed_at is null
     and lease_expires_at > now()
   for update;
  if not found or v_outbox.topic <> 'communication.telegram.send'
     or v_outbox.aggregate_type <> 'communication_message'
     or v_outbox.aggregate_id is distinct from p_message_id::text
     or (v_outbox.payload ->> 'messageId') is distinct from p_message_id::text
     or not exists (
       select 1 from public.communication_messages m
        where m.id = p_message_id and m.workspace_id = v_outbox.organization_id
          and m.project_id::text = v_outbox.payload ->> 'projectId'
     ) then
    raise exception 'telegram delivery completion rejected';
  end if;
  update public.transaction_outbox
     set processed_at = now(), lease_expires_at = null
   where id = p_outbox_id and lease_token = p_lease_token and processed_at is null;
end $$;

create or replace function app.fail_telegram_delivery_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_message_id uuid,
  p_retry_after_ms integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_outbox public.transaction_outbox;
declare v_terminal boolean := false;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram delivery requires the service principal';
  end if;
  if p_retry_after_ms is null or p_retry_after_ms not between 0 and 3600000 then
    raise exception 'telegram delivery retry_after is invalid';
  end if;
  select * into v_outbox from public.transaction_outbox
   where id = p_outbox_id and lease_token = p_lease_token and processed_at is null
     and lease_expires_at > now()
   for update;
  if not found or v_outbox.topic <> 'communication.telegram.send'
     or v_outbox.aggregate_type <> 'communication_message'
     or v_outbox.aggregate_id is distinct from p_message_id::text
     or (v_outbox.payload ->> 'messageId') is distinct from p_message_id::text
     or not exists (
       select 1 from public.communication_messages m
        where m.id = p_message_id and m.workspace_id = v_outbox.organization_id
          and m.project_id::text = v_outbox.payload ->> 'projectId'
     ) then
    raise exception 'telegram delivery failure rejected';
  end if;

  update public.transaction_outbox
     set attempt_count = attempt_count + 1,
         last_error = 'telegram_provider_rejected',
         lease_expires_at = null,
         available_at = greatest(
           now() + least(interval '1 hour', make_interval(secs => 30 * (2 ^ attempt_count))),
           now() + p_retry_after_ms * interval '1 millisecond'
         )
   where id = p_outbox_id and lease_token = p_lease_token and processed_at is null
   returning * into v_outbox;
  if not found then raise exception 'telegram delivery failure lease rejected'; end if;

  if v_outbox.attempt_count >= 5 then
    insert into public.outbox_dead_letters (organization_id, outbox_id, reason, attempts, first_failed_at)
    values (v_outbox.organization_id, p_outbox_id, 'telegram_provider_rejected',
            v_outbox.attempt_count, v_outbox.created_at)
    on conflict (outbox_id) do nothing;
    update public.transaction_outbox set processed_at = now() where id = p_outbox_id;
    v_terminal := true;
  end if;
  return v_terminal;
end $$;

revoke execute on function app.complete_outbox(uuid, uuid) from goproceed_service;
revoke execute on function app.fail_outbox(uuid, uuid, text) from goproceed_service;
revoke all on function app.prepare_telegram_delivery(uuid, uuid, bigint, integer)
  from public, anon, authenticated, goproceed_app;
revoke all on function app.complete_telegram_delivery_outbox(uuid, uuid, uuid)
  from public, anon, authenticated, goproceed_app;
revoke all on function app.fail_telegram_delivery_outbox(uuid, uuid, uuid, integer)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.prepare_telegram_delivery(uuid, uuid, bigint, integer) to goproceed_service;
grant execute on function app.complete_telegram_delivery_outbox(uuid, uuid, uuid) to goproceed_service;
grant execute on function app.fail_telegram_delivery_outbox(uuid, uuid, uuid, integer) to goproceed_service;
