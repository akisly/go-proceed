import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { createProjectPartyRequest, type ProjectPartyResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `project_parties.create` — link a workspace party to a project in a named
 * relationship. THE ROW THE ACT'S SIGNATORY SLOTS COULD NOT GET.
 *
 * `composeSignatorySlot` requires a `projectPartyId`, and the compose route
 * (`stages/[stageId]/statutory-acts/route.ts`) 422s if the row is not a
 * participant of that project. Until 2026-08-18 nothing could create one:
 * `public.project_parties` existed since migration 0010 with RLS and grants
 * and every M4 suite inserted into it by SQL, so on any real workspace the two
 * MANDATORY slots (`builder`, `technicalSupervision`) were guaranteed 422 and
 * `statutory_acts.compose` was unreachable through the API. TODOS.md had this
 * filed as a P3 «dead surface» item; the 2026-08-08 escalation in that entry
 * said what it actually was.
 *
 * AUTHORIZATION WAS DECIDED IN 0010, NOT HERE. `pp_write`, the table's INSERT
 * policy, requires `project.admin` on the project — so that is what this route
 * requires, and nothing else. A route stricter than its policy denies a write
 * the database would allow; a route laxer than its policy turns a 403 into a
 * 500 (src/lib/authz.ts:70-75 records both directions). Matching it exactly is
 * the whole of the capability decision.
 *
 * Why `project.admin` and not a new `parties.link` capability: the project's
 * participants — who the customer is, who supervises, who designs — are the
 * project's own configuration, the same class of fact as who holds which
 * grant. `project_manager` is the persona that owns that (responsibility-
 * presets.csv), and it already holds `project.admin`.
 *
 * NO MIGRATION. Table, RLS, grants and the `(workspace, project, party,
 * relationship)` unique all exist. This file and its sibling under
 * `parties/[partyId]/contacts` are routes over a schema that was waiting for
 * them.
 */
export const POST = commandRoute(createProjectPartyRequest, async (a) => {
  const projectId = a.params.projectId;
  const notFound = () => new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!projectId) throw notFound();

  const projectPartyId = randomUUID();
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    // The workspace comes from the project row, never from the caller — same
    // shape as `assignments.create` resolving it from the contract. A project
    // id outside the caller's tenancy is invisible under RLS and reads as
    // absent, so the 404 is existence-safe by construction.
    const p = await tx.query(`select workspace_id from public.projects where id = $1`, [projectId]);
    if (p.rows.length === 0) throw notFound();
    const workspaceId: string = p.rows[0].workspace_id;

    return withIdempotency<ProjectPartyResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "project_parties.create", key: a.idempotencyKey, requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "project.admin" });
      },
    }, async () => {
      // The party must be one of THIS workspace's parties. `parties_select`
      // hides other tenants' rows, so a foreign id and a missing id are the same
      // 422 — a field error, because it is the caller's input that is wrong, and
      // one that does not disclose whether the id exists elsewhere.
      const party = await tx.query(
        `select 1 from public.parties where workspace_id = $1 and id = $2`,
        [workspaceId, a.body.partyId]);
      if (party.rows.length === 0) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED", "Учасника не знайдено в цьому робочому просторі.", {
          requestId: a.requestId, retryable: false, userAction: "correct_fields",
          fieldErrors: [{ path: "partyId", message: "not a party of this workspace" }],
        }));
      }

      try {
        await tx.query(
          `insert into public.project_parties
             (id, workspace_id, project_id, party_id, relationship, note, created_by)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [projectPartyId, workspaceId, projectId, a.body.partyId, a.body.relationship,
           a.body.note ?? null, a.userId]);
      } catch (e) {
        // One party holds one relationship to one project ONCE — the table's own
        // `(workspace_id, project_id, party_id, relationship)` unique (0010).
        // Without this branch the 23505 reaches the caller as a 500. Reported as
        // VERSION_CONFLICT because that is what the catalog gives «the state you
        // assumed has moved» — the same code the app uses for a stale
        // expectedVersion — and its userAction, refresh_compare_retry, is the
        // right instruction: the participant list is not what the caller thinks.
        //
        // THE NAME IS TRUNCATED, and matching the full one would silently miss
        // it. PostgreSQL caps identifiers at 63 bytes, so the auto-generated
        // name of this constraint is `…party_id_relationsh_key` — measured in the
        // live catalog, not read off the migration. Matched on the stable prefix
        // for that reason.
        if (e instanceof Error && /project_parties_workspace_id_project_id_party_id_relationsh/.test(e.message)) {
          throw new HttpProblem(409, problem("VERSION_CONFLICT",
            "Цей учасник уже має таку роль у проєкті.", {
              requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry",
            }));
        }
        throw e;
      }

      // `ctx.organizationId` is null because the workspace was resolved from
      // the project row inside the transaction; the override names it, as
      // `assignments.create` does — without it recordAudit throws and the caller
      // sees a 500 for a write that succeeded.
      await recordAudit(tx, ctx, {
        action: "project_party.created", object_type: "project_party", object_id: projectPartyId,
        details: { projectId, partyId: a.body.partyId, relationship: a.body.relationship },
      }, { organizationId: workspaceId });
      return { status: 201, body: { projectPartyId, version: 1 } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
