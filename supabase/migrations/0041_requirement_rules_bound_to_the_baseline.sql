-- 0041: the requirement model bound to the baseline (v0.1-M1).
--
-- WHAT THIS ADDS
--   three tables — public.requirement_library_items,
--   public.requirement_rule_versions, public.contract_version_rule_bindings —
--   with their grants, RLS, append-only and frozen-content enforcement; one new
--   project capability value ('rule_bindings.manage'); one SECURITY DEFINER
--   retirement command; and the comments that record the retirement of the
--   one-template-per-assignment model.
--
-- WHAT THIS DOES NOT CHANGE
--   No table is dropped. No column is dropped. No existing constraint is
--   weakened. Migrations 0001-0040 are applied history and are not edited. The
--   only existing object altered is the capability CHECK on
--   public.project_access_grants, which is WIDENED by one value, and three
--   comments (see §10) which change no behaviour at all. Nothing here writes a
--   row: the twelve Додаток Н library rows are NOT seeded by this migration
--   (§1, open decision).
--   ONE EXISTING TEST GOES RED ON THIS MIGRATION ALONE — see §4.
--
-- ROLLBACK
--   Dev only, and only while the three tables are still empty:
--     drop trigger contract_version_rule_bindings_rule_version_guard
--       on public.contract_version_rule_bindings;
--     drop table public.contract_version_rule_bindings;
--     drop table public.requirement_rule_versions;
--     drop table public.requirement_library_items;
--     drop function app.guard_rule_binding();
--     drop function app.guard_requirement_rule_version();
--     drop function app.retire_requirement_rule_version(uuid, uuid);
--     alter table public.project_access_grants
--       drop constraint project_access_grants_capability_check;
--     alter table public.project_access_grants
--       add constraint project_access_grants_capability_check
--       check (capability = any (array[
--         'project.admin','project.view','contracts.edit','imports.manage','imports.publish',
--         'assignments.manage','progress.record','progress.adjust','evidence.record']));
--   Once a workspace has been provisioned with its library rows, or one rule
--   version has been published, or one baseline has been bound, THERE IS NO
--   ROLLBACK: dropping the tables destroys the content of a published baseline's
--   obligation set, and a published contract version is immutable, so the
--   dropped binding cannot be re-derived from anything. Staging and production
--   take a corrective forward migration instead.
--   The two comments in §10 have no rollback that restores meaning: reverting
--   them sets the comment to NULL, which is what they replaced.
--
-- ---------------------------------------------------------------------------
-- WHY THE TARGET DDL IS NOT TRANSCRIBED
--
-- technical/database/schema-v0.1.sql is the SHAPE to build toward, not a file
-- to copy. 0015:1-11 already records three standing deviations of the realized
-- database from it, and they all apply here:
--   * the workspace table is public.organizations, not public.workspaces, and
--     the membership key is memberships (organization_id, id) — the composite
--     unique added by 0015:21-22;
--   * state columns are text + CHECK, because this database has no enums and
--     enum evolution needs ALTER TYPE, which complicates additive migrations;
--   * content hashes are text with a hex check, matching
--     public.import_files.content_hash — so rule_version_hash is text, not
--     bytea as schema-v0.1.sql:977 has it.
--
-- FIVE FURTHER DEPARTURES FROM schema-v0.1.sql, EACH DELIBERATE:
--
-- 1. public.requirement_rules IS NOT CREATED. schema-v0.1.sql:926 creates it
--    and :989 gives requirement_rule_versions a foreign key into it, and
--    relationship-catalog.csv:57 declares that relationship. ADR-006 decision
--    4.1 keeps it out of v0.1 entirely — «requirement_rules is not in v0.1.
--    The only rule source in v0.1 is the shipped library; workspace-authored
--    rule drafting is v0.2» — entity-catalog.csv:31 marks it v0.2, it is not
--    among ADR-006 decision 4's twenty-six, and version-0.1.md §v0.1-M1 says
--    M1 BUILDS THREE tables. ADR-006 §"Replacement rule" 1 rules out the three
--    arguments for adding it anyway: «it is already in the DDL», «the catalog
--    has the row» and «it is one more table» are explicitly not reasons.
--    So requirement_rule_id below is a NOT NULL lineage key with no referent
--    in v0.1. The meaning it needs is carried by
--    unique (workspace_id, requirement_rule_id, version_no) on the version
--    table and by unique (workspace_id, contract_version_id,
--    requirement_rule_id) on the binding — ONE RULE CONTRIBUTES AT MOST ONE
--    VERSION TO A BASELINE, which is the invariant that makes "what was agreed"
--    unambiguous. v0.2 adds the table and the FK; that addition is additive
--    because the key is already here and already unique.
--    THE MISSING FK IS NOT AN OVERSIGHT. A reviewer reading
--    relationship-catalog.csv:57 should read this paragraph.
--
-- 2. THE `hold` CHECK OF schema-v0.1.sql:997 IS NOT TRANSCRIBED.
--    That line reads `check (intervention_type <> 'hold' or blocking_scope =
--    'blocks_both')`. ADR-006 decision 4.4 requires the opposite of it for
--    v0.1: «A v0.1 hold is blocks_stage_closure, not blocks_both», because in a
--    version with no packages the other half of `both` has nothing to block.
--    Transcribed, that CHECK would make EVERY v0.1 hold unstorable — the
--    publication command could not write the only scope it is allowed to write,
--    and the v0.2 widening migration INV-066 owes would have no rows to widen,
--    because none could ever have been written.
--    The CHECK therefore keeps all three intervention types and all four
--    blocking scopes (version-0.1.md §v0.1-M1 exit gates, INV-082), and BOTH
--    REFUSALS ARE THE PUBLICATION COMMAND'S: it rejects an intervention_type
--    other than `hold` (decision 4.3) and rejects a `hold` whose blocking_scope
--    is anything other than `blocks_stage_closure` (decision 4.4). Two refusals,
--    two tests, neither of them in this file.
--    The `witness` and `review` scope CHECKs of schema-v0.1.sql:998-999 ARE
--    kept: ADR-006 amends only the `hold` row of ADR-005 decision 4's table, and
--    across the three types all four scopes stay reachable, so v0.2 is additive.
--
-- 3. requirement_library_item_id IS NULLABLE, and the v0.1 rule that a rule
--    version must cite a shipped library item is the COMMAND's. ADR-006
--    decision 4.1's «the only rule source in v0.1 is the shipped library» is a
--    v0.1 restriction; a NOT NULL here would bake v0.1 into the schema and make
--    v0.2's workspace-authored rules a schema change rather than an additive
--    one. Same class of error as departure 2.
--
-- 4. THE LITERAL DISCRIMINATOR IS has_been_published, NOT status.
--    0023:28-48 makes a draft template unpinnable with a copied literal
--    'published' and a composite FK into (workspace_id, id, status). That
--    technique is SAFE ONLY WHERE THE STATUS IS TERMINAL, and
--    requirement_template_versions goes draft -> published and stops. A rule
--    version goes published -> retired (INV-067), and a foreign key is
--    re-validated when the referenced row is updated: a copied 'published'
--    literal would make `requirement_rule_versions.retire` fail with a foreign
--    key violation on every version that any baseline had bound. The
--    discriminator is therefore the generated column has_been_published, which
--    is monotone — retirement leaves published_at untouched — so binding a
--    DRAFT is unrepresentable and retiring a BOUND version still works.
--    "Retirement stops future binding" cannot be a foreign key at all, because
--    the same key must keep resolving for bindings made before the retirement;
--    it is a BEFORE INSERT trigger (§8).
--
-- 5. created_by_member_id IS ADDED, beyond schema-v0.1.sql. Every deployed
--    module in this database attributes the row that created an immutable fact
--    (0015:55, 0015:89, 0012:103). A published rule version with no author is
--    an obligation nobody owns.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION DOES NOT ENFORCE, NAMED SO IT IS NOT MISTAKEN FOR
-- ENFORCED
--
-- * INV-083 — publication refused without a bound rule-version set — is NOT
--   here. It is a refusal inside contract_versions.publish and
--   import_batches.publish (version-0.1.md §v0.1-M1 exit gates); there is no
--   deferred constraint that can express "a published version must already have
--   a binding" without breaking the insert order of the very transaction that
--   creates both.
-- * INV-080's first half — a rule version published after a baseline never
--   reaches that baseline — is NOT structurally enforced here, and the reason is
--   the deployed shape of public.contract_versions rather than a preference.
--   0012:120 defaults status to 'published', 0013:28-29 puts a BEFORE UPDATE OR
--   DELETE trigger on the table, and apps/app/app/v1/import-batches/[batchId]/
--   publish/route.ts:163 inserts a version that is already published. THERE IS
--   NO DRAFT LIFECYCLE IN THE RUNTIME: a contract version cannot be updated at
--   all, so `status` never moves. The manual baseline path that v0.1-M1 adds
--   (contract_versions.create -> a draft, then .publish) needs its own migration
--   to open that transition, and the "a binding may be inserted only while the
--   version is a draft, or in the publishing transaction itself" rule belongs in
--   THAT migration, where both states exist. Writing it here would either refuse
--   every binding the frozen importer makes (it publishes and would bind in one
--   transaction, against a row that is already 'published') or freeze a rule the
--   publish migration then has to contradict.
--   What IS enforced here: the binding row is append-only, it cannot name a
--   contract version in another tenant, project or contract, and it cannot name
--   a rule version that was never published.
-- * INV-082 and INV-085 are command refusals by design (see departure 2 and
--   version-0.1.md §v0.1-M1 / §v0.1-M3 exit gates). Nothing in this file
--   rejects a `witness`, a `review`, a `blocks_both` hold, or an external
--   approver, and nothing in this file should.
-- * The ДБН retrieval record — exact URL, retrieval date, SHA-256 — is still
--   absent from technical/requirements/ (hidden-works-content-rules.md §"Open
--   items"). The library table and its constraints can be built without it; what
--   it gates is M4's right to RENDER a VERIFIED_PRIMARY string in a
--   customer-facing artifact. This migration makes an unsourced string
--   unstorable; it cannot make a recorded source reproducible.
--
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. requirement_library_items — the shipped regulatory content
--
-- Додаток Н positions Н.14 (5 items) and Н.15 (7 items), verbatim, from
-- technical/requirements/dbn-a31-5-2016-dodatok-n.csv. Content is a repository
-- change under hidden-works-content-rules.md and NEVER a runtime command: there
-- is no requirement_library.create operation in technical/openapi/scope-v0.1.csv
-- and this migration deliberately creates none.
--
-- THE ROWS ARE NOT SEEDED HERE, and the reason is not laziness. These rows are
-- workspace-scoped (entity-catalog.csv:33, relationship-catalog.csv:59) and
-- there is no workspace at migration time. Where they are materialised —
-- per workspace at workspaces.create from a constant compiled out of the CSV,
-- or on first read — is an OPEN DECISION recorded in
-- docs/superpowers/plans/2026-08-06-v0.1-implementation.md §"M1 task
-- decomposition". The INSERT policy in §9 assumes the first; if the second is
-- chosen, that policy is what has to widen, and this paragraph is where to look.
-- ===========================================================================
create table public.requirement_library_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  source_standard text not null check (length(btrim(source_standard)) > 0),
  -- hidden-works-content-rules.md §"What the product MAY assert" item 1 carries
  -- Н.14 and Н.15 ONLY. «Н.1–Н.13» is not an allow-listed range and there is no
  -- value here that could hold one.
  position_code text not null check (position_code in ('Н.14','Н.15')),
  position_title_uk text not null check (length(btrim(position_title_uk)) > 0),
  item_no integer not null check (item_no >= 1),
  item_text_uk text not null check (length(btrim(item_text_uk)) > 0),
  -- Prohibition B: the string «орієнтовн» occurs zero times in the standard.
  -- Prohibition C: Додаток Н is never presented as mandatory or exhaustive.
  -- There is exactly one storable value and it is «довідковий».
  normative_character text not null default 'dovidkovyi'
    check (normative_character = 'dovidkovyi'),
  -- INV-073, storage half. UNVERIFIED is deliberately NOT in this list: an
  -- unverified string must never be shown as normative, and the cheapest way to
  -- guarantee that is to make it unstorable rather than filtered at render.
  verification text not null
    check (verification in ('VERIFIED_PRIMARY','VERIFIED_SECONDARY')),
  -- NOT NULL alone is not INV-073. NOT NULL admits '' and '   ', which carry no
  -- source while satisfying the column, and «a string with no source must be
  -- unrenderable» is a claim about content and not about nullability. 0023:54-56
  -- is the standing lesson in this codebase about constraints written the
  -- obvious way.
  source_citation text not null check (length(btrim(source_citation)) > 0),
  -- Prohibition G: neither ДБН А.3.1-5:2016 nor ДСТУ 9258:2023 says which
  -- position takes which act form. act_form_basis has one storable value, so a
  -- mapping can never be recorded as anything but the product's assumption.
  act_form_assumption text check (act_form_assumption in ('dodatok_v','dodatok_g')),
  act_form_basis text not null default 'product_assumption'
    check (act_form_basis = 'product_assumption'),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, source_standard, position_code, item_no),
  -- Prohibition A, made structural: Н.14 has exactly five items and Н.15 exactly
  -- seven. An eighth Н.15 line is UNREPRESENTABLE, not forbidden by review.
  -- Anything the product recommends beyond Додаток Н belongs to a separate block
  -- labelled «Додатково рекомендуємо (не з Додатка Н)» with no normative
  -- citation, and that block is not this table.
  constraint requirement_library_items_dodatok_n_extent_check
    check ((position_code = 'Н.14' and item_no <= 5)
        or (position_code = 'Н.15' and item_no <= 7))
);

comment on table public.requirement_library_items is
  'Shipped regulatory reference content: the twelve items of Додаток Н positions '
  'Н.14 and Н.15 (technical/requirements/dbn-a31-5-2016-dodatok-n.csv). Content is '
  'a repository change under docs/product/hidden-works-content-rules.md, never a '
  'runtime command — there is no create operation in scope-v0.1.csv. Rows are '
  'workspace-scoped because entity-catalog.csv and relationship-catalog.csv scope '
  'them so and INV-001 needs a tenant-safe key; domain-model.md calls the content '
  'workspace-independent, and both are honoured because a rule version COPIES the '
  'quoted text, its verification tag and its source into its own immutable content, '
  'so no tenant obligation depends on a shared row. EXTERNAL GATE: adding a '
  'position beyond Н.14/Н.15 needs the same primary-source verification that '
  'produced these twelve rows (ADR-005 assumption c). It is a content-sourcing '
  'programme, not a schema change.';

comment on column public.requirement_library_items.verification is
  'INV-073, storage half. VERIFIED_PRIMARY on every Додаток Н row rests on one '
  'download of the official ДБН file that no reviewer can reopen — no URL, no '
  'retrieval date, no hash were recorded (hidden-works-content-rules.md §"Open '
  'items"). A re-fetch that does not reproduce the same bytes must downgrade every '
  'row it touches to VERIFIED_SECONDARY. UNVERIFIED is not a storable value.';

-- ===========================================================================
-- 2. requirement_rule_versions — the immutable published obligation
--
-- The nine pinned fields of ADR-005 decision 2 (evidence_kind,
-- acceptance_criterion, norm_ref, performer_role, approver_role,
-- intervention_type, blocking_scope, timing, and multiplicity — which is the
-- pair min_evidence_count/max_evidence_count in the DDL), plus the predicate
-- side.
--
-- The predicate narrows to (work type, stage) in v0.1: ADR-006 decision 4.2
-- moves locations and location-subtree bulk instantiation to v0.2.
-- location_predicate is kept as a jsonb column with an empty default because it
-- is part of ADR-005 decision 2's approved design and dropping it would make
-- v0.2 a schema change; nothing in v0.1 reads it, and no v0.1 command writes
-- anything but the default.
--
-- severity HAS NO COLUMN HERE. ADR-005 decision 4 retires it as a free axis: a
-- requirement's consequence is blocking_scope, and one column says so. The
-- deployed severity column on requirement_template_versions (0015:46) belongs to
-- the model this replaces (§10).
-- ===========================================================================
create table public.requirement_rule_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  -- Lineage key with no referent in v0.1 — see departure 1 in the header.
  requirement_rule_id uuid not null,
  version_no integer not null check (version_no >= 1),
  -- Position inside the ordered set of ADR-005 decision 2. THE ORDERING CLAIM IS
  -- CORRECTED HERE, in place: this comment said «the order is part of what was
  -- agreed», and nothing in v0.1 makes that true. `ordinal` defaults to 1 on
  -- every publication (packages/contracts/src/requirement-rules.ts), no
  -- constraint makes it distinct within a (work_type_key, stage_key), and both
  -- readers tie-break on a primary key — the bind read-back on `b.id`, M2's
  -- occurrence index on `id` (0043:718-720). The sequence a foreman is shown is
  -- therefore TOTAL and STABLE across reads, and arbitrary: it is part of what
  -- was DEFAULTED. Correcting a comment on this branch is not editing history —
  -- 0041 has never been applied anywhere.
  --
  -- WHY THE OBVIOUS CONSTRAINT IS THE WRONG ONE. `unique (workspace_id,
  -- work_type_key, stage_key, ordinal) where status = 'published'` would refuse
  -- version 2 of a lineage while version 1 is still published — and publication
  -- does NOT retire its predecessor (requirement_rule_versions.publish only
  -- inserts), so two published versions of one lineage coexist by design. That
  -- index would break versioning to fix ordering.
  --
  -- WHAT MAKING IT A CONSTRAINT ACTUALLY COSTS, so the choice is decidable
  -- rather than deferred by silence. The ordinal belongs to the LINEAGE, not to
  -- the version: every version of one requirement_rule_id must carry the same
  -- position, and distinct lineages within one predicate must carry distinct
  -- positions. Neither is a unique index over this table, because the tuple
  -- repeats once per version — both need public.requirement_rules, the lineage
  -- table ADR-006 decision 4.1 defers to v0.2. So no v0.1 migration owes an
  -- ordering constraint, 0045 included. The v0.1-shaped alternative costs no
  -- schema at all and is recorded as owed rather than written here: the shipped
  -- library is the only rule source in v0.1 (decision 4.1) and every row carries
  -- its own Додаток Н position, so requirement_rule_versions.publish could DERIVE
  -- the ordinal from the cited library item instead of accepting it, which would
  -- make the order the standard's own and identical for every version of a
  -- lineage. That is a change to a command contract and to a route this
  -- migration does not own (M1 review finding 6).
  ordinal integer not null check (ordinal >= 1),
  -- 'draft' is unreachable through any v0.1 command (there is no rule-drafting
  -- operation in scope-v0.1.csv and the INSERT policy in §9 refuses one), and it
  -- stays in the vocabulary so v0.2's drafting slice is additive.
  status text not null default 'draft'
    check (status in ('draft','published','retired')),

  -- ── predicate side ──────────────────────────────────────────────────────
  work_type_key text not null check (length(btrim(work_type_key)) > 0),
  location_predicate jsonb not null default '{}'::jsonb,
  stage_key text not null check (length(btrim(stage_key)) > 0),

  -- ── requirement side ────────────────────────────────────────────────────
  -- All three types and all four scopes stay storable. The two v0.1 refusals
  -- are the publication command's (INV-082) — see departure 2 in the header.
  intervention_type text not null
    check (intervention_type in ('hold','witness','review')),
  blocking_scope text not null
    check (blocking_scope in ('none','blocks_stage_closure','blocks_package_inclusion','blocks_both')),
  timing text not null
    check (timing in ('before_work','during','before_concealment','after','before_package')),
  evidence_kind text not null
    check (evidence_kind in ('photo','measurement','document','checkbox')),
  acceptance_criterion text not null check (length(btrim(acceptance_criterion)) > 0),
  performer_role text not null check (length(btrim(performer_role)) > 0),
  approver_role text not null check (length(btrim(approver_role)) > 0),
  -- INV-085 is a command refusal, not a CHECK: while M5 is open a `hold` must
  -- name an INTERNAL approver role, and M5 lifts that restriction by the same
  -- change that ships the occurrence grant. A CHECK here would have to be
  -- dropped to lift it, and dropping a CHECK is the migration nobody reviews.
  approver_is_external boolean not null default false,
  min_evidence_count integer not null default 1 check (min_evidence_count >= 1),
  max_evidence_count integer
    check (max_evidence_count is null or max_evidence_count >= min_evidence_count),
  allowed_media jsonb not null default '[]'::jsonb,
  form_schema jsonb,
  exception_policy jsonb not null default '{}'::jsonb,

  -- ── the normative citation, COPIED into immutable content ───────────────
  -- Never a live reference: an occurrence pins this version, and a library row
  -- corrected later must not silently change an obligation already agreed.
  norm_ref text,
  norm_ref_verification text
    check (norm_ref_verification in ('VERIFIED_PRIMARY','VERIFIED_SECONDARY')),
  norm_ref_source text,
  -- provenance of the copied text, not its authority; nullable — departure 3.
  requirement_library_item_id uuid,

  rule_version_hash text check (rule_version_hash ~ '^[0-9a-f]{64}$'),
  published_at timestamptz,
  published_by_member_id uuid,
  retired_at timestamptz,
  retired_by_member_id uuid,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),

  -- The literal discriminator the binding resolves against — departure 4.
  -- Monotone by construction: the draft CHECK below forces it false for a draft,
  -- the published CHECK forces it true for anything else, and retirement never
  -- clears published_at, so a bound version stays retirable.
  has_been_published boolean generated always as (published_at is not null) stored,

  unique (workspace_id, id),
  -- the binding cannot claim a version belongs to a rule it does not
  unique (workspace_id, requirement_rule_id, id),
  -- one rule, one version number — the lineage key that survives the absence of
  -- public.requirement_rules in v0.1
  unique (workspace_id, requirement_rule_id, version_no),
  -- the binding pins the stage the version itself names, so it cannot misreport
  -- the baseline's stage vocabulary
  unique (workspace_id, id, stage_key),
  -- the M2 anchor: requirement_occurrences copies intervention_type and must be
  -- unable to misreport it (INV-066). Declared here rather than in M2 because
  -- adding a unique constraint to a populated immutable table is a migration
  -- that can fail on data, and this one cannot: the table is empty.
  unique (workspace_id, id, intervention_type),
  -- FK target for the binding's published-only discriminator
  unique (workspace_id, id, has_been_published),

  foreign key (workspace_id, requirement_library_item_id)
    references public.requirement_library_items (workspace_id, id),
  foreign key (workspace_id, published_by_member_id)
    references public.memberships (organization_id, id),
  foreign key (workspace_id, retired_by_member_id)
    references public.memberships (organization_id, id),
  foreign key (workspace_id, created_by_member_id)
    references public.memberships (organization_id, id),

  -- ADR-005 decision 4's table, minus the row ADR-006 decision 4.4 amends.
  constraint requirement_rule_versions_witness_scope_check
    check (intervention_type <> 'witness'
        or blocking_scope in ('none','blocks_stage_closure','blocks_both')),
  constraint requirement_rule_versions_review_scope_check
    check (intervention_type <> 'review'
        or blocking_scope in ('none','blocks_package_inclusion','blocks_both')),

  -- INV-073: a normative string without BOTH a tag and a source is
  -- unrepresentable, so a contributor cannot introduce one by editing a
  -- template. btrim for the same reason as the library's source_citation.
  constraint requirement_rule_versions_norm_ref_sourced_check
    check (norm_ref is null
        or (norm_ref_verification is not null
            and length(btrim(coalesce(norm_ref_source, ''))) > 0)),

  constraint requirement_rule_versions_published_check
    check (status = 'draft'
        or (rule_version_hash is not null
            and published_at is not null
            and published_by_member_id is not null)),
  -- Makes has_been_published exactly equivalent to `status <> 'draft'`. Without
  -- it a row could sit at 'draft' with published_at set and become bindable.
  constraint requirement_rule_versions_draft_check
    check (status <> 'draft'
        or (published_at is null and published_by_member_id is null
            and rule_version_hash is null
            and retired_at is null and retired_by_member_id is null)),
  constraint requirement_rule_versions_retired_check
    check (status <> 'retired'
        or (retired_at is not null and retired_by_member_id is not null)),
  -- retirement follows publication; nothing is retired that was never published
  constraint requirement_rule_versions_retirement_order_check
    check (retired_at is null or published_at is not null)
);

create index requirement_rule_versions_predicate_idx
  on public.requirement_rule_versions (workspace_id, work_type_key, stage_key)
  where status = 'published';
create index requirement_rule_versions_library_idx
  on public.requirement_rule_versions (workspace_id, requirement_library_item_id);

comment on table public.requirement_rule_versions is
  'Publish or retire only, never updated (INV-067): no UPDATE grant to aktflow_app, '
  'plus the frozen-content guard app.guard_requirement_rule_version(). Retirement '
  'stops FUTURE binding and changes nothing about a baseline or an occurrence that '
  'already pinned this identity — which is why it is a trigger on the binding and '
  'not a foreign key. severity as a free axis is retired (ADR-005 decision 4): a '
  'requirement''s consequence is blocking_scope, and one column says so. '
  'requirement_rule_id has no referent in v0.1 because ADR-006 decision 4.1 keeps '
  'public.requirement_rules out of it; the missing FK is deliberate.';

comment on column public.requirement_rule_versions.blocking_scope is
  'All four scopes are storable and the v0.1 restriction is the publication '
  'command''s (INV-082): a v0.1 hold is blocks_stage_closure, not blocks_both '
  '(ADR-006 decision 4.4). schema-v0.1.sql:997 carries the opposite CHECK and is '
  'deliberately not transcribed — it would make every v0.1 hold unstorable. THE '
  'v0.2 PACKAGE MILESTONE OWES A MIGRATION that widens every v0.1 hold to '
  'blocks_both, with a test that fails if one row is left behind (INV-066).';

comment on column public.requirement_rule_versions.has_been_published is
  'Literal discriminator for contract_version_rule_bindings, in place of the '
  'copied-status technique of 0023:40-48. A copied ''published'' literal would be '
  're-validated when the version is retired and would make retirement fail for '
  'every version a baseline had bound; this column is monotone, so binding a draft '
  'stays unrepresentable and retiring a bound version stays possible.';

-- ===========================================================================
-- 3. contract_version_rule_bindings — the set the baseline pins
--
-- ADR-005 decision 2: rules bind at contract-baseline publication, in the same
-- act that pins party, currency, tax, terms and approval policy. The set of
-- stage_key values bound to a contract version IS that version's stage
-- vocabulary, which is what lets M2 materialise stages and occurrences from one
-- binding rather than from a member command.
-- ===========================================================================
create table public.contract_version_rule_bindings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id),
  project_id uuid not null,
  contract_id uuid not null,
  contract_version_id uuid not null,
  requirement_rule_id uuid not null,
  requirement_rule_version_id uuid not null,
  -- carried from the pinned version and pinned to it by FK below
  stage_key text not null,
  -- Literal discriminator: NOT NULL and CHECK-forced true, so the composite FK
  -- can only resolve against a version whose generated has_been_published is
  -- true. Binding a draft is unrepresentable, not rejected in one route.
  bound_rule_version_is_published boolean not null default true
    check (bound_rule_version_is_published),
  bound_at timestamptz not null default now(),
  bound_by_member_id uuid not null,

  unique (workspace_id, id),
  unique (workspace_id, project_id, contract_id, contract_version_id, id),
  -- ONE RULE CONTRIBUTES AT MOST ONE VERSION TO A BASELINE. Two versions of the
  -- same rule inside one published contract version would make "what was agreed"
  -- ambiguous, and reproducibility is the whole point of the binding. This is
  -- also the constraint that carries requirement_rule_id's meaning while
  -- public.requirement_rules does not exist.
  unique (workspace_id, contract_version_id, requirement_rule_id),
  unique (workspace_id, contract_version_id, requirement_rule_version_id),

  foreign key (workspace_id, project_id, contract_id, contract_version_id)
    references public.contract_versions (workspace_id, project_id, contract_id, id),
  -- the version must belong to the rule the binding names
  foreign key (workspace_id, requirement_rule_id, requirement_rule_version_id)
    references public.requirement_rule_versions (workspace_id, requirement_rule_id, id),
  -- the binding cannot misreport the stage its rule version names
  foreign key (workspace_id, requirement_rule_version_id, stage_key)
    references public.requirement_rule_versions (workspace_id, id, stage_key),
  -- THE GUARANTEE THAT REPLACES THE ONE §10 RETIRES. 0015:104-107 and
  -- 0023:40-48 made "the pinned template exists in this workspace and is
  -- published" structural. Once nothing writes
  -- work_assignments.requirement_template_version_id those two FKs guarantee
  -- nothing, because the value is always NULL. Retiring the old pin without
  -- rebuilding the guarantee on the new path is a net loss of enforcement, not
  -- a refactor — so it is rebuilt here, by the same technique, before the pin
  -- stops being written in M2.
  constraint contract_version_rule_bindings_published_version_fkey
    foreign key (workspace_id, requirement_rule_version_id, bound_rule_version_is_published)
    references public.requirement_rule_versions (workspace_id, id, has_been_published),
  foreign key (workspace_id, bound_by_member_id)
    references public.memberships (organization_id, id)
);

create index contract_version_rule_bindings_stage_idx
  on public.contract_version_rule_bindings (workspace_id, contract_version_id, stage_key);
create index contract_version_rule_bindings_version_idx
  on public.contract_version_rule_bindings (workspace_id, requirement_rule_version_id);

comment on table public.contract_version_rule_bindings is
  'Pins the exact rule-version set to a contract version at baseline publication '
  '(ADR-005 decision 2). A rule published after that baseline does not retroactively '
  'enter it (INV-080). The set of stage_key values bound to a contract version IS '
  'that version''s stage vocabulary. Append-only: no UPDATE or DELETE grant and a '
  'mutation-rejecting trigger. INV-080''s "no later insert path for an existing '
  'contract version" is NOT enforced here — see the header — because '
  'public.contract_versions has no draft lifecycle in the runtime; it lands in the '
  'migration that opens the draft -> published transition for contract versions.';

-- ===========================================================================
-- 4. The capability vocabulary must grow with the route set
--
-- Same reason as 0016:15-26: the CHECK added by 0010:178 predates
-- rule_bindings.manage, so without this widening no grant for
-- contract_versions.bind_rules could be written at all and the RLS policy in §9
-- would be unsatisfiable. capabilities.csv:10 dates the capability v0.1-M1.
-- This is a WIDENING; every value previously accepted is still accepted.
--
-- THIS MIGRATION ALONE TURNS packages/testing/src/capability-vocabulary.test.ts
-- RED, AND THAT IS THE TEST DOING ITS JOB. It asserts that the database CHECK
-- and the zod enum `projectCapability` (packages/contracts/src/project-access.ts:11)
-- enumerate the SAME set, because the vocabulary is stated in three places and
-- derived in none, and v0.1-M2-A shipped a slice whose grants were rejected with
-- a 422 the fixtures swallowed. Two of the three places must move with this
-- migration, in the same slice and not in a later one:
--   packages/contracts/src/project-access.ts:11  projectCapability zod enum
--   packages/domain/src/authz.ts:9               ProjectCapability union
-- Deferring the widening instead is the worse option: the §9 insert policy would
-- name a capability no grant row could ever hold, and contract_versions.bind_rules
-- would fail at grant time with exactly the 422 that test was written after.
-- ===========================================================================
alter table public.project_access_grants
  drop constraint project_access_grants_capability_check;
alter table public.project_access_grants
  add constraint project_access_grants_capability_check
  check (capability = any (array[
    'project.admin','project.view','contracts.edit','imports.manage','imports.publish',
    'assignments.manage','progress.record','progress.adjust','evidence.record',
    'rule_bindings.manage']));

-- ===========================================================================
-- 5. Grants allowlist
--
-- NO UPDATE and NO DELETE on any of the three. Every one of them is an
-- immutable_snapshot in entity-catalog.csv, and the only mutation v0.1 performs
-- on any of them — retirement — goes through the SECURITY DEFINER command in §7,
-- so the application role never holds the privilege that would make INV-067 a
-- convention.
--
-- Route by route, so an unused grant is visible:
--   requirement_library_items    SELECT  requirement_library.list
--                                INSERT  the per-workspace materialisation of
--                                        repository content (open decision, §1)
--   requirement_rule_versions    SELECT  requirement_library.list's join,
--                                        contract_versions.bind_rules,
--                                        M2 occurrence materialisation
--                                INSERT  requirement_rule_versions.publish
--   contract_version_rule_bindings
--                                SELECT  contract_versions.get, M2 materialisation
--                                INSERT  contract_versions.bind_rules and
--                                        import_batches.publish (INV-083 holds on
--                                        BOTH routes to a published baseline or it
--                                        holds on neither)
-- aktflow_service gets nothing: none of these three records a server-observed
-- fact, so 0035's server-only plane does not apply.
-- ===========================================================================
revoke all on public.requirement_library_items, public.requirement_rule_versions,
  public.contract_version_rule_bindings
  from public, anon, authenticated;

grant select, insert on public.requirement_library_items       to aktflow_app;
grant select, insert on public.requirement_rule_versions       to aktflow_app;
grant select, insert on public.contract_version_rule_bindings  to aktflow_app;

-- ===========================================================================
-- 6. Append-only and frozen-content enforcement — the layer beyond grants
--
-- app.reject_mutation() is 0013:5-9 and is reused unchanged.
-- ===========================================================================
create trigger requirement_library_items_immutable before update or delete
  on public.requirement_library_items
  for each row execute function app.reject_mutation();

create trigger contract_version_rule_bindings_immutable before update or delete
  on public.contract_version_rule_bindings
  for each row execute function app.reject_mutation();

-- INV-067: publish or retire only. The ONLY update this table admits is
-- published -> retired, setting exactly retired_at and retired_by_member_id.
--
-- The content comparison is whole-row rather than column-by-column, and that is
-- the one place this guard departs from app.guard_template_version() (0016:64-83).
-- That function names six columns (evidence_type, allowed_media, multiplicity,
-- severity, template_key, version_no); seven others — timing, condition_expr,
-- form_schema, the three policy objects and template_hash — are not compared, and
-- a column added by a later migration would not be compared either. This is a
-- reading of 0016:73-79, not a defect reproduced from a test run. Comparing
-- to_jsonb(new) minus the retirement keys means a column added after this
-- migration is frozen from the moment it exists, without anybody remembering to
-- extend a list.
--
-- has_been_published is stripped from BOTH sides, and that is not tidiness.
-- PostgreSQL computes stored generated columns AFTER a BEFORE trigger has run,
-- so NEW's copy is not populated here while OLD's is. Compared, every retirement
-- would look like a content change and this guard would reject the one transition
-- it exists to permit. The column is a function of published_at, which IS
-- compared, so stripping it loses no coverage.
-- The ::text casts are explicit because `jsonb - 'literal'` has three candidate
-- operators (text, integer, text[]) and an unknown-typed literal resolves by
-- category rule rather than by anything a reader can see.
create or replace function app.guard_requirement_rule_version() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'requirement rule versions are not deletable (INV-067)';
  end if;

  if old.status <> 'published' or new.status <> 'retired' then
    raise exception
      'requirement rule version % admits only the published -> retired transition (INV-067); attempted % -> %',
      old.id, old.status, new.status;
  end if;

  if new.retired_at is null or new.retired_by_member_id is null then
    raise exception 'retiring rule version % must record retired_at and the retiring member', old.id;
  end if;

  if (to_jsonb(new) - 'status'::text - 'retired_at'::text
                    - 'retired_by_member_id'::text - 'has_been_published'::text)
     is distinct from
     (to_jsonb(old) - 'status'::text - 'retired_at'::text
                    - 'retired_by_member_id'::text - 'has_been_published'::text) then
    raise exception 'retirement must not alter frozen rule-version content (INV-067)';
  end if;

  return new;
end $$;
revoke all on function app.guard_requirement_rule_version() from public;

create trigger requirement_rule_versions_guard before update or delete
  on public.requirement_rule_versions
  for each row execute function app.guard_requirement_rule_version();

-- ===========================================================================
-- 7. Retirement: the only write path, and it resolves its own actor
--
-- There is no UPDATE grant on requirement_rule_versions, so
-- requirement_rule_versions.retire cannot be a route UPDATE. It is this
-- function, and it follows the pattern 0011:7-12 documents and 0017 corrected:
-- a SECURITY DEFINER bypasses RLS, so authorization is the function's own job,
-- the actor comes from app.current_actor() and never from an argument, and the
-- authorization runs BEFORE anything is read so a raise message cannot become a
-- cross-tenant oracle.
-- ===========================================================================
create or replace function app.retire_requirement_rule_version(
  p_workspace uuid, p_rule_version uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_member uuid;
  v_status text;
begin
  v_member := app.active_member_id(p_workspace);
  if v_member is null or app.member_role(p_workspace) not in ('owner','admin') then
    raise exception 'not authorized to retire a requirement rule version in this workspace';
  end if;

  select status into v_status
    from public.requirement_rule_versions
   where workspace_id = p_workspace and id = p_rule_version;

  if v_status is null then
    raise exception 'unknown requirement rule version';
  end if;
  -- Retirement is idempotent by state: the operation is idempotency-required in
  -- scope-v0.1.csv:30 and a replay must not raise.
  if v_status = 'retired' then
    return;
  end if;
  if v_status <> 'published' then
    raise exception 'only a published requirement rule version can be retired';
  end if;

  update public.requirement_rule_versions
     set status = 'retired', retired_at = now(), retired_by_member_id = v_member
   where workspace_id = p_workspace and id = p_rule_version;
end $$;
revoke all on function app.retire_requirement_rule_version(uuid, uuid) from public;
grant execute on function app.retire_requirement_rule_version(uuid, uuid) to aktflow_app;

-- ===========================================================================
-- 8. Retirement stops FUTURE binding
--
-- This cannot be a foreign key: the same key must keep resolving for every
-- binding made before the retirement, because retiring a rule «changes nothing
-- about an occurrence that already pinned this identity». A BEFORE INSERT
-- trigger evaluates the condition at the only moment it applies.
--
-- Not SECURITY DEFINER: it reads under the inserting role, and if RLS hides the
-- rule version the insert fails closed rather than proceeding on a NULL.
-- ===========================================================================
create or replace function app.guard_rule_binding() returns trigger
language plpgsql as $$
declare
  v_status text;
begin
  select status into v_status
    from public.requirement_rule_versions
   where workspace_id = new.workspace_id and id = new.requirement_rule_version_id;

  if v_status is null then
    raise exception 'requirement rule version % is not visible in this workspace',
      new.requirement_rule_version_id;
  end if;
  if v_status <> 'published' then
    raise exception
      'requirement rule version % is % and cannot be bound to a baseline (INV-067)',
      new.requirement_rule_version_id, v_status;
  end if;

  return new;
end $$;
revoke all on function app.guard_rule_binding() from public;

create trigger contract_version_rule_bindings_rule_version_guard before insert
  on public.contract_version_rule_bindings
  for each row execute function app.guard_rule_binding();

-- ===========================================================================
-- 9. RLS
--
-- Every write policy names what the route checks. 0014 exists because M1's write
-- policies asked only for active membership, so the database could not catch a
-- command-layer mistake; 0016:90-93 says that must not recur, and it does not
-- recur here.
-- ===========================================================================
alter table public.requirement_library_items      enable row level security;
alter table public.requirement_rule_versions      enable row level security;
alter table public.contract_version_rule_bindings enable row level security;

-- The library is workspace-scoped reference content: any active member reads it,
-- because requirement_library.list is a member-plane query and the foreman who
-- reads an occurrence reads the text behind it.
create policy rli_select on public.requirement_library_items for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
-- INSERT is the materialisation of repository content at workspace provisioning,
-- performed by the owner who creates the workspace inside the same transaction
-- (apps/app/app/v1/workspaces/route.ts inserts the owner membership first, so
-- app.member_role already resolves). IF THE OPEN DECISION IN §1 RESOLVES TO
-- SEED-ON-FIRST-READ, this policy is what has to widen, and widening it is a
-- policy replacement in the slice that ships it.
create policy rli_insert on public.requirement_library_items for insert to aktflow_app
  with check (app.member_role(workspace_id) in ('owner','admin'));

-- Rule versions are workspace governance: any active member reads (baselines
-- across projects bind them), owner/admin writes — the same role mapping
-- packages/domain/src/authz.ts uses for workspace capabilities, which is where
-- requirement_rules.manage (capabilities.csv:9) lands.
create policy rrv_select on public.requirement_rule_versions for select to aktflow_app
  using (app.active_member_id(workspace_id) is not null);
-- status = 'published' in the WITH CHECK is a v0.1 shape and is deliberate: v0.1
-- has no rule-drafting operation, there is no UPDATE grant, and the guard admits
-- only published -> retired — so a draft inserted here could never be published
-- and would be a permanently dead obligation. Making it unrepresentable is
-- cheaper than documenting it. v0.2's drafting slice REPLACES this policy and
-- adds the publication path; replacing a policy is additive (0023:77-78 is the
-- precedent) and the CHECK vocabulary already carries 'draft'.
create policy rrv_insert on public.requirement_rule_versions for insert to aktflow_app
  with check (app.member_role(workspace_id) in ('owner','admin')
              and status = 'published');

create policy cvrb_select on public.contract_version_rule_bindings for select to aktflow_app
  using (app.has_project_capability(workspace_id, project_id,
         array['project.view','project.admin']));
-- Two capabilities, because there are two routes to a published baseline and
-- INV-083 must hold on both: contract_versions.bind_rules runs under
-- rule_bindings.manage, and import_batches.publish runs under imports.publish
-- and must be able to pin the same set in its own publish transaction.
create policy cvrb_insert on public.contract_version_rule_bindings for insert to aktflow_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['rule_bindings.manage','imports.publish']));

-- ===========================================================================
-- 10. Retiring the previous model, additively
--
-- Nothing below drops anything. Applied migrations are append-only history and
-- 0015 created these objects; what changes is what the database SAYS about them,
-- so a reader of the catalog does not have to reconstruct the decision from an
-- ADR they may not know exists.
-- ===========================================================================
comment on table public.requirement_template_versions is
  'RETIRED, NOT DEFERRED — ADR-005 decision 2 and glossary.md retire this model, '
  'and entity-catalog.csv:30 records the same. The one-optional-template-per-'
  'assignment model cannot express a set, cannot vary by stage or location, and is '
  'absent by default, which is the same as having no gate. It is SUPERSEDED BY '
  'public.requirement_rule_versions plus public.contract_version_rule_bindings '
  '(migration 0041). The table is not dropped because applied migrations are '
  'append-only history, and it keeps its v0.1-M2 marker because that is where it '
  'exists in the runtime, not because v0.1 builds it. It is not extended, ever. '
  'STILL OWED: its two authoring routes (requirement_templates.create/.publish, '
  'v0.1-M1 rows of scope-v0.1.csv), the requirement_templates.manage capability in '
  'packages/domain/src/authz.ts, its @goproceed/contracts module and the '
  'requirement_owner responsibility preset are live in running code, so v0.1 still '
  'ships a way to author a retired model. That removal is scheduled into v0.1-M2 '
  'rather than M1 because these routes are still the media-policy source the upload '
  'gate reads (see the next comment).';

comment on column public.requirement_template_versions.severity is
  'RETIRED AS A FREE AXIS (ADR-005 decision 4). A requirement''s consequence is '
  'blocking_scope, and one column says so; public.requirement_rule_versions carries '
  'blocking_scope and has no severity column. Nothing new reads this column.';

-- The column stays, is not CHECK-constrained, and here is why both halves of
-- that are the decision rather than the default.
--
-- NOT DROPPED: dropping it is destructive against applied history, and
-- apps/app/app/v1/contracts/[contractId]/assignments/route.ts:81 still writes it.
--
-- NOT YET FORBIDDEN BY CHECK: a `check (requirement_template_version_id is null)`
-- added here would take effect BEFORE public.requirement_occurrences exists, and
-- apps/app/app/v1/assignments/[assignmentId]/upload-intents/route.ts:54-65 reads
-- allowed_media off the pinned template — «the pinned template is the authority on
-- what may be uploaded». With the pin permanently NULL, :57 is never entered and
-- EVERY upload silently falls back to FALLBACK_MEDIA (:16-20) — 50 MB and four MIME
-- types for every requirement in the product — while the malformed-allowed_media
-- CHECK of 0023:57-63, which exists precisely so a bad shape cannot widen the gate,
-- stops being reachable at the same moment. Nothing fails; the gate just gets wider,
-- which is the failure mode ADR-005 is written against.
-- The order is therefore: M2 adds the occurrence as the media source, THEN the
-- write stops, THEN the CHECK lands and the template read is removed — one
-- migration and one route change, not two releases.
comment on column public.work_assignments.requirement_template_version_id is
  'RETIRED (ADR-005 decision 2; entity-catalog.csv:22). Superseded by requirement '
  'occurrences materialised at assignment creation from the rule versions the '
  'published contract version binds (migration 0041). NOT DROPPED: applied '
  'migrations are append-only and the assignments route still writes it. NOT YET '
  'CHECK-CONSTRAINED TO NULL: it is still the live media-policy source for '
  'upload_intents.create, and forbidding it before requirement_occurrences exists '
  'would silently widen every upload to the route''s FALLBACK_MEDIA and make the '
  '0023 allowed_media CHECK unreachable. The CHECK belongs to the v0.1-M2 migration '
  'that makes the occurrence the media source, in that order. Until then the two '
  'composite FKs of 0015:104-107 and 0023:45-48 still guarantee that a pinned '
  'template exists and is published; the equivalent guarantee on the new path is '
  'contract_version_rule_bindings_published_version_fkey.';
