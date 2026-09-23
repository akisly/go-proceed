import { queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  listRequirementOccurrencesResponse, type ListRequirementOccurrencesResponse,
  listRequirementOccurrencesWithReferenceImagesResponse,
} from "@goproceed/contracts";
import { withTenantTx } from "@goproceed/database";
import { occurrenceView } from "../../../../../src/lib/requirement-content";
import { referenceImageView } from "../../../../../src/lib/reference-images";

export const runtime = "nodejs";

/**
 * `requirement_occurrences.list` —
 * GET /v1/assignments/{assignmentId}/requirement-occurrences
 * (technical/openapi/scope-v0.1.csv:36; query, idempotency natural, member
 * plane, governed by `project.view`).
 *
 * THE FOREMAN'S READ BEFORE WORK STARTS. capabilities.csv:14 names this
 * operation and says so in terms — «this is also how the foreman reads the
 * occurrence set for an assignment before work starts (ADR-006 step 2)» — which
 * is why the capability is `project.view` and not something narrower: the
 * foreman preset holds `progress.record` and `evidence.record` and reads the
 * obligation through `project.view`, so a stricter policy here would make the
 * central M2 screen unreachable for the persona it was built for. The RLS policy
 * `ro_select` (migration 0043 §9) names the same pair.
 *
 * THE ORDER IS CHRONOLOGICAL, NOT ALPHABETICAL. `requirement_occurrences_
 * assignment_idx` is (workspace, assignment, timing, ordinal, id), and sorting
 * by `timing` as text gives after → before_concealment → before_package →
 * before_work → during, which is the reverse of nothing in particular. The field
 * client shows obligations in the order the work meets them, so the sort is an
 * explicit CASE and is NOT index-backed. At pilot scale one assignment's
 * occurrence set is a handful of rows and the correct order is worth the sort;
 * if it ever is not, the index needs a different expression, not this route a
 * different order.
 *
 * NO SATISFACTION AND NO STATUS. Neither is a column (migration 0043) and
 * neither is computed here: satisfaction is a projection over decisions,
 * exceptions and review heads, and M3 is the milestone that ships it. A
 * nullable «satisfied» in this response would be read as «not yet satisfied» by
 * the one milestone that cannot tell the difference.
 */
export const GET = queryRoute(async (a) => {
  const versions = new URL(a.req.url).searchParams.getAll("referenceImages");
  if (versions.length > 1 || (versions.length === 1 && versions[0] !== "v1")) {
    throw new HttpProblem(422, problem("VALIDATION_FAILED", "Непідтримувана версія прикладів фотографій.",
      { requestId: a.requestId, retryable: false, userAction: "correct_fields" }));
  }
  const withImages = versions[0] === "v1";
  const assignmentId = a.params.assignmentId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Завдання не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!assignmentId) throw notFound;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx) => {
    const asg = await tx.query(
      `select a.workspace_id, a.project_id, a.contract_version_id, w.work_type_key
         from public.work_assignments a
         join public.work_items w
           on w.workspace_id = a.workspace_id and w.id = a.work_item_id
        where a.id = $1`, [assignmentId]);
    if (asg.rows.length === 0) throw notFound;
    const workspaceId: string = asg.rows[0].workspace_id;
    const projectId: string = asg.rows[0].project_id;
    const contractVersionId: string = asg.rows[0].contract_version_id;
    // Migration 0050's carrier, joined here only so the empty-list reason below
    // can tell an untyped line from an unbound baseline. A published line is
    // immutable (INV-015), so this is the same value materialisation read.
    const workTypeKey: string | null = asg.rows[0].work_type_key ?? null;

    const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
    await requireProjectCapability(tx, a.requestId,
      { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
    let captureAllowed = false;
    if (withImages) {
      try {
        // The upload-intent command uses this exact member/capability policy.
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "evidence.record" });
        captureAllowed = true;
      } catch (error) {
        if (!(error instanceof HttpProblem) || error.body.code !== "SCOPE_PROJECT_DENIED") throw error;
      }
    }

    const rows = await tx.query(
      `select o.id, o.work_assignment_id, o.rule_version_id, o.ordinal,
              o.work_stage_id, o.stage_key, o.stage_is_concealed,
              o.intervention_type, o.blocking_scope, o.timing, o.evidence_kind,
              o.acceptance_criterion, o.performer_role, o.approver_role,
              o.approver_is_external, o.min_evidence_count, o.max_evidence_count,
              o.norm_ref, o.norm_ref_verification, o.norm_ref_source, o.created_at,
              rv.allowed_media, o.reference_image_version_id,
              ri.version_no as reference_image_version_no, ri.sha256 as reference_image_sha256,
              ri.byte_size as reference_image_byte_size, ri.mime_type as reference_image_mime_type,
              ri.width as reference_image_width, ri.height as reference_image_height,
              ri.alt_text_uk as reference_image_alt_text_uk
         from public.requirement_occurrences o
         join public.requirement_rule_versions rv
           on rv.workspace_id = o.workspace_id and rv.id = o.rule_version_id
         left join public.requirement_reference_image_versions ri
           on ri.workspace_id = o.workspace_id and ri.id = o.reference_image_version_id
        where o.workspace_id = $1 and o.work_assignment_id = $2
        order by case o.timing
                   when 'before_work' then 1
                   when 'during' then 2
                   when 'before_concealment' then 3
                   when 'after' then 4
                   when 'before_package' then 5
                 end,
                 o.ordinal, o.id`,
      [workspaceId, assignmentId]);

    // WHY AN EMPTY LIST CARRIES A REASON. A foreman shown nothing cannot tell
    // «this work carries no obligation» from «this baseline bound no rules» from
    // «the obligation set could not be computed». The first is a fact, the second
    // is M1 review finding 1 (import_batches.publish can publish a baseline with
    // no bindings) and the third is the work-type gap — three different owners
    // and three different remedies. Silent non-coverage means there is no gate
    // (INV-072), so the emptiness is explained rather than rendered.
    //
    // Recomputed from the binding rather than read off the assignment, because
    // the assignment stores no verdict: what was true at materialisation is
    // what the occurrence rows show, and the reason there are none is a
    // property of the baseline as it stands now.
    let coverage: ListRequirementOccurrencesResponse["coverage"] = "covered";
    if (rows.rows.length === 0) {
      const bound = await tx.query(
        `select count(*)::int as n from public.contract_version_rule_bindings
          where workspace_id = $1 and contract_version_id = $2`,
        [workspaceId, contractVersionId]);
      // THREE REASONS, IN ORDER OF WHOSE PROBLEM IT IS. Before migration 0050
      // this branch could only report `work_type_unresolved`, because no line in
      // the product carried a work type; now the line either carries one or does
      // not, and the two have different remedies:
      //   * no bindings at all — the baseline is unfinished (M1 review finding 1);
      //   * the line names no work type — a superseding version with the line
      //     typed is the remedy, and for an imported baseline that is the only
      //     one (ADR-006 decision 6 freezes the importer, INV-015 freezes the
      //     published line);
      //   * the line names a work type and no bound rule version carries it —
      //     the honest «this work carries no obligation under this contract»,
      //     which is also what an incomplete binding looks like. ADR-006
      //     decision 4.2 requires it be named rather than hidden; naming it is
      //     all this read can do, and contract_versions.publish is where it was
      //     reported by position while the baseline was still a draft.
      coverage = bound.rows[0].n === 0 ? "no_bindings"
        : workTypeKey === null ? "work_type_unresolved"
        : "no_matching_rule";
    }

    // Parsed before returning, the pattern requirement_library.list establishes:
    // this response carries regulatory strings, and a citation that reached the
    // wire without its verification tag or its source must fail loudly rather
    // than render as normative (INV-073, hidden-works-content-rules.md).
    const schema = withImages ? listRequirementOccurrencesWithReferenceImagesResponse
      : listRequirementOccurrencesResponse;
    return schema.parse({
      workAssignmentId: assignmentId,
      contractVersionId,
      ...(withImages ? { workspaceId, captureAllowed } : {}),
      occurrences: rows.rows.map((row) => withImages
        ? { ...occurrenceView(row), referenceImage: referenceImageView(row, row.id) }
        : occurrenceView(row)),
      coverage,
    });
  });
  return { status: 200, body, headers: { "cache-control": "private, no-store", vary: "Authorization, Cookie" } };
});
