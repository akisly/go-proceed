import { commandRoute } from "../../../../../../../../src/lib/command";
import {
  requireActiveMembership, requireProjectCapability,
} from "../../../../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../../../../src/lib/http";
import {
  requirementOccurrenceDryRunRequest,
  type DryRunBoundRule, type DryRunWorkLine,
  type RequirementOccurrenceDryRunResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";
import {
  BOUND_RULE_VERSIONS_SQL, boundRuleVersion, lineCoverage, planMaterialisation,
} from "../../../../../../../../src/lib/requirement-materialisation";

export const runtime = "nodejs";

/**
 * `requirement_occurrences.dry_run` —
 * POST /v1/projects/{projectId}/contract-versions/{versionId}
 *      /requirement-occurrences/dry-run
 * (technical/openapi/scope-v0.1.csv:37; command, idempotency required, member
 * plane, governed by `requirements.assign`).
 *
 * THE PATH CARRIES THE BASELINE, AND THAT IS THE OPEN DECISION RESOLVED.
 * version-0.1.md §v0.1-M2 records it: the route set kept the operation
 * project-scoped, so the published contract version it reports over «is named in
 * the request and not in the path, and no @goproceed/contracts module defines
 * that request. Either the path gains the version or the contract does.» It
 * gains the version. The project segment stays because the capability is a
 * PROJECT capability and because keeping both makes the cross-check below
 * possible: a version that belongs to another project is a 404 here, and with a
 * version-only path it would have been a cross-project read that passed every
 * check the route could make.
 *
 * IT WRITES NO OCCURRENCE, AND THE IMPORT GRAPH IS WHAT SAYS SO. This file does
 * not import src/lib/occurrence-writer — the only module in the product that
 * inserts an occurrence or a stage. What it does write is its own audit row and
 * its own idempotency record: the operation is `command` / idempotency
 * `required` in the scope CSV, and a dry run someone ran is a fact about who
 * looked at the coverage of a baseline and when.
 *
 * WHY IT IS A COMMAND AT ALL, GIVEN THAT IT CHANGES NOTHING. Because the uncovered
 * list is «part of the command's own output, not a report someone may choose to
 * run» (version-0.1.md §v0.1-M2 exit gates; INV-072). A query would have made it
 * the report.
 *
 * WHAT INV-072 ASKS FOR AND DOES NOT GET HERE. Its enforcement column reads «the
 * command fails closed unless that list is acknowledged inside the request
 * hash». The command that would fail closed is bulk instantiation, and it is a
 * v0.2 row of scope-v0.2.csv. In v0.1 the instantiating command is
 * `assignments.create`, one line at a time; making IT depend on an
 * acknowledgement of a whole-baseline dry run is a scope decision, not a detail,
 * and it is recorded rather than taken. The half this milestone can carry is
 * disclosure, and the response below carries it in three places: per line, as an
 * explicit uncovered list, and as a single machine-readable diagnosis.
 */
export const POST = commandRoute(requirementOccurrenceDryRunRequest, async (a) => {
  const projectId = a.params.projectId;
  const versionId = a.params.versionId;
  const notFound = new HttpProblem(404,
    problem("RESOURCE_NOT_FOUND", "Версію договору не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!projectId || !versionId) throw notFound;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const v = await tx.query(
      `select workspace_id, project_id, contract_id, version_no, status
         from public.contract_versions where id = $1`, [versionId]);
    if (v.rows.length === 0) throw notFound;
    const workspaceId: string = v.rows[0].workspace_id;
    // The path's two identifiers must name one row. Without this a caller with
    // access to project A could read the coverage of project B's baseline by
    // pairing A's id with B's version, and every capability check would pass.
    if (v.rows[0].project_id !== projectId) throw notFound;

    return withIdempotency<RequirementOccurrenceDryRunResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "requirement_occurrences.dry_run", key: a.idempotencyKey,
      requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        // TWO CAPABILITIES, AND THE SECOND IS NOT DEFENSIVE. capabilities.csv:23
        // governs this operation with `requirements.assign`, and the operation
        // READS the bindings and the work lines — whose RLS policies
        // (`cvrb_select`, 0041:778-780) ask for `project.view`/`project.admin`. A
        // holder of `requirements.assign` alone would pass this route and be
        // filtered by RLS to zero bindings, and would then be handed a coverage
        // report saying the baseline binds nothing. A false answer is worse than a
        // refusal, so the refusal is explicit.
        //   RECORDED: responsibility-presets.csv maps `requirement_owner` to
        //   `requirements.assign` ALONE, so that preset cannot run this operation.
        //   `pto_engineer` maps to `requirements.assign project.view` and can.
        //   Either the preset owes `project.view` or the policy owes
        //   `requirements.assign`; both are catalog decisions and neither is taken
        //   here.
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "requirements.assign" });
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
      },
    }, async () => {
      // A DRAFT BASELINE IS NOT REPORTED OVER. INV-072's v0.1 form is «the dry
      // run over a PUBLISHED contract version» (execution-and-evidence.md
      // §"Bulk instantiation"), and a draft's lines are still editable and its
      // bindings still movable — a coverage report over one would be true for as
      // long as it took to read.
      if (v.rows[0].status !== "published") {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Пробний прогін виконується лише над опублікованою версією договору.",
          { requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "versionId", message: "contract version is not published" }] }));
      }

      const bound = (await tx.query(BOUND_RULE_VERSIONS_SQL, [workspaceId, versionId]))
        .rows.map(boundRuleVersion);

      const lines = await tx.query(
        `select id, position, work_code, description, work_type_key
           from public.work_items
          where workspace_id = $1 and contract_version_id = $2
          order by position, id`,
        [workspaceId, versionId]);

      const workLines: DryRunWorkLine[] = lines.rows.map((r) => {
        const line = {
          workItemId: r.id as string,
          position: Number(r.position),
          workCode: (r.work_code as string | null) ?? null,
          description: r.description as string,
          // Migration 0050's carrier. `lineCoverage` echoes it back as
          // `c.workTypeKey` from the same plan the coverage came from, so the
          // key shown beside a verdict is the key that produced it.
          workTypeKey: (r.work_type_key as string | null) ?? null,
        };
        const c = lineCoverage(bound, line);
        return { ...line, workTypeKey: c.workTypeKey, coverage: c.coverage,
                 ruleVersionIds: c.ruleVersionIds };
      });

      // Per-rule match counts, computed from the same plan the lines were, so
      // «this rule matches nothing» and «this line matches nothing» can never
      // disagree.
      const matchedByRule = new Map<string, number>();
      for (const line of workLines) {
        for (const id of line.ruleVersionIds) {
          matchedByRule.set(id, (matchedByRule.get(id) ?? 0) + 1);
        }
      }
      const boundRules: DryRunBoundRule[] = bound.map((r) => ({
        ruleVersionId: r.ruleVersionId,
        requirementRuleId: r.requirementRuleId,
        workTypeKey: r.workTypeKey,
        stageKey: r.stageKey,
        interventionType: r.interventionType,
        blockingScope: r.blockingScope,
        timing: r.timing,
        matchedWorkLineCount: matchedByRule.get(r.ruleVersionId) ?? 0,
      }));

      const uncoveredLines = workLines.filter((l) => l.coverage !== "covered");
      // What the whole baseline would materialise, counted the way the command
      // would produce it: one occurrence per matched rule per line.
      const wouldMaterialiseCount = workLines.reduce(
        (n, l) => n + planMaterialisation(l, bound).occurrences.length, 0);

      const diagnosis: RequirementOccurrenceDryRunResponse["summary"]["diagnosis"] =
        bound.length === 0 ? "no_bindings"
        : workLines.every((l) => l.coverage === "work_type_unresolved")
            && workLines.length > 0 ? "no_work_line_is_typed"
        : uncoveredLines.length === 0 ? "covered"
        : "partially_uncovered";

      const body: RequirementOccurrenceDryRunResponse = {
        projectId, contractId: v.rows[0].contract_id, contractVersionId: versionId,
        versionNo: Number(v.rows[0].version_no),
        boundRules, workLines, uncoveredLines,
        summary: {
          workLineCount: workLines.length,
          boundRuleCount: bound.length,
          uncoveredLineCount: uncoveredLines.length,
          wouldMaterialiseCount,
          diagnosis,
        },
      };

      // The audit row carries the COUNTS and the diagnosis, never the work
      // lines: error-catalog and audit policy keep row content out of records
      // that outlive the request, and a coverage report is exactly the kind of
      // thing that would otherwise copy a baseline into the audit log.
      await recordAudit(tx, ctx, {
        action: "requirement_occurrences.dry_run", object_type: "contract_version",
        object_id: versionId,
        details: {
          workLineCount: body.summary.workLineCount,
          boundRuleCount: body.summary.boundRuleCount,
          uncoveredLineCount: body.summary.uncoveredLineCount,
          wouldMaterialiseCount: body.summary.wouldMaterialiseCount,
          diagnosis: body.summary.diagnosis,
        },
      }, { organizationId: workspaceId });

      // NO OUTBOX EVENT. technical/events/event-catalog.csv has no row whose
      // producer is this operation, and a preview changes no state for a
      // projection to rebuild or a notification to announce. Inventing a topic
      // to look symmetrical with assignments.create would put an event on the
      // bus that no consumer is declared for.
      return { status: 200, body };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
