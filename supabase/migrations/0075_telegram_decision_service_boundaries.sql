-- The Telegram worker has no member RLS subject. Keep every token-table read
-- and mutation behind one bounded service-only command which derives tenant,
-- actor and message scope from durable rows.

alter table public.telegram_evidence_decision_tokens
  add column invalidated_at timestamptz,
  add column return_reply_message_id uuid,
  add constraint telegram_evidence_decision_return_reply_fkey
    foreign key (return_reply_message_id) references public.communication_messages(id),
  add constraint telegram_evidence_decision_terminal_state_check
    check (not (consumed_at is not null and invalidated_at is not null)),
  add constraint telegram_evidence_decision_consumed_actor_check
    check (consumed_at is null or actor_member_id is not null),
  add constraint telegram_evidence_decision_return_reply_check
    check (return_reply_message_id is null
      or (action = 'returned' and return_prompt_message_id is not null and actor_member_id is not null));

drop index public.telegram_evidence_decision_active_action_uniq;
create unique index telegram_evidence_decision_active_action_uniq
  on public.telegram_evidence_decision_tokens
    (workspace_id, telegram_chat_binding_id, requirement_occurrence_id, action)
  where consumed_at is null and invalidated_at is null;

create or replace function app.guard_telegram_evidence_decision_token_v2()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.created_at is distinct from new.created_at
     or old.expires_at is distinct from new.expires_at
     or old.decision_message_id is distinct from new.decision_message_id then
    raise exception 'telegram decision token issuance immutable';
  end if;
  if old.invalidated_at is not null and old.invalidated_at is distinct from new.invalidated_at then
    raise exception 'telegram decision invalidation immutable';
  end if;
  if old.return_reply_message_id is not null
     and old.return_reply_message_id is distinct from new.return_reply_message_id then
    raise exception 'telegram decision return reply immutable';
  end if;
  if new.actor_member_id is not null and not exists (
    select 1 from public.memberships m
    where m.organization_id=new.workspace_id and m.id=new.actor_member_id
      and m.user_id=new.actor_user_id and m.status='active'
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

create trigger telegram_evidence_decision_token_guard_v2
  before update on public.telegram_evidence_decision_tokens
  for each row execute function app.guard_telegram_evidence_decision_token_v2();

create or replace function app.prepare_telegram_evidence_decision_issue(
  p_workspace uuid, p_project uuid, p_binding uuid, p_occurrence uuid
) returns table(work_assignment_id uuid, already_issued boolean)
language plpgsql security definer set search_path='' as $$
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision requires service principal';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_binding::text||':'||p_occurrence::text,0));
  return query
    select o.work_assignment_id,
      exists (select 1 from public.telegram_evidence_decision_tokens t
        where t.workspace_id=p_workspace and t.project_id=p_project
          and t.telegram_chat_binding_id=p_binding
          and t.requirement_occurrence_id=p_occurrence) as already_issued
    from public.requirement_occurrences o
    join public.telegram_chat_bindings b
      on b.workspace_id=o.workspace_id and b.project_id=o.project_id
     and b.id=p_binding and b.disconnected_at is null
    join public.project_field_channels c
      on c.workspace_id=b.workspace_id and c.project_id=b.project_id
     and c.channel='telegram' and c.state='active'
    where o.workspace_id=p_workspace and o.project_id=p_project and o.id=p_occurrence
      and exists (
        select 1 from public.communication_attachments a
        join public.evidence_objects e
          on e.workspace_id=a.workspace_id and e.project_id=a.project_id
         and e.id=a.evidence_object_id
        where a.workspace_id=o.workspace_id and a.project_id=o.project_id
          and a.requirement_occurrence_id=o.id and a.state='available'
      );
end $$;

create or replace function app.issue_telegram_evidence_decision_tokens(
  p_workspace uuid, p_project uuid, p_binding uuid, p_occurrence uuid,
  p_message uuid, p_accept_hash text, p_return_hash text
) returns boolean language plpgsql security definer set search_path='' as $$
declare assignment_id uuid;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision requires service principal';
  end if;
  if p_accept_hash !~ '^[0-9a-f]{64}$' or p_return_hash !~ '^[0-9a-f]{64}$'
     or p_accept_hash=p_return_hash then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_binding::text||':'||p_occurrence::text,0));
  select prepared.work_assignment_id into assignment_id
  from app.prepare_telegram_evidence_decision_issue(p_workspace,p_project,p_binding,p_occurrence) prepared
  where not prepared.already_issued;
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
     action,token_hash,expires_at,decision_message_id)
  values
    (p_workspace,p_project,p_binding,p_occurrence,'accepted',p_accept_hash,now()+interval '24 hours',p_message),
    (p_workspace,p_project,p_binding,p_occurrence,'returned',p_return_hash,now()+interval '24 hours',p_message);
  return true;
end $$;

drop function app.claim_telegram_evidence_decision_token(text,bigint,bigint,bigint);
-- 0074 never created this resolver name on the final reviewed branch. Keep the
-- clean chain tolerant while still removing it from any intermediate database
-- that did receive an earlier draft. This committed migration had never been
-- applied anywhere when corrected; without IF EXISTS the whole 0075 transaction
-- aborts before the valid old claim-overload drop can commit.
drop function if exists app.resolve_telegram_evidence_return_reply(uuid,uuid,bigint,bigint);
create function app.claim_telegram_evidence_decision_token(
  p_hash text, p_bot bigint, p_chat bigint, p_sender bigint, p_message bigint
) returns table(
  id uuid,workspace_id uuid,project_id uuid,telegram_chat_binding_id uuid,
  requirement_occurrence_id uuid,actor_user_id uuid,actor_member_id uuid,
  action text,consumed_at timestamptz,return_prompt_message_id uuid,work_assignment_id uuid
) language plpgsql security definer set search_path='' as $$
declare chosen public.telegram_evidence_decision_tokens%rowtype;
declare actor public.memberships%rowtype;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision requires service principal';
  end if;
  select t.* into chosen
  from public.telegram_evidence_decision_tokens t
  join public.telegram_chat_bindings b
    on b.workspace_id=t.workspace_id and b.project_id=t.project_id
   and b.id=t.telegram_chat_binding_id and b.bot_id=p_bot and b.chat_id=p_chat
   and b.disconnected_at is null
  join public.project_field_channels c
    on c.workspace_id=t.workspace_id and c.project_id=t.project_id
   and c.channel='telegram' and c.state='active'
  join public.communication_messages control
    on control.id=t.decision_message_id and control.workspace_id=t.workspace_id
   and control.project_id=t.project_id
   and control.telegram_chat_binding_id=t.telegram_chat_binding_id
   and control.direction='outbound' and control.kind='text'
   and control.delivery_state='provider_accepted'
   and control.provider_message_id=p_message
  where t.token_hash=p_hash and t.expires_at>now() and t.invalidated_at is null
  ;
  if not found then return; end if;

  perform 1 from public.telegram_evidence_decision_tokens sibling
    where sibling.decision_message_id=chosen.decision_message_id
    order by sibling.id for update;
  select t.* into chosen from public.telegram_evidence_decision_tokens t
    where t.id=chosen.id and t.expires_at>now() and t.invalidated_at is null;
  if not found then return; end if;

  select m.* into actor
  from public.telegram_member_links l
  join public.memberships m
    on m.organization_id=l.workspace_id and m.id=l.member_id
   and m.status='active'
  where l.workspace_id=chosen.workspace_id and l.telegram_user_id=p_sender
    and l.revoked_at is null
    and exists (
      select 1 from public.project_access_grants g
      where g.workspace_id=chosen.workspace_id and g.project_id=chosen.project_id
        and g.member_id=m.id and g.capability in ('project.view','project.admin')
        and g.revoked_at is null and g.valid_from<=now()
        and (g.valid_until is null or g.valid_until>now())
    )
    and exists (
      select 1 from public.project_access_grants g
      where g.workspace_id=chosen.workspace_id and g.project_id=chosen.project_id
        and g.member_id=m.id and g.capability='evidence_decisions.decide'
        and g.revoked_at is null and g.valid_from<=now()
        and (g.valid_until is null or g.valid_until>now())
    )
    and not exists (
      select 1 from public.upload_intents u
      where u.workspace_id=chosen.workspace_id
        and u.requirement_occurrence_id=chosen.requirement_occurrence_id
        and u.created_by_member_id=m.id
    )
    and not exists (
      select 1 from public.evidence_objects e
      join public.upload_intents u on u.workspace_id=e.workspace_id and u.id=e.upload_intent_id
      where e.workspace_id=chosen.workspace_id
        and u.requirement_occurrence_id=chosen.requirement_occurrence_id
        and e.recorder_member_id=m.id
    )
    and not exists (
      select 1 from public.progress_entries p
      join public.requirement_occurrences o
        on o.workspace_id=p.workspace_id and o.work_assignment_id=p.work_assignment_id
      where p.workspace_id=chosen.workspace_id
        and o.id=chosen.requirement_occurrence_id
        and p.recorded_by_member_id=m.id
    )
  limit 1;
  if not found then return; end if;
  if exists (
    select 1 from public.telegram_evidence_decision_tokens sibling
    where sibling.decision_message_id=chosen.decision_message_id
      and sibling.actor_member_id is not null and sibling.actor_member_id<>actor.id
  ) then return; end if;

  update public.telegram_evidence_decision_tokens as token
    set actor_member_id=actor.id,actor_user_id=actor.user_id
    where token.decision_message_id=chosen.decision_message_id and token.actor_member_id is null;
  update public.telegram_evidence_decision_tokens as token
    set invalidated_at=coalesce(invalidated_at,now())
    where token.decision_message_id=chosen.decision_message_id and token.id<>chosen.id
      and token.consumed_at is null;

  return query
    select t.id,t.workspace_id,t.project_id,t.telegram_chat_binding_id,
      t.requirement_occurrence_id,t.actor_user_id,t.actor_member_id,t.action::text,
      t.consumed_at,t.return_prompt_message_id,o.work_assignment_id
    from public.telegram_evidence_decision_tokens t
    join public.requirement_occurrences o
      on o.workspace_id=t.workspace_id and o.project_id=t.project_id
     and o.id=t.requirement_occurrence_id
    where t.id=chosen.id;
end $$;

create function app.prepare_telegram_decision_return_prompt(p_token uuid,p_actor uuid)
returns table(work_assignment_id uuid,already_prompted boolean)
language plpgsql security definer set search_path='' as $$
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision requires service principal';
  end if;
  return query
    select o.work_assignment_id,t.return_prompt_message_id is not null
    from public.telegram_evidence_decision_tokens t
    join public.requirement_occurrences o
      on o.workspace_id=t.workspace_id and o.project_id=t.project_id
     and o.id=t.requirement_occurrence_id
    join public.telegram_chat_bindings b
      on b.workspace_id=t.workspace_id and b.project_id=t.project_id
     and b.id=t.telegram_chat_binding_id and b.disconnected_at is null
    join public.project_field_channels c
      on c.workspace_id=t.workspace_id and c.project_id=t.project_id
     and c.channel='telegram' and c.state='active'
    where t.id=p_token and t.actor_member_id=p_actor and t.action='returned'
      and t.consumed_at is null and t.invalidated_at is null and t.expires_at>now()
    for update of t;
end $$;

create function app.bind_telegram_decision_return_prompt(p_token uuid,p_actor uuid,p_prompt uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision requires service principal';
  end if;
  if not exists (
    select 1 from public.telegram_evidence_decision_tokens t
    join public.communication_messages m
      on m.id=p_prompt and m.workspace_id=t.workspace_id and m.project_id=t.project_id
     and m.telegram_chat_binding_id=t.telegram_chat_binding_id
     and m.direction='outbound' and m.kind='text' and m.delivery_state='queued'
    where t.id=p_token and t.actor_member_id=p_actor and t.action='returned'
      and t.return_prompt_message_id is null and t.consumed_at is null
      and t.invalidated_at is null and t.expires_at>now()
  ) then return false; end if;
  update public.telegram_evidence_decision_tokens
    set return_prompt_message_id=p_prompt where id=p_token;
  return true;
end $$;

create function app.reserve_telegram_evidence_return_reply(
  p_workspace uuid,p_binding uuid,p_sender bigint,p_reply uuid,p_prompt bigint
) returns table(
  id uuid,workspace_id uuid,project_id uuid,telegram_chat_binding_id uuid,
  requirement_occurrence_id uuid,actor_user_id uuid,actor_member_id uuid,
  action text,consumed_at timestamptz,return_prompt_message_id uuid,work_assignment_id uuid
) language plpgsql security definer set search_path='' as $$
declare chosen public.telegram_evidence_decision_tokens%rowtype;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision requires service principal';
  end if;
  select t.* into chosen
  from public.telegram_evidence_decision_tokens t
  join public.telegram_chat_bindings b
    on b.workspace_id=t.workspace_id and b.project_id=t.project_id
   and b.id=t.telegram_chat_binding_id and b.disconnected_at is null
  join public.project_field_channels c
    on c.workspace_id=t.workspace_id and c.project_id=t.project_id
   and c.channel='telegram' and c.state='active'
  join public.communication_messages prompt
    on prompt.id=t.return_prompt_message_id and prompt.workspace_id=t.workspace_id
   and prompt.project_id=t.project_id
   and prompt.telegram_chat_binding_id=t.telegram_chat_binding_id
   and prompt.direction='outbound' and prompt.kind='text'
   and prompt.delivery_state='provider_accepted' and prompt.provider_message_id=p_prompt
  join public.communication_messages reply
    on reply.id=p_reply and reply.workspace_id=t.workspace_id
   and reply.project_id=t.project_id
   and reply.telegram_chat_binding_id=t.telegram_chat_binding_id
   and reply.direction='inbound' and reply.kind='text' and reply.delivery_state='received'
   and reply.reply_to_message_id=prompt.id and reply.provider_reply_to_message_id=p_prompt
   and reply.provider_user_id=p_sender and reply.author_member_id=t.actor_member_id
  join public.telegram_member_links l
    on l.workspace_id=t.workspace_id and l.member_id=t.actor_member_id
   and l.telegram_user_id=p_sender and l.revoked_at is null
  join public.memberships m
    on m.organization_id=t.workspace_id and m.id=t.actor_member_id
   and m.user_id=t.actor_user_id and m.status='active'
  where t.workspace_id=p_workspace and t.telegram_chat_binding_id=p_binding
    and t.action='returned' and t.consumed_at is null and t.invalidated_at is null
    and t.expires_at>now()
    and (t.return_reply_message_id is null or t.return_reply_message_id=p_reply)
  for update of t;
  if not found then return; end if;
  update public.telegram_evidence_decision_tokens
    set return_reply_message_id=p_reply
    where public.telegram_evidence_decision_tokens.id=chosen.id
      and return_reply_message_id is null;
  return query
    select t.id,t.workspace_id,t.project_id,t.telegram_chat_binding_id,
      t.requirement_occurrence_id,t.actor_user_id,t.actor_member_id,t.action::text,
      t.consumed_at,t.return_prompt_message_id,o.work_assignment_id
    from public.telegram_evidence_decision_tokens t
    join public.requirement_occurrences o
      on o.workspace_id=t.workspace_id and o.project_id=t.project_id
     and o.id=t.requirement_occurrence_id
    where t.id=chosen.id;
end $$;

create function app.finalize_telegram_evidence_decision_token(
  p_token uuid,p_actor uuid,p_decision uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare chosen public.telegram_evidence_decision_tokens%rowtype;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision requires service principal';
  end if;
  select * into chosen from public.telegram_evidence_decision_tokens
    where id=p_token for update;
  if not found or chosen.actor_member_id is distinct from p_actor or chosen.invalidated_at is not null then return false; end if;
  if chosen.consumed_at is not null then return chosen.decision_id=p_decision; end if;
  if not exists (
    select 1 from public.requirement_evidence_decisions d
    where d.workspace_id=chosen.workspace_id and d.id=p_decision
      and d.requirement_occurrence_id=chosen.requirement_occurrence_id
      and d.decided_by_member_id=chosen.actor_member_id
      and d.outcome::text=chosen.action::text
  ) then return false; end if;
  if chosen.action='returned' and chosen.return_reply_message_id is null then return false; end if;
  update public.telegram_evidence_decision_tokens
    set consumed_at=now(),decision_id=p_decision where id=chosen.id;
  update public.telegram_evidence_decision_tokens
    set invalidated_at=coalesce(invalidated_at,now())
    where decision_message_id=chosen.decision_message_id and id<>chosen.id
      and consumed_at is null;
  return true;
end $$;

revoke select,insert,update on public.telegram_evidence_decision_tokens from goproceed_service;
revoke all on function
  app.prepare_telegram_evidence_decision_issue(uuid,uuid,uuid,uuid),
  app.issue_telegram_evidence_decision_tokens(uuid,uuid,uuid,uuid,uuid,text,text),
  app.claim_telegram_evidence_decision_token(text,bigint,bigint,bigint,bigint),
  app.prepare_telegram_decision_return_prompt(uuid,uuid),
  app.bind_telegram_decision_return_prompt(uuid,uuid,uuid),
  app.reserve_telegram_evidence_return_reply(uuid,uuid,bigint,uuid,bigint),
  app.finalize_telegram_evidence_decision_token(uuid,uuid,uuid)
from public,anon,authenticated,goproceed_app;
grant execute on function
  app.prepare_telegram_evidence_decision_issue(uuid,uuid,uuid,uuid),
  app.issue_telegram_evidence_decision_tokens(uuid,uuid,uuid,uuid,uuid,text,text),
  app.claim_telegram_evidence_decision_token(text,bigint,bigint,bigint,bigint),
  app.prepare_telegram_decision_return_prompt(uuid,uuid),
  app.bind_telegram_decision_return_prompt(uuid,uuid,uuid),
  app.reserve_telegram_evidence_return_reply(uuid,uuid,bigint,uuid,bigint),
  app.finalize_telegram_evidence_decision_token(uuid,uuid,uuid)
to goproceed_service;
