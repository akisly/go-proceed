import { randomUUID } from "node:crypto";
import {
  submitExternalOccurrenceDecisionRequest, EXTERNAL_ASSURANCE_LABEL, problem,
  type SubmitExternalOccurrenceDecisionResponse,
} from "@goproceed/contracts";
import { withExternalTx, recordAudit, enqueueOutbox } from "@goproceed/database";
import { HttpProblem } from "../../../src/lib/http";
import {
  externalCommandRoute, invalidLink, rotateExternalSession,
} from "../../../src/lib/external-session";
import { lockOccurrenceLineage } from "../../../src/lib/readiness";
import {
  EXTERNAL_CONFIRMATION_TEXT_VERSION, externalSessionCookie, newSecret, receiptHash,
} from "../../../src/lib/external-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `external.occurrence_decision_submit` — POST /external/occurrence-decisions
 * (technical/openapi/scope-v0.1.csv:58; command, idempotency required, EXTERNAL
 * plane, governed by `external.decide_evidence` — capabilities.csv:39).
 *
 * The технагляд's own decision, taken with no account, on ONE requirement
 * occurrence, and it moves no money (ADR-005 decision 9, INV-075 first half).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS ROUTE WRITES, IN ORDER, AND WHY THE ORDER IS NOT NEGOTIABLE
 *
 *   1. the receipt              `public.external_decision_batches`
 *   2. the fact                 `public.requirement_evidence_decisions`
 *   3. the head                 `public.requirement_evidence_decision_heads`
 *   4. audit + outbox
 *   5. THE SESSION ROTATION, LAST
 *
 * (1) before (2) because `requirement_evidence_decisions_batch_fkey` points that
 * way — the receipt is what carries the confirmation-text version and the
 * idempotency record, which is why `external_decision_batches` was moved into
 * v0.1 by the owner amendment of 2026-08-06 (entity-catalog.csv:69).
 *
 * (5) LAST, AND THIS IS A TRAP WORTH NAMING. Rotation marks the current session
 * `revoked`, and every external RLS policy in this database resolves through
 * `app.external_session_scope()`, which requires `s.status = 'active'`. The
 * instant the rotation's UPDATE commits inside this transaction, THE SESSION GUC
 * STOPS RESOLVING: `app.external_session_occurrence()` returns NULL,
 * `app.external_session_workspace()` returns NULL, and any further insert into
 * an audit row, an outbox row, a decision or a head is refused by its policy.
 * A future edit that moves any write below the rotation will fail with a policy
 * violation that says nothing about rotation. It is written here so that reader
 * does not have to find out.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * INV-007 WITHOUT `public.idempotency_records`
 *
 * `withIdempotency` cannot be used on this plane: `0006:50-59` scopes that
 * table's policies to `actor_scope = 'user:' || app.current_actor()`, and there
 * is no actor. The batch IS the idempotency record — its
 * `(workspace_id, external_access_grant_id, idempotency_key)` key and its
 * `request_hash` are exactly the two halves the invariant names — and the replay
 * below reconstructs the receipt from the stored rows rather than from a stored
 * response body. That is strictly better than a stored body for one reason worth
 * stating: a stored body would have to contain the rotated CSRF token, and a
 * replay would then hand out a token for a session that has already rotated.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * INV-007'S REPLAY IS UNREACHABLE, AND THE UNIQUE KEY UNDER IT IS NOT
 * — recorded 2026-08-08, still open
 *
 * WHAT IS TRUE. `external_decision_batches_idempotency_key` is unique over
 * (workspace, grant, key) and `packages/testing/src/m5-external-schema.test.ts`
 * proves the SECOND write is refused by the database. A same-key retry can
 * therefore never record a second decision. That much of INV-007 holds, in
 * storage, where it cannot be forgotten.
 *
 * WHAT IS NOT TRUE, AND USED TO BE CLAIMED BY OMISSION: that a retry gets the
 * receipt back. It does not, and cannot, while step (5) below rotates the
 * session:
 *
 *   * a retry carrying the ORIGINAL cookie dies in `resolveExternalSession` —
 *     the rotation marked that session `revoked`, so `app.resolve_external_
 *     session` returns no row and the wrapper answers 404 before this handler
 *     is entered at all;
 *   * a retry carrying the ROTATED cookie (a browser applies `Set-Cookie` from
 *     a response whose body it then fails to read) resolves, reaches the replay
 *     read below — and reads nothing, because `edb_external_select` is
 *     `external_session_id = app.current_external_session()` and the batch names
 *     the PREDECESSOR session. It then falls through to the write path and is
 *     refused by the head-version check with 409 `VERSION_CONFLICT`.
 *
 * So the reviewer who loses the response is told the link is dead, or that
 * somebody else decided, while their decision is recorded. Double-deciding is
 * prevented — by the head version and the unique key, not by idempotency.
 *
 * WHAT IT WOULD TAKE. `edb_external_select` must follow the rotation lineage:
 * a session may read the batches of the session it rotated from, transitively,
 * through `rotated_from_session_id` — which is already stored, already unique
 * per predecessor (`external_sessions_rotation_key`), and already the thing
 * that makes «one live session per grant» true. That is a POLICY, therefore
 * behaviour, therefore migration 0051 and not an edit to 0049; this slice does
 * not own the migrations and does not write it. `red_external_select` is
 * already occurrence-scoped and needs nothing. The replay branch below is
 * written to be correct on the day that lands, and is dead until it does.
 *
 * WHAT STANDS IN ITS PLACE MEANWHILE, and it is a mitigation and not a fix: the
 * shell offers «Перевірити стан», a GET of `external.occurrence_scope` whose
 * `decision.byThisGrant` tells the reviewer whether the head was written
 * through their own link (`review/route.ts` §"A reload no longer kills the
 * page").
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * INV-031 IS CHECKED IN THREE PLACES AND THIS IS THE LEAST IMPORTANT OF THEM.
 *
 * Here: `a.scope.mayDecide` is false for an observer and the request is a 403.
 * In RLS: `edb_external_insert` and `red_external_insert` both call
 * `app.external_session_may_decide()`. In storage:
 * `external_decision_batches.grant_decides_evidence` is CHECKed true and foreign
 * keyed onto the grant's own `decides_evidence`, so an observer's receipt is
 * unstorable. A rewrite of this file cannot reintroduce the hole.
 *
 * NOTHING HERE WAS EXECUTED.
 */
export const POST = externalCommandRoute(
  submitExternalOccurrenceDecisionRequest, async (a) => {
    const scope = a.scope;

    const denied = new HttpProblem(403, problem("SCOPE_DENIED",
      "Це посилання надано лише для перегляду.",
      { requestId: a.requestId, retryable: false, userAction: "request_scope" }));
    const conflict = (detail: string) => new HttpProblem(409, problem("VERSION_CONFLICT",
      detail, { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));

    // ── INV-031, layer one ──────────────────────────────────────────────────
    if (!scope.mayDecide) throw denied;

    // ── the wording they submitted under ────────────────────────────────────
    // A receipt that says «they agreed» and cannot say to what is not a receipt.
    // `EXTERNAL_CONFIRMATION_TEXT_VERSION` carries a digest of the three strings
    // inside it, so this comparison fails the moment the wording changes — which
    // is exactly when a submit taken against the old wording must not be
    // recorded as if it were taken against the new one.
    if (a.body.confirmationTextVersion !== EXTERNAL_CONFIRMATION_TEXT_VERSION) {
      throw conflict("Текст підтвердження оновився. Оновіть сторінку і повторіть.");
    }

    // The new session's secrets, generated before the transaction so the
    // rotation at the end has nothing left to fail on.
    const nextSessionValue = newSecret();
    const nextCsrfValue = newSecret();

    const result = await withExternalTx(
      { organizationId: scope.workspaceId, requestId: a.requestId,
        externalSessionId: scope.sessionId },
      async (tx) => {
        const ctx = {
          actorUserId: "", organizationId: scope.workspaceId, requestId: a.requestId,
        };

        // ── INV-007, the replay read ────────────────────────────────────────
        // Before the lock, because a replay must not queue behind a live submit
        // on the same lineage: the answer is already written.
        const prior = await tx.query(
          `select b.id, b.receipt_id, b.receipt_hash, b.request_hash,
                  b.server_received_at, b.confirmation_text_version,
                  d.id as decision_id, d.outcome, d.decision_no,
                  d.superseded_decision_id, d.decided_at, d.approver_role
             from public.external_decision_batches b
             left join public.requirement_evidence_decisions d
               on d.workspace_id = b.workspace_id and d.decision_batch_id = b.id
            where b.workspace_id = $1 and b.external_access_grant_id = $2
              and b.idempotency_key = $3`,
          [scope.workspaceId, scope.grantId, a.idempotencyKey]);

        if (prior.rows.length > 0) {
          const p = prior.rows[0];
          if (p.request_hash !== a.requestHash) {
            // The same code `toProblemResponse` produces for the member plane's
            // IdempotencyConflictError, produced directly because this plane
            // does not go through `withIdempotency`.
            throw new HttpProblem(409, problem("IDEMPOTENCY_CONFLICT",
              "Той самий Idempotency-Key використано з іншим тілом запиту.",
              { requestId: a.requestId, retryable: false,
                userAction: "new_key_or_reuse_original" }));
          }
          // THE HEAD OF THE LINEAGE THIS RECEIPT BELONGS TO — 2026-08-08.
          //
          // What this read used to be: `select version from
          // public.requirement_evidence_decision_heads` with no predicate and
          // `Number(head.rows[0]?.version ?? 1)` under it. Two defects in one
          // line. The table is keyed by (occurrence, approver_role) and the
          // external policy narrows it to the occurrence only, so a second
          // approver role on the same obligation — which v0.2's multi-role
          // review makes ordinary — would have returned an arbitrary row. And
          // the `?? 1` FABRICATED a version: a replay that found no head would
          // have told the caller «version 1», which is a number the client then
          // sends back as `expectedVersion`. A decision exists (this branch read
          // it), so its head exists; if it does not, the lineage is broken and
          // this must say so rather than invent a number for it.
          //
          // DEV-085 (BL-182 S2): the lineage is named by its workspace and
          // occurrence too, as the member route names it, so the statement does
          // not lean on RLS for what it reads — this is the internet-facing
          // plane.
          const head = await tx.query(
            `select version from public.requirement_evidence_decision_heads
              where workspace_id = $1 and requirement_occurrence_id = $2 and approver_role = $3`,
            [scope.workspaceId, scope.occurrenceId, p.approver_role as string]);
          if (head.rows.length !== 1) {
            throw new Error(
              `replayed receipt ${p.receipt_id} has ${head.rows.length} heads for role `
              + `${p.approver_role}`);
          }
          return {
            replayed: true as const,
            body: {
              receiptId: p.receipt_id as string,
              receiptHash: (p.receipt_hash as Buffer).toString("hex"),
              decisionBatchId: p.id as string,
              decisionId: p.decision_id as string,
              requirementOccurrenceId: scope.occurrenceId,
              approverRole: p.approver_role as string,
              outcome: p.outcome as "accepted" | "returned",
              decisionNo: Number(p.decision_no),
              supersededDecisionId: (p.superseded_decision_id as string | null) ?? null,
              headVersion: Number(head.rows[0].version),
              decidedAt: new Date(p.decided_at as string).toISOString(),
              serverReceivedAt: new Date(p.server_received_at as string).toISOString(),
              confirmationTextVersion: p.confirmation_text_version as string,
              assuranceLabel: EXTERNAL_ASSURANCE_LABEL,
              occurrenceSatisfied: p.outcome === "accepted",
            },
          };
        }

        // ── serialize the lineage ───────────────────────────────────────────
        // The SAME advisory lock the member plane's `evidence_decisions.create`
        // takes (`apps/app/src/lib/readiness.ts`), on the same key, so an
        // internal decision and an external one on one occurrence cannot
        // interleave. An advisory lock and not `select … for update`: PostgreSQL
        // applies a table's UPDATE policies to `FOR UPDATE`, and the two planes
        // hold different ones, so a row lock would hand one of them an empty
        // result instead of a lock.
        await lockOccurrenceLineage(tx, scope.workspaceId, [scope.occurrenceId]);

        // The occurrence, read under the lock, through the one-row policy.
        const occ = await tx.query(
          `select id, project_id, approver_role, intervention_type
             from public.requirement_occurrences`);
        // Zero rows is a REFUSAL and not a defect, for the reasons written out
        // at the same statement in `occurrence/route.ts` — a revoke, an expiry
        // crossing or a rotation landing between the routing read and this
        // one. Until 2026-08-08 both branches threw a bare Error, which made
        // the ordinary case a 500 on a plane where every other refusal is a 404
        // `EXTERNAL_SHARE_INVALID`. A wider result is still an error, because
        // that is `ro_external_select` having widened.
        if (occ.rows.length === 0) throw invalidLink(a.requestId);
        if (occ.rows.length !== 1 || occ.rows[0].id !== scope.occurrenceId) {
          throw new Error(
            `external scope resolved ${occ.rows.length} occurrences for one session`);
        }
        const projectId: string = occ.rows[0].project_id;
        // PINNED FROM THE OCCURRENCE, never from the grant and never from the
        // wire. The grant's `recipient_role` was already forced to equal this at
        // issue (`external_access_grants_decide_role_fkey`); reading it here
        // rather than there means the decision's role comes from the obligation
        // even if a future slice loosened the grant.
        const approverRole: string = occ.rows[0].approver_role;
        const interventionType: string = occ.rows[0].intervention_type;

        const headRow = await tx.query(
          `select h.version, h.current_decision_id, h.current_outcome, d.decision_no
             from public.requirement_evidence_decision_heads h
             left join public.requirement_evidence_decisions d
               on d.workspace_id = h.workspace_id and d.id = h.current_decision_id
            where h.workspace_id = $1 and h.requirement_occurrence_id = $2 and h.approver_role = $3`,
          [scope.workspaceId, scope.occurrenceId, approverRole]);
        const head = headRow.rows[0] as
          | { version: string | number; current_decision_id: string | null;
              current_outcome: string | null; decision_no: string | number | null }
          | undefined;
        const headVersion = head ? Number(head.version) : null;
        if (a.body.expectedVersion !== headVersion) {
          throw conflict(headVersion === null
            ? "Щодо цієї вимоги ще немає рішень; оновіть сторінку."
            : `Рішення щодо цієї вимоги змінилися (поточна версія ${headVersion}).`);
        }

        const now = await tx.query("select now() as t");
        const serverReceivedAt = new Date(now.rows[0].t as string);
        const decisionNo = head ? Number(head.decision_no) + 1 : 1;
        const batchId = randomUUID();
        const decisionId = randomUUID();
        const receiptId = randomUUID();

        // ── 1. the receipt ──────────────────────────────────────────────────
        // The hash is over a FLAT, key-sorted object and is not keyed: a keyed
        // digest is one property away from a signature, and level 3 must not
        // produce anything that looks like one.
        const hash = receiptHash({
          receiptId, decisionBatchId: batchId, decisionId,
          workspaceId: scope.workspaceId, projectId,
          requirementOccurrenceId: scope.occurrenceId,
          externalAccessGrantId: scope.grantId, externalSessionId: scope.sessionId,
          approverRole, outcome: a.body.outcome, decisionNo,
          confirmationTextVersion: a.body.confirmationTextVersion,
          serverReceivedAt: serverReceivedAt.toISOString(),
          requestHash: a.requestHash,
          assuranceLabel: EXTERNAL_ASSURANCE_LABEL,
        });

        await tx.query(
          `insert into public.external_decision_batches
             (id, workspace_id, project_id, requirement_occurrence_id,
              external_access_grant_id, external_session_id, reviewer_claims,
              confirmation_text_version, submitted_at, server_received_at,
              idempotency_key, request_hash, receipt_id, receipt_hash)
           values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$9,$10,$11,$12,$13)`,
          [batchId, scope.workspaceId, projectId, scope.occurrenceId,
           scope.grantId, scope.sessionId, JSON.stringify(a.body.reviewerClaims),
           a.body.confirmationTextVersion, serverReceivedAt,
           a.idempotencyKey, a.requestHash, receiptId, hash]);

        // ── 2. the fact ─────────────────────────────────────────────────────
        // `decided_by_member_id` is NULL and the three external columns are set:
        // `requirement_evidence_decisions_authority_check` (0045 §4) admits
        // exactly one deciding authority, never both and never neither, and
        // `requirement_evidence_decisions_assurance_check` requires
        // LINK_CONFIRMATION beside an external session and forbids it elsewhere.
        // Until migration 0049 §6 this insert was unstorable by construction.
        const inserted = await tx.query(
          `insert into public.requirement_evidence_decisions
             (id, workspace_id, project_id, requirement_occurrence_id, approver_role,
              outcome, decision_no, superseded_decision_id, superseded_decision_no,
              decided_by_member_id, external_session_id, external_access_grant_id,
              decision_batch_id, assurance_label, reason, issues,
              idempotency_key, request_hash)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,null,$10,$11,$12,$13,$14,$15::jsonb,$16,$17)
           returning decided_at`,
          [decisionId, scope.workspaceId, projectId, scope.occurrenceId, approverRole,
           a.body.outcome, decisionNo,
           head?.current_decision_id ?? null,
           head ? Number(head.decision_no) : null,
           scope.sessionId, scope.grantId, batchId, EXTERNAL_ASSURANCE_LABEL,
           a.body.reason ?? null, JSON.stringify(a.body.issues),
           a.idempotencyKey, a.requestHash]);
        const decidedAt = new Date(inserted.rows[0].decided_at as string).toISOString();

        // ── 3. the head ─────────────────────────────────────────────────────
        if (head) {
          const advanced = await tx.query(
            `update public.requirement_evidence_decision_heads
                set current_decision_id = $4, current_outcome = $5,
                    version = version + 1, updated_at = now()
              where workspace_id = $1 and requirement_occurrence_id = $2
                and approver_role = $3 and version = $6
              returning version`,
            [scope.workspaceId, scope.occurrenceId, approverRole, decisionId, a.body.outcome, headVersion]);
          if (advanced.rows.length === 0) {
            throw conflict("Рішення щодо цієї вимоги щойно змінилися.");
          }
        } else {
          await tx.query(
            `insert into public.requirement_evidence_decision_heads
               (workspace_id, project_id, requirement_occurrence_id, approver_role,
                current_decision_id, current_outcome)
             values ($1,$2,$3,$4,$5,$6)`,
            [scope.workspaceId, projectId, scope.occurrenceId, approverRole,
             decisionId, a.body.outcome]);
        }

        // ── 4. audit and outbox ─────────────────────────────────────────────
        // `actorType: "external"` and no user id. `audit_insert_external`
        // (migration 0049 §10) is the only policy that admits this row, and it
        // requires both — plus that the organization is THIS SESSION'S
        // workspace, so an external command cannot audit into another tenant.
        await recordAudit(tx, ctx, {
          action: "requirement_evidence_decision.recorded",
          object_type: "requirement_occurrence", object_id: scope.occurrenceId,
          details: {
            decisionId, decisionBatchId: batchId, receiptId,
            approverRole, outcome: a.body.outcome, decisionNo,
            supersededDecisionId: head?.current_decision_id ?? null,
            externalAccessGrantId: scope.grantId, externalSessionId: scope.sessionId,
            assuranceLabel: EXTERNAL_ASSURANCE_LABEL,
            confirmationTextVersion: a.body.confirmationTextVersion,
            // The claims, recorded AS CLAIMS. They are what the reviewer said
            // about themselves and the audit row is where that belongs; nothing
            // downstream may read them as identity.
            reviewerClaims: a.body.reviewerClaims,
          },
        }, { organizationId: scope.workspaceId, actorType: "external" });

        // event-catalog.csv:22 names `bff.external.occurrence_decision_submit` as
        // the second producer of this topic — the member plane's
        // `evidence_decisions.create` is the first, and the payload shape is the
        // same one it emits so a future consumer has one shape to handle.
        await enqueueOutbox(tx, ctx, {
          topic: "requirement_evidence_decision.recorded",
          aggregate_type: "requirement_occurrence", aggregate_id: scope.occurrenceId,
          payload_version: 1,
          payload: {
            workspaceId: scope.workspaceId, projectId,
            requirementOccurrenceId: scope.occurrenceId, decisionId,
            approverRole, outcome: a.body.outcome, decisionNo,
            assuranceLabel: EXTERNAL_ASSURANCE_LABEL,
          },
        }, { organizationId: scope.workspaceId });

        // event-catalog.csv:35 — `external_decision_batch.recorded`, v0.1-M5,
        // aggregate `external_decision_batch`, v0.1 write path
        // `bff.external.occurrence_decision_submit`.
        await enqueueOutbox(tx, ctx, {
          topic: "external_decision_batch.recorded",
          aggregate_type: "external_decision_batch", aggregate_id: batchId,
          payload_version: 1,
          payload: {
            workspaceId: scope.workspaceId, projectId,
            requirementOccurrenceId: scope.occurrenceId,
            externalAccessGrantId: scope.grantId, decisionBatchId: batchId,
            receiptId, outcome: a.body.outcome,
            confirmationTextVersion: a.body.confirmationTextVersion,
          },
        }, { organizationId: scope.workspaceId });

        // ── 5. rotation, and NOTHING AFTER IT ───────────────────────────────
        await rotateExternalSession(tx, scope, nextSessionValue, nextCsrfValue);

        return {
          replayed: false as const,
          body: {
            receiptId, receiptHash: hash.toString("hex"), decisionBatchId: batchId,
            decisionId, requirementOccurrenceId: scope.occurrenceId, approverRole,
            outcome: a.body.outcome, decisionNo,
            supersededDecisionId: head?.current_decision_id ?? null,
            headVersion: (headVersion ?? 0) + 1,
            decidedAt, serverReceivedAt: serverReceivedAt.toISOString(),
            confirmationTextVersion: a.body.confirmationTextVersion,
            assuranceLabel: EXTERNAL_ASSURANCE_LABEL,
            // ONLY THE DECISION DISJUNCT, and the limit is real. `satisfied(o)`
            // has two disjuncts (readiness.ts) and the second is a waiver or an
            // accepted risk on `requirement_exception_heads` — a table the
            // external session has NO POLICY ON, deliberately: whether the crew
            // waived their own requirement is not in the granted scope. So this
            // reports what this decision did and not the full predicate. The
            // closure command re-evaluates the whole of it under the stage lock
            // (INV-061), and it is the only answer that decides anything.
            occurrenceSatisfied:
              interventionType === "hold" && a.body.outcome === "accepted",
          },
        };
      });

    // The rotated session's cookie and token. On a REPLAY nothing rotated, so
    // the caller keeps the CSRF token it already has — returning a new one for a
    // session that did not rotate would break the next request.
    if (result.replayed) {
      // No `csrfToken` and no `Set-Cookie`: nothing rotated, so the caller keeps
      // what it has. Returning a token for a rotation that did not happen would
      // break its next request, and returning a placeholder would be a value a
      // client could try to present — `requireCsrfAndOrigin` demands 43
      // base64url characters, so the field being ABSENT is the only shape that
      // cannot be mistaken for a token.
      const body: SubmitExternalOccurrenceDecisionResponse = result.body;
      return { status: 200, body };
    }
    const body: SubmitExternalOccurrenceDecisionResponse = {
      ...result.body, csrfToken: nextCsrfValue,
    };
    return { status: 201, body, setCookie: externalSessionCookie(nextSessionValue) };
  });
