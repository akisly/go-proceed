-- RLS policies for tenant-scoped tables + api.me_context read projection.

alter table public.organizations enable row level security;
alter table public.legal_entities enable row level security;
alter table public.memberships enable row level security;

-- organizations: readable only if the actor has a membership; insertable by any authenticated actor (bootstrap)
create policy org_select on public.organizations for select to aktflow_app
  using (exists (
    select 1 from public.memberships m
    where m.organization_id = organizations.id
      and m.user_id = app.current_actor()
      and m.status = 'active'));
create policy org_insert on public.organizations for insert to aktflow_app
  with check (app.current_actor() is not null);

-- legal_entities: same-org membership
create policy le_select on public.legal_entities for select to aktflow_app
  using (exists (
    select 1 from public.memberships m
    where m.organization_id = legal_entities.organization_id
      and m.user_id = app.current_actor() and m.status = 'active'));
-- A legal entity is never a bootstrap target: it always belongs to an existing org
-- the actor must be an active member of. Without this check any actor could inject
-- rows into another tenant's org (cross-tenant data injection).
create policy le_insert on public.legal_entities for insert to aktflow_app
  with check (exists (
    select 1 from public.memberships m
    where m.organization_id = legal_entities.organization_id
      and m.user_id = app.current_actor() and m.status = 'active'));

-- memberships: an actor sees only their own membership rows; during bootstrap may insert their own owner row
create policy m_select on public.memberships for select to aktflow_app
  using (user_id = app.current_actor());
create policy m_insert on public.memberships for insert to aktflow_app
  with check (
    user_id = app.current_actor()
    and role = 'owner'
    and not app.org_has_members(memberships.organization_id));

-- read projection for GET /v1/me/context
create view api.me_context as
  select m.user_id, m.organization_id, o.display_name, m.role, m.status, m.version as membership_version
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = app.current_actor() and m.status = 'active';
grant select on api.me_context to aktflow_app;
