-- INV-116 catalog checks (DEV-060 T1 T2 T3 T6 T8; DEV-071, BL-157).
--
-- ONE read-only SELECT over the system catalogs of current_database(). Every row
-- is a violation; ZERO ROWS MEANS INV-116 HOLDS. No bind parameters and no psql
-- meta-commands, so it can be pasted verbatim into the Supabase connector's
-- execute_sql, and any role can run it.
--
-- Read by packages/testing/src/temporary-privilege.test.ts (with a negative
-- control per check) and by scripts/snapshot-db-catalog.mjs (exit 1 on a row);
-- run on hosted projects per infra/README-staging.md §2.3. Migration 0102 keeps
-- its own copy in its assertion block (migrations are append-only).
--
--   T1  PUBLIC holds TEMPORARY, or the database ACL is still the default (which grants it).
--   T2  a product role is missing, or reaches TEMPORARY or a superuser through any membership.
--   T3  a role holding TEMPORARY, short of a superuser or the owner's rights, can become a product role.
--   T6  such a role can reach a non-extension SECURITY DEFINER function in app, public or api.
--   T8  a non-extension function body in app, public or api creates a temporary object
--       (CREATE TEMP, SELECT … INTO TEMP, or an object named into pg_temp.). A statement
--       assembled at run time is out of its reach.
--
-- The seven product roles are named here, so a run against the wrong project
-- returns «product role missing» rows instead of passing on nothing.
--
-- Every literal compared with a catalog column is cast to its pg_catalog type,
-- and every string function or operator it meets is one pg_catalog defines for
-- exactly those types, so an operator someone creates in public or "$user" for
-- (name, name), (oid, int4) or the like cannot win resolution and empty a check
-- (the CVE-2018-1058 class; DEV-071 gp-security S1-04). The LIKE and T8 patterns are
-- E'' strings, so they do not depend on standard_conforming_strings.

with db as (
  select d.oid, d.datdba, d.datacl
    from pg_catalog.pg_database d
   where d.datname = pg_catalog.current_database()
),
named(rolname) as (
  values ('goproceed_app'), ('goproceed_app_login'), ('goproceed_service'),
         ('goproceed_service_login'), ('goproceed_worker'), ('goproceed_purge_worker'),
         ('goproceed_purge_worker_login')
),
product as (
  select r.oid, r.rolname from pg_catalog.pg_roles r where r.rolname like E'goproceed\\_%'::pg_catalog.text
),
owner_rights(oid) as (
  select r.oid from pg_catalog.pg_roles r, db
   where pg_catalog.pg_has_role(r.oid, db.datdba, 'SET')
      or pg_catalog.pg_has_role(r.oid, db.datdba, 'USAGE')
),
violation(check_id, subject, detail) as (
  select 'T1'::pg_catalog.text, 'PUBLIC'::pg_catalog.text,
         case when db.datacl is null then 'the database ACL is the default, which grants PUBLIC TEMPORARY'::pg_catalog.text
              else 'PUBLIC holds TEMPORARY'::pg_catalog.text end
    from db
   where db.datacl is null
      or exists (select 1 from pg_catalog.aclexplode(db.datacl) a
                  where a.grantee = 0::pg_catalog.oid and a.privilege_type = 'TEMPORARY'::pg_catalog.text)

  union all
  select 'T2'::pg_catalog.text, n.rolname::pg_catalog.text, 'product role missing'::pg_catalog.text
    from named n
   where not exists (select 1 from pg_catalog.pg_roles r where r.rolname::pg_catalog.text = n.rolname::pg_catalog.text)

  union all
  select distinct 'T2'::pg_catalog.text, p.rolname::pg_catalog.text,
         'reaches TEMPORARY or a superuser via '::pg_catalog.text || x.rolname::pg_catalog.text
    from product p
    join pg_catalog.pg_roles x on pg_catalog.pg_has_role(p.oid, x.oid, 'MEMBER')
    cross join db
   where x.rolsuper or pg_catalog.has_database_privilege(x.oid, db.oid, 'TEMPORARY')

  union all
  select distinct 'T3'::pg_catalog.text, m.rolname::pg_catalog.text,
         'holds TEMPORARY and can become '::pg_catalog.text || p.rolname::pg_catalog.text
    from product p
    join pg_catalog.pg_roles m on m.oid <> p.oid and pg_catalog.pg_has_role(m.oid, p.oid, 'MEMBER')
    cross join db
   where m.rolname not like E'goproceed\\_%'::pg_catalog.text
     and not m.rolsuper
     and pg_catalog.has_database_privilege(m.oid, db.oid, 'TEMPORARY')
     and m.oid not in (select oid from owner_rights)

  union all
  select distinct 'T6'::pg_catalog.text, h.rolname::pg_catalog.text,
         'holds TEMPORARY and reaches definer '::pg_catalog.text
           || pg_catalog.format('%I.%I(%s)'::pg_catalog.text, n.nspname, p.proname,
                                pg_catalog.pg_get_function_identity_arguments(p.oid))
    from db
    join pg_catalog.pg_roles h on pg_catalog.has_database_privilege(h.oid, db.oid, 'TEMPORARY')
    join pg_catalog.pg_roles x on pg_catalog.pg_has_role(h.oid, x.oid, 'MEMBER')
    join pg_catalog.pg_proc p on p.prosecdef
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
                                and n.nspname::pg_catalog.text in ('app'::pg_catalog.text, 'public'::pg_catalog.text, 'api'::pg_catalog.text)
   where not h.rolsuper
     and h.rolname::pg_catalog.text !~ '^pg_'::pg_catalog.text
     and h.oid not in (select oid from owner_rights)
     and pg_catalog.has_schema_privilege(x.oid, n.oid, 'USAGE')
     and pg_catalog.has_function_privilege(x.oid, p.oid, 'EXECUTE')
     and not exists (select 1 from pg_catalog.pg_depend dep
                      where dep.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass::pg_catalog.oid
                        and dep.objid = p.oid and dep.deptype = 'e'::pg_catalog."char")

  union all
  select 'T8'::pg_catalog.text,
         pg_catalog.format('%I.%I(%s)'::pg_catalog.text, n.nspname, p.proname,
                           pg_catalog.pg_get_function_identity_arguments(p.oid)),
         'body creates a temporary object'::pg_catalog.text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname::pg_catalog.text in ('app'::pg_catalog.text, 'public'::pg_catalog.text, 'api'::pg_catalog.text)
     and p.prosrc ~* E'(create\\s+(local\\s+|global\\s+)?temp(orary)?\\M|\\minto\\s+temp(orary)?\\M|\\mpg_temp\\.)'::pg_catalog.text
     and not exists (select 1 from pg_catalog.pg_depend dep
                      where dep.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass::pg_catalog.oid
                        and dep.objid = p.oid and dep.deptype = 'e'::pg_catalog."char")
)
select v.check_id, v.subject, v.detail
  from violation v
 order by 1, 2, 3;
