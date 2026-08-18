-- THE FIVE POSTGRESQL ROLES, RENAMED aktflow_* -> goproceed_*.
--
-- The product was renamed to GoProceed on 2026-08-03. Every workspace package
-- identifier moved that day, the CSS class followed, and the 26 on-screen
-- strings followed on 2026-08-10. The database roles are the last runtime
-- identifiers still carrying the old name, and TODOS.md has held them back
-- with a stated reason:
--
--   «`ALTER ROLE ... RENAME TO` is not a text substitution — a role rename
--    clears an md5-hashed password, every connection string and CI secret has
--    to move in the same window, and the rename must land in a migration that
--    runs against an environment whose app is already connecting under the old
--    name. That is a deployment-ordering problem, not a find-and-replace.»
--
-- EVERY CLAUSE OF THAT DESCRIBES A DEPLOYED ENVIRONMENT, AND THERE IS NONE.
-- `infra/README-staging.md` still records that staging has never been
-- provisioned: no Supabase cloud project, no Vercel project for `apps/app`, no
-- deploy step in CI. The only databases that have ever run this chain are the
-- local stack and CI's, both rebuilt from scratch on every run. There is no
-- live connection string to coordinate and no session to keep alive across the
-- change. This migration is therefore free TODAY and becomes exactly the
-- deployment-ordering problem the entry describes on the day the P0 origin is
-- provisioned — which is the whole reason it is landing now rather than after.
--
-- WHAT WAS MEASURED RATHER THAN ASSUMED, before this file was written. On the
-- local stack, inside a transaction that was rolled back:
--
--   * 137 RLS policies name `aktflow_app`. After the rename, 137 name
--     `goproceed_app` and ZERO still name the old one. `pg_policy.polroles`
--     holds role OIDs, not names, so every policy follows the role.
--   * 126 table grants to `aktflow_app` likewise follow — ACLs are OID-based
--     for the same reason.
--   * The login password SURVIVES, and the entry's md5 clause does not apply
--     to this stack at all: `show password_encryption` is `scram-sha-256`,
--     whose verifier is not salted with the role name. (Even if it were, the
--     local passwords are set after every reset by
--     scripts/set-local-app-password.mjs, and no real environment has one.)
--   * Role MEMBERSHIP survives: `pg_has_role(goproceed_app_login,
--     goproceed_app, member)` is still true.
--
-- NO POLICY IS REWRITTEN, NO GRANT IS RE-ISSUED, NO MEMBERSHIP IS RE-GRANTED.
-- All three would be redundant against the measurements above, and each one
-- would be a change to the authorization substrate smuggled in beside a rename.
--
-- WHAT A RENAME CANNOT FOLLOW, AND THIS FILE ORIGINALLY MISSED: the role name
-- stored as TEXT rather than as a catalog reference. The first draft of this
-- migration said it «renames and does nothing else», which was wrong, and the
-- test suite is what said so — `m2-binding-hardening` and `m2-service-principal`
-- failed with `role "aktflow_service" does not exist`, six tests, immediately.
--
-- The source is `app.finalize_upload_intent` (migration 0035), whose body
-- guards on `pg_has_role(session_user, 'aktflow_service', 'member')`. That
-- string is inside `prosrc`; it is not a dependency the catalog knows about, so
-- `ALTER ROLE ... RENAME TO` leaves it pointing at a role that no longer
-- exists, and every server-side finalize raises instead of running. It fails
-- CLOSED, which is the one mercy, but the whole evidence path is down.
--
-- So the two blocks after the rename rewrite text, and they do it by SEARCHING
-- THE CATALOG rather than by naming the objects they expect to find. Naming
-- `app.finalize_upload_intent` here would fix today's tree and silently miss
-- the next function to acquire such a reference before this migration runs.
-- Both blocks assert afterward that nothing of their kind is left, so a miss is
-- a failed migration rather than a runtime error later.
--
-- The full catalog was swept for every other place a name can hide as text —
-- policy USING/WITH CHECK expressions, check constraints, column defaults,
-- views, rules, trigger definitions, cron job commands, default ACLs, event
-- triggers, and per-role settings. All were zero; only function bodies (1) and
-- object comments (4) carried anything.
--
-- THE OLDER MIGRATIONS ARE NOT EDITED, and that is a deliberate choice between
-- two available ones (owner decision, 2026-08-17). Forty files under
-- supabase/migrations/ still read `aktflow_*`; substituting the text there
-- would leave a textually clean tree and would have been safe in the narrow
-- sense that nothing has applied them for real. It is refused because a
-- migration is history in this repository — TODOS.md says so in terms about a
-- migration COMMENT — and history should say what actually happened: these
-- roles were created as `aktflow_*` and renamed later. A fresh `db reset`
-- therefore creates the old names in 0003/0034 and renames them here, which
-- looks redundant and is exactly right.
--
-- IDEMPOTENT, because infra/README-staging.md §2.2 requires every migration in
-- this repository to survive a second `supabase db push` with no effect. A
-- bare `alter role ... rename to` would fail on the second apply once the old
-- name is gone; each rename below is guarded on the old name still existing
-- AND the new one not, so a re-run is a no-op rather than an error, and a
-- half-applied state (which cannot happen inside one transaction, but could
-- arise from a hand-run fragment) converges rather than wedging.

do $$
declare
  -- Ordered oldest-first, matching the migrations that created them:
  -- 0003_roles_and_grants.sql for the app pair and the worker,
  -- 0034_service_principal_role.sql for the service pair.
  pairs constant text[][] := array[
    ['aktflow_app',            'goproceed_app'],
    ['aktflow_app_login',      'goproceed_app_login'],
    ['aktflow_worker',         'goproceed_worker'],
    ['aktflow_service',        'goproceed_service'],
    ['aktflow_service_login',  'goproceed_service_login']
  ];
  old_name text;
  new_name text;
begin
  for i in 1 .. array_length(pairs, 1) loop
    old_name := pairs[i][1];
    new_name := pairs[i][2];

    if exists (select 1 from pg_roles where rolname = new_name) then
      -- Already renamed: the second `db push`, or a re-run of this file.
      raise notice 'role % already exists; % rename skipped', new_name, old_name;
    elsif exists (select 1 from pg_roles where rolname = old_name) then
      execute format('alter role %I rename to %I', old_name, new_name);
      raise notice 'renamed role % to %', old_name, new_name;
    else
      -- NEITHER NAME EXISTS. Not silently tolerated: 0003 and 0034 create
      -- these unconditionally, so reaching here means the chain did not run in
      -- order and a later grant would fail against a role that is absent. Fail
      -- loudly, in the migration that noticed, rather than leaving the next
      -- one to fail with a message about something else.
      raise exception 'neither % nor % exists — migrations 0003/0034 did not run before this one', old_name, new_name;
    end if;
  end loop;
end $$;

-- ── FUNCTION BODIES ─────────────────────────────────────────────────────────
-- Rewritten by searching `prosrc`, not by naming the function this tree happens
-- to have. `pg_get_functiondef` reproduces the whole definition including
-- `security definer`, the `set search_path` clause and the argument list, so
-- `create or replace` from it preserves every property except the text being
-- substituted; the owner is preserved because `create or replace` never changes
-- it.
--
-- Alternation is ordered LONGEST-FIRST (`app_login` before `app`), because `_`
-- is a word character: `\y` after `app` inside `aktflow_app_login` is not a word
-- boundary, so a shorter-first alternation would leave `goproceed_app_login`
-- mangled into `goproceed_app` + `_login`.
do $$
declare
  r record;
  rewritten int := 0;
begin
  for r in
    select p.oid, n.nspname, p.proname, pg_get_functiondef(p.oid) as def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname not in ('pg_catalog', 'information_schema')
       and p.prosrc ~ '\yaktflow_(app_login|app|service_login|service|worker)\y'
  loop
    execute regexp_replace(
      r.def, '\yaktflow_(app_login|app|service_login|service|worker)\y',
      'goproceed_\1', 'g');
    rewritten := rewritten + 1;
    raise notice 'rewrote a pre-rename role reference inside %.%', r.nspname, r.proname;
  end loop;
  raise notice 'function bodies rewritten: %', rewritten;

  -- ASSERT, rather than trust the loop above. A body that still names an old
  -- role would raise `role "aktflow_..." does not exist` at call time — which
  -- is how this was found in the first place, six tests into a suite run.
  perform 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname not in ('pg_catalog', 'information_schema')
      and p.prosrc ~ '\yaktflow_(app_login|app|service_login|service|worker)\y';
  if found then
    raise exception 'a function body still names a pre-rename role after the rewrite';
  end if;
end $$;

-- ── OBJECT COMMENTS ─────────────────────────────────────────────────────────
-- `comment on table` text describing which grants a role holds. Nothing breaks
-- if these are left, which is exactly why they are worth moving: a comment on a
-- LIVE table naming a role that no longer exists is a stale claim on a current
-- object, and this repository treats that as a defect rather than as cosmetics.
--
-- Restricted to ordinary and partitioned tables (`relkind in ('r','p')`) —
-- the only kinds carrying such a comment here — with an assertion covering
-- every other kind, so a view or a function comment acquiring one later fails
-- the migration instead of being skipped by a `where` clause nobody re-reads.
do $$
declare
  r record;
  moved int := 0;
begin
  for r in
    select c.oid::regclass::text as rel, d.description
      from pg_description d
      join pg_class c on c.oid = d.objoid
     where d.objsubid = 0
       and c.relkind in ('r', 'p')
       and d.description ~ '\yaktflow_(app_login|app|service_login|service|worker)\y'
  loop
    execute format('comment on table %s is %L', r.rel,
      regexp_replace(r.description,
        '\yaktflow_(app_login|app|service_login|service|worker)\y', 'goproceed_\1', 'g'));
    moved := moved + 1;
  end loop;
  raise notice 'object comments rewritten: %', moved;

  perform 1 from pg_description d
    where d.description ~ '\yaktflow_(app_login|app|service_login|service|worker)\y';
  if found then
    raise exception 'an object comment still names a pre-rename role after the rewrite';
  end if;
end $$;

-- NOTHING IN A TABLE holds a role name, so there is no data to migrate beside
-- the catalog changes above: no grants ledger, and no audit row naming a
-- database role — `audit_events` records the application actor
-- (`app.actor_user_id`), which is a member id. Verified by grep over
-- technical/database/schema-v0.1.sql and the migration chain before writing
-- this, rather than assumed: no column default, check constraint or seeded row
-- carries one.
