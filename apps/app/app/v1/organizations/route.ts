import { createHash, randomUUID } from "node:crypto";
import { requireUser } from "../../../src/lib/auth";
import { idempotencyKeyFrom } from "../../../src/lib/request-context";
import { HttpProblem, toProblemResponse, ok, requestIdFrom } from "../../../src/lib/http";
import { createOrganizationRequest, problem, type CreateOrganizationResponse } from "@aktflow/contracts";
import { buildOrganizationCreation } from "@aktflow/domain";
import { withTenantTx, recordAudit, enqueueOutbox, withIdempotency } from "@aktflow/database";

export const runtime = "nodejs"; // node-postgres + node:crypto require the Node runtime

export async function POST(req: Request): Promise<Response> {
  // Fallback id in case X-Request-Id itself fails validation below (before a
  // "real" requestId exists to attach to that very problem+json response).
  let requestId = crypto.randomUUID();
  try {
    // requestIdFrom validates syntax/length per docs/22-data-api-contract.md:170
    // and throws HttpProblem 422 VALIDATION_FAILED for an invalid header
    // instead of ever echoing it back into audit_events.request_id.
    requestId = requestIdFrom(req);
    const { userId } = await requireUser(requestId, req);

    // technical/error-catalog.csv is authoritative: VALIDATION_FAILED is 422,
    // user_action "correct_fields" — a missing Idempotency-Key is a request
    // validation failure like any other, not a bespoke off-catalog code.
    const idempotencyKey = idempotencyKeyFrom(req);
    if (!idempotencyKey) {
      throw new HttpProblem(422, problem("VALIDATION_FAILED",
        "Заголовок Idempotency-Key обовʼязковий.", {
          requestId, retryable: false, userAction: "correct_fields",
          fieldErrors: [{ path: "Idempotency-Key", message: "required" }],
        }));
    }

    // Read the RAW body once: it is both parsed and hashed (request_hash must be a
    // 64-char sha256 hex per the idempotency_records check constraint).
    const raw = await req.text();
    const requestHash = createHash("sha256").update(raw).digest("hex");
    let json: unknown;
    try { json = JSON.parse(raw); }
    catch {
      throw new HttpProblem(422, problem("VALIDATION_FAILED", "Тіло запиту не є валідним JSON.",
        { requestId, retryable: false, userAction: "correct_fields" }));
    }

    const parsed = createOrganizationRequest.safeParse(json);
    if (!parsed.success) {
      throw new HttpProblem(422, problem("VALIDATION_FAILED", "Некоректні дані організації.", {
        requestId, retryable: false, userAction: "correct_fields",
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

    // docs/22-data-api-contract.md:166 / technical/openapi.yaml declare this
    // header on the 201 so a client can distinguish "still replayable" from
    // "window expired" — without it a late retry could silently create a
    // second organization instead of replaying.
    return ok(out.status, out.body, requestId, {
      "Idempotency-Replay-Until": out.expiresAt.toISOString(),
    });
  } catch (err) {
    // Single mapping point: HttpProblem → its status, IdempotencyConflictError → 409, else 500.
    return toProblemResponse(err, requestId);
  }
}
