-- The retry that claimed nothing.
--
-- WHAT THIS ADDS. Two SECURITY DEFINER functions for the bounded provider
-- download retry (0069): app.claim_telegram_evidence_retries, which leases
-- the due attachments across tenants the way app.claim_telegram_media_groups
-- (0071) leases due albums, and app.revalidate_telegram_evidence_retry, which
-- rechecks one leased attachment's immutable source identity and live
-- authorization boundary immediately before its download. Nothing else: no
-- policy, no table grant, no column. Both bodies are the SQL processor.ts ran
-- inline until this migration, moved verbatim behind the service principal.
--
-- WHY. processDueTelegramEvidenceRetries opened its transaction with no
-- workspace declared — the retry queue spans tenants, like the album queue —
-- and scanned public.communication_attachments inline. Every telegram
-- service policy is `workspace_id = app.service_workspace()` (0062, 0080), and
-- with no workspace declared that is `workspace_id = NULL`: the scan saw no
-- row. TODOS.md's measurement («the step-by-step join count was zero already
-- at communication_attachments with state='processing'») was exact. Had a
-- workspace been declared it would still have selected nothing, because the
-- scan INNER JOINs public.project_field_channels and
-- public.requirement_occurrences, and LEFT JOINs public.memberships and
-- public.project_access_grants — every one of them member-plane only
-- (policies keyed on app.current_actor(), which a service transaction leaves
-- empty; goproceed_service inherits goproceed_app, so those policies bind it).
-- revalidateTelegramEvidenceRetryContext, run with the workspace declared,
-- joined the same tables and therefore answered false for every valid retry.
-- Measured 2026-09-04 on the local stack at 0082, read-only, as
-- goproceed_service with the workspace declared: project_field_channels,
-- requirement_occurrences, memberships and project_access_grants each count 0
-- against tables that hold rows.
--
-- What that cost: no scheduled retry was ever attempted. An attachment whose
-- first download failed retryably (0069's `provider_download_retryable`)
-- stayed `processing` with its provider handle retained, past every
-- provider_next_retry_at, until an album re-claim or a manual intervention —
-- the design's «Temporary file download failure: retry within a bounded
-- window» (2026-08-28 §11) never happened, and INV-094's promise that staged
-- provider handles are cleared after terminal processing was kept only
-- because nothing ever reached terminal.
--
-- The house answer is the one 0071 gave the album queue: a definer that
-- crosses tenants for the claim, guarded by the service principal, and a
-- definer bounded to the declared workspace for the per-row check (0078's
-- guard, `p_workspace_id is distinct from app.service_workspace()` raises).
-- Lock order is unchanged: group first, then the attachment (0072).
--
-- WHAT THIS DOES NOT CHANGE. The retry policy (three attempts, 30-second
-- backoff, 0071's settle), the lease length (60 seconds, passed by the
-- caller as before), the candidate predicate, the context predicate, the
-- returned columns. No table gains a service policy.
--
-- Pinned by packages/testing/src/telegram-rls.test.ts «§ the retry claim and
-- revalidation definers (0083)» and, end to end, by
-- apps/app/tests/telegram-evidence.int.test.ts «waits for retryable album
-- parts, then completes once on retry success or exhaustion» and «does not
-- download due retries after identity relink or delivered-card
-- invalidation». Recorded as DA-174 and DA-175 in
-- technical/data-access-surface.csv; INV-097's enforcement column names both.
--
-- ROLLBACK (dev only): drop function app.claim_telegram_evidence_retries(integer, integer),
-- app.revalidate_telegram_evidence_retry(uuid, uuid, uuid, uuid, uuid, bigint, bigint, bigint, uuid, timestamptz, bigint, timestamptz, uuid).

create function app.claim_telegram_evidence_retries(p_limit integer, p_lease_seconds integer)
returns table (
  id uuid, workspace_id uuid, project_id uuid, provider_file_id text, provider_file_unique_id text,
  filename_snapshot text, media_type_snapshot text, byte_size bigint, requirement_occurrence_id uuid,
  provider_message_id text, chat_id text, bot_id text, actor_user_id text, work_assignment_id text,
  telegram_chat_binding_id uuid, telegram_media_group_id uuid,
  group_lease_token text, group_lease_expires_at text, group_generation text, group_claimed_last_part_at text,
  context_valid boolean, retry_lease_token text, retry_lease_expires_at text
)
language plpgsql security definer set search_path = '' as $$
declare
  v_row record;
  v_lease record;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram evidence retry claim requires the service principal';
  end if;
  if p_limit < 1 or p_limit > 100 or p_lease_seconds < 1 or p_lease_seconds > 300 then
    raise exception 'invalid telegram evidence retry claim bounds';
  end if;
  for v_row in
    select a.id, a.workspace_id, a.project_id, a.provider_file_id, a.provider_file_unique_id,
           a.filename_snapshot, a.media_type_snapshot, a.byte_size, a.requirement_occurrence_id,
           m.provider_message_id::text as provider_message_id, b.chat_id::text as chat_id, b.bot_id::text as bot_id,
           u.user_id::text as actor_user_id, o.work_assignment_id::text as work_assignment_id,
           m.telegram_chat_binding_id, a.telegram_media_group_id,
           g.processing_lease_token::text as group_lease_token,
           g.processing_lease_expires_at::text as group_lease_expires_at,
           g.claimed_generation::text as group_generation,
           g.claimed_last_part_at::text as group_claimed_last_part_at,
           (m.author_member_id is not null and l.member_id is not null and u.user_id is not null
             and b.disconnected_at is null and c.state = 'active'
             and (g.id is null or g.uploader_member_id = m.author_member_id)
             and exists (select 1 from public.project_access_grants pg
               where pg.workspace_id = a.workspace_id and pg.project_id = a.project_id
                 and pg.member_id = m.author_member_id and pg.capability = 'evidence.record'
                 and pg.revoked_at is null and pg.valid_from <= now()
                 and (pg.valid_until is null or pg.valid_until > now()))
             and exists (select 1 from public.communication_messages card
               where card.workspace_id = a.workspace_id and card.project_id = a.project_id
                 and card.telegram_chat_binding_id = m.telegram_chat_binding_id
                 and card.provider_message_id = m.provider_reply_to_message_id
                 and card.kind = 'assignment_card' and card.delivery_state = 'provider_accepted'
                 and card.work_assignment_id = o.work_assignment_id
                 and card.telegram_occurrence_snapshot @> array[o.id]
                 and (g.id is null or card.provider_message_id = g.reply_provider_message_id))) as context_valid
      from public.communication_attachments a
      join public.communication_messages m on m.workspace_id = a.workspace_id and m.id = a.message_id
      join public.telegram_chat_bindings b on b.workspace_id = a.workspace_id and b.project_id = a.project_id and b.id = m.telegram_chat_binding_id
      join public.project_field_channels c on c.workspace_id = b.workspace_id and c.project_id = b.project_id and c.channel = 'telegram'
      join public.requirement_occurrences o on o.workspace_id = a.workspace_id and o.id = a.requirement_occurrence_id
      left join public.telegram_media_groups g on g.workspace_id = a.workspace_id and g.id = a.telegram_media_group_id
      left join public.telegram_member_links l on l.workspace_id = a.workspace_id
        and l.telegram_user_id = m.provider_user_id and l.member_id = m.author_member_id and l.revoked_at is null
      left join public.memberships u on u.organization_id = a.workspace_id and u.id = m.author_member_id and u.status = 'active'
     where a.state = 'processing'
       and ((a.provider_next_retry_at <= now()
           and (a.provider_retry_lease_expires_at is null or a.provider_retry_lease_expires_at <= now()))
         or (a.provider_next_retry_at is null
           and (a.provider_retry_lease_expires_at is null or a.provider_retry_lease_expires_at <= now())))
       and a.requirement_occurrence_id is not null and a.provider_file_id is not null
       and (a.telegram_media_group_id is null or (
             g.state = 'processing' and g.processing_lease_token is not null
         and g.processing_lease_expires_at > now()
         and g.claimed_generation = g.processing_generation
         and g.claimed_last_part_at = g.last_part_at))
     order by a.provider_next_retry_at, a.id limit p_limit
  loop
    -- Album claims are always acquired before attachment retry leases: the
    -- order settlement uses (0072), so a retry claimant never inverts the
    -- group/attachment lock graph.
    if v_row.telegram_media_group_id is not null then
      perform 1 from public.telegram_media_groups g
        where g.workspace_id = v_row.workspace_id and g.project_id = v_row.project_id and g.id = v_row.telegram_media_group_id
          and g.state = 'processing' and g.processing_lease_token = v_row.group_lease_token::uuid
          and g.processing_lease_expires_at = v_row.group_lease_expires_at::timestamptz and g.processing_lease_expires_at > now()
          and g.processing_generation = v_row.group_generation::bigint and g.claimed_generation = v_row.group_generation::bigint
          and g.last_part_at = v_row.group_claimed_last_part_at::timestamptz and g.claimed_last_part_at = v_row.group_claimed_last_part_at::timestamptz
        for update;
      if not found then continue; end if;
    end if;
    perform 1 from public.communication_attachments a
      where a.id = v_row.id and a.state = 'processing' and a.provider_file_id is not null
        and a.requirement_occurrence_id is not null
        and ((a.provider_next_retry_at is not null and a.provider_next_retry_at <= now())
          or (a.provider_next_retry_at is null and (a.provider_retry_lease_expires_at is null or a.provider_retry_lease_expires_at <= now())))
      for update;
    if not found then continue; end if;
    update public.communication_attachments a
       set provider_retry_lease_token = gen_random_uuid(),
           provider_retry_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
           provider_next_retry_at = null
     where a.id = v_row.id and a.state = 'processing' and a.provider_file_id is not null
       and ((a.provider_next_retry_at is not null and a.provider_next_retry_at <= now())
         or (a.provider_next_retry_at is null and (a.provider_retry_lease_expires_at is null or a.provider_retry_lease_expires_at <= now())))
     returning a.provider_retry_lease_token::text, a.provider_retry_lease_expires_at::text into v_lease;
    if not found then continue; end if;
    id := v_row.id; workspace_id := v_row.workspace_id; project_id := v_row.project_id;
    provider_file_id := v_row.provider_file_id; provider_file_unique_id := v_row.provider_file_unique_id;
    filename_snapshot := v_row.filename_snapshot; media_type_snapshot := v_row.media_type_snapshot;
    byte_size := v_row.byte_size; requirement_occurrence_id := v_row.requirement_occurrence_id;
    provider_message_id := v_row.provider_message_id; chat_id := v_row.chat_id; bot_id := v_row.bot_id;
    actor_user_id := v_row.actor_user_id; work_assignment_id := v_row.work_assignment_id;
    telegram_chat_binding_id := v_row.telegram_chat_binding_id; telegram_media_group_id := v_row.telegram_media_group_id;
    group_lease_token := v_row.group_lease_token; group_lease_expires_at := v_row.group_lease_expires_at;
    group_generation := v_row.group_generation; group_claimed_last_part_at := v_row.group_claimed_last_part_at;
    context_valid := v_row.context_valid;
    retry_lease_token := v_lease.provider_retry_lease_token; retry_lease_expires_at := v_lease.provider_retry_lease_expires_at;
    return next;
  end loop;
end $$;

-- Recheck immutable source identity and the live authorization boundary
-- immediately before download. Bounded to the declared workspace.
create function app.revalidate_telegram_evidence_retry(
  p_workspace_id uuid, p_attachment_id uuid, p_retry_lease_token uuid, p_work_assignment_id uuid,
  p_binding_id uuid, p_provider_message_id bigint, p_chat_id bigint, p_bot_id bigint,
  p_group_lease_token uuid, p_group_lease_expires_at timestamptz, p_generation bigint,
  p_claimed_last_part_at timestamptz, p_actor_user_id uuid
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_valid boolean;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'telegram evidence retry revalidation requires the service principal';
  end if;
  if p_workspace_id is null or p_attachment_id is null then
    raise exception 'telegram evidence retry revalidation identity is required';
  end if;
  if p_workspace_id is distinct from app.service_workspace() then
    raise exception 'telegram evidence retry revalidation workspace is not the declared workspace';
  end if;
  select exists (
    select 1
      from public.communication_attachments a
      join public.communication_messages m on m.workspace_id = a.workspace_id and m.project_id = a.project_id and m.id = a.message_id
      join public.telegram_chat_bindings b on b.workspace_id = a.workspace_id and b.project_id = a.project_id
        and b.id = m.telegram_chat_binding_id
      join public.project_field_channels c on c.workspace_id = b.workspace_id and c.project_id = b.project_id
        and c.channel = 'telegram' and c.state = 'active'
      join public.telegram_member_links l on l.workspace_id = a.workspace_id
        and l.telegram_user_id = m.provider_user_id and l.member_id = m.author_member_id and l.revoked_at is null
      join public.memberships u on u.organization_id = a.workspace_id and u.id = m.author_member_id and u.status = 'active'
      join public.requirement_occurrences o on o.workspace_id = a.workspace_id and o.project_id = a.project_id
        and o.id = a.requirement_occurrence_id and o.work_assignment_id = p_work_assignment_id
      join public.communication_messages card on card.workspace_id = m.workspace_id and card.project_id = m.project_id
        and card.telegram_chat_binding_id = m.telegram_chat_binding_id
        and card.provider_message_id = m.provider_reply_to_message_id
        and card.kind = 'assignment_card' and card.delivery_state = 'provider_accepted'
        and card.work_assignment_id = o.work_assignment_id
        and card.telegram_occurrence_snapshot @> array[o.id]
      left join public.telegram_media_groups g on g.workspace_id = a.workspace_id and g.project_id = a.project_id
        and g.id = a.telegram_media_group_id
     where a.workspace_id = p_workspace_id and a.id = p_attachment_id and a.state = 'processing'
       and a.provider_retry_lease_token = p_retry_lease_token and a.provider_retry_lease_expires_at > now()
       and u.user_id = p_actor_user_id
       and m.telegram_chat_binding_id = p_binding_id and m.provider_message_id = p_provider_message_id
       and b.chat_id = p_chat_id and b.bot_id = p_bot_id and b.disconnected_at is null
       and (a.telegram_media_group_id is null or (
         g.telegram_chat_binding_id = b.id and g.uploader_member_id = m.author_member_id
         and g.reply_provider_message_id = m.provider_reply_to_message_id
         and g.state = 'processing' and g.processing_lease_token = p_group_lease_token
         and g.processing_lease_expires_at = p_group_lease_expires_at and g.processing_lease_expires_at > now()
         and g.processing_generation = p_generation and g.claimed_generation = p_generation
         and g.last_part_at = p_claimed_last_part_at and g.claimed_last_part_at = p_claimed_last_part_at
       ))
  ) into v_valid;
  return v_valid;
end $$;

revoke all on function app.claim_telegram_evidence_retries(integer, integer)
  from public, anon, authenticated, goproceed_app;
revoke all on function app.revalidate_telegram_evidence_retry(uuid, uuid, uuid, uuid, uuid, bigint, bigint, bigint, uuid, timestamptz, bigint, timestamptz, uuid)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.claim_telegram_evidence_retries(integer, integer) to goproceed_service;
grant execute on function app.revalidate_telegram_evidence_retry(uuid, uuid, uuid, uuid, uuid, bigint, bigint, bigint, uuid, timestamptz, bigint, timestamptz, uuid) to goproceed_service;
