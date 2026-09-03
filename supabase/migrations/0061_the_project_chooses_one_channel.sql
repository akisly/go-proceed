-- A project may choose exactly one field-communication channel while it is a
-- draft; activation makes that choice operational and records who locked it.
create type public.project_status as enum ('draft','active','archived');
create type public.field_communication_channel as enum ('telegram');
create type public.project_field_channel_state as enum
  ('unbound','connected','active','unhealthy','archived');

alter table public.projects
  add column status public.project_status not null default 'active';

create table public.project_field_channels (
  workspace_id uuid not null,
  project_id uuid not null,
  channel public.field_communication_channel not null,
  state public.project_field_channel_state not null default 'unbound',
  locked_at timestamptz,
  locked_by_member_id uuid,
  last_healthy_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, project_id),
  foreign key (workspace_id, project_id)
    references public.projects(workspace_id, id),
  foreign key (workspace_id, locked_by_member_id)
    references public.memberships(organization_id, id),
  check ((locked_at is null and locked_by_member_id is null)
      or (locked_at is not null and locked_by_member_id is not null))
);

revoke all on public.project_field_channels from public, anon, authenticated;
grant select, insert, update on public.project_field_channels to goproceed_app;
alter table public.project_field_channels enable row level security;
create policy pfc_select on public.project_field_channels for select to goproceed_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy pfc_insert on public.project_field_channels for insert to goproceed_app
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));
create policy pfc_update on public.project_field_channels for update to goproceed_app
  using (app.has_project_capability(workspace_id, project_id, array['project.admin']))
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));

create or replace function app.guard_project_field_channel() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- The one exceptional write that creates the lock must come from a connected,
  -- recently healthy channel. A selected channel alone is not a Telegram group.
  if old.locked_at is null and new.locked_at is not null
     and (old.state <> 'connected' or old.last_healthy_at is null or new.state <> 'active') then
    raise exception 'only a connected healthy field channel may be locked';
  end if;

  if old.locked_at is not null then
    if new.channel is distinct from old.channel
       or new.locked_at is distinct from old.locked_at
       or new.locked_by_member_id is distinct from old.locked_by_member_id then
      raise exception 'locked field channel identity is immutable';
    end if;
    if (old.state = 'active' and new.state not in ('active','unhealthy'))
       or (old.state = 'unhealthy' and new.state not in ('unhealthy','active'))
       or (old.state = 'archived' and new.state <> 'archived') then
      raise exception 'locked field channel admits only health-state transitions';
    end if;
    if new.last_healthy_at is null
       or new.last_healthy_at < old.last_healthy_at then
      raise exception 'locked field channel health cannot be cleared or moved backwards';
    end if;
  end if;
  return new;
end $$;
revoke all on function app.guard_project_field_channel() from public;
create trigger project_field_channels_guard
  before update on public.project_field_channels
  for each row execute function app.guard_project_field_channel();

alter table public.project_access_grants
  drop constraint project_access_grants_capability_check;
alter table public.project_access_grants
  add constraint project_access_grants_capability_check
  check (capability = any (array[
    'project.admin','project.view','contracts.edit','imports.manage','imports.publish',
    'assignments.manage','progress.record','progress.adjust','evidence.record',
    'rule_bindings.manage','requirements.assign',
    'requirement_exceptions.decide','evidence_decisions.decide','stage_closures.close',
    'readiness.view','statutory_acts.compose','packages.submit','communication.reply'
  ]));
