import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireWorkspaceCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  retireRequirementRuleVersionRequest, type RetireRequirementRuleVersionResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `requirement_rule_versions.retire` —
 * POST /v1/requirement-rule-versions/{ruleVersionId}/retire
 * (technical/openapi/scope-v0.1.csv:30; command, idempotency required, member
 * plane, governed by the WORKSPACE capability requirement_rules.manage).
 *
 * WHAT RETIREMENT DOES, AND THE THREE THINGS IT DOES NOT DO (INV-067):
 * it stops FUTURE binding. A baseline that already bound this version keeps it,
 * an occurrence that already pinned it is unchanged, and nothing about the
 * version's frozen content moves. That is why it is a BEFORE INSERT trigger on
 * the binding (app.guard_rule_binding, 0041 §8) and not a foreign key: the same
 * key must keep resolving for every binding made before the retirement.
 *
 * IT IS NOT A ROUTE UPDATE. goproceed_app holds no UPDATE grant on
 * public.requirement_rule_versions — that absence is what makes INV-067
 * structural rather than a convention — so the one write path is the SECURITY
 * DEFINER command app.retire_requirement_rule_version(workspace, version)
 * (0041 §7). It resolves its own actor from app.current_actor() and does its own
 * authorization; the membership and capability checks below are not redundant
 * with it, they are what turns a plpgsql raise into a problem+json the caller
 * can act on, and they run BEFORE anything is read so a refusal cannot become a
 * cross-tenant oracle.
 *
 * NO OUTBOX EVENT, and this is a gap named rather than papered over.
 * technical/events/event-catalog.csv carries requirement_rule_version.published
 * (:14) and no retirement topic. Emitting one would put an uncatalogued event on
 * the wire; the audit row below is the record retirement leaves. A consumer that
 * needs to learn of a retirement has no v0.1 event to subscribe to — see the
 * report accompanying this slice.
 *
 * REPLAY IS ANSWERED TWICE, deliberately. The same Idempotency-Key replays out
 * of public.idempotency_records without re-entering the transaction body; a
 * DIFFERENT key against an already-retired version re-enters it, and
 * app.retire_requirement_rule_version returns without raising for a version that
 * is already retired (0041:679-683), so the second caller is answered with the
 * ORIGINAL retirement's timestamp rather than a fresh one. Retirement is a fact,
 * not an event, and re-stamping it would rewrite when future binding stopped.
 */
export const POST = commandRoute(retireRequirementRuleVersionRequest, async (a) => {
  const ruleVersionId = a.params.ruleVersionId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND",
    "Версію правила не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!ruleVersionId) throw notFound;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    // Resolve the workspace before opening the idempotency scope, which is keyed
    // on it. The read is RLS-scoped by rrv_select (0041:770-771, active
    // membership), so a version in another tenant is indistinguishable from an
    // absent one — the same shape requirement_templates.publish:24-31 uses.
    const found = await tx.query(
      `select workspace_id from public.requirement_rule_versions where id = $1`,
      [ruleVersionId]);
    if (found.rows.length === 0) throw notFound;
    const workspaceId: string = found.rows[0].workspace_id;

    return withIdempotency<RetireRequirementRuleVersionResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "requirement_rule_versions.retire", key: a.idempotencyKey,
      requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      requireWorkspaceCapability(a.requestId, m.role, "requirement_rules.manage");
      // owner/admin, which is exactly the role set
      // app.retire_requirement_rule_version checks for itself (0041:670-673). A
      // route check laxer than the function would turn a 403 into a 500; a
      // stricter one would deny a write the database would have allowed.

      const before = await tx.query(
        `select requirement_rule_id, version_no, status
           from public.requirement_rule_versions
          where workspace_id = $1 and id = $2`,
        [workspaceId, ruleVersionId]);
      if (before.rows.length === 0) throw notFound;
      const prior = before.rows[0];
      if (prior.status !== "published" && prior.status !== "retired") {
        // UNREACHABLE, and left as a loud failure rather than a catalogued
        // refusal. The only insert path is requirement_rule_versions.publish and
        // the RLS policy rrv_insert admits status = 'published' only
        // (0041:774-776); there is no UPDATE grant, so nothing can move a row
        // back to 'draft'. A row here in any other state is a database defect,
        // and technical/error-catalog.csv has no code that describes it — the
        // nearest, RULE_PUBLISH_CONFLICT, tells the caller to run an impact
        // preview that does not exist in v0.1. Inventing a refusal for an
        // unrepresentable state would be a surface nobody can reach and a code
        // nobody can act on.
        throw new Error(
          `requirement rule version ${ruleVersionId} is ${prior.status}; only 'published' is reachable in v0.1`);
      }

      await tx.query("select app.retire_requirement_rule_version($1, $2)",
        [workspaceId, ruleVersionId]);

      const after = await tx.query(
        `select status, retired_at from public.requirement_rule_versions
          where workspace_id = $1 and id = $2`,
        [workspaceId, ruleVersionId]);
      const row = after.rows[0];
      if (!row || row.status !== "retired" || row.retired_at === null) {
        // The function is the only write path and it either retires the row or
        // raises. Never report a retirement that did not happen.
        throw new Error(
          `requirement rule version ${ruleVersionId} was not retired by app.retire_requirement_rule_version`);
      }
      const retiredAt = new Date(row.retired_at).toISOString();

      await recordAudit(tx, ctx, {
        action: "requirement_rule_version.retired",
        object_type: "requirement_rule_version", object_id: ruleVersionId,
        details: {
          requirementRuleId: prior.requirement_rule_id,
          versionNo: Number(prior.version_no),
          // What the caller found, so the trail distinguishes the retirement
          // from a later replay that changed nothing.
          priorStatus: prior.status,
        },
      }, { organizationId: workspaceId, objectVersion: Number(prior.version_no) });

      return { status: 200, body: { ruleVersionId, status: "retired" as const, retiredAt } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
