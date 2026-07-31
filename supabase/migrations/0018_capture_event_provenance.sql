-- 0018: correction from the engineering review of the v0.1-M2-A foundation.
--
-- Additive. Tightens one column and replaces the two capture_events policies
-- created in 0016. 0016 is applied history and is not edited.
--
-- Why: capture_events.project_id was nullable, and 0016's insert policy only
-- demanded the evidence capability when project_id was present. A member
-- holding nothing but project.view could therefore append a capture event with
-- project_id NULL — including one carrying event_source = 'server' and bound to
-- an upload intent they cannot see. capture_events are append-only provenance
-- facts, so a forged row is permanent and pollutes the receipt history the
-- mobile client (M2-B) reconciles against.
--
-- Demonstrated in packages/testing/src/m2-policy-gaps.test.ts.
--
-- project_id becomes NOT NULL rather than the policy merely handling the NULL
-- case: every M2-A writer already knows the project, and an optional tenant
-- coordinate on a security-relevant row is a standing invitation to this bug.
-- technical/database/schema-v0.1.sql leaves it nullable; this is a deliberate
-- tightening, recorded here so the divergence is not mistaken for drift.
--
-- Rollback (dev only): re-widen the column and restore the 0016 policy bodies.

alter table public.capture_events alter column project_id set not null;

drop policy ce_select on public.capture_events;
create policy ce_select on public.capture_events for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));

drop policy ce_insert on public.capture_events;
create policy ce_insert on public.capture_events for insert to aktflow_app
  with check (
    app.has_project_capability(workspace_id, project_id, array['evidence.record'])
    -- A capture event bound to an intent must agree with that intent's project,
    -- so the capability check cannot be satisfied against some other project the
    -- member happens to hold evidence.record on.
    and (upload_intent_id is null or exists (
          select 1 from public.upload_intents u
           where u.workspace_id = capture_events.workspace_id
             and u.id = capture_events.upload_intent_id
             and u.project_id = capture_events.project_id)));
