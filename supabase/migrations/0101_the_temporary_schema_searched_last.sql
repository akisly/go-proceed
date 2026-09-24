-- The temporary schema searched last (DEV-059, BL-152; closes BL-110, narrows BL-146).
--
-- WHAT WAS WRONG. Unless a path lists pg_temp, PostgreSQL searches the session's
-- temporary schema FIRST for relation and type names — an empty path included
-- (PostgreSQL 17, «search_path»; «Writing SECURITY DEFINER Functions Safely»:
-- «write pg_temp as the last entry in search_path»). Every definer in app whose
-- path was '' or `public` and that named a type unqualified in its own body — a
-- plpgsql DECLARE (`new_membership uuid`, 0011), a cast (`org::text`, 0006), a
-- default — resolved it through the caller's temporary schema with its owner's
-- rights. A session with
-- arbitrary SQL on an application, service or purge connection (PUBLIC holds
-- TEMP) could create a domain pg_temp.uuid whose CHECK calls a pg_temp function,
-- and the definer ran it as its owner: DEV-059's red run shows it as `postgres`
-- through accept_invitation, retire_requirement_rule_version, org_has_members and,
-- on the service plane, abandon_unauthorized_upload_intent. Invoker functions
-- that pin '' run as that owner too when a definer fires or calls them.
--
-- WHAT THIS CHANGES. `set search_path = pg_catalog, pg_temp` on:
--   * the ten app definers and public.drain_outbox that pinned `public` — every
--     relation in their bodies is public.-qualified and every function they call
--     is in pg_catalog or app.-qualified (DEV-059's body read);
--   * every non-extension function in app and public whose path is exactly ''
--     (0098's three helpers and 0099's guard among them). For those the change is
--     neutral for any name the temporary schema does not also define: functions
--     and operators were never looked up there.
-- ALTER FUNCTION copies no body; OID, owner, SECURITY DEFINER, volatility, ACL stay.
--
-- WHAT THIS DOES NOT CHANGE. pg_temp is still searched, last: a name no earlier
-- schema defines still falls through to it, so bodies keep schema-qualifying
-- every relation, type and function outside pg_catalog (BL-155). The eleven
-- definers pinned `public, pg_temp` (pg_temp is already last; they still trust
-- public — BL-146); the inlinable
-- invoker helpers with no SET clause (INV-114); PUBLIC's TEMP on the database
-- (BL-155).
--
-- Rollback (re-opens BL-152): the eleven named below `set search_path = public`;
-- the 77 functions DEV-059's record lists by name (Appendix) `set search_path = ''`.

alter function app.org_has_members(uuid)                              set search_path = pg_catalog, pg_temp;
alter function app.delete_expired_idempotency(uuid, text, text, text) set search_path = pg_catalog, pg_temp;
alter function app.purge_expired_idempotency(integer)                 set search_path = pg_catalog, pg_temp;
alter function app.claim_outbox(integer, text, integer)               set search_path = pg_catalog, pg_temp;
alter function app.complete_outbox(uuid, uuid)                        set search_path = pg_catalog, pg_temp;
alter function app.fail_outbox(uuid, uuid, text)                      set search_path = pg_catalog, pg_temp;
alter function app.accept_invitation(text)                            set search_path = pg_catalog, pg_temp;
alter function app.member_role(uuid)                                  set search_path = pg_catalog, pg_temp;
alter function app.contract_version_is_draft(uuid, uuid)              set search_path = pg_catalog, pg_temp;
alter function app.work_type_key_is_bindable(uuid, uuid, text)        set search_path = pg_catalog, pg_temp;
alter function public.drain_outbox(integer)                           set search_path = pg_catalog, pg_temp;

do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select ns.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname in ('app', 'public')
       and p.proconfig @> array['search_path=""']::pg_catalog.text[]
       and not exists (select 1 from pg_catalog.pg_depend d
                        where d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
                          and d.objid = p.oid and d.deptype = 'e')
     order by 1, 2, 3
  loop
    execute pg_catalog.format('alter function %I.%I(%s) set search_path = pg_catalog, pg_temp',
                              r.nspname, r.proname, r.args);
    n := n + 1;
  end loop;
  raise notice '0101: % functions moved from search_path="" to pg_catalog, pg_temp', n;
end $$;

do $$
declare
  bad text;
  f text;
begin
  select pg_catalog.string_agg(pg_catalog.format('%s %s', p.oid::pg_catalog.regprocedure,
           coalesce(pg_catalog.array_to_string(p.proconfig, ';'), '<no SET>')), ', ')
    into bad
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname in ('app', 'public', 'api')
     and not exists (select 1 from pg_catalog.pg_depend d
                      where d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
                        and d.objid = p.oid and d.deptype = 'e')
     and (p.prosecdef or exists (select 1 from pg_catalog.unnest(p.proconfig) c where c like 'search_path=%'))
     and not exists (select 1 from pg_catalog.unnest(p.proconfig) c
                      where c in ('search_path=pg_catalog, pg_temp', 'search_path=public, pg_temp'));
  if bad is not null then
    raise exception '0101: a definer, or a function pinning search_path, does not list pg_temp last: %', bad;
  end if;

  foreach f in array array[
    'app.org_has_members(uuid)', 'app.delete_expired_idempotency(uuid,text,text,text)',
    'app.purge_expired_idempotency(integer)', 'app.claim_outbox(integer,text,integer)',
    'app.complete_outbox(uuid,uuid)', 'app.fail_outbox(uuid,uuid,text)', 'app.accept_invitation(text)',
    'app.member_role(uuid)', 'app.contract_version_is_draft(uuid,uuid)',
    'app.work_type_key_is_bindable(uuid,uuid,text)', 'public.drain_outbox(integer)'] loop
    if not exists (select 1 from pg_catalog.pg_proc p
                    where p.oid = f::pg_catalog.regprocedure and p.prosecdef
                      and p.proconfig = array['search_path=pg_catalog, pg_temp']::pg_catalog.text[]) then
      raise exception '0101: % is not SECURITY DEFINER with exactly search_path=pg_catalog, pg_temp', f;
    end if;
    if pg_catalog.has_function_privilege('anon', f, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception '0101: anon or authenticated can execute %', f;
    end if;
  end loop;

  if not pg_catalog.has_function_privilege('goproceed_app', 'app.accept_invitation(text)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('goproceed_app', 'app.has_project_capability(uuid,uuid,text[])', 'EXECUTE')
     or not pg_catalog.has_function_privilege('goproceed_service', 'app.abandon_unauthorized_upload_intent(uuid)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('goproceed_purge_worker', 'app.claim_upload_purge(integer)', 'EXECUTE') then
    raise exception '0101: a caller lost EXECUTE';
  end if;
end $$;
