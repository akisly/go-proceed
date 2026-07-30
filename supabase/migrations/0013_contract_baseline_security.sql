-- 0013: grants + RLS + immutability/append-only enforcement for the
-- contract-baseline module. Mirrors 0006's audit append-only trigger pattern.
-- Rollback (dev only): drop policies + triggers + app.reject_mutation, revoke grants.

create or replace function app.reject_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is immutable (append-only relation)', tg_table_name;
end $$;

-- ── grants allowlist ─────────────────────────────────────────────────────────
revoke all on public.unit_definitions, public.locations, public.contracts,
  public.contract_versions, public.work_items, public.import_batches,
  public.import_files, public.import_row_results, public.source_amount_resolutions
  from public, anon, authenticated;

grant select, insert, update on public.unit_definitions to aktflow_app;
grant select, insert, update on public.locations to aktflow_app;
grant select, insert, update on public.contracts to aktflow_app;
grant select, insert on public.contract_versions to aktflow_app;
grant select, insert on public.work_items to aktflow_app;
grant select, insert, update on public.import_batches to aktflow_app;
grant select, insert on public.import_files to aktflow_app;
grant select, insert on public.import_row_results to aktflow_app;
grant select, insert on public.source_amount_resolutions to aktflow_app;

-- ── immutability / append-only triggers (second layer beyond grants) ─────────
create trigger contract_versions_immutable before update or delete
  on public.contract_versions for each row execute function app.reject_mutation();
create trigger work_items_immutable before update or delete
  on public.work_items for each row execute function app.reject_mutation();
create trigger import_files_immutable before update or delete
  on public.import_files for each row execute function app.reject_mutation();
create trigger import_row_results_immutable before update or delete
  on public.import_row_results for each row execute function app.reject_mutation();
create trigger source_amount_resolutions_immutable before update or delete
  on public.source_amount_resolutions for each row execute function app.reject_mutation();
create trigger project_responsibility_assignments_immutable before update or delete
  on public.project_responsibility_assignments for each row execute function app.reject_mutation();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.unit_definitions enable row level security;
alter table public.locations enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_versions enable row level security;
alter table public.work_items enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_files enable row level security;
alter table public.import_row_results enable row level security;
alter table public.source_amount_resolutions enable row level security;

-- Workspace-scoped units: any active member reads; writes are capability-checked
-- in the command layer (units.manage), RLS provides the tenant boundary.
create policy units_select on public.unit_definitions for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy units_insert on public.unit_definitions for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy units_update on public.unit_definitions for update to aktflow_app
  using (app.active_member_id(workspace_id) is not null)
  with check (app.active_member_id(workspace_id) is not null);

create policy locations_select on public.locations for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy locations_insert on public.locations for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['imports.manage','project.admin']));
create policy locations_update on public.locations for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.admin']))
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));

create policy contracts_select on public.contracts for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy contracts_insert on public.contracts for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['contracts.edit']));
create policy contracts_update on public.contracts for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['contracts.edit']))
  with check (app.has_project_capability(workspace_id, project_id, array['contracts.edit']));

create policy cv_select on public.contract_versions for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy cv_insert on public.contract_versions for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['imports.publish']));

create policy wi_select on public.work_items for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy wi_insert on public.work_items for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['imports.publish']));

create policy ib_select on public.import_batches for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy ib_insert on public.import_batches for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['imports.manage']));
create policy ib_update on public.import_batches for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['imports.manage','imports.publish']))
  with check (app.has_project_capability(workspace_id, project_id, array['imports.manage','imports.publish']));

-- import_files/row_results/resolutions are batch-scoped: derive project via the
-- batch row (workspace-leading index path; the subquery is per-statement).
create policy if_select on public.import_files for select to aktflow_app
  using (exists (select 1 from public.import_batches b
                  where b.workspace_id = import_files.workspace_id
                    and b.id = import_files.import_batch_id
                    and app.has_project_capability(b.workspace_id, b.project_id,
                          array['project.view','project.admin'])));
create policy if_insert on public.import_files for insert to aktflow_app
  with check (exists (select 1 from public.import_batches b
                       where b.workspace_id = import_files.workspace_id
                         and b.id = import_files.import_batch_id
                         and app.has_project_capability(b.workspace_id, b.project_id,
                               array['imports.manage'])));

create policy irr_select on public.import_row_results for select to aktflow_app
  using (exists (select 1 from public.import_batches b
                  where b.workspace_id = import_row_results.workspace_id
                    and b.id = import_row_results.import_batch_id
                    and app.has_project_capability(b.workspace_id, b.project_id,
                          array['project.view','project.admin'])));
create policy irr_insert on public.import_row_results for insert to aktflow_app
  with check (exists (select 1 from public.import_batches b
                       where b.workspace_id = import_row_results.workspace_id
                         and b.id = import_row_results.import_batch_id
                         and app.has_project_capability(b.workspace_id, b.project_id,
                               array['imports.manage'])));

create policy sar_select on public.source_amount_resolutions for select to aktflow_app
  using (exists (select 1 from public.import_batches b
                  where b.workspace_id = source_amount_resolutions.workspace_id
                    and b.id = source_amount_resolutions.import_batch_id
                    and app.has_project_capability(b.workspace_id, b.project_id,
                          array['project.view','project.admin'])));
create policy sar_insert on public.source_amount_resolutions for insert to aktflow_app
  with check (exists (select 1 from public.import_batches b
                       where b.workspace_id = source_amount_resolutions.workspace_id
                         and b.id = source_amount_resolutions.import_batch_id
                         and app.has_project_capability(b.workspace_id, b.project_id,
                               array['imports.manage'])));
