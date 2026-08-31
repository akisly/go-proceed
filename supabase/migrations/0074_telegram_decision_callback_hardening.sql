-- Forward-only hardening: decision tokens start unclaimed in a group and are
-- bound atomically to the first currently-authorized linked PTV actor.
alter table public.telegram_evidence_decision_tokens
  alter column actor_user_id drop not null,
  alter column actor_member_id drop not null,
  add column decision_message_id uuid,
  add constraint telegram_evidence_decision_token_actor_pair_check
    check ((actor_user_id is null) = (actor_member_id is null)),
  add constraint telegram_evidence_decision_token_terminal_check
    check ((consumed_at is null) = (decision_id is null));
alter table public.telegram_evidence_decision_tokens
  add constraint telegram_evidence_decision_token_message_fkey
  foreign key (decision_message_id) references public.communication_messages(id);
create unique index telegram_evidence_decision_active_action_uniq on public.telegram_evidence_decision_tokens
  (workspace_id, telegram_chat_binding_id, requirement_occurrence_id, action) where consumed_at is null;
create or replace function app.guard_telegram_evidence_decision_token() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.workspace_id<>new.workspace_id or old.project_id<>new.project_id or old.telegram_chat_binding_id<>new.telegram_chat_binding_id
    or old.requirement_occurrence_id<>new.requirement_occurrence_id or old.action<>new.action or old.token_hash<>new.token_hash then
   raise exception 'telegram decision token identity immutable';
 end if;
 if old.actor_member_id is not null and (old.actor_member_id is distinct from new.actor_member_id or old.actor_user_id is distinct from new.actor_user_id) then
   raise exception 'telegram decision token actor immutable once claimed';
 end if;
 if old.return_prompt_message_id is not null and old.return_prompt_message_id is distinct from new.return_prompt_message_id then
   raise exception 'telegram decision prompt immutable';
 end if;
 if old.consumed_at is not null then raise exception 'telegram decision token terminal'; end if;
 return new;
end $$;
create trigger telegram_evidence_decision_token_guard before update on public.telegram_evidence_decision_tokens
 for each row execute function app.guard_telegram_evidence_decision_token();

create or replace function app.resolve_telegram_evidence_decision_context(p_workspace uuid,p_project uuid,p_binding uuid,p_occurrence uuid)
returns table(work_assignment_id uuid) language plpgsql security definer set search_path='' as $$
begin
 if not pg_has_role(session_user,'goproceed_service','member') then raise exception 'telegram decision requires service principal'; end if;
 return query select o.work_assignment_id from public.requirement_occurrences o
 join public.telegram_chat_bindings b on b.workspace_id=o.workspace_id and b.project_id=o.project_id and b.id=p_binding and b.disconnected_at is null
 join public.project_field_channels c on c.workspace_id=b.workspace_id and c.project_id=b.project_id and c.channel='telegram' and c.state='active'
 where o.workspace_id=p_workspace and o.project_id=p_project and o.id=p_occurrence
   and exists (select 1 from public.communication_attachments a where a.workspace_id=o.workspace_id and a.requirement_occurrence_id=o.id and a.state='available');
end $$;

create or replace function app.claim_telegram_evidence_decision_token(p_hash text,p_bot bigint,p_chat bigint,p_sender bigint)
returns table(id uuid,workspace_id uuid,project_id uuid,telegram_chat_binding_id uuid,requirement_occurrence_id uuid,actor_user_id uuid,actor_member_id uuid,action text,consumed_at timestamptz,return_prompt_message_id uuid,work_assignment_id uuid)
language plpgsql security definer set search_path='' as $$
declare t public.telegram_evidence_decision_tokens; m public.memberships;
begin
 if not pg_has_role(session_user,'goproceed_service','member') then raise exception 'telegram decision requires service principal'; end if;
 select t0.* into t from public.telegram_evidence_decision_tokens t0 join public.telegram_chat_bindings b on b.workspace_id=t0.workspace_id and b.id=t0.telegram_chat_binding_id
 join public.project_field_channels c on c.workspace_id=b.workspace_id and c.project_id=b.project_id and c.channel='telegram' and c.state='active'
 where t0.token_hash=p_hash and b.bot_id=p_bot and b.chat_id=p_chat and b.disconnected_at is null and t0.expires_at>now() for update;
 if not found then return; end if;
 select mm.* into m from public.telegram_member_links l join public.memberships mm on mm.organization_id=l.workspace_id and mm.id=l.member_id
 where l.workspace_id=t.workspace_id and l.telegram_user_id=p_sender and l.revoked_at is null and mm.status='active'
 and exists (select 1 from public.project_access_grants g where g.workspace_id=t.workspace_id and g.project_id=t.project_id and g.member_id=mm.id and g.capability in ('project.view','project.admin') and g.revoked_at is null and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now()))
 and exists (select 1 from public.project_access_grants g where g.workspace_id=t.workspace_id and g.project_id=t.project_id and g.member_id=mm.id and g.capability='evidence_decisions.decide' and g.revoked_at is null and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())) limit 1;
 if not found or (t.actor_member_id is not null and t.actor_member_id<>m.id) then return; end if;
 update public.telegram_evidence_decision_tokens set actor_member_id=m.id,actor_user_id=m.user_id where id=t.id and actor_member_id is null;
 return query select t.id,t.workspace_id,t.project_id,t.telegram_chat_binding_id,t.requirement_occurrence_id,m.user_id,m.id,t.action::text,t.consumed_at,t.return_prompt_message_id,o.work_assignment_id from public.requirement_occurrences o where o.workspace_id=t.workspace_id and o.id=t.requirement_occurrence_id;
end $$;

revoke all on function app.resolve_telegram_evidence_decision_context(uuid,uuid,uuid,uuid),app.claim_telegram_evidence_decision_token(text,bigint,bigint,bigint) from public,anon,authenticated,goproceed_app;
grant execute on function app.resolve_telegram_evidence_decision_context(uuid,uuid,uuid,uuid),app.claim_telegram_evidence_decision_token(text,bigint,bigint,bigint) to goproceed_service;
