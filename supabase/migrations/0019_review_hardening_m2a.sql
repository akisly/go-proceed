-- 0019: further corrections from the engineering review of the v0.1-M2-A
-- foundation, including findings raised by the outside voice.
--
-- Additive. 0015-0018 are applied history and are not edited.
--
-- Rollback (dev only): restore the prior FK and grants; drop the new uniques
-- and app.orphan_upload_intent.

-- ---------------------------------------------------------------------------
-- D5 — INV-023 was only half structural.
--
-- The 0015 foreign key was (workspace_id, root_progress_entry_id, root_is_root):
-- it makes a chain unrepresentable, but happily accepts a root belonging to a
-- DIFFERENT assignment or work item. The invariant text requires "the same
-- workspace assignment and work item", so the reference has to carry both.
-- ---------------------------------------------------------------------------
alter table public.progress_entries
  add constraint progress_entries_lineage_scope_key
  unique (workspace_id, work_assignment_id, work_item_id, id, is_root);

alter table public.progress_entries
  drop constraint progress_entries_root_is_root_fkey;

alter table public.progress_entries
  add constraint progress_entries_root_is_root_fkey
  foreign key (workspace_id, work_assignment_id, work_item_id,
               root_progress_entry_id, root_is_root)
  references public.progress_entries
            (workspace_id, work_assignment_id, work_item_id, id, is_root);

-- ---------------------------------------------------------------------------
-- D6 — storage keys were unique per workspace, not per bucket.
--
-- Both buckets are globally addressed, so a workspace-scoped unique let two
-- tenants record rows pointing at the same physical object. Whoever is
-- authorized on either row could then reach the other tenant's bytes.
-- ---------------------------------------------------------------------------
alter table public.evidence_objects
  add constraint evidence_objects_physical_key_key unique (storage_bucket, storage_key);
alter table public.upload_intents
  add constraint upload_intents_staging_key_key unique (staging_bucket, staging_storage_key);

-- ---------------------------------------------------------------------------
-- D2 — the upload_intents write surface was the whole row.
--
-- A column-wide UPDATE grant let a holder of evidence.record rewrite the
-- expected hash, the staging key, the creating member, the assignment, or the
-- finalized evidence pointer — every field the protocol's integrity rests on.
-- Only the state-machine columns are writable now; the identity and expectation
-- columns are fixed at issue time.
-- ---------------------------------------------------------------------------
revoke update on public.upload_intents from aktflow_app;
grant update (status, staging_bucket, staging_storage_key, staging_attempt,
              quota_reserved_bytes, finalized_evidence_object_id, failure_code, version)
  on public.upload_intents to aktflow_app;

-- ---------------------------------------------------------------------------
-- D2 (second half) — the revocation branch of INV-047 was unreachable.
--
-- ui_update requires evidence.record, but orphaning happens precisely BECAUSE
-- the caller just lost it. The transition therefore cannot go through the
-- ordinary policy; it gets a definer that self-authorizes on a fact revocation
-- cannot take away — being the member who created the intent — and that can
-- only ever move the row to orphaned_for_purge.
-- ---------------------------------------------------------------------------
create or replace function app.orphan_upload_intent(p_workspace uuid, p_intent uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_member uuid;
begin
  select created_by_member_id into v_member
    from public.upload_intents
   where workspace_id = p_workspace and id = p_intent
     and status in ('intent_authorized','staged','integrity_verified','scan_pending');

  if v_member is null then
    raise exception 'no orphanable upload intent';
  end if;

  -- Active membership, not the project capability: the capability is what was
  -- just revoked. An unrelated member of the same workspace still cannot orphan
  -- somebody else's intent.
  if v_member is distinct from app.active_member_id(p_workspace) then
    raise exception 'not authorized to orphan this upload intent';
  end if;

  update public.upload_intents
     set status = 'orphaned_for_purge', failure_code = 'authorization_revoked',
         version = version + 1
   where workspace_id = p_workspace and id = p_intent;
end $$;
revoke all on function app.orphan_upload_intent(uuid, uuid) from public;
grant execute on function app.orphan_upload_intent(uuid, uuid) to aktflow_app;
