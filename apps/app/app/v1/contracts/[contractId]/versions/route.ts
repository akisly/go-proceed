import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { validationFailed } from "../../../../../src/lib/manual-baseline";
import {
  createContractVersionRequest, type CreateContractVersionResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `contract_versions.create` — POST /v1/contracts/{contractId}/versions
 * (technical/openapi/scope-v0.1.csv:15; command, idempotency required, member
 * plane, governed by contracts.edit).
 *
 * Creates the DRAFT that ADR-006 decision 2's manual baseline is typed into.
 * Migration 0042 is what makes a draft representable at all; before it,
 * public.contract_versions defaulted to 'published' and rejected every update.
 *
 * NOTHING COMMERCIAL CROSSES THE WIRE. Currency, tax mode and rate, terms,
 * approval and rounding policy, both tolerances and both party snapshots are
 * copied from the contract inside this transaction, exactly as the importer's
 * publish copies them (import-batches/[batchId]/publish/route.ts:161-176), and
 * migration 0042's guard then freezes every one of them for the life of the
 * version. A pin accepted here would let a caller publish a baseline whose own
 * numbers contradict the contract they were agreed under.
 *
 * NO OUTBOX EVENT. technical/events/event-catalog.csv carries
 * contract_version.published and contract_version.rules_bound and nothing for a
 * drafted version; a draft is not yet a fact anyone outside the workspace may
 * act on. Inventing a topic to make the route symmetric would put an
 * uncatalogued event on the wire.
 */
export const POST = commandRoute(createContractVersionRequest, async (a) => {
  const contractId = a.params.contractId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Договір не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!contractId) throw notFound;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    // RLS-scoped: a contract in another tenant is indistinguishable from absent.
    const c = await tx.query(
      `select workspace_id, project_id from public.contracts where id = $1`, [contractId]);
    if (c.rows.length === 0) throw notFound;
    const workspaceId: string = c.rows[0].workspace_id;
    const projectId: string = c.rows[0].project_id;

    return withIdempotency<CreateContractVersionResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "contract_versions.create", key: a.idempotencyKey,
      requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "contracts.edit" });

      // Serialize version numbering per contract. max(version_no)+1 read outside
      // a lock lets two concurrent creates compute the same number, and
      // unique (workspace_id, contract_id, version_no) would then reject one
      // caller with a raw 23505 instead of giving them version N+1. Same
      // advisory-lock technique as requirement_templates.create; it needs no
      // table grant and releases with the transaction.
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`cv|${workspaceId}|${contractId}`]);

      const contract = (await tx.query(
        `select * from public.contracts where workspace_id = $1 and id = $2`,
        [workspaceId, contractId])).rows[0];

      // The number is max+1 over EVERY version of the contract, drafts
      // included, because the unique constraint counts drafts too.
      const numbering = await tx.query(
        `select coalesce(max(version_no), 0) as v from public.contract_versions
          where workspace_id = $1 and contract_id = $2`,
        [workspaceId, contractId]);
      const versionNo = Number(numbering.rows[0].v) + 1;

      // A draft supersedes a PUBLISHED version or nothing. Superseding another
      // draft would name a predecessor that may never exist as an agreement,
      // and the diff contract_versions.get computes would compare a baseline
      // against something nobody signed.
      let supersedesVersionId: string | null = null;
      if (a.body.supersedesVersionId) {
        const prev = await tx.query(
          `select id from public.contract_versions
            where workspace_id = $1 and contract_id = $2 and id = $3 and status = 'published'`,
          [workspaceId, contractId, a.body.supersedesVersionId]);
        if (prev.rows.length === 0) {
          throw validationFailed(a.requestId,
            "Версію, яку заміщує ця чернетка, не знайдено серед опублікованих версій цього договору.",
            [{ path: "supersedesVersionId", message: "unknown or unpublished version of this contract" }]);
        }
        supersedesVersionId = prev.rows[0].id;
      }

      // Immutable party snapshots from CURRENT profiles, taken here rather than
      // at publication because own_party_snapshot and customer_party_snapshot
      // are NOT NULL on the row this command inserts and migration 0042's guard
      // forbids publication from touching them. The identity a baseline names is
      // therefore the identity that was on file when it was opened.
      const snap = async (partyId: string): Promise<Record<string, unknown>> => {
        const r = await tx.query(
          `select p.display_name, lp.official_name, lp.edrpou, lp.vat_number,
                  lp.tax_status, lp.legal_address, lp.country_code
             from public.parties p
             left join public.party_legal_profiles lp
               on lp.workspace_id = p.workspace_id and lp.party_id = p.id
            where p.workspace_id = $1 and p.id = $2`, [workspaceId, partyId]);
        return r.rows[0] ?? {};
      };

      const contractVersionId = randomUUID();
      await tx.query(
        `insert into public.contract_versions
           (id, workspace_id, project_id, contract_id, version_no, status, origin,
            own_party_snapshot, customer_party_snapshot, currency, tax_mode, tax_rate_bps,
            terms, approval_policy, rounding_policy,
            source_tolerance_minor_units, source_tolerance_bps,
            import_batch_id, source_manifest_hash, supersedes_version_id,
            created_by, published_by, published_at)
         values ($1,$2,$3,$4,$5,'draft','manual',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                 null,null,$16,$17,null,null)`,
        [contractVersionId, workspaceId, projectId, contractId, versionNo,
         JSON.stringify(await snap(contract.own_party_id)),
         JSON.stringify(await snap(contract.customer_party_id)),
         contract.currency, contract.tax_mode, contract.tax_rate_bps,
         JSON.stringify(contract.terms), JSON.stringify(contract.approval_policy),
         JSON.stringify(contract.rounding_policy),
         contract.source_tolerance_minor_units, contract.source_tolerance_bps,
         supersedesVersionId, a.userId]);
      // published_at is written as an EXPLICIT null. The column keeps its
      // `default now()` (0012:133) so the frozen importer's insert still works,
      // which means omitting it here would stamp the draft with a publication
      // time and be rejected by contract_versions_draft_check. That rejection is
      // the guard working; passing null is how this command satisfies it.

      await recordAudit(tx, ctx, {
        action: "contract_version.drafted", object_type: "contract_version",
        object_id: contractVersionId,
        details: { contractId, versionNo, origin: "manual", supersedesVersionId },
      }, { organizationId: workspaceId, objectVersion: versionNo });

      return {
        status: 201,
        body: { contractVersionId, versionNo, status: "draft" as const, supersedesVersionId },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
