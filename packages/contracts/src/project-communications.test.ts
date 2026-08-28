import { describe, expect, it } from "vitest";
import { projectCommunicationPage } from "./project-communications";

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
});
