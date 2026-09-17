-- The server fact that named no workspace (DEV-017, BL-102).
--
-- WHAT WAS WRONG. 0035 §Server facts wrote the service policy of
-- public.capture_events as
--
--   create policy ce_insert_server on public.capture_events for insert
--     to <service role>
--     with check (event_source = 'server' and exists (
--       select 1 from public.upload_intents u
--        where u.workspace_id = capture_events.workspace_id
--          and u.id = capture_events.upload_intent_id
--          and u.project_id = capture_events.project_id));
--
-- It never asks which workspace the service transaction declared, and its
-- EXISTS runs under row level security on public.upload_intents, whose only
-- policies are the actor-bound ui_select and the session-bound
-- ui_external_select. goproceed_service is a member of goproceed_app (0034) and
-- inherits both, so the policy asked, in effect, «can this transaction's ACTOR
-- see the intent?» That gave two wrong answers:
--
--   * a service transaction with no actor — the service contract, and what
--     every other service policy is proved against — was refused its own
--     workspace's event, because the EXISTS matched nothing;
--   * a transaction carrying an actor entitled to workspace A was admitted the
--     event of A whatever workspace it declared, B included.
--
-- apps/app/src/lib/evidence/finalize-upload-intent.ts declared no workspace at
-- all (organizationId: null on all three service transactions), so no
-- production path exercised the declaration.
--
-- WHAT THIS CHANGES. The policy keeps its name, role and command, gains the
-- workspace term every other service policy carries (0062, 0080, 0086), and
-- asks the binding question through a SECURITY DEFINER function that only the
-- service role may execute:
--
--   event_source = 'server'
--   and workspace_id = app.service_workspace()
--   and app.upload_intent_scope_matches(workspace_id, upload_intent_id, project_id)
--
-- The function answers one boolean about a (workspace, intent, project) triple
-- the caller has already named in full. It is narrower than a service SELECT
-- policy over public.upload_intents, which would open a whole tenant table's
-- read surface to answer it, and it detaches the SERVER's attestation from the
-- MEMBER's live read capability: a capability revoked mid-upload now leaves the
-- failure event writable, which is what 0035 wanted the server's own facts to
-- be. It raises nothing, so a refusal stays 42501 rather than becoming P0001.
--
-- The declaration is not an authorization: the service code sets it itself
-- (0062; packages/database/src/tx.ts). What it buys is the fence against a
-- defect in service code — a finalize that forgot its scope now writes nothing.
--
-- WHAT THIS DOES NOT CHANGE. ce_insert (the device branch), ce_select, every
-- upload_intents policy, every grant, every table, constraint and row, and
-- app.finalize_upload_intent / app.fail_upload_intent / app.block_upload_intent.
-- An actor-bearing service transaction can still insert a DEVICE-sourced row
-- into any workspace its actor is entitled to, through the inherited ce_insert,
-- and still reads through the inherited ce_select: that is BL-101 and BL-019,
-- not this migration.
--
-- ORDER. The application must declare the intent's workspace BEFORE this
-- migration is applied, or every finalize fails with 42501. The code change
-- ships in the same commit and is safe against the old policy: at 0086 nothing
-- these transactions touch reads app.organization_id, and setting it can only
-- widen a permissive service policy. A hosted push must deploy the build first
-- (runbook §10 Q-9).
--
-- Pinned by packages/testing/src/evidence-service-rls.test.ts (its «declaring A
-- … declaring B or nothing» and actor-bearing cases are red at 0086 and green
-- here). INV-001; technical/data-access-surface.csv DA-182 to DA-184.
--
-- ROLLBACK (dev only): restore the 0035 with_check above and
-- `drop function app.upload_intent_scope_matches(uuid, uuid, uuid);`. That
-- reopens BL-102; roll forward instead.

create or replace function app.upload_intent_scope_matches(
  p_workspace uuid, p_intent uuid, p_project uuid
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from public.upload_intents u
     where u.workspace_id = p_workspace
       and u.id = p_intent
       and u.project_id = p_project)
$$;

comment on function app.upload_intent_scope_matches(uuid, uuid, uuid) is
  'Does this upload intent belong to this workspace and project? One boolean about a triple the caller already names, for ce_insert_server (0087, BL-102). Service principal only; raises nothing, so a policy refusal stays 42501.';

revoke all on function app.upload_intent_scope_matches(uuid, uuid, uuid)
  from public, anon, authenticated, goproceed_app;
grant execute on function app.upload_intent_scope_matches(uuid, uuid, uuid)
  to goproceed_service;

alter policy ce_insert_server on public.capture_events
  with check (
    event_source = 'server'
    and workspace_id = app.service_workspace()
    and app.upload_intent_scope_matches(workspace_id, upload_intent_id, project_id));

comment on policy ce_insert_server on public.capture_events is
  'Service plane, server-sourced events only: the workspace the service transaction declared (app.service_workspace()), and the intent must belong to that workspace and project (0087 corrects 0035, whose EXISTS ran under the member''s own read capability and asked no workspace).';

-- Self-check.
do $$
declare
  server_check text;
  device_check text;
  policy_count int;
begin
  select with_check into server_check from pg_policies
   where schemaname = 'public' and tablename = 'capture_events'
     and policyname = 'ce_insert_server' and cmd = 'INSERT'
     and permissive = 'PERMISSIVE' and roles = array['goproceed_service']::name[];
  if server_check is null then
    raise exception '0087: ce_insert_server is missing, or is no longer a permissive INSERT policy for goproceed_service';
  end if;
  if server_check not like '%event_source%'
     or server_check not like '%service_workspace()%'
     or server_check not like '%upload_intent_scope_matches%' then
    raise exception '0087: ce_insert_server does not carry all three terms: %', server_check;
  end if;

  -- The device branch and the read policy are untouched.
  select with_check into device_check from pg_policies
   where schemaname = 'public' and tablename = 'capture_events' and policyname = 'ce_insert';
  if device_check is null or device_check not like '%''device''%' then
    raise exception '0087: ce_insert is missing or no longer names the device branch';
  end if;
  select count(*)::int into policy_count from pg_policies
   where schemaname = 'public' and tablename = 'capture_events';
  if policy_count <> 3 then
    raise exception '0087: capture_events carries % policies, not 3', policy_count;
  end if;

  -- The function is a definer with a pinned search_path, and only the service
  -- principal may execute it.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app' and p.proname = 'upload_intent_scope_matches'
       and p.prosecdef
       and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path%') then
    raise exception '0087: app.upload_intent_scope_matches is not a SECURITY DEFINER with a pinned search_path';
  end if;
  if not has_function_privilege('goproceed_service',
        'app.upload_intent_scope_matches(uuid, uuid, uuid)', 'execute') then
    raise exception '0087: goproceed_service cannot execute app.upload_intent_scope_matches';
  end if;
  if has_function_privilege('public',
        'app.upload_intent_scope_matches(uuid, uuid, uuid)', 'execute')
     or has_function_privilege('anon',
        'app.upload_intent_scope_matches(uuid, uuid, uuid)', 'execute')
     or has_function_privilege('authenticated',
        'app.upload_intent_scope_matches(uuid, uuid, uuid)', 'execute')
     or has_function_privilege('goproceed_app',
        'app.upload_intent_scope_matches(uuid, uuid, uuid)', 'execute') then
    raise exception '0087: app.upload_intent_scope_matches is executable outside the service principal';
  end if;
end $$;
