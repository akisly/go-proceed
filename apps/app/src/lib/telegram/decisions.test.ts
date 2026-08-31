import { describe, expect, it } from "vitest";
import { isTelegramDecisionCallback, processTelegramDecisionCallback, processTelegramDecisionReturnReply } from "./decisions";

describe("Telegram evidence decisions", () => {
  it("recognizes only the explicit opaque decision callback namespace", () => {
    expect(isTelegramDecisionCallback("dec:opaque-server-token-1")).toBe(true);
    expect(isTelegramDecisionCallback("ок")).toBe(false);
    expect(isTelegramDecisionCallback("req:opaque-selection-token")).toBe(false);
  });

  it("treats ordinary ok text as chat, never a return decision", async () => {
    await expect(processTelegramDecisionReturnReply({
      workspaceId: "workspace", telegramChatBindingId: "binding", senderId: "7",
      replyToMessageId: null, text: "ок",
    })).resolves.toBeNull();
  });

  it("requires a nonblank reply before it can begin a return decision", async () => {
    await expect(processTelegramDecisionReturnReply({
      workspaceId: "workspace", telegramChatBindingId: "binding", senderId: "7",
      replyToMessageId: "12", text: "   ",
    })).resolves.toBeNull();
  });

  it("attempts exactly one callback acknowledgement for a rejected explicit action", async () => {
    const answers: string[] = [];
    await expect(processTelegramDecisionCallback({
      kind: "callback_query", updateId: "1", callbackId: "callback", senderId: "7", chatId: "8", messageId: "9",
      data: "dec:opaque-server-token-1",
    }, { answerCallbackQuery: async ({ text }) => { answers.push(text); } })).resolves.toBe("decision_callback_failed");
    expect(answers).toHaveLength(1);
  });
});
