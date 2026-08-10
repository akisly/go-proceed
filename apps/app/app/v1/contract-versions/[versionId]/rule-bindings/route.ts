import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import {
  notFoundVersion, requireDraft, validationFailed, refuseUnlockableVersion,
} from "../../../../../src/lib/manual-baseline";
import {
  bindContractVersionRulesRequest,
  type BindContractVersionRulesResponse, type RuleBindingView,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `contract_versions.bind_rules` —
 * POST /v1/contract-versions/{versionId}/rule-bindings
 * (technical/openapi/scope-v0.1.csv:19; command, idempotency required, member
 * plane, governed by rule_bindings.manage).
 *
 * Pins the exact requirement rule-version set the work under this baseline will
 * be judged against (ADR-005 decision 2, ADR-006 decision 3). It targets a
 * DRAFT: a published version is immutable and a rule published afterwards never
 * reaches it (INV-080). That window is enforced structurally by
 * app.guard_rule_binding_window() (migration 0042 §5); the refusal here exists
 * to give the caller a code rather than a trigger's raise.
 *
 * IT IS ADDITIVE, NOT A REPLACEMENT. public.contract_version_rule_bindings is
 * append-only — no UPDATE grant, no DELETE grant, a mutation-rejecting trigger
 * (0041:591-593) — so a second call adds to the set and can never shrink it.
 * A caller that bound the wrong rule while the version is still a draft has no
 * unbind operation in v0.1; the remedy is a new draft. That is a real cost of
 * append-only and it is stated rather than papered over with a soft delete.
 *
 * THREE THINGS THIS COMMAND DOES NOT CHECK, because they are unrepresentable:
 * a draft rule version cannot be bound (composite FK on the literal
 * discriminator has_been_published, 0041:495-497), a binding cannot misreport
 * the stage its version names (0041:485-486), and one rule cannot contribute
 * two versions to a baseline (0041:476). The route reads the first and the
 * third back out as catalogued field errors because a 23503/23505 reaching the
 * caller as a 500 is not a refusal anyone can act on.
 *
 * THE THIRD HAS TWO SHAPES AND BOTH ARE READ BACK. A version of a rule the
 * baseline has already bound is caught against the stored set; two versions of
 * one rule inside a SINGLE request are caught against the request itself. Only
 * the first of those was checked before the M1 review — the second reached the
 * unique key mid-loop and came back as a 500 (M1 review finding 3).
 */
export const POST = commandRoute(bindContractVersionRulesRequest, async (a) => {
  const versionId = a.params.versionId;
  if (!versionId) throw notFoundVersion(a.requestId);

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const v = await tx.query(
      `select workspace_id, project_id, contract_id, status
         from public.contract_versions where id = $1`, [versionId]);
    if (v.rows.length === 0) throw notFoundVersion(a.requestId);
    const workspaceId: string = v.rows[0].workspace_id;
    const projectId: string = v.rows[0].project_id;
    const contractId: string = v.rows[0].contract_id;

    return withIdempotency<BindContractVersionRulesResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "contract_versions.bind_rules", key: a.idempotencyKey,
      requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "rule_bindings.manage" });

      const locked = await tx.query(
        `select status from public.contract_versions
          where workspace_id = $1 and id = $2 for update`, [workspaceId, versionId]);
      // An empty lock is not an absent version: cv_update's USING hides a
      // PUBLISHED row from `for update`, which is exactly the state this refusal
      // is about. See refuseUnlockableVersion.
      if (locked.rows.length === 0) {
        await refuseUnlockableVersion(tx, a.requestId, workspaceId, versionId);
      }
      requireDraft(a.requestId, locked.rows[0].status);

      // A caller that repeats an id in one call means it once. Deduplicating
      // before the uniqueness check keeps the refusal about the BASELINE ("this
      // rule is already bound") rather than about the request's own shape.
      const wanted = [...new Set(a.body.ruleVersionIds)];

      const named = await tx.query(
        `select id, requirement_rule_id, status, work_type_key, stage_key,
                intervention_type, blocking_scope
           from public.requirement_rule_versions
          where workspace_id = $1 and id = any($2::uuid[])`,
        [workspaceId, wanted]);
      const byId = new Map(named.rows.map((r) => [r.id as string, r]));

      const unknown = wanted.filter((id) => !byId.has(id));
      if (unknown.length > 0) {
        throw validationFailed(a.requestId,
          "Одну або кілька версій правил не знайдено в цьому робочому просторі.",
          unknown.map((id) => ({
            path: `ruleVersionIds[${a.body.ruleVersionIds.indexOf(id)}]`,
            message: "unknown rule version in this workspace",
          })));
      }
      const unpublished = wanted.filter((id) => byId.get(id)!.status !== "published");
      if (unpublished.length > 0) {
        throw validationFailed(a.requestId,
          "До базису можна прив'язати лише опубліковану версію правила. "
          + "Вилучена з обігу версія не потрапляє до нових базисів (INV-067).",
          unpublished.map((id) => ({
            path: `ruleVersionIds[${a.body.ruleVersionIds.indexOf(id)}]`,
            message: `rule version is ${byId.get(id)!.status}, not published`,
          })));
      }

      // TWO VERSIONS OF ONE LINEAGE INSIDE ONE REQUEST, and it is checked HERE —
      // before the baseline's own state is read — because a request that
      // contradicts itself is refused on its own terms, the way `unknown` and
      // `unpublished` above are. It is a different fault from the `wanted`
      // deduplication: that one is the same id twice and means the id once,
      // this one is two DIFFERENT ids resolving to one requirement_rule_id.
      //
      // WITHOUT THIS THE ONLY MID-LOOP FAILURE THE COMMAND CAN REACH GETS OUT AS
      // A 500. The already-bound check below reads only bindings that ALREADY
      // exist, so both ids pass it, the first insert lands and the second meets
      // `unique (workspace_id, contract_version_id, requirement_rule_id)`
      // (0041:471-476) as a raw 23505 — which this route's own header calls «not
      // a refusal anyone can act on». Every other conflict is decided before the
      // loop starts, so this is the last one that was not.
      //
      // THE DETAIL AND THE FIELD MESSAGE ARE THE SIBLING ROUTE'S, CHARACTER FOR
      // CHARACTER. import-batches/[batchId]/publish/route.ts refuses the same
      // request on the same set and its comment states that the two routes
      // refuse identically; two wordings for one fault would make that claim
      // false and would let a client tell the two publication paths apart by
      // their error text.
      const byLineage = new Map<string, string[]>();
      for (const id of wanted) {
        const lineage = byId.get(id)!.requirement_rule_id as string;
        byLineage.set(lineage, [...(byLineage.get(lineage) ?? []), id]);
      }
      // Every id of an over-full lineage is named, not all-but-the-first: the
      // caller has to see WHICH two versions collide to know which one to keep.
      const sameLineage = [...byLineage.values()].filter((ids) => ids.length > 1).flat();
      if (sameLineage.length > 0) {
        throw validationFailed(a.requestId,
          "Одне правило дає базису щонайбільше одну версію, "
          + "а в запиті названо дві версії того самого правила.",
          sameLineage.map((id) => ({
            path: `ruleVersionIds[${a.body.ruleVersionIds.indexOf(id)}]`,
            message: "two versions of one rule cannot be bound to one baseline",
          })));
      }

      const existing = await tx.query(
        `select requirement_rule_id, requirement_rule_version_id
           from public.contract_version_rule_bindings
          where workspace_id = $1 and contract_version_id = $2`, [workspaceId, versionId]);
      const boundRules = new Set(existing.rows.map((r) => r.requirement_rule_id as string));
      const boundVersions = new Set(existing.rows.map((r) => r.requirement_rule_version_id as string));

      // ONE RULE CONTRIBUTES AT MOST ONE VERSION TO A BASELINE (0041:471-476).
      // Re-binding the identical version is NOT a replay to swallow: the caller
      // asked for something the baseline already has, and answering 201 would
      // let a client believe a set was replaced when it was appended to.
      const conflicting = wanted.filter((id) => {
        const r = byId.get(id)!;
        return boundVersions.has(id) || boundRules.has(r.requirement_rule_id as string);
      });
      if (conflicting.length > 0) {
        throw validationFailed(a.requestId,
          "Одне з правил уже прив'язане до цієї версії договору. "
          + "Одне правило дає базису щонайбільше одну версію.",
          conflicting.map((id) => ({
            path: `ruleVersionIds[${a.body.ruleVersionIds.indexOf(id)}]`,
            message: "this rule already contributes a version to this baseline",
          })));
      }

      for (const id of wanted) {
        const r = byId.get(id)!;
        await tx.query(
          `insert into public.contract_version_rule_bindings
             (id, workspace_id, project_id, contract_id, contract_version_id,
              requirement_rule_id, requirement_rule_version_id, stage_key, bound_by_member_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [randomUUID(), workspaceId, projectId, contractId, versionId,
           r.requirement_rule_id, id, r.stage_key, m.memberId]);
        // bound_rule_version_is_published is left to its CHECK-forced default:
        // the column exists so the composite FK can only resolve against a
        // version whose generated has_been_published is true, and writing it
        // here would suggest the command is the thing deciding it.
      }

      // THE ORDER IS TOTAL AND STABLE; IT IS NOT YET MEANINGFUL. `b.id` is the
      // primary key, so two reads of the same baseline return the same sequence
      // — but `rv.ordinal` defaults to 1 on every publication and nothing
      // constrains it to be distinct within a (work_type_key, stage_key), so
      // with every ordinal equal the sequence is decided by a uuid nobody chose.
      // 0041:285-287 claims «the order is part of what was agreed»; today it is
      // part of what was defaulted, and that comment is corrected there rather
      // than restated here. Making it a constraint needs public.requirement_rules
      // — see the note in 0041 §2 for why a unique index over the predicate
      // cannot do it in v0.1 (M1 review finding 6).
      const all = await tx.query(
        `select b.id, b.requirement_rule_id, b.requirement_rule_version_id, b.stage_key,
                rv.work_type_key, rv.intervention_type, rv.blocking_scope
           from public.contract_version_rule_bindings b
           join public.requirement_rule_versions rv
             on rv.workspace_id = b.workspace_id and rv.id = b.requirement_rule_version_id
          where b.workspace_id = $1 and b.contract_version_id = $2
          order by rv.work_type_key, rv.stage_key, rv.ordinal, b.id`,
        [workspaceId, versionId]);
      const bindings: RuleBindingView[] = all.rows.map((b) => ({
        bindingId: b.id,
        requirementRuleId: b.requirement_rule_id,
        ruleVersionId: b.requirement_rule_version_id,
        workTypeKey: b.work_type_key,
        stageKey: b.stage_key,
        interventionType: b.intervention_type,
        blockingScope: b.blocking_scope,
      }));
      // The distinct stage keys of the bound set ARE this version's stage
      // vocabulary — M2 materialises stages and occurrences from the binding
      // rather than from a member command — so the caller is given it rather
      // than left to derive it.
      const stageKeys = [...new Set(bindings.map((b) => b.stageKey))].sort();

      await recordAudit(tx, ctx, {
        action: "contract_version.rules_bound", object_type: "contract_version",
        object_id: versionId,
        details: { boundNow: wanted.length, boundTotal: bindings.length, stageKeys },
      }, { organizationId: workspaceId });
      await enqueueOutbox(tx, ctx, {
        topic: "contract_version.rules_bound", aggregate_type: "contract_version",
        aggregate_id: versionId, payload_version: 1,
        payload: {
          workspaceId, projectId, contractId, contractVersionId: versionId,
          ruleVersionIds: wanted, stageKeys,
        },
      }, { organizationId: workspaceId });

      return { status: 201, body: { contractVersionId: versionId, bindings, stageKeys } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
