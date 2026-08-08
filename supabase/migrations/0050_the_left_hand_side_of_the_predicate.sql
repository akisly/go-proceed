-- 0050: the work type a line carries — the left-hand side of the rule predicate.
--
-- WHAT THIS ADDS
--   public.work_items.work_type_key            nullable text, with a shape CHECK
--   app.work_type_key_is_bindable(uuid,uuid,text)  the resolver, SECURITY DEFINER
--   app.guard_work_item_work_type()            a BEFORE INSERT OR UPDATE trigger
--                                              that refuses a key resolving to
--                                              nothing
--   two comment corrections in 0043 (in place — see §7), and one comment on the
--   new column.
--
-- WHAT THIS DOES NOT CHANGE
--   No table is created. No table is dropped. No column is dropped. No existing
--   constraint is weakened, no existing policy is replaced, no existing trigger
--   is dropped or recreated. Migrations 0001-0040 are applied history and are
--   not edited. No row is written. `aktflow_app` gains no privilege on any
--   table; the one new EXECUTE grant is on the resolver.
--
--   IN PARTICULAR: THE COLUMN IS ADDITIVE AND NULLABLE, AND NULL KEEPS ITS
--   CURRENT MEANING. Every row public.work_items holds today — every line the
--   frozen importer wrote, and every line typed before this migration — gets
--   NULL, matches no rule, and continues to be disclosed as
--   `coverage: "work_type_unresolved"` on the assignment 201, in the occurrence
--   list and in the dry run's per-line verdict. A null key is NOT an error and
--   this migration does not make it one. What it stops being is the ONLY
--   possible value.
--
-- ROLLBACK
--   Dev only, and only while no line carries a work type:
--     drop trigger work_items_work_type_guard on public.work_items;
--     drop function app.guard_work_item_work_type();
--     drop function app.work_type_key_is_bindable(uuid, uuid, text);
--     alter table public.work_items
--       drop constraint work_items_work_type_key_shape_check,
--       drop column work_type_key;
--   ONCE ONE PUBLISHED BASELINE CARRIES A TYPED LINE THERE IS NO ROLLBACK.
--   Dropping the column destroys the only record of what the parties agreed the
--   work WAS, and a published contract version is immutable (INV-015), so the
--   value cannot be retyped into it. Worse, occurrences already materialised
--   from that key stay — they pin rule versions (INV-066/INV-067) and do not
--   read this column at read time — so the rollback would leave obligations in
--   force whose derivation is no longer legible. Staging and production take a
--   corrective forward migration instead.
--
-- ===========================================================================
-- WHY THIS SLICE EXISTS, AND WHAT IT IS ANSWERABLE TO
--
-- ADR-006 decision 1 step 1: ПТВ «enters the work lines BY HAND, PICKS A WORK
-- TYPE, and the requirements load from the shipped ДБН library». The picking has
-- had no carrier. `requirement_rule_versions.work_type_key` (0041:326) is the
-- predicate's right-hand side; glossary.md:109 says the left-hand side is
-- «carried as work_type_key ON THE WORK ITEM and on the rule version»; and
-- public.work_items has carried no such column since 0012:219-268. So
-- `workTypeKeyOf` in apps/app/src/lib/requirement-materialisation.ts returns
-- null for every line, `matchesLine` is false for every bound rule, and ZERO
-- OCCURRENCES MATERIALISE IN ANY REAL PILOT: every stage is empty, every
-- closure is vacuous, and ADR-008's admission event proves nothing. The gate is
-- structurally sound and has never fired.
--
-- (CITED BY NAME, NOT BY LINE. This read «requirement-materialisation.ts:141»
-- until 2026-08-08, by which time :141 was a comment line inside that
-- function's own docblock and `workTypeKeyOf` had moved to :171. A line number
-- into a file the same slice is editing is stale before the slice lands; the
-- symbol is the citation and the file is small enough to grep.)
--
-- 0043's header raised this at the boundary and refused to close it by writing
-- DDL on the way past, because glossary.md:109 also says giving work type an
-- OWNING FACT «is a scope decision an ADR must make». THAT SENTENCE AND THIS
-- MIGRATION ARE ABOUT DIFFERENT THINGS, and the distinction is the whole
-- licence for this file:
--
--   * the CARRIER — a column on the work line holding the key the rule
--     predicate is matched against — is required in terms by an APPROVED ADR
--     (ADR-006 decision 1 step 1). It is added here.
--   * the OWNING ENTITY — a table that DEFINES the set of work types, with an
--     operation that creates one and a capability that governs it — is the
--     scope decision glossary.md defers. IT IS NOT TAKEN HERE. See §3.
--
-- ===========================================================================
-- 0. THE CONSTRAINT THAT DECIDES THE SHAPE
--
-- A wrong work type must not be absorbable. One typo in a key — «montazh» for
-- «montazhni-roboty» — and the line matches no bound rule, no occurrence
-- materialises, the stage closes vacuously, the act is composed over an empty
-- obligation set, and EVERY PER-ROW CONSTRAINT IN THIS DATABASE STILL PASSES.
-- That is the same failure the stub avoids loudly, reintroduced silently and
-- one row at a time instead of product-wide. A carrier whose wrong value is
-- indistinguishable from its right value is not a fix; it is the original
-- defect with better manners.
--
-- So the slice owes two things, at two different moments, and they are NOT the
-- same rule:
--
--   WRITE PATH — REFUSE. A key that resolves to nothing in this workspace is a
--   typo with no benign reading. It is refused when the line is written (§4,
--   §5), because that is the moment the person who typed it is present and can
--   correct it. Deferring it to publication would report it to whoever presses
--   publish, days later, about a line they did not type.
--
--   PUBLISH PATH — MAKE IT VISIBLE. A key that resolves in the workspace but
--   matches no rule version BOUND TO THIS BASELINE is ambiguous: either the
--   binding is incomplete, or this contract genuinely does not carry that
--   obligation. ADR-006 decision 4.2 settles what to do with the ambiguous
--   case in terms — «a work type with no matching rule must still be NAMED IN
--   THE COMMAND'S OUTPUT, because silent non-coverage means there is no gate».
--   Named, not refused. That belongs in contract_versions.publish and is not a
--   constraint; see §6.1 for the division and for the one case that IS refused
--   there — total disjointness between the typed lines and the bound set, in
--   either of its two shapes, typed-but-unmatched and all-untyped.
--
-- ===========================================================================
-- 1. THE COLUMN
--
-- `alter table … add column <nullable, no default>` is catalog-only in
-- PostgreSQL 11+: no table rewrite, an ACCESS EXCLUSIVE lock held for the
-- catalog update. On pilot-scale tables that is a moment, and it is stated
-- rather than assumed (the same claim 0043 §1 makes for its uniques).
--
-- THE SHAPE CHECK IS STRICTER THAN THE RULE SIDE'S, DELIBERATELY — AND IT IS
-- NOT AS STRICT AS THIS COMMENT ONCE CLAIMED. 0041:326 has
-- `check (length(btrim(work_type_key)) > 0)` on the rule version, which admits
-- a padded key — ' montazh ' is storable there. This column refuses SPACE
-- padding, because BOTH comparisons that matter are exact string equality:
-- app.work_type_key_is_bindable below, and `matchesLine` in
-- apps/app/src/lib/requirement-materialisation.ts. Normalising in one of them
-- and not the other is how two comparisons come to disagree, which is the exact
-- failure class this slice exists to remove.
--
-- SPACE PADDING, NOT PADDING. CORRECTED 2026-08-08: this paragraph read «this
-- column refuses padding OUTRIGHT», which overstates what the CHECK does.
-- PostgreSQL's one-argument `btrim(string)` removes the longest run of the
-- characters in its `characters` argument, WHICH DEFAULTS TO A SINGLE SPACE
-- (U+0020). It is not a whitespace trim. So `work_type_key = btrim(...)`
-- refuses ' montazh ' and ADMITS E'\tmontazh', E'montazh\n', E'\rmontazh' and
-- a key padded with U+00A0. The claim stood in three places and all three are
-- corrected together: this paragraph; the `workTypeKey` comment on
-- `createWorkItemRequest` in packages/contracts/src/work-items.ts; and the
-- `workTypeKeyOf` docblock in apps/app/src/lib/requirement-materialisation.ts.
-- The `comment on column` at the end of §5 never made the claim and is
-- unchanged.
--
-- WHAT ACTUALLY KEEPS A TAB-PADDED KEY OUT TODAY, since the CHECK does not —
-- two things, and neither is this constraint:
--   1. `z.string().trim()` on every wire that can write one: work_items.create
--      and work_items.update (packages/contracts/src/work-items.ts) on the line
--      side, requirement_rules.publish (requirement-rules.ts:83) on the rule
--      side. Zod's `.trim()` applies JavaScript's `String.prototype.trim`,
--      which IS a whitespace trim: its WhiteSpace set covers tab, newline, CR
--      and U+00A0. Both sides trim, which is why the two comparisons still
--      agree in practice.
--   2. the trigger, for the line side specifically. A key no published rule
--      version in the workspace carries resolves to nothing, so
--      `work_items_work_type_guard` raises on E'\tmontazh' whatever the shape
--      CHECK thinks — and no rule version can carry E'\tmontazh' because of 1.
-- The guarantee is therefore real but it is a ROUTE-LAYER guarantee with a
-- trigger behind it, not the row constraint this comment advertised. A future
-- writer that reaches public.work_items without Zod inherits 2, not 1.
--
-- THE CONSEQUENCE, NAMED RATHER THAN LEFT TO BE FOUND: a rule version published
-- with a SPACE-padded key would be UNMATCHABLE — no line could name it, because
-- no line can store the space-padded form and the trimmed form resolves to
-- nothing. That is a dead rule, and a dead rule that fails loudly at the first
-- line someone types against it. It is also unreachable today, for reason 1
-- above: the rule side trims before the row is written.
--
-- BOTH COLUMNS OWE A REAL TIGHTENING, and this file does not make it. On 0041
-- it would be the shape this column already has; on THIS column it would be a
-- whitespace predicate rather than a btrim identity, e.g.
--   check (work_type_key is null or (length(work_type_key) > 0
--          and work_type_key !~ '^[[:space:]]' and work_type_key !~ '[[:space:]]$'))
-- — stated as the direction and not as tested SQL, and with the caveat that
-- whether U+00A0 falls inside `[[:space:]]` depends on the database's ctype, so
-- a tightening that must cover it has to name the characters. NEITHER IS MADE
-- HERE: 0041 and 0050 are unapplied files whose COMMENTS this branch may
-- correct, and changing a CHECK is behaviour, which needs a NEW FILE.
--   THE NUMBER MOVED, so the pointer is written as a description first. This
--   line read «(0051 or later)». 0051 was claimed later on 2026-08-08 by
--   0051_the_stage_nobody_agreed_to.sql, which guards work_stages.stage_key and
--   carries neither tightening. The next free file is 0052 as the chain stands
--   on 2026-08-08; look for the migration that REPLACES
--   work_items_work_type_key_shape_check, not for a number. Corrected in place,
--   this file being unapplied.
-- Recorded as owed, on both columns.
--
-- Validation against existing rows cannot fail: the column is created in this
-- statement, so every existing row holds NULL and NULL satisfies the CHECK.
-- ===========================================================================
alter table public.work_items
  add column work_type_key text;

alter table public.work_items
  add constraint work_items_work_type_key_shape_check
  check (work_type_key is null
      or (work_type_key = btrim(work_type_key) and length(work_type_key) > 0));

-- ===========================================================================
-- 2. NO INDEX, AND THAT IS A DECISION
--
-- Nothing reads this column by predicate. Materialisation reads ONE line by id
-- (apps/app/app/v1/contracts/[contractId]/assignments/route.ts); the dry run and
-- contract_versions.publish read EVERY line of one contract version, which
-- `work_items_version_idx` (0012:269-270) already serves. An index whose only
-- justification is that the column looks like a lookup key is a write cost with
-- no reader, and this table is on the write path of every typed line.
--
-- The index that WOULD earn its place is the one a work-type vocabulary screen
-- needs — «which lines of this project are typed as X» — and no v0.1 operation
-- asks that question. It arrives with the operation that does.
-- ===========================================================================

-- ===========================================================================
-- 3. THE THREE OPTIONS, AND WHY THE MIDDLE ONE
--
-- OPTION A — a plain nullable text column, nothing else. REJECTED, and it is
-- the option that looks like the smallest diff. Its failure is §0's: a typo is
-- storable, matches nothing, and every downstream surface reports the SAME
-- honest-looking value a genuinely uncovered line reports. Under this option
-- `coverage: "no_matching_rule"` would mean either «this baseline does not
-- cover this work» or «somebody mistyped», with nothing able to tell them
-- apart. The disclosure that makes the current stub honest — a value a client
-- can switch on — becomes noise the moment the value has two causes.
--
-- OPTION B — the key must resolve to a rule version this workspace can bind,
-- enforced at write time. CHOSEN. §4 and §5.
--
-- OPTION C — a declared vocabulary table (say `public.work_types`) that the
-- rule version and the work line both reference by composite foreign key.
-- REJECTED HERE, and it is the cleanest design; the reason is scope and it is
-- arithmetic rather than taste.
--
--   IT IS AN ENTITY, AND entity-catalog.csv HAS NO ROW FOR IT. Adding one adds
--   a table to the v0.1 build list, and that list is not a local fact. It is
--   transcribed in FIVE places and pinned by a validator:
--
--     1. scripts/validate-canonical-docs.mjs:239-251 — ADR006_V01_BUILD_LIST
--        (26 names) and ADR006_V01_BUILD_TOTAL = 26. Guards 11-13 fail if the
--        array and the prose disagree; guard 11 fails in BOTH directions for
--        M3-M6, so a catalog row with no list entry is also a failure.
--     2. docs/decisions/ADR-006-pilot-shaped-v0.1.md decision 4's milestone
--        table — the list's own home, and the only one an owner may amend.
--     3. docs/product/roadmap.md:149 and :278 — «twenty-six v0.1 tables, of
--        which nine already have a table … Seventeen of the twenty-six».
--     4. docs/delivery/version-0.1.md:72 and :783 — the same two counts and
--        «the same twenty-six names», plus the per-milestone `v0.1 tables`
--        column that guard 13 projects through the catalog.
--     5. docs/README.md:190 — «twenty-six v0.1 tables have no table in any
--        applied migration».
--
--   Twenty-six becomes twenty-seven, seventeen becomes eighteen, one milestone
--   row gains a name, and the entity catalog gains a row. NONE OF THAT IS THE
--   OBJECTION. The objection is ADR-006's own «Replacement rule» 1, which rules
--   out exactly the three arguments this option would be carried by: «it is
--   already in the DDL», «the catalog has the row» and «IT IS ONE MORE TABLE»
--   are explicitly not reasons to add work to v0.1. The build list was last
--   amended by the owner (2026-08-06, moving it from 23 to 26); it is not a
--   thing a migration amends on its way to fixing something else. That is the
--   same discipline 0041 departure 1 applied to public.requirement_rules and
--   0043's header applied to this very column.
--
--   AND A TABLE ALONE WOULD NOT BE THE DESIGN ANYWAY. A vocabulary nobody can
--   DECLARE is not a declared vocabulary: option C needs an operation
--   (`work_types.create`, a 59th row in technical/openapi/scope-v0.1.csv, whose
--   58 are enumerated in docs/superpowers/plans/2026-08-06-v0.1-implementation-
--   progress.md §2), a capability governing it (capabilities.csv has none, and
--   a capability naming no operation is a guard-9 failure), a seeding decision
--   for the twelve Додаток Н rows that 0041 §1 already left open, and a
--   migration that adds the referencing FK to requirement_rule_versions — an
--   append-only, publish-only table (INV-067). It is a slice, not a column.
--
--   WHAT OPTION C WOULD BUY THAT OPTION B DOES NOT: a work type could exist
--   before any rule cites it, so a workspace could type «земляні роботи» on a
--   line and later publish rules for it. Under option B that order is
--   forbidden — see §5's residue. That is the real cost of this choice and it
--   is the reason option C should eventually win.
--
-- RECORDED AS OWED, PRECISELY: entity-catalog.csv row `work_stages` and
-- glossary.md:109 both say work type has no owning fact and that giving it one
-- is an ADR's decision. This migration does not change that sentence. It
-- changes only the sentence that said the key has nowhere to LIVE.
-- ===========================================================================

-- ===========================================================================
-- 4. THE RESOLVER
--
-- WHAT «RESOLVES» MEANS, at the only two moments a work line is written, and
-- why each is the strongest check available AT THAT MOMENT.
--
-- THE ORDERING PROBLEM IS REAL AND IS NOT WORKED AROUND. Rule versions are
-- published workspace-wide (requirement_rule_versions.publish) BEFORE they are
-- bound; a line is typed onto a DRAFT contract version (work_items.create,
-- 0042 §4's wi_insert) and the draft may have no bindings at all yet —
-- contract_versions.bind_rules can run after the last line is typed, and
-- nothing orders the two. So a create-time check CANNOT validate against
-- bindings: at that moment the set it would read is legitimately empty, and a
-- check against an empty set refuses every line in the product.
--
-- The check is therefore a DISJUNCTION of the two sources of vocabulary that
-- can exist at write time, and it is exactly «is this key a real key in this
-- workspace, right now»:
--
--   ARM 1 — the key is carried by a PUBLISHED rule version in this workspace.
--   This is the whole vocabulary before anything is bound, and it is the arm
--   that catches the typo. The vocabulary is emergent — no entity declares it
--   (§3) — so «published rule versions of this workspace» is not an
--   approximation of the vocabulary, it IS the vocabulary.
--
--   ARM 2 — the key is carried by a rule version BOUND TO THIS LINE'S OWN
--   contract version, whatever that version's current status. Without this arm
--   the check has a false refusal with a real shape: retirement
--   (app.retire_requirement_rule_version, 0041 §7) stops FUTURE binding and
--   changes nothing about a baseline that already bound the version (INV-067),
--   so a draft that bound R yesterday and had R retired today would be unable
--   to type a new line naming R's work type — while the occurrences that key
--   would materialise are exactly the ones the draft already agreed to.
--
-- Arm 2 is strictly narrower than the real predicate and arm 1 is strictly
-- wider; the union is what the database can honestly assert before publication.
-- The NARROW form — «matches a rule version bound to THIS version» — is the
-- real predicate, it is only computable once both sets exist, and it is checked
-- at publication, by the command, in §6.
--
-- SECURITY DEFINER, and here is the argument, which is 0042 §4's about
-- app.contract_version_is_draft:
--   * arm 1 discloses nothing new. `rrv_select` (0041 §9) admits ANY active
--     member of the workspace to public.requirement_rule_versions, and a caller
--     writing a work line has already passed requireActiveMembership. Under
--     SECURITY INVOKER this arm would read the same rows and return the same
--     answer.
--   * arm 2 is the reason. `cvrb_select` (0041 §9) requires project.view or
--     project.admin, and a ПТВ typing lines holds `contracts.edit`, which
--     0042's own comment says may be held WITHOUT project.view. Under SECURITY
--     INVOKER arm 2 would silently evaluate to false for exactly the person the
--     arm exists to protect, and the refusal would be unexplainable.
--   * the disclosure is bounded — BY THE CALLERS, NOT BY THE FUNCTION. As a
--     property of the function this bullet was false. It read «the disclosure
--     is bounded to a boolean about (a workspace the caller is an active member
--     of, a contract version the caller is at that moment writing a line into
--     under `contracts.edit`, a key the caller typed)», which describes the
--     arguments the callers pass and not the arguments the function accepts.
--     Corrected in place on 2026-08-08, this file being unapplied. The function's arm 2 takes `cv` as an argument and checks only
--     that the bindings it reads sit in `ws`; it never asks what the caller may
--     see of `cv`, so asked of an ARBITRARY contract version in a workspace the
--     caller belongs to it answers «this version binds a rule version carrying
--     this key» to a caller holding no project grant on it — the exact bit
--     `cvrb_select` (0041 §9) withholds. What is true is narrower:
--       — the only two callers are `requireBindableWorkType`
--         (apps/app/src/lib/manual-baseline.ts:107, behind work_items.create
--         and .update) and `app.guard_work_item_work_type()` (§5 below). Both
--         pass the contract version of the ROW BEING WRITTEN, never a version
--         the caller named;
--       — a row can only be written into a draft the caller holds
--         `contracts.edit` on: the trigger returns early on a NULL key (§5:471)
--         so the importer's published insert never reaches arm 2, and
--         `app.guard_work_item()` (0042 §3) refuses every update to a line of a
--         published version;
--       — so on every path that exists in v0.1 the additional bit really is
--         «this draft you are typing into binds a rule version carrying the key
--         you just typed», and arm 1 is open to every member anyway.
--     THAT IS A PROPERTY OF TODAY'S TWO CALLERS AND A THIRD WOULD NOT INHERIT
--     IT. apps/app/tests/work-type-carrier.int.test.ts:528-530 already calls the
--     resolver directly, which is the shape a future caller would take. The
--     narrowing that would make the bounded-disclosure claim a property of the
--     FUNCTION is one predicate — `and exists (select 1 from
--     public.contract_versions v where v.workspace_id = ws and v.id = cv and
--     v.status = 'draft')` on arm 2, aliased `v` so it does not shadow the `cv`
--     parameter — and it is behaviour-
--     preserving for both callers above, since a line can only be written into
--     a draft. IT IS NOT MADE HERE. The rule this branch works under is that an
--     unapplied migration's COMMENTS may be corrected in place, while anything
--     that changes what the database DOES — a CHECK, a trigger, a policy, a
--     function body — arrives as a new migration, so that a reader of the chain
--     is never asked to guess which version of a statement was the one anyone
--     reasoned about. So the predicate belongs in a NEW FILE, as a
--     `create or replace` of this function. THE NUMBER IS NOT THE IDENTIFIER:
--     this sentence read «migration 0051» when it was written, and 0051 was
--     claimed later the same day by 0051_the_stage_nobody_agreed_to.sql, which
--     does not touch this function. 0052 is the next free file as the chain
--     stands on 2026-08-08. Corrected in place. Recorded as owed in §6.5 below
--     and in TODOS.md; unwritten as of 2026-08-08.
--
-- `stable`, not `volatile`: it reads and returns the same answer within a
-- statement. `set search_path = public` for the reason 0011:7-12 gives.
-- ===========================================================================
create or replace function app.work_type_key_is_bindable(ws uuid, cv uuid, k text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      -- ARM 1: the workspace's published vocabulary.
      select 1 from public.requirement_rule_versions rv
       where rv.workspace_id = ws
         and rv.work_type_key = k
         and rv.status = 'published')
    or exists (
      -- ARM 2: what this baseline already bound, retired or not (INV-067).
      select 1 from public.contract_version_rule_bindings b
       where b.workspace_id = ws
         and b.contract_version_id = cv
         and exists (
           select 1 from public.requirement_rule_versions rv
            where rv.workspace_id = b.workspace_id
              and rv.id = b.requirement_rule_version_id
              and rv.work_type_key = k))
$$;
revoke all on function app.work_type_key_is_bindable(uuid, uuid, text) from public;
grant execute on function app.work_type_key_is_bindable(uuid, uuid, text) to aktflow_app;

comment on function app.work_type_key_is_bindable(uuid, uuid, text) is
  'True when a work-type key names something this workspace can actually put in '
  'front of the requirement-rule predicate: a published rule version anywhere in '
  'the workspace, or any rule version already bound to the named contract '
  'version. Consulted by the trigger on public.work_items and by work_items.create '
  '/.update so the caller gets a catalogued field error rather than a trigger''s '
  'raise. It is NOT the materialisation predicate: that one matches against the '
  'rule versions bound to the assignment''s OWN baseline and is evaluated in '
  'apps/app/src/lib/requirement-materialisation.ts.';

-- ===========================================================================
-- 5. THE REFUSAL, STRUCTURALLY
--
-- A SEPARATE TRIGGER, NOT AN ARM OF app.guard_work_item(). 0042 §3 says in
-- terms why that guard is `before update or delete` and not `before insert`:
-- «the frozen importer inserts its work items into a version that is ALREADY
-- published, inside the transaction that created it, so a "lines may only be
-- inserted into a draft" rule would break it». Folding this check into that
-- function would mean adding INSERT to that trigger, which would apply the
-- draft-only rule to the importer and break ADR-006 decision 6's freeze. So:
-- a second trigger, on INSERT and UPDATE, carrying only this rule.
--
-- IT IS A NO-OP FOR EVERY ROW THE FROZEN IMPORTER WRITES. The importer supplies
-- no work type, the column is NULL, and the function returns on its first line.
-- Nothing in the import path is read, locked or slowed.
--
-- FIRING ORDER IS NOT LEFT TO CHANCE. PostgreSQL fires same-event BEFORE
-- triggers in name order, and `work_items_guard` (0042 §3) sorts before
-- `work_items_work_type_guard`. So on UPDATE the immutability refusal —
-- «a line of a published version cannot be corrected (INV-015)» — is raised
-- FIRST, and a caller correcting a frozen line is told that, not that its work
-- type is unknown. The names are chosen for that and the ordering is asserted
-- here rather than discovered later.
--
-- THE UPDATE ARM ONLY FIRES WHEN THE KEY ITSELF CHANGES, and this is the
-- retirement answer. Ask what happens when the LAST rule version carrying key K
-- is retired while lines still name it:
--   * PUBLISHED lines keep K, untouched. Nothing cascades — and nothing should:
--     0041's comment on requirement_rule_versions says retirement «changes
--     nothing about a baseline or an occurrence that already pinned this
--     identity — which is why it is a trigger on the binding and not a foreign
--     key», and the same reasoning forbids a foreign key here. A published
--     line cannot be updated at all (INV-015, guard_work_item), so no trigger
--     can even reach it.
--   * DRAFT lines already carrying K keep it AND STAY EDITABLE. Correcting such
--     a line's description, quantity or price does not re-check the key,
--     because `new.work_type_key is not distinct from old.work_type_key`
--     short-circuits. A retirement therefore never traps a draft line into
--     being uncorrectable — which is what a naive `before update` check would
--     do, and it would do it days later, to somebody fixing a typo in a
--     description.
--   * A NEW line naming K on a draft that has NOT bound a K-carrying version is
--     REFUSED. That is correct: retirement stops future binding (INV-067), so K
--     can reach no new baseline, and a line naming it would materialise nothing.
--     Refusing at the keystroke is the honest form of that fact.
--   * A NEW line naming K on a draft that HAS already bound a K-carrying
--     version is ADMITTED, by arm 2. Its occurrences will materialise.
--   * Occurrences already materialised are untouched. They pin rule versions
--     (INV-066/INV-067) and never re-read this column.
--
-- THE RESIDUE, STATED: a workspace cannot type a work type BEFORE publishing a
-- rule version that carries it. «Земляні роботи» with no ДБН hidden-works
-- requirement is unnameable on a line — the vocabulary is emergent (§3), so a
-- key with no rule is not a work type as far as this database is concerned; it
-- is a typo. Such a line stays NULL and is disclosed as
-- `work_type_unresolved`, exactly as today. Option C is what removes this
-- residue, and §3 says what option C costs.
--
-- NOT SECURITY DEFINER, and it does not need to be: everything it reads it
-- reads through the resolver, which is. It raises rather than returning false
-- so that a route which forgot the check fails visibly instead of writing a key
-- nothing can use.
-- ===========================================================================
create or replace function app.guard_work_item_work_type() returns trigger
language plpgsql as $$
begin
  -- A line with no work type is the pre-0050 shape and stays legal (header).
  if new.work_type_key is null then
    return new;
  end if;

  -- An UPDATE that leaves the key alone re-checks nothing: see the retirement
  -- paragraph above. `is not distinct from` and not `=`, because both sides may
  -- be NULL and `null = null` is null, which would fall through to the check.
  if tg_op = 'UPDATE' and new.work_type_key is not distinct from old.work_type_key then
    return new;
  end if;

  if not app.work_type_key_is_bindable(
       new.workspace_id, new.contract_version_id, new.work_type_key) then
    -- The route checks this first and returns a catalogued VALIDATION_FAILED
    -- naming the field (technical/error-catalog.csv:15). Reaching this raise
    -- means a write path did not check, which is a defect and is meant to be
    -- loud. Same division as contract_versions.bind_rules and
    -- app.guard_rule_binding_window() (0042 §5).
    raise exception
      'work type % names no rule version this workspace can bind (public.work_items.work_type_key)',
      new.work_type_key;
  end if;

  return new;
end $$;
revoke all on function app.guard_work_item_work_type() from public;

create trigger work_items_work_type_guard before insert or update
  on public.work_items
  for each row execute function app.guard_work_item_work_type();

comment on column public.work_items.work_type_key is
  'The first argument of the requirement-rule predicate, on the LINE side — the '
  'left-hand side that requirement_rule_versions.work_type_key (0041:326) is the '
  'right-hand side of (ADR-006 decision 4.2; glossary.md:109). ПТВ picks it when '
  'the line is typed (ADR-006 decision 1 step 1). NULLABLE AND NULL IS NOT AN '
  'ERROR: every line the frozen importer wrote and every line typed before '
  'migration 0050 carries NULL, matches no rule, and is disclosed as '
  'work_type_unresolved rather than refused. A NON-NULL value must name something '
  'the workspace can bind — app.work_type_key_is_bindable, enforced by '
  'work_items_work_type_guard — because a key that resolves to nothing produces '
  'an empty obligation set, a vacuous closure and a passing constraint on every '
  'row. NO FOREIGN KEY AND NO VOCABULARY TABLE: the set of work types has no '
  'owning entity in v0.1 (entity-catalog.csv; glossary.md:109 calls that a scope '
  'decision an ADR must make) and it is emergent — whatever keys this '
  'workspace''s published rule versions carry. Whether a line''s key matches the '
  'rules THIS BASELINE bound is a different and narrower question, answered at '
  'publication by contract_versions.publish.';

-- ===========================================================================
-- 6. WHAT THIS MIGRATION DOES NOT ENFORCE, NAMED SO IT IS NOT MISTAKEN FOR
--    ENFORCED
--
-- 1. THE NARROW PREDICATE IS NOT A CONSTRAINT. «This line's work type matches a
--    rule version bound to THIS contract version» cannot be a CHECK (it spans
--    three tables) and cannot be a foreign key (there is no candidate key to
--    point at: many rule versions share one work_type_key, which is the whole
--    point of a predicate). It is evaluated by contract_versions.publish, in
--    the publish transaction, where both sets finally exist — the same place
--    and for the same reason INV-083 lives there rather than in the schema
--    (0041:136-141, 0042's «WHAT THIS MIGRATION DOES NOT ENFORCE» §1).
--
--    THE DIVISION THAT COMMAND MAKES, recorded here because this file is where
--    a reader will look for it. CORRECTED IN PLACE ON 2026-08-08: this file has
--    never been applied anywhere, so the comment is edited rather than
--    superseded by a later `comment on` — the SQL below is untouched. Two of the
--    four bullets described the predicate as it stood when this file was
--    written, and the SAME CHANGE SET that wrote this file then replaced it.
--    Each bullet names what it used to say, because a reader who saw the earlier
--    draft has to be able to tell which half moved.
--      * lines with NULL work type — counted and reported (`untypedLineCount`),
--        and NOT A FAULT WHILE SOME OTHER LINE IS COVERED. This bullet read
--        «counted and reported, never refused»; that was true of the
--        `typedLineCount > 0` predicate and is false now — an all-untyped draft
--        is refused by the last bullet. It remains true of the imported
--        baseline, for the different reason §6.2 gives: the importer never
--        reaches contract_versions.publish at all.
--      * typed lines matching a bound rule version — counted and reported.
--      * typed lines matching NO bound rule version, while at least one OTHER
--        line DOES match — REPORTED BY POSITION, in the 201 body and in the
--        audit record, and published. ADR-006 decision 4.2 requires exactly
--        this: «a work type with no matching rule must still be named in the
--        command's output, because silent non-coverage means there is no gate».
--        Refusing instead would be worse than silence: the only escape a caller
--        would have is to clear the work type, which is the silent hole.
--      * A BOUND SET NO LINE REACHES — `boundRuleVersionCount > 0 &&
--        coveredLineCount === 0`, at apps/app/app/v1/contract-versions/
--        [versionId]/publish/route.ts:336 — REFUSED, `RULE_BINDING_REQUIRED`
--        (technical/error-catalog.csv:120, 409, user action
--        `bind_rule_versions_then_publish`). A bound set that no line in the
--        baseline can reach is INV-083's hole one level in: the version carries
--        bindings and the gate it describes can never fire. The catalogued user
--        action is already the right instruction.
--        THIS BULLET READ «at least one typed line and NOT ONE of them matching
--        any bound rule version». That qualifier was `typedLineCount > 0`, and
--        it was defeated by a one-field PATCH: clear the work type on every
--        line, `typedLineCount` falls to 0, the 409 vanishes, and the version
--        publishes immutably with a binding no line can reach — every stage
--        empty, every closure vacuous, which is the state the refusal exists to
--        prevent. The qualifier became `boundRuleVersionCount > 0` on
--        2026-08-08, so BOTH shapes of total disjointness are now refused:
--        typed lines none of which match, and lines that are all untyped. The
--        route's own comment at :317-335 carries the argument. Partial
--        non-coverage stays legal and disclosed, per ADR-006 decision 4.2; only
--        total disjointness is refused.
--        On that route the new qualifier is belt-and-braces rather than
--        load-bearing — INV-083 already refuses a binding-less draft at :184, so
--        `boundRuleVersionCount` is > 0 by the time :336 runs. It is written out
--        because the predicate is quoted in packages/contracts and because the
--        OTHER publish command, import_batches.publish, binds rule versions and
--        never evaluates coverage at all (§6.2).
--
-- 2. THE IMPORTER IS NOT TAUGHT TO TYPE A WORK TYPE, and import_batches.publish
--    gains no disclosure. ADR-006 decision 6 freezes import EXPANSION and this
--    slice does not touch it: the importer writes NULL and every imported line
--    keeps working, uncovered and disclosed. WHAT THAT MEANS FOR A BASELINE
--    THAT ARRIVED THROUGH THE IMPORTER, plainly: it is published and immutable
--    (INV-015), so its lines can never acquire a work type; no assignment
--    against it will ever materialise an occurrence; every stage on it closes
--    vacuously. The pilot's remedy is the hand-typed baseline ADR-006 decision
--    1 step 1 describes, which is the route this column serves. Giving an
--    imported line a work type LATER is not this slice's problem — it needs a
--    superseding version, or an operation that edits a published line, and the
--    second contradicts INV-015. THE FIRST IS THE HONEST ANSWER, EVERY ROUTE IT
--    NEEDS EXISTS, AND IT IS EXPENSIVE — say what it costs rather than let
--    «it already exists» be read as «it is easy». `contract_versions.create` a
--    successor, type the lines, bind, publish. What that second step actually
--    is: `contract_versions.create` COPIES NO LINES — apps/app/app/v1/contracts/
--    [contractId]/versions/route.ts writes the version row and nothing else —
--    and scope-v0.1.csv:17-19 carries exactly three work-item operations,
--    create, update and remove, ALL PER LINE. There is no bulk write and no
--    copy-forward. So the remedy is one `work_items.create` HTTP command per
--    line of the imported кошторис, each with its own idempotency key, each
--    retyping every commercial field the importer had already parsed —
--    description, unit, quantity, price state and price, section, source key,
--    work code — and each naming `predecessorWorkItemId` BY HAND, because
--    `matchLineage` runs in the importer and a typed line has no file to match.
--    A кошторис is not ten lines. THAT COST IS THE ARGUMENT for teaching the
--    importer to carry a work type, and it is the reason the paragraph below is
--    written as a condition rather than a hypothetical; it is not an argument
--    for editing a published line, which INV-015 forecloses.
--    IF the importer is ever taught to write a work type, the publish-time
--    disclosure in §6.1 must move with it in the same slice, or the two routes
--    to a published baseline will disagree about whether a hole is visible —
--    which is precisely the split INV-083 exists to prevent.
--
-- 3. NOTHING HERE MAKES A NULL KEY AN ERROR, at any later moment. Occurrence
--    materialisation still returns `work_type_unresolved` for such a line, and
--    a stage over an assignment on such a line is still empty and still closes
--    vacuously. The vacuous closure remains visible (`vacuous: true` on the
--    201, in the audit row and in the outbox payload) and is unchanged by this
--    migration. What changes is that it is no longer the ONLY outcome.
--
-- 4. NO INVARIANT ID IS ALLOCATED FOR THE WRITE-PATH REFUSAL. The rule «a work
--    line's non-null work type names a rule version this workspace can bind»
--    has no row in technical/database/invariant-catalog.csv, and inventing an
--    id in a migration is how a catalog acquires two owners. THE CATALOG OWES
--    ONE, and it must say: a non-null work_items.work_type_key names at least
--    one requirement_rule_version that is published in the same workspace or is
--    already bound to that line's own contract version; enforced by
--    work_items_work_type_guard plus the command's field refusal; severity P0,
--    scope `requirements`, applies to v0.1-M1. INV-072 covers the DISCLOSURE
--    half and INV-083 covers the publication refusal; neither covers the write.
--
-- 5. ARM 2 OF app.work_type_key_is_bindable IS NOT SCOPED TO A DRAFT, AND THE
--    RESOLVER THEREFORE DOES NOT ENFORCE ITS OWN BOUNDED-DISCLOSURE ARGUMENT.
--    Added 2026-08-08, after a build audit read §4's argument as a property of
--    the function when it is a property of the function's two callers; §4's
--    bullet is corrected in place and this is the standing item it leaves.
--    THE FACT: the function is SECURITY DEFINER and granted to aktflow_app, and
--    arm 2 accepts any `cv` in a workspace the caller is an active member of. A
--    caller who invokes it directly with a contract version it holds no
--    project.view/project.admin grant on learns whether that version binds a
--    rule version carrying a given key — a bit `cvrb_select` (0041 §9)
--    withholds. UNREACHABLE THROUGH ANY v0.1 ROUTE: the two callers pass the
--    contract version of the row being written and nothing else, and no v0.1
--    operation lets a caller name the argument (scope-v0.1.csv carries no
--    resolver-shaped operation). So this is a widened surface, not a disclosed
--    leak, and it is written down here rather than left to be rediscovered.
--    WHAT CLOSES IT: a new migration — 0052 as the chain stands on 2026-08-08,
--    and the number is written down here only as today's next free file. This
--    read «migration 0051» until 0051 was claimed the same day by
--    0051_the_stage_nobody_agreed_to.sql, which guards the stage key and leaves
--    this function untouched; corrected in place, this file being unapplied. The
--    thing to look for is `create or replace function
--    app.work_type_key_is_bindable`, arm 2 gaining
--    `and exists (select 1 from public.contract_versions v
--                  where v.workspace_id = ws and v.id = cv and v.status = 'draft')`.
--    Behaviour-preserving for both current callers — a work_items row can only
--    be written into a draft (app.guard_work_item(), 0042 §3; and §5's trigger
--    returns early on the NULL key every importer insert carries) — so it needs
--    no route change and no new test fixture, only a case asserting the
--    resolver answers false for a published version the caller cannot see.
--
-- ===========================================================================
-- 7. TWO COMMENTS CORRECTED IN 0043, IN PLACE
--
-- 0043 was written on this branch and has never been applied anywhere, so its
-- comments may be corrected in the file rather than overwritten by a later
-- `comment on`. Two of them assert something this migration makes false, and
-- both are edited in supabase/migrations/0043_the_obligation_before_the_
-- covering.sql itself, marked as in-place corrections in the same style as
-- 0041:286-294:
--   * the header's «ONE FURTHER GAP … THE LEFT-HAND SIDE OF THE RULE PREDICATE
--     HAS NOWHERE TO LIVE» and its closing restatement (0043:1034-1039);
--   * `comment on column public.work_stages.stage_key`, whose last sentence
--     read «and public.work_items has no such column: see migration 0043's
--     header».
-- Correcting a comment on this branch is not editing history. What is NOT
-- corrected: 0043's judgement that the migration «DOES NOT CLOSE IT AND MUST
-- NOT» was right for 0043, and it stays as written, with the correction noting
-- that 0050 closes it under ADR-006 decision 1 step 1 and that the OWNING
-- ENTITY question is untouched.
--
-- THE FIRST OF THOSE TWO CORRECTIONS WAS ITSELF WRONG, AND WAS CORRECTED AGAIN
-- ON 2026-08-08. One bullet of it asserted that technical/database/
-- schema-v0.1.sql «still carries work_type_key only on the rule side», cited
-- two rule-side line numbers that the same change had already moved, and
-- credited §1 of THIS file with stating a new deviation from 0015:1-11. All
-- three were false: the same change that wrote this migration also added the
-- line-side column to schema-v0.1.sql, so no deviation was created, and §1
-- above is about the ALTER TABLE and names that file nowhere. The corrected
-- bullet in 0043 quotes what it replaced rather than overwriting it, because a
-- correction that introduces new false statements is worse than the staleness
-- it replaced — and this section is where a reader would otherwise stop,
-- believing the 0043 correction landed clean.
--
-- ===========================================================================
-- 8. WHAT COULD NOT BE CHECKED HERE
--
-- This checkout has no node_modules, no database and no docker. NOTHING IN THIS
-- FILE HAS BEEN EXECUTED. No claim here rests on a run: not that this migration
-- applies, not that the CHECK validates, not that the trigger creates, not that
-- the trigger fires, not that the resolver returns what it is read to return,
-- not that the firing order asserted in §5 is what PostgreSQL produces. The
-- only check performed is a static reading of migrations 0010-0049,
-- technical/database/schema-v0.1.sql, the four catalogs, ADR-005, ADR-006 and
-- ADR-008.
--
-- THE TWO THINGS A REVIEWER WITH A DATABASE SHOULD RUN FIRST:
--   1. `create trigger work_items_work_type_guard before insert or update` in
--      §5, on a database where 0042's `work_items_guard` already exists, and
--      then an UPDATE of a PUBLISHED line — to confirm the raise is 0042's
--      immutability message and not this file's. §5 asserts a name ordering
--      that has never been observed.
--   2. Arm 2 of the resolver against a workspace where the only carrier of a
--      key has been retired and is bound to one draft — the case §5 says is
--      admitted. If it refuses, arm 2 is not reading what it is read to read
--      and the retirement analysis above is wrong in the direction that traps
--      a person mid-draft.
-- ===========================================================================
