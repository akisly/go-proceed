-- The actor that named its type (DEV-055, BL-150).
--
-- WHAT WAS WRONG. `app.current_actor()` (0003), `app.current_external_session()`
-- (0049) and `app.service_workspace()` (0062) are small invoker SQL functions
-- with no SET clause, so PostgreSQL inlines them into their callers and parses
-- their bodies under the caller's search path. Their casts named `uuid`
-- unqualified. PostgreSQL searches the session's temporary schema first for
-- type names, even under the empty path the workspace-access definers pin
-- (0098), so a session that created a temporary object named `uuid` changed
-- what the cast resolved to inside those definers: with a table they failed
-- («return type mismatch»), and a domain could attach a check of its own.
-- Only a session with arbitrary SQL on the application connection could do it.
--
-- WHAT THIS CHANGES. The three are re-created with the same signature and
-- attributes — invoker, `language sql stable`, no SET clause, so they stay
-- inlinable — naming `pg_catalog.uuid` and `pg_catalog.current_setting`.
-- CREATE OR REPLACE keeps each function's OID, owner, EXECUTE grants and
-- comment. A SET clause would have fixed the path and stopped the inlining.
--
-- WHAT THIS DOES NOT CHANGE. Unqualified type names in the bodies of the
-- definer functions themselves (casts and plpgsql declarations; BL-152), and
-- PUBLIC's TEMP privilege on the database (a separate decision).
--
-- Rollback: re-create the three with their original bodies (0003:68-71,
--           0049:647-655, 0062:598-601).

create or replace function app.current_actor() returns pg_catalog.uuid
language sql stable as $$
  select nullif(pg_catalog.current_setting('app.actor_user_id', true), '')::pg_catalog.uuid
$$;

create or replace function app.current_external_session() returns pg_catalog.uuid
language sql stable as $$
  select case
    when nullif(pg_catalog.current_setting('app.actor_user_id', true), '') is not null then null
    else nullif(pg_catalog.current_setting('app.external_session_id', true), '')::pg_catalog.uuid
  end
$$;

create or replace function app.service_workspace() returns pg_catalog.uuid
language sql stable as $$
  select nullif(pg_catalog.current_setting('app.organization_id', true), '')::pg_catalog.uuid
$$;

do $$
declare
  f text;
  r record;
begin
  foreach f in array array['app.current_actor()', 'app.current_external_session()', 'app.service_workspace()'] loop
    select p.prosecdef, p.proconfig, p.provolatile, l.lanname, p.prosrc into r
      from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid = p.prolang
     where p.oid = f::pg_catalog.regprocedure;
    if r.prosecdef or r.proconfig is not null or r.provolatile <> 's' or r.lanname <> 'sql' then
      raise exception '0100: % must stay an inlinable invoker SQL STABLE function with no SET clause', f;
    end if;
    if r.prosrc ~ '::uuid\M' or r.prosrc !~ '::pg_catalog\.uuid' or r.prosrc ~ '(^|[^.])current_setting\(' then
      raise exception '0100: % still names an unqualified type or function', f;
    end if;
  end loop;
  if not pg_catalog.has_function_privilege('goproceed_app', 'app.current_actor()', 'EXECUTE')
     or not pg_catalog.has_function_privilege('goproceed_service', 'app.current_actor()', 'EXECUTE')
     or not pg_catalog.has_function_privilege('goproceed_app', 'app.current_external_session()', 'EXECUTE')
     or not pg_catalog.has_function_privilege('goproceed_service', 'app.service_workspace()', 'EXECUTE') then
    raise exception '0100: a caller lost EXECUTE, so the helper would no longer be inlined';
  end if;
end $$;
