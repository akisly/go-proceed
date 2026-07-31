-- 0017: correction from the engineering review of the v0.1-M2-A foundation.
--
-- Additive. Replaces the two SECURITY DEFINER functions created in 0016. No
-- table, column, or constraint is dropped. 0016 is applied history and is not
-- edited.
--
-- Why: both functions took p_workspace from the caller and never resolved the
-- actor. SECURITY DEFINER bypasses RLS, and EXECUTE was granted to aktflow_app,
-- so ANY authenticated member could operate on ANY workspace's allocation head.
-- Demonstrated, not theorised: a member of workspace B planted a head row in
-- workspace A with effective_quantity 999999
-- (packages/testing/src/m2-definer-authz.test.ts).
--
-- The head gates reservation in M4, so a planted balance is a future overclaim
-- vector, and assert_reservation_invariant's raise messages leaked another
-- tenant's effective and reserved quantities.
--
-- 0011:11 already documented the safe pattern for this codebase: a definer
-- "uses app.current_actor() and validates the full tenant chain internally".
-- These two functions are now the only M2 definers, and they follow it.
--
-- Rollback (dev only): restore the 0016 bodies. Forward fix: a further
-- migration; never edit this file after deploy.

-- The 3-argument form let the caller assert the opening balance. A head's
-- opening quantity is a fact recorded in progress_entries, not an argument, so
-- the parameter is removed rather than merely validated.
drop function if exists app.open_allocation_head(uuid, uuid, numeric);

create or replace function app.open_allocation_head(p_workspace uuid, p_root uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_project  uuid;
  v_quantity numeric(20,6);
begin
  -- Resolve the root from the database. entry_kind = 'root' is part of the
  -- lookup so an adjustment id can never open a head.
  select p.project_id, p.quantity into v_project, v_quantity
    from public.progress_entries p
   where p.workspace_id = p_workspace and p.id = p_root and p.entry_kind = 'root';

  if v_project is null then
    raise exception 'unknown root progress entry';
  end if;

  -- SECURITY DEFINER bypasses RLS, so authorization is this function's job.
  if not app.has_project_capability(p_workspace, v_project, array['progress.record']) then
    raise exception 'not authorized to open an allocation head for this project';
  end if;

  insert into public.progress_allocation_heads
    (workspace_id, root_progress_entry_id, effective_quantity)
  values (p_workspace, p_root, v_quantity)
  on conflict (workspace_id, root_progress_entry_id) do nothing;
end $$;
revoke all on function app.open_allocation_head(uuid, uuid) from public;
grant execute on function app.open_allocation_head(uuid, uuid) to aktflow_app;

create or replace function app.assert_reservation_invariant(
  p_workspace uuid, p_root_progress_entry uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_project   uuid;
  v_effective numeric(20,6);
  v_reserved  numeric(20,6);
begin
  select p.project_id into v_project
    from public.progress_entries p
   where p.workspace_id = p_workspace and p.id = p_root_progress_entry
     and p.entry_kind = 'root';

  if v_project is null then
    raise exception 'unknown root progress entry';
  end if;

  -- Authorize BEFORE any balance is read, so an unauthorized caller cannot use
  -- the raise messages below as a cross-tenant oracle for another workspace's
  -- effective and reserved quantities.
  if not app.has_project_capability(p_workspace, v_project,
                                    array['progress.record','progress.adjust']) then
    raise exception 'not authorized to advance the allocation head for this project';
  end if;

  -- The caller must already hold the allocation head lock. Effective quantity is
  -- RECOMPUTED from the entries rather than trusted from the projection, so the
  -- route's arithmetic and the database's can never diverge silently.
  select coalesce(sum(quantity), 0) into v_effective
    from public.progress_entries
   where workspace_id = p_workspace
     and (id = p_root_progress_entry or root_progress_entry_id = p_root_progress_entry);

  select reserved_quantity into v_reserved
    from public.progress_allocation_heads
   where workspace_id = p_workspace and root_progress_entry_id = p_root_progress_entry;

  if v_effective < 0 then
    raise exception 'INV-024: effective quantity % is negative for root %',
      v_effective, p_root_progress_entry;
  end if;
  if v_reserved is not null and (v_reserved < 0 or v_reserved > v_effective) then
    raise exception 'INV-025: reserved % outside [0, %] for root %',
      v_reserved, v_effective, p_root_progress_entry;
  end if;

  update public.progress_allocation_heads
     set effective_quantity = v_effective, version = version + 1, updated_at = now()
   where workspace_id = p_workspace and root_progress_entry_id = p_root_progress_entry;
end $$;
revoke all on function app.assert_reservation_invariant(uuid, uuid) from public;
grant execute on function app.assert_reservation_invariant(uuid, uuid) to aktflow_app;
