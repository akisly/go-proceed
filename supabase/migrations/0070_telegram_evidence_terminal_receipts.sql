-- Durable Telegram evidence receipts and a fenced album state machine.
-- Every provider side effect originates from one immutable communication row
-- plus one transactional-outbox row created by a service-only RPC.

alter table public.telegram_media_groups
  add column claimed_generation bigint,
  add column claimed_last_part_at timestamptz,
  drop constraint telegram_media_groups_processing_lease_check;

update public.telegram_media_groups
   set claimed_generation = processing_generation,
       claimed_last_part_at = last_part_at
 where processing_lease_token is not null;

alter table public.telegram_media_groups
  add constraint telegram_media_groups_processing_claim_check check (
    (processing_lease_token is null and processing_lease_expires_at is null
      and claimed_generation is null and claimed_last_part_at is null)
    or
    (processing_lease_token is not null and processing_lease_expires_at is not null
      and claimed_generation is not null and claimed_last_part_at is not null)
  );

alter table public.telegram_requirement_choice_sessions
  add column media_group_generation bigint,
  add column closed_at timestamptz,
  add column closure_reason text;

update public.telegram_requirement_choice_sessions s
   set media_group_generation = g.processing_generation
  from public.telegram_media_groups g
 where s.telegram_media_group_id = g.id and s.media_group_generation is null;

alter table public.telegram_requirement_choice_sessions
  add constraint telegram_requirement_choice_sessions_generation_check check (
    (telegram_media_group_id is null and media_group_generation is null)
    or (telegram_media_group_id is not null and media_group_generation is not null)
  ),
  add constraint telegram_requirement_choice_sessions_closure_check check (
    (closed_at is null and closure_reason is null)
    or (closed_at is not null and closure_reason in ('selected','expired','generation_reopened'))
  );

alter table public.communication_messages
  add column telegram_evidence_receipt_key text,
  add column telegram_evidence_copy_key text,
  add column telegram_evidence_source_attachment_id uuid,
  add column telegram_evidence_source_media_group_id uuid,
  add column telegram_evidence_generation bigint,
  add column telegram_evidence_chunk_index integer,
  add column telegram_evidence_recipient_member_id uuid,
  add constraint communication_messages_evidence_receipt_shape_check check (
    (telegram_evidence_receipt_key is null
      and telegram_evidence_copy_key is null
      and telegram_evidence_source_attachment_id is null
      and telegram_evidence_source_media_group_id is null
      and telegram_evidence_generation is null
      and telegram_evidence_chunk_index is null
      and telegram_evidence_recipient_member_id is null)
    or
    (direction = 'outbound' and kind = 'text' and text is not null
      and telegram_evidence_receipt_key is not null
      and telegram_evidence_copy_key in (
        'telegram.evidence.unbound', 'telegram.evidence.choice_expired',
        'telegram.evidence.partial', 'telegram.evidence.complete',
        'telegram.evidence.failed'
      )
      and ((telegram_evidence_source_attachment_id is null)
        <> (telegram_evidence_source_media_group_id is null))
      and telegram_evidence_generation >= 0
      and telegram_evidence_chunk_index >= 0)
  ),
  add constraint communication_messages_evidence_attachment_fkey
    foreign key (workspace_id, project_id, telegram_evidence_source_attachment_id)
    references public.communication_attachments(workspace_id, project_id, id),
  add constraint communication_messages_evidence_media_group_fkey
    foreign key (workspace_id, project_id, telegram_evidence_source_media_group_id)
    references public.telegram_media_groups(workspace_id, project_id, id),
  add constraint communication_messages_evidence_recipient_fkey
    foreign key (workspace_id, telegram_evidence_recipient_member_id)
    references public.memberships(organization_id, id);

create unique index communication_messages_evidence_receipt_identity_uniq
  on public.communication_messages (workspace_id, telegram_evidence_receipt_key)
  where telegram_evidence_receipt_key is not null;

-- Any arrival after a claim or terminal decision invalidates that snapshot.
-- Awaiting-choice parts are staged again; already-terminal parts remain
-- auditable, and old callback capabilities can no longer be selected.
create or replace function app.bump_telegram_media_group_generation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.last_part_at is distinct from old.last_part_at then
    new.processing_generation := old.processing_generation + 1;
    if old.state = 'awaiting_requirement_choice' then
      update public.communication_attachments
         set state = 'staged', requirement_occurrence_id = null
       where telegram_media_group_id = old.id
         and state = 'awaiting_requirement_choice';
      update public.telegram_requirement_choice_sessions
         set closed_at = now(), closure_reason = 'generation_reopened'
       where telegram_media_group_id = old.id and closed_at is null;
    end if;
    if old.state <> 'open' then
      new.state := 'open';
      new.choice_expires_at := null;
      new.completed_at := null;
      new.processing_lease_token := null;
      new.processing_lease_expires_at := null;
      new.claimed_generation := null;
      new.claimed_last_part_at := null;
    end if;
  end if;
  return new;
end $$;

create or replace function app.claim_telegram_media_groups(
  p_limit integer,
  p_lease_seconds integer
) returns table (
  id uuid, workspace_id uuid, project_id uuid, telegram_chat_binding_id uuid,
  chat_id text, lease_token uuid, processing_generation bigint,
  claimed_last_part_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram media-group claim requires service principal';
  end if;
  if p_limit < 1 or p_limit > 100 or p_lease_seconds < 1 or p_lease_seconds > 300 then
    raise exception 'invalid telegram media-group claim bounds';
  end if;
  return query
    with candidates as (
      select g.id
        from public.telegram_media_groups g
       where (g.state = 'open'
          or (g.state = 'processing' and g.processing_lease_expires_at <= now()))
         and g.last_part_at <= now() - interval '2 seconds'
       order by g.last_part_at, g.id
       limit p_limit
       for update skip locked
    ), claimed as (
      update public.telegram_media_groups g
         set state = 'processing', processing_lease_token = gen_random_uuid(),
             processing_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
             claimed_generation = g.processing_generation,
             claimed_last_part_at = g.last_part_at
        from candidates c
       where g.id = c.id
       returning g.*
    )
    select c.id, c.workspace_id, c.project_id, c.telegram_chat_binding_id,
           b.chat_id::text, c.processing_lease_token, c.claimed_generation,
           c.claimed_last_part_at
      from claimed c
      join public.telegram_chat_bindings b
        on b.workspace_id = c.workspace_id and b.project_id = c.project_id
       and b.id = c.telegram_chat_binding_id;
end $$;

create or replace function app.complete_telegram_media_group_claim(
  p_group_id uuid,
  p_lease_token uuid,
  p_generation bigint,
  p_claimed_last_part_at timestamptz
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_group public.telegram_media_groups;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram media-group completion requires service principal';
  end if;
  select * into v_group from public.telegram_media_groups
   where id = p_group_id for update;
  if not found or v_group.state <> 'processing'
     or v_group.processing_lease_token is distinct from p_lease_token
     or v_group.claimed_generation is distinct from p_generation
     or v_group.claimed_last_part_at is distinct from p_claimed_last_part_at
     or v_group.processing_generation is distinct from p_generation
     or v_group.last_part_at is distinct from p_claimed_last_part_at then
    return 'stale';
  end if;
  if exists (
    select 1 from public.communication_attachments a
     where a.workspace_id = v_group.workspace_id
       and a.telegram_media_group_id = v_group.id
       and a.created_at <= p_claimed_last_part_at
       and a.state not in ('unbound','available','not_evidence','failed')
  ) then
    return 'pending';
  end if;
  update public.telegram_media_groups
     set state = 'completed', completed_at = now(),
         processing_lease_token = null, processing_lease_expires_at = null,
         claimed_generation = null, claimed_last_part_at = null
   where id = p_group_id;
  return 'completed';
end $$;

create or replace function app.enqueue_telegram_evidence_receipt(
  p_workspace_id uuid,
  p_project_id uuid,
  p_binding_id uuid,
  p_assignment_id uuid,
  p_source_attachment_id uuid,
  p_source_media_group_id uuid,
  p_copy_key text,
  p_generation bigint,
  p_chunk_index integer,
  p_text text,
  p_recipient_member_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_message_id uuid;
  v_reply_message_id uuid;
  v_source_id uuid;
  v_source_kind text;
  v_expected_recipient uuid;
  v_available integer;
  v_other integer;
  v_inserted integer := 0;
  v_receipt_key text;
  v_group public.telegram_media_groups;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram evidence receipt requires service principal';
  end if;
  if (p_source_attachment_id is null) = (p_source_media_group_id is null)
     or p_copy_key not in (
       'telegram.evidence.unbound', 'telegram.evidence.choice_expired',
       'telegram.evidence.partial', 'telegram.evidence.complete',
       'telegram.evidence.failed'
     )
     or p_generation < 0 or p_chunk_index < 0
     or p_text is null or length(p_text) < 1 or length(p_text) > 4096 then
    raise exception 'telegram evidence receipt input rejected';
  end if;
  if p_copy_key = 'telegram.evidence.unbound'
     and (p_chunk_index <> 0
       or p_text <> 'Фото не прив’язано до чинної картки завдання та залишено лише в історії чату.') then
    raise exception 'telegram unbound receipt must use canonical copy';
  end if;
  if p_copy_key = 'telegram.evidence.choice_expired'
     and (p_chunk_index <> 0
       or p_text <> 'Час вибору вимоги минув. Надішліть зображення ще раз у відповідь на картку завдання.') then
    raise exception 'telegram choice-expiry receipt must use canonical copy';
  end if;

  if p_source_attachment_id is not null then
    select a.message_id, m.author_member_id,
           count(*) filter (where a.state = 'available')::integer,
           count(*) filter (where a.state in ('unbound','not_evidence','failed'))::integer
      into v_reply_message_id, v_expected_recipient, v_available, v_other
      from public.communication_attachments a
      join public.communication_messages m
        on m.workspace_id = a.workspace_id and m.project_id = a.project_id and m.id = a.message_id
     where a.workspace_id = p_workspace_id and a.project_id = p_project_id
       and a.id = p_source_attachment_id and m.telegram_chat_binding_id = p_binding_id
       and a.state in ('unbound','available','not_evidence','failed')
     group by a.message_id, m.author_member_id;
    v_source_id := p_source_attachment_id;
    v_source_kind := 'attachment';
    if p_generation <> 0 then raise exception 'attachment receipt generation must be zero'; end if;
  else
    select * into v_group from public.telegram_media_groups
     where workspace_id = p_workspace_id and project_id = p_project_id
       and id = p_source_media_group_id for update;
    if not found or v_group.telegram_chat_binding_id is distinct from p_binding_id
       or v_group.processing_generation is distinct from p_generation then
      return null;
    end if;
    select (array_agg(m.id order by m.provider_message_id, m.id))[1], g.uploader_member_id,
           count(*) filter (where a.state = 'available')::integer,
           count(*) filter (where a.state in ('unbound','not_evidence','failed'))::integer
      into v_reply_message_id, v_expected_recipient, v_available, v_other
      from public.telegram_media_groups g
      join public.communication_attachments a
        on a.workspace_id = g.workspace_id and a.project_id = g.project_id
       and a.telegram_media_group_id = g.id
      join public.communication_messages m
        on m.workspace_id = a.workspace_id and m.project_id = a.project_id and m.id = a.message_id
     where g.workspace_id = p_workspace_id and g.project_id = p_project_id
       and g.id = p_source_media_group_id and g.telegram_chat_binding_id = p_binding_id
       and a.state in ('unbound','available','not_evidence','failed')
     group by g.uploader_member_id;
    v_source_id := p_source_media_group_id;
    v_source_kind := 'media_group';
  end if;
  if v_reply_message_id is null or coalesce(v_available, 0) + coalesce(v_other, 0) = 0 then
    raise exception 'telegram evidence receipt source is not terminal';
  end if;
  if p_source_media_group_id is not null and exists (
    select 1 from public.communication_attachments a
     where a.workspace_id = p_workspace_id and a.project_id = p_project_id
       and a.telegram_media_group_id = p_source_media_group_id
       and a.state not in ('unbound','available','not_evidence','failed')
  ) then
    raise exception 'telegram evidence receipt source is not terminal';
  end if;
  if p_copy_key = 'telegram.evidence.partial' and not (v_available > 0 and v_other > 0) then
    raise exception 'telegram partial receipt requires mixed outcomes';
  elsif p_copy_key = 'telegram.evidence.complete' and not (v_available > 0 and v_other = 0) then
    raise exception 'telegram complete receipt requires all available';
  elsif p_copy_key in ('telegram.evidence.unbound','telegram.evidence.choice_expired','telegram.evidence.failed')
        and v_available > 0 then
    raise exception 'telegram failure receipt cannot claim available evidence';
  end if;
  if p_copy_key = 'telegram.evidence.choice_expired' then
    if p_recipient_member_id is null or p_recipient_member_id is distinct from v_expected_recipient then
      raise exception 'telegram choice-expiry recipient must be the original uploader';
    end if;
  elsif p_recipient_member_id is not null then
    raise exception 'telegram terminal summary recipient is not allowed';
  end if;

  v_receipt_key := concat(p_copy_key, ':', v_source_kind, ':', v_source_id, ':', p_generation, ':', p_chunk_index);
  v_message_id := gen_random_uuid();
  insert into public.communication_messages (
    id, workspace_id, project_id, telegram_chat_binding_id, direction, kind,
    text, reply_to_message_id, work_assignment_id, delivery_state,
    telegram_evidence_receipt_key, telegram_evidence_copy_key,
    telegram_evidence_source_attachment_id, telegram_evidence_source_media_group_id,
    telegram_evidence_generation, telegram_evidence_chunk_index,
    telegram_evidence_recipient_member_id
  ) values (
    v_message_id, p_workspace_id, p_project_id, p_binding_id, 'outbound', 'text',
    p_text, v_reply_message_id, p_assignment_id, 'queued',
    v_receipt_key, p_copy_key, p_source_attachment_id, p_source_media_group_id,
    p_generation, p_chunk_index, p_recipient_member_id
  ) on conflict (workspace_id, telegram_evidence_receipt_key)
      where telegram_evidence_receipt_key is not null do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select id into v_message_id from public.communication_messages
     where workspace_id = p_workspace_id and telegram_evidence_receipt_key = v_receipt_key;
    return v_message_id;
  end if;
  insert into public.transaction_outbox (
    organization_id, topic, aggregate_type, aggregate_id, payload_version, payload
  ) values (
    p_workspace_id, 'communication.telegram.send', 'communication_message',
    v_message_id::text, 1,
    jsonb_build_object('messageId', v_message_id, 'projectId', p_project_id)
  );
  return v_message_id;
end $$;

create or replace function app.expire_telegram_evidence_choices(p_limit integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.telegram_requirement_choice_sessions;
  v_generation bigint;
  v_count integer := 0;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram evidence choice cleanup requires service principal';
  end if;
  if p_limit < 1 or p_limit > 100 then raise exception 'invalid telegram choice cleanup limit'; end if;
  for v_session in
    select * from public.telegram_requirement_choice_sessions
     where consumed_at is null and closed_at is null and expires_at <= now()
     order by expires_at, id limit p_limit for update skip locked
  loop
    if exists (
      select 1 from public.telegram_requirement_choice_sessions current_session
       where current_session.id = v_session.id and current_session.closed_at is not null
    ) then
      continue;
    end if;
    if v_session.telegram_media_group_id is null then
      update public.communication_attachments
         set state = 'not_evidence', failure_code = 'choice_expired', terminal_at = now(),
             provider_file_id = null, provider_file_unique_id = null,
             provider_next_retry_at = null, provider_retry_lease_token = null,
             provider_retry_lease_expires_at = null
       where id = v_session.communication_attachment_id
         and state = 'awaiting_requirement_choice';
      v_generation := 0;
    else
      update public.communication_attachments
         set state = 'not_evidence', failure_code = 'choice_expired', terminal_at = now(),
             provider_file_id = null, provider_file_unique_id = null,
             provider_next_retry_at = null, provider_retry_lease_token = null,
             provider_retry_lease_expires_at = null
       where telegram_media_group_id = v_session.telegram_media_group_id
         and state = 'awaiting_requirement_choice';
      update public.telegram_media_groups
         set state = 'not_evidence', completed_at = now(), choice_expires_at = null,
             processing_lease_token = null, processing_lease_expires_at = null,
             claimed_generation = null, claimed_last_part_at = null
       where id = v_session.telegram_media_group_id
         and state = 'awaiting_requirement_choice';
      select processing_generation into v_generation
        from public.telegram_media_groups where id = v_session.telegram_media_group_id;
    end if;
    update public.telegram_requirement_choice_sessions
       set closed_at = now(), closure_reason = 'expired'
     where workspace_id = v_session.workspace_id and closed_at is null
       and ((communication_attachment_id is not null and communication_attachment_id = v_session.communication_attachment_id)
         or (telegram_media_group_id is not null and telegram_media_group_id = v_session.telegram_media_group_id));
    perform app.enqueue_telegram_evidence_receipt(
      v_session.workspace_id, v_session.project_id, v_session.telegram_chat_binding_id,
      v_session.work_assignment_id, v_session.communication_attachment_id,
      v_session.telegram_media_group_id, 'telegram.evidence.choice_expired',
      v_generation, 0,
      'Час вибору вимоги минув. Надішліть зображення ще раз у відповідь на картку завдання.',
      v_session.uploader_member_id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Receipt metadata is part of the immutable original, never a delivery field.
create or replace function app.guard_communication_message() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'communication message original is immutable; append an event';
  end if;
  if old.id is distinct from new.id
     or old.workspace_id is distinct from new.workspace_id
     or old.project_id is distinct from new.project_id
     or old.telegram_chat_binding_id is distinct from new.telegram_chat_binding_id
     or old.direction is distinct from new.direction
     or old.kind is distinct from new.kind
     or old.text is distinct from new.text
     or old.author_member_id is distinct from new.author_member_id
     or old.provider_user_id is distinct from new.provider_user_id
     or old.provider_display_name_snapshot is distinct from new.provider_display_name_snapshot
     or old.provider_username_snapshot is distinct from new.provider_username_snapshot
     or old.server_received_at is distinct from new.server_received_at
     or old.reply_to_message_id is distinct from new.reply_to_message_id
     or old.provider_reply_to_message_id is distinct from new.provider_reply_to_message_id
     or old.work_assignment_id is distinct from new.work_assignment_id
     or old.retry_of_message_id is distinct from new.retry_of_message_id
     or old.telegram_reply_markup is distinct from new.telegram_reply_markup
     or old.telegram_occurrence_snapshot is distinct from new.telegram_occurrence_snapshot
     or old.telegram_evidence_receipt_key is distinct from new.telegram_evidence_receipt_key
     or old.telegram_evidence_copy_key is distinct from new.telegram_evidence_copy_key
     or old.telegram_evidence_source_attachment_id is distinct from new.telegram_evidence_source_attachment_id
     or old.telegram_evidence_source_media_group_id is distinct from new.telegram_evidence_source_media_group_id
     or old.telegram_evidence_generation is distinct from new.telegram_evidence_generation
     or old.telegram_evidence_chunk_index is distinct from new.telegram_evidence_chunk_index
     or old.telegram_evidence_recipient_member_id is distinct from new.telegram_evidence_recipient_member_id
     or old.created_at is distinct from new.created_at then
    raise exception 'communication message original is immutable; append an event';
  end if;
  return new;
end $$;

revoke all on function app.claim_telegram_media_groups(integer, integer)
  from public, anon, authenticated, goproceed_app;
revoke all on function app.complete_telegram_media_group_claim(uuid, uuid, bigint, timestamptz)
  from public, anon, authenticated, goproceed_app;
revoke all on function app.enqueue_telegram_evidence_receipt(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid)
  from public, anon, authenticated, goproceed_app;
revoke all on function app.expire_telegram_evidence_choices(integer)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.claim_telegram_media_groups(integer, integer) to goproceed_service;
grant execute on function app.complete_telegram_media_group_claim(uuid, uuid, bigint, timestamptz) to goproceed_service;
grant execute on function app.enqueue_telegram_evidence_receipt(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid) to goproceed_service;
grant execute on function app.expire_telegram_evidence_choices(integer) to goproceed_service;
