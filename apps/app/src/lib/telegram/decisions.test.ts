import { describe, expect, it, vi } from "vitest";
import { HttpProblem, problem } from "../http";
import { formatEvidenceDecisionActions } from "./cards";
import {
  isTelegramDecisionCallback,
  processTelegramDecisionCallback,
  processTelegramDecisionReturnReply,
  TelegramDecisionTransientError,
  type TelegramDecisionDependencies,
} from "./decisions";

const callback = {
  kind: "callback_query" as const, updateId: "1", callbackId: "callback",
  senderId: "7", chatId: "8", messageId: "9", data: "dec:opaque-server-token-1",
};
const tokenRow = {
  id: "10000000-0000-4000-8000-000000000001", workspace_id: "10000000-0000-4000-8000-000000000002",
  project_id: "10000000-0000-4000-8000-000000000003", telegram_chat_binding_id: "10000000-0000-4000-8000-000000000004",
  requirement_occurrence_id: "10000000-0000-4000-8000-000000000005", actor_user_id: "10000000-0000-4000-8000-000000000006",
  actor_member_id: "10000000-0000-4000-8000-000000000007", action: "accepted" as const, consumed_at: null,
  return_prompt_message_id: null, work_assignment_id: "10000000-0000-4000-8000-000000000008",
};

function callbackDeps(overrides: Partial<TelegramDecisionDependencies> = {}): TelegramDecisionDependencies {
  return {
    botId: "123456789", api: { answerCallbackQuery: vi.fn(async (): Promise<void> => undefined) },
    claimToken: vi.fn(async () => tokenRow),
    enqueueReturnPrompt: vi.fn(async (): Promise<"prompted"> => "prompted"),
    resolveReturnReply: vi.fn(async () => tokenRow), readHeadVersion: vi.fn(async () => null),
    recordDecision: vi.fn(async () => ({ status: 201, body: { decisionId: "10000000-0000-4000-8000-000000000009" } })),
    finalizeDecision: vi.fn(async () => undefined), ...overrides,
  };
}

describe("Telegram evidence decisions", () => {
  it("recognizes only the explicit opaque decision callback namespace", () => {
    expect(isTelegramDecisionCallback("dec:opaque-server-token-1")).toBe(true);
    expect(isTelegramDecisionCallback("ок")).toBe(false);
    expect(isTelegramDecisionCallback("req:opaque-selection-token")).toBe(false);
  });

  it("renders decision controls as plain text because text delivery has no HTML parse mode", () => {
    const rendered = formatEvidenceDecisionActions({ acceptedCallback: "dec:accepted", returnedCallback: "dec:returned" });
    expect(rendered.text).toBe("GoProceed\nОберіть явну дію щодо доказів.");
    expect(rendered).not.toHaveProperty("parseMode");
  });

  it("treats ordinary ok text as chat, never a return decision", async () => {
    await expect(processTelegramDecisionReturnReply({
      workspaceId: "workspace", telegramChatBindingId: "binding", senderId: "7",
      messageId: "message", replyToMessageId: null, text: "ок",
    })).resolves.toBeNull();
  });

  it("requires a nonblank reply before it can begin a return decision", async () => {
    await expect(processTelegramDecisionReturnReply({
      workspaceId: "workspace", telegramChatBindingId: "binding", senderId: "7",
      messageId: "message", replyToMessageId: "12", text: "   ",
    })).resolves.toBeNull();
  });

  it("records acceptance and invokes the acknowledgement sender exactly once", async () => {
    const deps = callbackDeps();
    await expect(processTelegramDecisionCallback(callback, deps)).resolves.toBe("decision_accepted");
    expect(deps.recordDecision).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: tokenRow.actor_user_id,
      occurrenceId: tokenRow.requirement_occurrence_id, body: { outcome: "accepted", issues: [], expectedVersion: null } }));
    expect(deps.finalizeDecision).toHaveBeenCalledTimes(1);
    expect(deps.finalizeDecision).toHaveBeenCalledWith(tokenRow, "10000000-0000-4000-8000-000000000009", null);
    expect(deps.api?.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("terminalizes a permanent refusal with one acknowledgement", async () => {
    const deps = callbackDeps({ recordDecision: vi.fn(async () => {
      throw new HttpProblem(403, problem("READINESS_OVERRIDE_DENIED", "denied"));
    }) });
    await expect(processTelegramDecisionCallback(callback, deps)).resolves.toBe("decision_callback_rejected");
    expect(deps.finalizeDecision).not.toHaveBeenCalled();
    expect(deps.api?.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("rejects a wrong-group, unlinked, expired, or archived resolver miss without a decision", async () => {
    const deps = callbackDeps({ claimToken: vi.fn(async () => null) });
    await expect(processTelegramDecisionCallback(callback, deps)).resolves.toBe("decision_callback_rejected");
    expect(deps.recordDecision).not.toHaveBeenCalled();
    expect(deps.api?.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("converges concurrent return callbacks on the one durable prompt", async () => {
    const returned = { ...tokenRow, action: "returned" as const };
    const deps = callbackDeps({
      claimToken: vi.fn(async () => returned),
      enqueueReturnPrompt: vi.fn(async (): Promise<"already_prompted"> => "already_prompted"),
    });
    await expect(processTelegramDecisionCallback(callback, deps)).resolves.toBe("reason_required");
    expect(deps.enqueueReturnPrompt).toHaveBeenCalledTimes(1);
    expect(deps.recordDecision).not.toHaveBeenCalled();
    expect(deps.api?.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("acknowledges an idempotent accepted-token replay without recording again", async () => {
    const deps = callbackDeps({ claimToken: vi.fn(async () => ({ ...tokenRow, consumed_at: new Date(0).toISOString() })) });
    await expect(processTelegramDecisionCallback(callback, deps)).resolves.toBe("decision_replayed");
    expect(deps.recordDecision).not.toHaveBeenCalled();
    expect(deps.finalizeDecision).not.toHaveBeenCalled();
    expect(deps.api?.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("surfaces transient command failure after one acknowledgement attempt", async () => {
    const failure = new Error("database unavailable");
    const deps = callbackDeps({ recordDecision: vi.fn(async () => { throw failure; }) });
    const thrown = await processTelegramDecisionCallback(callback, deps).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(TelegramDecisionTransientError);
    expect((thrown as TelegramDecisionTransientError).original).toBe(failure);
    expect(deps.finalizeDecision).not.toHaveBeenCalled();
    expect(deps.api?.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  it("surfaces acknowledgement delivery failure and never attempts it twice", async () => {
    const failure = new Error("telegram unavailable");
    const sender = vi.fn(async () => { throw failure; });
    const deps = callbackDeps({ api: { answerCallbackQuery: sender } });
    const thrown = await processTelegramDecisionCallback(callback, deps).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(TelegramDecisionTransientError);
    expect((thrown as TelegramDecisionTransientError).original).toBe(failure);
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("surfaces config/client factory failure instead of reporting a fictitious acknowledgement", async () => {
    const failure = new Error("missing Telegram config");
    const sender = vi.fn(async (): Promise<void> => undefined);
    const factory = vi.fn(() => { throw failure; });
    const thrown = await processTelegramDecisionCallback(callback, { createApi: factory }).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(TelegramDecisionTransientError);
    expect((thrown as TelegramDecisionTransientError).original).toBe(failure);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(sender).not.toHaveBeenCalled();
  });

  it("replays the exact return message after a transient failure and finalizes once", async () => {
    const failure = new Error("pool timeout");
    const record = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ status: 201, body: { decisionId: "10000000-0000-4000-8000-000000000009" } });
    const deps = callbackDeps({ recordDecision: record });
    const input = { workspaceId: tokenRow.workspace_id, telegramChatBindingId: tokenRow.telegram_chat_binding_id,
      senderId: "7", messageId: "10000000-0000-4000-8000-000000000010", replyToMessageId: "12", text: "Недоліки" };
    const first = await processTelegramDecisionReturnReply(input, deps).catch((error: unknown) => error);
    expect(first).toBeInstanceOf(TelegramDecisionTransientError);
    expect((first as TelegramDecisionTransientError).original).toBe(failure);
    await expect(processTelegramDecisionReturnReply(input, deps)).resolves.toBe("decision_returned");
    expect(deps.resolveReturnReply).toHaveBeenCalledTimes(2);
    expect(deps.finalizeDecision).toHaveBeenCalledTimes(1);
    expect(deps.finalizeDecision).toHaveBeenCalledWith(tokenRow,
      "10000000-0000-4000-8000-000000000009", input.messageId);
  });

  it("terminalizes permanent return refusal but preserves transient failure for inbox retry", async () => {
    const input = { workspaceId: tokenRow.workspace_id, telegramChatBindingId: tokenRow.telegram_chat_binding_id,
      senderId: "7", messageId: "10000000-0000-4000-8000-000000000010", replyToMessageId: "12", text: "Недоліки" };
    const permanent = callbackDeps({ recordDecision: vi.fn(async () => {
      throw new HttpProblem(409, problem("OCCURRENCE_CONFLICT", "stale"));
    }) });
    await expect(processTelegramDecisionReturnReply(input, permanent)).resolves.toBe("decision_return_rejected");
    const failure = new Error("pool timeout");
    const transient = callbackDeps({ recordDecision: vi.fn(async () => { throw failure; }) });
    const thrown = await processTelegramDecisionReturnReply(input, transient).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(TelegramDecisionTransientError);
    expect((thrown as TelegramDecisionTransientError).original).toBe(failure);
  });

  it("classifies return-reply resolver infrastructure failure as retryable", async () => {
    const failure = new Error("service pool unavailable");
    const deps = callbackDeps({ resolveReturnReply: vi.fn(async () => { throw failure; }) });
    const input = { workspaceId: tokenRow.workspace_id, telegramChatBindingId: tokenRow.telegram_chat_binding_id,
      senderId: "7", messageId: "10000000-0000-4000-8000-000000000010", replyToMessageId: "12", text: "Недоліки" };
    const thrown = await processTelegramDecisionReturnReply(input, deps).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(TelegramDecisionTransientError);
    expect((thrown as TelegramDecisionTransientError).original).toBe(failure);
  });
});
