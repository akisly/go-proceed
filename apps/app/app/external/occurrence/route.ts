import {
  externalOccurrenceScopeResponse, EXTERNAL_ASSURANCE_LABEL,
} from "@goproceed/contracts";
import { withExternalTx } from "@goproceed/database";
import { externalQueryRoute, invalidLink } from "../../../src/lib/external-session";
import {
  EXTERNAL_CONFIRMATION_TEXT, EXTERNAL_CONFIRMATION_TEXT_VERSION,
  EXTERNAL_LEVEL_STATEMENT, EXTERNAL_NOT_A_SIGNATURE,
} from "../../../src/lib/external-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `external.occurrence_scope` — GET /external/occurrence
 * (technical/openapi/scope-v0.1.csv:57; query, natural idempotency, EXTERNAL
 * plane, governed by `external.view_scope` — capabilities.csv:37).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE PATH CARRIES NO IDENTIFIER, AND THAT IS THE DESIGN.
 *
 * `/external/occurrence` — not `/external/occurrences/{id}`. There is nothing
 * for the client to name, because the session already names it: the occurrence
 * is `app.external_session_occurrence()`, resolved server-side from the grant
 * the token was exchanged for. A path parameter would be a value the reviewer
 * could edit, and every one of the three refusals it would then need
 * («is it in the grant's scope», «is it in the grant's workspace», «does it
 * exist») is a refusal that can be got wrong. INV-056's «never widens to a
 * second target» is satisfied by there being no way to ask for one.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHAT IS UNREACHABLE FROM HERE, and not merely unselected: `public.work_items`
 * (the price), `public.work_assignments`, `public.work_stages`,
 * `public.stage_closures`, `public.projects`, `public.contracts`,
 * `public.valuation_allocations`, `public.progress_entries` and every other
 * table in the database. RLS with no matching policy denies, and the reviewer
 * HAS NO PRICED SCOPE IN VIEW — which is why ADR-005 decision 9 can say an
 * occurrence-scoped session cannot submit a commercial decision without relying
 * on a command to refuse one.
 *
 * THE COUNT, CORRECTED — 2026-08-08. This header used to say «migration 0049
 * §10 gives the external session a policy on five tables and no others». Five
 * was wrong and had never been counted against the migration: §10 creates
 * SIXTEEN external policies over TEN tables. EIGHT of those tables are readable
 * from this plane — `requirement_occurrences`, `upload_intents`,
 * `evidence_objects`, `requirement_evidence_decisions`,
 * `requirement_evidence_decision_heads`, `external_access_grants`,
 * `external_sessions`, `external_decision_batches`, each narrowed to this
 * session's own row or this occurrence's own rows — and two,
 * `public.audit_events` and `public.transaction_outbox`, carry an INSERT policy
 * and no read (0006:29 revokes SELECT on audit_events from `aktflow_app`
 * outright, and 0003:64 grants the outbox INSERT only). The conclusion the
 * paragraph above draws is unchanged by the correction; the number is now
 * asserted rather than asserted about, by `packages/testing/src/m5-external-rls.test.ts`,
 * which sweeps every base table in `public` from a live external session instead
 * of trusting a sentence. The migration's own header carries the same stale
 * count («the eight other *_external_* policies §10 creates», 0049:31-32) and
 * that file is not this slice's to edit; it is reported.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RESPONSE IS PARSED, NOT ASSEMBLED.
 *
 * `externalOccurrenceScopeResponse.parse` runs at the boundary, exactly as M2
 * does for `requirement_occurrences.list` and for the same reason: this payload
 * carries ДБН text with a verification tag and a source, and INV-073's rendering
 * half says a normative string without both is unrenderable. The zod object
 * makes «tag and source travel with the string» a shape rather than a habit — a
 * `normRef` missing either does not serialize.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE LARGEST FUNCTIONAL GAP THIS MILESTONE LEAVES, STATED HERE BECAUSE THIS IS
 * WHERE IT BITES.
 *
 * The plan's M5 acceptance walk says the технагляд «reads the requirement in the
 * standard's own wording WITH THE PHOTO». This returns the requirement in the
 * standard's own wording, and the photo's identity, size, media type, SHA-256
 * and provenance — not the photo. `technical/openapi/scope-v0.1.csv` contains no
 * operation that streams an evidence original to an external session, and one is
 * not invented here: tenancy-and-security.md §"Storage RLS" says such a session
 * receives «only the evidence objects linked to that one occurrence» and «no
 * Storage credential or general storage.objects grant», which describes a
 * same-origin authorized stream that this milestone has no row in the API
 * surface for. A reviewer who cannot see the photo will not accept, and that is
 * the acceptance walk failing for a buildable reason. It is reported rather than
 * closed with a seventh operation nobody catalogued.
 *
 * A SECOND GAP OF THE SAME KIND: the response identifies the OBLIGATION and not
 * the OBJECT. No project name, no address, no contract number, because the
 * grant «grants no workspace navigation, project discovery» and those rows are
 * unreachable. Whether a технагляд supervising three sites can act on a link
 * that does not say which site it is about is a PILOT FINDING TO RECORD, and it
 * is not answered by adding a field to this response — it is answered by
 * deciding what an occurrence-scoped grant is allowed to disclose.
 *
 * NOTHING HERE WAS EXECUTED.
 */
export const GET = externalQueryRoute(async (a) => {
  const body = await withExternalTx(
    { organizationId: a.scope.workspaceId, requestId: a.requestId,
      externalSessionId: a.scope.sessionId },
    async (tx) => {
      // No `where id = $1`. `ro_external_select` admits exactly one row of this
      // table for this session, so «the occurrence» is a table scan of one. The
      // id is asserted below rather than filtered on, so a policy that ever
      // widened would fail this route loudly instead of silently returning a
      // sibling.
      const occ = await tx.query(
        `select id, ordinal, stage_key, stage_is_concealed, intervention_type,
                blocking_scope, timing, evidence_kind, acceptance_criterion,
                performer_role, approver_role, min_evidence_count, max_evidence_count,
                norm_ref, norm_ref_verification, norm_ref_source
           from public.requirement_occurrences`);
      // ── ZERO IS A REFUSAL; ANYTHING ELSE WRONG IS A DEFECT — 2026-08-08 ──
      //
      // WHAT WAS TRUE UNTIL THIS DATE: both branches threw a bare Error, and
      // the comment called that «the same generic invalid-link response every
      // other failure on this plane produces». It was not. A bare Error is a
      // 500 with no code from `toProblemResponse`, and every other refusal on
      // this plane is a 404 `EXTERNAL_SHARE_INVALID` — so the ONE case that
      // reaches it in normal operation surfaced as a server error.
      //
      // WHAT REACHES IT IN NORMAL OPERATION: a revoke, an expiry crossing or a
      // rotation landing between the resolve transaction (which routed this
      // request) and this statement. `external-session.ts` already says the
      // resolution «is a routing decision, never an authorization one» and that
      // the statement-time re-check inside `app.external_session_scope()` is
      // what decides — this is that re-check deciding, and its answer is
      // «this link is no longer valid».
      //
      // MORE THAN ONE ROW, OR ONE ROW THAT IS NOT THE GRANTED ONE, IS STILL AN
      // ERROR. That is `ro_external_select` having widened, which no refusal
      // message should absorb. The two cases are separated rather than merged,
      // because merging them would have made a policy regression look like an
      // expired link.
      if (occ.rows.length === 0) throw invalidLink(a.requestId);
      if (occ.rows.length !== 1 || occ.rows[0].id !== a.scope.occurrenceId) {
        throw new Error(
          `external scope resolved ${occ.rows.length} occurrences for one session`);
      }
      const o = occ.rows[0];

      const evidence = await tx.query(
        `select eo.id, eo.media_type, eo.byte_size::text as byte_size, eo.content_hash,
                eo.original_filename, eo.origin_method, eo.capture_time_trust,
                eo.claimed_capture_time, eo.server_received_at
           from public.evidence_objects eo
          order by eo.server_received_at, eo.id`);

      // The lineage the reviewer is about to append to. The head and the fact it
      // points at, in one read, exactly as the member plane does it — «current»
      // means the head and never the newest row, because a superseded decision
      // satisfies nothing (0045 §4).
      const head = await tx.query(
        `select h.version, h.current_outcome, d.decision_no, d.decided_at,
                d.external_access_grant_id
           from public.requirement_evidence_decision_heads h
           left join public.requirement_evidence_decisions d
             on d.workspace_id = h.workspace_id and d.id = h.current_decision_id`);

      const decisionRow = head.rows[0];
      return externalOccurrenceScopeResponse.parse({
        occurrence: {
          requirementOccurrenceId: o.id,
          ordinal: Number(o.ordinal),
          stageKey: o.stage_key,
          stageIsConcealed: o.stage_is_concealed ?? null,
          interventionType: o.intervention_type,
          blockingScope: o.blocking_scope,
          timing: o.timing,
          evidenceKind: o.evidence_kind,
          acceptanceCriterion: o.acceptance_criterion,
          performerRole: o.performer_role,
          approverRole: o.approver_role,
          minEvidenceCount: Number(o.min_evidence_count),
          maxEvidenceCount: o.max_evidence_count === null ? null : Number(o.max_evidence_count),
          // The three fields travel together or not at all.
          // `requirement_occurrences_norm_ref_sourced_check` says the same in
          // storage; this is the wire half of INV-073.
          normRef: o.norm_ref === null ? null : {
            text: o.norm_ref,
            verification: o.norm_ref_verification,
            source: o.norm_ref_source,
          },
        },
        evidence: evidence.rows.map((e: Record<string, unknown>) => ({
          evidenceObjectId: e.id,
          mediaType: e.media_type,
          byteSize: Number(e.byte_size),
          contentHash: e.content_hash,
          originalFilename: (e.original_filename as string | null) ?? null,
          originMethod: e.origin_method,
          captureTimeTrust: e.capture_time_trust,
          claimedCaptureTime: e.claimed_capture_time
            ? new Date(e.claimed_capture_time as string).toISOString() : null,
          serverReceivedAt: new Date(e.server_received_at as string).toISOString(),
        })),
        decision: decisionRow === undefined || decisionRow.current_outcome === null ? null : {
          headVersion: Number(decisionRow.version),
          currentOutcome: decisionRow.current_outcome,
          decisionNo: Number(decisionRow.decision_no),
          decidedAt: new Date(decisionRow.decided_at).toISOString(),
          byThisGrant: decisionRow.external_access_grant_id === a.scope.grantId,
        },
        permissions: { mayDecide: a.scope.mayDecide },
        assurance: {
          label: EXTERNAL_ASSURANCE_LABEL,
          levelStatement: EXTERNAL_LEVEL_STATEMENT,
          notASignature: EXTERNAL_NOT_A_SIGNATURE,
        },
        confirmationTextVersion: EXTERNAL_CONFIRMATION_TEXT_VERSION,
        confirmationText: EXTERNAL_CONFIRMATION_TEXT,
        session: {
          idleExpiresAt: a.scope.idleExpiresAt.toISOString(),
          absoluteExpiresAt: a.scope.absoluteExpiresAt.toISOString(),
        },
      });
    });

  return { status: 200, body };
});
