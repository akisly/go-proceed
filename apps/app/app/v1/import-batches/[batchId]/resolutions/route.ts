import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { createResolutionRequest, type CreateResolutionResponse } from "@goproceed/contracts";
import { RESOLVABLE_CODES } from "@goproceed/domain";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

export const POST = commandRoute(createResolutionRequest, async (a) => {
  const batchId = a.params.batchId;
  if (!batchId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    // Plain select first: SELECT ... FOR UPDATE would engage the UPDATE RLS
    // policy and turn a capability denial into an existence-safe 404 — the
    // 403 belongs to actors who can SEE the batch but lack imports.manage.
    const b0 = await tx.query(
      `select workspace_id, project_id from public.import_batches where id = $1`, [batchId]);
    if (b0.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Пакет імпорту не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = b0.rows[0].workspace_id;
    const projectId: string = b0.rows[0].project_id;
    return withIdempotency<CreateResolutionResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "import_resolutions.create", key: a.idempotencyKey, requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "imports.manage" });
      },
    }, async () => {
      const b = await tx.query(
        `select status, current_attempt from public.import_batches
          where workspace_id = $1 and id = $2 for update`, [workspaceId, batchId]);
      if (!["validated", "preview_ready"].includes(b.rows[0].status)) {
        throw new HttpProblem(409, problem("IMPORT_JOB_CONFLICT",
          "Розбіжності можна вирішувати лише після перевірки пакета.",
          { requestId: a.requestId, retryable: true, userAction: "refresh_import_job" }));
      }
      // The row must belong to THIS batch's latest attempt and carry the mismatch.
      const row = await tx.query(
        `select id, mapped, error_codes from public.import_row_results
          where workspace_id = $1 and import_batch_id = $2 and id = $3 and attempt = $4`,
        [workspaceId, batchId, a.body.rowResultId, b.rows[0].current_attempt]);
      if (row.rows.length === 0) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Рядок не знайдено в поточній перевірці цього пакета.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "rowResultId", message: "not in latest attempt" }],
          }));
      }
      const rowCodes: string[] = row.rows[0].error_codes ?? [];
      if (!RESOLVABLE_CODES.some((c) => rowCodes.includes(c))) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Цей рядок не потребує вирішення джерельної суми.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "rowResultId", message: `expected one of ${RESOLVABLE_CODES.join(", ")}` }],
          }));
      }
      const mapped = row.rows[0].mapped as { sourceMinor: string | null; derivedMinor: string | null };
      const resolutionId = randomUUID();
      try {
        await tx.query(
          `insert into public.source_amount_resolutions
             (id, workspace_id, import_batch_id, row_result_id, chosen_basis, reason,
              source_amount_minor_units, derived_amount_minor_units, resolved_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [resolutionId, workspaceId, batchId, a.body.rowResultId, a.body.chosenBasis,
           // Store the amounts EXACTLY as validated: re-validation compares them
           // and must be able to tell "no derived amount" from "derived zero".
           a.body.reason, mapped.sourceMinor, mapped.derivedMinor, a.userId]);
      } catch (e) {
        if (e instanceof Error && /source_amount_resolutions_workspace_id_import_batch_id_row/.test(e.message)) {
          throw new HttpProblem(409, problem("VERSION_CONFLICT",
            "Розбіжність цього рядка вже вирішено.",
            { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
        }
        throw e;
      }
      // log_policy: basis only — never the free-text reason.
      await recordAudit(tx, ctx, {
        action: "source_amount.resolved", object_type: "source_amount_resolution",
        object_id: resolutionId, details: { chosenBasis: a.body.chosenBasis },
      }, { organizationId: workspaceId });
      return { status: 201, body: { resolutionId } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
