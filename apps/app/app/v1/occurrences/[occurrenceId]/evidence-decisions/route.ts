import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  recordEvidenceDecisionRequest, type RecordEvidenceDecisionResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";
import { evaluateStage, lockOccurrenceLineage } from "../../../../../src/lib/readiness";

export const runtime = "nodejs";

/**
 * `evidence_decisions.create` —
 * POST /v1/occurrences/{occurrenceId}/evidence-decisions
 * (technical/openapi/scope-v0.1.csv:45; command, idempotency required, member
 * plane, governed by `evidence_decisions.decide`).
 *
 * THE FACT A HOLD RELEASES ON. `satisfied(o)` for a hold, in its v0.1 form, is
 * «∃ current accepting evidence decision on o by o.approver_role ∧ no current
 * return on o» — both halves answered by the head this command advances.
 *
 * IT MOVES NO MONEY (INV-075 first half, INV-032). There is no path from an
 * outcome to a quantity or a valuation here, and after ADR-008 the money moves at
 * the stage closure and nowhere else. An acceptance that admitted money would
 * make the approver a payer.
 *
 * THE ROLE IS NOT ON THE WIRE. `approver_role` is read from the occurrence and
 * pinned into the decision by `requirement_evidence_decisions_occurrence_fkey`;
 * a caller who could name a role could decide in a role the obligation does not
 * ask for, and the head that `satisfied(o)` reads is keyed on the occurrence's
 * own role.
 *
 * A RETURN MUST SAY WHY, in free text and with no reason code.
 * `state-catalog.csv:120` files the return reason as `NOT_ENUMERATED` — «a
 * recorded gap that BLOCKS v0.1-M5» — and offers the v0.1-shaped alternative in
 * terms. Inventing a vocabulary here is what that row forbids. The zod refinement
 * and `requirement_evidence_decisions_return_reason_check` say the same thing at
 * two layers.
 */
export const POST = commandRoute(recordEvidenceDecisionRequest, async (a) => {
  const occurrenceId = a.params.occurrenceId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Вимогу не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!occurrenceId) throw notFound;

  const conflict = (detail: string) => new HttpProblem(409, problem("OCCURRENCE_CONFLICT",
    detail, { requestId: a.requestId, retryable: false, userAction: "refresh_exact_occurrence" }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const occ = await tx.query(
      `select workspace_id, project_id, work_assignment_id, work_stage_id,
              approver_role, intervention_type, approver_is_external
         from public.requirement_occurrences where id = $1`, [occurrenceId]);
    if (occ.rows.length === 0) throw notFound;
    const workspaceId: string = occ.rows[0].workspace_id;
    const projectId: string = occ.rows[0].project_id;
    const approverRole: string = occ.rows[0].approver_role;
    const workStageId: string | null = occ.rows[0].work_stage_id;
    const assignmentId: string = occ.rows[0].work_assignment_id;

    return withIdempotency<RecordEvidenceDecisionResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "evidence_decisions.create", key: a.idempotencyKey,
      requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      // `project.view` BESIDE the decide capability, and it is not belt and
      // braces. The two head tables' SELECT policies (migration 0045 §10) ask for
      // `project.view` or `project.admin`, so a decider without it would read NO
      // head where one exists, be told the lineage has no root, and hit the
      // lineage key with a 23505 that reaches the caller as a 500. The same is
      // true of `ro_select` on the occurrence itself — which is why an actor
      // without it can still get a 404 from the lookup above, before this line
      // runs. That ordering is a property of reading through RLS and it is the
      // reason `project.view` belongs in whatever responsibility preset ends up
      // carrying `evidence_decisions.decide`.
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
      await requireProjectCapability(tx, a.requestId, {
        workspaceId, projectId, memberId: m.memberId,
        capability: "evidence_decisions.decide",
      });

      // Serialize this occurrence's two lineages BEFORE reading either head. An
      // advisory lock and not `select ... for update` on the head: PostgreSQL
      // applies a table's UPDATE policies to `FOR UPDATE`, and the closure
      // command — which must read the same heads — holds `stage_closures.close`
      // rather than `evidence_decisions.decide`, so a row lock would hand it an
      // empty result instead of a lock. src/lib/readiness.ts states the whole
      // argument beside the function.
      await lockOccurrenceLineage(tx, workspaceId, [occurrenceId]);

      // ── INV-069: the decider may never be the capturer ────────────────────
      //
      // ENFORCED HERE AND NOWHERE ELSE. `invariant-catalog.csv:70` assigns it to
      // the command, and migration 0045's header explains why a trigger would be
      // wrong: a non-definer guard reads under the mutating role, finds nothing
      // where RLS hides rows, and FAILS OPEN.
      //
      // THREE FACTS, AND THE THIRD IS A JUDGEMENT THE PACKAGE DOES NOT SETTLE.
      // The invariant reads «may not decide a requirement occurrence or an
      // internal review target set containing their own capture or their own
      // recorded progress». The first two conjuncts below are the CAPTURE half
      // and are not in doubt: an upload intent naming this occurrence, and an
      // evidence object finalized from one. The third — progress recorded on the
      // occurrence's assignment — is read here as covered, because the sentence
      // names recorded progress and v0.1 has no internal-review target set for it
      // to attach to instead (internal review is v0.2, ADR-006 decision 5).
      //
      // ITS COST IS REAL AND IS NOT HIDDEN: a single member who recorded the
      // quantity cannot then decide any obligation on that assignment, and
      // `responsibility-presets.csv` says «one member may combine
      // responsibilities in v0.1». A P0 invariant that names an act fails CLOSED
      // on that act; the alternative — a self-approved hidden-works record — is
      // the thing an adversarial технагляд tears up (ADR-006 decision 9). The
      // tension belongs to a permissions decision, not to this route, and it is
      // recorded rather than resolved by narrowing the check.
      const self = await tx.query(
        `select
           exists (select 1 from public.upload_intents ui
                    where ui.workspace_id = $1 and ui.requirement_occurrence_id = $2
                      and ui.created_by_member_id = $3) as captured,
           exists (select 1 from public.evidence_objects eo
                     join public.upload_intents ui2
                       on ui2.workspace_id = eo.workspace_id and ui2.id = eo.upload_intent_id
                    where eo.workspace_id = $1 and ui2.requirement_occurrence_id = $2
                      and eo.recorder_member_id = $3) as recorded_evidence,
           exists (select 1 from public.progress_entries p
                    where p.workspace_id = $1 and p.work_assignment_id = $4
                      and p.recorded_by_member_id = $3) as recorded_progress`,
        [workspaceId, occurrenceId, m.memberId, assignmentId]);
      const s = self.rows[0];
      if (s.captured || s.recorded_evidence || s.recorded_progress) {
        // READINESS_OVERRIDE_DENIED is the catalog's only requirement-occurrence
        // scoped 403 and its user_action — `resolve_blocker_or_request_manager` —
        // is literally the remedy: another member must decide. The catalog owes a
        // self-decision code of its own; inventing one here would put a string on
        // the wire that no catalog row governs.
        throw new HttpProblem(403, problem("READINESS_OVERRIDE_DENIED",
          "Рішення щодо цієї вимоги має ухвалити інший учасник: ви фіксували докази або обсяг за цим завданням.",
          { requestId: a.requestId, retryable: false,
            userAction: "resolve_blocker_or_request_manager" }));
      }

      // The head, and the exact fact it points at. `decision_no` comes from the
      // pointed-at row rather than from a count, because a count over a lineage
      // is a different question from «what is the current ordinal» the moment a
      // lineage is not contiguous — and migration 0045's chain CHECK exists
      // precisely because that is representable in most schemas.
      const headRow = await tx.query(
        `select h.version, h.current_decision_id, h.current_outcome,
                d.decision_no
           from public.requirement_evidence_decision_heads h
           left join public.requirement_evidence_decisions d
             on d.workspace_id = h.workspace_id and d.id = h.current_decision_id
          where h.workspace_id = $1 and h.requirement_occurrence_id = $2
            and h.approver_role = $3`,
        [workspaceId, occurrenceId, approverRole]);
      const head = headRow.rows[0] as
        | { version: string | number; current_decision_id: string | null;
            current_outcome: string | null; decision_no: string | number | null }
        | undefined;
      const headVersion = head ? Number(head.version) : null;

      if (a.body.expectedVersion !== headVersion) {
        throw conflict(headVersion === null
          ? "Щодо цієї вимоги ще немає рішень; надішліть expectedVersion: null."
          : `Рішення щодо цієї вимоги змінилися (поточна версія ${headVersion}).`);
      }

      const decisionNo = head ? Number(head.decision_no) + 1 : 1;
      const decisionId = randomUUID();
      const reason = a.body.reason ?? null;

      // `decided_at` is read BACK rather than composed in TypeScript: it is the
      // server time the decision was taken, `blocked_reason.since` reads it on a
      // return, and a client-side `new Date()` would put a second clock beside
      // the one the fact carries.
      const inserted = await tx.query(
        `insert into public.requirement_evidence_decisions
           (id, workspace_id, project_id, requirement_occurrence_id, approver_role,
            outcome, decision_no, superseded_decision_id, superseded_decision_no,
            decided_by_member_id, reason, issues, idempotency_key, request_hash)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)
         returning decided_at`,
        [decisionId, workspaceId, projectId, occurrenceId, approverRole,
         a.body.outcome, decisionNo,
         head?.current_decision_id ?? null,
         head ? Number(head.decision_no) : null,
         m.memberId, reason, JSON.stringify(a.body.issues),
         a.idempotencyKey, a.requestHash]);
      const decidedAt = new Date(inserted.rows[0].decided_at).toISOString();

      // The head is INSERTed for a root and UPDATEd for a successor, and the
      // update carries `and version = $expected` so a concurrent submit that read
      // the same version writes nothing rather than winning. `app.guard_requirement_head()`
      // is the second layer: it raises unless the version advances by exactly one.
      if (head) {
        const advanced = await tx.query(
          `update public.requirement_evidence_decision_heads
              set current_decision_id = $4, current_outcome = $5,
                  version = version + 1, updated_at = now()
            where workspace_id = $1 and requirement_occurrence_id = $2
              and approver_role = $3 and version = $6
            returning version`,
          [workspaceId, occurrenceId, approverRole, decisionId, a.body.outcome, headVersion]);
        if (advanced.rows.length === 0) throw conflict("Рішення щодо цієї вимоги щойно змінилися.");
      } else {
        await tx.query(
          `insert into public.requirement_evidence_decision_heads
             (workspace_id, project_id, requirement_occurrence_id, approver_role,
              current_decision_id, current_outcome)
           values ($1,$2,$3,$4,$5,$6)`,
          [workspaceId, projectId, occurrenceId, approverRole, decisionId, a.body.outcome]);
      }

      // Recomputed from the SAME function the closure command refuses on, so the
      // «is anything still owed» this response answers cannot disagree with the
      // answer the closure gives. It is a report and never a promise: the closure
      // re-evaluates under the stage row lock (INV-061).
      const stage = workStageId
        ? await evaluateStage(tx, { workspaceId, projectId, workStageId })
        : null;
      const evaluated = stage?.occurrences.find((o) => o.occurrenceId === occurrenceId);

      await recordAudit(tx, ctx, {
        action: "requirement_evidence_decision.recorded", object_type: "requirement_occurrence",
        object_id: occurrenceId,
        details: {
          decisionId, approverRole, outcome: a.body.outcome, decisionNo,
          supersededDecisionId: head?.current_decision_id ?? null,
          workStageId, stageCanClose: stage?.canCloseStage ?? null,
        },
      }, { organizationId: workspaceId });

      // technical/events/event-catalog.csv:22 — `requirement_evidence_decision.recorded`,
      // v0.1-M3, aggregate `requirement_occurrence`, producers
      // `bff.evidence_decisions.create` and `bff.external.occurrence_decision_submit`
      // (the second is M5). Consumers: `projection_rebuilder`, `notification_creator`
      // — NEITHER IS DEPLOYED. supabase/functions/outbox-drain/index.ts records that
      // drained rows have no consumer, so this event is durable and unread today.
      // It is emitted anyway: an event a milestone owes is not withheld because its
      // consumer is late, and the row is what the rebuilder will replay from.
      await enqueueOutbox(tx, ctx, {
        topic: "requirement_evidence_decision.recorded",
        aggregate_type: "requirement_occurrence", aggregate_id: occurrenceId,
        payload_version: 1,
        payload: {
          workspaceId, projectId, workAssignmentId: assignmentId, workStageId,
          requirementOccurrenceId: occurrenceId, decisionId,
          approverRole, outcome: a.body.outcome, decisionNo,
        },
      }, { organizationId: workspaceId });

      return {
        status: 201,
        body: {
          decisionId,
          requirementOccurrenceId: occurrenceId,
          approverRole,
          outcome: a.body.outcome,
          decisionNo,
          supersededDecisionId: head?.current_decision_id ?? null,
          headVersion: (headVersion ?? 0) + 1,
          decidedAt,
          occurrenceSatisfied: evaluated?.satisfied ?? false,
          stageCanClose: stage?.canCloseStage ?? null,
        },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
