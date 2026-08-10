import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { createAssignmentRequest, type CreateAssignmentResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";
import {
  BOUND_RULE_VERSIONS_SQL, boundRuleVersion, planMaterialisation,
} from "../../../../../src/lib/requirement-materialisation";
import { materialiseOccurrences } from "../../../../../src/lib/occurrence-writer";

export const runtime = "nodejs";

/**
 * `assignments.create` — POST /v1/contracts/{contractId}/assignments
 * (technical/openapi/scope-v0.1.csv:34; command, idempotency required, member
 * plane, governed by `assignments.manage`).
 *
 * v0.1-M2 gives this command a second job, and it is the one the milestone is
 * named for: CREATING AN ASSIGNMENT MATERIALISES ITS OBLIGATION SET. «An
 * occurrence is materialised from a binding when an assignment is created, and
 * pins the exact rule version» (ADR-005 decision 2; ADR-006 step 2) — before
 * the first quantity entry, with no evidence yet linked, so the field client can
 * show the foreman what must be photographed BEFORE the work starts. A
 * placeholder that appears after the stage is covered is not advance notice.
 *
 * IT HAPPENS IN THIS TRANSACTION OR NOT AT ALL. An assignment that exists with
 * no obligation set is the silent non-coverage INV-072 is written against, so
 * materialisation is not a follow-up call, not a job, and not a projection: the
 * stages, the occurrences, the audit rows and the outbox event share the
 * command's transaction, and a failure anywhere leaves no assignment behind.
 *
 * WHAT IT MATERIALISES DEPENDS ON THE LINE, AND THE COMMAND SAYS WHICH. The
 * rule predicate is (work type, stage); migration 0050 gives the work type a
 * carrier on `public.work_items` and this route reads it off the line — never
 * off the request, because a work type in the body would let the person
 * creating an assignment choose which obligations apply to the work.
 *
 * IT IS STILL EMPTY FOR AN UNTYPED LINE, and that stays a reported fact rather
 * than a silence: every imported line carries NULL (ADR-006 decision 6 freezes
 * the importer and INV-015 freezes the published line, so an imported baseline
 * can never acquire one), and a hand-typed line may legitimately carry none.
 * The 201 carries the verdict — `coverage`, one of `covered`, `no_bindings`,
 * `no_matching_rule`, `work_type_unresolved` — the audit carries it and the
 * outbox event carries it. See `workTypeKeyOf` in
 * src/lib/requirement-materialisation.ts for why the two ways of routing around
 * the missing carrier were worse than reporting the emptiness.
 */
export const POST = commandRoute(createAssignmentRequest, async (a) => {
  const contractId = a.params.contractId;
  if (!contractId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Договір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const invalid = (path: string, message: string, detail: string) =>
    new HttpProblem(422, problem("VALIDATION_FAILED", message, {
      requestId: a.requestId, retryable: false, userAction: "correct_fields",
      fieldErrors: [{ path, message: detail }],
    }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const c = await tx.query(
      `select workspace_id, project_id from public.contracts where id = $1`, [contractId]);
    if (c.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Договір не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = c.rows[0].workspace_id;
    const projectId: string = c.rows[0].project_id;

    return withIdempotency<CreateAssignmentResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "assignments.create", key: a.idempotencyKey, requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "assignments.manage" });

      // The work item must belong to the contract's CURRENT published version.
      // Matching on contract alone would silently attach operational scope to a
      // superseded version, and the assignment would then measure work against
      // quantities and prices nobody is contractually on the hook for.
      //
      // `status = 'published'` IS NOT OPTIONAL IN THIS SUBQUERY. Migration 0042
      // made a contract version able to be a DRAFT, and without the predicate
      // the highest version_no is whatever the last person started typing: an
      // assignment would be created against a baseline nobody has agreed to,
      // whose lines are still editable and whose money is not fixed. 0042's
      // header names this route and import_batches.publish as the two readers
      // that had to move with it. Migration 0043 makes the same guarantee
      // structural (`work_assignments_published_baseline_fkey`); this stays
      // because a 23503 is not a refusal a caller can act on.
      const wi = await tx.query(
        `select w.id, w.contract_version_id, w.unit_code, w.position,
                w.work_code, w.description, w.work_type_key
           from public.work_items w
          where w.workspace_id = $1 and w.contract_id = $2 and w.id = $3
            and w.contract_version_id = (
              select v.id from public.contract_versions v
               where v.workspace_id = w.workspace_id and v.contract_id = w.contract_id
                 and v.status = 'published'
               order by v.version_no desc limit 1)`,
        [workspaceId, contractId, a.body.workItemId]);
      if (wi.rows.length === 0) {
        throw invalid("workItemId",
          "Позицію робіт не знайдено в поточній опублікованій версії договору.",
          "unknown work item in the current published version");
      }
      const contractVersionId: string = wi.rows[0].contract_version_id;

      // RETIRED PIN, STILL WRITTEN. ADR-005 decision 2 retires
      // `requirement_template_version_id`, and the plan's contradiction 3 fixes
      // the order: add the occurrence source, then stop writing the pin, then
      // remove the template read. This route did the first.
      //
      // WHAT THIS COMMENT USED TO SAY, AND WHY IT NO LONGER HOLDS. Until
      // migration 0050 it read «stopping the write now — WHILE MATERIALISATION
      // CANNOT PRODUCE AN OCCURRENCE — would leave the upload gate with no
      // policy source at all», and «the pin therefore stays UNTIL THE WORK-TYPE
      // DECISION LANDS». That condition was met on 2026-08-08: 0050 adds the
      // carrier read at :197 below, and a TYPED line under a bound baseline now
      // materialises occurrences the upload gate can read its media policy from.
      //
      // THE PIN STAYS ANYWAY, ON A DIFFERENT AND NARROWER CONDITION, and the
      // condition is stated once — in the sibling file that actually reads the
      // pin, assignments/[assignmentId]/upload-intents/route.ts:38-47. In short:
      // an UNTYPED line still materialises nothing, an imported baseline is
      // published and immutable (INV-015) so its lines can never acquire a work
      // type, and therefore an assignment on an imported baseline will never
      // have an occurrence. Retiring source 2 today would drop exactly those
      // assignments to FALLBACK_MEDIA — the widening ADR-005 is written against.
      // Step two's condition is «every assignment that can reach the upload
      // route has an occurrence», not «the carrier exists».
      //
      // Do not restate that condition here. Two files stating it independently
      // is how they came to contradict each other in the first place.
      //
      // A draft template can still change, so pinning one would make the pin a
      // promise the system cannot keep.
      if (a.body.requirementTemplateVersionId) {
        const t = await tx.query(
          `select 1 from public.requirement_template_versions
            where workspace_id = $1 and id = $2 and status = 'published'`,
          [workspaceId, a.body.requirementTemplateVersionId]);
        if (t.rows.length === 0) {
          throw invalid("requirementTemplateVersionId",
            "Версію шаблону вимог не знайдено або вона ще не опублікована.",
            "must reference a published template version");
        }
      }

      const assignmentId = randomUUID();
      try {
        await tx.query(
          `insert into public.work_assignments
             (id, workspace_id, project_id, contract_id, contract_version_id, work_item_id,
              location_id, performer_party_id, assignee_member_id, planned_quantity,
              due_date, requirement_template_version_id, created_by_member_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [assignmentId, workspaceId, projectId, contractId, contractVersionId,
           a.body.workItemId, a.body.locationId ?? null, a.body.performerPartyId ?? null,
           a.body.assigneeMemberId ?? null, a.body.plannedQuantity ?? null,
           a.body.dueDate ?? null, a.body.requirementTemplateVersionId ?? null, m.memberId]);
      } catch (e) {
        // The composite foreign keys are the hard guarantee; this turns a raw
        // 23503 into the catalog-coded problem the client can act on.
        if (e instanceof Error && /work_assignments_workspace_id_project_id_location/.test(e.message)) {
          throw invalid("locationId", "Локацію не знайдено в цьому проєкті.",
            "unknown location in this project");
        }
        if (e instanceof Error && /work_assignments_workspace_id_performer/.test(e.message)) {
          throw invalid("performerPartyId", "Сторону-виконавця не знайдено.",
            "unknown party in this workspace");
        }
        if (e instanceof Error && /work_assignments_workspace_id_assignee/.test(e.message)) {
          throw invalid("assigneeMemberId", "Учасника не знайдено в цьому просторі.",
            "unknown membership in this workspace");
        }
        throw e;
      }

      // ── materialisation ────────────────────────────────────────────────────
      // Read through the BINDING, never by predicate over the rule table: the
      // baseline pins a set at publication (INV-080) and a version retired
      // afterwards does not leave it (INV-067).
      const bound = await tx.query(BOUND_RULE_VERSIONS_SQL, [workspaceId, contractVersionId]);
      const plan = planMaterialisation({
        workItemId: wi.rows[0].id,
        position: Number(wi.rows[0].position),
        workCode: wi.rows[0].work_code ?? null,
        description: wi.rows[0].description,
        // Migration 0050's carrier. Read from the line and never from the
        // request: the work type is a property of the agreed baseline, and an
        // assignment that could name its own would let a foreman choose which
        // obligations apply to him.
        workTypeKey: (wi.rows[0].work_type_key as string | null) ?? null,
      }, bound.rows.map(boundRuleVersion));

      const written = await materialiseOccurrences(tx, {
        workspaceId, projectId, contractId, contractVersionId, assignmentId,
        memberId: m.memberId,
      }, plan);

      const materialisation: CreateAssignmentResponse["requirementOccurrences"] = {
        occurrenceCount: written.occurrenceIds.length,
        stageCount: written.stageIds.length,
        ruleVersionIds: plan.occurrences.map((o) => o.rule.ruleVersionId),
        coverage: plan.coverage,
        usedRetiredTemplatePin: Boolean(a.body.requirementTemplateVersionId),
      };

      await recordAudit(tx, ctx, {
        action: "assignment.created", object_type: "work_assignment",
        object_id: assignmentId,
        details: {
          workItemId: a.body.workItemId, contractVersionId,
          usedRetiredTemplatePin: materialisation.usedRetiredTemplatePin,
        },
      }, { organizationId: workspaceId });
      // A SECOND AUDIT ROW, DELIBERATELY. The obligation set is a different fact
      // from the assignment, it is the fact a reviewer looks for by name, and
      // when it is empty the audit is the only place the reason survives after
      // the response is gone.
      await recordAudit(tx, ctx, {
        action: "requirement_occurrences.materialized", object_type: "work_assignment",
        object_id: assignmentId,
        details: {
          contractVersionId,
          boundRuleVersionCount: bound.rows.length,
          occurrenceCount: materialisation.occurrenceCount,
          stageCount: materialisation.stageCount,
          coverage: materialisation.coverage,
        },
      }, { organizationId: workspaceId });

      await enqueueOutbox(tx, ctx, {
        topic: "assignment.created", aggregate_type: "work_assignment",
        aggregate_id: assignmentId, payload_version: 1,
        payload: { workspaceId, projectId, contractId, contractVersionId, assignmentId },
      }, { organizationId: workspaceId });
      // technical/events/event-catalog.csv:18 — `requirement_occurrence.materialized`,
      // v0.1-M2, producer `bff.assignments.create`. EMITTED EVEN WHEN THE COUNT
      // IS ZERO: the consumers are a projection rebuilder and a notification
      // creator, and «this assignment's obligation set was computed and is
      // empty, for this reason» is precisely what both need to hear. An event
      // suppressed on zero would make non-coverage invisible to everything
      // downstream, which is the failure mode INV-072 names.
      //
      // AGGREGATE TYPE `work_assignment`, AND THE CATALOG OWES A CORRECTION.
      // event-catalog.csv:18 gives the aggregate as `requirement_occurrence`,
      // but materialisation produces a SET and its aggregate id would have to be
      // one occurrence of it — impossible in the case that most needs
      // announcing, which is the empty set. One event per assignment, carrying
      // the occurrence ids, is the only shape that can report zero.
      await enqueueOutbox(tx, ctx, {
        topic: "requirement_occurrence.materialized", aggregate_type: "work_assignment",
        aggregate_id: assignmentId, payload_version: 1,
        payload: {
          workspaceId, projectId, contractId, contractVersionId, assignmentId,
          occurrenceIds: written.occurrenceIds, stageIds: written.stageIds,
          coverage: materialisation.coverage,
        },
      }, { organizationId: workspaceId });

      return {
        status: 201,
        body: { assignmentId, version: 1, requirementOccurrences: materialisation },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
