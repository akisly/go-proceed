-- The responsibility that could not end (DEV-044, BL-015, ADR-014 decisions 2 and 3).
--
-- WHAT WAS WRONG. public.project_responsibility_assignments (0010) is an
-- append-only accountability fact: 0013 refuses UPDATE and DELETE on it through
-- app.reject_mutation, and the application role holds SELECT and INSERT only.
-- An assignment written without `valid_until` was therefore permanent, and the
-- separation-of-duties warnings the assign route computes (ADR-002) kept
-- counting a responsibility its holder no longer had. Nothing recorded that it
-- ended.
--
-- WHAT THIS CHANGES. One more append-only fact: the end of an assignment. It is
-- the shape 0045 gave requirement_exceptions, cut down to what an end needs —
-- a one-successor key (0045's requirement_exceptions_no_fork_key: here, at most
-- one end per assignment), a composite pin to the fact it closes (0045's
-- requirement_exceptions_chain_fkey: here, the assignment in the same workspace
-- and project), and app.reject_mutation reused as the guard beyond the grants.
-- No head and no ordinal: an assignment is ended once. `project_responsibilities.end`
-- writes one row per assignment of a (member, responsibility) pair that is live
-- or has not started, at the moment of the command (owner, 2026-09-23); an end
-- before an assignment's `valid_from` cancels it. The assignment row itself is
-- untouched, so its planned window stays in the accountability history
-- (docs/architecture/tenancy-and-security.md, «Project responsibilities»).
--
-- WHO MAY DO WHAT. Read: a member holding project.view or project.admin on the
-- project, or the holder of the ended assignment (the same audiences as
-- pra_select, 0011). Insert: a project administrator, as themselves, at the
-- transaction's time — `ended_at = now()` refuses a backdated or future end at
-- the database, not only in the route. The application role gets SELECT and
-- INSERT; nobody gets UPDATE or DELETE.
--
-- OUTSIDE ADR-006 DECISION 4'S LIST. The table joins its parent in the
-- workspace-access module, which the list's M1 row does not count (owner,
-- 2026-09-23; ADR-014 decision 3). It is tagged v0.1-M1 in the entity catalog.
--
-- Rollback (dev only): drop table public.project_responsibility_assignment_ends;
-- Forward fix (staging/prod): a corrective migration; never disable RLS in place.

create table public.project_responsibility_assignment_ends (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  assignment_id uuid not null,
  ended_by uuid not null references auth.users(id),
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint prae_workspace_id_key unique (workspace_id, id),
  -- One end per assignment: a second end, concurrent or not, is a 23505.
  constraint prae_one_end_per_assignment_key unique (workspace_id, assignment_id),
  constraint prae_project_fkey foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  -- The assignment must be of the same workspace AND the same project (INV-001):
  -- 0010's unique (workspace_id, project_id, id) on the assignments is the target.
  constraint prae_assignment_fkey foreign key (workspace_id, project_id, assignment_id)
    references public.project_responsibility_assignments (workspace_id, project_id, id)
);

create trigger project_responsibility_assignment_ends_immutable before update or delete
  on public.project_responsibility_assignment_ends
  for each row execute function app.reject_mutation();

-- ── grants allowlist ─────────────────────────────────────────────────────────
revoke all on public.project_responsibility_assignment_ends
  from public, anon, authenticated, service_role;
grant select, insert on public.project_responsibility_assignment_ends to goproceed_app;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.project_responsibility_assignment_ends enable row level security;

create policy prae_select on public.project_responsibility_assignment_ends
  for select to goproceed_app
  using (
    app.has_project_capability(workspace_id, project_id, array['project.view', 'project.admin'])
    or exists (
      select 1 from public.project_responsibility_assignments a
       where a.workspace_id = project_responsibility_assignment_ends.workspace_id
         and a.project_id = project_responsibility_assignment_ends.project_id
         and a.id = project_responsibility_assignment_ends.assignment_id
         and a.member_id = app.active_member_id(project_responsibility_assignment_ends.workspace_id)));

create policy prae_insert on public.project_responsibility_assignment_ends
  for insert to goproceed_app
  with check (
    app.has_project_capability(workspace_id, project_id, array['project.admin'])
    and ended_by = app.current_actor()
    and ended_at = now());

do $$
begin
  if has_table_privilege('goproceed_app', 'public.project_responsibility_assignment_ends', 'UPDATE')
     or has_table_privilege('goproceed_app', 'public.project_responsibility_assignment_ends', 'DELETE') then
    raise exception '0097: goproceed_app may not update or delete an end';
  end if;
end $$;
