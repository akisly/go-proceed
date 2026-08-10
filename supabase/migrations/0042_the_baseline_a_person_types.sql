-- 0042: the draft -> published lifecycle a hand-typed baseline needs (v0.1-M1).
--
-- WHAT THIS ADDS
--   The transition migration 0041 named as owed. 0041:144-156 records that
--   public.contract_versions has NO DRAFT LIFECYCLE IN THE RUNTIME — 0012:120
--   defaults status to 'published', 0013:28-29 forbids every UPDATE and DELETE,
--   and the importer inserts a row that is already published — and that «the
--   manual baseline path that v0.1-M1 adds (contract_versions.create -> a draft,
--   then .publish) needs its own migration to open that transition». This is
--   that migration. It opens exactly one transition, on exactly one table, and
--   it lands the two rules 0041 could not land because both states had to exist
--   first (INV-080's insert window, INV-015 on a work line).
--
--   Concretely:
--     * contract_versions may hold a DRAFT: import_batch_id, source_manifest_hash,
--       published_by and published_at become nullable FOR A DRAFT ONLY, each
--       under a CHECK that keeps the published shape exactly as it is today;
--     * a new `origin` discriminator ('import' | 'manual') keeps the importer's
--       own guarantee — an import-origin version still cannot exist without its
--       batch — while making a hand-typed version representable;
--     * contract_versions gains UPDATE, restricted by app.guard_contract_version()
--       to the single transition draft -> published and to four columns;
--     * work_items gain UPDATE and DELETE, restricted by app.guard_work_item()
--       to lines whose contract version is still a DRAFT (INV-015);
--     * contract_version_rule_bindings gain the insert-window trigger 0041:143-156
--       deferred to here (INV-080).
--
-- WHAT THIS DOES NOT CHANGE
--   No table is dropped, no column is dropped, no row is deleted, no data is
--   rewritten. Migrations 0001-0041 are applied history and are not edited.
--
--   THREE EXISTING GUARANTEES ARE REPLACED RATHER THAN WEAKENED, and each
--   replacement is stated here so a reviewer can check the arithmetic:
--
--   1. `contract_versions_immutable` (0013:28) rejected EVERY update and delete.
--      It is replaced by app.guard_contract_version(), which rejects every
--      delete, rejects every update whose old row is not a draft, rejects every
--      update whose new row is not published, and rejects any change outside
--      {status, published_at, published_by, source_manifest_hash}. A PUBLISHED
--      contract version is therefore exactly as immutable as it was on 0013,
--      and the exception it raises still says «immutable» so the assertion in
--      packages/testing/src/m1-rls-baseline.test.ts:50-66 keeps testing what it
--      was written to test.
--
--   2. `work_items_immutable` (0013:30) rejected EVERY update and delete. It is
--      replaced by app.guard_work_item(), which permits an update or a delete
--      ONLY while the owning contract version is a draft, and freezes the
--      tenancy, identity and import-provenance columns even then. A line of a
--      PUBLISHED version is exactly as immutable as it was on 0013 (INV-015).
--
--   3. The INSERT policies `cv_insert` and `wi_insert` (0013:79, 0013:85) asked
--      for imports.publish. They are replaced by policies that still admit
--      imports.publish on exactly the shape it wrote before — a row inserted
--      already-published — and additionally admit contracts.edit on a DRAFT row
--      and on a line of a draft version. contracts.edit CANNOT insert a
--      published contract version through this policy; the manual route reaches
--      `published` only through the guarded UPDATE.
--
--   NOTE ON THE GRANT ASSERTION THAT MUST MOVE WITH THIS MIGRATION:
--   packages/testing/src/m1-rls-baseline.test.ts:79-87 asserts that aktflow_app
--   holds no UPDATE or DELETE on contract_versions or work_items. That assertion
--   describes the append-only model this migration retires for these two tables,
--   and it is edited in the same slice — with the replacement assertions named
--   above written in its place. It is not deleted: an append-only table losing
--   its guard silently is the failure this repository has already had once.
--
-- ROLLBACK
--   Dev only, and only while no contract version is a draft and no work line
--   has been updated or deleted:
--     drop trigger contract_version_rule_bindings_insert_window
--       on public.contract_version_rule_bindings;
--     drop function app.guard_rule_binding_window();
--     drop trigger work_items_guard on public.work_items;
--     drop function app.guard_work_item();
--     drop trigger contract_versions_guard on public.contract_versions;
--     drop function app.guard_contract_version();
--     create trigger contract_versions_immutable before update or delete
--       on public.contract_versions for each row execute function app.reject_mutation();
--     create trigger work_items_immutable before update or delete
--       on public.work_items for each row execute function app.reject_mutation();
--     revoke update on public.contract_versions from aktflow_app;
--     revoke update, delete on public.work_items from aktflow_app;
--     drop policy cv_update on public.contract_versions;
--     drop policy wi_update on public.work_items;
--     drop policy wi_delete on public.work_items;
--     drop policy cv_insert on public.contract_versions;
--     create policy cv_insert on public.contract_versions for insert to aktflow_app
--       with check (app.has_project_capability(workspace_id, project_id, array['imports.publish']));
--     drop policy wi_insert on public.work_items;
--     create policy wi_insert on public.work_items for insert to aktflow_app
--       with check (app.has_project_capability(workspace_id, project_id, array['imports.publish']));
--     drop function app.contract_version_is_draft(uuid, uuid);
--     alter table public.contract_versions
--       drop constraint contract_versions_published_check,
--       drop constraint contract_versions_draft_check,
--       drop constraint contract_versions_origin_batch_check,
--       drop constraint contract_versions_manual_author_check,
--       drop column origin,
--       drop column created_by,
--       alter column import_batch_id set not null,
--       alter column source_manifest_hash set not null,
--       alter column published_by set not null,
--       alter column published_at set not null;
--   ONCE ONE DRAFT EXISTS THERE IS NO ROLLBACK: restoring the NOT NULLs fails on
--   the draft's own rows, and dropping `origin` destroys the only record of
--   which baselines were typed rather than imported. Staging and production take
--   a corrective forward migration instead.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION DOES NOT ENFORCE, NAMED SO IT IS NOT MISTAKEN FOR ENFORCED
--
-- * INV-083 — publication refused without a bound rule-version set — is STILL
--   not here, and 0041:136-141 gives the reason unchanged: the importer creates
--   the version and its bindings in one transaction, so no constraint can
--   express «a published version must already have a binding» without breaking
--   that transaction's own insert order. It is a refusal inside
--   contract_versions.publish and inside import_batches.publish.
-- * A DRAFT CANNOT BE DELETED, and nothing here gives it a delete path. There is
--   no contract_versions.remove row in technical/openapi/scope-v0.1.csv, so an
--   abandoned draft keeps its version number forever. That is a real cost of the
--   shape and it is recorded rather than worked around.
-- * MORE THAN ONE OPEN DRAFT PER CONTRACT IS REPRESENTABLE. `unique
--   (workspace_id, contract_id, version_no)` bounds the number, not the count of
--   drafts. Two open drafts are legal here and the routes do not forbid them —
--   but every reader that asked for «the contract's current version» by
--   `order by version_no desc limit 1` would have started answering with a
--   DRAFT the moment this migration applied. The two such readers in the tree
--   (apps/app/app/v1/contracts/[contractId]/assignments/route.ts:49-52 and
--   apps/app/app/v1/import-batches/[batchId]/publish/route.ts:91-96) are
--   corrected in this same slice. A THIRD SUCH READER ADDED LATER WOULD BE
--   WRONG IN THE SAME WAY: `status = 'published'` is not optional in that query.
--
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 0. Capability probe
--
-- app.guard_rule_binding_window() in §5 compares a row's xmin against the
-- current transaction id, which needs the xid8 -> xid cast (PostgreSQL 13+).
-- A plpgsql body is only syntax-checked at CREATE FUNCTION, so a missing cast
-- would not surface until the FROZEN IMPORTER's next publish — the worst place
-- to discover it. This probe is evaluated now and fails the migration loudly
-- instead.
-- ===========================================================================
do $$
begin
  perform pg_current_xact_id()::xid;
end $$;

-- ===========================================================================
-- 1. contract_versions may hold a draft
--
-- Each NOT NULL that is dropped is replaced by a CHECK that reimposes it for
-- every non-draft row, so the set of storable PUBLISHED rows is unchanged.
--
-- `published_at` KEEPS ITS `default now()` (0012:133). Dropping the default
-- would silently break the frozen importer, whose INSERT
-- (apps/app/app/v1/import-batches/[batchId]/publish/route.ts:162-176) never
-- names the column. The manual create command therefore writes an EXPLICIT NULL,
-- which overrides the default; a create command that merely omitted the column
-- would produce a draft carrying a publication timestamp and be rejected by
-- contract_versions_draft_check below. That rejection is the point.
-- ===========================================================================
alter table public.contract_versions
  alter column import_batch_id drop not null,
  alter column source_manifest_hash drop not null,
  alter column published_by drop not null,
  alter column published_at drop not null;

-- 'import' is the correct default for every row that already exists: on
-- 2026-08-06 import_batches.publish was the only route that had ever written
-- this table.
alter table public.contract_versions
  add column origin text not null default 'import'
    check (origin in ('import','manual'));

-- Attribution for a draft. published_by answers «who published this» and is
-- NULL until publication, so without this column a draft would be a row nobody
-- owns — the same argument 0041 departure 5 makes for a published rule version.
-- It is NOT NULL only for a manual version: the frozen importer's INSERT does
-- not name it, and its author is already recorded in published_by by the same
-- act that creates the row.
alter table public.contract_versions
  add column created_by uuid references auth.users(id);

alter table public.contract_versions
  -- An import-origin version still cannot exist without its batch. This is
  -- 0012:131's NOT NULL, re-expressed so that it binds exactly the rows it used
  -- to bind and no others.
  add constraint contract_versions_origin_batch_check
    check ((origin = 'import') = (import_batch_id is not null)),
  add constraint contract_versions_manual_author_check
    check (origin <> 'manual' or created_by is not null),
  -- The published shape, unchanged from 0012. For a manual baseline
  -- source_manifest_hash carries the digest of the TYPED LINE SET rather than
  -- of source files, because a hand-typed baseline has no source files and the
  -- line set is the source material it was published from. Both meanings are a
  -- content address of exactly what the publisher confirmed.
  add constraint contract_versions_published_check
    check (status = 'draft'
        or (source_manifest_hash is not null
            and published_by is not null
            and published_at is not null)),
  -- Makes «draft» mean what it says. Without it a row could sit at 'draft'
  -- carrying a publisher and a publication timestamp, and every reader that
  -- distinguishes the two states by looking at published_at would be wrong.
  add constraint contract_versions_draft_check
    check (status <> 'draft'
        or (source_manifest_hash is null
            and published_by is null
            and published_at is null));

create index contract_versions_draft_idx
  on public.contract_versions (workspace_id, contract_id, version_no)
  where status = 'draft';

comment on column public.contract_versions.origin is
  'How this baseline was produced: ''import'' through the frozen XLSX/CSV importer '
  '(ADR-006 decision 6) or ''manual'' through contract_versions.create plus '
  'work_items.create (ADR-006 decision 2). Manual entry is a FIRST-CLASS v0.1 '
  'capability and not a stopgap for a missing importer; this column records which '
  'route produced a version, never which one is preferred. It also carries 0012:131''s '
  'NOT NULL on import_batch_id forward: an import-origin version still cannot exist '
  'without its batch.';

comment on column public.contract_versions.source_manifest_hash is
  'Content address of the source material this baseline was published from. For '
  'origin ''import'' that is the file/parser/mapping manifest the importer computed '
  '(validate/route.ts:108-111). For origin ''manual'' it is the digest of the typed '
  'line set, computed over exactly the fields contract_versions.get returns, so the '
  'publisher confirms the line set it was shown and a concurrent edit is refused. '
  'NULL only while the version is a draft.';

-- ===========================================================================
-- 2. The one transition, and the four columns it may write
--
-- Modelled on app.guard_requirement_rule_version() (0041:618-644), including the
-- whole-row jsonb comparison rather than a named column list: a column added by
-- a later migration is frozen from the moment it exists, without anybody
-- remembering to extend a list. 0016:64-83 is the counter-example — six columns
-- named, seven left uncompared.
--
-- The ::text casts on the `-` operator are explicit for the reason 0041:615-617
-- gives: `jsonb - 'literal'` has three candidate operators and an unknown-typed
-- literal resolves by category rule rather than by anything a reader can see.
-- ===========================================================================
create or replace function app.guard_contract_version() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    -- Wording matters: a published contract version was immutable before this
    -- migration and is immutable after it, and the assertion that says so
    -- matches on this word.
    raise exception 'contract version % is immutable and not deletable (INV-015)', old.id;
  end if;

  if old.status <> 'draft' then
    raise exception
      'contract version % is immutable once published (INV-015); no column may change', old.id;
  end if;
  if new.status <> 'published' then
    raise exception
      'contract version % admits only the draft -> published transition; attempted % -> %',
      old.id, old.status, new.status;
  end if;

  if (to_jsonb(new) - 'status'::text - 'published_at'::text
                    - 'published_by'::text - 'source_manifest_hash'::text)
     is distinct from
     (to_jsonb(old) - 'status'::text - 'published_at'::text
                    - 'published_by'::text - 'source_manifest_hash'::text) then
    raise exception
      'publishing contract version % must not alter its pinned content (INV-015)', old.id;
  end if;

  return new;
end $$;
revoke all on function app.guard_contract_version() from public;

drop trigger contract_versions_immutable on public.contract_versions;
create trigger contract_versions_guard before update or delete
  on public.contract_versions
  for each row execute function app.guard_contract_version();

-- ===========================================================================
-- 3. A work line is correctable exactly while its version is a draft (INV-015)
--
-- The guard is NOT security definer, for the reason 0041:705-707 gives about
-- app.guard_rule_binding(): it reads under the mutating role, so if RLS hides
-- the contract version the mutation fails closed rather than proceeding on a
-- NULL.
--
-- INSERT IS DELIBERATELY NOT GUARDED HERE. The frozen importer inserts its work
-- items into a version that is ALREADY published, inside the transaction that
-- created it, so a «lines may only be inserted into a draft» rule would break
-- it. The insert side is governed by the RLS policy in §4 instead, where the
-- two routes can be told apart by the capability each one holds.
-- ===========================================================================
-- OLD and NEW are branched on explicitly rather than folded into one row
-- variable: on DELETE, NEW is unassigned, and `case tg_op when 'DELETE' then old
-- else new end` would still have to type both arms.
create or replace function app.guard_work_item() returns trigger
language plpgsql as $$
declare
  v_workspace uuid;
  v_version   uuid;
  v_status    text;
begin
  if tg_op = 'DELETE' then
    v_workspace := old.workspace_id;
    v_version   := old.contract_version_id;
  else
    v_workspace := new.workspace_id;
    v_version   := new.contract_version_id;
  end if;

  select cv.status into v_status
    from public.contract_versions cv
   where cv.workspace_id = v_workspace and cv.id = v_version;

  if v_status is null then
    raise exception 'contract version % is not visible in this workspace', v_version;
  end if;
  if v_status <> 'draft' then
    raise exception
      'work items of contract version % are immutable once it is published (INV-015)',
      v_version;
  end if;

  if tg_op = 'UPDATE' then
    -- Tenancy, identity and import provenance. A correction changes what the
    -- line SAYS; it may not move the line to another tenant, project, contract
    -- or version, and it may not acquire or shed the import row result it came
    -- from. currency, tax_mode and tax_rate_bps are pinned by the version and
    -- are frozen with them: one line of a version quietly carrying a different
    -- tax rate is a baseline whose own total contradicts its own pins.
    if (new.id, new.workspace_id, new.project_id, new.contract_id,
        new.contract_version_id, new.source_row_result_id, new.created_at,
        new.currency, new.tax_mode, new.tax_rate_bps)
       is distinct from
       (old.id, old.workspace_id, old.project_id, old.contract_id,
        old.contract_version_id, old.source_row_result_id, old.created_at,
        old.currency, old.tax_mode, old.tax_rate_bps) then
      raise exception
        'correcting work item % may not change its identity, tenancy, provenance or pinned tax basis',
        old.id;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app.guard_work_item() from public;

drop trigger work_items_immutable on public.work_items;
create trigger work_items_guard before update or delete
  on public.work_items
  for each row execute function app.guard_work_item();

-- ===========================================================================
-- 4. Grants and RLS
--
-- app.contract_version_is_draft is SECURITY DEFINER for the reason 0011:7-12
-- gives: it is consulted from a policy on public.work_items, whose actor may
-- hold contracts.edit without project.view, and a policy that silently
-- evaluated to false because a row was invisible would deny a permitted write
-- with no way to see why. It is bounded to (workspace, id) and returns a
-- boolean about a version the caller already named inside a policy that has
-- already checked that caller's project capability, so it is not an oracle for
-- anything the capability does not already grant.
-- ===========================================================================
create or replace function app.contract_version_is_draft(ws uuid, cv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contract_versions
     where workspace_id = ws and id = cv and status = 'draft')
$$;
revoke all on function app.contract_version_is_draft(uuid, uuid) from public;
grant execute on function app.contract_version_is_draft(uuid, uuid) to aktflow_app;

grant update on public.contract_versions to aktflow_app;
grant update, delete on public.work_items to aktflow_app;

drop policy cv_insert on public.contract_versions;
create policy cv_insert on public.contract_versions for insert to aktflow_app
  with check (
    -- The frozen importer, on exactly the shape it wrote before.
    (status = 'published'
      and app.has_project_capability(workspace_id, project_id, array['imports.publish']))
    -- contract_versions.create. It cannot insert a published version: reaching
    -- 'published' is the guarded UPDATE in §2 and nothing else.
    or (status = 'draft'
      and app.has_project_capability(workspace_id, project_id, array['contracts.edit'])));

create policy cv_update on public.contract_versions for update to aktflow_app
  using (status = 'draft'
    and app.has_project_capability(workspace_id, project_id, array['contracts.edit']))
  with check (app.has_project_capability(workspace_id, project_id, array['contracts.edit']));

drop policy wi_insert on public.work_items;
create policy wi_insert on public.work_items for insert to aktflow_app
  with check (
    app.has_project_capability(workspace_id, project_id, array['imports.publish'])
    or (app.has_project_capability(workspace_id, project_id, array['contracts.edit'])
        and app.contract_version_is_draft(workspace_id, contract_version_id)));

create policy wi_update on public.work_items for update to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['contracts.edit'])
    and app.contract_version_is_draft(workspace_id, contract_version_id))
  with check (app.has_project_capability(workspace_id, project_id, array['contracts.edit']));

create policy wi_delete on public.work_items for delete to aktflow_app
  using (app.has_project_capability(workspace_id, project_id, array['contracts.edit'])
    and app.contract_version_is_draft(workspace_id, contract_version_id));

-- ===========================================================================
-- 5. INV-080's insert window — deferred to here by 0041:143-156
--
-- «A rule version published after a contract version was published never
-- reaches that contract version.» 0041 could enforce that a binding names a
-- real, published rule version inside its own tenant, and could make the
-- binding row itself append-only, but it could NOT close the later-insert path,
-- because closing it needs both contract-version states to exist and on 0041
-- only one did.
--
-- The window is: the target version is still a DRAFT, or the target version was
-- created by THIS transaction. The second disjunct is the frozen importer,
-- which inserts an already-published version and binds to it in the same commit
-- (ADR-006 decision 3 puts the binding on both routes to a published baseline).
-- It is expressed as an xmin comparison because that is the only thing in the
-- row that distinguishes «created here» from «found here»; `now()` would compare
-- transaction START timestamps, which two concurrent transactions can share.
-- The cast this depends on is probed at the top of this file.
-- ===========================================================================
create or replace function app.guard_rule_binding_window() returns trigger
language plpgsql as $$
declare
  v_status   text;
  v_born_here boolean;
begin
  select cv.status, cv.xmin = pg_current_xact_id()::xid
    into v_status, v_born_here
    from public.contract_versions cv
   where cv.workspace_id = new.workspace_id and cv.id = new.contract_version_id;

  if v_status is null then
    raise exception 'contract version % is not visible in this workspace',
      new.contract_version_id;
  end if;

  if v_status <> 'draft' and not v_born_here then
    raise exception
      'contract version % is already published; its bound rule-version set is fixed (INV-080)',
      new.contract_version_id;
  end if;

  return new;
end $$;
revoke all on function app.guard_rule_binding_window() from public;

-- WHICH OF THE TWO GUARDS ANSWERS FIRST, corrected in place. This comment said
-- the name sorts AFTER contract_version_rule_bindings_rule_version_guard
-- (0041:731) so the published-rule-version check runs first. It is the reverse:
-- PostgreSQL fires BEFORE-row triggers in trigger-name order and
-- 'contract_version_rule_bindings_i...' sorts before
-- 'contract_version_rule_bindings_r...', so THIS window guard answers first and
-- an insert that is both outside the window and against an unpublished version
-- is refused with INV-080 rather than with the rule-version message.
--
-- Both refusals stay distinguishable in a log either way — that part held — and
-- no test depends on the order: packages/testing/src/m1-rules-schema.test.ts and
-- m1-rules-rls.test.ts arrange every probe so that exactly one guard can fire,
-- and both already recorded the contradiction this comment created.
--
-- THIS IS A COMMENT CORRECTION, NOT AN EDIT TO HISTORY. Migration 0042 was
-- written on this uncommitted branch and has never been applied anywhere, so no
-- deployed database carries the sentence being replaced and no checksum moves.
-- If the stated order is what is actually wanted, that is a RENAME in a later
-- migration (contract_version_rule_bindings_zz_insert_window) and not a change
-- here; nothing in v0.1 asks for it (M1 review finding 5).
create trigger contract_version_rule_bindings_insert_window before insert
  on public.contract_version_rule_bindings
  for each row execute function app.guard_rule_binding_window();

comment on table public.contract_version_rule_bindings is
  'Pins the exact rule-version set to a contract version at baseline publication '
  '(ADR-005 decision 2). A rule published after that baseline does not retroactively '
  'enter it (INV-080). The set of stage_key values bound to a contract version IS '
  'that version''s stage vocabulary. Append-only: no UPDATE or DELETE grant and a '
  'mutation-rejecting trigger. INV-080''s insert window — a binding may be inserted '
  'only while the contract version is a draft, or by the transaction that created '
  'the version — IS now enforced, by app.guard_rule_binding_window() in migration '
  '0042, which is the migration that opened the draft -> published transition the '
  'rule needed in order to be expressible.';

-- ===========================================================================
-- 6. What the catalogs owe, recorded here rather than edited into them
--
-- docs/domain/domain-model.md calls the Додаток Н library content
-- workspace-INDEPENDENT, while entity-catalog.csv and relationship-catalog.csv
-- scope public.requirement_library_items to a workspace and 0041:191-193 builds
-- it that way. The shape follows the catalogs and the substance follows the
-- document — a rule version COPIES the quoted text, its verification tag and its
-- source into its own immutable content, so no tenant obligation depends on a
-- shared row. The document is the thing that is wrong, and correcting it is a
-- documentation change this migration deliberately does not make: a migration
-- that edits prose is a migration nobody can review.
-- ===========================================================================
comment on column public.contract_versions.created_by is
  'Who typed this baseline. NOT NULL for origin ''manual'' and NULL for origin '
  '''import'', where the importer''s single-transaction publish already records the '
  'same person in published_by. A draft with no author is a row nobody owns.';
