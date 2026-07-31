-- 0016: grants, RLS, append-only enforcement and the reservation invariant for
-- the v0.1-M2-A execution and evidence module.
--
-- Additive. Reuses app.reject_mutation (0013), app.has_project_capability and
-- app.active_member_id (0011), and app.member_role (0014).
--
-- Functions live in schema `app`, not `app_private`: this database has no
-- app_private schema, and technical/database/schema-v0.1.sql's naming was
-- written before M1 was built. Consistency with the realized codebase wins.
--
-- Rollback (dev only): drop the policies and triggers below, drop
-- app.assert_reservation_invariant and app.open_allocation_head, restore the
-- prior project_access_grants capability check, revoke the grants.

-- ---------------------------------------------------------------------------
-- The database's capability vocabulary must grow with app.ProjectCapability,
-- or no M2 grant can be written at all. The check constraint in 0010 predates
-- these four capabilities.
-- ---------------------------------------------------------------------------
alter table public.project_access_grants
  drop constraint project_access_grants_capability_check;
alter table public.project_access_grants
  add constraint project_access_grants_capability_check
  check (capability = any (array[
    'project.admin','project.view','contracts.edit','imports.manage','imports.publish',
    'assignments.manage','progress.record','progress.adjust','evidence.record']));

-- ---------------------------------------------------------------------------
-- Grants allowlist. UPDATE is granted only where a state machine needs it:
-- work_assignments (status/version) and upload_intents. The append-only
-- relations get select+insert, and progress_allocation_heads gets select only —
-- it is maintained by the SECURITY DEFINER commands below, so a route cannot
-- move a balance by writing the projection directly.
-- ---------------------------------------------------------------------------
revoke all on public.requirement_template_versions, public.work_assignments,
  public.progress_entries, public.progress_allocation_heads,
  public.valuation_allocations, public.upload_intents, public.capture_events,
  public.evidence_objects
  from public, anon, authenticated;

grant select, insert, update on public.requirement_template_versions to aktflow_app;
grant select, insert, update on public.work_assignments  to aktflow_app;
grant select, insert         on public.progress_entries  to aktflow_app;
grant select                 on public.progress_allocation_heads to aktflow_app;
grant select, insert         on public.valuation_allocations to aktflow_app;
grant select, insert, update on public.upload_intents    to aktflow_app;
grant select, insert         on public.capture_events    to aktflow_app;
grant select, insert         on public.evidence_objects  to aktflow_app;

-- ---------------------------------------------------------------------------
-- Append-only / immutability triggers: the second layer beyond grants.
-- ---------------------------------------------------------------------------
create trigger progress_entries_immutable before update or delete
  on public.progress_entries for each row execute function app.reject_mutation();
create trigger valuation_allocations_immutable before update or delete
  on public.valuation_allocations for each row execute function app.reject_mutation();
create trigger capture_events_immutable before update or delete
  on public.capture_events for each row execute function app.reject_mutation();
create trigger evidence_objects_immutable before update or delete
  on public.evidence_objects for each row execute function app.reject_mutation();

-- INV-015: a published template version is frozen. A draft may advance to
-- published, but that transition must not alter the content the hash covers.
create or replace function app.guard_template_version() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'requirement template versions are not deletable';
  end if;
  if old.status = 'published' then
    raise exception 'published requirement template version % is immutable', old.id;
  end if;
  if new.status = 'published' and (
       new.evidence_type is distinct from old.evidence_type
    or new.allowed_media is distinct from old.allowed_media
    or new.multiplicity  is distinct from old.multiplicity
    or new.severity      is distinct from old.severity
    or new.template_key  is distinct from old.template_key
    or new.version_no    is distinct from old.version_no) then
    raise exception 'publishing must not alter frozen template content';
  end if;
  return new;
end $$;
revoke all on function app.guard_template_version() from public;

create trigger requirement_template_versions_guard before update or delete
  on public.requirement_template_versions
  for each row execute function app.guard_template_version();

-- ---------------------------------------------------------------------------
-- RLS. Write policies name the capability the route checks. Migration 0014
-- exists because M1's write policies asked only for active membership, so the
-- database could not catch a command-layer mistake; that must not recur here.
-- ---------------------------------------------------------------------------
alter table public.requirement_template_versions enable row level security;
alter table public.work_assignments              enable row level security;
alter table public.progress_entries              enable row level security;
alter table public.progress_allocation_heads     enable row level security;
alter table public.valuation_allocations         enable row level security;
alter table public.upload_intents                enable row level security;
alter table public.capture_events                enable row level security;
alter table public.evidence_objects              enable row level security;

-- Requirement templates are workspace-scoped governance: owner/admin write,
-- any active member reads (assignments across projects pin them).
create policy rtv_select on public.requirement_template_versions for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy rtv_insert on public.requirement_template_versions for insert to aktflow_app
  with check (app.member_role(workspace_id) in ('owner','admin'));
create policy rtv_update on public.requirement_template_versions for update to aktflow_app
  using (app.member_role(workspace_id) in ('owner','admin'))
  with check (app.member_role(workspace_id) in ('owner','admin'));

create policy wa_select on public.work_assignments for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy wa_insert on public.work_assignments for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['assignments.manage']));
create policy wa_update on public.work_assignments for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['assignments.manage']))
  with check (app.has_project_capability(workspace_id, project_id, array['assignments.manage']));

-- A root needs progress.record; an adjustment needs progress.adjust. The
-- distinction is in the capability catalog, so the database honours it too.
create policy pe_select on public.progress_entries for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy pe_insert on public.progress_entries for insert to aktflow_app
  with check (case entry_kind
    when 'root' then app.has_project_capability(workspace_id, project_id,
                       array['progress.record'])
    else             app.has_project_capability(workspace_id, project_id,
                       array['progress.adjust'])
  end);

create policy pah_select on public.progress_allocation_heads for select to aktflow_app
  using (exists (select 1 from public.progress_entries p
                  where p.workspace_id = progress_allocation_heads.workspace_id
                    and p.id = progress_allocation_heads.root_progress_entry_id
                    and app.has_project_capability(p.workspace_id, p.project_id,
                          array['project.view','project.admin'])));

create policy va_select on public.valuation_allocations for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy va_insert on public.valuation_allocations for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['progress.record','progress.adjust']));

create policy ui_select on public.upload_intents for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy ui_insert on public.upload_intents for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['evidence.record']));
create policy ui_update on public.upload_intents for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['evidence.record']))
  with check (app.has_project_capability(workspace_id, project_id, array['evidence.record']));

create policy eo_select on public.evidence_objects for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
create policy eo_insert on public.evidence_objects for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['evidence.record']));

-- capture_events carry a nullable project_id (a device may report before the
-- intent resolves), so the tenant boundary is membership plus, where the
-- project is known, the evidence capability.
create policy ce_select on public.capture_events for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null
     and (project_id is null
          or app.has_project_capability(workspace_id, project_id,
                array['project.view','project.admin'])));
create policy ce_insert on public.capture_events for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null
          and (project_id is null
               or app.has_project_capability(workspace_id, project_id,
                     array['evidence.record'])));

-- ---------------------------------------------------------------------------
-- Allocation head commands.
--
-- technical/database/schema-v0.1.sql:1795 declares
-- assert_reservation_invariant as a design interface whose body raises
-- 'design interface: implemented by v0.1 migrations'. This is that
-- implementation.
-- ---------------------------------------------------------------------------
create or replace function app.open_allocation_head(
  p_workspace uuid, p_root uuid, p_quantity numeric) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.progress_allocation_heads
    (workspace_id, root_progress_entry_id, effective_quantity)
  values (p_workspace, p_root, p_quantity)
  on conflict (workspace_id, root_progress_entry_id) do nothing;
end $$;
revoke all on function app.open_allocation_head(uuid, uuid, numeric) from public;
grant execute on function app.open_allocation_head(uuid, uuid, numeric) to aktflow_app;

create or replace function app.assert_reservation_invariant(
  p_workspace uuid, p_root_progress_entry uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_effective numeric(20,6);
  v_reserved  numeric(20,6);
begin
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
