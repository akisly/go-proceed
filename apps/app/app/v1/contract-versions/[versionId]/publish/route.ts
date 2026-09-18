import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import {
  lineManifestHash, notFoundVersion, pinsFrom, requireDraft, validationFailed, workItemView, refuseUnlockableVersion,
} from "../../../../../src/lib/manual-baseline";
import {
  publishContractVersionRequest, type PublishContractVersionResponse,
} from "@goproceed/contracts";
import {
  withTenantTx, withIdempotency, recordAudit, enqueueOutbox, type Tx,
} from "@goproceed/database";

export const runtime = "nodejs";

/** Renumbering headroom. Guarded rather than assumed; see renumber() below. */
const POSITION_PARK_OFFSET = 1_000_000_000;

/**
 * `contract_versions.publish` — POST /v1/contract-versions/{versionId}/publish
 * (technical/openapi/scope-v0.1.csv:20; command, idempotency required, member
 * plane, governed by contracts.edit).
 *
 * THE REFUSAL IS THE DELIVERABLE. INV-083: no baseline is published in v0.1
 * without a bound requirement rule-version set, and this route and
 * import_batches.publish refuse on the same condition or the invariant holds on
 * neither. It cannot be a constraint — 0041:136-141 explains why: the importer
 * creates a version and its bindings in one transaction, so no deferred check
 * can express «a published version must already have a binding» without
 * breaking that transaction's own insert order.
 *
 * ORDER OF THE REFUSALS, and it is a choice: MOST TERMINAL FIRST.
 *   1. A newer baseline is already published for this contract. Nothing the
 *      caller does clears it — v0.1 has no contract_versions.remove and no
 *      renumbering path — so this draft is finished.
 *   2. No rule-version set is bound (INV-083). Clearable, but not by a refresh;
 *      the binding count does not depend on the lines, so it stays true after
 *      one.
 *   3. The confirmed line manifest is stale. Clearable by a refresh, which is
 *      exactly what its user action says.
 *   4. Bindings exist, lines carry work types, and NOT ONE line's work type is
 *      among the bound rule versions'. Clearable by binding more rules, like 2
 *      — and it comes LAST rather than beside 2 because it is a statement about
 *      the LINES, and a caller whose manifest is stale does not yet agree with
 *      the server about what the lines are. Telling such a caller which of its
 *      work types match nothing, computed over lines it has not seen, is an
 *      answer to a question it did not ask. Refresh first, then coverage.
 * Reversing 1 and 2 would send a caller to bind rules — an APPEND-ONLY act with
 * no undo in v0.1 — onto a draft that can never be published (M1 review
 * finding 4).
 *
 * PARTIAL non-coverage is NOT a refusal; it travels in the 201 and in the audit
 * record as `workTypeCoverage`. ADR-005 decision 2 asks for the uncovered list
 * «part of the command's output, not a report someone may run» and ADR-006
 * decision 4.2 for the unmatched work type to be «named in the command's
 * output»; neither asks for a refusal, and ADR-005 decision 1's sub-rule — «the
 * gate never refuses to record a fact» — is why. Refusing would also leave a
 * caller no escape but to clear the work type, trading a disclosed hole for a
 * silent one. The argument in full is above the refusal below.
 *
 * IDEMPOTENCY CLASS ledger_400d, matching import_batches.publish:46: publishing
 * a baseline fixes the money pool every later exposure slice is carved from,
 * and a replay of that command must stay answerable for the audit retention
 * window rather than the ordinary thirty days.
 *
 * WHAT THIS COMMAND DOES NOT RE-DERIVE. Every line's money was decided by
 * work_items.create/.update under the version's OWN pins, which migration 0042
 * freezes for the life of the version, so there is nothing here that could
 * recompute to a different number. The same reasoning
 * import_batches/publish/route.ts:180-183 gives for writing what validate
 * decided. INV-054's tolerance refusal likewise already happened, per line, at
 * the moment the line was typed — see deriveLine in src/lib/manual-baseline.ts.
 */
export const POST = commandRoute(publishContractVersionRequest, async (a) => {
  const versionId = a.params.versionId;
  if (!versionId) throw notFoundVersion(a.requestId);

  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const v = await tx.query(
      `select workspace_id, project_id, contract_id from public.contract_versions where id = $1`,
      [versionId]);
    if (v.rows.length === 0) throw notFoundVersion(a.requestId);
    const workspaceId: string = v.rows[0].workspace_id;
    const projectId: string = v.rows[0].project_id;
    const contractId: string = v.rows[0].contract_id;

    return withIdempotency<PublishContractVersionResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "contract_versions.publish", key: a.idempotencyKey,
      requestHash: a.requestHash, idempotencyClass: "ledger_400d",
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "contracts.edit" });
      },
    }, async () => {
      // Serialize publication per contract, on the SAME key and by the same
      // technique contract_versions.create uses to serialize numbering
      // (versions/route.ts:66-67). Without it the ordering check below is a read
      // of committed state under READ COMMITTED: two drafts of one contract
      // could pass it concurrently and land in the very order it exists to
      // forbid. Taken after the idempotency lock and before the row lock, which
      // is the order create takes them in, so the two commands cannot invert.
      //
      // WHAT IT DOES NOT COVER, said plainly: import_batches.publish numbers a
      // version and publishes it without taking this lock, so an import that
      // commits between this check and this transaction's own commit is still
      // not excluded. That route is frozen (ADR-006 decision 6) and is not
      // edited here; the lock it would have to take is the same one, on the same
      // key, and that is recorded as owed rather than reached across for.
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`cv|${workspaceId}|${contractId}`]);

      const locked = await tx.query(
        `select id, version_no, status, origin, supersedes_version_id,
                currency, tax_mode, tax_rate_bps,
                rounding_policy, source_tolerance_minor_units, source_tolerance_bps
           from public.contract_versions
          where workspace_id = $1 and id = $2 for update`,
        [workspaceId, versionId]);
      // An empty lock is not an absent version: a second publication of the
      // same version finds the row hidden from `for update` by cv_update's
      // USING, and 409 VERSION_CONFLICT is the catalogued answer for it. See
      // refuseUnlockableVersion.
      if (locked.rows.length === 0) {
        await refuseUnlockableVersion(tx, a.requestId, workspaceId, versionId);
      }
      const version = locked.rows[0];
      requireDraft(a.requestId, version.status);

      // ── PUBLICATION ORDER AND version_no ORDER MUST AGREE ────────────────
      // This command numbers nothing: contract_versions.create assigns
      // max(version_no)+1 at DRAFT time (versions/route.ts:75-79) while
      // import_batches.publish assigns it at PUBLISH time, in its own numbering
      // block. Open a draft N, let an import publish N+1, then publish the
      // draft, and the baseline agreed SECOND carries the LOWER number. Every
      // reader that asks for «the contract's current version» asks by `order by
      // version_no desc limit 1` over published rows — the assignments route is
      // the one that decides from it which lines an assignment may name — so the
      // newest agreement would be silently invisible, and two published versions
      // would both claim to supersede N-1.
      //
      // A REFUSAL AND NOT A RENUMBERING, and that is forced rather than
      // preferred: app.guard_contract_version() (0042 §2) permits publication to
      // change status, published_at, published_by and source_manifest_hash and
      // rejects any statement that touches another column, so version_no cannot
      // move here without widening the guard that keeps a baseline reproducible.
      //
      // IT IS REPORTED FIRST, ahead of INV-083 and ahead of the manifest. The
      // other two refusals are conditions the caller can clear on this draft;
      // this one never clears — there is no contract_versions.remove and no
      // renumbering path, so an overtaken draft is finished and the work
      // continues in a new one. Naming a clearable condition first would send the
      // caller to bind rules, which is APPEND-ONLY and has no undo, onto a draft
      // that can never be published.
      //
      // THE COST, STATED RATHER THAN HIDDEN: a hand-typed twenty-line draft that
      // loses this race is retyped, because v0.1 has no operation that copies a
      // draft and none that deletes one. That is a worse outcome for one caller
      // than publishing would have been for them — and a better one for the
      // contract, which would otherwise carry two published baselines where the
      // newest agreement is the one nothing reads.
      const overtaken = await tx.query(
        `select count(*)::int as n from public.contract_versions
          where workspace_id = $1 and contract_id = $2 and status = 'published'
            and version_no > $3`,
        [workspaceId, contractId, version.version_no]);
      if (Number(overtaken.rows[0].n) > 0) {
        // VERSION_CONFLICT with the catalog's own retryable and user action
        // (technical/error-catalog.csv:13). It is the catalog's contract-version
        // state code and it already carries the sibling case — requireDraft
        // raises it for a version that is past editing — and this is the same
        // kind of fact: the version's state relative to its contract has moved
        // past the point where publishing it means anything. The detail names no
        // number: the code's log policy is `versions_only`, contract_versions.get
        // is where a caller reads which version won, and every other detail in
        // this route is a constant rather than an uncatalogued parameterised
        // string (technical/copy-catalog.csv owns those and is not edited here).
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Договір уже має опубліковану версію, новішу за цю чернетку. "
          + "Чернетку не публікують після новішого базису — перенесіть виправлення в нову версію.",
          { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));
      }

      // ── INV-083 ──────────────────────────────────────────────────────────
      const bound = await tx.query(
        `select count(*)::int as n from public.contract_version_rule_bindings
          where workspace_id = $1 and contract_version_id = $2`, [workspaceId, versionId]);
      const boundRuleVersionCount = Number(bound.rows[0].n);
      if (boundRuleVersionCount === 0) {
        throw new HttpProblem(409, problem("RULE_BINDING_REQUIRED",
          "Базис не публікується без прив'язаного набору версій правил. "
          + "Прив'яжіть вимоги до цієї чернетки і повторіть публікацію.",
          { requestId: a.requestId, retryable: false,
            userAction: "bind_rule_versions_then_publish" }));
      }

      const rows = await tx.query(
        `select * from public.work_items
          where workspace_id = $1 and contract_version_id = $2 order by position`,
        [workspaceId, versionId]);
      if (rows.rows.length === 0) {
        // The frozen importer refuses an empty batch too — a validate run whose
        // rowCount is zero lands the batch in 'failed' rather than
        // 'preview_ready' (validate/route.ts:271-273). A baseline with no work
        // lines has an empty money pool and nothing for M2 to assign against.
        throw validationFailed(a.requestId,
          "Чернетка не містить жодної позиції робіт — публікувати нічого.", []);
      }

      const pins = pinsFrom(version);
      const items = rows.rows.map(workItemView);
      const manifest = lineManifestHash(pins, items);
      if (manifest !== a.body.confirmedManifestHash) {
        // The manifest is the concurrency guard, and a stronger one than a
        // counter: public.contract_versions has no `version` column, and this
        // names the CONTENT. Another typist correcting a line between review
        // and publication is caught here.
        throw new HttpProblem(409, problem("VERSION_CONFLICT",
          "Набір позицій змінився після перегляду. Оновіть чернетку, звірте і повторіть.",
          { requestId: a.requestId, retryable: true, userAction: "refresh_compare_retry" }));
      }

      // ── WHAT THE GATE WILL ACTUALLY REACH ────────────────────────────────
      // THE NARROW PREDICATE, ASKED AT THE ONLY MOMENT IT IS ANSWERABLE. A
      // line's work type is checked at typing time against the workspace's
      // published rule versions (work_items.create/.update, migration 0050 §4),
      // because a draft may legitimately have no bindings yet — bind_rules can
      // run after the last line is typed and nothing orders the two. The
      // question that actually decides whether a foreman will ever see an
      // obligation is narrower: does the line's work type match a rule version
      // THIS baseline bound? Both sets exist here and nowhere earlier, and a
      // published version is immutable (INV-015), so this is also the last
      // moment anyone can be told.
      //
      // Read through the BINDING and never by predicate over the rule table —
      // the same rule src/lib/requirement-materialisation.ts follows, and for
      // the same reasons: the baseline pins a set at publication (INV-080) and
      // a version retired afterwards does not leave it (INV-067). A rule table
      // read here would report coverage the materialisation cannot deliver.
      const boundKeys = new Set<string>((await tx.query(
        `select distinct rv.work_type_key
           from public.contract_version_rule_bindings b
           join public.requirement_rule_versions rv
             on rv.workspace_id = b.workspace_id and rv.id = b.requirement_rule_version_id
          where b.workspace_id = $1 and b.contract_version_id = $2`,
        [workspaceId, versionId])).rows.map((r) => String(r.work_type_key)));

      // POSITIONS AS THEY WILL BE AFTER RENUMBERING, not as they are now.
      // `items` is ordered by position and renumber() rewrites that same order
      // to 1..N, so the final position of items[i] is i + 1. Reporting the
      // pre-renumbering position would name a row number the caller will never
      // see again — publication renumbers in this transaction.
      const typed = items
        .map((w, i) => ({ position: i + 1, key: w.workTypeKey }))
        .filter((l): l is { position: number; key: string } => l.key !== null);
      const unmatchedPositions = typed
        .filter((l) => !boundKeys.has(l.key)).map((l) => l.position);
      const workTypeCoverage = {
        coveredLineCount: typed.length - unmatchedPositions.length,
        typedLineCount: typed.length,
        untypedLineCount: items.length - typed.length,
        unmatchedPositions,
      };

      // THE ONE CASE THAT IS REFUSED, and it is INV-083's hole one level in.
      // A version carrying bindings that NOT ONE of its typed lines can reach
      // has a gate that can never fire: every assignment materialises nothing,
      // every stage is empty, every closure is vacuous. INV-083 refuses «a
      // version that carries no binding»; this refuses a bound set no line
      // names, which is the same absence wearing a row. Same code, same 409,
      // same catalogued user action — `bind_rule_versions_then_publish` is
      // already the correct instruction (technical/error-catalog.csv:120).
      //
      // WHY A PARTIALLY UNCOVERED BASELINE IS **NOT** REFUSED, though it is the
      // obvious next step, AND WHY THAT IS NOT A GATE LEFT PARTLY DECORATIVE.
      // The objection deserves its strongest form: a baseline that publishes
      // with lines no bound rule reaches is a baseline over part of which no
      // obligation can ever materialise — which is the failure this whole slice
      // exists to end. The answer is ADR-005 decision 2's own, and it is not a
      // concession:
      //
      //   * ADR-005 decision 2 states the remedy for non-coverage and it is
      //     DISCLOSURE, in terms: «Silent non-coverage means there is no gate;
      //     the uncovered list is part of the command's output, not a report
      //     someone may run». SILENT is the word doing the work. The defect the
      //     decision names is non-coverage nobody is told about; the thing it
      //     requires is the list, in the output, unconditionally — which is
      //     exactly `workTypeCoverage`, computed above and carried in the 201
      //     AND in the audit row. ADR-006 decision 4.2 says the same for the
      //     same reason: «a work type with no matching rule must still be NAMED
      //     IN THE COMMAND'S OUTPUT». Neither ADR asks for a refusal, and both
      //     had the chance to.
      //   * ADR-005 decision 1's sub-rule is the reason they do not: «the gate
      //     never refuses to record a fact… The append-only progress ledger must
      //     always be able to record what actually happened». A published
      //     contract version IS the recorded fact — what the parties agreed the
      //     work is and what it is worth. Refusing to record an agreement
      //     because part of it carries no hidden-works obligation would put the
      //     gate in front of the record instead of in front of the conclusion
      //     and the presentation, which decision 1 reserves it for. The two acts
      //     GoProceed blocks are a stage CLOSURE and package ELIGIBILITY, and
      //     both still refuse over this baseline, per line, exactly as before.
      //   * And the refusal would be mechanically self-defeating: the only way a
      //     caller could clear it is to CLEAR the work type, because binding is
      //     append-only and the missing rule version may not exist in the
      //     library at all. STATED PRECISELY, because the loose form overstates
      //     it: a cleared line is still disclosed — as `work_type_unresolved`,
      //     in `untypedLineCount` — so this is not a trade of disclosure for
      //     silence. It is a trade of a disclosure that NAMES WHAT IS MISSING
      //     («position 7 is montazh-… and nothing bound covers it», which tells
      //     the workspace exactly which rule version its library owes) for one
      //     that names only an absence. The classification the ПТВ actually made
      //     is destroyed to satisfy the gate, and a gate that is satisfied by
      //     deleting the evidence against it is the decorative one.
      //
      // WHAT WOULD MAKE THE GATE DECORATIVE is a line whose non-coverage nobody
      // can see. After this command there is no such line: every unmatched
      // position is named here while the draft can still be changed, named again
      // per assignment (`coverage`) and per read (`requirement_occurrences.list`),
      // and the count survives in the audit row after the version is immutable.
      //
      // AN ALL-UNTYPED VERSION IS REFUSED TOO, and the earlier reasoning for
      // exempting it was wrong on its own terms. It read "that is every imported
      // baseline" — but the importer never reaches this route: it inserts an
      // already-published row through import-batches/[batchId]/publish, as this
      // route's own audit comment below says. Every version that arrives here is
      // manual-origin.
      //
      // Left as it was, the refusal was defeated by a one-field PATCH: clear the
      // work type on every line, `typedLineCount` falls to 0, the 409 vanishes,
      // and the version publishes immutably with a binding no line can reach —
      // every stage empty, every closure vacuous. That is precisely the state
      // this refusal exists to prevent, reached by the cheapest possible edit.
      //
      // So the qualifier is `boundRuleVersionCount > 0` instead: INV-083 has
      // already forced a binding onto every version reaching this point, and a
      // baseline that bound obligations no line can ever meet is not a baseline
      // with a disclosed hole — it is a baseline whose gate is decorative.
      // Partial non-coverage stays legal and disclosed, per ADR-006 decision
      // 4.2; only total disjointness is refused.
      if (boundRuleVersionCount > 0 && workTypeCoverage.coveredLineCount === 0) {
        throw new HttpProblem(409, problem("RULE_BINDING_REQUIRED",
          "Жодна позиція цієї чернетки не відповідає прив'язаним версіям правил: "
          + "види робіт у позиціях і прив'язаний набір не перетинаються. "
          + "Прив'яжіть версії правил для видів робіт цієї чернетки і повторіть публікацію.",
          { requestId: a.requestId, retryable: false,
            userAction: "bind_rule_versions_then_publish" }));
      }

      await renumber(tx, workspaceId, versionId, rows.rows.length);

      await tx.query(
        `update public.contract_versions
            set status = 'published', published_at = now(), published_by = $3,
                source_manifest_hash = $4
          where workspace_id = $1 and id = $2`,
        [workspaceId, versionId, a.userId, manifest]);
      // Exactly the four columns app.guard_contract_version() permits. Anything
      // else in this SET would be rejected by the guard, which is how the pins
      // and both party snapshots stay what they were when the draft was opened.

      await recordAudit(tx, ctx, {
        action: "contract_version.published", object_type: "contract_version",
        object_id: versionId,
        details: {
          versionNo: Number(version.version_no), workItemCount: items.length,
          // Read off the row, not asserted. Only contract_versions.create can
          // produce a draft today — `cv_insert` admits a draft under
          // contracts.edit and a published row under imports.publish — so this
          // is 'manual' in every reachable case, and an audit trail that states
          // a column's value rather than the route's assumption stays true if
          // that ever stops holding.
          boundRuleVersionCount, origin: version.origin,
          // THE HOLE, IN THE RECORD AND NOT ONLY IN THE RESPONSE. A response is
          // read once by whoever pressed publish; the audit row is what an
          // auditor reads afterwards, when the version is immutable and the
          // consequence — an empty obligation set on some lines — is permanent.
          // Positions, not descriptions: a line's text is commercial content
          // and the same restraint work_item.corrected applies to its `fields`
          // applies here.
          workTypeCoverage,
        },
      }, { organizationId: workspaceId, objectVersion: Number(version.version_no) });
      await enqueueOutbox(tx, ctx, {
        // Same topic the importer emits (technical/events/event-catalog.csv:7
        // names both producers): a consumer must not have to know which route
        // typed the baseline.
        topic: "contract_version.published", aggregate_type: "contract_version",
        aggregate_id: versionId, payload_version: 1,
        payload: {
          workspaceId, projectId, contractId, contractVersionId: versionId,
          versionNo: Number(version.version_no),
        },
      }, { organizationId: workspaceId });

      return {
        status: 201,
        body: {
          contractVersionId: versionId,
          versionNo: Number(version.version_no),
          workItemCount: items.length,
          boundRuleVersionCount,
          supersedesVersionId: version.supersedes_version_id ?? null,
          workTypeCoverage,
        },
      };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});

/**
 * Close the gaps work_items.remove leaves, so a published hand-typed baseline
 * carries 1..N exactly as an imported one does — the M1 exit gate is that the
 * two are indistinguishable, and a printed act numbered 1, 2, 4, 5 is
 * distinguishable at a glance.
 *
 * TWO PASSES, because one is not safe. `unique (workspace_id,
 * contract_version_id, position)` is a plain unique index, checked per row as
 * an UPDATE walks the relation, and the order in which it walks is not
 * guaranteed — a single statement that permutes positions can collide with a
 * value it has not rewritten yet. Parking every row in a disjoint range first
 * makes both statements collision-free regardless of order. The offset is
 * asserted rather than assumed: `position` is `integer`, and a draft whose
 * highest position is already past the park range would overflow silently.
 *
 * This runs BEFORE the status flip, while app.guard_work_item() still sees a
 * draft. Reversing the two would make publication reject its own renumbering.
 */
async function renumber(
  tx: Tx, workspaceId: string, versionId: string, expected: number,
): Promise<void> {
  const max = await tx.query(
    `select coalesce(max(position), 0) as p from public.work_items
      where workspace_id = $1 and contract_version_id = $2`, [workspaceId, versionId]);
  const highest = Number(max.rows[0].p);
  if (highest >= POSITION_PARK_OFFSET) {
    throw new Error(
      `publish invariant: contract version ${versionId} has a position beyond the renumbering range`);
  }
  // Positions are assigned max+1 and never reused, so `max === count` holds
  // exactly when the set is already 1..N with no gap.
  if (highest === expected) return;
  await tx.query(
    `update public.work_items set position = position + $3
      where workspace_id = $1 and contract_version_id = $2`,
    [workspaceId, versionId, POSITION_PARK_OFFSET]);
  await tx.query(
    `update public.work_items w set position = r.rn
       from (select id, row_number() over (order by position) as rn
               from public.work_items
              where workspace_id = $1 and contract_version_id = $2) r
      where w.workspace_id = $1 and w.id = r.id`,
    [workspaceId, versionId]);
}
