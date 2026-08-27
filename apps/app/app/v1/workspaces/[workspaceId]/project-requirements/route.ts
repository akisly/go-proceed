import { commandRoute, queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireWorkspaceCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { validationFailed } from "../../../../../src/lib/manual-baseline";
import {
  createProjectRequirementRequest, projectRequirementListResponse,
  type ProjectSourcedRequirementItemResponse, type ProjectRequirementListResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `project_requirements.create` —
 * POST /v1/workspaces/{workspaceId}/project-requirements
 * (technical/openapi/scope-v0.1.csv:32; command, idempotency required, member
 * plane, governed by the WORKSPACE capability project_requirements.manage —
 * technical/permissions/capabilities.csv:10, owner/admin, the same role set
 * migration 0059's RLS policy `psri_insert` names).
 *
 * ADR-010: a workspace may author a requirement straight from its own робоча
 * документація, in `public.project_sourced_requirement_items` — a table of
 * its own, never a row of the shipped Додаток Н library
 * (`public.requirement_library_items`, unmodified by migration 0059). The
 * identifying fields (`sourceDocument`, `sourceSheet`, `sourceDrawingNo`) are
 * what make this INV-073's source half: «робоча
 * документація» without a sheet and a drawing number is a word, not a
 * source. `verification` is never accepted on the wire — the command writes
 * the one tag this table may store, `PROJECT_DOCUMENTATION`, and the CHECK
 * `project_sourced_requirement_items.verification = 'PROJECT_DOCUMENTATION'`
 * makes any other value unstorable.
 *
 * CREATE HAS NO UPDATE COUNTERPART, by design (ADR-010 decision 5): the text
 * and its citation are immutable once written, and a correction is a new item
 * plus an archive of the old one (`project_requirements.archive`,
 * ../../../../project-requirements/[itemId]/archive/route.ts).
 */
export const POST = commandRoute(createProjectRequirementRequest, async (a) => {
  const workspaceId = a.params.workspaceId;
  if (!workspaceId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Робочий простір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }

  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) =>
    withIdempotency<ProjectSourcedRequirementItemResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "project_requirements.create", key: a.idempotencyKey,
      requestHash: a.requestHash,
      // Default retention class. Authoring a requirement carves no money.
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      requireWorkspaceCapability(a.requestId, m.role, "project_requirements.manage");

      // NOT a plain RLS-scoped select against public.projects — that was the
      // review fix round 1 finding (Critical). projects_select answers "may
      // THIS member see THIS project's contents" (it reads project_access_grants,
      // and INV-019 auto-grants the CREATOR alone), never "does this project
      // belong to this workspace". project_requirements.manage is a WORKSPACE
      // capability, so a workspace owner/admin who did not personally create
      // PROJECT must still be able to cite it. app.project_in_workspace
      // (migration 0059 §4) answers the tenant question directly, bypassing
      // that policy by SECURITY DEFINER; a project in another workspace is
      // still indistinguishable from an absent one — the function returns
      // false for both — so the refusal below is never an oracle for another
      // tenant.
      const proj = await tx.query(
        `select app.project_in_workspace($1, $2) as ok`,
        [workspaceId, a.body.projectId]);
      if (proj.rows[0]?.ok !== true) {
        throw validationFailed(a.requestId,
          "Проєкт не знайдено в цьому робочому просторі.",
          [{ path: "projectId", message: "unknown project in this workspace" }]);
      }

      const inserted = await tx.query(
        `insert into public.project_sourced_requirement_items
           (workspace_id, project_id, item_text_uk, source_document, source_sheet,
            source_drawing_no, source_revision, verification, created_by_member_id)
         values ($1,$2,$3,$4,$5,$6,$7,'PROJECT_DOCUMENTATION',$8)
         returning *`,
        [workspaceId, a.body.projectId, a.body.itemTextUk, a.body.sourceDocument,
         a.body.sourceSheet, a.body.sourceDrawingNo, a.body.sourceRevision ?? null,
         m.memberId]);

      const view = itemView(inserted.rows[0] as ProjectSourcedRequirementItemRow);

      // No opts.organizationId override: ctx.organizationId is already
      // workspaceId here (unlike archive/route.ts, which resolves it mid-tx),
      // so recordAudit's own fallback to ctx.organizationId is exactly right.
      await recordAudit(tx, ctx, {
        action: "project_sourced_requirement_item.created",
        object_type: "project_sourced_requirement_item", object_id: view.itemId,
        details: {
          projectId: a.body.projectId, sourceDocument: a.body.sourceDocument,
          sourceSheet: a.body.sourceSheet, sourceDrawingNo: a.body.sourceDrawingNo,
        },
      });

      return { status: 201, body: view };
    }));

  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});

/**
 * `project_requirements.list` — GET /v1/workspaces/{workspaceId}/project-requirements
 * (technical/openapi/scope-v0.1.csv:34; query, idempotency `natural`, member
 * plane — no Idempotency-Key and no request body).
 *
 * NO PAGINATION AND NO FILTER PARAMETER, and archived items are RETURNED, not
 * hidden — the same choice `requirement_library.list` makes and for the same
 * reason: a caller that wants only the active set filters the rows it was
 * given. Ordered by `created_at, id` for a stable list rather than the
 * standard's own sequence, because unlike Додаток Н this table has no
 * standard-defined order to preserve.
 *
 * THE RESPONSE IS PARSED BEFORE IT IS RETURNED, the same reason and the same
 * mechanism `requirement_library.list` uses: this route returns regulatory-
 * adjacent strings (the requirement text and its citation), and
 * `projectRequirementListResponse` is a zod schema rather than a plain
 * interface so a row whose tag or source went missing FAILS here instead of
 * rendering (docs/product/hidden-works-content-rules.md §"Architectural
 * requirement").
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTHORIZATION: ACTIVE MEMBERSHIP, NO CAPABILITY GATE — the same judgement
 * `requirement_library.list` records, reached the same way. Two sources
 * disagree:
 *
 *   * technical/permissions/capabilities.csv:10 lists project_requirements.list
 *     among the operations of project_requirements.manage, owner/admin only.
 *   * migration 0059's RLS policy `psri_select` reads
 *     `app.active_member_id(workspace_id) is not null`, and its own comment
 *     gives the reason in the SAME words `rli_select` uses: «the foreman who
 *     reads an occurrence reads the text behind it» — here, through a rule
 *     version that may cite `project_sourced_requirement_item_id` instead of
 *     the library.
 *
 * The policy wins, on the precedent `requirement-library/route.ts` sets:
 * docs/README.md §"Source of truth" puts an applied migration above the
 * permission catalog, and a route stricter than the policy denies a read the
 * database would have allowed — the failure the `readiness.view` correction
 * documented beside `IMPLIED_BY_PROJECT_ADMIN` in `apps/app/src/lib/authz.ts`
 * names in the other direction. `project_requirements.manage` still gates
 * `.create` and `.archive` above and in the archive route: this is a
 * departure for the READ alone, matching `psri_select`'s own permissiveness.
 * CAPABILITIES.CSV THEREFORE OWES THE SAME CORRECTION requirement-library's
 * route already flags for its sibling row, and this route does not make it.
 */
export const GET = queryRoute(async (a) => {
  const workspaceId = a.params.workspaceId;
  if (!workspaceId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Робочий простір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }

  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx): Promise<ProjectRequirementListResponse> => {
    await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);

    const r = await tx.query(
      `select id, project_id, item_text_uk, source_document, source_sheet,
              source_drawing_no, source_revision, verification, status,
              created_at, archived_at
         from public.project_sourced_requirement_items
        where workspace_id = $1
        order by created_at, id`,
      [workspaceId]);

    return projectRequirementListResponse.parse({
      items: (r.rows as ProjectSourcedRequirementItemRow[]).map(itemView),
    });
  });
  return { status: 200, body };
});

export interface ProjectSourcedRequirementItemRow {
  id: string;
  project_id: string;
  item_text_uk: string;
  source_document: string;
  source_sheet: string;
  source_drawing_no: string;
  source_revision: string | null;
  verification: string;
  status: string;
  created_at: Date | string;
  archived_at: Date | string | null;
}

/**
 * One row → the one view, shared by `.create` and `.list` (this file's `GET`)
 * so a project-sourced item reads identically however it is fetched — the
 * same reason the shipped library's own mapper, `libraryItemView` in
 * `apps/app/src/lib/requirement-content.ts`, exists in the first place. The
 * archive route imports nothing from here: `ArchiveProjectRequirementResponse`
 * carries neither the text nor the citation, so it has no row to map through
 * this shape.
 */
export function itemView(r: ProjectSourcedRequirementItemRow): ProjectSourcedRequirementItemResponse {
  return {
    itemId: r.id,
    projectId: r.project_id,
    itemTextUk: r.item_text_uk,
    sourceDocument: r.source_document,
    sourceSheet: r.source_sheet,
    sourceDrawingNo: r.source_drawing_no,
    sourceRevision: r.source_revision,
    verification: r.verification as ProjectSourcedRequirementItemResponse["verification"],
    status: r.status as ProjectSourcedRequirementItemResponse["status"],
    createdAt: new Date(r.created_at).toISOString(),
    archivedAt: r.archived_at === null ? null : new Date(r.archived_at).toISOString(),
  };
}
