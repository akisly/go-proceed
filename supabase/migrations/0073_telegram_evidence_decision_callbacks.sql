-- Explicit Telegram decision capabilities. Callback data carries only a random
-- opaque token; its scope, actor, group, expiry, prompt, and replay state stay
-- server-side.
create type public.telegram_evidence_decision_action as enum ('accepted', 'returned');

create table public.telegram_evidence_decision_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  telegram_chat_binding_id uuid not null,
  requirement_occurrence_id uuid not null,
  actor_user_id uuid not null,
  actor_member_id uuid not null,
  action public.telegram_evidence_decision_action not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  return_prompt_message_id uuid,
  decision_id uuid,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((action = 'accepted' and return_prompt_message_id is null) or action = 'returned'),
  unique (workspace_id, id),
  foreign key (workspace_id, project_id) references public.project_field_channels(workspace_id, project_id),
  foreign key (workspace_id, project_id, telegram_chat_binding_id) references public.telegram_chat_bindings(workspace_id, project_id, id),
  foreign key (workspace_id, project_id, requirement_occurrence_id) references public.requirement_occurrences(workspace_id, project_id, id),
  foreign key (workspace_id, actor_member_id) references public.memberships(organization_id, id),
  foreign key (return_prompt_message_id) references public.communication_messages(id),
  foreign key (workspace_id, decision_id) references public.requirement_evidence_decisions(workspace_id, id)
);
create index telegram_evidence_decision_tokens_callback_idx
  on public.telegram_evidence_decision_tokens (token_hash) where consumed_at is null;
create index telegram_evidence_decision_tokens_prompt_idx
  on public.telegram_evidence_decision_tokens (return_prompt_message_id) where return_prompt_message_id is not null and consumed_at is null;

alter table public.telegram_evidence_decision_tokens enable row level security;
revoke all on public.telegram_evidence_decision_tokens from public, anon, authenticated, goproceed_app;
grant select, insert, update on public.telegram_evidence_decision_tokens to goproceed_service;
create policy telegram_evidence_decision_tokens_service on public.telegram_evidence_decision_tokens
  for all to goproceed_service
  using (exists (select 1 from public.telegram_chat_bindings b
    where b.workspace_id=telegram_evidence_decision_tokens.workspace_id
      and b.project_id=telegram_evidence_decision_tokens.project_id
      and b.id=telegram_evidence_decision_tokens.telegram_chat_binding_id)
    and exists (select 1 from public.requirement_occurrences o
      where o.workspace_id=telegram_evidence_decision_tokens.workspace_id
        and o.project_id=telegram_evidence_decision_tokens.project_id
        and o.id=telegram_evidence_decision_tokens.requirement_occurrence_id))
  with check (exists (select 1 from public.telegram_chat_bindings b
    where b.workspace_id=telegram_evidence_decision_tokens.workspace_id
      and b.project_id=telegram_evidence_decision_tokens.project_id
      and b.id=telegram_evidence_decision_tokens.telegram_chat_binding_id)
    and exists (select 1 from public.requirement_occurrences o
      where o.workspace_id=telegram_evidence_decision_tokens.workspace_id
        and o.project_id=telegram_evidence_decision_tokens.project_id
        and o.id=telegram_evidence_decision_tokens.requirement_occurrence_id));
