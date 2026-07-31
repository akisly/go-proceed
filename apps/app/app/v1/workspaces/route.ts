import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../src/lib/command";
import { createWorkspaceRequest, type CreateWorkspaceResponse } from "@aktflow/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@aktflow/database";

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
      await recordAudit(tx, ctx, {
        action: "workspace.created", object_type: "workspace",
        object_id: workspaceId, details: {},
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
