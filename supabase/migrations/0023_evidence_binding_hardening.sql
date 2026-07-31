-- 0023: corrections from the pre-landing review of v0.1-M2-A.
--
-- Additive. Adds constraints and replaces policies from 0015/0016/0018/0019.
-- Nothing is dropped, and 0015-0022 stay applied history.
--
-- One theme across all four findings: an invariant enforced only in a route is
-- not enforced. Migration 0014 exists in v0.1-M1 for exactly this reason, and
-- these are the same class of gap in the M2 surface.

-- ---------------------------------------------------------------------------
-- 1. A progress entry's work item must be the one its assignment names.
--
-- 0015 referenced the assignment by (workspace, project, assignment) and the
-- work item by (workspace, work_item), independently. Nothing tied the two: a
-- caller authorized in project A could append an immutable entry pairing
-- project A's assignment with project B's work item, and the valuation writer
-- sums by work_item_id, so project B's performed quantity would silently move.
-- ---------------------------------------------------------------------------
alter table public.work_assignments
  add constraint work_assignments_scope_work_item_key
  unique (workspace_id, project_id, id, work_item_id);

alter table public.progress_entries
  add constraint progress_entries_assignment_work_item_fkey
  foreign key (workspace_id, project_id, work_assignment_id, work_item_id)
  references public.work_assignments (workspace_id, project_id, id, work_item_id);

-- ---------------------------------------------------------------------------
-- 2. A pinned requirement template must be published, in the database and not
-- merely in the route.
--
-- The literal-discriminator trick already used for INV-023 in 0015: the
-- assignment carries a constant 'published' alongside the reference, and the
-- composite foreign key can only resolve against a row whose status matches.
-- Pinning a draft becomes unrepresentable rather than rejected in one place.
-- ---------------------------------------------------------------------------
alter table public.requirement_template_versions
  add constraint requirement_template_versions_status_key unique (workspace_id, id, status);

alter table public.work_assignments
  add column pinned_template_status text
    generated always as (case when requirement_template_version_id is null
                              then null else 'published' end) stored;

alter table public.work_assignments
  add constraint work_assignments_pinned_template_published_fkey
  foreign key (workspace_id, requirement_template_version_id, pinned_template_status)
  references public.requirement_template_versions (workspace_id, id, status);

-- A published template's media rules have to be usable without the reading
-- route defending itself: the upload gate does allowed_media.mimeTypes.includes,
-- which throws on a malformed shape and silently widens to the fallback when the
-- lookup returns nothing.
-- coalesce, not a bare comparison: jsonb_typeof returns NULL for an absent key,
-- and a CHECK that evaluates to NULL PASSES. Written the obvious way, this
-- constraint accepted `{}` — the very shape most likely to reach it.
alter table public.requirement_template_versions
  add constraint requirement_template_versions_allowed_media_check
  check (status = 'draft' or (
    coalesce(jsonb_typeof(allowed_media -> 'mimeTypes'), '') = 'array'
    and coalesce(jsonb_array_length(allowed_media -> 'mimeTypes'), 0) > 0
    and coalesce(jsonb_typeof(allowed_media -> 'maxByteSize'), '') = 'number'));

-- ---------------------------------------------------------------------------
-- 3. Evidence rows must agree with the upload intent they claim to come from.
--
-- 0016 let any session holding evidence.record insert an evidence_objects row
-- with an attacker-chosen hash, storage key, recorder and
-- inspection_status = 'passed'. The protocol was enforced entirely in the
-- finalize route, so a command-layer mistake or an injected query produced
-- permanent forged provenance instead of being contained.
--
-- The row must now name an intent in the same workspace and project, created by
-- the member being recorded as recorder, and must carry that intent's exact key
-- and expected hash. There is nothing left for the caller to choose.
-- ---------------------------------------------------------------------------
drop policy eo_insert on public.evidence_objects;
create policy eo_insert on public.evidence_objects for insert to aktflow_app
  with check (
    app.has_project_capability(workspace_id, project_id, array['evidence.record'])
    and upload_intent_id is not null
    and exists (
      select 1 from public.upload_intents u
       where u.workspace_id = evidence_objects.workspace_id
         and u.id = evidence_objects.upload_intent_id
         and u.project_id = evidence_objects.project_id
         and u.created_by_member_id = evidence_objects.recorder_member_id
         and u.staging_storage_key = evidence_objects.storage_key
         and u.staging_bucket = evidence_objects.storage_bucket
         and u.expected_content_hash = evidence_objects.content_hash
         and u.expected_byte_size = evidence_objects.byte_size));

-- Capture events bind to an intent the actor created. event_source itself stays
-- unenforceable: v0.1-M2-A has no service principal distinct from aktflow_app,
-- so the database cannot tell the server's own assertion from a member's. That
-- separation arrives with the service plane in the capability catalog and is
-- recorded in TODOS.md rather than pretended here.
drop policy ce_insert on public.capture_events;
create policy ce_insert on public.capture_events for insert to aktflow_app
  with check (
    app.has_project_capability(workspace_id, project_id, array['evidence.record'])
    and (upload_intent_id is null or exists (
          select 1 from public.upload_intents u
           where u.workspace_id = capture_events.workspace_id
             and u.id = capture_events.upload_intent_id
             and u.project_id = capture_events.project_id
             and u.created_by_member_id = app.active_member_id(capture_events.workspace_id))));

-- ---------------------------------------------------------------------------
-- 4. Upload intent state is writable, its identity is not.
--
-- 0019 narrowed the update grant but still exposed the storage key, the bucket
-- and the attempt counter, and its policy was project-wide rather than owner
-- scoped. A holder of evidence.record could retarget another member's intent at
-- a key of their choosing, or mark it available without any evidence.
-- ---------------------------------------------------------------------------
revoke update on public.upload_intents from aktflow_app;
grant update (status, finalized_evidence_object_id, failure_code, version)
  on public.upload_intents to aktflow_app;

drop policy ui_update on public.upload_intents;
create policy ui_update on public.upload_intents for update to aktflow_app
  using (created_by_member_id = app.active_member_id(workspace_id)
     and app.has_project_capability(workspace_id, project_id, array['evidence.record']))
  with check (created_by_member_id = app.active_member_id(workspace_id));
