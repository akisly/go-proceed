import { describe, expect, it } from "vitest";
import {
  projectCommunicationPage, projectCommunicationCommandResponse,
  retryProjectCommunicationRequest, telegramBindingIntentResponse, telegramMemberLinkIntentResponse,
} from "./project-communications";

describe("project communications contracts", () => {
  it("parses a normalized message page without provider secrets", () => {
    const page = projectCommunicationPage.parse({
      messages: [{
        messageId: crypto.randomUUID(), direction: "inbound", kind: "text",
        source: "telegram",
        author: { memberId: null, displayName: "Іван", role: null, verified: false },
        text: "Роботу завершено", replyToMessageId: null, providerSentAt: null,
        serverReceivedAt: new Date().toISOString(), deliveryState: "received",
        retryOfMessageId: null, workAssignmentId: null, events: [], attachments: [],
      }],
      nextCursor: null,
    });

    expect(JSON.stringify(page)).not.toContain("file_id");
    expect(JSON.stringify(page)).not.toContain("bot_token");
  });

  it("exposes staged provider metadata without claiming evidence processing", () => {
    expect(projectCommunicationPage.parse({
      messages: [{
        messageId: crypto.randomUUID(), direction: "inbound", kind: "photo",
        source: "telegram",
        author: { memberId: null, displayName: null, role: null, verified: false }, text: null,
        replyToMessageId: null, providerSentAt: null, serverReceivedAt: new Date().toISOString(),
        deliveryState: "received", retryOfMessageId: null, workAssignmentId: null, events: [], attachments: [{
          attachmentId: crypto.randomUUID(), filename: null, mediaType: "image/jpeg", byteSize: "123",
          state: "staged", requirementOccurrenceId: null, evidenceObjectId: null,
          evidenceDecisionId: null, failureCode: null,
        }],
      }],
      nextCursor: null,
    }).messages[0]?.attachments[0]?.state).toBe("staged");
  });

  it("defines Telegram-fixed reply receipts and an explicit unknown-delivery acknowledgement", () => {
    const receipt = projectCommunicationCommandResponse.parse({
      messageId: crypto.randomUUID(), channel: "telegram", deliveryState: "queued",
      replyToMessageId: null, retryOfMessageId: null,
    });
    expect(receipt.channel).toBe("telegram");
    expect(receipt).not.toHaveProperty("recipient");
    expect(retryProjectCommunicationRequest.parse({ acknowledgePossibleDuplicate: true }))
      .toEqual({ acknowledgePossibleDuplicate: true });
    expect(() => retryProjectCommunicationRequest.parse({ acknowledgePossibleDuplicate: "yes" })).toThrow();
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
