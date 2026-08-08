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

/**
 * `progress.adjust` — POST /v1/progress-entries/{entryId}/adjustments.
 *
 * ADR-008 AND THE CARVE THAT STAYED BEHIND.
 *
 * When ADR-008 moved the valuation carve out of `progress.record` and into
 * admission, this route kept calling `appendValuationAllocation`
 * unconditionally. That left the money gate walkable in two calls, with no
 * stage, no closure and no decision anywhere: record `0.000001` against a
 * ten-unit line, then adjust `+9.999999`. `work_item_performed` counts only
 * admitted quantity, so the adjustment saw the whole line unperformed and drew
 * essentially the whole pool — `admitted_by_closure_id` NULL, `stage_closures`
 * empty. INV-089 is P0 and reads «performed quantity is recorded UNVALUED until
 * admission»; ADR-008's «only admitted quantity competes for the pool, and
 * admission is a deliberate authorised act rather than a side effect of
 * measurement» was false as implemented.
 *
 * THE GATE IS THE ROOT'S OWN ADMISSION, and nothing else. A correction may move
 * money only if the lineage it corrects already HOLDS money — i.e. only if some
 * `valuation_allocations` row names this root. That predicate is exact rather
 * than a proxy: it is read under the same two locks the carve is computed under,
 * it needs no join to `stage_closures`, and it stays correct for the pre-ADR-008
 * rows whose money was carved at recording time and which carry no closure id.
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *
 *   * It does not consult readiness. INV-065 forbids that here as firmly as in
 *     `progress.record`: a foreman who measured 6 metres instead of 10 measured
 *     6, whether or not anybody has photographed anything, and the correction is
 *     recorded either way. Only the MONEY waits.
 *   * It does not queue the correction for a later admission. It does not have
 *     to: `admitClosedStageQuantity` admits the LINEAGE at its EFFECTIVE
 *     quantity, so a pre-admission correction is already inside the number the
 *     closure carves. See `src/lib/admission.ts` — the two changes are one fix
 *     and neither is correct alone.
 *   * It does not answer ADR-008's open question. «Whether an
 *     admitted-then-corrected quantity releases its allocation, and by what
 *     command» is still undecided; the admitted arm below keeps exactly the
 *     behaviour that shipped.
 *
 * NOTHING HERE WAS EXECUTED: no test run, no route invoked, no migration applied.
 */
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

      // ── the gate (ADR-008, INV-089) ──────────────────────────────────────
      //
      // Read under `lockWorkItem` + `lockAllocationHead`, which are already
      // held: an admission racing this correction must wait for the head, so
      // this answer cannot go stale between the read and the carve. Read on
      // `root_progress_entry_id` rather than `progress_entry_id` because the
      // question is whether the LINEAGE holds money — a root admitted by a
      // closure and then corrected twice has three allocation rows and any one
      // of them answers yes.
      const admittedRoot = await tx.query(
        `select 1 from public.valuation_allocations
          where workspace_id = $1 and root_progress_entry_id = $2 limit 1`,
        [workspaceId, entryId]);
      const rootAdmitted = admittedRoot.rows.length > 0;

      // THE DIRECTION MATTERS, and gating on `rootAdmitted` alone was a third
      // route to the pool with no closure behind it. The v0.1 final review
      // reproduced it: record 0.000001, satisfy the hold honestly, close the
      // stage — admission carves for a millionth of a unit — then adjust
      // +9.999999. The lineage held money, so the old gate opened, and
      // `appendValuationAllocation` ran with no `admission` argument:
      // `admitted_by_closure_id` NULL, `work_item_performed` = 0.000001, and
      // the carve handed over essentially the whole pool. One honest closure
      // covering a millionth of a unit bought the entire line, and the
      // capability needed was `progress.adjust` — a foreman's.
      //
      // Every layer below passed it, which is why the direction has to be the
      // gate here: 0046's recording arm is satisfied by a NULL closure id under
      // `progress.adjust`; 0025's per-row check compares funded against the
      // row's own quantity; and 0048's lineage trigger bounds funded by the
      // lineage's PERFORMED quantity, which says nothing about whether that
      // quantity was ever admitted.
      //
      // A REDUCTION against admitted money still carves, because that is
      // ADR-008's genuinely open question — what a correction to already
      // admitted money releases — and this is not the place to answer it. An
      // INCREASE is not a correction to admitted money; it is new unadmitted
      // quantity, and the next closure admits it through `pendingEntries` like
      // any other. So it waits for a gate, as ADR-008 decision requires.
      const allocation = (rootAdmitted && delta < 0n)
        ? await appendValuationAllocation(tx, {
            workspaceId, projectId, contractId, workItemId,
            progressEntryId: adjustmentEntryId, rootProgressEntryId: entryId,
            deltaQuantity: delta,
          })
        : null;

      await recordAudit(tx, ctx, {
        action: "progress.adjusted", object_type: "progress_entry",
        object_id: adjustmentEntryId,
        details: { rootProgressEntryId: entryId, quantity: a.body.quantity,
                   reasonCode: a.body.reasonCode,
                   // Whether this correction moved money, and it is in the audit
                   // rather than only in the response because after the response
                   // is gone the audit row is the only place the distinction
                   // survives. An unadmitted correction writes NO allocation row,
                   // so there is otherwise nothing to find.
                   rootAdmitted },
      }, { organizationId: workspaceId });
      await enqueueOutbox(tx, ctx, {
        topic: "progress.adjusted", aggregate_type: "progress_entry",
        aggregate_id: adjustmentEntryId, payload_version: 1,
        payload: { workspaceId, projectId, assignmentId, workItemId,
                   rootProgressEntryId: entryId, adjustmentEntryId },
      }, { organizationId: workspaceId });

      const base = {
        adjustmentEntryId,
        rootProgressEntryId: entryId,
        effectiveRootQuantity: fromScaled6(effectiveAfter),
      };
      // No `allocation: null` on the unadmitted arm. A null would be read as
      // «unvalued» — the state INV-038 reserves for a line whose price is
      // unknown — and this quantity is priced and simply unadmitted. The
      // annotation is on the variable rather than left to inference, so a future
      // arm that forgot `admitted` fails here instead of on the wire.
      const body: AdjustProgressResponse = allocation === null
        ? { ...base, admitted: false }
        : {
            ...base,
            admitted: true,
            allocation: {
              valued: allocation.valued,
              netMinorUnits: allocation.net?.toString() ?? null,
              taxMinorUnits: allocation.tax?.toString() ?? null,
              grossMinorUnits: allocation.gross?.toString() ?? null,
              unvaluedReason: allocation.reason,
            },
          };
      return { status: 201, body };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
