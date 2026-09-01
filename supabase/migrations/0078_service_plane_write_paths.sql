-- The two writes the service plane still could not make.
--
-- 0062 gave the service plane a subject (app.service_workspace) and confined
-- every telegram and communication table to it. Two tables were left out
-- because they are not telegram's: public.transaction_outbox and
-- public.audit_events. Both admit exactly two shapes today — a member with an
-- active membership matching app.current_actor(), and an external session — and
-- a Telegram worker is neither. It has a provider identity and no account, so
-- it can never satisfy the membership predicate and should not pretend to.
--
-- The house has already answered this shape twice, at 0064 and across 0062's
-- ingress: a SECURITY DEFINER function that fixes what the caller may not
-- choose. That is what these two are. Neither adds a policy and neither adds a
-- table grant, so the write surface stays exactly as narrow as it is today and
-- widens only along these two named functions.
--
-- Both carry the same guard: `p_workspace_id is distinct from
-- app.service_workspace()` raises. Without it a definer owned by postgres
-- (rolbypassrls) would be a hole straight through the confinement 0062 exists
-- to create — a transaction declared for one workspace could write into any
-- other, which is strictly more than the blanket policies it replaced allowed.

-- ---------------------------------------------------------------------------
-- The service plane's delivery outbox row.
--
-- What this enforces at THIS call site is three things: a fixed topic, a
-- payload the caller cannot choose, and equality with the declared workspace.
-- It does NOT corroborate the aggregate against an independent source fact —
-- delivery.ts inserts the communication_messages row ten lines earlier in the
-- same uncommitted transaction from the same caller-supplied input, so the
-- lookup below confirms the parameters match the row the caller just wrote and
-- nothing more. Said plainly here so a later reader does not mistake it for the
-- corroboration 0064 performs against a genuinely prior fact.
-- ---------------------------------------------------------------------------
create or replace function app.enqueue_communication_delivery_outbox(
  p_workspace_id uuid, p_project_id uuid, p_message_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'communication delivery outbox requires the service principal';
  end if;
  if p_workspace_id is null or p_project_id is null or p_message_id is null then
    raise exception 'communication delivery outbox identity is required';
  end if;
  if p_workspace_id is distinct from app.service_workspace() then
    raise exception 'communication delivery outbox workspace is not the declared workspace';
  end if;
  perform 1 from public.communication_messages m
   where m.workspace_id = p_workspace_id and m.project_id = p_project_id
     and m.id = p_message_id and m.direction = 'outbound'
     and m.delivery_state = 'queued';
  if not found then
    raise exception 'communication delivery aggregate does not match tenant';
  end if;
  -- No `on conflict`: no unique index covers this topic (the telegram-processor
  -- identity index is partial on two other topics), so duplicate suppression
  -- for 'communication.telegram.send' is the caller's job, as it is today.
  insert into public.transaction_outbox
    (organization_id, topic, aggregate_type, aggregate_id, payload_version, payload)
  values (p_workspace_id, 'communication.telegram.send', 'communication_message',
          p_message_id::text, 1,
          jsonb_build_object('messageId', p_message_id, 'projectId', p_project_id));
end $$;

revoke all on function app.enqueue_communication_delivery_outbox(uuid, uuid, uuid)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.enqueue_communication_delivery_outbox(uuid, uuid, uuid)
  to goproceed_service;

-- ---------------------------------------------------------------------------
-- The service plane's audit row.
--
-- A function rather than an `audit_insert_service` policy, deliberately. A
-- policy would let ANY service statement write ANY audit row for the declared
-- workspace; this lets the service plane write an attestation whose actor shape
-- it cannot choose. `actor_user_id` is forced NULL and `actor_type` is refused
-- unless it is 'system' or 'worker', so no service transaction can forge a row
-- that reads as a person's act — which is the whole value of an audit log.
--
-- The read side is untouched and stays shut: 0006 revoked SELECT on
-- audit_events from goproceed_app outright and nothing here grants it back, so
-- the service plane writes an attestation it can never read.
-- ---------------------------------------------------------------------------
create or replace function app.record_service_audit(
  p_workspace_id uuid, p_actor_type text, p_action text, p_object_type text,
  p_object_id text, p_request_id text, p_details jsonb,
  p_object_version bigint, p_reason_code text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'service audit requires the service principal';
  end if;
  if p_workspace_id is distinct from app.service_workspace() then
    raise exception 'service audit workspace is not the declared workspace';
  end if;
  -- Not a repetition of the table's CHECK. That constraint admits 'user' and
  -- 'external' as well; this refuses them, because a row written with no
  -- account behind it must never be readable as a person's act.
  if p_actor_type is null or p_actor_type not in ('system', 'worker') then
    raise exception 'service audit actor_type must be system or worker';
  end if;
  if p_action is null or p_object_type is null or p_object_id is null or p_details is null then
    raise exception 'service audit row is incomplete';
  end if;
  insert into public.audit_events
    (organization_id, actor_user_id, actor_type, action, object_type, object_id,
     request_id, details, object_version, reason_code)
  values (p_workspace_id, null, p_actor_type, p_action, p_object_type, p_object_id,
          p_request_id, p_details, p_object_version, p_reason_code);
end $$;

revoke all on function app.record_service_audit(uuid, text, text, text, text, text, jsonb, bigint, text)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.record_service_audit(uuid, text, text, text, text, text, jsonb, bigint, text)
  to goproceed_service;
