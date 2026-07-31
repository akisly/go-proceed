import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { recordProgressRequest, type RecordProgressResponse } from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@aktflow/database";
import {
  appendValuationAllocation, lockWorkItem, toScaled6, fromScaled6,
} from "../../../../../src/lib/valuation-writer";

export const runtime = "nodejs";

export const POST = commandRoute(recordProgressRequest, async (a) => {
  const assignmentId = a.params.assignmentId;
  if (!assignmentId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Завдання не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Завдання не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const asg = await tx.query(
      `select workspace_id, project_id, contract_id, work_item_id, status
         from public.work_assignments where id = $1`, [assignmentId]);
    if (asg.rows.length === 0) throw notFound;
    const { workspace_id: workspaceId, project_id: projectId,
            contract_id: contractId, work_item_id: workItemId } = asg.rows[0];

    return withIdempotency<RecordProgressResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "progress.record", key: a.idempotencyKey, requestHash: a.requestHash,
      // Appending money lineage is a ledger event, so the record stays
      // replayable for the audit retention window rather than 30 days.
      idempotencyClass: "ledger_400d",
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "progress.record" });

      if (asg.rows[0].status !== "active") {
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Завдання не активне, вимірювання неможливе.",
          { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
      }

      // Serialize BEFORE reading any total: the allocation is carved from the
      // remaining pool, and a stale read of that remainder is how two concurrent
      // measurements would both spend the same minor unit.
      await lockWorkItem(tx, workspaceId, workItemId);

      const unit = await tx.query(
        `select unit_precision from public.work_items where workspace_id = $1 and id = $2`,
        [workspaceId, workItemId]);
      const precision: number = unit.rows[0].unit_precision;
      const fraction = a.body.quantity.split(".")[1] ?? "";
      if (fraction.replace(/0+$/, "").length > precision) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          `Точність кількості перевищує ${precision} знаки після коми для цієї одиниці.`, {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "quantity", message: `max ${precision} decimal places` }],
          }));
      }
      const quantity = toScaled6(a.body.quantity);
      if (quantity <= 0n) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Кількість має бути більшою за нуль.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "quantity", message: "must be greater than zero" }],
          }));
      }

      const progressEntryId = randomUUID();
      await tx.query(
        `insert into public.progress_entries
           (id, workspace_id, project_id, work_assignment_id, work_item_id,
            entry_kind, quantity, recorded_by_member_id, recorded_at)
         values ($1,$2,$3,$4,$5,'root',$6,$7,coalesce($8::timestamptz, now()))`,
        [progressEntryId, workspaceId, projectId, assignmentId, workItemId,
         a.body.quantity, m.memberId, a.body.recordedAt ?? null]);

      // The head opens from the entry itself; the definer reads the quantity
      // rather than trusting an argument (migration 0017).
      await tx.query("select app.open_allocation_head($1,$2)", [workspaceId, progressEntryId]);

      const allocation = await appendValuationAllocation(tx, {
        workspaceId, projectId, contractId, workItemId,
        progressEntryId, rootProgressEntryId: progressEntryId, deltaQuantity: quantity,
      });

      await recordAudit(tx, ctx, {
        action: "progress.recorded", object_type: "progress_entry",
        object_id: progressEntryId,
        details: { assignmentId, workItemId, quantity: a.body.quantity },
      }, { organizationId: workspaceId });
      await enqueueOutbox(tx, ctx, {
        topic: "progress.recorded", aggregate_type: "progress_entry",
        aggregate_id: progressEntryId, payload_version: 1,
        payload: { workspaceId, projectId, assignmentId, workItemId, progressEntryId },
      }, { organizationId: workspaceId });

      return {
        status: 201,
        body: {
          progressEntryId,
          effectiveQuantity: fromScaled6(quantity),
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
