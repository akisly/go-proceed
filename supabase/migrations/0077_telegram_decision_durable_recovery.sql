-- Durable decision-control publication and attributed decision attempts.
-- Every privileged entry point is service-only, derives tenant scope from
-- persisted rows, and uses an empty search path.

create table public.telegram_evidence_decision_attempts (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null,
  workspace_id uuid not null,
  project_id uuid not null,
  telegram_chat_binding_id uuid not null,
  requirement_occurrence_id uuid not null,
  actor_user_id uuid not null,
  actor_member_id uuid not null,
  action text not null,
  reason text,
  return_reply_message_id uuid,
  attempt_started_at timestamptz not null,
  expected_version bigint,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'pending',
  decision_id uuid,
  failure_code text,
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  lease_id uuid,
  lease_expires_at timestamptz,
  leased_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id,id),
  unique (token_id),
  unique (idempotency_key),
  foreign key (workspace_id,token_id)
    references public.telegram_evidence_decision_tokens(workspace_id,id),
  foreign key (workspace_id,project_id)
    references public.project_field_channels(workspace_id,project_id),
  foreign key (workspace_id,project_id,telegram_chat_binding_id)
    references public.telegram_chat_bindings(workspace_id,project_id,id),
  foreign key (workspace_id,project_id,requirement_occurrence_id)
    references public.requirement_occurrences(workspace_id,project_id,id),
  foreign key (workspace_id,actor_member_id)
    references public.memberships(workspace_id,id),
  foreign key (return_reply_message_id) references public.communication_messages(id),
  foreign key (workspace_id,decision_id)
    references public.requirement_evidence_decisions(workspace_id,id),
  check (action in ('accepted','returned')),
  check (request_hash ~ '^[0-9a-f]{64}$'),
  check (status in ('pending','completed','failed_permanent')),
  check (attempt_count>=0),
  check ((action='accepted' and reason is null and return_reply_message_id is null)
      or (action='returned' and nullif(btrim(reason),'') is not null and return_reply_message_id is not null)),
  check ((status='completed' and decision_id is not null and failure_code is null)
      or (status='failed_permanent' and decision_id is null and failure_code is not null)
      or (status='pending' and decision_id is null and failure_code is null)),
  check ((lease_id is null and lease_expires_at is null and leased_by is null)
      or (lease_id is not null and lease_expires_at is not null and leased_by is not null))
);

create index telegram_evidence_decision_attempts_due_idx
  on public.telegram_evidence_decision_attempts(available_at,id)
  where status='pending';

create function app.guard_telegram_evidence_decision_attempt()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.token_id is distinct from new.token_id
     or old.workspace_id is distinct from new.workspace_id
     or old.project_id is distinct from new.project_id
     or old.telegram_chat_binding_id is distinct from new.telegram_chat_binding_id
     or old.requirement_occurrence_id is distinct from new.requirement_occurrence_id
     or old.actor_user_id is distinct from new.actor_user_id
     or old.actor_member_id is distinct from new.actor_member_id
     or old.action is distinct from new.action
     or old.reason is distinct from new.reason
     or old.return_reply_message_id is distinct from new.return_reply_message_id
     or old.attempt_started_at is distinct from new.attempt_started_at
     or old.expected_version is distinct from new.expected_version
     or old.idempotency_key is distinct from new.idempotency_key
     or old.request_hash is distinct from new.request_hash
     or old.created_at is distinct from new.created_at then
    raise exception 'telegram decision attempt identity immutable';
  end if;
  if old.status<>'pending' then
    raise exception 'telegram decision attempt terminal';
  end if;
  return new;
end $$;

create trigger telegram_evidence_decision_attempts_guard
before update on public.telegram_evidence_decision_attempts
for each row execute function app.guard_telegram_evidence_decision_attempt();

alter table public.telegram_evidence_decision_attempts enable row level security;
revoke all on table public.telegram_evidence_decision_attempts from public,anon,authenticated,goproceed_app,goproceed_service;

create or replace function app.prepare_telegram_evidence_decision_issue(
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
  -- Fence archive, health, disconnect, and rebinding until the control message,
  -- outbox row, and token pair commit together.
  perform 1
  from public.project_field_channels c
  join public.telegram_chat_bindings b
    on b.workspace_id=c.workspace_id and b.project_id=c.project_id
   and b.id=p_binding and b.disconnected_at is null
  where c.workspace_id=p_workspace and c.project_id=p_project
    and c.channel='telegram' and c.state='active'
  for update of c,b;
  if not found then return; end if;
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
    where o.workspace_id=p_workspace and o.project_id=p_project and o.id=p_occurrence
      and ((p_source_kind='attachment' and exists (
        select 1 from public.communication_attachments a
        join public.evidence_objects e on e.workspace_id=a.workspace_id
          and e.project_id=a.project_id and e.id=a.evidence_object_id
        where a.workspace_id=o.workspace_id and a.project_id=o.project_id
          and a.id=p_source_id and a.requirement_occurrence_id=o.id and a.state='available'
          and a.telegram_media_group_id is null
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

create function app.list_due_telegram_evidence_decision_controls(p_limit integer)
returns table(
  workspace_id uuid,project_id uuid,telegram_chat_binding_id uuid,
  requirement_occurrence_id uuid,review_source_kind text,
  review_source_id uuid,review_source_generation bigint
) language plpgsql security definer set search_path='' as $$
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision recovery requires service principal';
  end if;
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'telegram decision recovery limit invalid';
  end if;
  return query
    with candidates as (
      select a.workspace_id,a.project_id,m.telegram_chat_binding_id,
        a.requirement_occurrence_id,'attachment'::text as source_kind,a.id as source_id,0::bigint as source_generation
      from public.communication_attachments a
      join public.communication_messages m on m.workspace_id=a.workspace_id and m.id=a.message_id
      where a.state='available' and a.evidence_object_id is not null
        and a.requirement_occurrence_id is not null and a.telegram_media_group_id is null
      union
      select a.workspace_id,a.project_id,m.telegram_chat_binding_id,
        a.requirement_occurrence_id,'media_group'::text,g.id,g.processing_generation
      from public.communication_attachments a
      join public.communication_messages m on m.workspace_id=a.workspace_id and m.id=a.message_id
      join public.telegram_media_groups g on g.workspace_id=a.workspace_id
        and g.project_id=a.project_id and g.id=a.telegram_media_group_id
      where a.state='available' and a.evidence_object_id is not null
        and a.requirement_occurrence_id is not null
    )
    select candidate.workspace_id,candidate.project_id,candidate.telegram_chat_binding_id,
      candidate.requirement_occurrence_id,candidate.source_kind,candidate.source_id,candidate.source_generation
    from candidates candidate
    join public.telegram_chat_bindings b on b.workspace_id=candidate.workspace_id
      and b.project_id=candidate.project_id and b.id=candidate.telegram_chat_binding_id
      and b.disconnected_at is null
    join public.project_field_channels c on c.workspace_id=candidate.workspace_id
      and c.project_id=candidate.project_id and c.channel='telegram' and c.state='active'
    where not exists (
      select 1 from public.telegram_evidence_decision_tokens t
      where t.workspace_id=candidate.workspace_id and t.project_id=candidate.project_id
        and t.telegram_chat_binding_id=candidate.telegram_chat_binding_id
        and t.requirement_occurrence_id=candidate.requirement_occurrence_id
        and t.review_source_kind=candidate.source_kind and t.review_source_id=candidate.source_id
        and t.review_source_generation=candidate.source_generation
    )
    order by candidate.workspace_id,candidate.source_kind,candidate.source_id,candidate.requirement_occurrence_id
    limit p_limit;
end $$;

create or replace function app.claim_telegram_evidence_decision_token(
  p_hash text,p_bot bigint,p_chat bigint,p_sender bigint,p_message bigint
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
  join public.telegram_chat_bindings b on b.workspace_id=t.workspace_id and b.project_id=t.project_id
    and b.id=t.telegram_chat_binding_id and b.bot_id=p_bot and b.chat_id=p_chat and b.disconnected_at is null
  join public.project_field_channels c on c.workspace_id=t.workspace_id and c.project_id=t.project_id
    and c.channel='telegram' and c.state='active'
  join public.communication_messages control on control.id=t.decision_message_id
    and control.workspace_id=t.workspace_id and control.project_id=t.project_id
    and control.telegram_chat_binding_id=t.telegram_chat_binding_id
    and control.direction='outbound' and control.kind='text'
    and control.delivery_state='provider_accepted' and control.provider_message_id=p_message
  where t.token_hash=p_hash and t.expires_at>clock_timestamp() and t.invalidated_at is null;
  if not found then return; end if;

  -- One stable lock per control pair avoids opposite sibling row-lock order.
  perform pg_advisory_xact_lock(hashtextextended(chosen.decision_message_id::text,0));
  select t.* into chosen
  from public.telegram_evidence_decision_tokens t
  join public.telegram_chat_bindings b on b.workspace_id=t.workspace_id and b.project_id=t.project_id
    and b.id=t.telegram_chat_binding_id and b.bot_id=p_bot and b.chat_id=p_chat and b.disconnected_at is null
  join public.project_field_channels c on c.workspace_id=t.workspace_id and c.project_id=t.project_id
    and c.channel='telegram' and c.state='active'
  join public.communication_messages control on control.id=t.decision_message_id
    and control.workspace_id=t.workspace_id and control.project_id=t.project_id
    and control.telegram_chat_binding_id=t.telegram_chat_binding_id
    and control.direction='outbound' and control.kind='text'
    and control.delivery_state='provider_accepted' and control.provider_message_id=p_message
  where t.id=chosen.id and t.token_hash=p_hash
    and t.expires_at>clock_timestamp() and t.invalidated_at is null
  for update of t;
  if not found then return; end if;

  select m.* into actor
  from public.telegram_member_links l
  join public.memberships m on m.organization_id=l.workspace_id and m.id=l.member_id and m.status='active'
  where l.workspace_id=chosen.workspace_id and l.telegram_user_id=p_sender and l.revoked_at is null
    and exists (select 1 from public.project_access_grants g
      where g.workspace_id=chosen.workspace_id and g.project_id=chosen.project_id and g.member_id=m.id
        and g.capability in ('project.view','project.admin') and g.revoked_at is null
        and g.valid_from<=clock_timestamp() and (g.valid_until is null or g.valid_until>clock_timestamp()))
    and exists (select 1 from public.project_access_grants g
      where g.workspace_id=chosen.workspace_id and g.project_id=chosen.project_id and g.member_id=m.id
        and g.capability='evidence_decisions.decide' and g.revoked_at is null
        and g.valid_from<=clock_timestamp() and (g.valid_until is null or g.valid_until>clock_timestamp()))
    and not exists (select 1 from public.upload_intents u
      where u.workspace_id=chosen.workspace_id and u.requirement_occurrence_id=chosen.requirement_occurrence_id
        and u.created_by_member_id=m.id)
    and not exists (select 1 from public.evidence_objects e
      join public.upload_intents u on u.workspace_id=e.workspace_id and u.id=e.upload_intent_id
      where e.workspace_id=chosen.workspace_id and u.requirement_occurrence_id=chosen.requirement_occurrence_id
        and e.recorder_member_id=m.id)
    and not exists (select 1 from public.progress_entries p
      join public.requirement_occurrences o on o.workspace_id=p.workspace_id and o.work_assignment_id=p.work_assignment_id
      where p.workspace_id=chosen.workspace_id and o.id=chosen.requirement_occurrence_id
        and p.recorded_by_member_id=m.id)
  limit 1;
  if not found then return; end if;
  if exists (select 1 from public.telegram_evidence_decision_tokens sibling
    where sibling.decision_message_id=chosen.decision_message_id
      and sibling.actor_member_id is not null and sibling.actor_member_id<>actor.id) then return; end if;

  update public.telegram_evidence_decision_tokens token
    set actor_member_id=actor.id,actor_user_id=actor.user_id
    where token.decision_message_id=chosen.decision_message_id and token.actor_member_id is null;
  update public.telegram_evidence_decision_tokens token
    set invalidated_at=coalesce(invalidated_at,clock_timestamp())
    where token.decision_message_id=chosen.decision_message_id and token.id<>chosen.id and token.consumed_at is null;

  return query select t.id,t.workspace_id,t.project_id,t.telegram_chat_binding_id,
    t.requirement_occurrence_id,t.actor_user_id,t.actor_member_id,t.action::text,
    t.consumed_at,t.return_prompt_message_id,o.work_assignment_id
  from public.telegram_evidence_decision_tokens t
  join public.requirement_occurrences o on o.workspace_id=t.workspace_id
    and o.project_id=t.project_id and o.id=t.requirement_occurrence_id
  where t.id=chosen.id;
end $$;

create function app.start_telegram_evidence_decision_attempt(
  p_token uuid,p_actor uuid,p_reply uuid,p_expected_version bigint,p_request_hash text
) returns table(
  id uuid,token_id uuid,workspace_id uuid,project_id uuid,telegram_chat_binding_id uuid,
  requirement_occurrence_id uuid,actor_user_id uuid,actor_member_id uuid,action text,
  reason text,return_reply_message_id uuid,expected_version bigint,idempotency_key text,
  request_hash text,status text,decision_id uuid,lease_id uuid
) language plpgsql security definer set search_path='' as $$
declare chosen public.telegram_evidence_decision_tokens%rowtype;
declare existing public.telegram_evidence_decision_attempts%rowtype;
declare attempt_id uuid:=gen_random_uuid();
declare exact_reason text;
declare started_at timestamptz;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision attempt requires service principal';
  end if;
  if p_request_hash !~ '^[0-9a-f]{64}$' then return; end if;
  select * into chosen from public.telegram_evidence_decision_tokens where public.telegram_evidence_decision_tokens.id=p_token for update;
  if not found or chosen.actor_member_id is distinct from p_actor or chosen.consumed_at is not null
     or chosen.invalidated_at is not null then return; end if;
  select * into existing from public.telegram_evidence_decision_attempts a where a.token_id=chosen.id for update;
  if found then
    if existing.actor_member_id is distinct from p_actor
       or existing.return_reply_message_id is distinct from p_reply
       or existing.expected_version is distinct from p_expected_version
       or existing.request_hash is distinct from p_request_hash then return; end if;
    return query select existing.id,existing.token_id,existing.workspace_id,existing.project_id,
      existing.telegram_chat_binding_id,existing.requirement_occurrence_id,existing.actor_user_id,
      existing.actor_member_id,existing.action,existing.reason,existing.return_reply_message_id,
      existing.expected_version,existing.idempotency_key,existing.request_hash,existing.status,
      existing.decision_id,existing.lease_id;
    return;
  end if;
  perform 1 from public.project_field_channels c
  join public.telegram_chat_bindings b on b.workspace_id=c.workspace_id and b.project_id=c.project_id
    and b.id=chosen.telegram_chat_binding_id and b.disconnected_at is null
  where c.workspace_id=chosen.workspace_id and c.project_id=chosen.project_id
    and c.channel='telegram' and c.state='active' for update of c,b;
  if not found then return; end if;
  started_at:=clock_timestamp();
  if started_at>=chosen.expires_at then return; end if;

  if chosen.action='accepted' then
      if p_reply is not null then return; end if;
  else
      if p_reply is null then return; end if;
      select nullif(btrim(reply.text),'') into exact_reason
      from public.communication_messages reply
      join public.communication_messages prompt on prompt.id=chosen.return_prompt_message_id
        and prompt.workspace_id=chosen.workspace_id and prompt.project_id=chosen.project_id
        and prompt.telegram_chat_binding_id=chosen.telegram_chat_binding_id
        and prompt.direction='outbound' and prompt.kind='text'
        and prompt.delivery_state='provider_accepted' and prompt.provider_message_id is not null
      where reply.id=p_reply and reply.workspace_id=chosen.workspace_id and reply.project_id=chosen.project_id
        and reply.telegram_chat_binding_id=chosen.telegram_chat_binding_id
        and reply.direction='inbound' and reply.kind='text' and reply.delivery_state='received'
        and reply.reply_to_message_id=prompt.id and reply.provider_reply_to_message_id=prompt.provider_message_id
        and reply.author_member_id=chosen.actor_member_id;
      if exact_reason is null then return; end if;
  end if;
  insert into public.telegram_evidence_decision_attempts(
      id,token_id,workspace_id,project_id,telegram_chat_binding_id,requirement_occurrence_id,
      actor_user_id,actor_member_id,action,reason,return_reply_message_id,attempt_started_at,
      expected_version,idempotency_key,request_hash
    ) values (
      attempt_id,chosen.id,chosen.workspace_id,chosen.project_id,chosen.telegram_chat_binding_id,
      chosen.requirement_occurrence_id,chosen.actor_user_id,chosen.actor_member_id,chosen.action,
      exact_reason,p_reply,started_at,p_expected_version,'telegram-decision-attempt:'||attempt_id::text,p_request_hash
  ) returning * into existing;
  return query select existing.id,existing.token_id,existing.workspace_id,existing.project_id,
    existing.telegram_chat_binding_id,existing.requirement_occurrence_id,existing.actor_user_id,
    existing.actor_member_id,existing.action,existing.reason,existing.return_reply_message_id,
    existing.expected_version,existing.idempotency_key,existing.request_hash,existing.status,
    existing.decision_id,existing.lease_id;
end $$;

create function app.claim_telegram_evidence_decision_attempts(
  p_limit integer,p_worker text,p_lease_seconds integer
) returns setof public.telegram_evidence_decision_attempts
language plpgsql security definer set search_path='' as $$
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision recovery requires service principal';
  end if;
  if p_limit is null or p_limit<1 or p_limit>100 or nullif(btrim(p_worker),'') is null
     or p_lease_seconds is null or p_lease_seconds<1 or p_lease_seconds>300 then
    raise exception 'telegram decision recovery claim invalid';
  end if;
  return query
    with due as (
      select a.id from public.telegram_evidence_decision_attempts a
      where a.status='pending' and a.available_at<=clock_timestamp()
        and (a.lease_expires_at is null or a.lease_expires_at<=clock_timestamp())
      order by a.available_at,a.id limit p_limit for update skip locked
    )
    update public.telegram_evidence_decision_attempts a
      set lease_id=gen_random_uuid(),lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds),
          leased_by=left(btrim(p_worker),200),attempt_count=a.attempt_count+1,updated_at=clock_timestamp()
    from due where a.id=due.id returning a.*;
end $$;

create function app.finalize_telegram_evidence_decision_attempt(
  p_attempt uuid,p_lease uuid,p_decision uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare attempt public.telegram_evidence_decision_attempts%rowtype;
declare chosen public.telegram_evidence_decision_tokens%rowtype;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision attempt requires service principal';
  end if;
  select * into attempt from public.telegram_evidence_decision_attempts where id=p_attempt for update;
  if not found then return false; end if;
  if attempt.status='completed' then return attempt.decision_id=p_decision; end if;
  if attempt.status<>'pending' or not ((attempt.lease_id is null and p_lease is null)
      or (attempt.lease_id=p_lease and attempt.lease_expires_at>clock_timestamp())) then return false; end if;
  select * into chosen from public.telegram_evidence_decision_tokens where id=attempt.token_id for update;
  if not found or chosen.actor_member_id<>attempt.actor_member_id or chosen.action<>attempt.action
     or chosen.invalidated_at is not null or attempt.attempt_started_at>chosen.expires_at then return false; end if;
  if chosen.consumed_at is not null then
    if chosen.decision_id<>p_decision then return false; end if;
  elsif not exists (select 1 from public.requirement_evidence_decisions d
    where d.workspace_id=attempt.workspace_id and d.id=p_decision
      and d.requirement_occurrence_id=attempt.requirement_occurrence_id
      and d.decided_by_member_id=attempt.actor_member_id and d.outcome::text=attempt.action) then return false;
  else
    update public.telegram_evidence_decision_tokens
      set return_reply_message_id=attempt.return_reply_message_id,consumed_at=clock_timestamp(),decision_id=p_decision
      where id=chosen.id;
    update public.telegram_evidence_decision_tokens
      set invalidated_at=coalesce(invalidated_at,clock_timestamp())
      where decision_message_id=chosen.decision_message_id and id<>chosen.id and consumed_at is null;
  end if;
  update public.telegram_evidence_decision_attempts
    set status='completed',decision_id=p_decision,failure_code=null,
        lease_id=null,lease_expires_at=null,leased_by=null,updated_at=clock_timestamp()
    where id=attempt.id;
  return true;
end $$;

create function app.fail_telegram_evidence_decision_attempt(
  p_attempt uuid,p_lease uuid,p_code text
) returns boolean language plpgsql security definer set search_path='' as $$
declare attempt public.telegram_evidence_decision_attempts%rowtype;
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision attempt requires service principal';
  end if;
  if nullif(btrim(p_code),'') is null then return false; end if;
  select * into attempt from public.telegram_evidence_decision_attempts where id=p_attempt for update;
  if not found then return false; end if;
  if attempt.status='failed_permanent' then return true; end if;
  if attempt.status<>'pending' or not ((attempt.lease_id is null and p_lease is null)
      or (attempt.lease_id=p_lease and attempt.lease_expires_at>clock_timestamp())) then return false; end if;
  update public.telegram_evidence_decision_attempts
    set status='failed_permanent',failure_code=left(btrim(p_code),200),
        lease_id=null,lease_expires_at=null,leased_by=null,updated_at=clock_timestamp()
    where id=attempt.id;
  update public.telegram_evidence_decision_tokens
    set invalidated_at=coalesce(invalidated_at,clock_timestamp())
    where id=attempt.token_id and consumed_at is null;
  return true;
end $$;

create function app.retry_telegram_evidence_decision_attempt(
  p_attempt uuid,p_lease uuid,p_code text
) returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not pg_has_role(session_user,'goproceed_service','member') then
    raise exception 'telegram decision recovery requires service principal';
  end if;
  if p_code is distinct from 'telegram_decision_transient' then return false; end if;
  update public.telegram_evidence_decision_attempts
    set available_at=clock_timestamp()+make_interval(secs=>least(300,greatest(30,attempt_count*30))),
        lease_id=null,lease_expires_at=null,leased_by=null,updated_at=clock_timestamp()
  where id=p_attempt and status='pending' and lease_id=p_lease and lease_expires_at>clock_timestamp();
  return found;
end $$;

revoke all on function
  app.prepare_telegram_evidence_decision_issue(uuid,uuid,uuid,uuid,text,uuid,bigint),
  app.list_due_telegram_evidence_decision_controls(integer),
  app.claim_telegram_evidence_decision_token(text,bigint,bigint,bigint,bigint),
  app.start_telegram_evidence_decision_attempt(uuid,uuid,uuid,bigint,text),
  app.claim_telegram_evidence_decision_attempts(integer,text,integer),
  app.finalize_telegram_evidence_decision_attempt(uuid,uuid,uuid),
  app.fail_telegram_evidence_decision_attempt(uuid,uuid,text),
  app.retry_telegram_evidence_decision_attempt(uuid,uuid,text)
from public,anon,authenticated,goproceed_app;
grant execute on function
  app.prepare_telegram_evidence_decision_issue(uuid,uuid,uuid,uuid,text,uuid,bigint),
  app.list_due_telegram_evidence_decision_controls(integer),
  app.claim_telegram_evidence_decision_token(text,bigint,bigint,bigint,bigint),
  app.start_telegram_evidence_decision_attempt(uuid,uuid,uuid,bigint,text),
  app.claim_telegram_evidence_decision_attempts(integer,text,integer),
  app.finalize_telegram_evidence_decision_attempt(uuid,uuid,uuid),
  app.fail_telegram_evidence_decision_attempt(uuid,uuid,text),
  app.retry_telegram_evidence_decision_attempt(uuid,uuid,text)
to goproceed_service;
