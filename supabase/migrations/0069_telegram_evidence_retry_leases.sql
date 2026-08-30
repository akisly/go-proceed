-- Provider bytes can be temporarily unavailable.  Keep their opaque handles
-- only while this bounded retry lease is live; terminal states still clear it.
alter table public.communication_attachments
  add column provider_retry_attempts integer not null default 0
    check (provider_retry_attempts >= 0 and provider_retry_attempts <= 3),
  add column provider_next_retry_at timestamptz,
  add column provider_retry_lease_token uuid,
  add column provider_retry_lease_expires_at timestamptz,
  add constraint communication_attachments_provider_retry_lease_check
    check ((provider_retry_lease_token is null) = (provider_retry_lease_expires_at is null));

create index communication_attachments_provider_retry_due_idx
  on public.communication_attachments (provider_next_retry_at)
  where state='processing' and provider_next_retry_at is not null;

-- A processing group either holds one bounded lease or is open/awaiting a
-- choice; a stale lease is reclaimable by the worker.
alter table public.telegram_media_groups
  add constraint telegram_media_groups_processing_state_lease_check
    check (state <> 'processing' or processing_lease_token is not null);
