import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability, type ActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  recordRequirementExceptionRequest, type RecordRequirementExceptionResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";
import { evaluateStage, lockOccurrenceLineage } from "../../../../../src/lib/readiness";

export const runtime = "nodejs";

/**
 * `requirement_exceptions.create` — POST /v1/occurrences/{occurrenceId}/exceptions
 * (technical/openapi/scope-v0.1.csv:44; command, idempotency required, member
 * plane, governed by `requirement_exceptions.decide`).
 *
 * THE ONLY ESCAPE v0.1 HAS. ADR-006 decision 4 keeps the closure-without-evidence
 * bypass out of v0.1 because its whole price is package ineligibility and a
 * version with no packages has no price to charge. So the attributed, visible
 * `waiver` / `accept_risk` is what stands in its place — «One attributed, visible
 * escape exists, which is what ADR-005's argument against an absolute lock
 * actually requires» (execution-and-evidence.md §"Closure without evidence"). An
 * absolute lock is routed around outside the system, and then the product is the
 * enemy.
 *
 * INV-063 IS ENFORCED HERE, BY THE COMMAND. «A requirement occurrence whose
 * intervention_type is hold can never carry a not_applicable exception» — and
 * version-0.1.md §M3 makes «the exception command itself rejects `not_applicable`
 * on a hold» an exit gate AND a security test, because a refusal that lives in a
 * UI affordance or in a role that happens not to have the button is not a
 * refusal. The intervention type is read from the OCCURRENCE and never from the
 * request, `requirement_exceptions_hold_not_applicable_check` is the second layer
 * over a column the composite foreign key pins from the same occurrence, and the
 * request schema deliberately still accepts the value so the refused case is
 * expressible and therefore testable.
 *
 * INV-069 IS DELIBERATELY NOT APPLIED HERE, and that is a judgement rather than
 * an omission. It names deciding an occurrence and clearing an unevidenced
 * closure; an exception is neither. It is not the obligation being met, it is a
 * named actor stating on the record that it will not be met and accepting the
 * consequence — ADR-005 decision 3 requires exactly that the actor be visible,
 * not that they be a different person from the crew. Applying the self-decision
 * rule here would mean a foreman could never record the risk he is the one
 * taking, which converts the escape into an escalation and teaches that the gate
 * is theatre.
 *
 * `revoke` IS NOT REACHABLE THROUGH THIS ROUTE. Migration 0045 §3 keeps it in the
 * column's CHECK so v0.2 is additive, and records that `scope-v0.1.csv` has no
 * revoke operation. A successor exception here supersedes a prior one and can
 * carry `waiver`, `accept_risk` or `not_applicable`; withdrawing an escape
 * outright is the operation v0.1 does not have.
 */
export const POST = commandRoute(recordRequirementExceptionRequest, async (a) => {
  const occurrenceId = a.params.occurrenceId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Вимогу не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!occurrenceId) throw notFound;

  const conflict = (detail: string) => new HttpProblem(409, problem("OCCURRENCE_CONFLICT",
    detail, { requestId: a.requestId, retryable: false, userAction: "refresh_exact_occurrence" }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const occ = await tx.query(
      `select workspace_id, project_id, work_assignment_id, work_stage_id, intervention_type
         from public.requirement_occurrences where id = $1`, [occurrenceId]);
    if (occ.rows.length === 0) throw notFound;
    const workspaceId: string = occ.rows[0].workspace_id;
    const projectId: string = occ.rows[0].project_id;
    const interventionType: string = occ.rows[0].intervention_type;
    const workStageId: string | null = occ.rows[0].work_stage_id;
    const assignmentId: string = occ.rows[0].work_assignment_id;

    return withIdempotency<RecordRequirementExceptionResponse, ActiveMembership>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "requirement_exceptions.create", key: a.idempotencyKey,
      requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        // `project.view` beside the decide capability, for the reason the sibling
        // decision route states in full: the exception head's SELECT policy asks
        // for it, and an actor without it reads no head where one exists, believes
        // the lineage has no root, and collides with
        // `requirement_exceptions_lineage_key` — a 23505 the caller cannot act on.
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
        await requireProjectCapability(tx, a.requestId, {
          workspaceId, projectId, memberId: m.memberId,
          capability: "requirement_exceptions.decide",
        });
        return m;
      },
    }, async (m) => {
      // INV-063, as the command's own refusal and before anything is written.
      // 422 and not 409: the request named an action this obligation can never
      // carry, which is a fact about the request rather than about a race, and
      // the remedy is a different action — `waiver` or `accept_risk` — not a
      // refresh.
      if (a.body.action === "not_applicable" && interventionType === "hold") {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Обовʼязкову вимогу не можна позначити як таку, що не застосовується. "
          + "Доступні дії: відмова від вимоги або прийняття ризику, з обґрунтуванням.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{
              path: "action",
              message: "not_applicable is never available on a hold occurrence (INV-063)",
            }],
          }));
      }

      // The same advisory lock the decision command and the closure take, for the
      // same reason: `satisfied(o)` is a disjunction over BOTH heads, so a lock
      // that covered only one lineage would let the other move underneath the
      // predicate. See src/lib/readiness.ts.
      await lockOccurrenceLineage(tx, workspaceId, [occurrenceId]);

      const headRow = await tx.query(
        `select h.version, h.current_exception_id, h.current_action, e.exception_no
           from public.requirement_exception_heads h
           left join public.requirement_exceptions e
             on e.workspace_id = h.workspace_id and e.id = h.current_exception_id
          where h.workspace_id = $1 and h.requirement_occurrence_id = $2
            and h.exception_scope = 'occurrence'`,
        [workspaceId, occurrenceId]);
      const head = headRow.rows[0] as
        | { version: string | number; current_exception_id: string | null;
            current_action: string | null; exception_no: string | number | null }
        | undefined;
      const headVersion = head ? Number(head.version) : null;

      if (a.body.expectedVersion !== headVersion) {
        throw conflict(headVersion === null
          ? "Щодо цієї вимоги ще немає винятків; надішліть expectedVersion: null."
          : `Винятки щодо цієї вимоги змінилися (поточна версія ${headVersion}).`);
      }

      const exceptionNo = head ? Number(head.exception_no) + 1 : 1;
      const exceptionId = randomUUID();

      // `occurrence_intervention_type` is written from the OCCURRENCE's own
      // column, which `requirement_exceptions_occurrence_fkey` then pins back to
      // that same occurrence: the copy cannot disagree with its source, and
      // INV-063 becomes a table CHECK over a value no caller supplied.
      const inserted = await tx.query(
        `insert into public.requirement_exceptions
           (id, workspace_id, project_id, requirement_occurrence_id,
            occurrence_intervention_type, action, exception_no,
            predecessor_exception_id, predecessor_exception_no,
            authority_member_id, reason, idempotency_key, request_hash)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         returning created_at`,
        [exceptionId, workspaceId, projectId, occurrenceId, interventionType,
         a.body.action, exceptionNo,
         head?.current_exception_id ?? null,
         head ? Number(head.exception_no) : null,
         m.memberId, a.body.reason, a.idempotencyKey, a.requestHash]);
      const createdAt = new Date(inserted.rows[0].created_at).toISOString();

      if (head) {
        const advanced = await tx.query(
          `update public.requirement_exception_heads
              set current_exception_id = $3, current_action = $4,
                  version = version + 1, updated_at = now()
            where workspace_id = $1 and requirement_occurrence_id = $2
              and exception_scope = 'occurrence' and version = $5
            returning version`,
          [workspaceId, occurrenceId, exceptionId, a.body.action, headVersion]);
        if (advanced.rows.length === 0) throw conflict("Винятки щодо цієї вимоги щойно змінилися.");
      } else {
        await tx.query(
          `insert into public.requirement_exception_heads
             (workspace_id, project_id, requirement_occurrence_id, exception_scope,
              current_exception_id, current_action)
           values ($1,$2,$3,'occurrence',$4,$5)`,
          [workspaceId, projectId, occurrenceId, exceptionId, a.body.action]);
      }

      const stage = workStageId
        ? await evaluateStage(tx, { workspaceId, projectId, workStageId })
        : null;
      const evaluated = stage?.occurrences.find((o) => o.occurrenceId === occurrenceId);

      await recordAudit(tx, ctx, {
        action: "requirement_exception.recorded", object_type: "requirement_occurrence",
        object_id: occurrenceId,
        details: {
          exceptionId, action: a.body.action, exceptionNo,
          predecessorExceptionId: head?.current_exception_id ?? null,
          authorityMemberId: m.memberId,
          workStageId, stageCanClose: stage?.canCloseStage ?? null,
        },
      }, { organizationId: workspaceId });

      // technical/events/event-catalog.csv:19 — `requirement_exception.recorded`,
      // v0.1-M3, aggregate `requirement_occurrence`, producer
      // `bff.requirement_exceptions.create`, consumer `projection_rebuilder`,
      // which is not deployed. Emitted anyway; see the note on the sibling
      // decision route.
      await enqueueOutbox(tx, ctx, {
        topic: "requirement_exception.recorded",
        aggregate_type: "requirement_occurrence", aggregate_id: occurrenceId,
        payload_version: 1,
        payload: {
          workspaceId, projectId, workAssignmentId: assignmentId, workStageId,
          requirementOccurrenceId: occurrenceId, exceptionId,
          action: a.body.action, exceptionNo,
        },
      }, { organizationId: workspaceId });

      return {
        status: 201,
        body: {
          exceptionId,
          requirementOccurrenceId: occurrenceId,
          action: a.body.action,
          exceptionNo,
          predecessorExceptionId: head?.current_exception_id ?? null,
          headVersion: (headVersion ?? 0) + 1,
          // The escape stays VISIBLE and ATTRIBUTED on the scope: who took it and
          // why travel on the receipt, not only in the audit row.
          authorityMemberId: m.memberId,
          reason: a.body.reason,
          createdAt,
          occurrenceSatisfied: evaluated?.satisfied ?? false,
          stageCanClose: stage?.canCloseStage ?? null,
        },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
