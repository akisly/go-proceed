-- The revoke that could be undone (DEV-052, BL-138, INV-113).
--
-- WHAT WAS WRONG. 0096 narrowed the application role's UPDATE on
-- public.project_access_grants to `revoked_at` and `version`, and said what it
-- did not change: RLS cannot compare the old row with the new one, so a defect
-- in the product could still set `revoked_at` back to null — un-revoking a grant
-- on any project the actor administers — or backdate it. Superuser sessions
-- could rewrite any column of a grant, or delete it; a deleted grant also
-- re-opens `pag_insert`'s bootstrap arm (0011), which lets any active member
-- grant themselves `project.admin` on a project with no grant rows at all.
--
-- WHAT THIS CHANGES. A BEFORE UPDATE OR DELETE row trigger refuses every change
-- to a grant but the revoke itself:
--   - DELETE is refused: a grant is revoked, never removed;
--   - a revoked grant never changes again;
--   - the one UPDATE allowed sets `revoked_at` from null to the transaction's
--     `now()` — not earlier, not later, the rule 0097 sets for `ended_at` — with
--     `version` unchanged or up by one;
--   - every other column is frozen, a column a later migration adds included
--     (the rows are compared as jsonb without the two writable keys).
-- Both product writers — `project_access.revoke` and the grant route's
-- replacement of `project.view` (DEV-049) — write exactly that. The function is
-- an invoker (it reads only OLD and NEW), pins the empty search path, and no
-- role executes it directly. The trigger has the default enablement, so it fires
-- for every role, the table owner and superusers included, and not under
-- `session_replication_role = replica`, which is the bypass the fixtures'
-- teardown already uses. Column privileges and RLS are checked before a BEFORE
-- trigger runs, so 0096's 42501 refusals keep their codes.
--
-- WHAT THIS DOES NOT CHANGE. The table owner's bypasses: replica mode,
-- `alter table … disable trigger` (dropM2Workspaces) and TRUNCATE, which only
-- the owner holds since 0058 (truncateAll). A later migration that backfills a
-- grant column must disable this trigger around the backfill. Inserts are
-- unchanged.
--
-- This supersedes 0096's «What this does not change» on write-once; 0096 itself
-- is not edited. ADR-014's amendment of 2026-09-24 (DEV-052) records it.
--
-- Rollback: drop trigger project_access_grants_guard on public.project_access_grants;
--           drop function app.guard_project_access_grant();

create function app.guard_project_access_grant() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'INV-113: a project access grant is never deleted, only revoked (grant %)', old.id;
  end if;
  if old.revoked_at is not null then
    raise exception 'INV-113: a revoked project access grant never changes (grant %)', old.id;
  end if;
  if new.revoked_at is null then
    raise exception 'INV-113: the only change to a project access grant is its revoke (grant %)', old.id;
  end if;
  if new.revoked_at <> now() then
    raise exception 'INV-113: a project access grant is revoked at the transaction''s time, not another (grant %)', old.id;
  end if;
  if new.version <> old.version and new.version <> old.version + 1 then
    raise exception 'INV-113: a revoke keeps the version or raises it by one (grant %)', old.id;
  end if;
  if (to_jsonb(new) - 'revoked_at' - 'version') is distinct from (to_jsonb(old) - 'revoked_at' - 'version') then
    raise exception 'INV-113: a revoke changes revoked_at and version only (grant %)', old.id;
  end if;
  return new;
end;
$$;

revoke all on function app.guard_project_access_grant() from public, anon, authenticated, service_role;

create trigger project_access_grants_guard
  before update or delete on public.project_access_grants
  for each row execute function app.guard_project_access_grant();

do $$
declare
  t record;
  r text;
begin
  select tgenabled, tgtype, tgfoid into t
    from pg_trigger
   where tgrelid = 'public.project_access_grants'::regclass and tgname = 'project_access_grants_guard'
     and not tgisinternal;
  if not found or t.tgenabled <> 'O' or t.tgtype <> (1 | 2 | 8 | 16)
     or t.tgfoid <> 'app.guard_project_access_grant()'::regprocedure then
    raise exception '0099: project_access_grants_guard is not a BEFORE UPDATE OR DELETE row trigger on app.guard_project_access_grant() with default enablement';
  end if;
  if not exists (select 1 from pg_proc p
                  where p.oid = 'app.guard_project_access_grant()'::regprocedure
                    and not p.prosecdef and p.proconfig = array['search_path=""']) then
    raise exception '0099: app.guard_project_access_grant() is not an invoker with exactly search_path=""';
  end if;
  foreach r in array array['anon', 'authenticated', 'goproceed_app', 'goproceed_service', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r)
       and has_function_privilege(r, 'app.guard_project_access_grant()', 'EXECUTE') then
      raise exception '0099: % can execute app.guard_project_access_grant()', r;
    end if;
  end loop;
  -- 0096's column grant is unchanged.
  if has_table_privilege('goproceed_app', 'public.project_access_grants', 'UPDATE')
     or has_table_privilege('goproceed_app', 'public.project_access_grants', 'DELETE')
     or not has_column_privilege('goproceed_app', 'public.project_access_grants', 'revoked_at', 'UPDATE')
     or not has_column_privilege('goproceed_app', 'public.project_access_grants', 'version', 'UPDATE') then
    raise exception '0099: goproceed_app privileges on project_access_grants changed';
  end if;
end $$;
