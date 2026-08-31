-- Decision controls are idempotent per evidence submission/review cycle, while
-- transient provider/database failures preserve the leased inbox payload for a
-- bounded retry. Return replies are bound only after the shared decision is
-- durable, never during pre-command validation.
-- An expired control is still the issued control for that exact source cycle;
-- the user must submit new evidence (new source/generation) or decide on web.

alter table public.telegram_evidence_decision_tokens
  add column review_source_kind text,
  add column review_source_id uuid,
  add column review_source_generation bigint;

-- The effective guards intentionally reject mutation of terminal/identity
-- fields, while this one migration must backfill a new immutable identity and
-- clear obsolete pre-command reply reservations. Disable both under the table
-- migration lock, replace v2 below, then restore both before exposing commands.
alter table public.telegram_evidence_decision_tokens
  disable trigger telegram_evidence_decision_token_guard;
alter table public.telegram_evidence_decision_tokens
  disable trigger telegram_evidence_decision_token_guard_v2;
update public.telegram_evidence_decision_tokens
set review_source_kind='legacy',
    review_source_id=coalesce(decision_message_id,id),
    review_source_generation=0,
    return_reply_message_id=case when consumed_at is null then null else return_reply_message_id end
where review_source_kind is null;

alter table public.telegram_evidence_decision_tokens
  alter column review_source_kind set not null,
  alter column review_source_id set not null,
  alter column review_source_generation set not null,
  add constraint telegram_evidence_decision_review_source_check
    check (review_source_kind in ('legacy','attachment','media_group')
      and review_source_generation>=0
      and (review_source_kind<>'attachment' or review_source_generation=0));

drop index public.telegram_evidence_decision_active_action_uniq;
create unique index telegram_evidence_decision_review_action_uniq
  on public.telegram_evidence_decision_tokens
    (workspace_id,telegram_chat_binding_id,requirement_occurrence_id,
     review_source_kind,review_source_id,review_source_generation,action);

create or replace function app.guard_telegram_evidence_decision_token_v2()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.created_at is distinct from new.created_at
     or old.expires_at is distinct from new.expires_at
     or old.decision_message_id is distinct from new.decision_message_id
     or old.review_source_kind is distinct from new.review_source_kind
     or old.review_source_id is distinct from new.review_source_id
     or old.review_source_generation is distinct from new.review_source_generation then
    raise exception 'telegram decision token issuance immutable';
  end if;
  if old.invalidated_at is not null and old.invalidated_at is distinct from new.invalidated_at then
    raise exception 'telegram decision invalidation immutable';
  end if;
  if old.return_reply_message_id is not null
     and old.return_reply_message_id is distinct from new.return_reply_message_id then
    raise exception 'telegram decision return reply immutable';
  end if;
  -- Membership activity is checked before the shared command. Final receipt
  -- writing must survive an immediately-following revocation race, so this
  -- guard verifies only the immutable user/member identity pair.
  if new.actor_member_id is not null and not exists (
    select 1 from public.memberships m
    where m.organization_id=new.workspace_id and m.id=new.actor_member_id
      and m.user_id=new.actor_user_id
  ) then
    raise exception 'telegram decision actor pair invalid';
  end if;
  if new.decision_message_id is null or not exists (
    select 1 from public.communication_messages m
    where m.id=new.decision_message_id and m.workspace_id=new.workspace_id
      and m.project_id=new.project_id
      and m.telegram_chat_binding_id=new.telegram_chat_binding_id
      and m.direction='outbound' and m.kind='text'
      and m.telegram_reply_markup is not null
  ) then
    raise exception 'telegram decision control message invalid';
  end if;
  if new.return_prompt_message_id is not null and not exists (
    select 1 from public.communication_messages m
    where m.id=new.return_prompt_message_id and m.workspace_id=new.workspace_id
      and m.project_id=new.project_id
      and m.telegram_chat_binding_id=new.telegram_chat_binding_id
      and m.direction='outbound' and m.kind='text'
  ) then
    raise exception 'telegram decision return prompt invalid';
  end if;
  if new.return_reply_message_id is not null and not exists (
    select 1 from public.communication_messages r
    where r.id=new.return_reply_message_id and r.workspace_id=new.workspace_id
      and r.project_id=new.project_id
      and r.telegram_chat_binding_id=new.telegram_chat_binding_id
      and r.direction='inbound' and r.kind='text' and r.delivery_state='received'
      and r.reply_to_message_id=new.return_prompt_message_id
      and r.author_member_id=new.actor_member_id
  ) then
    raise exception 'telegram decision return reply invalid';
  end if;
  if new.consumed_at is not null and new.action='returned' and not exists (
    select 1 from public.communication_messages p
    where p.id=new.return_prompt_message_id and p.workspace_id=new.workspace_id
      and p.project_id=new.project_id
      and p.telegram_chat_binding_id=new.telegram_chat_binding_id
      and p.direction='outbound' and p.kind='text'
      and p.delivery_state='provider_accepted' and p.provider_message_id is not null
  ) then
    raise exception 'telegram decision return prompt was not delivered';
  end if;
  return new;
end $$;

alter table public.telegram_evidence_decision_tokens
  enable trigger telegram_evidence_decision_token_guard;
alter table public.telegram_evidence_decision_tokens
  enable trigger telegram_evidence_decision_token_guard_v2;

drop function app.prepare_telegram_evidence_decision_issue(uuid,uuid,uuid,uuid);
drop function app.issue_telegram_evidence_decision_tokens(uuid,uuid,uuid,uuid,uuid,text,text);

create function app.prepare_telegram_evidence_decision_issue(
  p_workspace uuid,p_project uuid,p_binding uuid,p_occurrence uuid,
  p_source_kind text,p_source_id uuid,p_source_generation bigint
) returns table(work_assignment_id uuid,already_issued boolean)
language plpgsql security definer set search_path='' as $$
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision requires service principal';
  end if;
  if p_source_kind not in ('attachment','media_group') or p_source_generation<0
     or (p_source_kind='attachment' and p_source_generation<>0) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_binding::text||':'||p_occurrence::text||':'||p_source_kind||':'||p_source_id::text||':'||p_source_generation::text,0));
  return query
    select o.work_assignment_id,
      exists (
        select 1 from public.telegram_evidence_decision_tokens t
        where t.workspace_id=p_workspace and t.project_id=p_project
          and t.telegram_chat_binding_id=p_binding and t.requirement_occurrence_id=p_occurrence
          and t.review_source_kind=p_source_kind and t.review_source_id=p_source_id
          and t.review_source_generation=p_source_generation
      )
    from public.requirement_occurrences o
    join public.telegram_chat_bindings b
      on b.workspace_id=o.workspace_id and b.project_id=o.project_id
     and b.id=p_binding and b.disconnected_at is null
    join public.project_field_channels c
      on c.workspace_id=b.workspace_id and c.project_id=b.project_id
     and c.channel='telegram' and c.state='active'
    where o.workspace_id=p_workspace and o.project_id=p_project and o.id=p_occurrence
      and ((p_source_kind='attachment' and exists (
        select 1 from public.communication_attachments a
        join public.evidence_objects e on e.workspace_id=a.workspace_id
          and e.project_id=a.project_id and e.id=a.evidence_object_id
        where a.workspace_id=o.workspace_id and a.project_id=o.project_id
          and a.id=p_source_id and a.requirement_occurrence_id=o.id and a.state='available'
      )) or (p_source_kind='media_group' and exists (
        select 1 from public.communication_attachments a
        join public.telegram_media_groups g on g.workspace_id=a.workspace_id
          and g.project_id=a.project_id and g.id=a.telegram_media_group_id
        join public.evidence_objects e on e.workspace_id=a.workspace_id
          and e.project_id=a.project_id and e.id=a.evidence_object_id
        where a.workspace_id=o.workspace_id and a.project_id=o.project_id
          and g.id=p_source_id and g.processing_generation=p_source_generation
          and a.requirement_occurrence_id=o.id and a.state='available'
      )));
end $$;

create function app.issue_telegram_evidence_decision_tokens(
  p_workspace uuid,p_project uuid,p_binding uuid,p_occurrence uuid,
  p_source_kind text,p_source_id uuid,p_source_generation bigint,
  p_message uuid,p_accept_hash text,p_return_hash text
) returns boolean language plpgsql security definer set search_path='' as $$
declare assignment_id uuid;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision requires service principal';
  end if;
  if p_accept_hash !~ '^[0-9a-f]{64}$' or p_return_hash !~ '^[0-9a-f]{64}$'
     or p_accept_hash=p_return_hash then return false; end if;
  select prepared.work_assignment_id into assignment_id
  from app.prepare_telegram_evidence_decision_issue(
    p_workspace,p_project,p_binding,p_occurrence,p_source_kind,p_source_id,p_source_generation
  ) prepared where not prepared.already_issued;
  if assignment_id is null then return false; end if;
  if not exists (
    select 1 from public.communication_messages m
    where m.id=p_message and m.workspace_id=p_workspace and m.project_id=p_project
      and m.telegram_chat_binding_id=p_binding and m.work_assignment_id=assignment_id
      and m.direction='outbound' and m.kind='text' and m.delivery_state='queued'
      and m.telegram_reply_markup is not null
  ) then return false; end if;
  insert into public.telegram_evidence_decision_tokens
    (workspace_id,project_id,telegram_chat_binding_id,requirement_occurrence_id,
     review_source_kind,review_source_id,review_source_generation,
     action,token_hash,expires_at,decision_message_id)
  values
    (p_workspace,p_project,p_binding,p_occurrence,p_source_kind,p_source_id,p_source_generation,
      'accepted',p_accept_hash,now()+interval '24 hours',p_message),
    (p_workspace,p_project,p_binding,p_occurrence,p_source_kind,p_source_id,p_source_generation,
      'returned',p_return_hash,now()+interval '24 hours',p_message);
  return true;
end $$;

drop function app.reserve_telegram_evidence_return_reply(uuid,uuid,bigint,uuid,bigint);
create function app.resolve_telegram_evidence_return_reply(
  p_workspace uuid,p_binding uuid,p_sender bigint,p_reply uuid,p_prompt bigint
) returns table(
  id uuid,workspace_id uuid,project_id uuid,telegram_chat_binding_id uuid,
  requirement_occurrence_id uuid,actor_user_id uuid,actor_member_id uuid,
  action text,consumed_at timestamptz,return_prompt_message_id uuid,work_assignment_id uuid
) language plpgsql security definer set search_path='' as $$
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision requires service principal';
  end if;
  return query
    select t.id,t.workspace_id,t.project_id,t.telegram_chat_binding_id,
      t.requirement_occurrence_id,t.actor_user_id,t.actor_member_id,t.action::text,
      t.consumed_at,t.return_prompt_message_id,o.work_assignment_id
    from public.telegram_evidence_decision_tokens t
    join public.telegram_chat_bindings b on b.workspace_id=t.workspace_id
      and b.project_id=t.project_id and b.id=t.telegram_chat_binding_id and b.disconnected_at is null
    join public.project_field_channels c on c.workspace_id=t.workspace_id
      and c.project_id=t.project_id and c.channel='telegram' and c.state='active'
    join public.communication_messages prompt on prompt.id=t.return_prompt_message_id
      and prompt.workspace_id=t.workspace_id and prompt.project_id=t.project_id
      and prompt.telegram_chat_binding_id=t.telegram_chat_binding_id
      and prompt.direction='outbound' and prompt.kind='text'
      and prompt.delivery_state='provider_accepted' and prompt.provider_message_id=p_prompt
    join public.communication_messages reply on reply.id=p_reply and reply.workspace_id=t.workspace_id
      and reply.project_id=t.project_id and reply.telegram_chat_binding_id=t.telegram_chat_binding_id
      and reply.direction='inbound' and reply.kind='text' and reply.delivery_state='received'
      and reply.reply_to_message_id=prompt.id and reply.provider_reply_to_message_id=p_prompt
      and reply.provider_user_id=p_sender and reply.author_member_id=t.actor_member_id
    join public.telegram_member_links l on l.workspace_id=t.workspace_id
      and l.member_id=t.actor_member_id and l.telegram_user_id=p_sender and l.revoked_at is null
    join public.memberships m on m.organization_id=t.workspace_id and m.id=t.actor_member_id
      and m.user_id=t.actor_user_id and m.status='active'
    join public.requirement_occurrences o on o.workspace_id=t.workspace_id
      and o.project_id=t.project_id and o.id=t.requirement_occurrence_id
    where t.workspace_id=p_workspace and t.telegram_chat_binding_id=p_binding
      and t.action='returned' and t.consumed_at is null and t.invalidated_at is null
      and t.expires_at>now();
end $$;

drop function app.finalize_telegram_evidence_decision_token(uuid,uuid,uuid);
create function app.finalize_telegram_evidence_decision_token(
  p_token uuid,p_actor uuid,p_decision uuid,p_reply uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare chosen public.telegram_evidence_decision_tokens%rowtype;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision requires service principal';
  end if;
  select * into chosen from public.telegram_evidence_decision_tokens where id=p_token for update;
  if not found or chosen.actor_member_id is distinct from p_actor or chosen.invalidated_at is not null then return false; end if;
  if chosen.consumed_at is not null then
    return chosen.decision_id=p_decision
      and chosen.return_reply_message_id is not distinct from p_reply;
  end if;
  if not exists (
    select 1 from public.requirement_evidence_decisions d
    where d.workspace_id=chosen.workspace_id and d.id=p_decision
      and d.requirement_occurrence_id=chosen.requirement_occurrence_id
      and d.decided_by_member_id=chosen.actor_member_id
      and d.outcome::text=chosen.action::text
  ) then return false; end if;
  if chosen.action='accepted' and p_reply is not null then return false; end if;
  if chosen.action='returned' and (p_reply is null or not exists (
    select 1 from public.communication_messages reply
    join public.communication_messages prompt on prompt.id=chosen.return_prompt_message_id
      and prompt.workspace_id=chosen.workspace_id and prompt.project_id=chosen.project_id
      and prompt.telegram_chat_binding_id=chosen.telegram_chat_binding_id
      and prompt.direction='outbound' and prompt.kind='text'
      and prompt.delivery_state='provider_accepted' and prompt.provider_message_id is not null
    where reply.id=p_reply and reply.workspace_id=chosen.workspace_id
      and reply.project_id=chosen.project_id
      and reply.telegram_chat_binding_id=chosen.telegram_chat_binding_id
      and reply.direction='inbound' and reply.kind='text' and reply.delivery_state='received'
      and reply.reply_to_message_id=prompt.id
      and reply.provider_reply_to_message_id=prompt.provider_message_id
      and reply.author_member_id=chosen.actor_member_id
  )) then return false; end if;
  update public.telegram_evidence_decision_tokens
    set return_reply_message_id=p_reply,consumed_at=now(),decision_id=p_decision
    where id=chosen.id;
  update public.telegram_evidence_decision_tokens
    set invalidated_at=coalesce(invalidated_at,now())
    where decision_message_id=chosen.decision_message_id and id<>chosen.id and consumed_at is null;
  return true;
end $$;

create function app.retry_telegram_decision_inbox(
  p_bot_id bigint,p_update_id bigint,p_lease_id uuid,p_error_code text
) returns text language plpgsql security definer set search_path='' as $$
declare current_attempts integer;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision retry requires service principal';
  end if;
  if p_error_code is distinct from 'telegram_decision_transient' then
    raise exception 'telegram decision retry code is not allowed';
  end if;
  select i.attempts into current_attempts from public.telegram_inbox_updates i
    where i.bot_id=p_bot_id and i.update_id=p_update_id and i.state='leased'
      and i.lease_id=p_lease_id for update;
  if not found then raise exception 'telegram decision retry rejected: lease mismatch or terminal row'; end if;
  if current_attempts<3 then
    update public.telegram_inbox_updates
      set state='pending',available_at=now()+make_interval(secs=>current_attempts*30),
          last_error_code=left(p_error_code,200),lease_id=null,lease_expires_at=null,leased_by=null
      where bot_id=p_bot_id and update_id=p_update_id;
    return 'retry_scheduled';
  end if;
  update public.telegram_inbox_updates
    set state='failed',payload=null,last_error_code=left(p_error_code,200),processed_at=now(),
        lease_id=null,lease_expires_at=null,leased_by=null
    where bot_id=p_bot_id and update_id=p_update_id;
  return 'failed';
end $$;

revoke all on function
  app.prepare_telegram_evidence_decision_issue(uuid,uuid,uuid,uuid,text,uuid,bigint),
  app.issue_telegram_evidence_decision_tokens(uuid,uuid,uuid,uuid,text,uuid,bigint,uuid,text,text),
  app.resolve_telegram_evidence_return_reply(uuid,uuid,bigint,uuid,bigint),
  app.finalize_telegram_evidence_decision_token(uuid,uuid,uuid,uuid),
  app.retry_telegram_decision_inbox(bigint,bigint,uuid,text)
from public,anon,authenticated,goproceed_app;
grant execute on function
  app.prepare_telegram_evidence_decision_issue(uuid,uuid,uuid,uuid,text,uuid,bigint),
  app.issue_telegram_evidence_decision_tokens(uuid,uuid,uuid,uuid,text,uuid,bigint,uuid,text,text),
  app.resolve_telegram_evidence_return_reply(uuid,uuid,bigint,uuid,bigint),
  app.finalize_telegram_evidence_decision_token(uuid,uuid,uuid,uuid),
  app.retry_telegram_decision_inbox(bigint,bigint,uuid,text)
to goproceed_service;
