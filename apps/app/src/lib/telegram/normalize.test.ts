import { describe, expect, it } from "vitest";
import { normalizeTelegramUpdate } from "./normalize";

const messageFixture = {
  update_id: 1001,
  message: {
    message_id: 77,
    date: 1_735_689_600,
    from: { id: 42, first_name: "Іван", last_name: "Будівельник" },
    chat: { id: -100123, type: "supergroup" },
    text: "Роботу завершено",
    reply_to_message: { message_id: 12 },
    media_group_id: "media-1",
  },
};

const editedMessageFixture = {
  update_id: 1002,
  edited_message: {
    message_id: 78,
    edit_date: 1_735_689_660,
    chat: { id: -100123, type: "supergroup" },
    text: "Уточнений текст",
  },
};

const callbackFixture = {
  update_id: 1003,
  callback_query: {
    id: "callback-1",
    from: { id: 42, first_name: "Іван" },
    data: "occurrence:one",
    message: {
      message_id: 79,
      chat: { id: -100123, type: "supergroup" },
    },
  },
};

const membershipFixture = {
  update_id: 1004,
  my_chat_member: {
    chat: { id: -100123, type: "supergroup" },
    new_chat_member: { status: "member" },
  },
};

function startGroupFixture(payload: string) {
  return {
    update_id: 1005,
    message: {
      message_id: 80,
      date: 1_735_689_600,
      from: { id: 42, first_name: "Іван" },
      chat: { id: -100123, type: "supergroup" },
      text: `/startgroup ${payload}`,
    },
  };
}

describe("normalizeTelegramUpdate", () => {
  it.each([
    [messageFixture, "message"],
    [editedMessageFixture, "edited_message"],
    [callbackFixture, "callback_query"],
    [membershipFixture, "my_chat_member"],
  ] as const)("normalizes %s", (input, kind) => {
    expect(normalizeTelegramUpdate(input).kind).toBe(kind);
  });

  it("keeps provider identifiers as decimal strings", () => {
    const normalized = normalizeTelegramUpdate(messageFixture);
    expect(normalized).toMatchObject({ updateId: "1001", chatId: "-100123", messageId: "77", senderId: "42" });
  });

  it("redacts /start and /startgroup payloads from normalized text and snapshots", () => {
    const normalized = normalizeTelegramUpdate(startGroupFixture("secret-token"));
    expect(normalized).toMatchObject({ kind: "message", text: null, command: { kind: "startgroup", hasPayload: true } });
    expect(JSON.stringify(normalized)).not.toContain("secret-token");
  });

  it("normalizes the largest photo rendition as one file candidate", () => {
    const normalized = normalizeTelegramUpdate({
      update_id: 1006,
      message: {
        ...messageFixture.message,
        photo: [
          { file_id: "small", file_unique_id: "small-u", width: 90, height: 90, file_size: 10 },
          { file_id: "large", file_unique_id: "large-u", width: 1000, height: 1000, file_size: 100 },
        ],
        text: undefined,
      },
    });
    expect(normalized).toMatchObject({
      files: [{ kind: "photo", fileId: "large", fileUniqueId: "large-u", fileSize: 100 }],
      text: null,
    });
  });

  it("selects the largest photo pixel area when file sizes are absent", () => {
    const normalized = normalizeTelegramUpdate({
      update_id: 1008,
      message: {
        ...messageFixture.message,
        photo: [
          { file_id: "wide", file_unique_id: "wide-u", width: 200, height: 100 },
          { file_id: "tall", file_unique_id: "tall-u", width: 100, height: 300 },
        ],
        text: undefined,
      },
    });
    expect(normalized).toMatchObject({ files: [{ fileId: "tall" }] });
  });

  it("returns unsupported for updates outside the adapter boundary", () => {
    expect(normalizeTelegramUpdate({ update_id: 1007, channel_post: {} })).toEqual({
      kind: "unsupported",
      updateId: "1007",
      reason: "unsupported_update_type",
    });
  });
});
