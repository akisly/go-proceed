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
  reviewSource: { kind: "attachment" | "media_group"; id: string; generation: number };
}): Promise<"issued" | "already_issued" | "skipped"> {
  const accepted = token();
  const returned = token();
  return withServiceTx(context(input.workspaceId), async (tx) => {
    const prepared = await tx.query<{ work_assignment_id: string; already_issued: boolean }>(
      `select * from app.prepare_telegram_evidence_decision_issue(
        $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::uuid,$7::bigint)`,
      [input.workspaceId, input.projectId, input.telegramChatBindingId, input.occurrenceId,
        input.reviewSource.kind, input.reviewSource.id, input.reviewSource.generation],
    );
    const row = prepared.rows[0];
    if (!row) return "skipped";
    if (row.already_issued) return "already_issued";
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
      `select app.issue_telegram_evidence_decision_tokens(
        $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::uuid,$7::bigint,$8::uuid,$9::text,$10::text) as issued`,
      [input.workspaceId, input.projectId, input.telegramChatBindingId, input.occurrenceId,
        input.reviewSource.kind, input.reviewSource.id, input.reviewSource.generation,
        message.messageId, tokenHash(accepted), tokenHash(returned)],
    );
    if (issued.rows[0]?.issued !== true) throw new Error("telegram_decision_issue_raced");
    return "issued";
  });
}

async function listDueDecisionControls(limit: number): Promise<DueControlRow[]> {
  return withServiceTx(context(null), async (tx) => {
    const rows = await tx.query<DueControlRow>(
      "select * from app.list_due_telegram_evidence_decision_controls($1::integer)", [limit],
    );
    return rows.rows;
  });
}

export async function reconcileTelegramEvidenceDecisionControls(
  limit = 20,
  deps: {
    listDueControls?: (limit: number) => Promise<DueControlRow[]>;
    issueCallbacks?: typeof issueTelegramEvidenceDecisionCallbacks;
  } = {},
): Promise<{ scanned: number; issued: number; skipped: number; failed: number }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("invalid_decision_control_limit");
  const rows = await (deps.listDueControls ?? listDueDecisionControls)(limit);
  const result = { scanned: rows.length, issued: 0, skipped: 0, failed: 0 };
  for (const row of rows) {
    try {
      const outcome = await (deps.issueCallbacks ?? issueTelegramEvidenceDecisionCallbacks)({
        workspaceId: row.workspace_id, projectId: row.project_id,
        telegramChatBindingId: row.telegram_chat_binding_id, occurrenceId: row.requirement_occurrence_id,
        reviewSource: { kind: row.review_source_kind, id: row.review_source_id,
          generation: Number(row.review_source_generation) },
      });
      if (outcome === "issued") result.issued += 1;
      else result.skipped += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
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

export type TelegramDecisionAttemptRow = {
  id: string;
  token_id: string;
  workspace_id: string;
  project_id: string;
  telegram_chat_binding_id: string;
  requirement_occurrence_id: string;
  actor_user_id: string;
  actor_member_id: string;
  action: "accepted" | "returned";
  reason: string | null;
  return_reply_message_id: string | null;
  expected_version: string | number | null;
  idempotency_key: string;
  request_hash: string;
  status: "pending" | "completed" | "failed_permanent";
  decision_id: string | null;
  lease_id: string | null;
};

type DueControlRow = {
  workspace_id: string; project_id: string; telegram_chat_binding_id: string;
  requirement_occurrence_id: string; review_source_kind: "attachment" | "media_group";
  review_source_id: string; review_source_generation: string | number;
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
  startAttempt?: (row: TelegramDecisionTokenRow, replyMessageId: string | null,
    expectedVersion: number | null) => Promise<TelegramDecisionAttemptRow | null>;
  recordDecision?: typeof recordEvidenceDecision;
  finalizeAttempt?: (attempt: TelegramDecisionAttemptRow, decisionId: string) => Promise<void>;
  failAttempt?: (attempt: TelegramDecisionAttemptRow, code: string) => Promise<void>;
};

export class TelegramDecisionTransientError extends Error {
  readonly code = "telegram_decision_transient";
  readonly original: unknown;
  constructor(original: unknown) {
    super("telegram_decision_transient");
    this.name = "TelegramDecisionTransientError";
    this.original = original;
  }
}

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
      "select * from app.resolve_telegram_evidence_return_reply($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::bigint)",
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

async function startDecisionAttempt(
  row: TelegramDecisionTokenRow,
  replyMessageId: string | null,
  expectedVersion: number | null,
): Promise<TelegramDecisionAttemptRow | null> {
  const requestHash = tokenHash(`${row.id}:${row.action}:${replyMessageId ?? "none"}`);
  return withServiceTx(context(row.workspace_id), async (tx) => {
    const started = await tx.query<TelegramDecisionAttemptRow>(
      `select * from app.start_telegram_evidence_decision_attempt(
        $1::uuid,$2::uuid,$3::uuid,$4::bigint,$5::text)`,
      [row.id, row.actor_member_id, replyMessageId, expectedVersion, requestHash],
    );
    return started.rows[0] ?? null;
  });
}

async function finalizeDecisionAttempt(attempt: TelegramDecisionAttemptRow, decisionIdValue: string): Promise<void> {
  await withServiceTx(context(attempt.workspace_id), async (tx) => {
    const finalized = await tx.query<{ finalized: boolean }>(
      "select app.finalize_telegram_evidence_decision_attempt($1::uuid,$2::uuid,$3::uuid) as finalized",
      [attempt.id, attempt.lease_id, decisionIdValue],
    );
    if (finalized.rows[0]?.finalized !== true) throw new Error("telegram_decision_finalize_rejected");
  });
}

async function failDecisionAttempt(attempt: TelegramDecisionAttemptRow, code: string): Promise<void> {
  await withServiceTx(context(attempt.workspace_id), async (tx) => {
    const failed = await tx.query<{ failed: boolean }>(
      "select app.fail_telegram_evidence_decision_attempt($1::uuid,$2::uuid,$3::text) as failed",
      [attempt.id, attempt.lease_id, code],
    );
    if (failed.rows[0]?.failed !== true) throw new Error("telegram_decision_fail_rejected");
  });
}

function decisionId(result: DecisionResult): string {
  const value = (result.body as { decisionId?: unknown }).decisionId;
  if (typeof value !== "string") throw new Error("telegram_decision_result_invalid");
  return value;
}

function permanentDecisionFailure(error: unknown): error is HttpProblem {
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
  let activeRuntime: ReturnType<typeof runtime>;
  try {
    activeRuntime = runtime(deps);
  } catch (error) {
    throw new TelegramDecisionTransientError(error);
  }
  let acknowledged = false;
  const acknowledge = async (text: string) => {
    if (acknowledged) throw new Error("telegram_callback_acknowledged_twice");
    acknowledged = true;
    await activeRuntime.api.answerCallbackQuery({ callbackId: update.callbackId, text });
  };
  const claim = deps.claimToken ?? claimToken;
  const prompt = deps.enqueueReturnPrompt ?? enqueueReturnPrompt;
  const head = deps.readHeadVersion ?? readHeadVersion;
  const start = deps.startAttempt ?? startDecisionAttempt;
  const record = deps.recordDecision ?? recordEvidenceDecision;
  const finalize = deps.finalizeAttempt ?? finalizeDecisionAttempt;
  const fail = deps.failAttempt ?? failDecisionAttempt;
  let attempt: TelegramDecisionAttemptRow | null = null;

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
    attempt = await start(row, null, expectedVersion);
    if (!attempt || attempt.status === "failed_permanent") {
      await acknowledge("Дія недійсна або вже використана.");
      return "decision_callback_rejected";
    }
    if (attempt.status === "completed") {
      await acknowledge("Рішення вже зафіксовано.");
      return "decision_replayed";
    }
    const result = await record({
      actorUserId: attempt.actor_user_id,
      requestId: randomUUID(),
      occurrenceId: attempt.requirement_occurrence_id,
      body: { outcome: "accepted", issues: [], expectedVersion: attempt.expected_version === null
        ? null : Number(attempt.expected_version) },
      idempotencyKey: attempt.idempotency_key,
      requestHash: attempt.request_hash,
    });
    await finalize(attempt, decisionId(result));
    await acknowledge("Рішення зафіксовано.");
    return "decision_accepted";
  } catch (error) {
    if (acknowledged) throw error instanceof TelegramDecisionTransientError
      ? error : new TelegramDecisionTransientError(error);
    if (permanentDecisionFailure(error)) {
      if (attempt) {
        try {
          await fail(attempt, error.body.code);
        } catch (failError) {
          throw new TelegramDecisionTransientError(failError);
        }
      }
      try {
        await acknowledge("Дія недійсна або вже використана.");
      } catch (ackError) {
        throw new TelegramDecisionTransientError(ackError);
      }
      return "decision_callback_rejected";
    }
    try {
      await acknowledge("Не вдалося виконати дію. Спробуйте ще раз.");
    } catch (ackError) {
      throw new TelegramDecisionTransientError(ackError);
    }
    throw error instanceof TelegramDecisionTransientError
      ? error : new TelegramDecisionTransientError(error);
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
  const start = deps.startAttempt ?? startDecisionAttempt;
  const record = deps.recordDecision ?? recordEvidenceDecision;
  const finalize = deps.finalizeAttempt ?? finalizeDecisionAttempt;
  const fail = deps.failAttempt ?? failDecisionAttempt;
  let attempt: TelegramDecisionAttemptRow | null = null;
  try {
    const row = await resolve(input);
    if (!row) return null;
    const expectedVersion = await head(row);
    attempt = await start(row, input.messageId, expectedVersion);
    if (!attempt || attempt.status === "failed_permanent") return "decision_return_rejected";
    if (attempt.status === "completed") return "decision_returned";
    const result = await record({
      actorUserId: attempt.actor_user_id,
      requestId: randomUUID(),
      occurrenceId: attempt.requirement_occurrence_id,
      body: { outcome: "returned", reason: attempt.reason ?? reason, issues: [],
        expectedVersion: attempt.expected_version === null ? null : Number(attempt.expected_version) },
      idempotencyKey: attempt.idempotency_key,
      requestHash: attempt.request_hash,
    });
    await finalize(attempt, decisionId(result));
    return "decision_returned";
  } catch (error) {
    if (permanentDecisionFailure(error)) {
      if (attempt) {
        try {
          await fail(attempt, error.body.code);
        } catch (failError) {
          throw new TelegramDecisionTransientError(failError);
        }
      }
      return "decision_return_rejected";
    }
    throw error instanceof TelegramDecisionTransientError
      ? error : new TelegramDecisionTransientError(error);
  }
}

async function claimDecisionAttempts(input: { workerId: string; limit: number }): Promise<TelegramDecisionAttemptRow[]> {
  return withServiceTx(context(null), async (tx) => {
    const rows = await tx.query<TelegramDecisionAttemptRow>(
      "select * from app.claim_telegram_evidence_decision_attempts($1::integer,$2::text,$3::integer)",
      [input.limit, input.workerId, 60],
    );
    return rows.rows;
  });
}

async function retryDecisionAttempt(attempt: TelegramDecisionAttemptRow, code: string): Promise<void> {
  await withServiceTx(context(attempt.workspace_id), async (tx) => {
    const retried = await tx.query<{ retried: boolean }>(
      "select app.retry_telegram_evidence_decision_attempt($1::uuid,$2::uuid,$3::text) as retried",
      [attempt.id, attempt.lease_id, code],
    );
    if (retried.rows[0]?.retried !== true) throw new Error("telegram_decision_attempt_retry_rejected");
  });
}

type DecisionRecoveryDependencies = {
  claimAttempts?: (input: { workerId: string; limit: number }) => Promise<TelegramDecisionAttemptRow[]>;
  recordDecision?: typeof recordEvidenceDecision;
  finalizeAttempt?: (attempt: TelegramDecisionAttemptRow, decisionId: string) => Promise<void>;
  failAttempt?: (attempt: TelegramDecisionAttemptRow, code: string) => Promise<void>;
  retryAttempt?: (attempt: TelegramDecisionAttemptRow, code: string) => Promise<void>;
};

/** Bounded, lease-fenced replay of durable decision attempts. */
export async function recoverTelegramEvidenceDecisionAttempts(
  input: { workerId: string; limit: number },
  deps: DecisionRecoveryDependencies = {},
): Promise<{ claimed: number; completed: number; permanentFailed: number; retried: number; failed: number }> {
  if (!input.workerId.trim() || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new Error("invalid_decision_attempt_batch");
  }
  const attempts = await (deps.claimAttempts ?? claimDecisionAttempts)(input);
  const result = { claimed: attempts.length, completed: 0, permanentFailed: 0, retried: 0, failed: 0 };
  for (const attempt of attempts) {
    try {
      if (attempt.action === "returned" && !attempt.reason?.trim()) {
        await (deps.failAttempt ?? failDecisionAttempt)(attempt, "VALIDATION_FAILED");
        result.permanentFailed += 1;
        continue;
      }
      const recorded = await (deps.recordDecision ?? recordEvidenceDecision)({
        actorUserId: attempt.actor_user_id, requestId: randomUUID(),
        occurrenceId: attempt.requirement_occurrence_id,
        body: attempt.action === "accepted"
          ? { outcome: "accepted", issues: [], expectedVersion: attempt.expected_version === null
            ? null : Number(attempt.expected_version) }
          : { outcome: "returned", reason: attempt.reason!, issues: [], expectedVersion: attempt.expected_version === null
            ? null : Number(attempt.expected_version) },
        idempotencyKey: attempt.idempotency_key, requestHash: attempt.request_hash,
      });
      await (deps.finalizeAttempt ?? finalizeDecisionAttempt)(attempt, decisionId(recorded));
      result.completed += 1;
    } catch (error) {
      try {
        if (permanentDecisionFailure(error)) {
          await (deps.failAttempt ?? failDecisionAttempt)(attempt, error.body.code);
          result.permanentFailed += 1;
        } else {
          await (deps.retryAttempt ?? retryDecisionAttempt)(attempt, "telegram_decision_transient");
          result.retried += 1;
        }
      } catch {
        result.failed += 1;
      }
    }
  }
  return result;
}
