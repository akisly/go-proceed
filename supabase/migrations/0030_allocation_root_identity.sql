-- 0030: corrections from the second adversarial pass on v0.1-M2-A.
--
-- Additive. Adds one generated column and two constraints, and restates two
-- policies to say what they actually require.

-- ---------------------------------------------------------------------------
-- 1. An allocation's root must be THIS fact's root.
--
-- 0025 required root_progress_entry_id to point at a root, using the literal
-- discriminator pattern. It did not require that root to be the root of the
-- progress entry being valued, so an adjustment could attach its money lineage
-- to a root belonging to another assignment or work item in the same workspace.
--
-- Every progress entry already knows its own root: itself when it is one, its
-- parent when it is an adjustment. Naming that makes the constraint expressible
-- as a foreign key instead of a rule the writer is trusted to follow.
-- ---------------------------------------------------------------------------
alter table public.progress_entries
  add column effective_root_id uuid
    generated always as (coalesce(root_progress_entry_id, id)) stored;

comment on column public.progress_entries.effective_root_id is
  'The root this fact belongs to: itself for a root, its parent for an '
  'adjustment. Exists so an allocation can be tied to the root of the exact '
  'fact it values rather than to any root in the workspace.';

alter table public.progress_entries
  add constraint progress_entries_effective_root_key
  unique (workspace_id, id, effective_root_id);

alter table public.valuation_allocations
  add constraint valuation_allocations_root_of_this_fact_fkey
  foreign key (workspace_id, progress_entry_id, root_progress_entry_id)
  references public.progress_entries (workspace_id, id, effective_root_id);

-- ---------------------------------------------------------------------------
-- 2. Policies state their real requirement.
--
-- va_insert asks for the progress capability, and ce_insert for the evidence
-- one, but each reaches its answer through an EXISTS over a table whose own
-- SELECT policy demands project.view or project.admin. The read capability was
-- therefore required in fact and stated nowhere: a member holding only
-- progress.record was denied by a policy that never mentions project.view, and
-- a change to an unrelated SELECT policy would silently move who can write.
--
-- The behaviour is correct — writing into a project you cannot see should fail
-- — so this makes the rule visible where it is enforced rather than changing
-- who is allowed.
-- ---------------------------------------------------------------------------
drop policy va_insert on public.valuation_allocations;
create policy va_insert on public.valuation_allocations for insert to aktflow_app
  with check (
    app.has_project_capability(workspace_id, project_id,
      array['project.view','project.admin'])
    and exists (
      select 1 from public.progress_entries p
       where p.workspace_id = valuation_allocations.workspace_id
         and p.id = valuation_allocations.progress_entry_id
         and app.has_project_capability(p.workspace_id, p.project_id,
               case p.entry_kind
                 when 'root' then array['progress.record']
                 else             array['progress.adjust']
               end)));

drop policy ce_insert on public.capture_events;
create policy ce_insert on public.capture_events for insert to aktflow_app
  with check (
    app.has_project_capability(workspace_id, project_id,
      array['project.view','project.admin'])
    and app.has_project_capability(workspace_id, project_id, array['evidence.record'])
    and (upload_intent_id is null or exists (
          select 1 from public.upload_intents u
           where u.workspace_id = capture_events.workspace_id
             and u.id = capture_events.upload_intent_id
             and u.project_id = capture_events.project_id
             and u.created_by_member_id = app.active_member_id(capture_events.workspace_id))));
