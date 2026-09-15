-- The key that named itself (DEV-011, BL-085).
--
-- WHAT THIS CHANGES. TELEGRAM_LINK_PEPPER was one HMAC key with no id, used for
-- two things: the verifier of every Telegram link token and subject_hmac in the
-- erasure registry. Replacing it invalidated live links and broke the
-- registry's match, so a repeat erasure request allocated a second surrogate.
-- It is replaced by two key registries, each `<keyId>:<base64>` with an active
-- id: TELEGRAM_LINK_HMAC_KEYS on the deployed app, TELEGRAM_ERASURE_HMAC_KEYS on
-- the operator's machine only. Every stored HMAC now carries its key id.
--   1. verifier_key_id on both intent tables; the consume definers take paired
--      candidate key ids and verifiers, one per configured key, and return the
--      intent id they consumed;
--   2. subject_key_id on app.telegram_erasures, and app.telegram_erasure_keys,
--      one check value per key id as first supplied, so the same id with a different secret is
--      refused instead of silently allocating a second surrogate;
--   3. app.erase_telegram_identity takes the key set: it refuses a set that
--      does not cover every key id this workspace's registry holds, refuses more
--      than one match, and moves a match under an older key to the active key.
--
-- EXISTING ROWS. They were computed under the pepper, and get the key id
-- 'legacy'. An operator whose database holds such rows supplies
-- `legacy:<base64 of the pepper's UTF-8 bytes>`, which yields the same HMACs
-- (Node's createHmac uses a string key's UTF-8 bytes). Intents live 15 minutes.
--
-- WHAT THIS DOES NOT FIX. A leaked erasure key still re-identifies the rows
-- still under it, and every backup taken before a row was re-keyed; a row
-- leaves an old key only when that subject asks again (the wrapping scheme is a
-- backlog entry). The secret supplied the first time a key id is seen is trusted,
-- including 'legacy', which has no check value until its first erasure run.
--
-- The old signatures are dropped, so application code older than this
-- migration fails against it: no hosted Telegram path is live (BL-024).
--
-- ROLLBACK (dev only): restore both consume definers from 0062 and both
-- erasure definers from 0081; drop app.assert_keyed_hmacs,
-- app.telegram_erasure_keys and the three key-id columns with their checks.

-- ===========================================================================
-- 0. The one shape both planes validate
-- ===========================================================================

create or replace function app.assert_keyed_hmacs(p_key_ids text[], p_hmacs text[], p_message text)
returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_key_ids is null or p_hmacs is null
     or coalesce(cardinality(p_key_ids) between 1 and 8, false) = false
     or cardinality(p_key_ids) <> cardinality(p_hmacs)
     or array_ndims(p_key_ids) <> 1 or array_ndims(p_hmacs) <> 1
     or exists (select 1 from unnest(p_key_ids) as k(v) where k.v is null or k.v !~ '\S')
     or exists (select 1 from unnest(p_hmacs) as h(v) where h.v is null or h.v !~ '^[0-9a-f]{64}$')
     or (select count(distinct k.v) from unnest(p_key_ids) as k(v)) <> cardinality(p_key_ids)
  then
    raise exception '%', p_message using errcode = '22023';
  end if;
end $$;
revoke all on function app.assert_keyed_hmacs(text[], text[], text) from public, anon, authenticated, goproceed_app, goproceed_service;

-- ===========================================================================
-- 1. Link intents
-- ===========================================================================

alter table public.telegram_binding_intents add column if not exists verifier_key_id text;
update public.telegram_binding_intents set verifier_key_id = 'legacy' where verifier_key_id is null;
alter table public.telegram_binding_intents
  alter column verifier_key_id set not null,
  add constraint telegram_binding_intents_verifier_key_id_not_blank check (verifier_key_id ~ '\S');

alter table public.telegram_member_link_intents add column if not exists verifier_key_id text;
update public.telegram_member_link_intents set verifier_key_id = 'legacy' where verifier_key_id is null;
alter table public.telegram_member_link_intents
  alter column verifier_key_id set not null,
  add constraint telegram_member_link_intents_verifier_key_id_not_blank check (verifier_key_id ~ '\S');

drop function if exists app.consume_telegram_binding_intent(text, bigint, bigint, text, text, bigint);

create function app.consume_telegram_binding_intent(
  p_verifier_key_ids text[], p_verifier_hashes text[], p_bot_id bigint, p_chat_id bigint, p_chat_type text,
  p_title_snapshot text, p_telegram_user_id bigint
) returns table (
  workspace_id uuid, project_id uuid, telegram_chat_binding_id uuid, outcome text, telegram_binding_intent_id uuid
)
language plpgsql security definer set search_path = '' as $$
declare i public.telegram_binding_intents;
declare b public.telegram_chat_bindings;
begin
  perform app.assert_keyed_hmacs(p_verifier_key_ids, p_verifier_hashes,
    'a link token needs one verifier per key id: 1 to 8 distinct non-blank key ids, 64 lowercase hex characters each');
  -- One candidate per configured key; a row matches only under the key id that
  -- computed it.
  select t.* into i from public.telegram_binding_intents t
   where (t.verifier_key_id, t.verifier_hash) in
         (select u.k, u.h from unnest(p_verifier_key_ids, p_verifier_hashes) as u(k, h))
     and t.consumed_at is null and t.expires_at > now()
   limit 1
   for update of t;
  if not found then return; end if;
  if p_chat_type not in ('group', 'supergroup') then
    return query select i.workspace_id, i.project_id, null::uuid, 'wrong_group_type', i.id;
    return;
  end if;
  perform 1 from public.project_field_channels c
   where c.workspace_id = i.workspace_id and c.project_id = i.project_id
     and c.channel = 'telegram' and c.state = 'unbound' and c.locked_at is null
   for update;
  if not found then
    return query select i.workspace_id, i.project_id, null::uuid, 'channel_unavailable', i.id;
    return;
  end if;
  insert into public.telegram_chat_bindings
    (workspace_id, project_id, bot_id, chat_id, chat_type, title_snapshot, connected_by_member_id)
  values (i.workspace_id, i.project_id, p_bot_id, p_chat_id, p_chat_type, p_title_snapshot, i.requested_by_member_id)
  returning * into b;
  update public.telegram_binding_intents
     set consumed_at = now(), consumed_by_telegram_user_id = p_telegram_user_id
   where id = i.id;
  -- Every column qualified: workspace_id and project_id are OUT parameters
  -- here (0062's note on 42702).
  update public.project_field_channels c
     set state = 'connected', last_healthy_at = now(), updated_at = now()
   where c.workspace_id = i.workspace_id and c.project_id = i.project_id;
  return query select b.workspace_id, b.project_id, b.id, 'connected', i.id;
end $$;
revoke all on function app.consume_telegram_binding_intent(text[], text[], bigint, bigint, text, text, bigint) from public, anon, authenticated, goproceed_app;
grant execute on function app.consume_telegram_binding_intent(text[], text[], bigint, bigint, text, text, bigint) to goproceed_service;

drop function if exists app.consume_telegram_member_link_intent(text, bigint, text, text);

create function app.consume_telegram_member_link_intent(
  p_verifier_key_ids text[], p_verifier_hashes text[], p_telegram_user_id bigint,
  p_display_name_snapshot text, p_username_snapshot text
) returns table (
  workspace_id uuid, member_id uuid, telegram_member_link_id uuid, outcome text, telegram_member_link_intent_id uuid
)
language plpgsql security definer set search_path = '' as $$
declare i public.telegram_member_link_intents;
declare l public.telegram_member_links;
begin
  perform app.assert_keyed_hmacs(p_verifier_key_ids, p_verifier_hashes,
    'a link token needs one verifier per key id: 1 to 8 distinct non-blank key ids, 64 lowercase hex characters each');
  select t.* into i from public.telegram_member_link_intents t
   where (t.verifier_key_id, t.verifier_hash) in
         (select u.k, u.h from unnest(p_verifier_key_ids, p_verifier_hashes) as u(k, h))
     and t.consumed_at is null and t.expires_at > now()
   limit 1
   for update of t;
  if not found then return; end if;
  perform 1 from public.memberships m
   where m.organization_id = i.workspace_id and m.id = i.member_id and m.status = 'active'
   for update;
  if not found then
    return query select i.workspace_id, i.member_id, null::uuid, 'membership_inactive', i.id;
    return;
  end if;
  insert into public.telegram_member_links
    (workspace_id, member_id, telegram_user_id, display_name_snapshot, username_snapshot, linked_by_member_id)
  values (i.workspace_id, i.member_id, p_telegram_user_id, p_display_name_snapshot, p_username_snapshot, i.issued_by_member_id)
  on conflict do nothing
  returning * into l;
  if not found then
    return query select i.workspace_id, i.member_id, null::uuid, 'telegram_identity_already_linked', i.id;
    return;
  end if;
  update public.telegram_member_link_intents
     set consumed_at = now(), consumed_by_telegram_user_id = p_telegram_user_id
   where id = i.id;
  return query select l.workspace_id, l.member_id, l.id, 'linked', i.id;
end $$;
revoke all on function app.consume_telegram_member_link_intent(text[], text[], bigint, text, text) from public, anon, authenticated, goproceed_app;
grant execute on function app.consume_telegram_member_link_intent(text[], text[], bigint, text, text) to goproceed_service;

-- ===========================================================================
-- 2. The registry's key ids and the key check values
-- ===========================================================================

alter table app.telegram_erasures add column if not exists subject_key_id text;
update app.telegram_erasures set subject_key_id = 'legacy' where subject_hmac is not null and subject_key_id is null;
alter table app.telegram_erasures
  add constraint telegram_erasures_subject_key_id_not_blank check (subject_key_id is null or subject_key_id ~ '\S'),
  add constraint telegram_erasures_subject_key_id_with_hmac check ((subject_hmac is null) = (subject_key_id is null));
comment on table app.telegram_erasures is
  'One row per erased Telegram identity per workspace. subject_hmac is an HMAC the operator computed under the erasure key subject_key_id names; the original identifier is stored nowhere. Reachable through app.erase_telegram_identity only.';

create table if not exists app.telegram_erasure_keys (
  key_id        text primary key check (key_id ~ '\S'),
  check_value   text not null check (check_value ~ '^[0-9a-f]{64}$'),
  first_used_at timestamptz not null default now()
);
comment on table app.telegram_erasure_keys is
  'One row per erasure key id ever supplied: an HMAC of a fixed label under that key, recorded the first time the id is supplied. A later erasure supplying the same id with a different secret is refused. Holds no key and no subject. Reachable through app.erase_telegram_identity only.';
alter table app.telegram_erasure_keys enable row level security;
revoke all on table app.telegram_erasure_keys from public, anon, authenticated, goproceed_app, goproceed_service;

-- ===========================================================================
-- 3. The erasure definers
-- ===========================================================================

drop function if exists app.erase_telegram_identity_internal(uuid, bigint, text, text, text);

-- Retention calls this with five arguments (0081 §5) and resolves through the
-- sixth parameter's default; its body is 0081's, with the key id carried
-- beside the HMAC.
create function app.erase_telegram_identity_internal(
  p_workspace uuid, p_telegram_user_id bigint, p_subject_hmac text, p_origin text, p_scope text,
  p_subject_key_id text default null
) returns table (
  surrogate_user_id bigint, messages bigint, events bigint, links bigint,
  attachments bigint, pending_updates_for_subject bigint, already_erased boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  v_surrogate bigint;
  v_existed boolean := false;
  v_messages bigint := 0; v_events bigint := 0; v_links bigint := 0; v_attachments bigint := 0;
  v_pending bigint := 0;
  v_try integer;
begin
  if p_telegram_user_id is null or p_telegram_user_id <= 0 then
    raise exception 'erasure needs a real Telegram identifier';
  end if;
  if p_origin not in ('data_subject_request', 'retention') then
    raise exception 'erasure origin must be data_subject_request or retention';
  end if;
  if (p_origin = 'data_subject_request') <> (p_subject_hmac is not null) then
    raise exception 'a data-subject request carries an HMAC and a retention run carries none';
  end if;
  if (p_subject_hmac is null) <> (p_subject_key_id is null) then
    raise exception 'a subject HMAC and its key id travel together';
  end if;
  if p_scope not in ('all', 'communication', 'identity') then
    raise exception 'unknown erasure scope %', p_scope;
  end if;

  if p_subject_hmac is not null then
    select e.surrogate_user_id into v_surrogate
      from app.telegram_erasures e
     where e.workspace_id = p_workspace and e.subject_key_id = p_subject_key_id and e.subject_hmac = p_subject_hmac;
    v_existed := found;
  end if;
  if v_surrogate is null then
    for v_try in 1..8 loop
      v_surrogate := -(1 + floor(random() * 4611686018427387903))::bigint;
      exit when not exists (select 1 from app.telegram_erasures e
                             where e.workspace_id = p_workspace and e.surrogate_user_id = v_surrogate);
      v_surrogate := null;
    end loop;
    if v_surrogate is null then raise exception 'could not allocate a surrogate identifier'; end if;
    insert into app.telegram_erasures (workspace_id, subject_hmac, subject_key_id, surrogate_user_id, origin)
    values (p_workspace, p_subject_hmac, p_subject_key_id, v_surrogate, p_origin);
  end if;

  -- 0081's I2: refuse a repeat erasure after the subject linked again, before
  -- any write of this call.
  if p_scope in ('all', 'identity') then
    if exists (
      select 1 from public.telegram_member_links l
      where l.workspace_id = p_workspace and l.telegram_user_id = p_telegram_user_id
    ) and exists (
      select 1 from public.telegram_member_links l
      where l.workspace_id = p_workspace and l.telegram_user_id = v_surrogate
    ) then
      raise exception 'the subject was linked again after an earlier erasure in this workspace; a repeat erasure of the link needs the owner''s decision (TODOS.md, retention and erasure residue)';
    end if;
  end if;

  perform set_config('app.erasure_subject', p_telegram_user_id::text, true);
  perform set_config('app.erasure_surrogate', v_surrogate::text, true);

  if p_scope in ('all', 'communication') then
    update public.communication_messages
       set provider_user_id = v_surrogate,
           provider_display_name_snapshot = null,
           provider_username_snapshot = null,
           text = case when text is null then null else '[текст стерто на запит]' end
     where workspace_id = p_workspace and provider_user_id = p_telegram_user_id;
    get diagnostics v_messages = row_count;

    update public.communication_message_events e
       set text = '[текст стерто на запит]'
      from public.communication_messages m
     where e.message_id = m.id and m.workspace_id = p_workspace
       and m.provider_user_id = v_surrogate
       and e.event_kind = 'edited' and e.text is distinct from '[текст стерто на запит]';
    get diagnostics v_events = row_count;
  end if;

  if p_scope in ('all', 'identity') then
    update public.telegram_member_links
       set telegram_user_id = v_surrogate, display_name_snapshot = null,
           username_snapshot = null, revoked_at = coalesce(revoked_at, now())
     where workspace_id = p_workspace and telegram_user_id = p_telegram_user_id;
    get diagnostics v_links = row_count;
  end if;

  if p_scope in ('all', 'communication') then
    update public.communication_attachments a
       set filename_snapshot = null
      from public.communication_messages m
     where a.message_id = m.id and a.workspace_id = p_workspace
       and m.provider_user_id = v_surrogate and a.filename_snapshot is not null;
    get diagnostics v_attachments = row_count;
  end if;

  select count(*) into v_pending
    from public.telegram_inbox_updates u
   where u.state in ('pending', 'leased')
     and coalesce(u.payload #>> '{message,from,id}', u.payload #>> '{edited_message,from,id}',
                  u.payload #>> '{callback_query,from,id}', u.payload #>> '{my_chat_member,from,id}')
         = p_telegram_user_id::text;

  -- erased_at is NOT touched here: it is the column's own `default now()`
  -- from the INSERT above, i.e. the first erasure's timestamp, and a repeat
  -- call (idempotent or retention-after-request) must not move it forward.
  update app.telegram_erasures e
     set messages_count = e.messages_count + v_messages, events_count = e.events_count + v_events,
         links_count = e.links_count + v_links, attachments_count = e.attachments_count + v_attachments
   where e.workspace_id = p_workspace and e.surrogate_user_id = v_surrogate;

  perform app.write_erasure_audit(p_workspace, v_surrogate,
    jsonb_build_object('surrogate', v_surrogate, 'messages', v_messages, 'events', v_events,
                       'links', v_links, 'attachments', v_attachments, 'origin', p_origin,
                       'scope', p_scope, 'pending_updates_for_subject', v_pending),
    p_origin);

  perform set_config('app.erasure_subject', '', true);
  perform set_config('app.erasure_surrogate', '', true);

  return query select v_surrogate, v_messages, v_events, v_links, v_attachments, v_pending, v_existed;
end $$;
revoke all on function app.erase_telegram_identity_internal(uuid, bigint, text, text, text, text) from public, anon, authenticated, goproceed_app, goproceed_service;

drop function if exists app.erase_telegram_identity(uuid, bigint, text);

create function app.erase_telegram_identity(
  p_workspace uuid, p_telegram_user_id bigint, p_active_key_id text,
  p_key_ids text[], p_subject_hmacs text[], p_key_check_values text[]
) returns table (
  surrogate_user_id bigint, messages bigint, events bigint, links bigint,
  attachments bigint, pending_updates_for_subject bigint, already_erased boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  c_shape constant text := 'erasure needs one subject HMAC and one key check value per key id: 1 to 8 distinct non-blank key ids, 64 lowercase hex characters each, the active key id among them';
  v_mismatch text;
  v_missing text;
  v_matches integer;
  v_active_hmac text;
begin
  if not pg_has_role(session_user, 'goproceed_service', 'member') then
    raise exception 'erasure requires the service principal' using errcode = '42501';
  end if;
  perform app.assert_keyed_hmacs(p_key_ids, p_subject_hmacs, c_shape);
  perform app.assert_keyed_hmacs(p_key_ids, p_key_check_values, c_shape);
  if p_active_key_id is null or coalesce(p_active_key_id = any(p_key_ids), false) = false then
    raise exception '%', c_shape using errcode = '22023';
  end if;
  if p_workspace is distinct from app.service_workspace() then
    raise exception 'erasure workspace is not the declared workspace';
  end if;

  -- One erasure per workspace at a time: the coverage and match checks below
  -- read the registry, and the re-key writes it.
  perform pg_advisory_xact_lock(hashtextextended('app.erase_telegram_identity:' || p_workspace::text, 0));

  -- The same id with a different secret: recorded on first use, refused after.
  insert into app.telegram_erasure_keys (key_id, check_value)
  select u.k, u.v from unnest(p_key_ids, p_key_check_values) as u(k, v)
  on conflict (key_id) do nothing;
  select string_agg(u.k, ', ' order by u.k) into v_mismatch
    from unnest(p_key_ids, p_key_check_values) as u(k, v)
    join app.telegram_erasure_keys ek on ek.key_id = u.k
   where ek.check_value <> u.v;
  if v_mismatch is not null then
    raise exception 'erasure key % does not match the key first used under that id', v_mismatch;
  end if;

  -- A key set that cannot see every row would miss an earlier erasure of this
  -- person and split them across two surrogates.
  select string_agg(distinct e.subject_key_id, ', ' order by e.subject_key_id) into v_missing
    from app.telegram_erasures e
   where e.workspace_id = p_workspace and e.subject_key_id is not null
     and not (e.subject_key_id = any(p_key_ids));
  if v_missing is not null then
    raise exception 'erasure key set does not cover key ids already in this workspace''s registry: %', v_missing;
  end if;

  select count(*) into v_matches
    from app.telegram_erasures e
   where e.workspace_id = p_workspace
     and (e.subject_key_id, e.subject_hmac) in (select u.k, u.h from unnest(p_key_ids, p_subject_hmacs) as u(k, h));
  if v_matches > 1 then
    raise exception 'more than one registry row matches this subject; a person split across surrogates needs the owner''s decision';
  end if;

  select u.h into v_active_hmac from unnest(p_key_ids, p_subject_hmacs) as u(k, h) where u.k = p_active_key_id;

  -- A match under an older key moves to the active key, in this transaction:
  -- a later refusal (the re-link guard) rolls it back with everything else.
  if v_matches = 1 then
    update app.telegram_erasures e
       set subject_key_id = p_active_key_id, subject_hmac = v_active_hmac
     where e.workspace_id = p_workspace
       and e.subject_key_id <> p_active_key_id
       and (e.subject_key_id, e.subject_hmac) in (select u.k, u.h from unnest(p_key_ids, p_subject_hmacs) as u(k, h));
  end if;

  return query select * from app.erase_telegram_identity_internal(
    p_workspace, p_telegram_user_id, v_active_hmac, 'data_subject_request', 'all', p_active_key_id);
end $$;
revoke all on function app.erase_telegram_identity(uuid, bigint, text, text[], text[], text[]) from public, anon, authenticated, goproceed_app;
grant execute on function app.erase_telegram_identity(uuid, bigint, text, text[], text[], text[]) to goproceed_service;
