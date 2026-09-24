-- No product role can create a temporary object (DEV-060, BL-155; INV-116).
--
-- WHAT WAS WRONG. PUBLIC held TEMPORARY on the database (PostgreSQL's default),
-- so every goproceed_* login could create a temporary schema, and PostgreSQL
-- searches that schema for relation and type names: first when a path does not
-- list it, last since 0101 (INV-115). 0101 stopped it shadowing a name pg_catalog
-- defines inside a definer; a name no earlier schema defines still fell through
-- to it, and nothing mechanical keeps every definer body qualified (DEV-059's
-- gp-security S1-01).
--
-- WHAT THIS CHANGES. TEMPORARY on this database is revoked from PUBLIC and from
-- every goproceed_* role, and granted back directly to every other role that
-- held it — the Supabase-managed roles (authenticator, anon, authenticated,
-- service_role, supabase_*_admin, dashboard_user, pgbouncer, …) keep exactly what
-- they had. The NOTICE lines name them. Not granted back: predefined pg_* roles
-- (a grant there would hand TEMP to every future member), the CLI's transient
-- cli_login_* logins (a direct grant would pin them in pg_shdepend; they work as
-- the owner anyway), and any role that can become or inherit a goproceed_* role.
-- A product backend then never gets a temporary schema, so `pg_temp_nnn` — «always
-- searched if it exists» (PostgreSQL 17, «search_path») — is in no path it runs.
--
-- WHAT THIS DOES NOT CHANGE. Roles created after this migration hold no TEMP
-- unless a migration grants it. A superuser, or a role with the owner's rights,
-- can still create a temporary schema and then SET ROLE into a product role;
-- only definer paths (INV-115) and qualified bodies cover that session. The
-- database ACL lives outside every schema: pg_dump without --create does not
-- carry it, so a restore into a new project re-opens PUBLIC's TEMP silently
-- (BL-157). Other databases on the cluster are untouched.
--
-- Everything runs in one DO block, so it is one statement however the file is
-- wrapped. A non-owner's REVOKE only warns, so step 0 refuses up front and
-- step 4 asserts the result.
--
-- Rollback (re-opens BL-155): grant temporary on database <this database> to public;
-- the direct grants may stay — they grant nothing PUBLIC would not.

do $$
declare
  db      pg_catalog.text := pg_catalog.current_database();
  owner   pg_catalog.oid;
  keep    pg_catalog.oid[];
  held    pg_catalog.oid[];
  r       record;
  bad     pg_catalog.text;
  product constant pg_catalog.text := 'goproceed\_%';
begin
  select d.datdba into owner from pg_catalog.pg_database d where d.datname = db;

  -- 0. Only the owner's rights revoke PUBLIC's grant; anyone else's REVOKE only warns.
  if not (pg_catalog.pg_has_role(current_user, owner, 'USAGE')
          or (select ro.rolsuper from pg_catalog.pg_roles ro where ro.rolname = current_user)) then
    raise exception '0102: % cannot act as the owner of database %', current_user, db;
  end if;
  select pg_catalog.string_agg(n, ', ') into bad
    from pg_catalog.unnest(array['goproceed_app', 'goproceed_app_login', 'goproceed_service',
      'goproceed_service_login', 'goproceed_worker', 'goproceed_purge_worker',
      'goproceed_purge_worker_login']) n
   where not exists (select 1 from pg_catalog.pg_roles ro where ro.rolname = n);
  if bad is not null then
    raise exception '0102: product roles missing: %', bad;
  end if;

  -- 1. Who keeps TEMP: every holder now, but predefined roles, product roles, the
  --    CLI's transient logins and anything that can become or inherit a product role.
  --    `held` is every non-predefined holder, for the check that nothing else lost it.
  select pg_catalog.array_agg(ro.oid) into held
    from pg_catalog.pg_roles ro
   where pg_catalog.has_database_privilege(ro.oid, db, 'TEMPORARY')
     and ro.rolname !~ '^pg_';
  select pg_catalog.array_agg(ro.oid) into keep
    from pg_catalog.pg_roles ro
   where pg_catalog.has_database_privilege(ro.oid, db, 'TEMPORARY')
     and ro.rolname !~ '^pg_'
     and ro.rolname not like product
     and ro.rolname not like 'cli\_login\_%'
     and not exists (select 1 from pg_catalog.pg_roles p
                      where p.rolname like product
                        and pg_catalog.pg_has_role(ro.oid, p.oid, 'MEMBER'));

  -- 2. Revoke.
  execute pg_catalog.format('revoke temporary on database %I from public', db);
  for r in select ro.rolname from pg_catalog.pg_roles ro where ro.rolname like product order by 1 loop
    execute pg_catalog.format('revoke temporary on database %I from %I', db, r.rolname);
  end loop;

  -- 3. Grant back, directly, to each keeper that lost it.
  for r in select ro.rolname from pg_catalog.pg_roles ro
            where ro.oid = any(keep)
              and not pg_catalog.has_database_privilege(ro.oid, db, 'TEMPORARY')
            order by 1 loop
    execute pg_catalog.format('grant temporary on database %I to %I', db, r.rolname);
    raise notice '0102: TEMPORARY granted back to %', r.rolname;
  end loop;
  for r in select ro.rolname from pg_catalog.pg_roles ro
            where ro.rolname !~ '^pg_'
              and not pg_catalog.has_database_privilege(ro.oid, db, 'TEMPORARY')
            order by 1 loop
    raise notice '0102: no TEMPORARY for %', r.rolname;
  end loop;

  -- 4. Assert, don't trust.
  if (select d.datacl is null from pg_catalog.pg_database d where d.datname = db)
     or exists (select 1 from pg_catalog.pg_database d, pg_catalog.aclexplode(d.datacl) a
                 where d.datname = db and a.grantee = 0 and a.privilege_type = 'TEMPORARY') then
    raise exception '0102: PUBLIC still holds TEMPORARY on %', db;
  end if;

  select pg_catalog.string_agg(distinct pg_catalog.format('%s via %s', p.rolname, x.rolname), ', ') into bad
    from pg_catalog.pg_roles p
    join pg_catalog.pg_roles x on pg_catalog.pg_has_role(p.oid, x.oid, 'MEMBER')
   where p.rolname like product
     and (x.rolsuper or pg_catalog.has_database_privilege(x.oid, db, 'TEMPORARY'));
  if bad is not null then
    raise exception '0102: a product role reaches TEMPORARY or a superuser: %', bad;
  end if;

  select pg_catalog.string_agg(distinct pg_catalog.format('%s -> %s', m.rolname, p.rolname), ', ') into bad
    from pg_catalog.pg_roles p
    join pg_catalog.pg_roles m on m.oid <> p.oid and pg_catalog.pg_has_role(m.oid, p.oid, 'MEMBER')
   where p.rolname like product
     and m.rolname not like product
     and not m.rolsuper
     and pg_catalog.has_database_privilege(m.oid, db, 'TEMPORARY')
     and not (pg_catalog.pg_has_role(m.oid, owner, 'SET') or pg_catalog.pg_has_role(m.oid, owner, 'USAGE'));
  if bad is not null then
    raise exception '0102: a role holding TEMPORARY can become a product role: %', bad;
  end if;

  -- Only product roles and the CLI's transient logins may lose TEMP. A role left
  -- off `keep` for being a member of a product role (on the hosted project every
  -- member of postgres is one: postgres holds ADMIN on the goproceed_* roles) and
  -- that held TEMP only through PUBLIC stops the migration here, not in a NOTICE.
  select pg_catalog.string_agg(ro.rolname, ', ') into bad
    from pg_catalog.pg_roles ro
   where ro.oid = any(held)
     and ro.rolname not like product
     and ro.rolname not like 'cli\_login\_%'
     and not pg_catalog.has_database_privilege(ro.oid, db, 'TEMPORARY');
  if bad is not null then
    raise exception '0102: a role that held TEMPORARY lost it: %', bad;
  end if;
  if not pg_catalog.has_database_privilege(owner, db, 'TEMPORARY') then
    raise exception '0102: the owner of % lost TEMPORARY', db;
  end if;
end $$;
