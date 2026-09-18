import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import {
  deriveLine, notFoundVersion, pinsFrom, requireBindableWorkType, requireDraft,
  resolveUnit, validationFailed, workItemView, refuseUnlockableVersion,
} from "../../../../../src/lib/manual-baseline";
import { createWorkItemRequest, type CreateWorkItemResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `work_items.create` — POST /v1/contract-versions/{versionId}/work-items
 * (technical/openapi/scope-v0.1.csv:16; command, idempotency required, member
 * plane, governed by contracts.edit).
 *
 * ПТВ types one line. Twenty lines is twenty calls: there is no bulk row in the
 * scope CSV and the M1 acceptance evidence is written against exactly this
 * operation.
 *
 * THIS ROUTE DOES NOT TOUCH THE IMPORTER (ADR-006 decision 6). It creates no
 * import batch, reads no column mapping, and extends no unit inference or
 * number parsing. What it shares with the importer is the DERIVATION — the same
 * canonical price basis, the same rounding midpoint, the same unit-precision
 * pinning, the same INV-054 tolerance rule — because a hand-typed line must be
 * indistinguishable from an imported one in the published version, which is the
 * M1 exit gate.
 */
export const POST = commandRoute(createWorkItemRequest, async (a) => {
  const versionId = a.params.versionId;
  if (!versionId) throw notFoundVersion(a.requestId);

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const v = await tx.query(
      `select workspace_id, project_id, contract_id, status
         from public.contract_versions where id = $1`, [versionId]);
    if (v.rows.length === 0) throw notFoundVersion(a.requestId);
    const workspaceId: string = v.rows[0].workspace_id;
    const projectId: string = v.rows[0].project_id;
    const contractId: string = v.rows[0].contract_id;

    return withIdempotency<CreateWorkItemResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "work_items.create", key: a.idempotencyKey, requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "contracts.edit" });
      },
    }, async () => {
      // Lock the version row: `position` is assigned as max+1 within it, and two
      // concurrent typists would otherwise compute the same position and one of
      // them would meet unique (workspace_id, contract_version_id, position) as
      // a raw 23505. Locking the version rather than taking an advisory lock
      // also serialises against the publish command, which renumbers.
      const locked = await tx.query(
        `select id, status, currency, tax_mode, tax_rate_bps, rounding_policy,
                source_tolerance_minor_units, source_tolerance_bps, supersedes_version_id
           from public.contract_versions
          where workspace_id = $1 and id = $2 for update`,
        [workspaceId, versionId]);
      // An empty lock is not an absent version — cv_update's USING hides a
      // published row from `for update`. See refuseUnlockableVersion.
      if (locked.rows.length === 0) {
        await refuseUnlockableVersion(tx, a.requestId, workspaceId, versionId);
      }
      const version = locked.rows[0];
      requireDraft(a.requestId, version.status);

      const pins = pinsFrom(version);
      const unit = await resolveUnit(tx, workspaceId, a.userId, a.body.unitCode);
      const derived = deriveLine(a.requestId, {
        description: a.body.description,
        unitCode: a.body.unitCode,
        contractQuantity: a.body.contractQuantity,
        unitPriceState: a.body.unitPriceState,
        unitPrice: a.body.unitPrice ?? null,
        sourceAmountMinor: a.body.sourceAmountMinor ?? null,
        sourceKey: a.body.sourceKey ?? null,
        workCode: a.body.workCode ?? null,
        section: a.body.section ?? null,
        externalRef: a.body.externalRef ?? null,
        predecessorWorkItemId: a.body.predecessorWorkItemId ?? null,
      }, unit, pins);

      // Lineage is a claim about the SUPERSEDED version, and the deployed FK
      // only reaches workspace scope (0012:266-267), so a caller could
      // otherwise name any line in the tenant — including one in another
      // contract — and contract_versions.get would compute a diff against a
      // predecessor that never preceded anything. The importer derives lineage
      // by matching (matchLineage); a typed line has no file to match, so the
      // operator names it and this is where the claim is checked.
      if (a.body.predecessorWorkItemId) {
        if (!version.supersedes_version_id) {
          throw validationFailed(a.requestId,
            "Ця версія нічого не заміщує, тому позиція не може мати попередника.",
            [{ path: "predecessorWorkItemId", message: "this version supersedes nothing" }]);
        }
        const pred = await tx.query(
          `select 1 from public.work_items
            where workspace_id = $1 and contract_version_id = $2 and id = $3`,
          [workspaceId, version.supersedes_version_id, a.body.predecessorWorkItemId]);
        if (pred.rows.length === 0) {
          throw validationFailed(a.requestId,
            "Попередню позицію не знайдено у версії, яку заміщує ця чернетка.",
            [{ path: "predecessorWorkItemId", message: "not a line of the superseded version" }]);
        }
      }

      // ADR-006 decision 1 step 1's «picks a work type», refused when it names
      // nothing this workspace can bind. Checked BEFORE the position is claimed
      // so a rejected line leaves no gap and no lock held longer than it must:
      // the refusal is a caller mistake, not a conflict.
      const workTypeKey = a.body.workTypeKey ?? null;
      await requireBindableWorkType(tx, a.requestId,
        { workspaceId, contractVersionId: versionId, workTypeKey });

      const next = await tx.query(
        `select coalesce(max(position), 0) as p from public.work_items
          where workspace_id = $1 and contract_version_id = $2`,
        [workspaceId, versionId]);
      // Positions are assigned max+1 and are NOT renumbered by work_items.remove,
      // so a draft can carry gaps. Publication renumbers to 1..N; see
      // contract-versions/[versionId]/publish/route.ts.
      const position = Number(next.rows[0].p) + 1;

      const inserted = await tx.query(
        `insert into public.work_items
           (id, workspace_id, project_id, contract_id, contract_version_id, position,
            source_key, work_code, description, work_type_key, section,
            unit_definition_id, unit_code, unit_precision,
            contract_quantity, unit_price_state, unit_price_decimal, price_basis,
            valuation_basis, currency, tax_mode, tax_rate_bps,
            source_amount_minor_units, approved_amount_minor_units,
            net_amount_minor_units, tax_amount_minor_units, gross_amount_minor_units,
            location_id, external_ref, source_row_result_id, predecessor_work_item_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
                 $19,$20,$21,$22,$23,null,$24,$25,$26,null,$27,null,$28)
         returning *`,
        [randomUUID(), workspaceId, projectId, contractId, versionId, position,
         a.body.sourceKey ?? null, a.body.workCode ?? null, a.body.description,
         workTypeKey,
         a.body.section ?? null,
         unit.id, unit.code, unit.precision,
         derived.contractQuantityText, a.body.unitPriceState, derived.unitPriceText,
         derived.priceBasis,
         // v0.1 accepts unit_price_derived only: approved_source_amount means a
         // recorded approval with a reason, and public.source_amount_resolutions
         // is keyed on an import row result a typed line does not have.
         a.body.valuationBasis,
         pins.currency, pins.taxMode, pins.taxRateBps,
         a.body.sourceAmountMinor ?? null,
         String(derived.netMinor), String(derived.taxMinor), String(derived.grossMinor),
         a.body.externalRef ?? null, a.body.predecessorWorkItemId ?? null]);
      // approved_amount_minor_units and source_row_result_id are explicit nulls:
      // both belong to the import path, and location_id is null because the
      // location tree leaves v0.1 with ADR-006 decision 4.2.

      const count = await tx.query(
        `select count(*)::int as n from public.work_items
          where workspace_id = $1 and contract_version_id = $2`, [workspaceId, versionId]);

      await recordAudit(tx, ctx, {
        action: "work_item.created", object_type: "work_item",
        object_id: inserted.rows[0].id,
        details: {
          contractVersionId: versionId, position, unitCode: unit.code,
          // WHETHER THE LINE WAS CLASSIFIED, because that is the field that
          // decides which obligations this line will ever carry. An unclassified
          // line materialises nothing, closes every stage vacuously, and the
          // version it belongs to is immutable once published — so «was this
          // line typed when it was created» is a question a dispute turns on,
          // and until now no audit row answered it.
          //
          // A BOOLEAN, NOT THE KEY. The key itself is a workspace-wide
          // classification rather than commercial content, so recording it would
          // not be a leak — but error-catalog.csv's `field_codes_no_values` log
          // policy is the restraint this file already applies to
          // work_item.corrected's `fields`, and presence is the whole question.
          // The value is on the row; the transition is what the row cannot show.
          workTypeKeyPresent: workTypeKey !== null,
        },
      }, { organizationId: workspaceId });

      return {
        status: 201,
        body: {
          workItem: workItemView(inserted.rows[0]),
          workItemCount: Number(count.rows[0].n),
        },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
