-- 0044: the capability the dry run needs, and the shape the media gate reads
--       (v0.1-M2, application-layer slice).
--
-- THE NUMBER. 0041, 0042 and 0043 are taken. 0043 is the M2 schema migration
-- (public.work_stages, public.requirement_occurrences); this file is the small
-- second half its own header names as owed by «the slice that ships
-- requirement_occurrences.dry_run» and «the slice that moves the read»
-- (0043:976-986 and 0043:243-248). It ships with the routes, not before them.
--
-- WHAT THIS ADDS
--   1. one value in the project-capability CHECK on public.project_access_grants:
--      'requirements.assign';
--   2. one CHECK on public.requirement_rule_versions.allowed_media, so the media
--      policy the upload gate now reads through a requirement occurrence cannot
--      be a shape the gate must defend itself against.
--
-- WHAT THIS DOES NOT CHANGE
--   No table, column, index, policy, grant or trigger is dropped or created. No
--   row is written, deleted or rewritten. Migrations 0001-0043 are applied
--   history and are not edited. The one constraint that is dropped is dropped and
--   immediately re-added WIDER, in the same transaction, by the technique
--   0016:20-26 and 0041:539-546 established for the same constraint.
--
-- ROLLBACK
--   alter table public.requirement_rule_versions
--     drop constraint requirement_rule_versions_allowed_media_check;
--   alter table public.project_access_grants
--     drop constraint project_access_grants_capability_check;
--   alter table public.project_access_grants
--     add constraint project_access_grants_capability_check
--     check (capability = any (array[
--       'project.admin','project.view','contracts.edit','imports.manage',
--       'imports.publish','assignments.manage','progress.record','progress.adjust',
--       'evidence.record','rule_bindings.manage']));
--   Narrowing the capability CHECK back FAILS if any grant row carrying
--   'requirements.assign' exists — which is correct: the rollback of a widening
--   is only available while nothing has used it. Delete or revoke those grants
--   first, and note that revoking sets revoked_at rather than removing the row,
--   so the value must actually be gone from the column.
--
-- WHAT WAS NOT CHECKED. Nothing here was executed. No psql, no supabase, no
-- migration run, no test. Static reading of 0010, 0016, 0023, 0041 and 0043 is
-- the only check performed on it.
--
-- ===========================================================================
-- 1. requirements.assign — the third of the three places
--
-- The project-capability vocabulary is stated in THREE places and derived in
-- none: this CHECK, the zod enum `projectCapability`
-- (packages/contracts/src/project-access.ts), and the TypeScript union
-- `ProjectCapability` (packages/domain/src/authz.ts).
-- packages/testing/src/capability-vocabulary.test.ts asserts the first two
-- enumerate the same set. All three move in THIS slice, which is the discipline
-- 0041:526-537 asked for and did not get: that migration widened the CHECK and
-- left the other two behind, so the test has been red on the merged tree since.
--
-- WHY NOW AND NOT IN 0043. capabilities.csv:23 makes `requirements.assign` the
-- governor of exactly one operation, `requirement_occurrences.dry_run`, and that
-- route did not exist when 0043 was written. 0043:984-986 says so and declines to
-- widen: «a capability with no route is dead surface and this migration ships no
-- route». The route ships with this file, so the capability does too.
--
-- WHAT IT DOES NOT GOVERN. Materialisation. capabilities.csv:18
-- (assignments.manage) and :23 (requirements.assign) both claim it, and only :18
-- names the command that inserts. The RLS policies of 0043 §9 follow the
-- operation, `responsibility-presets.csv` gives project_manager
-- assignments.manage without requirements.assign, and naming requirements.assign
-- on the write path would have deadlocked the persona that creates assignments.
-- This value is added so a GRANT ROW can carry it — not so a second capability
-- can guard an INSERT.
--
-- A WIDENING. Every value previously accepted is still accepted, so the
-- re-added constraint is validated against existing rows and cannot fail on
-- them: the old ten-value set is a subset of the new eleven.
-- ===========================================================================
alter table public.project_access_grants
  drop constraint project_access_grants_capability_check;
alter table public.project_access_grants
  add constraint project_access_grants_capability_check
  check (capability = any (array[
    'project.admin','project.view','contracts.edit','imports.manage','imports.publish',
    'assignments.manage','progress.record','progress.adjust','evidence.record',
    'rule_bindings.manage','requirements.assign']));

-- ===========================================================================
-- 2. The media policy the gate now reads gets the constraint the old one had
--
-- 0023:52-63 put a shape CHECK on requirement_template_versions.allowed_media
-- and stated why: «A published template's media rules have to be usable without
-- the reading route defending itself: the upload gate does
-- allowed_media.mimeTypes.includes, which throws on a malformed shape and
-- silently widens to the fallback when the lookup returns nothing.»
--
-- v0.1-M2 repoints that gate at the requirement occurrence, which reads
-- allowed_media through its PINNED RULE VERSION — and
-- public.requirement_rule_versions has no equivalent constraint. 0043:243-248
-- records the gap and declines to close it: «That CHECK belongs on the rule
-- version in the slice that moves the read; adding it here would constrain
-- another slice's table for a route that does not exist.» This is that slice.
--
-- THE CONDITION IS THE EVIDENCE KIND, NOT THE STATUS, and that is the one way
-- this differs from 0023. The column is `jsonb not null default '[]'::jsonb`
-- (0041:321) and TWO shapes are legitimate: the OBJECT the gate reads, and the
-- empty ARRAY default meaning «this evidence kind produces no uploaded
-- original». `publishRequirementRuleVersionRequest` already draws exactly that
-- line — allowedMedia is REQUIRED for 'photo' and 'document' and REFUSED for
-- 'measurement' and 'checkbox' — so the CHECK draws it in the same place. A
-- status-conditioned form would have been wrong here for the reason 0041:288-292
-- gives: v0.1 has no rule-drafting operation, so `status = 'draft'` exempts
-- nothing that can exist.
--
-- coalesce ON EVERY LEG, NOT AS A FLOURISH. `jsonb_typeof` returns NULL for an
-- absent key and a CHECK that evaluates to NULL PASSES. Written the obvious way
-- this constraint accepts `{}` — the very shape most likely to reach it. 0023
-- paid for that lesson and this is the same three lines.
--
-- VALIDATED AGAINST EXISTING ROWS, AND IT CAN FAIL. Unlike everything in 0043
-- §1, this constraint is capable of rejecting a row that exists: a
-- 'photo'/'document' rule version whose allowed_media is not the object shape.
-- The only writer is the publish route, which parses the request through
-- `publishRequirementRuleVersionRequest` and cannot produce one — so a failure
-- here reports a row written by something that bypassed the contract, and the
-- correct response is to look at that row, not to weaken this. It is stated
-- rather than assumed because nothing in this slice was executed.
-- ===========================================================================
alter table public.requirement_rule_versions
  add constraint requirement_rule_versions_allowed_media_check
  check (evidence_kind not in ('photo','document') or (
    coalesce(jsonb_typeof(allowed_media -> 'mimeTypes'), '') = 'array'
    and coalesce(jsonb_array_length(allowed_media -> 'mimeTypes'), 0) > 0
    and coalesce(jsonb_typeof(allowed_media -> 'maxByteSize'), '') = 'number'));

comment on column public.requirement_rule_versions.allowed_media is
  'The media policy of the obligations materialised from this version. FROM '
  'v0.1-M2 THIS IS THE UPLOAD GATE''S AUTHORITY: upload_intents.create reads it '
  'through requirement_occurrences.rule_version_id, in place of the retired '
  'requirement_template_versions.allowed_media (ADR-005 decision 2, plan '
  'contradiction 3). It is NOT copied onto the occurrence — the version is '
  'publish/retire-only with no UPDATE grant and a frozen-content guard, so '
  'reading through the pin returns what a copy would have returned and cannot '
  'drift from it. Two shapes are legitimate and they mean different things: the '
  'object {mimeTypes, maxByteSize} the gate reads, and the ''[]'' default meaning '
  'this evidence kind produces no uploaded original. The CHECK added by migration '
  '0044 makes the first mandatory for ''photo'' and ''document'', which is the '
  'constraint 0023:52-63 gave the model this one replaces. A gate that opens when '
  'its policy cannot be read is not a gate.';
