import { assignmentCardResponse } from "@goproceed/contracts";
import { withIdempotency, withServiceTx, withTenantTx } from "@goproceed/database";
import { z } from "zod";
import { requireActiveMembership, requireProjectCapability } from "../../../../../src/lib/authz";
import { commandRoute } from "../../../../../src/lib/command";
import { HttpProblem, problem } from "../../../../../src/lib/http";
import { formatAssignmentCard } from "../../../../../src/lib/telegram/cards";
import { loadTelegramConfig } from "../../../../../src/lib/telegram/config";
import { enqueueTelegramMessage } from "../../../../../src/lib/telegram/delivery";

export const runtime = "nodejs";

const request = z.object({}).strict();

function notFound(requestId: string): HttpProblem {
  return new HttpProblem(404, problem("RESOURCE_NOT_FOUND", "Завдання не знайдено.", {
    requestId, retryable: false, userAction: "return_to_list",
  }));
}

function unavailable(requestId: string): HttpProblem {
  return new HttpProblem(409, problem("VERSION_CONFLICT", "Активний канал Telegram для проєкту недоступний.", {
    requestId, retryable: true, userAction: "refresh_compare_retry",
  }));
}

async function authorizeAssignment(
  tx: Parameters<typeof requireActiveMembership>[0], requestId: string, userId: string, assignmentId: string,
): Promise<{ workspaceId: string; projectId: string; memberId: string }> {
  const assignment = await tx.query<{ workspace_id: string; project_id: string }>(
    "select workspace_id, project_id from public.work_assignments where id=$1", [assignmentId]);
  const row = assignment.rows[0];
  if (!row) throw notFound(requestId);
  const member = await requireActiveMembership(tx, requestId, userId, row.workspace_id);
  await requireProjectCapability(tx, requestId, {
    workspaceId: row.workspace_id, projectId: row.project_id, memberId: member.memberId, capability: "project.view",
  });
  await requireProjectCapability(tx, requestId, {
    workspaceId: row.workspace_id, projectId: row.project_id, memberId: member.memberId, capability: "assignments.manage",
  });
  return { workspaceId: row.workspace_id, projectId: row.project_id, memberId: member.memberId };
}

export const POST = commandRoute(request, async (a) => {
  const assignmentId = a.params.assignmentId;
  if (!assignmentId) throw notFound(a.requestId);
  const ctx = { actorUserId: a.userId, organizationId: null, requestId: a.requestId };
  const authorized = await withTenantTx(ctx, (tx) => authorizeAssignment(tx, a.requestId, a.userId, assignmentId));

  const result = await withServiceTx(ctx, async (tx) => withIdempotency(tx, {
    organizationId: authorized.workspaceId,
    actorScope: `user:${a.userId}`,
    operationId: "assignment_communication_cards.publish",
    key: a.idempotencyKey,
    requestHash: a.requestHash,
  }, async () => {
    await authorizeAssignment(tx, a.requestId, a.userId, assignmentId);
    const config = loadTelegramConfig();
    const binding = await tx.query<{ id: string }>(`select b.id
      from public.work_assignments a
      join public.projects p on p.workspace_id=a.workspace_id and p.id=a.project_id
      join public.project_field_channels c on c.workspace_id=a.workspace_id and c.project_id=a.project_id
      join public.telegram_chat_bindings b on b.workspace_id=a.workspace_id and b.project_id=a.project_id
      where a.id=$1 and a.workspace_id=$2 and p.status='active' and c.channel='telegram'
        and c.state='active' and c.locked_at is not null and b.disconnected_at is null and b.bot_id=$3::bigint
      for update of b, c`, [assignmentId, authorized.workspaceId, config.botId]);
    const telegramChatBindingId = binding.rows[0]?.id;
    if (!telegramChatBindingId) throw unavailable(a.requestId);

    const assignment = await tx.query<{ description: string }>(`select w.description
      from public.work_assignments a join public.work_items w on w.workspace_id=a.workspace_id and w.id=a.work_item_id
      where a.id=$1 and a.workspace_id=$2 and a.project_id=$3`,
    [assignmentId, authorized.workspaceId, authorized.projectId]);
    const title = assignment.rows[0]?.description;
    if (!title) throw notFound(a.requestId);
    const occurrences = await tx.query<{ id: string; criterion: string; norm_ref: string | null }>(`select id,
      acceptance_criterion as criterion, norm_ref
      from public.requirement_occurrences where workspace_id=$1 and project_id=$2 and work_assignment_id=$3
      order by case timing when 'before_work' then 1 when 'during' then 2 when 'before_concealment' then 3
                            when 'after' then 4 when 'before_package' then 5 end, ordinal, id`,
    [authorized.workspaceId, authorized.projectId, assignmentId]);
    const card = formatAssignmentCard({
      assignmentId, title,
      occurrences: occurrences.rows.map((occurrence) => ({
        occurrenceId: occurrence.id, criterion: occurrence.criterion,
        normRef: occurrence.norm_ref ?? "Нормативне посилання не вказано",
      })),
    });
    const queued = await enqueueTelegramMessage(tx, ctx, {
      workspaceId: authorized.workspaceId, projectId: authorized.projectId, telegramChatBindingId,
      workAssignmentId: assignmentId, kind: "assignment_card", text: card.text,
    });
    return { status: 201, body: assignmentCardResponse.parse({ ...queued, assignmentId }) };
  }));

  return { status: result.status, body: result.body, expiresAt: result.expiresAt };
});
