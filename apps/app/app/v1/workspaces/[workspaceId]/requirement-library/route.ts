import { queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { libraryItemView, type LibraryItemRow } from "../../../../../src/lib/requirement-content";
import {
  requirementLibraryListResponse, type RequirementLibraryListResponse,
} from "@goproceed/contracts";
import { withTenantTx } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `requirement_library.list` — GET /v1/workspaces/{workspaceId}/requirement-library
 * (technical/openapi/scope-v0.1.csv:31; query, idempotency `natural`, member
 * plane — so no Idempotency-Key and no request body).
 *
 * The shipped Додаток Н content: positions Н.14 (5 items) and Н.15 (7 items),
 * verbatim, each row carrying its verification tag and its source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RESPONSE IS PARSED BEFORE IT IS RETURNED, and that is the point of this
 * route rather than a flourish. This is the only one of the nine v0.1-M1
 * operations that returns REGULATORY STRINGS, and
 * docs/product/hidden-works-content-rules.md §"Architectural requirement" is
 * binding on every one of them: «every normative string the product displays
 * carries its verification tag and its source in the data, not in a template. A
 * string with no source must be unrenderable.» `requirementLibraryListResponse`
 * enforces exactly that at the boundary — an item whose tag or source went
 * missing FAILS here instead of rendering — which is why @goproceed/contracts
 * declares this response as a zod schema rather than a plain interface. Same
 * pattern me/context/route.ts:42 establishes.
 *
 * THE ROUTE DOES NOT FILTER, and the distinction matters. A row with no tag or
 * no source is UNSTORABLE — `verification` is NOT NULL over a two-value CHECK
 * and `source_citation` is NOT NULL with a non-blank check (0041 §1) — so this
 * parse is the second layer and not the first. Filtering would hide a defect;
 * refusing names it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTHORIZATION: ACTIVE MEMBERSHIP, NO CAPABILITY GATE. This is a JUDGEMENT
 * between two sources that disagree, recorded here rather than resolved
 * silently:
 *
 *   * technical/permissions/capabilities.csv:9 lists requirement_library.list
 *     among the operations of the WORKSPACE capability requirement_rules.manage,
 *     which packages/domain/src/authz.ts maps to owner and admin only.
 *   * migration 0041's RLS policy `rli_select` reads
 *     `app.active_member_id(workspace_id) is not null` and says why in the
 *     migration text: «any active member reads it, because
 *     requirement_library.list is a member-plane query and the foreman who reads
 *     an occurrence reads the text behind it.»
 *
 * The policy wins, on three grounds. docs/README.md §"Source of truth" puts
 * applied migrations at precedence 1 and the permission catalog below it.
 * ADR-006 step 2 has the foreman reading the obligation before work starts, and
 * a foreman holds the `member` governance role — gated on requirement_rules.manage
 * this route would 403 every user the content exists for. And a route check
 * stricter than the policy denies a read the database would have allowed, which
 * packages/domain/src/authz.ts:24-28 names as the failure to avoid in both
 * directions.
 *
 * CAPABILITIES.CSV THEREFORE OWES A CORRECTION and this route does not make it:
 * the operation belongs to the read every active member has, not to the
 * capability that PUBLISHES and RETIRES rule versions. Recorded, not edited.
 *
 * THE CORRECTION LANDED 2026-08-28: requirement_library.list left
 * requirement_rules.manage's operation list and stands in the
 * capability-exempt set (technical/openapi/README.md §Conventions, the
 * validator's CAPABILITY_EXEMPT) with active membership as its stated
 * governor. The two disagreeing sources above now agree; the paragraphs stay
 * as the history of why the policy won.
 *
 * NO CREATE, UPDATE OR DELETE COUNTERPART, and adding one is not a schema
 * change. Library content is a repository change under
 * hidden-works-content-rules.md §"Change control"; no row of
 * technical/openapi/scope-v0.1.csv writes this table and 0041 deliberately
 * creates no such operation.
 */
export const GET = queryRoute(async (a) => {
  const workspaceId = a.params.workspaceId;
  if (!workspaceId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Робочий простір не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }

  const ctx = { actorUserId: a.userId, organizationId: workspaceId, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx): Promise<RequirementLibraryListResponse> => {
    await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);

    const r = await tx.query(
      `select id, source_standard, position_code, position_title_uk, item_no,
              item_text_uk, normative_character, verification, source_citation,
              act_form_assumption, act_form_basis
         from public.requirement_library_items
        where workspace_id = $1
        order by position_code, item_no`,
      [workspaceId]);
    // Ordered by position then item number, because the order IS part of the
    // content: Н.14 items 1..5 and Н.15 items 1..7 are the standard's own
    // sequence, and a list rendered in insertion order would present the
    // standard rearranged.

    // NO PAGINATION AND NO FILTER PARAMETER. The set is twelve rows, fixed by
    // the allow-list, and it is not extensible by any operation — a page
    // parameter would imply a set that grows. A caller that wants one position
    // filters the twelve it was given.

    // The parse is the enforcement described in the header. Every field goes
    // through it, including the two the content rules are about.
    return requirementLibraryListResponse.parse({
      items: (r.rows as LibraryItemRow[]).map(libraryItemView),
    });
  });
  return { status: 200, body };
});
