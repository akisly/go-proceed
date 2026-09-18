import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability, type ActiveMembership } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { createWorkStageRequest, type CreateWorkStageResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";

export const runtime = "nodejs";

/**
 * `work_stages.create` — POST /v1/assignments/{assignmentId}/stages
 * (technical/openapi/scope-v0.1.csv:43; command, idempotency required, member
 * plane, governed by `assignments.manage`).
 *
 * THE CLOSABLE UNIT, CREATED BY HAND — AND ONLY WHERE THE BASELINE IMPLIED
 * NONE. `assignments.create` materialises one stage per bound `stage_key` the
 * line's work type reaches (migration 0043; plan contradiction 5, resolved as
 * option A). What is left for this command is the assignment materialisation
 * left with NO stage at all.
 *
 * IT USED TO BE EVERY STAGE THERE IS, and it is not any more. Until migration
 * 0050 no work line carried a work type, the rule predicate is (work type,
 * stage), and materialisation therefore produced nothing — so this hand-made
 * stage was the only kind that existed. 0050 lands the carrier and an
 * assignment on a TYPED line now arrives with its stages already materialised
 * from the binding.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A STAGE KEY THE BASELINE DID NOT IMPLY IS REFUSED, AND UNTIL 2026-08-08 IT
 * WAS NOT. THIS IS THE FINDING, NOT A PRECAUTION.
 *
 * Until that date this route wrote ANY `stageKey` the caller typed, checked only
 * `assignments.manage` and `status = 'active'`, and asked nothing about the
 * baseline. `work_stages_closable_unit_uniq` blocks only a repeat of the SAME
 * key on the same assignment, so a fresh key was always available. The sequence
 * that made it a money lever, in full:
 *
 *   1. a typed line materialises its stages, each carrying real obligations;
 *   2. they are discharged honestly and closed; the LAST closure is the
 *      admitting one and carves the money recorded so far (ADR-008,
 *      `admitClosedStageQuantity`, `ADMISSION_RULE = last_open_stage_of_assignment`);
 *   3. more quantity is recorded — unvalued, correctly, INV-089;
 *   4. a member holding `assignments.manage` + `stage_closures.close` types a
 *      key nobody agreed to. The stage is empty, so `evaluateStage` reports
 *      `canCloseStage: true` over `∀` on the empty set (src/lib/readiness.ts);
 *   5. closing it is vacuous AND, being the only open stage, it is the admitting
 *      closure. Every progress fact recorded since step 2 is released by a
 *      closure that proved nothing.
 *
 * Nothing refused it. It was VISIBLE in three places — `blockingOccurrenceCount:
 * 0` on this 201, `vacuous: true` on the closure's, and both in the audit — and
 * visibility is not refusal. It was also the only way to reach a SECOND
 * admission on one assignment, which is the step the double-spend in
 * `valuation.ts`/`valuation-writer.ts` needs to detonate.
 *
 * THE RULE NOW: if the assignment's line is COVERED — its `work_type_key`
 * matches at least one rule version this baseline bound — the stage key must be
 * one of the keys those matched rules name. It is ONE predicate, written in SQL
 * as `app.stage_key_is_admissible` (migration 0051 §1) and called both from here
 * and from the trigger, and it is the same set `planForWorkType` derives in
 * TypeScript for `assignments.create` and the dry run. Two places state that
 * correspondence — 0051 §1's comment and a test in
 * `materialisation-end-to-end.int.test.ts` that compares the function's verdict
 * with the stages materialisation actually wrote — because it is an agreement
 * between two languages and nothing in either enforces it.
 *
 * WHAT THAT MAKES THIS ROUTE, stated plainly because it is a narrowing and not a
 * tightening: FOR A COVERED LINE THE COMMAND IS NOW UNREACHABLE. Every implied
 * key already holds a materialised stage (created in `assignments.create`'s own
 * transaction, and `work_stages` has no DELETE grant), so an implied key is
 * refused 409 by `work_stages_closable_unit_uniq` and every other key is refused
 * 422 here. «A stage a typed baseline genuinely did not imply» — which this
 * header claimed as a reachable case until 2026-08-08 — is exactly what is
 * refused. If the owner wants free stage keys on a covered line, that is a
 * product decision and it must be RECORDED beside `vacuous`, not left as the
 * absence of a check.
 *
 * WHAT IS NOT REFUSED, AND WHY REFUSING IT WOULD BUY NOTHING. An UNCOVERED line
 * — untyped (every imported one, permanently: ADR-006 decision 6 freezes the
 * importer and INV-015 freezes the published line) or typed but matching no
 * bound rule — implies no stage, so any key is admitted and the stage is empty
 * and closes vacuously. That is INV-072's disclosed hole and this change does
 * not close it: on such an assignment the FIRST closure is already vacuous and
 * already admitting, so restricting the key to the baseline's bound vocabulary
 * would refuse spellings without shutting a single door. The narrower rule is
 * the one that shuts a door; the wider one only looks like it does.
 *
 * NOR IS «THE ASSIGNMENT MUST STILL HAVE AN OPEN STAGE» A CONDITION HERE. On a
 * covered line the question cannot arise (the command is unreachable). On an
 * uncovered one, «record a tranche, make a stage, close it, make the next» is
 * the only shape an imported baseline's money has, and it is what
 * `admission-valuation.int.test.ts` exercises. A rule that forbade it would
 * break the legal path and still leave the vacuous first closure untouched.
 *
 * STRUCTURALLY, AND NOT ONLY HERE — WHICH IS A CHOICE AND IS ARGUED IN 0051's
 * HEADER. `ws_insert` admits any holder of `assignments.manage` to INSERT into
 * `public.work_stages`, so a route check defends only the callers that come
 * through the route: a second route added later, a job, a hand-run statement as
 * `goproceed_app`. The mint this refusal exists against needs no more than an
 * INSERT and a closure, both of which that role can already perform. So the rule
 * is a BEFORE INSERT trigger (`work_stages_stage_key_guard`, migration 0051 §2)
 * and this check is the legible half of it — the same division migration 0050 §5
 * makes between `work_items.create` and `work_items_work_type_guard`, and 0042 §5
 * between `contract_versions.bind_rules` and `app.guard_rule_binding_window()`.
 *
 * IT CREATES NO OBLIGATION, AND THE RESPONSE SAYS SO. `src/lib/occurrence-writer.ts`
 * is the only door a requirement occurrence comes through and this route does not
 * import it; `requirement_occurrences.create` and `.bulk_instantiate` are v0.2. A
 * stage created here is empty, and an empty stage CLOSES — `∀` over an empty set
 * is true (execution-and-evidence.md §"Closure and eligibility"). Returning only
 * `{workStageId}` would let a caller create a closable unit and never learn that
 * closing it proves nothing, which is the silent non-coverage INV-072 exists
 * against. `blockingOccurrenceCount` is therefore read back from the database
 * rather than assumed to be zero.
 *
 * THE REASON GIVEN FOR READING IT BACK WAS «a count that is computed can become
 * non-zero when the work-type decision lands, and a hardcoded 0 could not». That
 * decision LANDED on 2026-08-08 (migration 0050) and the sentence stopped being
 * true in the same change: an assignment whose line carries a work type arrives
 * with its stages already materialised, and since that date this route refuses a
 * key outside the set that materialisation used — so a stage created HERE is on
 * a line that implies no obligation and its count is zero by construction. The
 * read stays anyway, for the smaller and more durable reason: no v0.1 command
 * attaches an occurrence to a stage that already exists, `requirement_occurrences
 * .create` and `.bulk_instantiate` are v0.2, and on the day one of them ships a
 * computed count reports the truth where a literal would report the past.
 *
 * NO OUTBOX EVENT. `technical/events/event-catalog.csv` carries `work_stage.closed`
 * and no `work_stage.created`, and a topic that is in no catalog row is a topic no
 * consumer is written against. The audit row carries the fact instead.
 *
 * GOVERNED BY `assignments.manage`, WHICH IS THE POLICY'S OWN ANSWER. `ws_insert`
 * (migration 0043 §9) names exactly that capability. `stage_closures.close` is a
 * different act by a different persona and migration 0045 §10 keeps them apart
 * deliberately; a route that checked the closure capability here would be denied
 * by the insert policy anyway, which is a 500 where a 403 belongs.
 */
export const POST = commandRoute(createWorkStageRequest, async (a) => {
  const assignmentId = a.params.assignmentId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Завдання не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!assignmentId) throw notFound;

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const asg = await tx.query(
      `select workspace_id, project_id, contract_id, contract_version_id, status
         from public.work_assignments where id = $1`, [assignmentId]);
    if (asg.rows.length === 0) throw notFound;
    const workspaceId: string = asg.rows[0].workspace_id;
    const projectId: string = asg.rows[0].project_id;
    const contractId: string = asg.rows[0].contract_id;
    const contractVersionId: string = asg.rows[0].contract_version_id;

    return withIdempotency<CreateWorkStageResponse, ActiveMembership>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "work_stages.create", key: a.idempotencyKey, requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "assignments.manage" });
        return m;
      },
    }, async (m) => {
      if (asg.rows[0].status !== "active") {
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Завдання не активне, створення етапу неможливе.",
          { requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry" }));
      }

      // ── THE KEY MUST BE ONE THE BASELINE IMPLIED FOR THIS LINE ───────────
      // The header carries the whole argument. What the code does, and why in
      // this shape:
      //
      //   * IT ASKS THE DATABASE, through `app.stage_key_is_admissible`
      //     (migration 0051 §1) — the same function the trigger calls, so the
      //     route's answer and the structural refusal cannot differ. This is
      //     `requireBindableWorkType`'s shape (src/lib/manual-baseline.ts) and
      //     migration 0050 §5's division: the trigger makes the rule
      //     structural, the route turns it into a catalogued field error
      //     instead of a raise that reaches the wire as a 500.
      //   * IT MUST BE SECURITY DEFINER AND THAT IS NOT A CONVENIENCE. The
      //     predicate reads `work_items.work_type_key` (`wi_select` asks
      //     `project.view`) and `contract_version_rule_bindings` (`cvrb_select`
      //     asks the same). This route is governed by `assignments.manage`,
      //     which may be held WITHOUT `project.view` — 0042 §4 makes exactly
      //     this argument about a ПТВ holding `contracts.edit`. Computed in
      //     TypeScript over RLS-visible rows, the implied set would read EMPTY
      //     for such a caller and the refusal would silently not happen: a
      //     check that fails open for precisely the actor it is written against.
      //   * THE WORK TYPE IS READ OFF THE LINE, never off the request — the
      //     property of the agreed baseline `assignments.create` makes the same
      //     argument about. Byte equality on the same normalised key as
      //     `planForWorkType`; migration 0051 §1 states that correspondence and
      //     `materialisation-end-to-end.int.test.ts` asserts it against the
      //     stages materialisation actually wrote.
      const admissible = await tx.query(
        `select app.stage_key_is_admissible($1, $2, $3) as ok`,
        [workspaceId, assignmentId, a.body.stageKey]);
      if (admissible.rows[0]?.ok !== true) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Цей вид робіт має етапи, визначені прив'язаними версіями правил цього "
          + "базису, і етап поза цим переліком не створюється: закриття такого "
          + "етапу нічого не підтверджує. Оберіть етап із переліку базису.",
          {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            // No value in the message: technical/error-catalog.csv:15 logs this
            // code `field_codes_no_values`, and the key the caller typed is the
            // value. The permitted set is not listed either — it is readable
            // from `requirement_occurrences.list` and from the assignment's own
            // stages, both of which the caller can already see.
            fieldErrors: [{ path: "stageKey", message: "stage key not implied by the baseline" }],
          }));
      }

      const stageId = randomUUID();
      try {
        // `status` and `version` keep their defaults ('open', 1). Writing either
        // here would read as this command having an opinion about a lifecycle it
        // cannot drive: migration 0045 §6 admits exactly one transition and only
        // through the closure command.
        //
        // `location_id` keeps its default too — locations are v0.2 (ADR-006
        // decision 4.2) and no v0.1 command sets one. That is also why the
        // `work_stages_closable_unit_uniq` index coalesces the nullable location
        // to a fixed uuid: in v0.1 every location is NULL, and without the
        // coalesce two NULLs would not collide and the index would constrain
        // nothing in the version that ships.
        await tx.query(
          `insert into public.work_stages
             (id, workspace_id, project_id, contract_id, contract_version_id,
              work_assignment_id, stage_key, is_concealed, created_by_member_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [stageId, workspaceId, projectId, contractId, contractVersionId,
           assignmentId, a.body.stageKey, a.body.isConcealed, m.memberId]);
      } catch (e) {
        // One assignment + one location node + one stage key is ONE stage
        // (migration 0043). Without this branch the 23505 reaches the caller as a
        // 500, and «close the same stage twice» would be reachable through
        // duplicate stage IDENTITIES rather than duplicate closures — the door
        // INV-076 is guarding is a different one.
        if (e instanceof Error && /work_stages_closable_unit_uniq/.test(e.message)) {
          throw new HttpProblem(409, problem("ASSIGNMENT_CONFLICT",
            "Етап із цим ключем уже існує для цього завдання.", {
              requestId: a.requestId, retryable: false,
              userAction: "refresh_assignment_and_occurrences",
            }));
        }
        throw e;
      }

      const counted = await tx.query(
        `select count(*)::int as n from public.requirement_occurrences
          where workspace_id = $1 and work_stage_id = $2
            and blocking_scope in ('blocks_stage_closure','blocks_both')`,
        [workspaceId, stageId]);
      const blockingOccurrenceCount: number = counted.rows[0].n;

      await recordAudit(tx, ctx, {
        action: "work_stage.created", object_type: "work_stage", object_id: stageId,
        details: {
          workAssignmentId: assignmentId, contractVersionId,
          stageKey: a.body.stageKey, isConcealed: a.body.isConcealed,
          // Carried into the audit for the reason assignments.create carries its
          // coverage verdict there: when the count is zero, the audit is the only
          // place the fact survives after the response is gone.
          blockingOccurrenceCount,
        },
      }, { organizationId: workspaceId });

      return {
        status: 201,
        body: {
          workStageId: stageId,
          workAssignmentId: assignmentId,
          stageKey: a.body.stageKey,
          isConcealed: a.body.isConcealed,
          status: "open" as const,
          version: 1,
          blockingOccurrenceCount,
        },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
