import { createHash, randomBytes, randomUUID } from "node:crypto";
import { withServiceTx, withTenantTx } from "@goproceed/database";
import { createTelegramApiClient, type TelegramApiClient } from "./api";
import { loadTelegramConfig } from "./config";
import { enqueueTelegramMessage } from "./delivery";
import { formatEvidenceDecisionActions } from "./cards";
import { recordEvidenceDecision } from "../evidence/record-evidence-decision";
import { HttpProblem } from "../http";
import type { NormalizedTelegramUpdate } from "./normalize";

const DECISION_CALLBACK_PREFIX = "dec:";
const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const context = (workspaceId: string | null) => ({ actorUserId: "", organizationId: workspaceId, requestId: randomUUID() });

export function isTelegramDecisionCallback(data: string | null): boolean {
  return data !== null && /^dec:[A-Za-z0-9_-]{20,}$/.test(data);
}

/**
 * Publish one durable control message and its two opaque actions. The advisory
 * lock acquired by the first RPC lives until this outer transaction commits,
 * so concurrent receipt reconciliation cannot enqueue a second keyboard.
 */
export async function issueTelegramEvidenceDecisionCallbacks(input: {
  workspaceId: string; projectId: string; telegramChatBindingId: string; occurrenceId: string;
}): Promise<void> {
  const accepted = token();
  const returned = token();
  await withServiceTx(context(input.workspaceId), async (tx) => {
    const prepared = await tx.query<{ work_assignment_id: string; already_issued: boolean }>(
      "select * from app.prepare_telegram_evidence_decision_issue($1::uuid,$2::uuid,$3::uuid,$4::uuid)",
      [input.workspaceId, input.projectId, input.telegramChatBindingId, input.occurrenceId],
    );
    const row = prepared.rows[0];
    if (!row || row.already_issued) return;
    const controls = formatEvidenceDecisionActions({
      acceptedCallback: `${DECISION_CALLBACK_PREFIX}${accepted}`,
      returnedCallback: `${DECISION_CALLBACK_PREFIX}${returned}`,
    });
    const message = await enqueueTelegramMessage(tx, context(input.workspaceId), {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      telegramChatBindingId: input.telegramChatBindingId,
      workAssignmentId: row.work_assignment_id,
      kind: "text",
      text: controls.text,
      inlineKeyboard: controls.inlineKeyboard,
    });
    const issued = await tx.query<{ issued: boolean }>(
      "select app.issue_telegram_evidence_decision_tokens($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::text,$7::text) as issued",
      [input.workspaceId, input.projectId, input.telegramChatBindingId, input.occurrenceId,
        message.messageId, tokenHash(accepted), tokenHash(returned)],
    );
    if (issued.rows[0]?.issued !== true) throw new Error("telegram_decision_issue_raced");
  });
}

type Callback = Extract<NormalizedTelegramUpdate, { kind: "callback_query" }>;
export type TelegramDecisionTokenRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  telegram_chat_binding_id: string;
  requirement_occurrence_id: string;
  actor_user_id: string;
  actor_member_id: string;
  action: "accepted" | "returned";
  consumed_at: string | null;
  return_prompt_message_id: string | null;
  work_assignment_id: string;
};

type DecisionResult = Awaited<ReturnType<typeof recordEvidenceDecision>>;
type ReturnReplyInput = {
  workspaceId: string;
  telegramChatBindingId: string;
  senderId: string;
  messageId: string;
  replyToMessageId: string | null;
  text: string | null;
};

export type TelegramDecisionDependencies = {
  botId?: string;
  api?: Pick<TelegramApiClient, "answerCallbackQuery">;
  createApi?: () => { botId: string; api: Pick<TelegramApiClient, "answerCallbackQuery"> };
  claimToken?: (update: Callback, botId: string) => Promise<TelegramDecisionTokenRow | null>;
  enqueueReturnPrompt?: (row: TelegramDecisionTokenRow) => Promise<"prompted" | "already_prompted" | "rejected">;
  resolveReturnReply?: (input: ReturnReplyInput) => Promise<TelegramDecisionTokenRow | null>;
  readHeadVersion?: (row: TelegramDecisionTokenRow) => Promise<number | null>;
  recordDecision?: typeof recordEvidenceDecision;
  finalizeDecision?: (row: TelegramDecisionTokenRow, decisionId: string) => Promise<void>;
};

async function claimToken(update: Callback, botId: string): Promise<TelegramDecisionTokenRow | null> {
  const callbackData = update.data;
  if (update.chatId === null || callbackData === null) return null;
  return withServiceTx(context(null), async (tx) => {
    const rows = await tx.query<TelegramDecisionTokenRow>(
      "select * from app.claim_telegram_evidence_decision_token($1::text,$2::bigint,$3::bigint,$4::bigint,$5::bigint)",
      [tokenHash(callbackData.slice(DECISION_CALLBACK_PREFIX.length)), botId, update.chatId, update.senderId, update.messageId],
    );
    return rows.rows[0] ?? null;
  });
}

async function enqueueReturnPrompt(row: TelegramDecisionTokenRow): Promise<"prompted" | "already_prompted" | "rejected"> {
  return withServiceTx(context(row.workspace_id), async (tx) => {
    const prepared = await tx.query<{ work_assignment_id: string; already_prompted: boolean }>(
      "select * from app.prepare_telegram_decision_return_prompt($1::uuid,$2::uuid)",
      [row.id, row.actor_member_id],
    );
    const target = prepared.rows[0];
    if (!target) return "rejected";
    if (target.already_prompted) return "already_prompted";
    const prompt = await enqueueTelegramMessage(tx, context(row.workspace_id), {
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      telegramChatBindingId: row.telegram_chat_binding_id,
      workAssignmentId: target.work_assignment_id,
      kind: "text",
      text: "Вкажіть причину повернення у відповіді на це повідомлення.",
    });
    const bound = await tx.query<{ bound: boolean }>(
      "select app.bind_telegram_decision_return_prompt($1::uuid,$2::uuid,$3::uuid) as bound",
      [row.id, row.actor_member_id, prompt.messageId],
    );
    if (bound.rows[0]?.bound !== true) throw new Error("telegram_decision_prompt_raced");
    return "prompted";
  });
}

async function resolveReturnReply(input: ReturnReplyInput): Promise<TelegramDecisionTokenRow | null> {
  if (input.replyToMessageId === null) return null;
  return withServiceTx(context(input.workspaceId), async (tx) => {
    const rows = await tx.query<TelegramDecisionTokenRow>(
      "select * from app.reserve_telegram_evidence_return_reply($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::bigint)",
      [input.workspaceId, input.telegramChatBindingId, input.senderId, input.messageId, input.replyToMessageId],
    );
    return rows.rows[0] ?? null;
  });
}

async function readHeadVersion(row: TelegramDecisionTokenRow): Promise<number | null> {
  return withTenantTx({ actorUserId: row.actor_user_id, organizationId: row.workspace_id, requestId: randomUUID() }, async (tx) => {
    const head = await tx.query<{ version: string }>(`select h.version::text
      from public.requirement_evidence_decision_heads h
      join public.requirement_occurrences o on o.workspace_id=h.workspace_id and o.id=h.requirement_occurrence_id
      where h.workspace_id=$1 and h.requirement_occurrence_id=$2 and h.approver_role=o.approver_role`,
    [row.workspace_id, row.requirement_occurrence_id]);
    return head.rows[0] ? Number(head.rows[0].version) : null;
  });
}

async function finalizeDecision(row: TelegramDecisionTokenRow, decisionId: string): Promise<void> {
  await withServiceTx(context(row.workspace_id), async (tx) => {
    const finalized = await tx.query<{ finalized: boolean }>(
      "select app.finalize_telegram_evidence_decision_token($1::uuid,$2::uuid,$3::uuid) as finalized",
      [row.id, row.actor_member_id, decisionId],
    );
    if (finalized.rows[0]?.finalized !== true) throw new Error("telegram_decision_finalize_rejected");
  });
}

function decisionId(result: DecisionResult): string {
  const value = (result.body as { decisionId?: unknown }).decisionId;
  if (typeof value !== "string") throw new Error("telegram_decision_result_invalid");
  return value;
}

function permanentDecisionFailure(error: unknown): boolean {
  return error instanceof HttpProblem && error.status >= 400 && error.status < 500;
}

function runtime(deps: TelegramDecisionDependencies): {
  botId: string; api: Pick<TelegramApiClient, "answerCallbackQuery">;
} {
  if (deps.api && deps.botId) return { api: deps.api, botId: deps.botId };
  if (deps.createApi) return deps.createApi();
  const config = loadTelegramConfig();
  return { botId: config.botId, api: createTelegramApiClient(config) };
}

/**
 * Every returned disposition has exactly one successful acknowledgement call.
 * Provider/config failures and transient infrastructure failures are surfaced
 * so the durable inbox can retry instead of recording a false success.
 */
export async function processTelegramDecisionCallback(
  update: Callback,
  deps: TelegramDecisionDependencies = {},
): Promise<string> {
  const activeRuntime = runtime(deps);
  let acknowledged = false;
  const acknowledge = async (text: string) => {
    if (acknowledged) throw new Error("telegram_callback_acknowledged_twice");
    acknowledged = true;
    await activeRuntime.api.answerCallbackQuery({ callbackId: update.callbackId, text });
  };
  const claim = deps.claimToken ?? claimToken;
  const prompt = deps.enqueueReturnPrompt ?? enqueueReturnPrompt;
  const head = deps.readHeadVersion ?? readHeadVersion;
  const record = deps.recordDecision ?? recordEvidenceDecision;
  const finalize = deps.finalizeDecision ?? finalizeDecision;

  try {
    if (!isTelegramDecisionCallback(update.data)) {
      await acknowledge("Дія недійсна або вже використана.");
      return "ignored_callback_query";
    }
    const row = await claim(update, activeRuntime.botId);
    if (!row) {
      await acknowledge("Дія недійсна або вже використана.");
      return "decision_callback_rejected";
    }
    if (row.action === "returned") {
      const outcome = await prompt(row);
      await acknowledge(outcome === "rejected"
        ? "Дія недійсна або вже використана."
        : "Вкажіть причину у відповіді на повідомлення бота.");
      return outcome === "rejected" ? "decision_callback_rejected" : "reason_required";
    }
    if (row.consumed_at !== null) {
      await acknowledge("Рішення вже зафіксовано.");
      return "decision_replayed";
    }
    const expectedVersion = await head(row);
    const result = await record({
      actorUserId: row.actor_user_id,
      requestId: randomUUID(),
      occurrenceId: row.requirement_occurrence_id,
      body: { outcome: "accepted", issues: [], expectedVersion },
      idempotencyKey: `telegram-decision:${row.id}`,
      requestHash: tokenHash(`${row.id}:accepted`),
    });
    await finalize(row, decisionId(result));
    await acknowledge("Рішення зафіксовано.");
    return "decision_accepted";
  } catch (error) {
    if (acknowledged) throw error;
    if (permanentDecisionFailure(error)) {
      await acknowledge("Дія недійсна або вже використана.");
      return "decision_callback_rejected";
    }
    await acknowledge("Не вдалося виконати дію. Спробуйте ще раз.");
    throw error;
  }
}

/** A normal message is a decision only when it replies to this exact delivered bot prompt. */
export async function processTelegramDecisionReturnReply(
  input: ReturnReplyInput,
  deps: TelegramDecisionDependencies = {},
): Promise<string | null> {
  const reason = input.text?.trim();
  if (input.replyToMessageId === null || !reason) return null;
  const resolve = deps.resolveReturnReply ?? resolveReturnReply;
  const head = deps.readHeadVersion ?? readHeadVersion;
  const record = deps.recordDecision ?? recordEvidenceDecision;
  const finalize = deps.finalizeDecision ?? finalizeDecision;
  const row = await resolve(input);
  if (!row) return null;
  try {
    const expectedVersion = await head(row);
    const result = await record({
      actorUserId: row.actor_user_id,
      requestId: randomUUID(),
      occurrenceId: row.requirement_occurrence_id,
      body: { outcome: "returned", reason, issues: [], expectedVersion },
      idempotencyKey: `telegram-decision:${row.id}`,
      requestHash: tokenHash(`${row.id}:returned:${reason}`),
    });
    await finalize(row, decisionId(result));
    return "decision_returned";
  } catch (error) {
    if (permanentDecisionFailure(error)) return "decision_return_rejected";
    throw error;
  }
}
