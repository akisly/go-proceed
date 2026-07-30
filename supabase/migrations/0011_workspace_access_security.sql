-- 0011: grants + RLS for the workspace-access module, membership helpers, and
-- the invitation-accept security-definer command.
-- Rollback (dev only): drop policies/functions created here; revoke the grants.
-- Forward fix (staging/prod): corrective migration; never disable RLS in place.

-- ── helper functions ─────────────────────────────────────────────────────────
-- Both helpers are SECURITY DEFINER (same sanctioned pattern as
-- app.org_has_members): they are consulted from RLS policies on the very
-- tables they read (memberships, project_access_grants), which would
-- otherwise recurse infinitely. Each is bounded to the CURRENT actor via
-- app.current_actor() and validates the full tenant chain internally, so no
-- cross-tenant row is reachable through them.
create or replace function app.active_member_id(ws uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m.id from public.memberships m
   where m.organization_id = ws and m.user_id = app.current_actor()
     and m.status = 'active'
$$;

create or replace function app.has_project_capability(ws uuid, proj uuid, caps text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.memberships m
      join public.project_access_grants g
        on g.workspace_id = m.organization_id and g.member_id = m.id
     where m.organization_id = ws and m.user_id = app.current_actor()
       and m.status = 'active'
       and g.project_id = proj and g.capability = any(caps)
       and g.revoked_at is null and g.valid_from <= now()
       and (g.valid_until is null or g.valid_until > now()))
$$;

-- 0009 deny-by-default strips automatic EXECUTE from every new function, so
-- RLS helper functions need explicit grants to be callable from policies
-- evaluated as aktflow_app.
revoke all on function app.active_member_id(uuid) from public;
grant execute on function app.active_member_id(uuid) to aktflow_app;
revoke all on function app.has_project_capability(uuid, uuid, text[]) from public;
grant execute on function app.has_project_capability(uuid, uuid, text[]) to aktflow_app;

-- SECURITY DEFINER (like app.org_has_members): the creator's very first grant
-- insert must pass RLS before any project.admin grant exists.
create or replace function app.project_has_grants(ws uuid, proj uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_access_grants
                  where workspace_id = ws and project_id = proj)
$$;
revoke all on function app.project_has_grants(uuid, uuid) from public;
grant execute on function app.project_has_grants(uuid, uuid) to aktflow_app;

-- ── grants allowlist ─────────────────────────────────────────────────────────
revoke all on public.invitations, public.parties, public.party_legal_profiles,
  public.own_legal_entity_profiles, public.party_contacts, public.projects,
  public.project_parties, public.project_access_grants,
  public.project_responsibility_assignments
  from public, anon, authenticated;

grant select, insert, update on public.invitations to aktflow_app;
grant select, insert, update on public.parties to aktflow_app;
grant select, insert, update on public.party_legal_profiles to aktflow_app;
grant select, insert on public.own_legal_entity_profiles to aktflow_app;
grant select, insert, update on public.party_contacts to aktflow_app;
grant select, insert, update on public.projects to aktflow_app;
grant select, insert, update on public.project_parties to aktflow_app;
grant select, insert, update on public.project_access_grants to aktflow_app;
grant select, insert on public.project_responsibility_assignments to aktflow_app;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.invitations enable row level security;
alter table public.parties enable row level security;
alter table public.party_legal_profiles enable row level security;
alter table public.own_legal_entity_profiles enable row level security;
alter table public.party_contacts enable row level security;
alter table public.projects enable row level security;
alter table public.project_parties enable row level security;
alter table public.project_access_grants enable row level security;
alter table public.project_responsibility_assignments enable row level security;

-- Workspace-scoped tables: active membership in that workspace.
create policy inv_select on public.invitations for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy inv_write on public.invitations for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy inv_update on public.invitations for update to aktflow_app
  using (app.active_member_id(workspace_id) is not null)
  with check (app.active_member_id(workspace_id) is not null);

create policy parties_select on public.parties for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy parties_insert on public.parties for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy parties_update on public.parties for update to aktflow_app
  using (app.active_member_id(workspace_id) is not null)
  with check (app.active_member_id(workspace_id) is not null);

create policy plp_select on public.party_legal_profiles for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy plp_insert on public.party_legal_profiles for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy plp_update on public.party_legal_profiles for update to aktflow_app
  using (app.active_member_id(workspace_id) is not null)
  with check (app.active_member_id(workspace_id) is not null);

create policy olep_select on public.own_legal_entity_profiles for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy olep_insert on public.own_legal_entity_profiles for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);

create policy pc_select on public.party_contacts for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
create policy pc_insert on public.party_contacts for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy pc_update on public.party_contacts for update to aktflow_app
  using (app.active_member_id(workspace_id) is not null)
  with check (app.active_member_id(workspace_id) is not null);

-- Projects: SELECT needs an explicit visibility grant (plan decision 6); INSERT
-- needs an active membership (the projects.create capability check runs in the
-- command layer).
create policy projects_select on public.projects for select to aktflow_app
  using (app.has_project_capability(workspace_id, id, array['project.view','project.admin']));
create policy projects_insert on public.projects for insert to aktflow_app
  with check (app.active_member_id(workspace_id) is not null);
create policy projects_update on public.projects for update to aktflow_app
  using (app.has_project_capability(workspace_id, id, array['project.admin']))
  with check (app.has_project_capability(workspace_id, id, array['project.admin']));

create policy pp_select on public.project_parties for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.view','project.admin']));
create policy pp_write on public.project_parties for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));
create policy pp_update on public.project_parties for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.admin']))
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));

-- Access grants: visible to project admins and to the grantee; writable by a
-- project admin, or by the project creator's bootstrap insert when the project
-- has no grants yet (mirrors the v0.0 owner-bootstrap pattern).
create policy pag_select on public.project_access_grants for select to aktflow_app
  using (
    app.has_project_capability(workspace_id, project_id, array['project.admin'])
    or member_id = app.active_member_id(workspace_id));
create policy pag_insert on public.project_access_grants for insert to aktflow_app
  with check (
    app.has_project_capability(workspace_id, project_id, array['project.admin'])
    or (member_id = app.active_member_id(workspace_id)
        and not app.project_has_grants(workspace_id, project_id)));
create policy pag_update on public.project_access_grants for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['project.admin']))
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));

create policy pra_select on public.project_responsibility_assignments for select to aktflow_app
  using (
    app.has_project_capability(workspace_id, project_id, array['project.view','project.admin'])
    or member_id = app.active_member_id(workspace_id));
create policy pra_insert on public.project_responsibility_assignments for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));

-- Members of a workspace may list the workspace's memberships (members.list).
-- Additive second SELECT policy; the v0.0 own-row policy remains.
create policy m_select_workspace on public.memberships for select to aktflow_app
  using (app.active_member_id(memberships.organization_id) is not null);

-- ── invitation accept (SECURITY DEFINER command) ─────────────────────────────
create or replace function app.accept_invitation(p_token_hash text)
returns table (workspace_id uuid, membership_id uuid, member_role text)
language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations%rowtype;
  new_membership uuid;
begin
  if app.current_actor() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select * into inv from public.invitations i
   where i.token_hash = p_token_hash and i.status = 'pending'
   for update;
  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;
  if inv.expires_at <= now() then
    update public.invitations
       set status = 'expired', updated_at = now(), version = version + 1
     where id = inv.id;
    raise exception 'INVITATION_NOT_FOUND'; -- existence-safe: expired == invalid
  end if;
  if exists (select 1 from public.memberships m
              where m.organization_id = inv.workspace_id
                and m.user_id = app.current_actor()) then
    raise exception 'ALREADY_MEMBER';
  end if;
  insert into public.memberships (organization_id, user_id, role, status, all_projects)
  values (inv.workspace_id, app.current_actor(), inv.role, 'active', false)
  returning id into new_membership;
  update public.invitations
     set status = 'accepted', accepted_membership_id = new_membership,
         updated_at = now(), version = version + 1
   where id = inv.id;
  return query select inv.workspace_id, new_membership, inv.role;
end $$;
revoke all on function app.accept_invitation(text) from public;
grant execute on function app.accept_invitation(text) to aktflow_app;
