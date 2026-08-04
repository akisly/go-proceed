import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { adjustProgressRequest, type AdjustProgressResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";
import {
  appendValuationAllocation, lockWorkItem, lockAllocationHead, toScaled6, fromScaled6,
} from "../../../../../src/lib/valuation-writer";

export const runtime = "nodejs";

export const POST = commandRoute(adjustProgressRequest, async (a) => {
  const entryId = a.params.entryId;
  if (!entryId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Вимірювання не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND",
    "Кореневе вимірювання не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    // entry_kind = 'root' is part of the LOOKUP, not a check afterwards. An
    // adjustment id simply resolves to nothing here, so INV-023 cannot be
    // reached by this route at all — the composite foreign key from migration
    // 0019 is the second layer behind it.
    const root = await tx.query(
      `select p.id, p.workspace_id, p.project_id, p.work_assignment_id, p.work_item_id,
              a.contract_id
         from public.progress_entries p
         join public.work_assignments a
           on a.workspace_id = p.workspace_id and a.id = p.work_assignment_id
        where p.id = $1 and p.entry_kind = 'root'`,
      [entryId]);
    if (root.rows.length === 0) throw notFound;
    const { workspace_id: workspaceId, project_id: projectId,
            work_assignment_id: assignmentId, work_item_id: workItemId,
            contract_id: contractId } = root.rows[0];

    return withIdempotency<AdjustProgressResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "progress.adjust", key: a.idempotencyKey, requestHash: a.requestHash,
      idempotencyClass: "ledger_400d",
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "progress.adjust" });

      const delta = toScaled6(a.body.quantity);
      if (delta === 0n) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Коригування не може бути нульовим.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "quantity", message: "must not be zero" }],
          }));
      }

      // Stable order: pool first, then this root's balance head.
      await lockWorkItem(tx, workspaceId, workItemId);
      await lockAllocationHead(tx, workspaceId, entryId);

      const before = await tx.query(
        `select coalesce(sum(quantity), 0)::text as effective
           from public.progress_entries
          where workspace_id = $1 and (id = $2 or root_progress_entry_id = $2)`,
        [workspaceId, entryId]);
      const effectiveBefore = toScaled6(before.rows[0].effective);
      const effectiveAfter = effectiveBefore + delta;

      if (effectiveAfter < 0n) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          `Коригування зробило б ефективну кількість відʼємною (${fromScaled6(effectiveBefore)} наявно).`, {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "quantity", message: "effective quantity would go negative" }],
          }));
      }

      const head = await tx.query(
        `select reserved_quantity::text as reserved from public.progress_allocation_heads
          where workspace_id = $1 and root_progress_entry_id = $2`,
        [workspaceId, entryId]);
      const reserved = head.rows.length > 0 ? toScaled6(head.rows[0].reserved) : 0n;
      if (effectiveAfter < reserved) {
        // Reducing scope that is already reserved is not a standalone command:
        // it needs the atomic corrected-successor transaction that arrives with
        // packages in v0.1-M4.
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          `Коригування перетнуло б зарезервовану кількість (${fromScaled6(reserved)}). ` +
          "Потрібна атомарна команда з виправленим наступником пакета.", {
            requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry",
          }));
      }

      const adjustmentEntryId = randomUUID();
      await tx.query(
        `insert into public.progress_entries
           (id, workspace_id, project_id, work_assignment_id, work_item_id,
            entry_kind, quantity, root_progress_entry_id, root_is_root, reason_code,
            recorded_by_member_id, recorded_at)
         values ($1,$2,$3,$4,$5,'adjustment',$6,$7,true,$8,$9,coalesce($10::timestamptz, now()))`,
        [adjustmentEntryId, workspaceId, projectId, assignmentId, workItemId,
         a.body.quantity, entryId, a.body.reasonCode, m.memberId, a.body.recordedAt ?? null]);

      // Re-derives effective quantity from the entries and advances the head, so
      // this route's arithmetic and the database's cannot diverge silently.
      await tx.query("select app.assert_reservation_invariant($1,$2)", [workspaceId, entryId]);

      const allocation = await appendValuationAllocation(tx, {
        workspaceId, projectId, contractId, workItemId,
        progressEntryId: adjustmentEntryId, rootProgressEntryId: entryId,
        deltaQuantity: delta,
      });

      await recordAudit(tx, ctx, {
        action: "progress.adjusted", object_type: "progress_entry",
        object_id: adjustmentEntryId,
        details: { rootProgressEntryId: entryId, quantity: a.body.quantity,
                   reasonCode: a.body.reasonCode },
      }, { organizationId: workspaceId });
      await enqueueOutbox(tx, ctx, {
        topic: "progress.adjusted", aggregate_type: "progress_entry",
        aggregate_id: adjustmentEntryId, payload_version: 1,
        payload: { workspaceId, projectId, assignmentId, workItemId,
                   rootProgressEntryId: entryId, adjustmentEntryId },
      }, { organizationId: workspaceId });

      return {
        status: 201,
        body: {
          adjustmentEntryId,
          rootProgressEntryId: entryId,
          effectiveRootQuantity: fromScaled6(effectiveAfter),
          allocation: {
            valued: allocation.valued,
            netMinorUnits: allocation.net?.toString() ?? null,
            taxMinorUnits: allocation.tax?.toString() ?? null,
            grossMinorUnits: allocation.gross?.toString() ?? null,
            unvaluedReason: allocation.reason,
          },
        },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
