import { commandRoute } from "../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../src/lib/authz";
import {
  deriveLine, locateWorkItem, notFoundWorkItem, pinsFrom, requireBindableWorkType,
  requireDraft, resolveUnit, validationFailed, workItemView, type ResolvedUnit, refuseUnlockableVersion,
} from "../../../../src/lib/manual-baseline";
import {
  updateWorkItemRequest, removeWorkItemRequest,
  type UpdateWorkItemResponse, type RemoveWorkItemResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `work_items.update` — PATCH /v1/work-items/{workItemId}
 * `work_items.remove` — DELETE /v1/work-items/{workItemId}
 * (technical/openapi/scope-v0.1.csv:17-18; both command, idempotency required,
 * member plane, governed by contracts.edit).
 *
 * BOTH ARE REFUSED ON A PUBLISHED VERSION (INV-015), and the refusal is
 * enforced twice on purpose: `requireDraft` below turns it into a catalogued
 * problem+json, and app.guard_work_item() (migration 0042 §3) makes it
 * impossible in the database, so a future route that forgot the check would
 * still fail rather than corrupt a published baseline. Neither layer is
 * decorative — the route exists to give the caller a code it can act on, the
 * trigger exists because a convention is not an invariant.
 *
 * `work_items.remove` is the ONLY DELETE in the v0.1 route set.
 *
 * `null` clears an optional field and an absent field is left alone; that
 * distinction is the whole reason the correction is a PATCH.
 *
 * NO OPTIMISTIC-CONCURRENCY GUARD. public.work_items has no `version` column
 * (0012:219-268), so there is no counter for an `expectedVersion` to compare
 * against and @goproceed/contracts declares none. Two ПТВ users correcting one
 * draft line resolve last-write-wins. What is NOT lost is the publication
 * confirmation: contract_versions.publish refuses a manifest hash that no
 * longer matches the line set, so a correction that lands between review and
 * publication is caught there rather than silently published.
 */

/**
 * The patch body as this route reads it. EVERY OPTIONAL FIELD OF
 * `updateWorkItemRequest` MUST APPEAR HERE, because `a.body` is cast to this
 * shape and a field the cast omits is not a runtime bug — it is a compile error
 * at the point of use, or worse, `undefined` read through a wider cast. When
 * @goproceed/contracts gains a patchable field, it is added here in the same
 * change; `workTypeKey` arrived with migration 0050 and the two moved together.
 */
interface Patchable {
  sourceKey?: string | null; workCode?: string | null; description?: string;
  section?: string | null; unitCode?: string;
  contractQuantity?: string; unitPriceState?: "known" | "zero" | "missing";
  unitPrice?: string | null; sourceAmountMinor?: string | null;
  externalRef?: string | null; predecessorWorkItemId?: string | null;
  /**
   * `null` CLEARS the work type and absent leaves it alone — the distinction
   * `merged` below exists for, and the one that lets a typist who classified a
   * line wrongly say so without inventing a replacement. See the guarded call
   * to `requireBindableWorkType`.
   */
  workTypeKey?: string | null;
}
/** `undefined` means "not in the body"; `null` means "clear it". */
const merged = <T>(patched: T | null | undefined, current: T | null): T | null =>
  patched === undefined ? current : patched;

export const PATCH = commandRoute(updateWorkItemRequest, async (a) => {
  const workItemId = a.params.workItemId;
  if (!workItemId) throw notFoundWorkItem(a.requestId);
  const body = a.body as Patchable;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const at = await locateWorkItem(tx, workItemId);
    if (!at) throw notFoundWorkItem(a.requestId);

    return withIdempotency<UpdateWorkItemResponse>(tx, {
      organizationId: at.workspaceId, actorScope: `user:${a.userId}`,
      operationId: "work_items.update", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, at.workspaceId);
      await requireProjectCapability(tx, a.requestId, {
        workspaceId: at.workspaceId, projectId: at.projectId,
        memberId: m.memberId, capability: "contracts.edit",
      });

      // Version first, then the line: the same lock order work_items.create
      // takes, so a correction and a fresh line cannot deadlock each other.
      const v = await tx.query(
        `select status, currency, tax_mode, tax_rate_bps, rounding_policy,
                source_tolerance_minor_units, source_tolerance_bps, supersedes_version_id
           from public.contract_versions
          where workspace_id = $1 and id = $2 for update`,
        [at.workspaceId, at.contractVersionId]);
      // `v.rows[0].status` off an EMPTY result was a TypeError and a 500. The
      // lock comes back empty for a published version, which is precisely the
      // case requireDraft exists to refuse. See refuseUnlockableVersion.
      if (v.rows.length === 0) {
        await refuseUnlockableVersion(tx, a.requestId, at.workspaceId, at.contractVersionId);
      }
      const version = v.rows[0];
      requireDraft(a.requestId, version.status);

      const cur = (await tx.query(
        `select * from public.work_items where workspace_id = $1 and id = $2 for update`,
        [at.workspaceId, workItemId])).rows[0];
      if (!cur) throw notFoundWorkItem(a.requestId);

      const pins = pinsFrom(version);
      // The unit is re-resolved only when the caller retyped it; otherwise the
      // line keeps the definition — and therefore the PRECISION — it was
      // created against. Re-resolving by code every time would silently repin a
      // quantity if the workspace's definition for that code had changed.
      const unit: ResolvedUnit = body.unitCode !== undefined
        ? await resolveUnit(tx, at.workspaceId, a.userId, body.unitCode)
        : { id: cur.unit_definition_id, code: cur.unit_code, precision: cur.unit_precision };

      // The price and its state are one fact under one CHECK
      // ((unit_price_state = 'known') = (unit_price_decimal is not null)), so
      // the contract requires them to be corrected together. A state that is
      // not 'known' clears the price whether or not the caller sent one.
      const state: "known" | "zero" | "missing" = body.unitPriceState
        ?? (cur.unit_price_state as "known" | "zero" | "missing");
      const price = body.unitPriceState !== undefined
        ? (body.unitPriceState === "known" ? body.unitPrice ?? null : null)
        : (cur.unit_price_decimal === null ? null : String(cur.unit_price_decimal));

      const sourceKey = merged(body.sourceKey, cur.source_key as string | null);
      const workCode = merged(body.workCode, cur.work_code as string | null);
      const description = body.description ?? (cur.description as string);
      const section = merged(body.section, cur.section as string | null);
      const contractQuantity = body.contractQuantity ?? String(cur.contract_quantity);
      const sourceAmountMinor = merged(body.sourceAmountMinor,
        cur.source_amount_minor_units === null ? null : String(cur.source_amount_minor_units));
      const externalRef = merged(body.externalRef, cur.external_ref as string | null);
      const workTypeKey = merged(body.workTypeKey, cur.work_type_key as string | null);
      const predecessorWorkItemId = merged(
        body.predecessorWorkItemId, cur.predecessor_work_item_id as string | null);

      const derived = deriveLine(a.requestId, {
        description, unitCode: unit.code, contractQuantity,
        unitPriceState: state, unitPrice: price, sourceAmountMinor,
        sourceKey, workCode, section, externalRef, predecessorWorkItemId,
      }, unit, pins);

      // Re-checked on every correction, not only when the field is in the body:
      // a caller may change nothing but the version's superseded target is
      // fixed, so the only way this can newly fail is a body that names a
      // predecessor, and checking unconditionally costs one indexed read.
      if (predecessorWorkItemId) {
        if (!version.supersedes_version_id) {
          throw validationFailed(a.requestId,
            "Ця версія нічого не заміщує, тому позиція не може мати попередника.",
            [{ path: "predecessorWorkItemId", message: "this version supersedes nothing" }]);
        }
        const pred = await tx.query(
          `select 1 from public.work_items
            where workspace_id = $1 and contract_version_id = $2 and id = $3`,
          [at.workspaceId, version.supersedes_version_id, predecessorWorkItemId]);
        if (pred.rows.length === 0) {
          throw validationFailed(a.requestId,
            "Попередню позицію не знайдено у версії, яку заміщує ця чернетка.",
            [{ path: "predecessorWorkItemId", message: "not a line of the superseded version" }]);
        }
      }

      // CHECKED ONLY WHEN THE KEY ITSELF MOVES, and that is the point rather
      // than an optimisation. `app.guard_work_item_work_type` short-circuits on
      // an unchanged key (migration 0050 §5) so that retiring the last rule
      // version carrying a key never traps an existing draft line: correcting
      // that line's description must not fail because of a retirement it had
      // nothing to do with. The route asks the same question the trigger does,
      // in the same shape, so the two cannot disagree about which corrections
      // are legal.
      const workTypeKeyChanged = workTypeKey !== (cur.work_type_key as string | null);
      const workTypeKeyCleared = cur.work_type_key !== null && workTypeKey === null;
      if (workTypeKeyChanged) {
        await requireBindableWorkType(tx, a.requestId, {
          workspaceId: at.workspaceId,
          contractVersionId: at.contractVersionId,
          workTypeKey,
        });
      }

      const updated = await tx.query(
        `update public.work_items
            set source_key = $3, work_code = $4, description = $5, section = $6,
                unit_definition_id = $7, unit_code = $8, unit_precision = $9,
                contract_quantity = $10, unit_price_state = $11, unit_price_decimal = $12,
                price_basis = $13,
                source_amount_minor_units = $14,
                net_amount_minor_units = $15, tax_amount_minor_units = $16,
                gross_amount_minor_units = $17,
                external_ref = $18, predecessor_work_item_id = $19,
                work_type_key = $20
          where workspace_id = $1 and id = $2
          returning *`,
        [at.workspaceId, workItemId, sourceKey, workCode, description, section,
         unit.id, unit.code, unit.precision,
         derived.contractQuantityText, state, derived.unitPriceText, derived.priceBasis,
         sourceAmountMinor,
         String(derived.netMinor), String(derived.taxMinor), String(derived.grossMinor),
         externalRef, predecessorWorkItemId, workTypeKey]);
      // currency, tax_mode, tax_rate_bps, valuation_basis, position, location_id
      // and source_row_result_id are deliberately absent from this SET: the
      // first three are pinned by the version and frozen by
      // app.guard_work_item(), valuation_basis has one storable value in v0.1,
      // and the last three are not correctable through this operation.

      const count = await tx.query(
        `select count(*)::int as n from public.work_items
          where workspace_id = $1 and contract_version_id = $2`,
        [at.workspaceId, at.contractVersionId]);

      await recordAudit(tx, ctx, {
        action: "work_item.corrected", object_type: "work_item", object_id: workItemId,
        details: {
          contractVersionId: at.contractVersionId,
          // Field NAMES only. technical/error-catalog.csv's log policy for a
          // validation failure is field_codes_no_values, and the same restraint
          // applies to an audit detail: a quantity is commercial content.
          fields: Object.keys(body).sort(),
          // THE ONE TRANSITION THE FIELD NAMES CANNOT EXPRESS. `fields` says
          // "workTypeKey" whenever the body carried the key — including when it
          // carried the value the line already had, and including when it
          // carried `null`. Neither says which way the obligation set moved,
          // and this is the field that decides the obligation set: clearing a
          // work type removes every requirement occurrence a future assignment
          // on this line would have materialised, and on publication it is also
          // how a draft slips past RULE_BINDING_REQUIRED. A published version is
          // immutable, so the correction that cleared the key is the last
          // reversible moment and the audit row is what an auditor reads after
          // it. Two booleans, no values — same restraint as `fields` above, and
          // the same shape contract_version.published's own coverage counts use.
          workTypeKeyChanged, workTypeKeyCleared,
        },
      }, { organizationId: at.workspaceId });

      return {
        status: 200,
        body: { workItem: workItemView(updated.rows[0]), workItemCount: Number(count.rows[0].n) },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});

export const DELETE = commandRoute(removeWorkItemRequest, async (a) => {
  const workItemId = a.params.workItemId;
  if (!workItemId) throw notFoundWorkItem(a.requestId);

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const at = await locateWorkItem(tx, workItemId);
    if (!at) throw notFoundWorkItem(a.requestId);

    return withIdempotency<RemoveWorkItemResponse>(tx, {
      organizationId: at.workspaceId, actorScope: `user:${a.userId}`,
      operationId: "work_items.remove", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, at.workspaceId);
      await requireProjectCapability(tx, a.requestId, {
        workspaceId: at.workspaceId, projectId: at.projectId,
        memberId: m.memberId, capability: "contracts.edit",
      });

      const v = await tx.query(
        `select status from public.contract_versions
          where workspace_id = $1 and id = $2 for update`,
        [at.workspaceId, at.contractVersionId]);
      if (v.rows.length === 0) {
        await refuseUnlockableVersion(tx, a.requestId, at.workspaceId, at.contractVersionId);
      }
      requireDraft(a.requestId, v.rows[0].status);

      // Positions are NOT closed up here. Renumbering a permutation inside
      // unique (workspace_id, contract_version_id, position) is not safe in one
      // statement, and a draft with a gap is harmless: every reader orders by
      // position and none of them requires it to be contiguous. Publication
      // renumbers to 1..N in two disjoint passes, so what is published looks
      // exactly like what the importer produces.
      const removed = await tx.query(
        `delete from public.work_items where workspace_id = $1 and id = $2 returning position`,
        [at.workspaceId, workItemId]);
      if (removed.rows.length === 0) throw notFoundWorkItem(a.requestId);

      const count = await tx.query(
        `select count(*)::int as n from public.work_items
          where workspace_id = $1 and contract_version_id = $2`,
        [at.workspaceId, at.contractVersionId]);

      await recordAudit(tx, ctx, {
        action: "work_item.removed", object_type: "work_item", object_id: workItemId,
        details: {
          contractVersionId: at.contractVersionId,
          position: Number(removed.rows[0].position),
        },
      }, { organizationId: at.workspaceId });

      return {
        status: 200,
        body: {
          workItemId,
          contractVersionId: at.contractVersionId,
          workItemCount: Number(count.rows[0].n),
        },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
