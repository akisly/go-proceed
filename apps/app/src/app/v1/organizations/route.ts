import { createHash, randomUUID } from "node:crypto";
import { requireUser } from "../../../lib/auth.js";
import { idempotencyKeyFrom } from "../../../lib/request-context.js";
import { HttpProblem, toProblemResponse, ok, requestIdFrom } from "../../../lib/http.js";
import { createOrganizationRequest, problem, type CreateOrganizationResponse } from "@aktflow/contracts";
import { buildOrganizationCreation } from "@aktflow/domain";
import { withTenantTx, recordAudit, enqueueOutbox, withIdempotency } from "@aktflow/database";

export const runtime = "nodejs"; // node-postgres + node:crypto require the Node runtime

export async function POST(req: Request): Promise<Response> {
  const requestId = requestIdFrom(req);
  try {
    const { userId } = await requireUser(requestId);

    const idempotencyKey = idempotencyKeyFrom(req);
    if (!idempotencyKey) {
      throw new HttpProblem(400, problem("idempotency.required",
        "Заголовок Idempotency-Key обовʼязковий.", { requestId, retryable: false,
        userAction: "Додайте Idempotency-Key і повторіть." }));
    }

    // Read the RAW body once: it is both parsed and hashed (request_hash must be a
    // 64-char sha256 hex per the idempotency_records check constraint).
    const raw = await req.text();
    const requestHash = createHash("sha256").update(raw).digest("hex");
    let json: unknown;
    try { json = JSON.parse(raw); }
    catch {
      throw new HttpProblem(400, problem("validation.failed", "Тіло запиту не є валідним JSON.",
        { requestId, retryable: false }));
    }

    const parsed = createOrganizationRequest.safeParse(json);
    if (!parsed.success) {
      throw new HttpProblem(400, problem("validation.failed", "Некоректні дані організації.", {
        requestId, retryable: false,
        fieldErrors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      }));
    }

    const ids = {
      organizationId: randomUUID(),
      legalEntityId: randomUUID(),
      membershipId: randomUUID(),
    };
    const c = buildOrganizationCreation(parsed.data, userId, ids);

    // organizationId is null during bootstrap: the org doesn't exist yet when the
    // transaction starts. recordAudit/enqueueOutbox accept an opts.organizationId
    // override below rather than requiring a second fabricated TenantContext.
    const ctx = { actorUserId: userId, organizationId: null, requestId };

    const out = await withTenantTx(ctx, async (tx) => {
      return withIdempotency<CreateOrganizationResponse>(tx, {
        organizationId: null,
        actorScope: `user:${userId}`,
        operationId: "organizations.create",
        key: idempotencyKey,
        requestHash,
      }, async () => {
        await tx.query(
          `insert into public.organizations (id, legal_name, display_name, edrpou, base_currency, timezone, status, version)
           values ($1,$2,$3,$4,$5,$6,'trial',1)`,
          [c.organization.id, c.organization.legal_name, c.organization.display_name,
           c.organization.edrpou, c.organization.base_currency, c.organization.timezone]);
        // ORDER MATTERS: the owner membership must exist BEFORE the legal entity,
        // because le_insert requires an active membership in that org (anti-injection).
        // m_insert still passes here because the org has no members yet (bootstrap).
        await tx.query(
          `insert into public.memberships (id, organization_id, user_id, role, status, all_projects, version)
           values ($1,$2,$3,'owner','active',true,1)`,
          [c.membership.id, c.membership.organization_id, c.membership.user_id]);
        await tx.query(
          `insert into public.legal_entities (id, organization_id, legal_name, registration_code, country_code) values ($1,$2,$3,$4,$5)`,
          [c.legalEntity.id, c.legalEntity.organization_id, c.legalEntity.legal_name, c.legalEntity.registration_code, c.legalEntity.country_code]);
        await recordAudit(tx, ctx, c.audit, { organizationId: c.organization.id });
        await enqueueOutbox(tx, ctx, c.outbox, { organizationId: c.organization.id });
        return {
          status: 201,
          body: {
            organizationId: c.organization.id, membershipId: c.membership.id,
            role: "owner" as const, version: 1,
          },
        };
      });
    });

    return ok(out.status, out.body, requestId);
  } catch (err) {
    // Single mapping point: HttpProblem → its status, IdempotencyConflictError → 409, else 500.
    return toProblemResponse(err, requestId);
  }
}
