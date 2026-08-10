-- ===========================================================================
-- 0056 — THE OBJECT A RENAME WOULD HAVE REWRITTEN
--
-- WHAT THIS IS FOR. Додаток В's first page names two things this database
-- already holds and the act has never been able to print:
--
--   ordinal 6  «(найменування робіт)»
--   ordinal 8  «(найменування і місце розташування об'єкта будівництва)»
--
-- `apps/app/src/lib/statutory-act-form.ts` says so in terms: «the view carries
-- ids, not names: work_items.description and projects.name are in the database
-- and NOT on the view, so those two fields stay `static` and print blank.
-- Widening the view is a separate, named step.» This is that step's schema half,
-- and it is needed for ONE of the two.
--
-- ---------------------------------------------------------------------------
-- WHY THE WORK ITEM NEEDS NO COLUMN AND THE PROJECT DOES
--
-- `work_items.description` is READ LIVE and stays that way. An act reaches a
-- line only through the assignment it covers; `work_assignments` is structurally
-- confined to a PUBLISHED baseline (work_assignments_published_baseline_fkey,
-- 0043:386-389), and `app.guard_work_item()` (0042 §3) raises on every update
-- and every delete of a line whose contract version is not a draft. 0047:421-437
-- already relies on exactly this chain to pin `unit_definition_id` and
-- `unit_precision` by foreign key, and `loadActVersionView` already reads
-- `work_items.unit_code` live and prints it in the quantity lines. A line an act
-- can name cannot move, so a description read at render time is the description
-- that was there at the freeze.
--
-- `public.projects` HAS NO SUCH GUARANTEE and is not close to one. 0011:125-127
-- grants UPDATE to any holder of `project.admin`, with no trigger, no status and
-- no terminal state — `name` and `address` are editable for the life of the
-- project, and `version` exists precisely because they move. Reading them live
-- into a frozen document would mean that fixing a typo in a project's name makes
-- every act ever frozen under it fail `frozen_content_hash_divergence` forever
-- (the render route's own refusal), because `content_hash` was pinned over the
-- old string. That is not a hypothetical: renaming a project is ordinary
-- administration, and it would silently destroy documents.
--
-- So the project's name travels the way a signatory's organisation name already
-- travels — frozen, with the version of the record it was taken from beside it
-- (§6's `frozen_organization_name` / `source_party_version`, 0047:283).
--
-- ---------------------------------------------------------------------------
-- WHY THESE ARE NOT «FIELDS OF ДОДАТОК В», WHICH THIS TABLE REFUSES TO CARRY
--
-- 0047 §4's header draws a line that this migration has to stay on the right
-- side of: «Storing them as columns would name fields of Додаток В, which
-- ADR-005 decision 10 and schema-v0.1.sql:1600 both refuse to do and which
-- prohibition E makes dangerous: a column is a field, and a field nobody sourced
-- is a field somebody will fill.»
--
-- What that paragraph refuses is storing the form's OWN TEXT — its title, its
-- captions, its resolution block, its disclaimers — because those are template
-- content and a column for one is a caption nobody sourced. The columns below
-- are the opposite kind of thing: they are RECORDED FACTS ABOUT THIS PROJECT,
-- copied out of `public.projects` at the freeze, carrying no normative string,
-- no caption and no tag. `statutory_act_version_signatories` already stores
-- three of exactly this kind. Which caption they print under is decided in the
-- committed field list (`technical/requirements/dbn-a31-5-2016-dodatok-v.csv`
-- and the binding beside it), not here, and nothing in this file names a field
-- of the form.
--
-- ---------------------------------------------------------------------------
-- WHY THEY ARE NULLABLE, AND WHY THERE IS NO BACKFILL
--
-- The pair of CHECKs 0047 §4 ends with is the pattern: a DRAFT carries none of
-- the freeze facts and a FROZEN row carries all of them. `content_hash`,
-- `renderer_version` and `form_template_hash` are already nullable columns held
-- to that shape by `statutory_act_versions_draft_clean_check` and
-- `statutory_act_versions_frozen_complete_check`, and the frozen project name is
-- the same class of fact — pinned in the one UPDATE the freeze performs. Both
-- constraints are extended below rather than a NOT NULL added, so a draft that
-- carried a frozen name would be as unstorable as a draft that carries a content
-- hash.
--
-- NO BACKFILL, AND NONE IS POSSIBLE. `app.guard_statutory_act_version()` (0047
-- §7) requires `new.draft_version = old.draft_version + 1` on every update of a
-- draft, so a migration-time UPDATE of existing rows would either violate that
-- guard or have to disable it. It does not need to: every existing row is a
-- DRAFT (the freeze has never succeeded anywhere — `statutory_acts.render` still
-- refuses on `dbn_retrieval_record_absent`, so `content_hash` cannot be
-- computed), and a draft must carry NULL here. Inventing a name for a row that
-- was never frozen would also be a lie about when it was read.
--
-- `frozen_project_address` stays nullable in BOTH states, because
-- `public.projects.address` is nullable (0010:142). A project with no recorded
-- address prints its name and nothing else; the caption still prints, and the
-- form does not pretend the field was answered — the same rule an unfilled
-- signatory slot follows.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS NOT CHECKED
--   Static reading of 0010, 0011, 0012, 0013, 0042, 0043 and 0047 against the
--   route and renderer this migration serves. Applied and exercised by the
--   act suite in the same change.
--
-- ROLLBACK (dev only): restore the two CHECK constraints to their 0047 text and
-- drop the three columns. No data migration either way, because no row carries a
-- value.
-- ===========================================================================

alter table public.statutory_act_versions
  -- The project's name AS IT READ AT THE FREEZE. Not a caption, not a citation:
  -- a copy of public.projects.name, which the freeze pins because the source can
  -- move and the document cannot.
  add column frozen_project_name text
    check (frozen_project_name is null
        or length(btrim(frozen_project_name, E' \t\n\r\f\v\u00A0')) > 0),
  -- «місце розташування» — the other half of ordinal 8's caption. Nullable in
  -- both states because the source column is.
  add column frozen_project_address text
    check (frozen_project_address is null
        or length(btrim(frozen_project_address, E' \t\n\r\f\v\u00A0')) > 0),
  -- The version of the project record the two strings above were taken from,
  -- matching `source_party_version` on the signatory rows and for the reason
  -- 0047 gives there: a reviewer years later needs to know what they are
  -- comparing against, and a frozen string with no version behind it is a claim
  -- with no record.
  add column source_project_version bigint
    check (source_project_version is null or source_project_version >= 1);

comment on column public.statutory_act_versions.frozen_project_name is
  'public.projects.name as it read in the freeze transaction. Frozen because '
  'projects_update (0011:125-127) lets any project.admin rename a project at any '
  'time with no guard and no terminal state, and a live read would make a rename '
  'break content_hash on every act ever frozen under that project. NULL on a '
  'draft and NOT NULL on a frozen row, by the two CHECKs this table already used '
  'for the other freeze facts.';
comment on column public.statutory_act_versions.frozen_project_address is
  'public.projects.address as it read in the freeze transaction. Nullable in BOTH '
  'states, unlike frozen_project_name, because the source column is nullable: a '
  'project with no recorded address prints its name and nothing else.';
comment on column public.statutory_act_versions.source_project_version is
  'public.projects.version the two frozen project strings were taken from — the '
  'same provenance statutory_act_version_signatories.source_party_version carries '
  'for a frozen organisation name.';

-- A DRAFT CARRIES NO FREEZE FACTS. Extended, not replaced: every term 0047 wrote
-- is repeated verbatim and the new columns are added to it.
alter table public.statutory_act_versions
  drop constraint statutory_act_versions_draft_clean_check,
  add constraint statutory_act_versions_draft_clean_check
    check (status <> 'draft'
        or (frozen_at is null and frozen_by_member_id is null
            and content_hash is null and renderer_version is null
            and form_template_hash is null
            and frozen_project_name is null and frozen_project_address is null
            and source_project_version is null));

-- A FROZEN VERSION CARRIES ALL OF THEM. `frozen_project_address` is deliberately
-- NOT here: an absent address is a fact about the project, not an incomplete
-- freeze.
alter table public.statutory_act_versions
  drop constraint statutory_act_versions_frozen_complete_check,
  add constraint statutory_act_versions_frozen_complete_check
    check (status <> 'frozen'
        or (frozen_at is not null and frozen_by_member_id is not null
            and content_hash is not null and renderer_version is not null
            and form_template_hash is not null and registry_checked_on is not null
            and frozen_project_name is not null
            and source_project_version is not null));
