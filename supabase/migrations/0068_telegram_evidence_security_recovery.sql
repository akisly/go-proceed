-- Follow-up hardening for Telegram evidence: service role still obeys RLS,
-- cards pin their rendered occurrence set, and album claims are fenced.

alter table public.communication_messages
  add column telegram_occurrence_snapshot uuid[];

alter table public.telegram_media_groups
  add column processing_lease_token uuid,
  add column processing_lease_expires_at timestamptz,
  add column processing_generation bigint not null default 0,
  drop constraint telegram_media_groups_choice_expiry_check,
  add constraint telegram_media_groups_choice_expiry_check
    check (choice_expires_at is null or choice_expires_at >= last_part_at),
  add constraint telegram_media_groups_processing_lease_check
    check ((processing_lease_token is null) = (processing_lease_expires_at is null));

-- A new album part always advances the generation.  If it arrives while a
-- worker owns an old generation the worker must reopen rather than completing
-- a snapshot which did not include that part.
create or replace function app.bump_telegram_media_group_generation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.last_part_at is distinct from old.last_part_at then
    new.processing_generation := old.processing_generation + 1;
    if old.state = 'processing' then
      new.state := 'open';
      new.processing_lease_token := null;
      new.processing_lease_expires_at := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists telegram_media_groups_generation on public.telegram_media_groups;
create trigger telegram_media_groups_generation before update on public.telegram_media_groups
  for each row execute function app.bump_telegram_media_group_generation();

-- RLS is deny-by-default for NOBYPASSRLS service workers too.  FKs alone do
-- not express the complete tenant/project/binding ownership used by callbacks.
drop policy if exists telegram_requirement_choice_sessions_service on public.telegram_requirement_choice_sessions;
create policy telegram_requirement_choice_sessions_service
  on public.telegram_requirement_choice_sessions for all to goproceed_service
  using (
    exists (select 1 from public.project_field_channels c
      where c.workspace_id=telegram_requirement_choice_sessions.workspace_id
        and c.project_id=telegram_requirement_choice_sessions.project_id)
    and exists (select 1 from public.telegram_chat_bindings b
      where b.workspace_id=telegram_requirement_choice_sessions.workspace_id
        and b.project_id=telegram_requirement_choice_sessions.project_id
        and b.id=telegram_requirement_choice_sessions.telegram_chat_binding_id)
    and exists (select 1 from public.work_assignments a
      where a.workspace_id=telegram_requirement_choice_sessions.workspace_id
        and a.project_id=telegram_requirement_choice_sessions.project_id
        and a.id=telegram_requirement_choice_sessions.work_assignment_id)
  )
  with check (
    exists (select 1 from public.project_field_channels c
      where c.workspace_id=telegram_requirement_choice_sessions.workspace_id
        and c.project_id=telegram_requirement_choice_sessions.project_id)
    and exists (select 1 from public.telegram_chat_bindings b
      where b.workspace_id=telegram_requirement_choice_sessions.workspace_id
        and b.project_id=telegram_requirement_choice_sessions.project_id
        and b.id=telegram_requirement_choice_sessions.telegram_chat_binding_id)
    and exists (select 1 from public.work_assignments a
      where a.workspace_id=telegram_requirement_choice_sessions.workspace_id
        and a.project_id=telegram_requirement_choice_sessions.project_id
        and a.id=telegram_requirement_choice_sessions.work_assignment_id)
  );

revoke all on public.telegram_requirement_choice_sessions from public, anon, authenticated, goproceed_app;
grant select, insert, update on public.telegram_requirement_choice_sessions to goproceed_service;

-- The worker has no member subject until it resolves the Telegram link.  Keep
-- that bootstrap lookup bounded to one exact binding/card rather than granting
-- the service principal broad occurrence reads under RLS.
create or replace function app.resolve_telegram_evidence_context(
  p_workspace_id uuid, p_project_id uuid, p_binding_id uuid,
  p_sender_id bigint, p_reply_message_id bigint
) returns table (
  assignment_id uuid, actor_user_id uuid, occurrence_id uuid,
  allowed_media jsonb, label text
)
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram evidence context requires service principal';
  end if;
  return query
    select card.work_assignment_id, m.user_id, o.id, rv.allowed_media,
           left(o.acceptance_criterion, 120)
      from public.telegram_member_links l
      join public.memberships m on m.organization_id=l.workspace_id and m.id=l.member_id
      join public.project_access_grants g on g.workspace_id=l.workspace_id
        and g.project_id=p_project_id and g.member_id=l.member_id and g.capability='evidence.record'
      join public.communication_messages card on card.workspace_id=l.workspace_id
        and card.project_id=p_project_id and card.telegram_chat_binding_id=p_binding_id
        and card.provider_message_id=p_reply_message_id and card.kind='assignment_card'
        and card.delivery_state='provider_accepted' and card.work_assignment_id is not null
      join public.requirement_occurrences o on o.workspace_id=card.workspace_id
        and o.project_id=card.project_id and o.work_assignment_id=card.work_assignment_id
      join public.requirement_rule_versions rv on rv.workspace_id=o.workspace_id and rv.id=o.rule_version_id
     where l.workspace_id=p_workspace_id and l.telegram_user_id=p_sender_id
       and l.revoked_at is null and m.status='active'
       and card.telegram_occurrence_snapshot @> array[o.id]
       and o.evidence_kind in ('photo','document')
     order by o.ordinal, o.id;
end $$;
revoke all on function app.resolve_telegram_evidence_context(uuid,uuid,uuid,bigint,bigint)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.resolve_telegram_evidence_context(uuid,uuid,uuid,bigint,bigint)
  to goproceed_service;
