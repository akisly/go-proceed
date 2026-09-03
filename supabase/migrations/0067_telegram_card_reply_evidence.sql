-- A Telegram image becomes evidence only through one delivered assignment card.
-- Choice tokens are opaque callback capabilities: their contents never contain
-- tenant, assignment, occurrence, or provider identifiers.

alter table public.telegram_media_groups
  add column reply_provider_message_id bigint,
  add column work_assignment_id uuid,
  add column last_part_at timestamptz not null default now(),
  add column choice_expires_at timestamptz,
  add constraint telegram_media_groups_assignment_fkey
    foreign key (workspace_id, project_id, work_assignment_id)
    references public.work_assignments(workspace_id, project_id, id),
  add constraint telegram_media_groups_choice_expiry_check
    check (choice_expires_at is null or choice_expires_at >= created_at);

alter table public.communication_messages
  add column telegram_reply_markup jsonb;

create or replace function app.prepare_telegram_delivery_with_markup(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_bot_id bigint,
  p_lease_seconds integer
) returns table (
  message_id uuid, workspace_id uuid, project_id uuid, chat_id text, text text,
  kind text, reply_provider_message_id text, eligible boolean, telegram_reply_markup jsonb
)
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram delivery requires the service principal';
  end if;
  return query
    select p.message_id, p.workspace_id, p.project_id, p.chat_id, p.text, p.kind,
           p.reply_provider_message_id, p.eligible, m.telegram_reply_markup
      from app.prepare_telegram_delivery(p_outbox_id, p_lease_token, p_bot_id, p_lease_seconds) p
      join public.communication_messages m on m.workspace_id=p.workspace_id and m.id=p.message_id;
end $$;
revoke all on function app.prepare_telegram_delivery_with_markup(uuid, uuid, bigint, integer)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.prepare_telegram_delivery_with_markup(uuid, uuid, bigint, integer)
  to goproceed_service;

create index telegram_media_groups_due_idx
  on public.telegram_media_groups (last_part_at)
  where state = 'open';

create table public.telegram_requirement_choice_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  telegram_chat_binding_id uuid not null,
  uploader_member_id uuid not null,
  work_assignment_id uuid not null,
  communication_attachment_id uuid,
  telegram_media_group_id uuid,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  candidate_occurrence_id uuid not null,
  allowed_occurrence_ids uuid[] not null check (cardinality(allowed_occurrence_ids) > 1),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  chosen_occurrence_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (token_hash),
  foreign key (workspace_id, project_id)
    references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, telegram_chat_binding_id)
    references public.telegram_chat_bindings(workspace_id, project_id, id),
  foreign key (workspace_id, uploader_member_id)
    references public.memberships(organization_id, id),
  foreign key (workspace_id, project_id, work_assignment_id)
    references public.work_assignments(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, communication_attachment_id)
    references public.communication_attachments(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, telegram_media_group_id)
    references public.telegram_media_groups(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, chosen_occurrence_id)
    references public.requirement_occurrences(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, candidate_occurrence_id)
    references public.requirement_occurrences(workspace_id, project_id, id),
  check ((communication_attachment_id is null) <> (telegram_media_group_id is null)),
  check ((consumed_at is null) = (chosen_occurrence_id is null)),
  check (expires_at > created_at)
);

alter table public.telegram_requirement_choice_sessions enable row level security;
revoke all on public.telegram_requirement_choice_sessions
  from public, anon, authenticated, goproceed_app;
grant select, insert, update on public.telegram_requirement_choice_sessions
  to goproceed_service;
