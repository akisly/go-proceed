-- 0006_foundation_tenant_isolation.sql
-- v0.0 gate 3 (docs/delivery/version-0.0.md): tenant isolation for
-- audit/idempotency/outbox, append-only audit, permission-aware legal
-- entities, serialized first-owner bootstrap. Additive only: no baseline
-- object is renamed or dropped.

-- 1) Append-only guard (design interface from technical/database/schema-v0.1.sql).
-- Lives in schema app (exists since 0003); rejects mutation even for the
-- table owner, so a widened grant alone can never rewrite history.
create or replace function app.reject_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only relation %.% cannot be % (correct via successor fact)',
    tg_table_schema, tg_table_name, lower(tg_op);
end $$;

create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function app.reject_mutation();

-- 2) RLS for the operational tables. Grants alone are not tenant-safe: the
-- BFF role could previously read/write any tenant's rows.
alter table public.audit_events enable row level security;
alter table public.idempotency_records enable row level security;
alter table public.transaction_outbox enable row level security;

-- audit: INSERT only, bound to an org the actor is an active member of.
-- The BFF never reads audit in v0.0; SELECT is revoked outright.
revoke select on public.audit_events from aktflow_app;
create policy audit_insert on public.audit_events for insert to aktflow_app
  with check (
    exists (select 1 from public.memberships m
            where m.organization_id = audit_events.organization_id
              and m.user_id = app.current_actor()
              and m.status = 'active'));

-- outbox: INSERT bound the same way; the app role may not enqueue for a
-- tenant the actor does not belong to, and never with a NULL org.
create policy outbox_insert on public.transaction_outbox for insert to aktflow_app
  with check (
    organization_id is not null
    and exists (select 1 from public.memberships m
                where m.organization_id = transaction_outbox.organization_id
                  and m.user_id = app.current_actor()
                  and m.status = 'active'));

-- idempotency: an actor sees and writes only its own actor_scope; when an
-- org is set it must be one the actor belongs to. Pre-workspace bootstrap
-- keeps organization_id NULL (unique nulls not distinct covers replay).
create policy idem_select on public.idempotency_records for select to aktflow_app
  using (actor_scope = 'user:' || app.current_actor()::text);
create policy idem_insert on public.idempotency_records for insert to aktflow_app
  with check (
    actor_scope = 'user:' || app.current_actor()::text
    and (organization_id is null
         or exists (select 1 from public.memberships m
                    where m.organization_id = idempotency_records.organization_id
                      and m.user_id = app.current_actor()
                      and m.status = 'active')));

-- 3) Permission-aware legal entities: replace the any-active-member policy
-- (0004) with a governance-role check. Additive-safe: policy replacement
-- does not change table shape.
drop policy le_insert on public.legal_entities;
create policy le_insert on public.legal_entities for insert to aktflow_app
  with check (exists (
    select 1 from public.memberships m
    where m.organization_id = legal_entities.organization_id
      and m.user_id = app.current_actor()
      and m.status = 'active'
      and m.role in ('owner','admin')));

-- 4) Serialized first-owner bootstrap. org_has_members takes a transaction
-- advisory lock keyed on the org BEFORE checking membership, so two
-- concurrent first-owner claims serialize: the loser waits for the winner's
-- commit, then sees the winner's row and fails the m_insert policy instead
-- of racing past it under READ COMMITTED.
create or replace function app.org_has_members(org uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('goproceed.bootstrap|' || org::text, 0));
  return exists (select 1 from public.memberships where organization_id = org);
end $$;
revoke all on function app.org_has_members(uuid) from public;
grant execute on function app.org_has_members(uuid) to aktflow_app;
