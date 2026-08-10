import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  actRenderBlockedDetails, freezeStatutoryActVersionRequest,
  type FreezeStatutoryActVersionResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";
import { loadActVersionView, locateActVersion } from "../../../../../src/lib/statutory-act";
import {
  RENDERER_VERSION, findFormTemplate, renderForFreeze,
} from "../../../../../src/lib/statutory-act-form";

export const runtime = "nodejs";

/**
 * `statutory_act_versions.freeze` — POST /v1/statutory-act-versions/{actVersionId}/freeze
 * (technical/openapi/scope-v0.1.csv:50; command, idempotency required, member
 * plane, governed by `statutory_acts.compose`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FREEZE PINS EVERY MATERIAL INPUT, AND «FROZEN» IS TERMINAL
 *
 * INV-015: an act version is immutable once frozen, and a correction is a
 * SUCCESSOR VERSION assembled from newly recorded facts. That is a schema rule
 * rather than a sentence — `app.guard_statutory_act_version()` rejects every
 * update whose old status is not `draft`, rejects every delete, and rejects any
 * change to identity, lineage, scope, provenance or idempotency; and
 * `app.guard_statutory_act_content()` refuses every insert, update and delete on
 * the quantity and signatory rows of a version that is no longer a draft. This
 * route is the one legal transition.
 *
 * WHAT IT PINS, in the one UPDATE below:
 *   `content_hash`       sha256 over the canonical serialisation of the rendered
 *                        document — the thing a later divergence is measured
 *                        against;
 *   `renderer_version`   the qualifier INV-015's determinism clause is written
 *                        with — «byte-deterministic FOR A GIVEN RENDERER
 *                        VERSION»;
 *   `form_template_hash` the digest of the whole template definition, so a
 *                        contributor who edits a caption without touching the
 *                        version string still moves the hash;
 *   `frozen_at`, `frozen_by_member_id`.
 * `statutory_act_versions_frozen_complete_check` requires all five plus
 * `registry_checked_on`, so a partially frozen row is unstorable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AN ACT THAT CANNOT BE RENDERED CANNOT BE FROZEN
 *
 * `content_hash` is the digest OF THE RENDER. If the render refuses, there is
 * nothing to hash, and freezing anyway would pin a hash of a document that does
 * not exist — the exact artifact INV-015's «a rendered act that cannot be
 * re-derived from its own record» exists to prevent. So this command refuses
 * with the renderer's own blocker list.
 *
 * IN v0.1 THAT REFUSAL FIRES, and it is not a defect in this route. Two
 * preconditions recorded as open in this repository are unmet:
 *   * the В.1/В.2 field list is committed nowhere
 *     (docs/delivery/test-strategy.md:139-152), so the form cannot be laid out
 *     without typing captions from memory;
 *   * the ДБН retrieval record does not exist, so «M4 cannot render a
 *     VERIFIED_PRIMARY string in a customer-facing artifact»
 *     (docs/superpowers/plans/2026-08-06-v0.1-implementation.md:265).
 * Both blockers are DERIVED from the absence of those data, so both stop being
 * produced when the data land, with no change to this route.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IDEMPOTENCY, AND WHY IT LIVES IN ONE PLACE ONLY
 *
 * The freeze writes no new row, so it has no `idempotency_key` column of its own
 * the way `statutory_acts.compose` does on the version row. Its whole idempotency
 * is `public.idempotency_records`. Migration 0047 §11 item 7 records that the
 * route slice owes either the columns or an explicit statement that the records
 * table is the whole of it; THIS IS THAT STATEMENT.
 *
 * NOTHING HERE WAS EXECUTED: no test run, no route invoked, no migration applied.
 */
export const POST = commandRoute(freezeStatutoryActVersionRequest, async (a) => {
  const actVersionId = a.params.actVersionId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Версію акта не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!actVersionId) throw notFound;

  const conflict = (detail: string) => new HttpProblem(409,
    problem("VERSION_CONFLICT", detail,
      { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const located = await locateActVersion(tx, actVersionId);
    if (!located) throw notFound;
    const { workspaceId, projectId, statutoryActId, workStageId, stageClosureId } = located;

    return withIdempotency<FreezeStatutoryActVersionResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "statutory_act_versions.freeze", key: a.idempotencyKey,
      requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "statutory_acts.compose" });

      // THE ROW LOCK. `for update` needs the UPDATE privilege migration 0047 §8
      // grants, and PostgreSQL applies `sav_update`'s USING clause to it —
      // `status = 'draft'` and the capability — so a version frozen by a
      // concurrent transaction comes back as NO ROWS rather than as a locked row
      // with the wrong status. That is why zero rows here is a conflict and not
      // a 404: the row exists, it is simply no longer freezable.
      const locked = await tx.query(
        `select status, draft_version, registry_checked_on
           from public.statutory_act_versions
          where workspace_id = $1 and id = $2 for update`,
        [workspaceId, actVersionId]);
      if (locked.rows.length === 0) {
        throw conflict("Версію акта щойно зафіксовано або змінено; оновіть дані.");
      }
      const draftVersion = Number(locked.rows[0].draft_version);
      if (locked.rows[0].status !== "draft") {
        throw conflict("Версію акта вже зафіксовано; виправлення оформлюється наступною версією.");
      }
      if (a.body.expectedDraftVersion !== draftVersion) {
        throw conflict(
          `Чернетку акта змінено (поточна версія ${draftVersion}); оновіть дані та повторіть спробу.`);
      }

      const draftView = await loadActVersionView(tx, workspaceId, actVersionId);
      if (!draftView) throw notFound;

      // THE FREEZE TIME IS READ BEFORE THE RENDER, NOT WRITTEN AFTER IT.
      //
      // Додаток В's act date binds to `frozenAt ?? composedAt`, and it carries
      // the column it came from in its provenance. Rendering the draft — where
      // `frozen_at` is still null — and only then writing `frozen_at = now()`
      // hashes a document whose date is `statutory_act_versions.composed_at`
      // and stores one whose date is `…frozen_at`. The very next call to
      // `statutory_acts.render` reads the frozen row, produces different bytes
      // and refuses with `frozen_content_hash_divergence`: EVERY act would
      // freeze successfully and then be permanently unrenderable, with the
      // renderer version and the template hash both matching so the refusal
      // names nothing that moved. Found the day the render first succeeded, by
      // the acceptance walk's «render twice and diff the bytes».
      //
      // `now()` is the TRANSACTION's timestamp in PostgreSQL and does not
      // advance inside one, so this is the same instant the UPDATE would have
      // written. It is passed to the UPDATE explicitly all the same, for the
      // reason the project name below is: the value that goes into the hash and
      // the value that goes into the column must be one value, not two that
      // happen to agree.
      const clock = await tx.query("select now() as frozen_at");
      const frozenAt = new Date(clock.rows[0].frozen_at).toISOString();
      const view = { ...draftView, frozenAt };

      const template = findFormTemplate(view.formTemplateKey, view.formTemplateVersion);
      const rendered = renderForFreeze(view, template);
      if (!rendered.ok) {
        // technical/error-catalog.csv has NO code for «a regulatory content
        // artifact this document needs is not committed», and one is not invented
        // here. `PACKAGE_BLOCKED` (row 26 — 422, `resolve_listed_blockers`, log
        // policy `counts_codes`, `inline_field_error`) is the closest existing
        // shape and the only one whose semantics match: a non-retryable 4xx
        // carrying a structured list of blockers, whose log policy is exactly
        // counts and codes and whose details carry no regulatory content. Its
        // catalog producer names packages, which v0.1 does not have at all. The
        // catalog is owed an act-shaped row; see this slice's report.
        throw new HttpProblem(422, problem("PACKAGE_BLOCKED",
          `Акт не можна зафіксувати: не виконано умов — ${rendered.blockers.length}.`, {
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

      // ONE UPDATE, AND `draft_version` ADVANCES BY EXACTLY ONE.
      // `app.guard_statutory_act_version()` requires that, which makes the
      // expected-version discipline structural: two commands that both read
      // version N cannot both write N+1. `and status = 'draft' and draft_version
      // = $N` makes the update itself the concurrency check even though the row
      // is already locked — a guard that depends on a lock taken earlier in the
      // same function stops holding when somebody moves the lock.
      // THE PROJECT'S NAME IS PINNED FROM THE VIEW THAT WAS JUST RENDERED, not
      // re-selected from `public.projects` (migration 0056). Re-reading it here
      // would open a window — however small — in which the string that goes into
      // `content_hash` and the string that goes into the column are not the same
      // string, and the divergence would only surface as a render refusal months
      // later. `view.projectName` IS the value the hash above was taken over.
      //
      // `sourceProjectVersion` is non-null on a draft (`public.projects.version`
      // is NOT NULL and the view branches on status), which is what
      // `statutory_act_versions_frozen_complete_check` requires beside the name.
      const frozen = await tx.query(
        `update public.statutory_act_versions
            set status = 'frozen', frozen_at = $11, frozen_by_member_id = $3,
                content_hash = $4, renderer_version = $5, form_template_hash = $6,
                frozen_project_name = $8, frozen_project_address = $9,
                source_project_version = $10,
                draft_version = draft_version + 1
          where workspace_id = $1 and id = $2 and status = 'draft' and draft_version = $7
          returning frozen_at, draft_version`,
        [workspaceId, actVersionId, m.memberId, rendered.document.contentHash,
         RENDERER_VERSION, rendered.document.formTemplateHash, draftVersion,
         view.projectName, view.projectAddress, view.sourceProjectVersion,
         // The instant the document above was dated with. See the note beside
         // the read: `frozen_at = now()` here would be the same value today and
         // would stop being the same value the moment anything between the read
         // and this statement opened a new transaction.
         frozenAt]);
      if (frozen.rows.length === 0) {
        throw conflict("Версію акта щойно змінено; оновіть дані та повторіть спробу.");
      }
      // `statutory_act_versions_freeze_complete` — deferred, definer — then
      // proves at COMMIT that the builder and технагляд slots are filled
      // (schema-v0.1.sql:1656-1657). Whether авторський нагляд is required is
      // NOT established: п. 8.4.3.5 names three roles and no document in this
      // package says the third is conditional (migration 0047 §11 item 8).

      const after = await loadActVersionView(tx, workspaceId, actVersionId);
      if (!after) throw notFound;

      await recordAudit(tx, ctx, {
        action: "statutory_act_version.frozen",
        object_type: "statutory_act_version", object_id: actVersionId,
        details: {
          statutoryActId, workStageId, stageClosureId,
          versionNo: after.versionNo,
          contentHash: after.contentHash,
          rendererVersion: after.rendererVersion,
          formTemplateKey: after.formTemplateKey,
          formTemplateVersion: after.formTemplateVersion,
          formTemplateHash: after.formTemplateHash,
          registryCheckedOn: after.registryCheckedOn,
        },
      }, { organizationId: workspaceId, objectVersion: after.draftVersion });

      // technical/events/event-catalog.csv:28 — `statutory_act_version.frozen`,
      // v0.1-M4, aggregate `statutory_act_version`, producer
      // `bff.statutory_act_versions.freeze`, consumer `projection_rebuilder`.
      // THE CONSUMER IS NOT DEPLOYED; the row is durable and unread until one
      // exists. `worker.artifact_renderer` consumes this event only from v0.2,
      // because `package_artifacts` is v0.2 and `statutory_acts.render` is a
      // member-plane query that renders on demand.
      //
      // INV-084 travels in the payload: in v0.1 the pin is the STAGE CLOSURE and
      // never a package version (ADR-006 decision 4.5). The v0.2 package slice
      // owes the migration that adds the additional pin to acts written during
      // the pilot, and this payload is what it will find them by.
      await enqueueOutbox(tx, ctx, {
        topic: "statutory_act_version.frozen",
        aggregate_type: "statutory_act_version", aggregate_id: actVersionId,
        payload_version: 1,
        payload: {
          workspaceId, projectId,
          statutoryActId, statutoryActVersionId: actVersionId,
          versionNo: after.versionNo,
          workStageId, stageClosureId,
          actForm: after.actForm,
          rendererVersion: after.rendererVersion,
          formTemplateKey: after.formTemplateKey,
          formTemplateVersion: after.formTemplateVersion,
          formTemplateHash: after.formTemplateHash,
          contentHash: after.contentHash,
          packageVersionId: null,
        },
      }, { organizationId: workspaceId });

      return { status: 200, body: { version: after } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
