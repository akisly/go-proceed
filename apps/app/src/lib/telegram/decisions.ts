import { createHash, randomBytes, randomUUID } from "node:crypto";
import { withServiceTx } from "@goproceed/database";
import { createTelegramApiClient } from "./api";
import { loadTelegramConfig } from "./config";
import { enqueueTelegramMessage } from "./delivery";
import { formatEvidenceDecisionActions } from "./cards";
import { recordEvidenceDecision } from "../evidence/record-evidence-decision";
import type { NormalizedTelegramUpdate } from "./normalize";

const DECISION_CALLBACK_PREFIX = "dec:";
const TOKEN_TTL_HOURS = 24;
const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const context = (workspaceId: string | null) => ({ actorUserId: "", organizationId: workspaceId, requestId: randomUUID() });

export function isTelegramDecisionCallback(data: string | null): boolean {
  return data !== null && /^dec:[A-Za-z0-9_-]{20,}$/.test(data);
}

export async function issueTelegramEvidenceDecisionCallbacks(input: {
  workspaceId: string; projectId: string; telegramChatBindingId: string; occurrenceId: string;
}): Promise<void> {
  const accepted = token(); const returned = token();
  await withServiceTx(context(input.workspaceId), async (tx) => {
    const available = await tx.query<{ work_assignment_id: string }>("select * from app.resolve_telegram_evidence_decision_context($1::uuid,$2::uuid,$3::uuid,$4::uuid)",
      [input.workspaceId,input.projectId,input.telegramChatBindingId,input.occurrenceId]);
    if (!available.rows[0]) return;
    const existing = await tx.query("select id from public.telegram_evidence_decision_tokens where workspace_id=$1 and telegram_chat_binding_id=$2 and requirement_occurrence_id=$3 and consumed_at is null limit 1",
      [input.workspaceId,input.telegramChatBindingId,input.occurrenceId]);
    if (existing.rows[0]) return;
    const controls = formatEvidenceDecisionActions({ acceptedCallback: `${DECISION_CALLBACK_PREFIX}${accepted}`, returnedCallback: `${DECISION_CALLBACK_PREFIX}${returned}` });
    const message = await enqueueTelegramMessage(tx, context(input.workspaceId), {
      workspaceId: input.workspaceId, projectId: input.projectId, telegramChatBindingId: input.telegramChatBindingId,
      workAssignmentId: available.rows[0].work_assignment_id, kind: "text", text: controls.text, inlineKeyboard: controls.inlineKeyboard,
    });
    for (const [action, raw] of [["accepted", accepted], ["returned", returned]] as const) {
      await tx.query(`insert into public.telegram_evidence_decision_tokens
        (workspace_id,project_id,telegram_chat_binding_id,requirement_occurrence_id,action,token_hash,expires_at,decision_message_id)
        values ($1,$2,$3,$4,$5::public.telegram_evidence_decision_action,$6,now()+interval '24 hours',$7)`,
      [input.workspaceId,input.projectId,input.telegramChatBindingId,input.occurrenceId,action,tokenHash(raw),message.messageId]);
    }
  });
}

type Callback = Extract<NormalizedTelegramUpdate, { kind: "callback_query" }>;
type TokenRow = { id: string; workspace_id: string; project_id: string; telegram_chat_binding_id: string;
  requirement_occurrence_id: string; actor_user_id: string; actor_member_id: string; action: "accepted" | "returned";
  consumed_at: string | null; return_prompt_message_id: string | null; work_assignment_id: string };

async function callbackToken(update: Callback): Promise<TokenRow | null> {
  const callbackData = update.data;
  if (update.chatId === null || callbackData === null) return null;
  const config = loadTelegramConfig();
  return withServiceTx(context(null), async (tx) => {
    const rows = await tx.query<TokenRow>("select * from app.claim_telegram_evidence_decision_token($1::text,$2::bigint,$3::bigint,$4::bigint)",
      [tokenHash(callbackData.slice(DECISION_CALLBACK_PREFIX.length)), config.botId, update.chatId, update.senderId]);
    return rows.rows[0] ?? null;
  });
}

/** Always acknowledges exactly once, including rejected, replayed, and failed callbacks. */
export async function processTelegramDecisionCallback(update: Callback, injectedApi?: { answerCallbackQuery(input: { callbackId: string; text: string }): Promise<unknown> }): Promise<string> {
  let answered = false;
  let api = injectedApi;
  const answer = async (text: string) => {
    if (answered) return; answered = true;
    if (api) await api.answerCallbackQuery({ callbackId: update.callbackId, text }).catch(() => undefined);
  };
  try {
    // Construct inside the guarded boundary. Tests inject this one narrow API
    // edge so a config/client failure cannot create a second acknowledgement.
    api ??= createTelegramApiClient(loadTelegramConfig());
    if (!isTelegramDecisionCallback(update.data)) { await answer("Дія недійсна або вже використана."); return "ignored_callback_query"; }
    const row = await callbackToken(update);
    if (!row) { await answer("Дія недійсна або вже використана."); return "decision_callback_rejected"; }
    if (row.action === "returned") {
      if (row.return_prompt_message_id !== null || row.consumed_at !== null) { await answer("Надайте причину у відповіді на повідомлення бота."); return "reason_required"; }
      await withServiceTx(context(row.workspace_id), async (tx) => {
        // The token row remains locked through message + outbox creation. A
        // concurrent callback observes the persisted prompt rather than
        // enqueueing a second one after its earlier callback claim committed.
        const current = await tx.query<{ return_prompt_message_id: string | null; consumed_at: string | null }>(
          "select return_prompt_message_id,consumed_at from public.telegram_evidence_decision_tokens where id=$1 for update", [row.id]);
        if (!current.rows[0] || current.rows[0].return_prompt_message_id !== null || current.rows[0].consumed_at !== null) return false;
        const prompt = await enqueueTelegramMessage(tx, context(row.workspace_id), {
          workspaceId: row.workspace_id, projectId: row.project_id, telegramChatBindingId: row.telegram_chat_binding_id,
          workAssignmentId: row.work_assignment_id, kind: "text", text: "Вкажіть причину повернення у відповіді на це повідомлення.",
        });
        await tx.query("update public.telegram_evidence_decision_tokens set return_prompt_message_id=$2 where id=$1", [row.id,prompt.messageId]);
        return true;
      });
      await answer("Вкажіть причину у відповіді на повідомлення бота."); return "reason_required";
    }
    if (row.consumed_at !== null) { await answer("Рішення вже зафіксовано."); return "decision_replayed"; }
    // Read immediately before the service call; it repeats capability and
    // self-decision checks under the linked PTV actor's tenant transaction.
    const head = await withServiceTx(context(row.workspace_id), async (tx) => tx.query<{ version: string }>(`select h.version::text from public.requirement_evidence_decision_heads h
      join public.requirement_occurrences o on o.workspace_id=h.workspace_id and o.id=h.requirement_occurrence_id
      where h.workspace_id=$1 and h.requirement_occurrence_id=$2 and h.approver_role=o.approver_role`, [row.workspace_id,row.requirement_occurrence_id]));
    const expectedVersion = head.rows[0] ? Number(head.rows[0].version) : null;
    const result = await recordEvidenceDecision({ actorUserId: row.actor_user_id, requestId: randomUUID(), occurrenceId: row.requirement_occurrence_id,
      body: { outcome: "accepted", issues: [], expectedVersion }, idempotencyKey: `telegram-decision:${row.id}`, requestHash: tokenHash(`${row.id}:accepted`) });
    await withServiceTx(context(row.workspace_id), async (tx) => tx.query("update public.telegram_evidence_decision_tokens set consumed_at=now(),decision_id=$2 where id=$1 and consumed_at is null", [row.id,(result.body as { decisionId: string }).decisionId]));
    await answer("Рішення зафіксовано."); return "decision_accepted";
  } catch {
    await answer("Не вдалося виконати дію. Спробуйте ще раз."); return "decision_callback_failed";
  }
}

/** A normal message is a decision only when it replies to this exact durable bot prompt. */
export async function processTelegramDecisionReturnReply(input: {
  workspaceId: string; telegramChatBindingId: string; senderId: string; replyToMessageId: string | null; text: string | null;
}): Promise<string | null> {
  const reason = input.text?.trim();
  if (input.replyToMessageId === null || !reason) return null;
  const row = await withServiceTx(context(input.workspaceId), async (tx) => {
    const rows = await tx.query<TokenRow>(`select t.id,t.workspace_id,t.project_id,t.telegram_chat_binding_id,t.requirement_occurrence_id,t.actor_user_id,t.actor_member_id,t.action,t.consumed_at,t.return_prompt_message_id,o.work_assignment_id
      from public.telegram_evidence_decision_tokens t join public.communication_messages p on p.id=t.return_prompt_message_id and p.workspace_id=t.workspace_id and p.project_id=t.project_id and p.telegram_chat_binding_id=t.telegram_chat_binding_id and p.direction='outbound' and p.provider_message_id is not null
      join public.requirement_occurrences o on o.workspace_id=t.workspace_id and o.id=t.requirement_occurrence_id
      join public.telegram_member_links l on l.workspace_id=t.workspace_id and l.member_id=t.actor_member_id and l.telegram_user_id=$3::bigint and l.revoked_at is null
      join public.memberships m on m.organization_id=t.workspace_id and m.id=l.member_id and m.user_id=t.actor_user_id and m.status='active'
      where t.workspace_id=$1 and t.telegram_chat_binding_id=$2 and p.provider_message_id=$4::bigint and t.action='returned'
        and t.consumed_at is null and t.expires_at>now() for update`, [input.workspaceId,input.telegramChatBindingId,input.senderId,input.replyToMessageId]);
    return rows.rows[0] ?? null;
  });
  if (!row) return null;
  try {
  const head = await withServiceTx(context(row.workspace_id), async (tx) => tx.query<{ version: string }>(`select h.version::text from public.requirement_evidence_decision_heads h join public.requirement_occurrences o on o.workspace_id=h.workspace_id and o.id=h.requirement_occurrence_id
    where h.workspace_id=$1 and h.requirement_occurrence_id=$2 and h.approver_role=o.approver_role`, [row.workspace_id,row.requirement_occurrence_id]));
  const result = await recordEvidenceDecision({ actorUserId: row.actor_user_id, requestId: randomUUID(), occurrenceId: row.requirement_occurrence_id,
    body: { outcome: "returned", reason, issues: [], expectedVersion: head.rows[0] ? Number(head.rows[0].version) : null },
    idempotencyKey: `telegram-decision:${row.id}`, requestHash: tokenHash(`${row.id}:returned:${reason}`) });
  await withServiceTx(context(row.workspace_id), async (tx) => tx.query("update public.telegram_evidence_decision_tokens set consumed_at=now(),decision_id=$2 where id=$1 and consumed_at is null", [row.id,(result.body as { decisionId: string }).decisionId]));
  return "decision_returned";
  } catch {
    // A return's authorization/self-decision/stale conflict is terminal for
    // this inbound reply. It stays normal chat history and cannot poison the
    // leased inbox into blind retries.
    return "decision_return_rejected";
  }
}
