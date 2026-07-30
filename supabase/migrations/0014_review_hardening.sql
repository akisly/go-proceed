-- 0014: corrections from the post-implementation engineering review of v0.1-M1.
-- Additive: adds one helper and REPLACES policies created in 0011/0013. No
-- table, column, or constraint is dropped.
--
-- Rollback (dev only): drop app.member_role; recreate the 0011/0013 policy
-- bodies listed below. Forward fix (staging/prod): a further migration; never
-- edit this file after deploy.
--
-- Why: RLS was a no-op for CAPABILITY. Every write policy asked only "is the
-- actor an active member of this workspace?", so the second layer could not
-- catch a command-layer mistake. INV-020 in particular was enforced in one
-- place only (the own-profile route). These policies make the database agree
-- with app.workspaceCapabilities().

create or replace function app.member_role(ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select m.role from public.memberships m
   where m.organization_id = ws and m.user_id = app.current_actor()
     and m.status = 'active'
$$;
revoke all on function app.member_role(uuid) from public;
grant execute on function app.member_role(uuid) to aktflow_app;

-- ── invitations: governance action, owner/admin only ────────────────────────
drop policy inv_write on public.invitations;
create policy inv_write on public.invitations for insert to aktflow_app
  with check (app.member_role(workspace_id) in ('owner','admin'));
drop policy inv_update on public.invitations;
create policy inv_update on public.invitations for update to aktflow_app
  using (app.member_role(workspace_id) in ('owner','admin'))
  with check (app.member_role(workspace_id) in ('owner','admin'));

-- ── parties and legal profiles: parties.manage = owner/admin ────────────────
drop policy parties_insert on public.parties;
create policy parties_insert on public.parties for insert to aktflow_app
  with check (app.member_role(workspace_id) in ('owner','admin'));
drop policy parties_update on public.parties;
create policy parties_update on public.parties for update to aktflow_app
  using (app.member_role(workspace_id) in ('owner','admin'))
  with check (app.member_role(workspace_id) in ('owner','admin'));

drop policy plp_insert on public.party_legal_profiles;
create policy plp_insert on public.party_legal_profiles for insert to aktflow_app
  with check (app.member_role(workspace_id) in ('owner','admin'));
-- INV-020 at the RLS layer: an OWN legal entity's official attributes are
-- owner-only, because publish freezes them into an immutable contract-version
-- snapshot. Ordinary counterparties stay editable by admins.
drop policy plp_update on public.party_legal_profiles;
create policy plp_update on public.party_legal_profiles for update to aktflow_app
  using (
    case when exists (
      select 1 from public.own_legal_entity_profiles o
       where o.workspace_id = party_legal_profiles.workspace_id
         and o.party_id = party_legal_profiles.party_id)
    then app.member_role(workspace_id) = 'owner'
    else app.member_role(workspace_id) in ('owner','admin') end)
  with check (
    case when exists (
      select 1 from public.own_legal_entity_profiles o
       where o.workspace_id = party_legal_profiles.workspace_id
         and o.party_id = party_legal_profiles.party_id)
    then app.member_role(workspace_id) = 'owner'
    else app.member_role(workspace_id) in ('owner','admin') end);

-- ── own legal entity profiles: INV-020, owner only ──────────────────────────
drop policy olep_insert on public.own_legal_entity_profiles;
create policy olep_insert on public.own_legal_entity_profiles for insert to aktflow_app
  with check (app.member_role(workspace_id) = 'owner');

-- ── party contacts: parties.manage = owner/admin ────────────────────────────
drop policy pc_insert on public.party_contacts;
create policy pc_insert on public.party_contacts for insert to aktflow_app
  with check (app.member_role(workspace_id) in ('owner','admin'));
drop policy pc_update on public.party_contacts;
create policy pc_update on public.party_contacts for update to aktflow_app
  using (app.member_role(workspace_id) in ('owner','admin'))
  with check (app.member_role(workspace_id) in ('owner','admin'));

-- ── projects: projects.create = owner/admin ─────────────────────────────────
drop policy projects_insert on public.projects;
create policy projects_insert on public.projects for insert to aktflow_app
  with check (app.member_role(workspace_id) in ('owner','admin'));

-- ── unit definitions: units.manage = owner/admin ────────────────────────────
drop policy units_insert on public.unit_definitions;
create policy units_insert on public.unit_definitions for insert to aktflow_app
  with check (app.member_role(workspace_id) in ('owner','admin'));
drop policy units_update on public.unit_definitions;
create policy units_update on public.unit_definitions for update to aktflow_app
  using (app.member_role(workspace_id) in ('owner','admin'))
  with check (app.member_role(workspace_id) in ('owner','admin'));

-- ── locations: publish creates them from the mapped location column ─────────
drop policy locations_insert on public.locations;
create policy locations_insert on public.locations for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
    array['imports.manage','imports.publish','project.admin']));

-- ── resolutions: a lump-sum line has NO derived amount ──────────────────────
-- Storing 0 there would make the approval look like it was granted against a
-- computed zero, and the re-validation check (approved amounts must still match)
-- could never succeed for such a row. Relaxing NOT NULL is not destructive.
alter table public.source_amount_resolutions
  alter column derived_amount_minor_units drop not null;
