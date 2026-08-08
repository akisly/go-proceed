import { createHash, randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireWorkspaceCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { validationFailed } from "../../../../../src/lib/manual-baseline";
import {
  citationOf, ruleVersionView, type RuleVersionRow,
} from "../../../../../src/lib/requirement-content";
import {
  publishRequirementRuleVersionRequest, type PublishRequirementRuleVersionResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `requirement_rule_versions.publish` —
 * POST /v1/workspaces/{workspaceId}/requirement-rule-versions
 * (technical/openapi/scope-v0.1.csv:29; command, idempotency required, member
 * plane, governed by the WORKSPACE capability requirement_rules.manage —
 * technical/permissions/capabilities.csv:9, owner/admin, which is the same role
 * set the RLS policy `rrv_insert` names at migration 0041:774-776).
 *
 * PUBLICATION IS ONE COMMAND, NOT A DRAFT LIFECYCLE. public.requirement_rules is
 * not in v0.1 (ADR-006 decision 4.1) and there is no rule-drafting operation in
 * either scope CSV, so a version cannot be published "through" a draft rule that
 * does not exist. The row is inserted already `published`; `rrv_insert` refuses
 * anything else, and there is no UPDATE grant, so what this command writes is
 * frozen the moment it commits (INV-067).
 *
 * THREE REFUSALS THIS ROUTE OWNS, because no CHECK carries them and 0041's
 * header says so explicitly (departure 2, and «what this migration does not
 * enforce»):
 *
 *  * INV-082 first half — intervention_type other than `hold` (ADR-006 decision
 *    4.3). Raised by `publishRequirementRuleVersionRequest`, not here: it is a
 *    property of the request alone and belongs where a client can discover it
 *    from the schema.
 *  * INV-082 second half — a `hold` whose blocking_scope is not
 *    `blocks_stage_closure` (ADR-006 decision 4.4). Same place, same reason.
 *  * INV-085 — while v0.1-M5 is unshipped a `hold` must name an INTERNAL
 *    approver role. THIS ONE IS HERE and deliberately not in the schema: it is
 *    lifted WITHIN v0.1, by the same change that ships occurrence_grants.issue,
 *    and a request contract that changed between M4 and M5 would make a client
 *    that is already correct start failing. The lift is one edit — the constant
 *    below — and not a search.
 *
 *    **LIFTED 2026-08-07 BY THE v0.1-M5 SLICE.** `occurrence_grants.issue` and
 *    `external.occurrence_decision_submit` exist, migration 0049 §6 dropped
 *    `requirement_evidence_decisions_v01_internal_only_check`, and an external
 *    approver named on a `hold` now has a way in. The constant is left in place
 *    rather than deleted with its branch: it is the record of what the refusal
 *    was and what lifted it, and `invariant-catalog.csv:86` requires BOTH
 *    directions to be tested — «external-approver-rejected-before-M5 tests;
 *    external-approver-accepted-from-M5 tests».
 *
 * THE CITATION IS COPIED, NEVER ACCEPTED. `norm_ref`, `norm_ref_verification`
 * and `norm_ref_source` are read off the cited library row inside this
 * transaction. A caller that could send them could assert a normative string
 * carrying a verification tag it invented, which is exactly what INV-073 and
 * hidden-works-content-rules.md §"Architectural requirement" exist to prevent.
 * Copying also makes the obligation immutable in the right way: a library row
 * corrected later must not silently change an obligation already agreed.
 */

/**
 * v0.1-M5 ships occurrence_grants.issue and the external decision plane. Until
 * it does, a `hold` that named an EXTERNAL approver role would be a hold nobody
 * in the product could release: the only decision surface is
 * evidence_decisions.create on the member plane (v0.1-M3), and an external
 * технагляд has no way in. INV-085 is that refusal, and flipping this constant
 * to true is the whole of lifting it.
 *
 * FLIPPED BY THE v0.1-M5 SLICE (2026-08-07), which is the change the invariant's
 * own row and the implementation plan (line 326) both require it to be flipped
 * by: «M5 lifts that restriction BY THE SAME CHANGE that ships the occurrence
 * grant. Shipping M5 without lifting it leaves the external arc unreachable;
 * lifting it before M5 ships produces holds nobody can close.»
 *
 * WHAT IS NOW REACHABLE, AND WHAT IS STILL NOT. A `hold` with
 * `approverIsExternal: true` publishes, materialises an occurrence carrying that
 * flag, and can be granted to an external decider — `occurrence_grants.issue`
 * refuses a DECIDING grant on an occurrence whose flag is false, so the flag is
 * now load-bearing rather than decorative. What is still not reachable is a
 * mixed baseline that works end to end without the work-type carrier: no
 * assignment materialises any occurrence at all (progress §4.1), so every M5
 * suite reaches an occurrence through the same documented harness M3 and M4 use.
 */
const OCCURRENCE_GRANTS_SHIPPED = true;

export const POST = commandRoute(publishRequirementRuleVersionRequest, async (a) => {
  const workspaceId = a.params.workspaceId;
  if (!workspaceId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Робочий простір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }

  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) =>
    withIdempotency<PublishRequirementRuleVersionResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "requirement_rule_versions.publish", key: a.idempotencyKey,
      requestHash: a.requestHash,
      // NOT ledger_400d. A rule version carves no money; it is the obligation a
      // baseline later pins. import_batches.publish and contract_versions.publish
      // take the long class because they fix the money pool, and copying it here
      // would say this command does something it does not.
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      requireWorkspaceCapability(a.requestId, m.role, "requirement_rules.manage");

      // ── INV-085 ────────────────────────────────────────────────────────────
      if (!OCCURRENCE_GRANTS_SHIPPED
          && a.body.interventionType === "hold" && a.body.approverIsExternal) {
        throw validationFailed(a.requestId,
          "Поки зовнішній доступ не ввімкнено, точку зупинки може зняти лише внутрішня роль. "
          + "Вкажіть внутрішнього затверджувача (INV-085).",
          [{ path: "approverIsExternal", message: "a hold must name an internal approver role until v0.1-M5" }]);
      }

      // ── the cited library row, read inside the tenant transaction ──────────
      // RLS-scoped: a row in another workspace is indistinguishable from an
      // absent one, so the refusal is never an oracle for another tenant's
      // content.
      const lib = await tx.query(
        `select id, source_standard, position_code, position_title_uk, item_no,
                item_text_uk, verification, source_citation
           from public.requirement_library_items
          where workspace_id = $1 and id = $2`,
        [workspaceId, a.body.requirementLibraryItemId]);
      if (lib.rows.length === 0) {
        // ADR-006 decision 4.1: «the only rule source in v0.1 is the shipped
        // library». The column is nullable so v0.2's workspace-authored rules
        // stay additive (0041 departure 3); the v0.1 restriction is this refusal.
        throw validationFailed(a.requestId,
          "Пункт бібліотеки вимог не знайдено в цьому робочому просторі. "
          + "У v0.1 правило спирається лише на постачений перелік Додатка Н.",
          [{ path: "requirementLibraryItemId", message: "unknown library item in this workspace" }]);
      }
      const item = lib.rows[0];

      // Absent acceptanceCriterion copies the standard's own wording VERBATIM,
      // which is what ADR-006 step 2 promises the foreman will see. Supplied
      // wording is the workspace's own: it is stored as the acceptance criterion
      // and it does NOT acquire the citation's verification tag by sitting next
      // to it — the tag travels with norm_ref and only with norm_ref.
      const acceptanceCriterion = a.body.acceptanceCriterion ?? (item.item_text_uk as string);

      // Serialize version numbering per lineage, for the reason
      // requirement_templates.create:28-32 gives: max+1 read outside a lock lets
      // two concurrent publications compute the same number and
      // unique (workspace_id, requirement_rule_id, version_no) would reject one
      // caller with a raw 23505 instead of giving them version N+1. An absent
      // requirementRuleId mints a new lineage, which cannot collide, and the
      // lock is still taken on the minted key so the two paths read alike.
      const requirementRuleId = a.body.requirementRuleId ?? randomUUID();
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`rrv|${workspaceId}|${requirementRuleId}`]);

      const numbering = await tx.query(
        `select coalesce(max(version_no), 0) as v from public.requirement_rule_versions
          where workspace_id = $1 and requirement_rule_id = $2`,
        [workspaceId, requirementRuleId]);
      const versionNo = Number(numbering.rows[0].v) + 1;
      // A CALLER-SUPPLIED requirementRuleId IS NOT VALIDATED AGAINST ANYTHING,
      // and that is forced rather than chosen: public.requirement_rules does not
      // exist in v0.1 (ADR-006 decision 4.1), so an unknown lineage key is
      // indistinguishable from a new one and simply starts at version 1. Nothing
      // in v0.1 requires successive versions of one lineage to keep the same
      // predicate either; inventing that rule here would be a constraint no
      // authority states.

      // The frozen content, in a fixed key order so identical obligations hash
      // identically. `allowedMedia` is the parsed request value rather than the
      // stored jsonb, so the digest cannot drift with a driver's key ordering.
      const allowedMediaJson = a.body.allowedMedia
        ? JSON.stringify(a.body.allowedMedia)
        // The column is NOT NULL with default '[]'::jsonb, and '[]' is an ARRAY
        // — not the object the upload gate reads. That is correct here and only
        // here: measurement and checkbox produce no uploaded original, the
        // request contract refuses allowedMedia for them, and the view below maps
        // the array back to `null` so no consumer ever tries to read a policy off
        // it. For photo and document the contract REQUIRES the object, so the
        // default is never what an occurrence copies.
        : "[]";
      const normRef = citationOf(item.source_standard as string, item.position_code as string);
      const frozen = JSON.stringify({
        requirementRuleId, versionNo, ordinal: a.body.ordinal,
        workTypeKey: a.body.workTypeKey,
        // The v0.1 predicate is (work type, stage) and nothing else — ADR-006
        // decision 4.2 moves locations to v0.2 — so the empty location predicate
        // is in the digest as the fact that no location narrows this rule.
        locationPredicate: {},
        stageKey: a.body.stageKey,
        interventionType: a.body.interventionType,
        blockingScope: a.body.blockingScope,
        timing: a.body.timing,
        evidenceKind: a.body.evidenceKind,
        acceptanceCriterion,
        performerRole: a.body.performerRole,
        approverRole: a.body.approverRole,
        approverIsExternal: a.body.approverIsExternal,
        minEvidenceCount: a.body.minEvidenceCount,
        maxEvidenceCount: a.body.maxEvidenceCount,
        allowedMedia: a.body.allowedMedia ?? null,
        // The citation is part of what was agreed, not decoration: two rule
        // versions identical in every obligation but resting on different
        // standards are different obligations.
        normRef,
        normRefVerification: item.verification,
        normRefSource: item.source_citation,
        requirementLibraryItemId: item.id,
      });
      const ruleVersionHash = createHash("sha256").update(frozen).digest("hex");

      const inserted = await tx.query(
        `insert into public.requirement_rule_versions
           (id, workspace_id, requirement_rule_id, version_no, ordinal, status,
            work_type_key, stage_key,
            intervention_type, blocking_scope, timing, evidence_kind,
            acceptance_criterion, performer_role, approver_role, approver_is_external,
            min_evidence_count, max_evidence_count, allowed_media,
            norm_ref, norm_ref_verification, norm_ref_source, requirement_library_item_id,
            rule_version_hash, published_at, published_by_member_id, created_by_member_id)
         values ($1,$2,$3,$4,$5,'published',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,
                 $19,$20,$21,$22,$23,now(),$24,$24)
         returning *`,
        [randomUUID(), workspaceId, requirementRuleId, versionNo, a.body.ordinal,
         a.body.workTypeKey, a.body.stageKey,
         a.body.interventionType, a.body.blockingScope, a.body.timing, a.body.evidenceKind,
         acceptanceCriterion, a.body.performerRole, a.body.approverRole, a.body.approverIsExternal,
         a.body.minEvidenceCount, a.body.maxEvidenceCount, allowedMediaJson,
         normRef, item.verification, item.source_citation, item.id,
         ruleVersionHash, m.memberId]);
      // location_predicate, form_schema and exception_policy are NOT named: the
      // first keeps its '{}' default because v0.1 has no location predicate
      // (ADR-006 decision 4.2), and the other two have no v0.1 wire field and no
      // v0.1 reader. published_by_member_id and created_by_member_id are the same
      // member because publication IS the creation — there is no draft to have
      // been authored by somebody else (ADR-006 decision 4.1).

      const view = ruleVersionView(inserted.rows[0] as RuleVersionRow);

      await recordAudit(tx, ctx, {
        action: "requirement_rule_version.published",
        object_type: "requirement_rule_version", object_id: view.ruleVersionId,
        details: {
          requirementRuleId, versionNo, ruleVersionHash,
          workTypeKey: a.body.workTypeKey, stageKey: a.body.stageKey,
          interventionType: a.body.interventionType, blockingScope: a.body.blockingScope,
          requirementLibraryItemId: item.id,
        },
      }, { organizationId: workspaceId, objectVersion: versionNo });
      await enqueueOutbox(tx, ctx, {
        // technical/events/event-catalog.csv:14, producer
        // bff.requirement_rule_versions.publish, payload_version 1.
        topic: "requirement_rule_version.published",
        aggregate_type: "requirement_rule_version", aggregate_id: view.ruleVersionId,
        payload_version: 1,
        payload: {
          workspaceId, requirementRuleId, ruleVersionId: view.ruleVersionId, versionNo,
          ruleVersionHash, workTypeKey: a.body.workTypeKey, stageKey: a.body.stageKey,
        },
        // NO ACCEPTANCE CRITERION AND NO CITATION IN THE PAYLOAD. The outbox is
        // read by consumers outside the command's authorization, and the
        // criterion is workspace content while the citation is a normative
        // string that must never travel without its tag and its source
        // (hidden-works-content-rules.md §"Architectural requirement"). A
        // consumer that needs either reads the version by id.
      }, { organizationId: workspaceId });

      return { status: 201, body: view };
    }));
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
