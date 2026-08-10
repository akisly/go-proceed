-- 0040: audit_events.project_id finally references a project, of the same tenant.
--
-- Additive. Adds one partial index and one constraint. No column changes, no
-- row is written, no object is dropped.
--
-- 0002 created audit_events with `project_id uuid` and no foreign key, because
-- public.projects did not exist yet, and left an instruction naming the exact
-- ALTER for whichever future migration created it. 0010 created
-- public.projects and did not run it. Nothing since has. So the column is an
-- unvalidated uuid that can name a project in another tenant, or no project
-- at all.
--
-- The ALTER 0002 named is itself not the right one, and copying it would be
-- the easy mistake here. It is single-column — `references public.projects(id)`
-- — which permits an audit row in tenant A to cite a project in tenant B.
-- Every cross-aggregate reference in this database is tenant-safe by
-- construction (docs/domain/domain-model.md: validated at write time by a
-- database-enforced invariant, with RLS as defence in depth), so the
-- constraint carries organization_id with it. public.projects (0010) declares
-- `unique (workspace_id, id)`, which is the target this needs, and spells its
-- tenant column workspace_id rather than organization_id — the two names refer
-- to the same tenant root.
--
-- MATCH SIMPLE is required, not incidental. project_id is nullable and most
-- audit rows have none: all 28 recordAudit call sites for workspace-scoped
-- commands pass NULL. Under MATCH SIMPLE a row with a NULL in any referencing
-- column satisfies the constraint, so those rows stay legal. MATCH FULL would
-- reject every one of them.
--
-- No referential action is declared, so the default NO ACTION applies. ON
-- DELETE CASCADE or SET NULL would have to DELETE or UPDATE an audit row, and
-- audit_events carries a BEFORE UPDATE OR DELETE trigger (0006) that raises
-- for the table owner too — the referential action would fail at run time
-- rather than at review time. NO ACTION means a project that is cited by audit
-- cannot be deleted, which is the correct behaviour for an append-only
-- accountability record.
--
-- Rollback:
--   alter table public.audit_events drop constraint audit_project_tenant_fk;
--   drop index public.audit_events_project_idx;

-- Not required by the constraint: Postgres only demands a unique index on the
-- REFERENCED side, and public.projects already declares unique (workspace_id,
-- id). This one serves the delete-time check on projects, which without it
-- scans audit_events. Partial, because the large majority of audit rows carry
-- no project and would only bloat it.
create index if not exists audit_events_project_idx
  on public.audit_events (organization_id, project_id)
  where project_id is not null;

-- Fail loudly and early rather than inside VALIDATE, so an operator gets the
-- offending rows instead of a constraint-violation message naming one.
do $$
declare
  orphan_count bigint;
begin
  select count(*) into orphan_count
  from public.audit_events a
  where a.project_id is not null
    and not exists (
      select 1 from public.projects p
      where p.id = a.project_id
        and p.workspace_id = a.organization_id
    );

  if orphan_count > 0 then
    raise exception
      '0040: % audit_events row(s) name a project that does not exist in their own tenant. '
      'audit_events is append-only (0006), so these cannot be repaired by UPDATE. '
      'Investigate before proceeding: select id, organization_id, project_id, action, occurred_at '
      'from public.audit_events a where a.project_id is not null and not exists '
      '(select 1 from public.projects p where p.id = a.project_id and p.workspace_id = a.organization_id);',
      orphan_count;
  end if;
end $$;

-- NOT VALID then VALIDATE: the ADD takes SHARE ROW EXCLUSIVE briefly and skips
-- the scan, and VALIDATE then runs under SHARE UPDATE EXCLUSIVE, which does not
-- block concurrent audit INSERTs. On an environment where audit_events has
-- grown large, split the VALIDATE into its own migration so it commits alone.
alter table public.audit_events
  add constraint audit_project_tenant_fk
  foreign key (organization_id, project_id)
  references public.projects (workspace_id, id)
  match simple
  not valid;

alter table public.audit_events
  validate constraint audit_project_tenant_fk;
