-- The helpers that trusted public (DEV-047, BL-143).
--
-- WHAT WAS WRONG. 0011 created the three SECURITY DEFINER helpers every
-- workspace-access policy rests on — `app.active_member_id`,
-- `app.has_project_capability` and `app.project_has_grants`, and through them
-- `projects_select`, `pag_*`, `pra_*` and 0097's `prae_*` — with
-- `set search_path = public`, not the empty path the project's definer rule
-- asks for. A definer function resolves every unqualified name through that
-- path with its owner's rights, so an object planted in `public` under a
-- built-in's name would run as the owner. Every table reference in the three
-- bodies is already qualified and `now()` resolves from `pg_catalog`, which is
-- always searched first, so the risk was low: the same class as BL-106 and
-- BL-110, which this migration does not touch.
--
-- WHAT THIS CHANGES. `alter function … set search_path = ''` on the three
-- helpers. With an empty path, `pg_catalog` is still searched implicitly, and
-- the session's temporary schema still comes first for relation and type names
-- (never for functions or operators; PostgreSQL 17, «search_path»), which is why
-- the bodies' qualified table names — not the path — are what keep a temporary
-- table from masking `public.memberships` or `public.project_access_grants`. A type name is
-- the exception: the inlined `app.current_actor()` casts to an unqualified
-- `uuid`, which a session's temporary schema can shadow (pre-existing; BL-150). It copies no body, so it keeps each function's owner, its EXECUTE
-- grants and its volatility; a definer function with a SET clause was never
-- inlined, so plans do not change. The assertion below fails the migration if
-- any of the three is not a definer with exactly the empty path afterwards, or
-- if `anon` or `authenticated` can execute one.
--
-- WHAT THIS DOES NOT CHANGE. The bodies, the policies, and the other definer
-- functions in `app` that still pin `public` (`org_has_members`,
-- `accept_invitation`, `member_role`, the outbox and idempotency functions and
-- the rest recorded in DEV-047's record).
--
-- Rollback: alter function app.active_member_id(uuid) set search_path = public;
--           alter function app.has_project_capability(uuid, uuid, text[]) set search_path = public;
--           alter function app.project_has_grants(uuid, uuid) set search_path = public;

alter function app.active_member_id(uuid) set search_path = '';
alter function app.has_project_capability(uuid, uuid, text[]) set search_path = '';
alter function app.project_has_grants(uuid, uuid) set search_path = '';

-- 0011 already revokes EXECUTE from public for these three; restated for the two Supabase roles.
revoke execute on function app.active_member_id(uuid) from anon, authenticated;
revoke execute on function app.has_project_capability(uuid, uuid, text[]) from anon, authenticated;
revoke execute on function app.project_has_grants(uuid, uuid) from anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'app.active_member_id(uuid)',
    'app.has_project_capability(uuid,uuid,text[])',
    'app.project_has_grants(uuid,uuid)'] loop
    if not exists (select 1 from pg_proc p
                    where p.oid = f::regprocedure and p.prosecdef
                      and p.proconfig = array['search_path=""']) then
      raise exception '0098: % is not SECURITY DEFINER with exactly search_path=""', f;
    end if;
    if has_function_privilege('anon', f, 'EXECUTE') or has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception '0098: anon or authenticated can execute %', f;
    end if;
  end loop;
end $$;
