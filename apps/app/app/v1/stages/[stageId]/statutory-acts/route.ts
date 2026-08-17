import { randomUUID } from "node:crypto";
import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  composeStatutoryActRequest, type ComposeStatutoryActResponse,
} from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";
import {
  loadActVersionView, midpointOfRoundingPolicy, parsePgNumeric, printedQuantityOf,
} from "../../../../../src/lib/statutory-act";
import {
  DODATOK_V_TEMPLATE, FORM_CITATION_SOURCE, FORM_CITATION_TEXT,
} from "../../../../../src/lib/statutory-act-form";

export const runtime = "nodejs";

/**
 * `statutory_acts.compose` — POST /v1/stages/{stageId}/statutory-acts
 * (technical/openapi/scope-v0.1.csv:49; command, idempotency required, member
 * plane, governed by `statutory_acts.compose`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ACT IS A BY-PRODUCT OF CLOSURE, NOT A DOCUMENT SOMEBODY WRITES
 *
 * ADR-005 decision 10, state-catalog.csv:47 and transition-catalog.csv:54 all
 * say it in terms: «a concealed stage produces a draft statutory act» when its
 * requirements are satisfied. This command therefore REFUSES a stage that is not
 * closed, and the refusal is structural twice over:
 *
 *   1. this route reads the stage's status and names it in the refusal, so a
 *      foreman is told what to do rather than that something went wrong;
 *   2. there is no relational path from an unclosed stage to an act at all.
 *      `statutory_acts_closure_fkey` (migration 0047 §3) resolves only against a
 *      `public.stage_closures` row, and 0045 makes such a row storable only when
 *      `can_close_stage` held over the stage's complete frozen obligation set.
 *      If this route's check were deleted the command would still be unable to
 *      write an act for an open stage — it would fail with a foreign key
 *      violation instead of a sentence, which is the difference between a
 *      product and a database.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THERE IS NO QUANTITY ON THE WIRE (INV-073)
 *
 * `composeQuantityEntry` carries `rootProgressEntryId` and `share`. The printed
 * number is computed HERE from the entry's own recorded quantity at the
 * canonical precision of the line, and the entry's quantity is then pinned INTO
 * the act row by a six-column foreign key, so the share is taken of a number
 * nobody typed. A composer who wants to print an invented figure has no key to
 * put it in; `.strict()` makes the attempt a 422 naming the key.
 *
 * THE COMPOSER-SIDE REFUSAL — a requested entry that is not an existing recorded
 * ROOT entry ON THIS LINE — is checked here before any insert. INV-073 covers
 * the RENDERING constraint; the composer's refusal «carries no invariant
 * identifier today» (version-0.1.md §v0.1-M4 security tests; the plan's
 * §"Decisions this plan raises and does not take" item 5; migration 0047 §11
 * item 9), and this route does not invent one either.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY `project.view` IS REQUIRED BESIDE `statutory_acts.compose`
 *
 * The same finding `readiness.get` records, one milestone later. This command
 * reads the stage (`ws_select`), the closure (`sc_select`), the frozen
 * occurrence set (`sco_select`), the recorded entries (`pe_select`), the line
 * (`wi_select`) and the participants (`pp_select`) — EVERY ONE of them behind
 * `project.view` or `project.admin`, and none of them behind
 * `statutory_acts.compose`. An actor holding only the act capability would not
 * be denied; they would compose an act with no quantity lines and no signatories
 * and be told the entries do not exist. Requiring the capability turns that into
 * a legible 403.
 *
 * CLOSED 2026-08-17. This paragraph read: «`statutory_acts.compose` appears in
 * NO row of technical/permissions/responsibility-presets.csv, so every persona
 * needs a hand-issued grant for all four M4 operations» — M1 review finding 8 and
 * M3 review finding 5 arriving a third time (migration 0047 §11 item 6). It is on
 * the `pto_engineer` persona now, beside `stage_closures.close`, because INV-084
 * makes the closure the event that pins the act version. `presetCoherenceErrors`
 * in scripts/validate-canonical-docs.mjs fails the build if it leaves again.
 * Nothing about this route changed; only the sentence about the world did.
 *
 * NOTHING HERE WAS EXECUTED: no test run, no route invoked, no migration applied.
 */
export const POST = commandRoute(composeStatutoryActRequest, async (a) => {
  const stageId = a.params.stageId;
  const notFound = new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Етап не знайдено.",
    { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  if (!stageId) throw notFound;

  // `retryable: true` is technical/error-catalog.csv:13's value, not this
  // route's. CORRECTED 2026-08-08 alongside the same correction in the sibling
  // `stage_closures.create` (M3 review finding 13): the catalog fixes the status,
  // the retryability and the user action per CODE, and a route that overrides one
  // of the three has invented a variant of the code. `refresh_compare_retry` is
  // literally an instruction to retry after refreshing.
  const conflict = (detail: string) => new HttpProblem(409,
    problem("VERSION_CONFLICT", detail,
      { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));
  const invalid = (detail: string, path: string, message: string) => new HttpProblem(422,
    problem("VALIDATION_FAILED", detail, {
      requestId: a.requestId, retryable: false, userAction: "correct_fields",
      fieldErrors: [{ path, message }],
    }));

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const st = await tx.query(
      `select workspace_id, project_id, contract_id, work_assignment_id,
              is_concealed, status
         from public.work_stages where id = $1`, [stageId]);
    if (st.rows.length === 0) throw notFound;
    const workspaceId: string = st.rows[0].workspace_id;
    const projectId: string = st.rows[0].project_id;
    const contractId: string = st.rows[0].contract_id;
    const assignmentId: string = st.rows[0].work_assignment_id;

    return withIdempotency<ComposeStatutoryActResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "statutory_acts.compose", key: a.idempotencyKey,
      requestHash: a.requestHash,
    }, async () => {
      const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
      // `project.view` first, so an actor who cannot see the project is told
      // that rather than being told they cannot compose.
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "project.view" });
      await requireProjectCapability(tx, a.requestId,
        { workspaceId, projectId, memberId: m.memberId, capability: "statutory_acts.compose" });

      // ── the refusal the milestone is about ────────────────────────────────
      if (st.rows[0].status !== "closed") {
        throw conflict(st.rows[0].status === "open"
          ? "Акт складається як наслідок закриття етапу. Спочатку закрийте етап."
          : "Етап закрито без доказів; акт за Додатком В для нього не складається.");
      }
      // `statutory_acts_concealment_check`: «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ» is
      // the act for CONCEALED works. Checked here so the caller gets a sentence
      // rather than a CHECK violation, and written against the form for the same
      // reason the constraint is: v0.2's Додаток Г covers responsible structures
      // and no source limits it to concealed work.
      if (st.rows[0].is_concealed !== true) {
        throw conflict("Етап не є прихованими роботами; форма за Додатком В до нього не застосовується.");
      }

      const cl = await tx.query(
        `select id from public.stage_closures
          where workspace_id = $1 and work_stage_id = $2
          order by closure_no desc limit 1`,
        [workspaceId, stageId]);
      if (cl.rows.length === 0) {
        // The stage says `closed` and no closure fact stands behind it. The
        // deferred `work_stages_closure_fact_required` makes that unreachable —
        // 0045 shut the UPDATE door and 0048 the INSERT one, and until 0048 a
        // stage BORN closed reached exactly here — so reaching it is a defect and
        // not a workflow state, reported as a conflict rather than silently
        // composing against nothing.
        throw conflict("Факт закриття етапу не знайдено; акт складати немає з чого.");
      }
      const stageClosureId: string = cl.rows[0].id;

      const wa = await tx.query(
        `select wa.work_item_id, wi.unit_definition_id, wi.unit_precision, wi.unit_code,
                cv.rounding_policy
           from public.work_assignments wa
           join public.work_items wi
             on wi.workspace_id = wa.workspace_id and wi.id = wa.work_item_id
           join public.contract_versions cv
             on cv.workspace_id = wi.workspace_id and cv.id = wi.contract_version_id
          where wa.workspace_id = $1 and wa.id = $2`,
        [workspaceId, assignmentId]);
      if (wa.rows.length === 0) throw notFound;
      const workItemId: string = wa.rows[0].work_item_id;
      const unitDefinitionId: string = wa.rows[0].unit_definition_id;
      const unitPrecision: number = Number(wa.rows[0].unit_precision);
      // The baseline's OWN pinned midpoint, not a constant chosen here. See
      // `printedQuantityOf`: no document in this package states a quantity
      // rounding rule, so applying the baseline's money rule to a quantity is
      // the product's assumption and is recorded rather than hidden.
      const midpoint = midpointOfRoundingPolicy(wa.rows[0].rounding_policy);

      // ── the act identity, one per closure ─────────────────────────────────
      const existing = await tx.query(
        `select id from public.statutory_acts
          where workspace_id = $1 and stage_closure_id = $2`,
        [workspaceId, stageClosureId]);

      let statutoryActId: string;
      let versionNo = 1;
      let predecessorVersionId: string | null = null;
      let predecessorVersionNo: number | null = null;

      if (a.body.correction) {
        if (existing.rows.length === 0) {
          throw conflict("Для цього закриття акта ще немає; виправляти немає чого.");
        }
        statutoryActId = existing.rows[0].id;
        const p = await tx.query(
          `select version_no, status from public.statutory_act_versions
            where workspace_id = $1 and id = $2 and statutory_act_id = $3`,
          [workspaceId, a.body.correction.predecessorVersionId, statutoryActId]);
        if (p.rows.length === 0) {
          throw invalid("Попередню версію акта не знайдено.",
            "correction.predecessorVersionId", "not a version of this act");
        }
        // `statutory_act_versions_chain_fkey` pins the predecessor's status to
        // 'frozen'; checked here so the caller is told, not shown a 500.
        if (p.rows[0].status !== "frozen") {
          throw conflict("Виправляти можна лише зафіксовану версію акта.");
        }
        predecessorVersionId = a.body.correction.predecessorVersionId;
        predecessorVersionNo = Number(p.rows[0].version_no);
        versionNo = predecessorVersionNo + 1;
      } else if (existing.rows.length > 0) {
        // `statutory_acts_closure_key` allows exactly one act identity per
        // closure, and «a correction is a successor VERSION» is the only
        // correction this milestone has (migration 0047 §3).
        throw conflict(
          "Акт для цього закриття вже існує; виправлення оформлюється наступною версією.");
      } else {
        statutoryActId = randomUUID();
        await tx.query(
          `insert into public.statutory_acts
             (id, workspace_id, project_id, contract_id, work_assignment_id, work_item_id,
              work_stage_id, stage_closure_id, stage_is_concealed,
              act_form, act_form_basis, composed_by_member_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,true,'dodatok_v','product_assumption',$9)`,
          [statutoryActId, workspaceId, projectId, contractId, assignmentId, workItemId,
           stageId, stageClosureId, m.memberId]);
      }

      // `act_form_basis` is written as 'product_assumption' and is not on the
      // request. PROHIBITION G: no source establishes which Додаток Н position
      // takes which form, and v0.1 stores form В only
      // (`statutory_acts_v01_form_v_only_check`), so there is nothing for a user
      // to select and 'user_selected' has no v0.1 producer. The value stays in
      // the vocabulary for the v0.2 Г slice.

      // ── the version ───────────────────────────────────────────────────────
      const versionId = randomUUID();
      await tx.query(
        `insert into public.statutory_act_versions
           (id, workspace_id, project_id, contract_id, statutory_act_id,
            work_assignment_id, work_item_id, version_no, status,
            predecessor_version_id, predecessor_version_no, predecessor_status,
            correction_reason, form_template_key, form_template_version,
            form_citation, form_citation_verification, form_citation_source,
            registry_checked_on, composed_by_member_id, idempotency_key, request_hash)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11,$12,$13,$14,$15,
                 'VERIFIED_PRIMARY',$16,$17::date,$18,$19,$20)`,
        [versionId, workspaceId, projectId, contractId, statutoryActId,
         assignmentId, workItemId, versionNo,
         predecessorVersionId, predecessorVersionNo,
         predecessorVersionId === null ? null : "frozen",
         a.body.correction?.reason ?? null,
         DODATOK_V_TEMPLATE.key, DODATOK_V_TEMPLATE.version,
         // INV-073, storage half: the citation and its tag and its source go in
         // together or the row is unstorable. The tag rests on the SINGLE
         // UNREPRODUCED ДБН FETCH, and whether it may then be PRINTED in a
         // customer-facing artifact is a separate gate the renderer enforces.
         FORM_CITATION_TEXT, FORM_CITATION_SOURCE,
         a.body.registryCheckedOn, m.memberId, a.idempotencyKey, a.requestHash]);
      // `form_template_hash`, `renderer_version`, `content_hash`, `frozen_at` and
      // `frozen_by_member_id` are deliberately NOT written here:
      // `statutory_act_versions_draft_clean_check` refuses a draft that carries
      // any of them, so a draft cannot be mistaken for frozen by anything that
      // trusts the columns rather than the status.

      // ── the printed quantities ────────────────────────────────────────────
      const requestedIds = a.body.quantityEntries.map((q) => q.rootProgressEntryId);
      const duplicate = requestedIds.find((id, i) => requestedIds.indexOf(id) !== i);
      if (duplicate !== undefined) {
        // One line per recorded entry. Two shares of one entry would reach a
        // total the entry does not support; the primary key refuses it and this
        // says so first.
        throw invalid("Один і той самий запис обсягу вказано двічі.",
          "quantityEntries", `duplicate rootProgressEntryId ${duplicate}`);
      }

      // `= any('{}'::uuid[])` is valid and matches nothing, so the empty case
      // needs no branch. An entry the actor cannot SEE also matches nothing and
      // is refused below as «not an existing recorded entry» — which is why
      // `project.view` is required above rather than left to produce that
      // misleading message.
      const entries = await tx.query(
        `select id, quantity from public.progress_entries
          where workspace_id = $1 and work_assignment_id = $2 and work_item_id = $3
            and entry_kind = 'root' and id = any($4::uuid[])`,
        [workspaceId, assignmentId, workItemId, requestedIds]);
      const recorded = new Map<string, string>(
        entries.rows.map((e): [string, string] => [e.id as string, String(e.quantity)]));

      let lineNo = 0;
      for (const entry of a.body.quantityEntries) {
        // THE COMPOSER-SIDE REFUSAL. A share may only be taken of a ROOT entry
        // already recorded ON THIS ASSIGNMENT AND THIS LINE. An adjustment is a
        // correction TO a root and not a quantity of its own, and an entry on
        // another line would print under this act's heading.
        const q = recorded.get(entry.rootProgressEntryId);
        if (q === undefined) {
          throw invalid(
            "Обсяг можна друкувати лише з уже записаних фактів виконання на цій позиції.",
            `quantityEntries.${lineNo}.rootProgressEntryId`,
            "not an existing recorded root progress entry on this assignment and line");
        }
        const recordedQuantity = parsePgNumeric(q);
        const share = parsePgNumeric(entry.share);
        if (recordedQuantity === null || share === null) {
          throw invalid("Некоректне число.", `quantityEntries.${lineNo}.share`, "not a decimal");
        }
        const printed = printedQuantityOf({ recordedQuantity, share, unitPrecision, midpoint });
        if (!printed.ok) {
          // Deliberate, and named in migration 0047 §5: «an act that prints
          // «0.000» as the quantity performed is worse than an act that refuses
          // to be composed, and the composer must refuse the share rather than
          // print a zero».
          throw invalid(
            printed.reason === "rounds_to_zero"
              ? `Частка занадто мала, щоб надрукувати її в одиниці «${wa.rows[0].unit_code}».`
              : "Надрукований обсяг перевищив би записаний факт.",
            `quantityEntries.${lineNo}.share`, printed.reason);
        }
        lineNo += 1;
        await tx.query(
          `insert into public.statutory_act_version_quantities
             (workspace_id, project_id, statutory_act_version_id, work_assignment_id,
              work_item_id, root_progress_entry_id, source_entry_kind,
              source_recorded_quantity, source_quantity_share,
              printed_unit_id, printed_unit_precision, printed_quantity, line_no)
           values ($1,$2,$3,$4,$5,$6,'root',$7,$8,$9,$10,$11,$12)`,
          [workspaceId, projectId, versionId, assignmentId, workItemId,
           entry.rootProgressEntryId, q, entry.share,
           unitDefinitionId, unitPrecision, printed.printedQuantity, lineNo]);
      }

      // ── the three typed slots ─────────────────────────────────────────────
      const slots: { slot: string; input: { projectPartyId: string; partyContactId: string } }[] = [
        { slot: "builder", input: a.body.signatories.builder },
        { slot: "technical_supervision", input: a.body.signatories.technicalSupervision },
      ];
      if (a.body.signatories.designerSupervision) {
        slots.push({
          slot: "designer_supervision", input: a.body.signatories.designerSupervision,
        });
      }

      for (const { slot, input } of slots) {
        // The organisation name is read off the participant record and is never
        // typed by the caller. `legal_profile_official_name` is preferred over
        // `party_display_name` because a legal profile IS the official identity
        // and a display name is a label; `frozen_organization_name_source`
        // records which one this act froze, so a reviewer years later knows what
        // they are comparing against.
        const pp = await tx.query(
          `select pp.party_id, pp.relationship,
                  p.display_name, p.version as party_version,
                  lp.official_name, lp.version as legal_version
             from public.project_parties pp
             join public.parties p
               on p.workspace_id = pp.workspace_id and p.id = pp.party_id
             left join public.party_legal_profiles lp
               on lp.workspace_id = pp.workspace_id and lp.party_id = pp.party_id
            where pp.workspace_id = $1 and pp.project_id = $2 and pp.id = $3`,
          [workspaceId, projectId, input.projectPartyId]);
        if (pp.rows.length === 0) {
          throw invalid("Учасника проєкту не знайдено.",
            `signatories.${slot}.projectPartyId`, "not a participant of this project");
        }
        const party = pp.rows[0];

        const pc = await tx.query(
          `select full_name, role_title, version from public.party_contacts
            where workspace_id = $1 and id = $2 and party_id = $3`,
          [workspaceId, input.partyContactId, party.party_id]);
        if (pc.rows.length === 0) {
          throw invalid("Особу не знайдено серед контактів цього учасника.",
            `signatories.${slot}.partyContactId`, "not a contact of that party");
        }
        const contact = pc.rows[0];

        const useLegal = party.official_name !== null && party.official_name !== undefined;
        await tx.query(
          `insert into public.statutory_act_version_signatories
             (workspace_id, project_id, statutory_act_version_id, slot,
              project_party_id, party_id, party_relationship, party_contact_id,
              frozen_organization_name, frozen_organization_name_source,
              frozen_person_name, frozen_person_role_title,
              source_party_version, source_contact_version)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [workspaceId, projectId, versionId, slot,
           input.projectPartyId, party.party_id, party.relationship, input.partyContactId,
           useLegal ? party.official_name : party.display_name,
           useLegal ? "legal_profile_official_name" : "party_display_name",
           contact.full_name, contact.role_title,
           // The version of the record the NAME was taken from, matching
           // `frozen_organization_name_source`. Freezing the display name and
           // then recording the legal profile's version would make the pair
           // unreadable.
           Number(useLegal ? party.legal_version : party.party_version),
           Number(contact.version)]);
        // NOTHING IS WRITTEN FOR THE КВАЛІФІКАЦІЙНИЙ СЕРТИФІКАТ, and there is no
        // column to write it to. Allow-list item 10 establishes that технагляд
        // HOLDS one (ПКМУ № 903, п. 3); whether Додаток В has a slot for its
        // серія and номер is NOT established, and prohibition E bans the
        // adjacent «ким видана». `public.party_contacts` does not carry it in the
        // deployed database either (migration 0047 §11 item 5).
      }

      const view = await loadActVersionView(tx, workspaceId, versionId);
      if (!view) throw notFound;

      await recordAudit(tx, ctx, {
        action: "statutory_act_version.composed",
        object_type: "statutory_act_version", object_id: versionId,
        details: {
          statutoryActId, workStageId: stageId, stageClosureId,
          versionNo, predecessorVersionId,
          quantityLineCount: view.quantityLines.length,
          signatorySlots: view.signatories.map((s) => s.slot),
          decisionCount: view.decisions.length,
        },
      }, { organizationId: workspaceId });

      // NO OUTBOX ROW. technical/events/event-catalog.csv carries exactly ONE act
      // event — `statutory_act_version.frozen`, produced by
      // `bff.statutory_act_versions.freeze` — and no `…composed` row of any kind.
      // Enqueuing a topic the catalog does not carry would invent an event, so
      // composition is recorded in the audit trail and nowhere else.

      return { status: 201, body: { statutoryActId, version: view } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
