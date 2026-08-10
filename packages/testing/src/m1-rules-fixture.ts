import type { Client } from "pg";
import { dropWorkspaces } from "./pg";
import { readDodatokN, DODATOK_N_SOURCE_STANDARD } from "./dodatok-n";

/**
 * NOTHING HERE HAS BEEN EXECUTED. No node_modules, no database, no docker: no
 * `pnpm`, `vitest`, `tsc`, `psql` or `supabase` was run against this file, and
 * no claim is made that it applies, compiles or passes. Static reading is the
 * only check that was available.
 *
 * ---------------------------------------------------------------------------
 * Direct-insert fixture for the v0.1-M1 requirement-rule database suites, in
 * the shape packages/testing/src/m2-fixture.ts established and for the same
 * reason: these suites test DDL, triggers, grants and RLS policies, so building
 * the world through the routes would make a policy regression look like a
 * fixture failure. It bypasses RLS on purpose — the admin connection is the
 * table owner.
 *
 * Synthetic names carry the «Приклад-» prefix so no row can be mistaken for a
 * real Ukrainian company. The regulatory rows do NOT get a prefix and must not:
 * they are the actual Додаток Н wording, read from the CSV.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not exercise
 * `requirement_rule_versions.publish`. That command's own refusals (INV-082,
 * INV-085, the copied citation) are route behaviour and are tested through the
 * route in apps/app/tests. Here a published rule version is a PRECONDITION, not
 * a subject.
 */

export interface RulesFixture {
  workspaceId: string;
  userId: string;
  memberId: string;
  projectId: string;
  contractId: string;
  /** origin 'import', status 'published' — the shape the frozen importer writes. */
  publishedVersionId: string;
  /** origin 'manual', status 'draft' — the shape contract_versions.create writes. */
  draftVersionId: string;
  /** A line of the DRAFT version: correctable while the version is a draft. */
  draftWorkItemId: string;
  /** A line of the PUBLISHED version: immutable (INV-015). */
  publishedWorkItemId: string;
  /** Keyed «Н.14/1» … «Н.15/7». */
  libraryItemIds: Map<string, string>;
  unitId: string;
}

export interface RulesSeedOptions {
  workspaceId: string;
  userId: string;
  /** Distinguishes this world's display names and contract number. */
  suffix: string;
}

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const HEX64 = "repeat('a',64)";

export async function seedRulesWorld(c: Client, o: RulesSeedOptions): Promise<RulesFixture> {
  // auth.users outlives a scoped workspace cleanup and its email uniqueness is
  // partial, so the address is derived from the id and cannot collide — the
  // same reasoning m2-fixture.ts:48-52 records.
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email,
                             encrypted_password, created_at, updated_at)
     values ($1, $2, 'authenticated', 'authenticated', $3, '', now(), now())
     on conflict (id) do nothing`,
    [o.userId, ZERO_UUID, `${o.userId}@fixture.test`]);

  await c.query(
    `insert into public.organizations (id, legal_name, display_name)
     values ($1,$2,$2)`, [o.workspaceId, `Приклад-Простір-${o.suffix}`]);

  const mem = await c.query(
    `insert into public.memberships (organization_id, user_id, role, status)
     values ($1,$2,'owner','active') returning id`, [o.workspaceId, o.userId]);
  const memberId: string = mem.rows[0].id;

  const proj = await c.query(
    `insert into public.projects (workspace_id, name, created_by)
     values ($1,$2,$3) returning id`,
    [o.workspaceId, `Приклад-Проєкт-${o.suffix}`, o.userId]);
  const projectId: string = proj.rows[0].id;

  // Every project capability these suites need, including rule_bindings.manage
  // — the value migration 0041 §4 widens the CHECK by. A grant written before
  // that widening would have been rejected with a 23514.
  for (const capability of [
    "project.view", "project.admin", "contracts.edit", "imports.manage",
    "imports.publish", "rule_bindings.manage",
  ]) {
    await c.query(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,$4,$5)`,
      [o.workspaceId, projectId, memberId, capability, o.userId]);
  }

  const own = await c.query(
    `insert into public.parties (workspace_id, display_name, created_by)
     values ($1,$2,$3) returning id`,
    [o.workspaceId, `Приклад-Виконавець-${o.suffix}`, o.userId]);
  const customer = await c.query(
    `insert into public.parties (workspace_id, display_name, created_by)
     values ($1,$2,$3) returning id`,
    [o.workspaceId, `Приклад-Замовник-${o.suffix}`, o.userId]);
  // INV-002 is a foreign key: contracts.own_party_id resolves to an own legal
  // entity profile, not merely to a party.
  await c.query(
    `insert into public.party_legal_profiles
       (workspace_id, party_id, official_name, updated_by)
     values ($1,$2,$3,$4)`,
    [o.workspaceId, own.rows[0].id, `Приклад-Виконавець-${o.suffix} ТОВ`, o.userId]);
  await c.query(
    `insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by)
     values ($1,$2,$3)`, [o.workspaceId, own.rows[0].id, o.userId]);

  const contract = await c.query(
    `insert into public.contracts
       (workspace_id, project_id, own_party_id, customer_party_id, contract_no,
        currency, tax_mode, tax_rate_bps, rounding_policy, created_by)
     values ($1,$2,$3,$4,$5,'UAH','exclusive',2000,
             '{"midpoint":"half_up","scope":"work_item_version_pool"}'::jsonb,$6)
     returning id`,
    [o.workspaceId, projectId, own.rows[0].id, customer.rows[0].id,
     `ПР-${o.suffix}`, o.userId]);
  const contractId: string = contract.rows[0].id;

  const unit = await c.query(
    `insert into public.unit_definitions (workspace_id, code, unit_precision, created_by)
     values ($1,'м2',3,$2) returning id`, [o.workspaceId, o.userId]);
  const unitId: string = unit.rows[0].id;

  // ── version 1: published, origin 'import' ────────────────────────────────
  // contract_versions_origin_batch_check (0042 §1) makes (origin = 'import')
  // exactly equivalent to (import_batch_id is not null), so an import-origin
  // version still cannot exist without its batch.
  const batch = await c.query(
    `insert into public.import_batches (workspace_id, project_id, contract_id, created_by)
     values ($1,$2,$3,$4) returning id`, [o.workspaceId, projectId, contractId, o.userId]);
  const published = await c.query(
    `insert into public.contract_versions
       (workspace_id, project_id, contract_id, version_no, status, origin,
        own_party_snapshot, customer_party_snapshot, currency, tax_mode, tax_rate_bps,
        terms, approval_policy, rounding_policy,
        source_tolerance_minor_units, source_tolerance_bps,
        import_batch_id, source_manifest_hash, published_by)
     values ($1,$2,$3,1,'published','import','{}'::jsonb,'{}'::jsonb,'UAH','exclusive',2000,
             '{}'::jsonb,'{}'::jsonb,'{"midpoint":"half_up"}'::jsonb,100,10,$4,
             ${HEX64},$5)
     returning id`,
    [o.workspaceId, projectId, contractId, batch.rows[0].id, o.userId]);
  const publishedVersionId: string = published.rows[0].id;

  // ── version 2: draft, origin 'manual' ────────────────────────────────────
  // published_at is written as an EXPLICIT null: the column keeps its
  // `default now()` (0012:133) so the frozen importer still works, and omitting
  // it here would stamp the draft with a publication time and be rejected by
  // contract_versions_draft_check. created_by is NOT NULL for a manual version
  // (contract_versions_manual_author_check).
  const draft = await c.query(
    `insert into public.contract_versions
       (workspace_id, project_id, contract_id, version_no, status, origin,
        own_party_snapshot, customer_party_snapshot, currency, tax_mode, tax_rate_bps,
        terms, approval_policy, rounding_policy,
        source_tolerance_minor_units, source_tolerance_bps,
        import_batch_id, source_manifest_hash, supersedes_version_id,
        created_by, published_by, published_at)
     values ($1,$2,$3,2,'draft','manual','{}'::jsonb,'{}'::jsonb,'UAH','exclusive',2000,
             '{}'::jsonb,'{}'::jsonb,'{"midpoint":"half_up"}'::jsonb,100,10,
             null,null,$4,$5,null,null)
     returning id`,
    [o.workspaceId, projectId, contractId, publishedVersionId, o.userId]);
  const draftVersionId: string = draft.rows[0].id;

  const line = async (versionId: string, position: number): Promise<string> => {
    const r = await c.query(
      `insert into public.work_items
         (workspace_id, project_id, contract_id, contract_version_id, position,
          description, unit_definition_id, unit_code, unit_precision,
          contract_quantity, unit_price_state, unit_price_decimal, price_basis,
          valuation_basis, currency, tax_mode, tax_rate_bps,
          net_amount_minor_units, tax_amount_minor_units, gross_amount_minor_units)
       values ($1,$2,$3,$4,$5,$6,$7,'м2',3,'10.000','known','100.00','net',
               'unit_price_derived','UAH','exclusive',2000,100000,20000,120000)
       returning id`,
      [o.workspaceId, projectId, contractId, versionId, position,
       `Приклад-позиція-${o.suffix}-${position}`, unitId]);
    return r.rows[0].id;
  };
  const publishedWorkItemId = await line(publishedVersionId, 1);
  const draftWorkItemId = await line(draftVersionId, 1);

  // ── the twelve Додаток Н rows ────────────────────────────────────────────
  // Seeded here BY THE FIXTURE, which is not a claim that anything in the
  // product seeds them. Plan task 3 owes the constant and the
  // workspaces.create materialisation; that command is tested through the
  // route in apps/app/tests/requirement-library-fidelity.int.test.ts, and it is
  // deliberately not what this fixture stands in for. Without rows here the
  // rule-version tests below would have nothing to cite, because
  // requirement_rule_versions.requirement_library_item_id is a composite FK.
  const libraryItemIds = new Map<string, string>();
  for (const row of readDodatokN()) {
    const r = await c.query(
      `insert into public.requirement_library_items
         (workspace_id, source_standard, position_code, position_title_uk,
          item_no, item_text_uk, verification, source_citation)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [o.workspaceId, DODATOK_N_SOURCE_STANDARD, row.position, row.positionTitleUk,
       row.itemNo, row.itemTextUk, row.verification, row.source]);
    libraryItemIds.set(`${row.position}/${row.itemNo}`, r.rows[0].id);
  }

  return {
    workspaceId: o.workspaceId, userId: o.userId, memberId, projectId, contractId,
    publishedVersionId, draftVersionId, draftWorkItemId, publishedWorkItemId,
    libraryItemIds, unitId,
  };
}

export interface RuleVersionSeed {
  /** Absent starts a new lineage; supplied publishes the next version of one. */
  requirementRuleId?: string;
  versionNo?: number;
  ordinal?: number;
  status?: "draft" | "published";
  workTypeKey?: string;
  stageKey?: string;
  interventionType?: string;
  blockingScope?: string;
  timing?: string;
  evidenceKind?: string;
  libraryKey?: string;
  /**
   * The media policy, as the JSON that reaches the column.
   *
   * Defaulted rather than omitted BECAUSE MIGRATION 0044 MADE OMITTING IT
   * ILLEGAL for the evidence kinds that produce an uploaded original:
   * `requirement_rule_versions_allowed_media_check` requires the
   * `{mimeTypes, maxByteSize}` object for 'photo' and 'document', and the
   * column's own default is `'[]'::jsonb`. Every call in this fixture's history
   * relied on that default and took evidence kind 'photo', so leaving it
   * omitted would make EVERY seeded rule version unstorable the moment 0044 is
   * applied — and every M1 and M2 database suite would fail in its fixture
   * rather than in an assertion.
   *
   * Supply `[]` (or any other shape) explicitly to exercise the CHECK itself.
   */
  allowedMedia?: unknown;
}

/** What the publish route writes for a kind that takes an uploaded original. */
export const FIXTURE_ALLOWED_MEDIA = {
  mimeTypes: ["image/jpeg"], maxByteSize: 5 * 1024 * 1024,
} as const;

export interface SeededRuleVersion {
  ruleVersionId: string;
  requirementRuleId: string;
  stageKey: string;
}

/**
 * A rule version, inserted directly.
 *
 * `status: "draft"` is reachable ONLY from this admin connection: the RLS policy
 * `rrv_insert` (0041:774-776) admits `published` and nothing else, so a draft
 * cannot be written by the application role at all. The suites use one to prove
 * that binding an unpublished version is refused STRUCTURALLY rather than by a
 * route check — a fact that cannot be demonstrated without a draft to try.
 */
export async function seedRuleVersion(
  c: Client, f: RulesFixture, o: RuleVersionSeed = {},
): Promise<SeededRuleVersion> {
  const status = o.status ?? "published";
  const requirementRuleId = o.requirementRuleId
    ?? (await c.query<{ id: string }>("select gen_random_uuid() as id")).rows[0]!.id;
  const stageKey = o.stageKey ?? "prykhovani-roboty";
  const libraryKey = o.libraryKey ?? "Н.15/1";
  const libraryItemId = f.libraryItemIds.get(libraryKey);
  if (!libraryItemId) throw new Error(`m1-rules-fixture: no seeded library item ${libraryKey}`);
  const evidenceKind = o.evidenceKind ?? "photo";
  // The same line `publishRequirementRuleVersionRequest` draws and migration
  // 0044's CHECK draws: the object for the kinds that produce an uploaded
  // original, the empty array — the column's own default, meaning «no uploaded
  // original» — for the kinds that do not.
  const allowedMedia = o.allowedMedia !== undefined ? o.allowedMedia
    : ["photo", "document"].includes(evidenceKind) ? FIXTURE_ALLOWED_MEDIA : [];

  // requirement_rule_versions_published_check: a non-draft row must carry the
  // hash, the publication time and the publisher. A draft must carry none of
  // them (requirement_rule_versions_draft_check), which is what keeps the
  // generated has_been_published exactly equivalent to status <> 'draft'.
  const publishedBits = status === "draft"
    ? "null::text, null::timestamptz, null::uuid"
    : `${HEX64}, now(), $10::uuid`;

  // EVERY PARAMETER IS CAST EXPLICITLY. This is an INSERT ... SELECT, whose
  // select list is type-resolved before the target columns are known, so an
  // unknown-typed parameter resolves to text and then relies on an assignment
  // cast to reach uuid or integer. The casts remove that dependency; they are
  // not decoration.
  //
  // norm_ref is composed here in the same form
  // docs/product/hidden-works-content-rules.md §"What the product MAY assert"
  // item 1 gives literally — «ДБН А.3.1-5:2016, Додаток Н (довідковий),
  // позиція Н.15». apps/app/src/lib/requirement-content.ts:48-50 is the
  // PRODUCT-side authority for that string; this fixture reproduces the same
  // form so a seeded row is the shape the publish command writes. No item
  // number, no page, no approving order: each absence is a prohibition.
  const r = await c.query(
    `insert into public.requirement_rule_versions
       (workspace_id, requirement_rule_id, version_no, ordinal, status,
        work_type_key, stage_key,
        intervention_type, blocking_scope, timing, evidence_kind,
        acceptance_criterion, performer_role, approver_role,
        norm_ref, norm_ref_verification, norm_ref_source, requirement_library_item_id,
        allowed_media,
        rule_version_hash, published_at, published_by_member_id, created_by_member_id)
     select $1::uuid,$2::uuid,$3::integer,$4::integer,$5::text,
            $6::text,$7::text,$8::text,$9::text,$11::text,$12::text,
            li.item_text_uk, 'foreman', 'technical_supervisor',
            li.source_standard || ', Додаток Н (довідковий), позиція ' || li.position_code,
            li.verification, li.source_citation, li.id,
            $14::jsonb,
            ${publishedBits}, $10::uuid
       from public.requirement_library_items li
      where li.workspace_id = $1::uuid and li.id = $13::uuid
     returning id`,
    [f.workspaceId, requirementRuleId, o.versionNo ?? 1, o.ordinal ?? 1, status,
     o.workTypeKey ?? "montazh-elektrotekhnichnykh-ustanovok", stageKey,
     o.interventionType ?? "hold", o.blockingScope ?? "blocks_stage_closure",
     f.memberId, o.timing ?? "before_concealment", evidenceKind,
     libraryItemId, JSON.stringify(allowedMedia)]);
  if (r.rows.length === 0) {
    throw new Error("m1-rules-fixture: the cited library item was not visible");
  }
  return { ruleVersionId: r.rows[0].id, requirementRuleId, stageKey };
}

/**
 * Removes only the workspaces a suite owns. A blanket
 * `truncate public.organizations cascade` destroys state the neighbouring
 * suites depend on, which is the point m2-fixture.ts:182-189 argues.
 *
 * The dependency-ordered table list this function used to carry is gone, and
 * `dropWorkspaces` in ./pg.ts records why in full: the list was seven tables
 * short and four order violations wrong on 2026-08-08, and two of the tables
 * involved sit in FK cycles that no hand-written order could have satisfied.
 */
export async function dropRulesWorkspaces(
  c: Client, workspaceIds: readonly string[],
): Promise<void> {
  await dropWorkspaces(c, workspaceIds);
}

/** Runs SQL and reports the SQLSTATE, or null when it succeeded. */
export async function sqlstate(fn: () => Promise<unknown>): Promise<string | null> {
  try { await fn(); return null; } catch (e) { return (e as { code?: string }).code ?? "unknown"; }
}

/** Runs SQL and reports the raised message, or "" when it succeeded. */
export async function raised(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return ""; } catch (e) { return (e as Error).message; }
}
