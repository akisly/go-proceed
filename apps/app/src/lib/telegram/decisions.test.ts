import { describe, expect, it } from "vitest";
import { isTelegramDecisionCallback, processTelegramDecisionReturnReply } from "./decisions";

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
});
