import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { validationFailed } from "../../../../../src/lib/manual-baseline";
import { publishImportBatchRequest, type PublishImportBatchResponse } from "@goproceed/contracts";
import { matchLineage, decimalText, canonicalPriceBasis, type TaxMode } from "@goproceed/domain";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";

export const runtime = "nodejs";

interface MappedJson {
  sourceKey: string | null; workCode: string | null; description: string;
  section: string | null; unitText: string; normalizedUnit: string;
  quantity: { scaled: string; scale: number } | null;
  unitPrice: { scaled: string; scale: number } | null;
  unitPriceState: "known" | "zero" | "missing";
  derivedMinor: string | null; sourceMinor: string | null;
  valuationBasis: "unit_price_derived" | "approved_source_amount";
  net: string | null; tax: string | null; gross: string | null;
  locationName: string | null; externalRef: string | null;
}

export const POST = commandRoute(publishImportBatchRequest, async (a) => {
  const batchId = a.params.batchId;
  if (!batchId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const pre = await tx.query(
      `select workspace_id, project_id, contract_id from public.import_batches where id = $1`, [batchId]);
    if (pre.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = pre.rows[0].workspace_id;
    const projectId: string = pre.rows[0].project_id;
    const contractId: string = pre.rows[0].contract_id;
    return withIdempotency<PublishImportBatchResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "import_batches.publish", key: a.idempotencyKey, requestHash: a.requestHash,
      // Publishing a contract version is the ledger event of v0.1-M1: it fixes
      // the money pool every later exposure slice is carved from. It shipped on
      // the 30-day default, which TODOS.md carried as a deferred finding.
      idempotencyClass: "ledger_400d",
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "imports.publish" });

      // Lock ORDER: contract first (serializes version_no per contract), then batch.
      const c = await tx.query(
        `select * from public.contracts where workspace_id = $1 and id = $2 for update`,
        [workspaceId, contractId]);
      const b = await tx.query(
        `select * from public.import_batches where workspace_id = $1 and id = $2 for update`,
        [workspaceId, batchId]);
      const batch = b.rows[0];
      const contract = c.rows[0];
      if (batch.status !== "preview_ready") {
        throw new HttpProblem(409, problem("IMPORT_JOB_CONFLICT",
          "Пакет імпорту не готовий до публікації.",
          { requestId: a.requestId, retryable: true, userAction: "refresh_import_job" }));
      }
      if (Number(batch.version) !== a.body.expectedVersion) {
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Пакет імпорту було змінено. Оновіть сторінку і повторіть.",
          { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));
      }
      if (batch.source_manifest_hash !== a.body.confirmedManifestHash) {
        throw new HttpProblem(409, problem("IMPORT_REVIEW_STALE",
          "Джерело або мапінг змінилися після перегляду. Запустіть перевірку знову.",
          { requestId: a.requestId, retryable: false, userAction: "run_new_dry_run" }));
      }

      // ── INV-083, on the second route to a published baseline ─────────────
      //
      // «No baseline is published in v0.1 without a bound requirement
      // rule-version set»: contract_versions.publish and import_batches.publish
      // both refuse a version carrying no contract_version_rule_bindings row,
      // or the invariant holds on neither (invariant-catalog.csv:84,
      // transition-catalog.csv:13, version-0.1.md §"Exit gates", ADR-006
      // decision 3). The manual route has refused since M1; this one published
      // a baseline with no obligations at all, which is the route the pilot
      // actually uses. This is that refusal.
      //
      // NOT AN IMPORT EXPANSION. ADR-006 decision 1 freezes the importer, and
      // what it freezes is expansion — a new format, a new mapping affordance,
      // a new parsing behaviour, a new column read out of a spreadsheet. This
      // adds none. It closes a gate BYPASS on an existing route, and a bypass
      // left open is INV-083 holding on one route, which the invariant itself
      // says is the same as holding on neither. Nothing about the source file,
      // the mapping, the parse or the money changes here.
      //
      // WHY THE REFUSAL IS LAST OF THE FOUR PRECONDITIONS. The three above are
      // about whether THIS BATCH may be published at all — it is not ready, it
      // was changed under the caller, its source moved. Answering any of them
      // with «прив'яжіть вимоги і повторіть» would name an action that cannot
      // succeed; an already-published batch in particular can never be
      // published again no matter what is bound. This one is the first
      // condition about the BASELINE rather than about the batch, and it is
      // checked before anything is written.
      //
      // A caller that repeats an id means it once, so the set is deduplicated
      // before it is counted — exactly as contract_versions.bind_rules does —
      // and a request of three copies of one id is a set of one, not of three.
      const wantedRuleVersions = [...new Set(a.body.ruleVersionIds)];
      if (wantedRuleVersions.length === 0) {
        throw new HttpProblem(409, problem("RULE_BINDING_REQUIRED",
          "Базис не публікується без прив'язаного набору версій правил. "
          + "Виберіть вимоги для цього імпорту і повторіть публікацію.",
          { requestId: a.requestId, retryable: false,
            userAction: "bind_rule_versions_then_publish" }));
      }

      // READ BACK BEFORE WRITING ANYTHING. Three of the four things that can be
      // wrong with this set are unrepresentable in storage — a draft rule
      // version cannot be bound (composite FK on the literal discriminator
      // has_been_published, 0041:495-497), a binding cannot misreport the stage
      // its version names (0041:485-486), and one rule cannot contribute two
      // versions to one baseline (0041:476) — but each of them reaches the
      // caller as a raw 23503/23505 turned into a 500, and a 500 is not a
      // refusal anyone can act on. Same reasoning, same field-error shape and
      // the same catalogued codes as
      // contract-versions/[versionId]/rule-bindings/route.ts:77-143, so the two
      // routes refuse the same request identically.
      const namedRuleVersions = await tx.query(
        `select id, requirement_rule_id, status, stage_key
           from public.requirement_rule_versions
          where workspace_id = $1 and id = any($2::uuid[])`,
        [workspaceId, wantedRuleVersions]);
      const ruleVersionById = new Map(
        namedRuleVersions.rows.map((r) => [r.id as string, r]));
      const fieldPath = (id: string) => `ruleVersionIds[${a.body.ruleVersionIds.indexOf(id)}]`;

      const unknownRuleVersions = wantedRuleVersions.filter((id) => !ruleVersionById.has(id));
      if (unknownRuleVersions.length > 0) {
        throw validationFailed(a.requestId,
          "Одну або кілька версій правил не знайдено в цьому робочому просторі.",
          unknownRuleVersions.map((id) => ({
            path: fieldPath(id), message: "unknown rule version in this workspace",
          })));
      }
      const unpublishedRuleVersions = wantedRuleVersions.filter(
        (id) => ruleVersionById.get(id)!.status !== "published");
      if (unpublishedRuleVersions.length > 0) {
        throw validationFailed(a.requestId,
          "До базису можна прив'язати лише опубліковану версію правила. "
          + "Вилучена з обігу версія не потрапляє до нових базисів (INV-067).",
          unpublishedRuleVersions.map((id) => ({
            path: fieldPath(id),
            message: `rule version is ${ruleVersionById.get(id)!.status}, not published`,
          })));
      }
      // ONE RULE CONTRIBUTES AT MOST ONE VERSION TO A BASELINE (0041:471-476).
      // The contract version this publication creates does not exist yet, so
      // there are no bindings to conflict with — the only way to violate the
      // key here is to name two versions OF THE SAME RULE in one request, and
      // the deduplication above does not catch that because the two ids differ.
      // Unchecked, the first insert succeeds and the second raises 23505.
      const byLineage = new Map<string, string[]>();
      for (const id of wantedRuleVersions) {
        const ruleId = ruleVersionById.get(id)!.requirement_rule_id as string;
        byLineage.set(ruleId, [...(byLineage.get(ruleId) ?? []), id]);
      }
      const doubled = [...byLineage.values()].filter((ids) => ids.length > 1).flat();
      if (doubled.length > 0) {
        throw validationFailed(a.requestId,
          "Одне правило дає базису щонайбільше одну версію, "
          + "а в запиті названо дві версії того самого правила.",
          doubled.map((id) => ({
            path: fieldPath(id),
            message: "two versions of one rule cannot be bound to one baseline",
          })));
      }

      // Immutable party snapshots from CURRENT profiles.
      const snap = async (partyId: string): Promise<Record<string, unknown>> => {
        const r = await tx.query(
          `select p.display_name, lp.official_name, lp.edrpou, lp.vat_number,
                  lp.tax_status, lp.legal_address, lp.country_code
             from public.parties p
             left join public.party_legal_profiles lp
               on lp.workspace_id = p.workspace_id and lp.party_id = p.id
            where p.workspace_id = $1 and p.id = $2`, [workspaceId, partyId]);
        return r.rows[0] ?? {};
      };
      const ownSnapshot = await snap(contract.own_party_id);
      const customerSnapshot = await snap(contract.customer_party_id);

      // TWO QUERIES BECAUSE THEY ASK TWO DIFFERENT QUESTIONS, and migration 0042
      // is what split them: once a contract version may be a DRAFT, the single
      // `order by version_no desc limit 1` this used to be started answering
      // «the contract's current version» with a draft nobody has agreed to.
      // 0042's header names this route and the assignments route as the two such
      // readers and corrects both in that migration's own slice.
      //
      //  * The NUMBER is max+1 over EVERY version, drafts included, because
      //    unique (workspace_id, contract_id, version_no) counts drafts too and
      //    reusing an open draft's number would fail the insert with a raw 23505.
      //  * The SUPERSEDED VERSION is the latest PUBLISHED one. A baseline may
      //    only supersede an agreement; naming a draft would make the diff
      //    contract_versions.get computes compare against something nobody
      //    signed. Same rule contract_versions.create enforces on the manual path.
      const numbering = await tx.query(
        `select coalesce(max(version_no), 0) as v from public.contract_versions
          where workspace_id = $1 and contract_id = $2`,
        [workspaceId, contractId]);
      const versionNo = Number(numbering.rows[0].v) + 1;
      const prev = await tx.query(
        `select id from public.contract_versions
          where workspace_id = $1 and contract_id = $2 and status = 'published'
          order by version_no desc limit 1`,
        [workspaceId, contractId]);
      const supersedesVersionId: string | null = prev.rows[0]?.id ?? null;

      // Publishable rows: latest attempt, non-blocking, in deterministic source
      // order. import_file_id leads the ordering because two CSVs in one batch
      // both carry worksheet null and share row numbers.
      const rows = await tx.query(
        `select r.id, r.import_file_id, r.worksheet, r.source_row, r.mapped, r.error_codes
           from public.import_row_results r
           join public.import_files f
             on f.workspace_id = r.workspace_id and f.id = r.import_file_id
          where r.workspace_id = $1 and r.import_batch_id = $2 and r.attempt = $3
            and r.severity <> 'blocking'
          order by f.uploaded_at, f.id, r.worksheet nulls first, r.source_row`,
        [workspaceId, batchId, batch.current_attempt]);

      // Units by normalized code.
      const unitRows = await tx.query(
        `select id, normalized_code, unit_precision, code from public.unit_definitions where workspace_id = $1`,
        [workspaceId]);
      const units = new Map(unitRows.rows.map(
        (u) => [u.normalized_code, { id: u.id as string, precision: u.unit_precision as number, code: u.code as string }]));

      // Locations named in the mapped column, resolved find-or-create per
      // project (same auto-registration pattern as unit_definitions).
      const locationIds = new Map<string, string>();
      const wantedLocations = [...new Set(rows.rows
        .map((r) => (r.mapped as MappedJson).locationName)
        .filter((n): n is string => typeof n === "string" && n.trim() !== "")
        .map((n) => n.trim()))];
      if (wantedLocations.length > 0) {
        const existing = await tx.query(
          `select id, name from public.locations
            where workspace_id = $1 and project_id = $2 and name = any($3::text[])`,
          [workspaceId, projectId, wantedLocations]);
        for (const l of existing.rows) locationIds.set(l.name, l.id);
        for (const name of wantedLocations) {
          if (locationIds.has(name)) continue;
          const created = await tx.query(
            `insert into public.locations (id, workspace_id, project_id, name, created_by)
             values ($1,$2,$3,$4,$5) returning id`,
            [randomUUID(), workspaceId, projectId, name, a.userId]);
          locationIds.set(name, created.rows[0].id);
        }
      }

      // Predecessor lineage against the superseded version. ORDER BY position
      // keeps matchLineage's "first match wins" rule deterministic when the
      // previous version holds duplicate source keys.
      let lineage = new Map<number, string>();
      if (supersedesVersionId) {
        const prevItems = await tx.query(
          `select id, source_key, work_code, description from public.work_items
            where workspace_id = $1 and contract_version_id = $2
            order by position`,
          [workspaceId, supersedesVersionId]);
        lineage = matchLineage(
          prevItems.rows.map((p) => ({
            id: p.id, sourceKey: p.source_key, workCode: p.work_code, description: p.description,
          })),
          rows.rows.map((r, i) => {
            const mp = r.mapped as MappedJson;
            return { position: i + 1, sourceKey: mp.sourceKey, workCode: mp.workCode, description: mp.description };
          }));
      }

      const contractVersionId = randomUUID();
      await tx.query(
        `insert into public.contract_versions
           (id, workspace_id, project_id, contract_id, version_no, status,
            own_party_snapshot, customer_party_snapshot, currency, tax_mode, tax_rate_bps,
            terms, approval_policy, rounding_policy,
            source_tolerance_minor_units, source_tolerance_bps,
            import_batch_id, source_manifest_hash, supersedes_version_id, published_by)
         values ($1,$2,$3,$4,$5,'published',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [contractVersionId, workspaceId, projectId, contractId, versionNo,
         JSON.stringify(ownSnapshot), JSON.stringify(customerSnapshot),
         contract.currency, contract.tax_mode, contract.tax_rate_bps,
         JSON.stringify(contract.terms), JSON.stringify(contract.approval_policy),
         JSON.stringify(contract.rounding_policy),
         contract.source_tolerance_minor_units, contract.source_tolerance_bps,
         batchId, batch.source_manifest_hash, supersedesVersionId, a.userId]);

      // ── The rule-version set, pinned in the same commit ──────────────────
      //
      // IT HAS TO BE THIS TRANSACTION AND THERE IS NO SECOND CALL AVAILABLE.
      // app.guard_rule_binding_window() (migration 0042 §5) admits a binding
      // only when the target contract version is a draft OR was created by the
      // current transaction — `cv.xmin = pg_current_xact_id()::xid`. That
      // second disjunct exists for this route and nothing else: 0042:426-433
      // names «the frozen importer, which inserts an already-published version
      // and binds to it in the same commit» as the reason it is there. A
      // binding attempted after this transaction commits is refused by the
      // guard, which is INV-080 — a rule published after a baseline never
      // reaches it — and is why the set cannot be a follow-up call.
      //
      // The INSERT grant and the `cvrb_insert` policy were both written for
      // this: 0041:565-570 justifies the grant with «import_batches.publish
      // (INV-083 holds on BOTH routes to a published baseline or it holds on
      // neither)», and 0041:785-787 admits `imports.publish` alongside
      // `rule_bindings.manage` precisely so this actor can pin the same set.
      // Until now both were dead code.
      //
      // requirement_rule_id and stage_key are copied off the rule version
      // rather than taken from the caller, so a binding cannot misreport the
      // stage its own version names; the composite FK (0041:485-486) would
      // refuse it anyway, and reading them here means the refusal never has to
      // fire. bound_rule_version_is_published is left to its CHECK-forced
      // default for the reason rule-bindings/route.ts:139-142 gives: the column
      // exists so the composite FK can only resolve against a version whose
      // generated has_been_published is true, and writing it here would suggest
      // this command is the thing deciding it.
      for (const ruleVersionId of wantedRuleVersions) {
        const rv = ruleVersionById.get(ruleVersionId)!;
        await tx.query(
          `insert into public.contract_version_rule_bindings
             (id, workspace_id, project_id, contract_id, contract_version_id,
              requirement_rule_id, requirement_rule_version_id, stage_key, bound_by_member_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [randomUUID(), workspaceId, projectId, contractId, contractVersionId,
           rv.requirement_rule_id, ruleVersionId, rv.stage_key, m.memberId]);
      }
      const boundRuleVersionCount = wantedRuleVersions.length;
      // The distinct stage keys of the bound set ARE this baseline's stage
      // vocabulary — M2 materialises stages and occurrences from the binding
      // rather than from a member command — so they are recorded in the audit
      // for the same reason contract_versions.bind_rules returns them.
      const stageKeys = [...new Set(
        wantedRuleVersions.map((id) => ruleVersionById.get(id)!.stage_key as string))].sort();

      // Money is NOT recomputed here. validate decided each row's canonical
      // value under one pin generation and stored it; publish writes exactly
      // that, so a pin edited between validate and publish cannot produce a
      // version whose amounts contradict its own recorded tax rate.
      const priceBasis = canonicalPriceBasis(contract.tax_mode as TaxMode);
      const COLS = 30;
      const rowValues: unknown[][] = rows.rows.map((r, i) => {
        const position = i + 1;
        const mp = r.mapped as MappedJson;
        const unit = units.get(mp.normalizedUnit);
        if (!unit || !mp.quantity) {
          // Defensive: a non-blocking row always carries a resolved unit + quantity.
          throw new Error(`publish invariant: row ${r.id} lacks unit or quantity`);
        }
        const approvedBasis = mp.valuationBasis === "approved_source_amount";
        return [randomUUID(), workspaceId, projectId, contractId, contractVersionId, position,
          mp.sourceKey, mp.workCode, mp.description, mp.section,
          unit.id, unit.code, unit.precision,
          decimalText(mp.quantity.scaled, mp.quantity.scale),
          mp.unitPriceState,
          // Tied to the STATE, not to the presence of a parsed value. A price of
          // 0,00 parses into a Decimal whose object is truthy, so the old
          // `mp.unitPrice ? …` wrote "0.00" alongside state 'zero' and violated
          // `(unit_price_state = 'known') = (unit_price_decimal is not null)` —
          // publishing any estimate containing a zero-priced row returned 500.
          // Zero-priced rows are ordinary (work bundled into another line).
          mp.unitPriceState === "known" && mp.unitPrice
            ? decimalText(mp.unitPrice.scaled, mp.unitPrice.scale) : null,
          mp.unitPrice ? priceBasis : null,
          approvedBasis ? "approved_source_amount" : "unit_price_derived",
          contract.currency, contract.tax_mode, contract.tax_rate_bps,
          mp.sourceMinor, approvedBasis ? mp.sourceMinor : null,
          mp.net ?? "0", mp.tax ?? "0", mp.gross ?? "0",
          mp.locationName ? locationIds.get(mp.locationName.trim()) ?? null : null,
          mp.externalRef, r.id, lineage.get(position) ?? null];
      });
      const CHUNK_ROWS = 500;
      for (let start = 0; start < rowValues.length; start += CHUNK_ROWS) {
        const chunk = rowValues.slice(start, start + CHUNK_ROWS);
        const values = chunk.flat();
        const tuples = chunk.map((_, i) => {
          const b = i * COLS;
          return `(${Array.from({ length: COLS }, (_, c) => `$${b + c + 1}`).join(",")})`;
        }).join(",");
        await tx.query(
          `insert into public.work_items
             (id, workspace_id, project_id, contract_id, contract_version_id, position,
              source_key, work_code, description, section,
              unit_definition_id, unit_code, unit_precision,
              contract_quantity, unit_price_state, unit_price_decimal, price_basis,
              valuation_basis, currency, tax_mode, tax_rate_bps,
              source_amount_minor_units, approved_amount_minor_units,
              net_amount_minor_units, tax_amount_minor_units, gross_amount_minor_units,
              location_id, external_ref, source_row_result_id, predecessor_work_item_id)
           values ${tuples}`, values);
      }
      const position = rowValues.length;

      await tx.query(
        `update public.import_batches
            set status = 'published', published_version_id = $3, version = version + 1, updated_at = now()
          where workspace_id = $1 and id = $2`,
        [workspaceId, batchId, contractVersionId]);
      await recordAudit(tx, ctx, {
        action: "contract_version.published", object_type: "contract_version",
        object_id: contractVersionId,
        details: {
          versionNo, workItemCount: position,
          // What INV-083 held against, recorded on the object it held for.
          // contract_versions.publish records boundRuleVersionCount on its own
          // publication audit; this route records the SET as well, because on
          // the manual path the identities are already in the trail — the
          // separate `contract_version.rules_bound` audit row bind_rules writes
          // — and on this path there is no such row to find. Without it the
          // audit could say a baseline was gated and not say by what.
          boundRuleVersionCount, ruleVersionIds: wantedRuleVersions, stageKeys,
        },
      }, { organizationId: workspaceId, objectVersion: versionNo });
      // NO SECOND OUTBOX EVENT. technical/events/event-catalog.csv:16 names
      // exactly one producer for `contract_version.rules_bound` —
      // bff.contract_versions.bind_rules — and emitting it here would add an
      // uncatalogued producer in a slice that is closing a gate, not extending
      // an event contract. `contract_version.published` is emitted below and
      // its catalog row (line 7) already names BOTH producers and records that
      // both refuse an unbound version; a consumer reading that event finds the
      // bindings committed, because they were written in this transaction. If a
      // consumer is ever found that needs the binding event from this route,
      // that is a catalog change first.
      await enqueueOutbox(tx, ctx, {
        topic: "contract_version.published", aggregate_type: "contract_version",
        aggregate_id: contractVersionId, payload_version: 1,
        payload: { workspaceId, projectId, contractId, contractVersionId, versionNo },
      }, { organizationId: workspaceId });
      return {
        status: 201,
        body: {
          contractVersionId, versionNo, workItemCount: position, supersedesVersionId,
          boundRuleVersionCount,
        },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
