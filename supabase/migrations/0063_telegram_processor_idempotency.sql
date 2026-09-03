-- Task 6 follow-up: converge retries after an inbox lease expires and retain
-- provider attachment metadata without claiming evidence processing has begun.

alter table public.communication_message_events
  add column provider_update_id bigint;

create unique index communication_message_events_provider_edit_identity_uniq
  on public.communication_message_events (workspace_id, project_id, message_id, provider_update_id)
  where event_kind = 'edited' and provider_update_id is not null;

alter table public.communication_attachments
  drop constraint communication_attachments_state_check,
  add constraint communication_attachments_state_check
    check (state in ('staged', 'unbound', 'awaiting_requirement_choice', 'processing', 'available', 'not_evidence', 'failed'));
