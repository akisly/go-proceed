-- 0025: correction from the pre-landing review of v0.1-M2-A.
--
-- Additive. Adds constraints to public.valuation_allocations and replaces one
-- policy from 0016. Nothing is dropped.
--
-- Why: an allocation named a work item and a progress entry INDEPENDENTLY.
-- Nothing required them to be the same fact. A row could claim work item X,
-- progress entry Y from a different work item, a quantity unrelated to either,
-- and a root_progress_entry_id pointing at an adjustment. Because
-- (workspace_id, progress_entry_id) is unique, such a row also consumes the one
-- allocation slot that fact will ever have — permanently attaching arbitrary
-- money to it, with the append-only trigger preventing any repair.
--
-- Same class as the bindings in 0023: the writer got this right, and the
-- database took its word for it.

-- ---------------------------------------------------------------------------
-- One key ties the allocation to the exact progress fact: same workspace, same
-- project, same work item, and the SAME QUANTITY. An allocation that valued a
-- different amount of work than the fact records is now unrepresentable rather
-- than merely unwritten by the current route.
-- ---------------------------------------------------------------------------
alter table public.progress_entries
  add constraint progress_entries_valuation_scope_key
  unique (workspace_id, project_id, work_item_id, id, quantity);

alter table public.valuation_allocations
  add constraint valuation_allocations_progress_fact_fkey
  foreign key (workspace_id, project_id, work_item_id, progress_entry_id, quantity)
  references public.progress_entries
            (workspace_id, project_id, work_item_id, id, quantity);

-- ---------------------------------------------------------------------------
-- The root reference must be a root, by the same literal-discriminator pattern
-- 0015 uses for INV-023 and 0023 uses for template pinning. The writer always
-- supplies it, so the column becomes NOT NULL rather than staying optional and
-- unchecked.
-- ---------------------------------------------------------------------------
alter table public.valuation_allocations
  alter column root_progress_entry_id set not null;

alter table public.valuation_allocations
  add column root_is_root boolean not null default true
    check (root_is_root);

alter table public.valuation_allocations
  add constraint valuation_allocations_root_is_root_fkey
  foreign key (workspace_id, root_progress_entry_id, root_is_root)
  references public.progress_entries (workspace_id, id, is_root);

-- Funded quantity is the part of this slice that drew money, so it can never
-- exceed the slice, and it carries the slice's sign.
alter table public.valuation_allocations
  add constraint valuation_allocations_funded_within_quantity_check
  check (abs(funded_quantity) <= abs(quantity)
     and (funded_quantity = 0 or sign(funded_quantity) = sign(quantity)));

-- ---------------------------------------------------------------------------
-- The insert policy accepted EITHER progress capability regardless of what the
-- entry actually is, so progress.record alone could write an adjustment's
-- money. It now reads the entry kind, exactly as the progress_entries policy
-- does, and asks for the capability that matches.
-- ---------------------------------------------------------------------------
drop policy va_insert on public.valuation_allocations;
create policy va_insert on public.valuation_allocations for insert to aktflow_app
  with check (exists (
    select 1 from public.progress_entries p
     where p.workspace_id = valuation_allocations.workspace_id
       and p.id = valuation_allocations.progress_entry_id
       and app.has_project_capability(p.workspace_id, p.project_id,
             case p.entry_kind
               when 'root' then array['progress.record']
               else             array['progress.adjust']
             end)));
