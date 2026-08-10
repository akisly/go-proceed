import { queryRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { actRenderBlockedDetails } from "@goproceed/contracts";
import { withTenantTx } from "@goproceed/database";
import { loadActVersionView, locateActVersion } from "../../../../../src/lib/statutory-act";
import { findFormTemplate, renderStatutoryAct } from "../../../../../src/lib/statutory-act-form";

export const runtime = "nodejs";

/**
 * `statutory_acts.render` — GET /v1/statutory-act-versions/{actVersionId}/render
 * (technical/openapi/scope-v0.1.csv:52; query, natural idempotency, member
 * plane, governed by `statutory_acts.compose`).
 *
 * THIS IS THE ONLY ARTIFACT SURFACE v0.1 HAS. Package artifacts are v0.2, so
 * without this route the milestone produces a row rather than a document
 * (version-0.1.md §v0.1-M4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IN v0.1 IT REFUSES, AND THE REFUSAL IS THE HONEST ANSWER
 *
 * Two preconditions this repository records as open are unmet, and neither is
 * this route's to fix:
 *
 *   `dodatok_v_field_list_not_committed` — hidden-works-content-rules.md
 *     allow-list item 3 licenses «every field of В.1 and В.2, in the standard's
 *     order»; docs/delivery/test-strategy.md:139-152 records that NO SUCH
 *     ENUMERATION EXISTS IN THIS REPOSITORY and that no test may substitute a
 *     field list typed from memory. A renderer is worse than a fixture: a
 *     caption typed from memory here reaches a document an engineer's client's
 *     lawyer reads, and it looks decided. So the form's own fields are not laid
 *     out and the render refuses instead of inventing them.
 *
 *   `dbn_retrieval_record_absent` — every VERIFIED_PRIMARY tag rests on one ДБН
 *     download with no recorded URL, retrieval date or hash, which «leaves the
 *     tag asserted and the source gone». The plan states the consequence in
 *     terms: «M4 cannot render a VERIFIED_PRIMARY string in a customer-facing
 *     artifact until it lands»
 *     (docs/superpowers/plans/2026-08-06-v0.1-implementation.md:265). A rendered
 *     act is a customer-facing artifact by construction.
 *
 * BOTH BLOCKERS ARE DERIVED FROM ABSENT DATA, not declared. Nothing in
 * `src/lib/statutory-act-form.ts` says «M4 is blocked»; it says «there is no
 * registered field list» and «there is no retrieval record». Commit the two
 * artifacts, populate `DODATOK_V_TEMPLATE.fieldList` and `DBN_RETRIEVAL_RECORD`
 * from them, and this route renders with no other change.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT REFUSES A DRAFT TOO, AND THAT ONE IS A JUDGEMENT
 *
 * No document in this package says whether a draft may be rendered. This route
 * refuses, for three reasons: INV-015 ties the artifact to a FROZEN version; the
 * determinism promise («repeated rendering of one frozen version is
 * byte-deterministic») has no draft analogue, because a draft's content moves;
 * and a rendered act is a document to hand over, so a printable non-final one is
 * the artifact ADR-005 decision 10 exists to make impossible.
 *
 * WHAT IT COSTS, because it is a real cost: a composer cannot preview the
 * laid-out form before an irreversible freeze, and the only correction is a
 * successor version. `statutory_acts.get` returns every assembled fact, so what
 * is unavailable is the layout and not the content. Reported as a judgement.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DETERMINISM, AND WHERE IT ACTUALLY LIVES
 *
 * INV-015's byte-determinism half is a property of the renderer over frozen
 * inputs and is not a database rule. Three things make it keepable here: the
 * inputs cannot move after the freeze (two guards, migration 0047 §7); every
 * read is explicitly ordered, because `order by created_at` over rows written in
 * one transaction is not an order; and the document carries no clock — no
 * `renderedAt`, no `now()`, nothing that differs between two calls. The response
 * body is therefore byte-identical on repeated calls for one frozen version and
 * one `RENDERER_VERSION`, and `contentHash` is the value a diff can be argued
 * with rather than about.
 *
 * NOTHING HERE WAS EXECUTED: no test run, no route invoked, no render produced.
 */
export const GET = queryRoute(async (a) => {
  const actVersionId = a.params.actVersionId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Версію акта не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!actVersionId) throw notFound;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const body = await withTenantTx(ctx, async (tx) => {
    const located = await locateActVersion(tx, actVersionId);
    if (!located) throw notFound;

    const m = await requireActiveMembership(tx, a.requestId, a.userId, located.workspaceId);
    await requireProjectCapability(tx, a.requestId, {
      workspaceId: located.workspaceId, projectId: located.projectId,
      memberId: m.memberId, capability: "project.view",
    });
    await requireProjectCapability(tx, a.requestId, {
      workspaceId: located.workspaceId, projectId: located.projectId,
      memberId: m.memberId, capability: "statutory_acts.compose",
    });

    const view = await loadActVersionView(tx, located.workspaceId, actVersionId);
    if (!view) throw notFound;

    const template = findFormTemplate(view.formTemplateKey, view.formTemplateVersion);
    const rendered = renderStatutoryAct(view, template);
    if (!rendered.ok) {
      // `PACKAGE_BLOCKED` (technical/error-catalog.csv:26 — 422,
      // `resolve_listed_blockers`, log policy `counts_codes`,
      // `inline_field_error`). NO CODE IN THAT CATALOG DESCRIBES «a regulatory
      // content artifact this document needs is not committed», and one is not
      // invented here; this is the only existing code whose shape matches — a
      // non-retryable 4xx carrying a structured blocker list whose log policy is
      // counts and codes. Its catalog producer names packages, which v0.1 does
      // not have at all, so nothing collides; the catalog is owed an act-shaped
      // row and this slice reports it rather than editing the CSV.
      //
      // NO REGULATORY CONTENT TRAVELS IN `details`: each blocker carries a code,
      // a sentence about what is missing, and what closes it. Not the missing
      // captions, and not the citation that could not be printed.
      throw new HttpProblem(422, problem("PACKAGE_BLOCKED",
        `Акт не можна відтворити: не виконано умов — ${rendered.blockers.length}.`, {
          requestId: a.requestId, retryable: false, userAction: "resolve_listed_blockers",
          details: actRenderBlockedDetails.parse({
            statutoryActVersionId: actVersionId,
            actForm: view.actForm,
            formTemplateKey: view.formTemplateKey,
            formTemplateVersion: view.formTemplateVersion,
            blockerCount: rendered.blockers.length,
            blockers: rendered.blockers,
          }),
        }));
    }

    // THE STORED HASH AND THE RENDERED ONE MUST AGREE. `content_hash` was pinned
    // at the freeze over exactly this document; a later render that does not
    // reproduce it is a divergence with a nameable cause — `rendererVersion`,
    // `formTemplateHash` or the content itself — which is what those three
    // columns exist for. Serving the divergent bytes silently would make
    // INV-015's determinism clause unfalsifiable, so the render refuses and says
    // which of the three moved.
    if (view.contentHash !== null && view.contentHash !== rendered.document.contentHash) {
      // ONE ERROR CODE, ONE `details` SHAPE. docs/22-data-api-contract.md:194 —
      // «API responses never alternate between JSON error shapes» — so this
      // divergence is a blocker in the same list rather than a second payload
      // under the same code. Hashes carry no content and no regulatory string.
      throw new HttpProblem(422, problem("PACKAGE_BLOCKED",
        "Відтворення акта не збігається з зафіксованим відбитком.", {
          requestId: a.requestId, retryable: false, userAction: "resolve_listed_blockers",
          details: actRenderBlockedDetails.parse({
            statutoryActVersionId: actVersionId,
            actForm: view.actForm,
            formTemplateKey: view.formTemplateKey,
            formTemplateVersion: view.formTemplateVersion,
            blockerCount: 1,
            blockers: [{
              code: "frozen_content_hash_divergence",
              detail: `the render produced ${rendered.document.contentHash} where the freeze `
                + `pinned ${view.contentHash} (renderer ${rendered.document.rendererVersion} `
                + `against frozen ${view.rendererVersion ?? "none"}; template hash `
                + `${rendered.document.formTemplateHash} against frozen `
                + `${view.formTemplateHash ?? "none"})`,
              closedBy: "identify which of the renderer version, the form template or the "
                + "act's own content moved; a frozen act that cannot be re-derived from "
                + "its own record is what INV-015 exists to prevent",
            }],
          }),
        }));
    }

    return rendered.document;
  });
  return { status: 200, body };
});
