import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  createStageClosureRequest, holdPointBlockedDetails,
  type CreateStageClosureResponse, type FrozenOccurrenceView,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit, enqueueOutbox } from "@goproceed/database";
import {
  assignmentValuations, blockedReasonFor, evaluateStage, frozenOccurrenceSetHash,
  lockOccurrenceLineage,
} from "../../../../../src/lib/readiness";
import { admitClosedStageQuantity } from "../../../../../src/lib/admission";

export const runtime = "nodejs";

/**
 * `stage_closures.create` — POST /v1/stages/{stageId}/closures
 * (technical/openapi/scope-v0.1.csv:46; command, idempotency required, member
 * plane, governed by `stage_closures.close`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE REFUSAL IS THE PRODUCT
 *
 * This is the half of the ADR-005 gate that ships in v0.1 (ADR-006 step 3) and
 * the only one a foreman meets. When any occurrence on the stage whose
 * `blocking_scope` blocks closure lacks an accepting evidence decision or a
 * current waiver/accept_risk exception, it refuses with `HOLD_POINT_BLOCKED`
 * (error-catalog.csv:95 — 409, `complete_or_authorize_occurrence`,
 * `inline_conflict_notice`) and the body carries one `blocked_reason` OBJECT per
 * unmet requirement: the requirement, the missing evidence by kind and criterion,
 * the role that owes the decision, since when, and the money that waits
 * (version-0.1.md §M3; ADR-005 decision 6). Never a bare 409 and a status word —
 * «a screen that displays «не готово» closes nothing».
 *
 * A REFUSAL WRITES NOTHING. It throws before the stage is touched, before the
 * closure exists, and before anything is carved; the transaction rolls back and
 * the only trace is the request log. That is also ADR-008's guarantee about
 * money: «a refused closure carves nothing, because a refused closure writes
 * nothing at all».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PREDICATE IS NOT IMPLEMENTED HERE
 *
 * It is in `src/lib/readiness.ts` and `readiness.get` calls the same function.
 * Two implementations that agree today are two implementations that disagree the
 * first time one is edited, and the disagreement is invisible until a foreman is
 * told he is ready and then refused. ADR-005 decision 7 makes readiness a
 * PRECONDITION; a precondition computed twice is two preconditions.
 *
 * `schema-v0.1.sql:2492-2493` says this command READS `readiness_projection`. It
 * does not, and migration 0045 §7 already records that comment as owed a
 * correction: INV-061's enforcement column says the predicate is «evaluated
 * inside the closure transaction under the stage row lock», and a row carrying a
 * watermark and a stale flag cannot be a gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STATEMENT ORDER, WHICH THREE SEPARATE MECHANISMS FORCE
 *
 *   1. UPDATE the stage to `closed`. `stage_closures_stage_fkey` resolves against
 *      `work_stages (…, status)` with the closure's `stage_status` CHECK-forced
 *      to `'closed'`, so the closure cannot be inserted first.
 *   2. INSERT the closure. `app.guard_closure_member_window()` refuses a member
 *      row whose parent closure was not created by this transaction, so the
 *      members cannot come first either.
 *   3. INSERT the members. `stage_closures_frozen_set` — deferred, definer —
 *      then proves at COMMIT that the claimed count, the member rows and the
 *      stage's blocking-occurrence count are all equal and that the hash
 *      describes the set.
 *   4. Carve. ADR-008; it must be after 2 so the allocation can name the closure.
 *
 * `work_stages_closure_fact_required` (deferred) closes the last door: a stage
 * marked `closed` with no closure fact behind it is refused at commit, so
 * `update work_stages set status='closed'` cannot become the whole gate. It
 * covers INSERT as well as UPDATE only from migration 0048 — 0045 built it
 * `after update` and a stage BORN closed needed no closure fact, was terminal
 * from birth, and counted as not-open when admission asked whether the
 * assignment had a stage left open. 0048 also narrows `ws_insert` to a stage
 * born `open`, so the policy and the trigger agree about it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY `project.view` IS REQUIRED BESIDE `stage_closures.close`
 *
 * Two independent reasons, and both are load-bearing:
 *
 *   * MONEY. `appendValuationAllocation` computes every total with
 *     `coalesce(sum(...), 0)`, and under RLS rows the actor cannot see read as
 *     ZERO rather than as an error. A carve run by an actor who can close but
 *     cannot read the project would see an untouched pool and take the whole of
 *     it. Migration 0046 §e names this and points at `va_insert`'s first
 *     conjunct; requiring the capability at the route turns a policy denial into
 *     a legible 403.
 *   * THE FROZEN-SET CHECK. `app.assert_stage_closure_set()` is SECURITY DEFINER
 *     and counts every blocking occurrence of the stage, RLS or no RLS. This
 *     route counts what it can SEE. If the two sets differed the closure would
 *     fail at COMMIT with a message about counts — a 500 describing a
 *     completeness violation that was really a visibility one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTHING HERE WAS EXECUTED: no test run, no route invoked, no migration applied.
 */
export const POST = commandRoute(createStageClosureRequest, async (a) => {
  const stageId = a.params.stageId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Етап не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!stageId) throw notFound;

  // `retryable: true` COMES FROM technical/error-catalog.csv:13, not from this
  // route's opinion. CORRECTED 2026-08-08 (M3 review finding 13): this helper
  // said `false`, and every conflict it raises is a stage or an assignment that
  // moved under the caller — the catalog's `refresh_compare_retry` describes
  // exactly what to do about that, and a client that reads `retryable` to decide
  // whether to offer «оновити і повторити» was being told not to offer it.
  // `contract-versions/[versionId]/publish/route.ts:160` already follows the
  // catalog here; precedent in this repo ran both ways and the catalog is the
  // one that is authoritative.
  const versionConflict = (detail: string) => new HttpProblem(409,
    problem("VERSION_CONFLICT", detail,
      { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    // THE ASSIGNMENT TRAVELS WITH THE STAGE, because this command has an opinion
    // about it (the refusal below). One query rather than two: the join is the
    // stage's own foreign key edge (0043:468-469), so it is total — a stage
    // without its assignment is unrepresentable — and `wa_select` (0016:114-116)
    // asks the same `project.view`/`project.admin` as `ws_select`, so it cannot
    // turn a visible stage into an invisible one.
    const st = await tx.query(
      `select s.workspace_id, s.project_id, s.contract_id, s.work_assignment_id, s.stage_key,
              s.is_concealed, s.status, s.version, a.status as assignment_status
         from public.work_stages s
         join public.work_assignments a
           on a.workspace_id = s.workspace_id and a.project_id = s.project_id
          and a.id = s.work_assignment_id
        where s.id = $1`, [stageId]);
    if (st.rows.length === 0) throw notFound;
    const workspaceId: string = st.rows[0].workspace_id;
    const projectId: string = st.rows[0].project_id;
    const contractId: string = st.rows[0].contract_id;
    const assignmentId: string = st.rows[0].work_assignment_id;

    return withIdempotency<CreateStageClosureResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "stage_closures.create", key: a.idempotencyKey,
      requestHash: a.requestHash,
      // ADR-008 makes this command the admission event, so it appends money
      // lineage and must stay replayable for the audit retention window — the
      // same class `progress.record` and `progress.adjust` take, and for the
      // reason that is now true of this route instead of that one.
      idempotencyClass: "ledger_400d",
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      // Order matters for the message a caller gets: `project.view` first, so an
      // actor who cannot see the project is told that rather than being told
      // they cannot close.
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "stage_closures.close" });

      if (a.body.correction) {
        // The field exists so the question is visible; the command refuses it so
        // nothing pretends to answer it. A correction needs the stage to move
        // again and migration 0045 §6 makes `closed` terminal —
        // `app.guard_work_stage()` rejects every update whose old status is not
        // `open`. ADR-008 §"What this ADR does not decide" holds the other half:
        // «v0.1 needs its own answer for a closure that is later found wrong, and
        // this ADR does not give one». Until it does, a correction is refused by
        // name rather than by a foreign key nobody can read.
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Виправлення закриття етапу у цій версії недоступне: закритий етап не змінюється.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{
              path: "correction",
              message: "no v0.1 route can supersede a stage closure; the stage is terminal once closed",
            }],
          }));
      }

      // THE ASSIGNMENT MUST BE ACTIVE, and this check exists because it was
      // missing (M3 review finding 7). `progress.record`
      // (assignments/[assignmentId]/progress/route.ts:76-80) and
      // `work_stages.create` (assignments/[assignmentId]/stages/route.ts:74-78)
      // both refuse a non-`active` assignment; this command read only the stage,
      // so on a `cancelled` or `completed` assignment nothing could be measured
      // and no stage could be created, and yet the stages that already existed
      // still closed — AND ADMITTED THEIR MONEY, because ADR-008 makes this
      // command the admission event and `admitClosedStageQuantity` runs at the
      // end of it. Three commands on one assignment held two opinions, and the
      // one that disagreed was the one that moves the money.
      //
      // The status vocabulary is 0015:86-87 — draft, active, paused, completed,
      // cancelled — and everything that is not `active` is refused, not just the
      // two terminal values: a `draft` or `paused` assignment is one nobody may
      // record against either, and a closure of a stage nobody may record
      // against would prove a hold point over quantity that cannot exist.
      //
      // NOT RE-READ UNDER A LOCK, and that is a v0.1 statement rather than an
      // omission: no v0.1 operation moves an assignment out of `active` —
      // `assignments.create` and `assignments.list` are the only two on
      // technical/openapi/scope-v0.1.csv — so there is no writer to race with.
      // The slice that ships `assignments.update` (or cancel) owes this check
      // the assignment row lock, taken before the stage lock to keep the lock
      // order this route already has.
      //
      // The message is the sibling commands' sentence with one word changed. A
      // foreman who is refused by all three should read three refusals that are
      // obviously the same refusal, and the raw status token stays out of the
      // copy because the vocabulary is English and the screen is not.
      if (st.rows[0].assignment_status !== "active") {
        throw versionConflict("Завдання не активне, закриття етапу неможливе.");
      }

      if (st.rows[0].status !== "open") {
        throw versionConflict(
          `Етап уже ${st.rows[0].status === "closed" ? "закрито" : "завершено"}; повторне закриття неможливе.`);
      }

      // THE STAGE ROW LOCK INV-061 NAMES. `for update` needs the UPDATE privilege
      // migration 0045 §8 grants, and PostgreSQL applies `ws_update`'s USING
      // clause to it — `status = 'open'` and `stage_closures.close` — so a stage
      // that was closed by a concurrent transaction comes back as NO ROWS rather
      // than as a locked row with the wrong status. That is why zero rows here is
      // reported as a conflict and not as a 404: the row exists, it is simply no
      // longer closable by this actor.
      const locked = await tx.query(
        `select status, version from public.work_stages
          where workspace_id = $1 and id = $2 for update`,
        [workspaceId, stageId]);
      if (locked.rows.length === 0) {
        throw versionConflict("Етап щойно змінився; оновіть дані та повторіть спробу.");
      }
      const stageVersion = Number(locked.rows[0].version);
      if (locked.rows[0].status !== "open") {
        throw versionConflict("Етап щойно закрито іншим учасником.");
      }
      if (a.body.expectedVersion !== stageVersion) {
        throw versionConflict(
          `Етап змінився (поточна версія ${stageVersion}); оновіть дані та повторіть спробу.`);
      }

      // TWO EVALUATIONS, AND THE SECOND IS THE ONE THAT COUNTS.
      //
      // The first learns WHICH occurrences the predicate quantifies over, because
      // the lineage locks are per occurrence and there is nothing to lock before
      // the set is known. The second runs with every one of those lineages held,
      // so no decision and no exception can move between the read and the freeze.
      // Skipping the second would mean freezing a set that was true a moment ago
      // — which is the whole of what migration 0045's header means when it says
      // «THE COMMAND MUST COMPARE THE MEMBER'S FACT WITH THE HEAD, under the head
      // lock, inside the closure transaction».
      //
      // A blocking occurrence that APPEARED between the two evaluations would be
      // missed by the lock list and caught anyway: the deferred definer trigger
      // counts the stage's blocking occurrences at COMMIT and refuses a set that
      // left one out. In v0.1 it cannot appear — materialisation happens once, at
      // assignment creation, and `requirement_occurrences.create` and
      // `.bulk_instantiate` are v0.2 — and migration 0045 records that the v0.2
      // bulk-instantiation slice owes a decision about it.
      const probe = await evaluateStage(tx, { workspaceId, projectId, workStageId: stageId });
      if (!probe) throw notFound;
      await lockOccurrenceLineage(tx, workspaceId, probe.blocking.map((o) => o.occurrenceId));

      const stage = await evaluateStage(tx, { workspaceId, projectId, workStageId: stageId });
      if (!stage) throw notFound;

      if (!stage.canCloseStage) {
        const valuations = await assignmentValuations(tx, workspaceId,
          stage.unsatisfied.map((o) => o.workAssignmentId));
        // Parsed before it goes on the wire, the pattern `requirement_library.list`
        // establishes: this body carries REGULATORY STRINGS, and a citation that
        // reached a foreman without its verification tag or its source must fail
        // loudly rather than render as normative (INV-073,
        // hidden-works-content-rules.md).
        const details = holdPointBlockedDetails.parse({
          workStageId: stage.workStageId,
          workAssignmentId: stage.workAssignmentId,
          stageKey: stage.stageKey,
          blockingOccurrenceCount: stage.blocking.length,
          unsatisfiedOccurrenceCount: stage.unsatisfied.length,
          blockedReasons: stage.unsatisfied.map(
            (o) => blockedReasonFor(o, stage, valuations.get(o.workAssignmentId))),
        });
        throw new HttpProblem(409, problem("HOLD_POINT_BLOCKED",
          `Етап не можна закрити: не виконано вимог — ${stage.unsatisfied.length}.`, {
            requestId: a.requestId, retryable: false,
            userAction: "complete_or_authorize_occurrence",
            details,
          }));
      }

      // ── 1. the stage moves ────────────────────────────────────────────────
      // Exactly three columns, because `app.guard_work_stage()` compares the
      // whole row as jsonb minus {status, version, updated_at} and raises on any
      // other difference. `and status = 'open' and version = $3` makes the update
      // itself the concurrency check even though the row is already locked: a
      // guard that depends on a lock taken earlier in the same function is a
      // guard that stops holding when somebody moves the lock.
      const closed = await tx.query(
        `update public.work_stages
            set status = 'closed', version = version + 1, updated_at = now()
          where workspace_id = $1 and id = $2 and status = 'open' and version = $3
          returning version`,
        [workspaceId, stageId, stageVersion]);
      if (closed.rows.length === 0) {
        throw versionConflict("Етап щойно змінився; оновіть дані та повторіть спробу.");
      }
      const newStageVersion = Number(closed.rows[0].version);

      // ── 2. the fact ───────────────────────────────────────────────────────
      const closureId = randomUUID();
      const memberIds = stage.blocking.map((o) => o.occurrenceId);
      const setHash = frozenOccurrenceSetHash(memberIds);
      const inserted = await tx.query(
        `insert into public.stage_closures
           (id, workspace_id, project_id, contract_id, work_assignment_id, work_stage_id,
            closure_no, closed_by_member_id, claimed_covered_at, claimed_covered_tz_offset,
            claimed_time_trust, can_close_stage_result,
            evaluated_occurrence_count, evaluated_occurrence_set_hash,
            idempotency_key, request_hash)
         values ($1,$2,$3,$4,$5,$6,1,$7,$8::timestamptz,$9,$10,true,$11,$12,$13,$14)
         returning closed_at`,
        [closureId, workspaceId, projectId, contractId, assignmentId, stageId,
         m.memberId, a.body.claimedCoveredAt ?? null, a.body.claimedCoveredTzOffset ?? null,
         // Untrusted, and labelled as such: a claimed covering time is a device
         // claim, and a closure with no claimed time claims no trust level either
         // (`stage_closures_claimed_time_check`).
         a.body.claimedCoveredAt ? "device_claimed" : "unknown",
         memberIds.length, setHash, a.idempotencyKey, a.requestHash]);
      const closedAt = new Date(inserted.rows[0].closed_at).toISOString();

      // ── 3. the frozen set ─────────────────────────────────────────────────
      // One row per occurrence the predicate quantified over, each naming the
      // EXACT fact it was satisfied by. `satisfiedBy` comes from the shared
      // evaluation, so what is frozen here is what `readiness.get` reports.
      const frozen: FrozenOccurrenceView[] = [];
      for (const o of stage.blocking) {
        const byDecision = o.satisfiedBy === "evidence_decision";
        await tx.query(
          `insert into public.stage_closure_occurrences
             (workspace_id, project_id, stage_closure_id, work_stage_id,
              requirement_occurrence_id, occurrence_blocking_scope, satisfied_by,
              relied_on_decision_id, relied_on_decision_outcome,
              relied_on_exception_id, relied_on_exception_action)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [workspaceId, projectId, closureId, stageId, o.occurrenceId, o.blockingScope,
           o.satisfiedBy,
           byDecision ? o.currentDecisionId : null,
           byDecision ? "accepted" : null,
           byDecision ? null : o.currentExceptionId,
           byDecision ? null : o.currentExceptionAction]);
        frozen.push({
          requirementOccurrenceId: o.occurrenceId,
          blockingScope: o.blockingScope as FrozenOccurrenceView["blockingScope"],
          satisfiedBy: o.satisfiedBy as FrozenOccurrenceView["satisfiedBy"],
          reliedOnDecisionId: byDecision ? o.currentDecisionId : null,
          reliedOnExceptionId: byDecision ? null : o.currentExceptionId,
          reliedOnExceptionAction: byDecision
            ? null : (o.currentExceptionAction as FrozenOccurrenceView["reliedOnExceptionAction"]),
        });
      }

      // ── 4. the carve (ADR-008) ────────────────────────────────────────────
      const admission = await admitClosedStageQuantity(tx, {
        workspaceId, projectId, contractId,
        workAssignmentId: assignmentId, stageClosureId: closureId,
      });

      // HOW MANY OBLIGATIONS WERE ESCAPED RATHER THAN MET (M3 review finding 9).
      // ADR-005 decision 3 says «the escape stays visible», and until 2026-08-08
      // it stayed visible only to someone who queried
      // `stage_closure_occurrences` afterwards: the audit row and the durable
      // event both said a stage closed and neither said it closed on two
      // waivers. With no bypass in v0.1 the attributed waiver/accept_risk is the
      // ONLY escape there is (capabilities.csv:24, ADR-006 decision 4), so the
      // count of them is the whole of what «visible» can mean here.
      //
      // The two sum to `evaluatedOccurrenceCount` on every closure that reaches
      // this line: `satisfiedFor` (src/lib/readiness.ts:277-285) returns exactly
      // one of the two disjuncts or `null`, and a `null` on any blocking
      // occurrence would have thrown `HOLD_POINT_BLOCKED` above. They are
      // recorded as two numbers rather than one ratio because a ratio cannot be
      // added up across closures without knowing both denominators.
      const satisfiedByDecisionCount =
        stage.blocking.filter((o) => o.satisfiedBy === "evidence_decision").length;
      const satisfiedByExceptionCount =
        stage.blocking.filter((o) => o.satisfiedBy === "exception").length;

      await recordAudit(tx, ctx, {
        action: "work_stage.closed", object_type: "work_stage", object_id: stageId,
        details: {
          stageClosureId: closureId, workAssignmentId: assignmentId,
          evaluatedOccurrenceCount: memberIds.length,
          evaluatedOccurrenceSetHash: setHash,
          satisfiedByDecisionCount,
          satisfiedByExceptionCount,
          // A vacuous closure is a closure that proved nothing, and after the
          // response is gone the audit row is the only place that survives.
          vacuous: stage.vacuous,
          admittedProgressEntryCount: admission.admittedProgressEntryCount,
          admissionValued: admission.valued,
        },
      }, { organizationId: workspaceId });

      // technical/events/event-catalog.csv:23 — `work_stage.closed`, v0.1-M3,
      // aggregate `work_stage`, producer `bff.stage_closures.create`, consumers
      // `projection_rebuilder` and `notification_creator`. NEITHER IS DEPLOYED;
      // the row is durable and unread until one exists, and it is what the
      // rebuilder will replay from — which is the reason the escape counts are
      // on the payload and not only in the audit row: the notification a
      // технагляд eventually gets about a closed stage should be able to say it
      // closed on waivers without re-reading the frozen set.
      //
      // `payload_version` STAYS 1. Nothing consumes this topic, so no reader can
      // be broken by two added scalar fields, and bumping the version would
      // claim a compatibility event that did not happen.
      await enqueueOutbox(tx, ctx, {
        topic: "work_stage.closed", aggregate_type: "work_stage", aggregate_id: stageId,
        payload_version: 1,
        payload: {
          workspaceId, projectId, contractId, workAssignmentId: assignmentId,
          workStageId: stageId, stageClosureId: closureId,
          evaluatedOccurrenceIds: memberIds,
          evaluatedOccurrenceSetHash: setHash,
          satisfiedByDecisionCount,
          satisfiedByExceptionCount,
          vacuous: stage.vacuous,
        },
      }, { organizationId: workspaceId });

      return {
        status: 201,
        body: {
          stageClosureId: closureId,
          workStageId: stageId,
          workAssignmentId: assignmentId,
          closureNo: 1,
          predecessorClosureId: null,
          stageVersion: newStageVersion,
          closedAt,
          closedByMemberId: m.memberId,
          evaluatedOccurrenceCount: memberIds.length,
          evaluatedOccurrenceSetHash: setHash,
          frozenOccurrences: frozen,
          vacuous: stage.vacuous,
          admission,
        },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
