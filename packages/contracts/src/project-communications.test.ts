import { describe, expect, it } from "vitest";
import {
  projectCommunicationPage, telegramBindingIntentResponse, telegramMemberLinkIntentResponse,
} from "./project-communications";

describe("project communications contracts", () => {
  it("parses a normalized message page without provider secrets", () => {
    const page = projectCommunicationPage.parse({
      messages: [{
        messageId: crypto.randomUUID(), direction: "inbound", kind: "text",
        author: { memberId: null, displayName: "Іван", verified: false },
        text: "Роботу завершено", replyToMessageId: null, providerSentAt: null,
        serverReceivedAt: new Date().toISOString(), deliveryState: "received",
        attachments: [],
      }],
      nextCursor: null,
    });

    expect(JSON.stringify(page)).not.toContain("file_id");
    expect(JSON.stringify(page)).not.toContain("bot_token");
  });

  it("distinguishes a newly issued Telegram URL from its token-free idempotency replay", () => {
    const receipt = {
      intentId: crypto.randomUUID(), projectId: crypto.randomUUID(), memberId: crypto.randomUUID(),
      expiresAt: new Date().toISOString(),
    };

    expect(telegramBindingIntentResponse.parse({
      ...receipt, kind: "issued", telegramUrl: "https://t.me/GoProceedTestBot?startgroup=token",
    })).toMatchObject({ kind: "issued", telegramUrl: expect.any(String) });
    expect(telegramBindingIntentResponse.parse({ ...receipt, kind: "replayed" }))
      .toEqual({ ...receipt, kind: "replayed" });
    expect(telegramMemberLinkIntentResponse.parse({ ...receipt, kind: "replayed" }))
      .not.toHaveProperty("telegramUrl");
    expect(() => telegramBindingIntentResponse.parse({
      ...receipt, kind: "replayed", telegramUrl: "https://t.me/GoProceedTestBot?startgroup=token",
    })).toThrow();
  });
});
