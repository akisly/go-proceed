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
