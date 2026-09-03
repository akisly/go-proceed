-- Close stale-worker and crash-recovery gaps without broadening service-table
-- grants. Lock order for album paths is always group -> sessions/attachments.

create or replace function app.bump_telegram_media_group_generation()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.last_part_at is distinct from old.last_part_at then
    new.processing_generation:=old.processing_generation+1;
    if old.state='processing' then
      update public.communication_attachments set state='staged',requirement_occurrence_id=null,
        provider_retry_lease_token=null,provider_retry_lease_expires_at=null
       where telegram_media_group_id=old.id and state='processing' and provider_next_retry_at is null
         and provider_retry_lease_token=old.processing_lease_token;
    elsif old.state='awaiting_requirement_choice' then
      update public.communication_attachments set state='staged',requirement_occurrence_id=null
       where telegram_media_group_id=old.id and state='awaiting_requirement_choice';
      update public.telegram_requirement_choice_sessions set closed_at=now(),closure_reason='generation_reopened'
       where telegram_media_group_id=old.id and closed_at is null;
    end if;
    if old.state<>'open' then
      new.state:='open'; new.choice_expires_at:=null; new.completed_at:=null;
      new.processing_lease_token:=null; new.processing_lease_expires_at:=null;
      new.claimed_generation:=null; new.claimed_last_part_at:=null;
    end if;
  end if;
  return new;
end $$;

drop function app.claim_telegram_media_groups(integer, integer);
create function app.claim_telegram_media_groups(p_limit integer, p_lease_seconds integer)
returns table (
  id uuid, workspace_id uuid, project_id uuid, telegram_chat_binding_id uuid,
  chat_id text, lease_token uuid, lease_expires_at timestamptz,
  processing_generation bigint, claimed_last_part_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare v_group public.telegram_media_groups;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram media-group claim requires service principal';
  end if;
  if p_limit < 1 or p_limit > 100 or p_lease_seconds < 1 or p_lease_seconds > 300 then
    raise exception 'invalid telegram media-group claim bounds';
  end if;
  for v_group in
    select g.* from public.telegram_media_groups g
     where (g.state='open' or (g.state='processing' and g.processing_lease_expires_at<=now()))
       and g.last_part_at<=now()-interval '2 seconds'
     order by g.last_part_at,g.id limit p_limit for update skip locked
  loop
    update public.telegram_media_groups g set state='processing',processing_lease_token=gen_random_uuid(),
      processing_lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
      claimed_generation=g.processing_generation,claimed_last_part_at=g.last_part_at
      where g.id=v_group.id returning g.* into v_group;
    update public.communication_attachments a set state='staged',requirement_occurrence_id=null,
      provider_retry_lease_token=null,provider_retry_lease_expires_at=null
      where a.workspace_id=v_group.workspace_id and a.project_id=v_group.project_id
        and a.telegram_media_group_id=v_group.id and a.state='processing'
        and a.provider_next_retry_at is null
        and (a.provider_retry_lease_expires_at is null or a.provider_retry_lease_expires_at<=now());
    update public.communication_attachments a set state='not_evidence',
      failure_code=case
        when m.author_member_id is distinct from v_group.uploader_member_id then 'album_uploader_mismatch'
        when m.provider_reply_to_message_id is distinct from v_group.reply_provider_message_id then 'album_anchor_mismatch'
        when a.byte_size is null then 'provider_file_size_unknown'
        when a.byte_size>20971520 then 'provider_file_too_large' else 'unsupported_media' end,
      terminal_at=now(),provider_file_id=null,provider_file_unique_id=null,provider_next_retry_at=null,
      provider_retry_lease_token=null,provider_retry_lease_expires_at=null
      from public.communication_messages m
      where a.workspace_id=v_group.workspace_id and a.project_id=v_group.project_id
        and a.telegram_media_group_id=v_group.id and a.message_id=m.id
        and m.workspace_id=a.workspace_id and m.project_id=a.project_id
        and a.created_at<=v_group.claimed_last_part_at and a.state='staged'
        and (m.author_member_id is distinct from v_group.uploader_member_id
          or m.provider_reply_to_message_id is distinct from v_group.reply_provider_message_id
          or a.byte_size is null or a.byte_size>20971520 or a.media_type_snapshot is null
          or a.media_type_snapshot not in ('image/jpeg','image/png','image/heic'));
    return query select v_group.id,v_group.workspace_id,v_group.project_id,v_group.telegram_chat_binding_id,
      b.chat_id::text,v_group.processing_lease_token,v_group.processing_lease_expires_at,
      v_group.claimed_generation,v_group.claimed_last_part_at
      from public.telegram_chat_bindings b where b.workspace_id=v_group.workspace_id
        and b.project_id=v_group.project_id and b.id=v_group.telegram_chat_binding_id;
  end loop;
end $$;

create or replace function app.complete_telegram_media_group_claim(
  p_group_id uuid, p_lease_token uuid, p_generation bigint, p_claimed_last_part_at timestamptz
) returns text language plpgsql security definer set search_path='' as $$
declare v_group public.telegram_media_groups;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram media-group completion requires service principal';
  end if;
  select * into v_group from public.telegram_media_groups where id=p_group_id for update;
  if not found or v_group.state <> 'processing'
     or v_group.processing_lease_token is distinct from p_lease_token
     or v_group.processing_lease_expires_at <= now()
     or v_group.claimed_generation is distinct from p_generation
     or v_group.claimed_last_part_at is distinct from p_claimed_last_part_at
     or v_group.processing_generation is distinct from p_generation
     or v_group.last_part_at is distinct from p_claimed_last_part_at then return 'stale'; end if;
  if exists (select 1 from public.communication_attachments a
    where a.workspace_id=v_group.workspace_id and a.telegram_media_group_id=v_group.id
      and a.created_at <= p_claimed_last_part_at
      and a.state not in ('unbound','available','not_evidence','failed')) then return 'pending'; end if;
  update public.telegram_media_groups set state='completed', completed_at=now(),
    processing_lease_token=null, processing_lease_expires_at=null,
    claimed_generation=null, claimed_last_part_at=null where id=p_group_id;
  return 'completed';
end $$;

create function app.settle_telegram_evidence_attachment(
  p_attachment_id uuid, p_attachment_lease_token uuid, p_outcome text,
  p_evidence_object_id uuid, p_failure_code text,
  p_group_id uuid, p_group_lease_token uuid, p_group_lease_expires_at timestamptz,
  p_generation bigint, p_claimed_last_part_at timestamptz
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_updated integer;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram evidence settlement requires service principal';
  end if;
  if p_outcome not in ('available','failed','retry')
     or (p_outcome='available') <> (p_evidence_object_id is not null)
     or (p_outcome<>'available') <> (p_failure_code is not null) then
    raise exception 'telegram evidence settlement input rejected';
  end if;
  update public.communication_attachments a set
    state=case when p_outcome='available' then 'available'
               when p_outcome='failed' or a.provider_retry_attempts+1 >= 3 then 'failed'
               else 'processing' end,
    evidence_object_id=case when p_outcome='available' then p_evidence_object_id else null end,
    failure_code=case when p_outcome='failed' or (p_outcome='retry' and a.provider_retry_attempts+1 >= 3)
                      then p_failure_code else null end,
    terminal_at=case when p_outcome in ('available','failed')
                       or (p_outcome='retry' and a.provider_retry_attempts+1 >= 3) then now() else null end,
    provider_retry_attempts=a.provider_retry_attempts+case when p_outcome='retry' then 1 else 0 end,
    provider_next_retry_at=case when p_outcome='retry' and a.provider_retry_attempts+1 < 3
      then now()+make_interval(secs=>(a.provider_retry_attempts+1)*30) else null end,
    retry_disposition=case when p_outcome='retry' and a.provider_retry_attempts+1 < 3 then 'scheduled'
                           when p_outcome='retry' then 'exhausted' else a.retry_disposition end,
    provider_file_id=case when p_outcome='retry' and a.provider_retry_attempts+1 < 3 then a.provider_file_id else null end,
    provider_file_unique_id=case when p_outcome='retry' and a.provider_retry_attempts+1 < 3 then a.provider_file_unique_id else null end,
    provider_retry_lease_token=null, provider_retry_lease_expires_at=null
  where a.id=p_attachment_id and a.state='processing'
    and a.provider_retry_lease_token=p_attachment_lease_token
    and a.provider_retry_lease_expires_at > now()
    and ((a.telegram_media_group_id is null and p_group_id is null)
      or (a.telegram_media_group_id=p_group_id and exists (
        select 1 from public.telegram_media_groups g where g.id=p_group_id
          and g.workspace_id=a.workspace_id and g.state='processing'
          and g.processing_lease_token=p_group_lease_token
          and g.processing_lease_expires_at=p_group_lease_expires_at
          and g.processing_lease_expires_at > now()
          and g.processing_generation=p_generation and g.claimed_generation=p_generation
          and g.last_part_at=p_claimed_last_part_at and g.claimed_last_part_at=p_claimed_last_part_at)));
  get diagnostics v_updated=row_count;
  return v_updated=1;
end $$;

alter function app.enqueue_telegram_evidence_receipt(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid)
  rename to enqueue_telegram_evidence_receipt_0070;
revoke all on function app.enqueue_telegram_evidence_receipt_0070(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid)
  from public, anon, authenticated, goproceed_app, goproceed_service;

create function app.enqueue_telegram_evidence_receipt(
  p_workspace_id uuid, p_project_id uuid, p_binding_id uuid, p_assignment_id uuid,
  p_source_attachment_id uuid, p_source_media_group_id uuid, p_copy_key text,
  p_generation bigint, p_chunk_index integer, p_text text, p_recipient_member_id uuid,
  p_group_lease_token uuid, p_claimed_last_part_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_expected_assignment uuid; v_group public.telegram_media_groups;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram evidence receipt requires service principal';
  end if;
  if p_source_attachment_id is not null then
    select coalesce(o.work_assignment_id, card.work_assignment_id) into v_expected_assignment
      from public.communication_attachments a
      join public.communication_messages m on m.workspace_id=a.workspace_id and m.project_id=a.project_id and m.id=a.message_id
      left join public.requirement_occurrences o on o.workspace_id=a.workspace_id and o.project_id=a.project_id and o.id=a.requirement_occurrence_id
      left join public.communication_messages card on card.workspace_id=m.workspace_id and card.project_id=m.project_id
       and card.telegram_chat_binding_id=m.telegram_chat_binding_id
       and card.provider_message_id=m.provider_reply_to_message_id and card.kind='assignment_card'
     where a.workspace_id=p_workspace_id and a.project_id=p_project_id and a.id=p_source_attachment_id
       and m.telegram_chat_binding_id=p_binding_id;
    if p_group_lease_token is not null or p_claimed_last_part_at is not null then
      raise exception 'attachment receipt cannot carry album claim';
    end if;
  else
    select * into v_group from public.telegram_media_groups where workspace_id=p_workspace_id
      and project_id=p_project_id and id=p_source_media_group_id for update;
    if not found or v_group.telegram_chat_binding_id is distinct from p_binding_id then return null; end if;
    select card.work_assignment_id into v_expected_assignment from public.communication_messages card
      where card.workspace_id=p_workspace_id and card.project_id=p_project_id
        and card.telegram_chat_binding_id=p_binding_id and card.kind='assignment_card'
        and card.provider_message_id=v_group.reply_provider_message_id and card.delivery_state='provider_accepted';
    if p_copy_key <> 'telegram.evidence.choice_expired' and (
      v_group.state <> 'processing' or v_group.processing_lease_token is distinct from p_group_lease_token
      or v_group.processing_lease_expires_at <= now()
      or v_group.processing_generation is distinct from p_generation
      or v_group.claimed_generation is distinct from p_generation
      or v_group.last_part_at is distinct from p_claimed_last_part_at
      or v_group.claimed_last_part_at is distinct from p_claimed_last_part_at) then return null; end if;
  end if;
  if p_assignment_id is distinct from v_expected_assignment then
    raise exception 'telegram evidence receipt assignment mismatch';
  end if;
  return app.enqueue_telegram_evidence_receipt_0070(
    p_workspace_id,p_project_id,p_binding_id,v_expected_assignment,p_source_attachment_id,
    p_source_media_group_id,p_copy_key,p_generation,p_chunk_index,p_text,p_recipient_member_id);
end $$;

create or replace function app.resolve_telegram_evidence_context(
  p_workspace_id uuid,p_project_id uuid,p_binding_id uuid,p_sender_id bigint,p_reply_message_id bigint
) returns table (assignment_id uuid,actor_user_id uuid,occurrence_id uuid,allowed_media jsonb,label text)
language plpgsql security definer set search_path='' as $$
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram evidence context requires service principal';
  end if;
  return query select card.work_assignment_id,m.user_id,o.id,rv.allowed_media,left(o.acceptance_criterion,120)
    from public.telegram_member_links l
    join public.memberships m on m.organization_id=l.workspace_id and m.id=l.member_id
    join public.project_access_grants g on g.workspace_id=l.workspace_id and g.project_id=p_project_id
      and g.member_id=l.member_id and g.capability='evidence.record'
      and g.revoked_at is null and g.valid_from <= now() and (g.valid_until is null or g.valid_until > now())
    join public.communication_messages card on card.workspace_id=l.workspace_id and card.project_id=p_project_id
      and card.telegram_chat_binding_id=p_binding_id and card.provider_message_id=p_reply_message_id
      and card.kind='assignment_card' and card.delivery_state='provider_accepted' and card.work_assignment_id is not null
    join public.requirement_occurrences o on o.workspace_id=card.workspace_id and o.project_id=card.project_id
      and o.work_assignment_id=card.work_assignment_id
    join public.requirement_rule_versions rv on rv.workspace_id=o.workspace_id and rv.id=o.rule_version_id
   where l.workspace_id=p_workspace_id and l.telegram_user_id=p_sender_id and l.revoked_at is null
     and m.status='active' and card.telegram_occurrence_snapshot @> array[o.id]
     and o.evidence_kind in ('photo','document') order by o.ordinal,o.id;
end $$;

-- Group-first expiry avoids inversion with the generation trigger (which
-- already owns the group row before closing its sessions).
create or replace function app.expire_telegram_evidence_choices(p_limit integer)
returns integer language plpgsql security definer set search_path='' as $$
declare v_group public.telegram_media_groups; v_session public.telegram_requirement_choice_sessions; v_count integer:=0;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then raise exception 'telegram evidence choice cleanup requires service principal'; end if;
  if p_limit<1 or p_limit>100 then raise exception 'invalid telegram choice cleanup limit'; end if;
  for v_group in select g.* from public.telegram_media_groups g
    where exists (select 1 from public.telegram_requirement_choice_sessions s where s.telegram_media_group_id=g.id
      and s.consumed_at is null and s.closed_at is null and s.expires_at<=now())
    order by g.id limit p_limit for update skip locked loop
    select * into v_session from public.telegram_requirement_choice_sessions s
      where s.telegram_media_group_id=v_group.id and s.consumed_at is null and s.closed_at is null and s.expires_at<=now()
      order by s.expires_at,s.id limit 1 for update;
    if not found then continue; end if;
    update public.communication_attachments set state='not_evidence',failure_code='choice_expired',terminal_at=now(),
      provider_file_id=null,provider_file_unique_id=null,provider_next_retry_at=null,
      provider_retry_lease_token=null,provider_retry_lease_expires_at=null
      where telegram_media_group_id=v_group.id and state='awaiting_requirement_choice';
    update public.telegram_requirement_choice_sessions set closed_at=now(),closure_reason='expired'
      where telegram_media_group_id=v_group.id and closed_at is null;
    update public.telegram_media_groups set state='not_evidence',completed_at=now(),choice_expires_at=null,
      processing_lease_token=null,processing_lease_expires_at=null,claimed_generation=null,claimed_last_part_at=null where id=v_group.id;
    perform app.enqueue_telegram_evidence_receipt(v_session.workspace_id,v_session.project_id,v_session.telegram_chat_binding_id,
      v_session.work_assignment_id,null,v_group.id,'telegram.evidence.choice_expired',v_group.processing_generation,0,
      'Час вибору вимоги минув. Надішліть зображення ще раз у відповідь на картку завдання.',v_session.uploader_member_id,null,null);
    v_count:=v_count+1;
  end loop;
  for v_session in select s.* from public.telegram_requirement_choice_sessions s
    where s.telegram_media_group_id is null and s.consumed_at is null and s.closed_at is null and s.expires_at<=now()
    order by s.expires_at,s.id limit greatest(p_limit-v_count,0) for update skip locked loop
    update public.communication_attachments set state='not_evidence',failure_code='choice_expired',terminal_at=now(),
      provider_file_id=null,provider_file_unique_id=null,provider_next_retry_at=null,
      provider_retry_lease_token=null,provider_retry_lease_expires_at=null
      where id=v_session.communication_attachment_id and state='awaiting_requirement_choice';
    update public.telegram_requirement_choice_sessions set closed_at=now(),closure_reason='expired'
      where communication_attachment_id=v_session.communication_attachment_id and closed_at is null;
    perform app.enqueue_telegram_evidence_receipt(v_session.workspace_id,v_session.project_id,v_session.telegram_chat_binding_id,
      v_session.work_assignment_id,v_session.communication_attachment_id,null,'telegram.evidence.choice_expired',0,0,
      'Час вибору вимоги минув. Надішліть зображення ще раз у відповідь на картку завдання.',v_session.uploader_member_id,null,null);
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

revoke all on function app.claim_telegram_media_groups(integer,integer) from public,anon,authenticated,goproceed_app;
revoke all on function app.settle_telegram_evidence_attachment(uuid,uuid,text,uuid,text,uuid,uuid,timestamptz,bigint,timestamptz) from public,anon,authenticated,goproceed_app;
revoke all on function app.enqueue_telegram_evidence_receipt(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid,uuid,timestamptz) from public,anon,authenticated,goproceed_app;
grant execute on function app.claim_telegram_media_groups(integer,integer) to goproceed_service;
grant execute on function app.settle_telegram_evidence_attachment(uuid,uuid,text,uuid,text,uuid,uuid,timestamptz,bigint,timestamptz) to goproceed_service;
grant execute on function app.enqueue_telegram_evidence_receipt(uuid,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,text,uuid,uuid,timestamptz) to goproceed_service;
