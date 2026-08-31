-- One album lock order everywhere: group first, then attachment/session rows.

create or replace function app.settle_telegram_evidence_attachment(
  p_attachment_id uuid, p_attachment_lease_token uuid, p_outcome text,
  p_evidence_object_id uuid, p_failure_code text,
  p_group_id uuid, p_group_lease_token uuid, p_group_lease_expires_at timestamptz,
  p_generation bigint, p_claimed_last_part_at timestamptz
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_group public.telegram_media_groups; v_attachment public.communication_attachments; v_updated integer;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram evidence settlement requires service principal';
  end if;
  if p_attachment_lease_token is null or p_outcome not in ('available','failed','retry')
     or (p_outcome='available') <> (p_evidence_object_id is not null)
     or (p_outcome<>'available') <> (p_failure_code is not null) then
    raise exception 'telegram evidence settlement input rejected';
  end if;
  if p_group_id is not null then
    select * into v_group from public.telegram_media_groups where id=p_group_id for update;
    if not found or v_group.state<>'processing'
       or v_group.processing_lease_token is distinct from p_group_lease_token
       or v_group.processing_lease_expires_at is distinct from p_group_lease_expires_at
       or v_group.processing_lease_expires_at<=now()
       or v_group.processing_generation is distinct from p_generation
       or v_group.claimed_generation is distinct from p_generation
       or v_group.last_part_at is distinct from p_claimed_last_part_at
       or v_group.claimed_last_part_at is distinct from p_claimed_last_part_at then return false; end if;
  elsif p_group_lease_token is not null or p_group_lease_expires_at is not null
     or p_generation is not null or p_claimed_last_part_at is not null then
    raise exception 'direct settlement cannot carry album claim';
  end if;
  select * into v_attachment from public.communication_attachments
    where id=p_attachment_id for update;
  if not found or v_attachment.state<>'processing'
     or v_attachment.provider_retry_lease_token is distinct from p_attachment_lease_token
     or v_attachment.provider_retry_lease_expires_at<=now()
     or ((p_group_id is null) <> (v_attachment.telegram_media_group_id is null))
     or (p_group_id is not null and v_attachment.telegram_media_group_id is distinct from p_group_id) then return false; end if;
  update public.communication_attachments a set
    state=case when p_outcome='available' then 'available'
      when p_outcome='failed' or a.provider_retry_attempts+1>=3 then 'failed' else 'processing' end,
    evidence_object_id=case when p_outcome='available' then p_evidence_object_id else null end,
    failure_code=case when p_outcome='failed' or (p_outcome='retry' and a.provider_retry_attempts+1>=3)
      then p_failure_code else null end,
    terminal_at=case when p_outcome in ('available','failed')
      or (p_outcome='retry' and a.provider_retry_attempts+1>=3) then now() else null end,
    provider_retry_attempts=a.provider_retry_attempts+case when p_outcome='retry' then 1 else 0 end,
    provider_next_retry_at=case when p_outcome='retry' and a.provider_retry_attempts+1<3
      then now()+make_interval(secs=>(a.provider_retry_attempts+1)*30) else null end,
    retry_disposition=case when p_outcome='retry' and a.provider_retry_attempts+1<3 then 'scheduled'
      when p_outcome='retry' then 'exhausted' else a.retry_disposition end,
    provider_file_id=case when p_outcome='retry' and a.provider_retry_attempts+1<3 then a.provider_file_id else null end,
    provider_file_unique_id=case when p_outcome='retry' and a.provider_retry_attempts+1<3 then a.provider_file_unique_id else null end,
    provider_retry_lease_token=null,provider_retry_lease_expires_at=null
    where a.id=p_attachment_id and a.provider_retry_lease_token=p_attachment_lease_token;
  get diagnostics v_updated=row_count;
  return v_updated=1;
end $$;

create function app.terminalize_telegram_media_group_staged(
  p_workspace_id uuid,p_group_id uuid,p_group_lease_token uuid,p_group_lease_expires_at timestamptz,
  p_generation bigint,p_claimed_last_part_at timestamptz,p_failure_code text
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_group public.telegram_media_groups;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram album terminalization requires service principal';
  end if;
  select * into v_group from public.telegram_media_groups
    where workspace_id=p_workspace_id and id=p_group_id for update;
  if not found or v_group.state<>'processing'
     or v_group.processing_lease_token is distinct from p_group_lease_token
     or v_group.processing_lease_expires_at is distinct from p_group_lease_expires_at
     or v_group.processing_lease_expires_at<=now()
     or v_group.processing_generation is distinct from p_generation
     or v_group.claimed_generation is distinct from p_generation
     or v_group.last_part_at is distinct from p_claimed_last_part_at
     or v_group.claimed_last_part_at is distinct from p_claimed_last_part_at then return false; end if;
  update public.communication_attachments set
    state=case when p_failure_code='unbound_card_reply' then 'unbound' else 'not_evidence' end,
    failure_code=p_failure_code,terminal_at=now(),provider_file_id=null,provider_file_unique_id=null,
    provider_next_retry_at=null,provider_retry_lease_token=null,provider_retry_lease_expires_at=null
    where workspace_id=p_workspace_id and telegram_media_group_id=p_group_id and state='staged'
      and created_at<=p_claimed_last_part_at;
  return true;
end $$;

alter function app.enqueue_telegram_evidence_receipt(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid,uuid,timestamptz)
  rename to enqueue_telegram_evidence_receipt_0071;
revoke all on function app.enqueue_telegram_evidence_receipt_0071(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid,uuid,timestamptz)
  from public,anon,authenticated,goproceed_app,goproceed_service;

create function app.enqueue_telegram_evidence_receipt(
  p_workspace_id uuid,p_project_id uuid,p_binding_id uuid,p_assignment_id uuid,
  p_source_attachment_id uuid,p_source_media_group_id uuid,p_copy_key text,p_generation bigint,
  p_chunk_index integer,p_text text,p_recipient_member_id uuid,p_group_lease_token uuid,
  p_claimed_last_part_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_group public.telegram_media_groups;
  v_common_card_id uuid;
  v_common_card_assignment uuid;
  v_context_mismatch boolean := false;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram evidence receipt requires service principal';
  end if;
  if p_source_media_group_id is not null then
    select * into v_group from public.telegram_media_groups where workspace_id=p_workspace_id
      and project_id=p_project_id and id=p_source_media_group_id for update;
    if not found then return null; end if;
    if p_copy_key <> 'telegram.evidence.choice_expired' and (
      v_group.state<>'processing'
      or v_group.processing_lease_token is distinct from p_group_lease_token
      or v_group.processing_lease_expires_at is distinct from p_group_lease_expires_at
      or v_group.processing_lease_expires_at<=now()
      or v_group.processing_generation is distinct from p_generation
      or v_group.claimed_generation is distinct from p_generation
      or v_group.last_part_at is distinct from p_claimed_last_part_at
      or v_group.claimed_last_part_at is distinct from p_claimed_last_part_at
    ) then return null; end if;
    select card.id, card.work_assignment_id into v_common_card_id, v_common_card_assignment
      from public.communication_messages card
     where card.workspace_id=p_workspace_id and card.project_id=p_project_id
       and card.telegram_chat_binding_id=p_binding_id and card.provider_message_id=v_group.reply_provider_message_id
       and card.kind='assignment_card' and card.delivery_state='provider_accepted'
     limit 1;
    select exists (
      select 1
        from public.communication_attachments a
        join public.communication_messages m on m.workspace_id=a.workspace_id and m.project_id=a.project_id and m.id=a.message_id
        left join public.communication_messages card on card.workspace_id=m.workspace_id and card.project_id=m.project_id
          and card.telegram_chat_binding_id=m.telegram_chat_binding_id
          and card.provider_message_id=m.provider_reply_to_message_id
          and card.kind='assignment_card' and card.delivery_state='provider_accepted'
        left join public.requirement_occurrences o on o.workspace_id=a.workspace_id and o.project_id=a.project_id
          and o.id=a.requirement_occurrence_id
       where a.workspace_id=p_workspace_id and a.project_id=p_project_id
         and a.telegram_media_group_id=v_group.id
         and a.created_at<=coalesce(p_claimed_last_part_at,v_group.last_part_at)
         and (
           m.telegram_chat_binding_id is distinct from p_binding_id
           or m.author_member_id is distinct from v_group.uploader_member_id
           or m.provider_reply_to_message_id is distinct from v_group.reply_provider_message_id
           or (card.id is null and coalesce(a.failure_code,'') <> 'unbound_card_reply')
           or (card.id is not null and (
             card.work_assignment_id is null
             or card.work_assignment_id is distinct from v_common_card_assignment
             or (a.requirement_occurrence_id is not null and (
               o.work_assignment_id is distinct from card.work_assignment_id
               or coalesce(card.telegram_occurrence_snapshot @> array[o.id], false) = false
             ))
           ))
           or (a.state='available' and (
             card.id is null or card.work_assignment_id is null
             or a.requirement_occurrence_id is null
             or o.work_assignment_id is distinct from card.work_assignment_id
             or coalesce(card.telegram_occurrence_snapshot @> array[o.id], false) = false
           ))
         )
    ) into v_context_mismatch;
    if v_context_mismatch and exists (
      select 1
        from public.communication_attachments a
        join public.communication_messages m on m.workspace_id=a.workspace_id and m.project_id=a.project_id and m.id=a.message_id
        left join public.communication_messages card on card.workspace_id=m.workspace_id and card.project_id=m.project_id
          and card.telegram_chat_binding_id=m.telegram_chat_binding_id
          and card.provider_message_id=m.provider_reply_to_message_id
          and card.kind='assignment_card' and card.delivery_state='provider_accepted'
        left join public.requirement_occurrences o on o.workspace_id=a.workspace_id and o.project_id=a.project_id
          and o.id=a.requirement_occurrence_id
       where a.workspace_id=p_workspace_id and a.project_id=p_project_id
         and a.telegram_media_group_id=v_group.id and a.state='available'
         and a.created_at<=coalesce(p_claimed_last_part_at,v_group.last_part_at)
         and (
           m.telegram_chat_binding_id is distinct from p_binding_id
           or m.author_member_id is distinct from v_group.uploader_member_id
           or m.provider_reply_to_message_id is distinct from v_group.reply_provider_message_id
           or card.id is null or card.work_assignment_id is null
           or card.work_assignment_id is distinct from v_common_card_assignment
           or a.requirement_occurrence_id is null
           or o.work_assignment_id is distinct from card.work_assignment_id
           or coalesce(card.telegram_occurrence_snapshot @> array[o.id], false) = false
         )
    ) then
      raise exception 'telegram album receipt cannot authorize mismatched evidence';
    end if;
  elsif p_source_attachment_id is not null then
    select exists (
      select 1
        from public.communication_attachments a
        join public.communication_messages m on m.workspace_id=a.workspace_id and m.project_id=a.project_id and m.id=a.message_id
        left join public.communication_messages card on card.workspace_id=m.workspace_id and card.project_id=m.project_id
          and card.telegram_chat_binding_id=m.telegram_chat_binding_id
          and card.provider_message_id=m.provider_reply_to_message_id
          and card.kind='assignment_card' and card.delivery_state='provider_accepted'
        left join public.requirement_occurrences o on o.workspace_id=a.workspace_id and o.project_id=a.project_id
          and o.id=a.requirement_occurrence_id
       where a.workspace_id=p_workspace_id and a.project_id=p_project_id and a.id=p_source_attachment_id
         and m.telegram_chat_binding_id=p_binding_id
         and a.state='available'
         and (
           card.id is null or card.work_assignment_id is null
           or o.work_assignment_id is distinct from card.work_assignment_id
           or o.id is null
           or coalesce(card.telegram_occurrence_snapshot @> array[o.id], false) = false
         )
    ) into v_context_mismatch;
    if v_context_mismatch then return null; end if;
  end if;
  return app.enqueue_telegram_evidence_receipt_0071(
    p_workspace_id,p_project_id,p_binding_id,p_assignment_id,p_source_attachment_id,p_source_media_group_id,
    p_copy_key,p_generation,p_chunk_index,p_text,p_recipient_member_id,p_group_lease_token,p_claimed_last_part_at);
end $$;

revoke all on function app.terminalize_telegram_media_group_staged(uuid,uuid,uuid,timestamptz,bigint,timestamptz,text)
  from public,anon,authenticated,goproceed_app;
revoke all on function app.enqueue_telegram_evidence_receipt(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid,uuid,timestamptz)
  from public,anon,authenticated,goproceed_app;
grant execute on function app.terminalize_telegram_media_group_staged(uuid,uuid,uuid,timestamptz,bigint,timestamptz,text) to goproceed_service;
grant execute on function app.enqueue_telegram_evidence_receipt(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid,uuid,timestamptz) to goproceed_service;
