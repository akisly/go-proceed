import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { recordProgressRequest, type RecordProgressResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";
import { lockWorkItem, toScaled6, fromScaled6 } from "../../../../../src/lib/valuation-writer";

export const runtime = "nodejs";

/**
 * `progress.record` — POST /v1/assignments/{assignmentId}/progress.
 *
 * ADR-008 (Approved, 2026-08-07): THE VALUATION CARVE HAS LEFT THIS ROUTE.
 *
 * What stays, unchanged, and each because the ADR says so in terms: the
 * append-only progress entry; the allocation head, which «is the serialization
 * point for adjustments and for allocation, and it must exist before either can
 * be ordered»; the audit row; the outbox event. What leaves is the
 * `appendValuationAllocation` call and the allocation figures on the 201.
 * Performed quantity is now RECORDED AND UNVALUED until a stage closure admits it
 * (`apps/app/app/v1/stages/[stageId]/closures/route.ts`).
 *
 * WHY NOT SIMPLY ADD A READINESS CHECK HERE. INV-065 forbids it, and the
 * prohibition is correct and is not relaxed: recording a measured quantity must
 * never depend on whether somebody has photographed anything. A foreman who
 * measured 40 metres measured 40 metres. The question ADR-008 answers is not
 * whether recording consults readiness — it is where the carve happens at all.
 *
 * THE WORK-ITEM LOCK STAYS, AND ITS REASON CHANGED. It no longer serializes a
 * carve, because there is none here. It serializes the read of `unit_precision`
 * and the head open against the same line's other commands, and it keeps this
 * route's lock ORDER identical to `progress.adjust`'s and to the closure's — pool
 * first. A route that stopped taking it would be the one route reaching for a
 * different order, which is how a serialization guarantee quietly stops holding.
 */

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
    // `contract_id` is no longer selected: it was here only to be handed to
    // `appendValuationAllocation`, and after ADR-008 this route writes no
    // allocation. Left in the SELECT it would be an unused column that reads as
    // if the money path were still one edit away from returning.
    const asg = await tx.query(
      `select workspace_id, project_id, work_item_id, status
         from public.work_assignments where id = $1`, [assignmentId]);
    if (asg.rows.length === 0) throw notFound;
    const { workspace_id: workspaceId, project_id: projectId,
            work_item_id: workItemId } = asg.rows[0];

    return withIdempotency<RecordProgressResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "progress.record", key: a.idempotencyKey, requestHash: a.requestHash,
      // STILL `ledger_400d` AFTER ADR-008, and the reason is no longer «this
      // route appends money lineage» — it does not. It is that the entry this
      // record creates is what a LATER admission carves against, and a replay
      // that re-executed instead of returning the original entry id would create
      // a second unadmitted quantity for the closure to admit. The retention has
      // to outlive the gap between recording and admission, and that gap is now
      // unbounded.
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

      // Serialize on the line, in the same order every other money-touching
      // command takes: pool first. Before ADR-008 the reason was that a stale
      // read of the remaining pool is how two concurrent measurements would both
      // spend the same minor unit; the carve has moved, and the lock stays
      // because the ORDER is the guarantee, not this route's need of it.
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
      //
      // IT OPENS WITH NO ALLOCATION BESIDE IT, AND THAT IS NOW AN ORDINARY STATE.
      // ADR-008 §Consequences: «progress_allocation_heads gains a state it did not
      // have. A head can now exist with reserved_quantity = 0 and no allocation
      // row, for an arbitrary period. The columns already permit it; nothing
      // writes that state today.» After this change every recorded quantity
      // writes it, and INV-089 says no projection or command may read it as an
      // error.
      await tx.query("select app.open_allocation_head($1,$2)", [workspaceId, progressEntryId]);

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
          // No allocation figures. `admitted: false` rather than a null
          // allocation object, because a null would be read as «unvalued» — the
          // state INV-038 reserves for a line whose price is unknown — and this
          // quantity is priced perfectly well and simply has not passed the gate.
          admitted: false as const,
        },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
