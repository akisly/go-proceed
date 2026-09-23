import { q, jsonReq } from "./fixtures";
import { readDodatokN, DODATOK_N_SOURCE_STANDARD } from "./dodatok-n";
import { lineManifestHash, pinsFrom } from "../../src/lib/manual-baseline";
import type { ContractVersionResponse } from "@goproceed/contracts";

/**
 * NOTHING HERE HAS BEEN EXECUTED. No node_modules, no database, no docker:
 * `vitest`, `tsc`, `psql` and `supabase` were never run against this file and
 * no claim is made that it compiles or that the suites using it pass. Static
 * reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * Route drivers for the v0.1-M1 manual baseline: the draft, its lines, its rule
 * bindings and its publication, plus the two things the suites need that no
 * route provides — the Додаток Н rows nothing seeds yet, and a way to make a
 * command fail AFTER it has written.
 */

/** A DELETE with no body. `commandRoute` reads an empty body as `{}`. */
export const delReq = (url: string): Request =>
  new Request(url, { method: "DELETE", headers: { "idempotency-key": crypto.randomUUID() } });

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

export async function createDraft(
  contractId: string, body: Record<string, unknown> = {},
): Promise<Response> {
  const { POST } = await import("../../app/v1/contracts/[contractId]/versions/route");
  return POST(jsonReq("http://x", body), params({ contractId }));
}

export async function addLine(
  versionId: string, body: Record<string, unknown>,
): Promise<Response> {
  const { POST } = await import("../../app/v1/contract-versions/[versionId]/work-items/route");
  return POST(jsonReq("http://x", body), params({ versionId }));
}

export async function patchLine(
  workItemId: string, body: Record<string, unknown>,
): Promise<Response> {
  const { PATCH } = await import("../../app/v1/work-items/[workItemId]/route");
  return PATCH(jsonReq("http://x", body, "PATCH"), params({ workItemId }));
}

export async function removeLine(workItemId: string): Promise<Response> {
  const { DELETE } = await import("../../app/v1/work-items/[workItemId]/route");
  return DELETE(delReq("http://x"), params({ workItemId }));
}

export async function bindRules(
  versionId: string, ruleVersionIds: string[],
): Promise<Response> {
  const { POST } = await import("../../app/v1/contract-versions/[versionId]/rule-bindings/route");
  return POST(jsonReq("http://x", { ruleVersionIds }), params({ versionId }));
}

export async function publishVersion(
  versionId: string, confirmedManifestHash: string,
): Promise<Response> {
  const { POST } = await import("../../app/v1/contract-versions/[versionId]/publish/route");
  return POST(jsonReq("http://x", { confirmedManifestHash }), params({ versionId }));
}

export async function getVersion(contractId: string, versionNo: number): Promise<Response> {
  const { GET } = await import("../../app/v1/contracts/[contractId]/versions/[versionNo]/route");
  return GET(new Request("http://x"), params({ contractId, versionNo: String(versionNo) }));
}

export async function publishRuleVersion(
  workspaceId: string, body: Record<string, unknown>,
): Promise<Response> {
  const { POST } = await import(
    "../../app/v1/workspaces/[workspaceId]/requirement-rule-versions/route");
  return POST(jsonReq("http://x", body), params({ workspaceId }));
}

export async function retireRuleVersion(ruleVersionId: string): Promise<Response> {
  const { POST } = await import(
    "../../app/v1/requirement-rule-versions/[ruleVersionId]/retire/route");
  return POST(jsonReq("http://x", {}), params({ ruleVersionId }));
}

export async function listLibrary(workspaceId: string): Promise<Response> {
  const { GET } = await import(
    "../../app/v1/workspaces/[workspaceId]/requirement-library/route");
  return GET(new Request("http://x"), params({ workspaceId }));
}

/**
 * The digest `contract_versions.publish` asks the caller to confirm, computed
 * the way a CLIENT would compute it.
 *
 * It is deliberately built from the `contract_versions.get` RESPONSE and not
 * from the database row. supabase/migrations/0042 and the publish route both
 * claim the manifest is «computed over exactly the fields
 * contract_versions.get returns, so the publisher confirms the line set it was
 * shown». Recomputing from the row would test the server against itself and
 * would stay green if that claim stopped being true.
 */
export function manifestOf(view: ContractVersionResponse): string {
  return lineManifestHash(pinsFrom({
    currency: view.pins.currency,
    tax_mode: view.pins.taxMode,
    tax_rate_bps: view.pins.taxRateBps,
    rounding_policy: view.pins.roundingPolicy as { midpoint?: string } | null,
    source_tolerance_minor_units: view.pins.toleranceMinorUnits,
    source_tolerance_bps: view.pins.toleranceBps,
  }), view.workItems);
}

/**
 * The twelve Додаток Н rows, inserted directly.
 *
 * THIS STANDS IN FOR A COMMAND THAT DOES NOT EXIST YET. Plan task 3 owes the
 * constant and the materialisation at `workspaces.create`; until it lands,
 * `requirement_rule_versions.publish` cannot succeed at all, because
 * `requirementLibraryItemId` is required and must resolve to a row in the
 * workspace — and with no rule version there is nothing to bind and no baseline
 * can be published. Every suite that needs a published baseline therefore has
 * to put the content there itself.
 *
 * IT IS NOT USED BY requirement-library-fidelity.int.test.ts, and must never
 * be: that suite exists to assert the COMMAND produces these rows, and seeding
 * them here first would make it assert nothing.
 *
 * IT SURVIVES TASK 3 LANDING. The insert is `on conflict do nothing` against
 * the tenant-unique key and the ids are read back afterwards, so once
 * `workspaces.create` seeds these rows itself this helper becomes a no-op
 * instead of failing with a 23505 in every suite that calls it. A fixture that
 * broke the moment the feature it stands in for arrived would be a fixture
 * nobody could safely land.
 *
 * Returns the ids keyed «Н.14/1» … «Н.15/7».
 */
export async function seedRequirementLibrary(workspaceId: string): Promise<Map<string, string>> {
  for (const row of readDodatokN()) {
    await q(
      `insert into public.requirement_library_items
         (workspace_id, source_standard, position_code, position_title_uk,
          item_no, item_text_uk, verification, source_citation)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (workspace_id, source_standard, position_code, item_no) do nothing`,
      [workspaceId, DODATOK_N_SOURCE_STANDARD, row.position, row.positionTitleUk,
       row.itemNo, row.itemTextUk, row.verification, row.source]);
  }
  const rows = await q<{ id: string; position_code: string; item_no: number }>(
    `select id, position_code, item_no from public.requirement_library_items
      where workspace_id = $1`, [workspaceId]);
  const ids = new Map<string, string>();
  for (const r of rows) ids.set(`${r.position_code}/${r.item_no}`, r.id);
  if (ids.size !== 12) {
    throw new Error(`seedRequirementLibrary: workspace ${workspaceId} holds ${ids.size} rows, not 12`);
  }
  // Synthetic metadata only: no real content or licence is claimed or uploaded.
  // Publication pins the latest illustration when one exists (0095); content-proxy tests
  // supply bytes independently and exercise integrity verification.
  await q(`insert into public.requirement_reference_image_versions
    (id,workspace_id,requirement_library_item_id,version_no,storage_key,sha256,byte_size,
     mime_type,width,height,alt_text_uk,rights_holder,license,source_uri,manifest_sha256)
    select gen_random_uuid(),workspace_id,id,1,gen_random_uuid()::text || '/' || gen_random_uuid()::text,
      repeat('a',64),3,'image/jpeg',1,1,'Приклад-тестовий ракурс','TEST ONLY','TEST ONLY',
      'https://example.com/test-only',repeat('b',64)
    from public.requirement_library_items where workspace_id=$1
    on conflict (workspace_id,requirement_library_item_id,version_no) do nothing`, [workspaceId]);
  return ids;
}

/**
 * The v0.1 rule-version body: a `hold` that blocks stage closure. Every other
 * intervention type and blocking scope is refused by INV-082 in the request
 * schema, so this is the shape a v0.1 publication takes and the suites vary only
 * the fields that are free.
 *
 * CORRECTED BY THE v0.1-M5 SLICE: «naming an internal approver … INV-085 by the
 * command» was true until `occurrence_grants.issue` shipped and is not now. The
 * default is still an internal approver; `over` carries `approverIsExternal:
 * true` for the external arc.
 */
export function ruleVersionBody(
  requirementLibraryItemId: string, over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    workTypeKey: "montazh-elektrotekhnichnykh-ustanovok",
    stageKey: "prykhovani-roboty",
    interventionType: "hold",
    blockingScope: "blocks_stage_closure",
    timing: "before_concealment",
    evidenceKind: "photo",
    performerRole: "foreman",
    approverRole: "technical_supervisor",
    allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 5 * 1024 * 1024 },
    requirementLibraryItemId,
    ...over,
  };
}

/**
 * The same v0.1 rule shape resting on ADR-010's SECOND source arm: an item the
 * workspace authored from its own робоча документація rather than a shipped
 * Додаток Н row.
 *
 * A SIBLING OF `ruleVersionBody`, NOT A PARAMETER OF IT. The request's
 * superRefine requires EXACTLY ONE of the two source ids, so a single builder
 * taking both would make «neither» and «both» — the two shapes this command may
 * never receive — reachable by ordinary use of the fixture.
 *
 * IT IS BUILT FROM `ruleVersionBody` RATHER THAN BESIDE IT, so the two arms
 * cannot drift: everything except the source id is literally the same object,
 * and a field added to the shared shape reaches this arm without a second edit.
 * The uuid handed in below is destructured away before the body is returned and
 * never reaches a route — the delete removes the KEY, so this does not lean on
 * `JSON.stringify` dropping an undefined value the way an inline
 * `requirementLibraryItemId: undefined` override does.
 */
export function projectSourcedRuleVersionBody(
  projectSourcedRequirementItemId: string, over: Record<string, unknown> = {},
): Record<string, unknown> {
  const shared = ruleVersionBody("00000000-0000-0000-0000-000000000000");
  delete shared.requirementLibraryItemId;
  return { ...shared, projectSourcedRequirementItemId, ...over };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Runs `fn` with one temporary BEFORE INSERT trigger on
 * public.transaction_outbox that raises for a single aggregate id.
 *
 * WHY A TRIGGER AND NOT A MOCK. "An induced failure publishes nothing" is a
 * claim about the TRANSACTION, and it is only worth asserting if the failure
 * lands AFTER the command has already written — after the renumbering, after
 * the status flip, after the audit row. Every refusal a test can trigger from
 * the outside (a stale manifest, a missing binding, a published version) is
 * checked BEFORE any of those writes, so it would prove nothing about rollback.
 * `enqueueOutbox` is the last thing both commands do; making that insert fail
 * is the only way to reach the interesting state without mocking the database
 * module out from under `withTenantTx`.
 *
 * The trigger is scoped to ONE aggregate id, so a suite running concurrently
 * against the same local Postgres is unaffected, and it is dropped in a
 * `finally`. The id is interpolated because a trigger body cannot take a
 * parameter and a session GUC would not reach the application's pooled
 * connection; it is checked against a uuid pattern first.
 */
export async function withOutboxInsertFailure<T>(
  aggregateId: string, fn: () => Promise<T>,
): Promise<T> {
  if (!UUID.test(aggregateId)) {
    throw new Error(`withOutboxInsertFailure: ${aggregateId} is not a uuid`);
  }
  await q(`create or replace function public.goproceed_test_induced_outbox_failure()
             returns trigger language plpgsql as $fn$
           begin
             if new.aggregate_id = '${aggregateId}' then
               raise exception 'induced failure after the command wrote its own rows';
             end if;
             return new;
           end $fn$`);
  await q(`create trigger goproceed_test_induced_outbox_failure
             before insert on public.transaction_outbox
             for each row execute function public.goproceed_test_induced_outbox_failure()`);
  try {
    return await fn();
  } finally {
    await q(`drop trigger if exists goproceed_test_induced_outbox_failure
               on public.transaction_outbox`);
    await q(`drop function if exists public.goproceed_test_induced_outbox_failure()`);
  }
}
