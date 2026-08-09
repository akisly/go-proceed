-- ===========================================================================
-- 0053 — THE EXTERNAL EXCHANGE RAISED ON EVERY CALL
--
-- WHAT WAS WRONG. `app.exchange_external_grant` (0049 §7) declares
-- `returns table (... token_hmac bytea ...)`, and in PL/pgSQL an OUT column of a
-- RETURNS TABLE is a VARIABLE in the function's scope. Its first statement then
-- read:
--
--     select * into g from public.external_access_grants
--      where hmac_key_id = p_hmac_key_id and token_hmac = p_token_hmac
--      for update;
--
-- `token_hmac` there names both that variable and a column of the table being
-- scanned, so the function raised 42702 «column reference "token_hmac" is
-- ambiguous» before it compared anything. Not on some inputs — on EVERY call,
-- because the ambiguity is resolved at first execution and has nothing to do
-- with the arguments.
--
-- WHAT IT COST. `POST /external/exchange` is the front door of the whole M5
-- protected-link protocol: the технагляд clicks the link in the letter, the
-- shell POSTs the token, and this function is what turns it into a session.
-- Every exchange answered 500 INTERNAL_ERROR, so no external session could ever
-- be created and nothing behind it — scope, decision, receipt — was reachable.
-- Thirteen cases in apps/app/tests/m5-external.int.test.ts said so the first
-- time that suite was ever executed, on 2026-08-09.
--
-- The sibling definer functions were checked for the same shape and are clean:
-- resolve_external_session, external_session_scope, external_session_occurrence,
-- external_session_may_decide, external_session_workspace and
-- current_external_session all execute. This is the only one.
--
-- THE FIX is to qualify the scan. The table is given an alias and both
-- predicates are read through it, so neither can bind to an OUT parameter.
-- `#variable_conflict use_column` would also silence it and is deliberately not
-- used: it would change how EVERY identifier in the body resolves, including
-- ones a later edit adds, and the point here is to remove an ambiguity rather
-- than to pick a winner for it. Nothing else about the function changes — the
-- TTL guard, the four refusals, the single-use update, the insert and the
-- returned row are all as 0049 wrote them.
--
-- ROLLBACK (dev only): re-apply 0049 §7's definition verbatim.
-- ===========================================================================
create or replace function app.exchange_external_grant(
  p_hmac_key_id text,
  p_token_hmac bytea,
  p_verifier_key_id text,
  p_session_verifier bytea,
  p_csrf_verifier bytea,
  p_idle_seconds integer,
  p_absolute_seconds integer)
returns table (session_id uuid, workspace_id uuid, project_id uuid, grant_id uuid,
               occurrence_id uuid, may_decide boolean, token_hmac bytea,
               absolute_expires_at timestamptz, idle_expires_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare
  g record;
  s_id uuid;
  now_ts timestamptz := now();
  idle_at timestamptz;
  abs_at timestamptz;
begin
  if p_idle_seconds is null or p_idle_seconds <= 0
     or p_absolute_seconds is null or p_absolute_seconds <= 0
     or p_idle_seconds > p_absolute_seconds then
    raise exception 'external session TTLs are out of range';
  end if;

  -- `eag`, and every predicate read through it. Unqualified `token_hmac` here
  -- names this function's own OUT column as readily as the table's, and that is
  -- the 42702 this migration exists for.
  select * into g
    from public.external_access_grants eag
   where eag.hmac_key_id = p_hmac_key_id
     and eag.token_hmac = p_token_hmac
   for update;

  if not found then return; end if;
  if g.status <> 'active' then return; end if;
  if g.expires_at <= now_ts then return; end if;
  if g.exchange_consumed_at is not null then return; end if;
  -- v0.1 exchanges only the occurrence arc. A package-scoped grant reaching this
  -- function in a v0.1 database is a row nothing could have written, and it is
  -- refused rather than half-handled.
  if g.scope_kind <> 'requirement_occurrence' then return; end if;

  idle_at := now_ts + make_interval(secs => p_idle_seconds);
  abs_at  := now_ts + make_interval(secs => p_absolute_seconds);

  update public.external_access_grants eag
     set exchange_consumed_at = now_ts, version = eag.version + 1
   where eag.id = g.id and eag.exchange_consumed_at is null;
  if not found then return; end if;

  insert into public.external_sessions
    (workspace_id, external_access_grant_id, requirement_occurrence_id,
     session_verifier, csrf_verifier, verifier_key_id,
     idle_expires_at, absolute_expires_at, grant_revocation_version)
  values
    (g.workspace_id, g.id, g.requirement_occurrence_id,
     p_session_verifier, p_csrf_verifier, p_verifier_key_id,
     idle_at, abs_at, g.revocation_version)
  returning id into s_id;

  return query select s_id, g.workspace_id, g.project_id, g.id,
                      g.requirement_occurrence_id, g.decides_evidence, g.token_hmac,
                      abs_at, idle_at;
end $$;

comment on function app.exchange_external_grant(
  text, bytea, text, bytea, bytea, integer, integer) is
  'INV-057 in one place: find the grant by its keyed verifier under a row lock, '
  'refuse unless it is live and unconsumed, mark it consumed, create exactly one '
  'session. Corrected in 0053 — as written in 0049 it raised 42702 on every call, '
  'because RETURNS TABLE makes token_hmac a variable and the scan read it '
  'unqualified.';
