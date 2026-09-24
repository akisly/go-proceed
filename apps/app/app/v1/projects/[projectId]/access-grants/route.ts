import { commandRoute } from "../../../../../src/lib/command";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { grantProjectAccessRequest, type GrantProjectAccessResponse } from "@goproceed/contracts";
import { withTenantTx, withIdempotency, recordAudit } from "@goproceed/database";
import { projectAccessMemberLock } from "../../../../../src/lib/project-access-lock";
import { refuseEndNotAfterNow } from "../../../../../src/lib/grant-window";

export const runtime = "nodejs";

export const POST = commandRoute(grantProjectAccessRequest, async (a) => {
  const projectId = a.params.projectId;
  if (!projectId) {
    throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
      { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
  }
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const out = await withTenantTx(ctx, async (tx) => {
    const p = await tx.query(`select workspace_id from public.projects where id = $1`, [projectId]);
    if (p.rows.length === 0) {
      throw new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Проєкт не знайдено.",
        { requestId: a.requestId, retryable: false, userAction: "return_to_list" }));
    }
    const workspaceId: string = p.rows[0].workspace_id;
    return withIdempotency<GrantProjectAccessResponse>(tx, {
      organizationId: workspaceId, actorScope: `user:${a.userId}`,
      operationId: "project_access.grant", key: a.idempotencyKey, requestHash: a.requestHash,
      authorize: async () => {
        const m = await requireActiveMembership(tx, a.requestId, a.userId, workspaceId);
        await requireProjectCapability(tx, a.requestId,
          { workspaceId, projectId, memberId: m.memberId, capability: "project.admin" });
      },
    }, async () => {
      // DEV-053 / BL-148: first, so an end already past is 422 even where the grant would be a no-op.
      await refuseEndNotAfterNow(tx, a.requestId, a.body.validUntil);
      // Target must be an ACTIVE membership of the same workspace.
      const target = await tx.query(
        `select 1 from public.memberships where organization_id = $1 and id = $2 and status = 'active'`,
        [workspaceId, a.body.memberId]);
      if (target.rows.length === 0) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Отримувач має бути активним учасником цього робочого простору.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "memberId", message: "not an active member" }],
          }));
      }
      // Serialized with a revoke of the same member (DEV-043, INV-111): the
      // duplicate check below must see a project.view a concurrent cascade revoked.
      await projectAccessMemberLock(tx, projectId, a.body.memberId);
      // Plan decision 6: any action capability implies adding project.view.
      const caps = new Set(a.body.capabilities);
      if ([...caps].some((c) => c !== "project.view")) caps.add("project.view");
      const requestedUntil = a.body.validUntil ? new Date(a.body.validUntil) : null;

      // DEV-048 / BL-140 / INV-111: the member's project.view must cover every
      // unexpired action capability they hold here, the ones granted now
      // included. `null` is «no end»; `undefined` is «no action to cover».
      const actions = await tx.query<{ capability: string; until: Date | null }>(
        `select capability, valid_until as until from public.project_access_grants
          where workspace_id=$1 and project_id=$2 and member_id=$3 and capability <> 'project.view'
            and revoked_at is null and (valid_until is null or valid_until > now())`,
        [workspaceId, projectId, a.body.memberId]);
      const later = (x: Date | null, y: Date | null) => (x === null || y === null ? null : x > y ? x : y);
      const endOf = (xs: (Date | null)[]): Date | null | undefined => (xs.length === 0 ? undefined : xs.reduce(later));
      // The held actions' window; the ones this call inserts join it below.
      const required = endOf(actions.rows.map((r) => r.until));
      const ends = (until: Date | null, need: Date | null) => until === null || (need !== null && until >= need);

      // A project.view grant alone may not end before the actions it guards.
      if (a.body.capabilities.every((c) => c === "project.view") && required !== undefined
          && !ends(requestedUntil, required)) {
        throw new HttpProblem(422, problem("VALIDATION_FAILED",
          "Доступ до перегляду проєкту не може закінчитися раніше за інші права учасника на цьому проєкті.", {
            requestId: a.requestId, retryable: false, userAction: "correct_fields",
            fieldErrors: [{ path: "validUntil", message: "ends before the member's other capabilities on this project" }],
          }));
      }

      const granted: GrantProjectAccessResponse["granted"] = [];
      // Review R1-03: the request's own string is written for an action, not a
      // millisecond Date, so an action keeps the precision it was sent with.
      const insert = async (cap: string, until: Date | string | null) => {
        const r = await tx.query(
          `insert into public.project_access_grants
             (workspace_id, project_id, member_id, capability, granted_by, valid_until)
           values ($1,$2,$3,$4,$5,$6) returning id`,
          [workspaceId, projectId, a.body.memberId, cap, a.userId, until]);
        granted.push({ capability: cap, grantId: r.rows[0].id, validUntil: until instanceof Date ? until.toISOString() : until });
      };
      for (const cap of caps) {
        if (cap === "project.view") continue;
        const dup = await tx.query(
          `select 1 from public.project_access_grants
            where workspace_id=$1 and project_id=$2 and member_id=$3 and capability=$4
              and revoked_at is null`,
          [workspaceId, projectId, a.body.memberId, cap]);
        if (dup.rows.length > 0) continue; // idempotent per-capability (unique index guards races)
        await insert(cap, a.body.validUntil ?? null);
      }
      // gp-security S1-02: only the actions actually inserted widen the view. A
      // requested action skipped as a held duplicate (BL-146) does not.
      const insertedActions = granted.length > 0;

      // project.view: needed when the member holds or is now granted an
      // unexpired action, or a view is asked for. Kept when a live one already
      // ends no earlier than that need; otherwise the unrevoked one (lapsed, not
      // yet valid, or too short) is revoked and a covering one inserted. Never
      // shortened. The revoke is the same column write project_access.revoke
      // makes (0096), under the same member lock.
      const viewRequested = a.body.capabilities.includes("project.view");
      const need = endOf([
        ...(required === undefined ? [] : [required]),
        ...(viewRequested || insertedActions ? [requestedUntil] : []),
      ]);
      const view = await tx.query<{ id: string; live: boolean; starts: Date; until: Date | null }>(
        `select id, valid_from <= now() and (valid_until is null or valid_until > now()) as live,
                valid_from as starts, valid_until as until
           from public.project_access_grants
          where workspace_id=$1 and project_id=$2 and member_id=$3 and capability='project.view' and revoked_at is null
            for update`,
        [workspaceId, projectId, a.body.memberId]);
      const current = view.rows[0];
      const replacedGrantIds: string[] = [];
      let replaced: { starts: Date; until: Date | null } | undefined;
      // Nothing to cover and no view asked for: the view is left as it is.
      if (need !== undefined && (!current || !current.live || !ends(current.until, need))) {
        if (current) {
          const r = await tx.query(
            `update public.project_access_grants set revoked_at = now(), version = version + 1
              where workspace_id=$1 and project_id=$2 and id=$3 and revoked_at is null`,
            [workspaceId, projectId, current.id]);
          if (r.rowCount !== 1) {
            throw new HttpProblem(409, problem("VERSION_CONFLICT",
              "Доступ змінився під час надання. Оновіть дані та повторіть спробу.", {
                requestId: a.requestId, retryable: false, userAction: "refresh_compare_retry",
              }));
          }
          replacedGrantIds.push(current.id);
          replaced = { starts: current.starts, until: current.until };
        }
        // A longer current view keeps the longer end: `need` never shortens it.
        // Review R1-01: a view not yet valid — one a concurrent grant committed
        // after this transaction's now() — counts too; for a lapsed one `need`
        // (null or after now()) is always the later.
        const viewUntil = current ? later(current.until, need) : need;
        // Review R2-01: when the end is the request's own, write the request's
        // string, as the action was written, so the view never ends a fraction
        // of a millisecond before it.
        await insert("project.view", viewUntil !== null && viewUntil === requestedUntil ? a.body.validUntil! : viewUntil);
      }
      await recordAudit(tx, ctx, {
        action: "project_access.granted", object_type: "project",
        object_id: projectId, details: {
          memberId: a.body.memberId, capabilities: [...caps],
          // gp-security S1-03: what was written, the window asked for, and a replaced view's ends.
          grantIds: granted.map((g) => g.grantId), validUntil: a.body.validUntil ?? null,
          ...(replacedGrantIds.length > 0 ? {
            replacedGrantIds,
            view: {
              grantId: granted.find((g) => g.capability === "project.view")!.grantId,
              // gp-security S2-02: a view that had not started yet is visible here.
              replacedValidFrom: replaced!.starts.toISOString(),
              replacedValidUntil: replaced!.until?.toISOString() ?? null,
            },
          } : {}),
        },
      }, { organizationId: workspaceId });
      return { status: 201, body: { granted } };
    });
  });
  return { status: out.status, body: out.body, expiresAt: out.expiresAt };
});
