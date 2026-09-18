import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../src/lib/command";
import { seedRequirementLibrary, DODATOK_N_SOURCE_STANDARD } from "../../../src/lib/dodatok-n";
import { createWorkspaceRequest, type CreateWorkspaceResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, actorScopedOnly, recordAudit, enqueueOutbox } from "@goproceed/database";

export const runtime = "nodejs"; // node-postgres + node:crypto require the Node runtime

export const POST = commandRoute(createWorkspaceRequest, async (a) => {
  const workspaceId = randomUUID();
  const membershipId = randomUUID();
  // workspaceId is null during bootstrap: the workspace doesn't exist yet when
  // the transaction starts (same pattern as the legacy organizations route).
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, (tx) =>
    withIdempotency<CreateWorkspaceResponse>(tx, {
      organizationId: null,
      actorScope: `user:${a.userId}`,
      operationId: "workspaces.create",
      key: a.idempotencyKey,
      requestHash: a.requestHash,
      // No workspace yet: the record is fenced by its actor (DEV-020 residual).
      authorize: actorScopedOnly,
    }, async () => {
      // legal_name mirrors displayName ONLY to satisfy the legacy NOT NULL —
      // the workspace holds no authoritative legal attributes (ADR-002);
      // official data lives in party_legal_profiles.
      await tx.query(
        `insert into public.organizations (id, legal_name, display_name, timezone, locale, status, version)
         values ($1,$2,$2,$3,$4,'trial',1)`,
        [workspaceId, a.body.displayName, a.body.timezone, a.body.locale]);
      await tx.query(
        `insert into public.memberships (id, organization_id, user_id, role, status, all_projects, version)
         values ($1,$2,$3,'owner','active',false,1)`,
        [membershipId, workspaceId, a.userId]);

      // ── The Додаток Н library, materialised into this workspace ──────────
      //
      // AFTER THE OWNER MEMBERSHIP AND INSIDE THIS TRANSACTION, and both halves
      // are load-bearing. `rli_insert` (migration 0041:758-759) admits the
      // write only when app.member_role(workspace_id) is 'owner' or 'admin',
      // and that function reads public.memberships — so moving this above the
      // membership insert makes RLS refuse all twelve rows. 0041:752-757 states
      // this ordering as the assumption its INSERT policy was written against;
      // until now that statement described a call that did not exist.
      //
      // A FAILURE HERE ROLLS THE WORKSPACE BACK, which is the point. A
      // workspace without the library is a workspace in which every rule
      // publication is refused and therefore every baseline is unpublishable —
      // a shape the product should not be able to produce. Provisioning either
      // completes or leaves nothing behind.
      //
      // Content is a repository change under
      // docs/product/hidden-works-content-rules.md §"Change control", never a
      // runtime command: the call takes no content argument, there is no
      // requirement_library.create row in technical/openapi/scope-v0.1.csv, and
      // this route creates none.
      const requirementLibraryItemCount = await seedRequirementLibrary(tx, workspaceId);

      await recordAudit(tx, ctx, {
        action: "workspace.created", object_type: "workspace",
        object_id: workspaceId,
        // The count and the standard are RECORDED rather than assumed, so
        // «this workspace was provisioned with the library» is a fact in the
        // trail. A workspace whose row says 12 and whose table holds fewer is
        // then a discrepancy somebody can see, instead of an empty list nobody
        // can date.
        details: { requirementLibraryItemCount, sourceStandard: DODATOK_N_SOURCE_STANDARD },
      }, { organizationId: workspaceId });
      await enqueueOutbox(tx, ctx, {
        topic: "workspace.created", aggregate_type: "workspace",
        aggregate_id: workspaceId, payload_version: 1,
        payload: { workspaceId, ownerUserId: a.userId },
      }, { organizationId: workspaceId });
      return { status: 201, body: { workspaceId, membershipId, role: "owner" as const, version: 1 } };
    }));
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
